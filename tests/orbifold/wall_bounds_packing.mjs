/*
  The wall-bounds side table handed to the bounded-wall shaders.

    node tests/orbifold/wall_bounds_packing.mjs

  DataPacking.packWallBoundsToArray() writes the bounds of a group's walls into
  their own float array, leaving the group data untouched.  A shader compiled
  with USE_WALL_BOUNDS reads it through withinWallBounds().  This test decodes
  the array the way that shader does and checks it agrees, wall for wall and
  point for point, with Group.withinWallBounds() on the CPU.

  1. hasWallBounds() is true exactly for orbifolds with a bounded wall
  2. the packed layout decodes back to the bounds that went in
  3. the decoded test agrees with the CPU one over the disk
  4. walledProgramName() swaps in the variants, and only for a walled group
*/

import { WallPaperGroup_General } from '../../lib/orbilib/WallPaperGroup_General.js';
import { Group, iPoint, iSplane } from '../../lib/invlib/invlib.js';
import { DataPacking } from '../../lib/invlib/DataPacking.js';
import { walledProgramName } from '../../lib/symhublib/SymRendererPrograms.js';

const WALLED   = ['oo', '2xo', '33333', '23o', '2222o', '234oo'];
const UNWALLED = ['o3', '3o', '*442', '*2223', '632'];

let failures = 0;
function check(cond, msg){
  if(!cond){ failures++; console.log('  FAIL: ' + msg); }
}

const symmetryUIStub = { init(){}, setShift(){}, render(){ return []; }, getUniforms(u){ return u; }, handleEvent(){} };
const mockCtrl   = () => { const c = { setValue: () => c, onChange: () => c, updateDisplay: () => c }; return c; };
const mockFolder = () => ({ add: mockCtrl, addFolder: mockFolder, removeFolder(){}, open(){}, close(){}, gpname: mockCtrl() });

function buildGroup(name, twist = 0){
  const wg = new WallPaperGroup_General({ symmetryUI: symmetryUIStub, patternMaker: null });
  wg.paramGui = mockFolder();
  wg.paramGuiFolder = null;
  wg.guiParams = { name };
  if(!wg.updateTheGroup()) return null;
  wg.updateTheGroupGeometry();
  if(twist !== 0){
    const p = { ...wg.getParamsMap() };
    Object.keys(p).filter(k => k.endsWith('_t')).forEach(k => p[k] = twist);
    wg.setParamsMap(p);
    wg.updateTheGroupGeometry();
  }
  const fd = wg.FD;
  return new Group({ s: fd.s.map(face => face[0]), t: fd.t, walls: fd.s });
}

// ── read the packed array the way the shader does ────────────────────────────

const slot = (data, offset) => data[4*offset];

function decodeSplane(data, offset){
  const v = [data[4*offset], data[4*offset+1], data[4*offset+2], data[4*offset+3]];
  return new iSplane({ v, type: slot(data, offset + 1) });
}

// the shader's withinWallBounds(g, pnt), in JS
function packedWithinWallBounds(data, g, pnt){
  const count = slot(data, 0);
  if(g < 0 || g >= count) return true;
  const boundsOffset = slot(data, 1 + g);
  if(boundsOffset === 0) return true;
  const boundsCount = slot(data, boundsOffset);
  for(let j = 0; j < boundsCount; j++){
    const bp = decodeSplane(data, boundsOffset + 1 + j*2);
    if(Group.withinWallBounds([null, bp], pnt) === false) return false;
  }
  return true;
}

console.log('=== hasWallBounds ===');
for(const name of WALLED){
  const g = buildGroup(name);
  check(g !== null && DataPacking.hasWallBounds(g), `${name}: should have bounded walls`);
}
for(const name of UNWALLED){
  const g = buildGroup(name);
  check(g !== null, `${name}: builds`);
  if(g) check(!DataPacking.hasWallBounds(g), `${name}: should NOT have bounded walls`);
  if(g) check(DataPacking.packWallBoundsToArray(g) === null,
              `${name}: should pack to nothing`);
}
console.log(`  ${WALLED.length} walled, ${UNWALLED.length} unwalled, as expected`);

console.log('\n=== the packed table decodes back, and agrees with the CPU ===');
const SAMPLES = 4000;
for(const name of WALLED){
  for(const twist of [0, 0.25]){
    const group = buildGroup(name, twist);
    const walls = group.getFundDomainWalls();
    const data  = DataPacking.packWallBoundsToArray(group);
    check(data !== null, `${name}/twist ${twist}: packs`);
    if(!data) continue;

    check(slot(data, 0) === walls.length,
          `${name}/twist ${twist}: header says ${slot(data,0)} walls, group has ${walls.length}`);

    // every bound splane survives the round trip
    let bounds = 0, wrong = 0;
    for(let g = 0; g < walls.length; g++){
      const expect = walls[g].slice(1);
      const offset = slot(data, 1 + g);
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
      const r = 0.999 * Math.sqrt(Math.random());
      const t = 2 * Math.PI * Math.random();
      const p = iPoint([r * Math.cos(t), r * Math.sin(t)]);
      for(let g = 0; g < walls.length; g++){
        if(packedWithinWallBounds(data, g, p) !== Group.withinWallBounds(walls[g], p)) disagree++;
      }
    }
    check(disagree === 0, `${name}/twist ${twist}: ${disagree} disagreements with the CPU test`);
    console.log(`  ${name.padEnd(8)} twist ${String(twist).padEnd(5)} ${walls.length} walls, ${bounds} bounds packed, ${data.length/4} slots, agrees on ${SAMPLES} points`);
  }
}

console.log('\n=== program selection ===');
const swaps = {
  'bufferToScreenImageArray': 'bufferToScreenImageArrayWalled',
  'overlayTiling':            'overlayTilingWalled',
  'overlayIsolines':          'overlayIsolinesWalled',
  'overlayLimitset':          'overlayLimitsetWalled',
  'overlayFundDomain':        'overlayFundDomainWalled',
};
for(const [plain, walled] of Object.entries(swaps)){
  check(walledProgramName(plain, true)  === walled, `${plain} -> ${walled} when walled`);
  check(walledProgramName(plain, false) === plain,  `${plain} unchanged when not walled`);
}
for(const untouched of ['bufferToScreenImage', 'overlayGenerators', 'overlayBuffer', 'overlayWorldGrid']){
  check(walledProgramName(untouched, true) === untouched, `${untouched} has no walled twin, stays put`);
}
console.log(`  ${Object.keys(swaps).length} programs swap, 4 without a twin stay put`);

console.log('');
if(failures){ console.log(`${failures} CHECKS FAILED`); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
