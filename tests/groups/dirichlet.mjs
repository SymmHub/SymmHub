/*
  tests of the Dirichlet domain operation (lib/grouplib/DirichletDomain.js)

    node tests/groups/dirichlet.mjs

  1. the loxodromic cyclic group of the Orb preset Cyclic/set_7 with the preset's base
     point and words (a, a^9, a^10 and their inverses): the Dirichlet group has six sides,
     the base is inside, each pairing transform maps its side onto the side of the inverse
     word and an inside point beyond it, random points fold into the domain
  2. the same words read the Orb way (a letter names the pairing transform, the inverse of
     the generator here) give the same sides as the reversed words: the rule of the preset
     converter
  3. dirichletCellAt: the image of the base found by folding a point lies in the tiling
     cell of that point (its fold word is the inverse of the cell's)
  4. selectDirichletSides on the cyclic group finds the hexagon: six sides, the images of
     the preset's words, and the sides bound a cell that contains the base
  5. the wallpaper group 'o' (two translations): the Dirichlet domain of a generic base
     point is a hexagon, of a base point of a rectangular lattice a rectangle; the sides
     found automatically agree with the words of at most two generators
  6. a *22222 reflection group and the untwisted 22222 group: the automatic sides give a
     group into which random points fold, and the pairing transforms map the sides onto
     sides; the twisted 22222 group of the Orb preset set_14 is not discrete (an image of
     the base lies inside the original domain), so there the search only has to stop and
     report
  7. the bent KLMN group of the symdraw preset par_s2223-4: the group survives the data
     round trip of the worker (same folds, same automatic sides), the deadline ends a
     slow search soon after it, startDirichletSearch without Worker searches in place,
     and the preset's long words on deformed groups leave out what overflows instead
     of throwing; the generator elements of such a domain take milliseconds (the
     isometry classification recursed without end there)
  8. the limit bisector (the base on the plane, 2026-10-29): the bisector of the points
     at height w above the base and its image is exactly N(a) - T N(a) + w^2/2 (e_inf -
     T e_inf) in H4 and tends to the side like w^2; the side is the Apollonius circle
     |x - T(a)|^2 = |T'(a)| |x - a|^2, for the unbent KLMN group (upper half plane) the
     hyperbolic bisector of a and T(a), for the wallpaper group o the euclidean one
  9. startDirichletSearch with a Worker (a stand-in speaking the worker's protocol):
     two searches use one worker, loaded once; a worker that fails to load leaves the
     search to the page (auto select never finished in the browser, 2026-10-29)
*/

import {
  Group_Cyclic,
  Group_WP,
  Group_s22222,
  Group_22222,
  parseWords,
  reduceWord,
  involutionLetters,
  dirichletBase,
  dirichletImage,
  dirichletSide,
  makeDirichletGroup,
  dirichletImages,
  dirichletCellAt,
  dirichletCell,
  sideArcPoint,
  selectDirichletSides,
  Group_KLMN,
  generatorElements,
  groupToData,
  groupFromData,
  startDirichletSearch,
} from '../../lib/grouplib/grouplib.js';
import { ITransform, iPoint, iTransformU4, iTransformH4, iGetBisectorU4, iDistanceU4, U4toH4, GroupUtils } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';
import { SPLANE_SPHERE, SPLANE_PLANE } from '../../lib/invlib/ISplane.js';

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

let seed = 20261026;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

function pnt(xy){ return iPoint([xy[0], xy[1], 0, 0]); }
function sigDist(side, xy){ return U4.sigDistanceSP(side, pnt(xy)); }
function isInside(sides, xy, eps = 1e-9){ return sides.every(s => sigDist(s, xy) < eps); }
function isStrictlyInside(sides, xy, eps){ return sides.every(s => sigDist(s, xy) < -eps); }

