/*
  MobiusMatrix.js — transforms of the plane z = 0 as Moebius 2x2 complex matrices

  A group whose splanes are all orthogonal to the plane z = 0 (spheres centred on it,
  vertical planes) acts on the complex plane by Moebius transformations z -> m(z) and
  anti-Moebius transformations z -> m(conj z). The 2x2 matrix m keeps the precision
  which the 5x5 H4 matrix loses (its entries are quadratic in those of m), and the
  trace of m classifies the transform without eigenvalues near 1.

  Moved from symhublib/TransformUtils.js (2026-10-30), where the transforms of planar
  groups are classified by them, so that grouplib shortens long planar transforms by
  their matrices (mobiusToSplanes): the H4 factorization (iGetFactorizationU4) of the
  word of a few hundred reflections of a Dirichlet side lost the half turn's trace to
  5e-5.
*/

import {
  abs,
  sqrt,
  cos,
  sin,
  SPLANE_SPHERE,
  SPLANE_PLANE,
  ITransform,
  iPlane,
  iSphere,
} from './modules.js';

// complex numbers as [re, im]
const cadd  = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub  = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul  = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cdiv  = (a, b) => {
  const d = b[0]*b[0] + b[1]*b[1];
  return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d];
};
const cconj = a => [a[0], -a[1]];
const cneg  = a => [-a[0], -a[1]];
const cabs  = a => Math.hypot(a[0], a[1]);
function csqrt(a){
  const r = cabs(a);
  const re = Math.sqrt(Math.max(0, (r + a[0])/2));
  const im = (a[1] < 0 ? -1 : 1)*Math.sqrt(Math.max(0, (r - a[0])/2));
  return [re, im];
}
// principal acosh(z) = log(z + sqrt(z - 1) sqrt(z + 1)), its real part is >= 0
function cacosh(z){
  const w = cadd(z, cmul(csqrt([z[0] - 1, z[1]]), csqrt([z[0] + 1, z[1]])));
  return [Math.log(cabs(w)), Math.atan2(w[1], w[0])];
}

// 2x2 complex matrices [[a, b], [c, d]]
const mmul = (A, B) => [[cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
                        [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))]];
const mconj  = A => A.map(row => row.map(cconj));
const mdet   = A => csub(cmul(A[0][0], A[1][1]), cmul(A[0][1], A[1][0]));
const mnorm2 = A => A[0].concat(A[1]).reduce((s, z) => s + z[0]*z[0] + z[1]*z[1], 0);
// the matrix scaled to det = 1 (up to sign)
const munit  = A => { const s = csqrt(mdet(A)); return A.map(row => row.map(z => cdiv(z, s))); };

const PLANAR_EPS = 1.e-12;

function isPlanarSplane(s){
  const v = s.v;
  switch(s.type){
  case SPLANE_SPHERE: return abs(v[2]) <= PLANAR_EPS*(abs(v[0]) + abs(v[1]) + abs(v[3]));
  case SPLANE_PLANE:  return abs(v[2]) <= PLANAR_EPS*(abs(v[0]) + abs(v[1]));
  default: return false;
  }
}

/**
  true when the transform (ITransform or array of splanes) maps the plane z = 0 to itself
  by its reflections: spheres centred on the plane and planes orthogonal to it
*/
export function isPlanarTransform(trans){
  const ref = (trans instanceof ITransform) ? trans.getRef() : trans;
  return ref.every(isPlanarSplane);
}

/**
  the matrix m of the reflection z -> m(conj z) in a planar splane
*/
function reflectionMobius(s){
  const v = s.v;
  if(s.type === SPLANE_SPHERE){
    // z -> c + r^2/(conj z - conj c)
    const c = [v[0], v[1]];
    return [[c, [v[3]*v[3] - (c[0]*c[0] + c[1]*c[1]), 0]],
            [[1, 0], cneg(cconj(c))]];
  }
  // the plane n.x = d with the unit normal n: z -> -n^2 conj z + 2 d n
  const len = Math.hypot(v[0], v[1]);
  const n = [v[0]/len, v[1]/len];
  return [[cneg(cmul(n, n)), [2*v[3]*n[0], 2*v[3]*n[1]]],
          [[0, 0], [1, 0]]];
}

