/*
  test for the fundamental domain shapes of the wallpaper groups
  (lib/grouplib/WallpaperGroups.js: WallpaperDomainShapes, the domainShape parameter)

    node tests/wallpaper/domain_shapes.mjs

  for every shape of every group which offers domain shapes:
  1. the sides bound a convex polygon with the area of the group's default
     domain (all fundamental domains of a group have the same area)
  2. each pairing transform is an element of the group, tested with the
     default domain: folding the image of an interior point of the default
     domain back into it must undo the transform exactly.  Each pairing
     transform also maps the midpoint of its side onto the boundary
  3. the cells across the sides do not overlap the domain
  4. random points of the plane fold into the domain by the pairing transforms
     and the folding transform is a group element
  5. the default shape is the historic domain, and is what an omitted or unknown
     domainShape gives (regression guard for old documents)
*/

import {
  iWallpaperGroup,
  WallpaperDomainShapes,
  getWallpaperDomainShapes,
  resolveWallpaperDomainShape,
  DEFAULT_DOMAIN_SHAPE,
} from '../../lib/grouplib/WallpaperGroups.js';
import { Group, ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { domainCorners } from '../../lib/grouplib/GroupPresentation.js';
import { classifyEuclidean, isometryToString, sameTransform } from '../../lib/grouplib/SubgroupDomain.js';

const A = 0.5;            // scale parameter of the groups
const EPS = 1e-9;
const SAMPLES = 400;      // random points per check

// geometry parameters per group; 2222 is also run with off-centre 2-fold points
const GEOMETRIES = {
  '2222': [{ a: A }, { a: A, b: 0.7, c: 0.06 }],
};
const defaultGeometries = [{ a: A }];

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }
const num = x => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(4);
const fmt = xy => `(${num(xy[0])},${num(xy[1])})`;
const geoString = geo => Object.entries(geo).map(([k, v]) => `${k}=${v}`).join(' ');

// deterministic pseudo random numbers
let seed = 20260904;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

// ---- points and sides ----------------------------------------------------
// sides are iSplane planes: unit normal v[0..2] pointing outward, offset v[3]

function pnt(xy){ return iPoint([xy[0], xy[1], 0, 0]); }
function xyOf(p){ return [p.v[0], p.v[1]]; }
function apply(itrans, xy){ return xyOf(itrans.transform(pnt(xy))); }
function sigDist(side, xy){ return U4.sigDistanceSP(side, pnt(xy)); }
function isInside(sides, xy, eps = EPS){ return sides.every(s => sigDist(s, xy) <= eps); }
function isStrictlyInside(sides, xy, eps){ return sides.every(s => sigDist(s, xy) < -eps); }
function isOnBoundary(sides, xy, eps){
  return isInside(sides, xy, eps) && sides.some(s => Math.abs(sigDist(s, xy)) < eps);
}
function dist(p, q){ return Math.hypot(p[0]-q[0], p[1]-q[1]); }

/** the polygon of a domain: corners in cyclic order, the two corners of every side, area, centroid */
function polygon(sides){
  const corners = domainCorners(sides);
  const O = [0, 0];
  corners.forEach(c => { O[0] += c.point[0]/corners.length; O[1] += c.point[1]/corners.length; });
  const sorted = corners.slice().sort((p, q) =>
      Math.atan2(p.point[1]-O[1], p.point[0]-O[0]) - Math.atan2(q.point[1]-O[1], q.point[0]-O[0]));
  const verts = sorted.map(c => c.point);
  let s = 0;
  for(let i = 0; i < verts.length; i++){
    const p = verts[i], q = verts[(i+1)%verts.length];
    s += p[0]*q[1] - q[0]*p[1];
  }
  const sideCorners = sides.map(() => []);
  corners.forEach(c => c.sides.forEach(i => sideCorners[i].push(c.point)));
  return { verts, sideCorners, area: Math.abs(s)/2, centroid: O };
}

