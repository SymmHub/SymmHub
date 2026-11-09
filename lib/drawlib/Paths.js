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
//  A compound path has several closed rings, its islands and holes (the fill
//  rule of its style tells which): nodes holds them one after the other,
//  ringEnd marking the last node of every ring but the last. Its points stay
//  one outline: the rings joined by bridges from the first node to the first
//  node of each ring, each bridge walked there and back, so that it adds
//  nothing to what is inside under either rule. All that reads points as a
//  polygon or a box needs nothing more; only what draws or picks the line
//  itself leaves the bridges out (itemBridges, traceNodes).
//
//  A geodesic path (geodesic: true) has the same nodes, but its segments
//  without handles are the straight lines of the group's geometry (the
//  hyperbolic plane, the sphere), arcs on screen, and its segments with
//  handles the cubics of that geometry through the same control points (an
//  isometry applied to the nodes and handles gives the image of the path).
//  What is drawn is its outline: { nodes, source, key }, the nodes of an
//  ordinary cubic path that stands for it (geodesicOutline: every arc and
//  every such cubic as cubic pieces), made by the document from the nodes
//  and the geometry in force (DrawingDocument's outliner) and not saved. A
//  node's handles are edited in the chart of the node (the chart argument
//  of nodeMoved, handleMoved and the others). The tools edit the nodes; all that draws or
//  flattens reads the outline in their place (drawnNodes), so points is the
//  outline flattened. source tells the part of the path's segment each
//  segment of the outline is (flattenItem, outlinePoint). A geodesic shape
//  (Shapes.js) is such a path whose nodes come from its numbers; a node of
//  its marked plain starts a side that is the plain cubic of its handles
//  (the pieces fitted to an arc of the shape), drawn as it is.
//

import {
    shapeMapped,
} from './modules.js';

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
    const points = [], pieces = [];
    if (!nodes.length) return { points, pieces };
    if (tol === undefined) tol = FLAT_TOL*extentOf(nodes);
    const rings = nodeRings(nodes), hub = nodes[0].p;
    const bridge = (p) => { pieces.push({ seg: -1, t0: 0, t1: 1 }); points.push(p[0], p[1]); };
    points.push(hub[0], hub[1]);
    rings.forEach(([first, last], k) => {
        if (k) bridge(nodes[first].p);
        for (let i = first; i < (closed ? last + 1 : last); i++) {
            const seg = segmentOf(nodes, i, i === last ? first : i + 1);
            const emit = (p, t0, t1) => { pieces.push({ seg: i, t0, t1 }); points.push(p[0], p[1]); };
            if (seg.straight) emit(seg.p3, 0, 1);
            else subdivide(seg, 0, 1, 0, tol, emit);
        }
        if (k && k < rings.length - 1) bridge(hub);
    });
    // the closing segment ends at the first point; after several rings the last bridge does
    if (rings.length > 1) pieces.push({ seg: -1, t0: 0, t1: 1 });
    else if (closed) points.length -= 2;
    return { points, pieces };
}

function flattenNodes(nodes, closed, tol){
    return flattenDetailed(nodes, closed, tol).points;
}

/** the rings of the nodes: [first, last] of each, in order; one for an ordinary path */
function nodeRings(nodes){
    const rings = [];
    let first = 0;
    nodes.forEach((m, i) => { if (m.ringEnd || i === nodes.length - 1) { rings.push([first, i]); first = i + 1; } });
    return rings;
}

/** the node after i on a closed outline: past the last of its ring the first of it */
function nextNode(nodes, i){
    if (!nodes[i].ringEnd && i < nodes.length - 1) return i + 1;
    let k = i;
    while (k > 0 && !nodes[k - 1].ringEnd) k--;
    return k;
}

/** the node before i on a closed outline */
function prevNode(nodes, i){
    if (i > 0 && !nodes[i - 1].ringEnd) return i - 1;
    let k = i;
    while (k < nodes.length - 1 && !nodes[k].ringEnd) k++;
    return k;
}

