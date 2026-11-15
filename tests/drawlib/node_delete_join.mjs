/*
  tests of delete keeping the shape, break and join in the node tool
  (lib/drawlib/Paths.js, CurveFit.js, DrawingEditor.js, NodeTool.js;
  docs/node_editing_plan.md 5.5)

    node tests/drawlib/node_delete_join.mjs

  Checked here:
  - CurveFit's fitOneCubic: one cubic through samples, its end tangents kept;
  - nodesRemovedKeepingShape: a circle of eight nodes without every other
    one stays a circle (within 3e-4), without six of them within 2e-2, the
    kept nodes' tangents as they were; a straight run stays straight; a
    removed end of an open path: the new end a corner without its outer
    handle; symmetric and auto nodes kept become smooth; a ring of a
    compound path left with one node goes; a geodesic path keeps its drawn
    outline (in the chart of the run's first node);
  - brokenPaths: a closed path opens at the node (doubled into two corner
    ends), splits at the others; an open one splits at inner nodes only;
  - joinedNodes and closedJoin: merged at the midpoint with each end's
    handle, or by a straight segment; reversed when the ends ask for it;
  - the tool: Delete keeps a path's shape, Ctrl+Delete joins the segments
    as they are, a polyline loses its points, Alt+click keeps the shape;
    Shift+B on a closed and an open path (new items above, selected, the
    ends picked); Shift+J of one path (it closes) and of two (one item, the
    other gone; two polylines stay a polyline), Join with segment; undo and
    redo of each; the menu and the bar.
*/

import { Group_WP } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import {
    nodeType, withType, flattenItem, nodesRemovedKeepingShape, brokenPaths, joinedNodes, closedJoin, reversedNodes,
} from '../../lib/drawlib/Paths.js';
import { fitOneCubic } from '../../lib/drawlib/CurveFit.js';
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
const node = (x, y, extra = {}) => ({ p: [x, y], h1: null, h2: null, ...extra });
/** are a and b the same direction */
const along = (a, b, eps = 1e-9) => Math.abs(cross(unit(a), unit(b))) < eps && dot(a, b) > 0;

/** a circle of radius 1 by n smooth nodes, the handles of the best cubic of each arc */
function circle(n){
    const k = 4/3*Math.tan(Math.PI/(2*n));
    return [...Array(n)].map((_, i) => {
        const a = 2*Math.PI*i/n, p = [Math.cos(a), Math.sin(a)], t = [-Math.sin(a), Math.cos(a)];
        return { p, h1: [p[0] - k*t[0], p[1] - k*t[1]], h2: [p[0] + k*t[0], p[1] + k*t[1]], smooth: true };
    });
}
/** the largest distance of the flattened outline of the nodes from the unit circle */
function radialError(nodes, closed = true){
    const f = flattenItem({ type: 'path', nodes, closed }, 0.001).points;
    let e = 0;
    for (let i = 0; i + 1 < f.length; i += 2) e = Math.max(e, Math.abs(Math.hypot(f[i], f[i + 1]) - 1));
    return e;
}
/** the flat points as pairs */
const pairs = (f) => { const out = []; for (let i = 0; i + 1 < f.length; i += 2) out.push([f[i], f[i + 1]]); return out; };
/** the largest distance of points from a polyline */
function offPolyline(points, line){
    let worst = 0;
    for (const q of points) {
        let best = Infinity;
        for (let k = 0; k + 1 < line.length; k++) {
            const a = line[k], b = line[k + 1], d = sub(b, a), l2 = dot(d, d);
            const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(q, a), d)/l2)) : 0;
            best = Math.min(best, dist(q, [a[0] + t*d[0], a[1] + t*d[1]]));
        }
        worst = Math.max(worst, best);
    }
    return worst;
}

