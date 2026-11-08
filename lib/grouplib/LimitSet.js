import {
    getMatrixMobius,
    isPlanarTransform,
    iPoint,
    cMul,
    cDiv,
    cAdd,
    cSub,
    cAbs,
    csqrt,
    mmul,
    mdet,
} from './modules.js';

//
//  LimitSet - a sample of the limit set of a Kleinian group, for the local geometry of
//  the group at a point (GroupGeometry.maximalDisk; docs/shape_motions_plan.md, outside
//  the repository)
//
//  Seeds: the fixed points of the loxodromic, hyperbolic and parabolic elements among the
//  words of at most SEED_LENGTH letters in the side pairing transforms (for a reflection
//  group the products of reflections in disjoint sides; the cusps). They are pushed by the
//  words of the group without backtracking, a word kept and extended while the scale
//  |w'(base)| of its cell at a base point of the domain is at least minScale (the pruning
//  of dirichletImages in DirichletDomain.js), so the sample is about minScale fine along
//  the whole limit set, which a sample by the length of the words is not (the cells of
//  long words are tiny near the cusps and large elsewhere). The words and the points are
//  budgeted. The point at infinity may be a limit point (a parabolic fixing it); it is
//  noted apart from the finite points.
//
//  The transforms are taken as Möbius maps of the plane (getMatrixMobius: z -> m(z), or
//  z -> m(conj z) for a reversing one) and composed as such; a transform that is not
//  planar is left out. The sample is kept per group (a WeakMap) and recomputed when the
//  options differ.
//
//  limitSetSample(group, options) -> {
//      points    Float64Array [x0, y0, x1, y1, ...], the finite limit points
//      count     their number
//      infinity  true when the point at infinity is a limit point
//      words     the words the orbit was taken over
//      seeds     the seeds, [x, y] or null for infinity
//      minScale, maxWords, maxPoints
//  } or null when no seed is found (a finite group, or no planar transform)
//

const MYNAME = 'LimitSet';

const SEED_LENGTH = 3;
// most seeds: the orbit of one limit point is dense already, more seeds only fill the
// sample faster; the shortest words' fixed points come first
const MAX_SEEDS = 6;
const DEFAULT_MIN_SCALE = 3.e-3;
const DEFAULT_MAX_WORDS = 20000;
const DEFAULT_MAX_POINTS = 120000;
const FOLD_ITERATIONS = 100;
// |tr^2 - 4| below this: parabolic (one fixed point); a real trace below 2 in size: elliptic (none)
const EPS_PARABOLIC = 1.e-7;
const EPS_REAL = 1.e-9;
// |c| of the matrix below this: an affine map, infinity is fixed
const EPS_AFFINE = 1.e-14;
// the point at infinity, and the size of a denominator that sends a point there
const INF = null;
const EPS_DEN = 1.e-150;

const mCache = new WeakMap();

// ---- elements as Möbius maps of the plane -------------------------------------------------

const conjC = z => [z[0], -z[1]];
const conjM = m => m.map(row => row.map(conjC));
const IDENTITY = { m: [[[1, 0], [0, 0]], [[0, 0], [1, 0]]], r: false };

/** the matrix scaled to determinant 1 */
function unit(m){
    const s = csqrt(mdet(m));
    if (!(cAbs(s) > 0)) return m;
    return m.map(row => row.map(z => cDiv(z, s)));
}

/** the element {m, r} of a transform (ITransform or array of splanes): z -> m(z), or m(conj z) when r; null when not planar */
function elementOf(trans){
    const ref = (trans && typeof trans.getRef === 'function') ? trans.getRef() : trans;
    if (!ref || !isPlanarTransform(ref)) return null;
    const { m, reversing } = getMatrixMobius(ref);
    return { m: unit(m), r: reversing };
}

/** f after g: z -> f(g(z)) */
function compose(f, g){
    return { m: mmul(f.m, f.r ? conjM(g.m) : g.m), r: f.r !== g.r };
}

