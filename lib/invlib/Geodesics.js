import {
    cMul,
    modelMap,
    canonicalChart,
    mobiusApply,
    mobiusInverse,
    mobiusDerivative,
} from './modules.js';

//
//  Geodesics - the segment between two points as the geodesic of a geometry, for drawing
//  shapes by the lines of the group's geometry (docs/geodesic_drawing_assessment.md,
//  outside the repository)
//
//  A geometry is the absolute of GeometryMotions.js: the plane, a disk or a half plane of
//  the hyperbolic plane (the model on the side of the points), a sphere by its
//  stereographic equator. In these conformal models the geodesic through two points is a
//  circle orthogonal to the absolute (through the antipodes on the sphere), or a straight
//  line through the centre of the model, so a segment is an arc: the one through its two
//  ends and its midpoint (geodesicArc).
//
//  The midpoint comes from the linear model. The standard model (the unit disk, the plane,
//  the stereographic plane of the unit sphere; w = modelMap(z)) lifts to the quadric
//  k (x^2 + y^2) + t^2 = 1 of R^3,
//
//      X = (2w, 1 - k |w|^2) / (1 + k |w|^2),        w = (x + i y) / (1 + t),
//
//  the hyperboloid for k = -1 and the sphere for k = 1 (the plane is t = 1, X = (w, 1)).
//  There the isometries are linear and a geodesic is the section by a plane through the
//  origin, so the sum of the vectors of two points, put back on the quadric, is their
//  midpoint.
//
//  For drawing an arc is given as cubic pieces (arcCubics): Canvas2D, the flattening of
//  drawlib's Paths.js and the SVG export take them as any cubic. A piece of at most 45
//  degrees is within 4e-6 of the radius of its arc.
//
//  A cubic segment with the control points P0, C1, C2, P3 (points of the plane, as the nodes
//  and handles of a path are) is the cubic of the linear model put back on the quadric,
//
//      X(t) = N( B0(t) X_P0 + B1(t) X_C1 + B2(t) X_C2 + B3(t) X_P3 ),
//
//  with the Bernstein polynomials B, and N the division by the length of the vector in the
//  form of the quadric (geodesicCurvePoint). It is linear in the control vectors, so an
//  isometry applied to the four points gives the image of the curve; it leaves P0 along the
//  geodesic to C1; with both handles on the geodesic of the ends it is that geodesic; in the
//  plane it is the Euclidean cubic. For drawing it is given as cubic pieces through its
//  points and velocities (geodesicCurveCubics), and it is split by de Casteljau's step on
//  the vectors (geodesicCurveSplit).
//

// an arc whose sagitta is below this fraction of its chord is a straight line
const FLAT = 1.e-9;
// an arc whose sagitta is above this many chords runs out through infinity (on the
// sphere, and outside a disk): it is not drawn as an arc
const FAR = 50;
// a point this close to the absolute (of the standard model's size) has no geodesics
const RIM = 1.e-12;
// the pieces of an arc are at most this wide
const PIECE_ANGLE = Math.PI/4;
// a point put on a geodesic ray stays this far (of the standard model's size) inside a hyperbolic absolute
const RIM_STAY = 1.e-4;
// the cubic pieces of a cubic segment stay this close to it, of the extent of its control
// points (a tenth of a texel of a sprite of 1024), and are at most 2^CURVE_DEPTH (a
// segment that runs far out, a control point next to the point at infinity of a model,
// takes them all and is drawn less closely)
const CURVE_TOL = 1.e-4;
const CURVE_DEPTH = 6;

/** -1 for the hyperbolic plane (a disk or a half plane), 0 for the plane, 1 for the sphere */
function curvature(geom){
    return geom.kind === 'spherical' ? 1 : (geom.kind === 'euclidean' ? 0 : -1);
}

/** the vector of the point w of the standard model on the quadric k (x^2 + y^2) + t^2 = 1 */
function lift(w, k){
    if (k === 0) return [w[0], w[1], 1];
    const n2 = w[0]*w[0] + w[1]*w[1], den = 1 + k*n2;
    return [2*w[0]/den, 2*w[1]/den, (1 - k*n2)/den];
}

