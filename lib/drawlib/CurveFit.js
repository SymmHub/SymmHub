//
//  curve fitting: a sequence of points as a path of cubic Bezier segments
//  (Paths.js nodes) within a tolerance - Schneider's algorithm (Graphics
//  Gems, "An Algorithm for Automatically Fitting Digitized Curves"): a
//  cubic fitted by least squares to the points under chord-length
//  parameters, the parameters improved by Newton-Raphson, the run split at
//  the point of the largest error when the fit is not within tolerance.
//  Joints between segments share the tangent: smooth nodes.
//
//  With corners asked for, the points first split where they turn sharply
//  (the corners of a star or of any sparse polygon): each run between two
//  corners is fitted on its own, a run that stays near its chord as one
//  straight segment, and the corners stay sharp nodes.
//

const MAX_ITERATIONS = 4;   // Newton-Raphson passes before splitting
// a turn this sharp is a corner (as the outline trace's, OutlineTrace.js)
const CORNER_TURN = 40*Math.PI/180;
// the turn at a point is measured to the points this many tolerances away: a
// pointer's jitter turns much over a pixel and little over a few
const CORNER_REACH = 4;

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

/** the segments as nodes: the joints share their tangent */
function segmentNodes(segments){
    const nodes = [{ p: segments[0][0], h1: null, h2: segments[0][1] }];
    for (let i = 0; i < segments.length; i++) {
        const next = segments[i + 1];
        nodes.push({ p: segments[i][3], h1: segments[i][2], h2: next ? next[1] : null, ...(next ? { smooth: true } : {}) });
    }
    return nodes;
}

/** the nodes of an open run of distinct points (two or more) within the squared error */
function openNodes(d, error){
    const segments = [];
    const tHat1 = normalize(sub(d[1], d[0]));
    const tHat2 = normalize(sub(d[d.length - 2], d[d.length - 1]));
    fitCubic(d, 0, d.length - 1, tHat1, tHat2, error, segments);
    return segmentNodes(segments);
}

/**
 * the indices where the points turn by CORNER_TURN or more, the turn
 * measured to the places the reach (a length) along them on each side, each
 * corner the sharpest of the points within that reach; an open run's ends
 * are none
 */
function cornerIndices(d, closed, reach){
    const n = d.length, maxSteps = closed ? Math.floor(n/2) : n - 1;
    const at = k => d[(k%n + n)%n];
    // from d[i] going by step: the place the reach along the points (the last point when they end first) and how many points lie nearer; null at an open end
    const away = (i, step) => {
        let walked = 0, prev = d[i], within = 0;
        for (let s = 1; s <= maxSteps; s++) {
            const k = i + s*step;
            if (!closed && (k < 0 || k >= n)) break;
            const q = at(k), l = len(sub(q, prev));
            if (walked + l >= reach) return { p: add(prev, scale(sub(q, prev), (reach - walked)/l)), within };
            walked += l;
            prev = q;
            within = s;
        }
        return within ? { p: prev, within: within - 1 } : null;
    };
    const turn = new Float64Array(n), spans = [];
    for (let i = 0; i < n; i++) {
        const a = away(i, -1), b = away(i, 1);
        spans.push([a ? a.within : 0, b ? b.within : 0]);
        if (!a || !b) continue;
        const u = sub(d[i], a.p), v = sub(b.p, d[i]);
        turn[i] = Math.abs(Math.atan2(u[0]*v[1] - u[1]*v[0], dot(u, v)));
    }
    const corners = [];
    for (let i = 0; i < n; i++) {
        if (turn[i] < CORNER_TURN) continue;
        // the sharpest of the points within the reach, the first of equals
        const [before, after] = spans[i];
        let sharpest = true;
        for (let k = i - before; k <= i + after && sharpest; k++) {
            if (k !== i) sharpest = k > i ? turn[(k%n + n)%n] <= turn[i] : turn[(k%n + n)%n] < turn[i];
        }
        if (sharpest) corners.push(i);
    }
    return corners;
}

/** the nodes of an open run between two corners: one straight segment when it stays near its chord */
function runNodes(run, tolerance){
    const a = run[0], b = run[run.length - 1], ab = sub(b, a), chord = len(ab);
    const near = p => {
        const ap = sub(p, a), along = dot(ap, ab)/chord;
        return Math.abs(ap[0]*ab[1] - ap[1]*ab[0])/chord <= tolerance && along >= -tolerance && along <= chord + tolerance;
    };
    if (chord > 0 && run.every(near)) return [{ p: a, h1: null, h2: null }, { p: b, h1: null, h2: null }];
    return openNodes(run, tolerance*tolerance);
}

/** the nodes through the distinct points with sharp nodes at the corners (indices): each run between them fitted on its own */
function cornerNodes(d, closed, corners, tolerance){
    const n = d.length, runs = [];
    if (closed) {
        corners.forEach((c, k) => {
            const end = corners[(k + 1)%corners.length], length = (end - c + n - 1)%n + 1;
            const run = [];
            for (let i = 0; i <= length; i++) run.push(d[(c + i)%n]);
            runs.push(run);
        });
    } else {
        const cuts = [0, ...corners, n - 1];
        for (let k = 0; k + 1 < cuts.length; k++) runs.push(d.slice(cuts[k], cuts[k + 1] + 1));
    }
    const nodes = [];
    for (const run of runs) {
        const part = runNodes(run, tolerance);
        // the corner: the handle into it from the run before, out of it from this one
        if (nodes.length) nodes[nodes.length - 1].h2 = part[0].h2;
        else nodes.push(part[0]);
        nodes.push(...part.slice(1));
    }
    // a closed path's last node is its first corner again
    if (closed) nodes[0].h1 = nodes.pop().h1;
    return nodes;
}

/**
 * the nodes of a path through the points ([[x, y], ...]) within tolerance
 * (the same units); closed: the path returns to the first point, its
 * joint there smooth. Fewer than two distinct points give no nodes.
 * corners: sharp turns stay sharp nodes, the runs between them fitted
 * apart (straight when they stay near their chord); else every joint is
 * smooth, as for a sampled curve.
 */
function fitCurve(points, closed, tolerance, corners = false){
    let d = distinct(points);
    if (closed && d.length > 1 && len(sub(d[0], d[d.length - 1])) === 0) d.pop();
    if (d.length < 2) return [];
    const loop = closed && d.length >= 3;
    const sharp = corners && d.length >= 3 ? cornerIndices(d, loop, CORNER_REACH*tolerance) : [];
    if (sharp.length) return cornerNodes(d, loop, sharp, tolerance);
    const error = tolerance*tolerance;
    if (!loop) return openNodes(d, error);
    // round the loop, the tangent at the first point from both its neighbours
    const segments = [];
    const run = [...d, d[0]];
    const t0 = normalize(scale(add(sub(d[1], d[0]), sub(d[0], d[d.length - 1])), 0.5));
    fitCubic(run, 0, run.length - 1, t0, scale(t0, -1), error, segments);
    const nodes = segmentNodes(segments);
    // the last node is the first again
    const last = nodes.pop();
    nodes[0].h1 = last.h1;
    nodes[0].smooth = true;
    return nodes;
}

export { fitCurve };
