/*
  DirichletDomain.js — the Dirichlet domain of a group as an operation on the group,
  ported from the Orb repo's Dirichlet domain builders (DirichletDomainBuilder2 of
  examples2, DirichletDomainCalculator of vb_playbox, 2026-10-26).

  The group acts on the plane by Möbius transformations and, extended, on the upper
  half space H^3. For a base point p = (x, y, w) at height w > 0 above the plane the
  Dirichlet domain of p is the set of points of H^3 closer to p than to any of its
  images g(p). Its sides lie on the bisectors of p and g(p), hemispheres orthogonal to
  the plane; their traces on the plane are circles (or lines), and the trace of the
  domain is a fundamental domain of the group on the plane with these circles as
  sides. The cell across the side of g is the Dirichlet domain of g(p), so the pairing
  transform of that side is g^{-1}. This is what the shaders need: a list of sides and
  a pairing transform per side, as for every other group.

  The sides are named by words in the generators of the group (the letters of
  Group.getGenNames(): a lowercase letter is the generator, the transform that maps
  the fundamental domain onto the cell across that side, an uppercase letter its
  inverse; the letters apply in the order written). The word of a side is the word of
  g; the words are saved in the documents, like the group's own parameters. In the
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
    iGetBisectorU4,
    iGetFactorizationU4,
    iDistanceU4,
    GroupUtils,
    Group,
    SPLANE_SPHERE,
    SPLANE_PLANE,
} from './modules.js';

const MYNAME = 'DirichletDomain';
const DEBUG = false;

const EPS = 1e-12;
// the arc tests: a point this close to a side counts as on it
const ARC_EPS = 1e-9;
const MIN_BASE_W = 1e-6;
// cosh(d) - 1 of an image too close to the base to give a side (selectDirichletSides)
const NEAR_IDENTITY = 1e-6;
export const DEFAULT_FOLD_ITERATIONS = 200;

// ---- words -------------------------------------------------------------------------

/** the words of a space or comma separated string */
export function parseWords(str) {
    return String(str || '').split(/[\s,]+/).filter(w => w.length > 0);
}

