/*
  ConformalKinds.js — the kinds of steps of the view's chain of conformal
  transformations (docs/conformal_transforms_plan.md, outside the repository):
  what the shaders and the CPU compute for each, from the same numbers.

  The list of transformations (ProjectionTransform.js) gives the chain as steps
  in the shaders' order, the step nearest the screen first:

      { kind: 'band', data: [fraction, 0, 0, 0] }

  kind    the kind's name here; its number `code` is what the shader's loop
          switches on (lib/shaders/projection_v2.glsl.mjs, VC_* there)
  data    the kind's numbers, a multiple of four (the shader gets them as vec4s,
          uViewChainData); [] for a kind without numbers
  mirrors (the moebius kind only) the reflections as splanes, in order: the CPU
          reflects in these, the shader in their numbers in data

  A kind has
      code               its number in the shader
      reverse(step, z)   the shader's step on the CPU: a point of the screen's
                         side [x, y] to the world's side. Single valued.
      direct(step, w, near)   its inverse, the world's side to the screen's (the
                         CPU alone: ViewChain.js viewChainToScreen). Where it has
                         many values it gives the one nearest to near, a point of
                         the plane it maps into (the seed's point at that stage),
                         its principal one without near. Null or a point that is
                         not finite where there is none.
      many               true when the direct form has many values

      kind       data, in floats                               reverse                                        direct
      moebius    up to 4 mirrors, each (v0 v1 v2 v3)(type 0 0 0)   the reflections in order                  the same, backwards
      rational   (n 0 0 0) then n points (x y exponent 0)      prod (z - zi)^ni                               the roots of P(z) - w Q(z) (many)
      uhp        -                                             (i - z)/(i + z)                                i (1 - w)/(1 + w)
      exp        -                                             log z                                          e^w
      lox        -                                             the inversion about (-1, 0) of radius 2, less 1, log   e^w, plus 1, the same inversion
      scale      (shift.x shift.y c.x c.y)                     (z - shift) c                                  w/c + shift
      periodic   (a1 a2)(d1 d2)(C 0 0)                         z - C reduced into the cell of a1, a2          w + C + m a1 + n a2 (many)
      band       (fraction 0 0 0)                              b tanh(a z), a = pi/4 fraction, b = 1/tan a    atanh(w/b)/a + i pi k/a (many)
      power      (n 0 0 0)                                     z^n = exp(n log z), n real                     exp((log w + 2 pi i k)/n) (many)

  The exponent's direct form has one value, but its reverse shows one sheet of
  the logarithm only: a world point off that sheet has a place that does not show
  it (viewChainToScreen tells: shown). The power with an exponent below 1 shows a
  sector of the plane only, in the same way.

  A new kind is an entry here, a function and a `case` with the same code in the
  shader (lib/shaders/projection_v2.glsl.mjs), a row in ConformalMaps.js and a
  line in ConformalMapFactory.js: the power was added so (2026-11-19).
*/

import {
    iPoint,
    iReflectU4,
    cMul,
    cDiv,
    cLog,
    cExp,
} from '../modules.js';

// the limits of the shader's loop (projection_v2.glsl.mjs has the same)
export const VIEW_CHAIN_MAX_STEPS = 16;     // steps
export const VIEW_CHAIN_DATA_SIZE = 64;     // vec4s of their numbers
export const MOEBIUS_STEP_MIRRORS = 4;      // mirrors of one moebius step
export const RATIONAL_MAX_POINTS  = 8;      // points of one rational step

const SPLANE_SPHERE = 1, SPLANE_PLANE = 2;  // as invlib and isplane.glsl.mjs have them

/** the inversion in the circle about c of radius r */
function inversion(c, r, p){
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const f = r*r/(dx*dx + dy*dy);
    return [c[0] + dx*f, c[1] + dy*f];
}

