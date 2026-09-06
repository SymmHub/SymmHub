import { ITransform, iPoint, isDefined, DataPacking } from '../invlib/invlib.js';
import { iSplane, iPlane, iSphere, SPLANE_PLANE, SPLANE_SPHERE, SPLANE_NONE } from '../invlib/ISplane.js';
import { U4 } from '../invlib/U4.js';
import { sameTransform } from './SubgroupDomain.js';

const MYNAME = 'GeneratorElements';
const DEBUG = false;
const EPS = 1.e-7;

/*
  GeneratorElements.js — the symmetry elements of the generators of a group:
  what the generators overlay draws besides the sides they pair.

  A pairing transform of a fundamental domain is an isometry, and an isometry
  of the plane, the sphere or the hyperbolic plane has a symmetry element:

    rotation      a cone point, the fixed point (two antipodal ones on the sphere)
    reflection    a mirror, the fixed line or circle: the side itself
    glide         an axis, the invariant line or geodesic, and a glide vector
    translation   a vector; a hyperbolic translation also has an axis

  classifyIsometry() classifies any ITransform through the Moebius
  transformation it induces on the complex plane (all three geometries are
  models in the plane: the Euclidean plane, the Poincare disk and the
  stereographic sphere), fitted from the images of three points: the
  fixed points of z -> (az + b)/(cz + d) and the trace decide, and an
  orientation reversing isometry is looked at through its square.

  generatorElements() and subgroupGeneratorElements() give the elements of
  the pairing generators of a group G and of a subgroup H (the pairings of
  the domain of SubgroupDomain.js), one per inverse pair of sides, in the
  world coordinates of the group they get.  packGeneratorElements() packs
  them into a data texture for lib/shaders/overlay_generators.glsl.mjs.
*/

// ---------------------------------------------------------------------------
// complex numbers as [re, im]
// ---------------------------------------------------------------------------

const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cdiv = (a, b) => {
  const d = b[0]*b[0] + b[1]*b[1];
  return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d];
};
const cabs  = a => Math.hypot(a[0], a[1]);
const carg  = a => Math.atan2(a[1], a[0]);
const cconj = a => [a[0], -a[1]];
const cneg  = a => [-a[0], -a[1]];
const csqrt = a => {
  const r = cabs(a);
  const re = Math.sqrt(Math.max(0, (r + a[0])/2));
  const im = (a[1] < 0 ? -1 : 1)*Math.sqrt(Math.max(0, (r - a[0])/2));
  return [re, im];
};
const ONE = [1, 0], ZERO = [0, 0];

/** the point [x, y] mapped by the transform */
export function applyToPoint(itrans, p){
  const q = itrans.transform(iPoint([p[0], p[1], 0, 0])).v;
  return [q[0], q[1]];
}

// ---------------------------------------------------------------------------
// Moebius transformations as 2x2 complex matrices [[a, b], [c, d]]
// ---------------------------------------------------------------------------

/** the matrix which maps z1, z2, z3 to 0, 1, infinity */
function toStandard(z){
  const [z1, z2, z3] = z;
  return [[csub(z2, z3), cneg(cmul(z1, csub(z2, z3)))],
          [csub(z2, z1), cneg(cmul(z3, csub(z2, z1)))]];
}

function matMul(A, B){
  return [[cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
          [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))]];
}

/** the Moebius transformation with M(z_k) = w_k, k = 1, 2, 3 */
function mobiusThrough(z, w){
  const A = toStandard(z), B = toStandard(w);
  const Badj = [[B[1][1], cneg(B[0][1])], [cneg(B[1][0]), B[0][0]]];
  return matMul(Badj, A);
}

/** scale the matrix to determinant 1 */
function normalize(M){
  const det = csub(cmul(M[0][0], M[1][1]), cmul(M[0][1], M[1][0]));
  const s = csqrt(det);
  return [[cdiv(M[0][0], s), cdiv(M[0][1], s)], [cdiv(M[1][0], s), cdiv(M[1][1], s)]];
}

