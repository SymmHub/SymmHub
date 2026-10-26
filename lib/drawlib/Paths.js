//
//  paths: items whose outline is cubic Bezier segments between nodes
//
//    { type: 'path', closed,
//      nodes: [{ p: [x, y], h1: [x, y] | null, h2: [x, y] | null, smooth }],
//      points: [x, y, ...] }
//
//  Node i has its point p, the handle h1 of the segment coming from node
//  i - 1 and the handle h2 of the segment going to node i + 1 (a closed path
//  goes from the last node back to the first); a segment without handles is
//  a straight line; smooth marks a node whose handles are kept in line.
//  points is the outline flattened (flattenNodes): what the hit tests, the
//  fold, the sprite boxes and the canvas outline use; the renderer draws the
//  curves. Every edit of the nodes goes through withNodes(), which flattens
//  again.
//

const FLAT_TOL = 2e-3;   // flattening tolerance, as a fraction of the path's extent
const MAX_DEPTH = 6;     // at most 64 pieces per segment

const lerp = (a, b, t) => [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t];

/** the extent of the nodes with their handles: the larger side of their box */
function extentOf(nodes){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) for (const q of [n.p, n.h1, n.h2]) {
        if (!q) continue;
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
    return Math.max(x1 - x0, y1 - y0, 1e-9);
}

/** the cubic from node i to node j: {p0, c1, c2, p3, straight} */
function segmentOf(nodes, i, j){
    const a = nodes[i], b = nodes[j];
    return { p0: a.p, c1: a.h2 || a.p, c2: b.h1 || b.p, p3: b.p, straight: !a.h2 && !b.h1 };
}

/** how far the control points stray from the chord */
function flatness(seg){
    const [ax, ay] = seg.p0, [bx, by] = seg.p3;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const d = q => len > 1e-12 ? Math.abs((q[0] - ax)*dy - (q[1] - ay)*dx)/len : Math.hypot(q[0] - ax, q[1] - ay);
    return Math.max(d(seg.c1), d(seg.c2));
}

/** the cubic split at t (de Casteljau): [first half, second half] */
function splitCubic(seg, t){
    const p01 = lerp(seg.p0, seg.c1, t), p12 = lerp(seg.c1, seg.c2, t), p23 = lerp(seg.c2, seg.p3, t);
    const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);
    return [{ p0: seg.p0, c1: p01, c2: p012, p3: m }, { p0: m, c1: p123, c2: p23, p3: seg.p3 }];
}

function subdivide(seg, t0, t1, depth, tol, emit){
    if (depth >= MAX_DEPTH || flatness(seg) <= tol) { emit(seg.p3, t0, t1); return; }
    const [a, b] = splitCubic(seg, 0.5);
    const tm = 0.5*(t0 + t1);
    subdivide(a, t0, tm, depth + 1, tol, emit);
    subdivide(b, tm, t1, depth + 1, tol, emit);
}

/**
 * the outline flattened: points [x, y, ...] (the first node's point first),
 * and per piece between two points in a row (the last piece of a closed path
 * back to the first point) the segment it lies on and its parameter range
 * {seg, t0, t1}
 */
