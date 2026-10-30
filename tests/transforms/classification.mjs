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
  6. the Dirichlet group of the symdraw preset par_s2223-11 (2026-10-30: two half turns of
     long words lost their trace to 5e-5 in the H4 factorization; products of half turns
     and of order 3 rotations were loxodromic with periods of 1e-4, which headed the list
     and took real loxodromics for their powers): the transforms are classified like the
     exact words, the loxodromic list starts with [0.1725,0.1420], and the members of
     each bucket are powers of its base by the exact words, no bucket a power of another
  7. a base whose period is within its error of 0 takes no longer transform for its power
  8. the reflections of a Moebius matrix (invlib mobiusToSplanes): loxodromic, elliptic,
     hyperbolic, parabolic, similarities, a translation, the identity, reversing ones
*/

import { Group_KLMN, makeDirichletGroup, dirichletBase, parseWords } from '../../lib/grouplib/grouplib.js';
import {
  GroupUtils,
  ITransform,
  iSphere,
  iPlane,
  classifyMobiusU4,
  getMatrixMobius,
  isPlanarTransform,
  mobiusToSplanes,
  mobiusDistance,
} from '../../lib/invlib/invlib.js';
import {
  TRANSFORM_TYPES,
  makeTransformClassificationU4,
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

// ---- 6. the Dirichlet group of par_s2223-11 ------------------------------------------------

console.log('6. the Dirichlet group of par_s2223-11');
{
  const klmn11 = new Group_KLMN();
  klmn11.setParamsMap({ s: false, K: 3, L: 2, M: 2, N: 2, twist: 0.0362, aspect: 0.49, bend: 34.68, uhp: true });
  const g11 = klmn11.getGroup();
  const base = dirichletBase({ baseX: 0.1292231066542999, baseY: 0.11946168615193525 });
  const words = parseWords('C(BC)7A C(BC)7AbACBCa(BC)9AbC CBa(Cb)9ACbCaBaC(bC)7 bACBCa(BC)9AbC CBa(Cb)9ACbCaB aC(bC)11aB2AbACBCa(BC)9A bC CB (CBa(Cb)9ACbCaB)3aC(bC)11aB2AbACBCa(BC)9A (CBa(Cb)9ACbCaB)4aC(bC)11aB2AbACBCa(BC)9A C(BC)6AbAC(BC)11A C(BC)7AbAC(BC)11A');
  const dg = makeDirichletGroup(g11, { base, words });
  const gens = GroupUtils.trans2itrans(dg.getTransforms());
  const names = gens.map(g => g.word);
  // the generators are the pairings in the group's order: matched to the words by their matrices
  const exact = dg.dirichletWords.map(w => GroupUtils.getInverseTransform(g11.word2trans(w)));
  const match = gens.map(g => exact.reduce((best, e, k) => (mobiusDistance(g, e) < mobiusDistance(g, exact[best])) ? k : best, 0));
  const exactOf = word => {
    let ref = [];
    for(const ch of word) ref = ref.concat(exact[match[names.indexOf(ch)]]);
    return new ITransform(ref, word);
  };
  const t = Date.now();
  const tc = makeTransformClassificationU4(gens, { maxPeriod: 10, maxCount: 10000 });
  console.log(`   ${tc.acceptedCount} transforms in ${Date.now() - t} ms`);
  const angle = (a, b) => { let d = (a - b) % 2; if(d > 1) d -= 2; if(d < -1) d += 2; return d; };
  // c is the n-th power of b by the exact complex lengths
  const powerN = (c, b) => {
    const n = Math.round(c.period/b.period);
    return (n >= 1 && Math.abs(c.period - n*b.period) < 1e-6*n && Math.abs(angle(c.rotation ?? 0, n*(b.rotation ?? 0))) < 1e-6*n) ? n : 0;
  };
  let wrong = [], notPowers = [], powerBuckets = [];
  for(const type of TRANSFORM_TYPES){
    const bases = [];
    for(const key of buckets(tc, type)){
      const ex = tc[type][key].map(r => ({ r, e: classifyMobiusU4(exactOf(r.word), 1e-11) }));
      for(const { r, e } of ex){
        const ok = e.type === r.type && near(e.period ?? 0, r.period ?? 0, 1e-3) && near(e.rotation ?? 0, r.rotation ?? 0, 1e-3);
        if(!ok) wrong.push(`${r.word}: ${r.type} for ${e.type}`);
      }
      if(type !== 'hyperbolic(+)' && type !== 'loxodromic(+)') continue;
      const b = ex.reduce((m, x) => (x.e.period < m.e.period) ? x : m).e;
      for(const { r, e } of ex) if(!powerN(e, b)) notPowers.push(`${key} ${r.word}`);
      bases.push([key, b]);
    }
    bases.sort((x, y) => x[1].period - y[1].period);
    bases.forEach(([key, b], i) => { if(bases.slice(0, i).some(([, a]) => powerN(b, a))) powerBuckets.push(key); });
  }
  check(wrong.length === 0, `all transforms classified like the exact words (${wrong.length} not: ${wrong.slice(0, 5).join(', ')})`);
  const lox = buckets(tc, 'loxodromic(+)').sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1)));
  check(lox[0] === '[0.1725,0.1420]', `the loxodromic list starts with [0.1725,0.1420] (${lox.slice(0, 3)})`);
  check(notPowers.length === 0, `the members of each bucket are powers of its base (${notPowers.length} not: ${notPowers.slice(0, 5).join(', ')})`);
  check(powerBuckets.length === 0, `no bucket is a power of another (${powerBuckets.slice(0, 5)})`);
  check(String(buckets(tc, 'elliptical(+)')) === '[0.6667]' && buckets(tc, 'half turn').length === 1, `one elliptic bucket [0.6667], one of half turns (${buckets(tc, 'elliptical(+)')})`);
  console.log(`   ${TRANSFORM_TYPES.map(type => `${type} ${tc[type].count}/${buckets(tc, type).length}`).join(', ')}`);
}

