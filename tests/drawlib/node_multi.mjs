/*
  tests of several picked nodes in the node tool
  (lib/drawlib/DrawingEditor.js, NodeTool.js; docs/node_editing_plan.md 5.4)

    node tests/drawlib/node_multi.mjs

  Checked here:
  - the editor's picked vertices: each once, the last picked last
    (getSelectedVertex), dropped with the selection;
  - picking: a click picks a node alone, Shift+click adds or drops it, a
    click on a segment picks its two nodes (Shift adds them), a rubber band
    picks the nodes of the selected outlines inside it (Shift adds them),
    Ctrl+A picks every node of the selected outlines (or selects all with
    nothing selected), Tab and Shift+Tab step, Escape drops them first;
  - a drag of a picked node moves all the picked nodes of two outlines by
    as much, one undo step; Ctrl keeps it horizontal; a press on a node not
    picked moves it alone; the arrows nudge them all;
  - Delete removes the picked nodes (two of an outline stay), one step;
  - the types act on all of them, the bar shows a shared type only;
  - Make segments curves with several picked: the segments between them,
    with one: its two segments;
  - X and Y in the bar: the centre of their box, typed they all move;
  - the handles of every picked node show, and the band is drawn.
*/

import { Group_WP } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import { nodeType, segmentStraight } from '../../lib/drawlib/Paths.js';
import { groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const node = (x, y, extra = {}) => ({ p: [x, y], h1: null, h2: null, ...extra });

const PX = 1000;     // canvas pixels a world unit, as the view's pixel size 0.001 has it
function pointer(type, w, extra = {}){
    return { type, wpnt: w, canvasX: PX*w[0], canvasY: PX*w[1], offsetX: PX*w[0], offsetY: PX*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1,
             preventDefault(){}, ...extra };
}
function click(tool, w, extra = {}){
    tool.handleEvent(pointer('pointerdown', w, extra));
    tool.handleEvent(pointer('pointerup', w, extra));
}
function drag(tool, from, to, extra = {}){
    tool.handleEvent(pointer('pointerdown', from, extra));
    for (let k = 1; k <= 4; k++) tool.handleEvent(pointer('pointermove', [from[0] + (to[0] - from[0])*k/4, from[1] + (to[1] - from[1])*k/4], extra));
    tool.handleEvent(pointer('pointerup', to, extra));
}
function key(tool, k, extra = {}){
    const e = { type: 'keydown', key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault(){}, stopPropagation(){}, ...extra };
    tool.handleKey(e);
    return e;
}

const g632 = new Group_WP({ type: '632' }).getGroup();
const ptc = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
const doc = DrawingDocument();
doc.clear();
doc.setOutliner(groupOutliner(g632, ptc));
const editor = DrawingEditor({
    document: doc,
    getContext: () => ({ group: g632, ptc, sprites: false, visLayers: [] }),
    view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
});
editor.setStyleValue('snap', false);
const tool = NodeTool({ editor });
const stroke = { stroke: { rgba: [0, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
const A = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(-0.4, -0.3), node(-0.2, -0.35), node(0, -0.3), node(0.2, -0.35)] });
const B = doc.insertItem({ type: 'path', closed: true, style: stroke, nodes: [node(0.1, 0.1), node(0.3, 0.1), node(0.3, 0.3), node(0.1, 0.3)] });
const C = doc.insertItem({ type: 'polyline', closed: false, style: stroke, points: [-0.4, 0.2, -0.3, 0.3, -0.2, 0.2] });
const selectAll = () => editor.setSelection([A, B, C].map(it => ({ id: it.id, frame: null, frameInv: null })));
const picks = () => editor.getSelectedVertices().map(v => `${v.id === A.id ? 'A' : v.id === B.id ? 'B' : 'C'}${v.vertex}`).join(',');
const pt = (it, v) => { const item = doc.getItem(it.id); return item.nodes ? item.nodes[v].p : [item.points[2*v], item.points[2*v + 1]]; };

// ── the editor's picked vertices ───────────────────────────────────────────
{
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 2 }, { id: A.id, vertex: 1 }, { id: C.id, vertex: 0 }]);
    check(picks() === 'B2,A1,C0' && editor.getSelectedVertex().id === C.id && editor.isVertexPicked(A.id, 1) && !editor.isVertexPicked(A.id, 2),
          'each once, a vertex listed twice keeps its last place, the last is getSelectedVertex');
    editor.setSelectedVertex({ id: A.id, vertex: 0 });
    check(picks() === 'A0', 'setSelectedVertex: that one alone');
    editor.clearSelection();
    check(picks() === '' && editor.getSelectedVertex() === null, 'dropped with the selection');
}

