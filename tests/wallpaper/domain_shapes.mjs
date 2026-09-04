/*
  test for the fundamental domain shapes of the wallpaper groups
  (lib/grouplib/WallpaperGroups.js: WallpaperDomainShapes, the domainShape parameter)

    node tests/wallpaper/domain_shapes.mjs

  for every shape of every group which offers domain shapes:
  1. the sides, listed in cyclic order, close up into a convex polygon with the
     area of the group's default domain (all fundamental domains of a group
     have the same area)
  2. each pairing transform is an element of the group (for 632: an orientation
     preserving isometry which maps the lattice of 6-fold points onto itself)
     and maps the midpoint of its side onto the boundary of the domain
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
import { classifyEuclidean, isometryToString } from '../../lib/grouplib/SubgroupDomain.js';

const A = 0.5;            // scale parameter of the groups
const EPS = 1e-9;
const SAMPLES = 400;      // random points per check
const SQRT3 = Math.sqrt(3);

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }
const num = x => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(4);
const fmt = xy => `(${num(xy[0])},${num(xy[1])})`;

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

function lineIntersection(p, q){
  const [a1, b1, , d1] = p.v, [a2, b2, , d2] = q.v;
  const det = a1*b2 - a2*b1;
  if(Math.abs(det) < 1e-12) return null;
  return [(d1*b2 - d2*b1)/det, (a1*d2 - a2*d1)/det];
}

// corners of the domain: corner i is where side i meets side i+1
function corners(sides){
  const n = sides.length, out = [];
  for(let i = 0; i < n; i++){
    const c = lineIntersection(sides[i], sides[(i+1)%n]);
    if(!c) return null;
    out.push(c);
  }
  return out;
}

function polygonArea(verts){
  let s = 0;
  for(let i = 0; i < verts.length; i++){
    const p = verts[i], q = verts[(i+1)%verts.length];
    s += p[0]*q[1] - q[0]*p[1];
  }
  return Math.abs(s)/2;
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

// ---- membership in the group ----------------------------------------------
// 632 with the default geometry: 6-fold points at (0,H) and (0,-H), 3-fold at
// (H/sqrt3,0), 2-fold at the origin.  632 is the group of orientation preserving
// isometries which map the lattice of 6-fold points onto itself.
const H = A*SQRT3/2;
const LATTICE = [[0, H], [0, -H], [SQRT3*H, 0]];

function isLatticePoint632(xy){
  // xy = (0,H) + i*(0,2H) + j*(sqrt3 H, -H)
  const j = xy[0]/(SQRT3*H);
  const i = (xy[1] - H + j*H)/(2*H);
  return Math.abs(i - Math.round(i)) < 1e-7 && Math.abs(j - Math.round(j)) < 1e-7;
}
function orientation(p, q, r){ return Math.sign((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])); }
function isElementOf632(itrans){
  const img = LATTICE.map(p => apply(itrans, p));
  return img.every(isLatticePoint632) && orientation(...img) === orientation(...LATTICE);
}
const MEMBERSHIP = { '632': isElementOf632 };

// ---- folding ----------------------------------------------------------------
// the same loop as Group.toFundDomain(), but keeping the accumulated transform
function fold(group, xy, maxIter = 200){
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

// ---- the tests ----------------------------------------------------------------

function testShape(name, shape, defaultArea){

  console.log(`\n=== ${name}  '${shape}' ===`);
  const isElement = MEMBERSHIP[name];
  const group = new Group(iWallpaperGroup({ name, a: A, domainShape: shape }));
  const fd = group.getFundDomain();
  const genNames = group.getGenNames();

  // 1. polygon and area
  const verts = corners(fd);
  if(!check(verts !== null, `${shape}: consecutive sides are parallel`)) return;
  console.log('  corners:', verts.map(fmt).join(' '));
  check(verts.every(v => isInside(fd, v, 1e-7)),
        `${shape}: a corner lies outside the domain - sides not in cyclic order?`);
  const area = polygonArea(verts);
  console.log(`  area: ${area.toFixed(6)}  (default domain ${defaultArea.toFixed(6)})`);
  check(Math.abs(area - defaultArea) < 1e-9, `${shape}: area differs from the default domain`);

  // 2. pairing transforms
  const rev = group.getReverseITransforms();
  check(rev.length === fd.length, `${shape}: ${rev.length} pairing transforms for ${fd.length} sides`);
  rev.forEach((t, i) => {
    console.log(`  side ${i} (${genNames[i]}): ${isometryToString(classifyEuclidean(t))}`);
    if(isElement)
      check(isElement(t), `${shape}: pairing transform of side ${i} is not an element of ${name}`);
    const n = fd.length;
    const mid = [(verts[(i+n-1)%n][0] + verts[i][0])/2, (verts[(i+n-1)%n][1] + verts[i][1])/2];
    check(Math.abs(sigDist(fd[i], mid)) < 1e-9, `${shape}: midpoint of side ${i} is not on side ${i}`);
    const img = apply(t, mid);
    check(isOnBoundary(fd, img, 1e-7),
          `${shape}: side ${i} is not mapped onto the boundary of the domain (${fmt(mid)} -> ${fmt(img)})`);
  });
  if(!isElement) console.log('  (no membership test for this group)');

  // 3. the cells across the sides do not overlap the domain
  const box = boundingBox(verts);
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
    if(isElement && !isElement(f.transform)) notElement++;
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
  const defaultGroup = new Group(iWallpaperGroup({ name, a: A }));
  const defaultArea = polygonArea(corners(defaultGroup.getFundDomain()));
  console.log(`\n${name}: shapes ${shapes.map(s => `'${s}'`).join(', ')}`);

  // 5. default shape resolution
  check(resolveWallpaperDomainShape(name, undefined) === shapes[0], `${name}: undefined shape does not resolve to the default`);
  check(resolveWallpaperDomainShape(name, 'no such shape') === shapes[0], `${name}: unknown shape does not resolve to the default`);
  check(resolveWallpaperDomainShape(name, DEFAULT_DOMAIN_SHAPE) === shapes[0], `${name}: '${DEFAULT_DOMAIN_SHAPE}' does not resolve to the default`);
  const explicit = new Group(iWallpaperGroup({ name, a: A, domainShape: shapes[0] }));
  const same = explicit.getFundDomain().every((s, i) =>
      s.v.every((x, k) => Math.abs(x - defaultGroup.getFundDomain()[i].v[k]) < 1e-12));
  check(same, `${name}: the default shape differs from the domain given without domainShape`);

  for(const shape of shapes) testShape(name, shape, defaultArea);
}

// regression guard: the historic 632 domain
{
  const fd = new Group(iWallpaperGroup({ name: '632', a: A })).getFundDomain();
  const expected = [[0, H], [A/2, 0], [0, -H]];
  const got = corners(fd);
  const ok = got.length === 3 && got.every((c, i) => dist(c, expected[i]) < 1e-9);
  check(ok, `632 default domain corners ${got.map(fmt).join(' ')} differ from the historic ${expected.map(fmt).join(' ')}`);
}
check(getWallpaperDomainShapes('*442').length === 1 && getWallpaperDomainShapes('*442')[0] === DEFAULT_DOMAIN_SHAPE,
      'a group without shapes should offer just the default shape');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