/**
 * the outline on a sink with Path2D's moveTo, lineTo, bezierCurveTo and
 * closePath, a moveTo per ring: the curves as they are, without the bridges
 */
function traceNodes(nodes, closed, sink){
    for (const [first, last] of nodeRings(nodes)) {
        sink.moveTo(nodes[first].p[0], nodes[first].p[1]);
        for (let i = first; i < (closed ? last + 1 : last); i++) {
            const a = nodes[i], b = nodes[i === last ? first : i + 1];
            if (!a.h2 && !b.h1) sink.lineTo(b.p[0], b.p[1]);
            else { const c1 = a.h2 || a.p, c2 = b.h1 || b.p; sink.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b.p[0], b.p[1]); }
        }
        if (closed) sink.closePath();
    }
}

// ── geodesic paths ───────────────────────────────────────────────────────────

/** the nodes an item is drawn and flattened by: a geodesic path's outline, else its own */
function drawnNodes(item){
    return (item.outline && item.outline.nodes) || item.nodes;
}

/**
 * the outline that stands for a geodesic path: the nodes of an ordinary cubic
 * path in which every segment without handles is the geodesic between its
 * ends, as the cubic pieces that pieces(P, Q) gives ([{c1, c2, p}] from P to
 * Q, invlib's geodesicCubics; null: the straight segment), and a segment
 * with handles is the cubic of the geometry through its control points, as
 * the cubic pieces that curve(P0, C1, C2, P3) gives ([{c1, c2, p, t0, t1}],
 * invlib's geodesicCurveCubics; null, or no curve: the cubic it is; a
 * missing handle is a control point on its node); a segment from a node
 * marked plain is the cubic of its handles as it is. A smooth node stays
 * smooth. {nodes, source}: source[k] tells what the outline's segment from
 * its node k to the next one of its ring is, {seg (the node of the path
 * its segment starts from), t0, t1 (the part of that segment)}, null for a
 * node no segment starts from
 */
function geodesicOutline(nodes, closed, pieces, curve = null){
    const out = [], source = [];
    const copy = q => (q ? [q[0], q[1]] : null);
    const rings = nodeRings(nodes);
    rings.forEach(([first, last], ringIndex) => {
        const start = out.length;
        // the handle the segment before leaves at the node it ends at
        let h1 = null;
        for (let i = first; i <= last; i++) {
            const a = nodes[i];
            out.push({ p: copy(a.p), h1, h2: null, ...(a.smooth ? { smooth: true } : {}) });
            source.push(null);
            h1 = null;
            if (i === last && !closed) break;
            const b = nodes[i === last ? first : i + 1];
            const parts = a.plain ? [{ c1: a.h2, c2: b.h1, p: b.p }]
                        : (a.h2 || b.h1) ? ((curve && curve(a.p, a.h2 || a.p, b.h1 || b.p, b.p)) || [{ c1: a.h2, c2: b.h1, p: b.p }])
                                         : (pieces(a.p, b.p) || [{ c1: null, c2: null, p: b.p }]);
            parts.forEach((part, m) => {
                const at = out.length - 1;
                out[at].h2 = copy(part.c1);
                // the part of the segment: the piece's own, else the pieces share it evenly (an arc's)
                source[at] = { seg: i, t0: part.t0 ?? m/parts.length, t1: part.t1 ?? (m + 1)/parts.length };
                if (m < parts.length - 1) {
                    // a node inside an arc: its handles in line
                    out.push({ p: copy(part.p), h1: copy(part.c2), h2: null, smooth: true });
                    source.push(null);
                } else {
                    h1 = copy(part.c2);
                }
            });
        }
        // the closing segment ends at the ring's first node
        if (closed) out[start].h1 = h1;
        if (ringIndex < rings.length - 1) out[out.length - 1].ringEnd = true;
    });
    return { nodes: out, source };
}

