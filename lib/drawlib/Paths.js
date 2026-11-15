//
//  paths: items whose outline is cubic Bezier segments between nodes
//
//    { type: 'path', closed,
//      nodes: [{ p: [x, y], h1: [x, y] | null, h2: [x, y] | null, smooth, symmetric, auto }],
//      points: [x, y, ...] }
//
//  Node i has its point p, the handle h1 of the segment coming from node
//  i - 1 and the handle h2 of the segment going to node i + 1 (a closed path
//  goes from the last node back to the first); a segment without handles is
//  a straight line. A node has one of four types (Inkscape's, nodeType,
//  docs/node_editing_plan.md 5.2): a corner (no flag), smooth (its handles
//  kept in line), symmetric (smooth, its handles as long as each other) or
//  auto (smooth, its handles made from its neighbours, withAutoHandles:
//  across the angle there, each a third of the way to its neighbour, made
//  again whenever the path changes); symmetric and auto come with smooth,
//  so what reads smooth alone takes them for smooth nodes.
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
    fitOneCubic,
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
    // auto nodes follow their neighbours (a geodesic path's in the chart of each node: the document does that)
    if (!item.geodesic) nodes = withAutoHandles(nodes, item.closed);
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
 * smooth node turns its other handle to stay in line, its length kept (a
 * symmetric node's as long as the dragged one: its mirror), an auto node
 * becoming smooth; without it the node becomes a corner
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
    const moved = { ...(keepSmooth ? withType(n, n.auto ? 'smooth' : nodeType(n)) : withType(n, 'corner')), [which]: [x[0], x[1]] };
    const dx = x[0] - n.p[0], dy = x[1] - n.p[1], len = Math.hypot(dx, dy);
    if (keepSmooth && n.symmetric) {
        moved[other] = [n.p[0] - dx, n.p[1] - dy];
    } else if (keepSmooth && n.smooth && n[other]) {
        const olen = Math.hypot(n[other][0] - n.p[0], n[other][1] - n.p[1]);
        if (len > 1e-12) moved[other] = [n.p[0] - dx/len*olen, n.p[1] - dy/len*olen];
    }
    return nodes.map((m, k) => k === i ? moved : m);
}

/** node i with its handles pulled out to x (h2 at x, h1 opposite): a smooth node (a symmetric one stays symmetric) */
function nodeHandlesPulled(nodes, i, x, chart = null){
    if (chart) {
        const out = inNodeChart(nodes, i, chart, (local, to) => nodeHandlesPulled(local, i, to(x)));
        out[i] = { ...out[i], h2: [x[0], x[1]] };
        return out;
    }
    const n = nodes[i];
    const moved = { ...withType(n, n.symmetric ? 'symmetric' : 'smooth'), h2: [x[0], x[1]], h1: [2*n.p[0] - x[0], 2*n.p[1] - x[1]] };
    return nodes.map((m, k) => k === i ? moved : m);
}

/**
 * node i a corner when it was smooth (symmetric, auto), else smooth
 * (nodeTypeSet: its handles put in line, made from the neighbours when it
 * has none); an end of an open path stays a corner
 */
function nodeSmoothToggled(nodes, i, closed, chart = null){
    return nodeTypeSet(nodes, i, nodes[i].smooth ? 'corner' : 'smooth', closed, chart);
}

//
//  The four types of a node (Inkscape's, docs/node_editing_plan.md 5.2).
//

const NODE_TYPES = ['corner', 'smooth', 'symmetric', 'auto'];

/** the type of a node: 'corner', 'smooth', 'symmetric' or 'auto' */
function nodeType(n){
    return n.auto ? 'auto' : n.symmetric ? 'symmetric' : n.smooth ? 'smooth' : 'corner';
}

/** the node with the flags of a type (symmetric and auto with smooth; a corner smooth: false), its handles as they are */
function withType(n, type){
    const { smooth, symmetric, auto, ...rest } = n;
    if (type === 'corner') return { ...rest, smooth: false };
    return { ...rest, smooth: true, ...(type === 'symmetric' ? { symmetric: true } : type === 'auto' ? { auto: true } : {}) };
}

/** is node i an end of an open path: no neighbour on one side */
function isEndNode(nodes, i, closed){
    return nodeNeighbour(nodes, i, 'h1', closed) < 0 || nodeNeighbour(nodes, i, 'h2', closed) < 0;
}

