/* Self-contained tests — no external data.  node tests/sublib/smoke.mjs */
import {
  makePresentation, subgroupClasses, subgroupsData, verifyData,
  permStringToArrays, permArraysToString, findByPermutations, cosetRepresentatives,
  getPreset, klmPresentation, sklmPresentation, COSET_SYMBOLS,
} from '../../lib/sublib/src/sublib.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name}${detail ? '  — ' + detail : ''}`); }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  check(name, a === e, `got ${a}, want ${e}`);
}
const countsOf = (data) => Object.fromEntries(data.countPerIndex.map(o => [o.index, o.count]));

console.log('\nZ^2 = <a,b | [a,b]>: subgroups of index n number sigma(n)');
{
  // Z^2 is abelian, so every subgroup is its own conjugacy class.
  const sigma = [null, 1, 3, 4, 7, 6, 12, 8, 15, 13, 18, 12, 28];
  const data = subgroupsData({ name: 'Z2', gens: 'a b', relators: '[a,b]', maxIndex: 12 });
  const c = countsOf(data);
  let ok = true;
  for (let n = 1; n <= 12; n++) if (c[n] !== sigma[n]) ok = false;
  check('sigma_1(n) for n <= 12', ok, JSON.stringify(c));
  eq('sum of sigma(1..12) subgroups in all', data.subgroups.length, 127);
  check('relators act trivially', verifyData(data).length === 0);
}

console.log('\nF2 = <a,b | >: literal subgroups of index n (Marshall Hall)');
{
  // Hall's counts per index: 1, 3, 13, 71, 461 — the search enumerates every
  // standardized table, i.e. every literal subgroup, so the totals accumulate.
  const cum = [0, 1, 4, 17, 88, 549];
  let ok = true;
  for (let n = 1; n <= 5; n++) {
    const { stats } = subgroupClasses(makePresentation('a b', ''), n);
    if (stats.literalCount !== cum[n]) { ok = false; console.log(`    index<=${n}: ${stats.literalCount} != ${cum[n]}`); }
  }
  check('cumulative literal subgroup counts 1,4,17,88,549', ok);
}

console.log('\nZ = <a | >: one subgroup per index, exercising the 62-symbol alphabet');
{
  const data = subgroupsData({ name: 'Z', gens: 'a', relators: '', maxIndex: 40 });
  eq('40 subgroups', data.totalCount, 40);
  const top = data.subgroups[data.subgroups.length - 1];
  eq('index 40', top.index, 40);
  check('coset 39 is written "N"', top.cosets.includes('N'), top.cosets);
  check('every index appears once', data.countPerIndex.every(o => o.count === 1));
  check('self-check clean', verifyData(data).length === 0);
}

console.log('\nTriangle groups against GAP LowIndexSubgroupsFpGroup (computed by V. Bulatov)');
{
  // (2,3,7) Hurwitz group
  const gap237 = { 1: 1, 7: 2, 8: 1, 9: 1, 14: 9, 15: 3, 21: 9, 22: 13, 24: 1 };
  const d237 = subgroupsData({ name: '237', gens: 'a b', relators: 'a^2, b^3, (a*b)^7', maxIndex: 24 });
  eq('(2,3,7) class counts', countsOf(d237), gap237);

  // *283 full triangle group
  const gapS283 = { 1: 1, 2: 3, 3: 1, 4: 2, 6: 7, 8: 5, 10: 2, 12: 18, 14: 2, 16: 10, 17: 1, 18: 7, 20: 11, 21: 4, 24: 75 };
  const dS283 = subgroupsData({ ...sklmPresentation(2, 8, 3), maxIndex: 24 });
  eq('*283 class counts', countsOf(dS283), gapS283);

  // the klm preset must be the same group as the two-generator (2,3,7)
  const dKlm = subgroupsData({ ...klmPresentation(2, 3, 7), maxIndex: 24 });
  eq('klm:237 agrees with <a,b | a^2,b^3,(ab)^7>', countsOf(dKlm), gap237);
}

console.log('\nwire format');
{
  const data = subgroupsData({ preset: 'wallpaper:632', maxIndex: 12 });
  eq('group string', data.group, 'Group( [ a, b, c ] )');
  eq('relator string', data.relators, '[ a^2, b^3, (a*b)^6, b*c ]');
  eq('trivial subgroup first', data.subgroups[0].subgroup, '632.1.1');
  eq('index-1 permutations', data.subgroups[0].cosets, 'a a a');

  const s = data.subgroups.find(x => x.index === 6);
  const perms = permStringToArrays(s.cosets);
  eq('roundtrip', permArraysToString(perms), s.cosets);
  eq('one block per generator', perms.length, 3);
  eq('block length = index', perms[0].length, 6);

  check('subgroup ids are unique', new Set(data.subgroups.map(x => x.subgroup)).size === data.subgroups.length);
  check('ids number from 1 within each index',
    data.countPerIndex.every(({ index, count }) =>
      data.subgroups.filter(x => x.index === index).map(x => x.subgroup).join() ===
      Array.from({ length: count }, (_, i) => `632.${index}.${i + 1}`).join()));
  check('self-check clean', verifyData(data).length === 0);
}