/** f(z), with the point at infinity as INF both ways */
function applyTo(f, z){
    const [[a, b], [c, d]] = f.m;
    if (z === INF) return cAbs(c) < EPS_DEN ? INF : cDiv(a, c);
    const w = f.r ? conjC(z) : z;
    const den = cAdd(cMul(c, w), d);
    if (cAbs(den) < EPS_DEN) return INF;
    return cDiv(cAdd(cMul(a, w), b), den);
}

/** |f'(z)| for a finite z (the matrix has determinant 1) */
function scaleAt(f, z){
    const [, [c, d]] = f.m;
    const w = f.r ? conjC(z) : z;
    const den = cAdd(cMul(c, w), d);
    const dd = den[0]*den[0] + den[1]*den[1];
    return dd > 0 ? 1/dd : Infinity;
}

const sameC = (a, b, eps) => Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;

/** is the element the identity (the matrix plus or minus the unit matrix, not reversing) */
function isIdentity(f, eps = 1.e-9){
    if (f.r) return false;
    const [[a, b], [c, d]] = f.m;
    for (const s of [1, -1]) {
        if (sameC(a, [s, 0], eps) && sameC(d, [s, 0], eps) && sameC(b, [0, 0], eps) && sameC(c, [0, 0], eps)) return true;
    }
    return false;
}

/**
 * the fixed points on the limit set of an orientation preserving element: both of a
 * loxodromic or hyperbolic one, the one of a parabolic one, none of an elliptic one (its
 * fixed points lie in the domain of discontinuity) or of the identity; INF for infinity
 */
function limitFixedPoints(f){
    if (f.r) return [];
    const [[a, b], [c, d]] = f.m;
    const tr = cAdd(a, d);
    const tr2 = cMul(tr, tr);
    const parabolic = cAbs(cSub(tr2, [4, 0])) < EPS_PARABOLIC;
    if (cAbs(c) < EPS_AFFINE) {
        // affine: z -> (a z + b)/d; infinity is fixed; a translation has no other fixed point
        const da = cSub(d, a);
        if (parabolic || cAbs(da) < EPS_AFFINE) return isIdentity(f) ? [] : [INF];
        return [INF, cDiv(b, da)];
    }
    if (parabolic) return [cDiv(cSub(a, d), cMul([2, 0], c))];
    if (Math.abs(tr[1]) < EPS_REAL && Math.abs(tr[0]) < 2) return [];   // elliptic
    const ad = cSub(a, d);
    const sq = csqrt(cAdd(cMul(ad, ad), cMul([4, 0], cMul(b, c))));
    const c2 = cMul([2, 0], c);
    return [cDiv(cAdd(ad, sq), c2), cDiv(cSub(ad, sq), c2)];
}

// ---- the sample ----------------------------------------------------------------------------

/** the elements of the group's generators (the side pairings) and the index of each one's inverse */
function generatorElements(group){
    const trs = (typeof group.getReverseITransforms === 'function') ? group.getReverseITransforms() : null;
    if (!trs) return null;
    const gens = trs.map(elementOf).filter(Boolean);
    if (!gens.length) return null;
    const inverse = gens.map((g, i) => {
        for (let j = 0; j < gens.length; j++) if (isIdentity(compose(g, gens[j]))) return j;
        return -1;
    });
    return { gens, inverse };
}

/** a point of the fundamental domain for the scale of the cells: the origin folded into it */
function basePoint(group){
    try {
        const res = group.toFundDomain({ pnt: iPoint([0, 0, 0, 0]), maxIterations: FOLD_ITERATIONS });
        if (res && res.inDomain && res.pnt && res.pnt.v.every(Number.isFinite)) return [res.pnt.v[0], res.pnt.v[1]];
    } catch (e) { /* the origin itself then */ }
    return [0, 0];
}

