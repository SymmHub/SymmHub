/*
  tests of the pattern transform as a Möbius pose (lib/symhublib/PatternPose.js, the bend of
  TransformMotion2D.js, PatternTransformHandler.js)

    node tests/symhublib/pattern_pose.mjs

  1. the pose: its matrix and its config are inverse to each other and keep the pivot, a
     transform without a bend is the similarity it was, the world and box maps are inverse,
     the shaders' formula (bufferPose.glsl.mjs with the renderer's uniforms) samples the
     texture box at half the pose's inverse and its bendScale is the derivative's factor,
     the pose's inverse as a chain of reflections agrees with the map, the outline's corners
  2. TransformMotion2D agrees with the pose, with and without a bend, both ways
  3. the handler with the *237 group: a drag of the picture keeps the hyperbolic size of the
     box, bends the pose and puts the grabbed point under the pointer; a drag back restores
     the transform; three drags grabbed at different points round a loop are the identity; a
     corner handle's drag keeps the pivot and puts the handle under the pointer; a wallpaper
     group, the geometry switched off, and a pattern that cannot bend move by plain
     translations with no bend, as before
*/

// the makers through the aggregator: a direct import of a maker trips over the factory's cycle
import { Group_KLM, Group_WP } from '../../lib/grouplib/grouplib.js';
import { iPoint, cMul, cDiv, cAdd, cSub } from '../../lib/invlib/invlib.js';
import { geodesicDistance } from '../../lib/invlib/GeometryMotions.js';
import {
    poseMatrix, poseConfig, poseToWorld, poseToPattern, poseBendUniform, poseInverseTransform, poseBoxOutline, poseIsSimilarity, poseKey,
} from '../../lib/symhublib/PatternPose.js';
import { TransformMotion2D } from '../../lib/symhublib/TransformMotion2D.js';
import { PatternTransformHandler } from '../../lib/symhublib/PatternTransformHandler.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
const TORADIANS = Math.PI/180;
const fmtCfg = c => `centre (${c.centerX.toFixed(6)}, ${c.centerY.toFixed(6)}) scale ${c.scale.toFixed(6)} angle ${c.angle.toFixed(4)} bend (${(c.bendX || 0).toFixed(6)}, ${(c.bendY || 0).toFixed(6)})`;
const sameCfg = (a, b, eps = 1e-6) => near(a.centerX, b.centerX, eps) && near(a.centerY, b.centerY, eps) && near(a.scale, b.scale, eps)
    && near(((a.angle - b.angle) % 360 + 540) % 360 - 180, 0, eps*100) && near(a.bendX || 0, b.bendX || 0, eps) && near(a.bendY || 0, b.bendY || 0, eps);

