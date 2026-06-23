import { iPoint, ITransform, TORADIANS } from './modules.js';

/**
 * Checks if two points in U4 are epsilon-equal.
 * 
 * @param {iSplane} pnt1 - First point
 * @param {iSplane} pnt2 - Second point
 * @param {number} eps - Epsilon threshold
 * @returns {boolean} True if points are close enough
 */
function isEpsilonEqualU4(pnt1, pnt2, eps) {
    if (pnt1.type !== pnt2.type) return false;
    for (let i = 0; i < pnt1.v.length; i++) {
        if (Math.abs(pnt1.v[i] - pnt2.v[i]) > eps) return false;
    }
    return true;
}

/**
 * Generates grid points in a (2*radius + 1)x(2*radius + 1) square region,
 * starting from the center (0, 0) and spiraling outwards.
 * 
 * @param {number} radius - Grid radius (number of rings around center)
 * @returns {Array<Array<number>>} Array of [gridX, gridY] coordinate pairs
 */
function generateSpiralPoints(radius) {
    const points = [];
    points.push([0, 0]);
    for (let r = 1; r <= radius; r++) {
        // Left side: x = -r, y from -r to r
        for (let y = -r; y <= r; y++) {
            points.push([-r, y]);
        }
        // Top side: y = r, x from -r + 1 to r
        for (let x = -r + 1; x <= r; x++) {
            points.push([x, r]);
        }
        // Right side: x = r, y from r - 1 down to -r
        for (let y = r - 1; y >= -r; y--) {
            points.push([r, y]);
        }
        // Bottom side: y = -r, x from r - 1 down to -r + 1
        for (let x = r - 1; x >= -r + 1; x--) {
            points.push([x, -r]);
        }
    }
    return points;
}

export const CrownCalculator = {
    /**
     * Calculates the direct transforms (crown) needed to map the pattern box into the fundamental domain.
     * 
     * @param {Group} group - Current symmetry group in world coordinates
     * @param {Object|TransformMotion2D} patternTransform - Pattern transform (config object or TransformMotion2D instance)
     * @param {Object} [options] - Options for the calculation
     * @param {number} [options.gridRadius=15] - Grid radius for scanning
     * @param {number} [options.maxIterations=20] - Max iterations to map point to FD
     * @param {iSplane} [options.basePoint] - Base point to check transform equality
     * @param {number} [options.epsilon=1e-7] - Threshold to consider two transformed points equal
     * @returns {Array<ITransform>} Array of direct ITransforms
     */
    calculate(group, patternTransform, options = {}) {
        const radius = options.gridRadius !== undefined ? options.gridRadius : 15;
        const maxIterations = options.maxIterations !== undefined ? options.maxIterations : 20;
        const basePoint = options.basePoint || iPoint([0.1, 0.2, 0.3, 0.1]);
        const eps = options.epsilon !== undefined ? options.epsilon : 1e-7;

        const gridPoints = generateSpiralPoints(radius);
        const directTransforms = [];
        const transformedBasePoints = [];

        // Extract center, scale, and angle (in radians) from patternTransform
        let cx = 0;
        let cy = 0;
        let scale = 1;
        let angleRad = 0;

        if (patternTransform) {
            if (patternTransform.tranParams) {
                // TransformMotion2D instance
                const tp = patternTransform.tranParams;
                cx = tp.center ? tp.center[0] : 0;
                cy = tp.center ? tp.center[1] : 0;
                scale = tp.scale !== undefined ? tp.scale : 1;
                angleRad = tp.angle !== undefined ? tp.angle : 0;
            } else {
                // Plain config object
                cx = patternTransform.centerX || 0;
                cy = patternTransform.centerY || 0;
                scale = patternTransform.scale !== undefined ? patternTransform.scale : 1;
                angleRad = (patternTransform.angle || 0) * TORADIANS;
            }
        }

        const sa = Math.sin(angleRad);
        const ca = Math.cos(angleRad);

        for (let i = 0; i < gridPoints.length; i++) {
            const [gx, gy] = gridPoints[i];
            // Normalize pattern coordinates to [-1, 1] range
            const px = gx / radius;
            const py = gy / radius;

            // Map pattern point to world coordinates [wx, wy]
            const wx = scale * (ca * px - sa * py) + cx;
            const wy = scale * (sa * px + ca * py) + cy;
            const wp = [wx, wy];

            // Map world point to the fundamental domain of the group
            const ipnt = iPoint(wp);
            const res = group.toFundDomain({ pnt: ipnt, maxIterations: maxIterations });
            const trans = res.transform;

            if (trans) {
                const tp = trans.transform(basePoint);
                let isDuplicate = false;
                for (let j = 0; j < transformedBasePoints.length; j++) {
                    if (isEpsilonEqualU4(tp, transformedBasePoints[j], eps)) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    trans.patternPoint = [px, py];
                    trans.worldPoint = wp;
                    trans.fundDomainPoint = [res.pnt.v[0], res.pnt.v[1]];
                    directTransforms.push(trans);
                    transformedBasePoints.push(tp);
                }
            }
        }

        return directTransforms;
    }
};