/**
 * the item's outline flattened as flattenDetailed gives it, with the pieces
 * told in the item's own nodes: for a geodesic path each piece of its
 * outline is the part {seg, t0, t1} of the path's segment it lies on
 */
function flattenItem(item, tol){
    const o = item.outline;
    if (!o || !o.nodes) return flattenDetailed(item.nodes, item.closed, tol);
    const flat = flattenDetailed(o.nodes, item.closed, tol);
    const pieces = flat.pieces.map(piece => {
        const src = piece.seg >= 0 ? o.source[piece.seg] : null;
        if (!src) return piece;
        const span = src.t1 - src.t0;
        return { seg: src.seg, t0: src.t0 + span*piece.t0, t1: src.t0 + span*piece.t1 };
    });
    return { points: flat.points, pieces };
}

/** the point of a geodesic path's outline on the path's segment seg (from node seg to the next) at its parameter t; null without it */
function outlinePoint(item, seg, t){
    const o = item.outline;
    if (!o || !o.nodes) return null;
    for (let k = 0; k < o.nodes.length; k++) {
        const src = o.source[k];
        if (!src || src.seg !== seg || t < src.t0 - 1e-12 || t > src.t1 + 1e-12) continue;
        const a = o.nodes[k], b = o.nodes[nextNode(o.nodes, k)];
        const u = src.t1 > src.t0 ? Math.max(0, Math.min(1, (t - src.t0)/(src.t1 - src.t0))) : 0;
        if (!a.h2 && !b.h1) return lerp(a.p, b.p, u);
        return splitCubic({ p0: a.p, c1: a.h2 || a.p, c2: b.h1 || b.p, p3: b.p }, u)[0].p3;
    }
    return null;
}

/**
 * a node added on segment i of the item's path at its parameter t
 * (splitSegment). On a geodesic path: on a side without handles the node
 * lies on the geodesic, where the outline is at t, and the two sides it
 * leaves are the same geodesic; a curved side is split as the cubic of the
 * geometry it is, by split(cp, t) -> {left, right} (the control points of
 * the two halves: the outliner's, invlib's geodesicCurveSplit), the node on
 * the curve and smooth; without it, or where the geometry does not draw the
 * side, as a Euclidean cubic
 */
function splitItemSegment(item, i, t, split = null){
    const nodes = item.nodes;
    const j = nextNode(nodes, i);
    if (!item.geodesic) return splitSegment(nodes, item.closed, i, t);
    const a = nodes[i], b = nodes[j];
    let fresh = null, h2 = a.h2, h1 = b.h1;
    if (!a.h2 && !b.h1) {
        const p = outlinePoint(item, i, t);
        if (p) fresh = { p, h1: null, h2: null };
    } else if (split) {
        const halves = split([a.p, a.h2 || a.p, b.h1 || b.p, b.p], t);
        if (halves) {
            h2 = halves.left[1];
            h1 = halves.right[2];
            fresh = { p: halves.left[3], h1: halves.left[2], h2: halves.right[1], smooth: true };
        }
    }
    if (!fresh) return splitSegment(nodes, item.closed, i, t);
    const out = nodes.map(m => ({ ...m, p: copyPoint(m.p), h1: copyPoint(m.h1), h2: copyPoint(m.h2) }));
    out[i].h2 = copyPoint(h2);
    out[j].h1 = copyPoint(h1);
    // on a ring's closing segment the new node is the ring's last
    if (out[i].ringEnd) { delete out[i].ringEnd; fresh.ringEnd = true; }
    out.splice(i + 1, 0, fresh);
    return out;
}

/**
 * the nodes of a geodesic path with its curved sides as runs of sides
 * without handles: the points of the outline along them, flattened within
 * tol (of the outline's extent, FLAT_TOL by default); the sides without
 * handles, straight in the geometry, stay as they are. Before the document
 * gave it an outline: its own cubics flattened
 */
