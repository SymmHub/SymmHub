/*
  tests of the editing overlay as geometry (DrawingEditor's builders, the packing of
  lib/symhublib/EditingOverlay.js for the GPU pass of lib/shaders/overlay_editing.glsl.mjs)

    node tests/drawlib/overlay_geometry.mjs

  1. itemWorldPath: a closed polyline's own points with the first repeated; on a copy the
     segments are subdivided; a compound path's rings are separated by a null, which
     outlineGeometry splits into polylines
  2. the builders: an outline's style, the handles' kinds and sizes, the transform box's
     frame and glyphs, the snap marker's colour by kind, the container when inside one
  3. pxDistance: by the view's scale at the canvas point when the view has one, by the
     pixel size otherwise
  4. packGeometry: the texels read back as the shader reads them: the headers, the
     directory, each polyline's header, colours (premultiplied), halo, box and points,
     each point's four texels, each splane's five; empty polylines, points without a
     place and splanes without a trace are left out; the texture is EDIT_TEX_W wide and
     grows by rows. From an origin (the view's centre): the points, boxes, circles' centres
     and lines' offsets and ranges taken from it in double, a circle with the power of the
     origin; the shader's distances (emulated in float) then exact at a deep zoom next to
     the absolute (a pixel 2.5e-9 at |w| ~ 1: from the world's origin they are off by
     pixels) and to a circle of radius 1e4 (a Dirichlet side that is nearly a line)
  5. the shared builders (lib/symhublib/OverlayGeometry.js): the trace of an inversive
     splane (a circle off the plane, a plane), the arcs of a side as splane records, a
     CSS colour, the geometries merged
  6. the pixels of the editor's tolerances by the view's scale at the pointer's canvas
     point: the pick tolerance of hitTest, the snap radius (its index rebuilt for another
     octave of the radius only), the fit tolerance; a place without a scale falls back
     to the pixel size; next to the limit set, where the fold magnifies the snap radius
     without bound, the snap query stays quick and still finds a vertex's copy
*/

import { Group_KLM } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { packGeometry } from '../../lib/symhublib/EditingOverlay.js';
import { splaneTrace, splaneGeometry, cssColor, mergeGeometry, newGeometry as newGeo, discGeometry } from '../../lib/symhublib/OverlayGeometry.js';
import { iSphere, iPlane } from '../../lib/invlib/invlib.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;   // the texels are float32
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;

const mk = new Group_KLM({});
Object.assign(mk.params, { K: 2, L: 3, M: 7, s: true, hasR: false });
const g237 = mk.getGroup();