// ---- 7. a base with a period within its error of 0 ------------------------------------------

console.log('7. a period within its error of 0 is no base of powers');
{
  // z -> e^(l + i t) z: two circles about 0, two lines through 0
  const lox = (l, t, word) => new ITransform([iSphere([0, 0, 0, 1]), iSphere([0, 0, 0, Math.exp(l/2)]),
                                              iPlane([1, 0, 0, 0]), iPlane([Math.cos(t/2), Math.sin(t/2), 0, 0])], word);
  // with the precision 3e-4 of the splanes b is loxodromic with the period 1e-3 +- 5e-4;
  // a's period is 4000 times b's, its rotation is not: a is no power of b (all
  // transforms went into the bucket of b before)
  const a = lox(4, Math.PI*(2/3 + 0.5), 'a'), b = lox(1e-3, 2*Math.PI/3, 'b');
  const tc = makeTransformClassificationU4([b, a], { maxPeriod: 20, maxCount: 30, precision: 3e-4 });
  const ba = bucketOf(tc, 'a'), bb = bucketOf(tc, 'b');
  check(bb && bb[0] === 'loxodromic(+)' && bb[1] === '[0.0010,0.6667]', `b loxodromic [0.0010,0.6667] (${bb})`);
  check(ba && ba[1] === '[4.0000,-0.8333]', `a in its own bucket [4.0000,-0.8333] (${ba})`);
  check(['aa', 'aaa'].every(w => String(bucketOf(tc, w)) === String(ba)), 'the powers of a in it');
}

// ---- 8. the reflections of a Moebius matrix -------------------------------------------------

console.log('8. mobiusToSplanes');
{
  const C = (re, im = 0) => [re, im];
  const cases = [
    ['loxodromic', [[C(1.3, 0.4), C(-0.7, 2.1)], [C(0.25, -0.6), C(0.9, 0.2)]]],
    ['elliptic', [[C(Math.cos(0.7), Math.sin(0.7)), C(0.3, 0.1)], [C(0, 0), C(Math.cos(0.7), -Math.sin(0.7))]]],
    ['hyperbolic', [[C(2), C(1)], [C(1), C(1)]]],
    ['parabolic', [[C(1), C(0.5, 0.2)], [C(0), C(1)]]],
    ['parabolic, c != 0', [[C(1.3), C(-0.09)], [C(1), C(0.7)]]],
    ['similarity', [[C(1.5, 0.8), C(-0.4, 3)], [C(0), C(1)]]],
    ['scaling about a far point', [[C(1.000001), C(1e3)], [C(0), C(1)]]],
    ['translation', [[C(1), C(-2, 0.75)], [C(0), C(1)]]],
    ['identity', [[C(1), C(0)], [C(0), C(1)]]],
    // near a similarity the precision is about the smaller of |c| and EPSILON/|c|,
    // the worst near |c| = 1e-8
    ['near affine', [[C(1.2, 0.1), C(0.4)], [C(1e-9, 2e-9), C(0.8, -0.3)]], 1e-7],
    ['near affine, worst', [[C(1.2, 0.1), C(0.4)], [C(1e-8, 0), C(0.8, -0.3)]], 1e-7],
    ['near affine, 1e-5', [[C(1.2, 0.1), C(0.4)], [C(1e-5, 1e-5), C(0.8, -0.3)]], 1e-10],
  ];
  // the reflections act as m (and the reflection in the real axis first when reversing)
  const flip = iPlane([0, 1, 0, 0]);
  for(const [name, m, eps = 1e-12] of cases){
    const plain = mobiusToSplanes(m, false);
    for(const reversing of [false, true]){
      const ref = mobiusToSplanes(m, reversing);
      const dist = (ref && plain) ? mobiusDistance(ref, reversing ? [flip].concat(plain) : plain) : Infinity;
      // the matrix r of the plain reflections is k m for one complex k: the residual of
      // r after the projection k = <m, r>/<m, m>, relative to r
      const ms = m.flat(), rs = getMatrixMobius(plain || []).m.flat();
      const mm = ms.reduce((s, a) => s + a[0]*a[0] + a[1]*a[1], 0);
      const k = ms.reduce((s, a, i) => [s[0] + (a[0]*rs[i][0] + a[1]*rs[i][1])/mm, s[1] + (a[0]*rs[i][1] - a[1]*rs[i][0])/mm], [0, 0]);
      const res = rs.map((b, i) => [b[0] - (k[0]*ms[i][0] - k[1]*ms[i][1]), b[1] - (k[0]*ms[i][1] + k[1]*ms[i][0])]);
      const off = Math.hypot(...res.flat())/Math.hypot(...rs.flat());
      check(ref && ref.length <= (reversing ? 5 : 4) && dist === 0 && off < eps,
            `${name}${reversing ? ', reversing' : ''}: ${ref && ref.length} reflections, off by ${off.toExponential(1)}`);
    }
  }
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