/**
 * the point of the standard model under a vector (any positive multiple of a vector of
 * the quadric); null for a vector that is under no point: outside the cone of the
 * hyperboloid, the zero vector, or the pole the stereographic plane has no point for
 */
function unlift(X, k){
    if (k === 0) return X[2] > 0 ? [X[0]/X[2], X[1]/X[2]] : null;
    const q2 = k*(X[0]*X[0] + X[1]*X[1]) + X[2]*X[2];
    if (!(q2 > 0)) return null;
    const den = Math.sqrt(q2) + X[2];
    if (!(den > RIM*Math.sqrt(q2))) return null;
    return [X[0]/den, X[1]/den];
}

/**
 * the midpoint of the geodesic from P to Q; null when there is none: Q is not in the
 * model of P (the other side of a hyperbolic absolute, or on it), or the two are
 * antipodes of a sphere
 */
function geodesicMidpoint(geom, P, Q){
    const k = curvature(geom);
    if (k === 0) return [0.5*(P[0] + Q[0]), 0.5*(P[1] + Q[1])];
    const s = modelMap(geom, P);
    const wp = mobiusApply(s, P), wq = mobiusApply(s, Q);
    if (!wp.every(Number.isFinite) || !wq.every(Number.isFinite)) return null;
    if (k < 0 && !(wp[0]*wp[0] + wp[1]*wp[1] < 1 - RIM && wq[0]*wq[0] + wq[1]*wq[1] < 1 - RIM)) return null;
    const X = lift(wp, k), Y = lift(wq, k);
    const sum = [X[0] + Y[0], X[1] + Y[1], X[2] + Y[2]];
    // antipodes: the vectors cancel, every great circle through them is a geodesic
    if (k > 0 && !(sum[0]*sum[0] + sum[1]*sum[1] + sum[2]*sum[2] > 1.e-20)) return null;
    const w = unlift(sum, k);
    if (!w) return null;
    const M = mobiusApply(mobiusInverse(s), w);
    return M.every(Number.isFinite) ? M : null;
}

/**
 * the geodesic segment from P to Q as an arc:
 *
 *   { line: true, P, Q }                       a straight segment (the plane; a geodesic
 *                                              through the centre of the model)
 *   { centre, radius, a0, sweep, P, Q }        the arc about centre from the angle a0 by
 *                                              sweep (radians, positive counterclockwise)
 *   null                                       no geodesic (geodesicMidpoint), or one that
 *                                              runs out through infinity
 */
function geodesicArc(geom, P, Q){
    if (curvature(geom) === 0) return { line: true, P, Q };
    const M = geodesicMidpoint(geom, P, Q);
    if (!M) return null;
    // the circle through P, M and Q, by the vectors from P
    const ax = M[0] - P[0], ay = M[1] - P[1], bx = Q[0] - P[0], by = Q[1] - P[1];
    const b2 = bx*bx + by*by;
    if (!(b2 > 0)) return { line: true, P, Q };
    const d = 2*(ax*by - ay*bx);
    // the sagitta, of the chord: M's distance from the line of P and Q
    const sag = Math.abs(d)/(2*b2);
    if (sag < FLAT) return { line: true, P, Q };
    if (!(sag < FAR)) return null;
    const a2 = ax*ax + ay*ay;
    const ux = (by*a2 - ay*b2)/d, uy = (ax*b2 - bx*a2)/d;
    const centre = [P[0] + ux, P[1] + uy], radius = Math.hypot(ux, uy);
    const a0 = Math.atan2(-uy, -ux), a1 = Math.atan2(Q[1] - centre[1], Q[0] - centre[0]);
    // from P through M to Q: counterclockwise when the three turn left
    let sweep = a1 - a0;
    if (d > 0 && sweep < 0) sweep += 2*Math.PI;
    if (d < 0 && sweep > 0) sweep -= 2*Math.PI;
    return { centre, radius, a0, sweep, P, Q };
}

