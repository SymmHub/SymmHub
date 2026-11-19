/*
  tests of the curved tiles (lib/drawlib/Tiles.js, docs/node_editing_plan.md 5.7)

    node tests/drawlib/tiles.mjs

  A curved tile is a closed path over the tile's edges. Its paired edges are
  the images of each other node by node, handles included (reversed: the
  order turned round, h1 and h2 swapped), and so the image of the curve
  wherever the generators are isometries of the geometry the path is drawn
  in: the plane in the wallpaper groups, the hyperbolic plane for a geodesic
  tile. Checked here:
  - in wallpaper groups, a tile from the domain with Curved sides on is a
    path; after its sides take handles, a node and a smooth node (the node
    tool's edits through tileWithNodes, tileInsertedVertex, tileMovedVertex),
    every pair is the image of its edge within 1e-12, the corners stay, a
    corner made smooth or a handle on a locked edge is refused;
  - To path then To polyline gives the tile of points back, and undo the
    tile before;
  - an edge drawn from corner to corner as nodes (the pen) becomes that edge
    with its handles, on either copy direction;
  - in a hyperbolic group the domain's arcs become exact geodesic sides
    (edges of their corners alone), and a curved edge's pair is the image of
    its outline, sampled along the geometry's curves;
  - To polyline on a curved tile gives a tile of points whose pairs are
    exact images point by point;
  - Release tile drops the pairing;
  - every triangle group K L M and *K L M (K L M in 2..8) and every rotation
    group of the sphere gives a tile that lies in its domain, a hyperbolic
    one inside the disk (the arcs of the sides the short way round), *K L M
    with its three mirrors locked, the others with every side paired, a half
    turn's side split at the centre; in a disk scaled and moved the tile is
    the image of the unit disk's;
  - the makers that build in the upper half plane or, with their switch uhp
    off, in the disk (KLMN, KLx, 5 and 6 splanes, 22222, *22222, *222222)
    give a tile in both: the polygon above the absolute, not its mirror
    image, and the image of the disk's tile corner for corner;
  - the same makers bent (Kleinian groups: the sides bound a polygon in each
    component) give the tile of the polygon inside the absolute their group
    carries, again the same in both models, and the same when the group is
    turned, scaled and moved; Maskit's group, whose sides bound one closed
    polygon and two regions to infinity, gives that polygon;
  - a point (tileFromDomain's at, the Tile tool's pointer) asks for the tile
    whose copies cover it: below the absolute of a group of the half plane
    the mirror image of the tile, in a bent group the tile of the other
    component, the one the mirror image becomes as the group bends; the
    disk's tile out there is its image where the domain out there is a
    polygon, and the maker's tile where it reaches infinity; the editor
    takes the point in world coordinates;
  - a Dirichlet domain (the symmetry's operation; the Grandma and Maskit
    makers' own domains) gives, without a point, the tile of the polygon
    that holds its base, in whichever component the base is: the base goes
    with the group through clone and applyTransform. In a straight group the
    tile for the mirror image of the base is the mirror image of the tile;
    a point still comes first; a group bent by half a degree, whose sides
    all but fit a model, keeps its polygon with a cusp (the absolute is that
    of the group the domain was made from).
*/

import { Group_KLM, Group_WP, Group_Grandma, Group_Spherical, Group_Maskit2,
         Group_KLMN, Group_KLx, Group_5splanes, Group_6splanes, Group_22222, Group_s22222, Group_s222222,
         dirichletBase, selectDirichletSides, makeDirichletGroup } from '../../lib/grouplib/grouplib.js';
import { U4, iPoint, iSphere, Group, ITransform } from '../../lib/invlib/invlib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';
import { patternToWorldMap } from '../../lib/drawlib/Folder.js';
import { outlinePoint } from '../../lib/drawlib/Paths.js';
import { tileEdgeStarts, tileWithNodes, tileInsertedVertex, tileMovedVertex, tileRemovedVertex, tileReplacedEdge,
         tileEdgeOfHandle, tileHandleFree, tileFromDomain, wordMap } from '../../lib/drawlib/Tiles.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);

const PTC = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };

function newEditor(group){
    const document = DrawingDocument();
    document.clear();
    document.setOutliner(groupOutliner(group, PTC));
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc: PTC, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}

/** an edge's points in order from its first corner: corner, its h2, (h1, p, h2) of each inner node, the last corner's h1, the last corner */
function edgeSequence(item, k){
    const starts = tileEdgeStarts(item.tile), n = item.nodes.length;
    const out = [];
    for (let v = starts[k]; v <= starts[k + 1]; v++) {
        const a = item.nodes[v % n];
        if (v > starts[k]) out.push(a.h1);
        out.push(a.p);
        if (v < starts[k + 1]) out.push(a.h2);
    }
    return out;
}

/** the largest distance between a curved tile's paired edges and the images of their edges, node by node and handle by handle (Infinity when they do not match up) */
function pairError(item, mapWord){
    let err = 0;
    item.tile.edges.forEach((e, k) => {
        if (e.pair === null || e.pair === undefined || e.pair === k) return;
        const map = mapWord(e.word);
        let image = edgeSequence(item, k).map(q => (q ? map(q) : null));
        if (e.reversed) image = image.reverse();
        const got = edgeSequence(item, e.pair);
        if (got.length !== image.length) { err = Infinity; return; }
        image.forEach((q, i) => {
            if (!q !== !got[i]) err = Infinity;
            else if (q) err = Math.max(err, dist(q, got[i]));
        });
    });
    return err;
}

/** the same for a tile of points */
function pointPairError(item, mapWord){
    const starts = tileEdgeStarts(item.tile), n = item.points.length/2;
    const pts = k => { const out = []; for (let v = starts[k]; v <= starts[k + 1]; v++) out.push([item.points[2*(v % n)], item.points[2*(v % n) + 1]]); return out; };
    let err = 0;
    item.tile.edges.forEach((e, k) => {
        if (e.pair === null || e.pair === undefined || e.pair === k) return;
        const map = mapWord(e.word);
        let image = pts(k).map(map);
        if (e.reversed) image = image.reverse();
        const got = pts(e.pair);
        if (got.length !== image.length) { err = Infinity; return; }
        image.forEach((q, i) => { err = Math.max(err, dist(q, got[i])); });
    });
    return err;
}

const corners = (item) => tileEdgeStarts(item.tile).slice(0, -1).map(v => item.nodes ? item.nodes[v].p : [item.points[2*v], item.points[2*v + 1]]);
const cornerShift = (a, b) => Math.max(...corners(a).map((p, k) => dist(p, corners(b)[k])));

/** a free edge with a pair other than itself, the first one; -1 for none */
const freeEdge = (item) => item.tile.edges.findIndex((e, k) => !e.locked && e.pair !== null && e.pair !== undefined && e.pair !== k);

/**
 * the node tool's edits on edge k of a curved tile: a node added in the middle
 * of its first segment, both corners' handles on the edge pulled out, the new
 * node smooth with handles, then the new node moved; the pairs follow at each
 * step. Returns the tile after each step
 */
function curvedEdits(editor, doc, id, k){
    const mapWord = editor.pairingMap;
    const steps = {};
    let item = doc.getItem(id);
    const starts = tileEdgeStarts(item.tile);
    const apply = (changed) => { editor.applyReplace(new Map([[id, changed]])); return doc.getItem(id); };
    item = apply(tileInsertedVertex(item, starts[k], null, mapWord, 0.5, editor.curveSplitter(item)));
    steps.inserted = item;
    const s = tileEdgeStarts(item.tile);
    const a = item.nodes[s[k]].p, b = item.nodes[(s[k + 1]) % item.nodes.length].p, m = item.nodes[s[k] + 1].p;
    const d = [b[0] - a[0], b[1] - a[1]], perp = [-d[1], d[0]];
    const at = (p, u, w) => [p[0] + u*d[0] + w*perp[0], p[1] + u*d[1] + w*perp[1]];
    const nodes = item.nodes.map(q => ({ ...q }));
    nodes[s[k]].h2 = at(a, 0.15, 0.2);
    nodes[(s[k + 1]) % nodes.length].h1 = at(b, -0.1, -0.15);
    nodes[s[k] + 1] = { ...nodes[s[k] + 1], h1: at(m, -0.2, 0.05), h2: at(m, 0.2, -0.05), smooth: true };
    const handled = tileWithNodes(item, nodes, mapWord, k);
    steps.handled = handled ? apply(handled) : null;
    if (!handled) return steps;
    steps.moved = apply(tileMovedVertex(steps.handled, s[k] + 1, at(m, 0.05, 0.1), mapWord, editor.nodeChart(steps.handled)));
    return steps;
}

