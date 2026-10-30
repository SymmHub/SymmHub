/*
  DirichletDomain.js — the Dirichlet domain of a group as an operation on the group,
  ported from the Orb repo's Dirichlet domain builders (DirichletDomainBuilder2 of
  examples2, DirichletDomainCalculator of vb_playbox, 2026-10-26).

  The group acts on the plane by Möbius transformations and, extended, on the upper
  half space H^3. For a point p at height w above a point a of the plane the
  Dirichlet domain of p is the set of points of H^3 closer to p than to any of its
  images g(p); its sides lie on the bisectors of p and g(p), hemispheres orthogonal
  to the plane. The base here is the point a on the plane itself, the limit w -> 0
  (the Orb builders took a small w > 0, which blends each side with the side of the
  Ford domain by w^2/2 and loses precision as w gets small). In the H4 vectors of
  invlib (U4toH4) a point of the plane is a null vector N(a), a transform T maps it
  linearly to T N(a) = N(T(a)) / |T'(a)|, and the limit bisector is the sphere of the
  vector N(a) - T N(a): the Apollonius sphere |x - T(a)|^2 = |T'(a)| |x - a|^2, the
  points as far from a horosphere at a as from its image under T. For a group of
  isometries of the euclidean plane, of the hyperbolic plane (upper half plane or
  disk) or of the sphere (stereographic) it is the bisector of a and T(a) of that
  geometry, so the domain is the group's own Dirichlet domain of a. The derivation:
  docs/dirichlet_limit_bisector.md in the workspace. The traces of the sides on the
  plane are circles (or lines), and the trace of the domain is a fundamental domain
  of the group on the plane with these circles as sides. The cell across the side of
  g is the Dirichlet domain of g(a), so the pairing transform of that side is g^{-1}.
  This is what the shaders need: a list of sides and a pairing transform per side,
  as for every other group.

  The sides are named by words in the generators of the group: the side names of
  Group.getGenNames(), each the generator that maps the fundamental domain onto the
  cell across that side, applied in the order written; an inverse is the partner
  side's letter (see the words section below). The word of a side is the word of g;
  the words are saved in the documents in a compact notation with powers and repeated
  blocks (f11, (af)11), like the group's own parameters. In the
  Orb repo the user chose the words by hand, clicking the circles or the cells on the
  screen (the symhublib tool DirichletDomainTool keeps that), and the words can be
  long: a side of the Dirichlet domain of a base point far from the original
  fundamental domain, or of a group with twisted pairings, is given by a group
  element far from the identity in the generators, which a search over words of
  growing length cannot reach. The words of the cells are found by folding points
  into the fundamental domain instead (dirichletCellAt), and the automatic choice of
  the sides (selectDirichletSides) folds sample points around the base point and keeps
  the bisectors that bound the cell (dirichletCell), which for the loxodromic cyclic
  group gives the hexagon of Jørgensen's analysis, the images a^{±1}, a^{±k},
  a^{±(k+1)} with k and k+1 from the best approximations of the rotation angle.

  The Orb presets saved their words with the opposite letter convention (a letter named
  the pairing transform, the inverse of the generator here): an old word reads here as
  the same word reversed; see tools/convert_orb_presets.py in the workspace.
*/

import {
    abs,
    sqrt,
    atan2,
    cos,
    sin,
    PI,
    isDefined,
    iPoint,
    iTransformU4,
    iTransformH4,
    U4toH4,
    H4toU4,
    iGetFactorizationU4,
    iDistanceU4,
    GroupUtils,
    Group,
    SPLANE_SPHERE,
    SPLANE_PLANE,
    isPlanarTransform,
    getMatrixMobius,
    mobiusDistance,
    mobiusToSplanes,
} from './modules.js';

const MYNAME = 'DirichletDomain';
const DEBUG = false;

const EPS = 1e-12;
// the arc tests: a point this close to a side counts as on it
const ARC_EPS = 1e-9;
// the distance (imageOf's dist) of an image too close to the base to give a side (selectDirichletSides)
const NEAR_IDENTITY = 1e-6;
export const DEFAULT_FOLD_ITERATIONS = 200;

// ---- words -------------------------------------------------------------------------
//
// A word is a string of side names of the group (Group.getGenNames()); the letter of
// a side stands for its generator, the transform that maps the fundamental domain
// onto the cell across that side, and the letters apply in the order written. No
// letter is needed for an inverse: the inverse of a side's generator is the generator
// of its partner side (the side it is paired with; a reflection or a half turn is its
// own partner), found from the transforms (wordAlphabet). Earlier words wrote the
// inverse of x as the uppercase X (the names Group gives the reverse transforms, and
// so the words of folds); such a letter, where X is not itself a side name, reads as
// the partner of x (normalizeWord). Some groups name sides with uppercase letters
// (Group_KLMN: a b B A C c); those are ordinary side names.
//
// The documents keep the words in a compact notation (compactWord, expandWord): a
// letter or a block in parentheses followed by a number is repeated that many times,
// f11 = fffffffffff, (af)3 = afafaf, a(f11ca)4 = af11caf11caf11caf11ca. A word without
// digits and parentheses is a plain word, as before.

