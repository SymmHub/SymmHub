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
  6. the orientation: a product of reflections in lines and circles keeps it
     for an even number of them and reverses it for an odd one, also where
     the pole of the map lies inside the circle through three points of the
     disk (the triangle of the points and of their images then tells it the
     other way round); the generators of the triangle groups of the
     hyperbolic plane (the KLM maker, K L M in 2..8) are rotations of the
     orders K and L about points of the disk, or the three mirrors
  7. the middle of a side that is an arc: in the triangle groups K L M and
     *K L M of every geometry the midpoint of every side, and of every edge
     of the domain's polygon, lies on the domain's boundary, in the
     hyperbolic plane inside the disk; a disk scaled and moved gives the
     images of the same midpoints; in the makers of the upper half plane
     (KLMN, KLx, 5 splanes, 22222, ...) the corners and the midpoints of the
     sides lie above the x axis (the sides bound the domain's mirror image
     below as well), the corners are the images of the same maker's corners
     in the disk, and they follow when the half plane is turned and moved;
     the lune between two crossing circles of the sphere, which fits a half
     plane too, keeps both its corners
  8. a bent group (KLMN with a bend, a Kleinian group whose sides bound a
     polygon in each component): the polygon, the midpoints of the sides and
     the arrows of the generators are those of the polygon inside the
     absolute the maker gives the group (Group.absolute), also for a bend of
     a degree, and after the group is cloned, turned and moved
  9. the polygon that holds a point (domainPolygon's opt.at, the Tile tool's
     pointer): in a group of the half plane a point below the x axis is held
     by the mirror image of the domain; in a bent group a point of either
     component by that component's polygon; a point outside a side by none;
     in the disk the polygon outside the unit circle is found where it is one
     (22222, split at the fixed points of the half turns out there) and not
     where it has a corner at infinity (KLMN, the triangle groups)
 10. a Dirichlet domain (the symmetry's operation, the Maskit maker's own
     domain): the middles of its sides, and so the arrows of its generators,
     are those of the polygon that holds its base, in whichever component the
     base lies and beyond the absolute of a straight group too; a side that
     does not bound that polygon keeps its middle where it is; the base and
     the absolute (that of the group the domain was made from) come with the
     group through clone and applyTransform
*/

import { iWallpaperGroup, getWallpaperDomainShapes, WallpaperGroupNames } from '../../lib/grouplib/WallpaperGroups.js';
import { Group_KLM, makeHyperbolicTriangle, makeSphericalTriangle } from '../../lib/grouplib/Group_KLM.js';
import { Group_KLMN, Group_KLx, Group_5splanes, Group_s22222, Group_22222, Group_s222222, Group_Spherical, Group_Maskit2,
         dirichletBase, selectDirichletSides, makeDirichletGroup } from '../../lib/grouplib/grouplib.js';