/** the seeds: the limit fixed points of the shortest words (at most SEED_LENGTH letters), each once, at most MAX_SEEDS of them */
function seedsOf(gens, inverse){
    const seeds = [];
    let infinity = false;
    const enough = () => seeds.length + (infinity ? 1 : 0) >= MAX_SEEDS;
    const add = z => {
        if (enough()) return;
        if (z === INF) { infinity = true; return; }
        if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) return;
        if (seeds.some(s => sameC(s, z, 1.e-9))) return;
        seeds.push(z);
    };
    let frontier = [{ f: IDENTITY, last: -1 }];
    for (let len = 1; len <= SEED_LENGTH && !enough(); len++) {
        const next = [];
        for (const w of frontier) {
            for (let g = 0; g < gens.length; g++) {
                if (w.last >= 0 && inverse[w.last] === g) continue;
                const f = compose(w.f, gens[g]);
                limitFixedPoints(f).forEach(add);
                next.push({ f, last: g });
            }
        }
        frontier = next;
    }
    return { seeds, infinity };
}

/**
 * the sample of the group's limit set, cached per group
 *
 * options: minScale (the pruning of the words by the scale of their cells),
 *          maxWords, maxPoints (the budget)
 */
export function limitSetSample(group, options = {}){
    const minScale = options.minScale || DEFAULT_MIN_SCALE;
    const maxWords = options.maxWords || DEFAULT_MAX_WORDS;
    const maxPoints = options.maxPoints || DEFAULT_MAX_POINTS;
    const key = `${minScale} ${maxWords} ${maxPoints}`;
    const cached = group && mCache.get(group);
    if (cached && cached.key === key) return cached.sample;
    const sample = computeSample(group, minScale, maxWords, maxPoints);
    if (group) mCache.set(group, { key, sample });
    return sample;
}

function computeSample(group, minScale, maxWords, maxPoints){
    if (!group) return null;
    const ge = generatorElements(group);
    if (!ge) return null;
    const { gens, inverse } = ge;
    const { seeds, infinity: seedInfinity } = seedsOf(gens, inverse);
    if (!seeds.length && !seedInfinity) return null;

    const base = basePoint(group);
    let points = new Float64Array(2*Math.min(maxPoints, 4096));
    let count = 0;
    let infinity = seedInfinity;
    const push = (f) => {
        for (const s of seeds) {
            const z = applyTo(f, s);
            if (z === INF) { infinity = true; continue; }
            if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
            if (count >= maxPoints) return;
            if (2*count + 2 > points.length) {
                const bigger = new Float64Array(Math.min(2*maxPoints, 2*points.length));
                bigger.set(points);
                points = bigger;
            }
            points[2*count] = z[0];
            points[2*count + 1] = z[1];
            count++;
        }
        // the point at infinity, when a limit point, has an orbit of limit points too
        if (seedInfinity) {
            const z = applyTo(f, INF);
            if (z !== INF && Number.isFinite(z[0]) && Number.isFinite(z[1]) && count < maxPoints) {
                if (2*count + 2 > points.length) {
                    const bigger = new Float64Array(Math.min(2*maxPoints, 2*points.length));
                    bigger.set(points);
                    points = bigger;
                }
                points[2*count] = z[0];
                points[2*count + 1] = z[1];
                count++;
            }
        }
    };

    push(IDENTITY);
    let words = 1;
    let frontier = [{ f: IDENTITY, last: -1 }];
    while (frontier.length && words < maxWords && count < maxPoints) {
        const next = [];
        for (const w of frontier) {
            for (let g = 0; g < gens.length && words < maxWords && count < maxPoints; g++) {
                if (w.last >= 0 && inverse[w.last] === g) continue;
                const f = compose(w.f, gens[g]);
                if (!(scaleAt(f, base) >= minScale)) continue;
                push(f);
                next.push({ f, last: g });
                words++;
            }
        }
        frontier = next;
    }
    return { points: points.subarray(0, 2*count), count, infinity, words, seeds: [...seeds, ...(seedInfinity ? [INF] : [])], minScale, maxWords, maxPoints };
}

/** forgets the sample of a group (its parameters changed in place) */
export function clearLimitSetSample(group){
    if (group) mCache.delete(group);
}