/**
 * the auto handles of a node at the origin with its neighbours at a (before)
 * and b (after), as vectors from it (Inkscape's): along the line across
 * the bisector of the angle a, 0, b, each a third of the way to its
 * neighbour; null where a neighbour stands on the node or both lie the same
 * way from it
 */
function autoVectors(a, b){
    const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    if (!(la > 1e-12 && lb > 1e-12)) return null;
    const d = [la/lb*b[0] - a[0], la/lb*b[1] - a[1]], ld = Math.hypot(d[0], d[1]);
    if (!(ld > 1e-12*la)) return null;
    const u = [d[0]/ld, d[1]/ld];
    return { h1: [-u[0]*la/3, -u[1]*la/3], h2: [u[0]*lb/3, u[1]*lb/3] };
}

/**
 * the auto handles of node i from its neighbours ({h1, h2}, both null at an
 * end of an open path or where autoVectors finds none); with a chart in the
 * chart of the node (a geodesic path: a third of the way along the
 * geodesics, as the node sees them)
 */
function autoHandles(nodes, i, closed, chart = null){
    const a = nodeNeighbour(nodes, i, 'h1', closed), b = nodeNeighbour(nodes, i, 'h2', closed);
    if (a < 0 || b < 0) return { h1: null, h2: null };
    const c = chartOf(nodes[i].p, chart);
    const v = autoVectors(c.to(nodes[a].p), c.to(nodes[b].p));
    if (!v) return { h1: null, h2: null };
    const h1 = c.from(v.h1), h2 = c.from(v.h2);
    return (finite(h1) && finite(h2)) ? { h1, h2 } : { h1: nodes[i].h1, h2: nodes[i].h2 };
}

/**
 * the nodes with the handles of their auto nodes made again from the
 * neighbours (autoHandles; with a chart, a geodesic path's, in the chart of
 * each node): what the document does at every change, so that an auto node
 * follows its neighbours; the same nodes when there is none
 */
function withAutoHandles(nodes, closed, chart = null){
    if (!nodes.some(m => m.auto)) return nodes;
    return nodes.map((m, i) => (m.auto ? { ...m, ...autoHandles(nodes, i, closed, chart) } : m));
}

/**
 * the handles of node i made smooth by Inkscape's rules: both retracted,
 * the auto handles; one retracted next to a straight segment, the other
 * turned in line with that segment; one retracted next to a curved one, it
 * comes out in line with the other, a third of the way to its neighbour;
 * both out, put in line (along the way from h1 to h2), their lengths kept
 */
function smoothHandles(nodes, i, closed){
    const n = nodes[i], p = n.p;
    const unit = (v) => { const l = Math.hypot(v[0], v[1]); return l > 1e-12 ? [v[0]/l, v[1]/l] : null; };
    const length = (h) => Math.hypot(h[0] - p[0], h[1] - p[1]);
    const along = (u, l) => [p[0] + u[0]*l, p[1] + u[1]*l];
    if (!n.h1 && !n.h2) return autoHandles(nodes, i, closed);
    if (n.h1 && n.h2) {
        const u = unit([n.h2[0] - n.h1[0], n.h2[1] - n.h1[1]]);
        return u ? { h1: along(u, -length(n.h1)), h2: along(u, length(n.h2)) } : { h1: n.h1, h2: n.h2 };
    }
    // one handle out: `out` is it, `gone` the retracted one, j the neighbour on gone's side
    const out = n.h1 ? 'h1' : 'h2', gone = out === 'h1' ? 'h2' : 'h1';
    const j = nodeNeighbour(nodes, i, gone, closed);
    const result = { h1: n.h1, h2: n.h2 };
    if (j < 0) return result;
    const q = nodes[j], straight = !q[out];      // the segment to j: its far handle is j's `out` side
    if (straight) {
        // the handle out turned along the line from j through the node
        const u = unit([p[0] - q.p[0], p[1] - q.p[1]]);
        if (u) result[out] = along(u, length(n[out]));
    } else {
        // the retracted one drawn out opposite the other, a third of the way to j
        const u = unit([p[0] - n[out][0], p[1] - n[out][1]]);
        if (u) result[gone] = along(u, Math.hypot(q.p[0] - p[0], q.p[1] - p[1])/3);
    }
    return result;
}

/**
 * node i given a type (Inkscape's rules): a corner keeps its handles;
 * smooth, smoothHandles; symmetric, a missing handle the mirror of the
 * other, else smooth with both handles their mean length; auto, the auto
 * handles.
 * An end of an open path stays a corner (the nodes as they are). With a
 * chart (a geodesic path) in the chart of the node
 */
