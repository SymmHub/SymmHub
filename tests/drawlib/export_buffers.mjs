/*
 node tests/drawlib/export_buffers.mjs

 ExportBuffers.js, the drawing's buffers while an image export renders, and
 ImageSize.exportPixelScale, the export's scale they follow:
  1. the export's scale: the image's pixels against the screen's, in world units
  2. a buffer's side: n s, never below n, the GPU's side, the memory budget
  3. the sprites' capacity as Sprites.update makes it
  4. the budgets: the panel's largest choices fit, an export of 2 to 4 times
     the screen grows a 1024 buffer
*/

import {
    exportBufferSize, spriteCapacity, PATTERN_EXPORT_BYTES, SPRITE_EXPORT_BYTES,
} from '../../lib/drawlib/ExportBuffers.js';
import { exportPixelScale, exportViewZoom } from '../../lib/uilib/ImageSize.js';

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const z = 0.7;
    check(near(exportPixelScale(957, z, 1914, z), 2), 'twice the width, the same zoom: 2');
    check(near(exportPixelScale(957, z, 957, z), 1), 'the screen size: 1');
    check(near(exportPixelScale(1000, z, 500, z), 0.5), 'half the width: 0.5');
    // a wide image zooms out (exportViewZoom): its pixels follow the height
    const zw = exportViewZoom(z, 957, 696, 2000, 500);
    check(near(exportPixelScale(957, z, 2000, zw), 500/696), 'a wide image: the ratio of the heights');
    check(exportPixelScale(0, z, 100, z) === 1 && exportPixelScale(100, z, 100, NaN) === 1, 'no scale: 1');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    check(exportBufferSize(1024, 1) === 1024, 'scale 1: the panel\'s size');
    check(exportBufferSize(1024, 0.5) === 1024, 'a smaller export does not coarsen the buffer');
    check(exportBufferSize(1024, NaN) === 1024, 'no scale: the panel\'s size');
    check(exportBufferSize(1024, 2) === 2048, 'scale 2: 2048');
    check(exportBufferSize(1024, 1.37) === 1403, 'any scale, rounded');
    check(exportBufferSize(1024, 8, { maxSide: 4096 }) === 4096, 'at most the GPU\'s side');
    check(exportBufferSize(4096, 2, { maxSide: 4096 }) === 4096, 'the panel\'s 4096 stays at a 4096 GPU');
    const lim = { bytesPerTexel: 16, count: 3, budget: 1024**3 };
    const byMemory = Math.floor(Math.sqrt(1024**3 / 48));
    check(exportBufferSize(1024, 8, lim) === byMemory, `the budget: ${byMemory} for 3 RGBA32F buffers in 1 GiB`);
    check(exportBufferSize(4096, 4, { ...lim, count: 20 }) === 4096, 'never below the panel\'s size, whatever the budget');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    check(spriteCapacity(0, 32) === 4 && spriteCapacity(4, 32) === 4, 'at least 4');
    check(spriteCapacity(5, 32) === 8 && spriteCapacity(17, 32) === 32, 'a power of two');
    check(spriteCapacity(100, 32) === 32, 'at most the shader\'s bound');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const pat = (n, s, count) => exportBufferSize(n, s, { maxSide: 16384, bytesPerTexel: 16, count, budget: PATTERN_EXPORT_BYTES });
    const spr = (n, s, k) => exportBufferSize(n, s, { maxSide: 16384, bytesPerTexel: 5, count: spriteCapacity(k, 32), budget: SPRITE_EXPORT_BYTES });
    check(pat(1024, 2, 3) === 2048 && pat(1024, 4, 3) === 4096, 'a 1024 pattern buffer: 2048 at 2x, 4096 at 4x');
    check(pat(1024, 4, 7) < 4096 && pat(1024, 4, 7) >= 2048, `with two components: ${pat(1024, 4, 7)} at 4x`);
    check(spr(1024, 2, 8) === 2048, '8 sprites of 1024: 2048 at 2x');
    check(spr(1024, 4, 32) < 4096 && spr(1024, 4, 32) > 1024, `32 sprites at 4x: ${spr(1024, 4, 32)}`);
    check(spr(2048, 1.5, 32) === 2048, 'the panel\'s largest sprites stay at their size when the budget is spent');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
