/**
 * PatternTransformRenderer.js
 *
 * UI visualization for PatternTransformHandler, drawn with WebGL directly onto
 * the pattern canvas. There is no 2D-canvas drawing left here: every rectangle,
 * ring and tick the tool shows is a splane, and the whole overlay is two
 * full-screen blits — one for the boxes, one for the point marks.
 *
 * Why splanes. A placement box is not stored as four corner points but as its
 * four bounding lines, each oriented so the box's interior is that line's solid
 * (negative-iDistance) side. The box is then the intersection of four
 * half-planes, its signed distance is the max of the four, and one number gives
 * the fill, the outline and the antialiasing at once — exactly the way
 * OrbifoldEdgeGLRenderer treats a fundamental domain. It also means a box
 * survives a Mobius transform: iTransformU4 turns a bounding line into a
 * bounding circle and iDistance handles both, so the fundamental-domain preview
 * of the pattern box is drawn by the same shader as the box itself.
 *
 * Appearance. Rather than coloured outlines and filled handles, the tool now
 * reads as a set of translucent gray veils plus hairlines:
 *
 *   - everything outside every image box is veiled the most;
 *   - the selected image is not veiled at all, wherever it reaches;
 *   - an unselected image is veiled lightly, and overlapping unselected images
 *     stack up darker without ever getting as dark as the bare background.
 *
 * So the selected image is the one you can see cleanly, each other image is a
 * distinguishable shade, and the picture stays legible underneath.
 */

import {
    programBuilder,
    initFragments,
    getBlitMaker,
    setViewport,
    enableBlending,
    ShaderFragments as SF,
    TORADIANS, sin, cos,
} from './modules.js';

import { iTransformU4 } from '../invlib/Inversive.js';
import { iPlane, iSphere, SPLANE_SPHERE, SPLANE_PLANE } from '../invlib/ISplane.js';
import { hexToRGBA } from '../invlib/Utilities.js';

const MYNAME = 'PatternTransformRenderer';

const fragBaseVertex  = { obj: SF, id: 'canvasVertexShader' };
const fragUtils       = { obj: SF, id: 'utils' };
const fragIsplane     = { obj: SF, id: 'isplane' };
const fragPatternBox  = { obj: SF, id: 'patternBoxOverlayShader' };
const fragPatternMark = { obj: SF, id: 'patternMarkOverlayShader' };

const baseVertexShader = { frags: [fragBaseVertex] };

const myFragments = [fragBaseVertex, fragUtils, fragIsplane, fragPatternBox, fragPatternMark];

const progPatternBox = {
    name: 'PatternBoxOverlay',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragIsplane, fragPatternBox] },
};

const progPatternMark = {
    name: 'PatternMarkOverlay',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragIsplane, fragPatternMark] },
};

const myPrograms = {
    patternBoxOverlay:  progPatternBox,
    patternMarkOverlay: progPatternMark,
};
const myProgs = programBuilder(myPrograms, true);

let fragmentsInitialized = false;

// must match patternBoxOverlayShader.glsl.mjs
const PB_MAX_BOXES = 16;

// must match patternMarkOverlayShader.glsl.mjs
const PM_MAX_MARKS = 64;
const PM_STYLES    = 5;

// mark styles, in the order the shader's colour arrays expect
const STYLE_CORNER     = 0; // corner of an unselected image box
const STYLE_CORNER_SEL = 1; // corner of the selected image box
const STYLE_PATTERN    = 2; // corner of the pattern box
const STYLE_PIVOT      = 3; // the pattern's rotate/scale pivot
const STYLE_PROBE      = 4; // double-click probe point and its image

// ── look ─────────────────────────────────────────────────────────────────────
//
// Sizes are in CSS pixels; they are scaled to device pixels at draw time, since
// the canvas transform's u_pixelSize is world units per *device* pixel.

const VEIL_COLOR   = [0.06, 0.07, 0.08];
const VEIL_OUT     = 0.42;  // alpha outside every image box
const VEIL_ONE     = 0.10;  // alpha inside exactly one unselected image box
const VEIL_RATIO   = 0.55;  // each further overlap closes this much of the gap

const HALO_COLOR   = '#00000080';
const HALO_EXTRA   = 1.6;   // css px added to a line's width to make its halo

const LINE_COLOR         = '#FFFFFFB3';
const LINE_WIDTH         = 1.0;
const SEL_LINE_COLOR     = '#FFFFFFFF';
const SEL_LINE_WIDTH     = 1.6;
const PATTERN_LINE_COLOR = '#FFFFFF66';
const GHOST_LINE_COLOR   = '#FF7A7ACC';

const FEATHER = 0.75;       // device px

