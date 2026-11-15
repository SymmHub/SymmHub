import {
    ITransform,
    SPLANE_SPHERE,
    applyTransform,
    generatorElements,
    domainPolygon,
    withNodes,
    nodeMoved,
    splitItemSegment,
    removeNode,
    flattenItem,
    nodeType,
} from './modules.js';

//
//  tiles: closed items whose edges are paired by the group's generators
//
//  A tile is the fundamental domain with its corners fixed and its edges
//  free: when an edge is reshaped, its paired edge follows as the image of
//  it under the generator pairing the two sides, so the copies of the tile
//  still fit together (Escher's tessellations). The item is an ordinary
//  closed polyline with
//
//    tile: { edges: [{ count, pair, word, reversed, locked }] }
//
//  edge k runs from corner k to corner k + 1 over count segments (the
//  corners are the first vertex of each edge, the points of the item being
//  the edges one after the other); the word's transform (in pattern
//  coordinates, see DrawingEditor.pairingMap) maps the edge onto edge pair,
//  its vertices in reverse order when reversed; a locked edge (a side on a
//  mirror) is fixed. A side mapped onto itself by a half turn is split at
//  the turn's centre into two edges paired with each other (as a domain may
//  list such a side already: two sides on one line or circle).
//
//  A curved tile (docs/node_editing_plan.md 5.7) is a closed path with the
//  same tile field, its counts in nodes: edge k runs over the nodes from
//  corner k to corner k + 1, and the handles at a corner belong to the edges
//  they lead into (h2 of corner k to edge k, h1 of corner k to edge k - 1).
//  The paired edge's nodes are the images of the edge's nodes, handles
//  included (a reversed pairing reverses their order and swaps h1 and h2):
//  the image of the curve wherever the generators are isometries of the
//  geometry the path is drawn in, the plane for a Euclidean path, the
//  hyperbolic plane or the sphere for a geodesic one (Paths.js). The corners
//  stay, and stay corners (their two handles shape two edges); a locked edge
//  has no handles. The edits below take either kind.
//

// the segments a side of the domain starts with: one on a line, several
// along a circle arc (and on a line paired with an arc, so that the image
// of the line follows the arc)
const ARC_SEGMENTS = 8;
// how far the image of an edge may miss the corners of its pair
const CORNER_TOL = 1.e-4;

/** per edge the index of its first vertex, and last the number of points */
function edgeStarts(tile){
    const starts = [0];
    for (const e of tile.edges) starts.push(starts[starts.length - 1] + e.count);
    return starts;
}

/** {edge, index} of a vertex: the edge it is on and its place there (0: the edge's first corner) */
function tileEdgeOfVertex(tile, v){
    const starts = edgeStarts(tile);
    for (let k = 0; k < tile.edges.length; k++) if (v >= starts[k] && v < starts[k + 1]) return { edge: k, index: v - starts[k] };
    return null;
}

/** a vertex the group fixes: a corner, or one on a locked edge */
function tileVertexFixed(tile, v){
    const at = tileEdgeOfVertex(tile, v);
    return !at || at.index === 0 || !!tile.edges[at.edge].locked;
}

/** the vertex of the paired edge that follows vertex v (an inner vertex of an edge with a pair); null for any other */
function tilePairedVertex(tile, v){
    const at = tileEdgeOfVertex(tile, v);
    if (!at || at.index === 0) return null;
    const e = tile.edges[at.edge];
    if (e.pair === null || e.pair === undefined || e.pair === at.edge) return null;
    const starts = edgeStarts(tile);
    const n = starts[starts.length - 1];
    return (starts[e.pair] + (e.reversed ? e.count - at.index : at.index)) % n;
}

/** the vertices of edge k, its two corners included: [x, y, ...] */
function edgePoints(points, starts, k){
    const n = points.length/2;
    const out = [];
    for (let v = starts[k]; v <= starts[k + 1]; v++) out.push(points[2*(v % n)], points[2*(v % n) + 1]);
    return out;
}

