/*
  smoke test for lib/grouplib/SubgroupKey.js

    node tests/subdomain/key_smoke.mjs

  1. every subgroup of every wallpaper group (index <= 6) gets a key, and the
     keys are pairwise distinct within each group
  2. keys are deterministic
  3. keys survive a change of the group's geometry parameters — a stand-in for
     a change of fundamental domain, which the frame is designed to absorb
*/
import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { Group } from '../../lib/invlib/invlib.js';
import { computeFrame, subgroupKey } from '../../lib/grouplib/SubgroupKey.js';
import { subgroupsData, WALLPAPER_NAMES } from '../../lib/sublib/src/sublib.js';

const MAX_INDEX = 6;
let failures = 0;
const check = (ok, msg) => { if(!ok){ failures++; console.log('  FAIL:', msg); } };

function keysOf(name, geo){
  const G = new Group(iWallpaperGroup({ name, ...geo }));
  const frame = computeFrame(G);
  const data = subgroupsData({ preset: 'wallpaper:' + name, maxIndex: MAX_INDEX, generators: 'none' });
  const out = new Map();
  for(const s of data.subgroups)
    out.set(s.subgroup, subgroupKey({ group: G, frame, cosets: s.cosets }).key);
  return { frame, keys: out };
}

let total = 0;
for(const name of WALLPAPER_NAMES){
  const t0 = Date.now();
  let r1, r2;
  try {
    r1 = keysOf(name, { a: 0.5, b: 0.5, c: 0.038 });
    r2 = keysOf(name, { a: 0.65, b: 0.65, c: 0.0494 });   // scaled geometry
  } catch(e){
    failures++; console.log(`${name.padEnd(6)} ERROR ${e.message}`); continue;
  }
  total += r1.keys.size;

  const list = [...r1.keys.values()];
  check(new Set(list).size === list.length,
        `${name}: keys collide (${list.length - new Set(list).size})`);

  let moved = 0;
  for(const [id, k] of r1.keys) if(r2.keys.get(id) !== k) moved++;
  check(moved === 0, `${name}: ${moved} keys changed under scaled geometry`);

  console.log(`${name.padEnd(6)} ${String(r1.keys.size).padStart(4)} subgroups  ` +
              `distinct ${new Set(list).size === list.length ? 'yes' : 'NO'}  ` +
              `scale-stable ${moved === 0 ? 'yes' : 'NO'}  ${Date.now() - t0}ms`);
}
console.log(`\n${total} subgroups keyed`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
