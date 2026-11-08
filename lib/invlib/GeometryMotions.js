import {
    cMul,
    cDiv,
    cAdd,
    cSub,
    cAbs,
    cAbs2,
    conj,
    cPolar,
} from './modules.js';

//
//  GeometryMotions - the motions of the Euclidean plane, the hyperbolic plane and the
//  sphere as Möbius maps of the plane, for moving shapes in the geometry of a group
//  (docs/shape_motions_plan.md, outside the repository)
//
//  A geometry is the absolute of a model in the plane:
//
//    { kind: 'euclidean' }                         the plane itself
//    { kind: 'hyperbolic', c: [x, y], r }           the circle |z - c| = r: the model is the
//                                                   disk inside or outside it, on the side of
//                                                   the point moved
//    { kind: 'halfplane', p: [x, y], e: [ex, ey] }  the line through p with the unit direction
//                                                   e: the model is the half plane on the side
//                                                   of the point moved
//    { kind: 'spherical', c: [x, y], R }            the sphere whose stereographic equator is
//                                                   the circle |z - c| = R (the absolute is the
//                                                   imaginary circle of radius iR about c)
//
//  A Möbius map z -> (az + b)/(cz + d) is the matrix [[a, b], [c, d]] of complex numbers
//  [re, im]; points are [x, y].
//
//  The chart of a point A (chartTo) maps the model onto the standard one - the unit disk,
//  the plane, the unit sphere (the stereographic plane with the unit circle as equator) -
//  with A at the origin; the canonical chart (canonicalChart) is the one whose derivative
//  at A is a positive real. A shape's pose is its picture in the canonical chart of its
//  anchor, and moving it from A to B is moveTo(A, B) = sigma_B^-1 sigma_A: in the disk and
//  on the sphere the translation from A to the centre of the model followed by the one from
//  the centre to B (Vladimir, 2026-11-08: a step composed of two large motions through a
//  canonical point, as in arcball navigation). A sequence of such moves composes to the
//  move from the first point to the last (the charts telescope), so a drag round a loop
//  changes nothing, and the picture keeps its screen orientation and its size in the metric
//  wherever it goes. Composing small translations along the path instead would turn it by
//  the area enclosed.
//
//  The other maps: translationTo (along the geodesic from A to B), rotationAbout and
//  similarityAbout (a turn, or a turn with a scaling, in the chart of a point; the scaling
//  is a Möbius map fixing the point and its antipode), and as point maps reflectionAbout
//  (in a geodesic through a point) and affineAbout (any affine map of the chart of a point).
//  geodesicDistance and density measure in the geometry; transformedGeometry carries a
//  geometry through a similarity (pattern to world coordinates); clampToModel keeps a
//  dragged point on the side of the absolute it started from.
//

const MYNAME = 'GeometryMotions';

const ZERO = [0, 0], ONE = [1, 0];
const neg = z => [-z[0], -z[1]];
const scaleC = (z, s) => [z[0]*s, z[1]*s];

// a point this close to the absolute (relative to the model's size) is not moved onto it
const RIM_EPS = 1.e-4;

// ---- Möbius maps ---------------------------------------------------------------------------

function mobiusIdentity(){
    return [[ONE, ZERO], [ZERO, ONE]];
}

/** the composition P after Q: z -> P(Q(z)) */
function mobiusCompose(P, Q){
    const [[a, b], [c, d]] = P, [[e, f], [g, h]] = Q;
    return [[cAdd(cMul(a, e), cMul(b, g)), cAdd(cMul(a, f), cMul(b, h))],
            [cAdd(cMul(c, e), cMul(d, g)), cAdd(cMul(c, f), cMul(d, h))]];
}

function mobiusInverse(m){
    return [[m[1][1], neg(m[0][1])], [neg(m[1][0]), m[0][0]]];
}

function mobiusDet(m){
    return cSub(cMul(m[0][0], m[1][1]), cMul(m[0][1], m[1][0]));
}

/** the image of the point z; the pole goes far away, not to infinity */
function mobiusApply(m, z){
    const [[a, b], [c, d]] = m;
    let den = cAdd(cMul(c, z), d);
    if (!(cAbs2(den) > 1.e-300)) den = [1.e-150, 0];
    return cDiv(cAdd(cMul(a, z), b), den);
}

/** the complex derivative at z, det/(cz + d)^2 */
function mobiusDerivative(m, z){
    const den = cAdd(cMul(m[1][0], z), m[1][1]);
    return cDiv(mobiusDet(m), cMul(den, den));
}

