/*
  tests of the node types: corner, smooth, symmetric, auto (Inkscape's)
  (lib/drawlib/Paths.js, DrawingDocument.js, NodeTool.js; docs/node_editing_plan.md 5.2)

    node tests/drawlib/node_types.mjs

  Checked here:
  - the flags of a type (symmetric and auto come with smooth), the cycle of
    Ctrl+click;
  - auto handles: across the angle at the node (perpendicular to its
    bisector), each a third of the way to its neighbour; none at the ends of
    an open path;
  - Inkscape's rules for a node made smooth: both handles retracted, the
    auto handles; one retracted next to a straight segment, the other turned
    in line with it; next to a curved one, the missing one opposite the
    other, a third of the way to its neighbour; both out, in line with their
    lengths; symmetric, their mean length (a missing one the mirror); a
    corner keeps its handles; the ends of an open path stay corners;
  - the edits of handles: a symmetric node mirrors the dragged handle, an
    auto node becomes smooth (dragged, linked, retracted, its segment a
    line), Alt a corner, pulled handles keep a symmetric node symmetric;
  - auto handles follow the neighbours: withAutoHandles, withNodes, the
    document (an inserted and an updated item, the flags kept; a loaded
    one as saved, its auto handles made before);
    on a geodesic path in the chart of the node (the hyperbolic plane): the
    handles on one geodesic, a third of the chart's way to the neighbours;
    the translation's chart gives the plane's;
  - the node tool: Shift+C, S, Y, A taken before the palette, Ctrl+click
    cycles, the double click toggles corner and smooth, an end stays a
    corner, a polyline becomes a path, undo, the bar's choice and the menu,
    the marks (a square, a disc, a diamond, a disc with a dot).
*/

import { Group_WP } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import {
    NODE_TYPES, nodeType, withType, isEndNode, autoHandles, withAutoHandles, nodeTypeSet, nextNodeType, nodeSmoothToggled,
    handleMoved, handleLinkedMoved, handleRetracted, segmentsStraight, nodeHandlesPulled, nodeMoved, withNodes,
} from '../../lib/drawlib/Paths.js';
import { geodesicOutliner, groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const cross = (a, b) => a[0]*b[1] - a[1]*b[0];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1];
const unit = (v) => { const l = len(v); return [v[0]/l, v[1]/l]; };
/** are the handles of node n in line through it, on opposite sides */
const inLine = (n, eps = 1e-12) => !!n.h1 && !!n.h2 && Math.abs(cross(unit(sub(n.h1, n.p)), unit(sub(n.h2, n.p)))) < eps && dot(sub(n.h1, n.p), sub(n.h2, n.p)) < 0;
const node = (x, y, extra = {}) => ({ p: [x, y], h1: null, h2: null, ...extra });
const translationChart = (p) => ({ to: q => [q[0] - p[0], q[1] - p[1]], from: q => [q[0] + p[0], q[1] + p[1]] });

// ── types and flags ────────────────────────────────────────────────────────
{
    check(NODE_TYPES.join() === 'corner,smooth,symmetric,auto', 'four types');
    check(nodeType(node(0, 0)) === 'corner' && nodeType(node(0, 0, { smooth: true })) === 'smooth'
          && nodeType(node(0, 0, { smooth: true, symmetric: true })) === 'symmetric' && nodeType(node(0, 0, { smooth: true, auto: true })) === 'auto',
          'the type read from the flags');
    const s = withType(node(0, 0, { auto: true, smooth: true, ringEnd: true }), 'symmetric');
    check(s.smooth === true && s.symmetric === true && !('auto' in s) && s.ringEnd === true, 'symmetric comes with smooth, the other flags stay');
    const c = withType(s, 'corner');
    check(c.smooth === false && !('symmetric' in c) && !('auto' in c), 'a corner: smooth false, no other type flag');
    check(nextNodeType('corner') === 'smooth' && nextNodeType('smooth') === 'symmetric' && nextNodeType('symmetric') === 'auto' && nextNodeType('auto') === 'corner',
          'Ctrl+click cycles corner, smooth, symmetric, auto');
}

