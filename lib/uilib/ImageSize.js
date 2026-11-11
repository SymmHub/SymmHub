/**
 * ImageSize.js
 *
 * The size of an exported image: the other side under a locked aspect ratio,
 * the limits of a format and the message when a size is beyond them, and the
 * zoom that shows the whole of the screen's view in an image of another shape.
 *
 * No imports: the export dialog (ExportImageDialog) and the renderer's export
 * use it, and node tests read it directly.
 */

// a single frame (PNG, JPG, WEBP) is drawn into one canvas: browsers give a
// canvas up to 16384 a side and about 268 million pixels, and a frame that
// large often fails in the GPU memory of a laptop; 8192 x 8192 (256 MB of
// RGBA) works on the GPUs SymmHub runs on
export const SINGLE_FRAME_SIDE   = 8192;
export const SINGLE_FRAME_PIXELS = 8192 * 8192;

// a TIFF is written tile by tile, uncompressed, with 32 bit offsets: the file
// stays below 4 GiB with room for the padding of the last tiles
export const TILED_SIDE   = 32768;
export const TILED_PIXELS = 2 ** 29;

// formats written tile by tile
const TILED_FORMATS = ['TIFF'];

//
//  the limits of a format: { side, pixels, tiled }
//  gpuSide: the largest side the GPU draws into (MAX_VIEWPORT_DIMS,
//  MAX_RENDERBUFFER_SIZE), when known; it bounds a single frame only
//
export function imageSizeLimits(format = 'PNG', gpuSide = Infinity) {
    if (TILED_FORMATS.includes(format)) {
        return { side: TILED_SIDE, pixels: TILED_PIXELS, tiled: true };
    }
    const side = Math.min(SINGLE_FRAME_SIDE, gpuSide > 0 ? gpuSide : Infinity);
    return { side, pixels: Math.min(SINGLE_FRAME_PIXELS, side * side), tiled: false };
}

//
//  null when width x height can be exported as format, else the message why not
//
export function imageSizeError(width, height, format = 'PNG', gpuSide = Infinity) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        return 'Width and height are whole numbers of pixels, at least 1.';
    }
    const lim = imageSizeLimits(format, gpuSide);
    const tail = lim.tiled ? '' : ' For a larger image choose TIFF, which is written in tiles.';
    if (width > lim.side || height > lim.side) {
        return `${format} export is limited to ${lim.side} pixels a side; ${width} × ${height} is larger.${tail}`;
    }
    if (width * height > lim.pixels) {
        const mp = n => (n / 1e6).toFixed(n < 1e7 ? 1 : 0);
        return `${format} export is limited to ${mp(lim.pixels)} million pixels; ${width} × ${height} is ${mp(width * height)} million.${tail}`;
    }
    return null;
}

//
//  the size with one side changed under a locked aspect ratio
//  changed: 'width' or 'height', value: its new value, aspect: width / height
//
export function lockedImageSize(changed, value, aspect) {
    const v = Math.max(1, Math.round(value));
    if (!(aspect > 0) || !Number.isFinite(aspect)) {
        return { width: v, height: v };
    }
    if (changed === 'height') {
        return { width: Math.max(1, Math.round(v * aspect)), height: v };
    }
    return { width: v, height: Math.max(1, Math.round(v / aspect)) };
}

//
//  the zoom of an export of exportWidth x exportHeight that shows the whole of
//  what a screen of screenWidth x screenHeight shows at zoom, scaled and never
//  cropped. The canvas transform spans 2 / zoom across the width, so an image
//  of the screen's shape keeps the zoom; a wider one zooms out until the
//  screen's height fits.
//
export function exportViewZoom(zoom, screenWidth, screenHeight, exportWidth, exportHeight) {
    const screenAspect = screenHeight / screenWidth;
    const exportAspect = exportHeight / exportWidth;
    if (!(screenAspect > 0) || !(exportAspect > 0)) return zoom;
    return (exportAspect < screenAspect) ? zoom * exportAspect / screenAspect : zoom;
}
