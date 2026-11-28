import {
    SPLANE_PLANE,
    SPLANE_SPHERE,
    iPoint,
    iDistanceU4,
    getMatrixMobius,
    cAbs,
    ITransform,
    canonicalChart,
    mobiusApply,
    mobiusInverse,
    mobiusDerivative,
    rotationAbout,
    geodesicDistance,
    density,
    domainAbsolute,
    domainBox,
    sidePermutations,
    invertPerm,
    wordToPerm,
} from './modules.js';
const SPLANE_IDENTITY = 0;

//
//  PlacementTrajectory — continuous geometric transitions between discrete
//  color placements (permIndex = p1 -> p2) for a symmetry group G and subgroup
//  coset permutations.
//
//  Supports:
//    - Domain geometry & bounds (for Solution 1 SPlane sweeps across D_0)
//    - Candidate target search: nearby group elements h in G whose color
//      permutation maps p1 -> p2 (ranked by geodesic distance in Euclidean,
//      hyperbolic, or spherical geometry)
//    - Continuous geodesic & rotation-arc pose interpolation along A -> h(A),
//      keeping intrinsic metric size constant (no chirality flip for reflections)
//

const EPS = 1.e-7;

/** Normalize angle into (-PI, PI]. */
function wrapAngle(a) {
    let x = a % (2 * Math.PI);
    if (x > Math.PI) x -= 2 * Math.PI;
    if (x <= -Math.PI) x += 2 * Math.PI;
    return x;
}

/** Curvature k in {-1, 0, +1} for a GeometryMotions geometry object. */
function geomCurvature(geom) {
    if (!geom) return 0;
    if (geom.kind === 'hyperbolic' || geom.kind === 'halfplane') return -1;
    if (geom.kind === 'spherical') return 1;
    return 0;
}

/**
 * Determine the GeometryMotions geometry ({kind: 'euclidean'|'hyperbolic'|'spherical', ...})
 * of a SymmHub Group from its fundamental domain sides.
 */
export function getGroupGeometry(group) {
    const fd = group && typeof group.getFundDomain === 'function' ? group.getFundDomain() : [];
    const abs = domainAbsolute(fd);
    if (abs.kind === 'euclidean' || abs.kind === 'hyperbolic' || abs.kind === 'spherical') {
        return abs;
    }
    return { kind: 'euclidean', residual: 0 };
}

/**
 * Compute bounding box, geometric incenter, and circumradius of the group's
 * fundamental domain D_0. Useful both for picking a clean starting point A in D_0
 * (Solution 2) and for normalizing SPlane sweeps across D_0 (Solution 1).
 */
export function getDomainBounds(group) {
    const fd = group && typeof group.getFundDomain === 'function' ? group.getFundDomain() : [];
    const walls = group && typeof group.getFundDomainWalls === 'function' ? group.getFundDomainWalls() : undefined;
    const sides = (fd || []).filter(sp => sp && (sp.type === SPLANE_PLANE || sp.type === SPLANE_SPHERE));
    const box = domainBox(fd, { walls }) || [-0.5, -0.5, 0.5, 0.5];
    const [x0, y0, x1, y1] = box;
    const cx = 0.5 * (x0 + x1);
    const cy = 0.5 * (y0 + y1);
    const dx = Math.max(1e-4, x1 - x0);
    const dy = Math.max(1e-4, y1 - y0);

    // Find interior point with maximum inward clearance from all domain sides (approximate incenter)
    let bestP = [cx, cy];
    let bestMargin = -Infinity;
    const N = 24;
    for (let iy = 1; iy < N; iy++) {
        const y = y0 + (dy * iy) / N;
        for (let ix = 1; ix < N; ix++) {
            const x = x0 + (dx * ix) / N;
            const ip = iPoint([x, y, 0, 0]);
            let maxD = -Infinity;
            for (let s = 0; s < sides.length; s++) {
                const d = iDistanceU4(sides[s], ip);
                if (d > maxD) maxD = d;
            }
            const margin = -maxD; // positive strictly inside D_0
            if (margin > bestMargin) {
                bestMargin = margin;
                bestP = [x, y];
            }
        }
    }

    // Fine local refinement around bestP
    const stepX = dx / N;
    const stepY = dy / N;
    for (let iy = -4; iy <= 4; iy++) {
        const y = bestP[1] + (stepY * iy) / 4;
        for (let ix = -4; ix <= 4; ix++) {
            const x = bestP[0] + (stepX * ix) / 4;
            const ip = iPoint([x, y, 0, 0]);
            let maxD = -Infinity;
            for (let s = 0; s < sides.length; s++) {
                const d = iDistanceU4(sides[s], ip);
                if (d > maxD) maxD = d;
            }
            const margin = -maxD;
            if (margin > bestMargin) {
                bestMargin = margin;
                bestP = [x, y];
            }
        }
    }

    const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    let radius = 0;
    for (const [px, py] of corners) {
        radius = Math.max(radius, Math.hypot(px - bestP[0], py - bestP[1]));
    }

    return {
        box,
        center: [cx, cy],
        incenter: bestP,
        inradius: Math.max(0, bestMargin),
        radius: Math.max(radius, 0.1),
    };
}