function mobiusApply(M, z){
  return cdiv(cadd(cmul(M[0][0], z), M[0][1]), cadd(cmul(M[1][0], z), M[1][1]));
}

/** the order of a rotation by the angle, 0 when it is not a finite order (up to 60) */
export function rotationOrder(angle){
  const n = 2*Math.PI/Math.abs(angle);
  const r = Math.round(n);
  return (r >= 1 && r <= 60 && Math.abs(n - r) < 1.e-4*r) ? r : 0;
}

/** the geodesic of the Poincare disk through two points of its boundary circle */
export function geodesicThrough(p1, p2){
  const det = p1[0]*p2[1] - p1[1]*p2[0];
  if(Math.abs(det) < 1.e-9){
    // antipodal points: a diameter
    return iPlane([-p1[1], p1[0], 0, 0]);
  }
  // the centre c has p1.c = 1 and p2.c = 1: the circle is orthogonal to the unit circle
  const cx = ( p2[1] - p1[1])/det;
  const cy = (-p2[0] + p1[0])/det;
  const r = Math.sqrt(Math.max(0, cx*cx + cy*cy - 1));
  return iSphere([cx, cy, 0, r]);
}

/** a line through the point p with the direction d */
function lineThrough(p, d){
  const len = Math.hypot(d[0], d[1]);
  const n = [-d[1]/len, d[0]/len];
  return iPlane([n[0], n[1], 0, n[0]*p[0] + n[1]*p[1]]);
}

/**
  classify an orientation preserving isometry given by its normalized Moebius matrix

  return { type: 'identity' | 'rotation' | 'translation' | 'parabolic' | 'hyperbolic' | 'loxodromic' | 'similarity',
           fixedPoints, angle, order, geometry, translation, axis, length }
*/
function classifyMobius(M){
  const [[a, b], [c, d]] = M;
  const tr = cadd(a, d);

  if(cabs(c) < 1.e-9){
    // affine: z -> m z + t
    const m = cdiv(a, d), t = cdiv(b, d);
    if(Math.abs(cabs(m) - 1) > 1.e-6)
      return { type: 'similarity', geometry: 'euclidean' };
    if(cabs(csub(m, ONE)) < 1.e-8){
      if(cabs(t) < EPS) return { type: 'identity', geometry: 'euclidean' };
      return { type: 'translation', translation: t, geometry: 'euclidean' };
    }
    const z0 = cdiv(t, csub(ONE, m));
    const angle = carg(m);
    return { type: 'rotation', fixedPoints: [z0], angle, order: rotationOrder(angle), geometry: 'euclidean' };
  }

  // the fixed points: c z^2 + (d - a) z - b = 0
  const ad = csub(a, d);
  const disc = cadd(cmul(ad, ad), cmul([4, 0], cmul(b, c)));
  const sq = csqrt(disc);
  const two_c = cmul([2, 0], c);
  const z1 = cdiv(cadd(ad, sq), two_c);
  const z2 = cdiv(csub(ad, sq), two_c);

  if(Math.abs(tr[1]) > 1.e-6)
    return { type: 'loxodromic', fixedPoints: [z1, z2], geometry: 'unknown' };
  const t2 = tr[0]*tr[0];
  if(Math.abs(t2 - 4) < 1.e-6){
    if(cabs(csub(z1, z2)) > 1.e-3)
      return { type: 'loxodromic', fixedPoints: [z1, z2], geometry: 'unknown' };
    return { type: 'parabolic', fixedPoints: [z1], geometry: 'unknown' };
  }
  if(t2 < 4){
    // elliptic: a rotation about a fixed point; the other fixed point is its
    // inverse in the boundary circle of the Poincare disk (z1 conj(z2) = R^2,
    // a positive real) or its antipode on the sphere (z1 conj(z2) = -R^2, a
    // negative real, R the radius of the equator in the stereographic model)
    const p = cmul(z1, cconj(z2));
    let geometry = 'unknown';
    if(Math.abs(p[1]) < 1.e-5*(1. + cabs(p))){
      if(p[0] > 1.e-9) geometry = 'hyperbolic';
      else if(p[0] < -1.e-9) geometry = 'spherical';
    }
    const fixed = (geometry === 'hyperbolic') ? [cabs(z1) < cabs(z2) ? z1 : z2] : [z1, z2];
    // the rotation angle at the fixed point: the derivative 1/(c z + d)^2
    const den = cadd(cmul(c, fixed[0]), d);
    const angle = carg(cdiv(ONE, cmul(den, den)));
    return { type: 'rotation', fixedPoints: fixed, angle, order: rotationOrder(angle), geometry };
  }
  // hyperbolic: a translation along the geodesic through its two boundary fixed points
  const onCircle = Math.abs(cabs(z1) - 1) < 1.e-4 && Math.abs(cabs(z2) - 1) < 1.e-4;
  return { type: 'hyperbolic', fixedPoints: [z1, z2], geometry: onCircle ? 'hyperbolic' : 'unknown',
           axis: onCircle ? geodesicThrough(z1, z2) : null,
           length: 2*Math.acosh(Math.abs(tr[0])/2) };
}