console.log('\ncanonicity pruning agrees with enumerating every subgroup');
{
  const cases = [
    ['wallpaper:632', 24], ['wallpaper:2222', 16], ['wallpaper:*333', 12],
    ['wallpaper:xx', 14], ['klm:237', 24], ['sklm:*244', 12],
  ];
  for (const [key, maxIndex] of cases) {
    const p = getPreset(key);
    const pres = makePresentation(p.gens, p.relators);
    const on = subgroupClasses(pres, maxIndex, { prune: true });
    const off = subgroupClasses(pres, maxIndex, { prune: false });
    const sig = (r) => r.classes.map(c => `${c.key}:${c.size}`).join('|');
    check(`${key} to index ${maxIndex}: same classes, same sizes`, sig(on) === sig(off),
      `${on.classes.length} vs ${off.classes.length} classes`);
    check(`  ...and the same subgroup count (${on.stats.literalCount})`,
      on.stats.literalCount === off.stats.literalCount);
    check(`  ...with fewer nodes searched (${on.stats.nodesVisited} < ${off.stats.nodesVisited})`,
      on.stats.nodesVisited < off.stats.nodesVisited);
  }
}

console.log('\ngenerator modes');
{
  for (const generators of ['gap', 'natural', 'none']) {
    const data = subgroupsData({ preset: 'wallpaper:442', maxIndex: 8, generators });
    const problems = verifyData(data);
    check(`${generators}: generator words stabilize coset 0`, problems.length === 0, problems[0]);
  }
  const gap = subgroupsData({ preset: 'wallpaper:442', maxIndex: 8, generators: 'gap' });
  const nat = subgroupsData({ preset: 'wallpaper:442', maxIndex: 8, generators: 'natural' });
  const i = gap.subgroups.findIndex(s => s.generators.split(/\s+/).some(w => w.length > 1));
  eq('natural is the gap word reversed',
    nat.subgroups[i].generators.split(/\s+/).map(w => [...w].reverse().join('')).join(' '),
    gap.subgroups[i].generators);
  eq('none leaves the field empty', subgroupsData({ preset: 'wallpaper:442', maxIndex: 4, generators: 'none' })
    .subgroups.every(s => s.generators === ''), true);
}

console.log('\nbudget walk (maxSubgroups)');
{
  const full = subgroupsData({ preset: 'wallpaper:o', maxIndex: 24 });
  const budgeted = subgroupsData({ preset: 'wallpaper:o', maxIndex: 24, maxSubgroups: 300 });
  check('budget lowers maxIndex', budgeted.maxIndex < full.maxIndex, `${budgeted.maxIndex} vs ${full.maxIndex}`);
  check('total stays within budget', budgeted.totalCount <= 300, String(budgeted.totalCount));
  eq('nextIndex is one past the kept range', budgeted.nextIndex, budgeted.maxIndex + 1);
  check('nextIndexCount is what the next index would add',
    budgeted.nextIndexCount ===
      full.countPerIndex.find(o => o.index === budgeted.nextIndex).count);
  check('no budget means no nextIndex', full.nextIndex === null);
}

console.log('\nlookup by permutations');
{
  const data = subgroupsData({ preset: 'wallpaper:442', maxIndex: 8 });
  const target = data.subgroups.find(s => s.index === 4 && s.cosets !== s.invcos) || data.subgroups[3];
  eq('exact match on invcos', findByPermutations(data, target.invcos)?.subgroup, target.subgroup);
  eq('exact match on cosets', findByPermutations(data, target.cosets)?.subgroup, target.subgroup);
  eq('whitespace tolerated', findByPermutations(data, '  ' + target.invcos.replace(/ /g, '   '))?.subgroup, target.subgroup);
  check('no match without a hit', findByPermutations(data, 'ab ba ab') === null);

  // a conjugate representative: relabel the cosets by a different base point
  const perms = permStringToArrays(target.cosets);
  const n = perms[0].length;
  const base = perms[0][0] !== 0 ? perms[0][0] : 1;   // some coset other than 0
  const relabel = [];                                 // BFS order from `base`
  const seen = new Array(n).fill(-1);
  seen[base] = 0; relabel.push(base);
  for (let i = 0; i < relabel.length; i++) {
    for (const p of perms) {
      const t = p[relabel[i]];
      if (seen[t] < 0) { seen[t] = relabel.length; relabel.push(t); }
    }
  }
  const conj = permArraysToString(perms.map(p => relabel.map(c => seen[p[c]])));
  const hit = findByPermutations(data, conj, { upToConjugacy: true });
  check('conjugate table found up to conjugacy', hit !== null && hit.index === target.index,
    `conj=${conj}`);
  check('conjugate table not found by exact match',
    conj === target.cosets || findByPermutations(data, conj) === null);
}

