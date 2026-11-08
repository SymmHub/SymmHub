/*
  tests of the motions of shapes in the geometry of the group (lib/invlib/GeometryMotions.js,
  lib/grouplib/GroupGeometry.js, the moves of lib/drawlib/DrawingEditor.js and SelectTool.js)

    node tests/drawlib/motions.mjs

  1. groupGeometry reads the geometry off the sides of a domain: the hyperbolic triangles
     *237 and 345 give the unit disk (with the rim listed as a side too), the spherical *532
     and *432 a sphere about the origin, the Euclidean *333 and the wallpaper group 632 the
     plane, two concentric circles no geometry
  2. GeometryMotions, in the plane, two disks (inside and outside), a half plane and two
     spheres: a translation and a move take A to B and keep distances; a move keeps the
     screen orientation of the picture at A, is the two motions through the centre in the
     unit disk and on the unit sphere, and a loop of moves is the identity; a similarity
     fixes its pivot with its factor as derivative; a reflection fixes its geodesic and is an
     involution; the clamp keeps a point in the model; a geometry carried to world
     coordinates measures as before
  3. DrawingEditor with the *237 group and a turned, scaled pattern transform: a drag keeps
     the hyperbolic size of an item (the distance of two of its vertices in the Poincaré disk
     of pattern coordinates), scales its stroke width with the local scale, and back to the
     start restores the item; a rotation and a flip keep the size, a flip is an involution;
     the corner handle's similarity puts the handle where the pointer is; a wallpaper group
     moves by plain translations as before; the spherical *532 keeps spherical sizes; a
     domain of no geometry falls back to the plane
  4. mappedItem on an image under a Möbius map: a parallelogram about the image of the
     centre, the exact corners under an affine map
  5. the pivot as the state of a move (anchoredMoveTo, the editor's anchoredMoveMap): the
     grabbed point follows the pointer, the anchor is carried exactly, the picture in its
     chart is kept, and three drags grabbed at different points round a loop are the
     identity, in every geometry and through the editor with the *237 group
  6. the geometry setting of the select tool: off, the moves are the plane's translations
     without a clamp; it is saved with the tool settings
  7. the incremental setting of the select tool: the move as geodesic steps along the
     pointer's path (parallel transport): the grabbed point follows the pointer, the size
     and the stroke follow as with the direct move, the path back restores the shape, a
     loop turns it by the hyperbolic area it encloses (the other way round the other way)
     while the direct move round a loop is the identity; in the plane, and with the
     geometry off, the steps compose to the translation; it is saved with the tool settings
*/

import { domainAbsolute, groupGeometry } from '../../lib/grouplib/GroupGeometry.js';
import { Group_KLM } from '../../lib/grouplib/Group_KLM.js';
import { Group_Spherical } from '../../lib/grouplib/Group_Spherical.js';
import { Group_WP } from '../../lib/grouplib/Group_WP.js';
import { Group, iSphere } from '../../lib/invlib/invlib.js';
import {
    mobiusApply, mobiusCompose, mobiusInverse, mobiusDerivative, canonicalChart, moveTo, anchoredMoveTo, translationTo,
    similarityAbout, reflectionAbout, geodesicDistance, density, transformedGeometry, clampToModel,
} from '../../lib/invlib/GeometryMotions.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { mappedItem } from '../../lib/drawlib/Paths.js';
import { worldToPatternMap, patternToWorldMap } from '../../lib/drawlib/Folder.js';

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
const IDENTITY = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];