// ── auto handles ───────────────────────────────────────────────────────────
{
    // the node at the origin, its neighbours at (-3, 0) and (0, 6)
    const nodes = [node(-3, 0), node(0, 0), node(0, 6)];
    const h = autoHandles(nodes, 1, false);
    const ua = unit(sub(nodes[0].p, nodes[1].p)), ub = unit(sub(nodes[2].p, nodes[1].p));
    check(Math.abs(len(h.h1) - 1) < 1e-12 && Math.abs(len(h.h2) - 2) < 1e-12, 'each a third of the way to its neighbour');
    check(Math.abs(dot(h.h2, [ua[0] + ub[0], ua[1] + ub[1]])) < 1e-12 && inLine({ p: [0, 0], ...h }), 'in line, across the bisector of the angle');
    check(dot(h.h1, ua) > 0 && dot(h.h2, ub) > 0, 'h1 towards the node before, h2 towards the one after');
    const ends = autoHandles(nodes, 0, false);
    check(ends.h1 === null && ends.h2 === null && isEndNode(nodes, 0, false) && !isEndNode(nodes, 0, true), 'an end of an open path has none');
    // closed: the end has both neighbours
    check(!!autoHandles(nodes, 0, true).h1, 'on a closed path the first node has its auto handles');
    // a straight run: the handles along it
    const run = [node(0, 0), node(2, 0), node(5, 0)];
    const r = autoHandles(run, 1, false);
    check(dist(r.h1, [2 - 2/3, 0]) < 1e-12 && dist(r.h2, [3, 0]) < 1e-12, 'on a straight run the handles along it');
    // the translation's chart: the plane's
    const t = autoHandles(nodes, 1, false, translationChart);
    check(dist(t.h1, h.h1) < 1e-15 && dist(t.h2, h.h2) < 1e-15, 'the translation\'s chart gives the plane\'s');
}