// generic points of the unit disk, in no special position
const FIT_POINTS = [[0.113, 0.071], [-0.229, 0.307], [0.291, -0.187]];
const TEST_POINTS = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0]), iPoint([0.31, -0.2, 0, 0])];

/**
  classify an isometry given as an ITransform

  return {
    orientation:  +1 (preserving) or -1 (reversing)
    type:         preserving: 'identity' | 'rotation' | 'translation' | 'parabolic' | 'hyperbolic' | 'loxodromic' | 'similarity'
                  reversing:  'reflection' | 'glide' | 'rotaryReflection' | 'parabolicGlide' | 'other'
    geometry:     'euclidean' | 'hyperbolic' | 'spherical' | 'unknown'
    fixedPoints:  [[x,y], ...]   rotation: the cone point(s); hyperbolic: the ends of the axis
    angle, order: rotation
    translation:  [dx,dy]  Euclidean translation; for a glide the glide vector
    axis:         iSplane  glide axis, or the axis of a hyperbolic translation
    length:       translation length of a hyperbolic translation
    square:       for a reversing isometry, the classification of its square
  }
*/
export function classifyIsometry(itrans){

  const W = FIT_POINTS.map(z => applyToPoint(itrans, z));
  if(W.some(w => !Number.isFinite(w[0]) || !Number.isFinite(w[1])))
    return { orientation: 1, type: 'other', geometry: 'unknown' };

  const cross = (p, q, r) => (q[0] - p[0])*(r[1] - p[1]) - (q[1] - p[1])*(r[0] - p[0]);
  const orientation = (cross(...W)*cross(...FIT_POINTS) < 0) ? -1 : 1;

  if(orientation > 0){
    const M = normalize(mobiusThrough(FIT_POINTS, W));
    const res = classifyMobius(M);
    res.orientation = 1;
    return res;
  }

  // reversing: g(z) = f(conj z) with f a Moebius transformation
  const res = { orientation: -1, geometry: 'unknown' };
  const square = itrans.getCopy().concat(itrans);
  if(sameTransform(square, new ITransform([], ''), TEST_POINTS)){
    res.type = 'reflection';
    return res;
  }
  const sq = classifyIsometry(square);
  res.square = sq;
  res.geometry = sq.geometry;
  switch(sq.type){
    case 'translation': {
      // a glide: the axis goes through the midpoint of a point and its image,
      // in the direction of the translation; the glide vector is half of it
      const z = FIT_POINTS[0], gz = W[0];
      const mid = [(z[0] + gz[0])/2, (z[1] + gz[1])/2];
      res.type = 'glide';
      res.axis = lineThrough(mid, sq.translation);
      res.translation = [sq.translation[0]/2, sq.translation[1]/2];
      return res;
    }
    case 'hyperbolic':
      res.type = 'glide';
      res.axis = sq.axis;
      res.length = sq.length/2;
      res.fixedPoints = sq.fixedPoints;
      return res;
    case 'rotation':
      res.type = 'rotaryReflection';
      res.fixedPoints = sq.fixedPoints;
      return res;
    case 'parabolic':
      res.type = 'parabolicGlide';
      return res;
    default:
      res.type = 'other';
      return res;
  }
}

