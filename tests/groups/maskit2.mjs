/*
  tests of Maskit's twice punctured torus groups (lib/grouplib/Group_Maskit2.js;
  Indra's Pearls p. 367, C. Series, The Maskit embedding of the twice punctured torus)

    node tests/groups/maskit2.mjs

  for the parameters of the presets (apps/sympix/presets/maskit2):
  1. the generators: a and b parabolic (trace 2) with the fixed points oo and 0, det c = 1,
     the punctures a B (trace -2, fixed point 1) and a c B C (trace -2)
  2. the reflection chains of a, A, b, B, c, C act as the matrices on points of the plane
  3. the Dirichlet domain of the base: at least six sides, the base inside, every pairing
     transform maps its side onto a side and an interior point beyond it, the words pair
     up (g with g^-1), the generators are products of the sides
  4. random points fold into the domain by the pairing transforms
*/

import { Group_Maskit2, dirichletSide, dirichletCellAt, dirichletSourceWord, normalizeWord, inverseWord } from '../../lib/grouplib/grouplib.js';
import { maskit2Generators } from '../../lib/grouplib/Group_Maskit2.js';
import { mmul, minverse, mtrace, mdet, mobius, wordMatrix } from '../../lib/grouplib/MobiusGenerators.js';
import { ITransform, iPoint, iTransformU4 } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_SPHERE, SPLANE_PLANE } from '../../lib/invlib/ISplane.js';

const EPS = 1e-7;
const FOLD_POINTS = 300;
const FOLD_MAX_ITER = 5000;
const FOLD_MIN_RATE = 0.9;

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

let seed = 20261105;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

const num = x => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(4);
const fmt = xy => `(${num(xy[0])},${num(xy[1])})`;
const cfmt = z => `${num(z[0])}${z[1] < 0 ? '-' : '+'}${num(Math.abs(z[1]))}i`;
const cdist = (u, v) => Math.hypot(u[0]-v[0], u[1]-v[1]);

function pnt(xy){ return iPoint([xy[0], xy[1], 0, 0]); }
function xyOf(p){ return [p.v[0], p.v[1]]; }
function apply(chain, xy){ return xyOf(new ITransform(chain).transform(pnt(xy))); }
function sigDist(side, xy){ return U4.sigDistanceSP(side, pnt(xy)); }
function isStrictlyInside(sides, xy, eps){ return sides.every(s => sigDist(s, xy) < -eps); }

function sameSplane(a, b, eps = 1e-6){
  if(a.type !== b.type) return false;
  const u = a.v, w = b.v;
  if(a.type === SPLANE_SPHERE){
    return Math.hypot(u[0]-w[0], u[1]-w[1], u[2]-w[2]) < eps && Math.abs(Math.abs(u[3]) - Math.abs(w[3])) < eps;
  }
  if(a.type === SPLANE_PLANE){
    const nu = Math.hypot(u[0], u[1], u[2]), nw = Math.hypot(w[0], w[1], w[2]);
    const same = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu - w[i]/nw) < eps);
    const opp  = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu + w[i]/nw) < eps);
    return same || opp;
  }
  return false;
}

// a box around the circles of the domain, and around the base for the lines
function boundingBox(sides, base){
  let xmin = base[0] - 1.5, ymin = base[1] - 1.5, xmax = base[0] + 1.5, ymax = base[1] + 1.5;
  for(const s of sides){
    if(s.type !== SPLANE_SPHERE) continue;
    const r = Math.abs(s.v[3]);
    xmin = Math.min(xmin, s.v[0]-r); xmax = Math.max(xmax, s.v[0]+r);
    ymin = Math.min(ymin, s.v[1]-r); ymax = Math.max(ymax, s.v[1]+r);
  }
  const dx = 0.2*(xmax-xmin), dy = 0.2*(ymax-ymin);
  return [xmin-dx, ymin-dy, xmax+dx, ymax+dy];
}
function randomInBox(box){ return [box[0] + rnd()*(box[2]-box[0]), box[1] + rnd()*(box[3]-box[1])]; }
function randomInside(sides, box){
  for(let k = 0; k < 20000; k++){
    const xy = randomInBox(box);
    if(isStrictlyInside(sides, xy, 1e-6)) return xy;
  }
  return null;
}
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

const CASES = [
  { name: 'symmetric',     t1: [0, 2.5],    t2: [0, 2.5],    base: [0, 1.25] },
  { name: 'skew',          t1: [0.5, 2.2],  t2: [-0.3, 2.6], base: [0, 1.1] },
  { name: 'near boundary', t1: [1.2, 1.6],  t2: [0.4, 2.6],  base: [0, 0.8] },
  { name: 'tall',          t1: [0, 3.5],    t2: [0, 1.5],    base: [0, 1.75] },
];

const invLetter = ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
const invWord = w => w.split('').reverse().map(invLetter).join('');

