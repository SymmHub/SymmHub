/*
  tests of the view's chain of maps on the CPU (lib/symhublib/ViewChain.js and the kinds
  of its steps, lib/symhublib/conformal/ConformalKinds.js), the map from a canvas point
  to the world point the shaders show there (lib/shaders/projection_v2.glsl.mjs
  makeProjection)

    node tests/symhublib/view_chain.mjs

  1. the kinds one by one against their formulas: a circle inversion as a moebius step,
     the rational map (z^2 - 1)/(z^2 + 1) of the default points, an exponent 2, an
     exponent cut to a whole number and one out of range as the shader has them, the
     upper half plane, the exponent's logarithm, the loxodromic map, the scale with its
     shift, the periodic wrap (a skew lattice too, about a centre), the band with its
     fraction; a chain of more than four mirrors is several moebius steps
  2. the chain: the identity without steps, the steps in the order given (the upper half
     plane before the logarithm), the sphere and the navigation's mirrors before them,
     exact false off the sphere and at infinity, the local magnification of the logarithm
     and of the band, the mirrors of a chain of Moebius maps alone
  3. the uniforms' arrays of a chain (packViewChain): the codes and offsets, the numbers
     in their places, the limits of steps and of numbers
  4. the direct forms of the kinds, the world's side to the screen's: on random points
     direct(reverse(z), near z) = z and reverse(direct(w)) = w for every kind; the kinds
     with many values take the value nearest to near (the band's strips, the periodic
     wrap's cells, the rational map's roots) and their principal one without it; the
     roots of a rational map, each as often as it counts
  5. the chain the other way (viewChainToScreen): a point sent to the world comes back to
     itself with the seed on it, and with the seed a little off; the sphere's front has a
     place and its back none; a seed on another copy gives that copy's place; a place
     that does not show its point says so (the exponent's other sheets, a point outside
     the periodic wrap's cell); no place at a map's infinity; the seed's path
*/

import { iSphere, iPlane } from '../../lib/invlib/invlib.js';
import { viewChainToWorld, viewChainToScreen, viewChainPath, viewChainHasSheets, viewChainScale, viewChainIsIdentity, viewChainMirrors } from '../../lib/symhublib/ViewChain.js';
import { CONFORMAL_KINDS as K, moebiusSteps, rationalStep, scaleStep, periodicStep, bandStep, plainStep, powerStep, packViewChain, viewChainRoom, rationalRoots,
         VIEW_CHAIN_MAX_STEPS, VIEW_CHAIN_DATA_SIZE } from '../../lib/symhublib/conformal/ConformalKinds.js';

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
const fmt = p => '(' + p.map(x => x.toFixed(6)).join(', ') + ')';
const run = (step, z) => K[step.kind].reverse(step, z);

// 1 ───────────────────────────────────────────────────────────────────────────

