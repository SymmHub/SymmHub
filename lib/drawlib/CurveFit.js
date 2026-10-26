//
//  curve fitting: a sequence of points as a path of cubic Bezier segments
//  (Paths.js nodes) within a tolerance - Schneider's algorithm (Graphics
//  Gems, "An Algorithm for Automatically Fitting Digitized Curves"): a
//  cubic fitted by least squares to the points under chord-length
//  parameters, the parameters improved by Newton-Raphson, the run split at
//  the point of the largest error when the fit is not within tolerance.
//  Joints between segments share the tangent: smooth nodes.
//

const MAX_ITERATIONS = 4;   // Newton-Raphson passes before splitting

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, s) => [a[0]*s, a[1]*s];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1];
const len = a => Math.hypot(a[0], a[1]);
const normalize = a => { const l = len(a); return l > 0 ? [a[0]/l, a[1]/l] : [0, 0]; };

/** the cubic with control points b[0..3] at t */
function bezierAt(b, t){
    const u = 1 - t;
    const w = [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
    return [w[0]*b[0][0] + w[1]*b[1][0] + w[2]*b[2][0] + w[3]*b[3][0],
            w[0]*b[0][1] + w[1]*b[1][1] + w[2]*b[2][1] + w[3]*b[3][1]];
}

/** the derivative control polygon of a Bezier (one degree lower) */
function derivative(b){
    const n = b.length - 1;
    const out = [];
    for (let i = 0; i < n; i++) out.push(scale(sub(b[i + 1], b[i]), n));
    return out;
}

function evalBezier(b, t){
    // de Casteljau for any degree
    let v = b.map(p => [p[0], p[1]]);
    for (let d = v.length - 1; d > 0; d--) {
        for (let i = 0; i < d; i++) v[i] = [v[i][0] + (v[i + 1][0] - v[i][0])*t, v[i][1] + (v[i + 1][1] - v[i][1])*t];
    }
    return v[0];
}

function chordLengthParameterize(d, first, last){
    const u = [0];
    for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(d[i], d[i - 1])));
    const total = u[u.length - 1] || 1;
    return u.map(x => x/total);
}

/** the cubic through d[first] and d[last] with the tangents, its handle lengths by least squares */
function generateBezier(d, first, last, u, tHat1, tHat2){
    const nPts = last - first + 1;
    const A = [];
    for (let i = 0; i < nPts; i++) {
        const t = u[i], v = 1 - t;
        A.push([scale(tHat1, 3*t*v*v), scale(tHat2, 3*t*t*v)]);
    }
    const C = [[0, 0], [0, 0]], X = [0, 0];
    for (let i = 0; i < nPts; i++) {
        C[0][0] += dot(A[i][0], A[i][0]);
        C[0][1] += dot(A[i][0], A[i][1]);
        C[1][1] += dot(A[i][1], A[i][1]);
        const t = u[i], v = 1 - t;
        const q = add(add(scale(d[first], v*v*v), scale(d[first], 3*t*v*v)), add(scale(d[last], 3*t*t*v), scale(d[last], t*t*t)));
        const tmp = sub(d[first + i], q);
        X[0] += dot(A[i][0], tmp);
        X[1] += dot(A[i][1], tmp);
    }
    C[1][0] = C[0][1];
    const detC0C1 = C[0][0]*C[1][1] - C[1][0]*C[0][1];
    const detC0X = C[0][0]*X[1] - C[1][0]*X[0];
    const detXC1 = X[0]*C[1][1] - X[1]*C[0][1];
    let alphaL = detC0C1 === 0 ? 0 : detXC1/detC0C1;
    let alphaR = detC0C1 === 0 ? 0 : detC0X/detC0C1;
    // a degenerate fit: handles a third of the chord
    const segLength = len(sub(d[last], d[first]));
    const epsilon = 1e-6*segLength;
    if (alphaL < epsilon || alphaR < epsilon) alphaL = alphaR = segLength/3;
    return [d[first], add(d[first], scale(tHat1, alphaL)), add(d[last], scale(tHat2, alphaR)), d[last]];
}

