/*
  FactorizationU4.js — a transform (a list of reflections) shortened to at most 5
  reflections, the transform's own splanes taken in U4: spheres by their centre
  and signed radius, planes by their unit normal and distance, points of the upper
  half space by their coordinates and height.

  iGetFactorizationU4 (Inversive.js) takes every splane to H4, the 5-vector of the
  hyperboloid model, for each reflection and back. A small sphere or a large one
  has large H4 components there, their difference holds its radius, and that is
  where the precision goes (a word of 200 reflections of the group 237: 4e-8;
  random planar transforms of a few reflections: up to 0.6). Here:

  1. the images u_i = T(e_i) of 5 splanes e_i are made by reflecting them in the
     transform's splanes in U4 (iReflectSplaneU4), the formulas of the
     inversions, so an image keeps the relative precision of its centre and
     radius however small or far it is;
  2. the point step: b_4, the bisector of u_4 and the point e_4 made from the
     differences of their coordinates, takes u_4 back (a plane and a moderate
     sphere instead when b_4 would be a sphere of radius 1/move), the other
     images reflected in it in U4;
  3. what is left fixes the point. For a transform of the plane z = 0
     (factorPlanar) it is an orthogonal map of span(e_0, e_1, e_3), taken apart
     by its axis and angle: 2 reflections, 3 when it reverses. In space
     (factorHybrid) Householder steps on the images' H4 vectors, of size 1 now.
  4. the result is checked against the images; when it is off by more than
     rounding the best of the other ways is taken.

  Accuracy (tests/transforms/factorization_u4.mjs): planar transforms within
  2e-12 of the exact map of their Moebius matrix, a motion near the identity
  (1e-3 ... 1e-12) within 1e-15, the word of 200 reflections within 3e-15.

  The splanes: e_4 the point above P, e_3 the unit sphere about P, e_2 the
  plane z = 0, e_1, e_0 vertical planes through P; P and the turn of e_0, e_1
  generic (see BASIS). An image passing within the rounding of a centre of
  inversion is a plane (THROUGH): the transforms here pair splanes through each
  other's centres, and a centre and radius hold a sphere of radius 1e12 badly.

  The orientation follows the H4 vectors of U4toH4: a sphere's radius is signed,
  a plane {x: n.x = d} has the H4 vector (-n, -d, -d).
*/

import {
    SPLANE_SPHERE,
    SPLANE_PLANE,
    SPLANE_POINT,
    iSphere,
    iPlane,
    iPoint,
} from './modules.js';

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const len = a => Math.hypot(a[0], a[1], a[2]);

// a step whose image is this close to its splane (the H4 length of their
// difference) gives no reflection
const SAME = 1e-12;
// the bisector is a plane when its sphere would be this many times larger
const PLANE_RATIO = 1e14;
// a sphere passes through the centre of inversion when its distance from it is
// its radius within this part (the rounding of a few reflections of a pair of
// splanes through each other's centres); a sphere passing at 1e-11 of the centre
// would be a sphere of radius 1e11, its plane is 1e-11 off it within 1
const THROUGH = 1e-11;

const centre = s => [s.v[0], s.v[1], s.v[2]];

// the plane with the normal n (any length) through the distance d along it
function plane(n, d){
    const l = len(n);
    return iPlane([n[0]/l, n[1]/l, n[2]/l, d/l]);
}