// ── fitOneCubic ────────────────────────────────────────────────────────────
{
    // a quarter of the unit circle
    const pts = [...Array(33)].map((_, j) => { const a = Math.PI/2*j/32; return [Math.cos(a), Math.sin(a)]; });
    const bez = fitOneCubic(pts, [0, 1], [1, 0]);
    check(bez && dist(bez[0], [1, 0]) === 0 && dist(bez[3], [0, 1]) < 1e-15, 'one cubic from the first sample to the last');
    check(along(sub(bez[1], bez[0]), [0, 1]) && along(sub(bez[2], bez[3]), [1, 0]), '... leaving and reaching along the tangents given (the second back into the curve)');
    check(Math.abs(len(sub(bez[1], bez[0])) - 0.5523) < 0.01, '... its handles near the best quarter circle\'s (0.5523)');
    const two = fitOneCubic([[0, 0], [3, 0]], [1, 0], [-1, 0]);
    check(dist(two[1], [1, 0]) < 1e-15 && dist(two[2], [2, 0]) < 1e-15, 'two samples: the handles at the thirds');
}

// ── delete keeping the shape ───────────────────────────────────────────────
{
    const c8 = circle(8);
    const four = nodesRemovedKeepingShape({ type: 'path', nodes: c8, closed: true }, new Set([1, 3, 5, 7]));
    check(four.length === 4 && four.every(m => nodeType(m) === 'smooth'), 'a circle of eight without every other node: four smooth nodes');
    check(radialError(four) < 3e-4, `... still a circle (${radialError(four).toExponential(2)})`);
    check([0, 1, 2, 3].every(k => along(sub(four[k].h2, four[k].p), sub(c8[2*k].h2, c8[2*k].p), 1e-9) && along(sub(four[k].h1, four[k].p), sub(c8[2*k].h1, c8[2*k].p), 1e-9)),
          '... each kept node\'s tangents as they were');
    const two = nodesRemovedKeepingShape({ type: 'path', nodes: c8, closed: true }, new Set([1, 2, 3, 5, 6, 7]));
    check(two.length === 2 && radialError(two) < 2e-2, `without six: two nodes, two half circles (${radialError(two).toExponential(2)})`);
    check(nodesRemovedKeepingShape({ type: 'path', nodes: c8, closed: true }, new Set([0, 1, 2, 3, 4, 5, 6])) === null, 'one left: null');
    check(nodesRemovedKeepingShape({ type: 'path', nodes: c8, closed: true }, new Set()) === c8, 'none removed: the same nodes');

    const line = [node(0, 0), node(1, 0), node(2, 0), node(3, 1)];
    const straight = nodesRemovedKeepingShape({ type: 'path', nodes: line, closed: false }, new Set([1]));
    check(straight.length === 3 && !straight[0].h2 && !straight[1].h1, 'a straight run along one line stays straight');
    const bent = nodesRemovedKeepingShape({ type: 'path', nodes: line, closed: false }, new Set([2]));
    check(bent.length === 3 && !!bent[1].h2 && !!bent[2].h1 && along(sub(bent[1].h2, bent[1].p), [1, 0]) && along(sub(bent[2].h1, bent[2].p), [-1, -1]),
          'a run with a turn: one curve, leaving along the first segment and reaching along the last');
    const smoothEnd = [node(0, 0, { h2: [0.3, 0.3] }), node(1, 0, { h1: [0.7, 0.3], h2: [1.3, -0.3], smooth: true }), node(2, 0, { h1: [1.7, -0.3] })];
    const noFirst = nodesRemovedKeepingShape({ type: 'path', nodes: smoothEnd, closed: false }, new Set([0]));
    check(noFirst.length === 2 && nodeType(noFirst[0]) === 'corner' && noFirst[0].h1 === null && dist(noFirst[0].h2, [1.3, -0.3]) === 0,
          'the first node of an open path removed: the new end a corner without h1, its segment as it was');
    const types = [node(0, 0), node(1, 1, { h1: [0.5, 1], h2: [1.5, 1], smooth: true, symmetric: true }), node(2, 0, { h1: [2, 0.5], h2: [2, -0.5], smooth: true }),
                   node(3, -1, { h1: [2.5, -1], h2: [3.5, -1], smooth: true, auto: true }), node(4, 0)];
    const typed = nodesRemovedKeepingShape({ type: 'path', nodes: types, closed: false }, new Set([2]));
    check(nodeType(typed[1]) === 'smooth' && nodeType(typed[2]) === 'smooth', 'a symmetric and an auto node next to the run: smooth');

    const compound = [node(0, 0), node(1, 0), node(1, 1), node(0, 1, { ringEnd: true }), node(3, 3), node(4, 3), node(4, 4)];
    const oneRing = nodesRemovedKeepingShape({ type: 'path', nodes: compound, closed: true }, new Set([4, 5]));
    check(oneRing.length === 4 && !oneRing.some(m => m.ringEnd), 'a ring of a compound path left with one node goes');
    const both = nodesRemovedKeepingShape({ type: 'path', nodes: compound, closed: true }, new Set([1, 5]));
    check(both.length === 5 && both[2].ringEnd === true && !both[4].ringEnd, '... a node of each ring: two rings, the first ending where it did');
}

