/*
  tests of the group transform's frame, the Symmetry tool's transform handles
  (lib/symhublib/GroupTransformFrame.js, GroupTransformTool.js, sym_utils.js;
  docs/symmetry_tool_plan.md sections 4 and 15, outside the repository)

    node tests/symhublib/group_transform_frame.mjs

  1. the maps of the stored numbers are the ITransform the renderer applies to the
     group (transformGroup: the translation, the rotation, the scale) and inverse to
     each other
  2. the frame (its centre c = g(a) for an anchor a, the angle, the scale) gives the
     stored numbers back, and a turn or a scaling about the anchor keeps c; frameBox
     widens the domain's box by the pad, to the least half size, about its centre;
     transformFrame carries the box's corners and centre by g
  3. a drag of the centre moves it with the pointer and keeps the angle and scale;
     the grabbed point stays under the pointer
  4. a drag of a corner turns and scales about the frame's centre by the pointer's
     turn and distance ratio, the centre stays and the corner grabbed stays under the
     pointer; a turn past half a circle goes on; Shift turns only, in 15 degree steps;
     Alt scales only
  5. transformSplane carries a circle and the ends of its arc with the points, keeps
     the label, and carries a line
  6. the tool with a view of its own: the frame stands 12 pixels outside the domain's
     box, at least 16 from the centre to a side, round the origin without a domain; a
     press on the centre or a corner is taken, a move sets the numbers, the corner
     grabbed stays under the pointer, Escape puts the numbers back, a tool not active
     takes nothing, the frame's inside takes no press, the geometry is where the frame
     is
*/

import { iPoint, iSphere, iPlane } from '../../lib/invlib/invlib.js';
import {
    groupTransformMaps, transformFromFrame, frameBox, transformFrame, startFrameDrag, frameDragTo,
} from '../../lib/symhublib/GroupTransformFrame.js';
import { GroupTransformTool } from '../../lib/symhublib/GroupTransformTool.js';
import { groupTransformITransform, transformSplane } from '../../lib/symhublib/sym_utils.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearP = (p, q, eps = 1e-9) => near(p[0], q[0], eps) && near(p[1], q[1], eps);
const TORAD = Math.PI/180;

const CONFS = [
    { translationX: 0, translationY: 0, rotation: 0, scale: 1 },
    { translationX: 0.3, translationY: -0.2, rotation: 40, scale: 1.6 },
    { translationX: -1.1, translationY: 0.45, rotation: -135, scale: 0.37 },
    { translationX: 0.01, translationY: 2, rotation: 270, scale: 12 },
];
const ANCHORS = [[0, 0], [0.3, -0.1], [-0.25, 0.6]];
const params = (c) => ({ translation: [c.translationX, c.translationY], rotation: c.rotation*TORAD, scale: c.scale });
// the point p turned by a degrees and scaled by k about c
const turnAbout = (c, p, a, k = 1) => {
    const v = [p[0] - c[0], p[1] - c[1]], r = a*TORAD;
    return [c[0] + k*(Math.cos(r)*v[0] - Math.sin(r)*v[1]), c[1] + k*(Math.sin(r)*v[0] + Math.cos(r)*v[1])];
};

// 1 ───────────────────────────────────────────────────────────────────────────

for (const conf of CONFS) {
    const m = groupTransformMaps(conf);
    const tr = groupTransformITransform(params(conf));
    for (const p of [[0, 0], [1, 0], [0.2, 0.5], [-0.7, 0.3]]) {
        const q = tr.transform(iPoint([p[0], p[1], 0, 0]));
        check(nearP(m.toWorld(p), [q.v[0], q.v[1]], 1e-9), `toWorld is the renderer's transform, ${JSON.stringify(conf)} at ${p}`);
        check(nearP(m.fromWorld(m.toWorld(p)), p, 1e-12), `fromWorld inverts toWorld, ${JSON.stringify(conf)} at ${p}`);
    }
    check(nearP(m.centre, m.toWorld([0, 0]), 0), 'the centre is the image of the origin');
    check(near(m.angle, conf.rotation*TORAD, 0) && near(m.scale, conf.scale, 0), 'the angle and the scale are the stored ones');
}

// 2 ───────────────────────────────────────────────────────────────────────────

