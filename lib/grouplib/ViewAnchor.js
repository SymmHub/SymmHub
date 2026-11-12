/*
  ViewAnchor.js — the view anchor: the element of the group that folds the
  view's centre into the fundamental domain F (docs/infinite_navigation_plan.md,
  outside the repository, step 1a).

  Every symmetric shader folds a pixel's world point p into F, at most
  uIterations steps; a view far from F runs out of steps and stops drawing.
  The anchor a moves the view to F instead: the shaders fold a(p) and start
  the fold's state (the colour permutation, the class of a subgroup's cell)
  from the state of a. The element that folds p is the same (the fold of a(p)
  followed by a), so the picture is the same; only the steps of the screen's
  own extent remain.

  The anchor is
    - a word of side indices of the group (the sides as the GPU has them,
      DataPacking: getFundDomain(), getReverseTransforms()), freely reduced:
      a side followed by its paired side cancels. Each letter carries an id,
      so that consumers keep their own state along the word and recompute
      only past the part that changed (foldState);
    - its map z -> M(anti ? conj(z) : z), M a complex 2x2 matrix of
      determinant 1, composed in double from the reflections of the sides.

  update() maps the view's disk (the world disk round the whole canvas,
  viewDisk) by the anchor and folds it further while all of it is outside a
  side: a step every pixel of the view takes in its own fold. Steps the disk
  no longer takes (the view went back) are taken back. Near F, and wherever
  the view straddles a side (a limit set across the screen), the anchor stays
  the identity: the picture is the fold of every pixel from scratch, as
  without the anchor (2026-11-12; folding the view's centre alone gave an
  element with its pole on the screen when the centre was in fine detail).
  An update that runs out of time leaves a partial anchor that the next frame
  continues. A group other than the last one resets the anchor. Phase 2 (the
  navigator keeps the anchored view) folds the view's centre into F.

  The shaders get the anchor centred at the reference point c (float):
     a(c + w) = q + w'/(A + B w'),   w' = anti ? conj(w) : w,
     |a'| = |A| / |A + B w'|^2
  q = a(c), A = D^2, B = D gamma, D = gamma u + delta, u = anti ? conj(c) : c:
  only the small w = p - c is taken in float.
*/

import {
    SPLANE_SPHERE,
    SPLANE_PLANE,
} from './modules.js';

const EPS = 1.e-7;                 // as the shaders: outside a side by more than EPS
const DEFAULT_BUDGET_MS = 6;       // the time of one update; the rest is done next frame
const REFOLD_MIN = 64;             // see continueRefold()
const REFOLD_MIN_STEPS = 1e5;
const RACE_MIN = 1024;             // a pending fold from a word this long races the fold from scratch
const LOOP_MAX = 32;               // phase 2: loops of the tiles up to this length are taken out of the word (popLoop)
const PEAK_EXACT = 1e4;            // phase 2: a word's map is exact (rounding 1e-8) when no map on its way was larger (isMapExact)
const CHECK = 256;                 // letters per checkpoint of a word (foldState)
const RIGID_TOL = 1e-6;            // an affine map with |alpha/delta| this near 1 is a motion (rigid)
const RELAX_MIN = 8;               // a side the disk is outside of, out of the pixels' order, only this far from F (diskSide)

const now = () => (typeof performance !== 'undefined') ? performance.now() : Date.now();

// ── complex numbers [re, im] and 2x2 matrices [a, b, c, d] ────────────────────

const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cMul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cDiv = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
const cConj = a => [a[0], -a[1]];
const cAbs = a => Math.hypot(a[0], a[1]);
// the larger component first, the other from it: no cancellation near the negative axis
function cSqrt(a){
    const r = cAbs(a);
    if (r === 0) return [0, 0];
    if (a[0] >= 0) {
        const x = Math.sqrt((r + a[0])/2);
        return [x, a[1]/(2*x)];
    }
    const y = (a[1] < 0 ? -1 : 1)*Math.sqrt((r - a[0])/2);
    return [a[1]/(2*y), y];
}

const IDENTITY = { m: [[1, 0], [0, 0], [0, 0], [1, 0]], anti: false };

function matMul(P, Q){
    return [
        cAdd(cMul(P[0], Q[0]), cMul(P[1], Q[2])),
        cAdd(cMul(P[0], Q[1]), cMul(P[1], Q[3])),
        cAdd(cMul(P[2], Q[0]), cMul(P[3], Q[2])),
        cAdd(cMul(P[2], Q[1]), cMul(P[3], Q[3])),
    ];
}

/** the matrix scaled to determinant 1 */
function matNormalize(M){
    const det = cAdd(cMul(M[0], M[3]), cMul([-1, 0], cMul(M[1], M[2])));
    const s = cSqrt(det);
    if (!(cAbs(s) > 0)) return M;
    return M.map(e => cDiv(e, s));
}

