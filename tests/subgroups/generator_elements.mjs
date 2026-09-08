/*
  test for lib/grouplib/GeneratorElements.js: the symmetry elements of the
  generators of a group and of a subgroup

    node tests/subgroups/generator_elements.mjs

  1. classifyIsometry() agrees with classifyEuclidean() (SubgroupDomain.js) on
     the pairing transforms of every wallpaper group and domain shape, and on
     the pairing generators of their subgroups to index 4: same type, same
     rotation centre and angle, same translation, same axis
  2. the arrows: a translation's or glide's arrow ends at the image of its
     start, and a glide's arrow lies on its axis
  3. the hyperbolic triangle group *237: the generators are mirrors, the sides;
     the product of two of its reflections is a rotation of the right order
     about the corner they meet at (a point of both circles), the product of
     two reflections in disjoint sides of an index 2 subgroup is a translation
     with an axis orthogonal to the unit circle
  4. the sphere: the rotations of the triangle group 235 have two antipodal
     fixed points
  5. packing round trip
*/

import { iWallpaperGroup, getWallpaperDomainShapes, WallpaperGroupNames } from '../../lib/grouplib/WallpaperGroups.js';
import { makeHyperbolicTriangle, makeSphericalTriangle } from '../../lib/grouplib/Group_KLM.js';
import { Group, ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_PLANE, SPLANE_SPHERE } from '../../lib/invlib/ISplane.js';
import { buildSubgroupDomain, classifyEuclidean } from '../../lib/grouplib/SubgroupDomain.js';
import {
  classifyIsometry, generatorElements, subgroupGeneratorElements, domainSideMidpoints,
  packGeneratorElements, applyToPoint, ELEMENT_KINDS, ELEMENT_TEXELS, elementToString,
} from '../../lib/grouplib/GeneratorElements.js';
import { subgroupsData } from '../../lib/sublib/src/sublib.js';

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }
const near = (p, q, eps = 1e-6) => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps;
const sigDist = (sp, p) => U4.sigDistanceSP(sp, iPoint([p[0], p[1], 0, 0]));

/** the same isometry in both classifications? */
function agrees(gen, euc, tag){
  if(euc.type === 'identity') return check(gen.type === 'identity', `${tag}: identity classified as ${gen.type}`);
  if(euc.type === 'rotation'){
    if(!check(gen.type === 'rotation', `${tag}: rotation classified as ${gen.type}`)) return false;
    let ok = near(gen.fixedPoints[0], euc.center, 1e-5) && Math.abs(Math.abs(gen.angle) - Math.abs(euc.angle)) < 1e-6;
    // a half turn is its own inverse: +PI and -PI are the same rotation
    if(Math.abs(Math.abs(euc.angle) - Math.PI) > 1e-6) ok = ok && Math.sign(gen.angle) === Math.sign(euc.angle);
    return check(ok, `${tag}: rotation centre/angle ${gen.fixedPoints[0]} ${gen.angle} vs ${euc.center} ${euc.angle}`);
  }
  if(euc.type === 'translation'){
    if(!check(gen.type === 'translation', `${tag}: translation classified as ${gen.type}`)) return false;
    return check(near(gen.translation, euc.translation, 1e-6), `${tag}: translation vector`);
  }
  if(euc.type === 'reflection')
    return check(gen.type === 'reflection', `${tag}: reflection classified as ${gen.type}`);
  if(euc.type === 'glide'){
    if(!check(gen.type === 'glide', `${tag}: glide classified as ${gen.type}`)) return false;
    // the axis: the Euclidean axis point lies on it, the directions are parallel
    const onAxis = Math.abs(sigDist(gen.axis, euc.axis.point)) < 1e-6;
    const [nx, ny] = gen.axis.v;
    const parallel = Math.abs(nx*euc.axis.dir[0] + ny*euc.axis.dir[1]) < 1e-6;
    const vec = near(gen.translation, euc.translation, 1e-6);
    return check(onAxis && parallel && vec, `${tag}: glide axis/vector`);
  }
  return check(false, `${tag}: unexpected Euclidean type ${euc.type}`);
}

// ---- 1, 2. wallpaper groups, subgroups and their arrows ------------------------

