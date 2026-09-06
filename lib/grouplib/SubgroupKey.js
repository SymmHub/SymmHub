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
  reproducible order — the ordinal in a display name like 632/632[3]#2.

  Class key.  An enumeration names a conjugacy class of subgroups by one
  representative, and which conjugate that is depends on the presentation:
  another fundamental domain of G gives other coset tables, and the table of
  a class may stand for another placement of the same subgroup, with another
  key.  subgroupClassKey() is the least key over all conjugates of H (the
  stabilizers of the cosets, from one shared enumeration): a property of the
  class, so the ordinals it gives survive a change of fundamental domain.
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
    coset:  the coset whose stabilizer is keyed, default 0 (H itself); the
            stabilizers of the cosets are the conjugates of H
  }

  return {
    index, latticeIndex, pointIndex,
    hnf: {a, b, d},
    elements: [{ matrix:[m00,m01,m10,m11], offset:[fx, fy] }],   // sorted
    key:  canonical string, sortable and comparable across variants
  }
*/
export function subgroupKey(opt){
  const coset = opt.coset || 0;
  return subgroupKeys({ ...opt, cosetList: [coset] }).get(coset);
}

/**
  the key of the conjugacy class of H: the least key over the conjugates of
  H, the stabilizers of the cosets.  An enumeration names a class by one
  representative, and which one it is depends on the presentation, so the
  key of the representative changes with the fundamental domain while the
  key of the class does not.

  return the subgroupKey() result of the least conjugate, with
    coset:  the coset it is the stabilizer of
    keys:   Map coset -> subgroupKey() result, all conjugates
*/
export function subgroupClassKey(opt){
  const perms = parsePerms(opt.cosets);
  const n = perms[0].length;
  const keys = subgroupKeys({ ...opt, cosets: perms, cosetList: [...Array(n).keys()] });
  let best = null, bestCoset = 0;
  for(const [c, k] of keys){
    if(!best || k.key < best.key){ best = k; bestCoset = c; }
  }
  return { ...best, coset: bestCoset, keys };
}

function parsePerms(cosets){
  if(typeof cosets === 'string')
    return cosets.trim().split(/[\s,]+/).map(w => Array.from(w, ch => ch.charCodeAt(0) - 97));
  return cosets;
}

/**
  the keys of the stabilizers of the listed cosets from one enumeration of
  the short words of G: the enumeration is the expensive part, a key is cheap

  return Map coset -> subgroupKey() result
*/
function subgroupKeys(opt){

  const group = opt.group;
  const frame = opt.frame;
  const perms = parsePerms(opt.cosets);
  const n = perms[0].length;
  const cosetList = opt.cosetList;

  const M = [[frame.t1[0], frame.t2[0]], [frame.t1[1], frame.t2[1]]];
  const detM = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  const toFrameV = v => [ (M[1][1] * v[0] - M[0][1] * v[1]) / detM,
                          (-M[1][0] * v[0] + M[0][0] * v[1]) / detM ];

  // Reflection generated groups need deep words: a translation is a product of
  // reflections in parallel mirrors, which for (2,3,6) first appears around
  // word length 8, and its H-cousins deeper still.  Growth is only quadratic,
  // so deep enumeration stays cheap; the element cap is the real bound.
  const prevKeys = new Map();
  for(let depth = 6; depth <= 30; depth += 2){

    const elems = enumerate(group, perms, depth);
    const gPoint = new Set();                       // linear parts of G
    const per = new Map(cosetList.map(c => [c, { hTrans: [], hParts: new Map() }]));

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

      // offset relative to the frame origin, the same for every conjugate
      const o = frame.origin;
      const tf = toFrameV([t[0] + L[0][0] * o[0] + L[0][1] * o[1] - o[0],
                           t[1] + L[1][0] * o[0] + L[1][1] * o[1] - o[1]]);
      const isTranslation = (mat[0] === 1 && mat[1] === 0 && mat[2] === 0 && mat[3] === 1);

      for(const c of cosetList){
        if(e.p[c] !== c) continue;                  // not in the stabilizer of c
        const acc = per.get(c);
        if(isTranslation){
          const ix = Math.round(tf[0]), iy = Math.round(tf[1]);
          if(Math.abs(tf[0] - ix) > 1e-4 || Math.abs(tf[1] - iy) > 1e-4){ ok = false; break; }
          if(ix !== 0 || iy !== 0) acc.hTrans.push([ix, iy]);
          continue;
        }
        const off = [snapFrac(tf[0]), snapFrac(tf[1])];
        const k = mat.join(',');
        if(!acc.hParts.has(k)) acc.hParts.set(k, { mat, offs: [] });
        acc.hParts.get(k).offs.push(off);
      }
      if(!ok) break;
    }
    if(!ok){ if(opt.debug) console.log(`  depth ${depth}: NON-INTEGER matrix or translation`); continue; }

    const results = new Map();
    let allStable = true;
    for(const c of cosetList){
      const { hTrans, hParts } = per.get(c);
      const hnf = hermite(hTrans);
      if(!hnf || hnf.a === 0 || hnf.d === 0){
        if(opt.debug) console.log(`  depth ${depth}: coset ${c}: lattice rank < 2 (${hTrans.length} vecs)`);
        allStable = false;
        break;
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
      if(!consistent){
        if(opt.debug) console.log(`  depth ${depth}: coset ${c}: INCONSISTENT offsets for a matrix`);
        allStable = false;
        break;
      }

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
        console.log(`  depth ${depth}: coset ${c}: elems ${elems.length}, gPoint ${gPoint.size}, ` +
          `hParts ${elements.length}, hnf ${hnf.a},${hnf.b},${hnf.d} ` +
          `-> latIdx ${latticeIndex} * ptIdx ${pointIndex} vs n ${n}` +
          `${key === prevKeys.get(c) ? ' (stable)' : ''}`);

      // closure: the index relation holds and the key is stable across depths
      if(latticeIndex * pointIndex !== n || key !== prevKeys.get(c)) allStable = false;
      prevKeys.set(c, key);
      results.set(c, { index: n, latticeIndex, pointIndex, hnf, elements, key });
    }
    if(allStable && results.size === cosetList.length) return results;
  }
  throw new Error(`${MYNAME}.subgroupKey: did not stabilize (index ${n})`);
}

