import {
  ITransform,
  iPoint,
  isDefined,
} from '../invlib/invlib.js';

const MYNAME = 'SubgroupKey';
const EPS = 1.e-5;

/*
  SubgroupKey.js — a canonical, fundamental-domain independent label for a
  finite index subgroup H of a euclidean plane group G.

  Ids produced by subgroup enumeration are artefacts of enumeration order, and
  coset tables are artefacts of the presentation, which changes with the choice
  of fundamental domain.  What does NOT change is the group itself: a set of
  isometries of the plane.  So the label is built from that set alone.

  Frame.  computeFrame(group) fixes, once per group, a coordinate frame derived
  purely from the isometries: t1, t2 a canonical reduced basis of the
  translation lattice T(G) (shortest vector with angle in [0,PI), then the
  shortest making a positively oriented pair), and an origin at a rotation
  centre of maximal order nearest (0,0) (or (0,0) itself in a group without
  rotations).  All fundamental-domain variants of the same group share this
  frame, because they share the isometries.

  Key.  subgroupKey({group, frame, cosets}) enumerates short words of G,
  tracking for each the isometry and the coset permutation, keeps those lying
  in H (they fix coset 0), and expresses H in the frame:

    - the translation sublattice T(H), as the unique Hermite basis
        (a, b), (0, d)     a > 0, d > 0, 0 <= b < d,   a*d = [T(G):T(H)]
    - for every surviving point group part: its integer matrix in the frame
      and its translation offset, reduced canonically modulo T(H)

  That data determines H exactly, and its string form sorts subgroups into a
  reproducible order — the ordinal in a display name like 632/632[3]#2 —
  which survives a change of fundamental domain.
*/

// ---------------------------------------------------------------------------
// small exact rationals (num/den, den > 0) — offsets are nice fractions and
// float arithmetic must not leak into a canonical string
// ---------------------------------------------------------------------------

function fgcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ [a, b] = [b, a % b]; } return a; }