// ── picking ────────────────────────────────────────────────────────────────
{
    selectAll();
    click(tool, [-0.2, -0.35]);
    check(picks() === 'A1', 'a click picks a node');
    click(tool, [0, -0.3], { shiftKey: true });
    check(picks() === 'A1,A2', 'Shift+click adds one');
    click(tool, [0.3, 0.1], { shiftKey: true });
    check(picks() === 'A1,A2,B1', 'Shift+click adds one of another outline');
    click(tool, [-0.2, -0.35], { shiftKey: true });
    check(picks() === 'A2,B1', 'Shift+click on a picked one drops it');
    click(tool, [0, -0.3]);
    check(picks() === 'A2', 'a click on a picked one picks it alone');
    click(tool, [0.2, 0.1]);
    check(picks() === 'B0,B1', 'a click on a segment picks its two nodes');
    click(tool, [-0.35, 0.25], { shiftKey: true });
    check(picks() === 'B0,B1,C0,C1', 'Shift+click on a polyline\'s segment adds its two');
    click(tool, [0.1, 0.2]);
    check(picks() === 'B3,B0', 'the closing segment of a closed path: its last and first');
    // a rubber band from where nothing of the selection is
    drag(tool, [-0.45, -0.45], [0.05, -0.25]);
    check(picks() === 'A0,A1,A2', 'a rubber band picks the nodes inside it');
    drag(tool, [0.25, 0.25], [0.35, 0.35], { shiftKey: true });
    check(picks() === 'A0,A1,A2,B2', 'Shift: the band adds them');
    // the band drawn while it is dragged
    tool.handleEvent(pointer('pointerdown', [0.5, 0.5]));
    tool.handleEvent(pointer('pointermove', [0.6, 0.55]));
    const band = tool.getOverlayGeometry().polylines.filter(pl => pl.closed && pl.dash === 4);
    tool.handleEvent(pointer('pointerup', [0.6, 0.55]));
    check(band.length === 1 && band[0].points.some(q => dist(q, [0.5, 0.5]) < 1e-12) && band[0].points.some(q => dist(q, [0.6, 0.55]) < 1e-12),
          'the band is drawn while it is dragged, corner to corner');
    check(picks() === '', 'a band round nothing picks nothing');
    // Ctrl+A, Tab, Escape
    let e = key(tool, 'a', { ctrlKey: true });
    check(e.isConsumed && editor.getSelectedVertices().length === 11, 'Ctrl+A picks every node of the selected outlines');
    editor.setSelectedVertex({ id: A.id, vertex: 3 });
    e = key(tool, 'Tab');
    check(e.isConsumed && picks() === 'A0', 'Tab: the next node (round to the first)');
    key(tool, 'Tab', { shiftKey: true });
    key(tool, 'Tab', { shiftKey: true });
    check(picks() === 'A2', 'Shift+Tab: the previous ones');
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 1 }]);
    key(tool, 'Escape');
    check(picks() === '' && editor.getSelection().length === 3, 'Escape drops the nodes first, the selection stays');
    editor.clearSelection();
    key(tool, 'a', { ctrlKey: true });
    check(editor.getSelection().length === 3 && picks() === '', 'Ctrl+A with nothing selected selects all');
}

// ── moving ─────────────────────────────────────────────────────────────────
{
    selectAll();
    const a1 = pt(A, 1), b0 = pt(B, 0), c1 = pt(C, 1), a2 = pt(A, 2);
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 0 }, { id: C.id, vertex: 1 }]);
    drag(tool, a1, [a1[0] + 0.05, a1[1] + 0.02]);
    const moved = (it, v, was, d) => dist(pt(it, v), [was[0] + d[0], was[1] + d[1]]) < 1e-12;
    check(moved(A, 1, a1, [0.05, 0.02]) && moved(B, 0, b0, [0.05, 0.02]) && moved(C, 1, c1, [0.05, 0.02]) && dist(pt(A, 2), a2) === 0,
          'a drag moves every picked node by as much, the others stay');
    check(picks() === 'A1,B0,C1' || picks() === 'B0,C1,A1', 'the picked nodes stay picked');
    editor.undo();
    check(dist(pt(A, 1), a1) === 0 && dist(pt(B, 0), b0) === 0 && dist(pt(C, 1), c1) === 0, 'one undo step brings them all back');
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 0 }]);
    drag(tool, a1, [a1[0] + 0.05, a1[1] + 0.01], { ctrlKey: true });
    check(moved(A, 1, a1, [0.05, 0]) && moved(B, 0, b0, [0.05, 0]), 'Ctrl: horizontally only');
    editor.undo();
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 0 }]);
    drag(tool, a2, [a2[0], a2[1] + 0.05]);
    check(moved(A, 2, a2, [0, 0.05]) && dist(pt(A, 1), a1) === 0 && dist(pt(B, 0), b0) === 0 && picks() === 'A2', 'a drag of a node not picked moves it alone');
    editor.undo();
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 0 }]);
    key(tool, 'ArrowRight');
    key(tool, 'ArrowUp', { shiftKey: true });
    check(moved(A, 1, a1, [0.001, -0.01]) && moved(B, 0, b0, [0.001, -0.01]), 'the arrows nudge them all (Shift: by 10)');
    editor.undo();
    check(dist(pt(A, 1), a1) === 0 && dist(pt(B, 0), b0) === 0, 'a run of nudges: one undo step');

    // X and Y in the bar
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 0 }]);
    const controls = tool.getProperties().flatMap(g => g.controls || [g]);
    const X = controls.find(c => c.kind === 'number' && c.label === 'X'), Y = controls.find(c => c.kind === 'number' && c.label === 'Y');
    const cx = 0.5*(a1[0] + b0[0]), cy = 0.5*(a1[1] + b0[1]);
    check(X && Y && X.visible() && Math.abs(X.get() - cx) < 1e-12 && Math.abs(Y.get() - cy) < 1e-12, 'X and Y: the centre of the box round the picked nodes');
    X.set(cx + 0.1);
    check(moved(A, 1, a1, [0.1, 0]) && moved(B, 0, b0, [0.1, 0]) && Math.abs(X.get() - cx - 0.1) < 1e-12, 'X typed: they all move across');
    Y.set(cy - 0.05);
    check(moved(A, 1, a1, [0.1, -0.05]) && moved(B, 0, b0, [0.1, -0.05]), 'Y typed: up or down');
    editor.undo();
    check(dist(pt(A, 1), a1) === 0 && dist(pt(B, 0), b0) === 0, 'undo: back (the typed moves merge)');
    editor.setSelectedVertex(null);
    check(!X.visible(), 'X and Y hidden without a picked node');
}