/** the complex hyperbolic tangent: tanh(x + iy) = (sinh 2x + i sin 2y)/(cosh 2x + cos 2y) */
function cTanh(z){
    const x2 = 2*z[0], y2 = 2*z[1];
    const den = Math.cosh(x2) + Math.cos(y2);
    return [Math.sinh(x2)/den, Math.sin(y2)/den];
}

/** the reflections of a chain applied in order (an entry that is no splane is skipped, as the shader's padding is) */
function reflect(mirrors, p){
    let ip = iPoint([p[0], p[1], 0, 0]);
    for (let i = 0; i < mirrors.length; i++) if (mirrors[i] && mirrors[i].v) ip = iReflectU4(mirrors[i], ip);
    return [ip.v[0], ip.v[1]];
}

/** the mirrors of a moebius step read back from its numbers (a step made without them) */
function mirrorsOfData(data){
    const out = [];
    for (let o = 0; o + 8 <= data.length; o += 8) {
        const type = Math.trunc(data[o + 4]);
        if (type === SPLANE_SPHERE || type === SPLANE_PLANE) out.push({ v: [data[o], data[o + 1], data[o + 2], data[o + 3]], type });
    }
    return out;
}

/** the complex inverse hyperbolic tangent: log((1 + u)/(1 - u))/2, its imaginary part in (-pi/2, pi/2] */
function cAtanh(u){
    const l = cLog(cDiv([1 + u[0], u[1]], [1 - u[0], -u[1]]));
    return [l[0]/2, l[1]/2];
}

const cDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cFinite = (z) => Number.isFinite(z[0]) && Number.isFinite(z[1]);

// ── the rational map backwards: the roots of a complex polynomial ──────────────
//  polynomials are arrays of complex coefficients [re, im], the constant first

function polyMul(a, b){
    const r = Array.from({ length: a.length + b.length - 1 }, () => [0, 0]);
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            const p = cMul(a[i], b[j]);
            r[i + j][0] += p[0];
            r[i + j][1] += p[1];
        }
    }
    return r;
}

/** the value of a polynomial and of its derivative at z (Horner): [p, p'] */
function polyValue(c, z){
    let p = [0, 0], dp = [0, 0];
    for (let i = c.length - 1; i >= 0; i--) {
        dp = cMul(dp, z);
        dp = [dp[0] + p[0], dp[1] + p[1]];
        p = cMul(p, z);
        p = [p[0] + c[i][0], p[1] + c[i][1]];
    }
    return [p, dp];
}

/**
 * all the roots of a polynomial, each as often as it counts: Durand and Kerner's
 * iteration from points on a circle round them, then two steps of Newton's for
 * the last digits. The leading coefficients that are zero are dropped; [] for a
 * constant
 */
function polyRoots(coeffs){
    const c = coeffs.slice();
    const big = Math.max(...c.map(x => Math.hypot(x[0], x[1])));
    while (c.length > 1 && Math.hypot(c[c.length - 1][0], c[c.length - 1][1]) <= 1.e-13*big) c.pop();
    const n = c.length - 1;
    if (n < 1 || !(big > 0) || !Number.isFinite(big)) return [];
    const m = c.map(x => cDiv(x, c[n]));        // monic
    if (n === 1) return [[-m[0][0], -m[0][1]]];
    const radius = 1 + Math.max(...m.slice(0, n).map(x => Math.hypot(x[0], x[1])));
    const z = Array.from({ length: n }, (_, k) => {
        const a = 2*Math.PI*k/n + 0.4;
        return [radius*Math.cos(a), radius*Math.sin(a)];
    });
    for (let it = 0; it < 500; it++) {
        let move = 0;
        for (let i = 0; i < n; i++) {
            let den = [1, 0];
            for (let j = 0; j < n; j++) if (j !== i) den = cMul(den, [z[i][0] - z[j][0], z[i][1] - z[j][1]]);
            const step = cDiv(polyValue(m, z[i])[0], den);
            if (!cFinite(step)) continue;
            z[i] = [z[i][0] - step[0], z[i][1] - step[1]];
            move = Math.max(move, Math.hypot(step[0], step[1]));
        }
        if (move < 1.e-15*radius) break;
    }
    return z.map((r) => {
        for (let it = 0; it < 2; it++) {
            const [p, dp] = polyValue(m, r);
            const step = cDiv(p, dp);
            // a root that counts more than once has no slope: it stays as it is
            if (!cFinite(step) || Math.hypot(step[0], step[1]) > 1.e-6*(1 + Math.hypot(r[0], r[1]))) break;
            r = [r[0] - step[0], r[1] - step[1]];
        }
        return r;
    });
}

