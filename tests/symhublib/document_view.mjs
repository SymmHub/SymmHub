/*
  tests of the document view's values (lib/symhublib/DocumentView.js;
  docs/document_view_plan.md, outside the repository)

    node tests/symhublib/document_view.mjs

  1. fitViewZoom: 'contain' shows the whole frame (wide, tall and square
     canvases and frames), 'cover' fills the canvas, 'exact' keeps the zoom;
     the frame on a canvas of its own shape keeps its zoom
  2. a document saved before the document view: no aspect, the legacy square
  3. a view is the canvas part alone (2026-11-19: the transforms are the
     document's content): pickView takes the euclidean keys of the navigator's
     values and copies them, nothing of the Moebius part, the sphere view or
     the maps; the place of the view (PLACE_PARTS, what back returns) is the
     canvas part and the Moebius transform, without its switch and the pole
  4. filePartValue: the view's keys in the live euclidean value, the aspect
     after them; a pick of the file value gives the view back; the stamp of a
     document view does not change with the transforms
  5. viewStamp: the same for a copy, another for any change
  6. the frame (3.7): its corners are the canvas's corners when the canvas has
     the frame's shape (CanvasTransform, turned too); frameLocal inverts
     framePoint; the outline; a corner dragged keeps the opposite one and the
     angle, Shift (keepAspect) the shape, minSide stops the corner; a turn by
     delta and the 15 degree steps; normalAngle
*/

import {
    VIEW_PARTS,
    PLACE_PARTS,
    LEGACY_ASPECT,
    pickView,
    filePartValue,
    fileAspect,
    validAspect,
    fitViewZoom,
    sameViewValue,
    viewStamp,
    frameAxes,
    frameSize,
    framePoint,
    frameLocal,
    frameCorners,
    frameOutline,
    movedFrame,
    resizedFrame,
    turnedFrame,
    normalAngle,
    FRAME_CORNERS,
} from '../../lib/symhublib/DocumentView.js';
import { CanvasTransform } from '../../lib/symhublib/CanvasTransform.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps;

// the world rectangle a zoom shows on a canvas: 2/zoom wide, height/width of it high
const shown = (zoom, w, h) => [2/zoom, (2/zoom)*h/w];

// 1 ───────────────────────────────────────────────────────────────────────────
for (const [w, h] of [[800, 500], [500, 800], [600, 600], [1920, 1080]]) {
    for (const aspect of [0.5, 1, 1.6, 9/16]) {
        const zoom = 1.7;
        const W = 2/zoom, H = W*aspect;
        const zc = fitViewZoom(zoom, aspect, w, h, 'contain');
        const [cw, ch] = shown(zc, w, h);
        check(cw >= W - 1e-12 && ch >= H - 1e-12, `contain shows the frame, ${w}x${h} aspect ${aspect}`);
        check(near(cw, W) || near(ch, H), `contain touches the frame, ${w}x${h} aspect ${aspect}`);
        const zv = fitViewZoom(zoom, aspect, w, h, 'cover');
        const [vw, vh] = shown(zv, w, h);
        check(vw <= W + 1e-12 && vh <= H + 1e-12, `cover inside the frame, ${w}x${h} aspect ${aspect}`);
        check(near(vw, W) || near(vh, H), `cover touches the frame, ${w}x${h} aspect ${aspect}`);
        check(fitViewZoom(zoom, aspect, w, h, 'exact') === zoom, `exact keeps the zoom, ${w}x${h}`);
    }
    // the frame of the canvas's own shape: the zoom as it is
    check(near(fitViewZoom(2.5, h/w, w, h, 'contain'), 2.5), `own shape contain ${w}x${h}`);
    check(near(fitViewZoom(2.5, h/w, w, h, 'cover'), 2.5), `own shape cover ${w}x${h}`);
}
// no aspect or no canvas: the zoom unchanged
check(fitViewZoom(3, null, 800, 500) === 3, 'no aspect');
check(fitViewZoom(3, 1, 0, 500) === 3, 'no canvas');
// a square frame on a wide canvas: zoomed out by the canvas's aspect
check(near(fitViewZoom(1, LEGACY_ASPECT, 1600, 900, 'contain'), 900/1600), 'square frame on a wide canvas');

// 2 ───────────────────────────────────────────────────────────────────────────
check(fileAspect({ centerX: 0, centerY: 0, zoom: 1, angle: 0 }) === null, 'a legacy document has no aspect');
check(fileAspect({ zoom: 1, aspect: 0.75 }) === 0.75, 'the aspect read');
check(fileAspect({ zoom: 1, aspect: -1 }) === null && fileAspect({ aspect: 'x' }) === null, 'a bad aspect refused');
check(validAspect('0.5') === 0.5, 'an aspect from a string');
check(LEGACY_ASPECT === 1, 'the legacy frame is square');