/**
  the Moebius matrix of a planar transform (isPlanarTransform), given as ITransform or array of splanes

  return {
    m:          2x2 complex matrix, scaled to |m| = 1
    reversing:  false: the transform is z -> m(z), true: it is z -> m(conj z)
    growth:     the largest size |p|^2/|det p| of the transforms p of the even prefixes
                of the reflections: the factor by which the errors of the splanes
                grow in m (2 for the identity)
  }
*/
export function getMatrixMobius(trans){
  const ref = (trans instanceof ITransform) ? trans.getRef() : trans;
  let m = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
  let growth = 2;
  for(let i = 0; i < ref.length; i++){
    // the reflection after the transform: R(conj(m(z)))
    m = mmul(reflectionMobius(ref[i]), mconj(m));
    // m matters up to a factor: keep its entries near 1
    const s = Math.sqrt(mnorm2(m));
    m = m.map(row => row.map(z => [z[0]/s, z[1]/s]));
    if(i % 2 == 1) growth = Math.max(growth, 1/cabs(mdet(m)));
  }
  return { m, reversing: (ref.length % 2 == 1), growth };
}

//
//  the relative distance of two matrices, both scaled to det = 1, up to sign
//
function matrixDistance(A, B){
  const a = munit(A), b = munit(B);
  const size = Math.sqrt(mnorm2(a));
  return Math.min(...[1, -1].map(sg => Math.sqrt(mnorm2(a.map((row, i) => row.map((z, j) => [z[0] - sg*b[i][j][0], z[1] - sg*b[i][j][1]])))))) / size;
}

/**
  the relative distance of the Moebius matrices of two planar transforms (ITransform or
  array of splanes), scaled to det = 1; Infinity when one reverses the orientation and
  the other does not
*/
export function mobiusDistance(t1, t2){
  const a = getMatrixMobius(t1), b = getMatrixMobius(t2);
  if(a.reversing !== b.reversing) return Infinity;
  return matrixDistance(a.m, b.m);
}

//
//  the reflections of the translation z -> z + tau e (e a unit vector): two lines
//  with the normal e, symmetric about the origin
//
function translationSplanes(tau, e){
  if(tau === 0) return [];
  return [iPlane([e[0], e[1], 0, -tau/4]), iPlane([e[0], e[1], 0, tau/4])];
}

//
//  the reflections of z -> m(z) = (a z + b)/(c z + d), ad - bc = 1, c != 0: the inversion
//  in the isometric circle |c z + d| = 1, then the euclidean reflection or glide
//  reflection w -> u conj(w) + t, u = -conj(c)/c, t = (a - conj(d))/c: the line with
//  the unit normal n, -n^2 = u, at the distance (t.n)/2 from the origin, then the
//  translation along it by t.(i n)
//
function isometricSplanes(a, c, d){
  const p = cneg(cdiv(d, c));
  const u = cneg(cdiv(cconj(c), c));
  const t = cdiv(csub(a, cconj(d)), c);
  const n = csqrt(cneg(u));
  const e = [-n[1], n[0]];
  return [iSphere([p[0], p[1], 0, 1/cabs(c)]),
          iPlane([n[0], n[1], 0, (t[0]*n[0] + t[1]*n[1])/2])]
          .concat(translationSplanes(t[0]*e[0] + t[1]*e[1], e));
}

//
//  the reflections of the similarity z -> k z + s (k = a/d, s = b/d): a translation, or
//  the scaling by |k| (two circles about the fixed point q, of radii about its distance
//  from the origin, which keeps the rounding of a far q small) and the rotation by
//  arg k about q (two lines through q)
//
function affineSplanes(a, b, d){
  const k = cdiv(a, d), s = cdiv(b, d);
  const k1 = csub([1, 0], k);
  if(k1[0] === 0 && k1[1] === 0){
    const len = cabs(s);
    return (len === 0) ? [] : translationSplanes(len, [s[0]/len, s[1]/len]);
  }
  const q = cdiv(s, k1);
  const rho = cabs(k), half = Math.atan2(k[1], k[0])/2;
  const out = [];
  if(rho !== 1){
    const r = Math.max(1, cabs(q));
    out.push(iSphere([q[0], q[1], 0, r]), iSphere([q[0], q[1], 0, r*sqrt(rho)]));
  }
  if(half !== 0){
    out.push(iPlane([1, 0, 0, q[0]]), iPlane([cos(half), sin(half), 0, cos(half)*q[0] + sin(half)*q[1]]));
  }
  return out;
}

