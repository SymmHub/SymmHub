/*
  tests of the groups imported from the Orb repo
  (lib/grouplib/Group_Cyclic.js, Group_ON.js, Group_s22222.js, Group_22222.js, Group_s222222.js)

    node tests/groups/orb_groups.mjs

  for each class, with its defaults and with the group parameters of every preset in
  apps/sympix/presets/<folder> (the old Orb presets, converted):
  1. the group builds: finite splanes, one pairing transform per side (the reflections
     for the reflection groups)
  2. each pairing transform maps its side onto a side of the domain (its partner), and
     maps an interior point of the domain beyond that side; skipped for Group_ON with
     twist != 0, whose twisted pairings do not keep the side pairing (see the class comment)
  3. with the default parameters random points fold into the domain by the pairing
     transforms within a bounded number of steps
  4. Group_s22222 and Group_s222222 with the angles 0: consecutive sides are orthogonal
     and the circles are centred on the x axis; Group_Cyclic: the generator maps a point z
     to AbsLambda^2 e^{2 i ArgLambda} z; Group_ON: the pairing of S4 and S4a is the
     rotation by 2 pi / N about the origin
*/

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Group_Cyclic,
  Group_ON,
  Group_s22222,
  Group_22222,
  Group_s222222,
} from '../../lib/grouplib/grouplib.js';
import { ITransform, iPoint, iTransformU4 } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_SPHERE, SPLANE_PLANE } from '../../lib/invlib/ISplane.js';

const EPS = 1e-7;
const FOLD_POINTS = 300;
const FOLD_MAX_ITER = 5000;
const FOLD_MIN_RATE = 0.97;   // points near the limit set may need more steps than allowed

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

// deterministic pseudo random numbers
let seed = 20261026;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

const num = x => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(4);
const fmt = xy => `(${num(xy[0])},${num(xy[1])})`;

// ---- points and splanes ----------------------------------------------------

function pnt(xy){ return iPoint([xy[0], xy[1], 0, 0]); }
function xyOf(p){ return [p.v[0], p.v[1]]; }
function apply(chain, xy){ return xyOf(new ITransform(chain).transform(pnt(xy))); }
function sigDist(side, xy){ return U4.sigDistanceSP(side, pnt(xy)); }
function isStrictlyInside(sides, xy, eps){ return sides.every(s => sigDist(s, xy) < -eps); }
function isFiniteSplane(s){ return s && s.v && s.v.length === 4 && s.v.every(Number.isFinite); }

// the same splane as a set, whatever its orientation
function sameSplane(a, b, eps = 1e-6){
  if(a.type !== b.type) return false;
  const u = a.v, w = b.v;
  if(a.type === SPLANE_SPHERE){
    return Math.hypot(u[0]-w[0], u[1]-w[1], u[2]-w[2]) < eps
        && Math.abs(Math.abs(u[3]) - Math.abs(w[3])) < eps;
  }
  if(a.type === SPLANE_PLANE){
    const nu = Math.hypot(u[0], u[1], u[2]), nw = Math.hypot(w[0], w[1], w[2]);
    const same = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu - w[i]/nw) < eps);
    const opp  = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu + w[i]/nw) < eps);
    return same || opp;
  }
  return false;
}

// two splanes at right angles
function areOrthogonal(a, b, eps = 1e-9){
  if(a.type === SPLANE_SPHERE && b.type === SPLANE_SPHERE){
    const d2 = (a.v[0]-b.v[0])**2 + (a.v[1]-b.v[1])**2;
    return Math.abs(d2 - a.v[3]*a.v[3] - b.v[3]*b.v[3]) < eps;
  }
  if(a.type === SPLANE_PLANE) [a, b] = [b, a];
  if(a.type === SPLANE_SPHERE && b.type === SPLANE_PLANE){
    // the centre lies on the plane (n.c = d, the normal of these planes is unit)
    return Math.abs(b.v[0]*a.v[0] + b.v[1]*a.v[1] - b.v[3]) < eps;
  }
  return false;
}