function frac(num, den = 1){
  if(den < 0){ num = -num; den = -den; }
  const g = fgcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

/** snap a float to p/q with a small denominator; throws if nothing fits */
export function snapFrac(x, maxDen = 96, eps = EPS){
  for(let q = 1; q <= maxDen; q++){
    const p = Math.round(x * q);
    if(Math.abs(x - p / q) < eps) return frac(p, q);
  }
  throw new Error(`${MYNAME}: ${x} is not close to a fraction with denominator <= ${maxDen}`);
}

const fadd = (a, b) => frac(a.num * b.den + b.num * a.den, a.den * b.den);
const fsub = (a, b) => frac(a.num * b.den - b.num * a.den, a.den * b.den);
const fmulInt = (a, k) => frac(a.num * k, a.den);
const ffloor = a => Math.floor(a.num / a.den);
const fstr = a => a.den === 1 ? String(a.num) : a.num + '/' + a.den;

// ---------------------------------------------------------------------------
// affine parts of an ITransform, straight from its action on three points
// ---------------------------------------------------------------------------

function affineOf(itrans){
  const o = itrans.transform(iPoint([0, 0, 0, 0])).v;
  const x = itrans.transform(iPoint([1, 0, 0, 0])).v;
  const y = itrans.transform(iPoint([0, 1, 0, 0])).v;
  return {
    L: [[x[0] - o[0], y[0] - o[0]],
        [x[1] - o[1], y[1] - o[1]]],
    t: [o[0], o[1]],
  };
}

const isIdentityL = L =>
  Math.abs(L[0][0] - 1) < EPS && Math.abs(L[1][1] - 1) < EPS &&
  Math.abs(L[0][1]) < EPS && Math.abs(L[1][0]) < EPS;

// ---------------------------------------------------------------------------
// enumeration of short words: isometry + coset permutation together
// ---------------------------------------------------------------------------

function invertPerm(p){ const q = new Array(p.length); p.forEach((v, i) => q[v] = i); return q; }

function enumerate(group, perms, depth, maxCount = 4000){
  const n = perms[0].length;
  const gens = group.transforms.map((t, i) => ({ t: new ITransform(t.slice(), ''), p: perms[i] }));
  const invs = gens.map(g => ({ t: g.t.getInverse(), p: invertPerm(g.p) }));
  const all = gens.concat(invs);

  const P1 = iPoint([0.12345, 0.06789, 0, 0]);
  const P2 = iPoint([-0.07211, 0.16183, 0, 0]);
  const key = t => {
    const a = t.transform(P1).v, b = t.transform(P2).v;
    return [a[0], a[1], b[0], b[1]].map(v => v.toFixed(5)).join(',');
  };

  const id = new ITransform([], '');
  let frontier = [{ t: id, p: [...Array(n).keys()] }];
  const seen = new Map([[key(id), frontier[0]]]);
  for(let d = 0; d < depth && seen.size < maxCount; d++){
    const next = [];
    for(const cur of frontier){
      for(const g of all){
        const t = cur.t.getCopy().concat(g.t);
        const k = key(t);
        if(!seen.has(k)){
          const e = { t, p: cur.p.map(i => g.p[i]) };
          seen.set(k, e);
          next.push(e);
        }
      }
    }
    frontier = next;
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// the frame
// ---------------------------------------------------------------------------

const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
const len = v => Math.hypot(v[0], v[1]);
// quantize before comparing: raw float differences of exact ties are 1e-16
// noise, and a sort must never let noise decide
const q6 = v => Math.round(v * 1e6);

/** angle in [0, PI): v and -v give the same value */
function halfAngle(v){
  let a = Math.atan2(v[1], v[0]);
  if(a < -EPS) a += Math.PI;
  if(a >= Math.PI - EPS) a -= Math.PI;
  return a;
}

/**
  canonical frame of a plane group, derived from its isometries only

  return { origin:[x,y], t1:[x,y], t2:[x,y], maxOrder }
*/
export function computeFrame(group, opt = {}){

  const perms = group.transforms.map(() => [0]);        // trivial action: all of G
  const elems = enumerate(group, perms, opt.depth || 6, opt.maxCount || 3000);

  const translations = [];
  const rotations = [];
  for(const e of elems){
    const { L, t } = affineOf(e.t);
    if(isIdentityL(L)){
      if(len(t) > EPS) translations.push(t);
    } else if(Math.abs(cross(...L) !== 0)){
      const det = L[0][0] * L[1][1] - L[0][1] * L[1][0];
      if(det > 0){
        const angle = Math.atan2(L[1][0], L[0][0]);
        const order = Math.round(2 * Math.PI / Math.abs(angle));
        // centre: (I - L) c = t
        const a11 = 1 - L[0][0], a12 = -L[0][1], a21 = -L[1][0], a22 = 1 - L[1][1];
        const dd = a11 * a22 - a12 * a21;
        if(Math.abs(dd) > EPS)
          rotations.push({ order, center: [(a22 * t[0] - a12 * t[1]) / dd,
                                           (-a21 * t[0] + a11 * t[1]) / dd] });
      }
    }
  }
  if(translations.length === 0)
    throw new Error(`${MYNAME}.computeFrame: no translations found`);

  // scale free quantities, so that uniformly scaled geometry (a stand-in for a
  // different fundamental domain of the same group) picks the same frame
  const unit = Math.min(...translations.map(len));
  const rlen = v => q6(len(v) / unit);
  const rang = v => q6(halfAngle(v));

  // t1: shortest translation, direction with the smallest angle in [0, PI),
  // pointed into the upper half plane
  const minR = Math.min(...translations.map(rlen));
  const cands = translations.filter(v => rlen(v) === minR)
    .sort((u, v) => rang(u) - rang(v));
  let t1 = cands[0];
  if(t1[1] < -EPS || (Math.abs(t1[1]) < EPS && t1[0] < 0)) t1 = [-t1[0], -t1[1]];

  // t2: shortest with cross(t1, t2) > 0, then smallest angle from t1
  const angFrom = v => q6(Math.atan2(cross(t1, v), v[0] * t1[0] + v[1] * t1[1]));
  const pos = translations.filter(v => cross(t1, v) > EPS)
    .sort((u, v) => (rlen(u) - rlen(v)) || (angFrom(u) - angFrom(v)));
  if(pos.length === 0)
    throw new Error(`${MYNAME}.computeFrame: translation lattice has rank < 2`);
  const t2 = pos[0];

  // origin: rotation centre of maximal order nearest (0,0); else (0,0).
  // compared in lattice units and quantized, again so noise never decides
  let origin = [0, 0], maxOrder = 1;
  if(rotations.length > 0){
    maxOrder = Math.max(...rotations.map(r => r.order));
    const rq = c => [q6(len(c) / unit), q6(c[0] / unit), q6(c[1] / unit)];
    const best = rotations.filter(r => r.order === maxOrder)
      .sort((p, q) => {
        const a = rq(p.center), b = rq(q.center);
        return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
      });
    origin = best[0].center.map(v => Math.abs(v) < EPS * unit ? 0 : v);
  }
  return { origin, t1, t2, maxOrder };
}

// ---------------------------------------------------------------------------
// Hermite basis of the sublattice generated by integer vectors
// ---------------------------------------------------------------------------

/**
  unique basis (a, b), (0, d):  a > 0, d > 0, 0 <= b < d
  (a = smallest positive x occurring, d = generator of the x = 0 line)
*/
export function hermite(vectors){
  let rows = vectors.map(v => [...v]).filter(v => v[0] !== 0 || v[1] !== 0);
  if(rows.length === 0) return null;

  // clear x entries down to a single pivot by the euclidean algorithm
  let pivot = null;
  const online = [];                 // rows with x == 0
  for(let r of rows){
    if(r[0] < 0) r = [-r[0], -r[1]];
    while(r[0] !== 0){
      if(pivot === null){ pivot = r; break; }
      if(pivot[0] > r[0]) [pivot, r] = [r, pivot];
      const q = Math.floor(r[0] / pivot[0]);
      r = [r[0] - q * pivot[0], r[1] - q * pivot[1]];
    }
    if(r[0] === 0 && r[1] !== 0) online.push(r[1]);
  }
  let d = 0;
  for(const y of online) d = fgcd(d, y);
  if(pivot === null){
    if(d === 0) return null;
    return { a: 0, b: 0, d };        // rank 1, degenerate for our use
  }
  if(d === 0) return { a: pivot[0], b: pivot[1], d: 0 };
  const b = ((pivot[1] % d) + d) % d;
  return { a: pivot[0], b, d };
}

// ---------------------------------------------------------------------------
// the key itself
// ---------------------------------------------------------------------------

/**
  canonical key of the subgroup with the given coset permutations

  opt = {
    group:  invlib Group (any fundamental domain variant of G)
    frame:  computeFrame(group) result — MUST be shared across variants
    cosets: coset permutation arrays, or the sublib string
  }

  return {
    index, latticeIndex, pointIndex,
    hnf: {a, b, d},
    elements: [{ matrix:[m00,m01,m10,m11], offset:[fx, fy] }],   // sorted
    key:  canonical string, sortable and comparable across variants
  }
*/
export function subgroupKey(opt){

  const group = opt.group;
  const frame = opt.frame;
  let perms = opt.cosets;
  if(typeof perms === 'string')
    perms = perms.trim().split(/[\s,]+/)
      .map(w => Array.from(w, ch => ch.charCodeAt(0) - 97));
  const n = perms[0].length;

  const M = [[frame.t1[0], frame.t2[0]], [frame.t1[1], frame.t2[1]]];
  const detM = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const toFrameV = v => [ (M[1][1] * v[0] - M[0][1] * v[1]) / detM,
                          (-M[1][0] * v[0] + M[0][0] * v[1]) / detM ];

  // Reflection generated groups need deep words: a translation is a product of
  // reflections in parallel mirrors, which for (2,3,6) first appears around
  // word length 8, and its H-cousins deeper still.  Growth is only quadratic,
  // so deep enumeration stays cheap; the element cap is the real bound.
  let prevKey = null;
  for(let depth = 6; depth <= 30; depth += 2){

    const elems = enumerate(group, perms, depth);
    const gPoint = new Set();                       // linear parts of G
    const hTrans = [];                              // T(H) in frame coords
    const hParts = new Map();                       // matrix -> offset fracs

    let ok = true;
    for(const e of elems){
      const { L, t } = affineOf(e.t);

      // linear part in the frame: integer 2x2
      const Lf = [
        toFrameV([L[0][0] * M[0][0] + L[0][1] * M[1][0],
                  L[1][0] * M[0][0] + L[1][1] * M[1][0]]),
        toFrameV([L[0][0] * M[0][1] + L[0][1] * M[1][1],
                  L[1][0] * M[0][1] + L[1][1] * M[1][1]]),
      ];
      const mat = [Lf[0][0], Lf[1][0], Lf[0][1], Lf[1][1]].map(v => {
        const r = Math.round(v);
        if(Math.abs(v - r) > 1e-4) ok = false;
        return r;
      });
      if(!ok) break;
      gPoint.add(mat.join(','));

      if(e.p[0] !== 0) continue;                    // not in H

      // offset relative to the frame origin
      const o = frame.origin;
      const tf = toFrameV([t[0] + L[0][0] * o[0] + L[0][1] * o[1] - o[0],
                           t[1] + L[1][0] * o[0] + L[1][1] * o[1] - o[1]]);

      if(mat[0] === 1 && mat[1] === 0 && mat[2] === 0 && mat[3] === 1){
        const ix = Math.round(tf[0]), iy = Math.round(tf[1]);
        if(Math.abs(tf[0] - ix) > 1e-4 || Math.abs(tf[1] - iy) > 1e-4){ ok = false; break; }
        if(ix !== 0 || iy !== 0) hTrans.push([ix, iy]);
        continue;
      }
      const off = [snapFrac(tf[0]), snapFrac(tf[1])];
      const k = mat.join(',');
      if(!hParts.has(k)) hParts.set(k, { mat, offs: [] });
      hParts.get(k).offs.push(off);
    }
    if(!ok){ if(opt.debug) console.log(`  depth ${depth}: NON-INTEGER matrix or translation`); continue; }

    const hnf = hermite(hTrans);
    if(!hnf || hnf.a === 0 || hnf.d === 0){
      if(opt.debug) console.log(`  depth ${depth}: lattice rank < 2 (${hTrans.length} vecs)`);
      continue;
    }
    const latticeIndex = hnf.a * hnf.d;

    // reduce an offset into the fundamental cell of the Hermite basis
    const reduce = off => {
      let [x, y] = off;
      const i = ffloor(frac(x.num * 1, x.den * hnf.a));          // floor(x / a)
      x = fsub(x, frac(i * hnf.a));
      y = fsub(y, frac(i * hnf.b));
      const j = ffloor(frac(y.num * 1, y.den * hnf.d));          // floor(y / d)
      y = fsub(y, frac(j * hnf.d));
      return [x, y];
    };

    const elements = [];
    let consistent = true;
    for(const { mat, offs } of hParts.values()){
      const reduced = offs.map(reduce).map(o => o.map(fstr).join(','));
      const uniq = [...new Set(reduced)];
      if(uniq.length !== 1){ consistent = false; break; }
      elements.push({ matrix: mat, offset: uniq[0] });
    }
    if(!consistent){ if(opt.debug) console.log(`  depth ${depth}: INCONSISTENT offsets for a matrix`); continue; }

    elements.sort((p, q) => {
      for(let i = 0; i < 4; i++)
        if(p.matrix[i] !== q.matrix[i]) return p.matrix[i] - q.matrix[i];
      return p.offset < q.offset ? -1 : p.offset > q.offset ? 1 : 0;
    });

    const hPoint = elements.length + 1;             // + identity part
    const pointIndex = gPoint.size / hPoint;
    const key = `k1|n=${n}|L=${hnf.a},${hnf.b},${hnf.d}|P=` +
      elements.map(e => e.matrix.join(',') + ':' + e.offset).join(';');

    if(opt.debug)
      console.log(`  depth ${depth}: elems ${elems.length}, gPoint ${gPoint.size}, ` +
        `hParts ${elements.length}, hnf ${hnf.a},${hnf.b},${hnf.d} ` +
        `-> latIdx ${latticeIndex} * ptIdx ${pointIndex} vs n ${n}` +
        `${key === prevKey ? ' (stable)' : ''}`);

    // closure: the index relation holds and the key is stable across depths
    if(latticeIndex * pointIndex === n && key === prevKey){
      return { index: n, latticeIndex, pointIndex, hnf, elements, key };
    }
    prevKey = key;
  }
  throw new Error(`${MYNAME}.subgroupKey: did not stabilize (index ${n})`);
}
