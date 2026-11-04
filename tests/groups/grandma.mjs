/*
  tests of Grandma's recipe (lib/grouplib/Group_Grandma.js, Indra's Pearls Box 21)

    node tests/groups/grandma.mjs

  for the traces ta = tb = 3 (Fuchsian), ta = 1.91 + 0.05 i, tb = 3 (the spirals),
  ta = 1.87 + 0.1 i, tb = 1.87 - 0.1 i (double spirals) and ta = 2, tb = 3 (a cusp):
  1. the recipe: det a = det b = 1, tr a = ta, tr b = tb, tr ab = tab, tab solves the
     Markov identity, and the commutator abAB has trace -2
  2. the reflection chains of a, A, b, B act as the matrices on points of the plane
  3. the Dirichlet domain of the origin: at least four sides, the base inside, every
     pairing transform maps its side onto a side and maps an interior point beyond it,
     the sides pair up by their words (g with g^-1)
  4. with real traces the group is Fuchsian: a and b preserve the unit circle and every
     side of the domain is a circle orthogonal to it
  5. random points fold into the domain by the pairing transforms
  6. the isometric circles domain: four sides I(A), I(a), I(B), I(b) paired by a, A, b, B
     (I(a) is mapped onto I(A) by a); the group's generators are named a, A, b, B
*/

// the library first: importing the class file as the entry evaluates GroupMakerFactory
// before the class (a TDZ error), as for every group class
import { Group_Grandma, dirichletSide, dirichletCellAt, dirichletSourceWord, normalizeWord, inverseWord } from '../../lib/grouplib/grouplib.js';
import { grandmaRecipe, mmul, inverse, trace, mobius } from '../../lib/grouplib/Group_Grandma.js';
import { ITransform, iPoint, iTransformU4 } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_SPHERE, SPLANE_PLANE } from '../../lib/invlib/ISplane.js';

const EPS = 1e-7;
const FOLD_POINTS = 300;
const FOLD_MAX_ITER = 5000;

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

let seed = 20261104;
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
// a circle orthogonal to the unit circle: |centre|^2 = r^2 + 1
function orthogonalToUnitCircle(s){
  if(s.type !== SPLANE_SPHERE) return false;
  return Math.abs(s.v[0]*s.v[0] + s.v[1]*s.v[1] - s.v[3]*s.v[3] - 1) < 1e-9;
}
// m preserves the unit circle: m = [[p, q], [conj q, conj p]] up to a unit factor
function preservesUnitCircle(m){
  const [[a, b], [c, d]] = m;
  return cdist(a, [d[0], -d[1]]) < 1e-9 && cdist(b, [c[0], -c[1]]) < 1e-9;
}

// the bases are those of the presets (apps/sympix/presets/grandma): away from the limit
// set, which passes through the fixed points of a (near the origin for the spirals, at the
// origin for the cusp, where a is parabolic)
const CASES = [
  { name: 'Fuchsian',       ta: [3, 0],       tb: [3, 0],       base: [0, 0],     fuchsian: true,  foldRate: 0.97 },
  { name: 'spirals',        ta: [1.91, 0.05], tb: [3, 0],       base: [0, -0.6],  fuchsian: false, foldRate: 0.9 },
  { name: 'double spirals', ta: [1.87, 0.1],  tb: [1.87, -0.1], base: [0.6, 0],   fuchsian: false, foldRate: 0.9 },
  // real traces with tab complex (ta^2 tb^2 < 4 ta^2 + 4 tb^2): not Fuchsian
  { name: 'cusp',           ta: [2, 0],       tb: [3, 0],       base: [-0.6, 0],  fuchsian: false, foldRate: 0.9 },
];