function sameSplane(a, b, eps = 1e-6){
  if(a.type !== b.type) return false;
  const u = a.v, w = b.v;
  if(a.type === SPLANE_SPHERE){
    return Math.hypot(u[0]-w[0], u[1]-w[1], u[2]-w[2]) < eps && Math.abs(Math.abs(u[3]) - Math.abs(w[3])) < eps;
  }
  if(a.type === SPLANE_PLANE){
    const nu = Math.hypot(u[0], u[1], u[2]), nw = Math.hypot(w[0], w[1], w[2]);
    const same = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu - w[i]/nw) < eps);
    const opp  = [0, 1, 2, 3].every(i => Math.abs(u[i]/nu + w[i]/nw) < eps);
    return same || opp;
  }
  return false;
}

function samePoint(p, q, eps = 1e-7){
  return Math.hypot(p.v[0]-q.v[0], p.v[1]-q.v[1], Math.abs(p.v[3])-Math.abs(q.v[3])) < eps;
}

// a point of the domain: the base, or the centre of the sides' bounding box when the base is in
function insidePoint(dg){
  const b = dg.dirichletBase;
  return [b.v[0], b.v[1]];
}

// every side bounds the cell; the pairing transform of side i maps the side onto a side and a
// point just beyond the middle of its free arc into the domain
function checkPairings(dg, label){
  const sides = dg.getFundDomain();
  const rtrans = dg.getReverseTransforms();
  const inside = insidePoint(dg);
  const cell = dirichletCell(sides);
  let ok = check(cell.length === sides.length, `${label}: ${cell.length} of ${sides.length} sides bound the cell`);
  for(const e of cell){
    const i = e.index;
    const tr = new ITransform(rtrans[i]);
    const image = tr.transform(sides[i]);
    const j = sides.findIndex(s => sameSplane(s, image, 1e-6));
    ok = check(j >= 0, `${label}: pairing ${i} ('${dg.dirichletWords[i]}') does not map its side onto a side`) && ok;
    const mid = sideArcPoint(sides[i], e.arcs[0], 0.5, 1);
    const delta = 1e-5*(1 + Math.hypot(mid[0], mid[1]));
    let dir = [mid[0]-inside[0], mid[1]-inside[1]];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    dir = [dir[0]/len, dir[1]/len];
    let beyond = [mid[0] + delta*dir[0], mid[1] + delta*dir[1]];
    if(sigDist(sides[i], beyond) <= 0) beyond = [mid[0] - delta*dir[0], mid[1] - delta*dir[1]];
    ok = check(sigDist(sides[i], beyond) > 0, `${label}: no point beyond side ${i}`) && ok;
    const back = tr.transform(pnt(beyond));
    const bxy = [back.v[0], back.v[1]];
    ok = check(isInside(sides, bxy, 1e-6), `${label}: pairing ${i} maps a point beyond side ${i} to (${bxy.map(x => x.toFixed(4))}) outside the domain`) && ok;
  }
  return ok;
}

// random points of the plane near the domain fold into it
function checkFolding(dg, label, radius, count = 200, maxIter = 2000, minRate = 0.97){
  const sides = dg.getFundDomain();
  const inside = insidePoint(dg);
  let folded = 0;
  for(let k = 0; k < count; k++){
    const xy = [inside[0] + radius*(2*rnd()-1), inside[1] + radius*(2*rnd()-1)];
    const res = dg.toFundDomain({ pnt: pnt(xy), maxIterations: maxIter });
    if(res.inDomain && isInside(sides, [res.pnt.v[0], res.pnt.v[1]], 1e-7)) folded++;
  }
  return check(folded >= minRate*count, `${label}: ${folded} of ${count} points fold into the domain`);
}

// ---- 1. the cyclic group of Cyclic/set_7 with the preset's words ------------------------