/** the words of a space or comma separated string */
export function parseWords(str) {
    return String(str || '').split(/[\s,]+/).filter(w => w.length > 0);
}

export function wordsToString(words) {
    return words.join(' ');
}

/**
 * the plain word of a word in the compact notation: a letter or a parenthesized block
 * followed by a number is repeated; null on a syntax error (unbalanced parentheses, a
 * number with nothing before it, a character other than a letter, digit or paren)
 */
export function expandWord(word) {
    const s = String(word);
    let i = 0;
    const block = () => {
        let out = '';
        while (i < s.length && s[i] !== ')') {
            let unit;
            const ch = s[i];
            if (ch === '(') {
                i++;
                unit = block();
                if (unit === null || s[i] !== ')') return null;
                i++;
            } else if (/[A-Za-z]/.test(ch)) {
                unit = ch;
                i++;
            } else {
                return null;
            }
            let num = '';
            while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
            out += num ? unit.repeat(parseInt(num, 10)) : unit;
        }
        return out;
    };
    const out = block();
    return (out === null || i !== s.length) ? null : out;
}

// a run-length encoding longer than this is not searched for repeated blocks (the
// search costs the cube of the number of runs)
const MAX_COMPACT_RUNS = 400;

/**
 * the shortest notation of a plain word with powers and repeated blocks, among the
 * notations that keep each run of one letter whole (f11, (af)11, a(f11ca)4); the
 * expansion of the result is the word
 */
export function compactWord(word) {
    // the runs of one letter
    const runs = [];
    for (const ch of word) {
        const last = runs[runs.length - 1];
        if (last && last.ch === ch) last.n++;
        else runs.push({ ch, n: 1 });
    }
    const runText = r => r.n === 1 ? r.ch : r.ch + r.n;
    const n = runs.length;
    if (n > MAX_COMPACT_RUNS) return runs.map(runText).join('');
    const keys = runs.map(r => r.ch + r.n);
    // best[i][j]: the shortest notation of the runs i .. j-1
    const best = Array.from({ length: n }, () => new Array(n + 1));
    for (let i = 0; i < n; i++) best[i][i + 1] = runText(runs[i]);
    for (let len = 2; len <= n; len++) {
        for (let i = 0; i + len <= n; i++) {
            const j = i + len;
            let b = null;
            for (let k = i + 1; k < j; k++) {
                const c = best[i][k] + best[k][j];
                if (b === null || c.length < b.length) b = c;
            }
            // runs i .. j-1 as a block of p runs repeated len / p times
            for (let p = 1; p <= len / 2; p++) {
                if (len % p) continue;
                let ok = true;
                for (let q = i + p; q < j && ok; q++) ok = keys[q] === keys[q - p];
                // a block of one run repeats as one run only when its letter differs
                // from its neighbours'; equal neighbours were merged into one run
                if (!ok || p === 1) continue;
                const c = '(' + best[i][i + p] + ')' + (len / p);
                if (c.length < b.length) b = c;
            }
            best[i][j] = b;
        }
    }
    return best[0][n];
}

// generic points: two transforms that agree on them are the same Möbius transformation
const TEST_POINTS = [iPoint([0.31, 0.17, 0, 0.23]), iPoint([-0.42, 0.29, 0, 0.11]), iPoint([0.13, -0.57, 0, 0.37])];

/** true when the two transforms (reflection lists) act the same way */
export function sameAction(a, b, eps = 1e-9) {
    if (a === b) return true;
    for (const p of TEST_POINTS) {
        const u = iTransformU4(a, p), v = iTransformU4(b, p);
        for (let k = 0; k < 4; k++) if (!(abs(u.v[k] - v.v[k]) <= eps)) return false;
    }
    return true;
}

const ALPHABETS = new WeakMap();

/**
 * the letters of the group's words: {names, inverse, alias}
 *   names    the side names, Group.getGenNames()
 *   inverse  for each side name the name of its partner side, whose generator is the
 *            inverse of this side's (the name itself for a reflection or half turn);
 *            null when no side acts as the inverse (not a side pairing)
 *   alias    the letters that stand for a side name: each side name for itself, a side
 *            that acts as an earlier one for that one (oN's duplicated S1, KLMN's two
 *            halves C and c of one half turn), and the uppercase X of a lowercase side
 *            name x, when X is not a side name, for the partner of x
 * computed once per group
 */