function nodeTypeSet(nodes, i, type, closed, chart = null){
    if (!NODE_TYPES.includes(type) || (type !== 'corner' && isEndNode(nodes, i, closed))) return nodes;
    if (chart && type !== 'corner') return inNodeChart(nodes, i, chart, (local) => nodeTypeSet(local, i, type, closed));
    const n = nodes[i], p = n.p;
    const mirror = (q) => [2*p[0] - q[0], 2*p[1] - q[1]];
    let h = { h1: n.h1, h2: n.h2 };
    if (type === 'auto') h = autoHandles(nodes, i, closed);
    // symmetric with one handle out: the other its mirror (Inkscape's)
    else if (type === 'symmetric' && !n.h1 !== !n.h2) h = n.h1 ? { h1: n.h1, h2: mirror(n.h1) } : { h1: mirror(n.h2), h2: n.h2 };
    else if (type !== 'corner') h = smoothHandles(nodes, i, closed);
    if (type === 'symmetric' && h.h1 && h.h2) {
        // in line (smoothHandles), both their mean length
        const v2 = [h.h2[0] - p[0], h.h2[1] - p[1]];
        const l1 = Math.hypot(h.h1[0] - p[0], h.h1[1] - p[1]), l2 = Math.hypot(v2[0], v2[1]), l = 0.5*(l1 + l2);
        if (l2 > 1e-12) h = { h1: [p[0] - v2[0]/l2*l, p[1] - v2[1]/l2*l], h2: [p[0] + v2[0]/l2*l, p[1] + v2[1]/l2*l] };
    }
    return nodes.map((m, k) => k === i ? { ...withType(n, type), h1: h.h1, h2: h.h2 } : m);
}

/** the type after a node's in the cycle of Ctrl+click (Inkscape's): corner, smooth, symmetric, auto, corner */
function nextNodeType(type){
    return NODE_TYPES[(NODE_TYPES.indexOf(type) + 1) % NODE_TYPES.length];
}

//
//  Inkscape's edits of handles and segments (docs/node_editing_plan.md 5.3).
//  A segment is named by the node it starts from (segment s runs from node
//  s to the next one of its ring); the handle h2 of node s and h1 of the
//  node after it are its two handles.
//

/** the node at the other end of the segment of node i's handle which (h1: the node before, h2: the node after); -1 when there is none (an end of an open path) */
function nodeNeighbour(nodes, i, which, closed){
    let j;
    if (which === 'h2') j = closed ? nextNode(nodes, i) : (i < nodes.length - 1 ? i + 1 : -1);
    else j = closed ? prevNode(nodes, i) : (i > 0 ? i - 1 : -1);
    return j === i ? -1 : j;
}

/** the segments meeting at node i, by the nodes they start from: the one coming in, the one going out (an end of an open path has one) */
function nodeSegments(nodes, i, closed){
    const out = [];
    const before = nodeNeighbour(nodes, i, 'h1', closed);
    if (before >= 0) out.push(before);
    if (nodeNeighbour(nodes, i, 'h2', closed) >= 0) out.push(i);
    return out;
}

/** is segment s straight: no handle at either end */
function segmentStraight(nodes, s, closed){
    const e = nodeNeighbour(nodes, s, 'h2', closed);
    return e >= 0 && !nodes[s].h2 && !nodes[e].h1;
}

/** the chart of the point p (with it at the origin), the plane's translation without a chart */
function chartOf(p, chart){
    return chart ? chart(p) : { to: q => [q[0] - p[0], q[1] - p[1]], from: q => [q[0] + p[0], q[1] + p[1]] };
}

const finite = q => !!q && Number.isFinite(q[0]) && Number.isFinite(q[1]);

/** the point a third of the way from p to q: in the plane, or along the geodesic through them in the chart of p */
function third(p, q, chart = null){
    const plain = [p[0] + (q[0] - p[0])/3, p[1] + (q[1] - p[1])/3];
    if (!chart) return plain;
    const c = chart(p), v = c.to(q), w = c.from([v[0]/3, v[1]/3]);
    return finite(w) ? w : plain;
}

/**
 * the retracted handle of node i that a pull towards x draws out (Inkscape's
 * Shift+drag on a node): of the retracted handles that lead to a neighbour,
 * the one whose neighbour lies nearer the direction from the node to x;
 * 'h1', 'h2', or null when the node has none. With a chart, the directions
 * are taken in the chart of the node; allowed(which), when given, says which
 * handles may come out (a tile's: not into a locked edge)
 */
