/*
  tests of three node tool features after Inkscape's
  (lib/drawlib/NodeTool.js, Paths.js alongHandleLines, DrawingEditor.js
  itemsInBand; docs/node_editing_plan.md 7.8)

    node tests/drawlib/node_lines_band_insert.mjs

  Checked here:
  - alongHandleLines: the nearer of a node's handle lines, a retracted
    handle's along its segment, an end's one line, in a geodesic chart a
    point on the geodesic from the node to its handle;
  - Alt+drag of a node: along its handle lines (a corner's segments, a
    handle out, Alt held only during the move, several picked nodes move by
    as much, a polyline's point), unsnapped, one undo step; Alt+click still
    removes the node, at the release; Alt+drag removes nothing;
  - the rubber band with no outline selected: the items with a copy wholly
    inside it selected on that copy (another tile's copy too), an item only
    partly inside left, nothing inside: the selection dropped, Shift adds;
    with an outline selected it still picks nodes;
  - Add nodes (Insert, the bar's button): a node in the middle of each
    segment between picked nodes, all of them picked, one undo step over two
    items; picks not next to each other, or one: the segment after the last
    picked, the new node alone; a closed path's closing segment; a polyline;
    a tile's edge (its pair takes one too); Ctrl+Insert does nothing.
*/

import { Group_WP } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import { alongHandleLines } from '../../lib/drawlib/Paths.js';
import { applyTransform } from '../../lib/drawlib/Orbits.js';
import { groupOutliner, geodesicOutliner } from '../../lib/drawlib/DrawingGeometry.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const node = (x, y, extra = {}) => ({ p: [x, y], h1: null, h2: null, ...extra });
const fmt = (x) => x.toExponential(1);

const PX = 1000;     // canvas pixels a world unit, as the view's pixel size 0.001 has it
function pointer(type, w, extra = {}){
    return { type, wpnt: w, canvasX: PX*w[0], canvasY: PX*w[1], offsetX: PX*w[0], offsetY: PX*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1,
             preventDefault(){}, ...extra };
}
function click(tool, w, extra = {}){
    tool.handleEvent(pointer('pointerdown', w, extra));
    tool.handleEvent(pointer('pointerup', w, extra));
}
/** a drag from `from` to `to`: the press with `down`, the moves and the release with `move` */
function drag(tool, from, to, down = {}, move = down){
    tool.handleEvent(pointer('pointerdown', from, down));
    for (let k = 1; k <= 4; k++) tool.handleEvent(pointer('pointermove', [from[0] + (to[0] - from[0])*k/4, from[1] + (to[1] - from[1])*k/4], move));
    tool.handleEvent(pointer('pointerup', to, move));
}
function key(tool, k, extra = {}){
    const e = { type: 'keydown', key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault(){}, stopPropagation(){}, ...extra };
    tool.handleKey(e);
    return e;
}