console.log('1. cyclic group, the words of the preset Cyclic/set_7');
const cyc = new Group_Cyclic();
cyc.setParamsMap({ AbsLambda: 1.022, ArgLambda: 19.2, finiteFP: false });
const cycGroup = cyc.getGroup();
const base7 = dirichletBase({ baseX: 0.7160210667, baseY: -0.0054142308 });
// the preset's words reversed (single letters, so unchanged)
const words7 = parseWords('a aaaaaaaaa aaaaaaaaaa b bbbbbbbbb bbbbbbbbbb');
const dg7 = makeDirichletGroup(cycGroup, { base: base7, words: words7 });
check(dg7 && dg7.getFundDomain().length === 6, 'six sides');
if(dg7){
  check(isStrictlyInside(dg7.getFundDomain(), [base7.v[0], base7.v[1]], 1e-9), 'the base is inside the domain');
  check(dg7.getReverseTransforms().every(t => t.length <= 5), 'the pairing transforms are shortened to at most 5 reflections');
  checkPairings(dg7, 'set_7');
  checkFolding(dg7, 'set_7', 0.5);
  // the pairing transform of the side of word w is the transform of the inverse word
  for(let i = 0; i < 6; i++){
    const w = dg7.dirichletWords[i];
    const inv = cycGroup.word2trans(GroupUtils.getInverseWord(w));
    const p = pnt([0.3, 0.1]);
    const a = iTransformU4(dg7.getReverseTransforms()[i], p);
    const b = iTransformU4(inv, p);
    check(samePoint(a, b, 1e-8), `pairing of '${w}' is the inverse word's transform`);
  }
}

// ---- 2. the Orb reading of the words ---------------------------------------------------

console.log('2. the Orb letter convention: old word == reversed word here');
{
  // the Orb groups of the 22222 preset set_14 and its (long) words
  const g22 = new Group_22222();
  g22.setParamsMap({ R1: 0.2, R2: 0.2, R3: 1.1, A2: 47.15, A3: 0, A4: 0, T0: -0.394, T1: -0.011, uhp: true });
  const group = g22.getGroup();
  const base = dirichletBase({ baseX: 0.0109922034, baseY: 0.8030285596 });
  const oldWords = parseWords('e d cd c fffffffffffa beffffffffffa ffffffffffacfffffffffffacfffffffffffa fffffffffffaeffffffffffacfffffffffffacfffffffffffa fffffffffffae de ebe a aebe b cebe');
  const names = group.getGenNames();
  const rtrans = group.getReverseTransforms();
  let ok = true;
  for(const w of oldWords){
    // Orb: the letters name the pairing transforms t_i, applied in the order written
    let P = [];
    for(const ch of w) P = P.concat(rtrans[names.indexOf(ch)]);
    const oldSide = dirichletImage(base, GroupUtils.getInverseTransform(P)).side;   // the side of P^{-1}(base)
    const here = dirichletSide(group, base, w.split('').reverse().join(''));
    ok = check(here && sameSplane(here.side, oldSide, 1e-7), `old word '${w.length > 20 ? w.slice(0, 20) + '…' : w}' == reversed word here`) && ok;
  }
  if(ok) console.log('  ', oldWords.length, 'words agree');
}

// ---- 3. the cell under a point ---------------------------------------------------------

console.log('3. dirichletCellAt: the image lies in the tiling cell of the point');
{
  const invol = involutionLetters(cycGroup);
  let ok = true, found = 0;
  for(let k = 0; k < 50; k++){
    const xy = [2*rnd() - 1, 2*rnd() - 1];
    const s = dirichletCellAt(cycGroup, base7, xy, 500, invol);
    if(!s) continue;
    found++;
    const fx = cycGroup.toFundDomain({ pnt: pnt(xy), maxIterations: 500 });
    const fp = cycGroup.toFundDomain({ pnt: pnt([s.point.v[0], s.point.v[1]]), maxIterations: 500 });
    const cellOfPoint = reduceWord(fx.word, invol), cellOfImage = reduceWord(fp.word, invol);
    ok = check(cellOfPoint === cellOfImage, `point (${xy.map(x => x.toFixed(3))}): cell '${cellOfPoint}', its image's cell '${cellOfImage}'`) && ok;
  }
  check(found > 40, `${found} of 50 points gave a cell`);
}

// ---- 4. the automatic sides of the cyclic group: the hexagon ---------------------------

