/*
  tests of the ellipse's arcs, circles and drawing from the centre
  (lib/drawlib/Shapes.js, ShapeHandles.js, ShapeTool.js; docs/node_editing_plan.md 5.6)

    node tests/drawlib/ellipse_arcs.mjs

  Checked here:
  - the numbers: start and end wrapped into [0, 2 pi), dropped when equal
    (the whole ellipse), one given alone with the other 0, the type kept
    unless it is the default slice, nothing of it on other kinds;
  - a whole ellipse comes out node for node as before;
  - an arc: its pieces of at most a quarter turn, its ends at the start and
    end parameters, its points on the ellipse (as close as the whole
    ellipse's four cubics: 2.8e-4 of the radius), its inner nodes smooth and
    its ends corners; a slice closed through a node at the centre, a chord
    closed, an arc open;
  - under affine maps the arc's ends follow, and a reflection swaps them;
  - in a hyperbolic and a spherical space a circle's arc lies on its metric
    circle, its ends at the parameters, a slice's sides geodesics;
  - the handles: the centre, rx at the left end, ry, the two ends (at the
    first axis's right end while whole); an end dragged on, inside and
    outside the ellipse, Ctrl by 15 degrees, Shift both ends; Ctrl on a
    radius a circle; the centre moved;
  - the ellipse tool: from the centre to the pointer, Shift a circle through
    it, From the centre off its box; new ellipses take the bar's arc;
    Ctrl+click a radius, a drag of an end, Shift+click an end, undo; the
    bar's controls and the editor's Whole and Circle.
*/