/** the largest squared distance of a point from the curve at its parameter, and the point's index */
function computeMaxError(d, first, last, bez, u){
    let maxDist = 0, splitPoint = Math.floor((last - first + 1)/2) + first;
    for (let i = first + 1; i < last; i++) {
        const p = bezierAt(bez, u[i - first]);
        const dist = dot(sub(p, d[i]), sub(p, d[i]));
        if (dist >= maxDist) { maxDist = dist; splitPoint = i; }
    }
    return [maxDist, splitPoint];
}

/** a better parameter for a point: one Newton-Raphson step on the distance */
function newtonRaphsonRootFind(bez, p, u){
    const q1 = derivative(bez), q2 = derivative(q1);
    const qu = evalBezier(bez, u), q1u = evalBezier(q1, u), q2u = evalBezier(q2, u);
    const numerator = dot(sub(qu, p), q1u);
    const denominator = dot(q1u, q1u) + dot(sub(qu, p), q2u);
    if (denominator === 0) return u;
    return u - numerator/denominator;
}

function reparameterize(d, first, last, u, bez){
    return u.map((t, i) => newtonRaphsonRootFind(bez, d[first + i], t));
}

function fitCubic(d, first, last, tHat1, tHat2, error, out){
    const nPts = last - first + 1;
    if (nPts === 2) {
        const dist = len(sub(d[last], d[first]))/3;
        out.push([d[first], add(d[first], scale(tHat1, dist)), add(d[last], scale(tHat2, dist)), d[last]]);
        return;
    }
    let u = chordLengthParameterize(d, first, last);
    let bez = generateBezier(d, first, last, u, tHat1, tHat2);
    let [maxError, splitPoint] = computeMaxError(d, first, last, bez, u);
    if (maxError < error) { out.push(bez); return; }
    // close: better parameters may bring it in
    if (maxError < error*error) {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const uPrime = reparameterize(d, first, last, u, bez);
            bez = generateBezier(d, first, last, uPrime, tHat1, tHat2);
            [maxError, splitPoint] = computeMaxError(d, first, last, bez, uPrime);
            if (maxError < error) { out.push(bez); return; }
            u = uPrime;
        }
    }
    // the run split at the worst point, the tangent there shared
    const tHatCenter = normalize(scale(add(sub(d[splitPoint - 1], d[splitPoint]), sub(d[splitPoint], d[splitPoint + 1])), 0.5));
    fitCubic(d, first, splitPoint, tHat1, tHatCenter, error, out);
    fitCubic(d, splitPoint, last, scale(tHatCenter, -1), tHat2, error, out);
}

/** the points without repeats of a point in a row */
function distinct(points){
    const out = [];
    for (const p of points) if (!out.length || len(sub(p, out[out.length - 1])) > 0) out.push([p[0], p[1]]);
    return out;
}

/**
 * the nodes of a path through the points ([[x, y], ...]) within tolerance
 * (the same units); closed: the path returns to the first point, its
 * joint there smooth. Fewer than two distinct points give no nodes.
 */
function fitCurve(points, closed, tolerance){
    let d = distinct(points);
    if (closed && d.length > 1 && len(sub(d[0], d[d.length - 1])) === 0) d.pop();
    if (d.length < 2) return [];
    const error = tolerance*tolerance;
    const segments = [];
    if (closed && d.length >= 3) {
        // round the loop, the tangent at the first point from both its neighbours
        const run = [...d, d[0]];
        const t0 = normalize(scale(add(sub(d[1], d[0]), sub(d[0], d[d.length - 1])), 0.5));
        fitCubic(run, 0, run.length - 1, t0, scale(t0, -1), error, segments);
    } else {
        const tHat1 = normalize(sub(d[1], d[0]));
        const tHat2 = normalize(sub(d[d.length - 2], d[d.length - 1]));
        fitCubic(d, 0, d.length - 1, tHat1, tHat2, error, segments);
    }
    // the segments as nodes: the joints share their tangent
    const nodes = [{ p: segments[0][0], h1: null, h2: segments[0][1] }];
    for (let i = 0; i < segments.length; i++) {
        const next = segments[i + 1];
        nodes.push({ p: segments[i][3], h1: segments[i][2], h2: next ? next[1] : null, ...(next ? { smooth: true } : {}) });
    }
    if (closed && d.length >= 3) {
        // the last node is the first again
        const last = nodes.pop();
        nodes[0].h1 = last.h1;
        nodes[0].smooth = true;
    }
    return nodes;
}

export { fitCurve };