/** the point of an arc (geodesicArc) at the fraction t of its length */
function arcPoint(arc, t){
    if (arc.line) return [arc.P[0] + (arc.Q[0] - arc.P[0])*t, arc.P[1] + (arc.Q[1] - arc.P[1])*t];
    const a = arc.a0 + arc.sweep*t;
    return [arc.centre[0] + arc.radius*Math.cos(a), arc.centre[1] + arc.radius*Math.sin(a)];
}

/**
 * an arc (not a line) as cubic pieces from its start to its end, each at most maxAngle
 * wide: [{c1, c2, p}], the two control points and the end of each piece; the last ends at
 * the arc's own end point
 */
function arcCubics(arc, maxAngle = PIECE_ANGLE){
    const n = Math.max(1, Math.ceil(Math.abs(arc.sweep)/maxAngle - 1.e-9));
    const step = arc.sweep/n;
    // the handle length of a circle piece, with the sign of the turn
    const h = (4/3)*Math.tan(step/4)*arc.radius;
    const [ox, oy] = arc.centre, r = arc.radius;
    const pieces = [];
    let p = arc.P, c = Math.cos(arc.a0), s = Math.sin(arc.a0);
    for (let i = 1; i <= n; i++) {
        const a = arc.a0 + step*i, c1 = Math.cos(a), s1 = Math.sin(a);
        const q = (i === n) ? arc.Q : [ox + r*c1, oy + r*s1];
        pieces.push({ c1: [p[0] - h*s, p[1] + h*c], c2: [q[0] + h*s1, q[1] - h*c1], p: [q[0], q[1]] });
        p = q; c = c1; s = s1;
    }
    return pieces;
}

/**
 * the geodesic segment from P to Q as cubic pieces [{c1, c2, p}] (arcCubics); null when
 * it is the straight segment: in the plane, through the centre of the model, or where
 * there is no geodesic to draw (geodesicArc)
 */
function geodesicCubics(geom, P, Q, maxAngle = PIECE_ANGLE){
    const arc = geodesicArc(geom, P, Q);
    return (arc && !arc.line) ? arcCubics(arc, maxAngle) : null;
}

/**
 * the point of the geodesic ray from A along the direction dir ([dx, dy] at A) that is as
 * far from A, in the geometry, as W is: in the canonical chart of A, where the geodesics
 * through A are the rays from the origin, the point of W's radius on the ray of dir
 */
function geodesicRayPoint(geom, A, dir, W){
    const n = Math.hypot(dir[0], dir[1]);
    if (curvature(geom) === 0 || !(n > 0)) {
        const r = Math.hypot(W[0] - A[0], W[1] - A[1]);
        return n > 0 ? [A[0] + dir[0]/n*r, A[1] + dir[1]/n*r] : [W[0], W[1]];
    }
    const s = canonicalChart(geom, A);
    const w = mobiusApply(s, W);
    // a pointer past the absolute: the point stays in the model
    let r = Math.hypot(w[0], w[1]);
    if (curvature(geom) < 0) r = Math.min(r, 1 - RIM_STAY);
    const out = mobiusApply(mobiusInverse(s), [dir[0]/n*r, dir[1]/n*r]);
    return out.every(Number.isFinite) ? out : [W[0], W[1]];
}

// ---- cubic segments ------------------------------------------------------------------------

const bernstein = t => { const s = 1 - t; return [s*s*s, 3*s*s*t, 3*s*t*t, t*t*t]; };
const bernsteinD = t => { const s = 1 - t; return [-3*s*s, 3*s*(s - 2*t), 3*t*(2*s - t), 3*t*t]; };
const combine = (X, b) => [0, 1, 2].map(i => b[0]*X[0][i] + b[1]*X[1][i] + b[2]*X[2][i] + b[3]*X[3][i]);

/**
 * the four control points of a cubic segment in the linear model: {s (the model map on the
 * side of the first point), si (its inverse), k, X (the four vectors)}; null when a
 * control point is not in the model of the first (past a hyperbolic absolute, or on it)
 */
function liftedCubic(geom, cp){
    const k = curvature(geom);
    const s = modelMap(geom, cp[0]);
    const X = [];
    for (const p of cp) {
        const w = mobiusApply(s, p);
        if (!w.every(Number.isFinite)) return null;
        if (k < 0 && !(w[0]*w[0] + w[1]*w[1] < 1 - RIM)) return null;
        X.push(lift(w, k));
    }
    return { s, si: mobiusInverse(s), k, X };
}