console.log('4. selectDirichletSides on the cyclic group');
{
  const t0 = Date.now();
  const res = selectDirichletSides(cycGroup, { base: base7, depth: 2, maxIterations: 500 });
  console.log(`   ${res.words.length} sides from ${res.candidates} candidates in ${Date.now() - t0} ms: ${res.words.join(' ')}`);
  check(res.words.length === 6, 'six sides (the hexagon)');
  // the images are those of the preset's words
  const expected = words7.map(w => dirichletSide(cycGroup, base7, w).point);
  const matched = expected.filter(p => res.sides.some(s => samePoint(s.point, p, 1e-6))).length;
  check(matched === 6, `${matched} of the 6 images of the preset's words are among the sides`);
  const dg = makeDirichletGroup(cycGroup, { base: base7, words: res.words });
  check(dg && isStrictlyInside(dg.getFundDomain(), [base7.v[0], base7.v[1]], 1e-9), 'the base is inside');
  checkPairings(dg, 'auto cyclic');
  checkFolding(dg, 'auto cyclic', 0.5);
  // every side has a free arc
  const cell = dirichletCell(dg.getFundDomain());
  check(cell.length === 6, `${cell.length} of 6 sides bound the cell`);
}

// ---- 5. the wallpaper group o: hexagon and rectangle -----------------------------------

console.log('5. wallpaper group o');
{
  const wp = new Group_WP({ type: 'o', a: 0.5, b: 0.6, angle_b: 70 });
  const group = wp.getGroup();
  const base = dirichletBase({ baseX: 0.03, baseY: 0.07 });
  const res = selectDirichletSides(group, { base, depth: 2 });
  console.log(`   oblique: ${res.words.length} sides from ${res.candidates} candidates: ${res.words.join(' ')}`);
  check(res.words.length === 6, 'oblique lattice: hexagon');
  // the same from the words of at most 2 generators
  const imgs = dirichletImages(group, { base, depth: 2 });
  const cell = dirichletCell(imgs.map(i => i.side));
  check(cell.length === 6, `depth-2 images: ${cell.length} sides bound the cell`);
  const dg = makeDirichletGroup(group, { base, words: res.words });
  if(dg){ checkPairings(dg, 'o oblique'); checkFolding(dg, 'o oblique', 2); }

  const group2 = new Group_WP({ type: 'o', a: 0.5, b: 0.6, angle_b: 90 }).getGroup();
  const res2 = selectDirichletSides(group2, { base, depth: 2 });
  console.log(`   rectangular: ${res2.words.length} sides: ${res2.words.join(' ')}`);
  check(res2.words.length === 4, 'rectangular lattice: rectangle');
}

// ---- 6. *22222 and 22222 ---------------------------------------------------------------