// a box around the circles of the domain
function boundingBox(sides){
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for(const s of sides){
    if(s.type !== SPLANE_SPHERE) continue;
    const r = Math.abs(s.v[3]);
    xmin = Math.min(xmin, s.v[0]-r); xmax = Math.max(xmax, s.v[0]+r);
    ymin = Math.min(ymin, s.v[1]-r); ymax = Math.max(ymax, s.v[1]+r);
  }
  if(!Number.isFinite(xmin)) return [-2, -2, 2, 2];
  const dx = 0.2*(xmax-xmin), dy = 0.2*(ymax-ymin);
  return [xmin-dx, ymin-dy, xmax+dx, ymax+dy];
}

function randomInBox(box){
  return [box[0] + rnd()*(box[2]-box[0]), box[1] + rnd()*(box[3]-box[1])];
}

function randomInside(sides, box){
  for(let k = 0; k < 20000; k++){
    const xy = randomInBox(box);
    if(isStrictlyInside(sides, xy, 1e-6)) return xy;
  }
  return null;
}

// the same loop as Group.toFundDomain()
function fold(group, xy, maxIter){
  const fd = group.getFundDomain();
  const rev = group.getReverseITransforms();
  let p = pnt(xy);
  for(let k = 0; k < maxIter; k++){
    const i = fd.findIndex(s => U4.sigDistanceSP(s, p) > EPS);
    if(i < 0) return { ok: true, steps: k };
    p = rev[i].transform(p);
    if(!p.v.every(Number.isFinite)) return { ok: false };
  }
  return { ok: false };
}

// ---- the parameter sets ---------------------------------------------------------

const here = fileURLToPath(new URL('.', import.meta.url));

function presetParamSets(folder, className){
  const dir = `${here}/../../apps/sympix/presets/${folder}`;
  if(!existsSync(dir)) return [];
  const sets = [];
  for(const f of readdirSync(dir).filter(n => n.endsWith('.json')).sort()){
    const doc = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    const g = doc.params?.symmetry?.group;
    if(g && g.className === className) sets.push({ name: f, params: g.params });
  }
  return sets;
}

const paramString = p => Object.entries(p).map(([k, v]) => `${k}=${v}`).join(' ');

// ---- the tests ----------------------------------------------------------------

function testGroup(Cls, folder, options, label, params){

  const maker = new Cls();
  if(params) maker.setParamsMap(params);
  const group = maker.getGroup();
  const fd = group.getFundDomain();
  const rev = group.getReverseTransforms();

  console.log(`--- ${maker.getClassName()}  ${label}: ${paramString(maker.params)}`);

  // 1. the group builds
  check(fd.length > 0, 'no sides');
  check(fd.every(isFiniteSplane), 'a side is not a finite splane');
  check(rev.length === fd.length, `${rev.length} pairing transforms for ${fd.length} sides`);
  check(rev.every(chain => chain.every(isFiniteSplane)), 'a pairing transform has a non finite splane');

  // an interior point
  const box = boundingBox(fd);
  const inside = randomInside(fd, box);
  if(!check(inside !== null, 'no interior point found in ' + fmt(box) + ' - ' + fmt(box.slice(2)))) return group;

  // 2. side pairing
  const skipPairing = options.skipPairing && options.skipPairing(maker.params);
  if(skipPairing){
    console.log('  side pairing not checked:', skipPairing);
  } else {
    fd.forEach((side, i) => {
      const image = iTransformU4(rev[i], side);
      const j = fd.findIndex(s => sameSplane(image, s));
      check(j >= 0, `the pairing transform of side ${i} does not map it onto a side`);
      const across = apply(rev[i].slice().reverse(), inside);
      check(sigDist(side, across) > EPS,
            `the generator of side ${i} maps the interior point ${fmt(inside)} to ${fmt(across)}, not beyond its side`);
    });
  }

  // 3. folding
  if(options.fold){
    let ok = 0, maxSteps = 0;
    for(let k = 0; k < FOLD_POINTS; k++){
      const f = fold(group, randomInBox(box), FOLD_MAX_ITER);
      if(f.ok){ ok++; maxSteps = Math.max(maxSteps, f.steps); }
    }
    const rate = ok/FOLD_POINTS;
    console.log(`  fold: ${ok} of ${FOLD_POINTS} points in at most ${maxSteps} steps`);
    check(rate >= FOLD_MIN_RATE, `only ${ok} of ${FOLD_POINTS} points fold into the domain`);
  }

  if(options.extra) options.extra(maker, group, fd, rev);
  return group;
}