export function wordAlphabet(group) {
    let al = ALPHABETS.get(group);
    if (al) return al;
    const names = group.getGenNames();
    const t = group.getTransforms();
    const r = group.getReverseTransforms();
    const alias = {};
    for (let i = 0; i < names.length; i++) {
        const j = names.findIndex((_, k) => k < i && sameAction(t[k], t[i]));
        alias[names[i]] = j >= 0 ? names[j] : names[i];
    }
    const inverse = {};
    for (let i = 0; i < names.length; i++) {
        let j = sameAction(t[i], r[i]) ? i : names.findIndex((_, k) => sameAction(t[k], r[i]));
        inverse[names[i]] = j >= 0 ? alias[names[j]] : null;
    }
    for (const x of names) {
        const X = x.toUpperCase();
        if (X !== x && !(X in alias) && inverse[x]) alias[X] = inverse[x];
    }
    al = { names, inverse, alias };
    ALPHABETS.set(group, al);
    return al;
}

/** the inverse of a plain word of side names: the partner letters in the reverse order */
export function inverseWord(group, word) {
    const { inverse } = wordAlphabet(group);
    let out = '';
    for (let i = word.length - 1; i >= 0; i--) {
        const inv = inverse[word[i]];
        if (!inv) return null;
        out += inv;
    }
    return out;
}

/** free reduction of a plain word of side names: a letter next to its partner cancels */
function reduceSideWord(word, inverse) {
    const out = [];
    for (const ch of word) {
        const last = out[out.length - 1];
        if (last !== undefined && inverse[last] === ch) out.pop();
        else out.push(ch);
    }
    return out.join('');
}

/**
 * the plain word of side names of a word, compact or plain, with old inverse letters:
 * expanded, each letter read through the alphabet's aliases, freely reduced; null when
 * the notation is wrong or a letter is not a side name
 */
export function normalizeWord(group, word) {
    const plain = expandWord(word);
    if (plain === null) return null;
    const { alias, inverse } = wordAlphabet(group);
    let out = '';
    for (const ch of plain) {
        const a = alias[ch];
        if (!a) return null;
        out += a;
    }
    return reduceSideWord(out, inverse);
}

/** the product of plain words of side names, freely reduced */
function productWord(group, ...words) {
    return reduceSideWord(words.join(''), wordAlphabet(group).inverse);
}

/**
 * the generator letters whose transform is its own inverse (reflections, half turns),
 * as a Set
 */
export function involutionLetters(group) {
    const { names, inverse } = wordAlphabet(group);
    return new Set(names.filter(n => inverse[n] === n));
}

/**
 * free reduction of a word in the old notation (uppercase letters for inverses), kept
 * for the old callers; the Dirichlet code reduces with normalizeWord
 */
export function reduceWord(word, involutions = new Set()) {
    const out = [];
    for (let ch of word) {
        const lower = ch.toLowerCase();
        if (involutions.has(lower)) ch = lower;
        const last = out[out.length - 1];
        if (last !== undefined) {
            const cancels = involutions.has(lower) ? last === ch
                : (last !== ch && last.toLowerCase() === lower);
            if (cancels) { out.pop(); continue; }
        }
        out.push(ch);
    }
    return out.join('');
}

/** true when the word (compact or plain) reads as a word of the group's side names */
export function isValidWord(group, word) {
    return normalizeWord(group, word) !== null;
}

/** true when every splane of the transform (a reflection list) has finite numbers */
function isFiniteTransform(tr) {
    return tr.every(s => s && Array.isArray(s.v) && s.v.every(Number.isFinite));
}

/**
 * true when the two transforms move the test points to the same places up to a
 * relative error: a long word's transform and its factorization, which rounding
 * separates a little
 */
function closeAction(a, b, rel = 1e-6) {
    for (const p of TEST_POINTS) {
        const u = iTransformU4(a, p), v = iTransformU4(b, p);
        if (!u || !v || !Array.isArray(u.v) || !Array.isArray(v.v)) return false;
        for (let k = 0; k < 4; k++) {
            if (!(abs(u.v[k] - v.v[k]) <= rel * (1 + abs(u.v[k])))) return false;
        }
    }
    return true;
}

// a long planar transform is kept while Number.EPSILON times the growth of its Moebius
// matrix (getMatrixMobius) is below LONG_BOUND: its rounding measured against exact
// rational matrices was 1/50 to 1/2500 of that (words of the deformed par_s2223-4
// groups), which keeps it near the precision the classification of the analyze
// window assumes (MOBIUS_PRECISION, 1e-6); the shortened transform's matrix agrees
// with the long one's to SHORT_PRECISION
const LONG_BOUND = 1e-4;
const SHORT_PRECISION = 1e-6;

/**
 * the transform (a reflection list) shortened to at most five reflections, or null when
 * the short one does not act as the long one. A planar transform is rebuilt from its
 * Moebius matrix, which keeps the precision of the long word (the H4 factorization of a
 * half turn of 300 reflections of the bent KLMN group par_s2223-11 was off by 5e-5,
 * which made products of half turns loxodromic in the analyze window); a long word
 * whose matrix has lost its precision gives none (a deformed group's word of growth
 * 1e15: its H4 factorization passed the test points, which it squeezed to one point).
 * Others are factored by their H4 matrices.
 */