for(const cs of CASES){
  console.log(`\n=== ${cs.name}: tau1 = ${cfmt(cs.t1)}, tau2 = ${cfmt(cs.t2)}, base ${fmt(cs.base)} ===`);

  // 1. the generators and the punctures
  const {a, b, c} = maskit2Generators(cs.t1, cs.t2);
  const M = { a, A: minverse(a), b, B: minverse(b), c, C: minverse(c) };
  check(cdist(mtrace(a), [2, 0]) < 1e-12 && cdist(mobius(a, [0.3, 0.2]), [2.3, 0.2]) < 1e-12, 'a is not z -> z + 2');
  check(cdist(mtrace(b), [2, 0]) < 1e-12 && cdist(mobius(b, [0, 0]), [0, 0]) < 1e-12, 'b is not parabolic with the fixed point 0');
  check(cdist(mdet(c), [1, 0]) < 1e-12, `det c = ${cfmt(mdet(c))}`);
  const p1 = wordMatrix('aB', M), p2 = wordMatrix('acBC', M);
  check(cdist(mtrace(p1), [-2, 0]) < 1e-9 && cdist(mobius(p1, [1, 0]), [1, 0]) < 1e-9, `the puncture aB: trace ${cfmt(mtrace(p1))}`);
  check(cdist(mtrace(p2), [-2, 0]) < 1e-9, `the puncture acBC: trace ${cfmt(mtrace(p2))}`);
  console.log(`  tr c = ${cfmt(mtrace(c))}, tr aB = ${cfmt(mtrace(p1))}, tr acBC = ${cfmt(mtrace(p2))}`);

  // the maker
  const maker = new Group_Maskit2();
  const base = iPoint([cs.base[0], cs.base[1], 0, 0]);
  maker.setParamsMap({t1_re: cs.t1[0], t1_im: cs.t1[1], t2_re: cs.t2[0], t2_im: cs.t2[1], baseX: cs.base[0], baseY: cs.base[1]});
  const group = maker.getGroup();
  const fd = group.getFundDomain();
  const rev = group.getReverseTransforms();
  console.log(`  Dirichlet domain: ${fd.length} sides, words ${group.dirichletWords ? group.dirichletWords.join(' ') : '(none)'}`);

  // 2. the chains act as the matrices (the carrier group's generators)
  const g0 = maker.getGenerators ? null : null;
  {
    const { carrierGroup } = await import('../../lib/grouplib/MobiusGenerators.js');
    const carrier = carrierGroup([{name: 'a', m: a}, {name: 'b', m: b}, {name: 'c', m: c}]);
    const gens = carrier.getTransforms();
    const names = carrier.getGenNames();
    check(names.join('') === 'aAbBcC', `carrier names ${names.join('')}`);
    for(const z of [[0.1, 0.2], [-0.3, 1.05], [0.4, 2.6]]){
      names.forEach((nm, i) => {
        const w = apply(gens[i], z), v = mobius(M[nm], z);
        check(cdist(w, v) < 1e-9, `chain of ${nm} maps ${fmt(z)} to ${fmt(w)}, the matrix to ${fmt(v)}`);
      });
    }
  }

  // 3. the Dirichlet domain
  check(fd.length >= 6, `${fd.length} sides`);
  check(rev.length === fd.length, `${rev.length} pairings for ${fd.length} sides`);
  check(isStrictlyInside(fd, cs.base, 1e-9), 'the base is not inside the domain');
  const box = boundingBox(fd, cs.base);
  const inside = randomInside(fd, box);
  if(check(inside !== null, 'no interior point found')){
    fd.forEach((side, i) => {
      const image = iTransformU4(rev[i], side);
      const j = fd.findIndex(s => sameSplane(image, s));
      check(j >= 0, `the pairing of side ${i} (${group.dirichletWords[i]}) does not map it onto a side`);
      const across = apply(rev[i].slice().reverse(), inside);
      check(sigDist(side, across) > EPS, `the generator of side ${i} maps ${fmt(inside)} to ${fmt(across)}, not beyond its side`);
    });
  }
  const words = group.dirichletWords || [];
  words.forEach(w => check(words.includes(invWord(w)), `the side of ${w} has no partner side ${invWord(w)}`));
  {
    const { carrierGroup } = await import('../../lib/grouplib/MobiusGenerators.js');
    const carrier = carrierGroup([{name: 'a', m: a}, {name: 'b', m: b}, {name: 'c', m: c}]);
    for(const g of ['a', 'A', 'b', 'B', 'c', 'C']){
      const img = dirichletSide(carrier, base, g);
      const cell = dirichletCellAt(group, base, [img.point.v[0], img.point.v[1]], 5000);
      const w = cell ? normalizeWord(carrier, inverseWord(carrier, dirichletSourceWord(group, cell.word)) + g) : null;
      check(w === '', `the generator ${g} is not a product of the sides (its image folds to ${cell ? cell.word : 'nowhere'}: ${w})`);
    }
  }

  // 4. folding
  let ok = 0, maxSteps = 0;
  for(let k = 0; k < FOLD_POINTS; k++){
    const f = fold(group, randomInBox(box), FOLD_MAX_ITER);
    if(f.ok){ ok++; maxSteps = Math.max(maxSteps, f.steps); }
  }
  console.log(`  fold: ${ok} of ${FOLD_POINTS} points in at most ${maxSteps} steps`);
  check(ok/FOLD_POINTS >= FOLD_MIN_RATE, `only ${ok} of ${FOLD_POINTS} points fold into the domain`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall checks passed');
process.exit(failures ? 1 : 0);