// ── a geodesic path keeps its drawn outline ────────────────────────────────
{
    const doc = DrawingDocument();
    doc.clear();
    const UNIT = { kind: 'hyperbolic', c: [0, 0], r: 1 };
    const outliner = geodesicOutliner(UNIT);
    doc.setOutliner(outliner);
    const stroke = { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
    const g = doc.insertItem({ type: 'path', closed: false, geodesic: true, style: stroke,
                               nodes: [node(-0.6, 0.1), node(-0.2, 0.35, { smooth: true, auto: true }), node(0.2, 0.3, { smooth: true, auto: true }), node(0.55, -0.1)] });
    const before = pairs(flattenItem(g, 0.0005).points);
    const nodes = nodesRemovedKeepingShape(g, new Set([1]), outliner);
    const after = doc.updateItem(g.id, { ...g, nodes });
    const now = pairs(flattenItem(after, 0.0005).points);
    const off = offPolyline(now, before);
    // one curve for two: within 8e-3 (a plane path of the same nodes: 4.5e-3)
    check(after.nodes.length === 3 && off < 8e-3, `a geodesic path without a node: its outline where it was (${off.toExponential(2)})`);
    const straightG = doc.insertItem({ type: 'path', closed: false, geodesic: true, style: stroke, nodes: [node(-0.5, 0), node(0, 0), node(0.5, 0)] });
    const sg = nodesRemovedKeepingShape(straightG, new Set([1]), outliner);
    check(sg.length === 2 && !sg[0].h2 && !sg[1].h1, 'a geodesic run on one geodesic: a side without handles');
}

// ── break ──────────────────────────────────────────────────────────────────
{
    const sq = [node(0, 0), node(1, 0, { h1: [0.5, -0.2], h2: [1.2, 0.5], smooth: true }), node(1, 1), node(0, 1)];
    const closed = brokenPaths(sq, true, [1]);
    check(closed.length === 1 && closed[0].nodes.length === 5 && closed[0].startBreak && closed[0].endBreak, 'a closed path broken at a node: one open path of n + 1 nodes');
    const c = closed[0].nodes;
    check(dist(c[0].p, [1, 0]) === 0 && dist(c[4].p, [1, 0]) === 0 && c[0].h1 === null && c[4].h2 === null && dist(c[0].h2, [1.2, 0.5]) === 0 && dist(c[4].h1, [0.5, -0.2]) === 0,
          '... from the node round to it, each end with its own handle');
    check(nodeType(c[0]) === 'corner' && nodeType(c[4]) === 'corner', '... the two ends corners');
    const twice = brokenPaths(sq, true, [3, 1]);
    check(twice.length === 2 && twice[0].nodes.map(m => m.p.join()).join(' ') === '1,0 1,1 0,1' && twice[1].nodes.map(m => m.p.join()).join(' ') === '0,1 0,0 1,0',
          'a closed path broken at two nodes: two paths, from the first break');
    const open = brokenPaths(sq, false, [0, 1, 2]);
    check(open.length === 3 && open.map(o => o.nodes.length).join() === '2,2,2' && !open[0].startBreak && open[0].endBreak && open[2].startBreak && !open[2].endBreak,
          'an open path breaks at its inner nodes only');
    check(brokenPaths(sq, false, [0, 3]).length === 1, '... its ends: no break');
}

// ── join ───────────────────────────────────────────────────────────────────
{
    const a = [node(0, 0), node(1, 0, { h2: [1.3, 0.2] })];
    const b = [node(1.2, 0.1, { h1: [1.0, 0.3], h2: [1.5, 0] }), node(2, 0)];
    const m = joinedNodes(a, 'last', b, 'first', true);
    check(m.nodes.length === 3 && m.at === 1 && dist(m.nodes[1].p, [1.1, 0.05]) < 1e-15, 'two ends merged at their midpoint');
    check(dist(m.nodes[1].h2, [1.4, -0.05]) < 1e-15 && m.nodes[1].h1 === null && nodeType(m.nodes[1]) === 'corner',
          '... the merged node a corner with the outer handles of the two ends, carried along');
    const s = joinedNodes(a, 'last', b, 'first', false);
    check(s.nodes.length === 4 && s.at === 1 && s.nodes[1].h2 === null && s.nodes[2].h1 === null, 'with segment: a straight segment between the ends');
    const r = joinedNodes(a, 'first', b, 'last', true);
    check(r.nodes.map(q => q.p.join()).join(' ') === '1,0 1,0 1.2,0.1' && dist(r.nodes[1].p, [1, 0]) === 0,
          'a\'s first to b\'s last: a reversed, then b reversed');
    check(dist(reversedNodes(b)[1].h2, [1.0, 0.3]) === 0 && dist(reversedNodes(b)[1].h1, [1.5, 0]) === 0 && reversedNodes(b)[0].h1 === null, 'reversed nodes swap their handles');

    const open = [node(0, 0), node(1, 0), node(1, 1), node(0.1, 0.9)];
    const merged = closedJoin(open, true);
    check(merged.length === 3 && dist(merged[0].p, [0.05, 0.45]) < 1e-15, 'one path closed: its ends merged into its first node');
    const seg = closedJoin(open, false);
    check(seg.length === 4 && seg[3].h2 === null && seg[0].h1 === null, '... with segment: the nodes as they are');
    check(closedJoin(open.slice(0, 2), true) === null && closedJoin(open.slice(0, 2), false).length === 2, 'two nodes: merged no, with segment yes');
    check(nodeType(withType(node(0, 0), 'corner')) === 'corner', 'withType corner');
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
    const R = 0.3;
    const ring = circle(8).map(m => ({ ...m, p: [R*m.p[0], R*m.p[1]], h1: [R*m.h1[0], R*m.h1[1]], h2: [R*m.h2[0], R*m.h2[1]] }));
    const select = (...items) => editor.setSelection(items.map(it => ({ id: it.id, frame: null, frameInv: null })));
    const pick = (...list) => editor.setSelectedVertices(list.map(([it, vertex]) => ({ id: it.id, vertex })));
    const picks = (names) => editor.getSelectedVertices().map(v => `${names[v.id] || '?'}${v.vertex}`).join(',');
    const radial = (it) => { const f = pairs(flattenItem(doc.getItem(it.id), 0.0002).points); return Math.max(...f.map(q => Math.abs(len(q) - R))); };
    const order = () => doc.getLayers()[0].getItems().map(it => it.id);

    // Delete keeps the shape, Ctrl+Delete does not
    const O = doc.insertItem({ type: 'path', closed: true, style: stroke, nodes: ring });
    select(O);
    pick([O, 1], [O, 3], [O, 5], [O, 7]);
    key(tool, 'Delete');
    check(doc.getItem(O.id).nodes.length === 4 && radial(O) < R*3e-4, `Delete: four nodes left, the circle kept (${(radial(O)/R).toExponential(2)})`);
    check(editor.getSelectedVertices().length === 0, '... the picked nodes gone');
    editor.undo();
    check(doc.getItem(O.id).nodes.length === 8 && radial(O) < R*1e-4, 'undo: eight nodes again');
    select(O);
    pick([O, 1], [O, 3], [O, 5], [O, 7]);
    key(tool, 'Delete', { ctrlKey: true });
    const plain = doc.getItem(O.id);
    check(plain.nodes.length === 4 && dist(plain.nodes[0].h2, ring[0].h2) < 1e-15 && radial(O) > R*0.05, 'Ctrl+Delete: the segments joined as they are (the handles stay)');
    editor.undo();

    // Alt+click keeps the shape; Ctrl+Alt+click does not
    select(O);
    click(tool, ring[2].p, { altKey: true });
    check(doc.getItem(O.id).nodes.length === 7 && radial(O) < R*1e-3, 'Alt+click removes the node, the shape kept');
    editor.undo();
    select(O);
    click(tool, ring[2].p, { altKey: true, ctrlKey: true });
    check(doc.getItem(O.id).nodes.length === 7 && dist(doc.getItem(O.id).nodes[1].h2, ring[1].h2) < 1e-15, 'Ctrl+Alt+click: as it is');
    editor.undo();

    // a polyline: its points go
    const L = doc.insertItem({ type: 'polyline', closed: false, style: stroke, points: [-0.4, 0.5, -0.3, 0.6, -0.2, 0.5, -0.1, 0.6] });
    select(L);
    pick([L, 1]);
    key(tool, 'Delete');
    check(doc.getItem(L.id).points.join() === '-0.4,0.5,-0.2,0.5,-0.1,0.6', 'a polyline: Delete removes its point');
    editor.undo();

    // break a closed path at a node
    const names = { [O.id]: 'O', [L.id]: 'L' };
    select(O);
    pick([O, 2]);
    check(key(tool, 'B', { shiftKey: true }).isConsumed, 'Shift+B taken');
    let it = doc.getItem(O.id);
    check(!it.closed && it.nodes.length === 9 && dist(it.nodes[0].p, ring[2].p) < 1e-15 && dist(it.nodes[8].p, ring[2].p) < 1e-15,
          'Shift+B on a closed path: open at the node, n + 1 nodes');
    check(picks(names) === 'O0,O8' && radial(O) < R*1e-4, '... its two ends picked, the outline as it was');
    editor.undo();
    check(doc.getItem(O.id).closed && doc.getItem(O.id).nodes.length === 8, 'undo: closed again');

    // break an open path at two inner nodes: new items above it
    const P = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(-0.5, -0.5), node(-0.4, -0.5), node(-0.3, -0.5), node(-0.2, -0.5), node(-0.1, -0.5)] });
    names[P.id] = 'P';
    const top = doc.insertItem({ type: 'path', closed: false, style: stroke, nodes: [node(0.5, 0.5), node(0.6, 0.6)] });
    select(P);
    pick([P, 1], [P, 3]);
    key(tool, 'B', { shiftKey: true });
    const ids = order();
    const at = ids.indexOf(P.id);
    const p1 = doc.getItem(ids[at + 1]), p2 = doc.getItem(ids[at + 2]);
    check(doc.getItem(P.id).nodes.length === 2 && p1 && p2 && p1.nodes.length === 3 && p2.nodes.length === 2 && ids[at + 3] === top.id,
          'Shift+B on an open path at two nodes: three paths, the new ones just above it in order');
    check(dist(p1.nodes[0].p, [-0.4, -0.5]) < 1e-15 && dist(p2.nodes[1].p, [-0.1, -0.5]) < 1e-15 && p1.style.strokeWidth === 0.01 && !p1.closed,
          '... each the part it was, with its style');
    check(editor.getSelection().map(s => s.id).join() === [P.id, p1.id, p2.id].join(), '... all three selected, in their order');
    names[p1.id] = 'p'; names[p2.id] = 'q';
    check(picks(names) === 'P1,p0,p2,q0', '... the ends made picked');
    editor.undo();
    check(order().join() === [O.id, L.id, P.id, top.id].join() && doc.getItem(P.id).nodes.length === 5, 'undo: one path again, the new ones gone');
    editor.redo();
    check(order().length === 6 && doc.getItem(P.id).nodes.length === 2, 'redo: three again');
    editor.undo();

    // join the two ends of one path
    select(P);
    pick([P, 0], [P, 4]);
    check(key(tool, 'J', { shiftKey: true }).isConsumed, 'Shift+J taken');
    it = doc.getItem(P.id);
    check(it.closed && it.nodes.length === 4 && dist(it.nodes[0].p, [-0.3, -0.5]) < 1e-15, 'Shift+J on the two ends of a path: closed, merged at their midpoint');
    check(picks(names) === 'P0', '... the merged node picked');
    editor.undo();
    select(P);
    pick([P, 0], [P, 4]);
    const menu = tool.getContextMenu({ wpnt: null });
    const labels = menu.map(m => m.label || '-');
    check(['Break  Shift+B', 'Join  Shift+J', 'Join with segment', 'Remove nodes as they are  Ctrl+Delete'].every(l => labels.includes(l)), 'the menu has Break, Join, Join with segment, Remove as they are');
    menu.find(m => m.label === 'Join with segment').action();
    it = doc.getItem(P.id);
    check(it.closed && it.nodes.length === 5 && picks(names) === 'P4,P0', 'Join with segment: closed by a straight segment, the ends picked');
    editor.undo();

    // join two paths
    const Q = doc.insertItem({ type: 'path', closed: false, style: { ...stroke, strokeWidth: 0.02 }, nodes: [node(0.1, -0.5, { h2: [0.15, -0.6] }), node(0.3, -0.5)] });
    names[Q.id] = 'Q';
    select(P, Q);
    pick([P, 4], [Q, 0]);
    const bar = tool.getProperties().flatMap(g => g.controls || []);
    const joinButton = bar.find(c => c.icon && c.title && c.title.startsWith('Join (Shift+J)'));
    check(!!joinButton && joinButton.enabled() && bar.some(c => c.title && c.title.startsWith('Break (Shift+B)')) && bar.some(c => c.title && c.title.startsWith('Join with segment')),
          'the bar has Break, Join and Join with segment');
    joinButton.action();
    it = doc.getItem(P.id);
    check(it.nodes.length === 6 && !doc.getItem(Q.id) && it.style.strokeWidth === 0.01 && dist(it.nodes[4].p, [0, -0.5]) < 1e-15 && dist(it.nodes[4].h2, [0.05, -0.6]) < 1e-15,
          'Join of two paths: one path (the first picked\'s style), the other gone, merged at the midpoint, its handle carried along');
    check(picks(names) === 'P4' && editor.getSelection().map(s => s.id).join() === P.id, '... the merged node picked, the other no longer selected');
    editor.undo();
    check(doc.getItem(Q.id) && doc.getItem(P.id).nodes.length === 5 && order().join() === [O.id, L.id, P.id, top.id, Q.id].join(), 'undo: both again, in their places');
    editor.redo();
    check(!doc.getItem(Q.id) && doc.getItem(P.id).nodes.length === 6, 'redo: one again');
    editor.undo();
    // the first end of one to the first end of the other
    select(P, Q);
    pick([P, 0], [Q, 0]);
    tool.getContextMenu({ wpnt: null }).find(m => m.label === 'Join with segment').action();
    it = doc.getItem(P.id);
    check(it.nodes.length === 7 && it.nodes.map(m => m.p[0].toFixed(1)).join() === '-0.1,-0.2,-0.3,-0.4,-0.5,0.1,0.3', 'first ends joined with a segment: the first path reversed, then the other');
    editor.undo();
    // two polylines stay a polyline
    const M = doc.insertItem({ type: 'polyline', closed: false, style: stroke, points: [0.2, 0.6, 0.0, 0.7] });
    names[M.id] = 'M';
    select(L, M);
    pick([L, 3], [M, 1]);
    key(tool, 'J', { shiftKey: true });
    it = doc.getItem(L.id);
    check(it.type === 'polyline' && !it.nodes && it.points.map(v => +v.toFixed(3)).join() === '-0.4,0.5,-0.3,0.6,-0.2,0.5,-0.05,0.65,0.2,0.6' && !doc.getItem(M.id),
          'two polylines joined: a polyline');
    editor.undo();
    // cannot: an inner node, three picked, a tile
    select(P, Q);
    pick([P, 2], [Q, 0]);
    check(tool.getContextMenu({ wpnt: null }).find(m => m.label === 'Join  Shift+J').disabled === true, 'an inner node: no join');
    pick([P, 0], [P, 4], [Q, 0]);
    check(tool.getContextMenu({ wpnt: null }).find(m => m.label === 'Join  Shift+J').disabled === true, 'three picked: no join');
    pick([P, 0]);
    check(tool.getContextMenu({ wpnt: null }).find(m => m.label === 'Break  Shift+B').disabled === true, 'the end of an open path: no break');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
if (failed) process.exitCode = 1;