// ---- the groups ────────────────────────────────────────────────────────────

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}
const g237 = klm(2, 3, 7, true), g345 = klm(3, 4, 5, false), g333 = klm(3, 3, 3, true);
const g532 = new Group_Spherical({ type: '*532' }).getGroup();
const g432 = new Group_Spherical({ type: '*432' }).getGroup();
const g632 = new Group_WP({ type: '632' }).getGroup();
const gRings = new Group({ s: [iSphere([0, 0, 0, -0.5]), iSphere([0, 0, 0, 1])] });

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const cases = [
        ['*237', g237, 'hyperbolic'], ['345', g345, 'hyperbolic'], ['*532', g532, 'spherical'], ['*432', g432, 'spherical'],
        ['*333', g333, 'euclidean'], ['632', g632, 'euclidean'], ['two concentric circles', gRings, 'kleinian'],
    ];
    for (const [name, g, kind] of cases) {
        const geo = groupGeometry(g);
        let ok = geo.kind === kind;
        if (kind === 'hyperbolic') ok = ok && nearPt(geo.c, [0, 0], 1e-6) && near(geo.r, 1, 1e-6);
        if (kind === 'spherical') ok = ok && nearPt(geo.c, [0, 0], 1e-6) && geo.R > 0;
        check(ok, `${name}: ${JSON.stringify(geo)}, expected ${kind}`);
        if (kind === 'spherical') console.log(`  ${name}: a sphere with the equator radius ${geo.R.toFixed(6)}`);
    }
    // the boundary of the disk listed as a side (the hasR domains): the unit disk still
    const withRim = domainAbsolute([...g237.getFundDomain(), iSphere([0, 0, 0, 1])]);
    check(withRim.kind === 'hyperbolic' && nearPt(withRim.c, [0, 0], 1e-6) && near(withRim.r, 1, 1e-6), `*237 with the rim as a side: ${JSON.stringify(withRim)}`);
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const P = [0.2, 0.15], Q = [-0.3, 0.35], X = [0.1, -0.3], Y = [0.45, 0.05];
    const geoms = [
        ['plane', { kind: 'euclidean' }, P, Q, X, Y],
        ['unit disk', { kind: 'hyperbolic', c: [0, 0], r: 1 }, P, Q, X, Y],
        ['disk about 0.3+0.1i of radius 0.7', { kind: 'hyperbolic', c: [0.3, 0.1], r: 0.7 }, P, Q, X, Y],
        ['outside the unit disk', { kind: 'hyperbolic', c: [0, 0], r: 1 }, [1.7, 0.4], [2.1, -1.3], [1.4, 1.1], [3, 0.2]],
        ['half plane', { kind: 'halfplane', p: [0.2, -0.1], e: [Math.SQRT1_2, Math.SQRT1_2] }, P, Q, [0.5, 0.6], [-0.2, 0.3]],
        ['unit sphere', { kind: 'spherical', c: [0, 0], R: 1 }, P, Q, X, Y],
        ['sphere about 0.5-0.2i, equator 0.8', { kind: 'spherical', c: [0.5, -0.2], R: 0.8 }, P, Q, X, Y],
    ];
    const pts = [[0.1, 0.2], [-0.3, 0.1], [0.25, -0.35], [0, 0.5]];
    for (const [name, g, A, B, X1, Y1] of geoms) {
        const T = translationTo(g, A, B), M = moveTo(g, A, B);
        const d0 = geodesicDistance(g, X1, Y1);
        check(nearPt(mobiusApply(T, A), B, 1e-12) && near(geodesicDistance(g, mobiusApply(T, X1), mobiusApply(T, Y1)), d0, 1e-9),
              `${name}: the translation takes A to B and keeps distances`);
        const dM = mobiusDerivative(M, A);
        check(nearPt(mobiusApply(M, A), B, 1e-12) && near(geodesicDistance(g, mobiusApply(M, X1), mobiusApply(M, Y1)), d0, 1e-9) && near(dM[1], 0, 1e-9) && dM[0] > 0,
              `${name}: the move takes A to B, keeps distances and the screen orientation at A (turn ${fmt(Math.atan2(dM[1], dM[0]))})`);
        const s = canonicalChart(g, A), ds = mobiusDerivative(s, A);
        check(nearPt(mobiusApply(s, A), [0, 0], 1e-12) && near(ds[1], 0, 1e-12) && ds[0] > 0, `${name}: the canonical chart has A at the origin and a positive real derivative`);
        // a loop of moves is the identity
        const loop = [A, B, X1, Y1, A];
        let L = IDENTITY;
        for (let i = 1; i < loop.length; i++) L = mobiusCompose(moveTo(g, loop[i - 1], loop[i]), L);
        check(pts.every(p => nearPt(mobiusApply(L, p), p, 1e-9)), `${name}: a loop of moves is the identity`);
        // the similarity about A: A fixed, the factor its derivative
        const f = [1.3*Math.cos(0.4), 1.3*Math.sin(0.4)];
        const S = similarityAbout(g, A, f);
        check(nearPt(mobiusApply(S, A), A, 1e-12) && nearPt(mobiusDerivative(S, A), f, 1e-9), `${name}: the similarity about A`);
        // the reflection in the geodesic through A along dir: A and the geodesic fixed, an involution
        const dir = [0.6, -0.8];
        const R = reflectionAbout(g, A, dir);
        const onGeodesic = mobiusApply(mobiusInverse(s), [0.3*dir[0], 0.3*dir[1]]);
        check(nearPt(R(A), A, 1e-12) && nearPt(R(onGeodesic), onGeodesic, 1e-9) && pts.every(p => nearPt(R(R(p)), p, 1e-9)), `${name}: the reflection`);
    }
    // the move is the two motions through the centre of the model
    for (const [name, g] of [['unit disk', geoms[1][1]], ['unit sphere', geoms[5][1]], ['plane', geoms[0][1]]]) {
        const A = [0.3, -0.2], B = [-0.5, 0.4];
        const M = moveTo(g, A, B), M2 = mobiusCompose(translationTo(g, [0, 0], B), translationTo(g, A, [0, 0]));
        check(pts.every(p => nearPt(mobiusApply(M, p), mobiusApply(M2, p), 1e-12)), `${name}: the move is T(0 -> B) T(A -> 0)`);
    }
    // the clamp
    const disk = geoms[1][1];
    const inside = clampToModel(disk, [0.2, 0.1], [0.3, 0.3]), onto = clampToModel(disk, [0.2, 0.1], [1.5, 0]), out = clampToModel(disk, [1.5, 0.2], [0.5, 0]);
    check(nearPt(inside, [0.3, 0.3], 0) && Math.hypot(...onto) < 1 && Math.hypot(...onto) > 0.999 && Math.hypot(...out) > 1 && Math.hypot(...out) < 1.001,
          `the clamp keeps the pointer in the model, just off the rim: ${onto}, ${out}`);
    // a geometry carried to world coordinates by a pattern transform
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const toW = patternToWorldMap(ptc);
    for (const g of [geoms[2][1], geoms[6][1], geoms[4][1]]) {
        const gw = transformedGeometry(g, toW);
        const p = [0.25, 0.05], q = [0.1, 0.3], w = toW.map(p[0], p[1]), u = toW.map(q[0], q[1]);
        check(near(density(gw, w), density(g, p)/toW.scale, 1e-9) && near(geodesicDistance(gw, w, u), geodesicDistance(g, p, q), 1e-9),
              `${g.kind} carried to world coordinates measures as before`);
    }
}

