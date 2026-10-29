/*
  tests of the classification of the transforms of a group (lib/symhublib/TransformUtils.js,
  the 'analyze' button of the fixed points transform)

    node tests/transforms/classification.mjs

  1. the bent KLMN group of the symdraw preset bending/par_s2223-6 is planar and is
     classified by Moebius matrices: its generators a (hyperbolic), b (order 3), C (half
     turn) are in their buckets, the powers of a transform are in its bucket (a, A, aa;
     bC, CB, bCbC), there are no parabolics, no identities
  2. the Dirichlet group of the preset (what the analyze window gets in the app): the
     words of its 12 pairings, rewritten in the exact KLMN generators, give the same
     types, periods and rotations (2026-10-29: the H4 eigenvalues made half turns
     hyperbolic, order 3 rotations loxodromic and put noise into the buckets); the
     elliptic transforms are one bucket of rotations by 2/3, the hyperbolic ones two
  3. the powers of a transform go to its bucket also when a power is made first
  4. orientation reversing planar transforms: reflection, glide reflection, rotary
     reflection, the antipodal map, a parabolic glide
  5. a group with a splane off the plane z = 0 is classified by the H4 matrices
*/

import { Group_KLMN, makeDirichletGroup, dirichletBase, parseWords } from '../../lib/grouplib/grouplib.js';
import { GroupUtils, ITransform, iSphere, iPlane } from '../../lib/invlib/invlib.js';
import {
  TRANSFORM_TYPES,
  makeTransformClassificationU4,
  classifyMobiusU4,
  getMatrixMobius,
  isPlanarTransform,
} from '../../lib/symhublib/TransformUtils.js';

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** the bucket of the classification which holds the word: [type, key] */
function bucketOf(tc, word){
  for(const type of TRANSFORM_TYPES){
    for(const key of Object.keys(tc[type])){
      if(key !== 'count' && tc[type][key].some(r => r.word === word)) return [type, key];
    }
  }
  return null;
}
function buckets(tc, type){ return Object.keys(tc[type]).filter(k => k !== 'count'); }

const PRESET_PARAMS = { s: false, K: 3, L: 2, M: 2, N: 2, twist: 0.0169, aspect: 0.49, bend: 34, uhp: true };
const klmn = new Group_KLMN();
klmn.setParamsMap(PRESET_PARAMS);
const group = klmn.getGroup();

// ---- 1. the KLMN group ----------------------------------------------------------------

console.log('1. the bent KLMN group of par_s2223-6');
{
  const gens = group.getTransforms();
  check(gens.every(g => isPlanarTransform(g)), 'the generators are planar');
  const t = Date.now();
  const tc = makeTransformClassificationU4(gens, { maxPeriod: 10, maxCount: 10000 });
  console.log(`   ${tc.acceptedCount} transforms in ${Date.now() - t} ms`);
  check(tc.planar, 'classified as a planar group');
  check(tc.acceptedCount === 10000, `10000 transforms accepted (${tc.acceptedCount})`);
  const ba = bucketOf(tc, 'a'), bb = bucketOf(tc, 'b'), bc = bucketOf(tc, 'C');
  check(ba && ba[0] === 'hyperbolic(+)' && ba[1] === '[1.4267]', `a: hyperbolic [1.4267] (${ba})`);
  check(bb && bb[0] === 'elliptical(+)' && bb[1] === '[0.6667]', `b: elliptical [0.6667] (${bb})`);
  check(bc && bc[0] === 'half turn', `C: half turn (${bc})`);
  for(const w of ['A', 'aa', 'AA'])
    check(String(bucketOf(tc, w)) === String(ba), `${w} in the bucket of a (${bucketOf(tc, w)})`);
  const bl = bucketOf(tc, 'bC');
  check(bl && bl[0] === 'loxodromic(+)' && bl[1] === '[0.0979,0.1091]', `bC: loxodromic [0.0979,0.1091] (${bl})`);
  for(const w of ['CB', 'bCbC'])
    check(String(bucketOf(tc, w)) === String(bl), `${w} in the bucket of bC (${bucketOf(tc, w)})`);
  check(tc['parabolic(+)'].count === 0 && tc['identity'].count === 0, 'no parabolics, no identities');
  check(buckets(tc, 'elliptical(+)').length === 1, `one elliptic bucket (${buckets(tc, 'elliptical(+)')})`);
}

