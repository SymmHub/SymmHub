import { ITransform, iPoint, isDefined, DataPacking,
         iSplane, iPlane, iSphere, SPLANE_PLANE, SPLANE_SPHERE, SPLANE_NONE, U4 } from '../invlib/invlib.js';
import {
    sameTransform,
    splaneIntersections,
} from './modules.js';

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
  orientation reversing isometry (told by the cross ratio of four points,
  which it makes its conjugate) is looked at through its square.

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
    const inner = (cabs(z1) < cabs(z2)) ? z1 : z2;
    const fixed = (geometry === 'hyperbolic') ? [inner] : [z1, z2];
    // the rotation angle at the fixed point: the derivative 1/(c z + d)^2
    const den = cadd(cmul(c, fixed[0]), d);
    const angle = carg(cdiv(ONE, cmul(den, den)));
    const res = { type: 'rotation', fixedPoints: fixed, angle, order: rotationOrder(angle), geometry };
    // the fixed point beyond the absolute of the disk: the centre of the
    // rotation in the mirror image of the hyperbolic plane (a tile there)
    if(geometry === 'hyperbolic') res.mirrorFixedPoints = [(inner === z1) ? z2 : z1];
    return res;
  }
  // hyperbolic: a translation along the geodesic through its two boundary fixed points
  const onCircle = Math.abs(cabs(z1) - 1) < 1.e-4 && Math.abs(cabs(z2) - 1) < 1.e-4;
  return { type: 'hyperbolic', fixedPoints: [z1, z2], geometry: onCircle ? 'hyperbolic' : 'unknown',
           axis: onCircle ? geodesicThrough(z1, z2) : null,
           length: 2*Math.acosh(Math.abs(tr[0])/2) };
}

// generic points of the unit disk, in no special position: the Moebius
// transformation is fitted through the images of the three, the fourth tells
// the orientation. It lies where the cross ratio of the four is exp(-i pi/3),
// as far from the real axis as a cross ratio of modulus 1 gets
const FIT_POINTS = [[0.113, 0.071], [-0.229, 0.307], [0.291, -0.187]];
const ORIENTATION_POINT = [0.296, 0.215];
const TEST_POINTS = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0]), iPoint([0.31, -0.2, 0, 0])];

/** the cross ratio (z1 - z3)(z2 - z4) / ((z1 - z4)(z2 - z3)) */
const crossRatio = (z1, z2, z3, z4) => cdiv(cmul(csub(z1, z3), csub(z2, z4)), cmul(csub(z1, z4), csub(z2, z3)));
const FIT_RATIO = crossRatio(...FIT_POINTS, ORIENTATION_POINT);

/**
  the orientation of a map of the plane made of reflections in lines and
  circles, by the images w of the three fit points and of the orientation
  point: +1 when it keeps their cross ratio (a Moebius transformation), -1
  when it makes it its conjugate (a Moebius transformation of conj z), 0 when
  the images give no cross ratio.

  Three points do not tell it. The triangle of their images is the triangle
  turned over under a reversing affine map, but also under a Moebius
  transformation whose pole (the point it sends to infinity) lies inside the
  circle through the three points; and that circle, of radius 1 here, holds
  the poles of many isometries of the Poincare disk and of the sphere: by the
  triangle a half turn reads as a mirror and a mirror as a rotation.
*/
function orientationBy(w){
  const c = crossRatio(...w);
  if(!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return 0;
  return (cabs(csub(c, FIT_RATIO)) <= cabs(csub(c, cconj(FIT_RATIO)))) ? 1 : -1;
}

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
  return classifyAt(itrans, 0);
}