function flattenDetailed(nodes, closed, tol){
    const n = nodes.length;
    const points = [], pieces = [];
    if (!n) return { points, pieces };
    if (tol === undefined) tol = FLAT_TOL*extentOf(nodes);
    points.push(nodes[0].p[0], nodes[0].p[1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
        const seg = segmentOf(nodes, i, (i + 1) % n);
        const emit = (p, t0, t1) => { pieces.push({ seg: i, t0, t1 }); points.push(p[0], p[1]); };
        if (seg.straight) emit(seg.p3, 0, 1);
        else subdivide(seg, 0, 1, 0, tol, emit);
    }
    // the closing segment ends at the first point
    if (closed && segs > 0) points.length -= 2;
    return { points, pieces };
}

function flattenNodes(nodes, closed, tol){
    return flattenDetailed(nodes, closed, tol).points;
}

/** the item with these nodes, its points flattened from them */
function withNodes(item, nodes){
    return { ...item, type: 'path', nodes, points: flattenNodes(nodes, item.closed) };
}

const copyPoint = q => q ? [q[0], q[1]] : null;

function mappedNodes(nodes, map){
    return nodes.map(n => ({ ...n, p: map(n.p), h1: n.h1 ? map(n.h1) : null, h2: n.h2 ? map(n.h2) : null }));
}

function movedNodes(nodes, dx, dy){
    return mappedNodes(nodes, q => [q[0] + dx, q[1] + dy]);
}

/** node i moved to x, its handles along */
function nodeMoved(nodes, i, x){
    const n = nodes[i];
    const dx = x[0] - n.p[0], dy = x[1] - n.p[1];
    const moved = { ...n, p: [x[0], x[1]], h1: n.h1 ? [n.h1[0] + dx, n.h1[1] + dy] : null, h2: n.h2 ? [n.h2[0] + dx, n.h2[1] + dy] : null };
    return nodes.map((m, k) => k === i ? moved : m);
}

/**
 * handle which ('h1' or 'h2') of node i moved to x; with keepSmooth a
 * smooth node turns its other handle to stay in line, its length kept,
 * and without it the node becomes a corner
 */
function handleMoved(nodes, i, which, x, keepSmooth){
    const n = nodes[i];
    const other = which === 'h1' ? 'h2' : 'h1';
    const moved = { ...n, [which]: [x[0], x[1]] };
    if (keepSmooth && n.smooth && n[other]) {
        const dx = x[0] - n.p[0], dy = x[1] - n.p[1], len = Math.hypot(dx, dy);
        const olen = Math.hypot(n[other][0] - n.p[0], n[other][1] - n.p[1]);
        if (len > 1e-12) moved[other] = [n.p[0] - dx/len*olen, n.p[1] - dy/len*olen];
    } else if (!keepSmooth) {
        moved.smooth = false;
    }
    return nodes.map((m, k) => k === i ? moved : m);
}

/** node i with its handles pulled out to x (h2 at x, h1 opposite): a smooth node */
function nodeHandlesPulled(nodes, i, x){
    const n = nodes[i];
    const moved = { ...n, h2: [x[0], x[1]], h1: [2*n.p[0] - x[0], 2*n.p[1] - x[1]], smooth: true };
    return nodes.map((m, k) => k === i ? moved : m);
}

/**
 * node i a corner when it was smooth, else smooth: its handles put in line
 * (made from the neighbours, a third of the way to them, when it has none)
 */
function nodeSmoothToggled(nodes, i, closed){
    const n = nodes[i], count = nodes.length;
    if (n.smooth) return nodes.map((m, k) => k === i ? { ...m, smooth: false } : m);
    const prev = (i > 0 || closed) ? nodes[(i - 1 + count) % count] : null;
    const next = (i < count - 1 || closed) ? nodes[(i + 1) % count] : null;
    let d;
    if (n.h1 && n.h2) d = [n.h2[0] - n.h1[0], n.h2[1] - n.h1[1]];
    else if (n.h2) d = [n.h2[0] - n.p[0], n.h2[1] - n.p[1]];
    else if (n.h1) d = [n.p[0] - n.h1[0], n.p[1] - n.h1[1]];
    else if (prev && next) d = [next.p[0] - prev.p[0], next.p[1] - prev.p[1]];
    else if (next) d = [next.p[0] - n.p[0], next.p[1] - n.p[1]];
    else if (prev) d = [n.p[0] - prev.p[0], n.p[1] - prev.p[1]];
    else d = [1, 0];
    const len = Math.hypot(d[0], d[1]) || 1;
    const u = [d[0]/len, d[1]/len];
    const l1 = n.h1 ? Math.hypot(n.h1[0] - n.p[0], n.h1[1] - n.p[1]) : (prev ? Math.hypot(prev.p[0] - n.p[0], prev.p[1] - n.p[1])/3 : 0);
    const l2 = n.h2 ? Math.hypot(n.h2[0] - n.p[0], n.h2[1] - n.p[1]) : (next ? Math.hypot(next.p[0] - n.p[0], next.p[1] - n.p[1])/3 : 0);
    const moved = { ...n, smooth: true,
                    h1: l1 > 0 ? [n.p[0] - u[0]*l1, n.p[1] - u[1]*l1] : null,
                    h2: l2 > 0 ? [n.p[0] + u[0]*l2, n.p[1] + u[1]*l2] : null };
    return nodes.map((m, k) => k === i ? moved : m);
}

/** a node added on segment i (from node i to the next) at its parameter t: the curve keeps its shape */
function splitSegment(nodes, closed, i, t){
    const n = nodes.length, j = (i + 1) % n;
    const seg = segmentOf(nodes, i, j);
    const out = nodes.map(m => ({ ...m, p: copyPoint(m.p), h1: copyPoint(m.h1), h2: copyPoint(m.h2) }));
    let fresh;
    if (seg.straight) {
        fresh = { p: lerp(seg.p0, seg.p3, t), h1: null, h2: null };
    } else {
        const [a, b] = splitCubic(seg, t);
        out[i].h2 = a.c1;
        out[j].h1 = b.c2;
        fresh = { p: a.p3, h1: a.c2, h2: b.c1, smooth: true };
    }
    out.splice(i + 1, 0, fresh);
    return out;
}

/** the nodes without node i (its neighbours keep their handles) */
function removeNode(nodes, i){
    return nodes.filter((m, k) => k !== i);
}

/** a polyline as a path of straight segments */
function pathFromPolyline(item){
    const nodes = [];
    for (let i = 0; i + 1 < item.points.length; i += 2) nodes.push({ p: [item.points[i], item.points[i + 1]], h1: null, h2: null });
    return withNodes(item, nodes);
}

/** a path as a polyline through its flattened outline */
function polylineFromPath(item){
    const out = { ...item, type: 'polyline', points: item.points.slice() };
    delete out.nodes;
    return out;
}

export { flattenNodes, flattenDetailed, withNodes, mappedNodes, movedNodes, nodeMoved, handleMoved, nodeHandlesPulled, nodeSmoothToggled,
         splitSegment, removeNode, pathFromPolyline, polylineFromPath };