// ── wallpaper groups ────────────────────────────────────────────────────────
for (const type of ['632', '442', '333', '2222', '4*2', '3*3', '22x']) {
    const group = new Group_WP({ type }).getGroup();
    const { doc, editor } = newEditor(group);
    const mapWord = editor.pairingMap;
    editor.setStyleValue('curvedTiles', true);
    const tile = editor.addTileFromDomain();
    if (!tile) { check(false, `${type}: a tile from the domain`); continue; }
    check(tile.type === 'path' && !!tile.nodes && !tile.geodesic && tile.nodes.length === tile.tile.edges.reduce((s, e) => s + e.count, 0),
          `${type}: with Curved sides on the tile is a path over its edges (${tile.tile.edges.length} edges, ${tile.nodes.length} nodes)`);
    check(pairError(tile, mapWord) < 1e-12, `${type}: its pairs are the images of their edges (${fmt(pairError(tile, mapWord))})`);
    const k = freeEdge(tile);
    if (k < 0) { check(false, `${type}: an edge with a pair`); continue; }
    const steps = curvedEdits(editor, doc, tile.id, k);
    check(!!steps.inserted && pairError(steps.inserted, mapWord) < 1e-12 && steps.inserted.tile.edges[k].count === 2
          && steps.inserted.tile.edges[tile.tile.edges[k].pair].count === 2,
          `${type}: a node added on edge ${k}: its pair gets one too (${fmt(pairError(steps.inserted, mapWord))})`);
    check(!!steps.handled && pairError(steps.handled, mapWord) < 1e-12 && cornerShift(steps.handled, tile) === 0,
          `${type}: the corners' handles and a smooth node's: the pair is the image within 1e-12 (${fmt(steps.handled ? pairError(steps.handled, mapWord) : NaN)}), the corners stay`);
    const pe = tile.tile.edges[k];
    check(!!steps.handled && (pe.reversed ? !!steps.handled.nodes[tileEdgeStarts(steps.handled.tile)[pe.pair] + 1].smooth : true),
          `${type}: the smooth node's image is smooth (the pairing ${pe.reversed ? 'reverses' : 'keeps the order'})`);
    check(!!steps.moved && pairError(steps.moved, mapWord) < 1e-12, `${type}: the node moved, its handles along: the pair follows (${fmt(steps.moved ? pairError(steps.moved, mapWord) : NaN)})`);
    // refused: a corner made smooth, a handle on a locked edge, a corner moved
    const h = steps.handled;
    const sm = h.nodes.map((q, v) => v === 0 ? { ...q, smooth: true } : q);
    check(tileWithNodes(h, sm, mapWord) === null, `${type}: a corner made smooth is refused`);
    const moved = h.nodes.map((q, v) => v === 0 ? { ...q, p: [q.p[0] + 0.01, q.p[1]] } : q);
    check(tileWithNodes(h, moved, mapWord) === null, `${type}: a corner moved is refused`);
    const locked = h.tile.edges.findIndex(e => e.locked);
    if (locked >= 0) {
        const v = tileEdgeStarts(h.tile)[locked];
        check(!tileHandleFree(h.tile, v, 'h2') && tileEdgeOfHandle(h.tile, v, 'h2') === locked, `${type}: the handle of a corner into a locked edge is not free`);
        const into = h.nodes.map((q, w) => w === v ? { ...q, h2: [q.p[0] + 0.01, q.p[1] + 0.01] } : q);
        check(tileWithNodes(h, into, mapWord) === null, `${type}: a handle on a locked edge is refused`);
    }
    // the node removed again: the pair loses it too
    const removed = tileRemovedVertex(steps.moved, tileEdgeStarts(steps.moved.tile)[k] + 1, mapWord);
    check(!!removed && removed.tile.edges[k].count === 1 && removed.tile.edges[pe.pair].count === 1 && pairError(removed, mapWord) < 1e-12,
          `${type}: the node removed: the pair loses its image too`);
    // an edge replaced by nodes from its last corner to its first (a pen path drawn backwards)
    const s = tileEdgeStarts(h.tile), n = h.nodes.length;
    const A = h.nodes[s[k]].p, B = h.nodes[s[k + 1] % n].p;
    const mid = [0.5*(A[0] + B[0]) + 0.05, 0.5*(A[1] + B[1]) - 0.03];
    const pen = [{ p: B, h1: null, h2: [B[0] + 0.02, B[1]] }, { p: mid, h1: [mid[0] + 0.03, mid[1]], h2: [mid[0] - 0.03, mid[1]], smooth: true }, { p: A, h1: [A[0], A[1] + 0.02], h2: null }];
    editor.setSelection([{ id: h.id, frame: null, frameInv: null }]);
    const took = editor.replaceTileEdge(pen.map(q => q.p), null, 5, pen);
    const r = doc.getItem(h.id), rs = tileEdgeStarts(r.tile);
    const first = r.nodes[rs[k]], inner = r.nodes[rs[k] + 1], last = r.nodes[rs[k + 1] % r.nodes.length];
    check(took && r.tile.edges[k].count === 2 && dist(inner.p, mid) < 1e-12 && dist(inner.h1, pen[1].h2) < 1e-12 && dist(first.h2, pen[2].h1) < 1e-12
          && dist(last.h1, pen[0].h2) < 1e-12 && pairError(r, mapWord) < 1e-12,
          `${type}: a pen path drawn from the last corner of edge ${k} to its first becomes the edge, turned round, its pair following`);
}

// ── To path, To polyline, undo, Release tile (wallpaper) ────────────────────
{
    const group = new Group_WP({ type: '632' }).getGroup();
    const { doc, editor } = newEditor(group);
    const mapWord = editor.pairingMap;
    check(editor.getStyleConfig().curvedTiles === true, 'Curved sides is on by default (docs/tile_tool_ui_plan.md D3)');
    editor.setStyleValue('curvedTiles', false);
    const tile = editor.addTileFromDomain();
    check(tile.type === 'polyline' && !tile.nodes, 'with Curved sides off a tile of points, as before');
    editor.convertSelection(true);
    const curved = doc.getItem(tile.id);
    check(curved.type === 'path' && !!curved.tile && JSON.stringify(curved.tile.edges.map(e => e.count)) === JSON.stringify(tile.tile.edges.map(e => e.count)),
          'To path makes it a curved tile, its pairing kept');
    editor.convertSelection(false);
    const back = doc.getItem(tile.id);
    check(back.type === 'polyline' && !!back.tile && back.points.length === tile.points.length && back.points.every((x, i) => Math.abs(x - tile.points[i]) < 1e-12)
          && JSON.stringify(back.tile) === JSON.stringify(tile.tile), 'To polyline gives the tile of points back');
    editor.convertSelection(false);
    check(doc.getItem(tile.id) === back || JSON.stringify(doc.getItem(tile.id)) === JSON.stringify(back), 'To polyline on a tile of points changes nothing (its pairing kept)');
    editor.undo();
    check(doc.getItem(tile.id).type === 'path' && !!doc.getItem(tile.id).tile, 'undo: the curved tile');
    editor.undo();
    check(doc.getItem(tile.id).type === 'polyline' && JSON.stringify(doc.getItem(tile.id).tile) === JSON.stringify(tile.tile), 'undo again: the tile of points');
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    editor.releaseTiles();
    check(!doc.getItem(tile.id).tile && doc.getItem(tile.id).closed, 'Release tile: a plain closed outline');
    check(pointPairError(tile, mapWord) < 1e-12, `the tile of points' pairs are exact (${fmt(pointPairError(tile, mapWord))})`);
}

// ── a group changed since the tile was made: the pairs stay ─────────────────
{
    const group = new Group_WP({ type: '442' }).getGroup();
    const { editor } = newEditor(group);
    editor.setStyleValue('curvedTiles', true);
    const tile = editor.addTileFromDomain();
    const k = freeEdge(tile), pair = tile.tile.edges[k].pair, starts = tileEdgeStarts(tile.tile);
    // another group's maps: a shift that takes no corner onto a corner
    const shifted = () => (q) => [q[0] + 0.3, q[1] - 0.2];
    const nodes = tile.nodes.map(q => ({ ...q }));
    nodes[starts[k]].h2 = [nodes[starts[k]].p[0] + 0.05, nodes[starts[k]].p[1] + 0.02];
    const out = tileWithNodes(tile, nodes, shifted, k);
    check(!!out && JSON.stringify(edgeSequence(out, pair)) === JSON.stringify(edgeSequence(tile, pair)) && !!out.nodes[starts[k]].h2,
          'a group whose maps no longer take an edge to its pair: the edge changes, its pair stays');
}

