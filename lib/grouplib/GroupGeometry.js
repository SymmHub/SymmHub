import {
    SPLANE_SPHERE,
    SPLANE_PLANE,
    iPoint,
    iSphere,
    iPlane,
    limitSetSample,
} from './modules.js';

//
//  GroupGeometry - the geometry a group acts on by isometries, read off the sides of its
//  fundamental domain, and the local geometry of a Kleinian group at a point
//  (docs/shape_motions_plan.md, outside the repository)
//
//  The sides of every domain SymmHub makes are geodesics of the group's geometry (the
//  limit bisector of DirichletDomain.js is the bisector of each geometry), so the
//  absolute is the circle every circle side is orthogonal to and every line side passes
//  through, fitted to the sides by least squares as GeneratorElements.modelDisk does,
//  but keeping a negative squared radius as the imaginary circle:
//
//    all sides lines                       euclidean: the absolute is the point at infinity
//    r^2 > 0, the sides fit the circle     hyperbolic: the circle |z - c| = r (the model is
//                                          the disk inside it, or outside it)
//    r^2 < 0, the sides fit the circle     spherical: the sphere whose stereographic equator
//                                          is the circle of radius R = sqrt(-r^2) about c
//    no fit                                kleinian: the group preserves no round circle
//
//  A domain may list the boundary of its disk as a side of its own (the `hasR` domains):
//  when the sides do not fit together, each circle side is tried as the absolute of the
//  others. The pairing transforms must preserve the absolute too (groupGeometry): a group
//  whose sides are geodesics but whose pairings are twisted off them (Group_22222's
//  twists) is Kleinian. The result is in the coordinates the domain is given in (pattern
//  coordinates for a pattern's group); GeometryMotions.transformedGeometry carries it to
//  the world.
//
//  A Kleinian group has a local geometry at every point A of its domain of discontinuity:
//  the maximal round disk D_A there (Kulkarni, Pinkall 1994: the disk with A in the
//  hyperbolic convex hull of its touching points with the limit set), whose Poincaré
//  metric is the Kulkarni-Pinkall (Thurston) metric, invariant under the group,
//  continuous in A and in the deformation of the group, the Poincaré disk itself for a
//  Fuchsian group. In the frame w = 1/(z - A), where A is at infinity, D_A is the
//  complement of the minimum enclosing circle of the limit set (maximalDiskAt). The
//  limit set is a sample (LimitSet.js), fine enough near the fundamental domain, so the
//  point is folded into the domain first and the disk carried back by the fold, which
//  is exact since D_{gA} = g D_A (maximalDisk). The half plane model of the hyperbolic
//  plane (a group whose limit set is a line) comes out of the same computation.
//

const MYNAME = 'GroupGeometry';

// a side fits the absolute when its deviation is below this fraction of the scale
const FIT_TOL = 1.e-4;
// a squared radius this small (of the sides' size) is no circle
const SMALL_R2 = 1.e-12;
const FOLD_ITERATIONS = 200;
// a point closer than this (squared) to a sampled limit point lies on the limit set
const ON_LIMIT_SET = 1.e-24;
// the radius of the disk at a point of the limit set
const TINY_R = 1.e-9;
// a disk of a radius beyond this (times the size of the point) is a half plane
const HUGE_R = 1.e6;

// ---- the absolute of a domain ----------------------------------------------------------------

/** the deviation of a side from the circle |z - (X, Y)|^2 = r2 as its absolute, relative to the sizes */
function deviation(X, Y, r2, sp){
    if (sp.type === SPLANE_SPHERE) {
        // orthogonal to the circle: |c - (X, Y)|^2 - r^2 = r2
        const [cx, cy, , r] = sp.v;
        const d2 = (cx - X)*(cx - X) + (cy - Y)*(cy - Y);
        return Math.abs(d2 - r*r - r2)/(Math.abs(r2) + d2 + r*r);
    }
    if (sp.type === SPLANE_PLANE) {
        // through the centre
        const [nx, ny, , d] = sp.v;
        const len = Math.hypot(nx, ny) || 1;
        return Math.abs((nx*X + ny*Y - d)/len)/Math.sqrt(Math.abs(r2) || 1);
    }
    return 0;
}