/**
 * the point of the lifted cubic at t, with its velocity (d/dt, in the plane) when asked:
 * {z, d}; null where the curve has no point of the plane. For the hyperbolic plane and
 * the sphere only: in the plane a cubic segment is the Euclidean cubic and comes by none
 * of this
 */
function curveAt(L, t, velocity = false){
    const Y = combine(L.X, bernstein(t));
    const w = unlift(Y, L.k);
    if (!w) return null;
    const z = mobiusApply(L.si, w);
    if (!z.every(Number.isFinite)) return null;
    if (!velocity) return { z };
    const Yd = combine(L.X, bernsteinD(t));
    // w = (Y1 + i Y2)/(q + Y3) with q the length of Y in the form of the quadric
    const q = Math.sqrt(L.k*(Y[0]*Y[0] + Y[1]*Y[1]) + Y[2]*Y[2]);
    const qd = (L.k*(Y[0]*Yd[0] + Y[1]*Yd[1]) + Y[2]*Yd[2])/q;
    const den = q + Y[2], dend = qd + Yd[2];
    const wd = [(Yd[0]*den - Y[0]*dend)/(den*den), (Yd[1]*den - Y[1]*dend)/(den*den)];
    // z = si(w): the velocity turned and scaled by the derivative of the inverse model map
    const d = cMul(mobiusDerivative(L.si, w), wd);
    return d.every(Number.isFinite) ? { z, d } : null;
}

/**
 * the point at t of the cubic segment with the control points cp = [P0, C1, C2, P3] in the
 * geometry; null where it has none (a control point out of the model, a curve of the
 * sphere through the point at infinity)
 */
function geodesicCurvePoint(geom, cp, t){
    if (curvature(geom) === 0) {
        const b = bernstein(t);
        return [0, 1].map(i => b[0]*cp[0][i] + b[1]*cp[1][i] + b[2]*cp[2][i] + b[3]*cp[3][i]);
    }
    const L = liftedCubic(geom, cp);
    const e = L ? curveAt(L, t) : null;
    return e ? e.z : null;
}

/**
 * the cubic segment as cubic pieces through its points and velocities, each within tol
 * (of the extent of the control points) of it: [{c1, c2, p, t0, t1}], the control points
 * and the end of a piece and the part of the segment's parameter it covers; null when the
 * segment is the Euclidean cubic of its control points: in the plane, and where the
 * geometry does not draw it (geodesicCurvePoint)
 */
function geodesicCurveCubics(geom, cp, tol = CURVE_TOL){
    if (curvature(geom) === 0) return null;
    const L = liftedCubic(geom, cp);
    if (!L) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of cp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const reach = tol*Math.max(x1 - x0, y1 - y0, 1.e-12);
    const pieces = piecesAlong(t => curveAt(L, t, true), 0, 1, reach, false);
    if (!pieces) return null;
    // the segment ends at its own end point
    pieces[pieces.length - 1].p = [cp[3][0], cp[3][1]];
    return pieces;
}

// the end tangents of a piece are parallel below this sine: its handles are Hermite's
const PARALLEL = 1.e-6;
// so many steps along the curve find the point nearest to the chord's midpoint
const MIDPOINT_STEPS = 4;

/**
 * the handles [c1, c2] of the cubic piece from ea to eb ({z, d}: point and velocity, over
 * the parameter length dt): Hermite's, a third of the velocity, or with em (the curve's
 * point in the middle of the piece: the one nearest to the chord's midpoint) along the
 * tangents with the lengths that put the piece's midpoint there (an arc of a circle comes
 * out as the usual cubic arc); Hermite's again when the tangents are parallel or the
 * lengths come out backwards or absurd
 */