console.log('6. *22222 and 22222');
{
  const s5 = new Group_s22222();
  const group = s5.getGroup();
  const base = dirichletBase({ baseX: 0.1, baseY: 0.5 });
  const t0 = Date.now();
  const res = selectDirichletSides(group, { base, depth: 2 });
  console.log(`   *22222: ${res.words.length} sides from ${res.candidates} candidates in ${Date.now() - t0} ms: ${res.words.join(' ')}`);
  const dg = makeDirichletGroup(group, { base, words: res.words });
  check(dg && dg.getFundDomain().length >= 5, '*22222: at least five sides');
  if(dg){ checkPairings(dg, '*22222'); checkFolding(dg, '*22222', 1.5); }

  const g22 = new Group_22222();
  g22.setParamsMap({ R1: 0.2, R2: 0.2, R3: 1.1, A2: 47.15, A3: 0, A4: 0, T0: 0, T1: 0, uhp: true });
  const group2 = g22.getGroup();
  const base2 = dirichletBase({ baseX: 0.0109922034, baseY: 0.8030285596 });
  const t1 = Date.now();
  const res2 = selectDirichletSides(group2, { base: base2, depth: 2, maxIterations: 1000 });
  console.log(`   22222 untwisted: ${res2.words.length} sides from ${res2.candidates} candidates in ${Date.now() - t1} ms: ${res2.words.join(' ')}`);
  check(res2.unpaired === 0 && res2.nearIdentity === 0, '22222 untwisted: all sides paired');
  const dg2 = makeDirichletGroup(group2, { base: base2, words: res2.words });
  check(dg2 && dg2.getFundDomain().length >= 6, '22222 untwisted: at least six sides');
  if(dg2){ checkPairings(dg2, '22222 untwisted'); checkFolding(dg2, '22222 untwisted', 1, 200, 3000, 0.9); }

  // the twisted group of the preset set_14 is not discrete: the search stops and says so
  g22.setParamsMap({ T0: -0.394, T1: -0.011 });
  const group3 = g22.getGroup();
  const t2 = Date.now();
  const res3 = selectDirichletSides(group3, { base: base2, depth: 2, maxIterations: 1000 });
  console.log(`   22222 (set_14, twisted): ${res3.words.length} sides from ${res3.candidates} candidates in ${Date.now() - t2} ms, ${res3.unpaired} unpaired, ${res3.nearIdentity} images at the base`);
  check(Date.now() - t2 < 5000, '22222 twisted: the search stops within 5 s');
  check(res3.words.length >= 6, '22222 twisted: a best-effort domain with at least six sides');
  const nearest = dirichletSide(group3, base2, 'afffffffffff');
  const fold = group3.toFundDomain({ pnt: pnt([nearest.point.v[0], nearest.point.v[1]]), maxIterations: 1000 });
  check(fold.inDomain && fold.word === '', '22222 twisted: the nearest image of the base lies inside the original domain (not a fundamental domain)');
  // the preset's own words (reversed) still give a group that renders: the base inside, its sides bound a cell
  const presetWords = parseWords('e d cd c fffffffffffa beffffffffffa ffffffffffacfffffffffffacfffffffffffa fffffffffffaeffffffffffacfffffffffffacfffffffffffa fffffffffffae de ebe a aebe b cebe').map(w => w.split('').reverse().join(''));
  const dgp = makeDirichletGroup(group3, { base: base2, words: presetWords });
  check(dgp && isStrictlyInside(dgp.getFundDomain(), [base2.v[0], base2.v[1]], 1e-9), '22222 twisted: the base is inside the preset\'s domain');
  const pcell = dirichletCell(dgp.getFundDomain());
  console.log(`   the preset's first ${presetWords.length} words: ${pcell.length} of ${dgp.getFundDomain().length} sides bound their cell`);
}

// ---- 7. the group as data (for the worker), the deadline, deformed words ------------

