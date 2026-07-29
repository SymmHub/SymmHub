/**
 * MaskWorker.js
 *
 * ProcessingWorker: applies a geometric mask to the shared DoubleFBO each frame.
 *
 * For every texel:
 *   — inside the mask shape  → value is unchanged
 *   — outside the mask shape → value is replaced with uMaskValue (a configurable vec2)
 *
 * Mask shapes (maskType parameter):
 *   'rectangle' — axis-aligned rectangle (MaskRectangle)
 *   'circle'    — circle (MaskCircle)
 *
 * Shape parameters are managed by the active shape object, exposed via ParamObj.
 *
 * Interface (ProcessingWorker):
 *   init(glCtx)
 *   process(buffer, time)
 *   getParams()
 *   getName() / getClassName()
 */

import {
    ParamBool,
    ParamFloat,
    ParamChoice,
    ParamObj,
    ShaderFragments as SF,
    programBuilder,
} from './modules.js';

import { MaskRectangle } from './MaskRectangle.js';
import { MaskCircle }    from './MaskCircle.js';
import { MaskTruchet }   from './MaskTruchet.js';
import { MaskHexagon }   from './MaskHexagon.js';
import { MaskTriangle }  from './MaskTriangle.js';

const MYNAME = 'MaskWorker';

// ── Shader program ────────────────────────────────────────────────────────────

const fragBaseVertex = { obj: SF, id: 'canvasVertexShader' };
const fragMask       = { obj: SF, id: 'maskShader' };
const fragSplane     = { obj: SF, id: 'isplane' };
const fragUtils      = { obj: SF, id: 'utils' };     // provides linearStep()

const Mask_programs = programBuilder({
    mask: {
        name: 'Mask',
        vs:   { frags: [fragBaseVertex] },
        fs:   { frags: [fragSplane, fragUtils, fragMask] },
    },
}, /* compileAll = */ false);

// ── Shape registry ────────────────────────────────────────────────────────────

const MASK_TYPE_RECTANGLE = 'rectangle';
const MASK_TYPE_CIRCLE    = 'circle';
const MASK_TYPE_TRUCHET   = 'truchet';
const MASK_TYPE_HEXAGON   = 'hexagon';
const MASK_TYPE_TRIANGLE  = 'triangle';

const maskTypeNames = [MASK_TYPE_RECTANGLE, MASK_TYPE_CIRCLE, MASK_TYPE_TRUCHET, MASK_TYPE_HEXAGON, MASK_TYPE_TRIANGLE];

function createShape(typeName, options = {}) {
    switch (typeName) {
        case MASK_TYPE_CIRCLE:   return MaskCircle(options);
        case MASK_TYPE_TRUCHET:  return MaskTruchet(options);
        case MASK_TYPE_HEXAGON:  return MaskHexagon(options);
        case MASK_TYPE_TRIANGLE: return MaskTriangle(options);
        case MASK_TYPE_RECTANGLE:
        default:                 return MaskRectangle(options);
    }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export function MaskWorker(options = {}) {

    let mGLCtx  = null;
    let mParams = null;

    const mConfig = {
        enabled:    options.enabled    ?? false,
        maskType:   options.maskType   ?? MASK_TYPE_RECTANGLE,
        maskValueR: options.maskValueR ?? 1.0,   // R component written outside mask
        maskValueG: options.maskValueG ?? 0.0,   // G component written outside mask
    };

    // Active shape object — rebuilt whenever maskType changes
    let mShape = createShape(mConfig.maskType, options);

    // Reference to the shape's ParamObj — set in makeParams(), used by
    // onMaskTypeChanged() to call replaceObj() and refresh the UI.
    let mShapeParamObj = null;

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        mGLCtx = glCtx;
        Mask_programs.getProgram(glCtx.gl, 'mask');  // trigger compile
    }

    // ── processing ────────────────────────────────────────────────────────────

    /**
     * Apply the mask in-place to the shared DoubleFBO.
     * @param {DoubleFBO} buffer
     * @param {number}    time   — unused, kept for interface conformance
     */
    function process(buffer, time) {
        if (!mConfig.enabled) return;
        if (!mGLCtx) return;

        const gl      = mGLCtx.gl;
        const program = Mask_programs.getProgram(gl, 'mask');

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        // Vertex shader (canvasVertexShader) requires these to produce correct vUv.
        // For the mask pass we want a 1:1 mapping — no pan/zoom, aspect ratio 1.
        program.setUniforms({
            u_aspect: 1,
            u_scale:  1,
            u_center: [0, 0],
        });

        program.setUniforms({
            uSource:     buffer.read,
            uMaskType:   mShape.getMaskType(),
            uMaskValue:  [mConfig.maskValueR, mConfig.maskValueG],
        });

        program.setUniforms(mShape.getShapeUniforms());

        program.blit(buffer.write);
        buffer.swap();
    }


    // ── mask type change ──────────────────────────────────────────────────────

    function onMaskTypeChanged() {
        mShape = createShape(mConfig.maskType);
        // Use ParamObj's built-in replaceObj() to tear down the old shape
        // controllers and rebuild the UI from the new shape in one call.
        if (mShapeParamObj) mShapeParamObj.replaceObj(mShape);
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return {
            enabled:    ParamBool({  obj: c, key: 'enabled', name: 'enabled' }),
            maskType:   ParamChoice({
                obj:    c,
                key:    'maskType',
                choice: maskTypeNames,
                name:   'mask type',
                onChange: onMaskTypeChanged,
            }),
            maskValueR:  ParamFloat({ obj: c, key: 'maskValueR',  name: 'mask R' }),
            maskValueG:  ParamFloat({ obj: c, key: 'maskValueG',  name: 'mask G' }),
            shape:       (mShapeParamObj = ParamObj({ name: 'shape', obj: mShape })),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        getId:        () => 'Mask',
        getName:      () => 'Mask',
        getClassName: () => MYNAME,
        getParams,
        process,
    };

} // MaskWorker
