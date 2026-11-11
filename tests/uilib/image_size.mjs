/*
 node tests/uilib/image_size.mjs

 ImageSize.js, the size of an exported image (Export Image... in the app bar):
  1. the other side under a locked aspect ratio
  2. the limits of a single frame and of a tiled TIFF, the GPU's side, the messages
  3. the zoom of an export that shows the whole of the screen's view:
     the view's extent in world units, scaled and never cropped
*/

import {
    imageSizeLimits, imageSizeError, lockedImageSize, exportViewZoom,
    SINGLE_FRAME_SIDE, TILED_SIDE,
} from '../../lib/uilib/ImageSize.js';

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const same = (a, b) => a.width === b.width && a.height === b.height;

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const aspect = 1280 / 720;
    check(same(lockedImageSize('width', 2560, aspect), {width: 2560, height: 1440}), 'width doubled: height doubled');
    check(same(lockedImageSize('height', 360, aspect), {width: 640, height: 360}), 'height halved: width halved');
    check(same(lockedImageSize('width', 1001, 1.5), {width: 1001, height: 667}), 'rounded to whole pixels');
    check(same(lockedImageSize('width', 0, 2), {width: 1, height: 1}), 'never below a pixel');
    check(same(lockedImageSize('height', 3, 1000), {width: 3000, height: 3}), 'a wide aspect');
    check(same(lockedImageSize('width', 50, NaN), {width: 50, height: 50}), 'no aspect: square');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const png = imageSizeLimits('PNG');
    check(png.side === SINGLE_FRAME_SIDE && !png.tiled, 'PNG: one frame, 8192 a side');
    check(imageSizeLimits('PNG', 4096).side === 4096, 'a GPU that draws less lowers the PNG limit');
    check(imageSizeLimits('PNG', 16384).side === SINGLE_FRAME_SIDE, 'a GPU that draws more does not raise it');
    check(imageSizeLimits('TIFF', 4096).side === TILED_SIDE, 'TIFF is tiled: the GPU side does not bound it');

    check(imageSizeError(1280, 720, 'PNG') === null, 'the canvas size is fine');
    check(imageSizeError(8192, 8192, 'PNG') === null, '8192 x 8192 PNG is fine');
    const big = imageSizeError(8193, 100, 'PNG');
    check(!!big && big.includes('8192 pixels a side') && big.includes('TIFF'), `beyond the side: ${big}`);
    const gpu = imageSizeError(5000, 5000, 'JPG', 4096);
    check(!!gpu && gpu.includes('4096') && gpu.startsWith('JPG'), `beyond the GPU: ${gpu}`);
    check(imageSizeError(20000, 20000, 'TIFF') === null, '20000 x 20000 TIFF is fine');
    const tiff = imageSizeError(32768, 32768, 'TIFF');
    check(!!tiff && tiff.includes('million pixels') && !tiff.includes('choose TIFF'), `TIFF beyond its pixels: ${tiff}`);
    check(!!imageSizeError(0, 10) && !!imageSizeError(10.5, 10) && !!imageSizeError(NaN, 10), 'not a size');
}

// 3 ───────────────────────────────────────────────────────────────────────────
// CanvasTransform: the width spans 2 / zoom world units, a pixel is 2 / (width zoom)
{
    const extent = (zoom, w, h) => ({ x: 2 / zoom, y: 2 * h / (w * zoom) });
    const screen = { w: 1280, h: 720, zoom: 0.7 };
    const s = extent(screen.zoom, screen.w, screen.h);

    const sizes = [[1280, 720], [3840, 2160], [640, 360], [1000, 1000], [4000, 1000], [720, 1280], [8192, 2]];
    for (const [w, h] of sizes) {
        const z = exportViewZoom(screen.zoom, screen.w, screen.h, w, h);
        const e = extent(z, w, h);
        const covers = e.x >= s.x * (1 - 1e-12) && e.y >= s.y * (1 - 1e-12);
        const tight = near(e.x, s.x) || near(e.y, s.y);
        check(covers && tight, `${w} x ${h}: shows the whole screen view, touching it on one axis`);
    }
    const z = exportViewZoom(screen.zoom, screen.w, screen.h, 3840, 2160);
    check(z === screen.zoom, 'the screen shape scaled: the same zoom, the same view');
    const e = extent(z, 3840, 2160);
    check(near(e.x, s.x) && near(e.y, s.y), 'the same extent on both axes');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