// ---------------------------------------------------------------------------
// the wallpaper type of a subgroup, from its key
// ---------------------------------------------------------------------------

const vlen = v => Math.hypot(v[0], v[1]);
const vdot = (u, v) => u[0]*v[0] + u[1]*v[1];

/** Lagrange reduced basis of the lattice spanned by v1 and v2: the shortest vector first */
function reduceBasis(v1, v2){
  let a = v1.slice(), b = v2.slice();
  for(let iter = 0; iter < 60; iter++){
    if(vlen(b) < vlen(a)) [a, b] = [b, a];
    const m = Math.round(vdot(a, b)/vdot(a, a));
    if(m === 0) break;
    b = [b[0] - m*a[0], b[1] - m*a[1]];
  }
  if(vlen(b) < vlen(a)) [a, b] = [b, a];
  return [a, b];
}

/** the generator of the 1D lattice {i p + j q}: the least positive value over small integers */
function gcdReal(p, q, eps){
  let best = 0;
  for(let i = -12; i <= 12; i++){
    for(let j = -12; j <= 12; j++){
      const v = Math.abs(i*p + j*q);
      if(v > eps && (best === 0 || v < best)) best = v;
    }
  }
  return best;
}

/** the length of the shortest lattice vector in the direction u (a unit vector), 0 when none is found */
function shortestAlong(basis, u, eps){
  const [a, b] = basis;
  const ca = a[0]*u[1] - a[1]*u[0], cb = b[0]*u[1] - b[1]*u[0];
  let best = 0;
  for(let i = -12; i <= 12; i++){
    for(let j = -12; j <= 12; j++){
      if((i === 0 && j === 0) || Math.abs(i*ca + j*cb) > eps) continue;
      const l = vlen([i*a[0] + j*b[0], i*a[1] + j*b[1]]);
      if(best === 0 || l < best) best = l;
    }
  }
  return best;
}

function parseFrac(s){
  const [p, q] = String(s).split('/');
  return Number(p)/(q === undefined ? 1 : Number(q));
}

