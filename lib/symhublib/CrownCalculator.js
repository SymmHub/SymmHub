import { iPoint, ITransform, TORADIANS } from './modules.js';

// the tiles of the box are found two ways: the big ones by folding a grid of
// box points, the rest by walking from the found tiles across their sides
const DEFAULT_GRID_RADIUS = 15;
const DEFAULT_MAX_ITERATIONS = 20;
// at most this many tiles are added by the walk (the grid's are always kept)
const DEFAULT_MAX_COUNT = 1000;
// a tile whose image of the domain is smaller than this (pattern units, the
// box is [-1, 1]^2) is left out, with everything beyond it
const DEFAULT_MIN_SIZE = 1e-3;
// the walk tests whether a tile meets the box with this many domain points
const CLOUD_SIZE = 32;

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

/**
 * the maps between the pattern box [-1, 1]^2 and the group's coordinates for
 * a pattern transform (a config object or a TransformMotion2D instance)
 */
function boxMaps(patternTransform) {
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
    return {
        toWorld: (px, py) => [scale * (ca * px - sa * py) + cx, scale * (sa * px + ca * py) + cy],
        toPattern: (wx, wy) => {
            const dx = wx - cx, dy = wy - cy;
            return [(ca * dx + sa * dy) / scale, (-sa * dx + ca * dy) / scale];
        },
    };
}

/** the generators of the group as ITransforms, with their inverses */
function generatorTransforms(group) {
    const genMap = group.genMap;
    const names = group.genNames;
    if (!genMap || !names) return [];
    const gens = [];
    for (const name of names) {
        for (const letter of [name, name.toUpperCase()]) {
            if (genMap[letter] && !gens.some(g => g.word === letter)) gens.push(new ITransform(genMap[letter], letter));
        }
    }
    return gens;
}