function geodesicStraightNodes(item, tol = FLAT_TOL){
    const o = item.outline, nodes = item.nodes;
    if (!o || !o.nodes) return straightRings(nodes, undefined, !!item.closed);
    const reach = tol*extentOf(o.nodes);
    // the outline's segments of every side of the path, in their order
    const bySide = new Map();
    o.source.forEach((src, k) => {
        if (!src) return;
        if (!bySide.has(src.seg)) bySide.set(src.seg, []);
        bySide.get(src.seg).push(k);
    });
    const out = [];
    nodes.forEach((m, i) => {
        const node = { p: copyPoint(m.p), h1: null, h2: null };
        out.push(node);
        const pieces = bySide.get(i);
        // a curved side: the points along the pieces of its outline, short of the node it ends at
        if (pieces && (m.h2 || nodes[nextNode(nodes, i)].h1)) {
            const pts = [];
            for (const k of pieces) {
                const a = o.nodes[k], b = o.nodes[nextNode(o.nodes, k)];
                const flat = flattenNodes([{ p: a.p, h1: null, h2: a.h2 }, { p: b.p, h1: b.h1, h2: null }], false, reach);
                for (let q = 2; q + 1 < flat.length; q += 2) pts.push([flat[q], flat[q + 1]]);
            }
            pts.pop();
            for (const p of pts) out.push({ p, h1: null, h2: null });
        }
        // the ring ends with the last node made for it
        if (m.ringEnd) out[out.length - 1].ringEnd = true;
    });
    return out;
}

/** the item without what makes it a geodesic path: the flag and the outline (its nodes stay) */
function withoutGeodesic(item){
    if (!item.geodesic && !item.outline) return item;
    const { geodesic, outline, ...rest } = item;
    return rest;
}

/**
 * a geodesic path as the plain path it is drawn as: its outline for its
 * nodes, the flag gone; with deep the items it holds too. Any other item as
 * it is
 */
function euclideanItem(item, deep = false){
    let out = item;
    if (item.geodesic) {
        const o = item.outline;
        out = (o && o.nodes) ? withNodes(withoutGeodesic(item), o.nodes.map(m => ({ ...m, p: copyPoint(m.p), h1: copyPoint(m.h1), h2: copyPoint(m.h2) })))
                             : withoutGeodesic(item);
    }
    if (deep && item.children) {
        const children = item.children.map(c => euclideanItem(c, true));
        if (children.some((c, k) => c !== item.children[k])) out = { ...out, children };
    }
    return out;
}

/** a copy of the item as it is saved: plain JSON, without what is made from it again (the outline of a geodesic path) */
function savedItem(item){
    return JSON.parse(JSON.stringify(item, (key, value) => (key === 'outline' ? undefined : value)));
}

// item -> the Set of its bridges, or null with one ring
const mBridges = new WeakMap();

/** the segments of a path's points that are bridges between rings, by their first points; null with one ring */
function itemBridges(item){
    if (!item.nodes) return null;
    let bridges = mBridges.get(item);
    if (bridges === undefined) {
        const compound = item.nodes.some(m => m.ringEnd);
        bridges = compound ? new Set(flattenDetailed(drawnNodes(item), item.closed).pieces.flatMap((piece, i) => (piece.seg < 0 ? [i] : []))) : null;
        mBridges.set(item, bridges);
    }
    return bridges;
}

/** the rings flattened into straight nodes, the rings kept; a single ring left open when closed is false */
function straightRings(nodes, tol, closed = true){
    const rings = nodeRings(nodes);
    return rings.flatMap(([first, last], k) => {
        const ring = nodes.slice(first, last + 1).map(({ ringEnd, ...m }) => m);
        const points = flattenNodes(ring, closed || rings.length > 1, tol), out = [];
        for (let i = 0; i + 1 < points.length; i += 2) out.push({ p: [points[i], points[i + 1]], h1: null, h2: null });
        if (k < rings.length - 1) out[out.length - 1].ringEnd = true;
        return out;
    });
}

/**
 * the item with these nodes, its points flattened from them; an outline of
 * its own, so no shape (Shapes.js) any more. A geodesic path keeps its flag
 * and loses its outline, which the document makes again from the new nodes
 * (until then its points are those of the straight sides)
 */
