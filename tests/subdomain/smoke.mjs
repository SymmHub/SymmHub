/*
  smoke test for lib/grouplib/SubgroupDomain.js

    node tests/subdomain/smoke.mjs

  builds the wallpaper group 632, enumerates its subgroups with sublib, and
  runs the subgroup domain builder on every subgroup of index <= MAX_INDEX,
  checking the invariants the construction promises.  Prints the canonical
  cells, transversal and pairing generators of the two index 3 subgroups.
*/

import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { Group, ITransform, iPoint } from '../../lib/invlib/invlib.js';
import {
  buildSubgroupDomain,
  parseCosetPerms,
  sameTransform,
  classifyEuclidean,
  isometryToString,
} from '../../lib/grouplib/SubgroupDomain.js';
import { subgroupsData } from '../../lib/sublib/src/sublib.js';

const MAX_INDEX = 6;
const GROUP = '632';

let failures = 0;
function check(ok, msg){
  if(!ok){ failures++; console.log('  FAIL:', msg); }
  return ok;
}

const testPoints = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0])];
const identity = new ITransform([], '');

// ---- build G -------------------------------------------------------------

const group = new Group(iWallpaperGroup({name: GROUP, a: 0.5}));
const genNames = group.getGenNames();
console.log(`group ${GROUP}, generators: ${genNames.join(' ')}`);

const gens = {};
genNames.forEach((name, i) => {
  gens[name] = new ITransform(group.transforms[i].slice(), name);
});

function wordToITransform(word){
  let t = new ITransform([], '');
  for(const ch of word){
    const lower = ch.toLowerCase();
    const g = (ch === lower) ? gens[ch] : gens[lower].getInverse();
    t = t.concat(g);
  }
  return t;
}

// the sublib presentation of 632: a^2, b^3, (a*b)^6, b*c
console.log('\nrelator check (each must be the identity isometry):');
for(const rel of ['aa', 'bbb', 'abababababab', 'bc']){
  const ok = sameTransform(wordToITransform(rel), identity, testPoints);
  console.log(`  ${rel.padEnd(14)} -> ${ok ? 'identity' : 'NOT IDENTITY'}`);
  check(ok, `relator ${rel} is not the identity - generator correspondence is wrong`);
}

// ---- enumerate subgroups and run the builder on each ---------------------

const data = subgroupsData({ preset: 'wallpaper:' + GROUP, maxIndex: MAX_INDEX });
console.log(`\nsublib: ${data.subgroups.length} subgroups of index <= ${MAX_INDEX}\n`);

function cosetOfWord(word, perms){
  let c = 0;
  for(const ch of word){
    const lower = ch.toLowerCase();
    const k = lower.charCodeAt(0) - 'a'.charCodeAt(0);
    if(ch === lower){
      c = perms[k][c];
    } else {
      c = perms[k].indexOf(c);
    }
  }
  return c;
}

for(const sub of data.subgroups){

  const perms = parseCosetPerms(sub.cosets);
  const res = buildSubgroupDomain({ group: group, cosets: sub.cosets });

  // 1: one cell per ORBIT class (cells[k]: A_w maps k to 0), and the coset
  //    transversal has one word per coset with the right coset
  check(res.n === sub.index, `${sub.subgroup}: n=${res.n} != index=${sub.index}`);
  res.cells.forEach((cell, k) => {
    check(cell.orbit === k, `${sub.subgroup}: cells[${k}].orbit=${cell.orbit}`);
    let x = k;
    for(const ch of cell.word){
      const low = ch.toLowerCase(), gi = low.charCodeAt(0) - 97;
      x = (ch === low) ? perms[gi][x] : perms[gi].indexOf(x);
    }
    check(x === 0, `${sub.subgroup}: cell word '${cell.word}' has beta != ${k}`);
  });
  res.cosetTransversal.forEach((t, j) => {
    check(t.coset === j && cosetOfWord(t.word, perms) === j,
          `${sub.subgroup}: coset transversal word '${t.word}' not in coset ${j}`);
  });

  // 2: distinct cells are distinct isometries
  for(let i = 0; i < res.n; i++)
    for(let j = i+1; j < res.n; j++)
      check(!sameTransform(res.cells[i].itrans, res.cells[j].itrans, testPoints),
            `${sub.subgroup}: cells ${i} and ${j} coincide`);

  // 3: every pairing word is an element of H (fixes coset 0)
  for(const p of res.pairings)
    check(cosetOfWord(p.word, perms) === 0,
          `${sub.subgroup}: pairing '${p.word}' is not in H (coset ${cosetOfWord(p.word, perms)})`);

  // 4: side accounting: interior walls come in pairs, boundary sides all paired
  const interior = res.sides.filter(s => s.kind === 'interior');
  const boundary = res.sides.filter(s => s.kind === 'boundary');
  check(interior.length % 2 === 0, `${sub.subgroup}: odd interior wall count`);
  check(interior.length + boundary.length === res.n * group.getFundDomain().length,
        `${sub.subgroup}: side count mismatch`);
  for(const p of res.pairings)
    check(p.to !== undefined || p.inverseOf !== undefined,
          `${sub.subgroup}: pairing '${p.word}' has no partner side`);

  const genWords = res.generators.map(g => res.pairings[g].word);
  console.log(`${sub.subgroup.padEnd(10)} index ${String(sub.index).padStart(2)}  ` +
              `cells: ${res.cells.map(c => c.word === '' ? 'e' : c.word).join(' ').padEnd(24)} ` +
              `H gens: ${genWords.join(' ')}`);
}

// ---- detail on the two index 3 subgroups ---------------------------------

for(const sub of data.subgroups.filter(s => s.index === 3)){
  const res = buildSubgroupDomain({ group: group, cosets: sub.cosets });
  console.log(`\n=== ${sub.subgroup} ===`);
  console.log('  domain cells (orbit reps, f_i) :');
  res.cells.forEach((cell, k) => {
    const w = cell.word === '' ? 'e' : cell.word;
    console.log(`    f_${k} = ${w.padEnd(6)} ${isometryToString(classifyEuclidean(cell.itrans))}`);
  });
  console.log('  coset transversal (g_j):');
  res.cosetTransversal.forEach((t, j) => {
    const w = t.word === '' ? 'e' : t.word;
    console.log(`    g_${j} = ${w.padEnd(6)} ${isometryToString(classifyEuclidean(t.itrans))}`);
  });
  console.log('  pairing generators of H:');
  for(const gi of res.generators){
    const p = res.pairings[gi];
    console.log(`    ${p.word.padEnd(8)} ${isometryToString(p.isometry)}`);
  }
  const b = res.sides.filter(s => s.kind === 'boundary').length;
  const i = res.sides.filter(s => s.kind === 'interior').length;
  console.log(`  sides: ${b} boundary, ${i} interior`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