/** Extract direct + inverse generator ITransforms from a Group (as CrownCalculator does). */
function getGeneratorTransforms(group) {
    const genMap = group.genMap;
    const names = group.genNames;
    if (!genMap || !names) return [];
    const gens = [];
    for (const name of names) {
        for (const letter of [name, name.toUpperCase()]) {
            if (genMap[letter] && !gens.some(g => g.word === letter)) {
                gens.push(new ITransform(genMap[letter], letter));
            }
        }
    }
    return gens;
}

/** Deduplication key for a group element via a general-position test point. */
function transformKey(transform) {
    const p = transform.transform(iPoint([0.1371, 0.2193, 0.3117, 0.1]));
    if (!Array.isArray(p.v)) return `inf_${p.type}`;
    return p.v.map(v => Math.round(v * 1e5)).join(',');
}

/** Apply an ITransform to a 2D point [x, y] -> [x', y']. */
export function applyTransform2D(transform, pt) {
    const out = transform.transform(iPoint([pt[0], pt[1], 0, 0]));
    if (!out || !Array.isArray(out.v)) return [NaN, NaN];
    return [out.v[0], out.v[1]];
}

/**
 * Estimate local 1-jet (target point, scale, rotation angle, chirality) of an
 * ITransform at a point A.
 */
function analyzeLocalJet(transform, A) {
    const B = applyTransform2D(transform, A);
    const eps = 1e-5;
    const Bx = applyTransform2D(transform, [A[0] + eps, A[1]]);
    const By = applyTransform2D(transform, [A[0], A[1] + eps]);
    const ux = (Bx[0] - B[0]) / eps;
    const uy = (Bx[1] - B[1]) / eps;
    const vx = (By[0] - B[0]) / eps;
    const vy = (By[1] - B[1]) / eps;
    const det = ux * vy - uy * vx;
    const scale = Math.hypot(ux, uy);
    const angle = wrapAngle(Math.atan2(uy, ux));
    const orientationPreserving = det >= 0;
    return { targetPoint: B, endScale: scale, endAngle: angle, orientationPreserving };
}

/**
 * For an orientation-preserving transform h, check if h is an elliptic rotation
 * about an interior fixed point O inside the model (useful for circular/geodesic
 * orbital arc trajectories around cone points).
 */