/** the map as a point map [x, y] -> [x, y] */
function mobiusPointMap(m){
    return q => mobiusApply(m, q);
}

// ---- charts ---------------------------------------------------------------------------------

/** -1 for the hyperbolic plane (a disk or a half plane), 0 for the plane, 1 for the sphere */
function curvature(geom){
    return geom.kind === 'spherical' ? 1 : (geom.kind === 'euclidean' ? 0 : -1);
}

/** (z - u)/(1 + k conj(u) z): the automorphism of the standard model taking u to the origin (the disk: 1 - conj(u) z; the sphere: 1 + conj(u) z) */
function toOrigin(u, k){
    return [[ONE, neg(u)], [scaleC(conj(u), k), ONE]];
}

/**
 * the Möbius map of the model containing A onto the standard model: the unit disk, the
 * plane itself, the unit sphere; A decides the side of a circle or a line
 */
function modelMap(geom, A){
    switch (geom.kind) {
    case 'euclidean':
        return mobiusIdentity();
    case 'hyperbolic': {
        // the disk onto the unit disk: (z - c)/r inside, r/(z - c) outside
        const inside = cAbs(cSub(A, geom.c)) < geom.r;
        return inside ? [[[1/geom.r, 0], scaleC(geom.c, -1/geom.r)], [ZERO, ONE]]
                      : [[ZERO, [geom.r, 0]], [ONE, neg(geom.c)]];
    }
    case 'halfplane': {
        // the line onto the real axis (p to 0, e along it), the side of A up, then
        // Cayley's map (w - i)/(w + i) of the upper half plane onto the unit disk
        const ce = conj(geom.e);
        let s1 = [[ce, neg(cMul(geom.p, ce))], [ZERO, ONE]];
        if (mobiusApply(s1, A)[1] < 0) s1 = mobiusCompose([[neg(ONE), ZERO], [ZERO, ONE]], s1);
        return mobiusCompose([[ONE, [0, -1]], [ONE, [0, 1]]], s1);
    }
    case 'spherical':
        return [[[1/geom.R, 0], scaleC(geom.c, -1/geom.R)], [ZERO, ONE]];
    default:
        throw new Error(`${MYNAME}: unknown geometry '${geom.kind}'`);
    }
}

/**
 * the chart of A: the Möbius map of the model (the one containing A) onto the standard
 * model with A at the origin, the model map followed by the automorphism taking A's
 * image to the origin (which has a positive real derivative there: the chart turns at
 * A as the model map does)
 */
function chartTo(geom, A){
    const s = modelMap(geom, A);
    return mobiusCompose(toOrigin(mobiusApply(s, A), curvature(geom)), s);
}

/** the chart of A turned so that its derivative at A is a positive real: the model seen from A without a turn */
function canonicalChart(geom, A){
    const s = chartTo(geom, A);
    const d = mobiusDerivative(s, A), n = cAbs(d);
    if (!(n > 0) || !Number.isFinite(n)) return s;
    return mobiusCompose([[scaleC(conj(d), 1/n), ZERO], [ZERO, ONE]], s);
}

// ---- motions --------------------------------------------------------------------------------

/**
 * the move of a pose from A to B: sigma_B^-1 sigma_A with the canonical charts, the map
 * that puts the picture of A's chart into B's. The chart of B is taken in geomB, the
 * geometry at B, the same as A's unless the geometry varies from point to point (the
 * maximal disks of a Kleinian group); in one geometry B's model must be A's
 */
function moveTo(geom, A, B, geomB = geom){
    return mobiusCompose(mobiusInverse(canonicalChart(geomB, B)), canonicalChart(geom, A));
}

// the anchor's place is solved to this (relative) precision, in so many passes at most
const ANCHOR_TOL = 1.e-13;
const ANCHOR_PASSES = 8;

/**
 * the place X of an anchor whose canonical chart puts the point w at q: sigma_X(w) = q,
 * in the geometry geom (w's model). In the standard model, with p the image of w and
 * q' = q turned by the chart's turn at X (the argument of the model map's derivative,
 * nil inside a disk, on the sphere and in the plane), the automorphism tau_v taking v,
 * the image of X, to the origin must take p to q': v - beta conj(v) = gamma with
 * beta = -k q' p and gamma = p - q', a real 2x2 system. Where the model map turns
 * (outside a disk, in a half plane) the turn is iterated from the guess. Null when the
 * system is singular (a far pointer on the sphere)
 */
