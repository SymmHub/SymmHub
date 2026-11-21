import {
    ITransform,
    SPLANE_SPHERE,
    applyTransform,
    foldHome,
    generatorElements,
    domainPolygon,
    groupDomainBase,
    groupModelAbsolute,
    groupWalls,
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
//    tile: { edges: [{ count, pair, word, reversed, locked, fitted }] }
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
//  A Kleinian group's generators are Möbius maps, which take a cubic onto a
//  curve that is no cubic (DrawingEditor.pairingMap marks such a map
//  fitImage). Its curved tiles are plain paths; the pair's nodes are the
//  images of the edge's nodes, and each of its segments the cubic fitted to
//  the image of the edge's segment (imageSegment: through the images of the
//  ends, leaving them along the images of the end tangents, so a smooth node
//  stays smooth; its handle lengths fitted): the nodes and handles the tools
//  edit, close to the image (about 1e-5 of the tile for the domain's sides,
//  up to some 1e-3 for a side bent far where the map stretches much). Such
//  a pair is marked fitted (the edge it follows is not), and what is drawn
//  is the exact image: the tile's outline (tileOutline, made by the
//  document's outliner as a geodesic path's is, DrawingDocument.js) has the
//  pair's segments as cubic pieces of the image of the edge's, within 1e-6
//  of the tile, so the copies meet without a gap. An edit of the pair makes
//  it the edge followed and the other the fit. The tile of the domain
//  (tileFromDomain with curves) is made of the domain's arcs, a cubic for at
//  most a quarter turn of each, the pair's nodes the images on its own
//  circle, marked fitted; a locked side (a mirror, a circle) keeps its
//  handles.
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

// the image of a segment under a map that takes a cubic onto no cubic: so
// many samples of it, so many passes of the fit
const FIT_SAMPLES = 32;
const FIT_PASSES = 12;

const pAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const pSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const pMul = (a, s) => [a[0]*s, a[1]*s];

/** the point of the cubic cp at t */
function cubicAt(cp, t){
    const u = 1 - t, a = u*u*u, b = 3*u*u*t, c = 3*u*t*t, d = t*t*t;
    return [a*cp[0][0] + b*cp[1][0] + c*cp[2][0] + d*cp[3][0], a*cp[0][1] + b*cp[1][1] + c*cp[2][1] + d*cp[3][1]];
}

/** the tangent vector v at p carried by the map (its derivative there, by central differences over step) */
function tangentImage(map, p, v, step){
    const L = Math.hypot(v[0], v[1]);
    if (!(L > 0)) return [0, 0];
    const u = [v[0]/L*step, v[1]/L*step];
    return pMul(pSub(map(pAdd(p, u)), map(pSub(p, u))), L/(2*step));
}

/**
 * the cubic [Q0, Q0 + a*T0, Q3 + b*T3, Q3] nearest the points Q (least
 * squares in a and b, the parameters of the points found again on the fit
 * by Newton's steps between the passes), from the parameters t;
 * {cp, err}: err the farthest a point lies from its place on the cubic; null
 * when the fit fails or turns a handle back
 */
function fitLengths(Q0, T0, Q3, T3, Q, t){
    t = t.slice();
    let cp = null;
    for (let pass = 0; pass < FIT_PASSES; pass++) {
        let A11 = 0, A12 = 0, A22 = 0, r1 = 0, r2 = 0;
        for (let i = 0; i < Q.length; i++) {
            const s = t[i], u = 1 - s;
            const f1 = pMul(T0, 3*u*u*s), f2 = pMul(T3, 3*u*s*s);
            const r = pSub(Q[i], pAdd(pMul(Q0, u*u*u + 3*u*u*s), pMul(Q3, s*s*s + 3*u*s*s)));
            A11 += f1[0]*f1[0] + f1[1]*f1[1]; A12 += f1[0]*f2[0] + f1[1]*f2[1]; A22 += f2[0]*f2[0] + f2[1]*f2[1];
            r1 += f1[0]*r[0] + f1[1]*r[1]; r2 += f2[0]*r[0] + f2[1]*r[1];
        }
        const det = A11*A22 - A12*A12;
        if (!(Math.abs(det) > 1.e-14*A11*A22)) return null;
        const a = (r1*A22 - r2*A12)/det, b = (A11*r2 - A12*r1)/det;
        if (!(a > 0 && b > 0)) return null;
        cp = [Q0, pAdd(Q0, pMul(T0, a)), pAdd(Q3, pMul(T3, b)), Q3];
        newtonParameters(cp, Q, t);
    }
    return { cp, err: fitError(cp, Q, t) };
}

/** the parameters t of the points Q moved to their nearest places on the cubic cp (a few Newton steps each) */
function newtonParameters(cp, Q, t){
    const d1 = [pMul(pSub(cp[1], cp[0]), 3), pMul(pSub(cp[2], cp[1]), 3), pMul(pSub(cp[3], cp[2]), 3)];
    const d2 = [pMul(pSub(d1[1], d1[0]), 2), pMul(pSub(d1[2], d1[1]), 2)];
    for (let i = 0; i < Q.length; i++) {
        let s = t[i];
        for (let it = 0; it < 3; it++) {
            const u = 1 - s;
            const r = pSub(cubicAt(cp, s), Q[i]);
            const D1 = pAdd(pAdd(pMul(d1[0], u*u), pMul(d1[1], 2*u*s)), pMul(d1[2], s*s));
            const D2 = pAdd(pMul(d2[0], u), pMul(d2[1], s));
            const den = D1[0]*D1[0] + D1[1]*D1[1] + r[0]*D2[0] + r[1]*D2[1];
            if (!(Math.abs(den) > 0)) break;
            s = Math.min(1, Math.max(0, s - (r[0]*D1[0] + r[1]*D1[1])/den));
        }
        t[i] = s;
    }
}

/** the farthest the points Q lie from the cubic at their parameters t */
function fitError(cp, Q, t){
    let err = 0;
    for (let i = 0; i < Q.length; i++) err = Math.max(err, dist(cubicAt(cp, t[i]), Q[i]));
    return err;
}

/**
 * the image of the cubic cp = [P0, C1, C2, P3] (a retracted handle at its
 * node: a third of the way to the other end) under a map that takes it onto
 * no cubic (a Möbius map): the cubic through the images of its ends that
 * leaves them along the images of its end tangents (a conformal map keeps a
 * smooth node smooth), its handle lengths fitted to the image (least
 * squares, the samples' parameters started from the chord lengths along the
 * image and from the cubic's own; the better fit, or the lengths the map's
 * derivative gives where both fail)
 */
function imageSegment(map, cp){
    const [P0, C1, C2, P3] = cp;
    const Q0 = map(P0), Q3 = map(P3);
    const chord = pSub(P3, P0), L = Math.hypot(chord[0], chord[1]);
    if (!(L > 0)) return [Q0, C1 ? map(C1) : Q0, C2 ? map(C2) : Q3, Q3];
    const h0 = (C1 && dist(C1, P0) > 0) ? pSub(C1, P0) : pMul(chord, 1/3);
    const h3 = (C2 && dist(C2, P3) > 0) ? pSub(C2, P3) : pMul(chord, -1/3);
    const step = 1.e-5*L;
    const T0 = tangentImage(map, P0, h0, step), T3 = tangentImage(map, P3, h3, step);
    const src = [P0, C1 || P0, C2 || P3, P3];
    const Q = [], own = [];
    for (let i = 1; i < FIT_SAMPLES; i++) { own.push(i/FIT_SAMPLES); Q.push(map(cubicAt(src, i/FIT_SAMPLES))); }
    // the parameters by the chord lengths along the image
    const along = [0];
    let prev = Q0;
    for (const q of [...Q, Q3]) { along.push(along[along.length - 1] + dist(prev, q)); prev = q; }
    const total = along[along.length - 1];
    const byChord = total > 0 ? along.slice(1, -1).map(s => s/total) : own;
    // the derivative's lengths, to compare
    const plain = [Q0, pAdd(Q0, T0), pAdd(Q3, T3), Q3];
    const tp = own.slice();
    newtonParameters(plain, Q, tp);
    let best = { cp: plain, err: fitError(plain, Q, tp) };
    for (const t of [byChord, own]) {
        const f = fitLengths(Q0, T0, Q3, T3, Q, t);
        if (f && f.err < best.err) best = f;
    }
    return best.cp;
}

/**
 * the curved tile with the pair of edge k following it: the pair's inner
 * nodes the images of k's (in reverse order, h1 and h2 swapped, when the
 * pairing reverses), handles included, and the handles of the pair at its
 * corners the images of k's handles at its corners; the corners stay. Under
 * a map marked fitImage (a Kleinian group's) each segment of the pair is
 * the cubic fitted to the image of k's (imageSegment), and an auto node of
 * the pair smooth (its handles are the fit's, not its neighbours')
 */
function curvedWithPairFollowing(item, k, mapWord){
    const tile = item.tile, e = tile.edges[k];
    const starts = edgeStarts(tile), n = item.nodes.length;
    const at = v => item.nodes[v % n];
    const map = mapWord(e.word);
    const image = q => (q ? map(q) : null);
    let inner = [], out, into;
    if (map.fitImage) {
        // the nodes of edge k, corner to corner, and their images, the handles the fits'
        const src = [];
        for (let v = starts[k]; v <= starts[k + 1]; v++) src.push(at(v));
        const imgs = src.map(a => {
            const { auto, ...rest } = a;
            return { ...rest, ...(auto ? { smooth: true } : {}), p: map(a.p), h1: null, h2: null };
        });
        for (let i = 0; i + 1 < src.length; i++) {
            const cp = imageSegment(map, [src[i].p, src[i].h2, src[i + 1].h1, src[i + 1].p]);
            imgs[i].h2 = cp[1];
            imgs[i + 1].h1 = cp[2];
        }
        inner = imgs.slice(1, -1);
        out = imgs[0].h2;
        into = imgs[imgs.length - 1].h1;
    } else {
        for (let v = starts[k] + 1; v < starts[k + 1]; v++) {
            const a = at(v);
            inner.push({ ...a, p: map(a.p), h1: image(a.h1), h2: image(a.h2) });
        }
        // the handles leaving the pair's first corner and entering its last
        out = image(at(starts[k]).h2);
        into = image(at(starts[k + 1]).h1);
    }
    if (e.reversed) {
        inner = inner.reverse().map(a => ({ ...a, h1: a.h2, h2: a.h1 }));
        [out, into] = [into, out];
    }
    const nodes = [];
    const edges = tile.edges.map(x => ({ ...x }));
    // a fitted pair is drawn as the exact image of edge k (tileOutline)
    delete edges[k].fitted;
    if (map.fitImage) edges[e.pair].fitted = true;
    else delete edges[e.pair].fitted;
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
    // (no pair of points is a fit)
    const edges = tile.edges.map(({ fitted, ...e }) => ({ ...e, count: 0 }));
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

// the most of a turn one cubic of a side's arc stands for (its error then
// 2.7e-4 of the radius at most), and the most cubics a side gets
const ARC_PIECE = Math.PI/2;
const ARC_PIECES_MOST = 8;

/** a side from corner a to corner b: {arc: {c, R, d}} along the arc through mid for a circle side (d its signed sweep), else {} */
function sideCourse(side, a, b, mid){
    if (side.type !== SPLANE_SPHERE) return {};
    const { d } = arcSweep(side, a, b, mid);
    return { arc: { c: [side.v[0], side.v[1]], R: Math.abs(side.v[3]), d } };
}

/** the turns of the pieces between the points q along the side's arc (each the way the arc goes); [] for a line */
function pieceTurns(course, q){
    if (!course.arc) return [];
    const { c, d } = course.arc;
    const ang = p => Math.atan2(p[1] - c[1], p[0] - c[0]);
    const out = [];
    for (let i = 0; i + 1 < q.length; i++) {
        const t = wrapAngle(ang(q[i + 1]) - ang(q[i]));
        out.push(d >= 0 ? t : t - TWO_PI);
    }
    return out;
}

/** points from corner a to corner b dividing the side in n equal pieces (of its arc's turn, or of its length) */
function sideDivision(course, a, b, n){
    if (!course.arc) return Array.from({ length: n + 1 }, (_, i) => (i === 0 ? a : i === n ? b : [a[0] + (b[0] - a[0])*i/n, a[1] + (b[1] - a[1])*i/n]));
    const { c, R, d } = course.arc;
    const ta = Math.atan2(a[1] - c[1], a[0] - c[0]);
    return Array.from({ length: n + 1 }, (_, i) => (i === 0 ? a : i === n ? b : [c[0] + R*Math.cos(ta + d*i/n), c[1] + R*Math.sin(ta + d*i/n)]));
}

/**
 * the nodes of a side through the points q (corner to corner, in its
 * order): on an arc each piece the cubic of its turn (its handles along the
 * circle's tangents, 4/3 tan(turn/4) of the radius long), the inner nodes
 * smooth; on a line no handles
 */
function sideNodes(course, q){
    const nodes = q.map(p => ({ p: [p[0], p[1]], h1: null, h2: null }));
    if (!course.arc) return nodes;
    const { c, R } = course.arc;
    const turns = pieceTurns(course, q);
    const tangent = p => { const a = Math.atan2(p[1] - c[1], p[0] - c[0]); return [-Math.sin(a), Math.cos(a)]; };
    for (let i = 0; i < turns.length; i++) {
        const k = 4/3*Math.tan(turns[i]/4)*R;
        nodes[i].h2 = pAdd(q[i], pMul(tangent(q[i]), k));
        nodes[i + 1].h1 = pSub(q[i + 1], pMul(tangent(q[i + 1]), k));
    }
    for (let i = 1; i + 1 < nodes.length; i++) nodes[i].smooth = true;
    return nodes;
}

/** how many cubics the side gets: one for each quarter turn of its arc (at least one) */
const piecesOf = (course) => (course.arc ? Math.max(1, Math.ceil(Math.abs(course.arc.d)/ARC_PIECE - 1.e-9)) : 1);

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
 * the point folded by the group into the region inside all the sides of
 * its domain; null when the fold does not get there (a point of the limit
 * set, or one too far out)
 */
function foldedPoint(group, p){
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    const f = foldHome(group, p);
    return (f.inDomain && Number.isFinite(f.pnt[0]) && Number.isFinite(f.pnt[1])) ? f.pnt : null;
}

/**
 * the tile of the group's fundamental domain: the domain's polygon with its
 * sides paired by the generators (a side on a mirror locked, a side a half
 * turn maps onto itself split at the turn's centre), each paired side
 * derived from its partner so that they fit exactly.
 *
 * The sides bound a polygon in every component of the plane the group
 * tiles: a bent (Kleinian) group has two, of different shapes, and a group
 * of the hyperbolic plane has its domain and the mirror image of it beyond
 * the absolute. The tile is that of the maker's domain: of a Dirichlet
 * domain the polygon that holds its base (the points nearer the base than
 * its images: the other polygons are only what the same sides bound
 * elsewhere), wherever the base is, beyond the absolute too; of any other
 * domain the polygon inside the absolute the maker gives (Group.absolute),
 * or of the model the sides fit. A point (at, pattern coordinates: where
 * the pointer is) asks for the tile whose copies cover it: the polygon the
 * group folds the point into. Where a point's polygon is none (the limit
 * set; a region that reaches infinity, as the mirror image of a domain
 * about the centre of its disk does), the next rule tells: without the
 * pointer's the base's, without the base's the one inside the absolute.
 *
 * group: in pattern coordinates; fromPattern: {map(x, y)} to world
 * coordinates (a similarity); style: the item's style. Returns the item, or
 * null when the domain has no polygon. curves: the tile a curved tile of
 * cubics (a Kleinian group's, whose sides are circle arcs): an arc a cubic
 * for each quarter turn of it at most, a line one straight segment, the
 * pair's nodes the images of the edge's, its handles those of its own
 * circle there (where an edge is a line and its pair an arc, the line is
 * divided as the arc needs)
 */
function tileFromDomain(group, fromPattern, style, at = null, curves = false){
    if (!group || !group.getFundDomain || !group.getGenNames || !group.transforms) return null;
    const fd = group.getFundDomain();
    const names = group.getGenNames();
    const elements = generatorElements({ group });
    // the centre of a half turn on a side splits the side in two edges: the centre
    // in the domain, and for the polygon beyond the absolute the one there
    const centres = [];
    for (const e of elements) {
        if (e.kind !== 'cone') continue;
        if (e.center) centres.push(e.center);
        for (const p of (e.isometry && e.isometry.mirrorFixedPoints) || []) centres.push(p);
    }
    const held = at ? foldedPoint(group, at) : null;
    // a Dirichlet domain's base, and the absolute of the model the group was built in
    // (the group's own, or that of the group a Dirichlet domain was made from)
    const base = groupDomainBase(group);
    const absolute = groupModelAbsolute(group);
    // an orbifold's sides sharing one splane, each along its stretch
    const walls = groupWalls(group);
    const poly = (held && domainPolygon(fd, { corners: centres, absolute, at: held, walls }))
              || (base && domainPolygon(fd, { corners: centres, absolute, at: base, walls }))
              || domainPolygon(fd, { corners: centres, absolute, walls });
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
        const course = sideCourse(side, poly.corners[s.from], poly.corners[s.to], poly.mids[k]);
        if (p) edges.push({ points, course, pair: p.pair, word: p.word, reversed: true, locked: false });
        else edges.push({ points, course, pair: null, word: null, reversed: false, locked: true });
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
        if (curves) {
            // the cubics: the edge divided for both arcs (no piece of the pair's past a
            // quarter turn by much), the pair through the images of its points
            const imageOf = (q) => { const im = q.slice(1, -1).map(found.map); if (e.reversed) im.reverse(); return [pa, ...im, pb]; };
            let n = Math.max(piecesOf(e.course), piecesOf(partner.course)), q, qp;
            for (;; n++) {
                q = sideDivision(e.course, a, b, n);
                qp = imageOf(q);
                if (n >= ARC_PIECES_MOST || !pieceTurns(partner.course, qp).some(t => Math.abs(t) > 1.15*ARC_PIECE)) break;
            }
            e.nodes = sideNodes(e.course, q);
            partner.nodes = sideNodes(partner.course, qp);
            // (drawn as the exact image of the edge's cubics: tileOutline)
            partner.fitted = true;
        }
    }

    if (curves) return curvedDomainTile(edges, fromPattern, style);

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

/**
 * the curved tile of the domain's edges (tileFromDomain with curves): each
 * edge's nodes (pattern coordinates, corner to corner; an edge without its
 * own, a locked one, divided as its arc needs), a corner's h1 the end of
 * the edge before it, its h2 the start of its own, carried to the world
 * (fromPattern a similarity, so a cubic's image is the cubic of the images)
 */
function curvedDomainTile(edges, fromPattern, style){
    const P = (q) => (q ? fromPattern.map(q[0], q[1]) : null);
    const lists = edges.map(e => e.nodes || sideNodes(e.course, sideDivision(e.course, e.points.slice(0, 2), e.points.slice(-2), piecesOf(e.course))));
    const nodes = [];
    const tileEdges = [];
    lists.forEach((list, k) => {
        const prev = lists[(k - 1 + lists.length) % lists.length];
        nodes.push({ p: P(list[0].p), h1: P(prev[prev.length - 1].h1), h2: P(list[0].h2) });
        for (let i = 1; i + 1 < list.length; i++) nodes.push({ ...list[i], p: P(list[i].p), h1: P(list[i].h1), h2: P(list[i].h2) });
        const e = edges[k];
        tileEdges.push({ count: list.length - 1, pair: e.pair, word: e.word, reversed: e.reversed, locked: e.locked, ...(e.fitted && !e.locked ? { fitted: true } : {}) });
    });
    return withNodes({ type: 'path', closed: true, style, tile: { edges: tileEdges } }, nodes);
}

// ---------------------------------------------------------------------------
// the outline of a curved tile whose pairs are fits (a Kleinian group's)
// ---------------------------------------------------------------------------

// the exact image of an edge stands within this fraction of the tile's extent
// (the pieces halved until so), in at most 2^OUTLINE_DEPTH pieces a segment;
// a pair's nodes are taken for the images of the edge's within NODE_TOL of it
const OUTLINE_TOL = 1.e-6;
const OUTLINE_DEPTH = 6;
const NODE_TOL = 1.e-7;

/** the cubic from node a to node b as it is drawn (Paths.js): a straight one (no handles) with its control points at the thirds */
function drawnCubic(a, b){
    if (!a.h2 && !b.h1) { const d = pSub(b.p, a.p); return [a.p, pAdd(a.p, pMul(d, 1/3)), pSub(b.p, pMul(d, 1/3)), b.p]; }
    return [a.p, a.h2 || a.p, b.h1 || b.p, b.p];
}

/** the derivative of the cubic cp at t */
function cubicDerivative(cp, t){
    const u = 1 - t;
    const d = [pSub(cp[1], cp[0]), pSub(cp[2], cp[1]), pSub(cp[3], cp[2])];
    return pMul(pAdd(pAdd(pMul(d[0], u*u), pMul(d[1], 2*u*t)), pMul(d[2], t*t)), 3);
}

/**
 * the image of the cubic cp under the map as cubic pieces [{c1, c2, p, t0,
 * t1}] from the image of cp[0], t0 and t1 the part of cp's parameter each
 * stands for: on a part, the cubic with the image's points and derivatives
 * at its ends (Hermite's; a conformal map keeps the pieces' joints smooth),
 * halved until it lies within reach of the image at the part's quarters
 */
function imagePieces(map, cp, reach){
    const size = Math.max(dist(cp[0], cp[1]), dist(cp[1], cp[2]), dist(cp[2], cp[3]), dist(cp[0], cp[3]));
    const step = 1.e-5*(size || 1);
    const at = (t) => { const B = cubicAt(cp, t); return { q: map(B), d: tangentImage(map, B, cubicDerivative(cp, t), step) }; };
    const out = [];
    const piece = (t0, A, t1, B, depth) => {
        const h = t1 - t0;
        const c1 = pAdd(A.q, pMul(A.d, h/3)), c2 = pSub(B.q, pMul(B.d, h/3));
        if (depth < OUTLINE_DEPTH) {
            const hermite = [A.q, c1, c2, B.q];
            const off = Math.max(...[0.25, 0.5, 0.75].map(u => dist(cubicAt(hermite, u), map(cubicAt(cp, t0 + u*h)))));
            if (!(off <= reach)) {
                const tm = 0.5*(t0 + t1), M = at(tm);
                piece(t0, A, tm, M, depth + 1);
                piece(tm, M, t1, B, depth + 1);
                return;
            }
        }
        out.push({ c1, c2, p: B.q, t0, t1 });
    };
    piece(0, at(0), 1, at(1), 0);
    return out;
}

/** pieces from start (imagePieces) the other way round: from their end back to start, the parameter turned (1 - t) */
function reversedPieces(pieces, start){
    const out = [];
    for (let i = pieces.length - 1; i >= 0; i--) {
        const pc = pieces[i];
        out.push({ c1: pc.c2, c2: pc.c1, p: i > 0 ? pieces[i - 1].p : start, t0: 1 - pc.t1, t1: 1 - pc.t0 });
    }
    return out;
}

/**
 * the outline a curved tile is drawn by where its pairs are fits (a Kleinian
 * group's; the document's outliner makes it, DrawingGeometry.kleinianOutliner):
 * the tile's nodes, each edge marked fitted drawn as the exact image of its
 * pair's cubics under the pair's word (mapWord(word): world to world, null
 * for an unknown word), as cubic pieces within tol of the tile's extent;
 * {nodes, source} as Paths.geodesicOutline gives (source per node of the
 * outline: {seg, t0, t1}, the part of the tile's segment its segment is;
 * null for none). A fitted edge whose nodes are not the images of its
 * pair's (the group changed since) is drawn by its own nodes; null when no
 * edge is drawn as an image
 */
function tileOutline(item, mapWord, tol = OUTLINE_TOL){
    const tile = item.tile, nodes = item.nodes;
    if (!tile || !nodes || !nodes.length || !item.closed || nodes.some(m => m.ringEnd)) return null;
    const starts = edgeStarts(tile), n = nodes.length;
    if (starts[starts.length - 1] !== n) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of nodes) for (const q of [m.p, m.h1, m.h2]) {
        if (!q) continue;
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
    const extent = Math.max(x1 - x0, y1 - y0);
    if (!(extent > 0)) return null;
    // per segment of the tile (from node s) the pieces of the image it is drawn by
    const parts = new Array(n).fill(null);
    let any = false;
    tile.edges.forEach((e, j) => {
        const k = e.pair;
        if (!e.fitted || e.locked || k === null || k === undefined || k === j) return;
        const src = tile.edges[k];
        if (!src || src.fitted || src.locked || src.pair !== j || src.count !== e.count) return;
        const map = mapWord(src.word);
        if (!map) return;
        const m = src.count;
        const from = [], to = [];
        for (let i = 0; i <= m; i++) { from.push(nodes[(starts[k] + i) % n]); to.push(nodes[(starts[j] + i) % n]); }
        if (from.some((a, i) => !(dist(map(a.p), to[src.reversed ? m - i : i].p) <= NODE_TOL*extent))) return;
        for (let i = 0; i < m; i++) {
            const cp = drawnCubic(from[i], from[i + 1]);
            const pieces = imagePieces(map, cp, tol*extent);
            parts[(starts[j] + (src.reversed ? m - 1 - i : i)) % n] = src.reversed ? reversedPieces(pieces, map(cp[0])) : pieces;
        }
        any = true;
    });
    if (!any) return null;
    const out = [], source = [];
    // the handle the segment before leaves at the node it ends at
    let h1 = null;
    for (let i = 0; i < n; i++) {
        const a = nodes[i], b = nodes[(i + 1) % n];
        out.push({ p: copyPoint(a.p), h1, h2: null, ...(a.smooth ? { smooth: true } : {}) });
        source.push(null);
        const pieces = parts[i] || [{ c1: a.h2, c2: b.h1, p: b.p, t0: 0, t1: 1 }];
        pieces.forEach((pc, q) => {
            const last = out.length - 1;
            out[last].h2 = copyPoint(pc.c1);
            source[last] = { seg: i, t0: pc.t0, t1: pc.t1 };
            if (q < pieces.length - 1) {
                // a node inside the image: its handles in line
                out.push({ p: copyPoint(pc.p), h1: copyPoint(pc.c2), h2: null, smooth: true });
                source.push(null);
            } else {
                h1 = copyPoint(pc.c2);
            }
        });
    }
    // the closing segment ends at the first node
    out[0].h1 = h1;
    return { nodes: out, source };
}

export { tileFromDomain, edgeStarts as tileEdgeStarts, tileEdgeOfVertex, tileVertexFixed, tilePairedVertex, tileMovedVertex, tileInsertedVertex, tileRemovedVertex, tileReplacedEdge, wordMap,
         isCurvedTile, tileEdgeOfHandle, tileHandleFree, tileEdgeOfSegment, tileWithNodes, curvedTile, polylineTile, releasedTile, tileOutline };