/** the point of vertex v of a tile: its node's on a curved tile */
function tilePoint(item, v){
    if (item.nodes) return item.nodes[v % item.nodes.length].p;
    const n = item.points.length/2;
    return [item.points[2*(v % n)], item.points[2*(v % n) + 1]];
}

/**
 * does the word of edge k still map its corners onto those of its pair (in
 * reverse order when the pairing reverses): not when the group changed
 * since the tile was made, whose generators then take the edge elsewhere
 */
function pairHolds(item, k, map){
    const tile = item.tile, e = tile.edges[k], starts = edgeStarts(tile);
    const a = tilePoint(item, starts[k]), b = tilePoint(item, starts[k + 1]);
    const pa = tilePoint(item, starts[e.pair]), pb = tilePoint(item, starts[e.pair + 1]);
    const [qa, qb] = e.reversed ? [pb, pa] : [pa, pb];
    const tol = CORNER_TOL*Math.max(1, dist(a, b));
    return dist(map(a), qa) <= tol && dist(map(b), qb) <= tol;
}

/**
 * the item with the pair of edge k following it: the pair's inner vertices
 * are the images of k's inner vertices (in reverse order when the pairing
 * reverses), as many as k has. mapWord(word) gives the map of a word. A pair
 * whose corners the word no longer maps onto (the group changed) stays as it
 * is
 */
function tileWithPairFollowing(item, k, mapWord){
    const tile = item.tile;
    const e = tile.edges[k];
    if (e.pair === null || e.pair === undefined || e.pair === k) return item;
    if (!pairHolds(item, k, mapWord(e.word))) return item;
    if (item.nodes) return curvedWithPairFollowing(item, k, mapWord);
    const starts = edgeStarts(tile);
    const map = mapWord(e.word);
    const src = edgePoints(item.points, starts, k);
    const inner = [];
    for (let i = 2; i + 3 < src.length; i += 2) inner.push(map([src[i], src[i + 1]]));
    if (e.reversed) inner.reverse();
    const n = item.points.length/2;
    const points = [];
    const edges = tile.edges.map(x => ({ ...x }));
    for (let j = 0; j < tile.edges.length; j++) {
        const a = starts[j];
        points.push(item.points[2*(a % n)], item.points[2*(a % n) + 1]);
        if (j === e.pair) {
            for (const q of inner) points.push(q[0], q[1]);
            edges[j].count = inner.length + 1;
        } else {
            for (let v = a + 1; v < starts[j + 1]; v++) points.push(item.points[2*(v % n)], item.points[2*(v % n) + 1]);
        }
    }
    return { ...item, points, tile: { ...tile, edges } };
}

/**
 * the item with the inner vertices of edge k replaced by inner ([[x, y], ...]
 * in world coordinates, from corner k towards corner k + 1), its pair
 * following; null for a locked edge. A curved tile takes nodes too
 * ({p, h1, h2, smooth} or [x, y]), and ends {h2, h1}: the handles of the
 * edge at its first corner and at its last (none without)
 */
function tileReplacedEdge(item, k, inner, mapWord, ends = null){
    const tile = item.tile;
    const e = tile.edges[k];
    if (!e || e.locked) return null;
    if (item.nodes) return curvedReplacedEdge(item, k, inner, mapWord, ends);
    const starts = edgeStarts(tile);
    const n = starts[starts.length - 1];
    const points = [];
    const edges = tile.edges.map(x => ({ ...x }));
    for (let j = 0; j < tile.edges.length; j++) {
        const a = starts[j];
        points.push(item.points[2*(a % n)], item.points[2*(a % n) + 1]);
        if (j === k) {
            for (const q of inner) points.push(q[0], q[1]);
            edges[j].count = inner.length + 1;
        } else {
            for (let v = a + 1; v < starts[j + 1]; v++) points.push(item.points[2*(v % n)], item.points[2*(v % n) + 1]);
        }
    }
    return tileWithPairFollowing({ ...item, points, tile: { ...tile, edges } }, k, mapWord);
}