export function wordsToString(words) {
    return words.join(' ');
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

function shortWord(word) {
    return word.length > 12 ? `${word.slice(0, 10)}…(${word.length})` : word;
}

/** the generator letters whose transform is its own inverse (reflections, half turns), as a Set */
export function involutionLetters(group) {
    const names = group.getGenNames();
    const trans = group.getTransforms();
    const rtrans = group.getReverseTransforms();
    const out = new Set();
    for (let i = 0; i < names.length; i++) {
        if (sameAction(trans[i], rtrans[i])) out.add(names[i]);
    }
    return out;
}

/**
 * free reduction of a word: a letter next to its inverse cancels; the letters of
 * `involutions` (reflections) are written lowercase and cancel in pairs
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

/** true when every letter of the word names a generator of the group */
export function isValidWord(group, word) {
    const map = group.genMap || {};
    for (const ch of word) if (!isDefined(map[ch])) return false;
    return true;
}

// ---- base point and sides -----------------------------------------------------------

/** the base point of the config {baseX, baseY, baseW} as an iPoint at height baseW */
export function dirichletBase(cfg) {
    let w = cfg.baseW;
    if (!(abs(w) >= MIN_BASE_W)) w = MIN_BASE_W;
    return iPoint([cfg.baseX, cfg.baseY, 0, w]);
}

function footOf(point) {
    return iPoint([point.v[0], point.v[1], 0, 0]);
}

function flipSplane(s) {
    if (s.type === SPLANE_SPHERE) s.v[3] = -s.v[3];
    else s.v = s.v.map(x => -x);
    return s;
}

/**
 * the bisector of the base and its image, oriented with the base on its negative
 * side (inside), as the sides of every fundamental domain; null when the image is
 * the base or the bisector degenerates
 */
export function dirichletBisector(base, point) {
    const d = Math.hypot(point.v[0] - base.v[0], point.v[1] - base.v[1],
        point.v[2] - base.v[2], abs(point.v[3]) - abs(base.v[3]));
    if (!(d > EPS)) return null;
    const s = iGetBisectorU4(base, point);
    if (!s || !s.v || !s.v.every(Number.isFinite)) return null;
    if (s.type !== SPLANE_SPHERE && s.type !== SPLANE_PLANE) return null;
    if (iDistanceU4(s, base) > 0) flipSplane(s);
    return s;
}

/**
 * the side of the Dirichlet domain named by a word: {word, trans, point, side} with
 * the transform of the word, the image of the base under it and the oriented
 * bisector; null for an unknown letter or the identity
 */
export function dirichletSide(group, base, word) {
    if (!isValidWord(group, word)) {
        console.warn(`${MYNAME}: the word '${word}' has a letter that is not a generator (${group.getGenNames().join('')})`);
        return null;
    }
    const trans = group.word2trans(word);
    const point = iTransformU4(trans, base);
    const side = dirichletBisector(base, point);
    if (!side) return null;
    return { word, trans, point, side };
}

/**
 * the Dirichlet domain of the base point with the sides named by the words, as a
 * Group: the bisectors as the sides, the inverses of the words' transforms as the
 * pairing transforms (shortened to at most five reflections). Words that give no
 * side are left out, and so are words whose transform overflows or loses its
 * precision (a long word of a group deformed since the words were chosen: the
 * shortened transform does not act as the word); null when no side is left. The group carries the words
 * of its sides as `dirichletWords` and the base as `dirichletBase`.
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
                rev = iGetFactorizationU4(inv);
                if (!isFiniteTransform(rev) || !closeAction(rev, inv)) rev = null;
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
        used.push(word);
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

function keyOf(point) {
    const v = point.v;
    return `${v[0].toFixed(7)},${v[1].toFixed(7)},${abs(v[3]).toFixed(7)}`;
}

/** cosh of the hyperbolic distance between two points of the upper half space */
export function coshDistance(p, q) {
    const wp = abs(p.v[3]), wq = abs(q.v[3]);
    const d2 = (p.v[0] - q.v[0]) ** 2 + (p.v[1] - q.v[1]) ** 2 + (wp - wq) ** 2;
    return 1 + d2 / (2 * wp * wq);
}

/**
 * the images of the base under the words of at most `depth` generators (breadth
 * first over the generators, which include the inverses of a side pairing), each as
 * {word, point, side}; images lower than minScale * the base height are left out
 * (they lie near the limit set, with tiny bisectors), as are repeated points; the
 * base itself is not listed
 */
export function dirichletImages(group, { base, depth = 2, minScale = 0.01, maxCount = 2000 }) {
    const trans = group.getTransforms();
    const names = group.getGenNames();
    const minW = abs(base.v[3]) * minScale;
    const seen = new Set([keyOf(base)]);
    const out = [];
    let frontier = [{ word: '', point: base }];
    for (let d = 0; d < depth && frontier.length > 0; d++) {
        const next = [];
        for (const it of frontier) {
            for (let k = 0; k < trans.length; k++) {
                const p = iTransformU4(trans[k], it.point);
                if (!(abs(p.v[3]) >= minW)) continue;
                const key = keyOf(p);
                if (seen.has(key)) continue;
                seen.add(key);
                const side = dirichletBisector(base, p);
                if (!side) continue;
                const item = { word: it.word + names[k], point: p, side };
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
 * the fold of the point. Null when a fold fails within maxIterations or the point is
 * in the base's own cell.
 */
export function dirichletCellAt(group, base, xy, maxIterations = DEFAULT_FOLD_ITERATIONS, involutions = null) {
    const fb = group.toFundDomain({ pnt: footOf(base), maxIterations });
    const fx = group.toFundDomain({ pnt: iPoint([xy[0], xy[1], 0, 0]), maxIterations });
    if (!fb.inDomain || !fx.inDomain) return null;
    if (!involutions) involutions = involutionLetters(group);
    const word = reduceWord(fb.word + GroupUtils.getInverseWord(fx.word), involutions);
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
 *   the words nearest image first, their {word, point, side}, the cell (dirichletCell
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
    const minW = abs(base.v[3]) * minScale;
    const involutions = involutionLetters(group);
    const cands = new Map();
    // an image (almost) at the base: the base lies on the axis of an elliptic element,
    // or the group is not discrete; such images give no side and no domain exists
    let nearIdentity = 0;
    // the candidates are closed under inverses: the side of g pairs with the side of g^{-1}
    const add = (item, withInverse = true) => {
        if (!item || !(abs(item.point.v[3]) >= minW)) return false;
        if (coshDistance(base, item.point) < 1 + NEAR_IDENTITY) { nearIdentity++; return false; }
        const key = keyOf(item.point);
        if (cands.has(key)) return false;
        cands.set(key, item);
        if (withInverse) add(dirichletSide(group, base, reduceWord(GroupUtils.getInverseWord(item.word), involutions)), false);
        return true;
    };
    dirichletImages(group, { base, depth, minScale, maxCount }).forEach(it => add(it));
    // the images in the tiling cells next to a candidate's cell (words one or two letters longer)
    const names = group.getGenNames();
    const letters = names.concat(names.map(n => GroupUtils.getInverseWord(n))).filter((l, i, a) => a.indexOf(l) === i);
    const addNeighbours = (item, levels) => {
        let frontier = [item];
        for (let l = 0; l < levels; l++) {
            const next = [];
            for (const it of frontier) {
                if (timeUp()) return;
                for (const ch of letters) {
                    if (cands.size >= maxCount) return;
                    const word = reduceWord(it.word + ch, involutions);
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
            add(dirichletCellAt(group, base, xy, maxIterations, involutions));
        }
    }

    // the sides pair up (g with g^{-1}) when the candidates are complete
    const unpaired = sides => sides.filter(s => {
        const inv = dirichletSide(group, base, reduceWord(GroupUtils.getInverseWord(s.word), involutions));
        return inv && !sides.some(t => keyOf(t.point) === keyOf(inv.point));
    });
    let sides = [];
    let lastKey = '';
    for (let round = 0; round < rounds; round++) {
        const sorted = [...cands.values()].sort((a, b) => coshDistance(base, a.point) - coshDistance(base, b.point));
        const cell = dirichletCell(sorted.map(c => c.side));
        sides = cell.map(e => ({ ...sorted[e.index], arcs: e.arcs }));
        const key = sides.map(s => keyOf(s.point)).join(';');
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
        const sideWords = sides.map(s => s.word).concat(sides.map(s => reduceWord(GroupUtils.getInverseWord(s.word), involutions)));
        for (const w of sideWords) {
            if (timeUp()) break;
            for (const w2 of sideWords) {
                if (cands.size >= maxCount) break;
                add(dirichletSide(group, base, reduceWord(w + w2, involutions)));
            }
        }
        for (const s of sides) {
            if (timeUp()) break;
            addNeighbours(s, 2);
            const t = traceOf(s.side);
            for (const arc of s.arcs) {
                for (const p of arcPoints(t, arc, arcSamples, reach)) {
                    if (cands.size >= maxCount || timeUp()) break;
                    add(dirichletCellAt(group, base, p, maxIterations, involutions));
                    // the point pushed away from the base, across the arc
                    const dx = p[0] - bx, dy = p[1] - by;
                    const len = Math.hypot(dx, dy) || 1;
                    for (const f of [0.1, 0.3, 1]) {
                        const q = [p[0] + f * reach * dx / len, p[1] + f * reach * dy / len];
                        add(dirichletCellAt(group, base, q, maxIterations, involutions));
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
        words: sides.map(s => s.word),
        sides,
        cell,
        candidates: cands.size,
        unpaired: open.length,
        nearIdentity,
        timedOut,
    };
}