// ---------------------------------------------------------------------------
// the sides of a domain: their midpoints, where the arrows of the pairings start
// ---------------------------------------------------------------------------

const sigDist = (sp, p) => U4.sigDistanceSP(sp, iPoint([p[0], p[1], 0, 0]));

/** intersection points of two splanes (lines or circles) in the plane, [] when none */
export function splaneIntersections(s1, s2){
  const isLine = s => s.type === SPLANE_PLANE;
  if(isLine(s1) && isLine(s2)){
    const [a1, b1, , d1] = s1.v, [a2, b2, , d2] = s2.v;
    const det = a1*b2 - a2*b1;
    if(Math.abs(det) < 1.e-12) return [];
    return [[(d1*b2 - d2*b1)/det, (a1*d2 - a2*d1)/det]];
  }
  if(isLine(s1) || isLine(s2)){
    const L = isLine(s1) ? s1 : s2, S = isLine(s1) ? s2 : s1;
    const [nx, ny, , d] = L.v;
    const [cx, cy, , r] = S.v;
    const t = d - (nx*cx + ny*cy);
    const fx = cx + t*nx, fy = cy + t*ny;          // the foot of the centre on the line
    const h2 = r*r - t*t;
    if(h2 < -1.e-12) return [];
    const h = Math.sqrt(Math.max(0, h2));
    return h < 1.e-9 ? [[fx, fy]] : [[fx - h*ny, fy + h*nx], [fx + h*ny, fy - h*nx]];
  }
  const [x1, y1, , r1] = s1.v, [x2, y2, , r2] = s2.v;
  const dx = x2 - x1, dy = y2 - y1;
  const dd = Math.hypot(dx, dy);
  if(dd < 1.e-12) return [];
  const R1 = Math.abs(r1), R2 = Math.abs(r2);
  const a = (R1*R1 - R2*R2 + dd*dd)/(2*dd);
  const h2 = R1*R1 - a*a;
  if(h2 < -1.e-12) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const mx = x1 + a*dx/dd, my = y1 + a*dy/dd;
  return h < 1.e-9 ? [[mx, my]] : [[mx - h*dy/dd, my + h*dx/dd], [mx + h*dy/dd, my - h*dx/dd]];
}

/** the point of the splane nearest to p */
function footOn(sp, p){
  if(sp.type === SPLANE_PLANE){
    const [nx, ny, , d] = sp.v;
    const t = nx*p[0] + ny*p[1] - d;
    return [p[0] - t*nx, p[1] - t*ny];
  }
  const [cx, cy, , r] = sp.v;
  const dx = p[0] - cx, dy = p[1] - cy;
  const len = Math.hypot(dx, dy) || 1;
  return [cx + Math.abs(r)*dx/len, cy + Math.abs(r)*dy/len];
}