/** S after T, both {m, anti}: S(T(z)) */
function compose(S, T){
    const t = S.anti ? T.m.map(cConj) : T.m;
    return { m: matNormalize(matMul(S.m, t)), anti: S.anti !== T.anti };
}

/** the inverse of {m, anti} (determinant 1): T(z) = M(conj z) has T^-1(w) = conj(M^-1)(conj w) */
function invertMap(T){
    const M = T.m;
    const inv = [M[3], cMul([-1, 0], M[1]), cMul([-1, 0], M[2]), M[0]];
    return { m: T.anti ? inv.map(cConj) : inv, anti: T.anti };
}

/** the reflection in a splane as {m, anti: true}, null for anything else */
function reflectionMap(sp){
    const v = sp.v;
    if (sp.type === SPLANE_SPHERE) {
        // z -> c + r^2/(conj(z) - conj(c))
        const c = [v[0], v[1]];
        const r2 = v[3]*v[3];
        return { m: matNormalize([c, [r2 - (c[0]*c[0] + c[1]*c[1]), 0], [1, 0], cMul([-1, 0], cConj(c))]), anti: true };
    }
    if (sp.type === SPLANE_PLANE) {
        // z -> -n^2 conj(z) + 2 d n, |n| = 1
        const l = Math.hypot(v[0], v[1]);
        const n = [v[0]/l, v[1]/l];
        const d = v[3]/l;
        return { m: matNormalize([cMul([-1, 0], cMul(n, n)), [2*d*n[0], 2*d*n[1]], [0, 0], [1, 0]]), anti: true };
    }
    return null;
}

/** the map applied to the point [x, y]; null at infinity */
function applyMap(T, p){
    const z = T.anti ? [p[0], -p[1]] : [p[0], p[1]];
    const M = T.m;
    const den = cAdd(cMul(M[2], z), M[3]);
    if (!(cAbs(den) > 0)) return null;
    const w = cDiv(cAdd(cMul(M[0], z), M[1]), den);
    return (isFinite(w[0]) && isFinite(w[1])) ? w : null;
}

/** signed distance of the point [x, y] to a side, as iDistance of the shaders */
function sideDist(sp, p){
    const v = sp.v;
    if (sp.type === SPLANE_SPHERE) {
        const d = Math.hypot(p[0] - v[0], p[1] - v[1]) - Math.abs(v[3]);
        return v[3] > 0 ? d : -d;
    }
    return p[0]*v[0] + p[1]*v[1] - v[3];
}

/** the signed distance of the point [x, y] to a side in world units: sideDist with the plane's normal made unit */
function diskDist(sp, p){
    const v = sp.v;
    if (sp.type === SPLANE_SPHERE) return sideDist(sp, p);
    const l = Math.hypot(v[0], v[1]) || 1;
    return (p[0]*v[0] + p[1]*v[1] - v[3])/l;
}

/**
 * the image of the disk {c, r} under the map T (determinant 1), a disk {c, r}; null when
 * T sends a point of the closed disk to infinity (the image is not a disk). With
 * u = gamma c + delta: radius r/(|u|^2 - |gamma|^2 r^2), centre T(c) - conj(gamma u) r^2/(|u|^2 (...))
 */
function mapDisk(T, D){
    const r = D.r;
    if (!(r >= 0 && r < Infinity)) return null;
    const c = T.anti ? [D.c[0], -D.c[1]] : D.c;
    const M = T.m;
    const u = cAdd(cMul(M[2], c), M[3]);
    const u2 = u[0]*u[0] + u[1]*u[1];
    const den = u2 - (M[2][0]*M[2][0] + M[2][1]*M[2][1])*r*r;
    if (!(den > 0)) return null;
    const tc = cDiv(cAdd(cMul(M[0], c), M[1]), u);
    const k = r*r/(u2*den);
    const gu = cConj(cMul(M[2], u));
    const out = { c: [tc[0] - k*gu[0], tc[1] - k*gu[1]], r: r/den };
    return (isFinite(out.c[0]) && isFinite(out.c[1]) && isFinite(out.r)) ? out : null;
}

/**
 * an affine element of a group (gamma exactly 0) that is a Euclidean motion, |alpha| = |delta| = 1
 * (determinant 1): the rounding of millions of steps makes it a similarity, off by the
 * distance from home far out, unless kept so. An affine element that is not a motion stays
 * as it is: a dilation z -> k z (a side pairing of a group in the upper half plane, KLMN with
 * uhp: |alpha/delta| = |k|) was made the identity here, and the fold of the view's centre
 * never got anywhere (2026-11-12, bending/par_s2223-2 flickered)
 */