function detectRotationCenter(geom, transform, A, B, endAngle) {
    if (!Number.isFinite(endAngle) || Math.abs(endAngle) < 1e-3) return null;

    // Euclidean exact circumcenter for pure rotation by endAngle from A to B
    if (geom.kind === 'euclidean') {
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const chord = Math.hypot(dx, dy);
        if (chord < 1e-6) return { center: A.slice(), angle: endAngle };
        const halfTan = Math.tan(0.5 * endAngle);
        if (Math.abs(halfTan) < 1e-5) return null;
        const k = 0.5 / halfTan;
        const cx = 0.5 * (A[0] + B[0]) - k * dy;
        const cy = 0.5 * (A[1] + B[1]) + k * dx;
        // Verify O is actually fixed by transform (distinguishes pure rotation from glide/wrong branch)
        const O = [cx, cy];
        const hO = applyTransform2D(transform, O);
        if (Math.hypot(hO[0] - O[0], hO[1] - O[1]) < 1e-4 * (1 + chord)) {
            return { center: O, angle: endAngle };
        }
        return null;
    }

    // Conformal (hyperbolic / spherical): solve fixed points of Möbius matrix M: c z^2 + (d - a) z - b = 0
    try {
        const res = getMatrixMobius(transform.ref);
        if (!res || res.reversing || !res.m) return null;
        // res.m is [[a, b], [c, d]] with complex pairs [re, im]
        const [[a, b], [c, d]] = res.m;
        const cAbsVal = cAbs(c);
        const candidates = [];
        if (cAbsVal < 1e-10) {
            // Linear map (a z + b) / d = z -> (a - d) z = -b
            const den = [a[0] - d[0], a[1] - d[1]];
            const den2 = den[0] * den[0] + den[1] * den[1];
            if (den2 > 1e-12) {
                candidates.push([
                    (-b[0] * den[0] - b[1] * den[1]) / den2,
                    (-b[1] * den[0] + b[0] * den[1]) / den2,
                ]);
            }
        } else {
            // Quadratic: c z^2 + (d - a) z - b = 0
            const q = [d[0] - a[0], d[1] - a[1]];
            // disc = q^2 + 4 c b
            const q2 = [q[0] * q[0] - q[1] * q[1], 2 * q[0] * q[1]];
            const cb = [c[0] * b[0] - c[1] * b[1], c[0] * b[1] + c[1] * b[0]];
            const disc = [q2[0] + 4 * cb[0], q2[1] + 4 * cb[1]];
            const r = Math.hypot(disc[0], disc[1]);
            const ang = Math.atan2(disc[1], disc[0]) * 0.5;
            const sq = [Math.sqrt(r) * Math.cos(ang), Math.sqrt(r) * Math.sin(ang)];
            const den = [2 * c[0], 2 * c[1]];
            const den2 = den[0] * den[0] + den[1] * den[1];
            for (const sgn of [1, -1]) {
                const num = [-q[0] + sgn * sq[0], -q[1] + sgn * sq[1]];
                candidates.push([
                    (num[0] * den[0] + num[1] * den[1]) / den2,
                    (num[1] * den[0] - num[0] * den[1]) / den2,
                ]);
            }
        }

        // Pick the fixed point inside the model (and nearest A on sphere)
        let bestO = null;
        let bestDist = Infinity;
        for (const O of candidates) {
            if (!Number.isFinite(O[0]) || !Number.isFinite(O[1])) continue;
            if (geom.kind === 'hyperbolic') {
                const rO = Math.hypot(O[0] - geom.c[0], O[1] - geom.c[1]);
                if (rO >= geom.r * 0.98) continue;
            }
            const hO = applyTransform2D(transform, O);
            if (Math.hypot(hO[0] - O[0], hO[1] - O[1]) > 1e-3) continue;
            const dist = geodesicDistance(geom, A, O);
            if (Number.isFinite(dist) && dist < bestDist) {
                bestDist = dist;
                bestO = O;
            }
        }
        if (!bestO) return null;

        // Compute exact rotation angle about bestO in canonical chart of bestO
        const chartO = canonicalChart(geom, bestO);
        const uA = mobiusApply(chartO, A);
        const uB = mobiusApply(chartO, B);
        const rotAngle = wrapAngle(Math.atan2(uB[1], uB[0]) - Math.atan2(uA[1], uA[0]));
        if (Math.abs(rotAngle) < 1e-3) return null;

        // Verify rotationAbout(geom, bestO, rotAngle) lands at B
        const checkM = rotationAbout(geom, bestO, rotAngle);
        const checkB = mobiusApply(checkM, A);
        if (Math.hypot(checkB[0] - B[0], checkB[1] - B[1]) < 1e-3) {
            return { center: bestO, angle: rotAngle };
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * Find nearby group elements h in G whose color action carries placement `fromPlacement`
 * to `toPlacement` (for cosets: gperm[p1] === p2; for orbits: gperm[p1] === p2 shifts
 * color labels identically).
 *
 * Returns an array of candidate targets sorted by geodesic distance:
 *   {
 *     transform,              // ITransform mapping D_0 -> h(D_0)
 *     word,                   // generator word of h
 *     perm,                   // permutation array of h as used by crown/sprite shaders
 *     startPoint,             // [x, y] = A
 *     targetPoint,            // [x, y] = h(A)
 *     distance,               // geodesic distance d_geom(A, h(A))
 *     wordLength,             // number of generator steps
 *     orientationPreserving,  // true iff even reflection count (direct isometry)
 *     endAngle,               // local derivative angle arg(h'(A)) in radians
 *     endScale,               // local metric scale |h'(A)|
 *     rotationCenter,         // [ox, oy] if pure rotation about an interior cone point, else null
 *     rotationAngle,          // angle about rotationCenter (radians), or 0
 *   }
 */
export function findPlacementTargets({
    group,
    generatorPerms,
    useOrbit = false,
    fromPlacement = 0,
    toPlacement = 0,
    startPoint = null,
    geometry = null,
    maxTiles = 400,
    maxCandidates = 14,
}) {
    if (!group || !generatorPerms || generatorPerms.length === 0) return [];
    const permSize = generatorPerms[0].length;
    if (permSize === 0) return [];

    const p1 = ((fromPlacement % permSize) + permSize) % permSize;
    const p2 = ((toPlacement % permSize) + permSize) % permSize;
    const geom = geometry || getGroupGeometry(group);
    const A = startPoint ? [startPoint[0], startPoint[1]] : getDomainBounds(group).incenter;

    const sidePerms = sidePermutations(group, generatorPerms, useOrbit);
    const invSidePerms = sidePerms.map(invertPerm);
    const sideNames = group.getGenNames ? group.getGenNames() : group.genNames;
    const gens = getGeneratorTransforms(group);

    if (p1 === p2) {
        const idPerm = Array.from({ length: permSize }, (_, i) => i);
        return [{
            transform: new ITransform([], ''),
            word: '',
            perm: idPerm,
            startPoint: A,
            targetPoint: A.slice(),
            distance: 0,
            wordLength: 0,
            orientationPreserving: true,
            endAngle: 0,
            endScale: 1,
            rotationCenter: null,
            rotationAngle: 0,
        }];
    }

    // Best-first search ordered by geodesic distance d(A, fromFD(A))
    const id = new ITransform([], '');
    const seen = new Set([transformKey(id)]);
    const queue = [{ fromFD: id, depth: 0, dist: 0 }];
    const candidates = [];
    let visited = 0;

    while (queue.length > 0 && visited < maxTiles) {
        // Pop tile closest to A
        let bestIdx = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].dist < queue[bestIdx].dist) bestIdx = i;
        }
        const cur = queue.splice(bestIdx, 1)[0];
        visited++;

        if (cur.depth > 0) {
            const word = cur.fromFD.getWord();
            const gperm = wordToPerm(word, sidePerms, invSidePerms, useOrbit, sideNames);
            if (gperm[p1] === p2) {
                const jet = analyzeLocalJet(cur.fromFD, A);
                if (Number.isFinite(jet.targetPoint[0]) && Number.isFinite(jet.targetPoint[1])) {
                    const rot = jet.orientationPreserving
                        ? detectRotationCenter(geom, cur.fromFD, A, jet.targetPoint, jet.endAngle)
                        : null;
                    candidates.push({
                        transform: cur.fromFD,
                        word,
                        perm: gperm,
                        startPoint: A,
                        targetPoint: jet.targetPoint,
                        distance: cur.dist,
                        wordLength: cur.depth,
                        orientationPreserving: jet.orientationPreserving,
                        endAngle: jet.endAngle,
                        endScale: jet.endScale,
                        rotationCenter: rot ? rot.center : null,
                        rotationAngle: rot ? rot.angle : 0,
                    });
                    // Stop early once we have plenty of both direct and reflection candidates
                    const directCount = candidates.filter(c => c.orientationPreserving).length;
                    if (candidates.length >= maxCandidates && directCount >= Math.min(4, maxCandidates)) {
                        break;
                    }
                }
            }
        }

        // Expand across every generator side (matches CrownCalculator walk)
        for (let g = 0; g < gens.length; g++) {
            const gen = gens[g];
            const nextFromFD = new ITransform(gen.ref.slice(), gen.word);
            nextFromFD.concat(cur.fromFD);
            const key = transformKey(nextFromFD);
            if (seen.has(key)) continue;

            const pt = applyTransform2D(nextFromFD, A);
            if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
            if (geom.kind === 'hyperbolic') {
                const rPt = Math.hypot(pt[0] - geom.c[0], pt[1] - geom.c[1]);
                if (rPt >= geom.r * 0.995) continue;
            }
            const dist = geodesicDistance(geom, A, pt);
            if (!Number.isFinite(dist)) continue;

            seen.add(key);
            queue.push({ fromFD: nextFromFD, depth: cur.depth + 1, dist });
        }
    }

    candidates.sort((a, b) => a.distance - b.distance || a.wordLength - b.wordLength);
    return candidates.slice(0, maxCandidates);
}

