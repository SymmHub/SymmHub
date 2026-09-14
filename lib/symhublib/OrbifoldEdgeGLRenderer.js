/**
 * OrbifoldEdgeGLRenderer — draws OrbifoldUITool's fundamental-domain edges
 * (circular arcs, in the Poincare disk / 'circle' projection) directly onto
 * the WebGL pattern canvas, replacing the 2D-canvas iDrawSplane() path used
 * previously.
 *
 * Only SPLANE_SPHERE (bounded circular arc) splanes are supported: the
 * orbifold edge editor is only active for hyperbolic groups
 * (OrbifoldUITool.isActive()), whose fundamental-domain edges are always
 * circular arcs in the disk model.
 *
 * Each edge is drawn as a tessellated polyline of straight GL segments, in
 * world coordinates (the same "world" space as CanvasTransform.world2screen,
 * i.e. the space the canvasVertexShader's vUv already lands in) — so no
 * screen-pixel conversion is needed, only the inversive (Mobius) transform
 * already used by iDrawSplane to move the raw splane into view.
 */

import {
    programBuilder,
    initFragments,
    getBlitMaker,
    setViewport,
    enableBlending,
    ShaderFragments as SF,
} from './modules.js';

import { iTransformU4, iReflect } from '../invlib/Inversive.js';
import { iSphere, SPLANE_SPHERE } from '../invlib/ISplane.js';
import { hexToRGBA, cos, sin, abs } from '../invlib/Utilities.js';

const MYNAME = 'OrbifoldEdgeGLRenderer';
const DEBUG = false;

const fragBaseVertex = { obj: SF, id: 'canvasVertexShader' };
const fragUtils       = { obj: SF, id: 'utils' };
const fragSdf2d        = { obj: SF, id: 'sdf2d' };
const fragDrawSegment  = { obj: SF, id: 'drawSegmentOverlayShader' };

const baseVertexShader = { frags: [fragBaseVertex] };

const myFragments = [fragBaseVertex, fragUtils, fragSdf2d, fragDrawSegment];

const progDrawSegmentOverlay = {
    name: 'DrawSegmentOverlay',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragSdf2d, fragDrawSegment] },
};

const myPrograms = { drawSegmentOverlay: progDrawSegmentOverlay };
const myProgs = programBuilder(myPrograms, true);

let fragmentsInitialized = false;

// segments per full turn (2*PI) of arc; short arcs use proportionally fewer
const SEGMENTS_PER_TURN = 48;
const MIN_SEGMENTS = 6;

function OrbifoldEdgeGLRenderer(options = {}) {

    let mGL = null;

    init(options);

    function init(options) {
        if (options.gl) mGL = options.gl;
        if (!fragmentsInitialized) {
            initFragments(myFragments);
            fragmentsInitialized = true;
        }
        if (mGL) myProgs.getProgram(mGL, 'drawSegmentOverlay'); // triggers compile
    }

    //
    //  transform the raw splane's bounded circle by the given inversive
    //  transform (an array of splanes, as returned by
    //  navigator.getInversiveTransform()) — mirrors the 'circle' branch of
    //  invlib/IDrawing.js#iDrawSplane, but stops before world2screen since
    //  that projection is applied for free by the vertex shader.
    //
    function transformBoundedCircle(splane, itrans) {

        const b = splane.bounds;
        const cx = splane.v[0], cy = splane.v[1], r = abs(splane.v[3]);

        let b0 = [cx + r * cos(-b[0]), cy + r * sin(-b[0]), 0];
        let b1 = [cx + r * cos(-b[1]), cy + r * sin(-b[1]), 0];
        for (let i = 0; i < itrans.length; i++) {
            b0 = iReflect(itrans[i], b0);
            b1 = iReflect(itrans[i], b1);
        }
        let tsplane = iTransformU4(itrans, splane);
        return iSphere(tsplane.v, [b0, b1]);
    }

    //
    //  tessellate a (already view-transformed) bounded circle into a
    //  polyline of world-space points
    //
    function tessellateArc(splane) {

        const cx = splane.v[0], cy = splane.v[1], r = abs(splane.v[3]);
        const [min, max] = splane.bounds;
        const span = max - min;
        const segCount = Math.max(MIN_SEGMENTS, Math.ceil(SEGMENTS_PER_TURN * span / (2 * Math.PI)));

        const pts = [];
        for (let i = 0; i <= segCount; i++) {
            const t = min + span * i / segCount;
            pts.push([cx + r * cos(-t), cy + r * sin(-t)]);
        }
        return pts;
    }

    //
    //  draw one straight world-space segment onto the current framebuffer
    //
    function blitSegment(canvasTransUni, pointA, pointB, colorRGBA, halfWidth, aa) {

        const program = progDrawSegmentOverlay.program;
        if (!program) return;

        program.bind();
        program.setUniforms(canvasTransUni);
        program.setUniforms({
            pointA, pointB,
            color:     colorRGBA,
            halfWidth, aa,
        });
        getBlitMaker(mGL).blit(null); // draw onto the default (visible) framebuffer
    }

    function drawPolyline(canvasTransUni, pts, colorRGBA, widthPixels, pixelSize) {

        const halfWidth = 0.5 * widthPixels * pixelSize;
        const aa = pixelSize; // ~1 screen pixel of antialiasing
        for (let i = 0; i < pts.length - 1; i++) {
            blitSegment(canvasTransUni, pts[i], pts[i + 1], colorRGBA, halfWidth, aa);
        }
    }

    //
    //  public: draw one fd edge (splane) the way OrbifoldUITool wants it —
    //  an optional wide translucent "shadow" pass under a narrower solid
    //  stroke, matching the look of the old ctx-based iDrawSplane() calls.
    //
    //  param: { lineStyle, lineWidth, shadowStyle, shadowWidth } (hex colors,
    //  widths in screen pixels) — same shape as iDrawSplane's param.
    //
    function drawSplane(splane, itrans, canvasTransform, param = {}) {

        if (!mGL || !splane || splane.type !== SPLANE_SPHERE || !splane.bounds) return;

        const lineWidth    = param.lineWidth    ?? 2;
        const lineColor    = hexToRGBA(param.lineStyle    ?? '#0000FF');
        const shadowWidth   = param.shadowWidth  ?? 0;
        const shadowColor  = hexToRGBA(param.shadowStyle  ?? '#00007733');

        const tsplane = transformBoundedCircle(splane, itrans);
        const pts = tessellateArc(tsplane);

        setViewport(mGL, { width: mGL.drawingBufferWidth, height: mGL.drawingBufferHeight });
        enableBlending(mGL);

        const canvasTransUni = canvasTransform.getUniforms({});
        const pixelSize = canvasTransUni.u_pixelSize;

        if (shadowWidth > 0) {
            drawPolyline(canvasTransUni, pts, shadowColor, shadowWidth, pixelSize);
        }
        drawPolyline(canvasTransUni, pts, lineColor, lineWidth, pixelSize);

        return tsplane; // mirrors iDrawSplane's return value (used by OrbifoldUITool for hit-testing)
    }

    return {
        init,
        drawSplane,
        getClassName: () => MYNAME,
    };

} // function OrbifoldEdgeGLRenderer()

export { OrbifoldEdgeGLRenderer };
