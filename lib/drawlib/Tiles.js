import {
    ITransform,
    SPLANE_SPHERE,
    applyTransform,
    generatorElements,
    domainPolygon,
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

/**
 * the item with the pair of edge k following it: the pair's inner vertices
 * are the images of k's inner vertices (in reverse order when the pairing
 * reverses), as many as k has. mapWord(word) gives the map of a word.
 */
function tileWithPairFollowing(item, k, mapWord){
    const tile = item.tile;
    const e = tile.edges[k];
    if (e.pair === null || e.pair === undefined || e.pair === k) return item;
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
 * following; null for a locked edge
 */
function tileReplacedEdge(item, k, inner, mapWord){
    const tile = item.tile;
    const e = tile.edges[k];
    if (!e || e.locked) return null;
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

/** the item with a vertex moved to x (world), its edge's pair following; null for a fixed vertex */
function tileMovedVertex(item, vertex, x, mapWord){
    if (tileVertexFixed(item.tile, vertex)) return null;
    const points = item.points.slice();
    points[2*vertex] = x[0];
    points[2*vertex + 1] = x[1];
    return tileWithPairFollowing({ ...item, points }, tileEdgeOfVertex(item.tile, vertex).edge, mapWord);
}

/** the item with a vertex x inserted after vertex seg (on the segment seg), its edge's pair following; null on a locked edge */
function tileInsertedVertex(item, seg, x, mapWord){
    const at = tileEdgeOfVertex(item.tile, seg);
    if (!at || item.tile.edges[at.edge].locked) return null;
    const points = item.points.slice();
    points.splice(2*(seg + 1), 0, x[0], x[1]);
    const edges = item.tile.edges.map(e => ({ ...e }));
    edges[at.edge].count++;
    return tileWithPairFollowing({ ...item, points, tile: { ...item.tile, edges } }, at.edge, mapWord);
}

/** the item with a vertex removed, its edge's pair following; null for a fixed vertex */
function tileRemovedVertex(item, vertex, mapWord){
    if (tileVertexFixed(item.tile, vertex)) return null;
    const at = tileEdgeOfVertex(item.tile, vertex);
    const points = item.points.slice();
    points.splice(2*vertex, 2);
    const edges = item.tile.edges.map(e => ({ ...e }));
    edges[at.edge].count--;
    return tileWithPairFollowing({ ...item, points, tile: { ...item.tile, edges } }, at.edge, mapWord);
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

export { tileFromDomain, edgeStarts as tileEdgeStarts, tileEdgeOfVertex, tileVertexFixed, tilePairedVertex, tileMovedVertex, tileInsertedVertex, tileRemovedVertex, tileReplacedEdge, wordMap };