{
    // a circle inversion: c + r^2 (p - c)/|p - c|^2
    const c = [0.5, 0], r = 1, p = [1.2, 0.3];
    const d = [p[0] - c[0], p[1] - c[1]], f = r*r/(d[0]*d[0] + d[1]*d[1]);
    const one = moebiusSteps([iSphere([c[0], c[1], 0, r])]);
    check(one.length === 1 && one[0].kind === 'moebius' && one[0].data.length === 32, 'a mirror: one moebius step of 8 vec4s');
    check(nearPt(run(one[0], p), [c[0] + d[0]*f, c[1] + d[1]*f], 1e-9), `a moebius step of one inversion: ${fmt(run(one[0], p))}`);
    // the same from the numbers alone, as the shader has them
    check(nearPt(run({ kind: 'moebius', data: one[0].data }, p), run(one[0], p), 1e-12), 'the mirrors read back from the numbers');
    // a line: the reflection in x = 0.25
    const line = moebiusSteps([iPlane([1, 0, 0, 0.25])]);
    check(nearPt(run(line[0], [1, 0.4]), [-0.5, 0.4], 1e-12), `a moebius step of one line: ${fmt(run(line[0], [1, 0.4]))}`);
    // six mirrors: two steps, the same map as the six in a row
    const six = [iSphere([0.5, 0, 0, 1]), iPlane([1, 0, 0, 0.25]), iSphere([-0.3, 0.2, 0, 0.7]), iPlane([0.6, 0.8, 0, 0.1]), iSphere([0, 1.5, 0, 1.2]), iPlane([0, 1, 0, -0.3])];
    const two = moebiusSteps(six);
    let q = p; for (const st of two) q = run(st, q);
    let q1 = p; for (const m of six) q1 = run(moebiusSteps([m])[0], q1);
    check(two.length === 2 && nearPt(q, q1, 1e-10), `six mirrors: two steps, the same point ${fmt(q)}`);
    check(moebiusSteps([]).length === 0 && moebiusSteps(null).length === 0, 'no mirrors: no step');

    // the rational map of the default points: (z - 1)(z + 1)/((z - i)(z + i))
    const rat = rationalStep([[1, 0, 1], [0, 1, -1], [-1, 0, 1], [0, -1, -1]]);
    check(rat.data[0] === 4 && rat.data.length === 20, 'the rational step: its count, then a vec4 a point');
    check(nearPt(run(rat, [0, 0]), [-1, 0]) && nearPt(run(rat, [2, 0]), [0.6, 0]), 'the rational map: 0 -> -1, 2 -> 0.6');
    const sq = run(rationalStep([[0, 0, 2]]), [1, 1]);
    check(nearPt(sq, [0, 2]), `an exponent 2: (1 + i)^2 = 2i, got ${fmt(sq)}`);
    // as the shader's int() and switch: 2.9 is 2, -1.5 is -1, 0.7 and 5 take no part
    check(nearPt(run(rationalStep([[0, 0, 2.9]]), [1, 1]), [0, 2]), 'an exponent 2.9 is 2');
    check(nearPt(run(rationalStep([[0, 0, -1.5]]), [0, 2]), [0, -0.5]), 'an exponent -1.5 is -1');
    check(nearPt(run(rationalStep([[0, 0, 0.7], [0.5, 0, 5]]), [0.3, 0.2]), [1, 0]), 'exponents 0.7 and 5 take no part');

    check(nearPt(run(plainStep('uhp'), [0, 1]), [0, 0]) && nearPt(run(plainStep('uhp'), [1, 0]), [0, 1]), 'the upper half plane: i -> 0, 1 -> i');
    check(nearPt(run(plainStep('exp'), [Math.E, 0]), [1, 0]) && nearPt(run(plainStep('exp'), [0, 1]), [0, Math.PI/2]), 'the exponent: the logarithm of the point');
    // loxodromic: (0, 0) -> inversion about (-1, 0), radius 2 -> (3, 0) -> shift -> (2, 0) -> log 2
    check(nearPt(run(plainStep('lox'), [0, 0]), [Math.log(2), 0]), `the loxodromic map: 0 -> ln 2, got ${fmt(run(plainStep('lox'), [0, 0]))}`);
    check(nearPt(run(scaleStep([0, 2], [1, 0]), [2, 0.5]), [-1, 2]), 'the scale: (2 + i/2 - 1) 2i = -1 + 2i');

    const unit = periodicStep([1, 0], [0, 1], [0, 0]);
    check(nearPt(run(unit, [1.3, -0.4]), [0.3, -0.4], 1e-12), `the periodic wrap of the unit lattice: ${fmt(run(unit, [1.3, -0.4]))}`);
    // a skew lattice about a centre: the point less the centre, less a lattice vector, in the cell about 0
    const a1 = [1, 0.2], a2 = [0.3, 1.1], C = [0.4, -0.1];
    const skew = periodicStep(a1, a2, C);
    const z = [3.37, -2.21], w = run(skew, z);
    const det = a1[0]*a2[1] - a1[1]*a2[0];
    const back = [z[0] - C[0] - w[0], z[1] - C[1] - w[1]];
    const m = (back[0]*a2[1] - back[1]*a2[0])/det, n = (-back[0]*a1[1] + back[1]*a1[0])/det;
    const e1 = (w[0]*a2[1] - w[1]*a2[0])/det, e2 = (-w[0]*a1[1] + w[1]*a1[0])/det;
    check(near(m, Math.round(m), 1e-9) && near(n, Math.round(n), 1e-9), `the skew wrap takes a lattice vector off: ${m.toFixed(6)}, ${n.toFixed(6)}`);
    check(Math.abs(e1) <= 0.5 + 1e-12 && Math.abs(e2) <= 0.5 + 1e-12, 'and lands in the cell about 0');
    check(periodicStep([1, 2], [2, 4], [0, 0]) === null, 'vectors along one line: no lattice');

    check(nearPt(run(bandStep(1), [0, 1]), [0, 1], 1e-12) && nearPt(run(bandStep(1), [0, 0]), [0, 0]) && nearPt(run(bandStep(0), [0.3, 0.2]), [0.3, 0.2]),
          'the band: its edge i -> i, 0 -> 0, fraction 0 the identity');
    // tanh z = (e^{2z} - 1)/(e^{2z} + 1): the band of fraction 4/pi is tanh itself (a = 1, b = 1/tan 1)
    const t = run(bandStep(4/Math.PI), [0.3, 0.2]);
    const e2z = [Math.exp(0.6)*Math.cos(0.4), Math.exp(0.6)*Math.sin(0.4)];
    const num = [e2z[0] - 1, e2z[1]], den = [e2z[0] + 1, e2z[1]], dd = den[0]*den[0] + den[1]*den[1];
    const tanh = [(num[0]*den[0] + num[1]*den[1])/dd, (num[1]*den[0] - num[0]*den[1])/dd];
    check(nearPt(t, [tanh[0]/Math.tan(1), tanh[1]/Math.tan(1)], 1e-12), 'the band is b tanh(a z)');

    // the power z^n: (1 + i)^2 = 2i, (1 + i)^3 = -2 + 2i, i^(1/2) = (1 + i)/sqrt 2, 2^-1 = 1/2,
    // and (-4)^(1/2) = 2i on the logarithm's sheet with the angle pi
    check(powerStep(2).kind === 'power' && powerStep(2).data.join() === '2,0,0,0', 'the power step: its exponent in a vec4');
    check(nearPt(run(powerStep(2), [1, 1]), [0, 2], 1e-12) && nearPt(run(powerStep(3), [1, 1]), [-2, 2], 1e-12), 'the power: (1 + i)^2 = 2i, (1 + i)^3 = -2 + 2i');
    check(nearPt(run(powerStep(0.5), [0, 1]), [Math.SQRT1_2, Math.SQRT1_2], 1e-12) && nearPt(run(powerStep(-1), [2, 0]), [0.5, 0], 1e-12), 'an exponent 1/2 and -1');
    check(nearPt(run(powerStep(0.5), [-4, 0]), [0, 2], 1e-12) && nearPt(run(powerStep(1), [0.3, -0.7]), [0.3, -0.7], 1e-12), 'the square root of -4 is 2i; the exponent 1 the identity');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const none = { sphere: false, moebius: null, steps: [] };
    check(viewChainIsIdentity(none) && nearPt(viewChainToWorld(none, [0.3, -0.7]).pnt, [0.3, -0.7]) && viewChainToWorld(none, [0.3, -0.7]).exact, 'no steps: the identity, exact');
    check(viewChainIsIdentity({ sphere: false, moebius: null }), 'a chain without the list is the identity too');
    const both = { ...none, steps: [plainStep('uhp'), plainStep('exp')] };
    const r = viewChainToWorld(both, [1, 1]);
    check(nearPt(r.pnt, run(plainStep('exp'), run(plainStep('uhp'), [1, 1])), 1e-12) && !nearPt(r.pnt, run(plainStep('uhp'), run(plainStep('exp'), [1, 1])), 1e-6) && !viewChainIsIdentity(both),
          `the steps in their order, the upper half plane before the logarithm: ${fmt(r.pnt)}`);
    check(!viewChainToWorld({ ...none, sphere: true }, [0.8, 0.7]).exact && viewChainToWorld({ ...none, sphere: true }, [0.3, 0.1]).exact, 'exact: false off the sphere');
    check(nearPt(viewChainToWorld({ ...none, sphere: true }, [0.6, 0]).pnt, [1/3, 0]), 'the sphere: (0.6, 0) -> (1/3, 0)');
    check(!viewChainToWorld({ ...none, steps: [plainStep('exp')] }, [0, 0]).exact, 'exact: false where the logarithm is infinite');
    // the magnification: |d log z/dz| = 1/|z|; the band's at 0 is a b = pi/4
    const p = [0.5, 0.2];
    const sc = viewChainScale({ ...none, steps: [plainStep('exp')] }, p);
    check(near(sc, 1/Math.hypot(p[0], p[1]), 1e-6), `the scale of the logarithm at ${fmt(p)}: ${sc}`);
    check(near(viewChainScale({ ...none, steps: [bandStep(1)] }, [0, 0]), Math.PI/4, 1e-6), `the scale of the band at 0: ${viewChainScale({ ...none, steps: [bandStep(1)] }, [0, 0])}`);
    check(viewChainScale({ ...none, sphere: true }, [2, 0]) === 1, 'the scale off the sphere is 1');
    // the sphere, then the navigation's mirrors, then the steps: the band, then a moebius step
    const nav = [iSphere([2, 0, 0, Math.sqrt(3)])];
    const fixed = moebiusSteps([iSphere([0.5, 0, 0, 1])]);
    const chain = { sphere: true, moebius: nav, steps: [bandStep(1), ...fixed] };
    const z0 = [0.2, 0.1];
    const s1 = [z0[0]/(1 + Math.sqrt(1 - 0.05)), z0[1]/(1 + Math.sqrt(1 - 0.05))];
    const expect = run(fixed[0], run(bandStep(1), run(moebiusSteps(nav)[0], s1)));
    check(nearPt(viewChainToWorld(chain, z0).pnt, expect, 1e-12), 'the sphere, the navigation, then the steps in order');
    // the mirrors of a chain of Moebius maps alone
    const mm = viewChainMirrors({ sphere: false, moebius: nav, steps: fixed });
    check(mm && mm.length === 2 && mm[0] === nav[0] && mm[1] === fixed[0].mirrors[0], 'the mirrors of the navigation and of the moebius steps, in order');
    check(viewChainMirrors({ sphere: false, moebius: null, steps: [] }).length === 0, 'no mirrors for the identity');
    check(viewChainMirrors(chain) === null && viewChainMirrors({ sphere: false, moebius: nav, steps: [bandStep(1)] }) === null, 'no mirrors with the sphere or a step of another kind');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const steps = [rationalStep([[1, 0, 1], [0, 1, -1]]), plainStep('exp'), scaleStep([0.5, -2], [0.25, 1]), bandStep(0.75)];
    const u = packViewChain(steps);
    check(u.count === 4 && u.dropped === 0, 'four steps packed');
    check(u.steps instanceof Int32Array && u.steps.length === 2*VIEW_CHAIN_MAX_STEPS && u.data instanceof Float32Array && u.data.length === 4*VIEW_CHAIN_DATA_SIZE, 'the arrays of the uniforms');
    check([...u.steps.slice(0, 8)].join() === [K.rational.code, 0, K.exp.code, 3, K.scale.code, 3, K.band.code, 4].join(), `the codes and offsets: ${[...u.steps.slice(0, 8)]}`);
    check(u.data[0] === 2 && u.data[4] === 1 && u.data[6] === 1 && u.data[9] === 1 && u.data[10] === -1, 'the rational step\'s numbers');
    check(u.data[12] === 0.25 && u.data[13] === 1 && u.data[14] === 0.5 && u.data[15] === -2 && u.data[16] === 0.75, 'the scale\'s and the band\'s numbers after them');
    check(viewChainRoom(steps).steps === 4 && viewChainRoom(steps).data === 5, 'the room of the chain: 4 steps, 5 vec4s');
    check(packViewChain([]).count === 0 && packViewChain(null).count === 0, 'no steps');
    // the codes are those of the shader's defines
    check([K.moebius.code, K.rational.code, K.uhp.code, K.exp.code, K.lox.code, K.scale.code, K.periodic.code, K.band.code, K.power.code].join() === '1,2,3,4,5,6,7,8,9', 'the codes of the kinds');
    const up = packViewChain([powerStep(2.5), plainStep('exp')]);
    check(up.count === 2 && up.steps[0] === 9 && up.steps[1] === 0 && up.data[0] === 2.5 && up.steps[2] === K.exp.code, 'a power step packed: its code and its exponent');
    // the limits: more steps than the loop has, more numbers than the array holds
    const many = Array.from({ length: VIEW_CHAIN_MAX_STEPS + 3 }, () => plainStep('exp'));
    const um = packViewChain(many);
    check(um.count === VIEW_CHAIN_MAX_STEPS && um.dropped === 3, 'steps past the limit are dropped from the end');
    const mirrors = moebiusSteps([iSphere([0.5, 0, 0, 1])]);          // 8 vec4s a step
    const wide = Array.from({ length: 9 }, () => mirrors[0]);
    const uw = packViewChain(wide);
    check(uw.count === 8 && uw.dropped === 1 && uw.steps[15] === 56, `numbers past the limit: ${uw.count} steps kept`);
}