function anchorPlace(geom, w, q, guess = w){
    const k = curvature(geom);
    const s = modelMap(geom, w), si = mobiusInverse(s);
    const p = mobiusApply(s, w);
    let X = guess;
    for (let pass = 0; pass < ANCHOR_PASSES; pass++) {
        const d = mobiusDerivative(s, X);
        const qq = cMul(q, cPolar(1, Math.atan2(d[1], d[0])));
        const beta = scaleC(cMul(qq, p), -k), gamma = cSub(p, qq);
        const D = 1 - cAbs2(beta);
        if (!(D > 1.e-12)) return null;
        const x = (gamma[0]*(1 + beta[0]) + beta[1]*gamma[1])/D;
        const y = (gamma[1]*(1 - beta[0]) + beta[1]*gamma[0])/D;
        const Xn = mobiusApply(si, [x, y]);
        if (!Number.isFinite(Xn[0]) || !Number.isFinite(Xn[1])) return null;
        const moved = Math.hypot(Xn[0] - X[0], Xn[1] - X[1]);
        X = Xn;
        if (moved <= ANCHOR_TOL*(1 + Math.hypot(X[0], X[1]))) break;
    }
    return X;
}

/**
 * the move of a pose whose state sits at the anchor C when the shape is grabbed at w0
 * and the pointer is at w1: sigma_{C1}^-1 sigma_C, the anchor going to the place C1 whose
 * chart puts w1 where C's chart puts w0 (anchorPlace), so that the grabbed point
 * follows the pointer and the anchor is carried exactly; moves grabbed anywhere then
 * compose by their anchors alone, and a loop of them is the identity. geomAt(point)
 * gives the geometry at a point: geomC everywhere in the plane, the disk and the
 * sphere; the maximal disk of a Kleinian group, in which case the anchor's place and
 * its geometry are iterated together from the guess (the last place found).
 * {m, anchor: C1, geometry: the geometry at C1}
 */
function anchoredMoveTo(geomC, C, w0, w1, geomAt = () => geomC, guess = null){
    const sC = canonicalChart(geomC, C);
    const q = mobiusApply(sC, w0);
    let X = guess || [w1[0] + C[0] - w0[0], w1[1] + C[1] - w0[1]];
    let g = geomC;
    for (let pass = 0; pass < 4; pass++) {
        g = geomAt(X);
        const Xn = anchorPlace(g, w1, q, X);
        if (!Xn) break;
        const moved = Math.hypot(Xn[0] - X[0], Xn[1] - X[1]);
        if (moved <= ANCHOR_TOL*(1 + Math.hypot(X[0], X[1]))) break;
        X = Xn;
    }
    g = geomAt(X);
    return { m: mobiusCompose(mobiusInverse(canonicalChart(g, X)), sC), anchor: X, geometry: g };
}

/**
 * the translation along the geodesic from A to B, the isometry with no turn along it:
 * in the chart of A the pure translation of the origin to the image t of B,
 * z -> (z + t)/(1 - k conj(t) z); null when B is not in A's model
 */
function translationTo(geom, A, B){
    const s = chartTo(geom, A);
    const t = mobiusApply(s, B);
    const k = curvature(geom);
    if (!Number.isFinite(t[0]) || !Number.isFinite(t[1]) || (k < 0 && cAbs(t) >= 1)) return null;
    const T = [[ONE, t], [scaleC(conj(t), -k), ONE]];
    return mobiusCompose(mobiusInverse(s), mobiusCompose(T, s));
}

/** the rotation about P by the angle (radians, counterclockwise) */
function rotationAbout(geom, P, angle){
    return similarityAbout(geom, P, cPolar(1, angle));
}

/**
 * the turn and scaling about P by the complex factor [re, im]: z -> factor z in the
 * canonical chart of P (a Möbius map fixing P and its antipode, with the derivative
 * factor at P); a real factor scales the picture of P's chart, a unit one turns it
 */
function similarityAbout(geom, P, factor){
    const s = canonicalChart(geom, P);
    return mobiusCompose(mobiusInverse(s), mobiusCompose([[factor, ZERO], [ZERO, ONE]], s));
}

/**
 * the reflection in the geodesic through P in the direction dir ([dx, dy] at P), as a
 * point map: in the canonical chart of P the reflection in the line through the origin
 * along dir, z -> (dir/|dir|)^2 conj(z)
 */
function reflectionAbout(geom, P, dir){
    const s = canonicalChart(geom, P), si = mobiusInverse(s);
    const n = Math.hypot(dir[0], dir[1]) || 1;
    const e = [dir[0]/n, dir[1]/n], e2 = cMul(e, e);
    return q => mobiusApply(si, cMul(e2, conj(mobiusApply(s, q))));
}