function pieceHandles(ea, eb, em, dt){
    const h = dt/3;
    const c1 = [ea.z[0] + h*ea.d[0], ea.z[1] + h*ea.d[1]], c2 = [eb.z[0] - h*eb.d[0], eb.z[1] - h*eb.d[1]];
    if (!em) return [c1, c2];
    const la = Math.hypot(ea.d[0], ea.d[1]), lb = Math.hypot(eb.d[0], eb.d[1]);
    if (!(la > 0) || !(lb > 0)) return [c1, c2];
    const ax = ea.d[0]/la, ay = ea.d[1]/la, bx = eb.d[0]/lb, by = eb.d[1]/lb;
    // alpha a - beta b = (8/3) (midpoint of the curve - mean of the ends)
    const rx = (8/3)*(em.z[0] - 0.5*(ea.z[0] + eb.z[0])), ry = (8/3)*(em.z[1] - 0.5*(ea.z[1] + eb.z[1]));
    const det = bx*ay - ax*by;
    if (Math.abs(det) < PARALLEL) return [c1, c2];
    const alpha = (bx*ry - by*rx)/det, beta = (ax*ry - ay*rx)/det;
    const chord = Math.hypot(eb.z[0] - ea.z[0], eb.z[1] - ea.z[1]);
    if (!(alpha > 0) || !(beta > 0) || alpha > 2*chord || beta > 2*chord) return [c1, c2];
    return [[ea.z[0] + alpha*ax, ea.z[1] + alpha*ay], [eb.z[0] - beta*bx, eb.z[1] - beta*by]];
}

/**
 * cubic pieces along the curve at(t) -> {z, d} (its point and velocity; null where it has
 * none), from t0 to t1, each within reach of the curve: [{c1, c2, p, t0, t1}]; null when
 * the curve fails. The handles are pieceHandles' (matched: fitted to the curve's point
 * nearest to the chord's midpoint, found from the parameter's midpoint by MIDPOINT_STEPS
 * steps along the curve). A piece is halved while one of its points at its eighths is
 * farther than reach from the curve, at most CURVE_DEPTH times
 */
function piecesAlong(at, t0, t1, reach, matched){
    const pieces = [];
    let failed = false;
    const sample = t => { const e = at(t); if (!e) failed = true; return e; };
    // the curve's point nearest to the chord's midpoint, from the point e at t
    const middle = (ta, ea, tb, eb, t, e) => {
        const mx = 0.5*(ea.z[0] + eb.z[0]), my = 0.5*(ea.z[1] + eb.z[1]);
        for (let i = 0; i < MIDPOINT_STEPS && !failed; i++) {
            const speed2 = e.d[0]*e.d[0] + e.d[1]*e.d[1];
            if (!(speed2 > 0)) break;
            const step = ((mx - e.z[0])*e.d[0] + (my - e.z[1])*e.d[1])/speed2;
            const next = Math.max(ta, Math.min(tb, t + step));
            if (next === t) break;
            t = next;
            e = sample(t);
        }
        return e;
    };
    const add = (ta, ea, tb, eb, depth) => {
        if (failed) return;
        const tm = 0.5*(ta + tb), em = sample(tm);
        if (failed) return;
        const [c1, c2] = pieceHandles(ea, eb, matched ? middle(ta, ea, tb, eb, tm, em) : null, tb - ta);
        if (failed) return;
        if (depth < CURVE_DEPTH) {
            // the piece against the curve at its eighths: how far its point is from the
            // curve. The two run at other speeds, which draws the same line, so the point
            // is measured against the curve's point nearest to it: one step along the
            // curve from the point of the same parameter
            let off = 0;
            for (const u of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
                const t = ta + (tb - ta)*u;
                const e = u === 0.5 ? em : sample(t);
                if (failed) return;
                const b = bernstein(u);
                const qx = b[0]*ea.z[0] + b[1]*c1[0] + b[2]*c2[0] + b[3]*eb.z[0];
                const qy = b[0]*ea.z[1] + b[1]*c1[1] + b[2]*c2[1] + b[3]*eb.z[1];
                const speed2 = e.d[0]*e.d[0] + e.d[1]*e.d[1];
                const step = speed2 > 0 ? ((qx - e.z[0])*e.d[0] + (qy - e.z[1])*e.d[1])/speed2 : 0;
                const near = step !== 0 ? sample(Math.max(ta, Math.min(tb, t + step))) : e;
                if (failed) return;
                off = Math.max(off, Math.hypot(qx - near.z[0], qy - near.z[1]));
            }
            if (off > reach) { add(ta, ea, tm, em, depth + 1); add(tm, em, tb, eb, depth + 1); return; }
        }
        pieces.push({ c1, c2, p: [eb.z[0], eb.z[1]], t0: ta, t1: tb });
    };
    const e0 = sample(t0), e1 = sample(t1);
    if (failed) return null;
    add(t0, e0, t1, e1, 0);
    return (failed || !pieces.length) ? null : pieces;
}

