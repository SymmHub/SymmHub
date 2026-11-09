import {
    iPoint,
    iReflectU4,
    cMul,
    cDiv,
    cLog,
} from './modules.js';

//
//  ViewChain - the map from a point of the plane the canvas transform gives to the
//  world point the shaders show there (docs/conformal_view_editing_assessment.md,
//  outside the repository)
//
//  Every buffer-to-screen shader maps a pixel to its world point through the same
//  chain (lib/shaders/projection_v2.glsl.mjs: makeSphericalProjection, then
//  makeProjection), in this order:
//
//      sphere -> moebius -> rational -> uhp2disc -> plane2band (the exponent map)
//             -> loxodromic -> cScale with its shift -> periodicWrap
//             -> band2disc with its fraction -> the fixed points moebius
//
//  This module is that chain on the CPU, step by step as the GLSL has it, so that
//  the pointer's world point is what the pixel shows. A chain is a plain descriptor
//  (InversiveNavigator.viewChain() builds it from the same numbers the uniforms
//  carry):
//
//      { sphere:   bool,                          the stereographic sphere
//        moebius:  [splanes] | null,              the reflections, in order
//        rational: { points: [[x, y, n], ...] } | null,
//        uhp:      bool,
//        exp:      bool,
//        lox:      bool,
//        cscale:   { c: [re, im], shift: [x, y] } | null,
//        periodic: { a: [a1, a2, a3], d: [d1, d2, d3], center: [cx, cy, cz] } | null,
//        band:     fraction (0: off),
//        fixed:    [splanes] | null }
//
//  The inverse, world to screen, is many-valued (the log, the tanh, the lattice, the
//  rational map) and is not here: the editing overlay goes to the GPU instead
//  (docs/gpu_editing_overlay_assessment.md).
//

const STEP_H = 1.e-5;   // the step of the derivative (plane units)

/** the stereographic sphere: the disk to the front hemisphere; null outside the disk */
function sphereStep(p){
    const pp = p[0]*p[0] + p[1]*p[1];
    if (pp >= 1) return null;
    const f = 1/(1 + Math.sqrt(1 - pp));
    return [p[0]*f, p[1]*f];
}

/** the reflections of a chain applied in order (an entry that is not a splane is skipped, as the GPU's padding is) */
function reflectStep(splanes, p){
    let ip = iPoint([p[0], p[1], 0, 0]);
    for (let i = 0; i < splanes.length; i++) if (splanes[i] && splanes[i].v) ip = iReflectU4(splanes[i], ip);
    return [ip.v[0], ip.v[1]];
}

/** the rational map: the product of (z - zi)^ni */
function rationalStep(points, p){
    let qp = [1, 0];
    for (const [x, y, n] of points) {
        const s = [p[0] - x, p[1] - y];
        const k = Math.round(n);
        if (k === 0) continue;
        let pw = [1, 0];
        for (let i = 0; i < Math.abs(k); i++) pw = cMul(pw, s);
        qp = k > 0 ? cMul(qp, pw) : cDiv(qp, pw);
    }
    return qp;
}

/** the upper half plane to the disk, as the GLSL uhp2disc */
function uhpStep(p){
    const mag = p[0]*p[0] + p[1]*p[1];
    const denom = mag + 2*p[1] + 1;
    return [(1 - mag)/denom, 2*p[0]/denom];
}

/** plane2band: the complex logarithm */
function logStep(p){
    return cLog(p);
}

/** the inversion in the circle about c of radius r (anti-conformal) */
function inversion(c, r, p){
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const f = r*r/(dx*dx + dy*dy);
    return [c[0] + dx*f, c[1] + dy*f];
}

/** loxodromic: the inversion in the circle about (-1, 0) of radius 2, a shift by -1, the logarithm */
function loxStep(p){
    const q = inversion([-1, 0], 2, p);
    return cLog([q[0] - 1, q[1]]);
}

/** cScale: the shift, then the complex factor */
function scaleStep(cs, p){
    return cMul([p[0] - cs.shift[0], p[1] - cs.shift[1]], cs.c);
}