/**
  depth: 1 for the square of a reversing isometry. The square preserves the
  orientation; one found reversing again is lost to rounding (a transform with
  huge entries maps the fit points almost onto one point, and the orientation
  test reads noise). Recursing would square it again and again, each time with
  a reflection list twice as long, until the memory runs out - a group deformed
  past the words of its Dirichlet domain did that and froze the page.
*/
function classifyAt(itrans, depth){

  const W = FIT_POINTS.map(z => applyToPoint(itrans, z));
  const w4 = applyToPoint(itrans, ORIENTATION_POINT);
  if([...W, w4].some(w => !Number.isFinite(w[0]) || !Number.isFinite(w[1])))
    return { orientation: 1, type: 'other', geometry: 'unknown' };

  const orientation = orientationBy([...W, w4]);
  if(orientation === 0)
    return { orientation: 1, type: 'other', geometry: 'unknown' };

  if(orientation > 0){
    const M = normalize(mobiusThrough(FIT_POINTS, W));
    const res = classifyMobius(M);
    res.orientation = 1;
    return res;
  }

  // reversing: g(z) = f(conj z) with f a Moebius transformation
  const res = { orientation: -1, geometry: 'unknown' };
  if(depth > 0){
    res.type = 'other';
    return res;
  }
  const square = itrans.getCopy().concat(itrans);
  if(sameTransform(square, new ITransform([], ''), TEST_POINTS)){
    res.type = 'reflection';
    return res;
  }
  const sq = classifyAt(square, depth + 1);
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

/*
  bounded walls: an orbifold with a handle or a second crosscap has sides sharing one
  splane, told apart by bounds (Group.getFundDomainWalls: per side [splane, ...bounds]),
  each a side only along its stretch, with its own pairing; the domain is what no side
  crosses, and with a twist it is not convex. The functions below take them as
  opt.walls; without them every side is its whole splane.
*/

/** the bounds of each side, [] for a side that is its whole splane */
function sideBounds(fd, walls){
  const ok = Array.isArray(walls) && walls.length === fd.length;
  return fd.map((sp, k) => (ok && walls[k]) ? walls[k].slice(1) : []);
}

/** is p within the stretch of the side with these bounds (Group.withinWallBounds); closed: by eps */
function inStretch(bounds, p, eps = 0){
  return bounds.every(b => sigDist(b, p) > -eps);
}

/** the domain's test: is p across none of the sides but those in skip? */
function insideSides(fd, bounds, eps){
  return (p, skip = []) => fd.every((sp, k) => skip.includes(k) || sigDist(sp, p) <= eps || !inStretch(bounds[k], p));
}

/** the sides on the splane of side i (side i too) */
function onSplaneOf(fd, i){
  return fd.map((sp, k) => k).filter(k => k === i || sameSplane(fd[i], fd[k]));
}

/** the walls of a group's domain (Group.getFundDomainWalls), undefined without them */
export function groupWalls(group){
  return (group && typeof group.getFundDomainWalls === 'function') ? group.getFundDomainWalls() : undefined;
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
  the disk of the Poincare model a domain lies in, in whatever coordinates
  the domain is given (the model may be moved and scaled): the circle every
  circle side is orthogonal to and every line side passes through, fitted
  to the sides by least squares

  return { center: [x, y], radius } or null when the sides do not fit one
*/
export function modelDisk(fd){
  // unknowns X, Y, W = X^2 + Y^2 - R^2: a circle side (cx, cy, r) gives
  // 2cx X + 2cy Y - W = cx^2 + cy^2 - r^2, a line side (nx, ny, d) gives
  // nx X + ny Y = d
  const fits = (X, Y, r2, sides) => sides.every(sp => {
    if(sp.type === SPLANE_SPHERE){
      const [cx, cy, , r] = sp.v;
      const d2 = (cx - X)*(cx - X) + (cy - Y)*(cy - Y);
      return Math.abs(d2 - r*r - r2) <= 1.e-4*(r2 + d2);
    }
    if(sp.type === SPLANE_PLANE){
      const [nx, ny, , d] = sp.v;
      return Math.abs(nx*X + ny*Y - d) <= 1.e-4*Math.sqrt(r2);
    }
    return true;
  });
  // a domain may list the disk's boundary as a side of its own
  for(const sp of fd){
    if(sp.type !== SPLANE_SPHERE) continue;
    const [cx, cy, , r] = sp.v;
    if(fits(cx, cy, r*r, fd.filter(s => s !== sp))) return { center: [cx, cy], radius: Math.abs(r) };
  }
  const rows = [];
  let circles = 0;
  for(const sp of fd){
    if(sp.type === SPLANE_SPHERE){
      const [cx, cy, , r] = sp.v;
      rows.push([2*cx, 2*cy, -1, cx*cx + cy*cy - r*r]);
      circles++;
    } else if(sp.type === SPLANE_PLANE){
      const [nx, ny, , d] = sp.v;
      rows.push([nx, ny, 0, d]);
    }
  }
  if(circles === 0 || rows.length < 3) return null;
  // the normal equations
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for(const r of rows){
    for(let i = 0; i < 3; i++){
      b[i] += r[i]*r[3];
      for(let j = 0; j < 3; j++) A[i][j] += r[i]*r[j];
    }
  }
  const det3 = m => m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
  const det = det3(A);
  const norm = A.reduce((s, row) => s + row.reduce((t, x) => t + x*x, 0), 0);
  if(Math.abs(det) < 1.e-12*Math.pow(norm, 1.5)) return null;
  const col = (m, k, v) => m.map((row, i) => row.map((x, j) => (j === k) ? v[i] : x));
  const X = det3(col(A, 0, b))/det, Y = det3(col(A, 1, b))/det, W = det3(col(A, 2, b))/det;
  const r2 = X*X + Y*Y - W;
  if(!(r2 > 0) || !fits(X, Y, r2, fd)) return null;
  return { center: [X, Y], radius: Math.sqrt(r2) };
}

/**
  tells the points of the model a domain lies in. The region inside all the
  sides of a domain of the hyperbolic plane is the domain and its mirror image
  across the absolute, so a corner, a point of a side or the middle of an arc
  is one of the domain on the domain's side of the absolute only.

  The maker of the group may give the absolute of the model it built in
  (Group.absolute, a splane with the domain on its inside):

    inside the absolute  when every side fits it (fitsAbsolute): a group of
                         the hyperbolic plane, wherever it is turned or moved
    anywhere             when a side does not: a bent group. Its sides fit no
                         model and bound a polygon in each component, of
                         which domainPolygon takes the one inside the absolute

  Without one the model is read off the sides:

    inside the disk      a domain of the Poincare disk (modelDisk)
    above the line       a domain of the upper half plane (halfPlaneModel, the
                         makers' y > 0) whose sides shut the absolute out, as
                         those of a domain of finite area do
    anywhere             any other domain. Two circles of the sphere that
                         cross fit a half plane too, but the lune between
                         them holds a stretch of that line (holdsLine), and
                         both its corners are corners

  A model read off the sides is a guess within a tolerance: the sides of a
  group bent by a degree still fit a disk, a huge one that may hold the wrong
  polygon. The makers that bend their groups give the absolute for that.

  at: a point of the region inside all the sides. When it lies beyond the
  absolute of the model, the points told are those of its side, the mirror
  image's: the group acts there too, and the mirror image of the domain is
  its domain there (domainPolygon gives the polygon that holds the point)

  return function([x, y]) -> boolean
*/
function modelPoints(fd, absolute = null, at = null){
  // side(p) is negative on the domain's side of the absolute, tol how far off it a point of it may be
  const sideOf = (side, tol) => (at && side(at) > tol) ? (p => side(p) >= -tol) : (p => side(p) <= tol);
  if(absolute){
    if(!fitsAbsolute(fd, absolute)) return () => true;
    return sideOf(p => sigDist(absolute, p), 1.e-6*sidesReach(fd));
  }
  const disk = modelDisk(fd);
  if(disk){
    const r2 = disk.radius*disk.radius;
    return sideOf(p => (p[0] - disk.center[0])**2 + (p[1] - disk.center[1])**2 - r2, 1.e-6*r2);
  }
  const half = halfPlaneModel(fd);
  if(half && !holdsLine(fd, half)){
    return sideOf(p => -(half.n[0]*(p[0] - half.p[0]) + half.n[1]*(p[1] - half.p[1])), 1.e-6*sidesReach(fd));
  }
  return () => true;
}

/** tells the points inside the absolute of the maker's model (Group.absolute), the points of its domain's side; null without one */
function absolutePoints(fd, absolute){
  if(!absolute) return null;
  const eps = 1.e-6*sidesReach(fd);
  return p => sigDist(absolute, p) <= eps;
}

/**
  do the sides fit the absolute of the maker's model: each a geodesic of it,
  a line or circle that crosses the absolute at a right angle
*/
function fitsAbsolute(fd, absolute){
  const TOL = 1.e-7;
  const unit = sp => { const len = Math.hypot(sp.v[0], sp.v[1]) || 1; return [sp.v[0]/len, sp.v[1]/len, sp.v[3]/len]; };
  return fd.every(sp => {
    if(sp.type !== SPLANE_SPHERE && sp.type !== SPLANE_PLANE) return true;
    if(absolute.type === SPLANE_PLANE){
      const [nx, ny, d] = unit(absolute);
      // a circle centred on the line, a line across it
      if(sp.type === SPLANE_SPHERE) return Math.abs(nx*sp.v[0] + ny*sp.v[1] - d) <= TOL*(1 + Math.abs(sp.v[3]));
      const [mx, my] = unit(sp);
      return Math.abs(nx*mx + ny*my) <= TOL;
    }
    const [cx, cy, , R] = absolute.v;
    if(sp.type === SPLANE_SPHERE){
      // two circles at a right angle: the squares of the radii add up to that of the centres' distance
      const d2 = (sp.v[0] - cx)**2 + (sp.v[1] - cy)**2;
      return Math.abs(d2 - R*R - sp.v[3]*sp.v[3]) <= TOL*(d2 + R*R + sp.v[3]*sp.v[3]);
    }
    // a line through the centre
    const [mx, my, e] = unit(sp);
    return Math.abs(mx*cx + my*cy - e) <= TOL*(Math.abs(R) + Math.hypot(cx, cy));
  });
}

/**
  the middle of the stretch of a circle side that holds the given points of
  it (two at least, the corners on the side). The points cut the circle into
  arcs, and inDomain([x, y]) tells, by its middle, an arc of the domain:

    one arc outside             the stretch is the rest of the circle
    several outside             the domain reaches the circle along several
                                stretches (the circle of a Kleinian group's
                                domain bounds a polygon in more than one
                                component): the longest arc inside, of those
                                prefer([x, y]) takes when it takes any (the
                                arcs inside the maker's absolute)
    none outside, or none       the test tells nothing (rounding, a circle the
    inside                      domain lies on both sides of): the longest arc
                                is the one outside

  The mean of the angles of two points is no such middle: it is the middle of
  the one arc between them or of the other by where the cut of atan2 falls.

  return [x, y]
*/
function arcMiddle(sp, points, inDomain, prefer = null){
  const [cx, cy, , r] = sp.v;
  const R = Math.abs(r);
  const at = t => [cx + R*Math.cos(t), cy + R*Math.sin(t)];
  const ang = points.map(p => Math.atan2(p[1] - cy, p[0] - cx)).sort((a, b) => a - b);
  // the arcs between neighbours, round the circle
  const arcs = ang.map((t, i) => {
    const len = (i + 1 < ang.length) ? ang[i + 1] - t : ang[0] + 2*Math.PI - t;
    return { mid: t + len/2, len };
  });
  const longest = list => list.reduce((best, a) => (a.len > best.len) ? a : best);
  const inside = arcs.filter(a => inDomain(at(a.mid)));
  const outside = arcs.length - inside.length;
  if(outside === 1) return at(arcs.find(a => !inside.includes(a)).mid + Math.PI);
  if(outside > 1 && inside.length > 0){
    const preferred = prefer ? inside.filter(a => prefer(at(a.mid))) : [];
    return at(longest(preferred.length ? preferred : inside).mid);
  }
  return at(longest(arcs).mid + Math.PI);
}

/** are the two splanes one line or one circle, sides the same way: the two halves of a side split by a half turn */
function sameSplane(a, b){
  return a.type === b.type && a.v.every((x, i) => Math.abs(x - b.v[i]) < 1.e-6);
}

/** where the line p + t d (d a unit vector) meets the segment from a to b, its ends included: the t, none or one */
function segmentHits(a, b, p, d){
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = d[0]*ey - d[1]*ex;
  if(Math.abs(den) < 1.e-14*Math.hypot(ex, ey)) return [];
  const fx = a[0] - p[0], fy = a[1] - p[1];
  const u = (fx*d[1] - fy*d[0])/den;
  return (u >= -1.e-12 && u <= 1 + 1.e-12) ? [(fx*ey - fy*ex)/den] : [];
}

/** where the line p + t d (d a unit vector) meets the arc about (cx, cy) of radius R from the angle t0 on by sweep, its ends included: the t, up to two */
function arcHits(cx, cy, R, t0, sweep, p, d){
  const fx = p[0] - cx, fy = p[1] - cy;
  const b = fx*d[0] + fy*d[1];
  const disc = b*b - (fx*fx + fy*fy - R*R);
  if(!(disc >= 0)) return [];
  const sq = Math.sqrt(disc);
  const out = [];
  for(const t of [-b - sq, -b + sq]){
    let turn = (Math.atan2(fy + t*d[1], fx + t*d[0]) - t0) % (2*Math.PI);
    if(turn < 0) turn += 2*Math.PI;
    if(turn <= sweep + 1.e-12 || turn >= 2*Math.PI - 1.e-12) out.push(t);
  }
  return out;
}

// the directions of the lines polygonHolding looks along, in no special position
const LOOK_ANGLES = [0.7391, 2.2143, 1.3027, 2.8641, 0.2113];

/**
  the polygon that holds a point of the region inside all the sides, of the
  closed polygons traced by domainPolygon (lists of {k}, indices of edges,
  each edge with hits(p, d): where a line meets it). Along a line through
  the point, the first edge ahead is an edge of the polygon round the point
  (nothing but an edge ends the region), and the line crosses the edges of
  that polygon an odd number of times ahead of the point and behind it. An
  even number both ways tells a point outside the closed line of the edges:
  the region reaches infinity there, and is no polygon. A point on an edge
  has the odd number on one side.

  reach: the size of the domain, for the tolerances

  return the polygon, or null
*/
function polygonHolding(p, edges, polygons, reach){
  const owner = new Map();
  polygons.forEach((round, i) => round.forEach(e => owner.set(e.k, i)));
  const tol = 1.e-9*reach;
  for(const angle of LOOK_ANGLES){
    const d = [Math.cos(angle), Math.sin(angle)];
    const hits = [];
    edges.forEach((e, k) => { for(const t of e.hits(p, d)) hits.push({ t, k }); });
    hits.sort((a, b) => a.t - b.t);
    // through a corner, or touching an arc, the line meets two edges at one place: another line tells
    if(hits.some((h, j) => j > 0 && h.t - hits[j - 1].t < tol)) continue;
    const first = hits.find(h => h.t > -tol);
    if(!first) return null;
    const i = owner.get(first.k);
    if(i === undefined) return null;
    const mine = hits.filter(h => owner.get(h.k) === i);
    const ahead = mine.filter(h => h.t > tol).length, behind = mine.filter(h => h.t < -tol).length;
    return (ahead % 2 === 1 || behind % 2 === 1) ? polygons[i] : null;
  }
  return null;
}

/**
  the corners of a domain given as an array of splanes: the intersections of
  two sides inside every other side (and, for a domain of the Poincare disk
  or of the upper half plane, on the domain's side of the absolute:
  modelPoints). The sides of a bent group bound several polygons, and the
  corners are those of them all

  opt = { absolute: the absolute of the maker's model (Group.absolute),
          at: a point of the region inside all the sides: beyond the absolute
              of the model, the corners are those of its side (modelPoints),
          walls: the walls of the domain (groupWalls): the ends of the sides'
              stretches are corners too, of a straight angle }

  return array of [x, y]
*/
export function domainCorners(fd, opt = {}){
  const eps = isDefined(opt.eps) ? opt.eps : 1.e-6;
  const n = fd.length;
  const bounds = sideBounds(fd, opt.walls);
  const inside = insideSides(fd, bounds, eps);
  const inModel = modelPoints(fd, opt.absolute, opt.at || null);

  const corners = [];
  const add = (p, skip) => {
    if(!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    if(!inModel(p) || !inside(p, skip)) return;
    if(corners.some(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1.e-6)) return;
    corners.push(p);
  };
  for(let i = 0; i < n; i++){
    for(let j = i + 1; j < n; j++){
      // two sides on one line or circle (a side split in two by a half turn) cross
      // nowhere: a rounding apart, they would cross anywhere
      if(sameSplane(fd[i], fd[j])) continue;
      for(const p of splaneIntersections(fd[i], fd[j])){
        if(inStretch(bounds[i], p, eps) && inStretch(bounds[j], p, eps)) add(p, [i, j]);
      }
    }
    // the ends of the stretch of a side with bounds
    for(const b of bounds[i]){
      for(const p of splaneIntersections(fd[i], b)) add(p, onSplaneOf(fd, i));
    }
  }
  return corners;
}

/**
  the polygon of a bounded domain: its corners, and its edges in the order
  they run round it, each with the corners it starts and ends at. An edge is
  a stretch of a side between two neighbouring corners that lies in the
  domain. The sides sharing one line or circle (a side split in two by the
  half turn about its centre) each take their stretch of it; a side alone on
  its line or circle takes all its stretches.

  The sides of a bent (Kleinian) group bound several polygons, one in each
  component of the group's domain of discontinuity, which may touch at a
  cusp. The polygon is then the one inside the absolute of the maker's model
  (the one with the fewest corners beyond it), and without an absolute the
  smallest.

  A point of the region inside all the sides (opt.at: any point, folded
  there by the group) asks for the polygon that holds it, of whatever
  component: in a bent group the polygon of the point's component, in a
  group of the hyperbolic plane the mirror image of the domain when the
  point lies beyond the absolute. A point in a region that reaches infinity
  (the mirror image of a domain that holds the centre of its disk) is held
  by no polygon: the edges round it are a closed line with the region
  outside.

  opt = { corners: extra corners on the sides (the centres of the half turns
          that map a side onto itself, which split it in two edges),
          absolute: the absolute of the maker's model (Group.absolute),
          at: [x, y], a point of the region inside all the sides: the
              polygon is the one that holds it,
          walls: the walls of the domain (groupWalls): a side with bounds takes
              the edges within its stretch }

  return { corners: [[x, y], ...], sides: [{ side, from, to }], mids: [[x, y], ...] }
  (side: the domain's side an edge lies on, from, to: indices of corners,
  mids: a point of each edge between its corners), or null when the sides
  close into no polygon of three edges or more, or into none that holds the
  point asked for
*/
export function domainPolygon(fd, opt = {}){
  const eps = isDefined(opt.eps) ? opt.eps : 1.e-6;
  const n = fd.length;
  const asked = opt.at ? [opt.at[0], opt.at[1]] : null;
  const bounds = sideBounds(fd, opt.walls);
  const across = insideSides(fd, bounds, eps);
  // a point outside a side is a point of no polygon
  if(asked && !(Number.isFinite(asked[0]) && Number.isFinite(asked[1]) && across(asked))) return null;
  const inModel = modelPoints(fd, opt.absolute, asked);
  // a point of the domain, not counting the sides in skip
  const inside = (p, skip) => inModel(p) && across(p, skip);
  const onSide = (sp, p) => Math.abs(sigDist(sp, p)) < 1.e-5;
  const corners = domainCorners(fd, opt);
  for(const p of (opt.corners || [])){
    if(!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if(!inside(p, []) || !fd.some(sp => onSide(sp, p))) continue;
    if(corners.some(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1.e-6)) continue;
    corners.push([p[0], p[1]]);
  }
  if(corners.length < 3) return null;

  // the edges: on each line or circle (the sides that share it together) the
  // stretches between neighbouring corners that lie in the domain, each from
  // its corner `from` to its corner `to` along the line or up the angle.
  // point(v, d): the point of the edge at the distance d from its end v
  const edges = [];
  const done = new Array(n).fill(false);
  for(let s = 0; s < n; s++){
    if(done[s]) continue;
    const group = [];
    for(let k = s; k < n; k++) if(!done[k] && sameSplane(fd[s], fd[k])){ group.push(k); done[k] = true; }
    const sp = fd[s];
    const on = corners.map((c, i) => ({ i, c })).filter(e => onSide(sp, e.c));
    // a side without two corners (the disk's boundary) is no edge of a polygon
    if(on.length < 2) continue;
    if(sp.type === SPLANE_PLANE){
      const [nx, ny] = sp.v;
      const place = e => -ny*e.c[0] + nx*e.c[1];
      on.sort((p, q) => place(p) - place(q));
      for(let j = 0; j + 1 < on.length; j++){
        const a = on[j], b = on[j + 1];
        const mid = [(a.c[0] + b.c[0])/2, (a.c[1] + b.c[1])/2];
        if(!inside(mid, group) || !group.some(k => inStretch(bounds[k], mid))) continue;
        const length = Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1]);
        edges.push({ group, from: a.i, to: b.i, mid, length, place: place(a),
                     point: (v, d) => { const u = (v === a.i) ? d/length : 1 - d/length; return [a.c[0] + u*(b.c[0] - a.c[0]), a.c[1] + u*(b.c[1] - a.c[1])]; },
                     hits: (p, d) => segmentHits(a.c, b.c, p, d) });
      }
    } else {
      const [cx, cy, , r] = sp.v;
      const R = Math.abs(r);
      const at = t => [cx + R*Math.cos(t), cy + R*Math.sin(t)];
      const angle = e => Math.atan2(e.c[1] - cy, e.c[0] - cx);
      on.sort((p, q) => angle(p) - angle(q));
      // round the circle: the last corner's arc runs on to the first
      for(let j = 0; j < on.length; j++){
        const a = on[j], b = on[(j + 1) % on.length];
        const t0 = angle(a);
        const sweep = (j + 1 < on.length) ? angle(b) - t0 : angle(b) + 2*Math.PI - t0;
        const mid = at(t0 + sweep/2);
        if(!inside(mid, group) || !group.some(k => inStretch(bounds[k], mid))) continue;
        edges.push({ group, from: a.i, to: b.i, mid, length: R*sweep, place: t0,
                     point: (v, d) => at((v === a.i) ? t0 + d/R : t0 + sweep - d/R),
                     hits: (p, d) => arcHits(cx, cy, R, t0, sweep, p, d) });
      }
    }
  }
  if(edges.length < 3) return null;

  // the polygons. Two edges at a corner bound one wedge of the domain when a
  // point between them, near the corner, lies strictly inside it: where two
  // sides touch (a cusp) four edges meet, two of each polygon that has the cusp
  const reach = sidesReach(fd);
  const strictly = p => inModel(p) && fd.every((s, k) => sigDist(s, p) < -1.e-12*reach || !inStretch(bounds[k], p));
  const wedge = (v, j, k) => {
    const L = Math.min(edges[j].length, edges[k].length);
    for(const f of [1/4, 1/8, 1/16, 1/32]){
      const p = edges[j].point(v, f*L), q = edges[k].point(v, f*L);
      if(strictly([(p[0] + q[0])/2, (p[1] + q[1])/2])) return true;
    }
    return false;
  };
  const meet = corners.map(() => []);
  edges.forEach((e, k) => { meet[e.from].push(k); meet[e.to].push(k); });
  const taken = new Array(edges.length).fill(false);
  const polygons = [];
  for(let k0 = 0; k0 < edges.length; k0++){
    if(taken[k0]) continue;
    // round from the edge k0: at each corner on to the edge of the same wedge
    const round = [];
    const start = edges[k0].from;
    // the edge k is gone along from its corner u to its corner v
    let k = k0, u = start, v = edges[k0].to, closed = false;
    for(;;){
      taken[k] = true;
      round.push({ k, from: u, to: v });
      if(v === start){
        const others = meet[v].filter(j => j !== k && j !== k0 && !taken[j]);
        if(others.length === 0 || wedge(v, k, k0)){ closed = true; break; }
      }
      const open = meet[v].filter(j => j !== k && !taken[j]);
      const next = (meet[v].length === 2) ? open[0] : open.find(j => wedge(v, k, j));
      if(next === undefined) break;
      k = next;
      u = v;
      v = (edges[k].from === u) ? edges[k].to : edges[k].from;
    }
    if(closed && round.length >= 3) polygons.push(round);
  }
  if(polygons.length === 0) return null;

  let round;
  if(asked){
    // the polygon that holds the point asked for
    round = polygonHolding(asked, edges, polygons, reach);
    if(!round) return null;
  } else {
    // of several polygons the one inside the maker's absolute, else the smallest
    const held = absolutePoints(fd, opt.absolute);
    const measure = round => {
      const c = round.map(e => corners[e.from]);
      const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
      return { beyond: held ? c.filter(p => !held(p)).length : 0,
               extent: Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
    };
    round = polygons[0];
    let best = measure(round);
    for(const candidate of polygons.slice(1)){
      const m = measure(candidate);
      if(m.beyond < best.beyond || (m.beyond === best.beyond && m.extent < best.extent)){ round = candidate; best = m; }
    }
  }

  // the side of each edge: the sides sharing a line or circle take the
  // polygon's edges on it one each, in their order along it; sides with
  // bounds the edges within their stretches
  const sideOf = new Map();
  const groups = [...new Set(round.map(e => edges[e.k].group))];
  for(const group of groups){
    let list = round.map(e => e.k).filter(k => edges[k].group === group).sort((p, q) => edges[p].place - edges[q].place);
    if(group.some(k => bounds[k].length > 0)){
      for(const k of list){
        const side = group.find(g => inStretch(bounds[g], edges[k].mid));
        if(side === undefined) return null;
        sideOf.set(k, side);
      }
      continue;
    }
    if(fd[group[0]].type !== SPLANE_PLANE && list.length > 1){
      // round a circle the order starts after the widest gap between the edges
      const R = Math.abs(fd[group[0]].v[3]);
      const end = k => edges[k].place + edges[k].length/R;
      let first = 0, widest = -Infinity;
      list.forEach((k, j) => {
        const before = list[(j + list.length - 1) % list.length];
        const gap = edges[k].place - end(before) + ((j === 0) ? 2*Math.PI : 0);
        if(gap > widest){ widest = gap; first = j; }
      });
      list = list.slice(first).concat(list.slice(0, first));
    }
    if(group.length === list.length) list.forEach((k, j) => sideOf.set(k, group[j]));
    else if(group.length === 1) list.forEach(k => sideOf.set(k, group[0]));
    else return null;
  }

  // round the polygon from its first edge (the lowest side's), along that edge
  const order = e => [sideOf.get(e.k), edges[e.k].place];
  let first = 0;
  round.forEach((e, j) => {
    const [s0, p0] = order(round[first]), [s1, p1] = order(e);
    if(s1 < s0 || (s1 === s0 && p1 < p0)) first = j;
  });
  round = round.slice(first).concat(round.slice(0, first));
  if(round[0].from !== edges[round[0].k].from){
    // the other way round: the first edge stays first
    round = [round[0]].concat(round.slice(1).reverse()).map(e => ({ k: e.k, from: e.to, to: e.from }));
  }
  const sides = round.map(e => ({ side: sideOf.get(e.k), from: e.from, to: e.to }));
  return { corners, sides, mids: round.map(e => edges[e.k].mid) };
}

/**
  a point of its domain a group knows the domain by: the base of a Dirichlet
  domain (lib/grouplib/DirichletDomain.js: makeDirichletGroup keeps it with
  the group as dirichletBase, and it goes with the group through clone and
  applyTransform). The sides of a domain bound a polygon in every component
  the group tiles, and the Dirichlet domain is the one that holds the base:
  the Tile tool's tile is that polygon (lib/drawlib/Tiles.js), and the
  middles of the sides, where the arrows of the generators start, are taken
  on it (domainSideMidpoints)

  return [x, y] in the group's coordinates, or null for any other group
*/
export function groupDomainBase(group){
  const v = (group && group.dirichletBase) ? group.dirichletBase.v : null;
  return (v && Number.isFinite(v[0]) && Number.isFinite(v[1])) ? [v[0], v[1]] : null;
}

/**
  the absolute of the model a group was built in (Group.absolute, which the
  makers that bend their groups give): a Dirichlet domain's is that of the
  group it was made from, the same group in the same model. The Dirichlet
  group carries none of its own: Group.absolute has the domain on its inside,
  and a Dirichlet domain is where its base is, beyond the absolute too.
  Without an absolute the model of a slightly bent group would be guessed
  from the sides (modelPoints), and a polygon with a cusp lost

  return an iSplane, or null
*/
export function groupModelAbsolute(group){
  if(!group) return null;
  return group.absolute || (group.dirichletSource && group.dirichletSource.absolute) || null;
}

/**
  the midpoints of the sides of a domain given as an array of splanes: the
  midpoint of the edge of the polygon lying on the side (for a circle side
  the middle of its arc in the domain), or, when the corners of a side cannot
  be found (an unbounded or ideal side), the point of the side nearest to an
  interior point

  opt = { absolute: the absolute of the maker's model (Group.absolute): where
          the sides bound several polygons (a bent group), the edge is that
          of the polygon inside it,
          at: [x, y], a point of the domain (the base of a Dirichlet domain,
              groupDomainBase): the edge is that of the polygon that holds
              the point, on whichever side of the absolute. A side with no
              edge on that polygon has its middle as without the point, and
              so has every side when no polygon holds the point (a region
              that reaches infinity),
          center: an interior point for the sides without corners,
          walls: the walls of the domain (groupWalls): a side with bounds has
              the middle of its stretch }

  return array of [x, y], one per side
*/
export function domainSideMidpoints(fd, opt = {}){
  const eps = isDefined(opt.eps) ? opt.eps : 1.e-6;
  const n = fd.length;
  const inModel = modelPoints(fd, opt.absolute);
  const bounds = sideBounds(fd, opt.walls);
  const across = insideSides(fd, bounds, eps);
  // a point of the domain, not counting the sides in skip
  const inside = (p, skip) => inModel(p) && across(p, skip);
  const held = absolutePoints(fd, opt.absolute);

  // the polygon that holds the point asked for: per side the middle of its edge
  // there (a side alone on its circle may bound the polygon twice: the longer edge)
  const onPolygon = new Map();
  const poly = opt.at ? domainPolygon(fd, { eps, absolute: opt.absolute, at: opt.at, walls: opt.walls }) : null;
  if(poly){
    poly.sides.forEach((e, k) => {
      const a = poly.corners[e.from], b = poly.corners[e.to], m = poly.mids[k];
      const length = Math.hypot(m[0] - a[0], m[1] - a[1]) + Math.hypot(b[0] - m[0], b[1] - m[1]);
      const best = onPolygon.get(e.side);
      if(!best || length > best.length) onPolygon.set(e.side, { mid: m, length });
    });
  }

  // the rest as without the point
  const corners = domainCorners(fd, { ...opt, at: null });
  // an interior point, for the fallbacks
  let center = [0, 0];
  if(corners.length > 0){
    center = [corners.reduce((s, c) => s + c[0], 0)/corners.length,
              corners.reduce((s, c) => s + c[1], 0)/corners.length];
  }
  if(isDefined(opt.center)) center = opt.center;

  const mids = [];
  for(let s = 0; s < n; s++){
    if(onPolygon.has(s)){ mids.push(onPolygon.get(s).mid); continue; }
    const sp = fd[s];
    const onSide = corners.filter(c => Math.abs(sigDist(sp, c)) < 1.e-5 && inStretch(bounds[s], c, 1.e-5));
    let mid = null;
    if(onSide.length >= 2){
      if(sp.type === SPLANE_PLANE){
        // the two extreme corners along the line: of the corners inside the
        // maker's absolute, when it holds two
        const inHeld = held ? onSide.filter(held) : [];
        const list = (inHeld.length >= 2) ? inHeld : onSide;
        const [nx, ny] = sp.v;
        const t = c => -ny*c[0] + nx*c[1];
        list.sort((p, q) => t(p) - t(q));
        const a = list[0], b = list[list.length - 1];
        mid = [(a[0] + b[0])/2, (a[1] + b[1])/2];
      } else {
        // the middle of the side's arc in the domain
        mid = arcMiddle(sp, onSide, p => inside(p, [s]) && inStretch(bounds[s], p), held);
      }
    }
    if(!mid) mid = footOn(sp, center);
    mids.push(mid);
  }
  return mids;
}

/**
  the model of the upper half plane a domain's sides fit: every circle side
  centred on one line (two circles at least, not concentric), every line side
  across it at a right angle. The line is the absolute; the domain is taken
  on the side its normal points to, oriented up (y > 0 for the x axis, the
  makers' upper half plane)

  return { p: [x, y] a point of the line, n: [nx, ny] the unit normal } or null
*/
function halfPlaneModel(sides, eps = 1.e-6){
  const circles = sides.filter(sp => sp.type === SPLANE_SPHERE);
  if(circles.length < 2) return null;
  const c0 = circles[0].v;
  const far = circles.map(sp => sp.v).reduce((best, v) => {
    const d = Math.hypot(v[0] - c0[0], v[1] - c0[1]);
    return d > best.d ? { v, d } : best;
  }, { v: null, d: 0 });
  const scale = Math.max(1, ...circles.map(sp => Math.hypot(sp.v[0], sp.v[1]) + Math.abs(sp.v[3])));
  if(!far.v || far.d < eps*scale) return null;
  const e = [(far.v[0] - c0[0])/far.d, (far.v[1] - c0[1])/far.d];
  let n = [-e[1], e[0]];
  if(n[1] < 0 || (n[1] === 0 && n[0] < 0)) n = [-n[0], -n[1]];
  const offLine = v => Math.abs(n[0]*(v[0] - c0[0]) + n[1]*(v[1] - c0[1]));
  if(circles.some(sp => offLine(sp.v) > 1.e-5*scale)) return null;
  for(const sp of sides){
    if(sp.type !== SPLANE_PLANE) continue;
    // a line side across the absolute: its normal along the line
    const len = Math.hypot(sp.v[0], sp.v[1]) || 1;
    if(Math.abs(sp.v[0]*n[0] + sp.v[1]*n[1])/len > 1.e-5) return null;
  }
  return { p: [c0[0], c0[1]], n };
}

/** how far from the origin the sides of a domain reach: a circle's far point, a line's foot */
function sidesReach(sides){
  let reach = 0;
  for(const sp of sides){
    const [a, b, , c] = sp.v;
    if(sp.type === SPLANE_SPHERE) reach = Math.max(reach, Math.hypot(a, b) + Math.abs(c));
    else if(sp.type === SPLANE_PLANE) reach = Math.max(reach, Math.abs(c)/(Math.hypot(a, b) || 1));
  }
  return Math.max(1, reach);
}

/**
  does the region inside all the sides hold a stretch of the line of a half
  plane model (halfPlaneModel) the sides fit: the sides cut the line where
  they cross it, and a piece between two cuts, or beyond them all, lies
  inside every side. Such sides bound no domain of finite area in the half
  plane: it reaches the absolute along that stretch, or it is the lune
  between two crossing circles, which the line cuts in two
*/
function holdsLine(sides, half){
  const e = [half.n[1], -half.n[0]];
  const at = u => [half.p[0] + u*e[0], half.p[1] + u*e[1]];
  const cuts = [];
  for(const sp of sides){
    if(sp.type === SPLANE_SPHERE){
      const u = (sp.v[0] - half.p[0])*e[0] + (sp.v[1] - half.p[1])*e[1], r = Math.abs(sp.v[3]);
      cuts.push(u - r, u + r);
    } else if(sp.type === SPLANE_PLANE){
      // the line side n.x = d crosses the absolute p + u e at n.(p + u e) = d
      const along = sp.v[0]*e[0] + sp.v[1]*e[1];
      if(Math.abs(along) > 1.e-12) cuts.push((sp.v[3] - sp.v[0]*half.p[0] - sp.v[1]*half.p[1])/along);
    }
  }
  if(cuts.length === 0) return true;
  cuts.sort((a, b) => a - b);
  const span = Math.max(1, cuts[cuts.length - 1] - cuts[0]);
  const pieces = [cuts[0] - span, cuts[cuts.length - 1] + span];
  for(let i = 0; i + 1 < cuts.length; i++){
    if(cuts[i + 1] - cuts[i] > 1.e-9*span) pieces.push((cuts[i] + cuts[i + 1])/2);
  }
  const eps = 1.e-9*span;
  return pieces.some(u => sides.every(sp => sigDist(sp, at(u)) < -eps));
}

/**
  the bounding box of a domain given as an array of splanes, from the points
  of its boundary: the corners (where two sides cross inside the others) and
  points along every side inside the others, which need no polygon to close
  (a side with no corners, a side twice on one line, an ideal corner). The
  region inside all the sides is the domain and its mirror image across the
  absolute: a domain of the Poincare disk (modelDisk) is taken inside the
  disk, one of the upper half plane (halfPlaneModel) above its line. An
  unbounded domain (a frieze's strip, a lune through infinity, a domain with
  a cusp at infinity) is cut by a window round the sides, the square of half
  side opt.window about the origin (by default twice the farthest reach of a
  side from the origin, at least 1), whose edges then bound the box.

  opt = { window, samples: the points along a side (256),
          walls: the walls of the domain (groupWalls): a side with bounds is a
              side only along its stretch }

  return [x0, y0, x1, y1], or null without sides or without a point of the
  boundary
*/
export function domainBox(fd, opt = {}){
  const keep = (fd || []).map((sp, k) => k).filter(k => { const sp = fd[k]; return sp && sp.v && (sp.type === SPLANE_SPHERE || sp.type === SPLANE_PLANE); });
  const sides = keep.map(k => fd[k]);
  if(!sides.length) return null;
  const allBounds = sideBounds(fd, opt.walls);
  const bounds = keep.map(k => allBounds[k]);
  const N = isDefined(opt.samples) ? opt.samples : 256;
  let reach = 0;
  for(const sp of sides){
    const [a, b, , c] = sp.v;
    reach = Math.max(reach, sp.type === SPLANE_SPHERE ? Math.hypot(a, b) + Math.abs(c) : Math.abs(c)/(Math.hypot(a, b) || 1));
  }
  const W = isDefined(opt.window) ? opt.window : Math.max(1, 2*reach);
  const eps = 1.e-7*Math.max(1, reach);
  const disk = modelDisk(sides);
  const half = disk ? null : halfPlaneModel(sides);
  const inModel = p => {
    if(disk) return (p[0] - disk.center[0])**2 + (p[1] - disk.center[1])**2 <= disk.radius*disk.radius*(1 + 1.e-6);
    if(half) return half.n[0]*(p[0] - half.p[0]) + half.n[1]*(p[1] - half.p[1]) >= -eps;
    return true;
  };
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  // a point of the boundary: in the window and the model, inside every side but those it is on
  const take = (p, skip) => {
    if(!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    if(Math.abs(p[0]) > W*(1 + 1.e-12) || Math.abs(p[1]) > W*(1 + 1.e-12) || !inModel(p)) return;
    if(!sides.every((s, j) => skip.includes(j) || sigDist(s, p) <= eps || !inStretch(bounds[j], p))) return;
    box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]);
    box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]);
  };
  // the corners
  for(let i = 0; i < sides.length; i++){
    for(let j = i + 1; j < sides.length; j++){
      for(const p of splaneIntersections(sides[i], sides[j])) take(p, [i, j]);
    }
  }
  // along the sides: a circle all round, a line across the window
  sides.forEach((sp, k) => {
    if(sp.type === SPLANE_SPHERE){
      const [cx, cy, , r] = sp.v;
      const R = Math.abs(r);
      for(let i = 0; i < N; i++){
        const t = 2*Math.PI*i/N;
        take([cx + R*Math.cos(t), cy + R*Math.sin(t)], [k]);
      }
    } else {
      const [nx, ny, , d] = sp.v;
      const len2 = nx*nx + ny*ny || 1, len = Math.sqrt(len2);
      const foot = [nx*d/len2, ny*d/len2], e = [-ny/len, nx/len];
      // the stretch of the line in the window
      let u0 = -Infinity, u1 = Infinity;
      for(let a = 0; a < 2; a++){
        if(Math.abs(e[a]) < 1.e-15){
          if(Math.abs(foot[a]) > W) return;
          continue;
        }
        const ua = (-W - foot[a])/e[a], ub = (W - foot[a])/e[a];
        u0 = Math.max(u0, Math.min(ua, ub));
        u1 = Math.min(u1, Math.max(ua, ub));
      }
      if(!(u0 <= u1)) return;
      for(let i = 0; i <= N; i++){
        const u = u0 + (u1 - u0)*i/N;
        take([foot[0] + u*e[0], foot[1] + u*e[1]], [k]);
      }
    }
  });
  // the absolute where the domain reaches it along an arc that is no side
  if(disk){
    for(let i = 0; i < N; i++){
      const t = 2*Math.PI*i/N;
      take([disk.center[0] + disk.radius*Math.cos(t), disk.center[1] + disk.radius*Math.sin(t)], []);
    }
  } else if(half){
    const e = [half.n[1], -half.n[0]];
    for(let i = 0; i <= N; i++){
      const u = -2*W + 4*W*i/N;
      take([half.p[0] + u*e[0], half.p[1] + u*e[1]], []);
    }
  }
  // the window's edges where they cut an unbounded domain
  for(let i = 0; i <= N; i++){
    const u = -W + 2*W*i/N;
    for(const p of [[u, -W], [u, W], [-W, u], [W, u]]) take(p, []);
  }
  return box[0] <= box[2] && box[1] <= box[3] ? box : null;
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
  find all cone points (rotation centres) at corners of a fundamental domain by
  walking boundary-pairing vertex cycles in the domain's corner graph.
  Catches cone points whose stabilizer is a product of pairing generators
  (e.g. the 7-fold vertex of 237, mirror-intersection corners of *237/*532,
  and vertex-cycle cone points of subgroup domains).
*/
function cornerConePoints(corners, moves){
  const n = corners.length;
  if(!n || !moves.length) return [];
  const ptNear = (a, b, tol) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
  const inBnd = (bounds, p) => !bounds || !bounds.length || bounds.every(b => sigDist(b, p) > -1.e-4);

  // Directed edges u -> { to, itrans } for boundary moves incident to corner u
  const adj = Array.from({ length: n }, () => []);
  for(let u = 0; u < n; u++){
    const p = corners[u];
    for(const mv of moves){
      if(mv.splane && (Math.abs(sigDist(mv.splane, p)) > 1.e-4 || !inBnd(mv.bounds, p))) continue;
      const q = applyToPoint(mv.itrans, p);
      if(!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
      const v = corners.findIndex(c => ptNear(c, q, 5.e-4));
      if(v >= 0) adj[u].push({ to: v, itrans: mv.itrans });
    }
  }

  const keyPts = [FIT_POINTS[0], FIT_POINTS[1]];
  const stateKey = (node, tr) => {
    const a = applyToPoint(tr, keyPts[0]), b = applyToPoint(tr, keyPts[1]);
    return `${node}:${a[0].toFixed(3)},${a[1].toFixed(3)},${b[0].toFixed(3)},${b[1].toFixed(3)}`;
  };

  const bestOrder = new Array(n).fill(0);
  const bestCls   = new Array(n).fill(null);
  const maxDepth  = Math.min(Math.max(n + 2, 6), 14);

  for(let start = 0; start < n; start++){
    if(!adj[start].length) continue;
    const p0 = corners[start];
    const id = new ITransform([], '');
    const seen = new Set([stateKey(start, id)]);
    let frontier = [{ node: start, tr: id }];
    for(let d = 0; d < maxDepth && frontier.length && seen.size < 200; d++){
      const next = [];
      for(const cur of frontier){
        for(const e of adj[cur.node]){
          const tr = cur.tr.getCopy().concat(e.itrans);
          const k = stateKey(e.to, tr);
          if(seen.has(k)) continue;
          seen.add(k);
          if(e.to === start){
            const cls = classifyIsometry(tr);
            if(cls.type === 'rotation' && cls.order >= 2 &&
               cls.fixedPoints.some(fp => ptNear(fp, p0, 5.e-4))){
              if(cls.order > bestOrder[start]){
                bestOrder[start] = cls.order;
                bestCls[start] = cls;
              }
            }
          }
          next.push({ node: e.to, tr });
        }
      }
      frontier = next;
    }
  }

  const out = [];
  for(let i = 0; i < n; i++){
    if(bestOrder[i] >= 2){
      out.push({ kind: 'cone', order: bestOrder[i], angle: bestCls[i].angle,
                 center: corners[i], axis: null, arrow: null, word: '', isometry: bestCls[i] });
    }
  }
  return out;
}

/** merge extra cone points (and rotary-reflection rotational axes) into elements, keeping max order per centre */
function appendExtraCones(out, extra){
  const ptNear = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 5.e-4;
  const cones = out.filter(e => e.kind === 'cone' && e.center);
  const addCone = (c) => {
    if(!c.center || !Number.isFinite(c.center[0]) || !Number.isFinite(c.center[1])) return;
    const prev = cones.find(e => ptNear(e.center, c.center));
    if(!prev){ out.push(c); cones.push(c); }
    else if(c.order > prev.order){ prev.order = c.order; prev.angle = c.angle; prev.isometry = c.isometry; }
  };
  for(const e of out.slice()){
    if(e.isometry && e.isometry.type === 'rotaryReflection' &&
       e.isometry.square && e.isometry.square.type === 'rotation' && e.isometry.square.order >= 2){
      for(const p of (e.isometry.fixedPoints || [])){
        addCone({ kind: 'cone', order: e.isometry.square.order, angle: e.isometry.square.angle,
                  center: p, axis: null, arrow: null, word: e.word, isometry: e.isometry.square });
      }
    }
  }
  for(const c of extra) addCone(c);
}

/**
  the elements of the pairing generators of a group, one generator per inverse
  pair of sides (a side paired with itself counts once)

  opt = { group, includeCornerCones (false: pairing generators only; true: also
          rotation centres formed by vertex cycles / mirror intersections) }

  The arrows start at the middles of the sides (domainSideMidpoints): on the
  polygon inside the maker's absolute, and for a Dirichlet domain on the
  polygon that holds its base (groupDomainBase), where its tile is

  return array of elements, each with sides: [from, to] (the transform of side
  `to` maps side `from` onto it)
*/
export function generatorElements(opt){
  const group = opt.group;
  const fd = group.getFundDomain();
  const names = group.getGenNames();
  const n = fd.length;
  const gens = group.transforms.map((t, i) => new ITransform(t.slice(), names[i]));
  const abs = groupModelAbsolute(group), at = groupDomainBase(group), walls = groupWalls(group);
  const mids = domainSideMidpoints(fd, { absolute: abs, at, walls });
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
  if(opt.includeCornerCones){
    const corners = domainCorners(fd, { absolute: abs, at, walls });
    const moves = [];
    for(let s = 0; s < n; s++){
      const bnd = (walls && walls[s]) ? walls[s].slice(1) : [];
      moves.push({ itrans: gens[s].getInverse(), splane: fd[s], bounds: bnd });
      moves.push({ itrans: gens[s], splane: fd[s], bounds: bnd });
    }
    appendExtraCones(out, cornerConePoints(corners, moves));
  }
  if(DEBUG) console.log(`${MYNAME}.generatorElements:`, out.map(e => `${e.word}:${e.kind}${e.order ? e.order : ''}`).join(' '));
  return out;
}

/**
  the elements of the generators of a subgroup H, the pairings of its domain
  (buildSubgroupDomain: one per inverse pair)

  opt = { group (G, the domain was built from), domain, includeCornerCones }
*/
export function subgroupGeneratorElements(opt){
  const group = opt.group;
  const domain = opt.domain;
  const fd = group.getFundDomain();
  const abs = groupModelAbsolute(group), at = groupDomainBase(group), walls = groupWalls(group);
  const mids = domainSideMidpoints(fd, { absolute: abs, at, walls });
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
  if(opt.includeCornerCones){
    const gCorners = domainCorners(fd, { absolute: abs, at, walls });
    const bSides = domain.sides.filter(sd => sd.kind === 'boundary');
    const corners = [];
    for(const cell of domain.cells){
      for(const c of gCorners){
        const p = applyToPoint(cell.itrans, c);
        if(!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
        if(corners.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 5.e-4)) continue;
        if(bSides.some(sd => Math.abs(sigDist(sd.splane, p)) < 1.e-4)) corners.push(p);
      }
    }
    const moves = [];
    for(const sd of bSides){
      const p = domain.pairings[sd.pairing];
      if(!p) continue;
      moves.push({ itrans: p.itrans, splane: sd.splane, bounds: sd.bounds });
      moves.push({ itrans: p.invItrans, splane: sd.splane, bounds: sd.bounds });
    }
    appendExtraCones(out, cornerConePoints(corners, moves));
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