/**
 * Pick the recommended default target from `findPlacementTargets` output:
 * prefers shortest orientation-preserving target when `preferDirect` is true
 * (and one exists), otherwise shortest overall.
 */
export function pickDefaultTarget(candidates, preferDirect = true) {
    if (!candidates || candidates.length === 0) return null;
    if (preferDirect) {
        const direct = candidates.find(c => c.orientationPreserving);
        if (direct) return direct;
    }
    return candidates[0];
}

/**
 * Evaluate the continuous pose { point: [x, y], scale, angle } along the trajectory
 * from target.startPoint (t = 0) to target.targetPoint (t = 1) in `geom`.
 *
 * Options:
 *   pathType: 'geodesic' | 'arc'   ('arc' orbits around target.rotationCenter when available)
 *   matchRotation: boolean         (smoothly rotate orientation-preserving moves to endAngle)
 *
 * Never flips chirality on orientation-reversing moves: simply moves the shape smoothly
 * along the geodesic (keeping its intrinsic metric scale).
 */
export function evaluateTrajectory(geom, target, t, options = {}) {
    const tc = Math.max(0, Math.min(1, t));
    const A = target.startPoint;
    const B = target.targetPoint;
    const pathType = options.pathType || 'geodesic';
    const matchRotation = options.matchRotation !== false;

    if (tc <= 0) {
        return { point: [A[0], A[1]], scale: 1, angle: 0 };
    }

    // Optional circular/geodesic orbital arc around a cone point
    if (pathType === 'arc' && target.rotationCenter && Math.abs(target.rotationAngle) > 1e-4) {
        const M = rotationAbout(geom, target.rotationCenter, tc * target.rotationAngle);
        const point = mobiusApply(M, A);
        const dA = density(geom, A);
        const dP = density(geom, point);
        const scale = (dP > 1e-12) ? (dA / dP) : 1;
        const deriv = mobiusDerivative(M, A);
        const angle = matchRotation ? Math.atan2(deriv[1], deriv[0]) : 0;
        return { point, scale, angle };
    }

    // Exact geodesic from A to B in canonical chart of A
    const k = geomCurvature(geom);
    let point;
    if (k === 0) {
        point = [A[0] + tc * (B[0] - A[0]), A[1] + tc * (B[1] - A[1])];
    } else {
        const s = canonicalChart(geom, A);
        const si = mobiusInverse(s);
        const u = mobiusApply(s, B);
        const r = Math.hypot(u[0], u[1]);
        if (r < 1e-12) {
            point = [A[0], A[1]];
        } else {
            const rt = k < 0
                ? Math.tanh(tc * Math.atanh(Math.min(r, 1 - 1e-14)))
                : Math.tan(tc * Math.atan(r));
            const ut = [(u[0] / r) * rt, (u[1] / r) * rt];
            point = mobiusApply(si, ut);
        }
    }

    const dA = density(geom, A);
    const dP = density(geom, point);
    const scale = (dP > 1e-12) ? (dA / dP) : 1;

    // For orientation-preserving targets, smoothly interpolate local frame rotation
    // to match h'(A) at t = 1. For orientation-reversing targets, keep angle = 0 (no flip).
    const angle = (target.orientationPreserving && matchRotation)
        ? tc * target.endAngle
        : 0;

    return { point, scale, angle };
}

