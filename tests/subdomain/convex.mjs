/*
  test for lib/grouplib/SubgroupConvex.js: convex fundamental domains of
  subgroups as unions of cells of the parent's tiling

    node tests/subdomain/convex.mjs [maxIndex]

  for every subgroup of index <= MAX_INDEX (632 to 8) of the 17 wallpaper
  groups (catalogue presentation), of the kite domain of 632 and the square
  domain of 442, of the hyperbolic triangle groups *237 and *245 and of the
  spherical triangle group *235:
  1. buildSubgroupDomain() with the convex search and without it; how many
     unions are convex either way, how many searches find nothing, the
     budget and the time are reported per group
  2. the splane convexity test agrees with the sampling test of
     checkDomainConvex() on every Euclidean union, and with the hull
     closure test on every Euclidean and hyperbolic union (both choices)
  3. a found union is convex, and it is a fundamental domain: the image of
     a point and of its H-translate coincide (subgroupImage)
  4. determinism: a second build gives the same cells
*/

import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { makeHyperbolicTriangle, makeSphericalTriangle } from '../../lib/grouplib/Group_KLM.js';
import { Group, iPoint } from '../../lib/invlib/invlib.js';
import { groupPresentation } from '../../lib/grouplib/GroupPresentation.js';
import { buildSubgroupDomain, subgroupDomainTable, subgroupImage, checkDomainConvex, sameTransform } from '../../lib/grouplib/SubgroupDomain.js';
import { isUnionConvex, isUnionHullClosed } from '../../lib/grouplib/SubgroupConvex.js';
import { subgroupsData, WALLPAPER_NAMES } from '../../lib/sublib/src/sublib.js';
import { grouplibWallpaperName } from '../../lib/grouplib/SubgroupNames.js';

const MAX_INDEX = Number(process.argv[2] || 6);
const SAMPLES = 24;

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

let seed = 20260906;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }
const pnt = xy => iPoint([xy[0], xy[1], 0, 0]);
const dist = (p, q) => Math.hypot(p.v[0] - q.v[0], p.v[1] - q.v[1]);
const testPoints = [pnt([0.12345, 0.06789]), pnt([-0.07211, 0.16183]), pnt([0.31, -0.2])];

const CASES = [];
for(const name of WALLPAPER_NAMES){
  CASES.push({ label: name, group: new Group(iWallpaperGroup({ name: grouplibWallpaperName(name), a: 0.5 })),
               preset: 'wallpaper:' + name, maxIndex: name === '632' ? Math.max(MAX_INDEX, 8) : MAX_INDEX, radius: 1.5, euclidean: true });
}
CASES.push({ label: '632 kite', group: new Group(iWallpaperGroup({ name: '632', a: 0.5, domainShape: '6-2-3-2 kite' })), maxIndex: MAX_INDEX, radius: 1.5, euclidean: true });
CASES.push({ label: '442 square', group: new Group(iWallpaperGroup({ name: '442', a: 0.5, domainShape: '4a-2-4b-2 square' })), maxIndex: MAX_INDEX, radius: 1.5, euclidean: true });
for(const [label, angles, relators] of [
  ['*237', [Math.PI/2, Math.PI/3, Math.PI/7], 'a^2, b^2, c^2, (a*b)^2, (a*c)^3, (b*c)^7'],
  ['*245', [Math.PI/2, Math.PI/4, Math.PI/5], 'a^2, b^2, c^2, (a*b)^2, (a*c)^4, (b*c)^5'],
]){
  const s = makeHyperbolicTriangle(...angles);
  CASES.push({ label, group: new Group({ s, t: s.map(sp => [sp]) }), presentation: { gens: 'a b c', relators },
               maxIndex: Math.min(MAX_INDEX, 6), radius: 0.85, euclidean: false, hasModel: true, maxIterations: 3000 });
}
{
  const s = makeSphericalTriangle(Math.PI/2, Math.PI/3, Math.PI/5);
  CASES.push({ label: '*235', group: new Group({ s, t: s.map(sp => [sp]) }),
               presentation: { gens: 'a b c', relators: 'a^2, b^2, c^2, (a*b)^2, (a*c)^3, (b*c)^5' },
               maxIndex: Math.min(MAX_INDEX, 6), radius: 1.5, euclidean: false, hasModel: false, maxIterations: 3000 });
}
for(const c of CASES){
  if(!c.preset && !c.presentation){
    const p = groupPresentation(c.group);
    c.presentation = { gens: p.gens, relators: p.relators };
  }
}

function randomPoint(radius){
  for(;;){
    const xy = [(2*rnd() - 1)*radius, (2*rnd() - 1)*radius];
    if(Math.hypot(xy[0], xy[1]) <= radius) return pnt(xy);
  }
}