const g632 = new Group_WP({ type: '632' }).getGroup();
const ptc = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
function setup(){
    const doc = DrawingDocument();
    doc.clear();
    doc.setOutliner(groupOutliner(g632, ptc));
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group: g632, ptc, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
    });
    editor.setStyleValue('snap', false);
    return { doc, editor, tool: NodeTool({ editor }) };
}
const stroke = { stroke: { rgba: [0, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
const sel = (it) => ({ id: it.id, frame: null, frameInv: null });

// ── alongHandleLines ───────────────────────────────────────────────────────
{
    const nodes = [node(0, 0), node(1, 0, { h1: [0.7, 0.3], h2: [1.4, 0] }), node(2, 1)];
    check(dist(alongHandleLines(nodes, 1, false, [2, 0.1]), [2, 0]) < 1e-12, 'nearer to the line of h2: on it');
    check(dist(alongHandleLines(nodes, 1, false, [0.5, 0.6]), [0.45, 0.55]) < 1e-12, 'nearer to the line of h1: on it (beyond the handle too)');
    const corner = [node(0, 0), node(1, 0), node(1, 1)];
    check(dist(alongHandleLines(corner, 1, false, [1.3, 0.1]), [1.3, 0]) < 1e-12 && dist(alongHandleLines(corner, 1, false, [1.05, 0.6]), [1, 0.6]) < 1e-12,
          'retracted handles: along the segments to the neighbours');
    check(dist(alongHandleLines(corner, 2, false, [1.4, 1.5]), [1, 1.5]) < 1e-12, 'the end of an open path: its one line');
    check(dist(alongHandleLines(corner, 0, true, [0.3, 0.29]), [0.295, 0.295]) < 1e-12, 'closed: the first node\'s line to the last');
    // a geodesic path in the unit disk: in the chart of the node, on the geodesic to its handle
    const chart = geodesicOutliner({ kind: 'hyperbolic', c: [0, 0], r: 1 }).chart;
    const g = [node(-0.5, 0.1), node(0.2, 0.3, { h2: [0.5, 0.1], h1: [-0.1, 0.35], smooth: true }), node(0.6, -0.2)];
    const at = alongHandleLines(g, 1, false, [0.55, 0.15], chart);
    const c = chart(g[1].p), u = c.to(at), d = c.to(g[1].h2);
    check(Math.abs(u[0]*d[1] - u[1]*d[0]) < 1e-12 && u[0]*d[0] + u[1]*d[1] > 0 && dist(at, [0.55, 0.15]) < 0.1,
          'a geodesic path: on the geodesic from the node through its handle (in the node\'s chart)');
}

// ── Alt+drag of a node: along its handle lines ─────────────────────────────
{
    const { doc, editor, tool } = setup();
    const P = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(0, 0), node(0.2, 0), node(0.2, 0.2)] });
    editor.setSelection([sel(P)]);
    const p = (v) => doc.getItem(P.id).nodes[v].p;
    // the editor's undo drops the selection: P selected again
    const undo = () => { editor.undo(); editor.setSelection([sel(P)]); };
    drag(tool, [0.2, 0], [0.3, 0.02], { altKey: true });
    check(dist(p(1), [0.3, 0]) < 1e-12 && doc.getItem(P.id).nodes.length === 3, 'Alt+drag of a corner: along its segment to the previous node');
    undo();
    check(dist(p(1), [0.2, 0]) < 1e-12, 'one undo step');
    drag(tool, [0.2, 0], [0.21, 0.15], { altKey: true });
    check(dist(p(1), [0.2, 0.15]) < 1e-12, '... nearer the other segment: along it');
    undo();
    drag(tool, [0.2, 0], [0.3, 0.03], {}, { altKey: true });
    check(dist(p(1), [0.3, 0]) < 1e-12, 'Alt held only while it moves: the same');
    undo();
    // a handle out on the diagonal
    doc.updateItem(P.id, { ...doc.getItem(P.id), nodes: [node(0, 0), node(0.2, 0, { h2: [0.25, 0.05] }), node(0.2, 0.2)] });
    drag(tool, [0.2, 0], [0.35, 0.16], { altKey: true });
    const n1 = doc.getItem(P.id).nodes[1];
    check(dist(n1.p, [0.355, 0.155]) < 1e-12 && dist(n1.h2, [0.405, 0.205]) < 1e-12, 'a handle out: along its line, the handle carried along');
    undo();
    // two picked nodes: the other moves by as much
    editor.setSelectedVertices([{ id: P.id, vertex: 0 }, { id: P.id, vertex: 1 }]);
    drag(tool, [0.2, 0], [0.3, 0.02], { altKey: true });
    check(dist(p(0), [0.1, 0]) < 1e-12 && dist(p(1), [0.3, 0]) < 1e-12, 'several picked: they move by the dragged one\'s step');
    undo();
    // a polyline's point: along its edges
    const L = doc.insertItem({ type: 'polyline', closed: true, style: stroke, points: [-0.4, 0, -0.2, 0, -0.3, 0.2] });
    editor.setSelection([sel(L)]);
    drag(tool, [-0.2, 0], [-0.1, -0.03], { altKey: true });
    check(dist(doc.getItem(L.id).points.slice(2, 4), [-0.1, 0]) < 1e-12, 'a polyline\'s point: along its edge');
    undo();
    // Alt+click removes the node at the release, Alt+drag removes nothing
    editor.setSelection([sel(P)]);
    tool.handleEvent(pointer('pointerdown', [0.2, 0], { altKey: true }));
    check(doc.getItem(P.id).nodes.length === 3, 'Alt+press: the node still there');
    tool.handleEvent(pointer('pointerup', [0.2, 0], { altKey: true }));
    check(doc.getItem(P.id).nodes.length === 2, '... removed at the release');
    undo();
    check(doc.getItem(P.id).nodes.length === 3, '... back by undo');
    // the snap stays off with Alt (the corners again, without the diagonal handle)
    doc.updateItem(P.id, { ...doc.getItem(P.id), nodes: [node(0, 0), node(0.2, 0), node(0.2, 0.2)] });
    editor.setStyleValue('snap', true);
    drag(tool, [0.2, 0], [0.199, 0.199], { altKey: true });
    check(dist(p(1), [0.2, 0.199]) < 1e-12, 'Alt: not snapped to the next node (on its line short of it)');
    undo();
    drag(tool, [0.2, 0], [0.199, 0.199]);
    check(dist(p(1), [0.2, 0.2]) < 1e-12, '... without Alt the same drag snaps to it');
    undo();
    editor.setStyleValue('snap', false);
}