/**
 * the polynomials of a rational step, prod (z - zi)^ni = P(z)/Q(z): the points
 * that take part as its reverse has them (the exponents cut to whole numbers,
 * from -3 to 3)
 */
function rationalPolys(d){
    let P = [[1, 0]], Q = [[1, 0]];
    const count = Math.min(RATIONAL_MAX_POINTS, Math.trunc(d[0]));
    for (let i = 0; i < count; i++) {
        const o = 4*(i + 1);
        const k = Math.trunc(d[o + 2]);
        if (k === 0 || Math.abs(k) > 3) continue;
        const factor = [[-d[o], -d[o + 1]], [1, 0]];
        for (let j = 0; j < Math.abs(k); j++) {
            if (k > 0) P = polyMul(P, factor);
            else Q = polyMul(Q, factor);
        }
    }
    return { P, Q };
}

/** every z with prod (z - zi)^ni = w: the roots of P(z) - w Q(z) */
export function rationalRoots(step, w){
    const { P, Q } = rationalPolys(step.data);
    const c = [];
    for (let i = 0; i < Math.max(P.length, Q.length); i++) {
        const p = P[i] || [0, 0], q = Q[i] ? cMul(w, Q[i]) : [0, 0];
        c.push([p[0] - q[0], p[1] - q[1]]);
    }
    return polyRoots(c);
}