import { Group_WP } from '../../lib/grouplib/grouplib.js';
import { geodesicDistance } from '../../lib/invlib/GeometryMotions.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { ShapeTool } from '../../lib/drawlib/ShapeTool.js';
import { shapeHandles, shapeWithHandleAt } from '../../lib/drawlib/ShapeHandles.js';
import { normalShape, shapeGeometry, shapeMapped, shapePoint, shapeLocal, ellipseParameter, isArc, arcSpan, wholeEllipse } from '../../lib/drawlib/Shapes.js';
import { flattenNodes } from '../../lib/drawlib/Paths.js';
import { geodesicOutliner, shapeSpace, groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const TAU = 2*Math.PI, DEG = Math.PI/180;
const wrap = t => ((t % TAU) + TAU) % TAU;
const angleOff = (a, b) => { const d = wrap(a - b); return Math.min(d, TAU - d); };

/** the point of the cubic from node a to node b at t */
function cubicPoint(a, b, t){
    const c1 = a.h2 || a.p, c2 = b.h1 || b.p, u = 1 - t;
    const w = [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
    return [0, 1].map(k => w[0]*a.p[k] + w[1]*c1[k] + w[2]*c2[k] + w[3]*b.p[k]);
}
/** the frame radius of a world point: 1 on the ellipse */
const frameRadius = (s, p) => { const [x, y] = shapeLocal(s, p); return Math.hypot(x/s.rx, y/s.ry); };
/** is the world point (on the ellipse) inside the arc's sweep */
const inSweep = (s, p, tol = 1e-9) => wrap(ellipseParameter(s, p) - s.start + tol) <= arcSpan(s) + 2*tol;

// ── the numbers ────────────────────────────────────────────────────────────
{
    const base = { kind: 'ellipse', cx: 0.2, cy: -0.1, rx: 0.3, ry: 0.12, angle: 0.7 };
    const a = normalShape({ ...base, start: -0.5, end: 7 });
    check(Math.abs(a.start - (TAU - 0.5)) < 1e-12 && Math.abs(a.end - (7 - TAU)) < 1e-12 && a.arc === undefined, 'start and end wrapped into [0, 2 pi), the slice not kept');
    check(!isArc(normalShape({ ...base, start: 1, end: 1 })) && !isArc(normalShape({ ...base, start: 1, end: 1 + TAU })), 'start = end (mod 2 pi): the whole ellipse');
    const one = normalShape({ ...base, end: 2 });
    check(one.start === 0 && Math.abs(one.end - 2) < 1e-12, 'one end alone: the other 0');
    check(normalShape({ ...base, start: 1, end: 2, arc: 'chord' }).arc === 'chord' && normalShape({ ...base, arc: 'arc' }).arc === 'arc'
          && normalShape({ ...base, arc: 'bogus' }).arc === undefined, 'the type kept unless the slice, on a whole ellipse too, a bad one dropped');
    const r = normalShape({ ...base, kind: 'rect', start: 1, end: 2, arc: 'arc' });
    check(r.start === undefined && r.end === undefined && r.arc === undefined, 'other kinds have no arc');
    const w = wholeEllipse({ ...base, start: 1, end: 2, arc: 'chord' });
    check(!isArc(w) && w.arc === 'chord', 'made whole: its ends dropped, its type kept');
}

// ── a whole ellipse as before ──────────────────────────────────────────────
{
    const s = normalShape({ kind: 'ellipse', cx: 0.2, cy: -0.1, rx: 0.3, ry: 0.12, angle: 0.7 });
    const KAPPA = 4*(Math.SQRT2 - 1)/3, c = Math.cos(s.angle), sn = Math.sin(s.angle);
    const expected = [0, 1, 2, 3].map(k => {
        const t = Math.PI*k/2, ct = Math.cos(t), st = Math.sin(t);
        const p = [s.cx + s.rx*ct*c - s.ry*st*sn, s.cy + s.rx*ct*sn + s.ry*st*c];
        const lx = -s.rx*st*KAPPA, ly = s.ry*ct*KAPPA, d = [lx*c - ly*sn, lx*sn + ly*c];
        return { p, h1: [p[0] - d[0], p[1] - d[1]], h2: [p[0] + d[0], p[1] + d[1]], smooth: true };
    });
    const g = shapeGeometry(s);
    const same = (m, e) => dist(m.p, e.p) < 1e-15 && dist(m.h1, e.h1) < 1e-15 && dist(m.h2, e.h2) < 1e-15 && m.smooth === e.smooth;
    check(g.closed && g.nodes.length === 4 && g.nodes.every((m, k) => same(m, expected[k])), 'a whole ellipse: the same four smooth nodes as before');
    const g2 = shapeGeometry({ ...s, start: 1.3, end: 1.3, arc: 'arc' });
    check(JSON.stringify(g2) === JSON.stringify(g), 'start = end, of any type: the whole ellipse');
}

// ── arcs ───────────────────────────────────────────────────────────────────
{
    const base = { kind: 'ellipse', cx: 0.2, cy: -0.1, rx: 0.3, ry: 0.12, angle: 0.7 };
    let worst = 0;
    for (const [from, to] of [[0, 30], [10, 100], [0, 90], [0, 91], [45, 225], [300, 30], [20, 290], [5, 4]]) {
        for (const arc of ['slice', 'chord', 'arc']) {
            const s = normalShape({ ...base, start: from*DEG, end: to*DEG, arc });
            const span = arcSpan(s), m = Math.ceil(span/(Math.PI/2) - 1e-9);
            const g = shapeGeometry(s);
            const arcNodes = arc === 'slice' ? g.nodes.slice(0, -1) : g.nodes;
            const what = `${arc} ${from}° to ${to}°`;
            check(arcNodes.length === m + 1 && g.closed === (arc !== 'arc'), `${what}: ${m} pieces of at most a quarter turn, ${arc === 'arc' ? 'open' : 'closed'}`);
            check(dist(arcNodes[0].p, shapePoint(s, s.rx*Math.cos(s.start), s.ry*Math.sin(s.start))) < 1e-15
                  && dist(arcNodes[m].p, shapePoint(s, s.rx*Math.cos(s.end), s.ry*Math.sin(s.end))) < 1e-15, `${what}: its ends at the start and end parameters`);
            check(!arcNodes[0].h1 && !arcNodes[m].h2 && !arcNodes[0].smooth && !arcNodes[m].smooth && arcNodes.slice(1, -1).every(n => n.smooth && n.h1 && n.h2),
                  `${what}: its ends corners, its inner nodes smooth`);
            if (arc === 'slice') {
                const c = g.nodes[g.nodes.length - 1];
                check(dist(c.p, [s.cx, s.cy]) < 1e-15 && !c.h1 && !c.h2, `${what}: closed through a node at the centre`);
            }
            for (let i = 0; i < m; i++) {
                for (let k = 0; k <= 32; k++) {
                    const p = cubicPoint(arcNodes[i], arcNodes[i + 1], k/32);
                    worst = Math.max(worst, Math.abs(frameRadius(s, p) - 1));
                    if (!inSweep(s, p, 1e-6)) worst = Infinity;
                }
            }
        }
    }
    check(worst < 2.8e-4, `the arcs' points on the ellipse within its sweep, ${fmt(worst)} of the radius off (the whole ellipse's cubics: 2.7e-4)`);
}

// ── maps ───────────────────────────────────────────────────────────────────
{
    const s = normalShape({ kind: 'ellipse', cx: 0.2, cy: -0.1, rx: 0.3, ry: 0.12, angle: 0.7, start: 0.4, end: 2.9, arc: 'chord' });
    const affine = (m) => q => [m[0]*q[0] + m[1]*q[1] + m[4], m[2]*q[0] + m[3]*q[1] + m[5]];
    const maps = [
        ['a turn and a scaling', affine([0.8*Math.cos(1.1), -0.8*Math.sin(1.1), 0.8*Math.sin(1.1), 0.8*Math.cos(1.1), 0.3, -0.2])],
        ['a shear', affine([1, 0.7, 0, 1, -0.1, 0.05])],
        ['a reflection', affine([1, 0, 0, -1, 0, 0.1])],
        ['a turned reflection with a stretch', affine([0.5, 0.9, 0.9, -0.3, 0.2, 0.1])],
    ];
    const point = (sh, t) => shapePoint(sh, sh.rx*Math.cos(t), sh.ry*Math.sin(t));
    for (const [name, map] of maps) {
        const out = shapeMapped(s, map);
        const det = (() => { const o = map([0, 0]), a = map([1, 0]), b = map([0, 1]); return (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]); })();
        const flipped = det < 0;
        const A = map(point(s, s.start)), B = map(point(s, s.end));
        const ok = isArc(out) && out.arc === 'chord'
            && dist(point(out, out.start), flipped ? B : A) < 1e-12 && dist(point(out, out.end), flipped ? A : B) < 1e-12
            && inSweep(out, map(point(s, 0.5*(s.start + s.end)))) && !inSweep(out, map(point(s, s.end + 0.5*(TAU - arcSpan(s)))));
        check(ok, `${name}: the arc's ends go to the images of its ends${flipped ? ', swapped' : ''}, its middle in the new sweep, the rest out`);
    }
}

// ── in a curved geometry ───────────────────────────────────────────────────
{
    const SPACES = [
        ['the disk (0.3, -0.2), 1.7', { kind: 'hyperbolic', c: [0.3, -0.2], r: 1.7 }, [0.8, 0.3]],
        ['the sphere (0.4, 0.1), 0.8', { kind: 'spherical', c: [0.4, 0.1], R: 0.8 }, [0.7, -0.2]],
    ];
    for (const [name, geom, C] of SPACES) {
        const sp = shapeSpace(geom);
        const half = 0.5*(geom.kind === 'spherical' ? geom.R : geom.r);
        const metricOf = L => L/half;
        const s = normalShape({ kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, angle: 0.4, start: 0.5, end: 4 });
        const g = shapeGeometry(s, sp);
        const arcNodes = g.nodes.slice(0, -1), centre = g.nodes[g.nodes.length - 1];
        // the arc alone, drawn by the geometry and flattened
        const o = geodesicOutliner(geom).outline(arcNodes, false);
        const flat = flattenNodes(o.nodes, false, 1e-6);
        const r = metricOf(s.rx);
        let off = 0;
        for (let i = 0; i + 1 < flat.length; i += 2) off = Math.max(off, Math.abs(geodesicDistance(geom, C, [flat[i], flat[i + 1]]) - r)/r);
        const chart = sp.chart(C);
        const param = q => { const k = chart.to(q); return Math.atan2(k[1], k[0]) - s.angle; };
        check(g.closed && dist(centre.p, C) < 1e-12 && !centre.h1 && !centre.h2 && !centre.plain && !arcNodes[arcNodes.length - 1].h2 && !arcNodes[arcNodes.length - 1].plain,
              `${name}: a slice closed through the centre by geodesic sides`);
        check(off < 1e-4, `${name}: the arc on its metric circle (${fmt(off)} of the radius off)`);
        check(angleOff(param(arcNodes[0].p), s.start) < 1e-9 && angleOff(param(arcNodes[arcNodes.length - 1].p), s.end) < 1e-9
              && !arcNodes[0].smooth && !arcNodes[arcNodes.length - 1].smooth && arcNodes.slice(1, -1).every(m => m.smooth),
              `${name}: its ends at the parameters of the chart's frame, corners, its inner nodes smooth`);
        const chord = shapeGeometry({ ...s, arc: 'chord' }, sp), open = shapeGeometry({ ...s, arc: 'arc' }, sp);
        check(chord.closed && !chord.nodes[chord.nodes.length - 1].plain && !chord.nodes[chord.nodes.length - 1].h2 && !open.closed && open.nodes.length === arcNodes.length,
              `${name}: a chord closed by a geodesic, an arc open`);
        // an end dragged in the chart: the parameter of the point
        const X = chart.from([0.2*Math.cos(2.2), 0.2*Math.sin(2.2)]);
        const moved = shapeWithHandleAt(s, 'end', X, s, false, false, sp);
        check(Math.abs(moved.end - wrap(2.2 - s.angle)) < 1e-9 && Math.abs(moved.rx - s.rx) < 1e-15 && moved.cx === s.cx,
              `${name}: an end dragged: the parameter of the pointer in the chart of the centre`);
    }
}

// ── the handles ────────────────────────────────────────────────────────────
{
    const view = { mapWorld: (frameInv, w) => w };
    const s = normalShape({ kind: 'ellipse', cx: 0.2, cy: -0.1, rx: 0.3, ry: 0.12, angle: 0.7 });
    const at = (x, y) => shapePoint(s, x, y), on = (t, f = 1) => at(f*s.rx*Math.cos(t), f*s.ry*Math.sin(t));
    const hs = shapeHandles(view, s, null);
    const h = k => hs.find(x => x.kind === k);
    check(hs.map(x => x.kind).join() === 'centre,rx,ry,start,end' && dist(h('centre').world, [s.cx, s.cy]) < 1e-15 && dist(h('rx').world, at(-s.rx, 0)) < 1e-15
          && dist(h('ry').world, at(0, s.ry)) < 1e-15 && dist(h('start').world, at(s.rx, 0)) < 1e-15 && dist(h('end').world, at(s.rx, 0)) < 1e-15
          && h('centre').mark === 'cross' && h('start').mark === 'disc' && !h('rx').mark,
          'an ellipse\'s handles: a cross at its centre, rx at the left end, ry at the top, both ends of a whole one at the right end');
    const e1 = shapeWithHandleAt(s, 'end', on(1));
    check(e1.start === 0 && Math.abs(e1.end - 1) < 1e-12 && e1.arc === undefined, 'the end of a whole ellipse dragged on it: an arc from 0, a slice');
    const e2 = shapeWithHandleAt(s, 'end', on(2, 0.5));
    check(Math.abs(e2.end - 2) < 1e-12 && e2.arc === 'arc', 'dragged inside: an open arc');
    const e3 = shapeWithHandleAt(e2, 'end', on(2.5, 1.5));
    check(Math.abs(e3.end - 2.5) < 1e-12 && e3.arc === undefined, 'dragged outside: a slice');
    const chord = { ...e1, arc: 'chord' };
    check(shapeWithHandleAt(chord, 'start', on(0.3, 1.1)).arc === 'chord' && shapeWithHandleAt(chord, 'start', on(0.3, 0.9)).arc === 'chord',
          'between 0.75 and 1.25 of the way out the type stays');
    const e4 = shapeWithHandleAt(e1, 'start', on(0.3), e1, true);
    check(Math.abs(e4.start - 15*DEG) < 1e-12 && Math.abs(e4.end - 1) < 1e-12, 'Ctrl: the end by steps of 15 degrees');
    const arc = normalShape({ ...s, start: 1, end: 3 });
    const e5 = shapeWithHandleAt(arc, 'start', on(1.5), arc, false, false, null, true);
    check(Math.abs(e5.start - 1.5) < 1e-12 && Math.abs(e5.end - 3.5) < 1e-12, 'Shift: the other end moved as far, the span kept');
    const back = shapeHandles(view, arc, null);
    check(dist(back.find(x => x.kind === 'start').world, on(1)) < 1e-15 && dist(back.find(x => x.kind === 'end').world, on(3)) < 1e-15, 'an arc\'s ends on the ellipse at their parameters');
    const c1 = shapeWithHandleAt(s, 'rx', at(-0.2, 0.05), s, true);
    const c2 = shapeWithHandleAt(s, 'ry', at(0.1, -0.25), s, true);
    check(Math.abs(c1.rx - 0.2) < 1e-12 && Math.abs(c1.ry - 0.2) < 1e-12 && Math.abs(c2.rx - 0.25) < 1e-12 && Math.abs(c2.ry - 0.25) < 1e-12,
          'Ctrl on a radius: a circle of that radius');
    const r1 = shapeWithHandleAt(s, 'rx', at(-0.2, 0.05));
    check(Math.abs(r1.rx - 0.2) < 1e-12 && r1.ry === s.ry, 'the rx diamond, dragged at the left end: rx alone');
    const m1 = shapeWithHandleAt(arc, 'centre', [0.5, 0.4]);
    check(m1.cx === 0.5 && m1.cy === 0.4 && m1.rx === arc.rx && m1.start === arc.start && m1.end === arc.end && m1.angle === arc.angle, 'the centre moved: the rest kept');
}

// ── the ellipse tool ───────────────────────────────────────────────────────
function newEditor(group, ptc){
    const document = DrawingDocument();
    document.clear();
    document.setOutliner(groupOutliner(group, ptc));
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}
// the canvas in pixels of the view's pixel size (0.001), as the drag thresholds count them
const PX = 1000;
function pointer(type, w, extra = {}){
    return { type, wpnt: w, canvasX: PX*w[0], canvasY: PX*w[1], offsetX: PX*w[0], offsetY: PX*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1,
             preventDefault(){}, ...extra };
}
function drag(tool, from, to, extra = {}){
    tool.handleEvent(pointer('pointerdown', from, extra));
    for (let k = 1; k <= 4; k++) tool.handleEvent(pointer('pointermove', [from[0] + (to[0] - from[0])*k/4, from[1] + (to[1] - from[1])*k/4], extra));
    tool.handleEvent(pointer('pointerup', to, extra));
}
function click(tool, w, extra = {}){
    tool.handleEvent(pointer('pointerdown', w, extra));
    tool.handleEvent(pointer('pointerup', w, extra));
}
{
    const g632 = new Group_WP({ type: '632' }).getGroup();
    const { doc, editor } = newEditor(g632, { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 });
    editor.setStyleValue('snap', false);
    const tool = ShapeTool({ editor, kind: 'ellipse' });
    const last = () => doc.getAllItems().pop();
    const C = [0.1, 0.05];
    drag(tool, C, [0.4, -0.15]);
    let e = last();
    check(e && e.shape.kind === 'ellipse' && dist([e.shape.cx, e.shape.cy], C) < 1e-15 && Math.abs(e.shape.rx - 0.3) < 1e-12 && Math.abs(e.shape.ry - 0.2) < 1e-12
          && !isArc(e.shape) && editor.getSelection()[0].id === e.id, 'a drag from the centre: the centre at the press, the half sizes to the pointer, selected');
    // a press on the selected ellipse's centre would move it (its cross): drawn with nothing selected
    editor.clearSelection();
    drag(tool, C, [0.4, -0.15], { shiftKey: true });
    e = last();
    check(Math.abs(e.shape.rx - Math.hypot(0.3, 0.2)) < 1e-12 && Math.abs(e.shape.ry - e.shape.rx) < 1e-15 && dist([e.shape.cx, e.shape.cy], C) < 1e-15,
          'Shift: a circle through the pointer');
    editor.setShapeToolValue('ellipse', 'fromCentre', false);
    editor.clearSelection();
    drag(tool, C, [0.4, -0.15]);
    e = last();
    check(dist([e.shape.cx, e.shape.cy], [0.25, -0.05]) < 1e-12 && Math.abs(e.shape.rx - 0.15) < 1e-12, 'From the centre off: from corner to corner of its box');
    editor.setShapeToolValue('ellipse', 'fromCentre', true);
    editor.setShapeToolValue('ellipse', 'end', Math.PI/2);
    editor.setShapeToolValue('ellipse', 'arc', 'chord');
    drag(tool, [-0.3, 0.2], [-0.1, 0.3]);
    e = last();
    check(e.shape.start === 0 && Math.abs(e.shape.end - Math.PI/2) < 1e-12 && e.shape.arc === 'chord' && e.closed && e.type === 'path', 'a new ellipse takes the bar\'s arc');
    editor.setShapeToolValue('ellipse', 'whole', true);
    editor.setShapeToolValue('ellipse', 'arc', 'slice');
    check(editor.getShapeToolConfig('ellipse').start === 0 && editor.getShapeToolConfig('ellipse').end === 0, 'Whole on the tool: its start and end 0');

    // the handles through the tool, on the ellipse selected
    editor.clearSelection();
    drag(tool, C, [0.4, -0.15]);
    const id = last().id;
    const s0 = doc.getItem(id).shape;
    click(tool, [C[0] - 0.3, C[1]], { ctrlKey: true });
    check(Math.abs(doc.getItem(id).shape.ry - 0.3) < 1e-12 && Math.abs(doc.getItem(id).shape.rx - 0.3) < 1e-12, 'Ctrl+click on the rx diamond: a circle of rx');
    editor.undo();
    editor.setSelection([{ id, frame: null, frameInv: null }]);
    check(doc.getItem(id).shape.ry === s0.ry, 'undo: the ellipse back');
    // the end, at the right end of the first axis, dragged inside to the top
    drag(tool, [C[0] + 0.3, C[1]], [C[0], C[1] + 0.1]);
    let sh = doc.getItem(id).shape;
    check(isArc(sh) && sh.start === 0 && Math.abs(sh.end - Math.PI/2) < 1e-12 && sh.arc === 'arc' && doc.getItem(id).closed === false,
          'the end dragged inside the ellipse: an open arc to the pointer\'s parameter');
    click(tool, [C[0], C[1] + 0.2], { shiftKey: true });
    sh = doc.getItem(id).shape;
    check(!isArc(sh) && sh.arc === 'arc' && doc.getItem(id).closed === true, 'Shift+click on the end: the whole ellipse again');
    // the centre moved
    drag(tool, C, [0.15, 0.1]);
    sh = doc.getItem(id).shape;
    check(dist([sh.cx, sh.cy], [0.15, 0.1]) < 1e-15 && Math.abs(sh.rx - 0.3) < 1e-12, 'the cross at the centre moves the ellipse');

    // the bar and the editor's commands
    const props = tool.getProperties();
    const flat = props.flatMap(p => p.controls || [p]);
    const startField = flat.find(c => c.label === 'start'), endField = flat.find(c => c.label === 'end');
    const types = flat.find(c => c.kind === 'iconChoice');
    check(props[0].kind === 'toggle' && props[0].title.startsWith('From the centre') && startField && endField && types
          && types.options.map(o => o.value).join() === 'slice,chord,arc', 'the bar: From the centre, start, end, the three types');
    startField.set(30);
    endField.set(-90);
    sh = doc.getItem(id).shape;
    check(Math.abs(sh.start - 30*DEG) < 1e-12 && Math.abs(sh.end - 270*DEG) < 1e-12 && Math.abs(endField.get() - 270) < 1e-9, 'start and end typed in degrees on the selected ellipse');
    types.set('slice');
    check(doc.getItem(id).shape.arc === undefined && doc.getItem(id).nodes.some(m => dist(m.p, [sh.cx, sh.cy]) < 1e-15), 'the type: a slice through the centre');
    editor.setShapeValue('circle', true);
    sh = doc.getItem(id).shape;
    check(Math.abs(sh.rx - sh.ry) < 1e-15 && Math.abs(sh.rx - Math.sqrt(0.3*0.2)) < 1e-12 && isArc(sh), 'Circle: both radii their geometric mean, the arc kept');
    editor.setShapeValue('whole', true);
    check(!isArc(doc.getItem(id).shape), 'Whole: the whole ellipse');
    editor.clearSelection();
    const circleButton = flat.find(c => c.kind === 'button' && c.title.startsWith('Circle'));
    check(circleButton && circleButton.enabled() === false, 'the Circle button greyed while no ellipse is selected');
}

console.log(failed ? `${failed} check(s) FAILED` : 'ellipse_arcs: all checks passed');
if (failed) process.exitCode = 1;