//
//  the splane x reflected in the sphere or plane p, in U4
//
export function iReflectSplaneU4(p, x){
    const pv = p.v, xv = x.v;
    if (p.type === SPLANE_PLANE) {
        // x -> x - 2 (N.x - dN) N
        const N = [pv[0], pv[1], pv[2]];
        const dN = pv[3];
        switch (x.type) {
        case SPLANE_SPHERE: {
            const c = centre(x);
            const c1 = sub(c, mul(N, 2*(dot(N, c) - dN)));
            return iSphere([c1[0], c1[1], c1[2], xv[3]]);
        }
        case SPLANE_PLANE: {
            const n = [xv[0], xv[1], xv[2]];
            const k = 2*dot(N, n);
            return iPlane([n[0] - k*N[0], n[1] - k*N[1], n[2] - k*N[2], xv[3] - k*dN]);
        }
        case SPLANE_POINT: {
            const c = centre(x);
            const c1 = sub(c, mul(N, 2*(dot(N, c) - dN)));
            return iPoint([c1[0], c1[1], c1[2], xv[3]]);
        }
        default:
            return x;
        }
    }
    if (p.type !== SPLANE_SPHERE) return x;
    // the inversion in the sphere (C, R) of the upper half space
    const C = centre(p);
    const R2 = pv[3]*pv[3];
    switch (x.type) {
    case SPLANE_SPHERE: {
        const r = xv[3];
        const e = sub(centre(x), C);
        const el = len(e);
        const ar = Math.abs(r);
        // the power of C, as a product: no cancellation of the squares
        const D = (el - ar)*(el + ar);
        // through C within the rounding of a centre and radius (a bisector of a
        // sphere and a plane is centred on the sphere): a plane, not a sphere of
        // radius 1e16
        if (Math.abs(el - ar) <= THROUGH*el) {
            // through C: the plane across e, R^2/(2|e|) from C, its normal -sign(r) e
            const n = mul(e, -Math.sign(r)/el);
            return iPlane([n[0], n[1], n[2], dot(n, C) - Math.sign(r)*R2/(2*el)]);
        }
        const k = R2/D;
        return iSphere([C[0] + k*e[0], C[1] + k*e[1], C[2] + k*e[2], k*r]);
    }
    case SPLANE_PLANE: {
        const n = [xv[0], xv[1], xv[2]];
        const delta = dot(n, C) - xv[3];
        // through C within the rounding of the plane's distance and C: the plane
        // itself, not a sphere of radius 1e17
        if (Math.abs(delta) <= THROUGH*Math.max(1, Math.abs(xv[3]), len(C))) return x;
        // the sphere through C and the image of C's foot on the plane
        const r1 = R2/(2*delta);
        return iSphere([C[0] - r1*n[0], C[1] - r1*n[1], C[2] - r1*n[2], r1]);
    }
    case SPLANE_POINT: {
        const e = [xv[0] - C[0], xv[1] - C[1], xv[2] - C[2], xv[3]];
        const ee = e[0]*e[0] + e[1]*e[1] + e[2]*e[2] + e[3]*e[3];
        if (ee === 0) return iPoint([1e10, 0, 0, 0]);
        const k = R2/ee;
        return iPoint([C[0] + k*e[0], C[1] + k*e[1], C[2] + k*e[2], k*e[3]]);
    }
    default:
        return x;
    }
}

//
//  the transform (a list of splanes, the first applied first) applied to x, in U4
//
export function iTransformSplaneU4(transform, x){
    for (const p of transform) x = iReflectSplaneU4(p, x);
    return x;
}

//
//  the bisector of the splanes t and e: the reflection taking t to e (the H4
//  vector t - e), null when they are the same within SAME or no reflection
//  takes one to the other. Points, or spheres and planes.
//
export function iBisectorU4(t, e){
    const tv = t.v, ev = e.v;
    if (t.type === SPLANE_POINT || e.type === SPLANE_POINT) {
        if (t.type !== e.type) return null;
        // the points (x1, w1), (x2, w2): q = 2 (cosh dist - 1)
        const dx = sub(centre(t), centre(e));
        const w1 = tv[3], w2 = ev[3];
        const dxl = len(dx);
        const q = (dxl*dxl + (w1 - w2)*(w1 - w2))/(w1*w2);
        if (!(q > SAME*SAME)) return null;
        const dw = w2 - w1;
        if (Math.abs(dw)*PLANE_RATIO <= dxl) {
            // the same heights: the plane half way
            const N = mul(dx, 1/dxl);
            return iPlane([N[0], N[1], N[2], dot(N, centre(t)) - dxl/2]);
        }
        // centred on the boundary on the line of the points, R^2 = |t - C| |e - C|
        const C = mul(sub(mul(centre(t), w2), mul(centre(e), w1)), 1/dw);
        const R2 = (dxl*dxl + dw*dw)*w1*w2/(dw*dw);
        return iSphere([C[0], C[1], C[2], Math.sqrt(R2)]);
    }
    const ts = t.type === SPLANE_SPHERE, es = e.type === SPLANE_SPHERE;
    if (ts && es) {
        const c1 = centre(t), c2 = centre(e);
        const r1 = tv[3], r2 = ev[3];
        const dc = sub(c1, c2);
        const dcl = len(dc);
        const dr = r1 - r2;
        // q = 2 - 2 <t, e> = (|dc|^2 - dr^2)/(r1 r2)
        const q = (dcl - Math.abs(dr))*(dcl + Math.abs(dr))/(r1*r2);
        if (!(q > SAME*SAME)) return null;
        if (Math.abs(dr)*PLANE_RATIO <= Math.max(Math.abs(r1), Math.abs(r2)) ) {
            // equal radii: the plane half way between the centres
            const N = mul(dc, 1/dcl);
            return iPlane([N[0], N[1], N[2], dot(N, c1) - dcl/2]);
        }
        // the centre of similitude (r2 c1 - r1 c2)/(r2 - r1), R^2 = q/beta^2
        const C = mul(sub(mul(c1, r2), mul(c2, r1)), -1/dr);
        const R2 = q*r1*r1*r2*r2/(dr*dr);
        return iSphere([C[0], C[1], C[2], Math.sqrt(R2)]);
    }
    if (ts || es) {
        // a sphere (c, r) and a plane n.x = d: centred at c + r n, R^2 = 2 r (r + c.n - d)
        const s = ts ? tv : ev, pl = ts ? ev : tv;
        const c = [s[0], s[1], s[2]], r = s[3];
        const n = [pl[0], pl[1], pl[2]], d = pl[3];
        const g = r + dot(c, n) - d;
        const q = 2*g/r;
        if (!(q > SAME*SAME)) return null;
        const C = [c[0] + r*n[0], c[1] + r*n[1], c[2] + r*n[2]];
        return iSphere([C[0], C[1], C[2], Math.sqrt(2*r*g)]);
    }
    // two planes: the normal n1 - n2, the distance d1 - d2
    const dn = [tv[0] - ev[0], tv[1] - ev[1], tv[2] - ev[2]];
    const q = dot(dn, dn);
    if (!(q > SAME*SAME)) return null;
    return plane(dn, tv[3] - ev[3]);
}