// 3 ───────────────────────────────────────────────────────────────────────────
const itrans = [{ type: 1, v: [0.1, 0.2, 0.3, 0.4] }, { type: 2, v: [1, 0, 0, 0.5] }];
const live = {
    euclidean:  { centerX: 0.3, centerY: -0.2, zoom: 2, angle: 15 },
    inversive:  { enabled: true, itrans, poleSet: true, poleX: 0.5, poleY: 0.25, anchored: { trans: itrans, word: [1, 2, 3] } },
    spherical:  { enabled: false },
    projection: { className: 'ProjectionTransform', params: { enabled: true, bandMap: { enabled: true, fraction: 0.3 } } },
};
const view = pickView(live);
check(Object.keys(VIEW_PARTS).join() === 'euclidean', 'a view is the canvas part alone');
check(Object.keys(view).join() === 'euclidean', 'the parts of a view picked');
check(sameViewValue(view.euclidean, live.euclidean), 'the euclidean part');
check(!('inversive' in view) && !('spherical' in view) && !('projection' in view), 'no transform in a view');
check(view.euclidean !== live.euclidean, 'the view is a copy');
live.euclidean.centerX = 9;
check(view.euclidean.centerX === 0.3, 'a change of the live value leaves the view');
live.euclidean.centerX = 0.3;
// the place of the view: the canvas part and the Moebius transform
const place = pickView(live, PLACE_PARTS);
check(Object.keys(place).join() === 'euclidean,inversive', 'the parts of a place');
check(Object.keys(place.inversive).join() === 'itrans,anchored', 'the Moebius transform without its switch and the pole');
check(sameViewValue(place.inversive.itrans, itrans) && place.inversive.itrans !== itrans, 'the place holds a copy of the transform');
check(sameViewValue(place.inversive.anchored, live.inversive.anchored), 'the anchored view in the place');
itrans[0].v[0] = 9;
check(place.inversive.itrans[0].v[0] === 0.1, 'a change of the live transform leaves the place');
itrans[0].v[0] = 0.1;

// 4 ───────────────────────────────────────────────────────────────────────────
const docView = pickView({
    euclidean:  { centerX: 1, centerY: 2, zoom: 0.5, angle: 0 },
    inversive:  { enabled: false, itrans: [], anchored: null },
    spherical:  { enabled: true },
    projection: { className: 'ProjectionTransform', params: { enabled: true } },
});
const eFile = filePartValue('euclidean', live.euclidean, docView, 0.75);
check(eFile.centerX === 1 && eFile.zoom === 0.5 && eFile.aspect === 0.75, 'the euclidean file value');
check(Object.keys(eFile).join() === 'centerX,centerY,zoom,angle,aspect', 'the aspect after the euclidean keys');
check(filePartValue('euclidean', live.euclidean, null, 1) === live.euclidean, 'no view: the live value');
const back = pickView({ euclidean: eFile, inversive: live.inversive, spherical: live.spherical, projection: live.projection });
check(sameViewValue(back, docView), 'the file values give the view back');
// a document view made under other transforms is the same view, with the same stamp
const docViewOther = pickView({
    euclidean:  { centerX: 1, centerY: 2, zoom: 0.5, angle: 0 },
    inversive:  live.inversive,
    spherical:  { enabled: false },
    projection: live.projection,
});
check(sameViewValue(docViewOther, docView), 'the transforms are no part of the document view');
check(viewStamp({ view: docViewOther, aspect: 0.75 }) === viewStamp({ view: docView, aspect: 0.75 }), 'nor of its stamp');