// 3 ───────────────────────────────────────────────────────────────────────────

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
const vertex = (item, i) => [item.points[2*i], item.points[2*i + 1]];

{
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const toP = worldToPatternMap(ptc).map;
    // the hyperbolic distance of two world points in the Poincaré disk of pattern coordinates
    const hyp = (p, q) => {
        const a = toP(p[0], p[1]), b = toP(q[0], q[1]);
        const num = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const den = Math.hypot(1 - a[0]*b[0] - a[1]*b[1], a[0]*b[1] - a[1]*b[0]);
        return 2*Math.atanh(num/den);
    };
    const { doc, editor } = newEditor(g237, ptc);
    const item = doc.insertItem(square(0.12, 0.08, 0.05));
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const geo = editor.geometry();
    check(geo.kind === 'hyperbolic' && near(geo.r, 0.8, 1e-9) && nearPt(geo.c, [0.1, -0.05], 1e-9), `the editor's geometry in world coordinates: ${JSON.stringify(geo)}`);
    const first = doc.getItem(item.id);
    const size0 = hyp(vertex(first, 0), vertex(first, 2));
    // a drag from the item's centre toward the rim
    const w0 = [0.12, 0.08], w1 = [0.55, -0.3];
    const map = editor.moveMap(w0, w1);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, first]]), map, true));
    const moved = doc.getItem(item.id);
    check(nearPt(map(w0), w1, 1e-12), 'the grabbed point follows the pointer');
    check(near(hyp(vertex(moved, 0), vertex(moved, 2)), size0, 1e-9), `a drag keeps the hyperbolic size: ${hyp(vertex(moved, 0), vertex(moved, 2))} against ${size0}`);
    // the local scale at the item's first point, where the stroke is measured
    const scale = density(geo, vertex(first, 0))/density(geo, map(vertex(first, 0)));
    check(near(moved.style.strokeWidth, 0.02*scale, 1e-8), `the stroke width follows the local scale ${scale.toFixed(6)}: ${moved.style.strokeWidth}`);
    const e = 1e-6, dm = map([w0[0] + e, w0[1]]);
    check(near((dm[1] - w1[1])/e, 0, 1e-5) && (dm[0] - w1[0])/e > 0, 'the picture keeps its screen orientation at the grabbed point');
    // back to the start: the item as it was
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, moved]]), editor.moveMap(w1, w0), true));
    const restored = doc.getItem(item.id);
    check(restored.points.every((x, i) => near(x, first.points[i], 1e-12)), 'back to the start restores the points exactly (the charts telescope)');
    // the stroke follows the local scale at the item's first point, which the map carries exactly
    check(near(restored.style.strokeWidth, 0.02, 2e-8), `back to the start restores the stroke width: ${restored.style.strokeWidth}`);
    // a rotation and a flip keep the size; the flip is an involution
    editor.rotateSelection(0.7);
    const turned = doc.getItem(item.id);
    check(near(hyp(vertex(turned, 0), vertex(turned, 2)), size0, 1e-9), 'a rotation keeps the hyperbolic size');
    editor.flipSelection('x');
    const flipped = doc.getItem(item.id);
    check(near(hyp(vertex(flipped, 0), vertex(flipped, 2)), size0, 1e-9), 'a flip keeps the hyperbolic size');
    const F = editor.flipMap([0.2, 0.1], [0, 1]);
    check([[0.1, 0.2], [0.3, -0.1], [0.5, 0.4]].every(p => nearPt(F(F(p)), p, 1e-9)) && nearPt(F([0.2, 0.1]), [0.2, 0.1], 1e-12), 'a flip is an involution fixing its centre');
    // the corner handle: the handle lands on the pointer, the pivot stays
    const pivot = [0.2, 0.1], h = [0.3, 0.12], p = [0.36, 0.2];
    const chart = editor.chartAt(pivot);
    const hl = chart.toChart(h), pl = chart.toChart(p);
    const ratio = Math.hypot(pl[0], pl[1])/Math.hypot(hl[0], hl[1]), ang = Math.atan2(pl[1], pl[0]) - Math.atan2(hl[1], hl[0]);
    const sim = editor.similarityMap(pivot, [ratio*Math.cos(ang), ratio*Math.sin(ang)]);
    check(nearPt(sim(pivot), pivot, 1e-12) && nearPt(sim(h), p, 1e-9) && nearPt(chart.fromChart(chart.toChart(h)), h, 1e-12), 'the corner handle lands on the pointer, the pivot stays');
    check(nearPt(editor.clampToGeometry(w0, [0.3, 0.1]), [0.3, 0.1], 0) && geodesicDistance(geo, w0, editor.clampToGeometry(w0, [2, 0.5])) < 20, 'the pointer is kept in the disk');

    // a wallpaper group: the plane, plain translations
    const wp = newEditor(g632, ptc);
    check(wp.editor.geometry().kind === 'euclidean' && !wp.editor.geometry().fallback, 'a wallpaper group moves in the plane');
    const tm = wp.editor.moveMap([0.1, 0.2], [0.4, -0.1]);
    check([[0, 0], [0.3, 0.7], [-1, 2]].every(q => nearPt(tm(q), [q[0] + 0.3, q[1] - 0.3], 1e-12)), 'its moves are the translations of before');
    const wItem = wp.doc.insertItem(square(0.1, 0.2, 0.05));
    wp.editor.setSelection([{ id: wItem.id, frame: null, frameInv: null }]);
    wp.editor.applyReplace(wp.editor.transformedSelection(new Map([[wItem.id, wp.doc.getItem(wItem.id)]]), tm, true));
    const wMoved = wp.doc.getItem(wItem.id);
    check(near(wMoved.style.strokeWidth, 0.02, 1e-12) && nearPt(vertex(wMoved, 0), [0.35, -0.15], 1e-12), 'a plain translation, the stroke as it was');

    // the sphere
    const sp = newEditor(g532, ptc);
    const sgeo = sp.editor.geometry();
    check(sgeo.kind === 'spherical', `the spherical group: ${JSON.stringify(sgeo)}`);
    const sItem = sp.doc.insertItem(square(0.3, 0.1, 0.06));
    sp.editor.setSelection([{ id: sItem.id, frame: null, frameInv: null }]);
    const sFirst = sp.doc.getItem(sItem.id);
    const sm = sp.editor.moveMap([0.3, 0.1], [1.2, 0.9]);
    sp.editor.applyReplace(sp.editor.transformedSelection(new Map([[sItem.id, sFirst]]), sm, true));
    const sMoved = sp.doc.getItem(sItem.id);
    check(near(geodesicDistance(sgeo, vertex(sMoved, 0), vertex(sMoved, 2)), geodesicDistance(sgeo, vertex(sFirst, 0), vertex(sFirst, 2)), 1e-9), 'a drag on the sphere keeps the spherical size');
    check(sMoved.style.strokeWidth > 0.02, `the stroke grows away from the centre of the stereographic plane: ${sMoved.style.strokeWidth}`);

    // a domain of no geometry: the plane, for now
    const kl = newEditor(gRings, ptc);
    const kg = kl.editor.geometry();
    check(kg.kind === 'euclidean' && kg.fallback === 'kleinian', `a domain of no geometry falls back to the plane: ${JSON.stringify(kg)}`);
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const quad = [0.1, 0.1, 0.4, 0.1, 0.4, 0.3, 0.1, 0.3];   // bottom-left, bottom-right, top-right, top-left
    const image = { type: 'image', closed: true, src: '', points: quad, style: { stroke: null, fill: null, opacity: 1 } };
    const disk = { kind: 'hyperbolic', c: [0, 0], r: 1 };
    const M = moveTo(disk, [0.25, 0.2], [-0.4, 0.5]);
    const map = q => mobiusApply(M, q);
    const out = mappedItem(image, map).points;
    check(near(out[0] + out[4], out[2] + out[6], 1e-12) && near(out[1] + out[5], out[3] + out[7], 1e-12), 'the mapped quad is a parallelogram');
    check(nearPt([0.5*(out[0] + out[4]), 0.5*(out[1] + out[5])], map([0.25, 0.2]), 1e-12), 'about the image of the centre');
    const aff = q => [0.3 + 1.2*(0.8*q[0] - 0.6*q[1]), -0.1 + 1.2*(0.6*q[0] + 0.8*q[1])];
    const outA = mappedItem(image, aff).points;
    check([0, 1, 2, 3].every(i => nearPt([outA[2*i], outA[2*i + 1]], aff([quad[2*i], quad[2*i + 1]]), 1e-12)), 'the exact corners under an affine map');
}