function rigid(T){
    const M = T.m;
    if (M[2][0] !== 0 || M[2][1] !== 0) return T;
    const ra = cAbs(M[0]), rd = cAbs(M[3]);
    if (!(ra > 0 && rd > 0)) return T;
    if (Math.abs(ra/rd - 1) > RIGID_TOL) return T;
    // alpha/|alpha|, delta/|delta|, beta by sqrt(|alpha| |delta|): the same map scaled to |alpha| = |delta|, then made isometric
    const s = Math.sqrt(ra*rd);
    return { m: [[M[0][0]/ra, M[0][1]/ra], [M[1][0]/s, M[1][1]/s], [0, 0], [M[3][0]/rd, M[3][1]/rd]], anti: T.anti };
}

function isIdentityMap(T, eps){
    if (T.anti) return false;
    const M = T.m;
    // determinant 1: the identity is +-I
    const s = M[0][0] >= 0 ? 1 : -1;
    return cAbs([M[0][0] - s, M[0][1]]) < eps && cAbs(M[1]) < eps && cAbs(M[2]) < eps && cAbs([M[3][0] - s, M[3][1]]) < eps;
}

/**
 * the sides of the group as the anchor uses them:
 *   [{splane, map, inverse}]: the side, the map of its pairing transform
 *   (the reflections in order, as the shaders apply them), the index of the
 *   side whose pairing undoes it (-1 when none)
 */
function groupSides(group){
    const fd = group.getFundDomain();
    const trs = group.getReverseTransforms();
    const sides = fd.map((sp, g) => {
        const t = trs[g];
        const ref = t ? (t.getRef ? t.getRef() : t) : [];
        let map = IDENTITY;
        for (const r of ref) {
            const R = reflectionMap(r);
            if (!R) return null;
            map = compose(R, map);
        }
        // a Euclidean motion composed of lines keeps gamma at the rounding (1e-17), not 0;
        // far out (beta ~ 1e6) every step adds gamma*beta to delta, and millions of steps
        // turn the map off the group: an affine map stays exactly affine
        const M = map.m;
        if (cAbs(M[2]) < 1e-12*Math.max(cAbs(M[0]), cAbs(M[3]))) {
            map = rigid({ m: matNormalize([M[0], M[1], [0, 0], M[3]]), anti: map.anti });
        }
        return { splane: sp, map, inv: invertMap(map), refs: ref, inverse: -1 };
    });
    if (sides.some(s => !s)) return null;
    for (const s of sides) {
        s.inverse = sides.findIndex(t => isIdentityMap(compose(t.map, s.map), 1e-9));
    }
    return sides;
}

// ── maps and mirrors ─────────────────────────────────────────────────────────

/** the map of mirrors applied in order (the first first), null when one is not a sphere or a plane */
export function mirrorsToMap(mirrors){
    let map = IDENTITY;
    for (const sp of mirrors) {
        const R = reflectionMap(sp);
        if (!R) return null;
        map = compose(R, map);
    }
    return map;
}

/** S after T */
export function composeMaps(S, T){
    return compose(S, T);
}

/** the largest entry of the map's matrix (determinant 1): how far it moves things */
export function mapSize(T){
    return Math.max(...T.m.map(cAbs));
}

/**
 * the map v -> (mirrors applied to centre + v), then post (a map, optional), composed in
 * double and written centred at v = 0 as q + v'/(A + B v') (v' = conj(v) when anti), the
 * form the shaders evaluate at the pixel's offset from the view's centre (vViewOffset):
 * {q, AB: [A, B], anti}, null when it is not finite or a mirror has no map
 */
export function centredViewMap(center, mirrors, post = null){
    if (!mirrors || !center || !isFinite(center[0]) || !isFinite(center[1])) return null;
    let T = { m: [[1, 0], [center[0], center[1]], [0, 0], [1, 0]], anti: false };
    for (const sp of mirrors) {
        const R = reflectionMap(sp);
        if (!R) return null;
        T = compose(R, T);
    }
    if (post) T = compose(post, T);
    const M = T.m;
    const D = M[3];
    if (!(cAbs(D) > 1e-150)) return null;
    const q = cDiv(M[1], D);
    const A = cMul(D, D);
    const B = cMul(D, M[2]);
    if (![q[0], q[1], A[0], A[1], B[0], B[1]].every(isFinite)) return null;
    return { q, AB: [A[0], A[1], B[0], B[1]], anti: T.anti };
}

/**
 * the view's disk in the world: the disk |v| <= radius of the offsets v from the view's
 * centre (the circle round the canvas), through the mirrors applied to centre + v: {c, r};
 * null when the mirrors send a point of it to infinity or one has no map
 */
export function viewDisk(center, mirrors, radius){
    if (!mirrors || !center || !isFinite(center[0]) || !isFinite(center[1]) || !(radius >= 0)) return null;
    let T = { m: [[1, 0], [center[0], center[1]], [0, 0], [1, 0]], anti: false };
    for (const sp of mirrors) {
        const R = reflectionMap(sp);
        if (!R) return null;
        T = compose(R, T);
    }
    return mapDisk(T, { c: [0, 0], r: radius });
}