// ── the rubber band with no outline selected: items ────────────────────────
{
    const { doc, editor, tool } = setup();
    const A = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(-0.4, -0.3), node(-0.2, -0.35), node(0, -0.3), node(0.2, -0.35)] });
    const B = doc.insertItem({ type: 'path', closed: true, style: stroke, nodes: [node(0.1, 0.1), node(0.3, 0.1), node(0.3, 0.3), node(0.1, 0.3)] });
    const I = doc.insertItem({ type: 'image', closed: true, src: null, points: [-0.45, 0.4, -0.35, 0.4, -0.35, 0.5, -0.45, 0.5],
                               style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 } });
    const ids = () => editor.getSelection().map(s => s.id === A.id ? 'A' : s.id === B.id ? 'B' : s.id === I.id ? 'I' : '?').sort().join(',');
    // every selected copy wholly in the band
    const allInside = (c0, c1) => editor.getSelection().every(s => doc.getItem(s.id).points.reduce((ok, v, k, a) => {
        if (!ok || k % 2) return ok;
        const w = editor.mapWorld(s.frameInv, [a[k], a[k + 1]]);
        return w[0] >= Math.min(c0[0], c1[0]) - 1e-9 && w[0] <= Math.max(c0[0], c1[0]) + 1e-9 && w[1] >= Math.min(c0[1], c1[1]) - 1e-9 && w[1] <= Math.max(c0[1], c1[1]) + 1e-9;
    }, true));
    editor.clearSelection();
    drag(tool, [0.08, 0.08], [0.32, 0.32]);
    check(ids().split(',').includes('B') && allInside([0.08, 0.08], [0.32, 0.32]), `nothing selected: the band selects the item inside it (${ids()})`);
    drag(tool, [-0.5, -0.4], [0.25, -0.25]);
    check(ids() === 'B' || ids() === '', 'with an outline selected the band picks nodes, the selection kept');
    check(editor.getSelectedVertices().length === 0, '... none of B inside it');
    editor.clearSelection();
    drag(tool, [0.08, 0.08], [0.2, 0.32]);
    check(!ids().split(',').includes('B'), 'an item only partly inside: not selected');
    editor.setSelection([sel(I)]);
    drag(tool, [-0.42, -0.38], [0.25, -0.25]);
    check(ids() === 'A', 'an image selected (no outline): the band selects the items inside, in its place');
    editor.setSelection([sel(I)]);
    drag(tool, [0.08, 0.08], [0.32, 0.32], { shiftKey: true });
    check(ids() === 'B,I', 'Shift: added to the selection');
    editor.setSelection([sel(I)]);
    drag(tool, [0.6, 0.6], [0.62, 0.62]);
    check(ids() === '', 'nothing inside, no Shift: the selection dropped');
    // a copy of B in another tile: its image by a side pairing of the group
    const tr = g632.getReverseITransforms().find(t => {
        const q = applyTransform(t, [0.2, 0.2]);
        return dist(q, [0.2, 0.2]) > 0.5;
    });
    if (!tr) check(false, 'a side pairing taking B away');
    else {
        const img = doc.getItem(B.id).nodes.map(m => applyTransform(tr, m.p));
        const lo = [Math.min(...img.map(q => q[0])) - 0.02, Math.min(...img.map(q => q[1])) - 0.02];
        const hi = [Math.max(...img.map(q => q[0])) + 0.02, Math.max(...img.map(q => q[1])) + 0.02];
        editor.clearSelection();
        drag(tool, lo, hi);
        const s = editor.getSelection().find(e => e.id === B.id);
        const w0 = s ? editor.mapWorld(s.frameInv, [0.1, 0.1]) : null;
        check(!!s && allInside(lo, hi) && dist(w0, [0.1, 0.1]) > 0.1, `a copy in another tile: selected on that copy (its first point at ${w0 ? w0.map(v => v.toFixed(3)) : '-'})`);
        // the node tool edits it there: a click on its copy of node 0 picks it
        if (s) {
            click(tool, w0);
            check(editor.getSelectedVertices().length === 1 && editor.getSelectedVertex().vertex === 0, '... its nodes picked on that copy');
        }
    }
}