/**
 * Sample N+1 polyline points along a trajectory for overlay path visualization.
 */
export function sampleTrajectoryPoints(geom, target, steps = 40, options = {}) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        pts.push(evaluateTrajectory(geom, target, i / steps, options).point);
    }
    return pts;
}

/**
 * Compute an animated iSPlane ({ type, data: [a,b,c,d] }) that cleanly sweeps
 * across a bounding region (either fundamental domain bounds or normalized shape box
 * or world viewport) as t goes from 0 to 1.
 *
 *   splaneKind: 'line' | 'circle'
 *   angleRad:   sweep normal angle for 'line'
 *   bounds:     { box: [x0,y0,x1,y1], incenter: [ix,iy], radius }
 *   margin:     extra padding beyond bounds so t=0 is 100% outside and t=1 is 100% inside
 */
export function evaluateSweepSplane(t, {
    splaneKind = 'line',
    angleRad = 0,
    bounds = { box: [-1, -1, 1, 1], incenter: [0, 0], radius: 1.5 },
    centerOverride = null,
    margin = 0.04,
} = {}) {
    const tc = Math.max(0, Math.min(1, t));
    const [x0, y0, x1, y1] = bounds.box;
    const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];

    if (splaneKind === 'circle') {
        const c = centerOverride || bounds.incenter || [0.5 * (x0 + x1), 0.5 * (y0 + y1)];
        let maxR = 0;
        for (const [px, py] of corners) {
            maxR = Math.max(maxR, Math.hypot(px - c[0], py - c[1]));
        }
        const pad = Math.max(margin, maxR * 0.05);
        // At t=0: radius = 0 -> SPLANE_IDENTITY (iDistance = +1 everywhere = 100% outside)
        // Note: in isplane.glsl.mjs, radius <= 0 inverts a sphere instead of emptying it!
        const r = tc * (maxR + pad);
        if (r <= 1e-5) {
            return {
                type: SPLANE_IDENTITY,
                data: [c[0], c[1], 0, 0],
                center: c,
                radius: 0,
            };
        }
        return {
            type: SPLANE_SPHERE,
            data: [c[0], c[1], 0, r],
            center: c,
            radius: r,
        };
    }

    // Straight line SPLANE_PLANE: normal = (cos a, sin a, 0), signed dist d = dot(n, p) - offset
    // Inside = dot(n, p) < offset. Sweeps offset from minProj - pad to maxProj + pad.
    const nx = Math.cos(angleRad);
    const ny = Math.sin(angleRad);
    let minP = Infinity;
    let maxP = -Infinity;
    for (const [px, py] of corners) {
        const proj = nx * px + ny * py;
        if (proj < minP) minP = proj;
        if (proj > maxP) maxP = proj;
    }
    const span = Math.max(1e-4, maxP - minP);
    const pad = Math.max(margin, span * 0.05);
    const offset = (minP - pad) + tc * (span + 2 * pad);
    return {
        type: SPLANE_PLANE,
        data: [nx, ny, 0, offset],
        normal: [nx, ny],
        offset,
    };
}