// 5 ───────────────────────────────────────────────────────────────────────────
//  the pivot as the state of a move (anchoredMoveTo): the grabbed point follows the
//  pointer, the anchor is carried exactly, and drags grabbed at different points round
//  a loop compose to the identity

{
    const inside = { C: [0.1, 0.05], w0: [0.15, 0.1], w1: [-0.3, 0.35], X: [0.05, 0.12], Y: [0.4, -0.2], Z: [0.14, 0.0] };
    const cases = [
        ['plane', { kind: 'euclidean' }, inside],
        ['unit disk', { kind: 'hyperbolic', c: [0, 0], r: 1 }, inside],
        ['disk about 0.3+0.1i of radius 0.7', { kind: 'hyperbolic', c: [0.3, 0.1], r: 0.7 }, inside],
        ['outside the unit disk', { kind: 'hyperbolic', c: [0, 0], r: 1 }, { C: [1.7, 0.4], w0: [1.75, 0.45], w1: [2.1, -1.3], X: [1.65, 0.5], Y: [3, 0.2], Z: [1.8, 0.3] }],
        ['half plane', { kind: 'halfplane', p: [0.2, -0.1], e: [Math.SQRT1_2, Math.SQRT1_2] }, { C: [0.2, 0.15], w0: [0.25, 0.2], w1: [-0.3, 0.35], X: [0.15, 0.25], Y: [0.5, 0.6], Z: [0.22, 0.1] }],
        ['unit sphere', { kind: 'spherical', c: [0, 0], R: 1 }, inside],
        ['sphere about 0.5-0.2i, equator 0.8', { kind: 'spherical', c: [0.5, -0.2], R: 0.8 }, inside],
    ];
    const pts = [[0.1, 0.2], [-0.3, 0.1], [0.25, -0.35], [0, 0.5]];
    for (const [name, g, P] of cases) {
        const { C, w0, w1, X, Y, Z } = P;
        const d1 = anchoredMoveTo(g, C, w0, w1);
        const sC = canonicalChart(g, C), s1 = canonicalChart(g, d1.anchor);
        check(nearPt(mobiusApply(d1.m, w0), w1, 1e-10) && nearPt(mobiusApply(d1.m, C), d1.anchor, 1e-12),
              `${name}: the anchored move takes the grabbed point to the pointer and the anchor to its place (${fmt(Math.hypot(...[0, 1].map(i => mobiusApply(d1.m, w0)[i] - w1[i])))})`);
        check(pts.every(p => nearPt(mobiusApply(s1, mobiusApply(d1.m, p)), mobiusApply(sC, p), 1e-10)), `${name}: the picture in the anchor's chart is carried`);
        // a second drag grabbed elsewhere, a third one bringing the anchor back to C
        const e2 = mobiusApply(d1.m, X);
        const d2 = anchoredMoveTo(g, d1.anchor, e2, Y);
        const e3 = mobiusApply(d2.m, mobiusApply(d1.m, Z));
        const f = mobiusApply(moveTo(g, d2.anchor, C), e3);
        const d3 = anchoredMoveTo(g, d2.anchor, e3, f);
        const L = mobiusCompose(d3.m, mobiusCompose(d2.m, d1.m));
        check(nearPt(d3.anchor, C, 1e-9) && pts.every(p => nearPt(mobiusApply(L, p), p, 1e-9)),
              `${name}: three drags grabbed at different points round a loop are the identity (anchor off by ${fmt(Math.hypot(d3.anchor[0] - C[0], d3.anchor[1] - C[1]))})`);
    }
    // the editor: a single item moved keeps the box's centre as its pivot, carried exactly;
    // drags grabbed at different points round a loop restore it
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const { doc, editor } = newEditor(g237, ptc);
    const item = doc.insertItem(square(0.12, 0.08, 0.05));
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const first = doc.getItem(item.id);
    const box = editor.selectionBox();
    const C = [0.5*(box[0] + box[2]), 0.5*(box[1] + box[3])];
    const grabbed = [0.15, 0.1], pointer = [0.5, -0.25];
    const m1 = editor.anchoredMoveMap(C, grabbed, pointer);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, { ...first, pivot: C }]]), m1.map, true));
    const moved = doc.getItem(item.id);
    check(nearPt(m1.map(grabbed), pointer, 1e-10) && nearPt(moved.pivot, m1.anchor, 1e-12), 'the editor: the grabbed point follows the pointer, the pivot is the anchor');
    const grabbed2 = m1.map([0.1, 0.05]), pointer2 = [-0.3, 0.4];
    const m2 = editor.anchoredMoveMap(moved.pivot, grabbed2, pointer2);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, moved]]), m2.map, true));
    const moved2 = doc.getItem(item.id);
    const grabbed3 = m2.map(m1.map([0.14, 0.11]));
    const target3 = editor.moveMap(moved2.pivot, C)(grabbed3);
    const m3 = editor.anchoredMoveMap(moved2.pivot, grabbed3, target3);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, moved2]]), m3.map, true));
    const back = doc.getItem(item.id);
    const err = Math.max(...back.points.map((x, i) => Math.abs(x - first.points[i])));
    check(err < 1e-9 && nearPt(back.pivot, C, 1e-9) && near(back.style.strokeWidth, 0.02, 1e-9), `the editor: three drags grabbed at different points restore the item (${fmt(err)}), its pivot and its stroke`);
}