function shortTransform(trans) {
    if (isPlanarTransform(trans)) {
        const { m, reversing, growth } = getMatrixMobius(trans);
        if (!(growth * Number.EPSILON <= LONG_BOUND)) return null;
        const short = mobiusToSplanes(m, reversing);
        return (short && isFiniteTransform(short) && mobiusDistance(short, trans) <= SHORT_PRECISION) ? short : null;
    }
    const short = iGetFactorizationU4(trans);
    return (isFiniteTransform(short) && closeAction(short, trans)) ? short : null;
}

function shortWord(word) {
    return word.length > 12 ? `${word.slice(0, 10)}…(${word.length})` : word;
}

// ---- base point and sides -----------------------------------------------------------

/**
 * the base point of the config {baseX, baseY} as an iPoint on the plane (the base
 * height baseW of the documents before 2026-10-29 is not used: the base is the limit
 * w -> 0)
 */
export function dirichletBase(cfg) {
    return iPoint([cfg.baseX, cfg.baseY, 0, 0]);
}

function footOf(point) {
    return iPoint([point.v[0], point.v[1], 0, 0]);
}

/** the H4 null vector N(a) of the base's point a on the plane */
function baseVector(base) {
    return U4toH4(footOf(base));
}

function flipSplane(s) {
    if (s.type === SPLANE_SPHERE) s.v[3] = -s.v[3];
    else s.v = s.v.map(x => -x);
    return s;
}

/**
 * the image of the base a with its side, from the H4 vector vec = T N(a) of a
 * transform T: {vec, point, scale, dist, side}
 *   point  T(a) on the plane
 *   scale  |T'(a)|, the scale factor of T at a (vec = N(T(a)) / scale), the height of
 *          the image of a point at height w above a is scale * w
 *   dist   |a - T(a)| / sqrt(scale) = sqrt(-2 <N(a), T N(a)>), the distance of the
 *          image from the base in the limit w -> 0 (2 w^2 (cosh d - 1) of the points
 *          at height w above a and T(a) tends to dist^2); the order of the images by
 *          their hyperbolic distance from the base. It is taken from the coordinates:
 *          the inner product has the rounding of the vectors' entries, whose square
 *          root (1e-8) would let the identity pass for an image
 *   side   the limit bisector of a and T(a), the sphere of N(a) - T N(a) (the
 *          Apollonius sphere |x - T(a)|^2 = scale |x - a|^2), oriented with the base
 *          on its negative side (inside), as the sides of every fundamental domain;
 *          null when the image is the base (dist 0: T fixes a)
 * null when T maps a to infinity (a is T's pole) or the vector is not finite.
 */
function imageOf(base, n, vec) {
    if (!vec.every(Number.isFinite)) return null;
    // a reflection keeps the time orientation: vec[4] - vec[3] = 1/scale > 0
    const den = vec[4] - vec[3];
    if (!(den > 0)) return null;
    const point = iPoint([vec[0] / den, vec[1] / den, vec[2] / den, 0]);
    const a = footOf(base);
    const dist = Math.hypot(point.v[0] - a.v[0], point.v[1] - a.v[1], point.v[2] - a.v[2]) * sqrt(den);
    let side = null;
    if (dist > EPS) {
        // <N(a) - T N(a), N(a) - T N(a)> = -2 <N(a), T N(a)> = dist^2
        const s = H4toU4(n.map((x, i) => (x - vec[i]) / dist));
        if (s && s.v && s.v.every(Number.isFinite) && (s.type === SPLANE_SPHERE || s.type === SPLANE_PLANE)) {
            if (iDistanceU4(s, a) > 0) flipSplane(s);
            side = s;
        }
    }
    return { vec, point, scale: 1 / den, dist, side };
}

/**
 * the image of the base under the transform with its side, {vec, point, scale, dist,
 * side} (see imageOf); null when the transform maps the base to infinity
 */
export function dirichletImage(base, trans) {
    const n = baseVector(base);
    return imageOf(base, n, iTransformH4(trans, n));
}

/**
 * the side of the Dirichlet domain named by a word (compact or plain, see the words
 * section): {word, trans, vec, point, scale, dist, side} with the plain word of side
 * names (normalizeWord), its transform and the image of the base under it with the
 * oriented bisector (dirichletImage); null for a word that does not read, or the
 * identity
 */
export function dirichletSide(group, base, word) {
    const plain = normalizeWord(group, word);
    if (plain === null) {
        console.warn(`${MYNAME}: the word '${shortWord(word)}' is not a word of the side names ${group.getGenNames().join('')} (or its notation is wrong)`);
        return null;
    }
    word = plain;
    if (word.length === 0) return null;
    const trans = group.word2trans(word);
    const image = dirichletImage(base, trans);
    if (!image || !image.side) return null;
    return { word, trans, ...image };
}

