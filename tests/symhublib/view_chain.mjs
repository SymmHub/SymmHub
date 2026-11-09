/*
  tests of the view's chain of maps on the CPU (lib/symhublib/ViewChain.js, the
  ProjectionTransform's chain parts), the map from a canvas point to the world point the
  shaders show there (lib/shaders/projection_v2.glsl.mjs makeProjection)

    node tests/symhublib/view_chain.mjs

  1. the steps one by one against their formulas: the sphere, a circle inversion as a
     Moebius chain, the rational map (z^2 - 1)/(z^2 + 1) of the default points, the upper
     half plane, the logarithm, the loxodromic map, the scale with its shift, the periodic
     wrap, the band with its fraction
  2. the chain: the identity without maps, the GLSL order (the upper half plane before the
     logarithm), exact false off the sphere and at infinity, the local magnification of the
     logarithm and of the band
  3. ProjectionTransform.getChainParts: all off by default, a map switched on through its
     params shows in the parts with the numbers the uniforms get
*/

import { iSphere } from '../../lib/invlib/invlib.js';
import { viewChainToWorld, viewChainScale, viewChainIsIdentity, viewChainSteps as S } from '../../lib/symhublib/ViewChain.js';
import { ProjectionTransform } from '../../lib/symhublib/ProjectionTransform.js';

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearPt = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
const fmt = p => '(' + p.map(x => x.toFixed(6)).join(', ') + ')';

// 1 ───────────────────────────────────────────────────────────────────────────

