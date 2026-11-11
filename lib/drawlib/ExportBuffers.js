//
//  ExportBuffers - the size of the drawing's buffers while an image export
//  renders
//
//  An image export of s times the screen's pixels (SymRenderer, exportImage.js)
//  asks the pattern for buffers s times as fine, so that the image shows what
//  the screen shows with s times the detail instead of the same texels
//  magnified. A buffer of n texels a side is made of exportBufferSize(n, s,
//  limits) texels: n s, never less than n, at most the GPU's side and as
//  large as a memory budget lets `count` buffers of the kind be.
//
//  No imports: PatternDrawing uses it and node tests read it directly.
//

// the GPU memory the pattern buffers (RGBA32F: 16 bytes a texel) may take
// during an export, and the sprites (RGBA8 and the R8 heights: 5 bytes)
export const PATTERN_EXPORT_BYTES = 1024 * 1024 * 1024;
export const SPRITE_EXPORT_BYTES  =  512 * 1024 * 1024;

/**
 * the side of a buffer of `nominal` texels during an export at `scale`
 * limits: { maxSide, bytesPerTexel, count, budget }
 */
export function exportBufferSize(nominal, scale, limits = {}) {
    const n = Math.max(1, Math.round(nominal));
    if (!(scale > 1) || !Number.isFinite(scale)) return n;
    const { maxSide = Infinity, bytesPerTexel = 4, count = 1, budget = Infinity } = limits;
    const byMemory = Math.floor(Math.sqrt(budget / (bytesPerTexel * Math.max(1, count))));
    const side = Math.min(Math.round(n * scale), maxSide > 0 ? maxSide : Infinity, byMemory);
    return Math.max(n, side);
}

/**
 * the layers of the sprites' texture array for `n` sprites, as Sprites.update
 * makes it: a power of two, at least 4, at most maxSprites
 */
export function spriteCapacity(n, maxSprites) {
    let capacity = 4;
    while (capacity < n) capacity *= 2;
    return Math.min(capacity, maxSprites);
}
