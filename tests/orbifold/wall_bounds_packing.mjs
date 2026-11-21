/*
  The bounds of the walls in the group data handed to the shaders.

    node tests/orbifold/wall_bounds_packing.mjs

  DataPacking.packGroupToArray() writes the bounds of a group's walls after the
  transforms, their offset in the y of the transforms texel (0 for a group
  without bounds). The shaders read them through inWallBounds()
  (inversiveSampler.glsl.mjs). This test decodes the array the way that shader
  does and checks it agrees, side for side and point for point, with
  Group.withinWallBounds() on the CPU.

  1. hasWallBounds() is true exactly for orbifolds with a bounded wall, and a
     group without bounds packs as before (no walls data, the y left 0)
  2. the packed walls decode back to the bounds that went in
  3. the decoded test agrees with the CPU one over the disk
  4. clone and applyTransform carry the bounds, and the packed fold of a
     transformed group agrees with the CPU fold

  After Chaim Goodman-Strauss's tests/orbifold/wall_bounds_packing.mjs
  (origin/sympix-orbifold2 004327e), which packed the bounds into a texture of
  their own.
*/

import { WallPaperGroup_General } from '../../lib/orbilib/WallPaperGroup_General.js';
import { Group, iPoint, iSplane, iReflectU4, ITransform } from '../../lib/invlib/invlib.js';
import { DataPacking } from '../../lib/invlib/DataPacking.js';
import { U4 } from '../../lib/invlib/U4.js';

const WALLED   = ['oo', '2xo', '33333', '23o', '2222o', '234oo'];
const UNWALLED = ['o3', '3o', '*442', '*2223', '632'];

let failures = 0;
function check(cond, msg){
  if(!cond){ failures++; console.log('  FAIL: ' + msg); }
}

const symmetryUIStub = { init(){}, setShift(){}, render(){ return []; }, getUniforms(u){ return u; }, handleEvent(){} };
const mockCtrl   = () => { const c = { setValue: () => c, onChange: () => c, updateDisplay: () => c }; return c; };
const mockFolder = () => ({ add: mockCtrl, addFolder: mockFolder, removeFolder(){}, open(){}, close(){}, gpname: mockCtrl() });

const log = console.log;
function quietly(f){ console.log = () => {}; try { return f(); } finally { console.log = log; } }

function buildGroup(name, twist = 0){
  return quietly(() => {
    const wg = new WallPaperGroup_General({ symmetryUI: symmetryUIStub, patternMaker: null });
    wg.paramGui = mockFolder();
    wg.paramGuiFolder = null;
    wg.guiParams = { name };
    if(!wg.updateTheGroup()) return null;
    wg.updateTheGroupGeometry();
    if(twist !== 0){
      const p = { ...wg.getParamsMap() };
      Object.keys(p).filter(k => k.endsWith('_t')).forEach(k => p[k] = twist);
      // setParamsMap rebuilds the geometry itself (WallPaperGroup_General)
      wg.setParamsMap(p);
    }
    const fd = wg.FD;
    return new Group({ s: fd.s.map(face => face[0]), t: fd.t, walls: fd.s.map(face => face.slice()) });
  });
}

// ── read the packed array the way the shaders do ─────────────────────────────

const slot = (data, offset, c = 0) => data[4*offset + c];

function decodeSplane(data, offset){
  const v = [data[4*offset], data[4*offset+1], data[4*offset+2], data[4*offset+3]];
  return new iSplane({ v, type: slot(data, offset + 1) });
}

// inversiveSampler's getWallsOffset() and inWallBounds(), in JS
const wallsOffsetOf = data => slot(data, 1, 1);
function packedInWallBounds(data, wallsOffset, g, pnt){
  if(wallsOffset === 0) return true;
  const boundsOffset = slot(data, wallsOffset + 1 + g);
  if(boundsOffset === 0) return true;
  const count = slot(data, boundsOffset);
  for(let j = 0; j < count; j++){
    if(U4.sigDistanceSP(decodeSplane(data, boundsOffset + 1 + 2*j), pnt) <= 0) return false;
  }
  return true;
}