for (const conf of CONFS) {
    const m = groupTransformMaps(conf);
    for (const a of ANCHORS) {
        const c = m.toWorld(a);
        const back = transformFromFrame(c, conf.rotation, m.scale, a);
        check(near(back.translationX, conf.translationX, 1e-12) && near(back.translationY, conf.translationY, 1e-12)
              && back.rotation === conf.rotation && back.scale === conf.scale,
              `the frame gives the stored numbers back, ${JSON.stringify(conf)} about ${a}`);
        // turned and scaled about the anchor: its image stays, the other points turn about it
        const turned = transformFromFrame(c, conf.rotation + 40, m.scale*1.5, a);
        const m2 = groupTransformMaps(turned);
        check(nearP(m2.toWorld(a), c, 1e-12), `a turn about the anchor keeps the frame's centre, ${JSON.stringify(conf)} about ${a}`);
        const p = [a[0] + 0.4, a[1] - 0.2];
        check(nearP(m2.toWorld(p), turnAbout(c, m.toWorld(p), 40, 1.5), 1e-9), 'the other points turn and scale about the centre');
    }
    // the origin by default, as before
    check(nearP(groupTransformMaps(transformFromFrame(m.centre, 10, 2)).centre, m.centre, 1e-12), 'the anchor is the origin by default');
}

{
    const b = frameBox([0.2, -0.1, 0.6, 0.5], { pad: 0.05, minHalf: 0 });
    check(nearP([b[0], b[1]], [0.15, -0.15], 1e-12) && nearP([b[2], b[3]], [0.65, 0.55], 1e-12), `the pad on every side (${b})`);
    const c = frameBox([0.2, -0.1, 0.6, 0.5], { pad: 0.05, minHalf: 0.3 });
    check(nearP([c[0], c[1]], [0.1, -0.15], 1e-12) && nearP([c[2], c[3]], [0.7, 0.55], 1e-12), `the least half size (${c})`);
    const d = frameBox([1, 2, 1, 2], { pad: 0.01, minHalf: 0.1 });
    check(nearP([d[0], d[1]], [0.9, 1.9], 1e-12) && nearP([d[2], d[3]], [1.1, 2.1], 1e-12), `a point's frame (${d})`);
    const e = frameBox([0.2, -0.1, 0.6, 0.5]);
    check(nearP([e[0], e[1]], [0.2, -0.1], 1e-12) && nearP([e[2], e[3]], [0.6, 0.5], 1e-12), `no pad, no least size: the box itself (${e})`);

    const conf = CONFS[1];
    const box = [0.1, -0.3, 0.7, 0.2];
    const f = transformFrame(conf, box);
    const m = groupTransformMaps(conf);
    check(nearP(f.anchor, [0.4, -0.05], 1e-12) && nearP(f.centre, m.toWorld([0.4, -0.05]), 1e-12), 'the frame\'s centre is the image of the box\'s centre');
    const corners = [[0.1, -0.3], [0.7, -0.3], [0.7, 0.2], [0.1, 0.2]].map(m.toWorld);
    check(f.corners.length === 4 && f.corners.every((q, i) => nearP(q, corners[i], 1e-12)), 'the corners are the images of the box\'s, counterclockwise');
    check(near(f.angle, conf.rotation*TORAD, 1e-15) && f.scale === conf.scale, 'the frame\'s angle and scale');
    const side = Math.hypot(f.corners[1][0] - f.corners[0][0], f.corners[1][1] - f.corners[0][1]);
    check(near(side, 0.6*conf.scale, 1e-12), 'the frame is scaled with the group');
}

// 3 ───────────────────────────────────────────────────────────────────────────