export const CONFORMAL_KINDS = {

    moebius: {
        code: 1,
        reverse: (step, z) => reflect(step.mirrors || mirrorsOfData(step.data), z),
        // every mirror is its own inverse: the same ones, the last first
        direct: (step, w) => reflect((step.mirrors || mirrorsOfData(step.data)).slice().reverse(), w),
    },

    rational: {
        code: 2,
        many: true,
        // the exponents cut to whole numbers as the shader's int() does
        reverse: (step, z) => {
            const d = step.data;
            const count = Math.min(RATIONAL_MAX_POINTS, Math.trunc(d[0]));
            let f = [1, 0];
            for (let i = 0; i < count; i++) {
                const o = 4*(i + 1);
                const s = [z[0] - d[o], z[1] - d[o + 1]];
                const k = Math.trunc(d[o + 2]);
                if (k === 0 || Math.abs(k) > 3) continue;
                let pw = [1, 0];
                for (let j = 0; j < Math.abs(k); j++) pw = cMul(pw, s);
                f = k > 0 ? cMul(f, pw) : cDiv(f, pw);
            }
            return f;
        },
        // the root nearest to near (to 0 without it); null for a map without a point
        direct: (step, w, near) => {
            const at = near || [0, 0];
            let best = null, dBest = Infinity;
            for (const z of rationalRoots(step, w)) {
                const d = cDist(z, at);
                if (d < dBest) { best = z; dBest = d; }
            }
            return best;
        },
    },

    uhp: {
        code: 3,
        // as the GLSL uhp2disc
        reverse: (step, z) => {
            const mag = z[0]*z[0] + z[1]*z[1];
            const denom = mag + 2*z[1] + 1;
            return [(1 - mag)/denom, 2*z[0]/denom];
        },
        direct: (step, w) => cMul([0, 1], cDiv([1 - w[0], -w[1]], [1 + w[0], w[1]])),
    },

    exp: {
        code: 4,
        reverse: (step, z) => cLog(z),
        direct: (step, w) => cExp(w),
    },

    lox: {
        code: 5,
        reverse: (step, z) => {
            const q = inversion([-1, 0], 2, z);
            return cLog([q[0] - 1, q[1]]);
        },
        direct: (step, w) => {
            const q = cExp(w);
            return inversion([-1, 0], 2, [q[0] + 1, q[1]]);
        },
    },

    scale: {
        code: 6,
        reverse: (step, z) => {
            const d = step.data;
            return cMul([z[0] - d[0], z[1] - d[1]], [d[2], d[3]]);
        },
        direct: (step, w) => {
            const d = step.data;
            const q = cDiv(w, [d[2], d[3]]);
            return [q[0] + d[0], q[1] + d[1]];
        },
    },

    periodic: {
        code: 7,
        many: true,
        reverse: (step, z) => {
            const d = step.data;
            const qx = z[0] - d[8], qy = z[1] - d[9];
            let e1 = qx*d[4] + qy*d[5], e2 = qx*d[6] + qy*d[7];
            e1 -= Math.round(e1);
            e2 -= Math.round(e2);
            return [e1*d[0] + e2*d[2], e1*d[1] + e2*d[3]];
        },
        // the copy of w + C in the cell about near (the cell about C without it)
        direct: (step, w, near) => {
            const d = step.data;
            let m = 0, n = 0;
            if (near) {
                const qx = near[0] - d[8] - w[0], qy = near[1] - d[9] - w[1];
                m = Math.round(qx*d[4] + qy*d[5]);
                n = Math.round(qx*d[6] + qy*d[7]);
            }
            return [w[0] + d[8] + m*d[0] + n*d[2], w[1] + d[9] + m*d[1] + n*d[3]];
        },
    },

    band: {
        code: 8,
        many: true,
        // the identity for a tiny fraction, as the GLSL band2disc
        reverse: (step, z) => {
            const a = (Math.PI/4)*step.data[0];
            if (Math.abs(a) < 1.e-4) return z;
            const b = 1/Math.tan(a);
            const t = cTanh([a*z[0], a*z[1]]);
            return [b*t[0], b*t[1]];
        },
        // tanh has the period i pi: the strip of near (the one about the real axis without it)
        direct: (step, w, near) => {
            const a = (Math.PI/4)*step.data[0];
            if (Math.abs(a) < 1.e-4) return w;
            const b = 1/Math.tan(a);
            const z0 = cAtanh([w[0]/b, w[1]/b]);
            const k = near ? Math.round((near[1] - z0[1]/a)*a/Math.PI) : 0;
            return [z0[0]/a, (z0[1] + Math.PI*k)/a];
        },
    },

    power: {
        code: 9,
        many: true,
        // z^n = exp(n log z), the logarithm's angle from -pi to pi, as the GLSL cPow
        reverse: (step, z) => {
            const n = step.data[0];
            const l = cLog(z);
            return cExp([n*l[0], n*l[1]]);
        },
        // the roots exp((log w + 2 pi i k)/n): those the reverse form takes back to w have
        // their angle (arg w + 2 pi k)/n from -pi to pi. Of them the one at the angle of
        // near (the first, k = 0, without it); for an exponent below 1 there may be none,
        // and the first is given (a place that does not show w). No value for n = 0
        direct: (step, w, near) => {
            const n = step.data[0];
            if (!(Math.abs(n) > 0) || !Number.isFinite(n)) return null;
            const l = cLog(w);
            const TWO_PI = 2*Math.PI;
            let k = near ? Math.round((n*Math.atan2(near[1], near[0]) - l[1])/TWO_PI) : 0;
            const lo = Math.ceil((-Math.abs(n)*Math.PI - l[1])/TWO_PI - 1e-12);
            const hi = Math.floor((Math.abs(n)*Math.PI - l[1])/TWO_PI + 1e-12);
            k = (lo <= hi) ? Math.max(lo, Math.min(hi, k)) : 0;
            return cExp([l[0]/n, (l[1] + TWO_PI*k)/n]);
        },
    },
};

// ── the steps of the kinds, from their values ──────────────────────────────────