/** the item with a vertex moved to x (world), its edge's pair following; null for a fixed vertex. A curved tile's node takes its handles along (in the chart of the node, nodeMoved) */
function tileMovedVertex(item, vertex, x, mapWord, chart = null){
    if (tileVertexFixed(item.tile, vertex)) return null;
    if (item.nodes) return tileWithPairFollowing(withNodes(item, nodeMoved(item.nodes, vertex, x, chart)), tileEdgeOfVertex(item.tile, vertex).edge, mapWord);
    const points = item.points.slice();
    points[2*vertex] = x[0];
    points[2*vertex + 1] = x[1];
    return tileWithPairFollowing({ ...item, points }, tileEdgeOfVertex(item.tile, vertex).edge, mapWord);
}

/**
 * the item with a vertex x inserted after vertex seg (on the segment seg),
 * its edge's pair following; null on a locked edge. On a curved tile the node
 * goes on the curve at the segment's parameter t (Paths.splitItemSegment,
 * split the geometry's splitter of a curved geodesic side), x unused
 */
function tileInsertedVertex(item, seg, x, mapWord, t = 0.5, split = null){
    const at = tileEdgeOfVertex(item.tile, seg);
    if (!at || item.tile.edges[at.edge].locked) return null;
    const edges = item.tile.edges.map(e => ({ ...e }));
    edges[at.edge].count++;
    if (item.nodes) return tileWithPairFollowing(withNodes({ ...item, tile: { ...item.tile, edges } }, splitItemSegment(item, seg, t, split)), at.edge, mapWord);
    const points = item.points.slice();
    points.splice(2*(seg + 1), 0, x[0], x[1]);
    return tileWithPairFollowing({ ...item, points, tile: { ...item.tile, edges } }, at.edge, mapWord);
}

/** the item with a vertex removed, its edge's pair following; null for a fixed vertex */
function tileRemovedVertex(item, vertex, mapWord){
    if (tileVertexFixed(item.tile, vertex)) return null;
    const at = tileEdgeOfVertex(item.tile, vertex);
    const edges = item.tile.edges.map(e => ({ ...e }));
    edges[at.edge].count--;
    if (item.nodes) return tileWithPairFollowing(withNodes({ ...item, tile: { ...item.tile, edges } }, removeNode(item.nodes, vertex)), at.edge, mapWord);
    const points = item.points.slice();
    points.splice(2*vertex, 2);
    return tileWithPairFollowing({ ...item, points, tile: { ...item.tile, edges } }, at.edge, mapWord);
}

// ---------------------------------------------------------------------------
// curved tiles: paths over the same edges
// ---------------------------------------------------------------------------

// how far off the straight line (geodesic) between its corners an inner
// point of an edge may lie for the edge to become its corners alone, as a
// fraction of the corners' distance (in the chart of the first corner)
const STRAIGHT_TOL = 1.e-6;

const copyPoint = q => (q ? [q[0], q[1]] : null);

/** is the item a curved tile: a tile over the nodes of a path */
const isCurvedTile = (item) => !!(item && item.tile && item.nodes);

/** the edge the handle which of node v shapes: h2 the edge going out of the node, h1 the one coming in (at a corner the edge before); -1 for none */
function tileEdgeOfHandle(tile, v, which){
    const at = tileEdgeOfVertex(tile, v);
    if (!at) return -1;
    if (at.index === 0 && which === 'h1') return (at.edge - 1 + tile.edges.length) % tile.edges.length;
    return at.edge;
}

/** may the handle which of node v be out: its edge is not locked */
function tileHandleFree(tile, v, which){
    const k = tileEdgeOfHandle(tile, v, which);
    return k >= 0 && !tile.edges[k].locked;
}

/** the edge segment s (from node s to the next) lies on; -1 for none */
function tileEdgeOfSegment(tile, s){
    const at = tileEdgeOfVertex(tile, s);
    return at ? at.edge : -1;
}

/** the index of corner k (the first node of edge k; corner 0 after the last edge) among n nodes */
function cornerIndex(edges, k, n){
    let v = 0;
    for (let j = 0; j < k; j++) v += edges[j].count;
    return v % n;
}

