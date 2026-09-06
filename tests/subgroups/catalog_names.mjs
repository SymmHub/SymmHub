/*
  test for lib/grouplib/SubgroupNames.js: the names of the subgroups of the
  wallpaper groups are the names of the colour group catalogue

    node tests/subgroups/catalog_names.mjs

  1. for every wallpaper group, the names makeSubgroupNamer() gives the
     subgroups of the catalogue presentation are the names of the catalogue
     manifests (catalog_names.json: 250117_colorsym/catalog/data/*.json as
     regenerated on 2026-09-05 with the key of the conjugacy class, all
     subgroups to index 6, 632 to index 8), and so are the types and the
     keys; the manifests' representativeKey is the key of the representative
     (classInvariant: false), which orders some buckets differently: how many
     names get another ordinal that way is reported per group
  2. another fundamental domain of the same group (632 kite, 442 square,
     2222 parallelogram, 3*3 kite): the presentation derived from the
     geometry gives other coset tables, but the same names: a subgroup gets
     the same name under both presentations (matched by its class key),
     every index has the same multiset of names, and the class keys of the
     default presentation are the same set as those of the other domain
  3. a group outside the catalogue (klm:237) keeps the sublib ids
*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { Group } from '../../lib/invlib/invlib.js';
import { groupPresentation } from '../../lib/grouplib/GroupPresentation.js';
import { makeSubgroupNamer, grouplibWallpaperName } from '../../lib/grouplib/SubgroupNames.js';
import { subgroupsData, WALLPAPER_NAMES } from '../../lib/sublib/src/sublib.js';

const FIXTURE = fileURLToPath(new URL('./catalog_names.json', import.meta.url));
const catalog = JSON.parse(readFileSync(FIXTURE, 'utf8'));

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

// ---- 1. the catalogue presentations -------------------------------------------

console.log('=== catalogue names ===');
let total = 0, changed = 0;
const defaultInfos = new Map();     // group name -> Map class key -> {name, entry}
for(const name of WALLPAPER_NAMES){
  const ref = catalog[name];
  if(!check(!!ref, `${name}: not in the fixture`)) continue;
  const t0 = Date.now();
  const data = subgroupsData({ preset: 'wallpaper:' + name, maxIndex: ref.maxIndex, generators: 'none' });
  const pres = { name, preset: 'wallpaper:' + name };
  const namer = makeSubgroupNamer({ data, presentation: pres });
  const asRepresentative = makeSubgroupNamer({ data, presentation: pres, classInvariant: false });
  check(namer.isCatalogue && asRepresentative.isCatalogue, `${name}: catalogue naming not in effect`);
  check(namer.groupName === name, `${name}: group name ${namer.groupName}`);
  check(data.subgroups.length === ref.subgroups.length,
        `${name}: ${data.subgroups.length} subgroups, fixture has ${ref.subgroups.length}`);
  const byCosets = new Map(ref.subgroups.map(s => [s.cosets, s]));
  const infos = new Map();
  let bad = 0, moved = 0;
  for(const s of data.subgroups){
    const want = byCosets.get(s.cosets);
    if(!check(!!want, `${name}: ${s.subgroup} (${s.cosets}) not in the fixture`)) continue;
    // the manifests: the class order
    const info = namer.infoOf(s);
    const ok = info.name === want.name && info.type === want.type && info.key === want.geoKey;
    if(!ok){
      bad++;
      if(bad <= 5) console.log(`  MISMATCH ${name} ${s.subgroup} ${s.cosets}: got ${info.name} (${info.type}, ${info.key}) want ${want.name} (${want.type}, ${want.geoKey})`);
    }
    check(namer.entryByName(want.name) === s, `${name}: entryByName(${want.name})`);
    check(namer.entryByName(s.subgroup) === s, `${name}: entryByName(${s.subgroup})`);
    // the representative order: same type, the representative's key, the name differs at most in the ordinal
    const rinfo = asRepresentative.infoOf(s);
    check(rinfo.type === want.type, `${name} ${s.subgroup}: representative order gives type ${rinfo.type}, want ${want.type}`);
    check(rinfo.key === want.representativeKey, `${name} ${s.subgroup}: representative key ${rinfo.key}, want ${want.representativeKey}`);
    check(rinfo.key >= info.key, `${name} ${s.subgroup}: class key ${info.key} is not the least`);
    check(rinfo.name.replace(/#\d+$/, '') === want.name.replace(/#\d+$/, ''), `${name} ${s.subgroup}: representative order gives ${rinfo.name}, want ${want.name} up to the ordinal`);
    check(asRepresentative.entryByName(rinfo.name) === s, `${name}: entryByName(${rinfo.name}) in the representative order`);
    if(rinfo.name !== want.name) moved++;
    infos.set(info.key, { name: info.name, entry: s });
    total++;
  }
  check(infos.size === data.subgroups.length, `${name}: class keys are not distinct`);
  defaultInfos.set(name, infos);
  check(bad === 0, `${name}: ${bad} names differ from the catalogue`);
  changed += moved;
  console.log(`  ${name.padEnd(6)} ${String(data.subgroups.length).padStart(3)} subgroups to index ${ref.maxIndex}: ` +
              `${bad === 0 ? 'catalogue names reproduced' : bad + ' differ'}; the representative order moves ${moved} ordinal${moved === 1 ? '' : 's'}  (${Date.now() - t0}ms)`);
}
console.log(`  ${total} subgroups compared, ${changed} names get another ordinal in the representative order`);

// ---- 2. other domain shapes ----------------------------------------------------

console.log('\n=== other domain shapes ===');
const SHAPES = [
  ['632',  '6-2-3-2 kite'],
  ['442',  '4a-2-4b-2 square'],
  ['2222', 'parallelogram'],
  ['3*3',  '3-*-*3-* kite'],
];
for(const [name, domainShape] of SHAPES){
  const ref = catalog[name];
  const maxIndex = Math.min(ref.maxIndex, 6);
  const t0 = Date.now();
  const group = new Group(iWallpaperGroup({ name: grouplibWallpaperName(name), a: 0.5, domainShape }));
  const pres = groupPresentation(group);
  const data = subgroupsData({ name, gens: pres.gens, relators: pres.relators, maxIndex, generators: 'none' });
  const namer = makeSubgroupNamer({ data, presentation: { name, domainShape, gens: pres.gens, relators: pres.relators } });
  check(namer.isCatalogue, `${name} [${domainShape}]: catalogue naming not in effect`);
  const byKey = defaultInfos.get(name);
  const refNames = [...byKey.values()].filter(v => v.entry.index <= maxIndex).map(v => v.name).sort();
  const names = [];
  const keys = new Set();
  let bad = 0, noKey = 0;
  for(const s of data.subgroups){
    const info = namer.infoOf(s);
    names.push(info.name);
    if(!info.key){ noKey++; continue; }
    keys.add(info.key);
    const want = byKey.get(info.key);
    if(!want){ bad++; if(bad <= 5) console.log(`  ${name} [${domainShape}] ${s.subgroup}: class key not among the default domain's: ${info.key}`); continue; }
    if(want.name !== info.name){
      bad++;
      if(bad <= 5) console.log(`  MISMATCH ${name} [${domainShape}] ${s.subgroup}: got ${info.name} want ${want.name}`);
    }
  }
  check(noKey === 0, `${name} [${domainShape}]: ${noKey} subgroups without a class key`);
  check(bad === 0, `${name} [${domainShape}]: ${bad} names differ from the default domain's`);
  const same = JSON.stringify(names.sort()) === JSON.stringify(refNames);
  check(same, `${name} [${domainShape}]: the multiset of names differs from the default domain's`);
  const defaultKeys = new Set([...byKey.entries()].filter(([k, v]) => v.entry.index <= maxIndex).map(([k]) => k));
  check(keys.size === defaultKeys.size && [...keys].every(k => defaultKeys.has(k)), `${name} [${domainShape}]: the class keys differ from the default domain's`);
  console.log(`  ${name.padEnd(5)} [${domainShape}] ${data.subgroups.length} subgroups: ${bad === 0 && same ? 'same names as the default domain' : 'DIFFERENT'}  (${Date.now() - t0}ms)`);
}

// ---- 3. outside the catalogue -------------------------------------------------

console.log('\n=== outside the catalogue ===');
{
  const data = subgroupsData({ preset: 'klm:237', maxIndex: 8, generators: 'none' });
  const namer = makeSubgroupNamer({ data, presentation: { name: '237', preset: 'klm:237' } });
  check(!namer.isCatalogue, 'klm:237: catalogue naming should not apply');
  const ids = data.subgroups.map(s => namer.nameOf(s));
  check(ids.every((id, i) => id === data.subgroups[i].subgroup), 'klm:237: names are the sublib ids');
  check(namer.entryByName(data.subgroups[1].subgroup) === data.subgroups[1], 'klm:237: entryByName by id');
  console.log(`  klm:237 ${data.subgroups.length} subgroups keep their ids (${ids.slice(0, 3).join(', ')}, ...)`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