// 5 ───────────────────────────────────────────────────────────────────────────
// the stamp: equal for the same view, another for any change
{
    const dv = { view: docView, aspect: 0.75 };
    const s = viewStamp(dv);
    check(typeof s === 'string' && s === viewStamp(JSON.parse(JSON.stringify(dv))), 'the stamp of a copy');
    check(viewStamp({ ...dv, aspect: 0.7500001 }) !== s, 'another aspect, another stamp');
    const moved = JSON.parse(JSON.stringify(dv)); moved.view.euclidean.centerX += 1e-12;
    check(viewStamp(moved) !== s, 'a moved centre, another stamp');
    check(viewStamp(null) === viewStamp(undefined), 'no view');
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
    const nearP = (a, b, eps = 1e-12) => Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
    // the frame of a view on a canvas of its shape is the canvas: its corners the canvas's
    for (const angle of [0, 20, -135, 90]) {
        const W = 800, H = 480;
        const ct = CanvasTransform({ width: W, height: H, center: [0.3, -0.7], zoom: 1.6, angle: angle*Math.PI/180 });
        const e = { centerX: 0.3, centerY: -0.7, zoom: 1.6, angle };
        const aspect = H/W;
        // the canvas's corners, from the bottom left counterclockwise (screen y down)
        const pix = [[0, H], [W, H], [W, 0], [0, 0]];
        const corners = frameCorners(e, aspect);
        check(pix.every((q, k) => nearP(ct.screen2world(q), corners[k], 1e-12)), `the frame's corners are the canvas's, angle ${angle}`);
        check(nearP(ct.screen2world([W/2, H/2]), framePoint(e, aspect, 0, 0)), `the centre, angle ${angle}`);
        // a canvas pixel's (u, v)
        const q = ct.screen2world([200, 120]);
        const uv = frameLocal(e, aspect, q);
        check(near(uv[0], -0.5, 1e-12) && near(uv[1], 0.5, 1e-12), `frameLocal of a pixel, angle ${angle}`);
        check(nearP(framePoint(e, aspect, uv[0], uv[1]), q), `framePoint inverts frameLocal, angle ${angle}`);
    }
    const e = { centerX: 1, centerY: 2, zoom: 0.5, angle: 30 }, aspect = 0.6;
    const [w, h] = frameSize(e, aspect);
    check(near(w, 4) && near(h, 2.4), 'the frame size');
    const { ex, ey } = frameAxes(30);
    check(near(ex[0]*ey[0] + ex[1]*ey[1], 0) && near(Math.hypot(...ex), 1), 'the axes');
    // the outline: n points a side, from the first corner, counterclockwise (positive area)
    const ol = frameOutline(e, aspect, 8);
    check(ol.length === 32 && nearP(ol[0], frameCorners(e, aspect)[0]) && nearP(ol[8], frameCorners(e, aspect)[1]), 'the outline');
    let area = 0;
    for (let i = 0; i < ol.length; i++) { const a = ol[i], b = ol[(i + 1) % ol.length]; area += a[0]*b[1] - b[0]*a[1]; }
    check(near(area/2, w*h, 1e-9), 'the outline encloses the frame counterclockwise');
    check(nearP(framePoint(movedFrame(e, [0.5, -1]), aspect, 0, 0), [1.5, 1]), 'moved');
    // a corner dragged: the opposite corner stays, the angle too, the corner at the point
    for (const [su, sv] of FRAME_CORNERS) {
        const opp = framePoint(e, aspect, -su, -sv);
        const p = framePoint(e, aspect, su*1.4, sv*0.8);
        const r = resizedFrame(e, aspect, [su, sv], p);
        check(nearP(framePoint(r.euclidean, r.aspect, -su, -sv), opp, 1e-12), `the opposite corner stays, ${su} ${sv}`);
        check(nearP(framePoint(r.euclidean, r.aspect, su, sv), p, 1e-12), `the corner at the point, ${su} ${sv}`);
        check(r.euclidean.angle === 30, 'the angle kept');
        check(near(frameSize(r.euclidean, r.aspect)[0], w*1.2, 1e-12) && near(frameSize(r.euclidean, r.aspect)[1], h*0.9, 1e-12), `the new sides, ${su} ${sv}`);
        // Shift: the shape kept, the larger change
        const k = resizedFrame(e, aspect, [su, sv], p, true);
        check(near(k.aspect, aspect, 1e-12) && near(frameSize(k.euclidean, k.aspect)[0], w*1.2, 1e-12), `the shape kept, ${su} ${sv}`);
        check(nearP(framePoint(k.euclidean, k.aspect, -su, -sv), opp, 1e-12), `the shape kept about the opposite corner, ${su} ${sv}`);
        // past the opposite corner: stopped at minSide
        const past = resizedFrame(e, aspect, [su, sv], framePoint(e, aspect, -su*1.5, -sv*1.5), false, 0.1);
        const ps = frameSize(past.euclidean, past.aspect);
        check(near(ps[0], 0.1, 1e-12) && near(ps[1], 0.1, 1e-12), `stopped at minSide, ${su} ${sv}`);
    }
    // a turn: the centre stays, the frame turns by delta in the world
    const t = turnedFrame(e, 15);
    check(t.angle === 15 && t.centerX === 1 && t.centerY === 2, 'turned');
    const c0 = framePoint(e, aspect, 1, 0), c1 = framePoint(t, aspect, 1, 0);
    const a0 = Math.atan2(c0[1] - 2, c0[0] - 1), a1 = Math.atan2(c1[1] - 2, c1[0] - 1);
    check(near(normalAngle((a1 - a0)*180/Math.PI), 15, 1e-9), 'the frame turned counterclockwise by delta');
    check(turnedFrame(e, 8, 15).angle === 15 && turnedFrame(e, 23, 15).angle === 0, 'the 15 degree steps');
    check(normalAngle(190) === -170 && normalAngle(-180) === 180 && normalAngle(540) === 180 && normalAngle(-0.5) === -0.5, 'normalAngle');
}

if (failed) {
    console.log(`document_view: ${failed} FAILED`);
    process.exit(1);
}
console.log('document_view: all passed');