/**
 * the Dirichlet domain of the base point with the sides named by the words, as a
 * Group: the bisectors as the sides, the inverses of the words' transforms as the
 * pairing transforms (shortened to at most five reflections, shortTransform). Words that give no
 * side are left out, and so are words whose transform overflows or loses its
 * precision (a long word of a group deformed since the words were chosen: the
 * shortened transform does not act as the word); null when no side is left. The group carries the words
 * of its sides, plain (side names, no notation: compactWord gives the stored form), as
 * `dirichletWords` and the base as `dirichletBase`.
 */
export function makeDirichletGroup(group, { base, words }) {
    const sides = [];
    const pairings = [];
    const used = [];
    const lost = [];
    for (const word of words) {
        let s = null, rev = null;
        try {
            s = dirichletSide(group, base, word);
            if (!s) continue;
            const inv = GroupUtils.getInverseTransform(s.trans);
            if (inv.length > 5) {
                rev = shortTransform(inv);
            } else {
                rev = inv.slice();       // without the word: the new group names its generators itself
                if (!isFiniteTransform(rev)) rev = null;
            }
        } catch (e) {
            rev = null;
        }
        if (!rev) { lost.push(word); continue; }
        sides.push(s.side);
        pairings.push(rev);
        used.push(s.word);
    }
    if (lost.length) console.warn(`${MYNAME}.makeDirichletGroup(): ${lost.length} side(s) left out, the transforms of their words overflow or lose their precision: ${lost.map(shortWord).join(' ')}`);
    if (sides.length === 0) return null;
    if (sides.length > 26) console.warn(`${MYNAME}: ${sides.length} sides, the generator names past 'z' are not letters`);
    const dg = new Group({ s: sides, t: pairings });
    dg.dirichletWords = used;
    dg.dirichletBase = base;
    if (DEBUG) console.log(`${MYNAME}.makeDirichletGroup(): ${sides.length} sides`, dg);
    return dg;
}

// ---- the images of the base --------------------------------------------------------

/** the key of an image (imageOf): its point and its scale */
function keyOf(image) {
    const v = image.point.v;
    return `${v[0].toFixed(7)},${v[1].toFixed(7)},${image.scale.toPrecision(7)}`;
}

/**
 * the images of the base under the words of at most `depth` generators (breadth
 * first over the generators, which include the inverses of a side pairing), each as
 * {word, vec, point, scale, dist, side} (dirichletImage); images where the scale
 * factor is below minScale are left out (they lie near the limit set, with tiny
 * bisectors: the image of a point at height w above the base lies lower than
 * minScale * w), as are repeated images; the base itself is not listed
 */
export function dirichletImages(group, { base, depth = 2, minScale = 0.01, maxCount = 2000 }) {
    const trans = group.getTransforms();
    const names = group.getGenNames();
    const n = baseVector(base);
    const seen = new Set([keyOf(imageOf(base, n, n))]);
    const out = [];
    let frontier = [{ word: '', vec: n }];
    for (let d = 0; d < depth && frontier.length > 0; d++) {
        const next = [];
        for (const it of frontier) {
            for (let k = 0; k < trans.length; k++) {
                // the letters apply in the order written: the vector of the word, then the letter
                const image = imageOf(base, n, iTransformH4(trans[k], it.vec));
                if (!image || !(image.scale >= minScale)) continue;
                const key = keyOf(image);
                if (seen.has(key)) continue;
                seen.add(key);
                if (!image.side) continue;
                const item = { word: it.word + names[k], ...image };
                out.push(item);
                next.push(item);
                if (out.length >= maxCount) return out;
            }
        }
        frontier = next;
    }
    return out;
}

/**
 * the side of the Dirichlet domain whose image of the base lies in the cell of the
 * group's tiling that contains the plane point xy: both points are folded into the
 * fundamental domain, the word is the fold of the base followed by the inverse of
 * the fold of the point, in side names. Null when a fold fails within maxIterations or
 * the point is in the base's own cell.
 */
export function dirichletCellAt(group, base, xy, maxIterations = DEFAULT_FOLD_ITERATIONS) {
    const fb = group.toFundDomain({ pnt: footOf(base), maxIterations });
    const fx = group.toFundDomain({ pnt: iPoint([xy[0], xy[1], 0, 0]), maxIterations });
    if (!fb.inDomain || !fx.inDomain) return null;
    // the fold words are written with the reverse transforms' names (the old uppercase
    // inverse letters): read them as side names
    const wb = normalizeWord(group, fb.word), wx = normalizeWord(group, fx.word);
    if (wb === null || wx === null) return null;
    const ix = inverseWord(group, wx);
    if (ix === null) return null;
    const word = productWord(group, wb, ix);
    if (word.length === 0) return null;
    return dirichletSide(group, base, word);
}