function withNodes(item, nodes){
    const out = { ...item, type: 'path', nodes, points: flattenNodes(nodes, item.closed) };
    delete out.shape;
    delete out.outline;
    return out;
}

const copyPoint = q => q ? [q[0], q[1]] : null;

function mappedNodes(nodes, map){
    return nodes.map(n => ({ ...n, p: map(n.p), h1: n.h1 ? map(n.h1) : null, h2: n.h2 ? map(n.h2) : null }));
}

function movedNodes(nodes, dx, dy){
    return mappedNodes(nodes, q => [q[0] + dx, q[1] + dy]);
}

//
//  The edits of a node and its handles below take a last argument chart for
//  the nodes of a geodesic path: chart(p) -> {to(q), from(q)}, the maps of
//  the plane to the chart of the point p and back, in which p is at the
//  origin and the geodesics through p are the straight lines through it (the
//  canonical chart of the group's geometry: the outliner's, DrawingGeometry.js).
//  The edit is then done on the chart's picture of the node, where "the
//  handles in line" and "the same length" mean what they mean in the
//  geometry, so that a smooth node gives a smooth curve; a moved node takes
//  its handles along as that picture. Without chart: in the plane, as ever.
//

/** the nodes with node i changed by op(nodes in the chart of its point, to) there: the node stays where it is, its handles come back from the chart */
function inNodeChart(nodes, i, chart, op){
    const c = chart(nodes[i].p);
    const local = op(mappedNodes(nodes, c.to), c.to)[i];
    const back = q => { const w = q ? c.from(q) : null; return (w && Number.isFinite(w[0]) && Number.isFinite(w[1])) ? w : null; };
    const node = { ...local, p: nodes[i].p, h1: back(local.h1), h2: back(local.h2) };
    return nodes.map((m, k) => k === i ? node : m);
}

/** node i moved to x, its handles along */
function nodeMoved(nodes, i, x, chart = null){
    const n = nodes[i];
    let moved = null;
    if (chart && (n.h1 || n.h2)) {
        // the handles as they are seen from the node: out of the chart of where it was into the chart of where it is
        const was = chart(n.p), is = chart(x);
        const carry = h => (h ? is.from(was.to(h)) : null);
        const h1 = carry(n.h1), h2 = carry(n.h2);
        if ([h1, h2].every(h => !h || (Number.isFinite(h[0]) && Number.isFinite(h[1])))) moved = { ...n, p: [x[0], x[1]], h1, h2 };
    }
    if (!moved) {
        const dx = x[0] - n.p[0], dy = x[1] - n.p[1];
        moved = { ...n, p: [x[0], x[1]], h1: n.h1 ? [n.h1[0] + dx, n.h1[1] + dy] : null, h2: n.h2 ? [n.h2[0] + dx, n.h2[1] + dy] : null };
    }
    return nodes.map((m, k) => k === i ? moved : m);
}

/**
 * handle which ('h1' or 'h2') of node i moved to x; with keepSmooth a
 * smooth node turns its other handle to stay in line, its length kept,
 * and without it the node becomes a corner
 */