// ── types, segments, handles ───────────────────────────────────────────────
{
    selectAll();
    editor.setSelectedVertices([0, 1, 2, 3].map(vertex => ({ id: B.id, vertex })));
    key(tool, 'S', { shiftKey: true });
    const nb = doc.getItem(B.id).nodes;
    check(nb.every(m => nodeType(m) === 'smooth'), 'Shift+S: every picked node smooth');
    const choice = tool.getProperties().flatMap(g => g.controls || [g]).find(c => c.kind === 'iconChoice' && /type of the picked nodes/.test(c.title));
    check(choice.get() === 'smooth', 'the bar shows their shared type');
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: B.id, vertex: 1 }]);
    check(choice.get() === null, 'mixed types: none shown');
    // the handles of every picked node show (B's nodes have handles now)
    editor.setSelectedVertices([{ id: B.id, vertex: 0 }, { id: B.id, vertex: 2 }]);
    const stalks = tool.getOverlayGeometry().points.filter(q => q.kind === 'disc' && q.size === 3.5);
    check(stalks.length === 8, `the handles of both picked nodes and of their neighbours: ${stalks.length}`);
    editor.undo();

    // segments: several picked, those between them; one picked, its two (undo drops the selection)
    selectAll();
    editor.setSelectedVertices([{ id: B.id, vertex: 0 }, { id: B.id, vertex: 1 }, { id: A.id, vertex: 2 }]);
    key(tool, 'U', { shiftKey: true });
    let b = doc.getItem(B.id).nodes, a = doc.getItem(A.id).nodes;
    check(!segmentStraight(b, 0, true) && segmentStraight(b, 1, true) && segmentStraight(b, 3, true) && segmentStraight(a, 1, false) && segmentStraight(a, 2, false),
          'several picked: only the segment between two of them made a curve');
    editor.undo();
    selectAll();
    editor.setSelectedVertices([{ id: B.id, vertex: 2 }]);
    key(tool, 'U', { shiftKey: true });
    b = doc.getItem(B.id).nodes;
    check(!segmentStraight(b, 1, true) && !segmentStraight(b, 2, true) && segmentStraight(b, 0, true), 'one picked: its two segments');
    editor.undo();
}

// ── delete ─────────────────────────────────────────────────────────────────
{
    selectAll();
    editor.setSelectedVertices([{ id: A.id, vertex: 1 }, { id: A.id, vertex: 2 }, { id: C.id, vertex: 1 }]);
    key(tool, 'Delete');
    const a = doc.getItem(A.id), c = doc.getItem(C.id);
    check(a.nodes.length === 2 && dist(a.nodes[0].p, [-0.4, -0.3]) === 0 && dist(a.nodes[1].p, [0.2, -0.35]) === 0 && c.points.length === 4 && picks() === '',
          'Delete removes the picked nodes of both outlines');
    editor.undo();
    check(doc.getItem(A.id).nodes.length === 4 && doc.getItem(C.id).points.length === 6, 'one undo step');
    selectAll();
    editor.setSelectedVertices([0, 1, 2, 3].map(vertex => ({ id: B.id, vertex })));
    key(tool, 'Delete');
    check(doc.getItem(B.id).nodes.length === 2, 'two nodes of an outline stay');
    editor.undo();
}

console.log(failed ? `node_multi: ${failed} FAILED` : 'node_multi: all checks passed');
process.exit(failed ? 1 : 0);
