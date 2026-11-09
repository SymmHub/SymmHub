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
     grows by rows
  5. the shared builders (lib/symhublib/OverlayGeometry.js): the trace of an inversive
     splane (a circle off the plane, a plane), the arcs of a side as splane records, a
     CSS colour, the geometries merged
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

function newEditor(view){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: g237, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
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

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