// ── hyperbolic and spherical groups ─────────────────────────────────────────
for (const [name, group, kind] of [['237', klm(2, 3, 7, false), 'hyperbolic'], ['*237', klm(2, 3, 7, true), 'hyperbolic'],
                                   ['245', klm(2, 4, 5, false), 'hyperbolic'], ['234', klm(2, 3, 4, false), 'spherical']]) {
    const { doc, editor } = newEditor(group);
    const mapWord = editor.pairingMap;
    if (editor.drawingGeometry().kind !== kind) { check(false, `${name}: a ${kind} group (${editor.drawingGeometry().kind})`); continue; }
    editor.setStyleValue('curvedTiles', false);
    const points = editor.addTileFromDomain();
    if (!points) { check(false, `${name}: a tile from the domain`); continue; }
    check(points.type === 'polyline' && points.tile.edges.some(e => e.count > 1), `${name}: the tile of points has its arcs as runs of points`);
    editor.convertSelection(true);
    const tile = doc.getItem(points.id);
    check(tile.type === 'path' && tile.geodesic === true && tile.tile.edges.every(e => e.count === 1),
          `${name}: To path: a geodesic tile, every side its corners alone (an exact geodesic side; counts ${tile.tile.edges.map(e => e.count).join(' ')})`);
    check(cornerShift(tile, points) < 1e-15 && pairError(tile, mapWord) < 1e-9, `${name}: the corners stay, the pairs are the images (${fmt(pairError(tile, mapWord))})`);
    // the polyline tile's arc points lie on the geodesic sides: in the chart of the side's first corner on the line to its last
    const chart = editor.nodeChart(tile);
    const starts = tileEdgeStarts(points.tile), n = points.points.length/2;
    let off = 0;
    points.tile.edges.forEach((e, k) => {
        const a = [points.points[2*starts[k]], points.points[2*starts[k] + 1]], c = chart(a);
        const b = c.to([points.points[2*(starts[k + 1] % n)], points.points[2*(starts[k + 1] % n) + 1]]), L = Math.hypot(b[0], b[1]);
        for (let v = starts[k] + 1; v < starts[k + 1]; v++) { const q = c.to([points.points[2*v], points.points[2*v + 1]]); off = Math.max(off, Math.abs(b[0]*q[1] - b[1]*q[0])/L/L); }
    });
    check(off < 1e-9, `${name}: the arcs' points lie on those geodesics (${fmt(off)})`);
    const k = freeEdge(tile);
    // all mirrors: no edge follows another, none takes handles
    if (k < 0) {
        check(tile.tile.edges.every(e => e.locked), `${name}: every side a mirror: locked, nothing to curve`);
        continue;
    }
    const steps = curvedEdits(editor, doc, tile.id, k);
    const h = steps.handled;
    check(!!h && pairError(h, mapWord) < 1e-9 && cornerShift(h, tile) < 1e-15,
          `${name}: edge ${k} curved: node by node the pair is the image (${fmt(h ? pairError(h, mapWord) : NaN)}), the corners stay`);
    // the outline: points of edge k's segments mapped onto the pair, near the pair's outline (sampled densely)
    if (h && h.outline) {
        const e = h.tile.edges[k], map = mapWord(e.word);
        const s = tileEdgeStarts(h.tile), nn = h.nodes.length;
        const segsOf = j => { const out = []; for (let v = s[j]; v < s[j + 1]; v++) out.push(v % nn); return out; };
        const pairSamples = [];
        for (const seg of segsOf(e.pair)) for (let i = 0; i <= 400; i++) { const q = outlinePoint(h, seg, i/400); if (q) pairSamples.push(q); }
        let worst = 0;
        const radius = editor.drawingGeometry().r || editor.drawingGeometry().R;
        for (const seg of segsOf(k)) for (let i = 0; i <= 20; i++) {
            const q = outlinePoint(h, seg, i/20);
            if (!q) { worst = Infinity; continue; }
            const w = map(q);
            worst = Math.max(worst, Math.min(...pairSamples.map(p => dist(p, w))));
        }
        check(worst/radius < 1e-9, `${name}: the pair's outline is the image of the edge's (within ${fmt(worst/radius)} of the geometry's radius)`);
    } else {
        check(false, `${name}: the curved tile has an outline`);
    }
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    editor.convertSelection(false);
    const flat = doc.getItem(tile.id);
    check(flat.type === 'polyline' && !!flat.tile && !flat.geodesic && pointPairError(flat, mapWord) < 1e-9,
          `${name}: To polyline: a tile of points along the curves, its pairs exact point by point (${fmt(pointPairError(flat, mapWord))})`);
}

