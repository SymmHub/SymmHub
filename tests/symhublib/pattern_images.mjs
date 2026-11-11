/*
  tests of the pattern transform tool with a pattern of several images
  (lib/symhublib/PatternTransformHandler.js, params.getImageTransforms; sympix's
  PatternImageArray), and of the orbifold edges as GPU overlay geometry
  (lib/orbilib/OrbifoldUITool.js)

    node tests/symhublib/pattern_images.mjs

  1. the box is selected at first: a drag moves it as before, the images keep
     their places in it; a click on the selection selects the next thing under
     the pointer: the topmost image, the one under it, the box again; a drag moves
     the selected image by the pointer's move in the pattern box, the box stays
  2. a corner of the selected image turns and scales it about its centre: the
     grabbed corner follows the pointer; a bent pose (sympix in a curved group)
     carries the image's outline and the corner handles with the box
  3. a press outside the box and the images selects the box (null) and is not
     consumed; an image that is no longer shown is no longer the selection
  4. OrbifoldUITool.getOverlayGeometry: an arc of an iSphere becomes the same arc
     (the short one between its ends) as an angle range, a line is cut to the disk
*/

import { iSphere, iPlane } from '../../lib/invlib/invlib.js';
import { poseToWorld, poseToPattern } from '../../lib/symhublib/PatternPose.js';
import { PatternTransformHandler } from '../../lib/symhublib/PatternTransformHandler.js';
import { OrbifoldUITool } from '../../lib/orbilib/modules.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;

// the screen: 300 px a unit, the origin at (400, 400)
const SCREEN = { world2screen: w => [400 + 300*w[0], 400 - 300*w[1]], getPixelSize: () => 1/300 };

function evt(type, w, buttons = 1){
    const s = SCREEN.world2screen(w);
    return { type, wpnt: w, canvasX: s[0], canvasY: s[1], buttons, ctrlKey: false, preventDefault(){} };
}
function drag(h, w0, w1, steps = 5){
    h.handleEvent(evt('pointerdown', w0));
    for (let i = 1; i <= steps; i++) h.handleEvent(evt('pointermove', [w0[0] + (w1[0] - w0[0])*i/steps, w0[1] + (w1[1] - w0[1])*i/steps]));
    h.handleEvent(evt('pointerup', w1, 0));
}
function click(h, w){
    const d = evt('pointerdown', w);
    h.handleEvent(d);
    h.handleEvent(evt('pointerup', w, 0));
    return d;
}

// images in the pattern box, the places as PatternImage keeps them
function makeImages(list){
    const places = list.map(p => ({ ...p }));
    let shown = null;
    const targets = () => places.map(p => ({ id: p.id, get: () => ({ centerX: p.centerX, centerY: p.centerY, scale: p.scale, angle: p.angle }), set: t => Object.assign(p, t) }))
        .filter(t => !shown || shown.includes(t.id));
    return { places, targets, show: ids => { shown = ids; } };
}
function makeHandler(config, images){
    return PatternTransformHandler({ config, onChanged(){}, canvasTransform: SCREEN, overlay: null, getGroup: () => null, canBend: () => false,
        getImageTransforms: images.targets });
}
const selected = h => { const s = h.getSelection(); return s.kind === 'image' ? s.id : null; };

