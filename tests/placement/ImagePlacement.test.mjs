//
//  Unit tests for lib/symhublib/ImagePlacement.js — the geometry behind
//  geometric image placement in sympix_orbifold.
//
//      node tests/placement/ImagePlacement.test.mjs
//
//  Everything is checked at all three curvatures and against several pattern
//  transforms, including the one apps/sympix/presets/orbifold/basic_default.json
//  actually ships, because a non-identity pattern transform is the case that
//  makes the frame conversion matter.
//
const BASE = new URL('../../', import.meta.url).href;
const { makePlacement } = await import(BASE + 'lib/symhublib/ImagePlacement.js');
const { iDistanceU4 } = await import(BASE + 'lib/invlib/Inversive.js');
const { iPoint } = await import(BASE + 'lib/invlib/ISplane.js');

let fails = 0, n = 0;
function ok(name, cond, extra='') { n++; if (!cond) { fails++; console.log('  FAIL', name, extra); } }
const near  = (a,b,e=1e-7)=>Math.abs(a-b)<e;
const nearP = (a,b,e=1e-7)=>near(a[0],b[0],e)&&near(a[1],b[1],e);
const angEq = (a,b,e=1e-4)=>near(((a-b+540)%360)-180, 0, e);

const FRAMES = [
  { name: 'identity', pt: null },
  // the pattern transform apps/sympix/presets/orbifold/basic_default.json ships
  { name: 'basic_default', pt: {centerX:0.1845210803690055, centerY:0.08448690826770239,
                               scale:0.4353527351323828, angle:-14.438233210205558} },
  { name: 'rotate only', pt: {centerX:0, centerY:0, scale:1, angle:40} },
];

for (const k of [-1, 0, 1]) {
for (const F of FRAMES) {
  const P = makePlacement({ curvature: k, patternTransform: F.pt });
  const tag = `k=${k} frame=${F.name}`;

  // 1. readBack(buildTWorld(cfg)) == cfg  (centre and angle round-trip)
  for (const cfg of [
      {centerX:0, centerY:0, angle:0}, {centerX:0, centerY:0, angle:37},
      {centerX:0.3, centerY:-0.2, angle:0}, {centerX:0.3, centerY:-0.2, angle:110},
      {centerX:-0.55, centerY:0.4, angle:-73},
  ]) {
    const rb = P.readBack(P.buildTWorld(cfg));
    ok(`${tag} readBack ${JSON.stringify(cfg)}`,
       nearP([rb.centerX,rb.centerY],[cfg.centerX,cfg.centerY],1e-6) && angEq(rb.angle,cfg.angle),
       JSON.stringify(rb));
  }

  // 2. centre maps where it should
  {
    const cfg = {centerX:0.25, centerY:0.1, angle:45};
    ok(`${tag} centre`, nearP(P.toPattern(P.centerWorld(P.buildTWorld(cfg))),
                              [cfg.centerX,cfg.centerY], 1e-9));
  }

  // 3. drag invariant: the grabbed point stays under the cursor
  {
    const cfg = {centerX:0.2, centerY:0.05, angle:20, scale:0.35};
    const T0 = P.buildTWorld(cfg);
    const pdown = P.toPattern(P.cornersWorld(T0, cfg.scale)[0]);   // a corner: well off-centre
    const q = P.pullBack(T0, pdown);
    for (const target of [[0.3,0.2],[-0.4,0.15],[0.05,-0.6],[0.5,0.5]]) {
      const p = P.clampToModel(target);
      const T1 = P.dragTo(T0, pdown, p);
      const landed = P.toPattern(P.toWorld(p));
      // Tw(q) should be the world image of p
      const got = P.toPattern(
          (await import(BASE+'lib/invlib/Inversive.js')).iTransformU4(T1,
              iPoint(q)).v.slice(0,2));
      ok(`${tag} dragTo pins the grabbed point -> ${target}`, nearP(got, p, 1e-9),
         JSON.stringify({got, p}));
      // and what we store rebuilds the same transform
      const rb = P.readBack(T1);
      const T2 = P.buildTWorld(rb);
      const got2 = P.toPattern(
          (await import(BASE+'lib/invlib/Inversive.js')).iTransformU4(T2,
              iPoint(q)).v.slice(0,2));
      ok(`${tag}   round-trips through buildTWorld`, nearP(got2, p, 1e-6), JSON.stringify(got2));
    }
  }

  // 4. containsPoint vs corners
  {
    const cfg = {centerX:0.15, centerY:-0.3, angle:15}, s = 0.3;
    const T = P.buildTWorld(cfg);
    ok(`${tag} centre inside`, P.containsPoint(T, s, P.toPattern(P.centerWorld(T))));
    ok(`${tag} corners on the boundary`,
       P.cornersPattern(T, s).every(c => P.containsPoint(T, s*1.0001, c)));
  }

  // 5. box splanes: interior negative at the centre, positive well outside
  {
    const cfg = {centerX:0.15, centerY:-0.3, angle:15}, s = 0.3;
    const T = P.buildTWorld(cfg);
    const sps = P.boxSplanesWorld(T, s);
    const c = P.centerWorld(T);
    ok(`${tag} splanes negative at centre`, sps.every(sp => iDistanceU4(sp, iPoint(c)) < 0),
       sps.map(sp=>iDistanceU4(sp,iPoint(c)).toFixed(4)).join(' '));
    const far = P.cornersWorld(T, s*3)[1];
    ok(`${tag} splanes positive outside`,
       Math.max(...sps.map(sp => iDistanceU4(sp, iPoint(far)))) > 0);
  }

  // 6. turnTo inverts
  {
    const cfg = {centerX:0.2, centerY:0.1, angle:33}, s = 0.28;
    const T = P.buildTWorld(cfg);
    const cs = P.cornersPattern(T, s);
    for (let i = 0; i < 4; i++) {
      const r = P.turnTo(T, cs[i], i);
      ok(`${tag} turnTo corner ${i}`, angEq(r.angle, cfg.angle) && near(r.scale, s, 1e-6),
         JSON.stringify(r));
    }
  }

  // 7. the shader word: image coords -> pattern, and it fits in 4 reflections
  {
    const cfg = {centerX:0.2, centerY:-0.1, angle:25, scale:0.3};
    const T  = P.buildT(cfg);
    const Tw = P.buildTWorld(cfg);
    const { iTransformU4 } = await import(BASE+'lib/invlib/Inversive.js');
    const probe = [0.1, 0.05];
    const viaT  = iTransformU4(T,  iPoint(probe)).v.slice(0,2);
    const viaTw = P.toPattern(iTransformU4(Tw, iPoint(probe)).v.slice(0,2));
    ok(`${tag} buildT == buildTWorld then toPattern`, nearP(viaT, viaTw, 1e-9),
       JSON.stringify({viaT, viaTw}));
    ok(`${tag} buildT fits in 4 reflections (got ${T.length})`, T.length <= 4);
  }
}
}