console.log('7. the group as data, the deadline, the words of a deformed group');
{
  // the bent KLMN group of the symdraw preset par_s2223-4, with its base and words
  const klmn = new Group_KLMN();
  const params = { s: false, K: 3, L: 2, M: 2, N: 2, twist: 0.0169, aspect: 0.49, bend: 34, uhp: true };
  klmn.setParamsMap(params);
  const group = klmn.getGroup();
  const base = dirichletBase({ baseX: 0.13563514348191294, baseY: 0.12021362958994072 });

  // the data round trip gives the same group: the same folds and the same automatic sides
  const copy = groupFromData(JSON.parse(JSON.stringify(groupToData(group))));
  check(copy.getGenNames().join('') === group.getGenNames().join(''), 'data: the same generator names');
  let sameFolds = true;
  for (let i = 0; i < 200; i++) {
    const p = pnt([rnd() - 0.5, rnd() * 0.8]);
    const a = group.toFundDomain({ pnt: p, maxIterations: 200 }), b = copy.toFundDomain({ pnt: p, maxIterations: 200 });
    if (a.word !== b.word || a.inDomain !== b.inDomain) sameFolds = false;
  }
  check(sameFolds, 'data: 200 random points fold with the same words');
  const r1 = selectDirichletSides(group, { base, depth: 2 });
  const r2 = selectDirichletSides(copy, { base, depth: 2 });
  check(r1.words.join(' ') === r2.words.join(' '), 'data: the same automatic sides');
  console.log(`   ${r1.words.length} sides, longest word ${Math.max(...r1.words.map(w => w.length))}`);

  // the deadline: a barely discrete bending (aspect 0.3, bend 30: about 3 s unlimited)
  // answers soon after it with the sides found so far
  klmn.setParamsMap({ ...params, twist: 0, aspect: 0.3, bend: 30 });
  const slow = klmn.getGroup();
  let t = Date.now();
  const r3 = selectDirichletSides(slow, { base, depth: 2, deadline: Date.now() + 300 });
  const ms = Date.now() - t;
  console.log(`   deadline 300 ms: answered in ${ms} ms, ${r3.words.length} sides from ${r3.candidates} candidates, timed out: ${r3.timedOut}`);
  check(r3.timedOut && ms < 1500, 'deadline: the search answers within 1.5 s of a 300 ms deadline');
  t = Date.now();
  const r4 = selectDirichletSides(slow, { base, depth: 2, deadline: Date.now() - 1 });
  check(r4.timedOut && Date.now() - t < 1000, 'deadline: a passed deadline answers at once');

  // startDirichletSearch without Worker (Node) searches in place and resolves
  const s = startDirichletSearch(group, { base, depth: 2, minScale: 0.01, maxIterations: 200, timeLimit: 5 });
  const r5 = await s.promise;
  check(r5.words && r5.words.join(' ') === r1.words.join(' '), 'startDirichletSearch: in place without a worker, the same sides');

  // the preset's long words on deformed groups: sides lost to overflow are left out,
  // nothing throws (the factorization reflected an undefined image before)
  const words = parseWords('bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcbcbcaBacbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcacbcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcAbAcBcBcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcAbAcBcBcbcbcaBacbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcacbcbcbcaB bAcBcBcbcbcaB bAcBcBcBcAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcbcaB bAcBcbcbcaB bAcBcBcBcB acbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcaB bAcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcBcA bAcBcBcBcBcB');
  const dg = makeDirichletGroup(group, { base, words });
  check(dg && dg.getFundDomain().length === 12, 'preset words: all 12 sides at the preset\'s parameters');
  for (const change of [{ K: 6 }, { twist: 0.3 }, { bend: 30 }]) {
    klmn.setParamsMap({ ...params, ...change });
    let dgc = null, threw = null;
    try { dgc = makeDirichletGroup(klmn.getGroup(), { base, words }); } catch (e) { threw = e.message; }
    check(!threw, `preset words with ${JSON.stringify(change)}: no exception (${threw})`);
    console.log(`   ${JSON.stringify(change)}: ${dgc ? dgc.getFundDomain().length : 0} sides kept`);
  }

  // the generators overlay on the domain left of those words after twist 0.3 and
  // aspect 0.3: classifyIsometry squared a reversing pairing, found the square
  // reversing again (rounding) and recursed with doubling reflection lists - a frame
  // of 21 s in the page, or the memory exhausted (2026-10-29)
  klmn.setParamsMap({ ...params, twist: 0.3, aspect: 0.3 });
  const dgw = makeDirichletGroup(klmn.getGroup(), { base, words });
  check(dgw, 'twist 0.3, aspect 0.3: a Dirichlet group from the remaining words');
  if(dgw){
    t = Date.now();
    let threw = null;
    try { generatorElements({ group: dgw }); } catch (e) { threw = e.message; }
    const gms = Date.now() - t;
    console.log(`   twist 0.3, aspect 0.3: ${dgw.getFundDomain().length} sides, generator elements in ${gms} ms`);
    check(!threw && gms < 2000, `generator elements of the deformed domain within 2 s, no exception (${threw})`);
  }
}

// ---- 8. the limit bisector --------------------------------------------------------------