// 4 ───────────────────────────────────────────────────────────────────────────

function rnd(seed){ let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s/4294967296; }; }
const fin = (z) => !!z && Number.isFinite(z[0]) && Number.isFinite(z[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const back = (step, w, near) => K[step.kind].direct(step, w, near);

{
    const r = rnd(7);
    const DEFAULT = [[1, 0, 1], [0, 1, -1], [-1, 0, 1], [0, -1, -1]];
    const cases = [
        ['moebius', moebiusSteps([iSphere([0.5, 0.2, 0, 1.3]), iPlane([0.6, 0.8, 0, 0.1]), iSphere([-1.5, 0.3, 0, 0.7])])[0], 1e-11],
        ['moebius from its numbers', { kind: 'moebius', data: moebiusSteps([iSphere([0.5, 0.2, 0, 1.3]), iPlane([0.6, 0.8, 0, 0.1])])[0].data }, 1e-11],
        ['rational, the default points', rationalStep(DEFAULT), 1e-11],
        ['rational, exponents 3 -2 2 -3', rationalStep([[0.3, 0.1, 3], [0, 1, -2], [-1, 0.4, 2], [0.2, -1, -3]]), 1e-8],
        ['upper half plane', plainStep('uhp'), 1e-11],
        ['exponent', plainStep('exp'), 1e-12],
        ['loxodromic', plainStep('lox'), 1e-12],
        ['scale', scaleStep([0.3, -1.6], [0.7, 0.2]), 1e-12],
        ['periodic', periodicStep([1, 0.2], [0.3, 1.1], [0.2, -0.1]), 1e-12],
        ['band', bandStep(1), 1e-12],
        ['band of fraction 0.6', bandStep(0.6), 1e-12],
        ['band of fraction 0', bandStep(0), 1e-12],
        ['power 2', powerStep(2), 1e-12],
        ['power 3', powerStep(3), 1e-12],
        ['power -2', powerStep(-2), 1e-11],
        ['power 1/2', powerStep(0.5), 1e-12],
        ['power 2.5', powerStep(2.5), 1e-12],
    ];
    for (const [name, step, eps] of cases) {
        let worstA = 0, worstB = 0, n = 0;
        for (let i = 0; i < 2000; i++) {
            const z = [3*(r() - 0.5), 3*(r() - 0.5)];
            const w = run(step, z);
            if (!fin(w)) continue;
            const b = back(step, w, z);
            if (!fin(b)) continue;
            n++;
            worstA = Math.max(worstA, dist(b, z)/(1 + Math.hypot(z[0], z[1])));
            worstB = Math.max(worstB, dist(run(step, b), w)/(1 + Math.hypot(w[0], w[1])));
        }
        check(n > 1900 && worstA <= eps && worstB <= eps, `${name}: direct(reverse z) = z (${worstA.toExponential(1)}), reverse(direct w) = w (${worstB.toExponential(1)}), ${n} points`);
    }
    check(!K.moebius.many && !K.uhp.many && !K.exp.many && !K.lox.many && !K.scale.many && K.rational.many && K.periodic.many && K.band.many && K.power.many,
          'the kinds with many values the other way: the rational map, the periodic wrap, the band, the power');

    // the power: the roots of w, the one at the angle of near; the first without it
    const pw2 = powerStep(2), pw3 = powerStep(3);
    check(nearPt(back(pw2, [0, 2], null), [1, 1], 1e-12) && nearPt(back(pw2, [0, 2], [-0.8, -1.3]), [-1, -1], 1e-12) && nearPt(back(pw2, [0, 2], [0.9, 0.7]), [1, 1], 1e-12),
          `the square roots of 2i by near: ${fmt(back(pw2, [0, 2], null))}, ${fmt(back(pw2, [0, 2], [-0.8, -1.3]))}`);
    const third = 2*Math.PI/3;
    const cubes = [[0.1, 0], [Math.cos(third) + 0.1, Math.sin(third)], [Math.cos(-third), Math.sin(-third) - 0.1]].map(n => back(pw3, [8, 0], n));
    check(nearPt(cubes[0], [2, 0], 1e-12) && nearPt(cubes[1], [2*Math.cos(third), 2*Math.sin(third)], 1e-12) && nearPt(cubes[2], [2*Math.cos(third), -2*Math.sin(third)], 1e-12)
          && cubes.every(z => nearPt(run(pw3, z), [8, 0], 1e-11)), `the three cube roots of 8: ${cubes.map(fmt)}`);
    // an exponent 2.5: of the roots exp((log w + 2 pi i k)/2.5) those with the angle within pi show w
    const pw25 = powerStep(2.5);
    const z25 = [0.6*Math.cos(2.9), 0.6*Math.sin(2.9)], w25 = run(pw25, z25);
    check(nearPt(back(pw25, w25, z25), z25, 1e-12) && nearPt(run(pw25, back(pw25, w25, [1, 0.01])), w25, 1e-11) && !nearPt(back(pw25, w25, [1, 0.01]), z25, 0.1),
          'an exponent 2.5: near picks among the roots that show the point');
    // an exponent 1/2 shows the right half plane only: a point of the left one has a place that does not show it
    const half = back(powerStep(0.5), [-1, 0.2], null);
    check(fin(half) && !nearPt(run(powerStep(0.5), half), [-1, 0.2], 1e-3), 'an exponent 1/2: a point of the left half plane is shown nowhere');
    check(back(powerStep(0), [1, 0], null) === null && back(powerStep(-1), [0, 0], null).some(x => !Number.isFinite(x)), 'no value for the exponent 0, none finite for 0 under a negative one');

    // the band: tanh has the period i pi, the strips are 4/fraction apart; the principal one about the real axis
    const w = run(bandStep(1), [0.3, 0.2]);
    check(nearPt(back(bandStep(1), w, null), [0.3, 0.2], 1e-12) && nearPt(back(bandStep(1), w, [0.1, 4.4]), [0.3, 4.2], 1e-12) && nearPt(back(bandStep(1), w, [5, -7.5]), [0.3, -7.8], 1e-12),
          `the band's strips: ${fmt(back(bandStep(1), w, null))}, ${fmt(back(bandStep(1), w, [0.1, 4.4]))}, ${fmt(back(bandStep(1), w, [5, -7.5]))}`);
    check(nearPt(back(bandStep(0.5), run(bandStep(0.5), [0.3, 0.2]), [0, 8.1]), [0.3, 8.2], 1e-12), 'the strips of the fraction 0.5 are 8 apart');
    // a point outside the disk shows between the strips of the disk
    const out = back(bandStep(1), [1.5, 0.2], null);
    check(fin(out) && Math.abs(Math.abs(out[1]) - 2) < 1 && nearPt(run(bandStep(1), out), [1.5, 0.2], 1e-10), `a point outside the disk: ${fmt(out)}`);

    // the periodic wrap: the copy in the cell about near, the cell about the centre without it
    const a1 = [1, 0.2], a2 = [0.3, 1.1], C = [0.4, -0.1];
    const skew = periodicStep(a1, a2, C);
    const p = [0.5, 0.1], pw = run(skew, p);
    check(nearPt(back(skew, pw, null), p, 1e-12), 'the periodic wrap without near: the cell about its centre');
    const far = [p[0] + 3*a1[0] - 2*a2[0], p[1] + 3*a1[1] - 2*a2[1]];
    check(nearPt(back(skew, pw, [far[0] + 0.2, far[1] - 0.15]), far, 1e-12), `near in another cell: its copy, ${fmt(back(skew, pw, [far[0] + 0.2, far[1] - 0.15]))}`);

    // the rational map of the default points, (z^2 - 1)/(z^2 + 1) = w: z^2 = (1 + w)/(1 - w), two roots
    const rat = rationalStep(DEFAULT);
    const roots = rationalRoots(rat, [0.6, 0]);
    check(roots.length === 2 && roots.some(z => nearPt(z, [2, 0], 1e-10)) && roots.some(z => nearPt(z, [-2, 0], 1e-10)), `the roots of the default map at 0.6: ${roots.map(fmt)}`);
    check(nearPt(back(rat, [0.6, 0], [1.5, 0.3]), [2, 0], 1e-10) && nearPt(back(rat, [0.6, 0], [-1, -0.3]), [-2, 0], 1e-10), 'near chooses the root');
    check(nearPt(back(rat, [-1, 0], null), [0, 0], 1e-7), `a root that counts twice: 0 for the value -1 (${fmt(back(rat, [-1, 0], null))})`);
    // z^3 = 8: three roots, each shows the point
    const cube = rationalStep([[0, 0, 3]]);
    const three = rationalRoots(cube, [8, 0]);
    check(three.length === 3 && three.every(z => nearPt(run(cube, z), [8, 0], 1e-9)) && three.some(z => nearPt(z, [2, 0], 1e-9)) && three.some(z => nearPt(z, [-1, Math.sqrt(3)], 1e-9)),
          `the cube roots of 8: ${three.map(fmt)}`);
    // the points that take no part in the reverse form take none here (an exponent 0.7, one of 5)
    const part = rationalStep([[0, 0, 0.7], [0.5, 0, 5], [1, 0, 1.9]]);
    check(rationalRoots(part, [0.25, 0.5]).length === 1 && nearPt(back(part, [0.25, 0.5], null), [1.25, 0.5], 1e-12), 'the exponents cut as the reverse form cuts them');
    check(back(rationalStep([[0, 0, 0.5]]), [1, 0], null) === null, 'a map without a point that takes part: no value');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const none = { sphere: false, moebius: null, steps: [] };
    const idr = viewChainToScreen(none, [0.3, -0.7]);
    check(idr && nearPt(idr.pnt, [0.3, -0.7], 1e-15) && idr.shown, 'no steps: the point itself, shown');
    check(!viewChainHasSheets(none) && !viewChainHasSheets({ ...none, steps: [plainStep('exp'), scaleStep([0, 2], [1, 0])] }) && viewChainHasSheets({ ...none, steps: [plainStep('exp'), bandStep(1)] }),
          'the chains with many places for a point: those with a band, a periodic wrap or a rational map');

    // the sphere: the front hemisphere has its place, the back none
    const ball = { ...none, sphere: true };
    const front = viewChainToScreen(ball, [1/3, 0]);
    check(front && nearPt(front.pnt, [0.6, 0], 1e-12) && front.shown, 'the sphere: (1/3, 0) shows at (0.6, 0)');
    check(viewChainToScreen(ball, [1.5, 0.2]) === null, 'a point on the back of the sphere has no place');

    // a chain of every part, a point sent to the world and back: the seed on it, then 0.05 off
    const nav = [iSphere([2, 0, 0, Math.sqrt(3)]), iPlane([0.6, 0.8, 0, 0.05])];
    const chains = [
        ['the navigation and a band', { sphere: false, moebius: nav, steps: [bandStep(1)] }],
        ['the sphere, the navigation, a band, a rational map, fixed points', { sphere: true, moebius: nav,
            steps: [bandStep(1), rationalStep([[1, 0, 1], [0, 1, -1], [-1, 0, 1], [0, -1, -1]]), ...moebiusSteps([iSphere([0.5, 0, 0, 1])])] }],
        ['the exponent and a scale', { sphere: false, moebius: null, steps: [plainStep('exp'), scaleStep([0.3, -1.6], [0.7, 0.2])] }],
        ['the loxodromic map, a periodic wrap, the upper half plane', { sphere: false, moebius: null,
            steps: [plainStep('lox'), periodicStep([1, 0.2], [0.3, 1.1], [0.2, -0.1]), plainStep('uhp')] }],
    ];
    const r = rnd(11);
    for (const [name, chain] of chains) {
        let worst = 0, worstOff = 0, n = 0, hidden = 0, moved = 0;
        for (let i = 0; i < 1500; i++) {
            const p = [1.6*(r() - 0.5), 1.6*(r() - 0.5)];
            const w = viewChainToWorld(chain, p);
            if (!w.exact) continue;
            const s = viewChainToScreen(chain, w.pnt, p);
            if (!s) { hidden++; continue; }
            n++;
            if (!s.shown) hidden++;
            worst = Math.max(worst, dist(s.pnt, p));
            const off = viewChainToScreen(chain, w.pnt, [p[0] + 0.03, p[1] - 0.04]);
            if (!off || dist(off.pnt, p) > 1e-6) moved++;
            else worstOff = Math.max(worstOff, dist(off.pnt, p));
        }
        check(n > 500 && hidden === 0 && worst <= 1e-9, `${name}: a point comes back to itself, the seed on it (${n} points, ${worst.toExponential(1)}, ${hidden} not shown)`);
        // a seed 0.05 off lands on another copy only where the copies are that close (the rim of the sphere, a branch point)
        check(moved <= 0.02*n && worstOff <= 1e-9, `${name}: and with the seed 0.05 off (${moved} of ${n} on another copy)`);
    }

    // the seed chooses the copy: the periodic wrap after a scale
    const wrap = { ...none, steps: [scaleStep([0.5, 0], [0, 0]), periodicStep([1, 0], [0, 1], [0, 0])] };
    //   reverse: z/2 (the scale), then into the unit cell; a cell is 2 wide on the screen
    const pw = viewChainToWorld(wrap, [0.4, 0.6]).pnt;
    check(nearPt(pw, [0.2, 0.3], 1e-12), 'a wrap after a scale: (0.4, 0.6) shows (0.2, 0.3)');
    const here = viewChainToScreen(wrap, pw, [0.5, 0.5]), there = viewChainToScreen(wrap, pw, [4.3, -1.7]), plain = viewChainToScreen(wrap, pw);
    check(here.shown && nearPt(here.pnt, [0.4, 0.6], 1e-12) && there.shown && nearPt(there.pnt, [4.4, -1.4], 1e-12) && nearPt(plain.pnt, [0.4, 0.6], 1e-12),
          `the copy by the seed: ${fmt(here.pnt)}, ${fmt(there.pnt)}`);
    // a world point outside the wrap's cell shows nowhere: its place shows another point
    const outside = viewChainToScreen(wrap, [0.7, 0.3], [0.5, 0.5]);
    check(outside && !outside.shown && nearPt(outside.pnt, [1.4, 0.6], 1e-12), 'a point outside the cell: a place that does not show it');

    // the exponent shows one sheet of its logarithm
    const ex = { ...none, steps: [plainStep('exp')] };
    const on = viewChainToScreen(ex, [0.3, 1]), offSheet = viewChainToScreen(ex, [0.3, 1 + 2*Math.PI]);
    check(on.shown && offSheet && !offSheet.shown && nearPt(on.pnt, offSheet.pnt, 1e-12), 'the exponent: a point a period off has the same place, which does not show it');

    // a map's infinity: -1 for the upper half plane
    check(viewChainToScreen({ ...none, steps: [plainStep('uhp')] }, [-1, 0]) === null, 'no place at a map\'s infinity');

    // the seed's path: the point each step is applied to; it ends where the chain is not defined
    const two = { sphere: true, moebius: null, steps: [bandStep(1), plainStep('exp')] };
    const path = viewChainPath(two, [0.6, 0]);
    check(path.length === 2 && nearPt(path[0], [1/3, 0], 1e-12) && nearPt(path[1], run(bandStep(1), [1/3, 0]), 1e-12), 'the path: the point before each step');
    check(viewChainPath(two, [0.9, 0.9]).length === 0, 'no path off the sphere');
    // a seed off the sphere: the principal values
    const sb = { sphere: true, moebius: null, steps: [bandStep(1)] };
    const wb = viewChainToWorld(sb, [0.3, 0.2]).pnt;
    const offSphere = viewChainToScreen(sb, wb, [3, 3]);
    check(offSphere && offSphere.shown && nearPt(offSphere.pnt, [0.3, 0.2], 1e-12), 'a seed off the sphere: the principal place');
}

console.log(failed ? `${failed} of ${checks} check(s) FAILED` : `all ${checks} checks passed`);
process.exit(failed ? 1 : 0);