function handleMoved(nodes, i, which, x, keepSmooth, chart = null){
    if (chart) {
        const out = inNodeChart(nodes, i, chart, (local, to) => handleMoved(local, i, which, to(x), keepSmooth));
        // the dragged handle is where the pointer is, to the last digit
        out[i] = { ...out[i], [which]: [x[0], x[1]] };
        return out;
    }
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
function nodeHandlesPulled(nodes, i, x, chart = null){
    if (chart) {
        const out = inNodeChart(nodes, i, chart, (local, to) => nodeHandlesPulled(local, i, to(x)));
        out[i] = { ...out[i], h2: [x[0], x[1]] };
        return out;
    }
    const n = nodes[i];
    const moved = { ...n, h2: [x[0], x[1]], h1: [2*n.p[0] - x[0], 2*n.p[1] - x[1]], smooth: true };
    return nodes.map((m, k) => k === i ? moved : m);
}

/**
 * node i a corner when it was smooth, else smooth: its handles put in line
 * (made from the neighbours, a third of the way to them, when it has none)
 */
function nodeSmoothToggled(nodes, i, closed, chart = null){
    if (chart) return inNodeChart(nodes, i, chart, (local) => nodeSmoothToggled(local, i, closed));
    const n = nodes[i], count = nodes.length;
    if (n.smooth) return nodes.map((m, k) => k === i ? { ...m, smooth: false } : m);
    const prev = (i > 0 || closed) ? nodes[prevNode(nodes, i)] : null;
    const next = (i < count - 1 || closed) ? nodes[nextNode(nodes, i)] : null;
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
    const j = nextNode(nodes, i);
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
    // on a ring's closing segment the new node is the ring's last
    if (out[i].ringEnd) { delete out[i].ringEnd; fresh.ringEnd = true; }
    out.splice(i + 1, 0, fresh);
    return out;
}

/** the nodes without node i (its neighbours keep their handles) */
function removeNode(nodes, i){
    const out = nodes.filter((m, k) => k !== i);
    // the one before is the last of the ring now, unless the ring is gone
    if (nodes[i].ringEnd && i > 0 && !nodes[i - 1].ringEnd) out[i - 1] = { ...out[i - 1], ringEnd: true };
    // the last ring gone: nothing marks the end of the nodes
    if (out.length && out[out.length - 1].ringEnd) { const { ringEnd, ...m } = out[out.length - 1]; out[out.length - 1] = m; }
    return out;
}

const AXES_EPS = 1e-4;      // the step of the finite differences carrying axes through a map

/** the centre of the box round the item's points, in its coordinates */
function itemCentre(item){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < item.points.length; i += 2) {
        x0 = Math.min(x0, item.points[i]);     x1 = Math.max(x1, item.points[i]);
        y0 = Math.min(y0, item.points[i + 1]); y1 = Math.max(y1, item.points[i + 1]);
    }
    return x0 <= x1 ? [0.5*(x0 + x1), 0.5*(y0 + y1)] : [0, 0];
}

/**
 * the transform box's axes [ux, uy, vx, vy] (unit vectors) carried through
 * the map as directions at the point `at`: finite differences, exact for
 * an affine map; the world's axes when the map folds them together
 */
function mappedAxes(map, at, axes, eps = AXES_EPS){
    const o = map(at);
    const dir = (dx, dy) => {
        const p = map([at[0] + eps*dx, at[1] + eps*dy]);
        const x = p[0] - o[0], y = p[1] - o[1], n = Math.hypot(x, y);
        return n > 0 ? [x/n, y/n] : null;
    };
    const u = dir(axes[0], axes[1]), v = dir(axes[2], axes[3]);
    if (!u || !v || Math.abs(u[0]*v[1] - u[1]*v[0]) < 1e-6) return [1, 0, 0, 1];
    return [u[0], u[1], v[0], v[1]];
}

/**
 * an image's quad [bottom-left, bottom-right, top-right, top-left] mapped by
 * the map's affine approximation at its centre (central differences along its
 * half edges, exact for an affine map): the quad stays a parallelogram, the
 * picture on it a picture, and it stays aligned with the frame holding it,
 * whose rect is mapped the same way (shapeMapped)
 */
function mappedQuad(p, map){
    const C = [0.5*(p[0] + p[4]), 0.5*(p[1] + p[5])];
    const a = [0.5*(p[2] - p[0]), 0.5*(p[3] - p[1])], b = [0.5*(p[6] - p[0]), 0.5*(p[7] - p[1])];
    const half = (v) => {
        const q1 = map([C[0] + v[0], C[1] + v[1]]), q0 = map([C[0] - v[0], C[1] - v[1]]);
        return [0.5*(q1[0] - q0[0]), 0.5*(q1[1] - q0[1])];
    };
    const cm = map(C), u = half(a), v = half(b);
    return [cm[0] - u[0] - v[0], cm[1] - u[1] - v[1],
            cm[0] + u[0] - v[0], cm[1] + u[1] - v[1],
            cm[0] + u[0] + v[0], cm[1] + u[1] + v[1],
            cm[0] - u[0] + v[0], cm[1] - u[1] + v[1]];
}

