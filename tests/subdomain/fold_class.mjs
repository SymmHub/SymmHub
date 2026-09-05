/*
  test for the class table, fold and packing of a subgroup domain
  (lib/grouplib/SubgroupDomain.js: subgroupDomainTable, subgroupFold,
  subgroupImage, packSubgroupDomain) - the CPU twin of what the overlay
  shaders do with a subgroup (lib/shaders/overlay_subgroup.glsl.mjs)

    node tests/subdomain/fold_class.mjs

  for every subgroup of index <= MAX_INDEX of a few wallpaper groups (default
  and other domain shapes) and of the hyperbolic triangle group *237:
  1. the fold of random points converges, ends in F and its class is a cell
  2. H-invariance: p and h(p), h an element of H, have the same image in the
     domain of H, and the image maps of p and h(p) differ by h
  3. the image of p is p itself exactly when p lies in a transversal cell,
     and the class is then that cell
  4. the boundary table agrees with the geometry: the wall across side s of
     the cell of p lies between two H-tiles iff boundary[class][s]
     (wallpaper groups: the sides are straight)
  5. the packed array carries the table, the cell transforms and F's sides
*/

import { iWallpaperGroup } from '../../lib/grouplib/WallpaperGroups.js';
import { makeHyperbolicTriangle } from '../../lib/grouplib/Group_KLM.js';
import { Group, iPoint } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { domainCorners, groupPresentation } from '../../lib/grouplib/GroupPresentation.js';
import {
  buildSubgroupDomain,
  subgroupDomainTable,
  subgroupFold,
  subgroupImage,
  packSubgroupDomain,
  sameTransform,
} from '../../lib/grouplib/SubgroupDomain.js';
import { subgroupsData } from '../../lib/sublib/src/sublib.js';

const MAX_INDEX = 6;
const SAMPLES = 60;
const EPS = 1e-7;

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

// deterministic pseudo random numbers
let seed = 20260905;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

const pnt = xy => iPoint([xy[0], xy[1], 0, 0]);
const dist = (p, q) => Math.hypot(p.v[0]-q.v[0], p.v[1]-q.v[1]);
const inside = (fd, p) => fd.every(s => U4.sigDistanceSP(s, p) <= EPS);
const testPoints = [pnt([0.12345, 0.06789]), pnt([-0.07211, 0.16183]), pnt([0.31, -0.2])];

// ---- the groups ----------------------------------------------------------------

const CASES = [];
for(const name of ['632', '442', '2222', '333', '*333', '22x'])
  CASES.push({ label: name, group: new Group(iWallpaperGroup({ name, a: 0.5, b: 0.6, c: 0.05 })),
               preset: 'wallpaper:' + name, radius: 1.5, straight: true });
CASES.push({ label: '632 kite', group: new Group(iWallpaperGroup({ name: '632', a: 0.5, domainShape: '6-2-3-2 kite' })),
             presentation: null, radius: 1.5, straight: true });
CASES.push({ label: '442 square', group: new Group(iWallpaperGroup({ name: '442', a: 0.5, domainShape: '4a-2-4b-2 square' })),
             presentation: null, radius: 1.5, straight: true });
{
  // the reflection group *237: sides s0, s1 meet at PI/2, s0, s2 at PI/3, s1, s2 at PI/7
  const s = makeHyperbolicTriangle(Math.PI/2, Math.PI/3, Math.PI/7);
  CASES.push({ label: '*237', group: new Group({ s, t: s.map(sp => [sp]) }),
               presentation: { gens: 'a b c', relators: 'a^2, b^2, c^2, (a*b)^2, (a*c)^3, (b*c)^7' },
               radius: 0.85, straight: false, maxIterations: 3000 });
}

// presentations of the domain shapes come from the geometry
for(const c of CASES){
  if(c.presentation === null){
    const p = groupPresentation(c.group);
    c.presentation = { gens: p.gens, relators: p.relators };
  }
}

// ---- helpers -------------------------------------------------------------------

function randomPoint(radius){
  for(;;){
    const xy = [(2*rnd()-1)*radius, (2*rnd()-1)*radius];
    if(Math.hypot(xy[0], xy[1]) <= radius) return pnt(xy);
  }
}

/** some elements of H: the pairing transforms and short products of them */
function elementsOf(domain){
  const gens = domain.pairings.map(p => p.itrans);
  const out = gens.slice();
  for(let k = 0; k < 6 && gens.length > 0; k++){
    const a = gens[Math.floor(rnd()*gens.length)], b = gens[Math.floor(rnd()*gens.length)];
    const c = gens[Math.floor(rnd()*gens.length)];
    out.push(a.getCopy().concat(b), a.getCopy().concat(b).concat(c));
  }
  return out;
}

/** which transversal cell holds the point, -1 for none */
function cellOf(domain, fd, p){
  return domain.cells.findIndex(c => inside(fd, c.itrans.inverseTransform(p)));
}

// ---- the tests -------------------------------------------------------------------