/** the same map (up to the sign of the matrix), within the rounding of maps of their size */
function sameMap(S, T){
    if (S.anti !== T.anti) return false;
    const tol = 1e-6*Math.max(1, mapSize(S), mapSize(T));
    const near = (s) => S.m.every((e, i) => cAbs([e[0] - s*T.m[i][0], e[1] - s*T.m[i][1]]) <= tol);
    return near(1) || near(-1);
}

/**
 * @returns the anchor object:
 *   update({group, refPoint, enabled, maxSteps, budgetMs}) -> true when the anchor changed
 *   getUniforms() -> the uniforms of the shaders (uAnchorEnabled, ...)
 *   getViewUniforms(center, mirrors) -> the uniforms of step 1b
 *   foldState(cache, init, step) -> the consumer's state of the word
 *   foldPermutation(cache, sidePerms, useOrbit), foldClass(cache, next)
 *   reset(), getWord(), getVersion(), getMap(), isEnabled(), isPending(), mapPoint(p)
 */
export function makeViewAnchor(){

    let mGroup = null;
    let mSides = null;          // groupSides(mGroup), null when the group has sides the anchor can not use
    let mNextId = 1;            // the ids of the checkpoints of the words
    let mW = makeWord();        // the anchor: its word and map
    let mCand = null;           // a fold of the centre from scratch in progress (see continueRefold)
    let mVersion = 0;
    let mEnabled = false;
    let mRef = null;            // the reference point of the last update, as the shaders get it (float)
    let mDisk = null;           // the view's disk of the last update in the world {c, r} (steps 1a, 1b)
    let mPending = false;       // the last update stopped at its budget before F
    let mSteps = 0;             // the steps appended since the last fold from scratch
    let mFresh = 0;             // the length of the word of that fold
    let mChainLen = 0;          // the length of the word when its pending fold began
    let mAnchored = false;      // phase 2: the navigator keeps the anchored view (update's anchored)
    const mStepLog = [];        // the steps of the anchored mode since takeSteps()
    let mRefTrue = null;        // phase 2: the world point of the view's centre (a^-1 of the anchored one), float
    let mWordSwapped = false;   // phase 2: the word was replaced by a shorter one of the same element

    //
    //  a word: the side indices in a typed array (a jump far out makes millions of
    //  letters), the id of every CHECK-th letter, given when it is pushed (a
    //  checkpoint whose id is still the word's has the whole word before it
    //  unchanged, see foldState), and the word's map
    //
    function makeWord(){
        return { data: new Uint16Array(1024), len: 0, ck: [], map: IDENTITY, peak: 1, edits: 0, fresh: -1 };
    }

    function wordPush(w, g){
        if (w.len === w.data.length) {
            const d = new Uint16Array(2*w.data.length);
            d.set(w.data);
            w.data = d;
        }
        w.data[w.len++] = g;
        if (w.len % CHECK === 0) w.ck.push(mNextId++);
    }

    function wordPop(w){
        if (w.len % CHECK === 0) w.ck.pop();
        w.len--;
    }

    // the step through side g, freely reduced: a side after its paired side cancels
    function wordAppend(w, g){
        if (w.len && mSides[g].inverse === w.data[w.len - 1]) wordPop(w);
        else if (!(mAnchored && popLoop(w, g))) wordPush(w, g);
        w.map = rigid(compose(mSides[g].map, w.map));
        w.edits++;
        // phase 2: the largest map on the way, the rounding of the map is about 1e-16 peak^2
        if (mAnchored) w.peak = Math.max(w.peak, mapSize(w.map));
    }

    //
    //  phase 2: the step through side g closes a loop of the tiles the word goes
    //  through (the last j letters and g give the identity): the loop is taken out.
    //  A way back crosses the tiles round a vertex on the other side of it than
    //  the way out (1,1,1 round a point of order 3, a relation of the group the
    //  free reduction does not know); without this the word would not get shorter
    //  on the way back, and its map, the true view, not exact again (isMapExact)
    //
    function popLoop(w, g){
        let P = mSides[g].map;
        for (let j = 1, n = Math.min(LOOP_MAX, w.len); j <= n; j++) {
            P = compose(P, mSides[w.data[w.len - j]].map);
            if (isIdentityMap(P, 1e-9)) {
                for (let i = 0; i < j; i++) wordPop(w);
                return true;
            }
        }
        return false;
    }

    //
    //  phase 2: the word's map is exact enough (the true centre, the navigator's
    //  true transform): its rounding, about 1e-16 peak^2, comes from the largest
    //  map on its way. Far out the true view is out of reach anyway. Back nearer
    //  home the map composed step by step keeps the rounding of the way out, so it
    //  is evaluated afresh from the word: exact when the word does not go far
    //  itself (a way back on the way out reduces freely), else lost (a loop far
    //  out: the free reduction does not know the group's relations)
    //
    function isMapExact(){
        const w = mW;
        if (w.peak <= PEAK_EXACT) return true;
        if (mapSize(w.map) > PEAK_EXACT || w.fresh === w.edits) return false;
        let map = IDENTITY, peak = 1;
        for (let i = 0; i < w.len; i++) {
            map = rigid(compose(mSides[w.data[i]].map, map));
            peak = Math.max(peak, mapSize(map));
        }
        w.map = map;
        w.peak = peak;
        // not again for the same word
        w.fresh = w.edits;
        return peak <= PEAK_EXACT;
    }

    //
    //  fold the point p from the word's state until F, maxSteps or the deadline
    //  (looked at every 256 steps); returns {steps, done: p reached F, p}
    //
    function foldWord(w, p, deadline, maxSteps){
        let steps = 0;
        while (steps < maxSteps) {
            if ((steps & 255) === 255 && now() > deadline) break;
            const g = mSides.findIndex(s => sideDist(s.splane, p) > EPS);
            if (g < 0) return { steps, done: true, p };
            wordAppend(w, g);
            if (mAnchored && w === mW) mStepLog.push(g);
            steps++;
            const np = applyMap(mSides[g].map, p);
            if (!np) break;
            p = np;
        }
        return { steps, done: false, p };
    }

    //
    //  steps 1a and 1b: the view's disk D (in the anchored world, the word's map applied)
    //  folded from the word's state. A step through a side is taken when all of the disk
    //  is outside it, so that every pixel of the view takes it in its own fold: the side
    //  every pixel takes first (the first side the disk is not inside of, when it is
    //  outside of it altogether), else, far from F (RELAX_MIN), any side the disk is
    //  outside of. First the last steps are taken back while the disk before them is no
    //  longer outside their sides (the view went back). Until F, maxSteps or the
    //  deadline; returns {steps, done: no step to take, D, lost: D is not a disk}
    //
    function foldDisk(w, D, deadline, maxSteps){
        let steps = 0;
        while (w.len && steps < maxSteps) {
            if ((steps & 255) === 255 && now() > deadline) return { steps, done: false, D };
            const g = w.data[w.len - 1];
            const prev = mapDisk(mSides[g].inv, D);
            if (!prev) return { steps, done: false, D, lost: true };
            if (diskDist(mSides[g].splane, prev.c) - prev.r > -EPS) break;
            wordPop(w);
            w.map = rigid(compose(mSides[g].inv, w.map));
            w.edits++;
            D = prev;
            steps++;
        }
        while (steps < maxSteps) {
            if ((steps & 255) === 255 && now() > deadline) return { steps, done: false, D };
            const g = diskSide(D);
            if (g < 0) return { steps, done: true, D };
            const next = mapDisk(mSides[g].map, D);
            if (!next) return { steps, done: true, D };
            wordAppend(w, g);
            D = next;
            steps++;
        }
        return { steps, done: false, D };
    }

    //  the side the disk D steps through (foldDisk), -1 for none
    function diskSide(D){
        let first = -1, far = null;
        for (let g = 0; g < mSides.length; g++) {
            const d = diskDist(mSides[g].splane, D.c);
            if (d + D.r <= EPS) continue;
            if (first < 0) {
                first = g;
                if (d - D.r > EPS) return g;
            } else if (d - D.r > EPS) {
                // out of the pixels' order: only where they could not fold the rest themselves
                if (far === null) far = !foldsWithin(D.c, RELAX_MIN);
                if (far) return g;
            }
        }
        return -1;
    }

    //  the point p gets to F in at most n steps
    function foldsWithin(p, n){
        for (let k = 0; k <= n; k++) {
            const g = mSides.findIndex(s => sideDist(s.splane, p) > EPS);
            if (g < 0) return true;
            p = applyMap(mSides[g].map, p);
            if (!p) return false;
        }
        return false;
    }

    function reset(){
        if (mW.len || mW.map !== IDENTITY) mVersion++;
        mW = makeWord();
        mCand = null;
        mSteps = 0;
        mFresh = 0;
        mStepLog.length = 0;
        mWordSwapped = false;
    }

    //
    //  a pan back and forth makes the word longer than the fold of the centre from
    //  scratch (another word of a nearby element: the free reduction does not know the
    //  group's relations), and every letter adds rounding to the map. When the steps
    //  since the last fold from scratch are more than a quarter of its word, the centre
    //  is folded afresh, over frames in what is left of their budget, and the shorter
    //  word kept: the word stays near the fold of the centre, and the folds from scratch
    //  cost a few steps per step. Any element of the group is an anchor, so the fold of
    //  a centre a few frames old is as good as the current one.
    //  The same fold from scratch races a long pending fold from a long word (back home
    //  from far away: the free reduction does not find the way back, and the word would
    //  double); whichever gets to F first is kept
    //  returns true when the word is replaced
    //
    function continueRefold(deadline, maxSteps){
        // some steps every frame, whatever the update spent
        const res = foldDisk(mCand.w, mCand.D, Math.max(deadline, now() + 1), maxSteps);
        mCand.D = res.D;
        mCand.steps += res.steps;
        let swapped = false;
        if (res.lost) {
            mCand = null;
        } else if (res.done) {
            const fresh = mCand.w.len;
            if (mPending || fresh < mW.len) {
                mW = mCand.w;
                mVersion++;
                swapped = true;
            }
            mFresh = fresh;
            mSteps = 0;
            mCand = null;
        } else if (mCand.steps > 4*mW.len + REFOLD_MIN_STEPS) {
            // it does not get to F (a centre near a limit set): not again for a while
            mFresh = mCand.steps;
            mSteps = 0;
            mCand = null;
        }
        return swapped;
    }

    //
    //  phase 2: a pan in a loop leaves a word longer than the fold of the centre
    //  from scratch, as above. The navigator's anchored transform depends on the
    //  anchor's element only, not on its word: near home, where the true centre t
    //  is exact enough, t is folded afresh and the new word kept when it is shorter
    //  and gives the same element (the same map: the elements of a discrete group
    //  are far apart). Far out the word keeps the letters of the way taken
    //
    function refoldAnchored(t, deadline, maxSteps){
        const w = makeWord();
        const r = foldWord(w, [t[0], t[1]], Math.max(deadline, now() + 1), Math.min(maxSteps, 4*mW.len + REFOLD_MIN));
        mSteps = 0;
        if (!r.done) return;
        mFresh = w.len;
        if (w.len < mW.len && sameMap(w.map, mW.map)) {
            mW = w;
            mVersion++;
            mWordSwapped = true;
        }
    }

    /**
     * @param {object} par
     * @param {object} par.group     the group drawn (as packed for the GPU)
     * @param {number[]} par.refPoint  the world point of the view's centre, null when there is none
     * @param {object} [par.viewDisk]  steps 1a, 1b: the view's disk {c, r} in the world (viewDisk), r
     *        Infinity when it is not a disk (the identity then); without it the centre is folded
     * @param {boolean} par.enabled  false: the identity
     * @param {number} [par.maxSteps]  the steps of this update at most
     * @param {number} [par.budgetMs]  its time at most: a jump far away goes on in the next frames
     * @param {boolean} [par.anchored] phase 2: refPoint is the anchored point already (the
     *        navigator's anchored view, which takes the steps by takeSteps()): folded from
     *        the word without the anchor's map, no refold
     * @returns true when the anchor changed
     */
    function update({ group, refPoint, viewDisk = null, enabled, maxSteps = Infinity, budgetMs = DEFAULT_BUDGET_MS, anchored = false }){
        const v0 = mVersion;
        const deadline = now() + budgetMs;
        setAnchored(anchored);
        if (group !== mGroup) {
            mGroup = group;
            mSides = group ? groupSides(group) : null;
            reset();
        }
        mEnabled = !!(enabled && mSides && mSides.length);
        if (!mEnabled) {
            reset();
            mRef = null;
            mPending = false;
            return mVersion !== v0;
        }
        // no reference point this frame (off the sphere, at infinity): the last one stays
        if (!refPoint || !isFinite(refPoint[0]) || !isFinite(refPoint[1])) {
            return mVersion !== v0;
        }
        if (mAnchored) {
            mRef = [refPoint[0], refPoint[1]];
            const res = foldWord(mW, mRef, deadline, maxSteps);
            if (res.steps) mVersion++;
            mSteps += res.steps;
            mPending = !res.done;
            // the true centre, for the shaders without the view's offset (getUniforms)
            const exact = isMapExact();
            const t = exact ? applyMap(invertMap(mW.map), res.p) : null;
            mRefTrue = t ? [Math.fround(t[0]), Math.fround(t[1])] : null;
            if (!mPending && t && mSteps > REFOLD_MIN + mFresh/4)
                refoldAnchored(t, deadline, maxSteps);
            return mVersion !== v0;
        }
        mRef = [Math.fround(refPoint[0]), Math.fround(refPoint[1])];
        mDisk = (viewDisk && viewDisk.c) ? { c: [viewDisk.c[0], viewDisk.c[1]], r: viewDisk.r }
                                         : { c: [refPoint[0], refPoint[1]], r: 0 };
        if (!(mDisk.r < Infinity) || !isFinite(mDisk.c[0]) || !isFinite(mDisk.c[1])) {
            // the view shows a pole of its chain or the whole plane: no step is every pixel's
            if (mW.len || mPending || mCand) reset();
            mPending = false;
            return mVersion !== v0;
        }
        let D = mapDisk(mW.map, mDisk);
        if (!D) {
            // the anchor sends a point of the view to infinity: start again
            reset();
            D = { c: mDisk.c.slice(), r: mDisk.r };
        }
        const wasPending = mPending;
        if (!wasPending) mChainLen = mW.len;
        // half the budget each while a fold from scratch runs too
        let res = foldDisk(mW, D, mCand ? now() + budgetMs/2 : deadline, maxSteps);
        if (res.lost) {
            reset();
            res = foldDisk(mW, { c: mDisk.c.slice(), r: mDisk.r }, mCand ? now() + budgetMs/2 : deadline, maxSteps);
        }
        if (res.steps) mVersion++;
        mSteps += res.steps;
        // the budget ran out: the next frame goes on
        mPending = !res.done;
        // a new long fold: a fold from scratch of an older centre is of no use to it
        if (mPending && !wasPending) mCand = null;
        // a long fold from a short word (a jump from home) is as good as a fold from scratch
        if (wasPending && !mPending && mChainLen <= RACE_MIN) {
            mFresh = mW.len;
            mSteps = 0;
        }
        const raceIt = mPending && mChainLen > RACE_MIN;
        if (!mCand && (raceIt || (!mPending && mSteps > REFOLD_MIN + mFresh/4))) {
            mCand = { w: makeWord(), D: { c: mDisk.c.slice(), r: mDisk.r }, steps: 0 };
        }
        if (mCand && continueRefold(deadline, maxSteps) && mPending) {
            // the fold from scratch won: on from it to the current view
            const q = mapDisk(mW.map, mDisk);
            if (q) {
                const r = foldDisk(mW, q, Math.max(deadline, now() + 1), maxSteps);
                mSteps += r.steps;
                mPending = !r.done;
            }
        }
        return mVersion !== v0;
    }

    function getUniforms(){
        if (!mEnabled || !mRef) return { uAnchorEnabled: false };
        // phase 2: the shaders' world point is the true one (the navigator's true
        // transform) unless the view's offset is used (getViewUniforms): the word's
        // map at the true centre; the identity when that is out of reach (far out
        // the offset is used anyway)
        const ref = mAnchored ? mRefTrue : mRef;
        if (!ref) return { uAnchorEnabled: true, uAnchorCQ: [mRef[0], mRef[1], mRef[0], mRef[1]], uAnchorAB: [1, 0, 0, 0], uAnchorAnti: false };
        const M = mW.map.m;
        const anti = mW.map.anti;
        const u = anti ? [ref[0], -ref[1]] : ref;
        const D = cAdd(cMul(M[2], u), M[3]);
        if (!(cAbs(D) > 1e-150)) return { uAnchorEnabled: false };
        const q = cDiv(cAdd(cMul(M[0], u), M[1]), D);
        const A = cMul(D, D);
        const B = cMul(D, M[2]);
        if (![q[0], q[1], A[0], A[1], B[0], B[1]].every(isFinite)) return { uAnchorEnabled: false };
        return {
            uAnchorEnabled: true,
            uAnchorCQ:      [ref[0], ref[1], q[0], q[1]],
            uAnchorAB:      [A[0], A[1], B[0], B[1]],
            uAnchorAnti:    anti,
        };
    }

    /**
     * the state of a consumer along the word: state_0 = init, state_k+1 = step(state_k, side)
     * cache: an object the consumer keeps ({} at first); a change of init or step
     * needs a fresh cache. The cache keeps the state at every checkpoint of the
     * word; the word changes at its end only, so the checkpoints whose ids are
     * still the word's are a prefix (found by bisection), and the state is
     * recomputed from the last of them: at most CHECK steps besides the new letters
     */
    function foldState(cache, init, step){
        const w = mW;
        if (cache.group !== mGroup) {
            cache.group = mGroup;
            cache.ck = [];
            cache.states = [init];
        }
        const ck = cache.ck;
        let lo = 0, hi = Math.min(ck.length, w.ck.length);
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (ck[mid] === w.ck[mid]) lo = mid + 1;
            else hi = mid;
        }
        // the letters past the last checkpoint and their states: a small pan costs its own steps only
        const tail = (lo === ck.length && cache.tail) ? cache.tail : { letters: [], states: [] };
        ck.length = lo;
        cache.states.length = lo + 1;
        const start = lo*CHECK;
        let k = 0;
        while (k < tail.letters.length && start + k < w.len && tail.letters[k] === w.data[start + k]) k++;
        tail.letters.length = k;
        tail.states.length = k;
        let s = k ? tail.states[k - 1] : cache.states[lo];
        for (let i = start + k; i < w.len; i++) {
            s = step(s, w.data[i]);
            if ((i + 1) % CHECK === 0) {
                ck.push(w.ck[(i + 1)/CHECK - 1]);
                cache.states.push(s);
                tail.letters.length = 0;
                tail.states.length = 0;
            } else {
                tail.letters.push(w.data[i]);
                tail.states.push(s);
            }
        }
        cache.tail = tail;
        return s;
    }

    /**
     * the colour permutation of the anchor, composed as the shaders do
     * (permutations24.glsl.mjs): null when the anchor is off.
     * cache: an object the consumer keeps ({} at first)
     * sidePerms: the permutations of the sides (sidePermutations), useOrbit as the layer's
     */
    function foldPermutation(cache, sidePerms, useOrbit){
        if (!mEnabled || !mRef || !sidePerms || !sidePerms.length) return null;
        if (cache.sidePerms !== sidePerms || cache.useOrbit !== useOrbit) {
            for (const k of Object.keys(cache)) delete cache[k];
            cache.sidePerms = sidePerms;
            cache.useOrbit = useOrbit;
        }
        const n = sidePerms[0].length;
        const init = Array.from({ length: n }, (_, i) => i);
        // compose_perms(outer, inner)[i] = outer[inner[i]]
        const step = useOrbit
            ? (cur, g) => sidePerms[g] ? cur.map(c => sidePerms[g][c]) : cur      // compose_perms(side, cur)
            : (cur, g) => sidePerms[g] ? sidePerms[g].map(x => cur[x]) : cur;     // compose_perms(cur, side)
        return foldState(cache, init, step);
    }

    /**
     * the class of the anchor's cell in a subgroup's class table
     * (SubgroupDomain.js subgroupDomainTable: next[class][side]), as subFold of the
     * shaders follows it: 0 when the anchor is off
     */
    function foldClass(cache, next){
        if (!mEnabled || !mRef || !next) return 0;
        if (cache.next !== next) {
            for (const k of Object.keys(cache)) delete cache[k];
            cache.next = next;
        }
        return foldState(cache, 0, (cls, g) => (next[cls] && next[cls][g] !== undefined) ? next[cls][g] : cls);
    }

    /**
     * step 1b: the map from the pixel's offset v from the view's centre to its
     * anchored world point, a o (mirrors) o (centre + v), composed in double and
     * centred at v = 0 (u = 0: D = delta, q = beta/delta, A = D^2, B = D gamma)
     * @param {number[]} center   the canvas transform's centre (the world point of v = 0 before the chain)
     * @param {object[]} mirrors  the view's chain after the centre, all reflections (splanes), in the order applied;
     *                            null when the chain is not Moebius maps alone
     * @returns the uniforms uAnchorView, uAnchorViewQ, uAnchorViewAB, uAnchorViewAnti; uAnchorView false when not possible
     */
    function getViewUniforms(center, mirrors){
        if (!mEnabled || !mRef) return { uAnchorView: false };
        // phase 2: the mirrors are the anchored view's already
        const c = centredViewMap(center, mirrors, mAnchored ? null : mW.map);
        if (!c) return { uAnchorView: false };
        return {
            uAnchorView:     true,
            uAnchorViewQ:    c.q,
            uAnchorViewAB:   c.AB,
            uAnchorViewAnti: c.anti,
        };
    }

    /**
     * phase 2: the anchor set to a word of side indices of the group (a document's,
     * [] for the identity); false (and the identity) when a letter is not a side
     */
    function setWord(group, letters = []){
        if (group !== mGroup) {
            mGroup = group;
            mSides = group ? groupSides(group) : null;
        }
        reset();
        mVersion++;
        mPending = false;
        if (!letters.length) return true;
        if (!mSides) return false;
        for (const g of letters) {
            if (!(Number.isInteger(g) && g >= 0 && g < mSides.length)) {
                reset();
                return false;
            }
            wordAppend(mW, g);
        }
        return true;
    }

    /**
     * phase 2: the navigator keeps the anchored view (or no longer); a change starts
     * the word afresh, as update's anchored does
     */
    function setAnchored(on){
        if (!!on === mAnchored) return;
        mAnchored = !!on;
        reset();
        mRefTrue = null;
    }

    // phase 2: the steps the anchor made since the last call, in order (side indices)
    function takeSteps(){
        const s = mStepLog.slice();
        mStepLog.length = 0;
        return s;
    }

    // phase 2: true once after the word was replaced by a shorter one of the same element
    function takeWordSwap(){
        const s = mWordSwapped;
        mWordSwapped = false;
        return s;
    }

    return {
        update,
        setAnchored,
        setWord,
        takeSteps,
        takeWordSwap,
        isMapExact,
        // the reflections of side g's pairing transform, in the order applied
        sideReflections: (g) => mSides[g].refs,
        sideCount:  () => mSides ? mSides.length : 0,
        getGroup:   () => mGroup,
        isAnchored: () => mAnchored,
        getViewUniforms,
        foldPermutation,
        foldClass,
        reset: () => { reset(); },
        getUniforms,
        foldState,
        getWord:    () => Array.from(mW.data.subarray(0, mW.len)),
        getVersion: () => mVersion,
        getMap:     () => mW.map,
        isEnabled:  () => mEnabled && !!mRef,
        isPending:  () => mEnabled && mPending,
        mapPoint:   (p) => applyMap(mW.map, p),
    };
}

// for the tests
export const viewAnchorMath = { reflectionMap, compose, applyMap, sideDist, groupSides };