// The splanes e_0 ... e_4: the vertical planes through P of the normals M_0, M_1,
// the plane z = 0 (M_2), the unit sphere about P, the point above P. P and the
// turn of M_0, M_1 are generic: the transforms here are made of splanes on the
// axes and centred on them, and an image passing within 1e-12 of a centre of
// inversion is a sphere of radius 1e12, which a centre and radius hold badly.
// The plane z = 0 keeps a transform of the plane in vertical splanes.
const P = [0.1234567, -0.0765432, 0];
const ANGLE = 0.6180339887;
const M = [
    [-Math.cos(ANGLE), -Math.sin(ANGLE), 0],
    [Math.sin(ANGLE), -Math.cos(ANGLE), 0],
    [0, 0, -1],
];
const BASIS = () => [
    iPlane([...M[0], dot(M[0], P)]),
    iPlane([...M[1], dot(M[1], P)]),
    iPlane([...M[2], dot(M[2], P)]),
    iSphere([P[0], P[1], P[2], -1]),
    iPoint([P[0], P[1], P[2], 1]),
];

//
//  the normal of the plane through P a splane is meant to be: a sphere (c, r)
//  of a huge radius is the plane of the normal (P - c)/r (its H4 vector c/r ~ -n)
//
function normalThroughP(s){
    const v = s.v;
    if (s.type === SPLANE_PLANE) return [v[0], v[1], v[2]];
    const d = sub(P, centre(s));
    return mul(d, Math.sign(v[3])/len(d));
}

//
//  the normal of the image of the splane s in the sphere or plane b, an image
//  known to be a plane through P: s passes through the centre of b, and the
//  image's normal is along the line from that centre to the centre of s (its
//  distance and the image's radius are rounding)
//
function normalOfImage(b, s){
    const v = s.v;
    if (!b) return normalThroughP(s);
    if (b.type === SPLANE_PLANE) {
        if (s.type !== SPLANE_PLANE) return normalThroughP(iReflectSplaneU4(b, s));
        const N = [b.v[0], b.v[1], b.v[2]], n = [v[0], v[1], v[2]];
        return sub(n, mul(N, 2*dot(N, n)));
    }
    if (s.type === SPLANE_PLANE) return [v[0], v[1], v[2]];
    const e = sub(centre(s), centre(b));
    return mul(e, -Math.sign(v[3])/len(e));
}