// inversiveSampler's iToFundamentalDomainSampler(), in JS (the word as side indices)
function packedFold(data, pnt, iterations){
  const domainOffset = slot(data, 0), transformsOffset = slot(data, 1);
  const size = slot(data, domainOffset);
  const wallsOffset = wallsOffsetOf(data);
  const word = [];
  for(let k = 0; k < iterations; k++){
    let found = false;
    for(let g = 0; g < size; g++){
      const sp = decodeSplane(data, domainOffset + 1 + 2*g);
      if(U4.sigDistanceSP(sp, pnt) > 1e-7 && packedInWallBounds(data, wallsOffset, g, pnt)){
        const to = slot(data, transformsOffset + g + 1);
        const n = slot(data, to);
        for(let r = 0; r < n; r++) pnt = iReflectU4(decodeSplane(data, to + 1 + 2*r), pnt);
        word.push(g);
        found = true;
        break;
      }
    }
    if(!found) return { inDomain: true, pnt, word };
  }
  return { inDomain: false, pnt, word };
}

function randomPoint(rmax){
  const r = rmax * Math.sqrt(Math.random());
  const t = 2 * Math.PI * Math.random();
  return iPoint([r * Math.cos(t), r * Math.sin(t)]);
}

console.log('=== hasWallBounds, and groups without bounds pack as before ===');
for(const name of WALLED){
  const g = buildGroup(name);
  check(g !== null && DataPacking.hasWallBounds(g), `${name}: should have bounded walls`);
}
for(const name of UNWALLED){
  const g = buildGroup(name);
  check(g !== null, `${name}: builds`);
  if(!g) continue;
  check(!DataPacking.hasWallBounds(g), `${name}: should NOT have bounded walls`);
  const data = DataPacking.packGroupToArray(g);
  check(wallsOffsetOf(data) === 0, `${name}: walls offset should be 0`);
  // the size of the layout without the walls data
  const fd = g.getFundDomain();
  const size = 2 + (2*fd.length + 1) + DataPacking.getTransformsBufferSize(g.getReverseTransforms());
  check(data.length === 4*size, `${name}: packed ${data.length/4} units, the layout without walls is ${size}`);
}
// an old style {s, t} object without walls, as the crown data is packed
{
  const g = buildGroup('*442');
  const data = DataPacking.packGroupToArray({ s: g.getFundDomain(), t: g.getReverseTransforms() });
  check(wallsOffsetOf(data) === 0, '{s, t}: walls offset should be 0');
}
console.log(`  ${WALLED.length} walled, ${UNWALLED.length} unwalled, as expected`);

console.log('\n=== the packed walls decode back, and agree with the CPU ===');
const SAMPLES = 4000;
for(const name of WALLED){
  for(const twist of [0, 0.25]){
    const group = buildGroup(name, twist);
    const walls = group.getFundDomainWalls();
    const data  = DataPacking.packGroupToArray(group);
    const wo = wallsOffsetOf(data);
    check(wo > 0, `${name}/twist ${twist}: walls offset set`);
    if(!(wo > 0)) continue;

    check(slot(data, wo) === walls.length,
          `${name}/twist ${twist}: walls data says ${slot(data, wo)} sides, group has ${walls.length}`);
    check(data.length/4 === wo + 1 + walls.length + walls.reduce((s, w) => s + (w.length > 1 ? 2*w.length - 1 : 0), 0),
          `${name}/twist ${twist}: walls data size`);

    // every bound splane survives the round trip
    let bounds = 0, wrong = 0;
    for(let g = 0; g < walls.length; g++){
      const expect = walls[g].slice(1);
      const offset = slot(data, wo + 1 + g);
      if(expect.length === 0){
        if(offset !== 0) wrong++;
        continue;
      }
      if(slot(data, offset) !== expect.length){ wrong++; continue; }
      for(let j = 0; j < expect.length; j++){
        const got = decodeSplane(data, offset + 1 + j*2);
        bounds++;
        // the texture is float32, so compare at float precision
        if(got.type !== expect[j].type ||
           got.v.some((x, i) => Math.abs(x - expect[j].v[i]) > 1e-6*(1 + Math.abs(expect[j].v[i])))) wrong++;
      }
    }
    check(wrong === 0, `${name}/twist ${twist}: ${wrong} packed bounds did not round trip`);
    check(bounds > 0,  `${name}/twist ${twist}: no bounds were packed`);

    // and the decoded test answers the same as the CPU one, everywhere
    let disagree = 0;
    for(let i = 0; i < SAMPLES; i++){
      const p = randomPoint(0.999);
      for(let g = 0; g < walls.length; g++){
        if(packedInWallBounds(data, wo, g, p) !== Group.withinWallBounds(walls[g], p)) disagree++;
      }
    }
    check(disagree === 0, `${name}/twist ${twist}: ${disagree} disagreements with the CPU test`);
    console.log(`  ${name.padEnd(8)} twist ${String(twist).padEnd(5)} ${walls.length} sides, ${bounds} bounds packed, ${data.length/4} units, agrees on ${SAMPLES} points`);
  }
}