// ---- 2. the Dirichlet group of the preset ---------------------------------------------

console.log('2. the Dirichlet group of par_s2223-6 against the exact generators');
{
  const base = dirichletBase({ baseX: 0.13563514348191294, baseY: 0.12021362958994072 });
  const words = parseWords('bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcbcbcaBacbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcacbcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcAbAcBcBcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcAbAcBcBcbcbcaBacbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcacbcbcbcaB bAcBcBcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcbcaB bAcBcbcbcaB bAcBcBcBcB acbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcaB bAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcBcBcB');
  const dg = makeDirichletGroup(group, { base, words });
  const gens = GroupUtils.trans2itrans(dg.getTransforms());
  const names = gens.map(g => g.word);

  // the pairing of each generator, as the reflections of the exact KLMN generators: the
  // inverse of the transform of a side's word, matched to the generator by its matrix
  const exact = dg.dirichletWords.map(w => GroupUtils.getInverseTransform(group.word2trans(w)));
  const normalized = t => {
    const { m } = getMatrixMobius(t);
    const [[a, b], [c, d]] = m;
    const det = [a[0]*d[0] - a[1]*d[1] - b[0]*c[0] + b[1]*c[1], a[0]*d[1] + a[1]*d[0] - b[0]*c[1] - b[1]*c[0]];
    const r = Math.hypot(det[0], det[1]);
    const s = [Math.sqrt((r + det[0])/2), (det[1] < 0 ? -1 : 1)*Math.sqrt((r - det[0])/2)];
    return [a, b, c, d].map(z => [(z[0]*s[0] + z[1]*s[1])/r, (z[1]*s[0] - z[0]*s[1])/r]);
  };
  const dist = (A, B) => Math.min(...[1, -1].map(sg => Math.max(...A.map((z, i) => Math.hypot(z[0] - sg*B[i][0], z[1] - sg*B[i][1])))));
  const match = gens.map(g => {
    const G = normalized(g);
    let best = -1, bd = Infinity;
    exact.forEach((e, k) => { const d = dist(G, normalized(e)); if(d < bd){ bd = d; best = k; } });
    return best;
  });
  check(new Set(match).size === gens.length, 'each generator matches its own pairing');
  const exactOf = word => {
    let ref = [];
    for(const ch of word) ref = ref.concat(exact[match[names.indexOf(ch)]]);
    return new ITransform(ref, word);
  };

  const t = Date.now();
  const tc = makeTransformClassificationU4(gens, { maxPeriod: 10, maxCount: 10000 });
  console.log(`   ${tc.acceptedCount} transforms in ${Date.now() - t} ms`);
  check(tc.planar, 'classified as a planar group');
  let wrong = [];
  for(const type of TRANSFORM_TYPES){
    for(const key of buckets(tc, type)){
      for(const r of tc[type][key]){
        const e = classifyMobiusU4(exactOf(r.word), 1e-11);
        const ok = e.type === r.type && near(e.period ?? 0, r.period ?? 0, 1e-3) && near(e.rotation ?? 0, r.rotation ?? 0, 1e-3);
        if(!ok && !(e.type === 'identity' && r.type === 'identity')) wrong.push(`${r.word}: ${r.type} for ${e.type}`);
      }
    }
  }
  check(wrong.length === 0, `all transforms classified like the exact words (${wrong.length} not: ${wrong.slice(0, 5).join(', ')})`);
  check(String(buckets(tc, 'elliptical(+)')) === '[0.6667]', `one elliptic bucket [0.6667] (${buckets(tc, 'elliptical(+)')})`);
  check(String(buckets(tc, 'hyperbolic(+)').sort()) === '[1.4267],[3.3024]', `hyperbolic buckets [1.4267] [3.3024] (${buckets(tc, 'hyperbolic(+)')})`);
  check(tc['parabolic(+)'].count === 0, `no parabolics (${tc['parabolic(+)'].count})`);
  for(const [w, type] of [['cijb', 'half turn'], ['hjhkg', 'elliptical(+)'], ['dd', 'identity'], ['bjhi', 'hyperbolic(+)']]){
    const b = bucketOf(tc, w);
    check(!b || b[0] === type, `${w}: ${type} (${b})`);
  }
  console.log(`   ${TRANSFORM_TYPES.map(type => `${type} ${tc[type].count}/${buckets(tc, type).length}`).join(', ')}`);
}