const MARK_STROKE = [
    '#FFFFFFB3',    // STYLE_CORNER
    '#FFFFFFFF',    // STYLE_CORNER_SEL
    '#FFFFFF8C',    // STYLE_PATTERN
    '#FFB020FF',    // STYLE_PIVOT
    '#FF5A5AFF',    // STYLE_PROBE
];

const MARK_FILL = [
    '#00000033',
    '#FFFFFF66',
    '#00000033',
    '#00000066',
    '#00000066',
];

const MARK_WIDTH = [1.2, 1.6, 1.1, 1.6, 1.4];   // css px

const R_CORNER     = 5.0;   // css px
const R_CORNER_SEL = 6.5;
const R_PATTERN    = 4.0;
const R_PIVOT      = 7.0;
const R_PROBE      = 6.0;
const PIVOT_TICK   = 13.0;  // css px, half-length of each pivot crosshair tick

const UNIT_CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

//
//  four inward-solid bounding planes of the convex quad `corners` (world coords,
//  given in cyclic order). Each plane's normal is flipped, if needed, so that
//  the quad's centre is on its negative side — the same "solid side is negative"
//  convention iDistance uses, so the quad is { p : max_i iDistance(s_i, p) < 0 }.
//
function quadSplanes(corners) {

    let cx = 0, cy = 0;
    for (const c of corners) { cx += c[0]; cy += c[1]; }
    cx /= corners.length; cy /= corners.length;

    const out = [];
    for (let i = 0; i < corners.length; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % corners.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const len = Math.hypot(ex, ey) || 1;
        let nx = ey / len, ny = -ex / len;
        let d = nx * a[0] + ny * a[1];
        if (nx * cx + ny * cy - d > 0) { nx = -nx; ny = -ny; d = -d; }
        out.push(iPlane([nx, ny, 0, d]));
    }
    return out;
}

//  write a box's four splanes into the shader's parallel arrays: `vecs` holds
//  the four vec4s starting at box index `i`, `types` the four types packed into
//  that box's own vec4.
function packSplanes(vecs, types, i, splanes) {
    for (let j = 0; j < 4; j++) {
        const s = splanes[j];
        const k = (i * 4 + j) * 4;
        vecs[k]     = s.v[0];
        vecs[k + 1] = s.v[1];
        vecs[k + 2] = s.v[2];
        vecs[k + 3] = s.v[3];
        types[i * 4 + j] = s.type;
    }
}

//  flatten a list of hex colours into the Float32Array a vec4[] uniform wants
function packColors(hexes) {
    const out = new Float32Array(hexes.length * 4);
    hexes.forEach((h, i) => out.set(hexToRGBA(h), i * 4));
    return out;
}

