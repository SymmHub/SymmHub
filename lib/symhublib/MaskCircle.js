/**
 * MaskCircle.js
 *
 * Circular mask shape for MaskWorker.
 *
 * Parameters (in world space [-1, 1]):
 *   centerX, centerY  — centre of the circle
 *   radius            — radius of the circle
 *
 * Exposes getShapeUniforms() used by MaskWorker to upload uniforms to the shader.
 */

import {
    ParamFloat,
    ParamGroup,
} from './modules.js';

const MYNAME = 'MaskCircle';

export function MaskCircle(options = {}) {

    const mConfig = {
        centerX: options.centerX ?? 0.0,
        centerY: options.centerY ?? 0.0,
        radius:  options.radius  ?? 0.8,
    };

    let mParams = null;

    // ── shape interface ───────────────────────────────────────────────────────

    /** Returns the mask type index expected by the shader (1 = circle). */
    function getMaskType() { return 1; }

    /**
     * Returns the uniform values for the current shape configuration.
     * MaskWorker merges these into its setUniforms() call.
     */
    function getShapeUniforms() {
        return {
            uCenter:  [mConfig.centerX, mConfig.centerY],
            uRadius:  mConfig.radius,
            uExtents: [0, 0],  // unused for circle
        };
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return ParamGroup({
            name: 'circle',
            params: {
                centerX: ParamFloat({ obj: c, key: 'centerX', min: -1, max: 1, step: 0.001, name: 'center X' }),
                centerY: ParamFloat({ obj: c, key: 'centerY', min: -1, max: 1, step: 0.001, name: 'center Y' }),
                radius:  ParamFloat({ obj: c, key: 'radius',  min:  0, max: 2, step: 0.001, name: 'radius'   }),
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

} // MaskCircle
