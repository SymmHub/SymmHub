import {
    drawItem,
} from './modules.js';

//
//  Sprites - every item of the drawing in a buffer of its own
//
//  A sprite is one item rasterized unfolded into a square buffer around its
//  bounding box (world coordinates), as a sympix image is drawn into its
//  pattern box. The buffers are the layers of one texture array (RGBA8,
//  size x size x capacity) the colour layers sample: for a pixel they find
//  the tiles meeting a sprite's box and sample the sprite where the tile's
//  map sends the pixel, so an item is shown at its own place with its copies
//  everywhere, never folded. A sprite is drawn again only when its item
//  changed.
//

const MYNAME = 'Sprites';
// the layers of the texture array; the colour layers' shader has the same bound
const MAX_SPRITES = 32;
// margin around the strokes, in texels, for the antialiased edges
const MARGIN_TEXELS = 2;

function itemBox(item){
    const p = item.points;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < p.length; i += 2) {
        x0 = Math.min(x0, p[i]);     x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
    }
    return [x0, y0, x1, y1];
}

/**
 * options.gl    the WebGL2 context
 * options.size  the sprites' size in texels
 */
function Sprites(options){

    const gl = options.gl;
    const mSize = options.size;
    let mTexture = null;
    let mCapacity = 0;
    // item id -> {index, item, box: {cx, cy, half}, layerId, opacity}
    const mSprites = new Map();
    const mFree = [];
    let mVersion = 0;
    let mMipmapsFor = -1;       // the version the mipmaps were made for
    let mWarned = false;

    const mCanvas = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(mSize, mSize)
        : Object.assign(document.createElement('canvas'), { width: mSize, height: mSize });

    function allocate(capacity){
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, mSize, mSize, capacity, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        if (mTexture) gl.deleteTexture(mTexture);
        mTexture = tex;
        mCapacity = capacity;
    }

    /** the square box around the item's strokes: {cx, cy, half} */
    function boxOf(item){
        const b = itemBox(item);
        const halfWidth = item.style.stroke ? 0.5*(item.style.strokeWidth || 0) : 0;
        let size = Math.max(b[2] - b[0], b[3] - b[1], 1e-6) + 2*halfWidth;
        // the margin, in world units of the final box
        size = size/(1 - 2*MARGIN_TEXELS/mSize);
        return { cx: 0.5*(b[0] + b[2]), cy: 0.5*(b[1] + b[3]), half: 0.5*size };
    }

    /** draws the item into its layer of the texture array */
    function rasterize(sprite){
        const ctx = mCanvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, mSize, mSize);
        const { cx, cy, half } = sprite.box;
        const s = mSize/(2*half);
        // world (x, y) -> canvas (s (x - cx) + size/2, s (y - cy) + size/2): the
        // canvas is drawn with y up, so its row 0 is the bottom of the box and
        // the upload needs no row flip (which costs as much as the upload
        // itself); text and images drawn here must flip themselves
        ctx.setTransform(s, 0, 0, s, mSize/2 - cx*s, mSize/2 - cy*s);
        drawItem(ctx, sprite.item);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, mTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, sprite.index, mSize, mSize, 1, gl.RGBA, gl.UNSIGNED_BYTE, mCanvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }

    /**
     * brings the sprites up to date with the items shown
     * entries: [{item, layerId, opacity}] in drawing order (bottom first)
     * returns true when something was drawn, freed or added
     */
    function update(entries){
        let changed = false;
        const keep = new Set();
        const wanted = entries.slice(0, MAX_SPRITES);
        if (entries.length > MAX_SPRITES && !mWarned) {
            console.warn(`${MYNAME}: ${entries.length} items, only ${MAX_SPRITES} shown as sprites`);
            mWarned = true;
        }
        for (const [id, sprite] of mSprites) {
            if (!wanted.some(e => e.item.id === id)) {
                mFree.push(sprite.index);
                mSprites.delete(id);
                changed = true;
            }
        }
        const needed = mSprites.size + wanted.filter(e => !mSprites.has(e.item.id)).length;
        if (needed > mCapacity) {
            let capacity = Math.max(4, mCapacity);
            while (capacity < needed) capacity *= 2;
            allocate(Math.min(capacity, MAX_SPRITES));
            // every sprite is drawn again into the new array
            for (const sprite of mSprites.values()) sprite.item = null;
            changed = true;
        }
        for (const e of wanted) {
            keep.add(e.item.id);
            let sprite = mSprites.get(e.item.id);
            if (!sprite) {
                sprite = { index: mFree.length ? mFree.pop() : mSprites.size, item: null, box: null, layerId: e.layerId, opacity: e.opacity };
                mSprites.set(e.item.id, sprite);
            }
            sprite.layerId = e.layerId;
            sprite.opacity = e.opacity;
            if (sprite.item !== e.item) {
                sprite.item = e.item;
                sprite.box = boxOf(e.item);
                rasterize(sprite);
                changed = true;
            }
        }
        if (changed) mVersion++;
        return changed;
    }

    /** the sprites in drawing order, for the colour layers */
    function getData(){
        const sprites = [];
        for (const [id, sprite] of mSprites) {
            sprites.push({ id, index: sprite.index, layerId: sprite.layerId, opacity: sprite.opacity, box: sprite.box, slot: 0 });
        }
        return { texture: mTexture, size: mSize, version: mVersion, sprites, ensureMipmaps };
    }

    function ensureMipmaps(){
        if (mMipmapsFor === mVersion || !mTexture) return;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, mTexture);
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        mMipmapsFor = mVersion;
    }

    function free(){
        if (mTexture) gl.deleteTexture(mTexture);
        mTexture = null;
        mCapacity = 0;
        mSprites.clear();
        mFree.length = 0;
    }

    return {
        update,
        getData,
        ensureMipmaps,
        free,
        getSize: () => mSize,
    };

} // function Sprites()

export { Sprites, MAX_SPRITES };
