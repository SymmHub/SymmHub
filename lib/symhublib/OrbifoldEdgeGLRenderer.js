/**
 * OrbifoldEdgeGLRenderer — draws OrbifoldUITool's fundamental domain (its
 * bounding edges and, optionally, its interior) directly onto the WebGL
 * pattern canvas, replacing the 2D-canvas iDrawSplane() path used previously.
 *
 * Everything is drawn from the splanes themselves, not from arcs derived from
 * them: an edge is a bounded splane, and a fragment belongs to its stroke when
 * its distance to the splane's zero set — |p - center| - |radius| for a
 * spherical splane, dot(p, normal) - distance for a line splane — is within
 * half the stroke width. So there is no tessellation and no segment count to
 * tune: the curve is exact at every zoom and under every navigator transform,
 * and the antialiasing is a per-pixel smoothstep on that same distance.
 *
 * The domain interior is the intersection of the solid side of each bounding
 * splane, i.e. the max of their signed distances (fdInteriorOverlayShader).
 *
 * Both flavors of splane are supported. Spherical splanes carry angular
 * `bounds` (in the negated-angle convention of ISplane.iSphere) and are
 * stroked only between them, with round caps; line splanes are unbounded, as
 * in iDrawSplane().
 *
 * All drawing happens in world coordinates — the same "world" space as
 * CanvasTransform.world2screen, i.e. the space the canvasVertexShader's vUv
 * already lands in — so no screen-pixel conversion is needed beyond turning
 * pixel stroke widths into world lengths. Only the inversive (Mobius)
 * transform already used by iDrawSplane is applied, to move the raw splanes
 * into view.
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
import { iSphere, SPLANE_SPHERE, SPLANE_PLANE } from '../invlib/ISplane.js';
import { hexToRGBA, cos, sin, abs } from '../invlib/Utilities.js';

const MYNAME = 'OrbifoldEdgeGLRenderer';

const fragBaseVertex = { obj: SF, id: 'canvasVertexShader' };
const fragUtils      = { obj: SF, id: 'utils' };
const fragIsplane    = { obj: SF, id: 'isplane' };
const fragDrawSplane = { obj: SF, id: 'drawSplaneOverlayShader' };
const fragFDInterior = { obj: SF, id: 'fdInteriorOverlayShader' };

const baseVertexShader = { frags: [fragBaseVertex] };

const myFragments = [fragBaseVertex, fragUtils, fragIsplane, fragDrawSplane, fragFDInterior];

const progDrawSplaneOverlay = {
    name: 'DrawSplaneOverlay',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragIsplane, fragDrawSplane] },
};

const progFDInteriorOverlay = {
    name: 'FDInteriorOverlay',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragIsplane, fragFDInterior] },
};

const myPrograms = {
    drawSplaneOverlay: progDrawSplaneOverlay,
    fdInteriorOverlay: progFDInteriorOverlay,
};
const myProgs = programBuilder(myPrograms, true);

let fragmentsInitialized = false;

// must match FD_MAX_SPLANES / FD_STRIDE in fdInteriorOverlayShader.glsl.mjs
const FD_MAX_SPLANES = 64;
const FD_STRIDE      = 5;

// antialiasing half-width of the interior's boundary, in screen pixels
const FILL_FEATHER = 0.5;

function OrbifoldEdgeGLRenderer(options = {}) {

    let mGL = null;
    const mFDData = new Float32Array(FD_MAX_SPLANES * FD_STRIDE);

    init(options);

    function init(options) {
        if (options.gl) mGL = options.gl;
        if (!fragmentsInitialized) {
            initFragments(myFragments);
            fragmentsInitialized = true;
        }
        if (mGL) {
            // triggers compile
            myProgs.getProgram(mGL, 'drawSplaneOverlay');
            myProgs.getProgram(mGL, 'fdInteriorOverlay');
        }
    }

    //
    //  move a splane into view coordinates. A bounded circle's endpoints have
    //  to be reflected separately and the angular bounds recomputed from them
    //  — mirrors the 'circle' branch of invlib/IDrawing.js#iDrawSplane, but
    //  stops before world2screen since that projection is applied for free by
    //  the vertex shader.
    //
    function toViewCoords(splane, itrans) {

        if (splane.type !== SPLANE_SPHERE || !splane.bounds)
            return iTransformU4(itrans, splane);

        const b = splane.bounds;
        const cx = splane.v[0], cy = splane.v[1], r = abs(splane.v[3]);

        let b0 = [cx + r * cos(-b[0]), cy + r * sin(-b[0]), 0];
        let b1 = [cx + r * cos(-b[1]), cy + r * sin(-b[1]), 0];
        for (let i = 0; i < itrans.length; i++) {
            b0 = iReflect(itrans[i], b0);
            b1 = iReflect(itrans[i], b1);
        }
        return iSphere(iTransformU4(itrans, splane).v, [b0, b1]);
    }

    //
    //  stroke one view-space splane: a path of thickness 2*halfWidth centred on
    //  the splane, or offset by `offset` toward its solid side (which is how
    //  iDrawSplane() drew the translucent shadow — inside the domain, not
    //  straddling the edge).
    //
    function strokeSplane(canvasTransUni, splane, colorRGBA, halfWidth, aa, offset) {

        const program = progDrawSplaneOverlay.program;
        if (!program) return;

        program.bind();
        program.setUniforms(canvasTransUni);
        program.setUniforms({
            uSplane:     [splane.v[0], splane.v[1], splane.v[2], splane.v[3]],
            uSplaneType: splane.type,
            uBounds:     splane.bounds ? [splane.bounds[0], splane.bounds[1]] : [0, 0],
            uBounded:    !!splane.bounds,
            uColor:      colorRGBA,
            uHalfWidth:  halfWidth,
            uAA:         aa,
            uOffset:     offset,
        });
        getBlitMaker(mGL).blit(null); // draw onto the default (visible) framebuffer
    }

    function beginFrame(canvasTransform) {
        setViewport(mGL, { width: mGL.drawingBufferWidth, height: mGL.drawingBufferHeight });
        enableBlending(mGL);
        return canvasTransform.getUniforms({});
    }

    //
    //  public: draw one fd edge (splane) the way OrbifoldUITool wants it —
    //  an optional wide translucent "shadow" pass under a narrower solid
    //  stroke, matching the look of the old ctx-based iDrawSplane() calls.
    //
    //  param: { lineStyle, lineWidth, shadowStyle, shadowWidth } (hex colors,
    //  widths in screen pixels) — same shape as iDrawSplane's param.
    //
    //  Returns the view-space splane, as iDrawSplane did (OrbifoldUITool keeps
    //  it for hit-testing).
    //
    function drawSplane(splane, itrans, canvasTransform, param = {}) {

        if (!mGL || !splane) return;
        if (splane.type !== SPLANE_SPHERE && splane.type !== SPLANE_PLANE) return;

        const lineWidth   = param.lineWidth   ?? 2;
        const lineColor   = hexToRGBA(param.lineStyle   ?? '#0000FF');
        const shadowWidth = param.shadowWidth ?? 0;
        const shadowColor = hexToRGBA(param.shadowStyle ?? '#00007733');

        const tsplane = toViewCoords(splane, itrans);

        const canvasTransUni = beginFrame(canvasTransform);
        const pixelSize = canvasTransUni.u_pixelSize;
        const aa = pixelSize; // ~1 screen pixel of antialiasing

        if (shadowWidth > 0) {
            const halfWidth = 0.5 * shadowWidth * pixelSize;
            strokeSplane(canvasTransUni, tsplane, shadowColor, halfWidth, aa, halfWidth);
        }
        strokeSplane(canvasTransUni, tsplane, lineColor, 0.5 * lineWidth * pixelSize, aa, 0);

        return tsplane;
    }

    //
    //  public: fill the interior of the domain bounded by `splanes` (the raw,
    //  untransformed bounding splanes — their angular bounds are ignored, each
    //  one bounds the domain as a whole half-space).
    //
    //  param: { fillStyle } (hex color, alpha included)
    //
    function drawInterior(splanes, itrans, canvasTransform, param = {}) {

        const program = progFDInteriorOverlay.program;
        if (!mGL || !program || !splanes || splanes.length === 0) return;

        let count = 0;
        for (const splane of splanes) {
            if (count >= FD_MAX_SPLANES) break;
            if (!splane || (splane.type !== SPLANE_SPHERE && splane.type !== SPLANE_PLANE)) continue;
            const t = iTransformU4(itrans, splane);
            const k = count * FD_STRIDE;
            mFDData[k]     = t.v[0];
            mFDData[k + 1] = t.v[1];
            mFDData[k + 2] = t.v[2];
            mFDData[k + 3] = t.v[3];
            mFDData[k + 4] = t.type;
            count++;
        }
        if (count === 0) return;

        const canvasTransUni = beginFrame(canvasTransform);

        program.bind();
        program.setUniforms(canvasTransUni);
        program.setUniforms({
            uFDData:    mFDData,
            uFDCount:   count,
            uFillColor: hexToRGBA(param.fillStyle ?? '#00007722'),
            uFeather:   FILL_FEATHER,
        });
        getBlitMaker(mGL).blit(null);
    }

    return {
        init,
        drawSplane,
        drawInterior,
        getClassName: () => MYNAME,
    };

} // function OrbifoldEdgeGLRenderer()

export { OrbifoldEdgeGLRenderer };