function testClass(Cls, folder, options){
  const className = new Cls().getClassName();
  console.log(`\n=== ${className} ===`);
  testGroup(Cls, folder, { ...options, fold: true }, 'defaults', null);
  const sets = presetParamSets(folder, className);
  console.log(`  ${sets.length} preset parameter sets in apps/sympix/presets/${folder}`);
  for(const set of sets) testGroup(Cls, folder, { ...options, fold: false }, set.name, set.params);
}

// right-angled polygons: with the angles 0 every circle is centred on the x axis and
// consecutive sides are orthogonal
function rightAngles(maker, group, fd){
  const angles = Object.keys(maker.params).filter(k => /^A\d$/.test(k)).map(k => maker.params[k]);
  if(!angles.every(a => a === 0)) return;
  fd.forEach(s => { if(s.type === SPLANE_SPHERE) check(Math.abs(s.v[1]) < 1e-12, 'a circle is not centred on the x axis'); });
  for(let i = 0; i < fd.length; i++){
    const a = fd[i], b = fd[(i+1)%fd.length];
    check(areOrthogonal(a, b), `sides ${i} and ${(i+1)%fd.length} are not orthogonal`);
  }
}

// the cyclic group: the generator is z -> |lambda|^2 e^{2 i arg} z
function cyclicGenerator(maker, group, fd, rev){
  if(maker.params.finiteFP) return;
  const lam = maker.params.AbsLambda, a = 2*maker.params.ArgLambda*Math.PI/180;
  const z = [0.3, 0.2];
  const w = apply(rev[0].slice().reverse(), z);
  const m = lam*lam;
  const expected = [m*(Math.cos(a)*z[0] - Math.sin(a)*z[1]), m*(Math.sin(a)*z[0] + Math.cos(a)*z[1])];
  check(Math.hypot(w[0]-expected[0], w[1]-expected[1]) < 1e-9,
        `the generator maps ${fmt(z)} to ${fmt(w)}, expected ${fmt(expected)}`);
}

// oN: S4 and S4a are paired by the rotation by 2 pi / N about the origin
function coneRotation(maker, group, fd, rev){
  if(maker.params.bend3 !== 0) return;
  const N = maker.params.N;
  const z = [0.3, 0.1];
  const w = apply(rev[0].slice().reverse(), z);
  const rz = Math.hypot(z[0], z[1]), rw = Math.hypot(w[0], w[1]);
  let da = Math.atan2(w[1], w[0]) - Math.atan2(z[1], z[0]);
  da = Math.abs(((da % (2*Math.PI)) + 3*Math.PI) % (2*Math.PI) - Math.PI);
  check(Math.abs(rz - rw) < 1e-9 && Math.abs(da - 2*Math.PI/N) < 1e-9,
        `the pairing of S4 and S4a turns ${fmt(z)} to ${fmt(w)}, not by 2 pi / ${N} about the origin`);
}

testClass(Group_s22222,  's22222',  { extra: rightAngles });
testClass(Group_s222222, 's222222', { extra: rightAngles });
testClass(Group_22222,   '22222',   {});
testClass(Group_Cyclic,  'cyclic',  { extra: cyclicGenerator });
testClass(Group_ON,      'on',      {
  extra: coneRotation,
  skipPairing: p => (p.twist !== 0) ? `twist = ${p.twist} (twisted pairings move the sides)` : null,
});

console.log(failures ? `\n${failures} FAILURES` : '\nall checks passed');
process.exit(failures ? 1 : 0);