export const CrownCalculator = {
    /**
     * Calculates the transforms (crown) which map the tiles meeting the pattern box
     * into the fundamental domain, nearest to the box centre first.
     *
     * The tiles are found two ways. Grid points of the box are folded into the
     * domain, which finds every tile larger than the grid step. Then, from the
     * domain and the tiles found, the walk across the sides (the group's
     * generators) adds the tiles that meet the box and were missed by the grid:
     * with a box much larger than the domain the grid steps over the tiles
     * next to the domain, and Color Images, which draws the first
     * MAX_CROWN_COUNT tiles, needs those. The walk stops at options.maxCount
     * tiles and at tiles smaller than options.minSize.
     *
     * @param {Group} group - Current symmetry group in world coordinates
     * @param {Object|TransformMotion2D} patternTransform - Pattern transform (config object or TransformMotion2D instance)
     * @param {Object} [options] - Options for the calculation
     * @param {number} [options.gridRadius=15] - Grid radius for scanning
     * @param {number} [options.maxIterations=20] - Max iterations to map point to FD
     * @param {number} [options.maxCount=1000] - Most tiles the walk adds to the grid's
     * @param {number} [options.minSize=1e-3] - Smallest tile the walk keeps (pattern units)
     * @param {iSplane} [options.basePoint] - Base point to check transform equality
     * @param {number} [options.epsilon=1e-7] - Threshold to consider two transformed points equal
     * @returns {Array<ITransform>} Array of direct ITransforms
     */
    calculate(group, patternTransform, options = {}) {
        const radius = options.gridRadius !== undefined ? options.gridRadius : DEFAULT_GRID_RADIUS;
        const maxIterations = options.maxIterations !== undefined ? options.maxIterations : DEFAULT_MAX_ITERATIONS;
        const maxCount = options.maxCount !== undefined ? options.maxCount : DEFAULT_MAX_COUNT;
        const minSize = options.minSize !== undefined ? options.minSize : DEFAULT_MIN_SIZE;
        const basePoint = options.basePoint || iPoint([0.1, 0.2, 0.3, 0.1]);
        const eps = options.epsilon !== undefined ? options.epsilon : 1e-7;

        const box = boxMaps(patternTransform);
        const gridPoints = generateSpiralPoints(radius);

        // the tiles: {toFD, fromFD} with the image of the base point under
        // toFD, which tells equal group elements apart
        const tiles = [];
        const seen = [];
        function known(tp) {
            for (let j = 0; j < seen.length; j++) {
                if (isEpsilonEqualU4(tp, seen[j], eps)) return true;
            }
            return false;
        }
        function add(toFD, fromFD, tp) {
            tiles.push({ toFD, fromFD });
            seen.push(tp);
        }

        // 1. the tiles the grid points of the box fold from; the folded points
        //    are a cloud of domain points for the tests of the walk
        const cloud = [];
        for (let i = 0; i < gridPoints.length; i++) {
            const [gx, gy] = gridPoints[i];
            const wp = box.toWorld(gx / radius, gy / radius);
            const res = group.toFundDomain({ pnt: iPoint(wp), maxIterations: maxIterations });
            const trans = res.transform;
            if (!trans) continue;
            if (res.inDomain && cloud.length < gridPoints.length) cloud.push(res.pnt);
            const tp = trans.transform(basePoint);
            if (!known(tp)) add(trans, null, tp);
        }
        const step = Math.max(1, Math.floor(cloud.length / CLOUD_SIZE));
        const sample = cloud.filter((p, i) => i % step === 0).slice(0, CLOUD_SIZE);
        const centre = iPoint([0, 0]);
        if (sample.length) {
            const c = [0, 0];
            sample.forEach(p => { c[0] += p.v[0]; c[1] += p.v[1]; });
            centre.v[0] = c[0] / sample.length;
            centre.v[1] = c[1] / sample.length;
        }

        // the tile fromFD(domain): does it meet the box, how large is it and
        // how far its centre is from the box centre (pattern units)
        function measure(fromFD) {
            let meets = false;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const s of sample) {
                const q = fromFD.transform(s);
                const p = box.toPattern(q.v[0], q.v[1]);
                if (Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1) meets = true;
                x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
                y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
            }
            const q = fromFD.transform(centre);
            const p = box.toPattern(q.v[0], q.v[1]);
            return { meets, size: Math.hypot(x1 - x0, y1 - y0), d: Math.hypot(p[0], p[1]) };
        }
        for (const t of tiles) {
            t.fromFD = t.toFD.getInverse();
            t.d = measure(t.fromFD).d;
        }

        // 2. the walk: from the domain and the grid's tiles, nearest first,
        //    across their sides
        const gens = generatorTransforms(group);
        if (gens.length && sample.length) {
            const identity = new ITransform([], '');
            const tpId = identity.transform(basePoint);
            if (!known(tpId)) {
                add(identity, identity, tpId);
                tiles[tiles.length - 1].d = measure(identity).d;
            }
            const queue = tiles.slice();
            let added = 0;
            while (queue.length && added < maxCount) {
                let at = 0;
                for (let i = 1; i < queue.length; i++) if (queue[i].d < queue[at].d) at = i;
                const tile = queue.splice(at, 1)[0];
                for (const gen of gens) {
                    // the tile across side gen: apply gen, then the tile's map
                    const fromFD = new ITransform(gen.ref.slice(), gen.word);
                    fromFD.concat(tile.fromFD);
                    const toFD = fromFD.getInverse();
                    const tp = toFD.transform(basePoint);
                    if (known(tp)) continue;
                    seen.push(tp);
                    const m = measure(fromFD);
                    if (!m.meets || m.size < minSize) continue;
                    const t = { toFD, fromFD, d: m.d };
                    tiles.push(t);
                    queue.push(t);
                    if (++added >= maxCount) break;
                }
            }
        }

        // 3. nearest to the box centre first
        tiles.sort((a, b) => a.d - b.d);
        return tiles.map(t => t.toFD);
    }
};