console.log('\ncoset representatives');
{
  // Independent of the library: walk a word through the permutations by hand.
  const walk = (entry, letters) => {
    const fwd = permStringToArrays(entry.cosets);
    const bwd = permStringToArrays(entry.invcos);
    let c = 0;
    for (const x of letters) c = x > 0 ? fwd[x - 1][c] : bwd[-x - 1][c];
    return c;
  };
  // Shortest distance from coset 0, computed separately.
  const distances = (entry) => {
    const fwd = permStringToArrays(entry.cosets);
    const bwd = permStringToArrays(entry.invcos);
    const n = fwd[0].length;
    const d = new Array(n).fill(-1);
    d[0] = 0;
    const q = [0];
    for (let i = 0; i < q.length; i++) {
      for (let k = 0; k < fwd.length; k++) {
        for (const t of [fwd[k][q[i]], bwd[k][q[i]]]) {
          if (d[t] < 0) { d[t] = d[q[i]] + 1; q.push(t); }
        }
      }
    }
    return d;
  };

  for (const [key, maxIndex] of [['wallpaper:632', 12], ['wallpaper:2222', 8], ['klm:237', 24], ['sklm:*333', 9]]) {
    const data = subgroupsData({ preset: key, maxIndex });
    let identityFirst = true, transversal = true, shortest = true, prefixClosed = true, viaOK = true, count = true;
    for (const entry of data.subgroups) {
      const reps = cosetRepresentatives(data, entry.subgroup);
      const words = new Set(reps.map(r => r.word));
      const dist = distances(entry);
      if (reps.length !== entry.index || words.size !== entry.index) count = false;
      if (reps[0].word !== '1' || reps[0].letters.length || reps[0].via !== null) identityFirst = false;
      for (const r of reps) {
        if (walk(entry, r.letters) !== r.coset) transversal = false;   // t_i really is in coset i
        if (r.letters.length !== dist[r.coset]) shortest = false;
        if (r.via) {
          if (walk(entry, reps[r.via.from].letters.concat([r.via.letter])) !== r.coset) viaOK = false;
          const prefix = r.letters.slice(0, -1).join(',');
          if (!reps.some(o => o.letters.join(',') === prefix)) prefixClosed = false;
        }
      }
    }
    console.log(`  ${key} (${data.subgroups.length} subgroups to index ${maxIndex})`);
    check('  one representative per coset, all distinct', count);
    check('  coset 0 is the identity', identityFirst);
    check('  t_i lies in coset i', transversal);
    check('  every word is a shortest one', shortest);
    check('  Schreier: prefixes are representatives too', prefixClosed);
    check('  via reproduces the word in one step', viaOK);
  }

  const data = subgroupsData({ preset: 'wallpaper:632', maxIndex: 6 });
  eq('index 6 words for 632.6.1',
    cosetRepresentatives(data, '632.6.1').map(r => r.word).join(' '), '1 b B Ba Bab BaB');
  eq('lookup by array position matches lookup by id',
    cosetRepresentatives(data, 3).map(r => r.word).join(' '),
    cosetRepresentatives(data, data.subgroups[3].subgroup).map(r => r.word).join(' '));
  eq('a bare subgroup entry works too',
    cosetRepresentatives(data.subgroups[3]).map(r => r.word).join(' '),
    cosetRepresentatives(data, 3).map(r => r.word).join(' '));
  eq('generator names can be overridden',
    cosetRepresentatives(data.subgroups[3], { gens: 'x y z' }).map(r => r.word).join(' ')
      .replace(/x/g, 'a').replace(/X/g, 'A').replace(/y/g, 'b').replace(/Y/g, 'B'),
    cosetRepresentatives(data, 3).map(r => r.word).join(' '));

  let threw = 0;
  try { cosetRepresentatives(data, 'nope.1.1'); } catch { threw++; }
  try { cosetRepresentatives(data.subgroups[3], { gens: 'a b' }); } catch { threw++; }
  try { cosetRepresentatives({ nothing: true }, 0); } catch { threw++; }
  eq('bad input throws', threw, 3);
}

console.log('\npresets');
{
  eq('bare orbifold resolves', getPreset('2222').name, '2222');
  eq('wallpaper: prefix resolves', getPreset('wallpaper:*442').name, '*442');
  eq('klm digits', getPreset('klm:237').relators, 'a*c, b*d, a^2, b^3, (a*d)^7');
  eq('sklm digits', getPreset('sklm:*237').relators, 'a^2, b^2, c^2, (a*b)^2, (c*a)^3, (b*c)^7');
  let threw = false;
  try { getPreset('nope:1'); } catch { threw = true; }
  check('unknown family throws', threw);
  eq('alphabet size', COSET_SYMBOLS.length, 62);
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nall tests passed\n');
process.exit(failures ? 1 : 0);