/**
 * the item with every point mapped (world to world): its points or nodes,
 * an image's quad, its pivot and its box's axes, its children; a shape
 * keeps its kind, its numbers mapped (by the map's affine approximation at
 * its centre where the map is not affine; a geodesic shape's between the
 * charts of its space, DrawingGeometry.shapeSpace), its outline made from
 * them; an image's quad is mapped by the affine approximation at its
 * centre too
 */
function mappedItem(item, map, space = null){
    let out;
    if (item.nodes) {
        out = withNodes(item, mappedNodes(item.nodes, map));
    } else if (item.type === 'image' && item.points && item.points.length >= 8) {
        out = { ...item, points: mappedQuad(item.points, map) };
    } else {
        const points = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) points.push(...map([item.points[i], item.points[i + 1]]));
        out = { ...item, points };
        delete out.shape;
    }
    if (item.shape) out.shape = shapeMapped(item.shape, map, true, item.geodesic ? space : null) || item.shape;
    if (item.pivot) out.pivot = map(item.pivot);
    if (item.axes) out.axes = mappedAxes(map, item.pivot || itemCentre(item), item.axes);
    if (item.children) out.children = item.children.map(c => mappedItem(c, map, space));
    return out;
}

/**
 * the item with its paths as polylines through their outlines flattened
 * within tol (of their extent), its children too; a geodesic path through
 * the outline it is drawn by, a plain polyline then
 */
function flattenedItem(item, tol = FLAT_TOL){
    let out = item;
    const nodes = item.nodes ? drawnNodes(item) : null;
    if (itemBridges(item)) {
        out = withNodes(withoutGeodesic(item), straightRings(nodes, tol*extentOf(nodes)));
    } else if (item.nodes) {
        out = { ...withoutGeodesic(item), type: 'polyline', points: flattenNodes(nodes, item.closed, tol*extentOf(nodes)) };
        delete out.nodes;
    }
    if (item.children) out = { ...out, children: item.children.map(c => flattenedItem(c, tol)) };
    return out;
}

/** a polyline as a path of straight segments */
function pathFromPolyline(item){
    const nodes = [];
    for (let i = 0; i + 1 < item.points.length; i += 2) nodes.push({ p: [item.points[i], item.points[i + 1]], h1: null, h2: null });
    return withNodes(item, nodes);
}

/**
 * a path as a polyline through its flattened outline; a geodesic path, whose
 * sides without handles are straight in the geometry already, stays a
 * geodesic path, its curved sides runs of such sides (itself when it has none)
 */
function polylineFromPath(item){
    if (item.geodesic) {
        if (!item.nodes.some(m => m.h1 || m.h2)) return item;
        return withNodes(item, geodesicStraightNodes(item));
    }
    // a line between the rings would show: straight nodes keep them apart
    if (itemBridges(item)) return withNodes(item, straightRings(item.nodes));
    const out = { ...item, type: 'polyline', points: item.points.slice() };
    delete out.nodes;
    delete out.shape;
    return out;
}

export { flattenNodes, flattenDetailed, nodeRings, nextNode, prevNode, traceNodes, itemBridges, withNodes, mappedNodes, movedNodes, nodeMoved, handleMoved, nodeHandlesPulled, nodeSmoothToggled,
         splitSegment, removeNode, mappedItem, mappedAxes, itemCentre, flattenedItem, pathFromPolyline, polylineFromPath,
         drawnNodes, geodesicOutline, flattenItem, outlinePoint, splitItemSegment, withoutGeodesic, euclideanItem, savedItem };