//
//  the reflections taking the images u of the splanes e back, in U4 throughout:
//  the bisectors in U4, the planes' last steps on their normals
//
function factorPure(e, u){
    const t = u.slice();
    const ref = [];
    const push = (b, j) => {
        ref.push(b);
        for (let i = 0; i < j; i++) t[i] = iReflectSplaneU4(b, t[i]);
    };
    // the point
    const b4 = iBisectorU4(t[4], e[4]);
    if (b4) push(b4, 4);
    // the unit sphere: its bisector must keep the point, a sphere through it
    // (|C - P|^2 + 1 = R^2) or a plane through P. A bisector made of two nearly
    // equal images is rounding, and only the fixed point keeps it right
    let b3 = iBisectorU4(t[3], e[3]);
    if (b3) {
        const v = b3.v;
        if (b3.type === SPLANE_SPHERE) {
            const dc = sub(centre(b3), P);
            b3 = iSphere([v[0], v[1], v[2], Math.sqrt(1 + dot(dc, dc))]);
        } else {
            b3 = iPlane([v[0], v[1], v[2], v[0]*P[0] + v[1]*P[1] + v[2]*P[2]]);
        }
        ref.push(b3);
    }
    // the planes: their images, orthogonal to the point and the unit sphere, are
    // planes through P (rounding may leave spheres of radius 1e13 instead); what
    // is left is a map of their normals, the turn of a frame. The step j reflects
    // in the plane through P of the normal n_t - M_j less its parts along
    // M_{j+1} ... M_2, fixed already
    const n = t.slice(0, 3).map(s => normalOfImage(b3, s));
    for (let j = 2; j >= 0; j--) {
        let dn = sub(n[j], M[j]);
        for (let k = j + 1; k <= 2; k++) dn = sub(dn, mul(M[k], dot(dn, M[k])));
        const l = len(dn);
        if (!(l > SAME)) continue;
        const N = mul(dn, 1/l);
        ref.push(iPlane([N[0], N[1], N[2], dot(N, P)]));
        for (let i = 0; i < j; i++) n[i] = sub(n[i], mul(N, 2*dot(N, n[i])));
    }
    // b_m ... b_1 T = I: T = b_1 ... b_m, the last found applied first
    return ref.reverse();
}

// ─── the 5 steps on the images' H4 vectors ─────────────────────────────────

// <u, v> of H4: + + + + -
const inner5 = (u, v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2] + u[3]*v[3] - u[4]*v[4];

// the H4 vector of a splane (U4toH4), |c|^2 - r^2 as a product
function toH4(s){
    const v = s.v;
    switch (s.type) {
    case SPLANE_SPHERE: {
        const r = v[3], cl = Math.hypot(v[0], v[1], v[2]);
        const pp = (cl - Math.abs(r))*(cl + Math.abs(r));
        return [v[0]/r, v[1]/r, v[2]/r, (pp - 1)/(2*r), (pp + 1)/(2*r)];
    }
    case SPLANE_PLANE:
        return [-v[0], -v[1], -v[2], -v[3], -v[3]];
    case SPLANE_POINT: {
        const w = v[3], pp = v[0]*v[0] + v[1]*v[1] + v[2]*v[2] + w*w;
        return [v[0]/w, v[1]/w, v[2]/w, (pp - 1)/(2*w), (pp + 1)/(2*w)];
    }
    default:
        return null;
    }
}

// the H4 vector t - e of the points t = (x1, w1), e = (x0, w0) of the upper half
// space, from their differences dx, dw: no cancellation of the components
// (|x|^2 + w^2 -+ 1)/2w of nearly equal points
function pointDifferenceH4(t, e){
    const x1 = centre(t), x0 = centre(e), w1 = t.v[3], w0 = e.v[3];
    const dx = sub(x1, x0), dw = w1 - w0;
    // w0 pp1 - w1 pp0, pp = |x|^2 + w^2
    const A = w0*dot(dx, [x1[0] + x0[0], x1[1] + x0[1], x1[2] + x0[2]]) - dw*dot(x0, x0) + w0*w1*dw;
    const ww = w0*w1;
    return [
        (w0*dx[0] - dw*x0[0])/ww,
        (w0*dx[1] - dw*x0[1])/ww,
        (w0*dx[2] - dw*x0[2])/ww,
        (A + dw)/(2*ww),
        (A - dw)/(2*ww),
    ];
}

// the splane of a spacelike H4 vector b (any length): a sphere of centre
// b_x/beta and radius |b|/beta, beta = b_4 - b_3; a plane when the sphere would
// be PLANE_RATIO times larger than |b| (its distance from a plane at 1 is less
// than the rounding of its centre then); through P when b keeps the point
function fromH4(b, throughP){
    const bx = [b[0], b[1], b[2]];
    const bl = len(bx);
    const beta = b[4] - b[3];
    const q = inner5(b, b);
    if (Math.abs(beta)*PLANE_RATIO <= Math.sqrt(q)) {
        const N = mul(bx, -1/bl);
        return iPlane([N[0], N[1], N[2], throughP ? dot(N, P) : -b[3]/bl]);
    }
    return iSphere([b[0]/beta, b[1]/beta, b[2]/beta, Math.sqrt(q)/Math.abs(beta)]);
}