function pulledHandle(nodes, i, x, closed, chart = null, allowed = null){
    const n = nodes[i];
    const c = chartOf(n.p, chart);
    const d = c.to(x);
    let best = null, bestAngle = Infinity;
    for (const which of ['h1', 'h2']) {
        if (n[which] || (allowed && !allowed(which))) continue;
        const j = nodeNeighbour(nodes, i, which, closed);
        if (j < 0) continue;
        const v = c.to(nodes[j].p);
        const angle = Math.abs(Math.atan2(d[0]*v[1] - d[1]*v[0], d[0]*v[0] + d[1]*v[1]));
        if (angle < bestAngle) { bestAngle = angle; best = which; }
    }
    return best;
}

/**
 * node i with its handle which retracted onto it (the segment on that side
 * straight when its other end has none too); the node keeps its kind, but a
 * symmetric or auto node becomes smooth (one handle is not their pair)
 */
function handleRetracted(nodes, i, which){
    return nodes.map((m, k) => k === i ? { ...plainSmooth(m), [which]: null } : m);
}

/** a symmetric or auto node as a smooth one (its handles edited apart from their rule), else the node */
function plainSmooth(n){
    return (n.symmetric || n.auto) ? withType(n, 'smooth') : n;
}

/**
 * the straight segments among segs as curves, their handles at the thirds
 * of their lines (Inkscape's Make segments curves): the outline stays, and
 * the nodes keep their kind, so a corner gets handles and stays sharp. With
 * a chart (a geodesic path) each handle a third of the way along the
 * geodesic, in the chart of its node
 */
function segmentsCurved(nodes, closed, segs, chart = null){
    const out = nodes.slice();
    for (const s of segs) {
        if (!segmentStraight(out, s, closed)) continue;
        const e = nodeNeighbour(out, s, 'h2', closed);
        const a = out[s].p, b = out[e].p;
        out[s] = { ...out[s], h2: third(a, b, chart) };
        out[e] = { ...out[e], h1: third(b, a, chart) };
    }
    return out;
}

/** the segments among segs without their handles (Make segments lines): straight, on a geodesic path the geodesics */
function segmentsStraight(nodes, closed, segs){
    const out = nodes.slice();
    for (const s of segs) {
        const e = nodeNeighbour(out, s, 'h2', closed);
        if (e < 0) continue;
        out[s] = { ...plainSmooth(out[s]), h2: null };
        out[e] = { ...plainSmooth(out[e]), h1: null };
    }
    return out;
}

/** the share of a segment drag the handle at the segment's end takes, at the grabbed parameter t (Inkscape's): 0 near the start, 1 near the end */
function bendWeight(t){
    if (t <= 1/6) return 0;
    if (t <= 0.5) return Math.pow((6*t - 1)/2, 3)/2;
    if (t <= 5/6) return (1 - Math.pow((6*(1 - t) - 1)/2, 3))/2 + 0.5;
    return 1;
}

/**
 * segment s bent by a drag from the point `from` (on it, at its parameter t)
 * to `to` (Inkscape's segment drag): its two handles share the move by
 * bendWeight(t), so that the point at t moves with the pointer; a straight
 * segment first gets its handles at its thirds; a smooth node at either end
 * turns its other handle to stay in line. nodes: as they were when the drag
 * began (t is kept off the ends, where the handles would fly away). With a
 * chart (a geodesic path) the move is made in the chart of the segment's
 * first node: the curve passes near the pointer
 */
function segmentBent(nodes, closed, s, t, from, to, chart = null){
    const e = nodeNeighbour(nodes, s, 'h2', closed);
    if (e < 0) return nodes;
    const out = segmentStraight(nodes, s, closed) ? segmentsCurved(nodes, closed, [s], chart) : nodes;
    const u = Math.max(0.05, Math.min(0.95, t));
    const w = bendWeight(u);
    const k1 = (1 - w)/(3*u*(1 - u)*(1 - u)), k2 = w/(3*u*u*(1 - u));
    const a = out[s], b = out[e];
    const c = chartOf(a.p, chart);
    const f = c.to(from), g = c.to(to), d = [g[0] - f[0], g[1] - f[1]];
    const moved = (q, k) => { const v = c.to(q), r = c.from([v[0] + k*d[0], v[1] + k*d[1]]); return finite(r) ? r : q; };
    const h2 = moved(a.h2 || a.p, k1), h1 = moved(b.h1 || b.p, k2);
    return handleMoved(handleMoved(out, s, 'h2', h2, true, chart), e, 'h1', h1, true, chart);
}