const largest = (X, Y, r2, sides) => sides.reduce((m, sp) => Math.max(m, deviation(X, Y, r2, sp)), 0);

function result(X, Y, r2, residual){
    if (!(Math.abs(r2) > SMALL_R2)) return { kind: 'kleinian', residual };
    return r2 > 0 ? { kind: 'hyperbolic', c: [X, Y], r: Math.sqrt(r2), residual }
                  : { kind: 'spherical',  c: [X, Y], R: Math.sqrt(-r2), residual };
}

/**
 * the absolute of a domain given as an array of splanes (iSplane: circles and lines in the
 * plane z = 0; other splanes are ignored)
 *
 * return { kind: 'euclidean' } | { kind: 'hyperbolic', c: [x, y], r } |
 *        { kind: 'spherical', c: [x, y], R } | { kind: 'kleinian' }, with `residual`, the
 *        largest deviation of a side from the fit (relative), for the fitted kinds
 */
export function domainAbsolute(fd){
    const sides = (fd || []).filter(sp => sp && (sp.type === SPLANE_SPHERE || sp.type === SPLANE_PLANE));
    if (sides.length === 0) return { kind: 'kleinian', residual: Infinity };
    if (sides.every(sp => sp.type === SPLANE_PLANE)) return { kind: 'euclidean', residual: 0 };

    // the normal equations for X, Y, W = X^2 + Y^2 - r2: a circle side (cx, cy, r) gives
    // 2cx X + 2cy Y - W = cx^2 + cy^2 - r^2, a line side (nx, ny, d) gives nx X + ny Y = d
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    for (const sp of sides) {
        let row;
        if (sp.type === SPLANE_SPHERE) {
            const [cx, cy, , r] = sp.v;
            row = [2*cx, 2*cy, -1, cx*cx + cy*cy - r*r];
        } else {
            const [nx, ny, , d] = sp.v;
            const len = Math.hypot(nx, ny) || 1;
            row = [nx/len, ny/len, 0, d/len];
        }
        for (let i = 0; i < 3; i++) {
            b[i] += row[i]*row[3];
            for (let j = 0; j < 3; j++) A[i][j] += row[i]*row[j];
        }
    }
    const det3 = m => m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    const det = det3(A);
    const norm = A.reduce((s, row) => s + row.reduce((t, x) => t + x*x, 0), 0);
    if (Math.abs(det) > 1.e-12*Math.pow(norm, 1.5)) {
        const col = (m, k, v) => m.map((row, i) => row.map((x, j) => (j === k) ? v[i] : x));
        const X = det3(col(A, 0, b))/det, Y = det3(col(A, 1, b))/det, W = det3(col(A, 2, b))/det;
        const r2 = X*X + Y*Y - W;
        const residual = largest(X, Y, r2, sides);
        if (residual <= FIT_TOL) return result(X, Y, r2, residual);
    }

    // the boundary of the disk listed as a side: the others fit it
    let best = null;
    for (const sp of sides) {
        if (sp.type !== SPLANE_SPHERE) continue;
        const [cx, cy, , r] = sp.v;
        const residual = largest(cx, cy, r*r, sides.filter(s => s !== sp));
        if (residual <= FIT_TOL && (!best || residual < best.residual)) best = { X: cx, Y: cy, r2: r*r, residual };
    }
    if (best) return result(best.X, best.Y, best.r2, best.residual);
    return { kind: 'kleinian', residual: Infinity };
}

/** the splanes of all the pairing transforms of a group (the reflections they are chains of) */
function pairingSplanes(group){
    const trs = (typeof group.getReverseITransforms === 'function') ? group.getReverseITransforms() : null;
    const out = [];
    for (const tr of trs || []) {
        const ref = tr && (typeof tr.getRef === 'function' ? tr.getRef() : tr.ref);
        for (const sp of ref || []) if (sp && (sp.type === SPLANE_SPHERE || sp.type === SPLANE_PLANE)) out.push(sp);
    }
    return out;
}

/**
 * the geometry of a group (invlib Group): the absolute of its fundamental domain
 * (domainAbsolute), which its pairing transforms must preserve as well, in the group's
 * coordinates
 */