// 6 ───────────────────────────────────────────────────────────────────────────
//  the geometry setting of the select tool: off, the moves are the plane's

{
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const { editor } = newEditor(g237, ptc);
    check(editor.getStyleConfig().geometry === true && editor.geometry().kind === 'hyperbolic', 'the moves are in the geometry by default');
    editor.setStyleValue('geometry', false);
    const off = editor.geometry();
    const tm = editor.moveMap([0.1, 0.2], [0.4, -0.1]);
    check(off.kind === 'euclidean' && !off.fallback && [[0, 0], [0.3, 0.7]].every(q => nearPt(tm(q), [q[0] + 0.3, q[1] - 0.3], 1e-12)) && nearPt(editor.clampToGeometry([0.1, 0.2], [5, 5]), [5, 5], 0),
          'off: the plane, translations, no clamp');
    editor.setStyleValue('geometry', true);
    check(editor.geometry().kind === 'hyperbolic', 'on again: the disk');
    const saved = editor.getStyleParams().getValue();
    editor.getStyleParams().setValue({ ...saved, geometry: false });
    check(saved.geometry === true && editor.geometry().kind === 'euclidean', 'the setting is saved with the tool settings and restored from them');
    editor.getStyleParams().setValue({ snap: true });
    check(editor.geometry().kind === 'euclidean', 'a saved drawing without the setting keeps the current value');
}