function PatternTransformRenderer(params) {

    const mConfig  = params.config;
    const mHandler = params.handler;
    // Optional: () => [{centerX,centerY,scale,angle,id}, ...] in pattern space,
    // one per texture image.
    const mGetExtraBoxes = params.getExtraBoxes || null;
    // Optional: () => {minX,minY,maxX,maxY} in pattern space — the union of the
    // visible image boxes. Absent / null => the default [-1,1]^2 box.
    const mGetPatternBox = params.getPatternBox || null;

    let mGL = params.gl || null;

    const mBoxSplane     = new Float32Array(PB_MAX_BOXES * 4 * 4);
    const mBoxType       = new Float32Array(PB_MAX_BOXES * 4);
    const mPatternSplane = new Float32Array(4 * 4);
    const mPatternType   = new Float32Array(4);
    const mGhostSplane   = new Float32Array(4 * 4);
    const mGhostType     = new Float32Array(4);
    const mMarkSplane    = new Float32Array(PM_MAX_MARKS * 4);
    const mMarkParam     = new Float32Array(PM_MAX_MARKS * 4);

    const mMarkStroke = packColors(MARK_STROKE);
    const mMarkFill   = packColors(MARK_FILL);
    const mMarkWidth  = new Float32Array(PM_STYLES);

    init(params);

    function init(options = {}) {
        if (options.gl) mGL = options.gl;
        if (!fragmentsInitialized) {
            initFragments(myFragments);
            fragmentsInitialized = true;
        }
        if (mGL) {
            myProgs.getProgram(mGL, 'patternBoxOverlay');   // triggers compile
            myProgs.getProgram(mGL, 'patternMarkOverlay');
        }
    }

    // ── pattern space -> world ───────────────────────────────────────────────

    function patternToWorld(p) {
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale !== undefined ? mConfig.scale : 1;
        const sa = sin(angle), ca = cos(angle);
        return [scale * (ca * p[0] - sa * p[1]) + (mConfig.centerX || 0),
                scale * (sa * p[0] + ca * p[1]) + (mConfig.centerY || 0)];
    }

    // corners of the pattern box, in world coords
    function patternCornersWorld() {
        const b = mGetPatternBox && mGetPatternBox();
        const cs = b
            ? [[b.minX, b.maxY], [b.maxX, b.maxY], [b.maxX, b.minY], [b.minX, b.minY]]
            : UNIT_CORNERS;
        return cs.map(patternToWorld);
    }

    // corners of one image's placement box, in world coords
    function imageCornersWorld(box) {
        const a = (box.angle || 0) * TORADIANS;
        const s = box.scale === undefined ? 1 : box.scale;
        const ca = cos(a), sa = sin(a);
        return UNIT_CORNERS.map(([ux, uy]) => patternToWorld([
            (box.centerX || 0) + s * (ca * ux - sa * uy),
            (box.centerY || 0) + s * (sa * ux + ca * uy),
        ]));
    }

    // ── marks ────────────────────────────────────────────────────────────────

    // A ring of `radius` world units about the world point c: a sphere splane,
    // whose iDistance is |p - c| - radius.
    function ringMark(n, c, radius, style) {
        if (n >= PM_MAX_MARKS) return n;
        const s = iSphere([c[0], c[1], 0, radius]);
        const k = n * 4;
        mMarkSplane[k] = s.v[0]; mMarkSplane[k + 1] = s.v[1];
        mMarkSplane[k + 2] = s.v[2]; mMarkSplane[k + 3] = s.v[3];
        mMarkParam[k] = SPLANE_SPHERE;
        mMarkParam[k + 1] = 0; mMarkParam[k + 2] = 0;
        mMarkParam[k + 3] = style;
        return n + 1;
    }

    // A segment through the world point c, along direction d, reaching halfLen
    // world units each way: a line splane carrying its extent along its own
    // tangent, measured from the line's foot point (the point of it closest to
    // the origin), which is the frame the shader clamps in.
    function segmentMark(n, c, d, halfLen, style) {
        if (n >= PM_MAX_MARKS) return n;
        const len = Math.hypot(d[0], d[1]) || 1;
        const ux = d[0] / len, uy = d[1] / len;
        const nx = uy, ny = -ux;                 // unit normal
        const dist = nx * c[0] + ny * c[1];
        const fx = nx * dist, fy = ny * dist;    // foot point
        const tx = -ny, ty = nx;                 // unit tangent
        const s = (c[0] - fx) * tx + (c[1] - fy) * ty;

        const sp = iPlane([nx, ny, 0, dist]);
        const k = n * 4;
        mMarkSplane[k] = sp.v[0]; mMarkSplane[k + 1] = sp.v[1];
        mMarkSplane[k + 2] = sp.v[2]; mMarkSplane[k + 3] = sp.v[3];
        mMarkParam[k] = SPLANE_PLANE;
        mMarkParam[k + 1] = s - halfLen; mMarkParam[k + 2] = s + halfLen;
        mMarkParam[k + 3] = style;
        return n + 1;
    }

    // ── drawing ──────────────────────────────────────────────────────────────

    function beginFrame(canvasTransform) {
        setViewport(mGL, { width: mGL.drawingBufferWidth, height: mGL.drawingBufferHeight });
        enableBlending(mGL);
        return canvasTransform.getUniforms({});
    }

    // css px -> device px. u_pixelSize is world units per device pixel, so every
    // size quoted in css px goes through here before being used as a width.
    function devicePerCss() {
        const c = mGL && mGL.canvas;
        if (c && c.clientWidth > 0) return c.width / c.clientWidth;
        return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    }

    //
    //  main entry, called once per frame by SymRenderer. `ctx` is the 2D overlay
    //  context and is deliberately unused: nothing in this tool is drawn there
    //  any more.
    //
    function renderUI(ctx, canvasTransform) {

        if (!mGL || !canvasTransform) return;
        const boxProgram  = progPatternBox.program;
        const markProgram = progPatternMark.program;
        if (!boxProgram || !markProgram) return;

        const canvasTransUni = beginFrame(canvasTransform);
        const pixelSize = canvasTransUni.u_pixelSize;
        const dpr = devicePerCss();
        const px = (cssPx) => cssPx * dpr;               // css px -> device px
        const world = (cssPx) => cssPx * dpr * pixelSize; // css px -> world units

        const sel = (mHandler && mHandler.getSelection) ? mHandler.getSelection() : null;
        const boxes = (mGetExtraBoxes && mGetExtraBoxes()) || [];

        // Boxes. With no per-image boxes the pattern box is the only rectangle
        // there is, so it plays the part of the single image: the veil then
        // separates the pattern from everything around it.
        const cornerSets = boxes.length
            ? boxes.map(imageCornersWorld)
            : [patternCornersWorld()];

        let boxCount = 0;
        let selected = -1;
        for (let i = 0; i < cornerSets.length && boxCount < PB_MAX_BOXES; i++) {
            packSplanes(mBoxSplane, mBoxType, boxCount, quadSplanes(cornerSets[i]));
            if (boxes.length && sel && sel.kind === 'image' && sel.id === boxes[i].id)
                selected = boxCount;
            boxCount++;
        }

        const patternCorners = patternCornersWorld();
        const patternSplanes = quadSplanes(patternCorners);
        packSplanes(mPatternSplane, mPatternType, 0, patternSplanes);
        // with no image boxes the pattern box is already box 0; don't outline it twice
        const hasPattern = boxes.length > 0;
        const patternSelected = !!(sel && sel.kind === 'pattern');
        if (!hasPattern && patternSelected) selected = 0;

        // The pattern box carried back through the fundamental-domain transform
        // picked up by a double click. Its bounding lines may come back as
        // circles; the shader reads either.
        const fdTrans = (mHandler && mHandler.getFundDomainTransform)
            ? mHandler.getFundDomainTransform() : null;
        let hasGhost = false;
        if (fdTrans) {
            const inv = fdTrans.getInverse();
            packSplanes(mGhostSplane, mGhostType, 0,
                        patternSplanes.map(sp => iTransformU4(inv, sp)));
            hasGhost = true;
        }

        boxProgram.bind();
        boxProgram.setUniforms(canvasTransUni);
        boxProgram.setUniforms({
            uBoxSplane:        mBoxSplane,
            uBoxType:          mBoxType,
            uBoxCount:         boxCount,
            uSelected:         selected,
            uPatternSplane:    mPatternSplane,
            uPatternType:      mPatternType,
            uHasPattern:       hasPattern,
            uPatternSelected:  hasPattern && patternSelected,
            uGhostSplane:      mGhostSplane,
            uGhostType:        mGhostType,
            uHasGhost:         hasGhost,
            uFeather:          FEATHER,
            uShadowColor:      VEIL_COLOR,
            uShadowOut:        VEIL_OUT,
            uShadowOne:        VEIL_ONE,
            uShadowRatio:      VEIL_RATIO,
            uHaloColor:        hexToRGBA(HALO_COLOR),
            uHaloExtra:        px(HALO_EXTRA),
            uLineWidth:        px(LINE_WIDTH),
            uSelLineWidth:     px(SEL_LINE_WIDTH),
            uLineColor:        hexToRGBA(LINE_COLOR),
            uSelLineColor:     hexToRGBA(SEL_LINE_COLOR),
            uPatternLineColor: hexToRGBA(PATTERN_LINE_COLOR),
            uGhostLineColor:   hexToRGBA(GHOST_LINE_COLOR),
        });
        getBlitMaker(mGL).blit(null);   // onto the default (visible) framebuffer

        // Marks: corner grab handles, the pivot, and the probe points.
        let n = 0;

        for (let i = 0; i < cornerSets.length; i++) {
            const isSel = (i === selected);
            const style = isSel ? STYLE_CORNER_SEL : STYLE_CORNER;
            const r = world(isSel ? R_CORNER_SEL : R_CORNER);
            for (const c of cornerSets[i]) n = ringMark(n, c, r, style);
        }

        if (hasPattern)
            for (const c of patternCorners)
                n = ringMark(n, c, world(R_PATTERN), STYLE_PATTERN);

        const pivot = patternToWorld([mConfig.pivotX || 0, mConfig.pivotY || 0]);
        n = ringMark(n, pivot, world(R_PIVOT), STYLE_PIVOT);
        n = segmentMark(n, pivot, [1, 0], world(PIVOT_TICK), STYLE_PIVOT);
        n = segmentMark(n, pivot, [0, 1], world(PIVOT_TICK), STYLE_PIVOT);

        if (mHandler) {
            const dbPoint = mHandler.getDoubleClickPoint();
            const dbImage = mHandler.getDoubleClickImage();
            if (dbPoint) n = ringMark(n, dbPoint, world(R_PROBE), STYLE_PROBE);
            if (dbImage) n = ringMark(n, dbImage, world(R_PROBE), STYLE_PROBE);
        }

        if (n === 0) return;

        for (let i = 0; i < PM_STYLES; i++) mMarkWidth[i] = px(MARK_WIDTH[i]);

        markProgram.bind();
        markProgram.setUniforms(canvasTransUni);
        markProgram.setUniforms({
            uMarkSplane:   mMarkSplane,
            uMarkParam:    mMarkParam,
            uMarkCount:    n,
            uFeather:      FEATHER,
            uHaloColor:    hexToRGBA(HALO_COLOR),
            uHaloExtra:    px(HALO_EXTRA),
            uStrokeColor:  mMarkStroke,
            uFillColor:    mMarkFill,
            uStrokeWidth:  mMarkWidth,
        });
        getBlitMaker(mGL).blit(null);
    }

    return {
        init,
        renderUI,
        getClassName: () => MYNAME,
    };

} // function PatternTransformRenderer()

export {
    PatternTransformRenderer
};
