/**
 * PatternTransformUtil.js
 *
 * Geometric utility functions for pattern transformations.
 */
import { TORADIANS, cos, sin, cPolar, cAdd, cMul } from './modules.js';

/**
 * Computes the canonical pattern transform (with pivot = 0) from an
 * extended pattern transform that has a non-zero pivot.
 *
 * @param {Object} transform - The extended transform definition.
 * @param {number} [transform.centerX=0]
 * @param {number} [transform.centerY=0]
 * @param {number} [transform.scale=1]
 * @param {number} [transform.angle=0] - In degrees
 * @param {number} [transform.pivotX=0]
 * @param {number} [transform.pivotY=0]
 * @returns {Object} The canonical transform object with pivotX = 0, pivotY = 0.
 */
export function getCanonicalPatternTransform(transform) {
    if (!transform) {
        return {
            centerX: 0,
            centerY: 0,
            scale: 1,
            angle: 0,
            pivotX: 0,
            pivotY: 0
        };
    }

    const cx = transform.centerX ?? 0;
    const cy = transform.centerY ?? 0;
    const scale = transform.scale ?? 1;
    const angle = transform.angle ?? 0;
    const ox = transform.pivotX ?? 0;
    const oy = transform.pivotY ?? 0;

    const a = angle * TORADIANS;
    const ca = cos(a);
    const sa = sin(a);

    // C_canon = C_ext - S * R(theta) * O
    // R(theta) * O = (ox * ca - oy * sa, ox * sa + oy * ca)
    const canonCx = cx - scale * (ox * ca - oy * sa);
    const canonCy = cy - scale * (ox * sa + oy * ca);

    return {
        centerX: canonCx,
        centerY: canonCy,
        scale: scale,
        angle: angle,
        pivotX: 0,
        pivotY: 0
    };
}

/**
 * Recalculates the pattern center (centerX, centerY) when the pattern pivot
 * changes, to preserve the visual position of the pattern.
 *
 * @param {Object} transform - The transform definition.
 * @param {number} transform.centerX
 * @param {number} transform.centerY
 * @param {number} transform.scale
 * @param {number} transform.angle - In degrees
 * @param {number} transform.pivotX
 * @param {number} transform.pivotY
 * @param {number} transform.oldPivotX
 * @param {number} transform.oldPivotY
 */
export function upgradePatternPivot(transform) {
    if (!transform) return;

    let oldCenter = [transform.centerX, transform.centerY];
    let cDelta  = [transform.pivotX - transform.oldPivotX, transform.pivotY - transform.oldPivotY];
    let cScale = cPolar(transform.scale, TORADIANS*transform.angle);
    let newCenter = cAdd(cMul(cScale, cDelta), oldCenter);

    transform.centerX = newCenter[0];
    transform.centerY = newCenter[1];
    transform.oldPivotX = transform.pivotX;
    transform.oldPivotY = transform.pivotY;
}