console.log('\n=== clone and applyTransform carry the bounds; the packed fold agrees ===');
const FOLDS = 1000;
for(const name of WALLED){
  const group = buildGroup(name, 0.25);
  const moved = group.clone();
  check(moved.getFundDomainWalls() && moved.getFundDomainWalls() !== group.getFundDomainWalls(),
        `${name}: the clone has walls of its own`);
  check(moved.getFundDomainWalls().every((w, i) => w[0] === moved.getFundDomain()[i]),
        `${name}: the clone's walls start with its sides`);
  // move the clone as the group transform and the pattern pose do: a hyperbolic
  // translation, a rotation, a scale and a Euclidean translation
  const T = ITransform.getHyperTranslation(0.3, -0.2)
    .concat(ITransform.getRotation([0, 0, 1], 0.7))
    .concat(ITransform.getScale(1.7))
    .concat(ITransform.getTranslation([0.4, -0.25]));
  moved.applyTransform(T);
  check(moved.getFundDomainWalls().every((w, i) => w[0] === moved.getFundDomain()[i]),
        `${name}: the moved walls start with the moved sides`);
  check(group.getFundDomainWalls().every((w, i) => w[0] === group.getFundDomain()[i]),
        `${name}: the original keeps its walls`);
  const data = DataPacking.packGroupToArray(moved);
  let outside = 0, noConv = 0, differs = 0, unmoved = 0;
  for(let i = 0; i < FOLDS; i++){
    const q = randomPoint(0.95);
    const p = T.transform(q);
    const gpu = packedFold(data, p, 60);
    const cpu = moved.toFundDomain({ pnt: p, maxIterations: 60 });
    if(!gpu.inDomain) { noConv++; continue; }
    // in the moved walled domain
    const inside = moved.getFundDomainWalls().every((w, g) =>
      !(U4.sigDistanceSP(w[0], gpu.pnt) > 1e-7 && Group.withinWallBounds(w, gpu.pnt)));
    if(!inside) outside++;
    const dist = (a, b) => Math.hypot(a.v[0] - b.v[0], a.v[1] - b.v[1]);
    if(dist(gpu.pnt, cpu.pnt) > 1e-6) differs++;
    // the fold of the moved group is the move of the fold
    const home = T.transform(group.toFundDomain({ pnt: q, maxIterations: 60 }).pnt);
    if(dist(gpu.pnt, home) > 1e-6) unmoved++;
  }
  check(noConv === 0,  `${name}: ${noConv}/${FOLDS} packed folds did not converge`);
  check(outside === 0, `${name}: ${outside}/${FOLDS} packed folds landed outside the walled domain`);
  check(differs === 0, `${name}: ${differs}/${FOLDS} packed folds differ from the CPU fold`);
  check(unmoved === 0, `${name}: ${unmoved}/${FOLDS} packed folds differ from the moved fold of the original`);
  console.log(`  ${name.padEnd(8)} moved: ${FOLDS} packed folds converge, land in the domain, agree with the CPU and the original`);
}

console.log('');
if(failures){ console.log(`${failures} CHECKS FAILED`); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