import { Group, ITransform, iPoint, iPlane, iSphere } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_PLANE, SPLANE_SPHERE } from '../../lib/invlib/ISplane.js';
import { buildSubgroupDomain, classifyEuclidean } from '../../lib/grouplib/SubgroupDomain.js';
import {
  classifyIsometry, generatorElements, subgroupGeneratorElements, domainSideMidpoints, domainPolygon, domainCorners,
  packGeneratorElements, applyToPoint, ELEMENT_KINDS, ELEMENT_TEXELS, elementToString, groupDomainBase, groupModelAbsolute,
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

// ---- 6, 7. the triangle groups of the KLM maker -----------------------------------

/** the group K L M (the rotations) or *K L M (s: the mirrors) of the KLM maker, its console output held back */
function klmGroup(K, L, M, s){
  const log = console.log;
  console.log = () => {};
  try {
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
  } finally { console.log = log; }
}

/** K L M in 2..8 with the geometry of the triangle of angles pi/K, pi/L, pi/M */
function* triangleOrders(){
  for(let K = 2; K <= 8; K++) for(let L = 2; L <= 8; L++) for(let M = 2; M <= 8; M++){
    // 1/K + 1/L + 1/M against 1, in whole numbers
    const sum = L*M + K*M + K*L, one = K*L*M;
    yield { K, L, M, geometry: (sum < one) ? 'hyperbolic' : ((sum === one) ? 'euclidean' : 'spherical') };
  }
}

// ---- 6. the orientation ---------------------------------------------------------------

console.log('\n=== the orientation ===');
{
  // products of reflections in lines and circles in no special position
  let seed = 20261118;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed/0x80000000; };
  const mirror = () => {
    if(rnd() < 0.3){ const a = 2*Math.PI*rnd(); return iPlane([Math.cos(a), Math.sin(a), 0, 2*rnd() - 1]); }
    return iSphere([4*rnd() - 2, 4*rnd() - 2, 0, 0.3 + 1.7*rnd()]);
  };
  // the triangle of three points of the disk and of their images: it tells the
  // orientation of an affine map, not of a map with its pole inside their circle
  const TRIANGLE = [[0.113, 0.071], [-0.229, 0.307], [0.291, -0.187]];
  const cross = (p, q, r) => (q[0] - p[0])*(r[1] - p[1]) - (q[1] - p[1])*(r[0] - p[0]);
  let maps = 0, triangleWrong = 0;
  for(let i = 0; i < 3000; i++){
    const count = 1 + Math.floor(6*rnd());
    const t = new ITransform(Array.from({ length: count }, mirror), '');
    const want = (count % 2) ? -1 : 1;
    maps++;
    check(classifyIsometry(t).orientation === want, `map ${i}, a product of ${count} reflections, read as ${want > 0 ? 'reversing' : 'keeping'} the orientation`);
    const w = TRIANGLE.map(z => applyToPoint(t, z));
    if(((cross(...w)*cross(...TRIANGLE) < 0) ? -1 : 1) !== want) triangleWrong++;
  }
  check(triangleWrong > maps/20, `only ${triangleWrong} of the ${maps} maps turn the triangle of three points the other way: too few to test by`);
  console.log(`  ${maps} products of 1 to 6 reflections: the orientation is the parity of their number (the triangle of three points tells it wrong for ${triangleWrong})`);

  // the generators of K L M are the rotations about two corners of the triangle, of
  // the orders K and L, those of *K L M its three mirrors
  let groups = 0, gens = 0;
  for(const { K, L, M, geometry } of triangleOrders()){
    if(geometry !== 'hyperbolic') continue;
    for(const s of [false, true]){
      const group = klmGroup(K, L, M, s);
      const name = `${s ? '*' : ''}${K}${L}${M}`;
      groups++;
      group.transforms.forEach((ref, i) => {
        const cls = classifyIsometry(new ITransform(ref.slice(), ''));
        gens++;
        if(s) check(cls.type === 'reflection', `${name}: mirror ${i} read as ${cls.type}`);
        else check(cls.type === 'rotation' && cls.order === [K, L][i % 2] && Math.hypot(cls.fixedPoints[0][0], cls.fixedPoints[0][1]) < 1,
                   `${name}: generator ${i}, a rotation of order ${[K, L][i % 2]} about a point of the disk, read as ${cls.type} ${cls.order || ''}`);
      });
      const els = generatorElements({ group });
      check(s ? (els.length === 3 && els.every(e => e.kind === 'mirror')) : (els.length === 2 && els.every(e => e.kind === 'cone')),
            `${name}: the elements ${els.map(e => e.kind + (e.order || '')).join(' ')}`);
    }
  }
  console.log(`  ${groups} triangle groups of the hyperbolic plane (K L M in 2..8), ${gens} generators: rotations of the orders K and L, or mirrors`);
}

// ---- 7. the middle of a side that is an arc ---------------------------------------------