// ── the tile of every triangle group and of the rotation groups of the sphere ──
{
    // a tile's points lie in the closed domain, in the hyperbolic plane inside the
    // unit disk: an arc drawn round the far side of its circle leaves both. A side
    // is locked on a mirror only: a rotation read as a mirror would lock its side,
    // a half turn not found would leave its side in one piece
    const quiet = (make) => { const log = console.log; console.log = () => {}; try { return make(); } finally { console.log = log; } };
    const sigDist = (sp, p) => U4.sigDistanceSP(sp, iPoint([p[0], p[1], 0, 0]));
    /** how a tile of the group sits in its domain: {off: the farthest a point lies beyond a side, reach: the farthest from the origin, err: the pairs' error}; null without a tile */
    const fit = (group) => {
        const tile = tileFromDomain(group, { map: (x, y) => [x, y] }, {});
        if (!tile) return null;
        const fd = group.getFundDomain();
        let off = 0, reach = 0;
        for (let i = 0; i < tile.points.length; i += 2) {
            const p = [tile.points[i], tile.points[i + 1]];
            for (const sp of fd) off = Math.max(off, sigDist(sp, p));
            reach = Math.max(reach, Math.hypot(p[0], p[1]));
        }
        return { edges: tile.tile.edges, off, reach, err: pointPairError(tile, word => wordMap(group, word)) };
    };
    const allPaired = (edges) => edges.every((e, k) => !e.locked && e.pair !== null && e.pair !== k && edges[e.pair].pair === k);

    const count = { hyperbolic: 0, euclidean: 0, spherical: 0 };
    const bad = [];
    let off = 0, reach = 0, err = 0;
    for (let K = 2; K <= 8; K++) for (let L = 2; L <= 8; L++) for (let M = 2; M <= 8; M++) {
        // 1/K + 1/L + 1/M against 1, in whole numbers
        const sum = L*M + K*M + K*L, one = K*L*M;
        const kind = sum < one ? 'hyperbolic' : (sum === one ? 'euclidean' : 'spherical');
        for (const s of [false, true]) {
            const name = `${s ? '*' : ''}${K}${L}${M}`;
            const f = fit(quiet(() => klm(K, L, M, s)));
            count[kind]++;
            if (!f) { bad.push(`${name}: no tile`); continue; }
            if (!(s ? (f.edges.length === 3 && f.edges.every(e => e.locked)) : (f.edges.length === 4 && allPaired(f.edges))))
                bad.push(`${name}: edges ${f.edges.map(e => e.locked ? 'locked' : 'pair ' + e.pair).join(', ')}`);
            off = Math.max(off, f.off);
            err = Math.max(err, f.err);
            if (kind === 'hyperbolic') reach = Math.max(reach, f.reach);
        }
    }
    check(bad.length === 0, `K L M in 2..8 (${count.hyperbolic} hyperbolic, ${count.euclidean} Euclidean, ${count.spherical} spherical groups): a tile of every one, *K L M of three locked mirrors, K L M of two pairs of sides`
          + (bad.length ? ` (${bad.length} not: ${bad.slice(0, 6).join('; ')})` : ''));
    check(off < 1e-9, `every point of those tiles lies in the closed domain (the farthest beyond a side: ${fmt(off)})`);
    check(reach <= 1 + 1e-12, `the tiles of the hyperbolic plane stay inside the unit disk (the farthest point at ${reach.toFixed(6)} of its radius)`);
    check(err < 1e-9, `their pairs are exact (${fmt(err)})`);

    // the rotation groups of the sphere: every side has a pair
    const makers = [];
    for (const [type, subtypes] of [['332', 3], ['432', 6], ['532', 6]]) for (let subtype = 0; subtype < subtypes; subtype++) makers.push([`${type} subtype ${subtype}`, () => new Group_Spherical({ type, subtype }).getGroup()]);
    for (const n of [3, 5, 8]) for (const centered of [true, false])
        makers.push([`22n n = ${n}${centered ? '' : ', not centred'}`, () => { const m = new Group_Spherical({ type: '22n', n }); m.mConfig.centered = centered; return m.getGroup(); }]);
    const badS = [];
    let offS = 0, errS = 0;
    for (const [name, make] of makers) {
        const f = fit(quiet(make));
        if (!f) { badS.push(`${name}: no tile`); continue; }
        if (!allPaired(f.edges)) badS.push(`${name}: edges ${f.edges.map(e => e.locked ? 'locked' : 'pair ' + e.pair).join(', ')}`);
        offS = Math.max(offS, f.off);
        errS = Math.max(errS, f.err);
    }
    check(badS.length === 0, `the rotation groups of the sphere (332, 432, 532 of every subtype, 22n): ${makers.length} tiles, every side with its pair`
          + (badS.length ? ` (${badS.length} not: ${badS.slice(0, 6).join('; ')})` : ''));
    check(offS < 1e-9 && errS < 1e-9, `those tiles lie in their domains (${fmt(offS)}), their pairs exact (${fmt(errS)})`);

    // the Poincare disk scaled and moved: the same tile there. A rotation is then
    // found with both its fixed points, and the one beyond the disk is no corner
    const move = ITransform.getScale(0.7).concat(ITransform.getTranslation([1.3, -0.4]));
    const moved = (p) => { const q = move.transform(iPoint([p[0], p[1], 0, 0])).v; return [q[0], q[1]]; };
    const pointsOf = (tile) => Array.from({ length: tile.points.length/2 }, (_, i) => [tile.points[2*i], tile.points[2*i + 1]]);
    const badM = [];
    let offM = 0;
    for (const [K, L, M, s] of [[3, 3, 6, false], [3, 3, 6, true], [2, 3, 7, false], [4, 2, 5, false], [5, 4, 2, false], [2, 8, 3, false], [8, 8, 8, false]]) {
        const name = `${s ? '*' : ''}${K}${L}${M}`;
        const group = quiet(() => klm(K, L, M, s));
        const there = new Group({ s: group.getFundDomain().map(sp => move.transform(sp)), t: group.transforms.map(ref => ref.map(sp => move.transform(sp))) });
        const t0 = tileFromDomain(group, { map: (x, y) => [x, y] }, {}), t1 = tileFromDomain(there, { map: (x, y) => [x, y] }, {});
        if (!t0 || !t1 || JSON.stringify(t0.tile.edges.map(e => [e.count, e.locked])) !== JSON.stringify(t1.tile.edges.map(e => [e.count, e.locked]))) { badM.push(name); continue; }
        // the same outline, from whichever corner: every moved point of the one is a point of the other
        const p1 = pointsOf(t1);
        for (const p of pointsOf(t0)) offM = Math.max(offM, Math.min(...p1.map(q => dist(q, moved(p)))));
    }
    check(badM.length === 0 && offM < 1e-9, `the disk scaled by 0.7 and moved to (1.3, -0.4): the tile of the group there is the image of the tile (${fmt(offM)})`
          + (badM.length ? ` (not for ${badM.join(', ')})` : ''));

    // the makers with the switch uhp build their domain in the upper half plane and,
    // with the switch off, reflect it into the unit disk (in the sphere about (0, -1)
    // of radius sqrt 2). The sides of the half plane's domain bound its mirror image
    // below the absolute as well: the tile is the polygon above, and it is the image
    // of the disk's tile, corner for corner and pair for pair
    const toDisk = (() => {
        const swap = new ITransform([iSphere([0, -1, 0, Math.SQRT2])], '');
        return (p) => { const q = swap.transform(iPoint([p[0], p[1], 0, 0])).v; return [q[0], q[1]]; };
    })();
    const made = (Maker, values, uhp) => quiet(() => {
        const maker = new Maker({});
        Object.assign(maker.params, values, { uhp });
        if (maker.state) maker.state.paramChanged = true;
        return maker.getGroup();
    });
    const cornersOf = (tile) => { const p = pointsOf(tile), out = []; let v = 0; for (const e of tile.tile.edges) { out.push(p[v]); v += e.count; } return out; };
    /** the pairing of a tile's edges read round it, the same from whichever corner and whichever way round */
    const pairingWord = (tile) => {
        const edges = tile.tile.edges, n = edges.length;
        const read = (start, dir) => Array.from({ length: n }, (_, j) => {
            const k = (((start + dir*j) % n) + n) % n;                   // the corner the edge is read from
            const e = edges[dir > 0 ? k : (k - 1 + n) % n];
            if (e.locked) return 'L';
            const steps = dir > 0 ? e.pair - k : k - 1 - e.pair;             // to its pair, in the direction of reading
            return (e.reversed ? 'r' : 'f') + (((steps % n) + n) % n);
        }).join(' ');
        const all = [];
        for (let s = 0; s < n; s++) all.push(read(s, 1), read(s, -1));
        return all.sort()[0];
    };
    // [name, maker, parameters, edges, are they paired (else locked: mirrors)]
    const switched = [
        ['KLMN 3 2 2 2', Group_KLMN, {}, 6, true],
        ['KLMN 2 3 4 5', Group_KLMN, { K: 2, L: 3, M: 4, N: 5 }, 6, true],
        ['KLMN 3 3 3 3, aspect 0.3', Group_KLMN, { K: 3, L: 3, M: 3, N: 3, aspect: 0.3 }, 6, true],
        ['KLMN with a cusp', Group_KLMN, { K: 0 }, 6, true],
        ['*KLMN', Group_KLMN, { s: true }, 4, false],
        ['*KLMN with a cusp', Group_KLMN, { K: 0, s: true }, 4, false],
        ['KLx 3 2', Group_KLx, {}, 4, true],
        ['KLx 4 3', Group_KLx, { K: 4, L: 3 }, 4, true],
        ['KLx with a cusp', Group_KLx, { K: 0 }, 4, true],
        ['*KLx', Group_KLx, { s: true }, 4, false],
        ['5 splanes', Group_5splanes, {}, 4, false],
        ['6 splanes', Group_6splanes, {}, 4, false],
        ['22222', Group_22222, {}, 8, true],
        ['22222 of other radii', Group_22222, { R1: 0.3, R2: 0.15 }, 8, true],
        ['*22222', Group_s22222, {}, 5, false],
        ['*222222', Group_s222222, {}, 6, false],
    ];
    const badU = [];
    let offU = 0, errU = 0, errCusp = 0, low = Infinity, far = 0, cornerOff = 0;
    for (const [name, Maker, values, edges, paired] of switched) {
        const half = made(Maker, values, true), disk = made(Maker, values, false);
        const fh = fit(half), fdk = fit(disk);
        if (!fh || !fdk) { badU.push(`${name}: no tile in the ${fh ? 'disk' : 'half plane'}`); continue; }
        for (const [where, f] of [['half plane', fh], ['disk', fdk]]) {
            if (!(f.edges.length === edges && (paired ? allPaired(f.edges) : f.edges.every(e => e.locked))))
                badU.push(`${name} in the ${where}: edges ${f.edges.map(e => e.locked ? 'locked' : 'pair ' + e.pair).join(', ')}`);
            offU = Math.max(offU, f.off);
            // a cusp, where two sides touch, is a corner found to 1e-8 only, and so is its image
            if (values.K === 0) errCusp = Math.max(errCusp, f.err); else errU = Math.max(errU, f.err);
        }
        const th = tileFromDomain(half, { map: (x, y) => [x, y] }, {}), td = tileFromDomain(disk, { map: (x, y) => [x, y] }, {});
        for (const p of pointsOf(th)) low = Math.min(low, p[1]);
        far = Math.max(far, fdk.reach);
        if (pairingWord(th) !== pairingWord(td)) badU.push(`${name}: the pairs ${pairingWord(th)} in the half plane, ${pairingWord(td)} in the disk`);
        // corner for corner: a cusp, where two sides touch, is found to 1e-8 only
        const ch = cornersOf(th).map(toDisk), cd = cornersOf(td);
        for (const p of ch) cornerOff = Math.max(cornerOff, Math.min(...cd.map(q => dist(p, q))));
        for (const q of cd) cornerOff = Math.max(cornerOff, Math.min(...ch.map(p => dist(p, q))));
    }
    check(badU.length === 0, `the makers with the switch uhp (${switched.length} groups of KLMN, KLx, 5 and 6 splanes, 22222, *22222, *222222): a tile in the half plane and in the disk, the same sides paired or locked`
          + (badU.length ? ` (${badU.length} not: ${badU.slice(0, 6).join('; ')})` : ''));
    check(low > -1e-7 && far <= 1 + 1e-7, `the half plane's tiles lie above the absolute (the lowest point at y = ${low.toExponential(1)}), the disk's inside the unit circle (the farthest at ${far.toFixed(6)})`);
    check(offU < 1e-9 && errU < 1e-9 && errCusp < 1e-6, `those tiles lie in their domains (${fmt(offU)}), their pairs exact (${fmt(errU)}; ${fmt(errCusp)} with a cusp for a corner)`);
    check(cornerOff < 1e-6, `the corners of the half plane's tile, reflected into the disk, are the corners of the disk's tile (${fmt(cornerOff)})`);

    // the same makers bent: the sides fit no model and bound two polygons, one in each
    // component, which may touch at a cusp. The tile is the polygon inside the absolute
    // the maker gives its group (Group.absolute): the one the unbent polygon becomes,
    // in the half plane and in the disk alike
    // [name, maker, the parameters that stay, the bending ones as [key, unbent, bent], edges, are they paired]
    const bent = [
        ['KLMN bent by 5', Group_KLMN, {}, [['bend', 0, 5]], 6, true],
        ['KLMN bent by 20', Group_KLMN, {}, [['bend', 0, 20]], 6, true],
        ['KLMN bent by -20', Group_KLMN, {}, [['bend', 0, -20]], 6, true],
        ['KLMN bent by 30', Group_KLMN, {}, [['bend', 0, 30]], 6, true],
        ['KLMN 2 3 4 5 bent by 20', Group_KLMN, { K: 2, L: 3, M: 4, N: 5 }, [['bend', 0, 20]], 6, true],
        ['KLMN 2 3 4 5 bent by -20', Group_KLMN, { K: 2, L: 3, M: 4, N: 5 }, [['bend', 0, -20]], 6, true],
        ['KLMN with a cusp, bent by 20', Group_KLMN, { K: 0 }, [['bend', 0, 20]], 6, true],
        ['KLMN with a cusp, bent by -20', Group_KLMN, { K: 0 }, [['bend', 0, -20]], 6, true],
        ['*KLMN bent by -20', Group_KLMN, { s: true }, [['bend', 0, -20]], 4, false],
        ['*KLMN with a cusp, bent by 20', Group_KLMN, { K: 0, s: true }, [['bend', 0, 20]], 4, false],
        ['KLx bent by 20', Group_KLx, {}, [['bend', 0, 20]], 4, true],
        ['KLx bent by -20', Group_KLx, {}, [['bend', 0, -20]], 4, true],
        ['KLx 4 3 bent by -20', Group_KLx, { K: 4, L: 3 }, [['bend', 0, -20]], 4, true],
        ['KLx with a cusp, bent by 20', Group_KLx, { K: 0 }, [['bend', 0, 20]], 4, true],
        ['*KLx bent by 20', Group_KLx, { s: true }, [['bend', 0, 20]], 4, false],
        ['5 splanes, a3 20', Group_5splanes, {}, [['a3', 0, 20]], 4, false],
        ['5 splanes, a3 -30, a4 200', Group_5splanes, {}, [['a3', 0, -30], ['a4', 180, 200]], 4, false],
        ['6 splanes, a4 150', Group_6splanes, {}, [['a4', 180, 150]], 4, false],
        ['22222, A2 20, A3 -15', Group_22222, {}, [['A2', 0, 20], ['A3', 0, -15]], 8, true],
        ['22222, A2 A3 A4 10', Group_22222, {}, [['A2', 0, 10], ['A3', 0, 10], ['A4', 0, 10]], 8, true],
        ['*22222, A2 30', Group_s22222, {}, [['A2', 0, 30]], 5, false],
        ['*222222, A2 20, A5 -15', Group_s222222, {}, [['A2', 0, 20], ['A5', 0, -15]], 6, false],
    ];
    const absDist = (group, p) => sigDist(group.absolute, p);
    const STEPS = 30;
    const badB = [];
    let offB = 0, errB = 0, errCuspB = 0, cornerOffB = 0, straddle = 0, stride = 0;
    for (const [name, Maker, fixed, bends, edges, paired] of bent) {
        const at = (t) => ({ ...fixed, ...Object.fromEntries(bends.map(([key, from, to]) => [key, from + t*(to - from)])) });
        const half = made(Maker, at(1), true), disk = made(Maker, at(1), false);
        const th = tileFromDomain(half, { map: (x, y) => [x, y] }, {}), td = tileFromDomain(disk, { map: (x, y) => [x, y] }, {});
        if (!th || !td) { badB.push(`${name}: no tile in the ${th ? 'disk' : 'half plane'}`); continue; }
        for (const [where, group, tile] of [['half plane', half, th], ['disk', disk, td]]) {
            const f = fit(group);
            if (!(f.edges.length === edges && (paired ? allPaired(f.edges) : f.edges.every(e => e.locked))))
                badB.push(`${name} in the ${where}: edges ${f.edges.map(e => e.locked ? 'locked' : 'pair ' + e.pair).join(', ')}`);
            offB = Math.max(offB, f.off);
            if (fixed.K === 0) errCuspB = Math.max(errCuspB, f.err); else errB = Math.max(errB, f.err);
            if (cornersOf(tile).some(p => absDist(group, p) > 1e-7)) straddle++;
        }
        if (pairingWord(th) !== pairingWord(td)) badB.push(`${name}: the pairs ${pairingWord(th)} in the half plane, ${pairingWord(td)} in the disk`);
        const ch = cornersOf(th).map(toDisk), cd = cornersOf(td);
        for (const p of ch) cornerOffB = Math.max(cornerOffB, Math.min(...cd.map(q => dist(p, q))));
        for (const q of cd) cornerOffB = Math.max(cornerOffB, Math.min(...ch.map(p => dist(p, q))));
        // the tile the unbent tile becomes: bent step by step, its corners move a little at each step (the other polygon is a jump away)
        for (const uhp of [true, false]) {
            let before = null;
            for (let k = 0; k <= STEPS; k++) {
                const tile = tileFromDomain(made(Maker, at(k/STEPS), uhp), { map: (x, y) => [x, y] }, {});
                const now = tile ? cornersOf(tile) : null;
                if (!now || (before && now.length !== before.length)) { badB.push(`${name} in the ${uhp ? 'half plane' : 'disk'}: ${now ? 'another polygon' : 'no tile'} at step ${k} of ${STEPS}`); break; }
                if (before) stride = Math.max(stride, ...now.map(p => Math.min(...before.map(q => dist(p, q)))));
                before = now;
            }
        }
    }
    check(badB.length === 0, `the same makers bent (${bent.length} groups): a tile in the half plane and in the disk, the same sides paired or locked`
          + (badB.length ? ` (${badB.length} not: ${badB.slice(0, 6).join('; ')})` : ''));
    check(offB < 1e-9 && errB < 1e-9 && errCuspB < 1e-6, `those tiles lie in their domains (${fmt(offB)}), their pairs exact (${fmt(errB)}; ${fmt(errCuspB)} with a cusp for a corner)`);
    check(cornerOffB < 1e-6, `bent too, the half plane's tile reflected into the disk is the disk's tile, corner for corner (${fmt(cornerOffB)}; ${straddle} of the tiles reach across the absolute)`);
    check(stride < 0.05, `bent from nothing in ${STEPS} steps, a tile's corners move by ${stride.toFixed(4)} at most in a step: it is the tile the unbent one becomes`);

    // the absolute goes with the group: turned by 126 degrees, scaled and moved, the
    // group gives the image of its tile, bent or not (the half plane's side "above"
    // is told by the absolute, not by the turn)
    const carry = ITransform.getRotation([0, 0, 1], 2.2).concat(ITransform.getScale(1.7)).concat(ITransform.getTranslation([0.7, -1.1]));
    const carried = (p) => { const q = carry.transform(iPoint([p[0], p[1], 0, 0])).v; return [q[0], q[1]]; };
    const badC = [];
    let offC = 0;
    for (const [name, Maker, values] of [['KLMN', Group_KLMN, {}], ['KLMN bent by 20', Group_KLMN, { bend: 20 }], ['KLMN bent by -20', Group_KLMN, { bend: -20 }], ['KLx bent by 20', Group_KLx, { bend: 20 }],
                                         ['22222', Group_22222, {}], ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }], ['*22222, A2 30', Group_s22222, { A2: 30 }]]) {
        for (const uhp of [true, false]) {
            const group = made(Maker, values, uhp);
            const there = group.clone();
            there.applyTransform(carry);
            const t0 = tileFromDomain(group, { map: (x, y) => [x, y] }, {}), t1 = tileFromDomain(there, { map: (x, y) => [x, y] }, {});
            if (!t0 || !t1 || pairingWord(t0) !== pairingWord(t1)) { badC.push(`${name} in the ${uhp ? 'half plane' : 'disk'}`); continue; }
            const c0 = cornersOf(t0).map(carried), c1 = cornersOf(t1);
            for (const p of c0) offC = Math.max(offC, Math.min(...c1.map(q => dist(p, q))));
        }
    }
    check(badC.length === 0 && offC < 1e-9, `turned by 126 degrees, scaled and moved, a group gives the image of its tile, corner for corner (${fmt(offC)})`
          + (badC.length ? ` (not: ${badC.join('; ')})` : ''));

    // bent past the point where its polygon closes up, a group in the disk has its sides
    // bound a region through infinity only: no tile, rather than a polygon with a side
    // that is no edge of the domain
    for (const [name, Maker, values] of [['KLMN bent by 60', Group_KLMN, { bend: 60 }], ['KLx bent by 60', Group_KLx, { bend: 60 }]]) {
        for (const uhp of [true, false]) {
            const f = fit(made(Maker, values, uhp));
            check(!f || f.off < 1e-9, `${name} in the ${uhp ? 'half plane' : 'disk'}: ${f ? 'a tile inside its domain (' + fmt(f.off) + ')' : 'no tile'}`);
        }
    }

    // a Kleinian group whose sides bound a closed polygon and two regions that run off to
    // infinity, touching it at cusps: the polygon is the tile
    {
        const group = quiet(() => new Group_Maskit2({}).getGroup());
        const f = fit(group);
        check(!!f && f.edges.length === 8 && allPaired(f.edges) && f.off < 1e-9 && f.err < 1e-6,
              `Maskit's 2-torus group: a tile of ${f ? f.edges.length : 'no'} edges, every one with its pair, inside the domain (${f ? fmt(f.off) : ''}), the pairs within ${f ? fmt(f.err) : ''}`);
    }

    // the pointer. The sides bound a polygon in every part of the plane the group
    // tiles, and a point (at) asks for the tile whose copies cover it: the polygon the
    // group folds the point into. Below the absolute of a group of the half plane that
    // is the mirror image of the tile; in a bent group the tile of the other component
    const ID = { map: (x, y) => [x, y] };
    const mirror = (p) => [p[0], -p[1]];
    // a point of the tile's part of the plane: the mean of its points (the corners alone may all be cusps, on the absolute)
    const mean = (tile) => { const p = pointsOf(tile); return [p.reduce((a, q) => a + q[0], 0)/p.length, p.reduce((a, q) => a + q[1], 0)/p.length]; };
    const sameTile = (a, b) => !!a && !!b && a.points.length === b.points.length && a.points.every((x, i) => Math.abs(x - b.points[i]) < 1e-12);
    const cornersOff = (a, b) => (a.length === b.length) ? Math.max(...a.map(p => Math.min(...b.map(q => dist(p, q)))), ...b.map(q => Math.min(...a.map(p => dist(p, q))))) : Infinity;
    /** how a tile sits in its group's domain: {off, err} as fit gives them */
    const sits = (group, tile) => {
        let off = 0;
        for (const p of pointsOf(tile)) for (const sp of group.getFundDomain()) off = Math.max(off, sigDist(sp, p));
        return { off, err: pointPairError(tile, word => wordMap(group, word)) };
    };
    // the disk's domain beyond the unit circle is the image of the half plane's below the
    // absolute, and reaches infinity where that holds the point (0, -1), whose image is
    // the point at infinity: then it is no polygon, and the tile is the maker's
    const reachesInfinity = (half) => half.getFundDomain().every(sp => sigDist(sp, [0, -1]) <= 1e-9);
    const badP = [];
    let offP = 0, errP = 0, errCuspP = 0, mirrorOff = 0, diskOff = 0, diskTiles = 0, diskNone = 0, strideP = 0;
    /** the checks of a tile beyond the absolute (below) of a half plane's group and of its image in the disk; at: the point asked for */
    const beyond = (name, Maker, values, half, below, at) => {
        const th = tileFromDomain(half, ID, {});
        if (sameTile(below, th)) { badP.push(`${name}: the maker's tile for a point beyond the absolute`); return; }
        if (pairingWord(below) !== pairingWord(th)) badP.push(`${name}: the pairs ${pairingWord(below)} beyond the absolute, ${pairingWord(th)} in the domain`);
        const f = sits(half, below);
        offP = Math.max(offP, f.off);
        if (values.K === 0) errCuspP = Math.max(errCuspP, f.err); else errP = Math.max(errP, f.err);
        const disk = made(Maker, values, false);
        const td = tileFromDomain(disk, ID, {}), out = tileFromDomain(disk, ID, {}, toDisk(at));
        if (!td || !out) { badP.push(`${name} in the disk: no tile`); return; }
        if (reachesInfinity(half)) {
            diskNone++;
            if (!sameTile(out, td)) badP.push(`${name} in the disk: a tile of a domain that reaches infinity`);
        } else {
            diskTiles++;
            if (sameTile(out, td)) { badP.push(`${name} in the disk: the maker's tile for a point beyond the unit circle`); return; }
            diskOff = Math.max(diskOff, cornersOff(cornersOf(below).map(toDisk), cornersOf(out)));
            if (pairingWord(out) !== pairingWord(td)) badP.push(`${name} in the disk: the pairs ${pairingWord(out)} beyond the unit circle`);
            offP = Math.max(offP, sits(disk, out).off);
        }
    };
    for (const [name, Maker, values] of switched) {
        const half = made(Maker, values, true);
        const th = tileFromDomain(half, ID, {});
        const c = mean(th);
        if (!sameTile(tileFromDomain(half, ID, {}, c), th)) badP.push(`${name}: another tile for a point of the tile`);
        const below = tileFromDomain(half, ID, {}, mirror(c));
        if (!below) { badP.push(`${name}: no tile below the absolute`); continue; }
        mirrorOff = Math.max(mirrorOff, cornersOff(cornersOf(below), cornersOf(th).map(mirror)));
        beyond(name, Maker, values, half, below, mirror(c));
    }
    check(mirrorOff < 1e-9, `the makers with the switch uhp, straight (${switched.length} groups): the tile for a point below the absolute is the mirror image of the tile, corner for corner (${fmt(mirrorOff)})`);
    // bent step by step from the mirror image of the tile, each step asked for at a point of the tile before
    const bentTiles = diskTiles, bentNone = diskNone;
    for (const [name, Maker, fixed, bends] of bent) {
        const at = (t) => ({ ...fixed, ...Object.fromEntries(bends.map(([key, from, to]) => [key, from + t*(to - from)])) });
        let before = null, point = null, tile = null, group = null;
        for (let k = 0; k <= STEPS; k++) {
            group = made(Maker, at(k/STEPS), true);
            if (k === 0) point = mirror(mean(tileFromDomain(group, ID, {})));
            tile = tileFromDomain(group, ID, {}, point);
            const now = tile ? cornersOf(tile) : null;
            if (!now || (before && now.length !== before.length)) { badP.push(`${name}: ${now ? 'another polygon' : 'no tile'} for the other component at step ${k} of ${STEPS}`); tile = null; break; }
            if (before) strideP = Math.max(strideP, ...now.map(p => Math.min(...before.map(q => dist(p, q)))));
            before = now;
            point = mean(tile);
        }
        if (tile) beyond(name, Maker, at(1), group, tile, point);
    }
    check(badP.length === 0, `${switched.length} straight and ${bent.length} bent groups: a point of the other part of the plane gets that part's tile, with the tile's pairs; in the disk its image (${diskTiles} groups) or, where the domain out there reaches infinity, the maker's tile (${diskNone})`
          + (badP.length ? ` (${badP.length} not: ${badP.slice(0, 6).join('; ')})` : ''));
    check(diskTiles > bentTiles && bentTiles > 0 && diskNone > bentNone && bentNone > 0, `both cases among the straight groups (${bentTiles} tiles, ${bentNone} none) and among the bent ones (${diskTiles - bentTiles}, ${diskNone - bentNone})`);
    check(offP < 1e-9 && errP < 1e-9 && errCuspP < 1e-6, `those tiles lie in their domains (${fmt(offP)}), their pairs exact (${fmt(errP)}; ${fmt(errCuspP)} with a cusp for a corner)`);
    check(diskOff < 1e-6, `the disk's tile beyond the unit circle is the image of the half plane's tile below the absolute, corner for corner (${fmt(diskOff)})`);
    check(strideP < 0.05, `bent from nothing in ${STEPS} steps, the other component's tile moves its corners by ${strideP.toFixed(4)} at most in a step: it is the tile the mirror image becomes`);

    // turned, scaled and moved, the group gives the image of the other tile for the image of the point
    {
        const badT = [];
        let offT = 0;
        for (const [name, Maker, values] of [['KLMN', Group_KLMN, {}], ['KLMN bent by 20', Group_KLMN, { bend: 20 }], ['KLMN bent by -20', Group_KLMN, { bend: -20 }], ['KLx bent by 20', Group_KLx, { bend: 20 }],
                                             ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }], ['*22222, A2 30', Group_s22222, { A2: 30 }]]) {
            const group = made(Maker, values, true);
            const p = mirror(mean(tileFromDomain(group, ID, {})));
            const there = group.clone();
            there.applyTransform(carry);
            const t0 = tileFromDomain(group, ID, {}, p), t1 = tileFromDomain(there, ID, {}, carried(p));
            if (!t0 || !t1 || sameTile(t0, tileFromDomain(group, ID, {})) || pairingWord(t0) !== pairingWord(t1)) { badT.push(name); continue; }
            offT = Math.max(offT, cornersOff(cornersOf(t0).map(carried), cornersOf(t1)));
        }
        check(badT.length === 0 && offT < 1e-9, `turned by 126 degrees, scaled and moved, a group gives the image of the other tile for the image of the point (${fmt(offT)})`
              + (badT.length ? ` (not: ${badT.join('; ')})` : ''));
    }

    // a point the fold does not bring into the domain (a point of the limit set: the
    // absolute of a group of the half plane) gets the maker's tile, and so does no point
    {
        const group = made(Group_KLMN, { bend: 20 }, true);
        const th = tileFromDomain(group, ID, {});
        check(sameTile(tileFromDomain(group, ID, {}, null), th) && sameTile(tileFromDomain(group, ID, {}, [NaN, 0.3]), th), 'no point, or one that is no number: the maker\'s tile');
        const straight = made(Group_KLMN, {}, true);
        check(sameTile(tileFromDomain(straight, ID, {}, [0.2371, 0]), tileFromDomain(straight, ID, {})), 'a point of the absolute, which no fold brings into the domain: the maker\'s tile');
    }

    // the editor takes the point in world coordinates: the tile of the pattern's point there
    {
        const group = made(Group_KLMN, { bend: 20 }, true);
        const { doc, editor } = newEditor(group);
        const toWorld = patternToWorldMap(PTC);
        const upper = tileFromDomain(group, ID, {});
        const p = mirror(mean(upper));
        const lower = tileFromDomain(group, ID, {}, p);
        const worldOf = (tile) => cornersOf(tile).map(q => toWorld.map(q[0], q[1]));
        const tDefault = editor.addTileFromDomain();
        const tAt = editor.addTileFromDomain(toWorld.map(p[0], p[1]));
        const tUp = editor.addTileFromDomain(toWorld.map(...mean(upper)));
        check(!!tDefault && !!tAt && !!tUp && tAt.type === 'polyline' && cornersOff(cornersOf(tAt), worldOf(lower)) < 1e-12 && cornersOff(cornersOf(tDefault), worldOf(upper)) < 1e-12
              && cornersOff(cornersOf(tUp), worldOf(upper)) < 1e-12,
              'the editor: a world point of the other component adds that component\'s tile, a point of the domain\'s component and no point the maker\'s');
        check(editor.getSelection().length === 1 && editor.getSelection()[0].id === tUp.id && doc.getItem(tAt.id) && doc.getItem(tAt.id).tile.edges.length === 6, 'the editor: each a tile of six edges on the layer, the last one selected');
        editor.undo(); editor.undo(); editor.undo();
        check(!doc.getItem(tAt.id) && !doc.getItem(tDefault.id), 'the editor: an undo each');
    }

    // a Dirichlet domain (the symmetry's operation, and the domains the Grandma and Maskit
    // makers build themselves). Its sides, the bisectors of the base and its images, bound
    // a polygon in every part of the plane the group tiles, as any domain's do, and the
    // domain is the one that holds the base. The tile made without a point is that
    // polygon, from the group as the renderer hands it on (a clone, moved by
    // applyTransform): the base goes with the group
    {
        const hush = (make) => { const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {}; try { return make(); } finally { console.log = log; console.warn = warn; } };
        const dirichlet = (group, b) => hush(() => {
            const base = dirichletBase({ baseX: b[0], baseY: b[1] });
            const res = selectDirichletSides(group, { base, depth: 2, maxIterations: 1000 });
            return res.words.length ? makeDirichletGroup(group, { base, words: res.words }) : null;
        });
        /** does the tile's outline go round the point: each edge the arc through its points (a line's edge straight), followed finely */
        const goesRound = (tile, p) => {
            const pts = pointsOf(tile), n = pts.length, fine = [];
            const sq = q => q[0]*q[0] + q[1]*q[1];
            const turn = (t) => ((t % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
            let v = 0;
            for (const e of tile.tile.edges) {
                const a = pts[v], b = pts[(v + e.count) % n], m = pts[v + (e.count >> 1)];
                fine.push(a);
                const d = 2*(a[0]*(m[1] - b[1]) + m[0]*(b[1] - a[1]) + b[0]*(a[1] - m[1]));
                if (e.count > 1 && Math.abs(d) > 1e-12*(sq(a) + sq(b) + sq(m))) {
                    // the circle through the edge's first, middle and last points
                    const cx = (sq(a)*(m[1] - b[1]) + sq(m)*(b[1] - a[1]) + sq(b)*(a[1] - m[1]))/d;
                    const cy = (sq(a)*(b[0] - m[0]) + sq(m)*(a[0] - b[0]) + sq(b)*(m[0] - a[0]))/d;
                    const R = Math.hypot(a[0] - cx, a[1] - cy), ang = q => Math.atan2(q[1] - cy, q[0] - cx);
                    const t0 = ang(a);
                    let sweep = turn(ang(b) - t0);
                    if (turn(ang(m) - t0) > sweep) sweep -= 2*Math.PI;
                    for (let i = 1; i < 256; i++) fine.push([cx + R*Math.cos(t0 + sweep*i/256), cy + R*Math.sin(t0 + sweep*i/256)]);
                }
                v += e.count;
            }
            let inside = false;
            for (let i = 0, j = fine.length - 1; i < fine.length; j = i++) {
                const [xi, yi] = fine[i], [xj, yj] = fine[j];
                if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi)*(p[1] - yi)/(yj - yi) + xi)) inside = !inside;
            }
            return inside;
        };
        /** the tile the tool makes of the group when it does not know the base */
        const withoutBase = (group) => { const g = group.clone(); delete g.dirichletBase; return tileFromDomain(g, ID, {}); };
        const at2 = (p) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;
        const edgesOf = (tile) => tile.tile.edges.map(e => e.locked ? 'locked' : 'pair ' + e.pair).join(', ');

        // the base goes with the group: a clone has its own, a moved group the moved one
        {
            const group = made(Group_KLMN, { bend: 20 }, true);
            const b = [0.31, -0.47];
            const dg = dirichlet(group, b);
            const copy = dg.clone();
            const there = dg.clone();
            there.applyTransform(carry);
            const v = (g) => (g.dirichletBase ? [g.dirichletBase.v[0], g.dirichletBase.v[1]] : [NaN, NaN]);
            check(!!copy.dirichletBase && copy.dirichletBase !== dg.dirichletBase && dist(v(copy), b) === 0, 'a clone of a Dirichlet group has the base, its own copy');
            check(dist(v(there), carried(b)) < 1e-12 && dist(v(dg), b) === 0 && dist(v(copy), b) === 0, `turned, scaled and moved, the group has the base moved along (${fmt(dist(v(there), carried(b)))}); the group it was cloned from keeps its own`);
            check(there.getFundDomain().every(sp => sigDist(sp, v(there)) < 0) && dg.getFundDomain().every(sp => sigDist(sp, b) < 0), 'the base lies inside every side, moved or not');
            check(!new Group({ s: group.getFundDomain(), t: group.getReverseTransforms() }).clone().dirichletBase && !group.clone().dirichletBase, 'a group that is no Dirichlet domain has none');
        }

        // bent groups, in the half plane and in the disk, the base in the one component and in the other
        const badD = [];
        let offD = 0, errD = 0, errCuspD = 0, domains = 0, inOther = 0, notDefault = 0;
        for (const [name, Maker, values, mirrors] of [
            ['KLMN bent by 20', Group_KLMN, { bend: 20 }, false], ['KLMN bent by -20', Group_KLMN, { bend: -20 }, false],
            ['KLMN 2 3 4 5 bent by 20', Group_KLMN, { K: 2, L: 3, M: 4, N: 5, bend: 20 }, false], ['KLMN with a cusp, bent by 20', Group_KLMN, { K: 0, bend: 20 }, false],
            ['KLx bent by 20', Group_KLx, { bend: 20 }, false], ['KLx 4 3 bent by -20', Group_KLx, { K: 4, L: 3, bend: -20 }, false],
            ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }, false], ['*22222, A2 30', Group_s22222, { A2: 30 }, true], ['5 splanes, a3 20', Group_5splanes, { a3: 20 }, true]]) {
            for (const uhp of [true, false]) {
                const group = made(Maker, values, uhp);
                const own = tileFromDomain(group, ID, {});
                const c = mean(own);
                // a point of the other component: of its tile, asked for beyond the absolute
                const second = tileFromDomain(group, ID, {}, uhp ? mirror(c) : toDisk(mirror(toDisk(c))));
                const bases = [c];
                if (second && !sameTile(second, own)) { bases.push(mean(second)); inOther++; }
                const got = [];
                for (const b of bases) {
                    const where = `${name} in the ${uhp ? 'half plane' : 'disk'}, the base at ${at2(b)}`;
                    const dg = dirichlet(group, b);
                    if (!dg) { badD.push(`${where}: no Dirichlet domain`); continue; }
                    const handed = dg.clone();
                    const tile = tileFromDomain(handed, ID, {});
                    domains++;
                    if (!tile) { badD.push(`${where}: no tile`); continue; }
                    if (!goesRound(tile, b)) badD.push(`${where}: the tile does not hold the base`);
                    if (!sameTile(tile, tileFromDomain(handed, ID, {}, b))) badD.push(`${where}: not the tile asked for at the base`);
                    if (!(mirrors ? tile.tile.edges.every(e => e.locked) : allPaired(tile.tile.edges))) badD.push(`${where}: edges ${edgesOf(tile)}`);
                    const s = sits(handed, tile);
                    offD = Math.max(offD, s.off);
                    if (values.K === 0) errCuspD = Math.max(errCuspD, s.err); else errD = Math.max(errD, s.err);
                    if (!sameTile(tile, withoutBase(handed))) notDefault++;
                    got.push(tile);
                }
                if (got.length === 2 && sameTile(got[0], got[1])) badD.push(`${name} in the ${uhp ? 'half plane' : 'disk'}: one tile for the bases of both components`);
            }
        }
        check(badD.length === 0, `Dirichlet domains of bent groups (${domains}, in the half plane and in the disk, ${inOther} of them with the base in the other component): the tile made without a point holds the base, its sides paired, or locked on the mirrors`
              + (badD.length ? ` (${badD.length} not: ${badD.slice(0, 6).join('; ')})` : ''));
        check(notDefault > 0 && inOther > 0, `for ${notDefault} of them that is not the polygon the tool takes when it does not know the base`);
        check(offD < 1e-9 && errD < 1e-9 && errCuspD < 1e-6, `those tiles lie in their domains (${fmt(offD)}), their pairs exact (${fmt(errD)}; ${fmt(errCuspD)} with a cusp for a corner)`);

        // a point comes first: the pointer over the other component gets that component's tile
        {
            const group = made(Group_KLMN, { bend: 20 }, true);
            const own = tileFromDomain(group, ID, {});
            const c = mean(own), far = mean(tileFromDomain(group, ID, {}, mirror(c)));
            const dg = dirichlet(group, c).clone();
            const atBase = tileFromDomain(dg, ID, {}), other = tileFromDomain(dg, ID, {}, far);
            check(!!atBase && !!other && !sameTile(atBase, other) && goesRound(atBase, c) && !goesRound(other, c) && allPaired(other.tile.edges) && sits(dg, other).off < 1e-9,
                  'a point comes first: one of the other component gets that component\'s tile of the Dirichlet domain, not the base\'s');
            check(sameTile(tileFromDomain(dg, ID, {}, [0.2371, NaN]), atBase), 'a point that is no number: the base\'s tile');
        }

        // straight groups. The Dirichlet domain of the mirror image of the base is the mirror image of
        // the domain, and the tile is there, beyond the absolute. In the disk the tiles are the images
        // of the half plane's; beyond the unit circle only where the domain there is a polygon: where it
        // reaches infinity (the half plane's sides hold (0, -1)) the tile is the polygon inside the disk
        const badS2 = [];
        let mirrorD = 0, diskD = 0, outPolygons = 0, outNone = 0;
        for (const [name, Maker, values] of [['KLMN 3 2 2 2', Group_KLMN, {}], ['KLMN 2 3 4 5', Group_KLMN, { K: 2, L: 3, M: 4, N: 5 }], ['KLx 3 2', Group_KLx, {}],
                                             ['22222', Group_22222, {}], ['*22222', Group_s22222, {}], ['5 splanes', Group_5splanes, {}]]) {
            const half = made(Maker, values, true), disk = made(Maker, values, false);
            const c = mean(tileFromDomain(half, ID, {}));
            const b = [c[0] + 0.05, c[1] + 0.03];
            const up = dirichlet(half, b), down = dirichlet(half, mirror(b)), inner = dirichlet(disk, toDisk(b)), outer = dirichlet(disk, toDisk(mirror(b)));
            if (!up || !down || !inner || !outer) { badS2.push(`${name}: no Dirichlet domain`); continue; }
            const tUp = tileFromDomain(up.clone(), ID, {}), tDown = tileFromDomain(down.clone(), ID, {});
            const tIn = tileFromDomain(inner.clone(), ID, {}), tOut = tileFromDomain(outer.clone(), ID, {});
            if (!tUp || !tDown || !tIn || !tOut) { badS2.push(`${name}: no tile`); continue; }
            if (!goesRound(tUp, b) || !sameTile(tUp, withoutBase(up))) badS2.push(`${name}: the base in the half plane has not the tile of the model's polygon`);
            if (!goesRound(tDown, mirror(b)) || sameTile(tDown, withoutBase(down))) badS2.push(`${name}: the base below the absolute has not its tile there`);
            mirrorD = Math.max(mirrorD, cornersOff(cornersOf(tDown), cornersOf(tUp).map(mirror)));
            if (!goesRound(tIn, toDisk(b))) badS2.push(`${name} in the disk: the tile does not hold the base`);
            diskD = Math.max(diskD, cornersOff(cornersOf(tIn), cornersOf(tUp).map(toDisk)));
            if (reachesInfinity(down)) {
                outNone++;
                if (!sameTile(tOut, withoutBase(outer)) || goesRound(tOut, toDisk(mirror(b)))) badS2.push(`${name} in the disk: a tile of a domain that reaches infinity`);
                diskD = Math.max(diskD, cornersOff(cornersOf(tOut), cornersOf(tDown).map(mirror).map(toDisk)));
            } else {
                outPolygons++;
                if (!goesRound(tOut, toDisk(mirror(b)))) badS2.push(`${name} in the disk: the base beyond the unit circle has not its tile there`);
                diskD = Math.max(diskD, cornersOff(cornersOf(tOut), cornersOf(tDown).map(toDisk)));
            }
        }
        check(badS2.length === 0 && mirrorD < 1e-9, `Dirichlet domains of straight groups: the tile for the mirror image of the base, below the absolute, is the mirror image of the tile, corner for corner (${fmt(mirrorD)})`
              + (badS2.length ? ` (${badS2.length} not: ${badS2.slice(0, 6).join('; ')})` : ''));
        check(diskD < 1e-6 && outPolygons > 0 && outNone > 0, `in the disk the tiles are their images (${fmt(diskD)}): beyond the unit circle too for ${outPolygons} groups; for ${outNone}, whose domain out there reaches infinity, the polygon inside the disk`);

        // bent by half a degree, the sides all but fit a model: guessed from them, it would cut the
        // cusp off the polygon. The absolute is that of the group the domain was made from
        for (const [name, Maker, values] of [['KLx with a cusp, bent by -0.5', Group_KLx, { K: 0, bend: -0.5 }], ['KLMN with a cusp, bent by 0.5', Group_KLMN, { K: 0, bend: 0.5 }]]) {
            const group = made(Maker, values, true);
            const c = mean(tileFromDomain(group, ID, {}));
            const dg = dirichlet(group, c).clone();
            const tile = tileFromDomain(dg, ID, {});
            check(!!tile && goesRound(tile, c) && allPaired(tile.tile.edges) && sits(dg, tile).off < 1e-9 && !dg.absolute && !!dg.dirichletSource.absolute,
                  `${name}: the tile of its Dirichlet domain holds the base, every side paired (${tile ? tile.tile.edges.length + ' edges' : 'no tile'})`);
        }

        // turned, scaled and moved (the base in the other component): the image of the tile
        {
            const badT = [];
            let offT = 0;
            for (const [name, Maker, values] of [['KLMN bent by 20', Group_KLMN, { bend: 20 }], ['KLx bent by 20', Group_KLx, { bend: 20 }], ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }], ['KLMN', Group_KLMN, {}]]) {
                const group = made(Maker, values, true);
                const far = mean(tileFromDomain(group, ID, {}, mirror(mean(tileFromDomain(group, ID, {})))));
                const dg = dirichlet(group, far);
                const there = dg.clone();
                there.applyTransform(carry);
                const t0 = tileFromDomain(dg, ID, {}), t1 = tileFromDomain(there, ID, {});
                if (!t0 || !t1 || !goesRound(t0, far) || !goesRound(t1, carried(far)) || pairingWord(t0) !== pairingWord(t1)) { badT.push(name); continue; }
                offT = Math.max(offT, cornersOff(cornersOf(t0).map(carried), cornersOf(t1)));
            }
            check(badT.length === 0 && offT < 1e-9, `turned by 126 degrees, scaled and moved, a Dirichlet group with its base in the other component gives the image of its tile (${fmt(offT)})`
                  + (badT.length ? ` (not: ${badT.join('; ')})` : ''));
        }

        // the makers whose own domain is a Dirichlet domain: the tile follows the base they are given
        for (const [name, Maker, b, edges] of [['Maskit\'s 2-torus group', Group_Maskit2, [0.4, 1], 14], ['Grandma\'s group', Group_Grandma, [0, 1.5], 8]]) {
            const group = hush(() => { const m = new Maker({}); Object.assign(m.params, { baseX: b[0], baseY: b[1] }); if (m.state) m.state.paramChanged = true; return m.getGroup(); });
            const handed = group.clone();
            const tile = tileFromDomain(handed, ID, {});
            check(!!handed.dirichletBase && !!tile && goesRound(tile, b) && tile.tile.edges.length === edges && allPaired(tile.tile.edges) && sits(handed, tile).off < 1e-9,
                  `${name} with the base at (${b.join(', ')}): the tile holds the base, ${tile ? tile.tile.edges.length : 'no'} edges, every one with its pair`
                  + ((tile && !sameTile(tile, withoutBase(handed))) ? ' (not the polygon taken without the base)' : ''));
        }

        // the editor's New tile, without a point: the base's tile in world coordinates
        {
            const group = made(Group_KLMN, { bend: 20 }, true);
            const far = mean(tileFromDomain(group, ID, {}, mirror(mean(tileFromDomain(group, ID, {})))));
            const dg = dirichlet(group, far).clone();
            const { doc, editor } = newEditor(dg);
            const toWorld = patternToWorldMap(PTC);
            const expected = cornersOf(tileFromDomain(dg, ID, {})).map(q => toWorld.map(q[0], q[1]));
            const tile = editor.addTileFromDomain();
            check(!!tile && tile.type === 'polyline' && cornersOff(cornersOf(tile), expected) < 1e-12 && goesRound(tile, toWorld.map(far[0], far[1])),
                  'the editor: New tile on a Dirichlet domain whose base is in the other component adds the tile there');
            editor.undo();
            check(!doc.getItem(tile.id), 'the editor: one undo takes it away');
        }
    }
}

// ── a Kleinian group: its tiles stay tiles of points ────────────────────────
{
    const mk = new Group_Grandma();
    Object.assign(mk.params, { ta_re: 1.9, ta_im: 0.05, tb_re: 3, tb_im: 0 });
    mk.state.paramChanged = true;
    const { doc, editor } = newEditor(mk.getGroup());
    editor.setStyleValue('curvedTiles', true);
    const tile = editor.addTileFromDomain();
    check(editor.drawingGeometry().fallback === 'kleinian' && !editor.canCurveTiles(), 'Kleinian: tiles cannot be curved');
    if (tile) {
        check(tile.type === 'polyline' && !!tile.tile && editor.curvedTileOf(tile) === null, 'Kleinian: with Curved sides on the tile is still a tile of points');
        editor.convertSelection(true);
        const plain = doc.getItem(tile.id);
        check(plain.type === 'path' && !plain.tile, 'Kleinian: To path makes it a plain path, its pairing dropped (as before)');
    }
}

console.log(failed ? `${failed} check(s) FAILED` : 'tiles: all checks passed');
if (failed) process.exitCode = 1;