/**
  the midpoints of the sides of a domain given as an array of splanes: the
  midpoint of the edge of the polygon (the arc, for a circle side) lying on
  the side, or, when the corners of a side cannot be found (an unbounded or
  ideal side), the point of the side nearest to an interior point

  return array of [x, y], one per side
*/
export function domainSideMidpoints(fd, opt = {}){
  const eps = isDefined(opt.eps) ? opt.eps : 1.e-6;
  const n = fd.length;
  const inside = (p, skip) => fd.every((s, k) => skip.includes(k) || sigDist(s, p) <= eps);

  // a domain of the Poincare disk (every circle side orthogonal to the unit
  // circle) lies inside the disk, but the intersection of the regions of its
  // sides extends beyond it: only corners inside the disk count there
  const circles = fd.filter(s => s.type === SPLANE_SPHERE);
  const orthogonal = sp => {
    const [cx, cy, , r] = sp.v;
    return Math.abs(cx*cx + cy*cy - r*r - 1) < 1.e-4*(1 + cx*cx + cy*cy);
  };
  const hyperbolic = circles.length > 0 && circles.every(orthogonal);
  const inModel = p => !hyperbolic || p[0]*p[0] + p[1]*p[1] <= 1 + 1.e-6;

  // the corners: intersections of two sides inside every other side
  const corners = [];
  for(let i = 0; i < n; i++){
    for(let j = i + 1; j < n; j++){
      for(const p of splaneIntersections(fd[i], fd[j])){
        if(!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
        if(!inModel(p) || !inside(p, [i, j])) continue;
        if(corners.some(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1.e-6)) continue;
        corners.push(p);
      }
    }
  }
  // an interior point, for the fallbacks
  let center = [0, 0];
  if(corners.length > 0){
    center = [corners.reduce((s, c) => s + c[0], 0)/corners.length,
              corners.reduce((s, c) => s + c[1], 0)/corners.length];
  }
  if(isDefined(opt.center)) center = opt.center;

  const mids = [];
  for(let s = 0; s < n; s++){
    const sp = fd[s];
    const onSide = corners.filter(c => Math.abs(sigDist(sp, c)) < 1.e-5);
    let mid = null;
    if(onSide.length >= 2){
      if(sp.type === SPLANE_PLANE){
        // the two extreme corners along the line
        const [nx, ny] = sp.v;
        const t = c => -ny*c[0] + nx*c[1];
        onSide.sort((p, q) => t(p) - t(q));
        const a = onSide[0], b = onSide[onSide.length - 1];
        mid = [(a[0] + b[0])/2, (a[1] + b[1])/2];
      } else {
        // the arc inside the domain: of the two arc midpoints the one inside
        const [cx, cy, , r] = sp.v;
        const R = Math.abs(r);
        const ang = onSide.map(c => Math.atan2(c[1] - cy, c[0] - cx));
        const a = ang[0], b = ang[ang.length - 1];
        const m1 = (a + b)/2, m2 = m1 + Math.PI;
        const p1 = [cx + R*Math.cos(m1), cy + R*Math.sin(m1)];
        const p2 = [cx + R*Math.cos(m2), cy + R*Math.sin(m2)];
        mid = inside(p1, [s]) ? p1 : (inside(p2, [s]) ? p2 : p1);
      }
    }
    if(!mid) mid = footOn(sp, center);
    mids.push(mid);
  }
  return mids;
}

// ---------------------------------------------------------------------------
// the elements
// ---------------------------------------------------------------------------

export const ELEMENT_KINDS = { cone: 1, mirror: 2, glide: 3, translation: 4, other: 5 };

/**
  the elements of one pairing transform

  opt = { itrans, side (iSplane, the side the transform maps another side onto),
          anchor [x,y] (a point of the paired side), word }

  return array of elements { kind, order, center, axis, arrow, word, isometry }
*/
export function pairingElements(opt){
  const t = opt.itrans;
  const cls = classifyIsometry(t);
  const word = opt.word || t.word || '';
  const out = [];
  const arrowFrom = (a) => {
    if(!a) return null;
    const b = applyToPoint(t, a);
    return (Number.isFinite(b[0]) && Number.isFinite(b[1])) ? [a, b] : null;
  };
  switch(cls.type){
    case 'identity':
      break;
    case 'rotation':
      for(const p of cls.fixedPoints)
        out.push({ kind: 'cone', order: cls.order, angle: cls.angle, center: p, axis: null, arrow: null, word, isometry: cls });
      break;
    case 'reflection':
      out.push({ kind: 'mirror', order: 2, center: null, axis: opt.side || null, arrow: null, word, isometry: cls });
      break;
    case 'glide': {
      let arrow = arrowFrom(opt.anchor);
      if(arrow && cls.axis && cls.geometry === 'euclidean'){
        // the glide vector along the axis: the feet of the anchor and its image
        arrow = [footOn(cls.axis, arrow[0]), footOn(cls.axis, arrow[1])];
      }
      out.push({ kind: 'glide', order: 0, center: null, axis: cls.axis || null, arrow, word, isometry: cls });
      break;
    }
    case 'translation':
      out.push({ kind: 'translation', order: 0, center: null, axis: null, arrow: arrowFrom(opt.anchor), word, isometry: cls });
      break;
    case 'hyperbolic':
      out.push({ kind: 'translation', order: 0, center: null, axis: cls.axis || null, arrow: arrowFrom(opt.anchor), word, isometry: cls });
      break;
    default:
      out.push({ kind: 'other', order: 0, center: null, axis: null, arrow: arrowFrom(opt.anchor), word, isometry: cls });
  }
  return out;
}

/**
  the elements of the pairing generators of a group, one generator per inverse
  pair of sides (a side paired with itself counts once)

  opt = { group }

  return array of elements, each with sides: [from, to] (the transform of side
  `to` maps side `from` onto it)
*/
export function generatorElements(opt){
  const group = opt.group;
  const fd = group.getFundDomain();
  const names = group.getGenNames();
  const n = fd.length;
  const gens = group.transforms.map((t, i) => new ITransform(t.slice(), names[i]));
  const mids = domainSideMidpoints(fd);
  const used = new Set();
  const out = [];
  for(let s = 0; s < n; s++){
    if(used.has(s)) continue;
    used.add(s);
    // the side the transform of s maps onto s: the side with the inverse transform;
    // an involution may pair two sides too (a half turn about the centre of an
    // edge split there into two sides swaps them), else it pairs its side with
    // itself (a mirror, a half turn about the midpoint of a whole side)
    const inv = gens[s].getInverse();
    let from = s;
    for(let k = 0; k < n; k++){
      if(k !== s && !used.has(k) && sameTransform(gens[k], inv, TEST_POINTS)){ from = k; break; }
    }
    if(from !== s) used.add(from);
    for(const e of pairingElements({ itrans: gens[s], side: fd[s], anchor: mids[from], word: names[s] })){
      e.sides = [from, s];
      out.push(e);
    }
  }
  if(DEBUG) console.log(`${MYNAME}.generatorElements:`, out.map(e => `${e.word}:${e.kind}${e.order ? e.order : ''}`).join(' '));
  return out;
}

/**
  the elements of the generators of a subgroup H, the pairings of its domain
  (buildSubgroupDomain: one per inverse pair)

  opt = { group (G, the domain was built from), domain }
*/
export function subgroupGeneratorElements(opt){
  const group = opt.group;
  const domain = opt.domain;
  const fd = group.getFundDomain();
  const mids = domainSideMidpoints(fd);
  const wallMid = side => applyToPoint(domain.cells[side.cell].itrans, mids[side.side]);
  const wallSplane = side => {
    const sd = domain.sides.find(x => x.cell === side.cell && x.side === side.side);
    return sd ? sd.splane : null;
  };
  const out = [];
  for(const gi of domain.generators){
    const p = domain.pairings[gi];
    const h = p.itrans;
    // the arrow starts on the side h maps onto p.from: p.to when it is known, else the boundary side which lands there
    let source = p.to || null;
    const target = wallMid(p.from);
    const lands = side => {
      const q = applyToPoint(h, wallMid(side));
      return Math.hypot(q[0] - target[0], q[1] - target[1]) < 1.e-5;
    };
    if(!source || !lands(source)){
      source = domain.sides.find(sd => sd.kind === 'boundary' && lands(sd)) || p.from;
    }
    for(const e of pairingElements({ itrans: h, side: wallSplane(p.from), anchor: wallMid(source), word: p.word })){
      e.sides = [source, p.from];
      out.push(e);
    }
  }
  if(DEBUG) console.log(`${MYNAME}.subgroupGeneratorElements:`, out.map(e => `${e.word}:${e.kind}${e.order ? e.order : ''}`).join(' '));
  return out;
}

// ---------------------------------------------------------------------------
// packing for the shaders
// ---------------------------------------------------------------------------

export const ELEMENT_TEXELS = 4;

/**
  pack the elements into a float array for a data texture: the header texel
  [count, 0, 0, 0], then per element ELEMENT_TEXELS texels:

     [kind, order, cx, cy]            kind: ELEMENT_KINDS, centre of a cone point
     [v0, v1, v2, v3]                 the axis splane, as DataPacking packs splanes
     [type, hasArrow, 0, 0]           SPLANE_NONE when there is no axis
     [ax, ay, bx, by]                 the arrow
*/
export function packGeneratorElements(elements){
  const n = elements.length;
  const data = new Float32Array(4*(1 + ELEMENT_TEXELS*n));
  data[0] = n;
  for(let k = 0; k < n; k++){
    const e = elements[k];
    const o = 4*(1 + ELEMENT_TEXELS*k);
    data[o]   = ELEMENT_KINDS[e.kind] || ELEMENT_KINDS.other;
    data[o+1] = e.order || 0;
    data[o+2] = e.center ? e.center[0] : 0;
    data[o+3] = e.center ? e.center[1] : 0;
    const ax = e.axis;
    if(ax){
      data[o+4] = ax.v[0]; data[o+5] = ax.v[1]; data[o+6] = ax.v[2]; data[o+7] = ax.v[3];
      data[o+8] = ax.type;
    } else {
      data[o+8] = SPLANE_NONE;
    }
    data[o+9] = e.arrow ? 1 : 0;
    if(e.arrow){
      data[o+12] = e.arrow[0][0]; data[o+13] = e.arrow[0][1];
      data[o+14] = e.arrow[1][0]; data[o+15] = e.arrow[1][1];
    }
  }
  return data;
}

/**
  upload packGeneratorElements() into a data sampler (DataPacking.createGroupDataSampler);
  the texture bound to the active unit before the call is bound again after it
*/
export function packGeneratorElementsToSampler(gl, sampler, elements){
  const data = packGeneratorElements(elements);
  const bound = gl.getParameter(gl.TEXTURE_BINDING_2D);
  gl.bindTexture(gl.TEXTURE_2D, sampler);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, data.length/4, 1, 0, gl.RGBA, gl.FLOAT, data);
  gl.bindTexture(gl.TEXTURE_2D, bound);
}

/** short human readable form of an element */
export function elementToString(e){
  const f = x => x.toFixed(4).replace(/\.?0+$/, '') || '0';
  const pt = p => '(' + f(p[0]) + ',' + f(p[1]) + ')';
  switch(e.kind){
    case 'cone':        return `cone point of order ${e.order || '?'} at ${pt(e.center)}`;
    case 'mirror':      return 'mirror' + (e.axis ? ' ' + e.axis.toStr(4) : '');
    case 'glide':       return 'glide' + (e.arrow ? ' ' + pt(e.arrow[0]) + ' -> ' + pt(e.arrow[1]) : '');
    case 'translation': return 'translation' + (e.arrow ? ' ' + pt(e.arrow[0]) + ' -> ' + pt(e.arrow[1]) : '');
    default:            return e.kind + (e.isometry ? ' (' + e.isometry.type + ')' : '');
  }
}