//
//  the reflections taking the images u of the splanes basis back: the point's
//  step in U4, the rest on the H4 vectors (Householder, each bisector kept
//  orthogonal to the splanes fixed already), the bisectors back to U4. Steps
//  with differences below same are skipped
//
function factorHybrid(basis, images, same){
    const e = basis.map(toH4);
    const u = images.slice();
    const ref = [];
    // the point: its bisector from the exact difference of the points, the other
    // images reflected in it in U4 (the H4 vectors of a point near the boundary
    // are large, their rounding would pass to the images); one bisector always,
    // not pointStep's two, to keep 5 reflections in space
    if (u[4].type === SPLANE_POINT) {
        const b = pointDifferenceH4(u[4], basis[4]);
        if (inner5(b, b) > same*same) {
            const b4 = fromH4(b, false);
            ref.push(b4);
            for (let i = 0; i < 4; i++) u[i] = iReflectSplaneU4(b4, u[i]);
        }
    }
    // the rest on the H4 vectors, of size 1 now: each image passes through the point
    const t = u.map(toH4);
    for (let j = 3; j >= 0; j--) {
        if (!t[j]) continue;
        if (j === 0) {
            // the last image is +-e_0 itself: the reflection in e_0 or none, by the
            // sign alone (a difference of rounding made a plane of any normal)
            if (inner5(t[0], e[0]) < 0) ref.push(basis[0]);
            break;
        }
        let b = t[j].map((x, i) => x - e[j][i]);
        for (let k = j + 1; k <= 4; k++) {
            const f = inner5(b, e[k])/inner5(e[k], e[k]);
            b = b.map((x, i) => x - f*e[k][i]);
        }
        const q = inner5(b, b);
        if (!(q > same*same)) continue;
        ref.push(fromH4(b, true));
        for (let i = 0; i < j; i++) {
            if (!t[i]) continue;
            const f = 2*inner5(b, t[i])/q;
            t[i] = t[i].map((x, k) => x - f*b[k]);
        }
    }
    return ref.reverse();
}

// the point step: reflections taking the image u4 of the point e4 back to it,
// the images u[0..3] reflected in them in U4. One bisector when it is a plane
// or a sphere of moderate size; else (the point moved nearly level, by little)
// the bisector is a sphere of radius 1/move, held to its rounding times that, and
// two reflections do it instead: the plane half way between the points' feet,
// then the sphere about the foot of e4 through the heights' geometric mean
const POINT_SPHERE_MAX = 100;
function pointStep(u, e4, ref, same){
    const u4 = u[4];
    if (u4.type !== SPLANE_POINT) return;
    const b = pointDifferenceH4(u4, e4);
    if (!(inner5(b, b) > same*same)) return;
    const push = m => {
        ref.push(m);
        for (let i = 0; i < 4; i++) u[i] = iReflectSplaneU4(m, u[i]);
    };
    const b4 = fromH4(b, false);
    if (b4.type === SPLANE_PLANE || Math.abs(b4.v[3]) <= POINT_SPHERE_MAX) { push(b4); return; }
    const x1 = centre(u4), x0 = centre(e4);
    const dx = sub(x1, x0), dxl = len(dx);
    if (dxl > 0) {
        const N = mul(dx, 1/dxl);
        push(iPlane([N[0], N[1], N[2], dot(N, x0) + dxl/2]));
    }
    const w1 = u4.v[3], w0 = e4.v[3];
    if (w1 !== w0) push(iSphere([x0[0], x0[1], x0[2], Math.sqrt(w1*w0)]));
}

