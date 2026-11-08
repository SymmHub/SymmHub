/*
  tests of the motions of shapes in Kleinian groups (lib/grouplib/LimitSet.js, the maximal
  disks of lib/grouplib/GroupGeometry.js, the editor's localGeometry in
  lib/drawlib/DrawingEditor.js; docs/shape_motions_plan.md, phase 2)

    node tests/drawlib/kleinian_motions.mjs

  1. Grandma's Fuchsian group (ta = tb = 3): the sample of the limit set lies on the unit
     circle; the maximal disk at points inside and outside is the unit disk, with and without
     the fold; the fit says hyperbolic (the editor never asks for the disks)
  2. the deformed group ta = 3 + 0.3i: the fit says kleinian; the sample is no circle; the
     maximal disk at a point and at its images under the generators are images of each other
     (the fold makes it exact); the disk changes little along a short path; a disk takes a few
     milliseconds
  3. the cyclic group: the half plane bounded by the line through the fixed points
     perpendicular to the point, whose metric is the flat 1/|A|
  4. Group_22222: in the disk and untwisted it is hyperbolic; twisted it is kleinian by its
     pairings though its sides fit the unit circle, and it has disks; in the half plane model
     the fit fails and the disks are half planes bounded by the real axis; the bent reflection
     group *22222 is kleinian with disks
  5. DrawingEditor with the deformed group and a turned, scaled pattern transform: the
     geometry falls back with 'kleinian', the local geometries are disks, a drag keeps the
     picture in the chart (the chart image of a vertex before equals the one after), three
     drags round a loop restore the item and its stroke width, the pointer is not clamped;
     the pivot as the state of a move: the grabbed point follows the pointer while the
     anchor's disk changes, and three drags grabbed at different points round a loop
     restore the item
*/

// the makers through the aggregator, which evaluates grouplib in its own order (a maker's
// file imported first is still initializing when GroupMakerFactory lists it)
import { Group_Grandma, Group_Cyclic, Group_22222, Group_s22222, limitSetSample } from '../../lib/grouplib/grouplib.js';
import { groupGeometry, maximalDisk, maximalDiskAt, minEnclosingCircle } from '../../lib/grouplib/GroupGeometry.js';
import { ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { mobiusApply, canonicalChart, moveTo, density, transformedGeometry } from '../../lib/invlib/GeometryMotions.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { patternToWorldMap } from '../../lib/drawlib/Folder.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);
const show = g => g.kind === 'hyperbolic' ? `disk c=(${g.c[0].toFixed(5)}, ${g.c[1].toFixed(5)}) r=${g.r.toFixed(5)}`
                : g.kind === 'halfplane' ? `half plane p=(${g.p[0].toFixed(5)}, ${g.p[1].toFixed(5)}) e=(${g.e[0].toFixed(5)}, ${g.e[1].toFixed(5)})` : g.kind;
/** the difference of two disks or half planes, as circles: centre and radius, or the lines' point and direction */
function diskDiff(a, b){
    if (!a || !b || a.kind !== b.kind) return Infinity;
    if (a.kind === 'hyperbolic') return Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) + Math.abs(a.r - b.r);
    if (a.kind === 'halfplane') {
        const across = (w, g) => (w[1] - g.p[1])*g.e[0] - (w[0] - g.p[0])*g.e[1];
        return Math.abs(across(a.p, b)) + Math.abs(Math.abs(a.e[0]*b.e[0] + a.e[1]*b.e[1]) - 1);
    }
    return 0;
}

function grandma(taRe, taIm){
    const mk = new Group_Grandma();
    Object.assign(mk.params, { ta_re: taRe, ta_im: taIm, tb_re: 3, tb_im: 0 });
    mk.state.paramChanged = true;
    return mk.getGroup();
}

// 1 ───────────────────────────────────────────────────────────────────────────