/**
  the reflections (at most 4, 5 for a reversing transform) of the planar transform
  z -> m(z), or z -> m(conj z) when reversing (getMatrixMobius), applied in their order
  (the first one first). They keep the precision of the matrix: of the inversion in the
  isometric circle with a euclidean isometry and of the similarity (for c = 0 or near
  it) the one closer to m is taken. Near a similarity, for a small c of the matrix
  scaled to det = 1, the circle of radius 1/|c| rounds to about Number.EPSILON/|c| and
  the similarity leaves out c: the relative precision is about the smaller of the two,
  1.5e-8 at worst (|c| near 1e-8).
*/
export function mobiusToSplanes(m, reversing = false){
  const u = munit(m);
  const [[a, b], [c, d]] = u;
  const candidates = [];
  if(cabs(c) > 0) candidates.push(isometricSplanes(a, c, d));
  if(cabs(d) > 0) candidates.push(affineSplanes(a, b, d));
  let best = null, bestDist = Infinity;
  for(const ref of candidates){
    if(!ref.every(s => s.v.every(Number.isFinite))) continue;
    const dist = (ref.length === 0) ? matrixDistance(u, [[[1, 0], [0, 0]], [[0, 0], [1, 0]]]) : matrixDistance(u, getMatrixMobius(ref).m);
    if(dist < bestDist){ best = ref; bestDist = dist; }
  }
  if(!best) return null;
  return (reversing) ? [iPlane([0, 1, 0, 0])].concat(best) : best;
}

// relative precision of the splanes of a planar transform
export const MOBIUS_PRECISION = 1.e-6;

/**
  classify a planar transform (isPlanarTransform) by the trace of its Moebius matrix

  precision: the relative precision of the splanes. The errors of the splanes grow
             in the entries of the matrix up to precision*growth (getMatrixMobius);
             the trace is far less sensitive, the errors of the conjugating factors
             of a word cancel in it: the trace is trusted to precision*sqrt(growth)
             (the error of the trace stays below 5e-7*sqrt(growth) for the 10000
             words of the Dirichlet group of the symdraw preset par_s2223-6)

  return {
    type:     one of the TRANSFORM_TYPES of symhublib/TransformUtils.js, or 'unknown'
              for a matrix which overflows
    period:   hyperbolic(+), loxodromic(+): the translation length l,
              hyperbolic(-): the translation length of the glide reflection
    rotation: elliptical(+), half turn, loxodromic(+): the rotation angle in units of PI,
              elliptical(-): the rotation of the rotary reflection
              (loxodromic: the complex translation length is l + i PI rotation)
    error:    estimated error of period and of PI*rotation
  }
*/
export function classifyMobiusU4(trans, precision = MOBIUS_PRECISION){

  const {m, reversing, growth} = getMatrixMobius(trans);
  // a reversing z -> m(conj z) is classified by its square m conj(m)
  const a = (reversing) ? mmul(m, mconj(m)) : m;
  const det = mdet(a);
  const size = mnorm2(a)/cabs(det);
  if(!Number.isFinite(size) || !Number.isFinite(growth))
    return { type: 'unknown' };
  const g = Math.max(growth, size);
  const errTrace = precision*Math.sqrt(g);
  const errMatrix = precision*g;
  const sd = csqrt(det);
  // the trace of the matrix normalized to det = 1
  let tr = cdiv(cadd(a[0][0], a[1][1]), sd);
  // the distance of the normalized matrix from a multiple of the identity
  const offd = (cabs(a[0][1]) + cabs(a[1][0]) + cabs(csub(a[0][0], a[1][1])))/cabs(sd);
  // the error of L from the error of tr = 2 cosh(L/2): dL = dtr/|sinh(L/2)|
  const errLength = (t) => errTrace/Math.sqrt(Math.max(errTrace, cabs(csub(cmul(t, t), [4, 0]))/4));

  if(reversing){
    // the trace of m conj(m) is real, 2 for a reflection and a parabolic glide,
    // 2 cosh(s) for a glide reflection by s, 2 cos(t) for a rotary reflection by t
    const t = tr[0];
    const error = errLength([t, 0])/2;
    if(abs(t - 2) <= errTrace)
      return { type: (offd <= errMatrix) ? 'reflection' : 'parabolic(-)' };
    if(t > 2)
      return { type: 'hyperbolic(-)', period: Math.acosh(t/2), error };
    return { type: 'elliptical(-)', rotation: Math.acos(Math.max(-1, t/2))/Math.PI, error };
  }

  // the matrix is defined up to sign
  if(tr[0] < 0) tr = cneg(tr);
  const error = errLength(tr);
  if(cabs(csub(tr, [2, 0])) <= errTrace)
    return { type: (offd <= errMatrix) ? 'identity' : 'parabolic(+)' };
  if(abs(tr[1]) <= errTrace){
    if(tr[0] <= errTrace)
      return { type: 'half turn', rotation: 1, error };
    if(tr[0] < 2)
      return { type: 'elliptical(+)', rotation: 2*Math.acos(tr[0]/2)/Math.PI, error };
    return { type: 'hyperbolic(+)', period: 2*Math.acosh(tr[0]/2), error };
  }
  // the complex translation length L: tr = 2 cosh(L/2)
  const L = cacosh([tr[0]/2, tr[1]/2]);
  return { type: 'loxodromic(+)', period: 2*L[0], rotation: 2*L[1]/Math.PI, error };

} // function classifyMobiusU4