function newEditor(view, group = g237){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: view || { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}
const square = (cx, cy, h) => ({ type: 'polyline', closed: true, points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
                                 style: { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.02, fill: null } });

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const item = doc.insertItem(square(0.1, 0.05, 0.1));
    const path = editor.itemWorldPath(doc.getItem(item.id), null);
    check(path.length === 5 && nearPt(path[0], [0, -0.05]) && nearPt(path[4], path[0]), `a closed polyline's world path: ${path.length} points, the first repeated`);
    // on a copy: the frame of a generator; 8 points a segment
    const frameInv = g237.revITransforms[0];
    const onCopy = editor.itemWorldPath(doc.getItem(item.id), frameInv);
    check(onCopy.length === 4*8 + 1 && !nearPt(onCopy[0], path[0], 1e-6), `on a copy the segments are subdivided: ${onCopy.length} points`);
    // a compound path: two rings, a bridge between them
    const ring = (cx, cy, h) => [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h];
    const compound = doc.insertItem({ type: 'path', closed: true, points: [...ring(0, 0, 0.3), ...ring(0, 0, 0.1)],
        nodes: [...ring(0, 0, 0.3), ...ring(0, 0, 0.1)].reduce((a, v, i, arr) => (i % 2 ? a : [...a, { p: [arr[i], arr[i + 1]], h1: null, h2: null }]), []),
        rings: [0, 4], style: { stroke: { rgba: [0, 0, 1, 1] }, strokeWidth: 0.02, fill: null } });
    const geo = editor.newGeometry();
    editor.outlineGeometry(geo, editor.itemWorldPath(doc.getItem(compound.id), null));
    check(geo.polylines.length >= 1 && geo.polylines.every(pl => pl.points.length >= 2), `a compound path gives ${geo.polylines.length} polyline(s)`);
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const item = doc.insertItem(square(0.1, 0.05, 0.1));
    const geo = editor.newGeometry();
    editor.outlineGeometry(geo, editor.itemWorldPath(doc.getItem(item.id), null));
    const pl = geo.polylines[0];
    check(geo.polylines.length === 1 && pl.width === 1.5 && pl.dash === 6 && pl.gap === 4 && pl.halo && pl.haloWidth === 4 && pl.points.length === 5, 'the outline style');
    editor.handleGeometry(geo, [0.1, 0.1], false, false);
    editor.handleGeometry(geo, [0.2, 0.1], true, true);
    editor.shapeHandleGeometry(geo, [0.3, 0.1]);
    editor.controlHandleGeometry(geo, [0, 0], [0.05, 0.05]);
    editor.snapGeometry(geo, { wpnt: [0.4, 0.1], kind: 'vertex' });
    editor.snapGeometry(geo, { wpnt: [0.4, 0.2], kind: 'mirror' });
    editor.snapGeometry(geo, null);
    const kinds = geo.points.map(p => p.kind);
    check(JSON.stringify(kinds) === JSON.stringify(['square', 'disc', 'diamond', 'disc', 'disc', 'disc']) && geo.points[0].size === 4 && geo.points[1].size === 5
          && geo.points[1].fill === geo.points[1].color && geo.points[2].size === 6 && geo.polylines.length === 2 && geo.points[4].color[0] > 0.8 && geo.points[5].color[2] > 0.6,
          `the handles' kinds and sizes: ${kinds}`);
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]], sides = [[0.5, 0], [1, 0.5]];
    const box = editor.newGeometry();
    editor.transformBoxGeometry(box, corners, sides, [0.5, 0.5]);
    check(box.polylines.length === 1 && box.polylines[0].points.length === 5 && box.polylines[0].halo && box.points.length === 2*4 + 2*2 + 6,
          `the transform box: ${box.polylines.length} polyline, ${box.points.length} glyphs`);
    const c = editor.newGeometry();
    editor.containerGeometry(c);
    check(c.polylines.length === 0, 'no container: nothing');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const plain = newEditor().editor;
    check(near(plain.pxDistance([0, 0], [0.003, 0.004], [10, 10]), 5), 'pxDistance by the pixel size');
    const scaled = newEditor({ toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => false, pixelSize: () => 0.001, scaleAt: c => c[0] > 100 ? 0.002 : 0.001 }).editor;
    check(near(scaled.pxDistance([0, 0], [0.003, 0.004], [200, 10]), 2.5) && near(scaled.pxDistance([0, 0], [0.003, 0.004], [10, 10]), 5) && near(scaled.pxDistance([0, 0], [0.003, 0.004], null), 5),
          'pxDistance by the view\'s scale at the canvas point');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const geometry = {
        polylines: [
            { points: [[0, 0], [1, 0], [1, 1]], width: 2, color: [1, 0, 0, 0.5], dash: 6, gap: 4, halo: [1, 1, 1, 0.8], haloWidth: 4, closed: true },
            { points: [[5, 5]] },                               // left out: one point
            { points: [[2, 2], [3, 4]], color: [0, 0, 1, 1] },
        ],
        points: [
            { p: [0.5, 0.5], kind: 'square', size: 4, color: [0, 0, 1, 1], fill: [1, 1, 1, 0.5], width: 1.5 },
            { kind: 'disc' },                                    // left out: no place
            { p: [2, 2], kind: 'cross', size: 14, color: [0, 0, 0, 1], width: 3 },
        ],
    };
    const packed = packGeometry(geometry);
    const T = i => Array.from(packed.data.slice(4*i, 4*i + 4));
    const head = T(0);
    check(packed.polylines === 2 && packed.points === 2 && head[0] === 2 && head[1] === 2 && head[2] === 2, `the header ${head}`);
    const off0 = T(head[2])[0], off1 = T(head[2] + 1)[0];
    check(off0 === 4 && off1 === off0 + 5 + 3, `the directory: ${off0}, ${off1}`);
    const h0 = T(off0), col = T(off0 + 1), halo = T(off0 + 2), h3 = T(off0 + 3), box = T(off0 + 4);
    check(h0[0] === 3 && h0[1] === 2 && h0[2] === 6 && h0[3] === 4, `polyline header ${h0}`);
    check(near(col[0], 0.5) && col[1] === 0 && near(col[3], 0.5), `the colour premultiplied ${col}`);
    check(near(halo[0], 0.8) && near(halo[3], 0.8) && h3[0] === 4 && h3[1] === 1, `the halo ${halo}, ${h3}`);
    check(box[0] === 0 && box[1] === 0 && box[2] === 1 && box[3] === 1, `the box ${box}`);
    check(T(off0 + 5)[0] === 0 && T(off0 + 6)[0] === 1 && T(off0 + 7)[1] === 1, 'the points of the polyline');
    const h1 = T(off1), c1 = T(off1 + 1), halo1 = T(off1 + 2), g1 = T(off1 + 3);
    check(h1[0] === 2 && h1[1] === 1 && h1[2] === 0 && halo1[3] === 0 && g1[0] === 3.5 && g1[1] === 0 && c1[2] === 1, `the second polyline's defaults ${h1} ${g1}`);
    const pb = head[3];
    check(pb === off1 + 5 + 2, `the points start at ${pb}`);
    const p0 = T(pb), s0 = T(pb + 1), f0 = T(pb + 2), w0 = T(pb + 3);
    check(p0[0] === 0.5 && p0[2] === 1 && p0[3] === 4 && s0[2] === 1 && near(f0[0], 0.5) && near(f0[3], 0.5) && w0[0] === 1.5, `the square's texels ${p0} ${f0} ${w0}`);
    const p1 = T(pb + 4);
    check(p1[2] === 3 && p1[3] === 14 && T(pb + 6)[3] === 0 && T(pb + 7)[0] === 3, 'the cross: kind 3, no fill, width 3');
    check(packed.texels === pb + 8 && packed.rows === 1 && packed.data.length === 2048*4 && T(1)[0] === 0 && T(1)[1] === pb + 8, `the texture: ${packed.texels} texels in ${packed.rows} row, no splanes ${T(1)}`);
    // splanes: a circle, a line's ray, one without a trace left out
    const withSplanes = packGeometry({ points: [{ p: [1, 1] }], splanes: [
        { circle: [1, 2, 3], range: null, width: 2, color: [1, 0, 0, 0.5], dash: 5, gap: 5 },
        { line: [0, 1, 0.5], range: [-Infinity, 2], width: 3, color: [0, 0, 1, 1], halo: [1, 1, 1, 0.5], haloWidth: 7 },
        { range: null },
    ] });
    const S = i => Array.from(withSplanes.data.slice(4*i, 4*i + 4));
    const sh = S(1);
    check(withSplanes.splanes === 2 && sh[0] === 2 && sh[1] === 2 + 4, `the splanes' header ${sh}`);
    const sc0 = S(sh[1]), sc1 = S(sh[1] + 1), sc3 = S(sh[1] + 3), sc4 = S(sh[1] + 4);
    check(sc0[0] === 0 && sc0[1] === 2 && sc0[2] === 5 && sc0[3] === 5 && near(sc1[0], 0.5) && sc1[1] === 0 && sc3[0] === 0 && sc3[1] === 0 && sc4[0] === 1 && sc4[1] === 2 && sc4[2] === 3,
          `the circle's texels ${sc0} ${sc1} ${sc3} ${sc4}`);
    const l0 = S(sh[1] + 5), l2 = S(sh[1] + 7), l3 = S(sh[1] + 8), l4 = S(sh[1] + 9);
    check(l0[0] === 1 && l0[1] === 3 && l0[2] === 0 && near(l2[3], 0.5) && l3[0] === 7 && l3[1] === 1 && l3[2] < -1e29 && l3[3] === 2 && l4[1] === 1 && l4[2] === 0.5,
          `the ray's texels ${l0} ${l3} ${l4}`);
    check(withSplanes.texels === sh[1] + 10, `the texture ends after the splanes: ${withSplanes.texels}`);
    // many points: more rows
    const big = packGeometry({ polylines: [], points: Array.from({ length: 600 }, (_, i) => ({ p: [i, 0] })) });
    check(big.rows === 2 && big.data.length === 2*2048*4, `600 points take ${big.rows} rows`);
    const none = packGeometry({ polylines: [{ points: [[0, 0]] }], points: [] });
    check(none.polylines === 0 && none.points === 0, 'nothing to draw');
}