// ---- the cell bounded by a set of bisectors ------------------------------------------

/** the trace of a side on the plane: a circle {c, r} or a line {n, d, p0, dir}; null when it misses the plane */
function traceOf(s) {
    const v = s.v;
    if (s.type === SPLANE_SPHERE) {
        const r2 = v[3] * v[3] - v[2] * v[2];
        if (!(r2 > EPS)) return null;
        return { circle: true, c: [v[0], v[1]], r: sqrt(r2) };
    }
    if (s.type === SPLANE_PLANE) {
        const len = Math.hypot(v[0], v[1]);
        if (!(len > EPS)) return null;
        const n = [v[0] / len, v[1] / len];
        const d = v[3] / len;
        return { circle: false, n, d, p0: [n[0] * d, n[1] * d], dir: [-n[1], n[0]] };
    }
    return null;
}

function paramOf(t, p) {
    return t.circle ? atan2(p[1] - t.c[1], p[0] - t.c[0])
        : (p[0] - t.p0[0]) * t.dir[0] + (p[1] - t.p0[1]) * t.dir[1];
}

function pointAt(t, u) {
    return t.circle ? [t.c[0] + t.r * cos(u), t.c[1] + t.r * sin(u)]
        : [t.p0[0] + u * t.dir[0], t.p0[1] + u * t.dir[1]];
}

/** the points where the traces a and b meet */
function intersections(a, b) {
    if (a.circle && b.circle) {
        const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1];
        const d = Math.hypot(dx, dy);
        if (!(d > EPS)) return [];
        if (d > a.r + b.r + ARC_EPS || d < abs(a.r - b.r) - ARC_EPS) return [];
        const al = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
        const h = sqrt(Math.max(0, a.r * a.r - al * al));
        const ux = dx / d, uy = dy / d;
        const mx = a.c[0] + al * ux, my = a.c[1] + al * uy;
        return [[mx - h * uy, my + h * ux], [mx + h * uy, my - h * ux]];
    }
    if (!a.circle && !b.circle) {
        const det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
        if (abs(det) < EPS) return [];
        return [[(a.d * b.n[1] - b.d * a.n[1]) / det, (a.n[0] * b.d - b.n[0] * a.d) / det]];
    }
    const circ = a.circle ? a : b;
    const line = a.circle ? b : a;
    const s = line.n[0] * circ.c[0] + line.n[1] * circ.c[1] - line.d;
    if (abs(s) > circ.r + ARC_EPS) return [];
    const h = sqrt(Math.max(0, circ.r * circ.r - s * s));
    const fx = circ.c[0] - s * line.n[0], fy = circ.c[1] - s * line.n[1];
    return [[fx + h * line.dir[0], fy + h * line.dir[1]], [fx - h * line.dir[0], fy - h * line.dir[1]]];
}

/**
 * the cell bounded by the sides (bisectors oriented with the base inside): for each
 * side that bounds it, its index and the parameter intervals of its free arcs
 * (angles on a circle, counter clockwise from a0 to a1 > a0; the parameter along a
 * line, with ±Infinity for the rays). A side whose trace is cut off entirely by the
 * other sides is not listed.
 *
 * @param {iSplane[]} sides
 * @returns {{index:number, arcs:number[][]}[]}
 */
export function dirichletCell(sides) {
    const n = sides.length;
    const traces = sides.map(traceOf);
    const inside = (p, skip) => {
        const pnt = iPoint([p[0], p[1], 0, 0]);
        const eps = ARC_EPS * (1 + Math.hypot(p[0], p[1]));
        for (let j = 0; j < n; j++) {
            if (j === skip || !traces[j]) continue;
            if (iDistanceU4(sides[j], pnt) > eps) return false;
        }
        return true;
    };
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = traces[i];
        if (!t) continue;
        const params = [];
        for (let j = 0; j < n; j++) {
            if (j === i || !traces[j]) continue;
            for (const p of intersections(t, traces[j])) params.push(paramOf(t, p));
        }
        params.sort((a, b) => a - b);
        const arcs = [];
        if (t.circle) {
            if (params.length === 0) {
                if (inside(pointAt(t, 0), i)) arcs.push([0, 2 * PI]);
            } else {
                for (let k = 0; k < params.length; k++) {
                    const a0 = params[k];
                    let a1 = params[(k + 1) % params.length];
                    if (a1 <= a0) a1 += 2 * PI;
                    if (inside(pointAt(t, (a0 + a1) / 2), i)) arcs.push([a0, a1]);
                }
            }
        } else {
            const L = 1 + (params.length ? Math.max(abs(params[0]), abs(params[params.length - 1])) : 0);
            if (params.length === 0) {
                if (inside(pointAt(t, 0), i)) arcs.push([-Infinity, Infinity]);
            } else {
                if (inside(pointAt(t, params[0] - L), i)) arcs.push([-Infinity, params[0]]);
                for (let k = 0; k + 1 < params.length; k++) {
                    if (inside(pointAt(t, (params[k] + params[k + 1]) / 2), i)) arcs.push([params[k], params[k + 1]]);
                }
                if (inside(pointAt(t, params[params.length - 1] + L), i)) arcs.push([params[params.length - 1], Infinity]);
            }
        }
        // arcs that meet at a crossing with a side that does not cut are one arc;
        // an arc of no length (a corner where several sides meet) is none
        const merged = [];
        for (const a of arcs) {
            const last = merged[merged.length - 1];
            if (last && abs(last[1] - a[0]) < 1e-12) last[1] = a[1];
            else merged.push(a);
        }
        const minLen = t.circle ? 1e-7 : 1e-9 * (1 + Math.hypot(t.p0[0], t.p0[1]));
        const real = merged.filter(a => a[1] - a[0] > minLen);
        if (real.length > 0) out.push({ index: i, arcs: real });
    }
    return out;
}

