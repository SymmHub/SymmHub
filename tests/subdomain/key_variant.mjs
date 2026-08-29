/*
  the definitive test for SubgroupKey: the key must not change when the group is
  handed over with a DIFFERENT generating set — which is exactly what a
  different fundamental domain (domainShape) produces.

    node tests/subdomain/key_variant.mjs

  For each test group, generator g_i is replaced by a word in the original
  generators (a conjugate), the pairing transforms are composed accordingly,
  and each subgroup's coset permutations are re-expressed for the new
  generators by evaluating the words.  Frames and keys must come out identical.
*/
import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { Group, ITransform } from '../../lib/invlib/invlib.js';
import { computeFrame, subgroupKey } from '../../lib/grouplib/SubgroupKey.js';
import { subgroupsData } from '../../lib/sublib/src/sublib.js';

const MAX_INDEX = 6;
let failures = 0;
const check = (ok, msg) => { if(!ok){ failures++; console.log('  FAIL:', msg); } };

/* words use a..z for generators, A..Z for inverses */
function wordTransform(group, word){
  let t = new ITransform([], '');
  for(const ch of word){
    const lower = ch.toLowerCase();
    const i = lower.charCodeAt(0) - 97;
    const g = new ITransform(group.transforms[i].slice(), '');
    t = t.concat(ch === lower ? g : g.getInverse());
  }
  return t;
}

function wordPerm(perms, word){
  const n = perms[0].length;
  const inv = p => { const q = []; p.forEach((v, i) => q[v] = i); return q; };
  let out = [...Array(n).keys()];
  for(const ch of word){
    const lower = ch.toLowerCase();
    const p = ch === lower ? perms[lower.charCodeAt(0) - 97]
                           : inv(perms[lower.charCodeAt(0) - 97]);
    out = out.map(i => p[i]);
  }
  return out;
}

/* a group object seen through different generators: enough for subgroupKey */
function variantGroup(group, words){
  return { transforms: words.map(w => wordTransform(group, w).ref) };
}

const CASES = [
  { name: '632',   words: ['bab', 'b', 'c'] },        // a -> conjugate by b
  { name: '*632',  words: ['bab', 'b', 'c'] },
  { name: '2222',  words: ['bab', 'b', 'cdc', 'd'] }, // two conjugated gens
  { name: '442',   words: ['bab', 'b', 'c'] },
  { name: '*333',  words: ['cac', 'b', 'c'] },
];

for(const { name, words } of CASES){
  const t0 = Date.now();
  const G = new Group(iWallpaperGroup({ name, a: 0.5, b: 0.5, c: 0.038 }));
  const V = variantGroup(G, words);

  const fG = computeFrame(G);
  const fV = computeFrame(V);
  const fs = f => JSON.stringify([f.origin, f.t1, f.t2].map(v => v.map(x => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(6))));
  check(fs(fG) === fs(fV), `${name}: frames differ\n    G: ${fs(fG)}\n    V: ${fs(fV)}`);

  const data = subgroupsData({ preset: 'wallpaper:' + name, maxIndex: MAX_INDEX, generators: 'none' });
  let moved = 0;
  for(const s of data.subgroups){
    const perms = s.cosets.trim().split(/\s+/).map(w => Array.from(w, c => c.charCodeAt(0) - 97));
    const vperms = words.map(w => wordPerm(perms, w));
    const kG = subgroupKey({ group: G, frame: fG, cosets: s.cosets }).key;
    const kV = subgroupKey({ group: V, frame: fV, cosets: vperms }).key;
    if(kG !== kV){ moved++; if(moved <= 2) console.log(`    ${s.subgroup}:\n      G ${kG}\n      V ${kV}`); }
  }
  check(moved === 0, `${name}: ${moved} keys changed under the new generating set`);
  console.log(`${name.padEnd(6)} ${String(data.subgroups.length).padStart(4)} subgroups  ` +
              `frame ${fs(fG) === fs(fV) ? 'same' : 'DIFFERS'}  keys ${moved === 0 ? 'all same' : moved + ' moved'}` +
              `  ${Date.now() - t0}ms`);
}
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