/** the handle point x of the node at p turned about it to the nearest multiple of step (radians), its distance kept; with a chart in the chart of p */
function handleSnapped(p, x, step, chart = null){
    const c = chartOf(p, chart);
    const v = c.to(x), r = Math.hypot(v[0], v[1]);
    if (!(r > 0)) return x;
    const angle = step*Math.round(Math.atan2(v[1], v[0])/step);
    const w = c.from([r*Math.cos(angle), r*Math.sin(angle)]);
    return finite(w) ? w : x;
}

/**
 * handle which of node i moved to x with the other handle linked to it
 * (Inkscape's Shift on a handle): on a smooth node the other one is its
 * mirror through the node, as long; on a corner the other one turns by the
 * angle the dragged one turned, its length kept. nodes: as they were when
 * the drag began. With a chart, in the chart of the node
 */
function handleLinkedMoved(nodes, i, which, x, chart = null){
    if (chart) {
        const out = inNodeChart(nodes, i, chart, (local, to) => handleLinkedMoved(local, i, which, to(x)));
        out[i] = { ...out[i], [which]: [x[0], x[1]] };
        return out;
    }
    const n = nodes[i], other = which === 'h1' ? 'h2' : 'h1';
    const moved = { ...(n.auto ? withType(n, 'smooth') : n), [which]: [x[0], x[1]] };
    const p = n.p, o = n[other], v = [x[0] - p[0], x[1] - p[1]];
    if (o && n.smooth) {
        moved[other] = [p[0] - v[0], p[1] - v[1]];
    } else if (o && n[which]) {
        const was = [n[which][0] - p[0], n[which][1] - p[1]];
        const turn = Math.atan2(v[1], v[0]) - Math.atan2(was[1], was[0]);
        const ov = [o[0] - p[0], o[1] - p[1]], cs = Math.cos(turn), sn = Math.sin(turn);
        moved[other] = [p[0] + ov[0]*cs - ov[1]*sn, p[1] + ov[0]*sn + ov[1]*cs];
    }
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

//
//  Delete keeping the shape, break and join (Inkscape's, docs/node_editing_plan.md 5.5).
//

const RUN_SAMPLES = 16;     // samples of each segment of a run of removed nodes, for its fit
const TANGENT_STEP = 1e-6;  // the step along a geodesic path's outline that gives a tangent there

/** the point of the cubic segment {p0, c1, c2, p3} at t */
function cubicAt(g, t){
    const u = 1 - t, w = [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
    return [0, 1].map(k => w[0]*g.p0[k] + w[1]*g.c1[k] + w[2]*g.c2[k] + w[3]*g.p3[k]);
}

/** the unit vector along v, null when it has no length */
function unitOf(v){
    const l = Math.hypot(v[0], v[1]);
    return l > 1e-300 ? [v[0]/l, v[1]/l] : null;
}

/** the direction the cubic leaves p0 in (its first control point not on p0, else the next) */
function leaving(g){
    return unitOf([g.c1[0] - g.p0[0], g.c1[1] - g.p0[1]]) || unitOf([g.c2[0] - g.p0[0], g.c2[1] - g.p0[1]]) || unitOf([g.p3[0] - g.p0[0], g.p3[1] - g.p0[1]]);
}

/** the cubic segment's control points through the map f */
const segmentMapped = (g, f) => ({ p0: f(g.p0), c1: f(g.c1), c2: f(g.c2), p3: f(g.p3) });

/** the squared distance of q from the polyline line ([[x, y]]) */
function polylineDistance2(q, line){
    let best = Infinity;
    for (let k = 0; k + 1 < line.length; k++) {
        const a = line[k], b = line[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx*dx + dy*dy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0])*dx + (q[1] - a[1])*dy)/l2)) : 0;
        const ex = a[0] + t*dx - q[0], ey = a[1] + t*dy - q[1];
        best = Math.min(best, ex*ex + ey*ey);
    }
    return best;
}