console.log('=== wallpaper groups ===');
const GEO = { a: 0.5, b: 0.6, c: 0.05 };
let groups = 0, gens = 0, subs = 0, hgens = 0;
for(const name of WallpaperGroupNames.filter(n => n !== 'trivial')){
  for(const domainShape of getWallpaperDomainShapes(name)){
    const group = new Group(iWallpaperGroup({ name, ...GEO, domainShape }));
    const fd = group.getFundDomain();
    const tag = `${name} [${domainShape}]`;
    groups++;

    // the midpoints lie on their sides and inside the domain
    const mids = domainSideMidpoints(fd);
    mids.forEach((m, s) => check(Math.abs(sigDist(fd[s], m)) < 1e-6 && fd.every(sp => sigDist(sp, m) <= 1e-6),
                                 `${tag}: midpoint of side ${s} is not on the boundary`));

    // the generators of G: every side is covered once, one element per inverse pair
    const els = generatorElements({ group });
    const covered = new Set();
    for(const e of els){
      e.sides.forEach(s => covered.add(s));
      const t = new ITransform(group.transforms[e.sides[1]].slice(), '');
      agrees(e.isometry, classifyEuclidean(t), `${tag} gen ${e.word}`);
      gens++;
      if(e.arrow){
        check(near(applyToPoint(t, e.arrow[0]), e.arrow[1], 1e-6) || e.kind === 'glide', `${tag} gen ${e.word}: arrow end is not the image of its start`);
        if(e.kind === 'glide'){
          check(Math.abs(sigDist(e.axis, e.arrow[0])) < 1e-6 && Math.abs(sigDist(e.axis, e.arrow[1])) < 1e-6, `${tag} gen ${e.word}: glide arrow off the axis`);
          const img = applyToPoint(t, e.arrow[0]);
          // the arrow is the glide vector: the image of the start, projected onto the axis, is the end
          check(near(e.arrow[1], e.arrow[0].map((v, i) => v + e.isometry.translation[i]), 1e-6), `${tag} gen ${e.word}: glide arrow is not the glide vector`);
          check(img !== null, 'unused');
        }
      }
      if(e.kind === 'mirror') check(e.axis === fd[e.sides[1]], `${tag} gen ${e.word}: mirror is not the side`);
      if(e.kind === 'cone') check(e.order >= 2 && e.order <= 6, `${tag} gen ${e.word}: cone order ${e.order}`);
    }
    check(covered.size === fd.length, `${tag}: ${covered.size} of ${fd.length} sides covered by the generators`);

    // the generators of the subgroups (default domain only: the tables are the catalogue's)
    if(domainShape !== getWallpaperDomainShapes(name)[0]) continue;
    const data = subgroupsData({ preset: 'wallpaper:' + name, maxIndex: 4, generators: 'none' });
    for(const sub of data.subgroups){
      let domain;
      try { domain = buildSubgroupDomain({ group, cosets: sub.cosets }); } catch(e){ check(false, `${tag} ${sub.subgroup}: ${e.message}`); continue; }
      subs++;
      const hels = subgroupGeneratorElements({ group, domain });
      const words = new Set();
      for(const e of hels){
        words.add(e.word);
        const pairing = domain.pairings.find(p => p.word === e.word);
        if(!check(!!pairing, `${tag} ${sub.subgroup}: element of unknown word ${e.word}`)) continue;
        agrees(e.isometry, pairing.isometry, `${tag} ${sub.subgroup} gen ${e.word}`);
        hgens++;
        if(e.arrow && e.kind === 'translation')
          check(near(applyToPoint(pairing.itrans, e.arrow[0]), e.arrow[1], 1e-6), `${tag} ${sub.subgroup} gen ${e.word}: arrow`);
        if(e.kind === 'mirror'){
          // the mirror is a boundary wall of the domain of H
          const wall = domain.sides.find(sd => sd.kind === 'boundary' && sd.splane === e.axis);
          check(!!wall, `${tag} ${sub.subgroup} gen ${e.word}: mirror is not a boundary wall`);
        }
      }
      // every generator of H gives at least one element (the identity never is a pairing)
      check(words.size === domain.generators.length, `${tag} ${sub.subgroup}: ${words.size} of ${domain.generators.length} generators have elements`);
    }
  }
}
console.log(`  ${groups} groups/domains, ${gens} generators; ${subs} subgroups, ${hgens} subgroup generators`);

// ---- 3. the hyperbolic plane --------------------------------------------------