console.log('8. the limit bisector of the base on the plane');
{
  const mink = (p, q) => p[0]*q[0] + p[1]*q[1] + p[2]*q[2] + p[3]*q[3] - p[4]*q[4];
  const unit = v => { const n = Math.sqrt(Math.abs(mink(v, v))); return v.map(x => x/n); };
  const vdist = (u, v) => { const a = unit(u), b = unit(v); return Math.hypot(...a.map((x, i) => x - b[i])); };
  const EINF = [0, 0, 0, 1, 1];
  // points along the trace of a side on the plane
  const tracePoints = side => {
    const arc = side.type === SPLANE_SPHERE ? [0, 2*Math.PI] : [-1, 1];
    return [0.1, 0.3, 0.55, 0.8].map(t => sideArcPoint(side, arc, t, 1)).filter(Boolean);
  };
  const klmn = new Group_KLMN();
  klmn.setParamsMap({ s: false, K: 3, L: 2, M: 2, N: 2, twist: 0, aspect: 0.49, bend: 0, uhp: true });
  const unbent = klmn.getGroup();
  klmn.setParamsMap({ s: false, K: 3, L: 2, M: 2, N: 2, twist: 0.0169, aspect: 0.49, bend: 34, uhp: true });
  const bent = klmn.getGroup();
  const a = [0.13563514348191294, 0.12021362958994072];
  const base = dirichletBase({ baseX: a[0], baseY: a[1] });
  const words = ['a', 'b', 'c', 'B', 'ab', 'bc', 'acb', 'cca', 'abcA', 'aCbc'];
  let pencil = 0, limit2 = 0, limit3 = 0, apol = 0, hyp = 0;
  for (const [label, group] of [['unbent', unbent], ['bent', bent]]) {
    for (const w of words) {
      const T = group.word2trans(w);
      const s = dirichletSide(group, base, w);
      if (!check(s, `${label} '${w}': a side`)) continue;
      check(iDistanceU4(s.side, base) < 0, `${label} '${w}': the base inside its side`);
      // the old bisector of the points at height h above a and T(a): exactly the
      // pencil N(a) - T N(a) + h^2/2 (e_inf - T e_inf), and h^2 away from the side
      const at = h => { const p = iPoint([a[0], a[1], 0, h]); return U4toH4(iGetBisectorU4(p, iTransformU4(T, p))); };
      const N = U4toH4(pnt(a));
      const TN = iTransformH4(T, N), TE = iTransformH4(T, EINF);
      const B = N.map((x, i) => x - TN[i] + (0.3*0.3/2)*(EINF[i] - TE[i]));
      pencil = Math.max(pencil, vdist(B, at(0.3)));
      const B0 = U4toH4(s.side);
      limit2 = Math.max(limit2, vdist(B0, at(1e-2)));
      limit3 = Math.max(limit3, vdist(B0, at(1e-3)));
      // the Apollonius circle; for the unbent group the bisector of the upper half plane
      const b = s.point.v;
      for (const x of tracePoints(s.side)) {
        const da = (x[0]-a[0])**2 + (x[1]-a[1])**2, db = (x[0]-b[0])**2 + (x[1]-b[1])**2;
        apol = Math.max(apol, Math.abs(db - s.scale*da)/db);
        if (label === 'unbent' && x[1] > 0) {
          const ca = 1 + da/(2*x[1]*a[1]), cb = 1 + db/(2*x[1]*b[1]);
          hyp = Math.max(hyp, Math.abs(ca - cb)/ca);
        }
      }
    }
  }
  console.log(`   pencil at w = 0.3: ${pencil.toExponential(1)}; the old bisector at w = 1e-2: ${limit2.toExponential(1)}, at 1e-3: ${limit3.toExponential(1)}; Apollonius ${apol.toExponential(1)}, hyperbolic ${hyp.toExponential(1)}`);
  check(pencil < 1e-9, 'the old bisector at w is N(a) - T N(a) + w^2/2 (e_inf - T e_inf)');
  check(limit3 < 1e-3 && limit3 < limit2/50, 'the old bisector tends to the side like w^2');
  check(apol < 1e-9, "the side is the Apollonius circle |x - T(a)|^2 = |T'(a)| |x - a|^2");
  check(hyp < 1e-9, 'unbent KLMN: the side is the hyperbolic bisector of a and T(a)');

  // the wallpaper group o: a plane, scale 1, the euclidean bisector
  const wp = new Group_WP({ type: 'o', a: 0.5, b: 0.6, angle_b: 70 }).getGroup();
  const wa = [0.03, 0.07];
  const wbase = dirichletBase({ baseX: wa[0], baseY: wa[1] });
  let eu = 0;
  for (const w of ['a', 'c', 'ac', 'aC']) {
    const s = dirichletSide(wp, wbase, w);
    if (!check(s && s.side.type === SPLANE_PLANE && Math.abs(s.scale - 1) < 1e-12, `o '${w}': a plane, scale 1`)) continue;
    const b = s.point.v;
    for (const x of tracePoints(s.side)) eu = Math.max(eu, Math.abs(Math.hypot(x[0]-wa[0], x[1]-wa[1]) - Math.hypot(x[0]-b[0], x[1]-b[1])));
  }
  console.log(`   o: euclidean bisector to ${eu.toExponential(1)}`);
  check(eu < 1e-12, 'o: the side is the euclidean bisector');
}