// an image's point u ([-1, 1]^2) in the pattern box
function imagePoint(p, u){
    const a = p.angle*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
    return [p.centerX + p.scale*(c*u[0] - s*u[1]), p.centerY + p.scale*(s*u[0] + c*u[1])];
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const cfg = { centerX: 0.2, centerY: 0.1, scale: 0.5, angle: 15, pivotX: 0, pivotY: 0 };
    const cfg0 = { ...cfg };
    // b on top of a, overlapping at the pattern point (0.1, 0)
    const images = makeImages([
        { id: 'a', centerX: -0.2, centerY: 0, scale: 0.5, angle: 0 },
        { id: 'b', centerX: 0.3, centerY: 0.1, scale: 0.4, angle: 30 },
    ]);
    const h = makeHandler(cfg, images);
    const both = poseToWorld(cfg, [0.1, 0]);
    check(selected(h) === null, 'the box selected at first');

    // a drag on the overlap moves the box
    {
        const imgs0 = JSON.stringify(images.places);
        drag(h, both, [both[0] + 0.1, both[1] + 0.05]);
        check(selected(h) === null, 'a drag keeps the box selected');
        check(near(cfg.centerX, cfg0.centerX + 0.1, 1e-12) && near(cfg.centerY, cfg0.centerY + 0.05, 1e-12), `the box moved: ${cfg.centerX}, ${cfg.centerY}`);
        check(JSON.stringify(images.places) === imgs0, 'the images keep their places in the box');
        drag(h, [both[0] + 0.1, both[1] + 0.05], both);
        check(near(cfg.centerX, cfg0.centerX, 1e-12) && near(cfg.centerY, cfg0.centerY, 1e-12), 'a drag back restores the box');
        Object.assign(cfg, cfg0);
    }

    // a click selects the topmost image (b, the last), a drag moves it
    click(h, both);
    const b0 = { ...images.places[1] };
    const target = poseToWorld(cfg, [0.1 + 0.2, 0 - 0.1]);
    drag(h, both, target);
    check(selected(h) === 'b', `the topmost image selected: ${selected(h)}`);
    check(near(images.places[1].centerX, b0.centerX + 0.2, 1e-12) && near(images.places[1].centerY, b0.centerY - 0.1, 1e-12),
        `the image moved by the pointer's move in the box: ${images.places[1].centerX}, ${images.places[1].centerY}`);
    check(images.places[1].scale === b0.scale && images.places[1].angle === b0.angle, 'a move keeps the scale and the angle');
    check(['centerX', 'centerY', 'scale', 'angle'].every(k => near(cfg[k], cfg0[k], 1e-12)), 'the box stays');
    // back
    drag(h, target, both);
    check(near(images.places[1].centerX, b0.centerX, 1e-12) && near(images.places[1].centerY, b0.centerY, 1e-12), 'a drag back restores the image');

    // clicks on the selected image cycle: b -> a -> box -> b
    const seq = [];
    for (let i = 0; i < 3; i++) { click(h, both); seq.push(selected(h)); }
    check(JSON.stringify(seq) === JSON.stringify(['a', null, 'b']), `clicks cycle the images under the pointer, then the box: ${JSON.stringify(seq)}`);

}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const cfg = { centerX: 0, centerY: 0, scale: 0.6, angle: -10, pivotX: 0, pivotY: 0 };
    const images = makeImages([{ id: 'a', centerX: 0.2, centerY: -0.1, scale: 0.3, angle: 25 }]);
    const h = makeHandler(cfg, images);
    const a = images.places[0];
    click(h, poseToWorld(cfg, [a.centerX, a.centerY]));
    check(selected(h) === 'a', 'the image selected by a click');
    const corner = imagePoint(a, [1, 1]);
    const goal = [corner[0] + 0.15, corner[1] + 0.05];      // in the box
    const c0 = [a.centerX, a.centerY];
    drag(h, poseToWorld(cfg, corner), poseToWorld(cfg, goal));
    check(nearPt(imagePoint(a, [1, 1]), goal, 1e-9), `the grabbed corner follows the pointer: ${imagePoint(a, [1, 1])} vs ${goal}`);
    check(nearPt([a.centerX, a.centerY], c0, 1e-12), 'the centre stays');
    check(a.scale > 0.3, `scaled: ${a.scale}`);

    // a bent pose carries the outline and the handles
    const bent = { centerX: 0.1, centerY: 0.05, scale: 0.4, angle: 5, pivotX: 0, pivotY: 0, bendX: 0.3, bendY: -0.2 };
    const hb = makeHandler(bent, images);
    hb.selectImage('a');
    const out = hb.getImageOutlines(8);
    check(out.length === 1 && out[0].selected && out[0].outline.length === 32, 'one outline of 4 x 8 points, selected');
    check(nearPt(out[0].corners[1], poseToWorld(bent, imagePoint(a, [1, 1])), 1e-12), 'the corners through the bent pose');
    const mid = poseToWorld(bent, imagePoint(a, [0, 1]));
    check(nearPt(out[0].outline[4], mid, 1e-12), 'an edge point through the bent pose');
    // the corner's handle under the pointer in the bent pose
    const wc = poseToWorld(bent, imagePoint(a, [-1, -1]));
    const goal2 = imagePoint(a, [-1.2, -1.1]);
    drag(hb, wc, poseToWorld(bent, goal2));
    check(nearPt(imagePoint(a, [-1, -1]), goal2, 1e-8), `bent: the corner follows the pointer in the box: ${imagePoint(a, [-1, -1])} vs ${goal2}`);
    check(nearPt(poseToPattern(bent, poseToWorld(bent, goal2)), goal2, 1e-9), 'the pose maps are inverse');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const cfg = { centerX: 0, centerY: 0, scale: 0.5, angle: 0, pivotX: 0, pivotY: 0 };
    const images = makeImages([{ id: 'a', centerX: 0, centerY: 0, scale: 0.5, angle: 0 }, { id: 'b', centerX: 0.6, centerY: 0.6, scale: 0.3, angle: 0 }]);
    const h = makeHandler(cfg, images);
    click(h, [0.0, 0.05]);
    check(selected(h) === 'a', 'a selected');
    const d = click(h, [0.9, -0.9]);
    check(selected(h) === null && !d.isConsumed, `a press outside selects the box and is left to the navigator: ${selected(h)}, ${d.isConsumed}`);
    click(h, [0.3, 0.3]);   // b in the box at (0.6, 0.6)
    check(selected(h) === 'b', `b selected: ${selected(h)}`);
    images.show(['a']);
    check(selected(h) === null, 'a hidden image is no longer the selection');
    check(h.getImageOutlines().length === 1, 'only the shown images are outlined');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const TWO_PI = 2*Math.PI;
    const angleOn = (range, phi) => { let u = phi; while (u < range[0]) u += TWO_PI; while (u >= range[0] + TWO_PI) u -= TWO_PI; return u <= range[1]; };
    const tool = new OrbifoldUITool({ navigator: { getInversiveTransform: () => [] }, config: { showDomain: true } });
    const cases = [
        ['short arc inside (-PI, PI)', [0.3, 0.8], 0.45],
        ['short arc across PI', [3.0, -3.0], 3.1],
        ['ends the other way round', [-0.5, 2.0], 0.7],
        ['across 0', [-0.4, 0.4], 0.05],
    ];
    for (const [name, ends, inside] of cases) {
        const c = [0.3, -0.2], r = 0.7;
        const pts = ends.map(t => [c[0] + r*Math.cos(t), c[1] + r*Math.sin(t), 0]);
        const sp = iSphere([c[0], c[1], 0, r], pts);
        sp.label = ['edge', 0];
        tool.wg = { curvature: -1, FD: {}, getGroup: () => ({ s: [[sp]], i: [] }) };
        const geo = tool.getOverlayGeometry();
        check(geo.splanes.length === 1, `${name}: one splane`);
        const g = geo.splanes[0];
        check(nearPt(g.circle, [c[0], c[1]], 1e-12) && near(g.circle[2], r, 1e-12), `${name}: the circle`);
        check(g.range[0] >= -Math.PI && g.range[0] < Math.PI && g.range[1] > g.range[0], `${name}: the range in order ${g.range}`);
        check(near(g.range[1] - g.range[0], Math.min(Math.abs(ends[1] - ends[0]), TWO_PI - Math.abs(ends[1] - ends[0])), 1e-9), `${name}: the short arc ${g.range}`);
        check(angleOn(g.range, inside), `${name}: the arc holds ${inside}: ${g.range}`);
        check(angleOn(g.range, ends[0]) && angleOn(g.range, ends[1]), `${name}: the arc ends at the ends ${g.range}`);
        check(tool.FDPoints.length === 1 && tool.FDPoints[0] === sp || tool.FDPoints[0].v[3] === sp.v[3], `${name}: the edge kept for the hit tests`);
    }
    // a line through the disk, cut to it
    const ln = iPlane([0.6, 0.8, 0, 0.5]);
    ln.label = ['mirror', 0];
    tool.wg = { curvature: -1, FD: {}, getGroup: () => ({ s: [[ln]], i: [] }) };
    const g = tool.getOverlayGeometry().splanes[0];
    check(g && g.line && near(g.line[2], 0.5, 1e-12) && near(g.range[1], Math.sqrt(1 - 0.25), 1e-12) && near(g.range[0], -g.range[1], 1e-15), `a line cut to the disk: ${g && g.range}`);
    // not active outside the hyperbolic plane
    tool.wg = { curvature: 0, FD: {}, getGroup: () => ({ s: [[ln]], i: [] }) };
    check(tool.getOverlayGeometry().splanes.length === 0, 'nothing for a flat group');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
