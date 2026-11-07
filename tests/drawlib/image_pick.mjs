/*
  tests of picking an image by its pixels (lib/drawlib/ImageItems.js)

    node tests/drawlib/image_pick.mjs

  1. quadUV inverts the map the renderer draws an image with (ItemRenderer.drawItem), on
     quads straight, turned, scaled, sheared and mirrored; the corners are where they
     are drawn
  2. du and dv bound what a step of unit length changes u and v by, and are reached
  3. a quad of no area has no image coordinates
  4. maskHit: the solid pixels and the transparent ones, the alpha threshold, a thin
     line reached within the radius and missed without it, the image's edges, the first
     and last rows and columns, a mask that is not square
*/

import { quadUV, maskHit } from '../../lib/drawlib/ImageItems.js';

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// the renderer's map: image coordinates (u, v) onto the quad
function drawn(p, u, v){
    return [p[6] + u*(p[4] - p[6]) + v*(p[0] - p[6]), p[7] + u*(p[5] - p[7]) + v*(p[1] - p[7])];
}

// a parallelogram: top-left corner o, top edge a, left edge (down the image) b
function quad(o, a, b){
    return [o[0] + b[0], o[1] + b[1], o[0] + a[0] + b[0], o[1] + a[1] + b[1], o[0] + a[0], o[1] + a[1], o[0], o[1]];
}

const quads = {
    straight: quad([-1, 1], [2, 0], [0, -1]),
    turned:   quad([0.3, -0.2], [Math.cos(0.7), Math.sin(0.7)], [Math.sin(0.7), -Math.cos(0.7)]),
    scaled:   quad([5, 7], [0.01, 0], [0, -0.02]),
    sheared:  quad([0, 0], [1, 0.4], [0.6, -1]),
    mirrored: quad([1, 1], [-2, 0], [0, -1]),
};

for (const [name, p] of Object.entries(quads)) {
    for (let k = 0; k < 200; k++) {
        const u = 3*Math.random() - 1, v = 3*Math.random() - 1;
        const at = quadUV(drawn(p, u, v), p);
        check(near(at.u, u, 1e-7) && near(at.v, v, 1e-7), `${name}: (${u}, ${v}) comes back as (${at.u}, ${at.v})`);
    }
    const corner = (x, u, v) => {
        const at = quadUV(x, p);
        check(near(at.u, u) && near(at.v, v), `${name}: corner (${u}, ${v}) is (${at.u}, ${at.v})`);
    };
    corner([p[6], p[7]], 0, 0);
    corner([p[4], p[5]], 1, 0);
    corner([p[0], p[1]], 0, 1);

    // the bounds: no direction exceeds them, one reaches each
    const c = drawn(p, 0.5, 0.5), base = quadUV(c, p);
    let maxU = 0, maxV = 0;
    for (let k = 0; k < 3600; k++) {
        const t = 2*Math.PI*k/3600;
        const at = quadUV([c[0] + Math.cos(t), c[1] + Math.sin(t)], p);
        maxU = Math.max(maxU, Math.abs(at.u - base.u));
        maxV = Math.max(maxV, Math.abs(at.v - base.v));
    }
    check(maxU <= base.du*(1 + 1e-9) && maxU >= base.du*(1 - 1e-5), `${name}: du ${base.du}, reached ${maxU}`);
    check(maxV <= base.dv*(1 + 1e-9) && maxV >= base.dv*(1 - 1e-5), `${name}: dv ${base.dv}, reached ${maxV}`);
}

check(quadUV([0, 0], [0, 0, 1, 1, 2, 2, 3, 3]) === null, 'a quad on a line has no image coordinates');
check(quadUV([0, 0], [1, 1, 1, 1, 1, 1, 1, 1]) === null, 'a quad at a point has no image coordinates');

// a 10 x 6 mask: transparent, row 2 faint, column 5 a solid line, the corners solid
const W = 10, H = 6;
const alpha = new Uint8Array(W*H);
const set = (x, y, a) => { alpha[y*W + x] = a; };
for (let x = 0; x < W; x++) set(x, 2, 15);
for (let y = 0; y < H; y++) set(5, y, 200);
set(0, 0, 255); set(W - 1, H - 1, 16);
const mask = { alpha, width: W, height: H };
const px = (x, y) => [(x + 0.5)/W, (y + 0.5)/H];

check(maskHit(mask, ...px(5, 1)), 'a solid pixel');
check(!maskHit(mask, ...px(3, 1)), 'a transparent pixel');
check(!maskHit(mask, ...px(3, 2)), 'alpha 15 does not count');
check(maskHit(mask, ...px(W - 1, H - 1)), 'alpha 16 counts');
check(maskHit(mask, ...px(0, 0)), 'the first pixel');

const [u3, v1] = px(3, 1);
check(!maskHit(mask, u3, v1, 1/W, 0), 'the line two columns away, out of reach');
check(maskHit(mask, u3, v1, 2/W, 0), 'the line two columns away, within reach');
check(!maskHit(mask, u3, v1, 0, 5/H), 'a reach down the rows does not find the line across');

check(maskHit(mask, 0, 0), 'u, v = 0 is the first pixel');
check(maskHit(mask, 1, 1), 'u, v = 1 is the last pixel');
check(!maskHit(mask, -0.01, 0), 'left of the image');
check(!maskHit(mask, 1.01, 1), 'right of the image');
check(!maskHit(mask, 0, -0.01), 'above the image');
check(!maskHit(mask, 1, 1.01), 'below the image');
check(maskHit(mask, -0.01, 0, 0.02, 0), 'just outside, the edge within reach');
check(maskHit(mask, 1.01, 1, 0.02, 0), 'just outside the other edge, within reach');

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