// ── Inkscape's rules ───────────────────────────────────────────────────────
{
    // a closed square of corners, curved where asked
    const square = () => [node(0, 0), node(4, 0), node(4, 4), node(0, 4)];
    // both retracted: smooth takes the auto handles, without the auto flag
    let n = nodeTypeSet(square(), 1, 'smooth', true);
    const a = autoHandles(square(), 1, true);
    check(n[1].smooth === true && !n[1].auto && dist(n[1].h1, a.h1) < 1e-12 && dist(n[1].h2, a.h2) < 1e-12, 'smooth, both retracted: the auto handles');
    // one retracted next to a straight segment: the other turned in line with it
    let sq = square();
    sq[1] = { ...sq[1], h2: [5, 2] };             // the segment from 0 to 1 straight (0 has no h2, 1 no h1)
    n = nodeTypeSet(sq, 1, 'smooth', true);
    check(n[1].h1 === null && Math.abs(n[1].h2[1]) < 1e-12 && Math.abs(len(sub(n[1].h2, n[1].p)) - Math.hypot(1, 2)) < 1e-12 && n[1].h2[0] > 4,
          'smooth, one retracted beside a straight segment: the other along that segment, its length kept');
    // one retracted next to a curved segment: the missing one opposite the other, a third of the way to its neighbour
    sq = square();
    sq[1] = { ...sq[1], h2: [5, 2] };
    sq[0] = { ...sq[0], h2: [1, -1] };            // the segment from 0 to 1 curved
    n = nodeTypeSet(sq, 1, 'smooth', true);
    check(inLine(n[1]) && Math.abs(len(sub(n[1].h1, n[1].p)) - 4/3) < 1e-12 && dist(n[1].h2, [5, 2]) < 1e-15,
          'smooth, one retracted beside a curved segment: drawn out opposite the other, a third of the way');
    // both out: in line along h1 -> h2, their lengths kept
    sq = square();
    sq[1] = { ...sq[1], h1: [3, 1], h2: [5, 2] };
    n = nodeTypeSet(sq, 1, 'smooth', true);
    check(inLine(n[1]) && Math.abs(len(sub(n[1].h1, n[1].p)) - Math.SQRT2) < 1e-12 && Math.abs(len(sub(n[1].h2, n[1].p)) - Math.hypot(1, 2)) < 1e-12,
          'smooth, both out: in line, their lengths kept');
    // symmetric: their mean length
    n = nodeTypeSet(sq, 1, 'symmetric', true);
    const mean = 0.5*(Math.SQRT2 + Math.hypot(1, 2));
    check(n[1].symmetric && n[1].smooth && inLine(n[1]) && Math.abs(len(sub(n[1].h1, n[1].p)) - mean) < 1e-12 && Math.abs(len(sub(n[1].h2, n[1].p)) - mean) < 1e-12,
          'symmetric: in line, both their mean length');
    // symmetric with one handle: the mirror of it
    sq = square();
    sq[1] = { ...sq[1], h2: [5, 2] };
    sq[0] = { ...sq[0], h2: [1, -1] };
    n = nodeTypeSet(sq, 1, 'symmetric', true);
    check(dist(n[1].h1, [3, -2]) < 1e-12 && dist(n[1].h2, [5, 2]) < 1e-12, 'symmetric with one handle out: the other its mirror');
    // auto
    n = nodeTypeSet(sq, 1, 'auto', true);
    const aa = autoHandles(sq, 1, true);
    check(n[1].auto && n[1].smooth && dist(n[1].h1, aa.h1) < 1e-15 && dist(n[1].h2, aa.h2) < 1e-15, 'auto: the auto handles, the flag');
    // a corner keeps its handles
    const back = nodeTypeSet(n, 1, 'corner', true);
    check(nodeType(back[1]) === 'corner' && dist(back[1].h1, n[1].h1) === 0 && dist(back[1].h2, n[1].h2) === 0, 'a corner keeps its handles');
    // the ends of an open path stay corners
    const open = square();
    check(nodeTypeSet(open, 0, 'smooth', false) === open && nodeTypeSet(open, 3, 'auto', false) === open
          && nodeTypeSet(open, 0, 'symmetric', false) === open, 'the ends of an open path stay corners');
    const endSmooth = open.map((m, k) => k === 0 ? { ...m, smooth: true } : m);
    check(nodeType(nodeTypeSet(endSmooth, 0, 'corner', false)[0]) === 'corner', 'a smooth end can be made a corner');
    // the translation's chart gives the plane's
    const ct = nodeTypeSet(sq, 1, 'symmetric', true, translationChart);
    const pl = nodeTypeSet(sq, 1, 'symmetric', true);
    check(dist(ct[1].h1, pl[1].h1) < 1e-12 && dist(ct[1].h2, pl[1].h2) < 1e-12 && ct[1].symmetric, 'nodeTypeSet in the translation\'s chart: the plane\'s');
    // the old toggle: a corner smooth, any smooth type a corner
    check(nodeType(nodeSmoothToggled(square(), 1, true)[1]) === 'smooth' && nodeType(nodeSmoothToggled(n, 1, true)[1]) === 'corner'
          && nodeType(nodeSmoothToggled(nodeTypeSet(sq, 1, 'symmetric', true), 1, true)[1]) === 'corner', 'the smooth toggle: corner to smooth, the others to corner');
}

// ── the edits of handles ───────────────────────────────────────────────────
{
    const base = () => [node(0, 0), node(4, 0, { h1: [3, -1], h2: [6, 2] }), node(8, 0)];
    const sym = nodeTypeSet(base(), 1, 'symmetric', false);
    let n = handleMoved(sym, 1, 'h2', [7, 1], true);
    check(nodeType(n[1]) === 'symmetric' && dist(n[1].h1, [1, -1]) < 1e-12, 'a symmetric node: the other handle the mirror of the dragged one');
    n = handleMoved(sym, 1, 'h2', [7, 1], false);
    check(nodeType(n[1]) === 'corner' && dist(n[1].h1, sym[1].h1) === 0, 'Alt: a corner, the other handle stays');
    const auto = nodeTypeSet(base(), 1, 'auto', false);
    n = handleMoved(auto, 1, 'h2', [7, 3], true);
    const l1 = len(sub(auto[1].h1, auto[1].p));
    check(nodeType(n[1]) === 'smooth' && inLine(n[1]) && Math.abs(len(sub(n[1].h1, n[1].p)) - l1) < 1e-12, 'a dragged auto handle: the node smooth, the other in line, its length kept');
    n = handleLinkedMoved(auto, 1, 'h2', [7, 3]);
    check(nodeType(n[1]) === 'smooth' && dist(n[1].h1, [1, -3]) < 1e-12, 'a linked drag of an auto handle: smooth, the other its mirror');
    n = handleRetracted(auto, 1, 'h1');
    check(nodeType(n[1]) === 'smooth' && n[1].h1 === null, 'a retracted handle of an auto node: smooth');
    n = handleRetracted(sym, 1, 'h1');
    check(nodeType(n[1]) === 'smooth', 'a retracted handle of a symmetric node: smooth');
    n = segmentsStraight(auto, false, [0]);
    check(nodeType(n[1]) === 'smooth' && n[1].h1 === null && n[1].h2 !== null, 'a line next to an auto node: smooth');
    n = nodeHandlesPulled(sym, 1, [5, 1]);
    check(nodeType(n[1]) === 'symmetric' && dist(n[1].h1, [3, -1]) < 1e-12, 'handles pulled out of a symmetric node: it stays symmetric');
    n = nodeHandlesPulled(auto, 1, [5, 1]);
    check(nodeType(n[1]) === 'smooth', 'handles pulled out of an auto node: smooth');
}