/** periodicWrap: the point reduced into the lattice cell about the centre (the GLSL works in 3D with z = 0) */
function periodicStep(pw, p){
    const { a, d, center: C } = pw;
    const centre = [0, 1, 2].map(i => C[0]*a[0][i] + C[1]*a[1][i] + C[2]*a[2][i]);
    const q = [p[0] - centre[0], p[1] - centre[1], 0 - centre[2]];
    const e = d.map(dk => q[0]*dk[0] + q[1]*dk[1] + q[2]*dk[2]).map(v => v - Math.round(v));
    return [e[0]*a[0][0] + e[1]*a[1][0] + e[2]*a[2][0], e[0]*a[0][1] + e[1]*a[1][1] + e[2]*a[2][1]];
}

/** the complex hyperbolic tangent */
function cTanh(z){
    // tanh(x + iy) = (sinh 2x + i sin 2y)/(cosh 2x + cos 2y)
    const x2 = 2*z[0], y2 = 2*z[1];
    const den = Math.cosh(x2) + Math.cos(y2);
    return [Math.sinh(x2)/den, Math.sin(y2)/den];
}

/** band2disc with the fraction: z -> b tanh(a z), a = (pi/4) fraction, b = 1/tan a; the identity for a tiny a */
function bandStep(fraction, p){
    const a = (Math.PI/4)*fraction;
    if (Math.abs(a) < 1.e-4) return p;
    const b = 1/Math.tan(a);
    const t = cTanh([a*p[0], a*p[1]]);
    return [b*t[0], b*t[1]];
}

/**
 * the world point the shaders show at the plane point p (after the canvas
 * transform): {pnt: [x, y], exact}; exact is false off the sphere, where the
 * shaders draw nothing and the point is returned as it is
 */
function viewChainToWorld(chain, p){
    let q = [p[0], p[1]];
    let exact = true;
    if (chain.sphere) {
        const s = sphereStep(q);
        if (!s) return { pnt: q, exact: false };
        q = s;
    }
    if (chain.moebius && chain.moebius.length) q = reflectStep(chain.moebius, q);
    if (chain.rational && chain.rational.points && chain.rational.points.length) q = rationalStep(chain.rational.points, q);
    if (chain.uhp) q = uhpStep(q);
    if (chain.exp) q = logStep(q);
    if (chain.lox) q = loxStep(q);
    if (chain.cscale) q = scaleStep(chain.cscale, q);
    if (chain.periodic) q = periodicStep(chain.periodic, q);
    if (chain.band) q = bandStep(chain.band, q);
    if (chain.fixed && chain.fixed.length) q = reflectStep(chain.fixed, q);
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) exact = false;
    return { pnt: q, exact };
}

/**
 * the local magnification |F'| of the chain at p, world units per plane unit, by
 * central differences (the maps are conformal or anti-conformal, so one direction
 * is enough); 1 where the chain is not defined
 */
function viewChainScale(chain, p, h = STEP_H){
    const a = viewChainToWorld(chain, [p[0] - h, p[1]]), b = viewChainToWorld(chain, [p[0] + h, p[1]]);
    if (!a.exact || !b.exact) return 1;
    const s = Math.hypot(b.pnt[0] - a.pnt[0], b.pnt[1] - a.pnt[1])/(2*h);
    return Number.isFinite(s) && s > 0 ? s : 1;
}

/** is the chain the identity (the canvas transform alone) */
function viewChainIsIdentity(chain){
    return !chain.sphere && !(chain.moebius && chain.moebius.length) && !(chain.rational && chain.rational.points && chain.rational.points.length)
        && !chain.uhp && !chain.exp && !chain.lox && !chain.cscale && !chain.periodic && !chain.band && !(chain.fixed && chain.fixed.length);
}

// the steps, for the tests
const viewChainSteps = { sphereStep, reflectStep, rationalStep, uhpStep, logStep, loxStep, scaleStep, periodicStep, bandStep, cTanh };

export {
    viewChainToWorld,
    viewChainScale,
    viewChainIsIdentity,
    viewChainSteps,
};
