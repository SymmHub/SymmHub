import {
    SymRendererPrograms,
    DataPacking,
    enableBlending,
    setViewport,
} from './modules.js';

//
//  EditingOverlay - the editing overlay drawn by the GPU (docs/gpu_editing_overlay_assessment.md,
//  outside the repository)
//
//  The drawing tools describe what they show over the picture as geometry in world
//  coordinates: polylines (the selection outlines, the transform box's frame, the
//  lines being drawn, the lines to control handles) and points (handles, the pivot,
//  the snap marker), each with its style in pixels. This pass packs them into a float
//  texture and draws them with the program overlayEditing (lib/shaders/overlay_editing.glsl.mjs),
//  which takes every pixel to its world point through the view's chain of maps, as the
//  pattern is drawn, so the overlay lies on the picture under any projection, where the
//  2D canvas, placed by the linear view, does not. Glyph sizes stay pixels through the
//  chain's local scale. Text stays on the 2D canvas.
//
//  geometry (OverlayGeometry.js builds it): {
//    polylines: [{ points: [[x, y], ...], width, color: [r, g, b, a], dash, gap, halo: [r, g, b, a], haloWidth, closed }],
//    points:    [{ p: [x, y], kind: 'disc' | 'square' | 'diamond' | 'cross', size, color, fill, width }],
//    splanes:   [{ circle: [cx, cy, r] | line: [nx, ny, d], range: [u0, u1] | null, width, color, dash, gap, halo, haloWidth }],
//  }
//  colours are straight rgba in 0..1; sizes, widths, dashes are pixels; a point's size is its radius.
//

const TEX_W = 2048;                 // texels a row, as the shader reads it
const POINT_KINDS = { disc: 0, square: 1, diamond: 2, cross: 3 };
const INFINITE = 1e30;              // the end of a ray, as the texture holds it

function premult(c){
    if (!c) return [0, 0, 0, 0];
    const a = c.length > 3 ? c[3] : 1;
    return [c[0]*a, c[1]*a, c[2]*a, a];
}

/**
 * the geometry as the texture's texels: {data: Float32Array, texels, polylines, points, splanes};
 * polylines without two points, points without a place and splanes without a trace are left out
 */
function packGeometry(geometry){
    const polys = (geometry && geometry.polylines || []).filter(pl => pl && pl.points && pl.points.length >= 2);
    const pts = (geometry && geometry.points || []).filter(pt => pt && pt.p);
    const spls = (geometry && geometry.splanes || []).filter(s => s && (s.circle || s.line));
    const texels = [];
    const push = (a, b, c, d) => texels.push(a, b, c, d);
    // the headers and the directory are filled in at the end
    push(0, 0, 0, 0);
    push(0, 0, 0, 0);
    const dir = 2;
    for (let k = 0; k < polys.length; k++) push(0, 0, 0, 0);
    const offsets = [];
    for (const pl of polys) {
        offsets.push(texels.length/4);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pl.points) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
        const halo = pl.halo ? premult(pl.halo) : [0, 0, 0, 0];
        push(pl.points.length, pl.width || 1, pl.dash || 0, pl.gap || (pl.dash || 0));
        push(...premult(pl.color || [0, 0, 0, 1]));
        push(...halo);
        push(pl.haloWidth || ((pl.width || 1) + 2.5), pl.closed ? 1 : 0, 0, 0);
        push(x0, y0, x1, y1);
        for (const p of pl.points) push(p[0], p[1], 0, 0);
    }
    const pointsStart = texels.length/4;
    for (const pt of pts) {
        push(pt.p[0], pt.p[1], POINT_KINDS[pt.kind] || 0, pt.size || 4);
        push(...premult(pt.color || [0, 0, 0, 1]));
        push(...(pt.fill ? premult(pt.fill) : [0, 0, 0, 0]));
        push(pt.width === undefined ? 1.5 : pt.width, 0, 0, 0);
    }
    const splanesStart = texels.length/4;
    const finite = u => Math.max(-INFINITE, Math.min(INFINITE, u));
    for (const s of spls) {
        push(s.circle ? 0 : 1, s.width || 1, s.dash || 0, s.gap || (s.dash || 0));
        push(...premult(s.color || [0, 0, 0, 1]));
        push(...(s.halo ? premult(s.halo) : [0, 0, 0, 0]));
        const r = s.range;
        push(s.haloWidth || 0, r ? 1 : 0, r ? finite(r[0]) : 0, r ? finite(r[1]) : 0);
        const g = s.circle || s.line;
        push(g[0], g[1], g[2], 0);
    }
    texels[0] = polys.length; texels[1] = pts.length; texels[2] = dir; texels[3] = pointsStart;
    texels[4] = spls.length; texels[5] = splanesStart;
    for (let k = 0; k < polys.length; k++) texels[4*(dir + k)] = offsets[k];
    const count = texels.length/4;
    const rows = Math.max(1, Math.ceil(count/TEX_W));
    const data = new Float32Array(TEX_W*rows*4);
    data.set(texels);
    return { data, texels: count, rows, polylines: polys.length, points: pts.length, splanes: spls.length };
}

/**
 * the pass; init(glCtx) once, then render(par, geometry) after the visualization
 * layers with the par they get (navigatorUni, renderUni, canvas)
 */
function EditingOverlay(){

    let mGL = null;
    let mPrograms = null;
    let mTexture = null;
    let mRows = 0;

    function init(glCtx){
        mGL = glCtx.gl;
        mPrograms = SymRendererPrograms();
        mTexture = DataPacking.createGroupDataSampler(mGL);
    }

    function upload(packed){
        const gl = mGL;
        gl.bindTexture(gl.TEXTURE_2D, mTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEX_W, packed.rows, 0, gl.RGBA, gl.FLOAT, packed.data);
        gl.bindTexture(gl.TEXTURE_2D, null);
        mRows = packed.rows;
    }

    function render(par, geometry){
        if (!mGL) return false;
        const packed = packGeometry(geometry);
        if (!packed.polylines && !packed.points && !packed.splanes) return false;
        const prog = mPrograms.getProgram('overlayEditing');
        if (!prog) return false;
        upload(packed);
        const gl = mGL;
        enableBlending(gl);
        prog.bind();
        prog.setUniforms(par.navigatorUni);
        prog.setUniforms(par.renderUni);
        prog.setUniforms({ uEditData: mTexture, uEditPolylines: packed.polylines, uEditPoints: packed.points, uEditSplanes: packed.splanes, uTransparency: 0, uSubEnabled: false });
        setViewport(gl, par.canvas);
        prog.blit(par.renderTarget ?? null);
        return true;
    }

    return {
        init,
        render,
        isReady: () => !!mGL,
    };
}

export {
    EditingOverlay,
    packGeometry,
};