// ---- 9. the search worker: kept between searches, the page when it fails ------------------

console.log('9. startDirichletSearch with a worker');
{
  const wp = new Group_WP({ type: 'o', a: 0.5, b: 0.6, angle_b: 70 }).getGroup();
  const base = dirichletBase({ baseX: 0.03, baseY: 0.07 });
  const opt = { base, depth: 2, minScale: 0.01, maxIterations: 200, timeLimit: 5 };
  const expected = selectDirichletSides(wp, opt).words.join(' ');
  // a stand-in for DirichletWorker.js: 'ready' after loading, then answers each search
  class GoodWorker {
    constructor() { GoodWorker.made++; setTimeout(() => this.onmessage({ data: { type: 'ready' } }), 20); }
    postMessage(m) {
      setTimeout(() => {
        const res = selectDirichletSides(groupFromData(m.group), { ...m.options, base: iPoint(m.base) });
        this.onmessage({ data: { type: 'done', result: { words: res.words, candidates: res.candidates, unpaired: res.unpaired, nearIdentity: res.nearIdentity, timedOut: res.timedOut } } });
      }, 0);
    }
    terminate() { GoodWorker.terminated++; }
  }
  GoodWorker.made = 0; GoodWorker.terminated = 0;
  class FailingWorker {
    constructor() { setTimeout(() => this.onerror({ message: 'simulated load failure' }), 20); }
    postMessage() {}
    terminate() {}
  }
  const saved = globalThis.Worker;
  try {
    globalThis.Worker = GoodWorker;
    // a module instance of its own (the query), with its own kept worker
    const S1 = await import('../../lib/grouplib/DirichletSearch.js?test=good');
    const stages = [];
    const a = await S1.startDirichletSearch(wp, { ...opt, onStage: s => stages.push(s) }).promise;
    const b = await S1.startDirichletSearch(wp, opt).promise;
    check(a.where === 'worker' && b.where === 'worker', `the searches ran in the worker (${a.where}, ${b.where})`);
    check(a.words.join(' ') === expected && b.words.join(' ') === expected, 'the worker gives the sides of the search in place');
    check(GoodWorker.made === 1 && GoodWorker.terminated === 0, `one worker for two searches (${GoodWorker.made} made, ${GoodWorker.terminated} terminated)`);
    check(stages.join(' ') === 'loading search', `the stages of the first search: ${stages.join(' ')}`);

    globalThis.Worker = FailingWorker;
    const S2 = await import('../../lib/grouplib/DirichletSearch.js?test=failing');
    const t = Date.now();
    const c = await S2.startDirichletSearch(wp, opt).promise;
    check(c.where === 'page' && c.words && c.words.join(' ') === expected && Date.now() - t < 2000,
      `a worker that fails to load: the search runs in the page (${c.where}, ${Date.now() - t} ms)`);
  } finally {
    globalThis.Worker = saved;
  }
  console.log('   one worker for two searches; a failing worker leaves the search to the page');
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