/** Nelder and Mead's simplex: the x (2 numbers) where f is least, from x0 with steps step */
function simplexMin(f, x0, step, iterations){
    let pts = [x0, [x0[0] + step, x0[1]], [x0[0], x0[1] + step]].map(x => ({ x, v: f(x) }));
    const at = (a, b, t) => [a[0] + t*(b[0] - a[0]), a[1] + t*(b[1] - a[1])];
    for (let i = 0; i < iterations; i++) {
        pts.sort((a, b) => a.v - b.v);
        const c = at(pts[0].x, pts[1].x, 0.5), w = pts[2];
        const r = at(c, w.x, -1), vr = f(r);
        if (vr < pts[0].v) {
            const x = at(c, w.x, -2), v = f(x);
            pts[2] = v < vr ? { x, v } : { x: r, v: vr };
        } else if (vr < pts[1].v) {
            pts[2] = { x: r, v: vr };
        } else {
            const x = at(c, w.x, vr < w.v ? -0.5 : 0.5), v = f(x);
            if (v < Math.min(vr, w.v)) pts[2] = { x, v };
            else pts = [pts[0], ...pts.slice(1).map(q => { const x = at(pts[0].x, q.x, 0.5); return { x, v: f(x) }; })];
        }
    }
    pts.sort((a, b) => a.v - b.v);
    return pts[0];
}

const REFINE_STEPS = 60;        // the simplex steps that fit a geodesic run's handles to its drawn outline
const DRAWN_SAMPLES = 8;        // points of each cubic piece of a drawn outline, measured against the samples

/**
 * the handles of the one cubic that stands for the run of segments segs
 * (from node s to node e, through the removed nodes between): fitted to
 * samples of the outline as it is drawn, leaving s and reaching e along
 * the outline's tangents there (CurveFit's fitOneCubic); {c1, c2}, both
 * null when every segment of the run is straight and the removed nodes lie
 * on the line from s to e (the segment stays straight). With an outliner
 * that has a chart (a geodesic path): the samples are the item's outline,
 * the fit runs in the chart of s, each tangent is the geodesic from its
 * node to its handle (the drawn curve's, seen from the node), and the
 * lengths of the handles along those geodesics are then fitted to the
 * curve the outliner draws through them (a geodesic curve is no plane
 * cubic of a chart)
 */
function runFitted(item, segs, s, e, outliner){
    const nodes = item.nodes, closed = !!item.closed;
    const chart = (outliner && outliner.chart) || null;
    const next = (k) => (closed ? nextNode(nodes, k) : k + 1);
    const c = chartOf(nodes[s].p, chart), ce = chartOf(nodes[e].p, chart);
    const drawn = !!(chart && item.geodesic && item.outline && item.outline.nodes);
    const at = (k, t) => (drawn && outlinePoint(item, k, t)) || cubicAt(segmentOf(nodes, k, next(k)), t);
    const end = c.to(nodes[e].p);
    // a straight run along one line (a geodesic through s): a straight segment
    if (segs.every(k => segmentStraight(nodes, k, closed))) {
        const L = Math.hypot(end[0], end[1]);
        const off = segs.slice(1).map(k => c.to(nodes[k].p)).map(q => Math.abs(end[0]*q[1] - end[1]*q[0])/(L || 1));
        if (L > 0 && off.every(d => d <= 1e-9*L)) return { c1: null, c2: null };
    }
    const pts = [];
    for (const k of segs) for (let j = 0; j < RUN_SAMPLES; j++) pts.push(c.to(at(k, j/RUN_SAMPLES)));
    pts.push(end);
    // the tangents: leaving s in its chart, back into the run from e in e's chart
    const lastG = segmentOf(nodes, segs[segs.length - 1], e);
    const t1 = leaving(segmentMapped(segmentOf(nodes, segs[0], next(segs[0])), c.to));
    const t2e = leaving(segmentMapped({ p0: lastG.p3, c1: lastG.c2, c2: lastG.c1, p3: lastG.p0 }, ce.to));
    if (!t1 || !t2e) return { c1: null, c2: null };
    // e's tangent as seen in the chart of s
    const near = c.to(ce.from([TANGENT_STEP*t2e[0], TANGENT_STEP*t2e[1]]));
    const t2 = chart ? unitOf([near[0] - end[0], near[1] - end[1]]) : t2e;
    const bez = t2 ? fitOneCubic(pts, t1, t2) : null;
    if (!bez) return { c1: null, c2: null };
    let c1 = c.from(bez[1]), c2 = c.from(bez[2]);
    if (!(finite(c1) && finite(c2))) return { c1: null, c2: null };
    if (chart && outliner.outline) {
        // the handles' lengths along their geodesics fitted to the drawn curve (in the chart of s)
        const handles = (x) => [c.from([Math.exp(x[0])*t1[0], Math.exp(x[0])*t1[1]]), ce.from([Math.exp(x[1])*t2e[0], Math.exp(x[1])*t2e[1]])];
        const cost = (x) => {
            const [h2, h1] = handles(x);
            if (!finite(h2) || !finite(h1)) return Infinity;
            const o = outliner.outline([{ p: nodes[s].p, h1: null, h2 }, { p: nodes[e].p, h1, h2: null }], false);
            if (!o || !o.nodes) return Infinity;
            const line = [];
            for (let k = 0; k + 1 < o.nodes.length; k++) {
                const g = segmentOf(o.nodes, k, k + 1);
                for (let j = 0; j < DRAWN_SAMPLES; j++) line.push(c.to(cubicAt(g, j/DRAWN_SAMPLES)));
            }
            line.push(end);
            if (!line.every(finite)) return Infinity;
            let sum = 0;
            for (const q of pts) sum += polylineDistance2(q, line);
            return sum;
        };
        const a0 = Math.hypot(bez[1][0], bez[1][1]), b0 = ce.to(c2);
        const x0 = [Math.log(a0 || 1e-3), Math.log(Math.hypot(b0[0], b0[1]) || 1e-3)];
        if (x0.every(Number.isFinite)) {
            const best = simplexMin(cost, x0, 0.2, REFINE_STEPS);
            if (Number.isFinite(best.v)) [c1, c2] = handles(best.x);
        }
    }
    return (finite(c1) && finite(c2)) ? { c1, c2 } : { c1: null, c2: null };
}