// 4, from an origin ───────────────────────────────────────────────────────────

{
    const f = Math.fround;
    // the shader's distances, in float as the GPU computes them, from the texels
    const segDist = (w, a, b) => {
        const abx = f(b[0] - a[0]), aby = f(b[1] - a[1]);
        const L2 = f(f(abx*abx) + f(aby*aby));
        const t = Math.min(1, Math.max(0, L2 > 0 ? f(f(f(f(w[0] - a[0])*abx) + f(f(w[1] - a[1])*aby))/L2) : 0));
        const dx = f(w[0] - f(a[0] + f(t*abx))), dy = f(w[1] - f(a[1] + f(t*aby)));
        return f(Math.sqrt(f(f(dx*dx) + f(dy*dy))));
    };
    const circleDist = (w, g) => {
        const dx = f(w[0] - g[0]), dy = f(w[1] - g[1]);
        const dist = f(Math.sqrt(f(f(dx*dx) + f(dy*dy))));
        const num = f(f(f(f(w[0]*w[0]) + f(w[1]*w[1])) - f(2*f(f(w[0]*g[0]) + f(w[1]*g[1])))) + g[3]);
        return Math.abs(f(num/f(dist + g[2])));
    };
    const plainCircleDist = (w, g) => Math.abs(f(f(Math.sqrt(f(f(f(w[0] - g[0])**2) + f(f(w[1] - g[1])**2)))) - g[2]));
    const lineDist = (w, g) => Math.abs(f(f(f(w[0]*g[0]) + f(w[1]*g[1])) - g[2]));
    const segExact = (w, a, b) => {
        const abx = b[0] - a[0], aby = b[1] - a[1];
        const t = Math.min(1, Math.max(0, ((w[0] - a[0])*abx + (w[1] - a[1])*aby)/(abx*abx + aby*aby)));
        return Math.hypot(w[0] - a[0] - t*abx, w[1] - a[1] - t*aby);
    };

    // a selected copy's frame at zoom 8e5 next to the unit circle (a deep zoom of 237): a
    // pixel is 2.5e-9 there, a float near 1 keeps 6e-8
    const O = [0.025900119576587232, -0.9996643758027056];
    const px = 2.5e-9;
    const at = (x, y) => [O[0] + x*px, O[1] + y*px];
    const frame = [at(-40, -30), at(50, -30), at(50, 35), at(-40, 35)];
    const n = [0.6, 0.8];
    const geo = {
        polylines: [{ points: frame, closed: true }],
        points: [{ p: frame[1], kind: 'square' }],
        splanes: [
            { circle: [O[0] + 0.3, O[1] + 0.4 + 7*px, 0.5] },                          // 7 px above the centre
            { line: [n[0], n[1], n[0]*O[0] + n[1]*O[1] + 3*px], range: [-Infinity, 2] },  // 3 px from the centre
        ],
    };
    const packed = packGeometry(geo, O);
    const T = i => Array.from(packed.data.slice(4*i, 4*i + 4));
    const off = T(T(0)[2])[0];
    const box = T(off + 4), p0 = T(off + 5), p2 = T(off + 7);
    const fr = p => [f(p[0]), f(p[1])];
    check(nearPt(p0, fr([-40*px, -30*px]), 1e-15) && nearPt(p2, fr([50*px, 35*px]), 1e-15), `the frame from the origin ${p0} ${p2}`);
    check(nearPt([box[0], box[1]], p0, 1e-15) && nearPt([box[2], box[3]], p2, 1e-15), `the frame's box from the origin ${box}`);
    const pt = T(T(0)[3]);
    check(nearPt(pt, fr([50*px, -30*px]), 1e-15), `the handle from the origin ${pt}`);
    const sb = T(1)[1];
    const gc = T(sb + 4), r3 = T(sb + 8), gl = T(sb + 9);
    check(near(gc[0], 0.3, 1e-7) && near(gc[1], 0.4, 1e-7) && gc[2] === 0.5 && near(gc[3], f(0.09 + (0.4 + 7*px)**2 - 0.25), 1e-12),
          `the circle from the origin, with the origin's power ${gc}`);
    // the line's offset from the origin; its range along t = (-ny, nx) less t.o, the infinite end kept
    const tO = -n[1]*O[0] + n[0]*O[1];
    check(gl[0] === f(0.6) && near(gl[2], 3*px, 1e-15) && r3[2] < -1e29 && near(r3[3], f(2 - tO), 1e-6), `the line from the origin ${gl} ${r3}`);
    {
        // the position along the line from the range's start is the same in both frames
        const w = at(17, -4), wr = [17*px, -4*px];
        const d = n[0]*O[0] + n[1]*O[1] + 3*px, dr = 3*px;
        const along = (p, dd) => (p[0] - n[0]*dd)*(-n[1]) + (p[1] - n[1]*dd)*n[0];
        check(Math.abs((along(w, d) - 2) - (along(wr, dr) - (2 - tO))) < 1e-12, 'a ranged line keeps its positions');
    }
    // the shader's distances at pixels near the frame, the circle and the line: from the
    // origin within a hundredth of a pixel; from the world's origin off by pixels
    const flat = packGeometry(geo);
    const F = i => Array.from(flat.data.slice(4*i, 4*i + 4));
    const fOff = F(F(0)[2])[0];
    const fb = F(1)[1];
    let worstNear = 0, worstFar = 0;
    for (const [x, y] of [[10.5, -30.2], [-12.3, 34.6], [50.4, 0.7], [-39.1, -1.3], [3.3, 7.4], [-6.8, 2.9]]) {
        const w = at(x, y);
        const exact = Math.min(...[0, 1, 2, 3].map(k => segExact(w, frame[k], frame[(k + 1) % 4])))/px;
        const fromOrigin = Math.min(...[0, 1, 2, 3].map(k => segDist([f(x*px), f(y*px)], T(off + 5 + k), T(off + 5 + (k + 1) % 4))))/px;
        const fromZero = Math.min(...[0, 1, 2, 3].map(k => segDist([f(w[0]), f(w[1])], F(fOff + 5 + k), F(fOff + 5 + (k + 1) % 4))))/px;
        const cExact = Math.abs(Math.hypot(w[0] - geo.splanes[0].circle[0], w[1] - geo.splanes[0].circle[1]) - 0.5)/px;
        const cOrigin = circleDist([f(x*px), f(y*px)], gc)/px;
        const cZero = plainCircleDist([f(w[0]), f(w[1])], F(fb + 4))/px;
        const lExact = Math.abs(n[0]*w[0] + n[1]*w[1] - geo.splanes[1].line[2])/px;
        const lOrigin = lineDist([f(x*px), f(y*px)], gl)/px;
        const lZero = lineDist([f(w[0]), f(w[1])], F(fb + 9))/px;
        worstNear = Math.max(worstNear, Math.abs(fromOrigin - exact), Math.abs(cOrigin - cExact), Math.abs(lOrigin - lExact));
        worstFar = Math.max(worstFar, Math.abs(fromZero - exact), Math.abs(cZero - cExact), Math.abs(lZero - lExact));
    }
    check(worstNear < 0.01, `from the view's centre the shader's distances are exact: off by ${worstNear.toFixed(4)} px`);
    check(worstFar > 1, `from the world's origin they are off by pixels: ${worstFar.toFixed(1)} px`);

    // a circle of radius 1e4 (a Dirichlet side that is nearly a line) at zoom 1.7: a pixel
    // 1.2e-3; the float of |w - c| keeps 5e-4 there, the origin's power gives it exactly
    const big = { circle: [3.4158449, 7708.4238, 7708.2949] };
    const gb = Array.from(packGeometry({ splanes: [big] }).data.slice(4*6, 4*6 + 4));
    const pb = 1.2e-3;
    let worstPower = 0, worstPlain = 0;
    for (const [x, y] of [[0.31, 0.25], [-0.42, 0.11], [0.05, -0.37], [0.2, 0.3]]) {
        // a point about a pixel off the circle near its lowest point
        const w = [big.circle[0] + x, big.circle[1] - big.circle[2] + y*pb];
        const exact = Math.abs(Math.hypot(w[0] - big.circle[0], w[1] - big.circle[1]) - big.circle[2])/pb;
        worstPower = Math.max(worstPower, Math.abs(circleDist([f(w[0]), f(w[1])], gb)/pb - exact));
        worstPlain = Math.max(worstPlain, Math.abs(plainCircleDist([f(w[0]), f(w[1])], gb)/pb - exact));
    }
    check(worstPower < 0.01, `a circle of radius 1e4 by the origin's power: off by ${worstPower.toFixed(4)} px`);
    check(worstPlain > 0.05, `by |w - c| - r in float: off by ${worstPlain.toFixed(3)} px`);
}