/**
 * the curved tile with the pair of edge k following it: the pair's inner
 * nodes the images of k's (in reverse order, h1 and h2 swapped, when the
 * pairing reverses), handles included, and the handles of the pair at its
 * corners the images of k's handles at its corners; the corners stay
 */
function curvedWithPairFollowing(item, k, mapWord){
    const tile = item.tile, e = tile.edges[k];
    const starts = edgeStarts(tile), n = item.nodes.length;
    const at = v => item.nodes[v % n];
    const map = mapWord(e.word);
    const image = q => (q ? map(q) : null);
    let inner = [];
    for (let v = starts[k] + 1; v < starts[k + 1]; v++) {
        const a = at(v);
        inner.push({ ...a, p: map(a.p), h1: image(a.h1), h2: image(a.h2) });
    }
    // the handles leaving the pair's first corner and entering its last
    let out = image(at(starts[k]).h2), into = image(at(starts[k + 1]).h1);
    if (e.reversed) {
        inner = inner.reverse().map(a => ({ ...a, h1: a.h2, h2: a.h1 }));
        [out, into] = [into, out];
    }
    const nodes = [];
    const edges = tile.edges.map(x => ({ ...x }));
    for (let j = 0; j < tile.edges.length; j++) {
        nodes.push({ ...at(starts[j]) });
        if (j === e.pair) {
            nodes.push(...inner);
            edges[j].count = inner.length + 1;
        } else {
            for (let v = starts[j] + 1; v < starts[j + 1]; v++) nodes.push(at(v));
        }
    }
    const first = cornerIndex(edges, e.pair, nodes.length), last = cornerIndex(edges, e.pair + 1, nodes.length);
    nodes[first] = { ...nodes[first], h2: out };
    nodes[last] = { ...nodes[last], h1: into };
    return withNodes({ ...item, tile: { ...tile, edges } }, nodes);
}

/** a curved tile with edge k's inner nodes replaced (nodes, or [x, y] points as nodes without handles) and its handles at its corners ends {h2, h1}, its pair following */
function curvedReplacedEdge(item, k, inner, mapWord, ends){
    const tile = item.tile;
    const starts = edgeStarts(tile), n = item.nodes.length;
    const fresh = inner.map(q => Array.isArray(q) ? { p: [q[0], q[1]], h1: null, h2: null }
                                                 : { ...q, p: copyPoint(q.p), h1: copyPoint(q.h1), h2: copyPoint(q.h2) });
    const nodes = [];
    const edges = tile.edges.map(x => ({ ...x }));
    for (let j = 0; j < tile.edges.length; j++) {
        nodes.push({ ...item.nodes[starts[j] % n] });
        if (j === k) {
            nodes.push(...fresh);
            edges[j].count = fresh.length + 1;
        } else {
            for (let v = starts[j] + 1; v < starts[j + 1]; v++) nodes.push(item.nodes[v % n]);
        }
    }
    const first = cornerIndex(edges, k, nodes.length), last = cornerIndex(edges, k + 1, nodes.length);
    nodes[first] = { ...nodes[first], h2: copyPoint(ends && ends.h2) };
    nodes[last] = { ...nodes[last], h1: copyPoint(ends && ends.h1) };
    return tileWithPairFollowing(withNodes({ ...item, tile: { ...tile, edges } }, nodes), k, mapWord);
}

/**
 * a curved tile with its nodes replaced by nodes edited in place (as many,
 * the node tool's edits of handles, segments and the kind of a node): the
 * pairs of the edges that changed follow them, the edge `prefer` last (when
 * an edge and its pair both changed, the one followed last is kept); null
 * when the edit would move a corner or make it smooth, or give a locked edge
 * a handle
 */
