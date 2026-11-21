/*
  Fundamental domains whose sides are bounded stretches of a wall.

    node tests/orbifold/walled_domain.mjs

  An orbifold with a handle or a second crosscap (oo, 2xo, 33333, 23o, ...) has
  a fundamental domain in which two or three sides lie on ONE sPlane and are
  told apart only by their bounds - each with its own pairing transform.  A
  reduction that looks only at the wall sPlane always picks the first of them,
  so a point crossing the other stretches is folded by the wrong generator: the
  pattern (and any image drawn in it) is cut along the bounds, which are not
  walls of the domain at all.

  1. the affected orbifolds really do have sides sharing a wall
  2. Group.toFundDomain honours the bounds: every point lands in the walled
     domain, and the word it returns really carries the point there
  3. convex orbifolds are unaffected - same word with and without the walls
*/

import { WallPaperGroup_General } from '../../lib/orbilib/WallPaperGroup_General.js';
import { Group, iPoint } from '../../lib/invlib/invlib.js';
import { U4 } from '../../lib/invlib/U4.js';

const WALLED = ['oo', '2xo', '33333', '23o', '2222o', '234oo'];
const CONVEX = ['*442', '*2223', '32x', '632', '*532'];

let failures = 0;
function check(cond, msg){
  if(!cond){ failures++; console.log('  FAIL: ' + msg); }
}

// ── build a group straight out of the orbifold machinery ──────────────────

const symmetryUIStub = { init(){}, setShift(){}, render(){ return []; }, getUniforms(u){ return u; }, handleEvent(){} };
const mockCtrl   = () => { const c = { setValue: () => c, onChange: () => c, updateDisplay: () => c }; return c; };
const mockFolder = () => ({ add: mockCtrl, addFolder: mockFolder, removeFolder(){}, open(){}, close(){}, gpname: mockCtrl() });

function buildFD(name){
  const wg = new WallPaperGroup_General({ symmetryUI: symmetryUIStub, patternMaker: null });
  wg.paramGui = mockFolder();
  wg.paramGuiFolder = null;
  wg.guiParams = { name };
  if(!wg.updateTheGroup()) return null;
  wg.updateTheGroupGeometry();
  return wg.FD;
}

// the rule of the orbifold app's iToWalledFundamentalDomain and of inWallBounds in
// the shared shaders (inversiveSampler.glsl.mjs): a side is crossed only
// where the point is outside its wall AND positive on every one of its bounds
function inWalledDomain(fd, pnt){
  for(const side of fd.s){
    let crossed = true;
    for(const sp of side){ if(U4.sigDistanceSP(sp, pnt) <= 0){ crossed = false; break; } }
    if(crossed) return false;
  }
  return true;
}

function randomPoint(){
  const r = 0.97 * Math.sqrt(Math.random());
  const t = 2 * Math.PI * Math.random();
  return iPoint([r * Math.cos(t), r * Math.sin(t)]);
}

const SAMPLES = 2000;

console.log('=== sides sharing a wall ===');
for(const name of WALLED){
  const fd = buildFD(name);
  check(fd !== null, `${name}: builds`);
  if(!fd) continue;
  const key = s => s.v.map(x => x.toFixed(9)).join(',') + '|' + s.type;
  const byWall = {};
  fd.s.forEach((side, i) => (byWall[key(side[0])] ||= []).push(i));
  const shared = Object.values(byWall).filter(a => a.length > 1);
  check(shared.length > 0, `${name}: some sides share a wall sPlane`);
  const bounded = fd.s.filter(side => side.length > 1).length;
  check(bounded > 0, `${name}: some sides carry bounds`);
  console.log(`  ${name.padEnd(8)} ${fd.s.length} sides, ${bounded} bounded, shared walls: ${JSON.stringify(shared)}`);
}

console.log('\n=== the reduction honours the bounds ===');
for(const name of [...WALLED, ...CONVEX]){
  const fd = buildFD(name);
  if(!fd){ check(false, `${name}: builds`); continue; }
  const walled = new Group({ s: fd.s.map(side => side[0]), t: fd.t, walls: fd.s });
  const flat   = new Group({ s: fd.s.map(side => side[0]), t: fd.t });
  let outside = 0, wrongMap = 0, differs = 0;
  for(let i = 0; i < SAMPLES; i++){
    const p   = randomPoint();
    const res = walled.toFundDomain({ pnt: p, maxIterations: 60 });
    if(!res.inDomain || !inWalledDomain(fd, res.pnt)) outside++;
    const q = res.transform.transform(p);
    if(Math.hypot(q.v[0] - res.pnt.v[0], q.v[1] - res.pnt.v[1]) > 1e-9) wrongMap++;
    if(flat.toFundDomain({ pnt: p, maxIterations: 60 }).word !== res.word) differs++;
  }
  check(outside  === 0, `${name}: ${outside}/${SAMPLES} points did not land in the walled domain`);
  check(wrongMap === 0, `${name}: ${wrongMap}/${SAMPLES} words did not carry the point to its image`);
  if(CONVEX.includes(name))
    check(differs === 0, `${name}: convex domain, but ${differs}/${SAMPLES} words changed`);
  else
    check(differs  >  0, `${name}: bounded sides, but no word ever changed - the test is not biting`);
  console.log(`  ${name.padEnd(8)} landed ${SAMPLES - outside}/${SAMPLES}, words changed by the bounds: ${differs}/${SAMPLES}`);
}

console.log('');
if(failures) { console.log(`${failures} CHECKS FAILED`); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