const fuchsian = grandma(3, 0);
{
    const geo = groupGeometry(fuchsian);
    check(geo.kind === 'hyperbolic' && nearPt(geo.c, [0, 0], 1e-6) && near(geo.r, 1, 1e-6), `the Fuchsian group by the fit: ${JSON.stringify(geo)}`);
    const t0 = Date.now();
    const S = limitSetSample(fuchsian);
    const dt = Date.now() - t0;
    let off = 0;
    for (let i = 0; i < S.count; i++) off = Math.max(off, Math.abs(Math.hypot(S.points[2*i], S.points[2*i + 1]) - 1));
    check(S && S.count > 1000 && S.count <= S.maxPoints && S.words <= S.maxWords && off < 1e-6 && !S.infinity,
          `the sample: ${S && S.count} points of ${S && S.words} words in ${dt} ms, off the unit circle by ${fmt(off)}`);
    console.log(`  Fuchsian sample: ${S.count} points, ${S.words} words, ${S.seeds.length} seeds, ${dt} ms`);
    for (const A of [[0, 0], [0.5, 0], [0.3, 0.6], [-0.95, 0.1], [1.5, 0], [2, 1]]) {
        const d1 = maximalDiskAt(A, S), d2 = maximalDisk(fuchsian, A);
        check(d1 && d1.kind === 'hyperbolic' && nearPt(d1.c, [0, 0], 1e-7) && near(d1.r, 1, 1e-7), `the disk at (${A}) without the fold: ${d1 && show(d1)}`);
        check(d2 && d2.kind === 'hyperbolic' && nearPt(d2.c, [0, 0], 1e-7) && near(d2.r, 1, 1e-7), `the disk at (${A}) with the fold: ${d2 && show(d2)}`);
    }
    // the minimum enclosing circle itself
    const px = Float64Array.from([0, 1, 0, -1, 0.3]), py = Float64Array.from([1, 0, -1, 0, 0.2]);
    const mec = minEnclosingCircle(px, py, 5);
    check(nearPt([mec.cx, mec.cy], [0, 0], 1e-12) && near(mec.r, 1, 1e-12), `the minimum enclosing circle of four points of the unit circle and one inside: ${JSON.stringify(mec)}`);
}

// 2 ───────────────────────────────────────────────────────────────────────────