/** the point of a side's trace at the fraction t of an arc (the arcs of dirichletCell); a ray is cut at `reach` from its end */
export function sideArcPoint(side, arc, t = 0.5, reach = 1) {
    const trace = traceOf(side);
    if (!trace) return null;
    let [u0, u1] = arc;
    if (!trace.circle) {
        if (u0 === -Infinity) u0 = (u1 === Infinity ? 0 : u1) - reach;
        if (u1 === Infinity) u1 = (arc[0] === -Infinity ? 0 : arc[0]) + reach;
    }
    return pointAt(trace, u0 + (u1 - u0) * t);
}

/** the points of a free arc of a side: `count` points along it and, for a line's rays, within `reach` of the end */
function arcPoints(trace, arc, count, reach) {
    let [u0, u1] = arc;
    if (!trace.circle) {
        if (u0 === -Infinity) u0 = (u1 === Infinity ? 0 : u1) - reach;
        if (u1 === Infinity) u1 = (arc[0] === -Infinity ? 0 : arc[0]) + reach;
    }
    const pts = [];
    for (let k = 0; k <= count; k++) pts.push(pointAt(trace, u0 + (u1 - u0) * k / count));
    return pts;
}

/**
 * the words of the sides of the Dirichlet domain of the base, found by geometry: the
 * candidate images of the base are those of the words of at most `depth` generators
 * and those found by folding sample points around the base into the fundamental
 * domain (a grid in a box around the base, then points along the sides of the cell
 * of the candidates so far, pushed outwards); the sides are the candidates whose
 * bisectors bound the cell of all candidates. Rounds repeat until no candidate is
 * added or the sides stop changing.
 *
 * The search can take seconds for a group that is barely discrete (or not at all):
 * its words grow long and the candidates many. `deadline` (a Date.now() time) ends
 * it early: no more candidates are looked for, and the sides are those of the
 * candidates found so far (`timedOut` is then true). DirichletSearch.js runs the
 * search in a worker with such a deadline.
 *
 * @returns {{words:string[], sides:object[], cell:object[], candidates:number,
 *            unpaired:number, nearIdentity:number, timedOut:boolean}}
 *   the words nearest image first (compact), their {word (plain), point, side}, the cell (dirichletCell
 *   of the sides, with the free arcs) and the number of candidates examined
 */