function testSubgroup(c, sub){
  const group = c.group;
  const fd = group.getFundDomain();
  const maxIterations = c.maxIterations || 500;
  let domain;
  try {
    domain = buildSubgroupDomain({ group, cosets: sub.cosets });
  } catch(e){
    check(false, `${c.label} ${sub.subgroup}: ${e.message}`);
    return null;
  }
  const table = subgroupDomainTable(domain);
  const tag = `${c.label} ${sub.subgroup} (index ${sub.index}, ${domain.simplyConnected ? 'simply connected' : 'with holes'})`;
  check(table.n === domain.n && table.m === fd.length, `${tag}: table size`);

  const elements = elementsOf(domain);
  let notInF = 0, badClass = 0, notInvariant = 0, notElement = 0, imageMismatch = 0, classMismatch = 0;
  let boundaryMismatch = 0, walls = 0, inCells = 0;
  const corners = c.straight ? domainCorners(fd) : null;

  for(let k = 0; k < SAMPLES; k++){
    const p = randomPoint(c.radius);

    // 1. the fold
    const f = subgroupFold({ group, table, pnt: p, maxIterations });
    if(!f.inDomain || !inside(fd, f.pnt)){ notInF++; continue; }
    if(f.cls < 0 || f.cls >= domain.n){ badClass++; continue; }
    if(dist(f.itrans.transform(p), f.pnt) > 1e-6) notInF++;

    // 2. H-invariance of the image
    const img = subgroupImage({ group, domain, table, pnt: p, maxIterations });
    const h = elements[k % elements.length];
    const img2 = subgroupImage({ group, domain, table, pnt: h.transform(p), maxIterations });
    if(!img2.inDomain || dist(img.pnt, img2.pnt) > 1e-6) notInvariant++;
    // the image map of h(p) after h is the image map of p (words act left to right)
    const m1 = img.itrans, m2 = h.getCopy().concat(img2.itrans);
    if(!sameTransform(m1, m2, testPoints)) notElement++;

    // 3. the image is the point exactly in the transversal cells
    const j = cellOf(domain, fd, p);
    const fixed = dist(img.pnt, p) < 1e-6;
    if(j >= 0){
      inCells++;
      if(!fixed) imageMismatch++;
      if(img.cls !== j) classMismatch++;
    } else if(fixed){
      imageMismatch++;
    }

    // 4. the boundary table against the geometry
    if(c.straight){
      for(let s = 0; s < fd.length; s++){
        const cs = corners.filter(cn => cn.sides.includes(s)).map(cn => cn.point);
        if(cs.length !== 2) continue;
        const mid = [(cs[0][0]+cs[1][0])/2, (cs[0][1]+cs[1][1])/2];
        const n = [fd[s].v[0], fd[s].v[1]];
        const d = 1e-3;
        // two points in F's frame on both sides of the wall, mapped back into the cell of p
        const a = f.itrans.inverseTransform(pnt([mid[0] - d*n[0], mid[1] - d*n[1]]));
        const b = f.itrans.inverseTransform(pnt([mid[0] + d*n[0], mid[1] + d*n[1]]));
        const ia = subgroupImage({ group, domain, table, pnt: a, maxIterations });
        const ib = subgroupImage({ group, domain, table, pnt: b, maxIterations });
        if(!ia.inDomain || !ib.inDomain) continue;
        walls++;
        if(ia.cls !== f.cls) classMismatch++;
        // the same H-tile: the same element of H maps both points into the domain
        const sameTile = sameTransform(ia.itrans, ib.itrans, testPoints);
        if(sameTile === table.boundary[f.cls][s]) boundaryMismatch++;
      }
    }
  }

  check(notInF === 0, `${tag}: ${notInF} points did not fold into F`);
  check(badClass === 0, `${tag}: ${badClass} folds gave a class out of range`);
  check(notInvariant === 0, `${tag}: ${notInvariant} images are not H-invariant`);
  check(notElement === 0, `${tag}: ${notElement} image maps of p and h(p) do not differ by h`);
  check(imageMismatch === 0, `${tag}: ${imageMismatch} points are fixed by the image map iff not in a transversal cell`);
  check(classMismatch === 0, `${tag}: ${classMismatch} classes disagree with the cell`);
  check(boundaryMismatch === 0, `${tag}: ${boundaryMismatch} of ${walls} walls disagree with the boundary table`);

  // 5. the packed array
  const data = packSubgroupDomain(domain);
  const n = data[1], m = data[2], tableOffset = data[3];
  let packOk = (n === domain.n && m === fd.length && tableOffset*4 + 4*n*m === data.length);
  for(let j = 0; j < domain.n && packOk; j++){
    for(let s = 0; s < fd.length; s++){
      const k = 4*(tableOffset + j*m + s);
      if(data[k] !== table.next[j][s] || (data[k+1] === 1) !== table.boundary[j][s]) packOk = false;
    }
  }
  // the transforms: cell j has as many reflections as its transform
  const transformsOffset = data[4];
  packOk = packOk && (data[4*transformsOffset] === domain.n);
  for(let j = 0; j < domain.n && packOk; j++){
    const off = data[4*(transformsOffset + 1 + j)];
    if(data[4*off] !== domain.cells[j].itrans.getRef().length) packOk = false;
  }
  const domainOffset = data[0];
  packOk = packOk && data[4*domainOffset] === fd.length;
  check(packOk, `${tag}: packed data`);

  return { cells: domain.n, sides: domain.sides.filter(sd => sd.kind === 'boundary').length, inCells, walls };
}

let total = 0;
for(const c of CASES){
  const t0 = Date.now();
  const data = c.presentation
    ? subgroupsData({ name: c.label, gens: c.presentation.gens, relators: c.presentation.relators, maxIndex: MAX_INDEX })
    : subgroupsData({ preset: c.preset, maxIndex: MAX_INDEX });
  console.log(`\n=== ${c.label}: ${data.subgroups.length} subgroups to index ${MAX_INDEX} ===`);
  for(const sub of data.subgroups){
    const r = testSubgroup(c, sub);
    total++;
    if(r) console.log(`  ${String(sub.subgroup).padEnd(12)} index ${String(sub.index).padStart(2)}  cells ${String(r.cells).padStart(2)}  boundary sides ${String(r.sides).padStart(2)}  samples in cells ${r.inCells}  walls checked ${r.walls}`);
  }
  console.log(`  ${Date.now() - t0}ms`);
}

console.log(`\n${total} subgroups tested`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