function boundingBox(verts){
  const xs = verts.map(v => v[0]), ys = verts.map(v => v[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function randomInside(sides, box, eps){
  for(let k = 0; k < 10000; k++){
    const xy = [box[0] + rnd()*(box[2]-box[0]), box[1] + rnd()*(box[3]-box[1])];
    if(isStrictlyInside(sides, xy, eps)) return xy;
  }
  throw new Error('cannot find a point inside the domain');
}

// ---- folding ----------------------------------------------------------------
// the same loop as Group.toFundDomain(), but keeping the accumulated transform
function fold(group, xy, maxIter = 500){
  const fd = group.getFundDomain();
  const rev = group.getReverseITransforms();
  let p = pnt(xy);
  let total = new ITransform([], '');
  for(let k = 0; k < maxIter; k++){
    const i = fd.findIndex(s => U4.sigDistanceSP(s, p) > EPS);
    if(i < 0) return { ok: true, pnt: xyOf(p), transform: total, steps: k };
    p = rev[i].transform(p);
    total = total.concat(rev[i]);
  }
  return { ok: false };
}

// ---- membership in the group ----------------------------------------------
// T is an element of the group iff folding T(p), for an interior point p of
// the default domain, gives back T^-1: the orbit of p meets the interior of
// a fundamental domain only at p, and a generic p has a trivial stabilizer
const testPoints = [pnt([0.12345, 0.06789]), pnt([-0.07211, 0.16183]), pnt([0.31, -0.2])];
function membershipTest(defaultGroup){
  const p = polygon(defaultGroup.getFundDomain()).centroid;
  return (t) => {
    const f = fold(defaultGroup, apply(t, p));
    return f.ok && sameTransform(f.transform, t.getInverse(), testPoints);
  };
}

// ---- the tests ----------------------------------------------------------------

function testShape(name, geo, shape, defaultArea, isElement){

  console.log(`\n=== ${name}  '${shape}'  (${geoString(geo)}) ===`);
  const group = new Group(iWallpaperGroup({ name, ...geo, domainShape: shape }));
  const fd = group.getFundDomain();
  const genNames = group.getGenNames();

  // 1. polygon and area
  const poly = polygon(fd);
  console.log('  corners:', poly.verts.map(fmt).join(' '));
  check(poly.verts.length === fd.length, `${shape}: ${poly.verts.length} corners for ${fd.length} sides`);
  check(poly.sideCorners.every(cs => cs.length === 2), `${shape}: a side does not have two corners`);
  console.log(`  area: ${poly.area.toFixed(6)}  (default domain ${defaultArea.toFixed(6)})`);
  check(Math.abs(poly.area - defaultArea) < 1e-9, `${shape}: area differs from the default domain`);

  // 2. pairing transforms
  const rev = group.getReverseITransforms();
  check(rev.length === fd.length, `${shape}: ${rev.length} pairing transforms for ${fd.length} sides`);
  rev.forEach((t, i) => {
    console.log(`  side ${i} (${genNames[i]}): ${isometryToString(classifyEuclidean(t))}`);
    check(isElement(t), `${shape}: pairing transform of side ${i} is not an element of ${name}`);
    const [P, Q] = poly.sideCorners[i];
    const mid = [(P[0] + Q[0])/2, (P[1] + Q[1])/2];
    check(Math.abs(sigDist(fd[i], mid)) < 1e-9, `${shape}: midpoint of side ${i} is not on side ${i}`);
    const img = apply(t, mid);
    check(isOnBoundary(fd, img, 1e-7),
          `${shape}: side ${i} is not mapped onto the boundary of the domain (${fmt(mid)} -> ${fmt(img)})`);
  });

  // 3. the cells across the sides do not overlap the domain
  const box = boundingBox(poly.verts);
  const direct = group.getTransforms().map(tr => new ITransform(tr.slice(), ''));
  let overlaps = 0;
  for(let k = 0; k < SAMPLES; k++){
    const q = randomInside(fd, box, 1e-6);
    direct.forEach(t => { if(isStrictlyInside(fd, apply(t, q), 1e-9)) overlaps++; });
  }
  check(overlaps === 0, `${shape}: ${overlaps} sample points of the adjacent cells fall inside the domain`);

  // 4. folding random points of the plane
  const R = 3*A;
  let folded = 0, notElement = 0, inconsistent = 0, maxSteps = 0;
  for(let k = 0; k < SAMPLES; k++){
    const xy = [(2*rnd()-1)*R, (2*rnd()-1)*R];
    const f = fold(group, xy);
    if(!f.ok || !isInside(fd, f.pnt, 1e-9)) continue;
    folded++;
    maxSteps = Math.max(maxSteps, f.steps);
    if(!isElement(f.transform)) notElement++;
    if(dist(apply(f.transform, xy), f.pnt) > 1e-7) inconsistent++;
  }
  check(folded === SAMPLES, `${shape}: ${SAMPLES - folded} of ${SAMPLES} points did not fold into the domain`);
  check(notElement === 0, `${shape}: ${notElement} folding transforms are not elements of ${name}`);
  check(inconsistent === 0, `${shape}: ${inconsistent} folding transforms do not map the point to its fold`);
  console.log(`  folded ${folded}/${SAMPLES} random points, at most ${maxSteps} steps`);
}

const groups = Object.keys(WallpaperDomainShapes);
console.log('groups with domain shapes:', groups.join(' '));

for(const name of groups){
  const shapes = getWallpaperDomainShapes(name);
  console.log(`\n${name}: shapes ${shapes.map(s => `'${s}'`).join(', ')}`);

  // 5. default shape resolution
  check(resolveWallpaperDomainShape(name, undefined) === shapes[0], `${name}: undefined shape does not resolve to the default`);
  check(resolveWallpaperDomainShape(name, 'no such shape') === shapes[0], `${name}: unknown shape does not resolve to the default`);
  check(resolveWallpaperDomainShape(name, DEFAULT_DOMAIN_SHAPE) === shapes[0], `${name}: '${DEFAULT_DOMAIN_SHAPE}' does not resolve to the default`);

  for(const geo of (GEOMETRIES[name] || defaultGeometries)){
    const defaultGroup = new Group(iWallpaperGroup({ name, ...geo }));
    const explicit = new Group(iWallpaperGroup({ name, ...geo, domainShape: shapes[0] }));
    const same = explicit.getFundDomain().every((s, i) =>
        s.v.every((x, k) => Math.abs(x - defaultGroup.getFundDomain()[i].v[k]) < 1e-12));
    check(same, `${name}: the default shape differs from the domain given without domainShape`);

    const defaultArea = polygon(defaultGroup.getFundDomain()).area;
    const isElement = membershipTest(defaultGroup);
    // the membership test must accept the default group's own transforms
    check(defaultGroup.getReverseITransforms().every(isElement), `${name}: membership test rejects the default group's own transforms`);
    for(const shape of shapes) testShape(name, geo, shape, defaultArea, isElement);
  }
}

// regression guard: the historic 632 domain
{
  const H = A*Math.sqrt(3)/2;
  const fd = new Group(iWallpaperGroup({ name: '632', a: A })).getFundDomain();
  const expected = [[A/2, 0], [0, H], [0, -H]];
  const got = polygon(fd).verts;
  const ok = got.length === 3 && expected.every(e => got.some(c => dist(c, e) < 1e-9));
  check(ok, `632 default domain corners ${got.map(fmt).join(' ')} differ from the historic ${expected.map(fmt).join(' ')}`);
}
check(getWallpaperDomainShapes('*442').length === 1 && getWallpaperDomainShapes('*442')[0] === DEFAULT_DOMAIN_SHAPE,
      'a group without shapes should offer just the default shape');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