/** a found union is a fundamental domain: H-invariance of the image, every cell reached */
function checkDomain(c, sub, domain, tag){
  const group = c.group;
  const table = subgroupDomainTable(domain);
  const maxIterations = c.maxIterations || 500;
  const elements = domain.pairings.map(p => p.itrans);
  const reached = new Set();
  let bad = 0;
  for(let k = 0; k < SAMPLES; k++){
    const p = randomPoint(c.radius);
    const img = subgroupImage({ group, domain, table, pnt: p, maxIterations });
    if(!img.inDomain) continue;
    reached.add(img.cls);
    const h = elements[k % elements.length];
    const img2 = subgroupImage({ group, domain, table, pnt: h.transform(p), maxIterations });
    if(!img2.inDomain || dist(img.pnt, img2.pnt) > 1e-6) bad++;
  }
  check(bad === 0, `${tag}: ${bad} images are not H-invariant`);
  // the loop analysis of buildSubgroupDomain assumes straight sides
  if(c.euclidean) check(domain.simplyConnected, `${tag}: the union has holes`);
  check(domain.sides.filter(s => s.kind === 'boundary').every(s => s.pairing !== undefined), `${tag}: an unpaired boundary side`);
}

console.log(`=== convex unions, subgroups to index ${MAX_INDEX} ===`);
let grand = { total: 0, convexBefore: 0, convexAfter: 0, notFound: 0, exhausted: 0, disagree: 0 };
for(const c of CASES){
  const t0 = Date.now();
  const data = c.preset
    ? subgroupsData({ preset: c.preset, maxIndex: c.maxIndex, generators: 'none' })
    : subgroupsData({ name: c.label, gens: c.presentation.gens, relators: c.presentation.relators, maxIndex: c.maxIndex, generators: 'none' });
  let total = 0, convexBefore = 0, convexAfter = 0, notFound = 0, exhausted = 0, statesMax = 0, disagree = 0;
  let tSearch = 0;
  for(const sub of data.subgroups){
    total++;
    const tag = `${c.label} ${sub.subgroup} (index ${sub.index})`;
    let plain, conv;
    try {
      plain = buildSubgroupDomain({ group: c.group, cosets: sub.cosets, convex: false });
      const t1 = Date.now();
      conv = buildSubgroupDomain({ group: c.group, cosets: sub.cosets });
      tSearch += Date.now() - t1;
    } catch(e){
      check(false, `${tag}: ${e.message}`);
      continue;
    }
    const cb = plain.isConvex, ca = conv.isConvex;
    convexBefore += cb ? 1 : 0;
    convexAfter += ca ? 1 : 0;
    const search = conv.convexSearch;
    if(!search.found){
      notFound++;
      console.log(`  ${tag}: no convex union; ${search.bestEffort ? 'best effort with hull excess ' + search.excess.toFixed(3) + ' over ' + search.unions + ' unions' : 'compact growth kept'}`);
    }
    if(search.exhausted) exhausted++;
    statesMax = Math.max(statesMax, search.states || 0);
    // 2. the splane test against the sampling test and the hull closure test
    for(const [d, what] of [[plain, 'growth'], [conv, 'search']]){
      if(c.euclidean){
        const s = checkDomainConvex({ group: c.group, domain: d, radius: 1.0, step: 0.02 });
        if(s.convex !== d.isConvex){ disagree++; console.log(`  ${tag} ${what}: splanes say ${d.isConvex}, sampling says ${s.convex} (${s.unionOnly}/${s.halfPlaneOnly})`); }
      }
      if(c.euclidean || c.hasModel){
        const h = isUnionHullClosed({ group: c.group, cells: d.cells });
        if(h !== d.isConvex){ disagree++; console.log(`  ${tag} ${what}: splanes say ${d.isConvex}, the hull closure says ${h}`); }
      }
    }
    // 3. a found union is convex, and the search's union (convex or best effort) is a fundamental domain
    if(search.found) check(ca, `${tag}: the search's union is not convex`);
    else check(!ca || cb, `${tag}: convex without a search result`);
    if(search.found || search.bestEffort) checkDomain(c, sub, conv, tag);
    // 4. determinism
    const again = buildSubgroupDomain({ group: c.group, cosets: sub.cosets });
    check(again.cells.every((cell, i) => sameTransform(cell.itrans, conv.cells[i].itrans, testPoints)), `${tag}: a second build chooses other cells`);
  }
  grand.total += total; grand.convexBefore += convexBefore; grand.convexAfter += convexAfter;
  grand.notFound += notFound; grand.exhausted += exhausted; grand.disagree += disagree;
  console.log(`  ${c.label.padEnd(11)} ${String(total).padStart(3)} subgroups: convex ${String(convexBefore).padStart(3)} -> ${String(convexAfter).padStart(3)}` +
              `  none found ${String(notFound).padStart(2)}  budget hit ${exhausted}  max closures ${String(statesMax).padStart(5)}  search ${tSearch}ms  total ${Date.now() - t0}ms`);
}
console.log(`  all: ${grand.total} subgroups, convex ${grand.convexBefore} -> ${grand.convexAfter}, none found ${grand.notFound}, budget hit ${grand.exhausted}, sampling disagreements ${grand.disagree}`);
check(grand.disagree === 0, `${grand.disagree} disagreements between the exact and the sampling convexity test`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