/**
 * the nodes of a path without the nodes in `remove` (a Set of indices), its
 * shape kept (Inkscape's delete): each run of removed nodes between two
 * kept nodes of a ring becomes one cubic fitted to the outline it replaces
 * (runFitted), the kept nodes' types staying (symmetric and auto ones
 * become smooth); removed nodes past the first or last kept one of an open
 * path go with their segments, the new end a corner; a ring left with fewer
 * than two nodes goes. With an outliner that has a chart (a geodesic path:
 * the document's, DrawingGeometry.js) each fit runs in the chart of its
 * run's first node and follows the curve the outliner draws (runFitted).
 * null when fewer than two nodes stay
 */
function nodesRemovedKeepingShape(item, remove, outliner = null){
    const nodes = item.nodes, closed = !!item.closed;
    const gone = new Set([...remove].filter(i => i >= 0 && i < nodes.length));
    if (!gone.size) return nodes;
    const out = nodes.map(m => ({ ...m }));
    const rings = nodeRings(nodes), keptRings = [];
    for (const [first, last] of rings) {
        const kept = [];
        for (let i = first; i <= last; i++) if (!gone.has(i)) kept.push(i);
        if (kept.length < 2) continue;
        keptRings.push(kept);
        if (!closed) {
            const a = kept[0], b = kept[kept.length - 1];
            if (a !== first) out[a] = { ...withType(out[a], 'corner'), h1: null };
            if (b !== last) out[b] = { ...withType(out[b], 'corner'), h2: null };
        }
        const pairs = [];
        for (let k = 0; k + 1 < kept.length; k++) pairs.push([kept[k], kept[k + 1]]);
        if (closed) pairs.push([kept[kept.length - 1], kept[0]]);
        for (const [s, e] of pairs) {
            const segs = [];
            for (let k = s; k !== e; k = closed ? nextNode(nodes, k) : k + 1) segs.push(k);
            if (segs.length < 2) continue;
            const fit = runFitted(item, segs, s, e, outliner);
            out[s] = { ...plainSmooth(out[s]), h2: fit.c1 };
            out[e] = { ...plainSmooth(out[e]), h1: fit.c2 };
        }
    }
    const result = [];
    keptRings.forEach((kept, r) => kept.forEach((i, k) => {
        const { ringEnd, ...m } = out[i];
        result.push(k === kept.length - 1 && r < keptRings.length - 1 ? { ...m, ringEnd: true } : m);
    }));
    return result.length >= 2 ? result : null;
}

/** the nodes run backwards: their order turned, h1 and h2 swapped */
function reversedNodes(nodes){
    return nodes.slice().reverse().map(m => ({ ...m, h1: m.h2, h2: m.h1 }));
}

/**
 * the open paths a path of one ring breaks into at the nodes `at`
 * (Inkscape's Break): a closed path opens at the first of them, the node
 * doubled into two ends, and splits at the others; an open path splits at
 * each that is not an end. [{nodes, startBreak, endBreak}]: each path's
 * nodes, and whether it starts or ends at a break (those ends corners
 * without their outer handle); the path as it is when nothing breaks it
 */
