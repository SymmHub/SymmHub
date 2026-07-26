/**
 * MaskTriangle.js
 *
 * Regular equilateral triangle mask shape for MaskWorker.
 *
 * Orientation: one vertex points right — first vertex at (cx + radius, cy),
 * remaining two rotated by ±120°.
 * `radius` is the circumradius (distance from centre to vertex), in world space [-1, 1].
 *
 * Parameters:
 *   centerX, centerY  — centre of the triangle (world space)
 *   radius            — circumradius
 */

import {
    ParamFloat,
    ParamGroup,
} from './modules.js';

const MYNAME = 'MaskTriangle';

export function MaskTriangle(options = {}) {

    const mConfig = {
        centerX: options.centerX ?? 0.0,
        centerY: options.centerY ?? 0.0,
        radius:  options.radius  ?? 0.8,
    };

    let mParams = null;

    // ── shape interface ───────────────────────────────────────────────────────

    /** Returns mask type index 4 = triangle */
    function getMaskType() { return 4; }

    function getShapeUniforms() {
        return {
            uCenter:  [mConfig.centerX, mConfig.centerY],
            uRadius:  mConfig.radius,
            uExtents: [0, 0],  // unused for triangle
        };
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return ParamGroup({
            name: 'triangle',
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

} // MaskTriangle