// ---- 3. powers made first ---------------------------------------------------------------

console.log('3. the powers of a transform, a power made first');
{
  // a = z -> k z (two circles about 0), the generators a^2, a
  const k = 3;
  const a = new ITransform([iSphere([0, 0, 0, 1]), iSphere([0, 0, 0, Math.sqrt(k)])], 'a');
  const a2 = a.getCopy().concat(a); a2.word = 'q';
  const tc = makeTransformClassificationU4([a2, a], { maxPeriod: 20, maxCount: 20 });
  const keys = buckets(tc, 'hyperbolic(+)');
  check(String(keys) === `[${Math.log(k).toFixed(4)}]`, `one bucket of a, ln 3 (${keys})`);
  check(['q', 'a'].every(w => String(bucketOf(tc, w)) === `hyperbolic(+),${keys[0]}`), 'a^2 and a in it');
}

// ---- 4. orientation reversing transforms ----------------------------------------------

console.log('4. orientation reversing planar transforms');
{
  const realAxis = iPlane([0, 1, 0, 0]);
  const unit = iSphere([0, 0, 0, 1]);
  const k = 2, alpha = Math.PI/3;
  const cases = [
    ['reflection', [unit], {}],
    // z -> k conj z
    ['hyperbolic(-)', [realAxis, unit, iSphere([0, 0, 0, Math.sqrt(k)])], { period: Math.log(k) }],
    // z -> e^(i alpha)/conj z: the unit circle, then the rotation by alpha about 0
    ['elliptical(-)', [unit, iPlane([1, 0, 0, 0]), iPlane([Math.cos(alpha/2), Math.sin(alpha/2), 0, 0])], { rotation: alpha/Math.PI }],
    // z -> -1/conj z
    ['elliptical(-)', [unit, iPlane([1, 0, 0, 0]), iPlane([0, 1, 0, 0])], { rotation: 1 }],
    // z -> conj z + 1
    ['parabolic(-)', [realAxis, iPlane([1, 0, 0, 0]), iPlane([1, 0, 0, 0.5])], {}],
  ];
  for(const [type, ref, values] of cases){
    const c = classifyMobiusU4(new ITransform(ref));
    let ok = c.type === type;
    for(const v in values) ok = ok && near(c[v], values[v]);
    check(ok, `${type} ${JSON.stringify(values)}: ${JSON.stringify(c)}`);
  }
}

// ---- 5. a group off the plane ------------------------------------------------------------

console.log('5. a group with a splane off the plane z = 0');
{
  const g1 = new ITransform([iSphere([0, 0, 0, 1]), iSphere([0, 0, 0.3, 2])], 'a');
  const g2 = new ITransform([iSphere([0.5, 0, 0, 0.2]), iSphere([0.6, 0, 0, 0.3])], 'b');
  check(!isPlanarTransform(g1) && isPlanarTransform(g2), 'g1 is not planar, g2 is');
  let tc = null, threw = null;
  try { tc = makeTransformClassificationU4([g1, g2], { maxPeriod: 10, maxCount: 200 }); } catch (e) { threw = e.message; }
  check(!threw && tc && !tc.planar && tc.acceptedCount > 0, `classified by the H4 matrices (${threw})`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