function brokenPaths(nodes, closed, at){
    const n = nodes.length;
    const breaks = [...new Set(at)].filter(i => i >= 0 && i < n && (closed || (i > 0 && i < n - 1))).sort((a, b) => a - b);
    if (!breaks.length) return [{ nodes, startBreak: false, endBreak: false }];
    const plain = ({ ringEnd, ...m }) => m;
    let seq, cuts;
    if (closed) {
        // round from the first break back to it, the other breaks as cuts
        const b0 = breaks[0];
        seq = [];
        for (let k = 0; k <= n; k++) seq.push(plain(nodes[(b0 + k) % n]));
        cuts = [0, ...breaks.slice(1).map(b => b - b0), n];
    } else {
        seq = nodes.map(plain);
        cuts = [0, ...breaks, n - 1];
    }
    const out = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
        const part = seq.slice(cuts[k], cuts[k + 1] + 1).map(m => ({ ...m }));
        const startBreak = closed || k > 0, endBreak = closed || k < cuts.length - 2;
        if (startBreak) part[0] = { ...withType(part[0], 'corner'), h1: null };
        if (endBreak) part[part.length - 1] = { ...withType(part[part.length - 1], 'corner'), h2: null };
        out.push({ nodes: part, startBreak, endBreak });
    }
    return out;
}

/**
 * the midpoint of p and q: in the plane, or with a chart on the line
 * through them in the chart of p (on the geodesic)
 */
function joinPoint(p, q, chart){
    const c = chartOf(p, chart), v = c.to(q), m = c.from([v[0]/2, v[1]/2]);
    return finite(m) ? m : [0.5*(p[0] + q[0]), 0.5*(p[1] + q[1])];
}

/**
 * one open path of two (Inkscape's Join): a's end aEnd ('first' or 'last')
 * joined to b's end bEnd, b's nodes in a's coordinates; a runs on into b.
 * merge: the two ends become one node at their midpoint (joinPoint), each
 * end's handles carried there (nodeMoved), a corner; else a straight
 * segment joins them (Join with segment). {nodes, at}: at the index of the
 * merged node, or of a's end
 */
function joinedNodes(a, aEnd, b, bEnd, merge, chart = null){
    const A = aEnd === 'last' ? a.map(m => ({ ...m })) : reversedNodes(a);
    const B = bEnd === 'first' ? b.map(m => ({ ...m })) : reversedNodes(b);
    const i = A.length - 1;
    if (!merge) {
        A[i] = { ...A[i], h2: null };
        B[0] = { ...B[0], h1: null };
        return { nodes: [...A, ...B], at: i };
    }
    const mid = joinPoint(A[i].p, B[0].p, chart);
    const a1 = nodeMoved(A, i, mid, chart)[i], b0 = nodeMoved(B, 0, mid, chart)[0];
    const node = { ...withType(a1, 'corner'), p: [mid[0], mid[1]], h1: a1.h1, h2: b0.h2 };
    return { nodes: [...A.slice(0, i), node, ...B.slice(1)], at: i };
}

/**
 * an open path closed by joining its two ends (Join of one path): merged
 * at their midpoint into its first node (merge, three nodes or more), else
 * by a straight segment from the last to the first; the nodes, null when
 * it cannot
 */
function closedJoin(nodes, merge, chart = null){
    const n = nodes.length;
    if (n < (merge ? 3 : 2)) return null;
    const out = nodes.map(m => ({ ...m }));
    if (!merge) {
        out[n - 1] = { ...out[n - 1], h2: null };
        out[0] = { ...out[0], h1: null };
        return out;
    }
    const mid = joinPoint(out[n - 1].p, out[0].p, chart);
    const last = nodeMoved(out, n - 1, mid, chart)[n - 1], first = nodeMoved(out, 0, mid, chart)[0];
    out[0] = { ...withType(first, 'corner'), p: [mid[0], mid[1]], h1: last.h1, h2: first.h2 };
    return out.slice(0, n - 1);
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
         drawnNodes, geodesicOutline, flattenItem, outlinePoint, splitItemSegment, withoutGeodesic, euclideanItem, savedItem,
         nodeNeighbour, nodeSegments, segmentStraight, pulledHandle, handleRetracted, segmentsCurved, segmentsStraight, bendWeight, segmentBent,
         handleSnapped, handleLinkedMoved,
         NODE_TYPES, nodeType, withType, isEndNode, autoHandles, withAutoHandles, nodeTypeSet, nextNodeType,
         nodesRemovedKeepingShape, reversedNodes, brokenPaths, joinPoint, joinedNodes, closedJoin };