{
    check(nearPt(S.sphereStep([0.6, 0]), [1/3, 0]) && S.sphereStep([1, 0]) === null, 'the sphere: (0.6, 0) -> (1/3, 0), the rim is off');
    // a circle inversion: c + r^2 (p - c)/|p - c|^2
    const c = [0.5, 0], r = 1, p = [1.2, 0.3];
    const d = [p[0] - c[0], p[1] - c[1]], f = r*r/(d[0]*d[0] + d[1]*d[1]);
    const inv = S.reflectStep([iSphere([c[0], c[1], 0, r])], p);
    check(nearPt(inv, [c[0] + d[0]*f, c[1] + d[1]*f], 1e-9), `a Moebius chain of one inversion: ${fmt(inv)}`);
    // the rational map of the default points: (z - 1)(z + 1)/((z - i)(z + i))
    const pts = [[1, 0, 1], [0, 1, -1], [-1, 0, 1], [0, -1, -1]];
    check(nearPt(S.rationalStep(pts, [0, 0]), [-1, 0]) && nearPt(S.rationalStep(pts, [2, 0]), [0.6, 0]), 'the rational map: 0 -> -1, 2 -> 0.6');
    const sq = S.rationalStep([[0, 0, 2]], [1, 1]);
    check(nearPt(sq, [0, 2]), `an exponent 2: (1 + i)^2 = 2i, got ${fmt(sq)}`);
    check(nearPt(S.uhpStep([0, 1]), [0, 0]) && nearPt(S.uhpStep([1, 0]), [0, 1]), 'the upper half plane: i -> 0, 1 -> i');
    check(nearPt(S.logStep([Math.E, 0]), [1, 0]) && nearPt(S.logStep([0, 1]), [0, Math.PI/2]), 'the logarithm');
    // loxodromic: (0, 0) -> inversion about (-1, 0), radius 2 -> (3, 0) -> shift -> (2, 0) -> log 2
    check(nearPt(S.loxStep([0, 0]), [Math.log(2), 0]), `the loxodromic map: 0 -> ln 2, got ${fmt(S.loxStep([0, 0]))}`);
    check(nearPt(S.scaleStep({ c: [0, 2], shift: [1, 0] }, [2, 0.5]), [-1, 2]), 'the scale: (2 + i/2 - 1) 2i = -1 + 2i');
    const lattice = { a: [[1, 0, 0], [0, 1, 0], [1, 1, 1]], d: [[1, 0, -1], [0, 1, -1], [0, 0, 1]], center: [0, 0, 0] };
    check(nearPt(S.periodicStep(lattice, [1.3, -0.4]), [0.3, -0.4], 1e-12), `the periodic wrap of the unit lattice: ${fmt(S.periodicStep(lattice, [1.3, -0.4]))}`);
    check(nearPt(S.bandStep(1, [0, 1]), [0, 1], 1e-12) && nearPt(S.bandStep(1, [0, 0]), [0, 0]) && nearPt(S.bandStep(0, [0.3, 0.2]), [0.3, 0.2]), 'the band: its edge i -> i, 0 -> 0, fraction 0 the identity');
    const t = S.cTanh([0.3, 0.2]);
    // tanh z = (e^{2z} - 1)/(e^{2z} + 1)
    const e2 = [Math.exp(0.6)*Math.cos(0.4), Math.exp(0.6)*Math.sin(0.4)];
    const num = [e2[0] - 1, e2[1]], den = [e2[0] + 1, e2[1]], dd = den[0]*den[0] + den[1]*den[1];
    check(nearPt(t, [(num[0]*den[0] + num[1]*den[1])/dd, (num[1]*den[0] - num[0]*den[1])/dd], 1e-12), 'the complex tanh');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const none = { sphere: false, moebius: null, rational: null, uhp: false, exp: false, lox: false, cscale: null, periodic: null, band: 0, fixed: null };
    check(viewChainIsIdentity(none) && nearPt(viewChainToWorld(none, [0.3, -0.7]).pnt, [0.3, -0.7]) && viewChainToWorld(none, [0.3, -0.7]).exact, 'no maps: the identity, exact');
    const both = { ...none, uhp: true, exp: true };
    const r = viewChainToWorld(both, [1, 1]);
    check(nearPt(r.pnt, S.logStep(S.uhpStep([1, 1])), 1e-12) && !nearPt(r.pnt, S.uhpStep(S.logStep([1, 1])), 1e-6) && !viewChainIsIdentity(both),
          `the GLSL order, the upper half plane before the logarithm: ${fmt(r.pnt)}`);
    check(!viewChainToWorld({ ...none, sphere: true }, [0.8, 0.7]).exact && viewChainToWorld({ ...none, sphere: true }, [0.3, 0.1]).exact, 'exact: false off the sphere');
    check(!viewChainToWorld({ ...none, exp: true }, [0, 0]).exact, 'exact: false where the logarithm is infinite');
    // the magnification: |d log z/dz| = 1/|z|; the band's at 0 is a b = pi/4
    const p = [0.5, 0.2];
    check(near(viewChainScale({ ...none, exp: true }, p), 1/Math.hypot(p[0], p[1]), 1e-6), `the scale of the logarithm at ${fmt(p)}: ${viewChainScale({ ...none, exp: true }, p)}`);
    check(near(viewChainScale({ ...none, band: 1 }, [0, 0]), Math.PI/4, 1e-6), `the scale of the band at 0: ${viewChainScale({ ...none, band: 1 }, [0, 0])}`);
    check(viewChainScale({ ...none, sphere: true }, [2, 0]) === 1, 'the scale off the sphere is 1');
    // the fixed points chain is applied last: after the band
    const chain = { ...none, band: 1, fixed: [iSphere([0.5, 0, 0, 1])] };
    check(nearPt(viewChainToWorld(chain, [0.2, 0.1]).pnt, S.reflectStep(chain.fixed, S.bandStep(1, [0.2, 0.1])), 1e-12), 'the fixed points transform comes after the band');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const pt = ProjectionTransform({});
    const off = pt.getChainParts();
    const none = { sphere: false, moebius: null, ...off };
    // (isIdentity() is not called: without a group maker the fixed points transform cannot build its data)
    check(viewChainIsIdentity(none), 'ProjectionTransform: all off by default');
    const params = pt.getParams();
    params.expMap.setValue({ enabled: true });
    check(pt.getChainParts().exp === true, 'the exponent map switched on shows in the parts');
    params.expMap.setValue({ enabled: false });
    params.bandMap.setValue({ enabled: true, fraction: 1 });
    check(pt.getChainParts().band === 1, 'the band fraction 1');
    params.bandMap.setValue({ enabled: false });
    params.scaleMap.setValue({ enabled: true, a1x: 1, a1y: 0, a2x: 0, a2y: 1, n1: 10, n2: 0, shift1: 0.25, shift2: 0 });
    const cs = pt.getChainParts().cscale;
    // s = 10 a1 = (10, 0); c = s/(2 pi i) = -10 i/(2 pi); the shift 2 pi (0.25, 0)
    check(cs && nearPt(cs.c, [0, -10/(2*Math.PI)], 1e-12) && nearPt(cs.shift, [Math.PI/2, 0], 1e-12), `the scale map's numbers: ${JSON.stringify(cs)}`);
    params.scaleMap.setValue({ enabled: false });
    params.rationalMap.setValue({ enabled: true });
    const rp = pt.getChainParts().rational;
    check(rp && rp.points.length === 4 && nearPt(S.rationalStep(rp.points, [0, 0]), [-1, 0]), 'the rational map default points');
    params.rationalMap.setValue({ enabled: false });
    params.periodicMap.setValue({ enabled: true, a1x: 1, a1y: 0, a2x: 0, a2y: 1, cx: 0, cy: 0 });
    const pw = pt.getChainParts().periodic;
    check(pw && nearPt(S.periodicStep(pw, [1.3, -0.4]), [0.3, -0.4], 1e-9), `the periodic wrap from the params: ${pw && fmt(S.periodicStep(pw, [1.3, -0.4]))}`);
    params.periodicMap.setValue({ enabled: false });
    params.enabled.setValue(false);
    params.expMap.setValue({ enabled: true });
    check(pt.getChainParts().exp === false, 'the projection switched off as a whole: no parts');
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