export function selectDirichletSides(group, {
    base, depth = 2, minScale = 0.01, maxCount = 2000,
    maxIterations = DEFAULT_FOLD_ITERATIONS, gridSize = 40, rounds = 12, arcSamples = 24,
    deadline = Infinity, log = null,
}) {
    let timedOut = false;
    const timeUp = () => {
        if (!timedOut && Date.now() > deadline) timedOut = true;
        return timedOut;
    };
    const inv = w => inverseWord(group, w);
    const cands = new Map();
    // an image (almost) at the base: the base lies on the axis of an elliptic element,
    // or the group is not discrete; such images give no side and no domain exists
    let nearIdentity = 0;
    // the candidates are closed under inverses: the side of g pairs with the side of g^{-1}
    const add = (item, withInverse = true) => {
        if (!item || !(item.scale >= minScale)) return false;
        if (item.dist < NEAR_IDENTITY) { nearIdentity++; return false; }
        const key = keyOf(item);
        if (cands.has(key)) return false;
        cands.set(key, item);
        const iw = withInverse ? inv(item.word) : null;
        if (iw) add(dirichletSide(group, base, iw), false);
        return true;
    };
    dirichletImages(group, { base, depth, minScale, maxCount }).forEach(it => add(it));
    // the images in the tiling cells next to a candidate's cell (words one or two letters longer)
    // the side names stand for the inverses too: the partner side's letter
    const letters = [...new Set(Object.values(wordAlphabet(group).alias).filter(l => wordAlphabet(group).names.includes(l)))];
    const addNeighbours = (item, levels) => {
        let frontier = [item];
        for (let l = 0; l < levels; l++) {
            const next = [];
            for (const it of frontier) {
                if (timeUp()) return;
                for (const ch of letters) {
                    if (cands.size >= maxCount) return;
                    const word = productWord(group, it.word, ch);
                    if (word.length === 0) continue;
                    const side = dirichletSide(group, base, word);
                    if (add(side)) next.push(side);
                }
            }
            frontier = next;
        }
    };

    const bx = base.v[0], by = base.v[1];
    const nearestDist = () => {
        let d = Infinity;
        for (const c of cands.values()) d = Math.min(d, Math.hypot(c.point.v[0] - bx, c.point.v[1] - by));
        return Number.isFinite(d) && d > 0 ? d : 1;
    };
    // the grid of sample points in a box around the base
    const half = 2 * nearestDist();
    for (let i = 0; i <= gridSize && !timeUp(); i++) {
        for (let j = 0; j <= gridSize; j++) {
            if (cands.size >= maxCount || timeUp()) break;
            const xy = [bx - half + 2 * half * i / gridSize, by - half + 2 * half * j / gridSize];
            add(dirichletCellAt(group, base, xy, maxIterations));
        }
    }

    // the sides pair up (g with g^{-1}) when the candidates are complete
    const unpaired = sides => sides.filter(s => {
        const iw = inv(s.word);
        const is = iw ? dirichletSide(group, base, iw) : null;
        return is && !sides.some(t => keyOf(t) === keyOf(is));
    });
    let sides = [];
    let lastKey = '';
    for (let round = 0; round < rounds; round++) {
        const sorted = [...cands.values()].sort((a, b) => a.dist - b.dist);
        const cell = dirichletCell(sorted.map(c => c.side));
        sides = cell.map(e => ({ ...sorted[e.index], arcs: e.arcs }));
        const key = sides.map(keyOf).join(';');
        const open = unpaired(sides).length;
        if (log) log(`round ${round}: ${cands.size} candidates, ${sides.length} sides, ${open} without a partner`);
        if (open === 0 && key === lastKey) break;
        // out of time: the sides of the candidates found so far
        if (timeUp()) break;
        // a missed image lies near a side: the Dirichlet cells across two sides (the
        // products of their words and inverses, as in every Dirichlet domain
        // algorithm), the tiling cells next to the side's image, or the cells of the
        // points along the side's free arcs and beyond them, where that image would
        // be nearer than the base
        const before = cands.size;
        const reach = 2 * nearestDist();
        const sideWords = sides.map(s => s.word).concat(sides.map(s => inv(s.word)).filter(w => w));
        for (const w of sideWords) {
            if (timeUp()) break;
            for (const w2 of sideWords) {
                if (cands.size >= maxCount) break;
                add(dirichletSide(group, base, productWord(group, w, w2)));
            }
        }
        for (const s of sides) {
            if (timeUp()) break;
            addNeighbours(s, 2);
            const t = traceOf(s.side);
            for (const arc of s.arcs) {
                for (const p of arcPoints(t, arc, arcSamples, reach)) {
                    if (cands.size >= maxCount || timeUp()) break;
                    add(dirichletCellAt(group, base, p, maxIterations));
                    // the point pushed away from the base, across the arc
                    const dx = p[0] - bx, dy = p[1] - by;
                    const len = Math.hypot(dx, dy) || 1;
                    for (const f of [0.1, 0.3, 1]) {
                        const q = [p[0] + f * reach * dx / len, p[1] + f * reach * dy / len];
                        add(dirichletCellAt(group, base, q, maxIterations));
                    }
                }
            }
        }
        if (cands.size === before && open === 0) break;
        lastKey = key;
    }
    const cell = dirichletCell(sides.map(s => s.side));
    // the sides of a Dirichlet domain come in pairs (the side of g with the side of g^{-1})
    const open = unpaired(sides);
    if (timedOut) {
        console.warn(`${MYNAME}.selectDirichletSides(): the time limit ended the search after ${cands.size} candidates; the ${sides.length} sides are a best effort`);
    } else if (nearIdentity > 0) {
        console.warn(`${MYNAME}.selectDirichletSides(): ${nearIdentity} images of the base lie at the base: the group is not discrete, or the base lies on the axis of a rotation; the sides are a best effort`);
    } else if (open.length > 0) {
        console.warn(`${MYNAME}.selectDirichletSides(): ${open.length} of ${sides.length} sides have no partner side; more candidates are needed (depth, minScale, iterations, rounds)`);
    }
    return {
        words: sides.map(s => compactWord(s.word)),
        sides,
        cell,
        candidates: cands.size,
        unpaired: open.length,
        nearIdentity,
        timedOut,
    };
}