// 5 ───────────────────────────────────────────────────────────────────────────

{
    const circle = splaneTrace(iSphere([1, 2, 0, 3]));
    const lifted = splaneTrace(iSphere([0, 0, 3, 5]));       // a sphere off the plane: its trace has radius 4
    const plane = splaneTrace(iPlane([0, 1, 0, 0.5]));        // the line y = 0.5
    const none = splaneTrace(iSphere([0, 0, 5, 3]));          // no trace
    check(circle && circle.circle && circle.circle[0] === 1 && circle.circle[2] === 3, `a circle's trace ${JSON.stringify(circle)}`);
    check(lifted && near(lifted.circle[2], 4), `a lifted sphere's trace ${JSON.stringify(lifted)}`);
    check(plane && plane.line && near(plane.line[1], 1) && near(plane.line[2], 0.5), `a plane's trace ${JSON.stringify(plane)}`);
    check(none === null && splaneTrace(null) === null, 'no trace');
    const geo = newGeo();
    splaneGeometry(geo, iSphere([0, 0, 0, 1]), { width: 3, color: [1, 0, 0, 1] });
    splaneGeometry(geo, iSphere([0, 0, 0, 1]), { width: 10, color: [1, 0, 0, 0.25] }, [[0, Math.PI], [2, 2], [3, 4]]);
    splaneGeometry(geo, iSphere([0, 0, 5, 3]), { width: 1 }, [[0, 1]]);
    check(geo.splanes.length === 3 && geo.splanes[0].range === null && geo.splanes[1].range[1] === Math.PI && geo.splanes[2].range[0] === 3 && geo.splanes[1].width === 10,
          `the arcs as splane records: ${geo.splanes.length}`);
    const col = cssColor('#7000D080');
    check(near(col[0], 0x70/255) && col[1] === 0 && near(col[2], 0xD0/255) && near(col[3], 0x80/255) && cssColor('#FF0000')[3] === 1 && cssColor('#FF0000', 0.5)[3] === 0.5, `a CSS colour ${col}`);
    const other = newGeo();
    discGeometry(other, [1, 1], { size: 7, fill: [1, 1, 0, 1], color: [0, 0, 0, 1], width: 1.5 });
    const merged = mergeGeometry(geo, null, other, { polylines: [{ points: [[0, 0], [1, 1]] }] });
    check(merged.splanes.length === 3 && merged.points.length === 1 && merged.polylines.length === 1 && merged.points[0].kind === 'disc' && merged.points[0].size === 7, 'the geometries merged');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    // a view whose pixels are ten times larger right of x = 100, and without a scale below y = 100
    const view = { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => false, pixelSize: () => 0.001,
                   scaleAt: c => c[1] > 100 ? NaN : (c[0] > 100 ? 0.01 : 0.001) };
    const { doc, editor } = newEditor(view, null);
    // a square of half side 0.1, its stroke 0.02 wide: painted to 0.11 from the centre
    const item = doc.insertItem(square(0, 0, 0.1));
    const hitId = (w, canvas) => { const hit = editor.hitTest(w, canvas); return hit ? hit.item.id : null; };
    // 0.03 beyond the stroke: 6 pixels of 0.001 do not reach it, 6 pixels of 0.01 do
    check(hitId([0.14, 0], [10, 10]) === null && hitId([0.14, 0], null) === null, 'not picked 0.03 away through small pixels');
    check(hitId([0.14, 0], [200, 10]) === item.id, 'picked 0.03 away through pixels ten times larger');
    check(hitId([0.114, 0], [10, 10]) === item.id && hitId([0.114, 0], null) === item.id, 'picked within the small pixels\' reach');
    check(hitId([0.14, 0], [200, 200]) === null, 'a place without a scale: the pixel size');
    check(editor.hitTest([0.14, 0], [200, 10], 0) === null, 'no tolerance, no reach');
    // the snap radius, 10 pixels: 0.05 from the corner (0.1, 0.1)
    const far = editor.snap([0.15, 0.1], null, [10, 10]);
    const reached = editor.snap([0.15, 0.1], null, [200, 10]);
    check(far === null && reached && reached.kind === 'vertex' && nearPt(reached.wpnt, [0.1, 0.1]), 'the snap radius follows the scale at the pointer');
    const close = editor.snap([0.105, 0.1], null, [10, 10]);
    check(close && nearPt(close.wpnt, [0.1, 0.1]) && editor.snap([0.15, 0.1], null, null) === null, 'and the index follows the radius back');
    // the fit tolerance
    check(near(editor.fitTolerance([200, 10]), 10*editor.fitTolerance([10, 10])) && near(editor.fitTolerance(null), editor.fitTolerance([10, 10]))
          && near(editor.fitTolerance([10, 200]), editor.fitTolerance(null)), 'the fit tolerance by the scale at the canvas point');

    // *237, next to the unit circle: the radius in the domain is hundreds of cells wide
    const hyp = newEditor();
    const sq = hyp.doc.insertItem(square(0.1, 0.05, 0.1));
    const t0 = Date.now();
    let found = 0;
    for (let i = 0; i < 40; i++) if (hyp.editor.snap([0.9995*Math.cos(i), 0.9995*Math.sin(i)], null, null)) found++;
    const ms = Date.now() - t0;
    check(ms < 1000, 'snap queries next to the limit set are quick: 40 in ' + ms + ' ms');
    // a copy of the square's corner (0, -0.05) far out: the corner mapped by a word of the generators
    const corner = [0, -0.05];
    let copy = corner;
    // the product of the three reflections is a glide: its powers take the point out
    for (let i = 0; i < 12; i++) copy = hyp.editor.mapWorld(g237.revITransforms[i % 3], copy);
    const at = hyp.editor.snap(copy, null, null);
    check(Math.hypot(copy[0], copy[1]) > 0.5 && at && at.kind === 'vertex' && at.itemId === sq.id && nearPt(at.wpnt, copy, 1e-6),
          'a copy of a vertex is found at ' + Math.hypot(copy[0], copy[1]).toFixed(4) + ' from the centre');
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