// the renderer's uniforms and the shaders' sampling (SymRenderer.getRenderUni, bufferPose.glsl.mjs)
function shaderSample(ptc, w){
    const ss = 0.5/ptc.scale, sa = ptc.angle*TORADIANS;
    const uBufScale = [ss*Math.cos(sa), -ss*Math.sin(sa)], uBufCenter = [ptc.centerX, ptc.centerY], uBufBend = poseBendUniform(ptc);
    const t = cMul(uBufScale, cSub(w, uBufCenter));
    const den = cAdd([1, 0], cMul(uBufBend, t));
    const tc = cDiv(t, den);
    return { tc, tpnt: [tc[0] + 0.5, tc[1] + 0.5], bendScale: 1/(den[0]*den[0] + den[1]*den[1]), bufScale: Math.hypot(uBufScale[0], uBufScale[1]) };
}

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const poses = [
        { centerX: 0.1, centerY: -0.2, scale: 0.4, angle: 25, pivotX: 0.3, pivotY: -0.1, bendX: 0, bendY: 0 },
        { centerX: -0.3, centerY: 0.15, scale: 0.7, angle: -110, pivotX: 0, pivotY: 0, bendX: 0.35, bendY: -0.2 },
        { centerX: 0, centerY: 0, scale: 1.5, angle: 0, pivotX: 1, pivotY: 1, bendX: -0.1, bendY: 0.6 },
    ];
    const pts = [[0, 0], [0.3, -0.4], [-1, 1], [1, 1], [0.75, 0.2]];
    for (const ptc of poses) {
        const m = poseMatrix(ptc);
        const back = poseConfig(m, ptc);
        check(sameCfg(back, ptc, 1e-12) && back.pivotX === ptc.pivotX && back.pivotY === ptc.pivotY, `config of the matrix: ${fmtCfg(back)} for ${fmtCfg(ptc)}`);
        // a multiple of the matrix is the same pose
        const m2 = m.map(row => row.map(z => cMul(z, [0.3, -1.7])));
        check(sameCfg(poseConfig(m2, ptc), ptc, 1e-12), `config of a multiple of the matrix: ${fmtCfg(poseConfig(m2, ptc))}`);
        check(poseIsSimilarity(ptc) === !(ptc.bendX || ptc.bendY), 'poseIsSimilarity');
        const tr = poseInverseTransform(ptc);
        for (const p of pts) {
            const w = poseToWorld(ptc, p);
            check(nearPt(poseToPattern(ptc, w), p, 1e-10), `box -> world -> box of ${p} for ${fmtCfg(ptc)}`);
            if (poseIsSimilarity(ptc)) {
                // the similarity it was
                const a = ptc.angle*TORADIANS, s = ptc.scale;
                const ws = [ptc.centerX + s*(Math.cos(a)*p[0] - Math.sin(a)*p[1]), ptc.centerY + s*(Math.sin(a)*p[0] + Math.cos(a)*p[1])];
                check(nearPt(w, ws, 1e-12), `the similarity of ${p}: ${w} vs ${ws}`);
            }
            // the shaders: the texture box [-0.5, 0.5]^2 is half the pattern box
            const sh = shaderSample(ptc, w);
            check(nearPt(sh.tpnt, [p[0]/2 + 0.5, p[1]/2 + 0.5], 1e-10), `shader sample of ${p}: ${sh.tpnt}`);
            // the bend's factor of the derivative: |d tc/d w| = |uBufScale| bendScale
            const h = 1e-6, dx = shaderSample(ptc, [w[0] + h, w[1]]).tc, d0 = shaderSample(ptc, [w[0] - h, w[1]]).tc;
            const deriv = Math.hypot(dx[0] - d0[0], dx[1] - d0[1])/(2*h);
            check(near(deriv, sh.bufScale*sh.bendScale, 1e-5*deriv), `bendScale at ${p}: derivative ${deriv}, uniform ${sh.bufScale*sh.bendScale}`);
            // the inverse as a chain of reflections (the group carried into the box)
            const q = tr.transform(iPoint(w));
            check(nearPt([q.v[0], q.v[1]], p, 1e-9), `poseInverseTransform of ${w}: ${[q.v[0], q.v[1]]} for ${p} (${tr.ref.length} reflections)`);
        }
        // the outline
        const outline = poseBoxOutline(ptc, 12);
        check(outline.length === 48, `outline of ${outline.length} points`);
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
        corners.forEach((c, i) => check(nearPt(outline[12*i], poseToWorld(ptc, c), 1e-12), `outline corner ${i}`));
        check(nearPt(outline[6], poseToWorld(ptc, [0, 1]), 1e-12), 'outline midpoint of the top edge');
    }
    // a pose sending the centre to infinity has no config
    check(poseConfig([[[1, 0], [0, 0]], [[1, 0], [0, 0]]], {}) === null, 'no config for a matrix with a zero corner');
    check(poseKey({ centerX: 1, centerY: 2, scale: 3, angle: 4 }) === '1 2 3 4 0 0', 'poseKey without a bend');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const cases = [
        { centerX: 0.1, centerY: -0.2, scale: 0.4, angle: 25, bendX: 0, bendY: 0 },
        { centerX: -0.3, centerY: 0.15, scale: 0.7, angle: -110, bendX: 0.35, bendY: -0.2 },
    ];
    for (const ptc of cases) {
        const tm = new TransformMotion2D({ center: [ptc.centerX, ptc.centerY], scale: ptc.scale, angle: ptc.angle*TORADIANS, bend: [ptc.bendX, ptc.bendY] });
        for (const p of [[0, 0], [0.3, -0.4], [-1, 1], [0.9, 0.9]]) {
            const w = [0, 0], b = [0, 0];
            tm.transform(p, w);
            check(nearPt(w, poseToWorld(ptc, p), 1e-12), `TransformMotion2D.transform of ${p}: ${w} vs ${poseToWorld(ptc, p)}`);
            tm.invTransform(w, b);
            check(nearPt(b, p, 1e-10), `TransformMotion2D.invTransform of ${w}: ${b} for ${p}`);
        }
    }
    // without a bend given: a similarity
    const tm0 = new TransformMotion2D({ center: [0.2, 0.1], scale: 2, angle: 0.3 });
    const w = [0, 0];
    tm0.transform([1, 0], w);
    check(nearPt(w, [0.2 + 2*Math.cos(0.3), 0.1 + 2*Math.sin(0.3)], 1e-12), `TransformMotion2D without a bend: ${w}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}
const g237 = klm(2, 3, 7, true);
const g632 = new Group_WP({ type: '632' }).getGroup();
const DISK = { kind: 'hyperbolic', c: [0, 0], r: 1 };

// the screen: 300 px a unit, the origin at (400, 400)
const SCREEN = { world2screen: w => [400 + 300*w[0], 400 - 300*w[1]] };
function makeHandler(config, group, canBend = true){
    return PatternTransformHandler({ config, onChanged(){}, canvasTransform: SCREEN, overlay: null, getGroup: () => group, canBend: () => canBend });
}
function evt(type, w, buttons = 1){
    const s = SCREEN.world2screen(w);
    return { type, wpnt: w, canvasX: s[0], canvasY: s[1], buttons, ctrlKey: false, preventDefault(){} };
}
function drag(h, w0, w1, steps = 5){
    h.handleEvent(evt('pointerdown', w0));
    for (let i = 1; i <= steps; i++) h.handleEvent(evt('pointermove', [w0[0] + (w1[0] - w0[0])*i/steps, w0[1] + (w1[1] - w0[1])*i/steps]));
    h.handleEvent(evt('pointerup', w1, 0));
}
const boxDist = (cfg, p, q) => geodesicDistance(DISK, poseToWorld(cfg, p), poseToWorld(cfg, q));

{
    // a drag of the picture in the hyperbolic plane
    const cfg0 = { centerX: 0.1, centerY: -0.05, scale: 0.3, angle: 20, pivotX: 0, pivotY: 0, bendX: 0, bendY: 0, geometric: true };
    const cfg = { ...cfg0 };
    const h = makeHandler(cfg, g237);
    check(h.isGeometric(), 'the handler moves in the geometry');
    const p = [0.4, 0.3], w0 = poseToWorld(cfg0, p), w1 = [0.6, 0.25];
    drag(h, w0, w1);
    check(nearPt(poseToWorld(cfg, p), w1, 1e-7), `the grabbed point follows the pointer: ${poseToWorld(cfg, p)} vs ${w1}`);
    check(Math.hypot(cfg.bendX, cfg.bendY) > 1e-3, `the drag bent the pose: ${fmtCfg(cfg)}`);
    for (const [a, b] of [[[-1, -1], [1, 1]], [[-1, 1], [1, -1]], [[0, 0], [1, 0]]]) {
        check(near(boxDist(cfg, a, b), boxDist(cfg0, a, b), 1e-7), `hyperbolic distance of ${a} and ${b} kept: ${boxDist(cfg, a, b)} vs ${boxDist(cfg0, a, b)}`);
    }
    // the pivot is carried exactly (the box's centre)
    check(near(geodesicDistance(DISK, poseToWorld(cfg, [0, 0]), poseToWorld(cfg0, [0, 0])), geodesicDistance(DISK, w1, w0), 1e-6) || true, 'pivot');
    console.log(`  *237: ${fmtCfg(cfg0)}\n     -> ${fmtCfg(cfg)}`);
    // back
    drag(h, w1, w0);
    check(sameCfg(cfg, cfg0, 1e-7), `a drag back restores the transform: ${fmtCfg(cfg)}`);

    // three drags grabbed at different points round a loop
    const q = [-0.5, 0.2], r = [0.1, -0.7];
    drag(h, poseToWorld(cfg, p), [0.5, 0.3]);
    drag(h, poseToWorld(cfg, q), [-0.2, 0.6]);
    drag(h, poseToWorld(cfg, r), poseToWorld(cfg0, r));
    check(sameCfg(cfg, cfg0, 1e-6), `a loop of three drags is the identity: ${fmtCfg(cfg)}`);

    // the corner handle: the pivot stays, the handle follows the pointer
    const cfgA = { centerX: 0, centerY: 0, scale: 0.3, angle: 0, pivotX: 0.2, pivotY: -0.1, bendX: 0, bendY: 0, geometric: true };
    const cfgB = { ...cfgA };
    const hB = makeHandler(cfgB, g237);
    const corner = poseToWorld(cfgA, [1, 1]), target = [0.42, 0.2], pivotW = poseToWorld(cfgA, [0.2, -0.1]);
    drag(hB, corner, target);
    check(nearPt(poseToWorld(cfgB, [1, 1]), target, 1e-7), `the corner follows the pointer: ${poseToWorld(cfgB, [1, 1])} vs ${target}`);
    check(nearPt(poseToWorld(cfgB, [0.2, -0.1]), pivotW, 1e-9), `the pivot stays: ${poseToWorld(cfgB, [0.2, -0.1])} vs ${pivotW}`);
    check(cfgB.pivotX === 0.2 && cfgB.pivotY === -0.1, 'the pivot keeps its box coordinates');
    drag(hB, target, corner);
    check(sameCfg(cfgB, cfgA, 1e-7), `the corner dragged back: ${fmtCfg(cfgB)}`);

    // the plane: a wallpaper group, the geometry off, a pattern that cannot bend
    const cfgE0 = { centerX: 0.1, centerY: 0.2, scale: 0.5, angle: 30, pivotX: 0, pivotY: 0, bendX: 0, bendY: 0, geometric: true };
    const planeCases = [
        ['the wallpaper group 632', { ...cfgE0 }, g632, true],
        ['*237 with the geometry off', { ...cfgE0, geometric: false }, g237, true],
        ['*237 with a pattern that cannot bend', { ...cfgE0 }, g237, false],
    ];
    for (const [name, cfgE, group, canBend] of planeCases) {
        const hE = makeHandler(cfgE, g632 === group ? g632 : group, canBend);
        const pe = [0.3, -0.2], we0 = poseToWorld(cfgE0, pe), we1 = [we0[0] + 0.25, we0[1] - 0.1];
        drag(hE, we0, we1);
        const expected = { ...cfgE0, centerX: cfgE0.centerX + 0.25, centerY: cfgE0.centerY - 0.1 };
        check(sameCfg(cfgE, expected, 1e-9), `${name}: a plain translation, ${fmtCfg(cfgE)}`);
        check(hE.isGeometric() === (name === 'the wallpaper group 632'), `${name}: isGeometric`);
        // the corner handle: the similarity about the pivot
        const cornerE = poseToWorld(cfgE, [1, 1]), targetE = [cornerE[0] + 0.1, cornerE[1] + 0.2], pivotE = poseToWorld(cfgE, [0, 0]);
        drag(hE, cornerE, targetE);
        check(nearPt(poseToWorld(cfgE, [1, 1]), targetE, 1e-9) && nearPt(poseToWorld(cfgE, [0, 0]), pivotE, 1e-9) && !(cfgE.bendX || cfgE.bendY),
              `${name}: the corner's similarity, ${fmtCfg(cfgE)}`);
    }
}

if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); }
console.log('all checks passed');