// the step of the finite differences that give a curve's velocity, of its parameter length
const VELOCITY_STEP = 1.e-6;

/**
 * cubic pieces along any curve of the plane, point(t) -> [x, y] (null where it has none),
 * from t0 to t1, within tol of the extent of the curve: [{c1, c2, p, t0, t1}], null when
 * the curve fails. The velocity comes by central differences; the handles are fitted to
 * the curve's midpoints (pieceHandles), so an arc of a circle is the usual cubic arc, and
 * a piece is halved while it is farther off (piecesAlong). The arcs of the shapes of a
 * curved geometry (drawlib's Shapes.js) are drawn by it
 */
function curveCubics(point, t0, t1, tol = CURVE_TOL){
    const h = VELOCITY_STEP*(t1 - t0);
    const at = (t) => {
        const z = point(t);
        if (!z || !z.every(Number.isFinite)) return null;
        const a = point(t - h), b = point(t + h);
        if (!a || !b) return null;
        const d = [(b[0] - a[0])/(2*h), (b[1] - a[1])/(2*h)];
        return d.every(Number.isFinite) ? { z, d } : null;
    };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= 16; i++) {
        const z = point(t0 + (t1 - t0)*i/16);
        if (!z || !z.every(Number.isFinite)) return null;
        x0 = Math.min(x0, z[0]); x1 = Math.max(x1, z[0]); y0 = Math.min(y0, z[1]); y1 = Math.max(y1, z[1]);
    }
    return piecesAlong(at, t0, t1, tol*Math.max(x1 - x0, y1 - y0, 1.e-12), true);
}

/**
 * the cubic segment split at t, as the control points of its two halves: {left: [P0, c1,
 * c2, M], right: [M, c1, c2, P3]}. De Casteljau's step on the vectors of the linear model,
 * each put back on the quadric, as nodes and handles are plain points: M is the point of
 * the segment at t, and the halves leave it and their ends as the segment does, but they
 * are not exactly the segment (the lengths of the vectors are dropped: about 0.1% of the
 * chord for a chord of 0.5 in the metric). Null in the plane and where the geometry does
 * not draw the segment
 */
function geodesicCurveSplit(geom, cp, t){
    if (curvature(geom) === 0) return null;
    const L = liftedCubic(geom, cp);
    if (!L) return null;
    const mix = (U, V) => [0, 1, 2].map(i => (1 - t)*U[i] + t*V[i]);
    const X = L.X;
    const X01 = mix(X[0], X[1]), X12 = mix(X[1], X[2]), X23 = mix(X[2], X[3]);
    const X012 = mix(X01, X12), X123 = mix(X12, X23), Xm = mix(X012, X123);
    const down = V => { const w = unlift(V, L.k); return w ? mobiusApply(L.si, w) : null; };
    const pts = [X01, X012, Xm, X123, X23].map(down);
    if (pts.some(q => !q || !q.every(Number.isFinite))) return null;
    return { left: [[cp[0][0], cp[0][1]], pts[0], pts[1], pts[2]],
             right: [[pts[2][0], pts[2][1]], pts[3], pts[4], [cp[3][0], cp[3][1]]] };
}

export {
    lift as geodesicLift,
    unlift as geodesicUnlift,
    geodesicMidpoint,
    geodesicArc,
    arcPoint,
    arcCubics,
    geodesicCubics,
    geodesicRayPoint,
    geodesicCurvePoint,
    geodesicCurveCubics,
    geodesicCurveSplit,
    curveCubics,
};
