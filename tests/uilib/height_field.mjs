/*
 node tests/uilib/height_field.mjs

 HeightField.js, the brushes of the image editor (ImageChannelEditor):
  1. the field, its grey pixels and back
  2. the brush weight: hard core, smooth rim, 0 outside
  3. a dab: raise, lower, level, smooth, clamped to 0..1, the box changed, the mask
  4. a stroke: dabs along the segment, its box
  5. the gradient, invert, fill; the field size for a picture
*/

import {
    createHeightField, copyHeightField, heightFieldFromRGBA, heightFieldToRGBA, isFlatField,
    brushWeight, brushDab, brushStroke, gradientFill, invertField, fillField, fieldSizeFor,
} from '../../lib/uilib/HeightField.js';

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const at = (f, i, j) => f.data[j*f.width + i];

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const f = createHeightField(4, 3);
    check(f.data.length === 12 && isFlatField(f), 'a new field is flat');
    f.data[5] = 0.5; f.data[11] = 1;
    const rgba = heightFieldToRGBA(f);
    check(rgba[20] === 128 && rgba[21] === 128 && rgba[22] === 128 && rgba[23] === 255 && rgba[44] === 255 && rgba[3] === 255, 'grey opaque pixels');
    const g = heightFieldFromRGBA(rgba, 4, 3);
    check(near(g.data[5], 128/255) && g.data[11] === 1 && g.data[0] === 0, 'and back (8 bits)');
    const c = copyHeightField(f);
    c.data[0] = 1;
    check(f.data[0] === 0 && !isFlatField(c), 'a copy is its own');
}

// 2 ───────────────────────────────────────────────────────────────────────────
check(brushWeight(0, 10, 0.5) === 1 && brushWeight(5, 10, 0.5) === 1, 'the core of a half soft brush: 1');
check(near(brushWeight(7.5, 10, 0.5), 0.5) && brushWeight(10, 10, 0.5) === 0 && brushWeight(12, 10, 0.5) === 0, 'its rim: 0.5 half way, 0 at the radius');
check(brushWeight(9.99, 10, 0) === 1 && brushWeight(0, 10, 1) === 1 && brushWeight(5, 10, 1) < 1, 'a hard brush, and one soft from the centre');

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const f = createHeightField(40, 40);
    const box = brushDab(f, 20, 20, { mode: 'raise', radius: 6, strength: 0.3, softness: 0 });
    check(near(at(f, 20, 20), 0.3) && at(f, 30, 20) === 0, 'raise: +strength at the centre, nothing beyond the radius');
    check(box && box[0] === 14 && box[1] === 14 && box[2] === 26 && box[3] === 26, `the box changed ${box}`);
    for (let k = 0; k < 10; k++) brushDab(f, 20, 20, { mode: 'raise', radius: 6, strength: 0.3, softness: 0 });
    check(at(f, 20, 20) === 1, 'clamped at 1');
    brushDab(f, 20, 20, { mode: 'lower', radius: 6, strength: 0.25, softness: 0 });
    check(near(at(f, 20, 20), 0.75), 'lower');
    brushDab(f, 20, 20, { mode: 'level', radius: 6, strength: 0.5, softness: 0, level: 0.25 });
    check(near(at(f, 20, 20), 0.5), 'level: half way to 0.25');
    // smooth: a spike evens out with its neighbours
    const s = createHeightField(9, 9);
    s.data[4*9 + 4] = 1;
    brushDab(s, 4.5, 4.5, { mode: 'smooth', radius: 3, strength: 1, softness: 0 });
    check(near(at(s, 4, 4), 1/9) && near(at(s, 3, 4), 1/9) && at(s, 2, 4) === 0 && at(s, 0, 0) === 0, `smooth: the mean of 3 by 3 around (${at(s, 4, 4)}, ${at(s, 3, 4)})`);
    // the mask: none where it is 0, half where it is 0.5
    const m = createHeightField(10, 1);
    const mask = new Float32Array(10).fill(1);
    mask[2] = 0; mask[3] = 0.5;
    brushDab(m, 5, 0.5, { mode: 'raise', radius: 10, strength: 0.4, softness: 0, mask });
    check(m.data[2] === 0 && near(m.data[3], 0.2) && near(m.data[5], 0.4), 'the mask scales the paint');
    check(brushDab(m, -50, -50, { mode: 'raise', radius: 3, strength: 1 }) === null, 'a dab outside changes nothing');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const f = createHeightField(100, 20);
    const box = brushStroke(f, [10, 10], [90, 10], { mode: 'raise', radius: 4, strength: 0.05, softness: 0 });
    check(box[0] <= 10 && box[2] >= 94 && box[1] === 6 && box[3] === 14, `the stroke's box ${box}`);
    check(at(f, 50, 10) > 0 && at(f, 50, 2) === 0 && at(f, 3, 10) === 0, 'painted along the segment, not around it, nor at its start (the press painted that)');
    const ends = [at(f, 30, 10), at(f, 60, 10)];
    check(near(ends[0], ends[1], 0.051), 'evenly along it');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const f = createHeightField(11, 3);
    gradientFill(f, [0.5, 1.5], [10.5, 1.5], 0, 1);
    check(at(f, 0, 0) === 0 && near(at(f, 5, 2), 0.5) && near(at(f, 10, 1), 1), 'a ramp from 0 to 1 along the drag');
    gradientFill(f, [5.5, 0], [5.5, 0], 0.2, 1);
    check(near(at(f, 3, 1), 0.2), 'a drag of no length: v0 everywhere');
    const g = createHeightField(4, 1, new Float32Array([0, 0.25, 0.5, 1]));
    invertField(g);
    check(g.data.join() === '1,0.75,0.5,0', 'invert');
    const mask = new Float32Array([1, 0, 1, 0.5]);
    fillField(g, 0, mask);
    check(g.data[0] === 0 && g.data[1] === 0.75 && g.data[2] === 0 && near(g.data[3], 0), 'fill with a mask');
    check(fieldSizeFor(400, 300).join() === '400,300' && fieldSizeFor(4000, 1000).join() === '1024,256' && fieldSizeFor(10, 3000, 1024).join() === '3,1024', 'the field size: the picture\'s, at most 1024');
}

console.log(failed ? `${failed} failed` : 'all passed');