const deformed = grandma(3, 0.3);
{
    const geo = groupGeometry(deformed);
    check(geo.kind === 'kleinian', `the deformed group by the fit: ${JSON.stringify(geo)}`);
    const S = limitSetSample(deformed);
    let off = 0;
    for (let i = 0; i < S.count; i++) off = Math.max(off, Math.abs(Math.hypot(S.points[2*i], S.points[2*i + 1]) - 1));
    check(S.count > 1000 && off > 0.05, `the sample is no circle: ${S.count} points, ${S.words} words, off the unit circle by up to ${off.toFixed(3)}`);
    console.log(`  deformed sample: ${S.count} points, ${S.words} words, ${S.seeds.length} seeds`);
    const A = [0.2, 0.1];
    let t0 = Date.now();
    const D = maximalDisk(deformed, A);
    const dt = Date.now() - t0;
    check(D && D.kind === 'hyperbolic' && D.r > 0.3 && D.r < 1.5, `the disk at (${A}): ${D && show(D)} in ${dt} ms`);
    // equivariance under the generators: g(D_A) against D_{gA}, with the fold both come from the same folded point
    const gens = deformed.getTransforms();
    for (let k = 0; k < gens.length; k++) {
        const g = new ITransform(gens[k].slice(), 'g' + k);
        const q = g.transform(iPoint([A[0], A[1], 0, 0]));
        const gA = [q.v[0], q.v[1]];
        const Dg = maximalDisk(deformed, gA);
        // the image of D under g: a circle through the images of three points of its circle, as a splane
        const sp = g.transform({ v: [D.c[0], D.c[1], 0, D.r], type: 1, clone(){ return this; } });
        const img = (sp && sp.type === 1) ? { kind: 'hyperbolic', c: [sp.v[0], sp.v[1]], r: Math.abs(sp.v[3]) } : null;
        const e = diskDiff(img, Dg);
        check(e < 1e-9, `equivariance under generator ${k} (${deformed.getGenNames()[k]}): g(D_A) against D_{gA}: ${fmt(e)} (${Dg && show(Dg)})`);
    }
    // continuity along a short path
    let prev = null, maxJump = 0, tsum = 0, n = 0;
    for (let i = 0; i <= 40; i++) {
        const P = [-0.3 + 0.6*i/40, 0.1*Math.sin(2*Math.PI*i/40)];
        t0 = Date.now();
        const Dp = maximalDisk(deformed, P);
        tsum += Date.now() - t0; n++;
        if (prev && Dp && prev.kind === Dp.kind) maxJump = Math.max(maxJump, diskDiff(Dp, prev)/0.015);
        prev = Dp;
    }
    check(maxJump < 10, `the disk along a path: largest change per unit step ${maxJump.toFixed(3)}, ${(tsum/n).toFixed(1)} ms a disk`);
    console.log(`  deformed group: ${(tsum/n).toFixed(1)} ms a disk, largest change per unit step along the path ${maxJump.toFixed(3)}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const cyc = new Group_Cyclic().getGroup();
    check(groupGeometry(cyc).kind === 'kleinian', 'the cyclic group has no absolute');
    const S = limitSetSample(cyc);
    let farthest = 0;
    for (let i = 0; i < S.count; i++) farthest = Math.max(farthest, Math.hypot(S.points[2*i], S.points[2*i + 1]));
    check(S && S.infinity && farthest < 1e-9, `its limit set is 0 and infinity: ${S && S.count} finite points within ${fmt(farthest)} of 0, infinity ${S && S.infinity}`);
    const A = [0.5, 0.2];
    const D = maximalDisk(cyc, A);
    const through0 = D && D.kind === 'halfplane' && Math.abs(D.p[0]*D.e[1] - D.p[1]*D.e[0]) < 1e-9;
    const perp = D && D.kind === 'halfplane' && Math.abs(A[0]*D.e[0] + A[1]*D.e[1]) < 1e-9;
    check(through0 && perp, `the disk at (${A}) is the half plane bounded by the line through 0 perpendicular to A: ${D && show(D)}`);
    check(D && near(density(D, A), 1/Math.hypot(A[0], A[1]), 1e-9), `its density at A is 1/|A|: ${D && density(D, A)}`);
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const g22222 = (over) => { const mk = new Group_22222(); Object.assign(mk.params, over); mk.state.paramChanged = true; return mk.getGroup(); };
    const plain = g22222({ uhp: false });
    const gp = groupGeometry(plain);
    check(gp.kind === 'hyperbolic' && nearPt(gp.c, [0, 0], 1e-6) && near(gp.r, 1, 1e-6), `22222 in the disk, untwisted: ${JSON.stringify(gp)}`);
    // a twist is a Fenchel-Nielsen twist: the pairings stay hyperbolic isometries (their
    // splanes are interpolated between geodesics, so they are geodesics), the group Fuchsian
    const twisted = g22222({ uhp: false, T0: 0.3 });
    const gt = groupGeometry(twisted);
    check(gt.kind === 'hyperbolic' && nearPt(gt.c, [0, 0], 1e-6) && near(gt.r, 1, 1e-6), `22222 twisted is Fuchsian still: ${JSON.stringify(gt)}`);
    // a bend takes the sides off the common circle: Kleinian
    const bent22222 = g22222({ uhp: false, A3: 20 });
    const gb2 = groupGeometry(bent22222);
    const Db2 = maximalDisk(bent22222, [0.1, 0.1]);
    check(gb2.kind === 'kleinian' && Db2 && (Db2.kind === 'hyperbolic' || Db2.kind === 'halfplane'), `22222 bent by 20 degrees: ${JSON.stringify(gb2)}, the disk at (0.1, 0.1): ${Db2 && show(Db2)}`);
    const uhp = g22222({ uhp: true });
    const gu = groupGeometry(uhp);
    check(gu.kind === 'kleinian', `22222 in the half plane: the fit finds no circle: ${JSON.stringify(gu)}`);
    const Su = limitSetSample(uhp);
    let offAxis = 0;
    for (let i = 0; i < Su.count; i++) offAxis = Math.max(offAxis, Math.abs(Su.points[2*i + 1]));
    check(Su.count > 100 && offAxis < 1e-6, `its limit set is the real axis: ${Su.count} points within ${fmt(offAxis)} of it`);
    const Du = maximalDisk(uhp, [0.3, 0.4]);
    const onAxis = Du && Du.kind === 'halfplane' && Math.abs(Du.p[1]) < 1e-6 && Math.abs(Du.e[1]) < 1e-6;
    check(onAxis, `its disk at (0.3, 0.4) is the upper half plane: ${Du && show(Du)}`);
    check(Du && near(density(Du, [0.3, 0.4]), 1/0.4, 1e-6), `with the density 1/y: ${Du && density(Du, [0.3, 0.4])}`);
    const bent = (() => { const mk = new Group_s22222(); Object.assign(mk.params, { uhp: false, A2: 25 }); mk.state.paramChanged = true; return mk.getGroup(); })();
    const gb = groupGeometry(bent);
    const Db = maximalDisk(bent, [0.05, 0.05]);
    check(gb.kind === 'kleinian' && Db && (Db.kind === 'hyperbolic' || Db.kind === 'halfplane'), `*22222 bent by 25 degrees: ${JSON.stringify(gb)}, the disk at (0.05, 0.05): ${Db && show(Db)}`);
}

// 5 ───────────────────────────────────────────────────────────────────────────

function newEditor(group, ptc){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}
const square = (cx, cy, h) => ({ type: 'polyline', closed: true, points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
                                 style: { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.02, fill: null } });

{
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const toW = patternToWorldMap(ptc).map;
    const { doc, editor } = newEditor(deformed, ptc);
    const geo = editor.geometry();
    check(geo.kind === 'euclidean' && geo.fallback === 'kleinian', `the editor's geometry: ${JSON.stringify(geo)}`);
    const w0 = toW(0.15, 0.1), w1 = toW(-0.35, 0.3), w2 = toW(0.1, -0.4);
    const g0 = editor.localGeometry(w0), g1 = editor.localGeometry(w1);
    check(g0.kind === 'hyperbolic' && g1.kind === 'hyperbolic' && g0 !== g1, `the local geometries: ${show(g0)}; ${show(g1)}`);
    // the disk in world coordinates is the disk of pattern coordinates carried over
    const dp = maximalDisk(deformed, [0.15, 0.1]);
    check(diskDiff(transformedGeometry(dp, patternToWorldMap(ptc)), g0) < 1e-12, 'the local geometry is the maximal disk carried to world coordinates');
    const item = doc.insertItem(square(w0[0], w0[1], 0.04));
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const first = doc.getItem(item.id);
    // a drag from w0 to w1: the picture in the chart of the grabbed point is the same before and after
    const map = editor.moveMap(w0, w1);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, first]]), map, true));
    const moved = doc.getItem(item.id);
    const s0 = canonicalChart(g0, w0), s1 = canonicalChart(g1, w1);
    let chartErr = 0;
    for (let i = 0; i < 4; i++) {
        const a = mobiusApply(s0, [first.points[2*i], first.points[2*i + 1]]), b = mobiusApply(s1, [moved.points[2*i], moved.points[2*i + 1]]);
        chartErr = Math.max(chartErr, Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    check(nearPt(map(w0), w1, 1e-12) && chartErr < 1e-12, `a drag keeps the picture in the chart (${fmt(chartErr)}) and takes the grabbed point to the pointer`);
    // the stroke follows the map's scale at the item's first point (the map between two
    // disks is conformal, its scale varies across the item)
    const v0 = [first.points[0], first.points[1]], e = 1e-6;
    const dmap = Math.hypot(...[0, 1].map(i => map([v0[0] + e, v0[1]])[i] - map([v0[0] - e, v0[1]])[i]))/(2*e);
    check(near(moved.style.strokeWidth/0.02, dmap, 1e-6), `the stroke scales by the map's scale at the first point ${dmap.toFixed(6)}: ${(moved.style.strokeWidth/0.02).toFixed(6)}`);
    // round the loop w1 -> w2 -> w0
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, moved]]), editor.moveMap(w1, w2), true));
    const second = doc.getItem(item.id);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, second]]), editor.moveMap(w2, w0), true));
    const back = doc.getItem(item.id);
    const err = Math.max(...back.points.map((x, i) => Math.abs(x - first.points[i])));
    check(err < 1e-10, `three drags round a loop restore the points (${fmt(err)})`);
    check(near(back.style.strokeWidth, 0.02, 2e-8), `and the stroke width: ${back.style.strokeWidth}`);
    check(nearPt(editor.clampToGeometry(w0, [5, 5]), [5, 5], 0), 'the pointer is not clamped in a Kleinian group');
    const chart = editor.chartAt(w0);
    check(nearPt(chart.fromChart(chart.toChart(w1)), w1, 1e-12) && nearPt(chart.toChart(w0), [0, 0], 1e-12), 'the chart at a point and back');

    // the pivot as the state of a move, the geometry varying with the anchor: the grabbed
    // point follows the pointer, and three drags grabbed at different points round a loop
    // restore the item
    const C = w0, grabbed = toW(0.18, 0.13), pointer = toW(-0.3, 0.35);
    const base = { ...back, pivot: C };
    const a1 = editor.anchoredMoveMap(C, grabbed, pointer);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, base]]), a1.map, true));
    const p1 = doc.getItem(item.id);
    check(nearPt(a1.map(grabbed), pointer, 1e-9) && nearPt(p1.pivot, a1.anchor, 1e-12), `the anchored move in a Kleinian group takes the grabbed point to the pointer (${fmt(Math.hypot(...[0, 1].map(i => a1.map(grabbed)[i] - pointer[i])))})`);
    const gA1 = editor.localGeometry(a1.anchor);
    check(gA1.kind === 'hyperbolic' && diskDiff(gA1, g0) > 1e-6, `the anchor's geometry is its own disk (${show(gA1)})`);
    const grabbed2 = a1.map(toW(0.12, 0.09)), pointer2 = toW(0.1, -0.4);
    const a2 = editor.anchoredMoveMap(p1.pivot, grabbed2, pointer2);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, p1]]), a2.map, true));
    const p2 = doc.getItem(item.id);
    const grabbed3 = a2.map(a1.map(toW(0.14, 0.1)));
    const target3 = editor.moveMap(p2.pivot, C)(grabbed3);
    const a3 = editor.anchoredMoveMap(p2.pivot, grabbed3, target3);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, p2]]), a3.map, true));
    const p3 = doc.getItem(item.id);
    const errLoop = Math.max(...p3.points.map((x, i) => Math.abs(x - base.points[i])));
    check(errLoop < 1e-9 && nearPt(p3.pivot, C, 1e-9) && near(p3.style.strokeWidth, base.style.strokeWidth, 1e-9), `three anchored drags round a loop restore the item (${fmt(errLoop)}), its pivot and its stroke`);
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
