/*
  test for lib/grouplib/GroupPresentation.js

    node tests/wallpaper/presentation.mjs

  1. for every wallpaper group of the sublib catalogue, the presentation derived
     from the grouplib fundamental domain defines the same group as the
     catalogue presentation: sublib finds the same number of subgroups of every
     index <= MAX_INDEX with both (the relators themselves are verified to be
     identities inside groupPresentation()).  Whether the two enumerations are
     identical (same coset tables in the same order) is reported as well.
  2. every domain shape of a group gives a presentation of the same group:
     same subgroup counts as the catalogue presentation.
  3. the catalogue relators hold for the grouplib group, i.e. the catalogue
     generators are the grouplib sides in order (reported per group).
*/

import { iWallpaperGroup, WallpaperDomainShapes, getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { Group, ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { groupPresentation } from '../../lib/grouplib/GroupPresentation.js';
import { sameTransform } from '../../lib/grouplib/SubgroupDomain.js';
import { subgroupsData, WALLPAPER_NAMES, wallpaperPresentation, makePresentation } from '../../lib/sublib/src/sublib.js';

const MAX_INDEX = 6;
const GEO = { a: 0.5, b: 0.5, c: 0.038 };

let failures = 0;
const check = (ok, msg) => { if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; };

const testPoints = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0])];
const identity = new ITransform([], '');

function counts(data){ return data.countPerIndex.map(c => `${c.index}:${c.count}`).join(' '); }
function tables(data){ return data.subgroups.map(s => s.cosets).join(' | '); }

function enumerate(spec){
  return subgroupsData({ ...spec, maxIndex: MAX_INDEX, generators: 'none' });
}

/** do the relators of a presentation hold for the group's direct transforms? */
function relatorsHold(group, gens, relators){
  const names = group.getGenNames();
  const direct = group.getTransforms().map((t, i) => new ITransform(t.slice(), names[i]));
  const pres = makePresentation(gens, relators);
  return pres.relators.every(word => {
    let t = new ITransform([], '');
    for(const x of word){
      const g = direct[Math.abs(x) - 1];
      t = t.concat(x > 0 ? g : g.getInverse());
    }
    return sameTransform(t, identity, testPoints);
  });
}

console.log(`subgroups to index ${MAX_INDEX}\n`);

const catalogueCounts = {};
for(const name of WALLPAPER_NAMES){
  const t0 = Date.now();
  const preset = wallpaperPresentation(name);
  const group = new Group(iWallpaperGroup({ name, ...GEO }));
  let pres;
  try {
    pres = groupPresentation(group);
  } catch(e){
    failures++;
    console.log(`${name.padEnd(6)} ERROR ${e.message}`);
    continue;
  }
  const fromCatalogue = enumerate({ preset: 'wallpaper:' + name });
  const fromDomain = enumerate({ name, gens: pres.gens, relators: pres.relators });
  catalogueCounts[name] = counts(fromCatalogue);
  const sameCounts = counts(fromCatalogue) === counts(fromDomain);
  const sameTables = tables(fromCatalogue) === tables(fromDomain);
  const presetHolds = relatorsHold(group, preset.gens, preset.relators);
  check(sameCounts, `${name}: subgroup counts differ, catalogue ${counts(fromCatalogue)} vs derived ${counts(fromDomain)}`);
  console.log(`${name.padEnd(6)} derived:   ${pres.gens} | ${pres.relators}`);
  console.log(`       catalogue: ${preset.gens} | ${preset.relators}`);
  console.log(`       subgroups ${counts(fromCatalogue)}  same counts: ${sameCounts ? 'yes' : 'NO'}` +
              `  identical tables: ${sameTables ? 'yes' : 'no'}  catalogue relators hold: ${presetHolds ? 'yes' : 'NO'}` +
              `  ${Date.now() - t0}ms`);
}

console.log('\ndomain shapes:');
for(const name of Object.keys(WallpaperDomainShapes)){
  const key = { 'O': 'o', 'XX': 'xx', '*X': '*x', '22X': '22x' }[name] || name;
  for(const shape of getWallpaperDomainShapes(name)){
    const t0 = Date.now();
    const group = new Group(iWallpaperGroup({ name, ...GEO, domainShape: shape }));
    let pres;
    try {
      pres = groupPresentation(group);
    } catch(e){
      failures++;
      console.log(`${name} '${shape}': ERROR ${e.message}`);
      continue;
    }
    const data = enumerate({ name, gens: pres.gens, relators: pres.relators });
    const same = counts(data) === catalogueCounts[key];
    check(same, `${name} '${shape}': subgroup counts ${counts(data)} differ from the catalogue ${catalogueCounts[key]}`);
    console.log(`${name} '${shape}': ${pres.gens} | ${pres.relators}`);
    console.log(`       pairing ${pres.pairing.join(' ')}, cycles ` +
                pres.cycles.map(c => `${c.word}^${c.order}`).join(' ') +
                `, subgroups ${counts(data)}  same counts: ${same ? 'yes' : 'NO'}  ${Date.now() - t0}ms`);
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