// ── auto handles follow the neighbours ─────────────────────────────────────
{
    const plain = [node(0, 0), node(4, 0), node(8, 0)];
    check(withAutoHandles(plain, false) === plain, 'no auto node: the same nodes');
    const auto = nodeTypeSet(plain, 1, 'auto', false);
    const moved = nodeMoved(auto, 2, [4, 6]);
    const follow = withAutoHandles(moved, false);
    const h = autoHandles(moved, 1, false);
    check(dist(follow[1].h1, h.h1) < 1e-15 && dist(follow[1].h2, h.h2) < 1e-15 && dist(follow[1].h2, moved[1].h2) > 0.1, 'a moved neighbour: the auto handles made again');
    const item = withNodes({ type: 'path', closed: false }, moved);
    check(dist(item.nodes[1].h2, h.h2) < 1e-15, 'withNodes makes them again');
    const geo = withNodes({ type: 'path', closed: false, geodesic: true }, moved);
    check(dist(geo.nodes[1].h2, moved[1].h2) === 0, 'a geodesic path\'s are left to the document (it has the chart)');

    // the document: inserted, updated, saved and loaded
    const doc = DrawingDocument();
    doc.clear();
    const stroke = { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
    const it = doc.insertItem({ type: 'path', closed: false, style: stroke,
                                nodes: [node(0, 0), node(0.4, 0, { smooth: true, auto: true, h1: [9, 9], h2: [9, 9] }), node(0.4, 0.6, { smooth: true, symmetric: true })] });
    const want = autoHandles(it.nodes, 1, false);
    check(it.nodes[1].auto && it.nodes[1].smooth && dist(it.nodes[1].h1, want.h1) < 1e-15 && it.nodes[2].symmetric && it.nodes[2].smooth,
          'an inserted item: its auto handles made, the flags kept');
    const up = doc.updateItem(it.id, withNodes(it, nodeMoved(it.nodes, 0, [-0.2, 0.3])));
    const want2 = autoHandles(up.nodes, 1, false);
    check(dist(up.nodes[1].h1, want2.h1) < 1e-15 && dist(up.nodes[1].h1, want.h1) > 1e-3, 'an updated item: the auto handles follow');
    const layer = doc.getLayers()[0];
    const saved = layer.getParams().items.getValue();
    const s = saved.find(x => x.id === it.id);
    check(s.nodes[1].auto === true && s.nodes[2].symmetric === true, 'the saved item carries the types');
    layer.getParams().items.setValue(saved);
    const loaded = doc.getItem(it.id);
    check(loaded.nodes[1].auto === true && dist(loaded.nodes[1].h1, want2.h1) < 1e-15, 'a loaded item: its types, its auto handles as saved');

    // a geodesic path in the hyperbolic plane: in the chart of the node
    const UNIT = { kind: 'hyperbolic', c: [0, 0], r: 1 };
    const outliner = geodesicOutliner(UNIT);
    doc.setOutliner(outliner);
    const g = doc.insertItem({ type: 'path', closed: false, geodesic: true, style: stroke,
                               nodes: [node(-0.6, 0.1), node(0.3, 0.2, { smooth: true, auto: true }), node(0.5, -0.5)] });
    const c = outliner.chart(g.nodes[1].p);
    const v1 = c.to(g.nodes[1].h1), v2 = c.to(g.nodes[1].h2), a = c.to(g.nodes[0].p), b = c.to(g.nodes[2].p);
    check(Math.abs(cross(unit(v1), unit(v2))) < 1e-9 && dot(v1, v2) < 0, 'a geodesic auto node: its handles on one geodesic (in line in its chart)');
    check(Math.abs(len(v1) - len(a)/3) < 1e-9 && Math.abs(len(v2) - len(b)/3) < 1e-9, '... each a third of the chart\'s way to its neighbour');
    check(Math.abs(dot(unit(v2), [unit(a)[0] + unit(b)[0], unit(a)[1] + unit(b)[1]])) < 1e-9, '... across the bisector of the angle there');
    const plane = autoHandles(g.nodes, 1, false);
    check(dist(plane.h2, g.nodes[1].h2) > 1e-4, '... not the plane\'s');
}

// ── the node tool ──────────────────────────────────────────────────────────
const PX = 1000;     // canvas pixels a world unit, as the view's pixel size 0.001 has it
function pointer(type, w, extra = {}){
    return { type, wpnt: w, canvasX: PX*w[0], canvasY: PX*w[1], offsetX: PX*w[0], offsetY: PX*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1,
             preventDefault(){}, ...extra };
}
function click(tool, w, extra = {}){
    tool.handleEvent(pointer('pointerdown', w, extra));
    tool.handleEvent(pointer('pointerup', w, extra));
}
function key(tool, k, extra = {}){
    const e = { type: 'keydown', key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault(){}, stopPropagation(){}, ...extra };
    tool.handleKey(e);
    return e;
}
{
    const g632 = new Group_WP({ type: '632' }).getGroup();
    const doc = DrawingDocument();
    doc.clear();
    doc.setOutliner(groupOutliner(g632, { centerX: 0, centerY: 0, scale: 1, angle: 0 }));
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group: g632, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
    });
    editor.setStyleValue('snap', false);
    const tool = NodeTool({ editor });
    const stroke = { stroke: { rgba: [0, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
    const it = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(-0.3, 0), node(0, 0.1, { h1: [-0.1, 0.05] }), node(0.3, 0)] });
    editor.setSelection([{ id: it.id, frame: null, frameInv: null }]);
    editor.setSelectedVertex({ id: it.id, vertex: 1 });
    const typeOf = (v = 1) => nodeType(doc.getItem(it.id).nodes[v]);

    let e = key(tool, 'S', { shiftKey: true });
    check(e.isConsumed && typeOf() === 'smooth', 'Shift+S: smooth, the key taken (not the palette\'s)');
    e = key(tool, 'Y', { shiftKey: true });
    check(e.isConsumed && typeOf() === 'symmetric', 'Shift+Y: symmetric');
    e = key(tool, 'A', { shiftKey: true });
    check(e.isConsumed && typeOf() === 'auto' && dist(doc.getItem(it.id).nodes[1].h2, autoHandles(doc.getItem(it.id).nodes, 1, false).h2) < 1e-15, 'Shift+A: auto');
    e = key(tool, 'C', { shiftKey: true });
    check(e.isConsumed && typeOf() === 'corner', 'Shift+C: a corner');
    e = key(tool, 's');
    check(!e.isConsumed && typeOf() === 'corner', 'S without Shift is left to the palette');
    editor.undo();
    check(typeOf() === 'auto', 'undo: the type before');
    editor.undo(); editor.undo(); editor.undo();
    check(typeOf() === 'corner', 'undo to the start');

    // Ctrl+click on the node cycles its type (undo may have changed the selection)
    editor.setSelection([{ id: it.id, frame: null, frameInv: null }]);
    editor.setSelectedVertex(null);
    const seen = [];
    for (let k = 0; k < 4; k++) { click(tool, [0, 0.1], { ctrlKey: true }); seen.push(typeOf()); }
    check(seen.join() === 'smooth,symmetric,auto,corner', `Ctrl+click cycles: ${seen.join(', ')}`);
    check(editor.getSelectedVertex() && editor.getSelectedVertex().vertex === 1, 'the clicked node picked');
    // the double click: corner and smooth
    tool.handleEvent(pointer('dblclick', [0, 0.1]));
    check(typeOf() === 'smooth', 'a double click on a corner: smooth');
    key(tool, 'Y', { shiftKey: true });
    tool.handleEvent(pointer('dblclick', [0, 0.1]));
    check(typeOf() === 'corner', 'a double click on a symmetric node: a corner');
    // an end stays a corner
    editor.setSelectedVertex({ id: it.id, vertex: 0 });
    key(tool, 'S', { shiftKey: true });
    click(tool, [-0.3, 0], { ctrlKey: true });
    check(typeOf(0) === 'corner', 'an end of an open path stays a corner (Shift+S, Ctrl+click)');

    // the bar's choice and the menu
    const choice = tool.getProperties().flatMap(g => g.controls || [g]).find(c => c.kind === 'iconChoice' && /type of the picked node/.test(c.title));
    check(!!choice && choice.options.map(o => o.value).join() === 'corner,smooth,symmetric,auto' && choice.enabled() === false && choice.get() === 'corner',
          'the bar\'s choice: four types, off on an end');
    editor.setSelectedVertex({ id: it.id, vertex: 1 });
    choice.set('symmetric');
    check(choice.enabled() && choice.get() === 'symmetric' && typeOf() === 'symmetric', 'the bar\'s choice sets the type');
    const menu = tool.getContextMenu({});
    const sym = menu.find(m => m.label && m.label.startsWith('Symmetric'));
    check(!!sym && sym.checked === true && menu.filter(m => typeof m.checked === 'boolean' && /Shift\+[CSYA]$/.test(m.label)).length === 4, 'the menu: the four types, the node\'s checked');
    menu.find(m => m.label.startsWith('Auto')).action();
    check(typeOf() === 'auto', 'the menu sets the type');

    // the marks
    key(tool, 'S', { shiftKey: true });
    const it2 = doc.getItem(it.id);
    const n2 = doc.insertItem({ type: 'path', closed: true, style: stroke,
                                nodes: [node(0.5, 0.5), node(0.7, 0.5, { smooth: true, symmetric: true, h1: [0.65, 0.45], h2: [0.75, 0.55] }),
                                        node(0.7, 0.7, { smooth: true, auto: true }), node(0.5, 0.7, { smooth: true, h1: [0.55, 0.75], h2: [0.45, 0.65] })] });
    editor.setSelection([{ id: it2.id, frame: null, frameInv: null }, { id: n2.id, frame: null, frameInv: null }]);
    editor.setSelectedVertex(null);
    const pts = tool.getOverlayGeometry().points;
    const at = (w) => pts.filter(q => dist(q.p, w) < 1e-12);
    const kinds = (w) => at(w).map(q => q.kind).join();
    check(kinds([0.5, 0.5]) === 'square' && kinds([0.7, 0.5]) === 'diamond' && kinds([0.5, 0.7]) === 'disc', 'the marks: a corner a square, symmetric a diamond, smooth a disc');
    check(kinds([0.7, 0.7]) === 'disc,disc' && at([0.7, 0.7])[1].size < at([0.7, 0.7])[0].size, 'auto: a disc with a dot');

    // a polyline's vertex: the path it becomes
    const pl = doc.insertItem({ type: 'polyline', closed: false, style: stroke, points: [-0.3, -0.3, 0, -0.2, 0.3, -0.3] });
    editor.setSelection([{ id: pl.id, frame: null, frameInv: null }]);
    editor.setSelectedVertex({ id: pl.id, vertex: 1 });
    key(tool, 'A', { shiftKey: true });
    const pa = doc.getItem(pl.id);
    check(pa.type === 'path' && nodeType(pa.nodes[1]) === 'auto' && inLine(pa.nodes[1]), 'Shift+A on a polyline\'s vertex: a path, the node auto');
}

console.log(failed ? `node_types: ${failed} FAILED` : 'node_types: all checks passed');
process.exit(failed ? 1 : 0);