// 7 ───────────────────────────────────────────────────────────────────────────
//  the incremental setting of the select tool: geodesic steps along the pointer's path

{
    const TODEG = 180/Math.PI;
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const { doc, editor } = newEditor(g237, ptc);
    check(editor.getStyleConfig().incremental === false, 'the moves are direct by default');
    editor.setStyleValue('incremental', true);
    const geo = editor.geometry();
    // a counterclockwise square loop of side 0.3 from a, 40 steps a side
    const a = [0.05, 0.02], side = 0.3, n = 40;
    const corners = [a, [a[0] + side, a[1]], [a[0] + side, a[1] + side], [a[0], a[1] + side]];
    const loop = [];
    for (let e = 0; e < 4; e++) {
        const p = corners[e], q = corners[(e + 1) % 4];
        for (let i = 0; i < n; i++) loop.push([p[0] + (q[0] - p[0])*i/n, p[1] + (q[1] - p[1])*i/n]);
    }
    loop.push(a);
    // the steps of a drag along a path, composed as the tool composes them
    const steps = (ed, path) => {
        let r = null, m = null;
        for (let i = 1; i < path.length; i++) { r = ed.incrementalMoveMap(path[i - 1], path[i], m); m = r.m; }
        return r;
    };
    const round = steps(editor, loop);
    const d = mobiusDerivative(round.m, a), turn = Math.atan2(d[1], d[0]);
    // the hyperbolic area of the square: 4 r^2/(r^2 - |w - c|^2)^2 over it
    let area = 0;
    const N = 400, h = side/N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const dx = a[0] + (i + 0.5)*h - geo.c[0], dy = a[1] + (j + 0.5)*h - geo.c[1];
        area += 4*geo.r*geo.r/((geo.r*geo.r - dx*dx - dy*dy)**2)*h*h;
    }
    check(nearPt(round.map(a), a, 1e-9) && near(Math.abs(turn), area, 1e-3*area),
          `incremental: a loop fixes its start and turns the shape by the area it encloses: ${(turn*TODEG).toFixed(3)} degrees, the area ${(area*TODEG).toFixed(3)}`);
    const back = steps(editor, [...loop].reverse());
    const dBack = mobiusDerivative(back.m, a);
    check(near(Math.atan2(dBack[1], dBack[0]), -turn, 1e-9), 'the loop the other way round turns the shape the other way');
    console.log(`  incremental: a counterclockwise loop of side 0.3 turns the shape by ${(turn*TODEG).toFixed(2)} degrees (the enclosed area ${(area*TODEG).toFixed(2)} degrees); the direct move round it by 0`);
    // the direct move round the loop: the identity
    const direct = editor.anchoredMoveMap(a, a, loop[loop.length - 1]);
    check([[0.1, 0.2], [-0.3, 0.1]].every(q => nearPt(direct.map(q), q, 1e-12)), 'direct: a loop is the identity');
    // an open path: the grabbed point follows the pointer, the hyperbolic size of the item
    // is kept, the stroke follows the local scale; the path back restores the item
    const item = doc.insertItem(square(0.08, 0.05, 0.04));
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const first = doc.getItem(item.id);
    const open = loop.slice(0, 2*n + 1), end = open[open.length - 1];
    const fwd = steps(editor, open);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, first]]), fwd.map, true));
    const moved = doc.getItem(item.id);
    const size = it => geodesicDistance(geo, vertex(it, 0), vertex(it, 2));
    check(nearPt(fwd.map(a), end, 1e-10) && near(size(moved), size(first), 1e-9),
          `incremental: the grabbed point follows the pointer (${fmt(Math.hypot(fwd.map(a)[0] - end[0], fwd.map(a)[1] - end[1]))}), the size is kept (${size(moved)} against ${size(first)})`);
    const scale = density(geo, vertex(first, 0))/density(geo, fwd.map(vertex(first, 0)));
    check(near(moved.style.strokeWidth, 0.02*scale, 1e-8), `incremental: the stroke width follows the local scale ${scale.toFixed(6)}: ${moved.style.strokeWidth}`);
    const rev = steps(editor, [...open].reverse());
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, moved]]), rev.map, true));
    const restored = doc.getItem(item.id);
    const err = Math.max(...restored.points.map((x, i) => Math.abs(x - first.points[i])));
    check(err < 1e-9 && near(restored.style.strokeWidth, 0.02, 1e-9), `incremental: the path back restores the item (${fmt(err)})`);
    // in the plane the steps compose to the direct move, a translation
    const { editor: plane } = newEditor(g632, ptc);
    plane.setStyleValue('incremental', true);
    const planar = steps(plane, open), tr = plane.moveMap(a, end);
    check([[0.1, 0.2], [-0.3, 0.1], a].every(q => nearPt(planar.map(q), tr(q), 1e-12)), 'in the plane the steps compose to the direct move');
    // the geometry off: the same on the hyperbolic group
    editor.setStyleValue('geometry', false);
    const flat = steps(editor, open), trFlat = editor.moveMap(a, end);
    check([[0.1, 0.2], [-0.3, 0.1]].every(q => nearPt(flat.map(q), trFlat(q), 1e-12)), 'the geometry off: the steps compose to the plane\'s translation');
    editor.setStyleValue('geometry', true);
    // the setting is saved with the tool settings
    const saved = editor.getStyleParams().getValue();
    editor.getStyleParams().setValue({ ...saved, incremental: false });
    check(saved.incremental === true && editor.getStyleConfig().incremental === false, 'the setting is saved with the tool settings and restored from them');
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