// ── Add nodes ──────────────────────────────────────────────────────────────
{
    const { doc, editor, tool } = setup();
    const A = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(-0.4, -0.3), node(-0.2, -0.35), node(0, -0.3), node(0.2, -0.35)] });
    const B = doc.insertItem({ type: 'path', closed: true, style: stroke, nodes: [node(0.1, 0.1), node(0.3, 0.1), node(0.3, 0.3), node(0.1, 0.3)] });
    const C = doc.insertItem({ type: 'polyline', closed: false, style: stroke, points: [-0.4, 0.2, -0.3, 0.3, -0.2, 0.2] });
    const selectAll = () => editor.setSelection([A, B, C].map(sel));
    selectAll();
    // the editor's undo drops the selection: all selected again
    const undo = () => { editor.undo(); selectAll(); };
    const picks = () => editor.getSelectedVertices().map(v => `${v.id === A.id ? 'A' : v.id === B.id ? 'B' : 'C'}${v.vertex}`).sort().join(',');
    const count = (it) => { const item = doc.getItem(it.id); return item.nodes ? item.nodes.length : item.points.length/2; };
    const pt = (it, v) => { const item = doc.getItem(it.id); return item.nodes ? item.nodes[v].p : [item.points[2*v], item.points[2*v + 1]]; };
    editor.setSelectedVertices([0, 1, 2].map(vertex => ({ id: A.id, vertex })));
    check(!key(tool, 'Insert', { ctrlKey: true }).isConsumed && count(A) === 4, 'Ctrl+Insert: nothing');
    check(key(tool, 'Insert').isConsumed && count(A) === 6, 'Insert with three picked: a node on each of the two segments between them');
    check(dist(pt(A, 1), [-0.3, -0.325]) < 1e-12 && dist(pt(A, 3), [-0.1, -0.325]) < 1e-12 && dist(pt(A, 4), [0, -0.3]) < 1e-12,
          '... in their middles, the old nodes after them');
    check(picks() === 'A0,A1,A2,A3,A4', `... the picked nodes and the new ones picked (${picks()})`);
    undo();
    check(count(A) === 4, 'one undo step');
    editor.setSelectedVertices([{ id: A.id, vertex: 0 }, { id: A.id, vertex: 2 }]);
    key(tool, 'Insert');
    check(count(A) === 5 && dist(pt(A, 3), [0.1, -0.325]) < 1e-12 && picks() === 'A3', 'picks not next to each other: after the last picked, the new node alone');
    undo();
    editor.setSelectedVertex({ id: A.id, vertex: 3 });
    key(tool, 'Insert');
    check(count(A) === 5 && dist(pt(A, 3), [0.1, -0.325]) < 1e-12 && picks() === 'A3', 'the end of an open path: on the segment before it');
    undo();
    editor.setSelectedVertices([{ id: B.id, vertex: 3 }, { id: B.id, vertex: 0 }]);
    key(tool, 'Insert');
    check(count(B) === 5 && dist(pt(B, 4), [0.1, 0.2]) < 1e-12 && picks() === 'B0,B3,B4', 'a closed path\'s closing segment: the new node last');
    undo();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: A.id, vertex: 2 }, { id: C.id, vertex: 0 }, { id: C.id, vertex: 1 }, { id: C.id, vertex: 2 }]);
    key(tool, 'Insert');
    check(count(A) === 5 && count(C) === 5 && dist(pt(C, 1), [-0.35, 0.25]) < 1e-12 && dist(pt(C, 3), [-0.25, 0.25]) < 1e-12,
          'two items, a polyline among them: each segment between picked nodes');
    check(picks() === 'A1,A2,A3,C0,C1,C2,C3,C4', `... all picked (${picks()})`);
    undo();
    check(count(A) === 4 && count(C) === 3, '... one undo step for both');
    // the bar's button
    editor.setSelectedVertices([{ id: B.id, vertex: 0 }, { id: B.id, vertex: 1 }]);
    const group = tool.getProperties().find(g => g.title === 'the picked node');
    const button = group.controls.find(c => (c.title || '').startsWith('Add nodes'));
    check(!!button && button.enabled(), 'the bar\'s Add nodes button is enabled');
    button.action();
    check(count(B) === 5 && dist(pt(B, 1), [0.2, 0.1]) < 1e-12, '... and adds the node');
    undo();
}

