/* Validate sublib against the GAP-generated corpus that ships with SymmHub.
 *
 *   node tests/sublib/validate-corpus.mjs [path-to-color_groups] [--sample N] [--family f]
 *
 * For every sub_*.json file it recomputes the enumeration from the very
 * presentation recorded in the file and checks:
 *   - the countPerIndex table matches exactly;
 *   - maxIndex / nextIndex / nextIndexCount / totalCount match (i.e. the
 *     maxSubgroups budget walk reproduces GAP's);
 *   - every subgroup in the file is one of ours, up to the choice of class
 *     representative — checked by canonical form, which is the mathematical
 *     statement "same conjugacy class";
 *   - how many representatives agree with GAP verbatim (reported, not enforced).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makePresentation, subgroupsData, permStringToArrays, canonicalForm, verifyData,
} from '../../lib/sublib/src/sublib.js';

// The corpus lives in this repo; resolve relative to this file so the test
// works from any working directory.
const DEFAULT_CORPUS = fileURLToPath(new URL('../../apps/sympix/color_groups', import.meta.url));

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i < 0 ? dflt : argv[i + 1];
};
const corpus = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true)
  || DEFAULT_CORPUS;
const sample = Number(flag('--sample', 0));
const onlyFamily = flag('--family', null);

// maxSubgroups budgets used by SymmHub's gap/generate_subgroups.g
const BUDGET = { wallpaper: 1000, klm: 300, sklm: 300 };
const BUDGET_OVERRIDE = { 'wallpaper/sub_o.json': 300 };

if (!existsSync(corpus)) {
  console.log(`corpus not found at ${corpus} — skipping (pass a path as the first argument)`);
  process.exit(0);
}

/** Rebuild the presentation from the file's own GAP strings. */
function presFromFile(d) {
  const gens = d.group.replace(/^Group\(\s*\[/, '').replace(/\]\s*\)\s*$/, '')
    .split(',').map(s => s.trim()).filter(Boolean).join(' ');
  return makePresentation(gens, d.relators.replace(/^\[/, '').replace(/\]$/, '').trim());
}

/** Coset permutation strings -> canonical form key (conjugacy-class identity). */
function classKey(cosetsStr, invcosStr) {
  const fwd = permStringToArrays(cosetsStr);
  const bwd = permStringToArrays(invcosStr);
  const n = fwd[0].length, nCols = 2 * fwd.length;
  const tab = new Int32Array(n * nCols);
  for (let k = 0; k < fwd.length; k++) {
    for (let c = 0; c < n; c++) {
      tab[c * nCols + 2 * k] = fwd[k][c];
      tab[c * nCols + 2 * k + 1] = bwd[k][c];
    }
  }
  return n + '#' + canonicalForm(tab, n, nCols).join(',');
}

const families = ['wallpaper', 'klm', 'sklm'].filter(f => !onlyFamily || f === onlyFamily);
const files = [];
for (const fam of families) {
  const dir = join(corpus, fam);
  if (!existsSync(dir)) continue;
  let list = readdirSync(dir).filter(f => f.startsWith('sub_') && f.endsWith('.json'));
  if (sample > 0 && list.length > sample) {
    const step = Math.ceil(list.length / sample);
    list = list.filter((_, i) => i % step === 0);
  }
  files.push(...list.map(f => [fam, f]));
}

let pass = 0, fail = 0, repMatched = 0, repTotal = 0, slowest = [];
const failures = [];

for (const [fam, file] of files) {
  const rel = `${fam}/${file}`;
  const gt = JSON.parse(readFileSync(join(corpus, rel), 'utf8'));
  const pres = presFromFile(gt);
  const budget = BUDGET_OVERRIDE[rel] ?? BUDGET[fam];

  // search to the same ceiling GAP was given (24 everywhere in this corpus)
  const data = subgroupsData({
    name: gt.name, presentation: pres, maxIndex: 24, maxSubgroups: budget,
  });

  const problems = [];

  if (data.maxIndex !== gt.maxIndex) problems.push(`maxIndex ${data.maxIndex} != ${gt.maxIndex}`);
  if (data.totalCount !== gt.totalCount) problems.push(`totalCount ${data.totalCount} != ${gt.totalCount}`);
  if ((data.nextIndex ?? null) !== (gt.nextIndex ?? null)) {
    problems.push(`nextIndex ${data.nextIndex} != ${gt.nextIndex}`);
  }
  if ((data.nextIndexCount ?? null) !== (gt.nextIndexCount ?? null)) {
    problems.push(`nextIndexCount ${data.nextIndexCount} != ${gt.nextIndexCount}`);
  }
  if (data.group !== gt.group) problems.push(`group string "${data.group}" != "${gt.group}"`);

  const mineCounts = JSON.stringify(data.countPerIndex);
  const gtCounts = JSON.stringify(gt.countPerIndex.map(o => ({ index: o.index, count: o.count })));
  if (mineCounts !== gtCounts) problems.push('countPerIndex differs');

  // conjugacy-class identity, and verbatim representative agreement
  const mineKeys = new Map();
  for (const s of data.subgroups) {
    const k = classKey(s.cosets, s.invcos);
    mineKeys.set(k, s);
  }
  let missing = 0;
  for (const s of gt.subgroups) {
    const k = classKey(s.cosets, s.invcos);
    const mine = mineKeys.get(k);
    if (!mine) { missing++; continue; }
    repTotal++;
    if (mine.cosets === s.cosets && mine.invcos === s.invcos) repMatched++;
  }
  if (missing) problems.push(`${missing} of ${gt.subgroups.length} GAP subgroups are in no class of ours`);

  const bad = verifyData(data, pres);
  if (bad.length) problems.push(`verifyData: ${bad.length} problem(s), first: ${bad[0]}`);

  slowest.push([data.stats.elapsedMs, rel, data.totalCount]);
  if (problems.length) { fail++; failures.push([rel, problems]); }
  else pass++;

  process.stderr.write(
    `[${String(pass + fail).padStart(4)}/${files.length}] ${rel.padEnd(24)}` +
    ` ${String(data.stats.elapsedMs).padStart(6)} ms  ${String(data.totalCount).padStart(4)} subgroups` +
    `${problems.length ? '  FAIL' : ''}\n`);
}

for (const [rel, problems] of failures) {
  console.log(`FAIL ${rel}`);
  for (const p of problems) console.log(`       ${p}`);
}

slowest.sort((a, b) => b[0] - a[0]);
console.log(`\ncorpus: ${corpus}`);
console.log(`${pass} pass / ${fail} fail  (${files.length} files)`);
console.log(`class representatives identical to GAP: ${repMatched}/${repTotal}` +
  ` (${(100 * repMatched / Math.max(1, repTotal)).toFixed(2)}%)`);
console.log('slowest files:');
for (const [ms, rel, n] of slowest.slice(0, 5)) console.log(`  ${String(ms).padStart(6)} ms  ${rel}  (${n} subgroups)`);

process.exit(fail ? 1 : 0);