console.log('\n=== the middles of the sides ===');
{
  // the region inside all the sides of a domain of the Poincare disk is the domain
  // and its mirror image across the unit circle, and the middle of either arc between
  // two corners lies inside every other side: the side's is the one inside the disk
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const onBoundary = (fd, k, p) => Math.abs(sigDist(fd[k], p)) < 1e-6 && fd.every(sp => sigDist(sp, p) <= 1e-6);
  // the same domain in a disk scaled and moved
  const move = ITransform.getScale(0.7).concat(ITransform.getTranslation([1.3, -0.4]));
  const count = { hyperbolic: 0, euclidean: 0, spherical: 0 };
  let sides = 0, edges = 0, worst = 0;
  for(const { K, L, M, geometry } of triangleOrders()){
    for(const s of [false, true]){
      const group = klmGroup(K, L, M, s);
      const fd = group.getFundDomain();
      const name = `${s ? '*' : ''}${K}${L}${M}`;
      const inModel = p => geometry !== 'hyperbolic' || Math.hypot(p[0], p[1]) < 1;
      count[geometry]++;

      const mids = domainSideMidpoints(fd);
      mids.forEach((m, k) => {
        sides++;
        check(onBoundary(fd, k, m) && inModel(m), `${name}: the midpoint (${m}) of side ${k} is not on the domain's boundary`);
      });

      // the polygon as the Tile tool asks for it: the centre of a half turn splits its side
      const centres = generatorElements({ group }).filter(e => e.kind === 'cone' && e.center).map(e => e.center);
      const poly = domainPolygon(fd, { corners: centres });
      if(!check(!!poly && poly.sides.length === (s ? 3 : 4), `${name}: a polygon of ${poly ? poly.sides.length : 'no'} edges`)) continue;
      poly.sides.forEach((e, k) => {
        const m = poly.mids[k], a = poly.corners[e.from], b = poly.corners[e.to];
        edges++;
        check(onBoundary(fd, e.side, m) && inModel(m) && Math.abs(dist(m, a) - dist(m, b)) < 1e-9,
              `${name}: the middle (${m}) of edge ${k} is not on the domain's boundary half way between its corners`);
      });

      if(geometry !== 'hyperbolic') continue;
      const moved = fd.map(sp => move.transform(sp));
      domainSideMidpoints(moved).forEach((m, k) => {
        const d = dist(m, applyToPoint(move, mids[k]));
        worst = Math.max(worst, d);
        check(d < 1e-9, `${name}: in the moved disk the midpoint of side ${k} is ${d} off the image of the unit disk's`);
      });
      const polyMoved = domainPolygon(moved, { corners: centres.map(c => applyToPoint(move, c)) });
      if(!check(!!polyMoved && polyMoved.sides.length === poly.sides.length, `${name}: a polygon of as many edges in the moved disk`)) continue;
      poly.sides.forEach((e, k) => {
        // the same edge of the moved polygon: by its side and its corners
        const a = applyToPoint(move, poly.corners[e.from]), b = applyToPoint(move, poly.corners[e.to]);
        const j = polyMoved.sides.findIndex(f => f.side === e.side
                    && Math.min(dist(polyMoved.corners[f.from], a) + dist(polyMoved.corners[f.to], b), dist(polyMoved.corners[f.from], b) + dist(polyMoved.corners[f.to], a)) < 1e-9);
        const d = (j >= 0) ? dist(polyMoved.mids[j], applyToPoint(move, poly.mids[k])) : Infinity;
        worst = Math.max(worst, d);
        check(d < 1e-9, `${name}: in the moved disk the middle of edge ${k} is ${d} off the image of the unit disk's`);
      });
    }
  }
  console.log(`  ${count.hyperbolic} hyperbolic, ${count.euclidean} Euclidean, ${count.spherical} spherical triangle groups: ${sides} sides and ${edges} edges of the polygons have their middles on the boundary of the domain`);
  console.log(`  a disk scaled by 0.7 and moved to (1.3, -0.4): the same middles within ${worst.toExponential(1)}`);

  // the makers of the upper half plane: the sides bound the domain and its mirror
  // image below the x axis, so a circle side holds its corners and their mirror
  // images, and two stretches inside the other sides. The corners are those above,
  // as many as the same maker has in the disk (its switch uhp off: the domain
  // reflected in the sphere about (0, -1) of radius sqrt 2) and their images there;
  // the middle of a side is that of its stretch above
  const quiet = (make) => { const log = console.log; console.log = () => {}; try { return make(); } finally { console.log = log; } };
  const made = (Maker, values, uhp) => quiet(() => {
    const maker = new Maker({});
    Object.assign(maker.params, values, { uhp });
    if(maker.state) maker.state.paramChanged = true;
    return maker.getGroup();
  });
  const halfPlane = [
    ['KLMN', Group_KLMN, {}],
    ['*KLMN', Group_KLMN, { s: true }],
    ['KLx', Group_KLx, {}],
    ['5 splanes', Group_5splanes, {}],
    ['*22222', Group_s22222, {}],
    ['22222', Group_22222, {}],
    ['*222222', Group_s222222, {}],
  ];
  const toDisk = new ITransform([iSphere([0, -1, 0, Math.SQRT2])], '');
  // the same domain turned by 30 degrees and moved: its half plane is told by its sides
  const turn = ITransform.getRotation([0, 0, 1], Math.PI/6).concat(ITransform.getTranslation([0.7, -1.1]));
  let halfSides = 0, halfCorners = 0, turned = 0, swapped = 0;
  for(const [name, Maker, values] of halfPlane){
    const fd = made(Maker, values, true).getFundDomain();
    const corners = domainCorners(fd);
    halfCorners += corners.length;
    check(corners.every(c => c[1] > -1e-9), `${name}: a corner below the x axis, the lowest at y = ${Math.min(...corners.map(c => c[1]))}`);
    const inDisk = domainCorners(made(Maker, values, false).getFundDomain());
    const reflected = corners.map(c => applyToPoint(toDisk, c));
    const offDisk = (inDisk.length === reflected.length) ? Math.max(...reflected.map(p => Math.min(...inDisk.map(q => dist(p, q))))) : Infinity;
    swapped = Math.max(swapped, offDisk);
    check(offDisk < 1e-9, `${name}: ${corners.length} corners in the half plane, ${inDisk.length} in the disk, ${offDisk} off their images`);
    domainSideMidpoints(fd).forEach((m, k) => {
      halfSides++;
      check(onBoundary(fd, k, m) && m[1] > 1e-6, `${name}: the midpoint (${m}) of side ${k} is not on the side's stretch above the x axis`);
    });
    const there = domainCorners(fd.map(sp => turn.transform(sp)));
    const images = corners.map(c => applyToPoint(turn, c));
    const off = (there.length === images.length) ? Math.max(...images.map(p => Math.min(...there.map(q => dist(p, q))))) : Infinity;
    turned = Math.max(turned, off);
    check(off < 1e-9, `${name}: turned and moved, the corners are ${off} off the images of the corners`);
  }
  console.log(`  ${halfPlane.length} groups of the upper half plane: their ${halfCorners} corners and the middles of their ${halfSides} sides lie above the x axis`);
  console.log(`  those corners are the images of the corners in the disk within ${swapped.toExponential(1)}; turned by 30 degrees and moved, the same corners within ${turned.toExponential(1)}`);

  // two circles of the sphere that cross (the lune of the rotations about two poles,
  // not centred) fit a half plane too: both poles are corners, and the middle of each
  // side lies between them on the lune
  for(const n of [3, 5, 8]){
    const fd = quiet(() => { const m = new Group_Spherical({ type: 'nn', n }); m.mConfig.centered = false; return m.getGroup(); }).getFundDomain();
    const corners = domainCorners(fd);
    check(fd.length === 2 && corners.length === 2, `the lune of the rotations of order ${n}: ${corners.length} corners of its ${fd.length} sides`);
    domainSideMidpoints(fd).forEach((m, k) => {
      check(onBoundary(fd, k, m) && corners.length === 2 && Math.abs(dist(m, corners[0]) - dist(m, corners[1])) < 1e-9, `the lune of order ${n}: the midpoint (${m}) of side ${k} is not half way between the poles on the lune`);
    });
  }
  console.log('  the lunes of the sphere between two poles (n = 3, 5, 8): both poles are corners');

  // a bent group (Kleinian): its sides fit no model and bound a polygon in each
  // component. The maker gives its group the absolute of the model it bent from
  // (Group.absolute), and the polygon, the middles of the sides and the arrows of the
  // generators are those of the polygon inside it. The absolute goes with the group
  const insideAbsolute = (group, p) => sigDist(group.absolute, p) <= 1e-7;
  const polygonOfGroup = (group, absolute) => domainPolygon(group.getFundDomain(),
        { corners: generatorElements({ group }).filter(e => e.kind === 'cone' && e.center).map(e => e.center), absolute });
  const polygonCorners = poly => poly.sides.map(e => poly.corners[e.from]);
  let bentGroups = 0;
  for(const uhp of [true, false]){
    for(const bend of [-20, -1, 1, 20]){
      const group = made(Group_KLMN, { bend }, uhp);
      const fd = group.getFundDomain();
      const name = `KLMN bent by ${bend} in the ${uhp ? 'half plane' : 'disk'}`;
      bentGroups++;
      check(!!group.absolute, `${name}: the group has no absolute`);
      // a bend of a degree leaves the sides within the tolerance of a model read off them: the absolute decides
      const poly = polygonOfGroup(group, group.absolute);
      check(!!poly && poly.sides.length === 6 && polygonCorners(poly).every(c => insideAbsolute(group, c)),
            `${name}: ${poly ? poly.sides.length + ' edges, ' + polygonCorners(poly).filter(c => !insideAbsolute(group, c)).length + ' corners beyond the absolute' : 'no polygon'}`);
      domainSideMidpoints(fd, { absolute: group.absolute }).forEach((m, k) => {
        check(onBoundary(fd, k, m) && insideAbsolute(group, m), `${name}: the midpoint (${m}) of side ${k} is not on the polygon inside the absolute`);
      });
      for(const e of generatorElements({ group })){
        if(e.arrow) check(insideAbsolute(group, e.arrow[0]), `${name}: the arrow of ${e.word} starts at (${e.arrow[0]}), beyond the absolute`);
      }
      // the clone carries its own absolute, and a transform moves it with the sides
      const there = group.clone();
      there.applyTransform(turn);
      const moved = polygonOfGroup(there, there.absolute);
      const images = poly ? polygonCorners(poly).map(c => applyToPoint(turn, c)) : [];
      const off = (moved && poly && moved.sides.length === poly.sides.length)
                ? Math.max(...images.map(p => Math.min(...polygonCorners(moved).map(q => dist(p, q))))) : Infinity;
      check(there.absolute !== group.absolute && off < 1e-9, `${name}: turned and moved, the polygon is ${off} off the image of the polygon`);
    }
  }
  // without the absolute the polygon is the smaller of the two: the other one, for a bend that makes the domain's the larger
  {
    const group = made(Group_KLMN, { bend: -20 }, true);
    const other = polygonOfGroup(group, null);
    check(!!other && polygonCorners(other).every(c => !insideAbsolute(group, c)), 'KLMN bent by -20: without the absolute the polygon is not the other, smaller one');
  }
  // the two halves of a side split by a half turn are one circle, a rounding apart in
  // the disk at some bends: they have no corner between them
  for(const bend of [5/3, 10/3, -10/3]){
    const poly = polygonOfGroup(made(Group_KLMN, { bend }, false), made(Group_KLMN, { bend }, false).absolute);
    check(!!poly && poly.sides.length === 6, `KLMN bent by ${bend} in the disk: ${poly ? poly.sides.length + ' edges' : 'no polygon'}`);
  }
  console.log(`  ${bentGroups} bent KLMN groups: the polygon, the middles of the sides and the generators' arrows are those of the polygon inside the maker's absolute, turned and moved too`);

  // ---- 9. the polygon that holds a point -------------------------------------------------
  // The sides bound a polygon in every part of the plane the group tiles: the domain
  // and, beyond the absolute, its mirror image (a bent group: a polygon of another
  // shape). A point of the region inside all the sides asks for the polygon it is in
  console.log('\n=== the polygon that holds a point ===');
  const folded = (group, p) => { const f = group.toFundDomain({ pnt: iPoint([p[0], p[1], 0, 0]), maxIterations: 400 }); return f.inDomain ? [f.pnt.v[0], f.pnt.v[1]] : null; };
  // the centres of the cone generators, beyond the absolute too, as the Tile tool gives them
  const allCentres = (group) => generatorElements({ group }).filter(e => e.kind === 'cone').flatMap(e => [e.center, ...(e.isometry.mirrorFixedPoints || [])]).filter(Boolean);
  const polygonAt = (group, p) => domainPolygon(group.getFundDomain(), { corners: allCentres(group), absolute: group.absolute, at: p });
  // a point inside a polygon: the mean of the middles of its edges (that of its corners lies on the absolute when they are cusps)
  const middle = poly => [poly.mids.reduce((s, p) => s + p[0], 0)/poly.mids.length, poly.mids.reduce((s, p) => s + p[1], 0)/poly.mids.length];
  const cornersOff = (a, b) => (a.length === b.length) ? Math.max(...a.map(p => Math.min(...b.map(q => dist(p, q))))) : Infinity;
  const conj = p => [p[0], -p[1]];
  const invert = p => { const r2 = p[0]*p[0] + p[1]*p[1]; return [p[0]/r2, p[1]/r2]; };

  // a group of the half plane: a point of the domain gives the domain, its mirror image the mirror image
  let mirrored = 0, worstMirror = 0;
  for(const [name, Maker, values] of halfPlane){
    const group = made(Maker, values, true);
    const poly = polygonOfGroup(group, group.absolute);
    const c = middle(poly);
    const here = polygonAt(group, c), there = polygonAt(group, conj(c));
    check(!!here && cornersOff(polygonCorners(here), polygonCorners(poly)) < 1e-12, `${name}: the polygon that holds a point of the domain is not the domain's`);
    const off = there ? cornersOff(polygonCorners(there), polygonCorners(poly).map(conj)) : Infinity;
    worstMirror = Math.max(worstMirror, off);
    mirrored++;
    check(off < 1e-9, `${name}: the polygon that holds the mirror image of a point of the domain is ${off} off the domain's mirror image`);
    if(there) there.sides.forEach((e, k) => check(onBoundary(group.getFundDomain(), e.side, there.mids[k]) && there.mids[k][1] < 1e-9,
                                                 `${name}: the middle (${there.mids[k]}) of edge ${k} of the polygon below is not on its side below the x axis`));
  }
  console.log(`  ${mirrored} groups of the upper half plane: a point below the x axis is held by the mirror image of the domain (within ${worstMirror.toExponential(1)}), a point of the domain by the domain`);

  // a point outside a side is a point of no polygon, and a point that is not folded yet is one
  {
    const group = made(Group_KLMN, {}, true);
    const fd = group.getFundDomain();
    const out = [3.7, 0.4];
    check(fd.some(sp => sigDist(sp, out) > 0.1) && polygonAt(group, out) === null, 'KLMN: a point outside a side is held by a polygon');
    const home = folded(group, out);
    check(!!home && !!polygonAt(group, home), 'KLMN: the point folded into the domain is held by no polygon');
  }

  // a bent group: the polygon of each of the two components, by a point of it
  let bentBoth = 0;
  for(const bend of [-20, -1, 1, 20]){
    const group = made(Group_KLMN, { bend }, true);
    const fd = group.getFundDomain();
    const poly = polygonOfGroup(group, group.absolute);
    // a point of the other component: the mirror image of a point of the domain, folded
    const p = folded(group, conj(middle(poly)));
    const other = p ? polygonAt(group, p) : null;
    const name = `KLMN bent by ${bend} in the half plane`;
    bentBoth++;
    if(!check(!!other && other.sides.length === 6, `${name}: ${other ? other.sides.length + ' edges' : 'no polygon'} round a point of the other component`)) continue;
    check(cornersOff(polygonCorners(other), polygonCorners(poly)) > 0.1, `${name}: the polygon of the other component is the domain's`);
    check(polygonCorners(other).filter(c => !insideAbsolute(group, c)).length > polygonCorners(poly).filter(c => !insideAbsolute(group, c)).length,
          `${name}: the polygon of the other component has no more corners beyond the absolute than the domain's`);
    other.sides.forEach((e, k) => check(onBoundary(fd, e.side, other.mids[k]), `${name}: the middle (${other.mids[k]}) of edge ${k} of the other polygon is not on the boundary`));
    const back = polygonAt(group, middle(poly));
    check(!!back && cornersOff(polygonCorners(back), polygonCorners(poly)) < 1e-12, `${name}: a point of the domain is not held by the domain's polygon`);
  }
  console.log(`  ${bentBoth} bent KLMN groups: a point of either component is held by that component's polygon of 6 edges`);

  // the disk: the mirror image of the domain lies outside the unit circle. That of 22222
  // is a polygon, split at the centres of the half turns out there (the fixed points the
  // classification keeps aside); that of KLMN has a corner at infinity (the domain has
  // one at the centre of the disk) and is no polygon
  {
    const group = made(Group_22222, {}, false);
    const poly = polygonOfGroup(group, group.absolute);
    const p = folded(group, invert(middle(poly)));
    const outer = p ? polygonAt(group, p) : null;
    const off = outer ? cornersOff(polygonCorners(outer), polygonCorners(poly).map(invert)) : Infinity;
    check(!!outer && outer.sides.length === 8 && off < 1e-9, `22222 in the disk: the polygon outside the unit circle has ${outer ? outer.sides.length : 'no'} edges, ${off} off the domain's image`);
    let turns = 0;
    for(const e of generatorElements({ group })){
      if(e.kind !== 'cone') continue;
      const m = e.isometry.mirrorFixedPoints;
      if(!check(!!m && m.length === 1, `22222 in the disk: the rotation ${e.word} has no fixed point kept aside`)) continue;
      turns++;
      const t = new ITransform(group.transforms[group.getGenNames().indexOf(e.word)].slice(), e.word);
      check(dist(m[0], invert(e.center)) < 1e-9 && dist(applyToPoint(t, m[0]), m[0]) < 1e-9,
            `22222 in the disk: the fixed point (${m[0]}) of ${e.word} beyond the circle is not the image of its centre, or is not fixed`);
    }
    check(turns > 0, '22222 in the disk: no rotation among the generators');
    const klmn = made(Group_KLMN, {}, false);
    const q = folded(klmn, invert(middle(polygonOfGroup(klmn, klmn.absolute))));
    check(!!q && polygonAt(klmn, q) === null, 'KLMN in the disk: a polygon outside the unit circle, where the domain has a corner at infinity');
    console.log(`  the disk: 22222 has its polygon outside the unit circle (the domain's image within ${off.toExponential(1)}, ${turns} half turns with their centres there); KLMN has none (a corner at infinity)`);
  }

  // the triangle groups: a point of the domain gives the domain; outside the disk the two
  // sides through its centre run to infinity, and there is no polygon
  {
    let groups = 0;
    for(const [K, L, M, s] of [[2, 3, 7, false], [2, 3, 7, true], [3, 3, 6, false], [4, 2, 5, true], [8, 8, 8, false]]){
      const group = klmGroup(K, L, M, s);
      const name = `${s ? '*' : ''}${K}${L}${M}`;
      const poly = polygonOfGroup(group, group.absolute);
      const here = polygonAt(group, middle(poly));
      check(!!here && cornersOff(polygonCorners(here), polygonCorners(poly)) < 1e-12, `${name}: a point of the domain is not held by the domain's polygon`);
      const p = folded(group, invert(middle(poly)));
      check(!!p && Math.hypot(p[0], p[1]) > 1 && polygonAt(group, p) === null, `${name}: a polygon outside the disk`);
      groups++;
    }
    console.log(`  ${groups} triangle groups: a point of the domain is held by the domain; outside the disk there is no polygon (two sides run to infinity)`);
  }

  // ---- 10. a Dirichlet domain: the middles of its sides and the arrows -------------------
  // The sides of a Dirichlet domain, the bisectors of the base and its images, bound a
  // polygon in every part of the plane the group tiles, and the domain is the one that
  // holds the base. The middles of the sides, where the arrows of the generators start,
  // are those of that polygon's edges. The group comes as the renderer hands it on: a clone
  console.log('\n=== a Dirichlet domain: the middles of its sides ===');
  {
    const hush = (make) => { const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {}; try { return make(); } finally { console.log = log; console.warn = warn; } };
    const dirichlet = (group, b) => hush(() => {
      const base = dirichletBase({ baseX: b[0], baseY: b[1] });
      const res = selectDirichletSides(group, { base, depth: 2, maxIterations: 1000 });
      return makeDirichletGroup(group, { base, words: res.words }).clone();
    });
    const wrap = (t) => ((t % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    /** is the point on an edge of the polygon that lies on the side: on the side, between the edge's corners */
    const onEdgeOf = (poly, fd, side, q, tol) => poly.sides.some((e, k) => {
      const sp = fd[side];
      if(e.side !== side || Math.abs(sigDist(sp, q)) > tol) return false;
      const a = poly.corners[e.from], b = poly.corners[e.to], m = poly.mids[k];
      if(sp.type !== SPLANE_SPHERE){
        const d = [b[0] - a[0], b[1] - a[1]];
        const u = ((q[0] - a[0])*d[0] + (q[1] - a[1])*d[1])/(d[0]*d[0] + d[1]*d[1]);
        return u >= -1e-6 && u <= 1 + 1e-6;
      }
      const ang = p => Math.atan2(p[1] - sp.v[1], p[0] - sp.v[0]);
      const t0 = ang(a);
      let sweep = wrap(ang(b) - t0), at = wrap(ang(q) - t0);
      // the arc from a to b that holds the edge's middle
      if(wrap(ang(m) - t0) > sweep){ sweep = 2*Math.PI - sweep; at = wrap(-at); }
      return at <= sweep + 1e-6 || at >= 2*Math.PI - 1e-6;
    });
    /** the polygon that holds the base of the Dirichlet group, as the Tile tool takes it */
    const basePolygon = (dg) => domainPolygon(dg.getFundDomain(), { corners: allCentres(dg), absolute: groupModelAbsolute(dg), at: groupDomainBase(dg) });
    /** of the arrows whose two sides bound the polygon: [how many, how many start and end on it] */
    const arrowsOn = (group, poly, tol) => {
      const fd = group.getFundDomain();
      const has = new Set(poly.sides.map(e => e.side));
      let able = 0, on = 0;
      for(const e of generatorElements({ group })){
        if(!e.arrow || !has.has(e.sides[0]) || !has.has(e.sides[1])) continue;
        able++;
        if(onEdgeOf(poly, fd, e.sides[0], e.arrow[0], tol) && onEdgeOf(poly, fd, e.sides[1], e.arrow[1], tol)) on++;
      }
      return [able, on];
    };
    const tolOf = (poly) => 1e-6*Math.max(1, ...poly.corners.map(c => Math.hypot(c[0], c[1])));

    // what the group tells: the base of a Dirichlet domain, and the absolute of the group it was made from
    {
      const group = made(Group_KLMN, { bend: 20 }, true);
      const b = [0.31, -0.47];
      const dg = dirichlet(group, b);
      check(dist(groupDomainBase(dg), b) === 0 && groupDomainBase(group) === null && groupDomainBase(klmGroup(2, 3, 7, false)) === null,
            'the base of a Dirichlet group, and none of any other group');
      check(!dg.absolute && groupModelAbsolute(dg) === dg.dirichletSource.absolute && groupModelAbsolute(group) === group.absolute && groupModelAbsolute(klmGroup(2, 3, 7, false)) === null,
            'the absolute of a Dirichlet group is that of the group it was made from; a maker\'s group has its own, a triangle group none');
    }

    // bent groups, both models, the base in either component
    let domains = 0, sides = 0, arrows = 0, offWithout = 0, elsewhere = 0;
    for(const [name, Maker, values] of [['KLMN bent by 20', Group_KLMN, { bend: 20 }], ['KLMN bent by -20', Group_KLMN, { bend: -20 }], ['KLMN 2 3 4 5 bent by 20', Group_KLMN, { K: 2, L: 3, M: 4, N: 5, bend: 20 }],
                                         ['KLx bent by 20', Group_KLx, { bend: 20 }], ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }]]){
      for(const uhp of [true, false]){
        const group = made(Maker, values, uhp);
        const own = polygonOfGroup(group, group.absolute);
        const c = middle(own);
        // a point of the other component: the mirror image of a point of the domain, folded, then of that polygon
        const far = folded(group, uhp ? conj(c) : invert(c));
        const second = far ? polygonAt(group, far) : null;
        const bases = [c];
        if(second && cornersOff(polygonCorners(second), polygonCorners(own)) > 1e-6) bases.push(middle(second));
        for(const b of bases){
          const where = `${name} in the ${uhp ? 'half plane' : 'disk'}, the base at (${b.map(x => x.toFixed(2)).join(', ')})`;
          const dg = dirichlet(group, b);
          const fd = dg.getFundDomain();
          const poly = basePolygon(dg);
          if(!check(!!poly, `${where}: no polygon holds the base`)) continue;
          domains++;
          const tol = tolOf(poly);
          const has = new Set(poly.sides.map(e => e.side));
          const mids = domainSideMidpoints(fd, { absolute: groupModelAbsolute(dg), at: groupDomainBase(dg) });
          mids.forEach((m, k) => {
            sides++;
            if(has.has(k)) check(onEdgeOf(poly, fd, k, m, tol), `${where}: the middle (${m}) of side ${k} is not on its edge of the base's polygon`);
            else { elsewhere++; check(onBoundary(fd, k, m), `${where}: the middle (${m}) of side ${k}, which does not bound the base's polygon, is not on the boundary`); }
          });
          const [able, on] = arrowsOn(dg, poly, tol);
          arrows += able;
          check(able > 0 && on === able, `${where}: ${on} of ${able} arrows start and end on the base's polygon`);
          // the same group without its base: the middles as they were taken before
          const blind = dg.clone();
          delete blind.dirichletBase;
          const [, onBlind] = arrowsOn(blind, poly, tol);
          offWithout += able - onBlind;
        }
      }
    }
    check(domains >= 16 && offWithout > 0, `${domains} Dirichlet domains of bent groups tried, ${offWithout} arrows off the base's polygon when the base is not known`);
    console.log(`  ${domains} Dirichlet domains of bent groups, in both models, the base in either component: the middles of ${sides - elsewhere} sides lie on the base's polygon (${elsewhere} sides do not bound it), and its ${arrows} arrows start and end there`);
    console.log(`  without the base ${offWithout} of those arrows would lie on another polygon`);

    // a straight group: the arrows for the mirror image of the base are the mirror images of the arrows
    let mirrorOff = 0, mirrorArrows = 0;
    for(const [name, Maker, values] of [['KLMN', Group_KLMN, {}], ['KLMN 2 3 4 5', Group_KLMN, { K: 2, L: 3, M: 4, N: 5 }], ['22222', Group_22222, {}]]){
      const group = made(Maker, values, true);
      const c = middle(polygonOfGroup(group, group.absolute));
      const b = [c[0] + 0.05, c[1] + 0.03];
      const up = dirichlet(group, b), down = dirichlet(group, conj(b));
      const au = generatorElements({ group: up }).filter(e => e.arrow).map(e => e.arrow), ad = generatorElements({ group: down }).filter(e => e.arrow).map(e => e.arrow);
      check(au.length > 0 && au.length === ad.length, `${name}: ${au.length} arrows for the base, ${ad.length} for its mirror image`);
      check(au.every(a => a[0][1] > 0 && a[1][1] > 0) && ad.every(a => a[0][1] < 0 && a[1][1] < 0), `${name}: the arrows are not on the base's side of the absolute`);
      for(const a of ad){
        const off = Math.min(...au.map(u => Math.max(dist(conj(u[0]), a[0]), dist(conj(u[1]), a[1]))));
        mirrorOff = Math.max(mirrorOff, off);
        mirrorArrows++;
      }
    }
    check(mirrorOff < 1e-9, `straight groups: the arrows for the mirror image of the base are ${mirrorOff} off the mirror images of the arrows`);
    console.log(`  straight groups of the half plane: the ${mirrorArrows} arrows for a base below the absolute are the mirror images of the arrows for the base above (within ${mirrorOff.toExponential(1)})`);

    // turned and moved (the base in the other component), the group gives the images of the arrows
    {
      let worst = 0, count = 0;
      for(const [name, Maker, values] of [['KLMN bent by 20', Group_KLMN, { bend: 20 }], ['KLMN 2 3 4 5 bent by 20', Group_KLMN, { K: 2, L: 3, M: 4, N: 5, bend: 20 }], ['22222, A2 20, A3 -15', Group_22222, { A2: 20, A3: -15 }]]){
        const group = made(Maker, values, true);
        const far = middle(polygonAt(group, folded(group, conj(middle(polygonOfGroup(group, group.absolute))))));
        const dg = dirichlet(group, far);
        const there = dg.clone();
        there.applyTransform(turn);
        const a0 = generatorElements({ group: dg }).filter(e => e.arrow).map(e => e.arrow), a1 = generatorElements({ group: there }).filter(e => e.arrow).map(e => e.arrow);
        const off = (a0.length === a1.length && a0.length > 0) ? Math.max(...a0.map((a, i) => Math.max(dist(applyToPoint(turn, a[0]), a1[i][0]), dist(applyToPoint(turn, a[1]), a1[i][1])))) : Infinity;
        check(off < 1e-9, `${name}, the base in the other component, turned and moved: the arrows are ${off} off the images of the arrows`);
        worst = Math.max(worst, off);
        count += a0.length;
      }
      console.log(`  turned by 30 degrees and moved, three Dirichlet groups give the images of their ${count} arrows (within ${worst.toExponential(1)})`);
    }

    // the Maskit maker's own domain is a Dirichlet domain: its arrows on the polygon that holds the base
    {
      const group = hush(() => new Group_Maskit2({}).getGroup()).clone();
      const poly = basePolygon(group);
      const [able, on] = poly ? arrowsOn(group, poly, 1e-6) : [0, 0];
      const blind = group.clone();
      delete blind.dirichletBase;
      const onBlind = poly ? arrowsOn(blind, poly, 1e-6)[1] : 0;
      check(!!poly && poly.sides.length === 8 && able === 4 && on === 4, `Maskit's 2-torus group: ${on} of ${able} arrows on the polygon of ${poly ? poly.sides.length : 'no'} edges that holds its base`);
      console.log(`  Maskit's 2-torus group: its ${able} arrows start and end on the octagon that holds its base (${onBlind} of them without the base)`);
    }
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
