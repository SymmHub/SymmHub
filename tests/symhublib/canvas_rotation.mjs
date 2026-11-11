/*
  tests of the turned canvas transform (docs/navigation_tool_plan.md section 2,
  outside the repository)

    node tests/symhublib/canvas_rotation.mjs

  1. screen -> world -> screen to 1e-9 pixels for angles, zooms, centres and
     a non-square canvas; angle 0 gives the old axis formulas
  2. the vertex shader's formula (u_center + R(-u_rotation) * offset) gives
     the world point screen2world gives at the four corners and the centre
  3. appendZoom and appendRotation keep the world point under the pixel
  4. appendPan moves the content by the pixel step on the screen
  5. screenVectorToWorld is the turned back screen vector; getVisibleBox is
     the canvas box at angle 0, on the canvas when turned, as large as it
     can be at 90 degrees
  6. reset and clone carry the angle
*/

import { CanvasTransform } from '../../lib/symhublib/CanvasTransform.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const W = 800, H = 500;
const make = (angle, zoom = 1.7, center = [0.3, -0.2]) => CanvasTransform({ width: W, height: H, center: [...center], zoom, angle });

// 1 ───────────────────────────────────────────────────────────────────────────

for (const a of [0, 0.3, -1.2, Math.PI/2, 2.9]) {
    const ct = make(a);
    for (const s of [[0, 0], [W, H], [123.4, 456.7], [W/2, H/2]]) {
        const w = ct.screen2world(s);
        const back = ct.world2screen(w);
        check(near(back[0], s[0], 1e-9) && near(back[1], s[1], 1e-9), `round trip at angle ${a}, pixel ${s}`);
    }
    const c = ct.screen2world([W/2, H/2]);
    check(near(c[0], 0.3, 1e-12) && near(c[1], -0.2, 1e-12), `the centre pixel shows the centre at angle ${a}`);
}
{
    // the formulas of the upright canvas
    const ct = make(0), zoom = 1.7, aspect = H/W;
    const s = [100, 50], w = ct.screen2world(s);
    check(near(w[0], (2*s[0]/W - 1)/zoom + 0.3, 1e-12) && near(w[1], -(2*s[1]/H - 1)*aspect/zoom - 0.2, 1e-12), 'angle 0: the old formulas');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const ct = make(0.7);
    const u = ct.getUniforms({});
    check(near(u.u_rotation, 0.7, 0), 'u_rotation is the angle');
    for (const [px, py] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
        // the shader: v = u_scale*position*vec2(1, aspect), vUv = u_center + R(-angle) v
        const v = [u.u_scale*px, u.u_scale*py*u.u_aspect];
        const c = Math.cos(u.u_rotation), s = Math.sin(u.u_rotation);
        const g = [u.u_center[0] + c*v[0] + s*v[1], u.u_center[1] - s*v[0] + c*v[1]];
        // position (px, py) is the pixel ((px + 1) W/2, (1 - py) H/2)
        const w = ct.screen2world([(px + 1)*W/2, (1 - py)*H/2]);
        check(near(g[0], w[0], 1e-12) && near(g[1], w[1], 1e-12), `shader and CPU agree at position ${px}, ${py}`);
    }
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const ct = make(0.4);
    const s = [600, 120];
    const w = ct.screen2world(s);
    ct.appendZoom(1.37, s[0], s[1]);
    const w1 = ct.screen2world(s);
    check(near(w1[0], w[0], 1e-12) && near(w1[1], w[1], 1e-12), 'zoom keeps the point under the pixel on a turned canvas');
    check(near(ct.getZoom()[0], 1.7*1.37, 1e-12), 'zoom multiplied');
    ct.appendRotation(0.25, s[0], s[1]);
    const w2 = ct.screen2world(s);
    check(near(w2[0], w[0], 1e-12) && near(w2[1], w[1], 1e-12), 'turn keeps the point under the pixel');
    check(near(ct.getAngle(), 0.65, 1e-12), 'turn adds to the angle');
    // a point elsewhere turns about the pixel, counterclockwise on the screen (y down: clockwise in pixel numbers)
    const q = [200, 400], wq = ct.screen2world(q);
    ct.appendRotation(Math.PI/2, s[0], s[1]);
    const sq = ct.world2screen(wq);
    // the vector from s to q, (-400, 280) in pixels, turned a quarter counterclockwise on the screen: (280, 400)
    check(near(sq[0] - s[0], 280, 1e-9) && near(sq[1] - s[1], 400, 1e-9), 'a quarter turn counterclockwise on the screen');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const ct = make(1.1);
    const w = [0.05, 0.4];
    const s0 = ct.world2screen(w);
    ct.appendPan(30, -12);
    const s1 = ct.world2screen(w);
    check(near(s1[0] - s0[0], 30, 1e-9) && near(s1[1] - s0[1], -12, 1e-9), 'pan moves the content by the pixel step');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const ct = make(0.9);
    const a = ct.screen2world([W/2, H/2]), b = ct.screen2world([W/2 + 10, H/2]);
    const v = ct.screenVectorToWorld([10*ct.getPixelSize(), 0]);
    check(near(b[0] - a[0], v[0], 1e-12) && near(b[1] - a[1], v[1], 1e-12), 'a screen vector to the world');

    const up = make(0).getVisibleBox(), size = make(0).getWorldSize();
    check(near(up[2] - up[0], size[0], 1e-12) && near(up[3] - up[1], size[1], 1e-12), 'upright: the visible box is the canvas');
    for (const ang of [0.3, -2, Math.PI/2]) {
        const t = make(ang), box = t.getVisibleBox();
        const corners = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(p => t.world2screen(p));
        check(corners.every(p => p[0] >= -1e-9 && p[0] <= W + 1e-9 && p[1] >= -1e-9 && p[1] <= H + 1e-9), `turned ${ang}: the visible box is on the canvas`);
    }
    // a quarter turn: the box of the canvas's proportions whose height fits the canvas's width
    const q = make(Math.PI/2), qb = q.getVisibleBox(), qs = q.getWorldSize();
    check(near((qb[2] - qb[0])/(qb[3] - qb[1]), qs[0]/qs[1], 1e-12), 'a quarter turn: the canvas proportions');
    check(near(qb[2] - qb[0], qs[1], 1e-9), 'a quarter turn: its width is the canvas height');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const ct = make(0.5);
    const cl = ct.clone();
    check(near(cl.getAngle(), 0.5, 0), 'clone keeps the angle');
    ct.reset();
    check(ct.getAngle() === 0, 'reset is upright');
    const s = ct.world2screen([0, 0]);
    check(near(s[0], W/2, 1e-9) && near(s[1], H/2, 1e-9), 'reset: 0 at the centre');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