function tileWithNodes(item, nodes, mapWord, prefer = -1){
    const tile = item.tile;
    if (!item.nodes || nodes.length !== item.nodes.length) return null;
    const same = (a, b) => (!a && !b) || (!!a && !!b && a[0] === b[0] && a[1] === b[1]);
    const changed = new Set();
    for (let v = 0; v < nodes.length; v++) {
        const m = nodes[v], o = item.nodes[v];
        const at = tileEdgeOfVertex(tile, v);
        if (!at) return null;
        if ((!same(m.p, o.p) && tileVertexFixed(tile, v)) || (at.index === 0 && m.smooth)) return null;
        if (!same(m.p, o.p) || nodeType(m) !== nodeType(o)) changed.add(at.edge);
        for (const which of ['h1', 'h2']) {
            if (same(m[which], o[which])) continue;
            const k = tileEdgeOfHandle(tile, v, which);
            if (m[which] && tile.edges[k].locked) return null;
            changed.add(k);
        }
    }
    let out = withNodes(item, nodes);
    for (const k of changed) if (k !== prefer) out = tileWithPairFollowing(out, k, mapWord);
    if (changed.has(prefer)) out = tileWithPairFollowing(out, prefer, mapWord);
    return out;
}

/**
 * a tile as a curved tile: its points the nodes, without handles; an edge
 * whose inner points lie on the straight line between its corners (with a
 * chart, the geodesic: straight in the chart of its first corner) its two
 * corners alone, so that a domain's arc becomes the exact geodesic side;
 * geodesic: a geodesic path (in the hyperbolic plane and on the sphere,
 * where the generators map its sides onto their pairs exactly). The pairs
 * then the images of the lower-indexed edges again. A curved tile stays as
 * it is. keepNodes: every point a node, no edge made its corners alone (the
 * nodes keep the indices of the points)
 */
function curvedTile(item, mapWord, geodesic = false, chart = null, keepNodes = false){
    if (!item.tile || item.nodes) return item;
    const tile = item.tile, starts = edgeStarts(tile), n = item.points.length/2;
    const pt = v => [item.points[2*(v % n)], item.points[2*(v % n) + 1]];
    const straight = (k) => {
        const a = pt(starts[k]);
        const c = chart ? chart(a) : { to: q => [q[0] - a[0], q[1] - a[1]] };
        const b = c.to(pt(starts[k + 1])), L = Math.hypot(b[0], b[1]);
        if (!(L > 0)) return false;
        for (let v = starts[k] + 1; v < starts[k + 1]; v++) {
            const q = c.to(pt(v));
            const across = Math.abs(b[0]*q[1] - b[1]*q[0])/L, along = (b[0]*q[0] + b[1]*q[1])/L;
            if (!(across <= STRAIGHT_TOL*L) || along < -STRAIGHT_TOL*L || along > (1 + STRAIGHT_TOL)*L) return false;
        }
        return true;
    };
    const nodes = [];
    const edges = tile.edges.map(e => ({ ...e }));
    for (let k = 0; k < tile.edges.length; k++) {
        nodes.push({ p: pt(starts[k]), h1: null, h2: null });
        if (!keepNodes && straight(k)) { edges[k].count = 1; continue; }
        for (let v = starts[k] + 1; v < starts[k + 1]; v++) nodes.push({ p: pt(v), h1: null, h2: null });
    }
    const base = { ...item, tile: { ...tile, edges } };
    if (geodesic) base.geodesic = true;
    let out = withNodes(base, nodes);
    edges.forEach((e, k) => { if (e.pair !== null && e.pair !== undefined && e.pair > k) out = tileWithPairFollowing(out, k, mapWord); });
    return out;
}

/**
 * a curved tile as a tile of points: its outline flattened as it is drawn
 * (a geodesic tile's along the geometry's curves), each edge over the
 * points of its segments; the pairs the images of the lower-indexed edges
 * again, point by point. A tile of points stays as it is
 */
function polylineTile(item, mapWord){
    if (!isCurvedTile(item)) return item;
    const tile = item.tile;
    const flat = flattenItem(item);
    const edges = tile.edges.map(e => ({ ...e, count: 0 }));
    for (const piece of flat.pieces) {
        const k = piece.seg >= 0 ? tileEdgeOfSegment(tile, piece.seg) : -1;
        if (k < 0) return item;
        edges[k].count++;
    }
    let out = { ...item, type: 'polyline', points: flat.points.slice(), tile: { ...tile, edges } };
    delete out.nodes;
    delete out.outline;
    delete out.geodesic;
    edges.forEach((e, k) => { if (e.pair !== null && e.pair !== undefined && e.pair > k) out = tileWithPairFollowing(out, k, mapWord); });
    return out;
}