/** an affine map ([x, y] -> [x, y]) of the canonical chart of P, as a point map of the plane */
function affineAbout(geom, P, affine){
    const s = canonicalChart(geom, P), si = mobiusInverse(s);
    return q => mobiusApply(si, affine(mobiusApply(s, q)));
}

// ---- measures ------------------------------------------------------------------------------

/** the distance of A and B in the geometry (B in A's model) */
function geodesicDistance(geom, A, B){
    const k = curvature(geom);
    if (k === 0) return Math.hypot(B[0] - A[0], B[1] - A[1]);
    const t = cAbs(mobiusApply(chartTo(geom, A), B));
    return k < 0 ? 2*Math.atanh(Math.min(t, 1 - 1.e-16)) : 2*Math.atan(t);
}

/** the density of the metric at A: a Euclidean length 1 at A measures this much */
function density(geom, A){
    switch (geom.kind) {
    case 'euclidean': return 1;
    case 'hyperbolic': { const d2 = cAbs2(cSub(A, geom.c)); return 2*geom.r/Math.abs(geom.r*geom.r - d2); }
    case 'halfplane': { const d = cSub(A, geom.p); return 1/Math.abs(d[1]*geom.e[0] - d[0]*geom.e[1]); }
    case 'spherical': { const d2 = cAbs2(cSub(A, geom.c)); return 2*geom.R/(geom.R*geom.R + d2); }
    default: return 1;
    }
}

// ---- coordinates ---------------------------------------------------------------------------

/**
 * the geometry carried through a similarity sim = {map(x, y) -> [x, y], scale} (the
 * pattern to world map of a pattern transform, Folder.js): circles keep their kind
 */
function transformedGeometry(geom, sim){
    switch (geom.kind) {
    case 'hyperbolic': return { ...geom, c: sim.map(geom.c[0], geom.c[1]), r: geom.r*sim.scale };
    case 'spherical':  return { ...geom, c: sim.map(geom.c[0], geom.c[1]), R: geom.R*sim.scale };
    case 'halfplane': {
        const p = sim.map(geom.p[0], geom.p[1]), q = sim.map(geom.p[0] + geom.e[0], geom.p[1] + geom.e[1]);
        const n = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        return { ...geom, p, e: [(q[0] - p[0])/n, (q[1] - p[1])/n] };
    }
    default: return geom;
    }
}

/**
 * B kept in the model of A: on A's side of the absolute, at least eps (of the model's
 * size) away from it; B itself where it is there already, or where the geometry has no
 * absolute in the plane
 */
function clampToModel(geom, A, B, eps = RIM_EPS){
    if (geom.kind === 'hyperbolic') {
        const dA = Math.hypot(A[0] - geom.c[0], A[1] - geom.c[1]) - geom.r;
        const side = dA < 0 ? -1 : 1;
        const vx = B[0] - geom.c[0], vy = B[1] - geom.c[1];
        const dB = Math.hypot(vx, vy) - geom.r;
        if (dB*side > eps*geom.r) return B;
        // out along the ray from the centre through B (through A when B is the centre)
        let ux = vx, uy = vy, n = Math.hypot(ux, uy);
        if (n < 1.e-12) { ux = A[0] - geom.c[0]; uy = A[1] - geom.c[1]; n = Math.hypot(ux, uy) || 1; if (n < 1.e-12) { ux = 1; uy = 0; n = 1; } }
        const rr = geom.r*(1 + side*eps);
        return [geom.c[0] + ux/n*rr, geom.c[1] + uy/n*rr];
    }
    if (geom.kind === 'halfplane') {
        // the signed distance across the line, positive on the left of e
        const across = w => (w[1] - geom.p[1])*geom.e[0] - (w[0] - geom.p[0])*geom.e[1];
        const side = across(A) < 0 ? -1 : 1;
        const d = across(B);
        const least = eps*(1 + Math.abs(across(A)));
        if (d*side > least) return B;
        const shift = side*least - d;
        return [B[0] - shift*geom.e[1], B[1] + shift*geom.e[0]];
    }
    return B;
}

export {
    mobiusIdentity,
    mobiusCompose,
    mobiusInverse,
    mobiusApply,
    mobiusDerivative,
    mobiusPointMap,
    modelMap,
    chartTo,
    canonicalChart,
    moveTo,
    anchorPlace,
    anchoredMoveTo,
    translationTo,
    rotationAbout,
    similarityAbout,
    reflectionAbout,
    affineAbout,
    geodesicDistance,
    density,
    transformedGeometry,
    clampToModel,
};