for (const conf of CONFS) {
    for (const a of ANCHORS) {
        const m = groupTransformMaps(conf);
        const c = m.toWorld(a);
        const w0 = [c[0] + 0.004, c[1] - 0.003];         // grabbed a little off the centre
        const drag = startFrameDrag(conf, 'centre', w0, a);
        const w = [w0[0] + 0.7, w0[1] - 0.25];
        const out = frameDragTo(drag, w);
        const m2 = groupTransformMaps(out);
        check(nearP(m2.toWorld(a), [c[0] + 0.7, c[1] - 0.25], 1e-12), `the centre moves with the pointer, ${JSON.stringify(conf)} about ${a}`);
        check(out.rotation === conf.rotation && near(out.scale, conf.scale, 0), 'a move of the centre keeps the angle and the scale');
        // the maker's point that was under the pointer is under it again
        const grabbed = m.fromWorld(w0);
        check(nearP(m2.toWorld(grabbed), w, 1e-12), 'the grabbed point follows the pointer');
    }
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const conf = CONFS[1];
    const box = [0.1, -0.3, 0.7, 0.2];
    const f = transformFrame(conf, box);
    const corner = f.corners[2];
    const grabbedMaker = groupTransformMaps(conf).fromWorld(corner);

    // the corner to the place of a turn by 40 degrees and a scale by 1.5, in a few steps
    const drag = startFrameDrag(conf, 'corner', corner, f.anchor);
    let out;
    for (let i = 1; i <= 5; i++) {
        const t = i/5;
        out = frameDragTo(drag, turnAbout(f.centre, corner, 40*t, 1 + 0.5*t));
    }
    check(near(out.rotation, conf.rotation + 40, 1e-9), `a corner turns the frame (${out.rotation})`);
    check(near(out.scale, conf.scale*1.5, 1e-9), `a corner scales the frame (${out.scale})`);
    const m2 = groupTransformMaps(out);
    check(nearP(m2.toWorld(f.anchor), f.centre, 1e-12), 'the frame\'s centre stays');
    check(nearP(m2.toWorld(grabbedMaker), turnAbout(f.centre, corner, 40, 1.5), 1e-9), 'the corner grabbed stays under the pointer');

    // round the centre by 300 degrees in steps
    const d2 = startFrameDrag(conf, 'corner', corner, f.anchor);
    for (let i = 1; i <= 30; i++) out = frameDragTo(d2, turnAbout(f.centre, corner, 300*i/30));
    check(near(out.rotation, conf.rotation + 300, 1e-9), `a turn past half a circle goes on (${out.rotation})`);
    check(near(out.scale, conf.scale, 1e-9), 'a turn at the same distance keeps the scale');
    // on past a whole circle (40 + 400 degrees): the angle is kept within the panel's ±360
    for (let i = 31; i <= 40; i++) out = frameDragTo(d2, turnAbout(f.centre, corner, 300*i/30));
    check(near(out.rotation, conf.rotation + 400 - 360, 1e-9), `past a whole circle the angle is kept within 360 (${out.rotation})`);

    // Shift: the turn alone, in steps of 15 degrees
    const away = turnAbout(f.centre, corner, 0.3/TORAD, 2);
    const d3 = startFrameDrag(conf, 'corner', corner, f.anchor);
    out = frameDragTo(d3, away, { turnOnly: true, stepDeg: 15 });
    check(near(out.rotation % 15, 0, 1e-9) && near(out.rotation, 60, 1e-9), `Shift turns in steps of 15 degrees (${out.rotation})`);
    check(out.scale === conf.scale, 'Shift keeps the scale');
    check(nearP(groupTransformMaps(out).toWorld(f.anchor), f.centre, 1e-12), 'Shift keeps the centre');
    // Alt: the scale alone
    const d4 = startFrameDrag(conf, 'corner', corner, f.anchor);
    out = frameDragTo(d4, away, { scaleOnly: true });
    check(out.rotation === conf.rotation && near(out.scale, conf.scale*2, 1e-9), `Alt scales only (${out.rotation}, ${out.scale})`);
    check(nearP(groupTransformMaps(out).toWorld(f.anchor), f.centre, 1e-12), 'Alt keeps the centre');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const conf = CONFS[2];
    const m = groupTransformMaps(conf);
    const p = params(conf);
    const end0 = [0.8, 0.1, 0], end1 = [0.5, 0.4, 0];
    const arc = iSphere([0.5, 0.1, 0, 0.3], [end0, end1]);
    arc.label = ['tube', 1];
    const w = transformSplane(arc, p);
    const c = m.toWorld([0.5, 0.1]);
    check(nearP([w.v[0], w.v[1]], c, 1e-9) && near(Math.abs(w.v[3]), 0.3*conf.scale, 1e-9), 'a circle goes to its image');
    const endOf = (sp, b) => [sp.v[0] + Math.abs(sp.v[3])*Math.cos(-b), sp.v[1] + Math.abs(sp.v[3])*Math.sin(-b)];
    check(nearP(endOf(w, w.bounds[0]), m.toWorld(end0), 1e-9) && nearP(endOf(w, w.bounds[1]), m.toWorld(end1), 1e-9), 'the ends of the arc go with the points');
    check(w.label === arc.label, 'the label stays');
    const line = iPlane([0.6, 0.8, 0, 0.25]);
    const wl = transformSplane(line, p);
    // a point of the line goes to a point of its image
    const q = [0.6*0.25 - 0.8*0.4, 0.8*0.25 + 0.6*0.4];
    const qw = m.toWorld(q);
    check(near(wl.v[0]*qw[0] + wl.v[1]*qw[1] - wl.v[3], 0, 1e-9), 'a line goes to its image');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    // a view of 100 pixels to the unit, y up, origin at the pixel (400, 300)
    const view = {
        toWorld: (c) => [(c[0] - 400)/100, (300 - c[1])/100],
        toCanvas: (w) => [400 + 100*w[0], 300 - 100*w[1]],
        scaleAt: () => 0.01,
    };
    const conf = { translationX: 0.5, translationY: 0.25, rotation: 30, scale: 2 };
    const original = { ...conf };
    let domain = [0, 0, 1, 0.5];
    let changes = 0;
    const tool = GroupTransformTool({ config: conf, view, domainBox: () => domain, canvas: { style: {} },
                                      repaint: () => {}, onChanged: () => { changes++; } });
    const ev = (type, c, extra = {}) => ({ type, canvasX: c[0], canvasY: c[1], button: 0, buttons: type === 'pointerup' ? 0 : 1,
                                         preventDefault() {}, ...extra });
    const m = groupTransformMaps(conf);

    // the frame: 12 pixels outside the domain's box (the maker's 0.06 at the scale 2)
    let f = tool.getFrame();
    check(nearP(f.anchor, [0.5, 0.25], 1e-12) && nearP(f.centre, m.toWorld([0.5, 0.25]), 1e-12), 'the frame\'s centre is the domain\'s');
    const corner0 = m.fromWorld(f.corners[0]), corner2 = m.fromWorld(f.corners[2]);
    check(nearP(corner0, [-0.06, -0.06], 1e-9) && nearP(corner2, [1.06, 0.56], 1e-9), `the frame stands 12 pixels outside the domain (${corner0}, ${corner2})`);
    const cc = view.toCanvas(f.centre);

    let e = ev('pointerdown', cc);
    tool.handleEvent(e);
    check(!e.isConsumed, 'a tool not active takes nothing');

    tool.setActive(true);
    e = ev('pointerdown', [cc[0] + 3, cc[1] - 2]);
    tool.handleEvent(e);
    check(e.isConsumed && tool.isDragging(), 'a press on the centre is taken');
    tool.handleEvent(ev('pointermove', [cc[0] + 53, cc[1] - 2]));
    check(nearP(groupTransformMaps(conf).toWorld(f.anchor), [f.centre[0] + 0.5, f.centre[1]], 1e-12), 'the centre follows the pointer');
    check(conf.rotation === 30 && conf.scale === 2 && changes === 1, 'the angle and scale stay, one change');
    e = { type: 'keydown', key: 'Escape' };
    tool.handleKey(e);
    check(e.isConsumed && !tool.isDragging(), 'Escape ends the drag');
    check(conf.translationX === original.translationX && conf.translationY === original.translationY, 'Escape puts the numbers back');

    // the frame's inside takes no press (a drag there is the view's)
    e = ev('pointerdown', view.toCanvas(turnAbout(f.centre, f.corners[0], 0, 0.5)));
    tool.handleEvent(e);
    check(!e.isConsumed && !tool.isDragging(), 'the frame\'s inside takes no press');

    // a corner: half as far, turned by 90 degrees about the centre (on the canvas, y down: a turn to the left)
    const rc = view.toCanvas(f.corners[1]);
    e = ev('pointerdown', [rc[0] + 2, rc[1] + 1]);
    tool.handleEvent(e);
    check(e.isConsumed && tool.isDragging(), 'a press on a corner is taken');
    const v = [rc[0] + 2 - cc[0], rc[1] + 1 - cc[1]];
    const to = [cc[0] + 0.5*v[1], cc[1] - 0.5*v[0]];
    tool.handleEvent(ev('pointermove', to));
    check(near(conf.rotation, 120, 1e-9) && near(conf.scale, 1, 1e-9), `a corner turns and scales (${conf.rotation}, ${conf.scale})`);
    check(nearP(groupTransformMaps(conf).toWorld(f.anchor), f.centre, 1e-12), 'the centre stays where it was');
    // the frame of the press carried along: the corner grabbed stays as far off the pointer as it was grabbed, turned and scaled
    const fd = tool.getFrame();
    const off = view.toCanvas(fd.corners[1]);
    check(nearP(off, [to[0] - 0.5*1, to[1] + 0.5*2], 1e-6), `the corner grabbed stays under the pointer (${off}, ${to})`);
    e = ev('pointerup', to);
    tool.handleEvent(e);
    check(e.isConsumed && !tool.isDragging(), 'the drag ends at the release');
    // after the drag the margin is the pixels' again: 12 pixels at the scale 1, the maker's 0.12
    const fa = tool.getFrame();
    check(nearP(groupTransformMaps(conf).fromWorld(fa.corners[0]), [-0.12, -0.12], 1e-9), 'after the drag the margin is 12 pixels again');

    // a tiny domain: the corners at least 16 pixels from the centre on each axis, found before the centre
    Object.assign(conf, original);
    domain = [0.5, 0.25, 0.5, 0.25];
    f = tool.getFrame();
    const fc = view.toCanvas(f.centre);
    const k0 = view.toCanvas(f.corners[0]);
    check(near(Math.hypot(k0[0] - fc[0], k0[1] - fc[1]), 16*Math.SQRT2, 1e-6), 'a point\'s frame keeps 16 pixels to a side');
    tool.handleEvent(ev('pointermove', k0, { buttons: 0 }));
    check(tool.getHover() === 'corner', 'the corner is hovered');
    tool.handleEvent(ev('pointermove', fc, { buttons: 0 }));
    check(tool.getHover() === 'centre', 'the centre is hovered');
    tool.handleEvent(ev('pointermove', [fc[0] + 60, fc[1] + 60], { buttons: 0 }));
    check(tool.getHover() === null, 'nothing away from the handles');

    // no domain: the box of side 1 round the maker's origin
    domain = null;
    f = tool.getFrame();
    check(nearP(f.anchor, [0, 0], 0) && nearP(f.centre, m.centre, 1e-12), 'without a domain the frame is round the maker\'s origin');

    // the geometry: the closed frame through the corners, a disc at each corner, the pivot's mark at the centre
    domain = [0, 0, 1, 0.5];
    f = tool.getFrame();
    const geo = tool.getOverlayGeometry();
    const line = geo.polylines[0];
    check(geo.polylines.length === 1 && line.points.length === 5 && f.corners.every((q, i) => nearP(line.points[i], q, 1e-12))
          && nearP(line.points[4], f.corners[0], 0), 'the frame is drawn through the corners');
    check(f.corners.every(q => geo.points.some(p => p.kind === 'disc' && nearP(p.p, q, 1e-12))), 'the corners are drawn where they are found');
    check(geo.points.some(p => p.kind === 'cross' && nearP(p.p, f.centre, 1e-12)), 'the centre is drawn as the pivot');
    check(geo.splanes.length === 0, 'no circle');
    // the 2D canvas: the frame, the pivot and the corners in canvas pixels
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...args) => calls.push([k, ...args])), set: (t, k, val) => { t[k] = val; return true; } });
    tool.renderUI(ctx, { world2screen: view.toCanvas });
    const k1 = view.toCanvas(f.corners[1]);
    check(calls.some(c => (c[0] === 'lineTo' || c[0] === 'moveTo') && near(c[1], k1[0], 1e-9) && near(c[2], k1[1], 1e-9)), 'the 2D frame goes through the corners');
    check(calls.some(c => c[0] === 'arc' && near(c[1], k1[0], 1e-9) && near(c[2], k1[1], 1e-9)), 'the 2D corners are drawn');
    tool.setActive(false);
    check(tool.getOverlayGeometry() === null, 'nothing drawn when not active');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