/** the item without its pairing: a plain outline */
function releasedTile(item){
    if (!item.tile) return item;
    const { tile, ...plain } = item;
    return plain;
}

// ---------------------------------------------------------------------------
// the domain's sides as point sequences (pattern coordinates)
// ---------------------------------------------------------------------------

const TWO_PI = 2*Math.PI;
const wrapAngle = t => ((t % TWO_PI) + TWO_PI) % TWO_PI;
const angleOn = (side, p) => Math.atan2(p[1] - side.v[1], p[0] - side.v[0]);

/** the arc of a circle side from a to b passing mid: {ta, d} start angle and signed sweep */
function arcSweep(side, a, b, mid){
    const ta = angleOn(side, a);
    let d = wrapAngle(angleOn(side, b) - ta);
    if (wrapAngle(angleOn(side, mid) - ta) > d) d -= TWO_PI;
    return { ta, d };
}

/** points along an arc of a circle side, the ends exactly a and b */
function arcPoints(side, ta, d, segments, a, b){
    const [cx, cy, , r] = side.v;
    const R = Math.abs(r);
    const out = [a[0], a[1]];
    for (let i = 1; i < segments; i++) { const t = ta + d*i/segments; out.push(cx + R*Math.cos(t), cy + R*Math.sin(t)); }
    out.push(b[0], b[1]);
    return out;
}

/** points along a line side from a to b */
function linePoints(a, b, segments){
    const out = [];
    for (let i = 0; i <= segments; i++) { const t = i/segments; out.push(a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t); }
    return out;
}

/** the points of a side from corner a to corner b, along the arc through mid for a circle side */
function sidePoints(side, a, b, mid, segments){
    if (side.type !== SPLANE_SPHERE) return linePoints(a, b, segments);
    const { ta, d } = arcSweep(side, a, b, mid);
    return arcPoints(side, ta, d, segments, a, b);
}

// ---------------------------------------------------------------------------
// the group's words
// ---------------------------------------------------------------------------