// ── Add nodes on a tile's edge: its pair takes one too ─────────────────────
{
    const { doc, editor, tool } = setup();
    const tile = editor.addTileFromDomain();
    const k = tile ? tile.tile.edges.findIndex((e, i) => !e.locked && e.pair !== null && e.pair !== undefined && e.pair !== i) : -1;
    if (!tile || k < 0 || tile.points.length/2 !== tile.tile.edges.length) check(false, 'a tile of corners with a free edge');
    else {
        const n = tile.points.length/2;
        editor.setSelection([sel(tile)]);
        editor.setSelectedVertices([{ id: tile.id, vertex: k }, { id: tile.id, vertex: (k + 1) % n }]);
        key(tool, 'Insert');
        const t = doc.getItem(tile.id);
        const a = [tile.points[2*k], tile.points[2*k + 1]], b = [tile.points[2*((k + 1) % n)], tile.points[2*((k + 1) % n) + 1]];
        const v = editor.getSelectedVertices().map(q => q.vertex);
        const mid = v.map(i => [t.points[2*i], t.points[2*i + 1]]).find(q => dist(q, [(a[0] + b[0])/2, (a[1] + b[1])/2]) < 1e-12);
        check(t.points.length/2 === n + 2 && t.tile.edges[k].count === 2 && t.tile.edges[tile.tile.edges[k].pair].count === 2,
              `a tile's edge ${k}: a node in its middle, its pair ${tile.tile.edges[k].pair} one too`);
        check(v.length === 3 && !!mid, '... the two corners and the new node picked');
        editor.undo();
        check(doc.getItem(tile.id).points.length/2 === n, '... one undo step');
    }
}

console.log(failed ? `node_lines_band_insert: ${failed} FAILED` : 'node_lines_band_insert: all checks passed');
if (failed) process.exit(1);