export function groupGeometry(group){
    if (!group || typeof group.getFundDomain !== 'function') return { kind: 'kleinian', residual: Infinity };
    const g = domainAbsolute(group.getFundDomain());
    if (g.kind === 'kleinian') return g;
    const refs = pairingSplanes(group);
    if (g.kind === 'euclidean') {
        return refs.every(sp => sp.type === SPLANE_PLANE) ? g : { kind: 'kleinian', residual: Infinity };
    }
    const r2 = g.kind === 'hyperbolic' ? g.r*g.r : -g.R*g.R;
    const dev = refs.reduce((m, sp) => Math.max(m, deviation(g.c[0], g.c[1], r2, sp)), 0);
    return dev <= FIT_TOL ? g : { kind: 'kleinian', residual: dev };
}

// ---- the maximal disk at a point --------------------------------------------------------------

/**
 * the smallest circle enclosing the n points (px[i], py[i]): {cx, cy, r}. Welzl's
 * algorithm, iterative, on the points in a random order (a fixed seed), expected O(n)
 */
export function minEnclosingCircle(px, py, n, seed = 12345){
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    let s = seed;
    for (let i = n - 1; i > 0; i--) {
        s = (s*1103515245 + 12345) & 0x7fffffff;
        const j = Math.floor((s/0x7fffffff)*(i + 1));
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    let cx = px[idx[0]], cy = py[idx[0]], r = 0;
    const inside = (k) => Math.hypot(px[k] - cx, py[k] - cy) <= r*(1 + 1.e-12) + 1.e-300;
    const two = (a, b) => { cx = 0.5*(px[a] + px[b]); cy = 0.5*(py[a] + py[b]); r = 0.5*Math.hypot(px[a] - px[b], py[a] - py[b]); };
    const three = (a, b, c) => {
        const bx = px[b] - px[a], by = py[b] - py[a], ex = px[c] - px[a], ey = py[c] - py[a];
        const d = 2*(bx*ey - by*ex);
        if (Math.abs(d) < 1.e-14*(bx*bx + by*by + ex*ex + ey*ey)) {
            // collinear: the farthest pair
            const dab = Math.hypot(bx, by), dac = Math.hypot(ex, ey), dbc = Math.hypot(px[c] - px[b], py[c] - py[b]);
            if (dab >= dac && dab >= dbc) two(a, b); else if (dac >= dbc) two(a, c); else two(b, c);
            return;
        }
        const b2 = bx*bx + by*by, e2 = ex*ex + ey*ey;
        const ux = (ey*b2 - by*e2)/d, uy = (bx*e2 - ex*b2)/d;
        cx = px[a] + ux; cy = py[a] + uy; r = Math.hypot(ux, uy);
    };
    for (let i = 1; i < n; i++) {
        const a = idx[i];
        if (inside(a)) continue;
        cx = px[a]; cy = py[a]; r = 0;
        for (let j = 0; j < i; j++) {
            const b = idx[j];
            if (inside(b)) continue;
            two(a, b);
            for (let k = 0; k < j; k++) {
                const c = idx[k];
                if (!inside(c)) three(a, b, c);
            }
        }
    }
    return { cx, cy, r };
}

/**
 * the maximal disk of the complement of the sampled limit set at the point A, in the
 * coordinates of the sample: {kind: 'hyperbolic', c, r} (the disk on the side of A), or
 * {kind: 'halfplane', p, e} when infinity is a touching point; a disk of radius TINY_R
 * when A lies on a limit point; null when the sample has fewer than two points
 */
export function maximalDiskAt(A, sample){
    const n = sample.count;
    const px = new Float64Array(n + 1), py = new Float64Array(n + 1);
    let m = 0;
    const pts = sample.points;
    for (let i = 0; i < n; i++) {
        // the frame w = 1/(z - A) = conj(z - A)/|z - A|^2, A at infinity
        const dx = pts[2*i] - A[0], dy = pts[2*i + 1] - A[1];
        const d2 = dx*dx + dy*dy;
        if (d2 < ON_LIMIT_SET) return { kind: 'hyperbolic', c: [A[0], A[1]], r: TINY_R };
        px[m] = dx/d2; py[m] = -dy/d2; m++;
    }
    if (sample.infinity) { px[m] = 0; py[m] = 0; m++; }
    if (m < 2) return null;
    const { cx, cy, r } = minEnclosingCircle(px, py, m);
    const mm = cx*cx + cy*cy, q = mm - r*r;
    if (!(Math.abs(q) > 1.e-9*(mm + r*r))) {
        // the circle passes through w = 0: infinity touches, the disk is the half plane
        // through the points z = A + 1/w of w = 2m and w = m (1 + i)
        const s2 = 2*mm;
        const p1 = [A[0] + cx/s2, A[1] - cy/s2];
        const p2 = [A[0] + (cx - cy)/s2, A[1] - (cx + cy)/s2];
        const ex = p2[0] - p1[0], ey = p2[1] - p1[1], len = Math.hypot(ex, ey) || 1;
        return { kind: 'halfplane', p: p1, e: [ex/len, ey/len] };
    }
    // the circle |w - m| = r under z = A + 1/w
    const c = [A[0] + cx/q, A[1] - cy/q], R = r/Math.abs(q);
    if (R > HUGE_R*(1 + Math.hypot(A[0], A[1]))) {
        // a limit set along a line sampled only so far: the circle stands in for the
        // line it tends to; take the half plane bounded by its tangent nearest A
        const dx = A[0] - c[0], dy = A[1] - c[1], len = Math.hypot(dx, dy) || 1;
        return { kind: 'halfplane', p: [c[0] + dx/len*R, c[1] + dy/len*R], e: [-dy/len, dx/len] };
    }
    return { kind: 'hyperbolic', c, r: R };
}

/** the disk or half plane as a splane, and back */
function diskSplane(disk){
    if (disk.kind === 'halfplane') {
        const nx = -disk.e[1], ny = disk.e[0];
        return iPlane([nx, ny, 0, nx*disk.p[0] + ny*disk.p[1]]);
    }
    return iSphere([disk.c[0], disk.c[1], 0, disk.r]);
}

function splaneDisk(sp){
    if (!sp || !sp.v || !sp.v.every(Number.isFinite)) return null;
    if (sp.type === SPLANE_SPHERE) return { kind: 'hyperbolic', c: [sp.v[0], sp.v[1]], r: Math.abs(sp.v[3]) };
    if (sp.type === SPLANE_PLANE) {
        const [nx, ny, , d] = sp.v;
        const n2 = nx*nx + ny*ny;
        if (!(n2 > 0)) return null;
        const len = Math.sqrt(n2);
        return { kind: 'halfplane', p: [nx*d/n2, ny*d/n2], e: [-ny/len, nx/len] };
    }
    return null;
}

/**
 * the maximal disk of the group's domain of discontinuity at the point p (in the group's
 * coordinates): p is folded into the fundamental domain (Group.toFundDomain), where the
 * sample of the limit set is fine, the disk is taken there (maximalDiskAt) and carried
 * back by the inverse of the fold, which is exact as the disks are equivariant. The point
 * itself is used when the fold does not end in the domain. options: those of
 * limitSetSample, and maxIterations of the fold. Null without a sample of the limit set
 */
export function maximalDisk(group, p, options = {}){
    const sample = limitSetSample(group, options);
    if (!sample || sample.count + (sample.infinity ? 1 : 0) < 2) return null;
    let at = p, fold = null;
    if (typeof group.toFundDomain === 'function') {
        const res = group.toFundDomain({ pnt: iPoint([p[0], p[1], 0, 0]), maxIterations: options.maxIterations || FOLD_ITERATIONS });
        if (res && res.inDomain && res.pnt && res.transform && res.transform.getLength() > 0 && res.pnt.v.every(Number.isFinite)) {
            at = [res.pnt.v[0], res.pnt.v[1]];
            fold = res.transform;
        }
    }
    const disk = maximalDiskAt(at, sample);
    if (!disk || !fold) return disk;
    return splaneDisk(fold.inverseTransform(diskSplane(disk))) || disk;
}

/**
 * the geometry of the group at the point p (the group's coordinates): its absolute
 * (groupGeometry) when it has one, else the maximal disk of its domain of discontinuity
 * at p; {kind: 'kleinian'} when there is neither (no limit set sample)
 */
export function localGeometry(group, p, options){
    const g = groupGeometry(group);
    if (g.kind !== 'kleinian') return g;
    return maximalDisk(group, p, options) || g;
}