/** the map of a word of the group's generators (a generator's name), in the group's coordinates; null for an unknown word */
function wordMap(group, word){
    const names = group.getGenNames ? group.getGenNames() : group.genNames;
    const i = names ? names.indexOf(word) : -1;
    const ref = (i >= 0 && group.transforms) ? group.transforms[i] : (group.genMap ? group.genMap[word] : null);
    if (!ref) return null;
    const t = new ITransform(ref.slice(), word);
    return p => applyTransform(t, p);
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * the tile of the group's fundamental domain: the domain's polygon with its
 * sides paired by the generators (a side on a mirror locked, a side a half
 * turn maps onto itself split at the turn's centre), each paired side
 * derived from its partner so that they fit exactly. group: in pattern
 * coordinates; fromPattern: {map(x, y)} to world coordinates; style: the
 * item's style. Returns the item, or null when the domain has no polygon.
 */
function tileFromDomain(group, fromPattern, style){
    if (!group || !group.getFundDomain || !group.getGenNames || !group.transforms) return null;
    const fd = group.getFundDomain();
    const names = group.getGenNames();
    const elements = generatorElements({ group });
    // the centre of a half turn on a side splits the side in two edges
    const poly = domainPolygon(fd, { corners: elements.filter(e => e.kind === 'cone' && e.center).map(e => e.center) });
    if (!poly) return null;
    const n = poly.sides.length;
    const edgesOfSide = new Map();
    poly.sides.forEach((s, k) => { if (!edgesOfSide.has(s.side)) edgesOfSide.set(s.side, []); edgesOfSide.get(s.side).push(k); });

    // what pairs each edge of the polygon: the edge its word (the generator
    // of the side it maps onto, its inverse the generator of this one) maps
    // it onto; the two halves of a side split by a half turn each other
    const pairing = new Array(n).fill(null);
    for (const e of elements) {
        const [from, to] = e.sides;
        const kf = edgesOfSide.get(from) || [], kt = edgesOfSide.get(to) || [];
        if (from === to && kf.length === 2 && e.kind === 'cone') {
            pairing[kf[0]] = { pair: kf[1], word: names[to] };
            pairing[kf[1]] = { pair: kf[0], word: names[to] };
        } else if (from !== to && kf.length === 1 && kt.length === 1) {
            pairing[kf[0]] = { pair: kt[0], word: names[to] };
            pairing[kt[0]] = { pair: kf[0], word: names[from] };
        }
    }

    // the edges, with their points in pattern coordinates: a mirror side, or
    // one without a pairing, is fixed
    const edges = [];        // {points (corners included), pair, word, reversed, locked}
    for (let k = 0; k < n; k++) {
        const s = poly.sides[k], p = pairing[k];
        const side = fd[s.side];
        const partnerSide = p ? fd[poly.sides[p.pair].side] : null;
        const curved = side.type === SPLANE_SPHERE || (partnerSide && partnerSide.type === SPLANE_SPHERE);
        const points = sidePoints(side, poly.corners[s.from], poly.corners[s.to], poly.mids[k], curved ? ARC_SEGMENTS : 1);
        if (p) edges.push({ points, pair: p.pair, word: p.word, reversed: true, locked: false });
        else edges.push({ points, pair: null, word: null, reversed: false, locked: true });
    }

    // the pairs: the lower-indexed edge is the master, its partner's inner
    // vertices the images of its own; the word is checked to carry the
    // master's corners onto the partner's (the generators' inverse pairing
    // when not), and tells which way round the partner runs
    for (let k = 0; k < edges.length; k++) {
        const e = edges[k];
        if (e.pair === null || e.pair < k) continue;
        const partner = edges[e.pair];
        const pa = partner.points.slice(0, 2), pb = partner.points.slice(-2);
        const a = e.points.slice(0, 2), b = e.points.slice(-2);
        let found = null;
        for (const word of [e.word, partner.word]) {
            const map = wordMap(group, word);
            if (!map) continue;
            const ia = map(a), ib = map(b);
            const dRev = dist(ia, pb) + dist(ib, pa), dFwd = dist(ia, pa) + dist(ib, pb);
            if (Math.min(dRev, dFwd) > CORNER_TOL) continue;
            found = { map, word, reversed: dRev <= dFwd };
            break;
        }
        if (!found) { e.pair = partner.pair = null; e.locked = partner.locked = true; continue; }
        if (found.word !== e.word) { partner.word = e.word; e.word = found.word; }
        e.reversed = partner.reversed = found.reversed;
        const inner = [];
        for (let i = 2; i + 3 < e.points.length; i += 2) inner.push(found.map([e.points[i], e.points[i + 1]]));
        if (e.reversed) inner.reverse();
        partner.points = [...pa, ...inner.flat(), ...pb];
    }

    // the item: the corners and inner vertices of the edges in order, in world coordinates
    const points = [];
    const tileEdges = [];
    for (const e of edges) {
        const pts = e.points;
        for (let i = 0; i + 3 < pts.length; i += 2) points.push(...fromPattern.map(pts[i], pts[i + 1]));
        tileEdges.push({ count: pts.length/2 - 1, pair: e.pair, word: e.word, reversed: e.reversed, locked: e.locked });
    }
    return { type: 'polyline', closed: true, points, style, tile: { edges: tileEdges } };
}

export { tileFromDomain, edgeStarts as tileEdgeStarts, tileEdgeOfVertex, tileVertexFixed, tilePairedVertex, tileMovedVertex, tileInsertedVertex, tileRemovedVertex, tileReplacedEdge, wordMap,
         isCurvedTile, tileEdgeOfHandle, tileHandleFree, tileEdgeOfSegment, tileWithNodes, curvedTile, polylineTile, releasedTile };
