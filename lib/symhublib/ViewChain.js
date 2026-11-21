import {
    iPoint,
    iReflectU4,
    CONFORMAL_KINDS,
} from './modules.js';

//
//  ViewChain - the map from a point of the plane the canvas transform gives to the
//  world point the shaders show there (docs/conformal_view_editing_assessment.md and
//  docs/conformal_transforms_plan.md, outside the repository)
//
//  Every buffer-to-screen shader maps a pixel to its world point through the same
//  chain (lib/shaders/projection_v2.glsl.mjs: makeSphericalProjection, then
//  makeProjection), in this order:
//
//      sphere -> moebius (the navigation's) -> the steps of the list of conformal
//      transformations, from its last row to its first
//
//  This module is that chain on the CPU, so that the pointer's world point is what
//  the pixel shows. A chain is a plain descriptor (InversiveNavigator.viewChain()
//  builds it from the same numbers the uniforms carry):
//
//      { sphere:   bool,                 the stereographic sphere
//        moebius:  [splanes] | null,     the reflections of the navigation, in order
//        steps:    [{kind, data, ...}] } the list's steps in the shaders' order
//                                        (ProjectionTransform.getChain; the kinds and
//                                        their numbers: conformal/ConformalKinds.js)
//
//  The other way, world to screen (viewChainToScreen), has many values: a world point
//  shows at one place under the band on the canvas, at two under the default rational
//  map, in every cell of the periodic wrap. It takes a seed, a plane point near where
//  the answer is wanted (the pointer, the canvas centre), and gives the place on the
//  seed's sheet: the seed goes to the world by the steps' reverse forms and its points
//  on the way are kept; the world point comes back by their direct forms, the last
//  step first, each one with many values taking the value nearest the seed's point at
//  its stage. So a mark stays on the copy the user works at. The tools' outlines and
//  handles need none of this: the GPU draws them through the reverse chain, on every
//  copy (docs/gpu_editing_overlay_assessment.md). This is for what is placed on the 2D
//  canvas by a point: a label, a pixel's step from a point.
//

const STEP_H = 1.e-5;   // the step of the derivative (plane units)
const SHOWN_EPS = 1.e-7;    // a place shows its world point: the way back agrees this well (relative)

const finite = (q) => !!q && Number.isFinite(q[0]) && Number.isFinite(q[1]);

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

/**
 * the world point the shaders show at the plane point p (after the canvas
 * transform): {pnt: [x, y], exact}; exact is false off the sphere, where the
 * shaders draw nothing and the point is returned as it is, and where a map
 * sends the point to infinity
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
    const steps = chain.steps;
    if (steps) {
        for (let i = 0; i < steps.length; i++) {
            const kind = CONFORMAL_KINDS[steps[i].kind];
            if (kind) q = kind.reverse(steps[i], q);
        }
    }
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

/**
 * the points of the plane point p on its way through the list's steps: path[k] is
 * the point step k is applied to (the plane step k's direct form maps into). The
 * path is shorter than the steps where the chain is not defined from there on (off
 * the sphere, a map's infinity)
 */
function viewChainPath(chain, p){
    const path = [];
    let q = [p[0], p[1]];
    if (chain.sphere) {
        q = sphereStep(q);
        if (!q) return path;
    }
    if (chain.moebius && chain.moebius.length) q = reflectStep(chain.moebius, q);
    const steps = chain.steps || [];
    for (let k = 0; k < steps.length; k++) {
        if (!finite(q)) break;
        path.push(q);
        const kind = CONFORMAL_KINDS[steps[k].kind];
        if (kind) q = kind.reverse(steps[k], q);
    }
    return path;
}

/** has the chain a step whose direct form has many values (a seed chooses among them) */
function viewChainHasSheets(chain){
    return (chain.steps || []).some(st => { const kind = CONFORMAL_KINDS[st.kind]; return !!(kind && kind.many); });
}

/**
 * the plane point (before the canvas transform) showing the world point w on the
 * sheet of the seed, a plane point near where the answer is wanted; without a seed
 * the principal value of every step:
 *   {pnt: [x, y], shown}   shown is false when the pixel there shows another world
 *                          point (the exponent shows one sheet of its logarithm,
 *                          the periodic wrap its cell alone)
 *   null                   there is no place: the back of the sphere, a map's infinity
 */
function viewChainToScreen(chain, w, seed = null){
    const steps = chain.steps || [];
    const path = (seed && viewChainHasSheets(chain)) ? viewChainPath(chain, seed) : null;
    let q = [w[0], w[1]];
    for (let k = steps.length - 1; k >= 0; k--) {
        const kind = CONFORMAL_KINDS[steps[k].kind];
        if (!kind) continue;
        q = kind.direct(steps[k], q, (path && k < path.length) ? path[k] : null);
        if (!finite(q)) return null;
    }
    if (chain.moebius && chain.moebius.length) {
        // every mirror is its own inverse: the same ones, the last first
        q = reflectStep(chain.moebius.slice().reverse(), q);
        if (!finite(q)) return null;
    }
    if (chain.sphere) {
        // the front hemisphere is the unit disk; a point outside it is on the back
        const f = 2/(1 + q[0]*q[0] + q[1]*q[1]);
        if (!(f >= 1 - 1.e-12)) return null;
        q = [q[0]*f, q[1]*f];
    }
    const back = viewChainToWorld(chain, q);
    const shown = back.exact && Math.hypot(back.pnt[0] - w[0], back.pnt[1] - w[1]) <= SHOWN_EPS*(1 + Math.hypot(w[0], w[1]));
    return { pnt: q, shown };
}

/** is the chain the identity (the canvas transform alone) */
function viewChainIsIdentity(chain){
    return !chain.sphere && !(chain.moebius && chain.moebius.length) && !(chain.steps && chain.steps.length);
}

/**
 * the reflections of a chain made of Moebius maps alone, in order: the
 * navigation's and those of the list's moebius steps (the fixed points
 * transformation); null with the sphere or a step of another kind
 */
function viewChainMirrors(chain){
    if (chain.sphere) return null;
    const out = [...(chain.moebius || [])];
    for (const st of chain.steps || []) {
        if (st.kind !== 'moebius' || !st.mirrors) return null;
        out.push(...st.mirrors);
    }
    return out;
}

export {
    viewChainToWorld,
    viewChainToScreen,
    viewChainPath,
    viewChainHasSheets,
    viewChainScale,
    viewChainIsIdentity,
    viewChainMirrors,
};