/**
 * the steps of a chain of reflections (splanes, applied in order): one moebius
 * step for each four of them; none for an empty chain
 */
export function moebiusSteps(mirrors){
    const list = (mirrors || []).filter(s => s && s.v);
    const steps = [];
    for (let i = 0; i < list.length; i += MOEBIUS_STEP_MIRRORS) {
        const part = list.slice(i, i + MOEBIUS_STEP_MIRRORS);
        const data = new Array(8*MOEBIUS_STEP_MIRRORS).fill(0);
        part.forEach((s, k) => {
            data[8*k] = s.v[0]; data[8*k + 1] = s.v[1]; data[8*k + 2] = s.v[2]; data[8*k + 3] = s.v[3];
            data[8*k + 4] = s.type;
        });
        steps.push({ kind: 'moebius', data, mirrors: part });
    }
    return steps;
}

/** the rational map of points [x, y, exponent]: the product of (z - zi)^ni */
export function rationalStep(points){
    const pts = points.slice(0, RATIONAL_MAX_POINTS);
    const data = [pts.length, 0, 0, 0];
    for (const p of pts) data.push(p[0], p[1], p[2], 0);
    return { kind: 'rational', data };
}

/** (z - shift) c, c and shift complex */
export function scaleStep(c, shift){
    return { kind: 'scale', data: [shift[0], shift[1], c[0], c[1]] };
}

/**
 * the reduction into the cell of the lattice a1, a2 about the point C (in the
 * plane); null for vectors along one line
 */
export function periodicStep(a1, a2, C){
    const det = a1[0]*a2[1] - a1[1]*a2[0];
    if (!(Math.abs(det) > 0) || !Number.isFinite(det)) return null;
    // the dual vectors: di . aj = 1 for i = j, 0 else
    return { kind: 'periodic', data: [a1[0], a1[1], a2[0], a2[1],
                                      a2[1]/det, -a2[0]/det, -a1[1]/det, a1[0]/det,
                                      C[0], C[1], 0, 0] };
}

/** the band of the fraction (1: the whole band map, 0: the identity) */
export function bandStep(fraction){
    return { kind: 'band', data: [fraction, 0, 0, 0] };
}

/** a step of a kind without numbers: 'uhp', 'exp', 'lox' */
export function plainStep(kind){
    return { kind, data: [] };
}

/** the power z^n of a real exponent */
export function powerStep(n){
    return { kind: 'power', data: [n, 0, 0, 0] };
}

// ── the chain for the shader ───────────────────────────────────────────────────

/**
 * the uniforms' arrays of a chain (steps in the shaders' order):
 *   {count, steps: Int32Array of (code, offset) pairs, data: Float32Array}
 * The steps past the limits (VIEW_CHAIN_MAX_STEPS, VIEW_CHAIN_DATA_SIZE) are
 * left out from the end of the array: dropped tells how many (the list keeps
 * within the limits itself, ProjectionTransform.getChain)
 */
export function packViewChain(steps){
    const stepArray = new Int32Array(2*VIEW_CHAIN_MAX_STEPS);
    const data = new Float32Array(4*VIEW_CHAIN_DATA_SIZE);
    let count = 0, used = 0;
    for (const st of steps || []) {
        const kind = CONFORMAL_KINDS[st.kind];
        if (!kind) continue;
        const size = st.data ? Math.ceil(st.data.length/4) : 0;
        if (count >= VIEW_CHAIN_MAX_STEPS || used + size > VIEW_CHAIN_DATA_SIZE) break;
        stepArray[2*count] = kind.code;
        stepArray[2*count + 1] = used;
        if (size) data.set(st.data, 4*used);
        used += size;
        count++;
    }
    return { count, steps: stepArray, data, dropped: (steps ? steps.length : 0) - count };
}

/** the room a list of steps takes in the shader: {steps, data (vec4s)} */
export function viewChainRoom(steps){
    let data = 0;
    for (const st of steps) data += st.data ? Math.ceil(st.data.length/4) : 0;
    return { steps: steps.length, data };
}