for(const cs of CASES){
  console.log(`\n=== ${cs.name}: ta = ${cfmt(cs.ta)}, tb = ${cfmt(cs.tb)} ===`);

  // 1. the recipe
  const {a, b, tab} = grandmaRecipe(cs.ta, cs.tb);
  const det = m => [m[0][0][0]*m[1][1][0] - m[0][0][1]*m[1][1][1] - (m[0][1][0]*m[1][0][0] - m[0][1][1]*m[1][0][1]),
                    m[0][0][0]*m[1][1][1] + m[0][0][1]*m[1][1][0] - (m[0][1][0]*m[1][0][1] + m[0][1][1]*m[1][0][0])];
  check(cdist(det(a), [1, 0]) < 1e-12, `det a = ${cfmt(det(a))}`);
  check(cdist(det(b), [1, 0]) < 1e-12, `det b = ${cfmt(det(b))}`);
  check(cdist(trace(a), cs.ta) < 1e-12, `tr a = ${cfmt(trace(a))}`);
  check(cdist(trace(b), cs.tb) < 1e-12, `tr b = ${cfmt(trace(b))}`);
  const ab = mmul(a, b);
  check(cdist(trace(ab), tab) < 1e-9, `tr ab = ${cfmt(trace(ab))}, tab = ${cfmt(tab)}`);
  // tab^2 - ta tb tab + ta^2 + tb^2 = 0
  const cm = (u, v) => [u[0]*v[0] - u[1]*v[1], u[0]*v[1] + u[1]*v[0]];
  const markov = [0, 1].map(k => cm(tab, tab)[k] - cm(cm(cs.ta, cs.tb), tab)[k] + cm(cs.ta, cs.ta)[k] + cm(cs.tb, cs.tb)[k]);
  check(Math.hypot(markov[0], markov[1]) < 1e-9, `Markov identity off by ${cfmt(markov)}`);
  const comm = mmul(mmul(a, b), mmul(inverse(a), inverse(b)));
  check(cdist(trace(comm), [-2, 0]) < 1e-9, `tr abAB = ${cfmt(trace(comm))}`);
  console.log(`  tab = ${cfmt(tab)}, tr abAB = ${cfmt(trace(comm))}`);

  // the maker
  const maker = new Group_Grandma();
  const bxy = cs.base || [0, 0];
  const base = iPoint([bxy[0], bxy[1], 0, 0]);
  maker.setParamsMap({ta_re: cs.ta[0], ta_im: cs.ta[1], tb_re: cs.tb[0], tb_im: cs.tb[1], baseX: bxy[0], baseY: bxy[1]});
  const group = maker.getGroup();
  const fd = group.getFundDomain();
  const rev = group.getReverseTransforms();
  console.log(`  Dirichlet domain of ${fmt(bxy)}: ${fd.length} sides, words ${group.dirichletWords ? group.dirichletWords.join(' ') : '(none)'}`);

  // 2. the chains act as the matrices
  const g0 = (() => { maker.setParamsMap({domain: 'isometric circles'}); return maker.getGroup(); })();
  const gens = g0.getTransforms();
  const names = g0.getGenNames();
  const mats = { a, A: inverse(a), b, B: inverse(b) };
  check(names.join('') === 'aAbB', `isometric circles group names ${names.join('')}`);
  for(const z of [[0.1, 0.2], [-0.3, 0.05], [0.4, -0.6]]){
    names.forEach((nm, i) => {
      const w = apply(gens[i], z), v = mobius(mats[nm], z);
      check(cdist(w, v) < 1e-9, `chain of ${nm} maps ${fmt(z)} to ${fmt(w)}, the matrix to ${fmt(v)}`);
    });
  }

  // 6. the isometric circles pair up
  check(fd !== g0.getFundDomain() && g0.getFundDomain().length === 4, 'isometric circles: four sides');
  const fd0 = g0.getFundDomain(), rev0 = g0.getReverseTransforms();
  // side 1 is I(a), mapped by a (= transforms[0], the inverse of rev[0]) onto side 0 = I(A)
  check(sameSplane(iTransformU4(rev0[1], fd0[1]), fd0[0]), 'a does not map I(a) onto I(A)');
  check(sameSplane(iTransformU4(rev0[3], fd0[3]), fd0[2]), 'b does not map I(b) onto I(B)');
  maker.setParamsMap({domain: 'dirichlet'});

  // 3. the Dirichlet domain
  check(fd.length >= 4, `${fd.length} sides`);
  check(rev.length === fd.length, `${rev.length} pairings for ${fd.length} sides`);
  check(isStrictlyInside(fd, bxy, 1e-9), 'the base is not inside the domain');
  const box = boundingBox(fd);
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
  // the words pair up: the inverse of a word (letters reversed, a<->A, b<->B) is a side's word
  const invWord = w => w.split('').reverse().map(ch => ({a: 'A', A: 'a', b: 'B', B: 'b'})[ch]).join('');
  const words = group.dirichletWords || [];
  words.forEach(w => check(words.includes(invWord(w)), `the side of ${w} has no partner side ${invWord(w)}`));
  // the domain is the group's, not a subgroup's: each generator's image of the base
  // folds back to the base by the pairings (the generator is a product of the sides)
  for(const g of ['a', 'A', 'b', 'B']){
    const img = dirichletSide(g0, base, g);
    const cell = dirichletCellAt(group, base, [img.point.v[0], img.point.v[1]], 5000);
    const w = cell ? normalizeWord(g0, inverseWord(g0, dirichletSourceWord(group, cell.word)) + g) : null;
    check(w === '' || w === null && cell === null && false, `the generator ${g} is not a product of the sides (its image folds to ${cell ? cell.word : 'nowhere'}: ${w})`);
  }

  // 4. Fuchsian: the unit circle is preserved and the sides are its geodesics
  if(cs.fuchsian){
    check(preservesUnitCircle(a) && preservesUnitCircle(b), 'a or b does not preserve the unit circle');
    fd.forEach((s, i) => check(orthogonalToUnitCircle(s), `side ${i} is not orthogonal to the unit circle`));
  }

  // 5. folding
  let ok = 0, maxSteps = 0;
  for(let k = 0; k < FOLD_POINTS; k++){
    const f = fold(group, randomInBox(box), FOLD_MAX_ITER);
    if(f.ok){ ok++; maxSteps = Math.max(maxSteps, f.steps); }
  }
  console.log(`  fold: ${ok} of ${FOLD_POINTS} points in at most ${maxSteps} steps`);
  check(ok/FOLD_POINTS >= cs.foldRate, `only ${ok} of ${FOLD_POINTS} points fold into the domain`);
}

// the other root of the Markov identity gives another pair with the same traces
{
  const {a, b, tab} = grandmaRecipe([1.91, 0.05], [3, 0], true);
  const comm = mmul(mmul(a, b), mmul(inverse(a), inverse(b)));
  check(cdist(trace(comm), [-2, 0]) < 1e-9, `other root: tr abAB = ${cfmt(trace(comm))}`);
  console.log(`\nother root for ta = 1.91 + 0.05 i, tb = 3: tab = ${cfmt(tab)}`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall checks passed');
process.exit(failures ? 1 : 0);