/**
  the wallpaper type of the subgroup with the given key, from the key alone:

  - the point group from the linear parts (the largest rotation order N, the
    reflections): without reflections o, 2222, 333, 442, 632;
  - with reflections, whether the coset of each reflection R holds a mirror
    (some element x -> Rx + t + v, v in T(H), with no translation along the
    axis: the axial part of t is in the 1D lattice of axial parts of T(H))
    and whether it holds a glide with a glide vector outside T(H).  A single
    reflection class: mirrors alone **, glides alone xx, both *x; two
    classes with a half turn: both mirrors alone *2222, both glides alone
    22x, both mixed 2*22, one of each 22*; four classes with a quarter
    turn: mirrors in every class *442, else 4*2; six classes *632;
  - three reflection classes with a third turn: the mirrors run along the
    shortest translations in 3*3 and along the ones sqrt(3) longer in *333.

  A property of the group as a set of isometries, hence of its conjugacy
  class and independent of the presentation; it agrees with the catalogue's
  Reidemeister-Schreier fingerprint on every subgroup of the manifests and
  works at any index.

  frame:  computeFrame(group) of the parent, the one the key was made with
  k:      a subgroupKey() or subgroupClassKey() result

  return the type in sublib's spelling, or null when the data is not understood
*/
export function wallpaperTypeOfKey(frame, k){
  if(!k || !k.hnf || !k.elements) return null;
  const F = [[frame.t1[0], frame.t2[0]], [frame.t1[1], frame.t2[1]]];
  const detF = F[0][0]*F[1][1] - F[0][1]*F[1][0];
  if(Math.abs(detF) < 1.e-12) return null;
  const Finv = [[F[1][1]/detF, -F[0][1]/detF], [-F[1][0]/detF, F[0][0]/detF]];
  const toReal = v => [F[0][0]*v[0] + F[0][1]*v[1], F[1][0]*v[0] + F[1][1]*v[1]];

  // the translation lattice of H, in real coordinates
  const basis = reduceBasis(toReal([k.hnf.a, k.hnf.b]), toReal([0, k.hnf.d]));
  const unit = vlen(basis[0]);
  if(!(unit > 0)) return null;
  const eps = 1.e-6*unit;
  const near = (x, m) => { const r = x - m*Math.round(x/m); return Math.abs(r) < 1.e-6*m; };

  let maxOrder = 1;
  const refl = [];
  for(const e of k.elements){
    const M = [[e.matrix[0], e.matrix[1]], [e.matrix[2], e.matrix[3]]];
    // the linear part in real coordinates: L = F M F^-1
    const FM = [[F[0][0]*M[0][0] + F[0][1]*M[1][0], F[0][0]*M[0][1] + F[0][1]*M[1][1]],
                [F[1][0]*M[0][0] + F[1][1]*M[1][0], F[1][0]*M[0][1] + F[1][1]*M[1][1]]];
    const L = [[FM[0][0]*Finv[0][0] + FM[0][1]*Finv[1][0], FM[0][0]*Finv[0][1] + FM[0][1]*Finv[1][1]],
               [FM[1][0]*Finv[0][0] + FM[1][1]*Finv[1][0], FM[1][0]*Finv[0][1] + FM[1][1]*Finv[1][1]]];
    const det = L[0][0]*L[1][1] - L[0][1]*L[1][0];
    if(det > 0){
      const angle = Math.atan2(L[1][0], L[0][0]);
      if(Math.abs(angle) > 1.e-9) maxOrder = Math.max(maxOrder, Math.round(2*Math.PI/Math.abs(angle)));
    } else {
      // a reflection: axis direction u, the offset's part along it
      const theta = Math.atan2(L[1][0], L[0][0])/2;
      const u = [Math.cos(theta), Math.sin(theta)];
      const parts = String(e.offset).split(',');
      if(parts.length !== 2) return null;
      const t = toReal([parseFrac(parts[0]), parseFrac(parts[1])]);
      const tu = vdot(t, u);
      const lambda = gcdReal(vdot(basis[0], u), vdot(basis[1], u), eps);   // axial parts of T(H)
      const mu = shortestAlong(basis, u, eps);                             // translations along the axis
      if(!lambda || !mu) return null;
      const mirror = near(tu, lambda);
      const glide = !near(tu, mu) || !near(tu + lambda, mu);
      refl.push({ mirror, glide, mu });
    }
  }

  const N = maxOrder;
  if(refl.length === 0) return { 1: 'o', 2: '2222', 3: '333', 4: '442', 6: '632' }[N] || null;
  const mirrorOnly = r => r.mirror && !r.glide;
  const glideOnly  = r => !r.mirror && r.glide;
  const both       = r => r.mirror && r.glide;
  switch(N){
    case 1: {
      if(refl.length !== 1) return null;
      const r = refl[0];
      return mirrorOnly(r) ? '**' : glideOnly(r) ? 'xx' : both(r) ? '*x' : null;
    }
    case 2: {
      if(refl.length !== 2) return null;
      const [r1, r2] = refl;
      if(mirrorOnly(r1) && mirrorOnly(r2)) return '*2222';
      if(glideOnly(r1) && glideOnly(r2)) return '22x';
      if(both(r1) && both(r2)) return '2*22';
      if((mirrorOnly(r1) && glideOnly(r2)) || (glideOnly(r1) && mirrorOnly(r2))) return '22*';
      return null;
    }
    case 3: {
      if(refl.length !== 3 || !refl.every(r => r.mirror)) return null;
      const ratio = refl[0].mu/unit;
      if(Math.abs(ratio - 1) < 1.e-3) return '3*3';
      if(Math.abs(ratio - Math.sqrt(3)) < 1.e-3) return '*333';
      return null;
    }
    case 4:
      if(refl.length !== 4) return null;
      return refl.every(r => r.mirror) ? '*442' : '4*2';
    case 6:
      return refl.length === 6 ? '*632' : null;
    default:
      return null;
  }
}