// ── the shader's mask is the same function as the CPU's hit test ─────────────
//
//  renderImage.glsl samples a buffer point by running buildT()'s reflections in
//  REVERSE order — which is T^-1 — and then testing
//      max(|q.x|, |q.y|) <= worldScale      (as max(|tc|) <= 0.5, tc = q * uImageHalf)
//  while the drag handler and the overlay test containsPoint(). If those two
//  ever disagree the drawn image and its outline/hit region come apart, which is
//  the failure a pixel test would be looking for. Here they are compared
//  directly, over a grid, with no texture colours to confound it.
{
  const { iInverseTransformU4 } = await import(BASE + 'lib/invlib/Inversive.js');
  const { iPoint: mkPoint }     = await import(BASE + 'lib/invlib/ISplane.js');

  for (const k of [-1, 0, 1]) {
    for (const F of FRAMES) {
      const P = makePlacement({ curvature: k, patternTransform: F.pt });
      const tag = `k=${k} frame=${F.name}`;
      for (const cfg of [
          {centerX:0.2,  centerY:-0.1, angle:25,  scale:0.30},
          {centerX:-0.4, centerY:0.3,  angle:-70, scale:0.55},
          {centerX:0,    centerY:0,    angle:0,   scale:0.4},
      ]) {
        const T  = P.buildT(cfg);              // image coords -> pattern, as packed
        const w  = P.worldScale(cfg.scale);    // half-side, and 0.5/w is uImageHalf
        const TW = P.buildTWorld(cfg);
        let disagree = 0, inside = 0, total = 0;
        for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
          const p = [i / 12 * 0.9, j / 12 * 0.9];
          // what the shader does: reflections of T in reverse order, then the box test
          const q = iInverseTransformU4(T, mkPoint(p)).v;
          const shaderSaysInside = Math.max(Math.abs(q[0]), Math.abs(q[1])) <= w;
          const cpuSaysInside    = P.containsPoint(TW, cfg.scale, p);
          total++;
          if (shaderSaysInside) inside++;
          if (shaderSaysInside !== cpuSaysInside) disagree++;
        }
        ok(`${tag} shader mask == containsPoint ${JSON.stringify(cfg)}`,
           disagree === 0, `${disagree}/${total} disagreed`);
        // a mask that is empty or covers everything would pass the above vacuously
        ok(`${tag}   mask is a real region ${JSON.stringify(cfg)}`,
           inside > 0 && inside < total, `${inside}/${total} inside`);
      }
    }
  }
}

console.log(fails ? `\n${fails}/${n} FAILED` : `\nall ${n} checks passed`);
process.exit(fails?1:0);
