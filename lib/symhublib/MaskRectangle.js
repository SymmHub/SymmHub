/**
 * MaskRectangle.js
 *
 * Axis-aligned rectangular mask shape for MaskWorker.
 *
 * Parameters (in world space [-1, 1]):
 *   centerX, centerY  — centre of the rectangle
 *   width, height     — full dimensions of the rectangle
 *
 * Exposes getShapeUniforms() used by MaskWorker to upload uniforms to the shader.
 */

import {
    ParamFloat,
    ParamGroup,
} from './modules.js';

const MYNAME = 'MaskRectangle';

export function MaskRectangle(options = {}) {

    const mConfig = {
        centerX: options.centerX ?? 0.0,
        centerY: options.centerY ?? 0.0,
        width:   options.width   ?? 1.0,
        height:  options.height  ?? 1.0,
    };

    let mParams = null;

    // ── shape interface ───────────────────────────────────────────────────────

    /** Returns the mask type index expected by the shader (0 = rectangle). */
    function getMaskType() { return 0; }

    /**
     * Returns the uniform values for the current shape configuration.
     * MaskWorker merges these into its setUniforms() call.
     */
    function getShapeUniforms() {
        return {
            uCenter:  [mConfig.centerX, mConfig.centerY],
            uExtents: [mConfig.width * 0.5, mConfig.height * 0.5],
            uRadius:  0,  // unused for rectangle
        };
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return ParamGroup({
            name: 'rectangle',
            params: {
                centerX: ParamFloat({ obj: c, key: 'centerX', min: -1, max: 1, step: 0.001, name: 'center X' }),
                centerY: ParamFloat({ obj: c, key: 'centerY', min: -1, max: 1, step: 0.001, name: 'center Y' }),
                width:   ParamFloat({ obj: c, key: 'width',   min:  0, max: 2, step: 0.001, name: 'width'    }),
                height:  ParamFloat({ obj: c, key: 'height',  min:  0, max: 2, step: 0.001, name: 'height'   }),
            },
        });
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── serialisation ─────────────────────────────────────────────────────────

    function getClassName() { return MYNAME; }
    function getName()      { return MYNAME; }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        getMaskType,
        getShapeUniforms,
        getParams,
        getName,
        getClassName,
    };

} // MaskRectangle
