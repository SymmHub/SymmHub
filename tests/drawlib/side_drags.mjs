/*
  tests of the node tool's side drags (lib/drawlib/NodeTool.js,
  docs/tile_tool_ui_plan.md 3.4, phase 1)

    node tests/drawlib/side_drags.mjs

  A drag on a segment bends it through the pointer (Inkscape's), whatever the
  outline is. Checked here:
  - a plain polyline, open and closed: it becomes a path, the curve passes
    through the drop point at the pressed parameter, the other segments stay
    straight; one undo step gives the polyline back;
  - a tile of points (632, Curved sides off): it becomes a curved tile, its
    pairing kept, the pair the image of the side handle by handle, the
    corners where they were; one undo step gives the tile of points back;
  - a curved tile (Curved sides on, the default) bends the same way;
  - a side on a mirror (*632) does not move;
  - in a hyperbolic group a tile of points becomes a geodesic curved tile,
    its pairs the images;
  - in a Kleinian group a curved tile (a path of cubics) and a tile of
    points bend the same way, the pair the cubic fitted to the image of the
    side (to 3e-3 of the tile) and drawn as the exact image (the document's
    outline of the tile, to 3e-6), the corners where they were; one undo
    step;
  - a double click on a side whose pair comes before it picks the new
    vertex (its index counted again after the pair took one too).
*/

import { Group_KLM, Group_WP, Group_Grandma } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import { groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';
import { segmentStraight } from '../../lib/drawlib/Paths.js';
import { tileEdgeStarts } from '../../lib/drawlib/Tiles.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PTC = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };

/** an editor and a node tool over a view of px canvas pixels a world unit, snapping off */
function setup(group, px = 1000){
    const doc = DrawingDocument();
    doc.clear();
    doc.setOutliner(groupOutliner(group, PTC));
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group, ptc: PTC, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [px*w[0], px*w[1]], toWorld: c => ({ pnt: [c[0]/px, c[1]/px] }), isLinear: () => true, pixelSize: () => 1/px },
    });
    editor.setStyleValue('snap', false);
    const tool = NodeTool({ editor });
    const pointer = (type, w, extra = {}) => ({ type, wpnt: w, canvasX: px*w[0], canvasY: px*w[1], offsetX: px*w[0], offsetY: px*w[1],
                                                button: 0, buttons: type === 'pointerup' ? 0 : 1, preventDefault(){}, ...extra });
    const drag = (from, to) => {
        tool.handleEvent(pointer('pointerdown', from));
        for (let k = 1; k <= 4; k++) tool.handleEvent(pointer('pointermove', [from[0] + (to[0] - from[0])*k/4, from[1] + (to[1] - from[1])*k/4]));
        tool.handleEvent(pointer('pointerup', to));
    };
    const dblclick = (w) => tool.handleEvent(pointer('dblclick', w));
    return { doc, editor, tool, drag, dblclick };
}

/** a point beside segment [a, b] at its parameter t, off it by off times its length (to the left) */
function beside(a, b, t, off){
    const d = [b[0] - a[0], b[1] - a[1]];
    return [a[0] + t*d[0] - off*d[1], a[1] + t*d[1] + off*d[0]];
}

const pointOf = (item, v) => {
    if (item.nodes) return item.nodes[v % item.nodes.length].p;
    const n = item.points.length/2;
    return [item.points[2*(v % n)], item.points[2*(v % n) + 1]];
};

/** an edge's points in order from its first corner; a curved tile's with its handles: corner, h2, (h1, p, h2) ..., h1, corner */
function edgeSequence(item, k){
    const starts = tileEdgeStarts(item.tile), out = [];
    for (let v = starts[k]; v <= starts[k + 1]; v++) {
        if (!item.nodes) { out.push(pointOf(item, v)); continue; }
        const a = item.nodes[v % item.nodes.length];
        if (v > starts[k]) out.push(a.h1);
        out.push(a.p);
        if (v < starts[k + 1]) out.push(a.h2);
    }
    return out;
}

/** the largest distance between the paired edges and the images of their edges, point by point (handles too); Infinity when they do not match up */
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

/** the point of a plane path's segment seg (from node seg to the next) at its parameter t: the cubic of its nodes and handles */
function cubicAt(item, seg, t){
    const n = item.nodes.length, a = item.nodes[seg], b = item.nodes[(seg + 1) % n];
    const p0 = a.p, c1 = a.h2 || a.p, c2 = b.h1 || b.p, p3 = b.p, u = 1 - t;
    return [0, 1].map(i => u*u*u*p0[i] + 3*u*u*t*c1[i] + 3*u*t*t*c2[i] + t*t*t*p3[i]);
}