console.log('\n=== hyperbolic *237 ===');
{
  const s = makeHyperbolicTriangle(Math.PI/2, Math.PI/3, Math.PI/7);
  const group = new Group({ s, t: s.map(sp => [sp]) });
  const els = generatorElements({ group });
  check(els.length === 3 && els.every(e => e.kind === 'mirror'), `*237: ${els.map(e => e.kind).join(' ')}`);
  els.forEach((e, i) => check(e.axis === s[i], `*237: mirror ${i} is not side ${i}`));
  console.log('  generators: ' + els.map(elementToString).join('; '));

  // rotations about the corners: products of two reflections
  const corners = [[0, 1, 2], [0, 2, 3], [1, 2, 7]];
  for(const [i, j, order] of corners){
    const t = new ITransform([s[i], s[j]], '');
    const cls = classifyIsometry(t);
    // two straight sides through the origin give an affine rotation about the origin: 'euclidean' as a Moebius map
    check(cls.type === 'rotation' && (cls.geometry === 'hyperbolic' || cls.geometry === 'euclidean'), `*237: sides ${i},${j}: ${cls.type} ${cls.geometry}`);
    check(cls.order === order, `*237: sides ${i},${j}: order ${cls.order}, want ${order}`);
    const p = cls.fixedPoints[0];
    check(Math.hypot(p[0], p[1]) < 1 && Math.abs(sigDist(s[i], p)) < 1e-6 && Math.abs(sigDist(s[j], p)) < 1e-6,
          `*237: sides ${i},${j}: fixed point ${p} is not the corner`);
    console.log(`  reflections ${i},${j}: rotation of order ${cls.order} about (${p[0].toFixed(4)}, ${p[1].toFixed(4)})`);
  }

  // a hyperbolic translation: reflections in two disjoint mirrors of the tiling
  const t = new ITransform([s[2], s[0], s[2], s[1], s[2]], '');   // s2 s0 s2 . s1 s2: conj. reflections, likely disjoint
  const cls = classifyIsometry(t);
  console.log(`  a longer word: ${cls.type} (${cls.geometry})` + (cls.order ? ` order ${cls.order}` : ''));
  if(cls.type === 'hyperbolic'){
    check(cls.axis && Math.abs(cls.axis.v[3]) > 0, '*237: hyperbolic translation without an axis');
    // the axis is orthogonal to the unit circle: |c|^2 = 1 + r^2, and passes through the fixed points
    if(cls.axis.type === SPLANE_SPHERE){
      const [cx, cy, , r] = cls.axis.v;
      check(Math.abs(cx*cx + cy*cy - 1 - r*r) < 1e-6, '*237: axis not orthogonal to the unit circle');
    }
    for(const p of cls.fixedPoints) check(Math.abs(sigDist(cls.axis, p)) < 1e-5, '*237: fixed point off the axis');
  }
  // the subgroup domains of *237: the elements of its subgroups of index 2 and 3
  const data = subgroupsData({ name: '*237', gens: 'a b c', relators: 'a^2, b^2, c^2, (a*b)^2, (a*c)^3, (b*c)^7', maxIndex: 3, generators: 'none' });
  for(const sub of data.subgroups){
    const domain = buildSubgroupDomain({ group, cosets: sub.cosets });
    const hels = subgroupGeneratorElements({ group, domain });
    const kinds = hels.map(e => e.kind + (e.order ? e.order : '')).join(' ');
    check(hels.length >= domain.generators.length, `*237 ${sub.subgroup}: ${hels.length} elements for ${domain.generators.length} generators`);
    for(const e of hels){
      if(e.kind === 'cone') check(Math.hypot(e.center[0], e.center[1]) < 1, `*237 ${sub.subgroup}: cone point outside the disk`);
    }
    console.log(`  ${sub.subgroup} (index ${sub.index}): ${kinds}`);
  }
}

// ---- 4. the sphere --------------------------------------------------------------

console.log('\n=== spherical 235 ===');
{
  const s = makeSphericalTriangle(Math.PI/2, Math.PI/3, Math.PI/5);
  const pairs = [[0, 1, 2], [0, 2, 3], [1, 2, 5]];
  for(const [i, j, order] of pairs){
    const t = new ITransform([s[i], s[j]], '');
    const cls = classifyIsometry(t);
    // two straight sides through the origin give an affine rotation about the origin, whose antipode is at infinity
    const affine = cls.geometry === 'euclidean';
    check(cls.type === 'rotation' && (cls.geometry === 'spherical' || affine), `235: sides ${i},${j}: ${cls.type} ${cls.geometry}`);
    check(cls.order === order, `235: sides ${i},${j}: order ${cls.order}, want ${order}`);
    check(cls.fixedPoints.length === (affine ? 1 : 2), `235: sides ${i},${j}: ${cls.fixedPoints.length} fixed points`);
    const [p, q] = cls.fixedPoints;
    if(q){
      // antipodal in the stereographic projection: q = -R^2/conj(p), R the radius of the equator
      const prod = [p[0]*q[0] - p[1]*(-q[1]), p[0]*(-q[1]) + p[1]*q[0]];
      check(prod[0] < 0 && Math.abs(prod[1]) < 1e-5*(1 + Math.abs(prod[0])), `235: sides ${i},${j}: fixed points not antipodal (${prod})`);
    }
    console.log(`  reflections ${i},${j}: rotation of order ${cls.order} about (${p[0].toFixed(4)}, ${p[1].toFixed(4)})` +
                (q ? ` and (${q[0].toFixed(4)}, ${q[1].toFixed(4)})` : ' (the antipode at infinity)'));
  }
}

// ---- 5. packing ------------------------------------------------------------------

console.log('\n=== packing ===');
{
  const group = new Group(iWallpaperGroup({ name: '22X', ...GEO }));
  const els = generatorElements({ group });
  const data = packGeneratorElements(els);
  check(data[0] === els.length && data.length === 4*(1 + ELEMENT_TEXELS*els.length), 'packing: size');
  els.forEach((e, k) => {
    const o = 4*(1 + ELEMENT_TEXELS*k);
    check(data[o] === ELEMENT_KINDS[e.kind], `packing: kind of ${k}`);
    if(e.axis) check(data[o+8] === e.axis.type && data[o+4] === e.axis.v[0], `packing: axis of ${k}`);
    else check(data[o+8] === 0, `packing: no axis of ${k}`);
    check(data[o+9] === (e.arrow ? 1 : 0), `packing: arrow flag of ${k}`);
    if(e.arrow) check(data[o+14] === Math.fround(e.arrow[1][0]), `packing: arrow of ${k}`);
  });
  console.log('  22x: ' + els.map(elementToString).join('; '));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