//
//  the reflections taking the images of a transform of the plane z = 0 back:
//  the point step, then what is left fixes the point above P and the plane z
//  = 0, an orthogonal map W of span(e_0, e_1, e_3) (H4 is Euclidean there).
//  W is a turn by the angle atan2(|skew W|, (tr W - 1)/2) about its axis, the
//  reflections in two vectors across the axis half that angle apart, and the
//  reflection in e_0 before them when W reverses. No step takes a difference of
//  nearly equal vectors, so a turn by 1e-12 is a turn by 1e-12
//
function factorPlanar(basis, images){
    const e = basis.map(toH4);
    const u = images.slice();
    const ref = [];
    pointStep(u, basis[4], ref, 1e-15);
    const t = u.map(toH4);
    if (!t[0] || !t[1] || !t[3]) return null;
    const idx = [0, 1, 3];
    // W = A^T, the columns of A the coordinates of the images
    const W = idx.map(i => idx.map(k => inner5(t[i], e[k])));
    const det = W[0][0]*(W[1][1]*W[2][2] - W[1][2]*W[2][1]) - W[0][1]*(W[1][0]*W[2][2] - W[1][2]*W[2][0]) + W[0][2]*(W[1][0]*W[2][1] - W[1][1]*W[2][0]);
    if (det < 0) {
        // W = W1 D, D the reflection in e_0 applied first
        ref.push(basis[0]);
        for (let i = 0; i < 3; i++) W[i][0] = -W[i][0];
    }
    const sk = [(W[2][1] - W[1][2])/2, (W[0][2] - W[2][0])/2, (W[1][0] - W[0][1])/2];
    const c = (W[0][0] + W[1][1] + W[2][2] - 1)/2;
    const sl = len(sk);
    const theta = Math.atan2(sl, c);
    if (theta === 0) return ref.reverse();
    let a;
    if (c >= 0) {
        a = mul(sk, 1/sl);
    } else {
        // near a half turn the skew part is small: the axis from W + W^T = 2c I + 2(1 - c) a a^T
        const S = [0, 1, 2].map(i => [0, 1, 2].map(k => (W[i][k] + W[k][i])/2 - (i === k ? c : 0)));
        const m = [0, 1, 2].reduce((m, i) => S[i][i] > S[m][m] ? i : m, 0);
        a = mul(S[m], 1/len(S[m]));
        if (dot(a, sk) < 0) a = mul(a, -1);
    }
    // u across the axis, v the turn of u by theta/2 about it
    const m = [0, 1, 2].reduce((m, i) => Math.abs(a[i]) < Math.abs(a[m]) ? i : m, 0);
    const em = [0, 0, 0]; em[m] = 1;
    const cr = (x, y) => [x[1]*y[2] - x[2]*y[1], x[2]*y[0] - x[0]*y[2], x[0]*y[1] - x[1]*y[0]];
    let uu = cr(a, em); uu = mul(uu, 1/len(uu));
    const au = cr(a, uu);
    const vv = [0, 1, 2].map(k => Math.cos(theta/2)*uu[k] + Math.sin(theta/2)*au[k]);
    const toVec = x => [0, 1, 2, 3, 4].map(k => x[0]*e[0][k] + x[1]*e[1][k] + x[2]*e[3][k]);
    ref.push(fromH4(toVec(uu), true), fromH4(toVec(vv), true));
    return ref.reverse();
}

// how far the reflections f take the splanes e from their images u: the H4
// vectors apart, relative to their size
function factorError(f, e, u){
    let w = 0;
    for (let i = 0; i < e.length; i++) {
        const a = toH4(iTransformSplaneU4(f, e[i])), b = toH4(u[i]);
        if (!a || !b) return Infinity;
        const size = Math.max(1, ...b.map(Math.abs));
        for (let k = 0; k < 5; k++) w = Math.max(w, Math.abs(a[k] - b[k])/size);
    }
    return w;
}

// a factorization this close to the images is taken at once
const GOOD = 1e-13;

//
//  the transform (a list of splanes, the first applied first) as at most 5
//  reflections. The images of the 5 splanes are made in U4, the reflections
//  rebuilt from them (factorHybrid); a step whose difference is near the
//  rounding (a motion of 1e-12) can go wrong there, so the result is checked
//  against the images and, when it is off, the best of the other ways is taken:
//  larger steps skipped, all steps in U4 (factorPure), no reflection at all
//
export function iFactorizeU4(transform){
    const basis = BASIS();
    const images = basis.map(s => iTransformSplaneU4(transform, s));
    // a transform of the plane z = 0 keeps it exactly
    const z = images[2];
    const planar = z.type === SPLANE_PLANE && z.v[0] === 0 && z.v[1] === 0 && z.v[2] === -1 && z.v[3] === 0;
    let best = planar ? factorPlanar(basis, images) : factorHybrid(basis, images, SAME);
    let err = best ? factorError(best, basis, images) : Infinity;
    if (err <= GOOD) return best;
    for (const make of [() => factorHybrid(basis, images, SAME), () => factorHybrid(basis, images, 1e-9), () => factorPure(basis, images), () => []]) {
        const f = make();
        if (!f) continue;
        const fe = factorError(f, basis, images);
        if (fe < err) { best = f; err = fe; }
    }
    return best;
}