const corners = (item) => tileEdgeStarts(item.tile).slice(0, -1).map(v => pointOf(item, v));
const cornerShift = (a, b) => Math.max(...corners(a).map((p, k) => dist(p, corners(b)[k])));
const select = (editor, item) => editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);

// ── plain polylines ─────────────────────────────────────────────────────────
for (const closed of [false, true]) {
    const { doc, editor, drag } = setup(new Group_WP({ type: '632' }).getGroup());
    const style = { stroke: { rgba: [0, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
    const item = doc.insertItem({ type: 'polyline', closed, style, points: [-0.4, -0.2, -0.1, -0.3, 0.2, -0.1, 0.1, 0.25] });
    const original = JSON.parse(JSON.stringify(doc.getItem(item.id)));
    select(editor, item);
    const what = closed ? 'a closed polyline' : 'an open polyline';
    const seg = closed ? 3 : 1, t = 0.3;
    const a = pointOf(original, seg), b = pointOf(original, seg + 1);
    const from = beside(a, b, t, 0), to = beside(a, b, t, 0.2);
    drag(from, to);
    const bent = doc.getItem(item.id);
    check(bent.type === 'path' && bent.nodes && bent.nodes.length === original.points.length/2 && !!bent.closed === closed,
          `${what}: a drag on segment ${seg} makes it a path of as many nodes`);
    const at = bent.nodes ? cubicAt(bent, seg, t) : null;
    check(!!at && dist(at, to) < 1e-9, `${what}: the curve passes through the drop point at the pressed parameter (${fmt(at ? dist(at, to) : NaN)})`);
    const segs = closed ? bent.nodes.length : bent.nodes.length - 1;
    const others = [...Array(segs).keys()].filter(s => s !== seg);
    check(others.every(s => segmentStraight(bent.nodes, s, closed)), `${what}: the other segments stay straight`);
    editor.undo();
    check(same(doc.getItem(item.id), original), `${what}: one undo gives the polyline back`);
}

// ── a tile of points and a curved tile (632) ────────────────────────────────
for (const curvedFirst of [false, true]) {
    const { doc, editor, drag } = setup(new Group_WP({ type: '632' }).getGroup());
    const mapWord = editor.pairingMap;
    editor.setStyleValue('curvedTiles', curvedFirst);
    const tile = editor.addTileFromDomain();
    const original = JSON.parse(JSON.stringify(doc.getItem(tile.id)));
    const what = curvedFirst ? 'a curved tile' : 'a tile of points';
    check(curvedFirst ? !!tile.nodes : tile.type === 'polyline', `632: ${what} from the domain`);
    // edge 1, whose pair (edge 0) comes before it
    const k = 1, starts = tileEdgeStarts(tile.tile), seg = starts[k];
    const a = pointOf(tile, seg), b = pointOf(tile, seg + 1);
    const t = 0.4, from = beside(a, b, t, 0), to = beside(a, b, t, 0.15);
    drag(from, to);
    const bent = doc.getItem(tile.id);
    check(bent.type === 'path' && !!bent.tile && same(bent.tile.edges.map(e => e.count), original.tile.edges.map(e => e.count)),
          `632, ${what}: a side drag makes a curved tile, its edges as they were`);
    check(pairError(bent, mapWord) < 1e-12, `632, ${what}: the pair is the image of the side, handles too (${fmt(pairError(bent, mapWord))})`);
    check(cornerShift(bent, original) < 1e-15, `632, ${what}: the corners stay`);
    const at = bent.nodes ? cubicAt(bent, seg, t) : null;
    check(!!at && dist(at, to) < 1e-9, `632, ${what}: the side passes through the drop point (${fmt(at ? dist(at, to) : NaN)})`);
    editor.undo();
    check(same(doc.getItem(tile.id), original), `632, ${what}: one undo gives the tile back`);
}

// ── a side on a mirror does not move ────────────────────────────────────────
{
    const { doc, editor, drag } = setup(new Group_WP({ type: '*632' }).getGroup());
    editor.setStyleValue('curvedTiles', false);
    const tile = editor.addTileFromDomain();
    if (!tile) check(false, '*632: a tile from the domain');
    else {
        const original = JSON.parse(JSON.stringify(doc.getItem(tile.id)));
        check(tile.tile.edges.every(e => e.locked), '*632: every side lies on a mirror');
        const a = pointOf(tile, 0), b = pointOf(tile, 1);
        drag(beside(a, b, 0.5, 0), beside(a, b, 0.5, 0.15));
        check(same(doc.getItem(tile.id), original), '*632: a drag on a mirror side changes nothing');
    }
}

// ── a hyperbolic tile of points becomes a geodesic curved tile ──────────────
{
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K: 2, L: 3, M: 7, s: false, hasR: false });
    const { doc, editor, drag } = setup(maker.getGroup(), 4000);
    const mapWord = editor.pairingMap;
    editor.setStyleValue('curvedTiles', false);
    const tile = editor.addTileFromDomain();
    const k = tile.tile.edges.findIndex((e, j) => !e.locked && e.pair !== null && e.pair !== j);
    const starts = tileEdgeStarts(tile.tile);
    // the edge's longest segment
    let seg = starts[k];
    for (let v = starts[k]; v < starts[k + 1]; v++) if (dist(pointOf(tile, v), pointOf(tile, v + 1)) > dist(pointOf(tile, seg), pointOf(tile, seg + 1))) seg = v;
    const a = pointOf(tile, seg), b = pointOf(tile, seg + 1);
    drag(beside(a, b, 0.5, 0), beside(a, b, 0.5, 0.3));
    const bent = doc.getItem(tile.id);
    check(bent.type === 'path' && bent.geodesic === true && !!bent.tile && bent.nodes.some(q => q.h1 || q.h2),
          `237: a side drag on a tile of points makes a geodesic curved tile with handles`);
    check(pairError(bent, mapWord) < 1e-9 && cornerShift(bent, tile) < 1e-12,
          `237: the pairs are the images (${fmt(pairError(bent, mapWord))}), the corners stay`);
}

// ── a Kleinian tile: the drag bends the side, the pair fitted to its image ──
{
    const mk = new Group_Grandma();
    Object.assign(mk.params, { ta_re: 1.9, ta_im: 0.05, tb_re: 3, tb_im: 0 });
    mk.state.paramChanged = true;
    const bez = (cp, t) => { const u = 1 - t; return [0, 1].map(i => u*u*u*cp[0][i] + 3*u*u*t*cp[1][i] + 3*u*t*t*cp[2][i] + t*t*t*cp[3][i]); };
    const cubicOf = (item, v) => { const n = item.nodes.length, a = item.nodes[v % n], b = item.nodes[(v + 1) % n]; return [a.p, a.h2 || a.p, b.h1 || b.p, b.p]; };
    const toSegment = (q, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L2 = d[0]*d[0] + d[1]*d[1]; const t = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0])*d[0] + (q[1] - a[1])*d[1])/L2)) : 0; return dist(q, [a[0] + t*d[0], a[1] + t*d[1]]); };
    /** how far the image of each paired edge's curve lies from its pair's curve */
    const curvePairError = (item, mapWord) => {
        const st = tileEdgeStarts(item.tile);
        let err = 0;
        item.tile.edges.forEach((e, k) => {
            if (e.pair === null || e.pair === k || e.locked) return;
            const map = mapWord(e.word), fine = [];
            for (let v = st[e.pair]; v < st[e.pair + 1]; v++) for (let i = 0; i <= 200; i++) fine.push(bez(cubicOf(item, v), i/200));
            for (let v = st[k]; v < st[k + 1]; v++) for (let i = 0; i <= 24; i++) {
                const q = map(bez(cubicOf(item, v), i/24));
                let best = Infinity;
                for (let j = 0; j + 1 < fine.length; j++) best = Math.min(best, toSegment(q, fine[j], fine[j + 1]));
                err = Math.max(err, best);
            }
        });
        return err;
    };
    /** how far the image of each edge lies from its fitted pair as drawn (the outline's pieces); Infinity without an outline */
    const drawnPairError = (item, mapWord) => {
        const o = item.outline, st = tileEdgeStarts(item.tile);
        if (!o || !o.nodes) return Infinity;
        let err = 0;
        item.tile.edges.forEach((e, j) => {
            if (!e.fitted) return;
            const map = mapWord(item.tile.edges[e.pair].word), fine = [];
            o.nodes.forEach((a, q) => {
                const src = o.source[q];
                if (!src || src.seg < st[j] || src.seg >= st[j + 1]) return;
                const b = o.nodes[(q + 1) % o.nodes.length];
                for (let i = 0; i <= 200; i++) fine.push(bez([a.p, a.h2 || a.p, b.h1 || b.p, b.p], i/200));
            });
            for (let v = st[e.pair]; v < st[e.pair + 1]; v++) for (let i = 0; i <= 24; i++) {
                const q = map(bez(cubicOf(item, v), i/24));
                let best = Infinity;
                for (let f = 0; f + 1 < fine.length; f++) best = Math.min(best, toSegment(q, fine[f], fine[f + 1]));
                err = Math.max(err, best);
            }
        });
        return err;
    };
    for (const curved of [true, false]) {
        const what = curved ? 'a curved tile' : 'a tile of points';
        const { doc, editor, drag } = setup(mk.getGroup(), 4000);
        editor.setStyleValue('curvedTiles', curved);
        const mapWord = editor.pairingMap;
        const tile = editor.addTileFromDomain();
        check(!!tile && tile.type === (curved ? 'path' : 'polyline'), `Kleinian: New tile with Curved sides ${curved ? 'on is a path of cubics' : 'off is a tile of points'}`);
        if (!tile) continue;
        const original = JSON.parse(JSON.stringify(doc.getItem(tile.id)));
        const c = corners(tile);
        let size = 0;
        for (const a of c) for (const b of c) size = Math.max(size, dist(a, b));
        const k = tile.tile.edges.findIndex((e, j) => !e.locked && e.pair !== null && e.pair !== j);
        const starts = tileEdgeStarts(tile.tile);
        // the longest segment of edge k, pressed at its middle (on the curve)
        let seg = starts[k];
        for (let v = starts[k]; v < starts[k + 1]; v++) if (dist(pointOf(tile, v), pointOf(tile, v + 1)) > dist(pointOf(tile, seg), pointOf(tile, seg + 1))) seg = v;
        const a = pointOf(tile, seg), b = pointOf(tile, seg + 1);
        const from = tile.nodes ? cubicAt(tile, seg, 0.5) : beside(a, b, 0.5, 0);
        const to = [from[0] - 0.15*(b[1] - a[1]), from[1] + 0.15*(b[0] - a[0])];
        drag(from, to);
        const out = doc.getItem(tile.id);
        const pair = tile.tile.edges[k].pair;
        check(out.type === 'path' && !!out.tile && out.tile.edges[k].count === tile.tile.edges[k].count && dist(cubicAt(out, seg, 0.5), to) < 1e-9,
              `Kleinian, ${what}: the drag bends the side through the drop point, a curved tile, no node added`);
        const err = curvePairError(out, mapWord)/size;
        check(err < 3e-3 && corners(out).every((p, i) => dist(p, c[i]) < 1e-15),
              `Kleinian, ${what}: edge ${k}'s pair ${pair} is the cubic fitted to its image (${fmt(err)} of the tile), the corners stay`);
        const drawnErr = drawnPairError(out, mapWord)/size;
        check(!!out.tile.edges[pair].fitted && !out.tile.edges[k].fitted && drawnErr < 3e-6,
              `Kleinian, ${what}: the pair marked fitted, drawn as the exact image (${fmt(drawnErr)} of the tile)`);
        editor.undo();
        check(same(doc.getItem(tile.id), original), `Kleinian, ${what}: one undo gives the tile back`);
    }
}

// ── a double click on a side whose pair comes first picks the new vertex ────
{
    const { doc, editor, dblclick } = setup(new Group_WP({ type: '632' }).getGroup());
    editor.setStyleValue('curvedTiles', false);
    const tile = editor.addTileFromDomain();
    const k = 1, pair = tile.tile.edges[k].pair, starts = tileEdgeStarts(tile.tile);
    check(pair < k, `632: the pair of edge ${k} (edge ${pair}) comes before it`);
    const at = beside(pointOf(tile, starts[k]), pointOf(tile, starts[k] + 1), 0.5, 0);
    dblclick(at);
    const out = doc.getItem(tile.id);
    const picked = editor.getSelectedVertex();
    check(out.points.length === tile.points.length + 4, 'a double click adds a vertex to the side and one to its pair');
    check(!!picked && dist(pointOf(out, picked.vertex), at) < 1e-12, 'the picked vertex is the new one, where the double click was');
}

console.log(failed ? `${failed} check(s) FAILED` : 'side drags: all checks passed');
if (failed) process.exitCode = 1;
