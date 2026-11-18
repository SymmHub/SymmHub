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
  - Release tile drops the pairing.
*/

import { Group_KLM, Group_WP, Group_Grandma } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';
import { outlinePoint } from '../../lib/drawlib/Paths.js';
import { tileEdgeStarts, tileWithNodes, tileInsertedVertex, tileMovedVertex, tileRemovedVertex, tileReplacedEdge,
         tileEdgeOfHandle, tileHandleFree } from '../../lib/drawlib/Tiles.js';

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
