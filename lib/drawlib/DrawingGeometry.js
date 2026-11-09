import {
    groupGeometry,
    transformedGeometry,
    canonicalChart,
    mobiusInverse,
    mobiusPointMap,
    geodesicCubics,
    geodesicCurveCubics,
    geodesicCurveSplit,
    geodesicMidpoint,
    curveCubics,
    patternToWorldMap,
    worldToPatternMap,
    maximalDiskFinder,
    geodesicOutline,
} from './modules.js';

//
//  the geometry a drawing is made in, and the outlines of its geodesic paths
//
//  The group acts by isometries of a geometry, the plane, the hyperbolic
//  plane or the sphere, read off its domain in pattern coordinates
//  (grouplib's GroupGeometry.js) and carried to the world, where the items
//  are, by the pattern transform (worldGeometry). A geodesic path (Paths.js)
//  is drawn by an outline whose sides are the geodesics of that geometry and
//  whose curved sides are its cubics (invlib's Geodesics.js); the outliner
//  made here is what the document resolves its geodesic paths by
//  (DrawingDocument.setOutliner), and PatternDrawing gives it another when
//  the group or the pattern box changes the geometry. The outliner also has
//  what the tools edit such a path by: the chart of a node, in which its
//  handles are moved, and the split of a curved side, and the space the
//  geodesic shapes are built in (shapeSpace: the projective chart of their
//  centre, their sizes lengths of the metric; Shapes.js). A Kleinian group
//  has no such geometry: its outliner (kleinianOutliner) draws by the
//  maximal disks of its domain of discontinuity at the points of the path,
//  the local geometry the editor moves shapes by (DrawingEditor.localGeometry).
//

/**
 * the geometry of the group (in pattern coordinates) in world coordinates,
 * as invlib's GeometryMotions.js takes it: {kind: 'euclidean' | 'hyperbolic'
 * | 'spherical', ...}; the plane with `fallback: 'kleinian'` for a group of
 * no absolute, and without a group
 */
function worldGeometry(group, ptc){
    const g = group ? groupGeometry(group) : { kind: 'euclidean' };
    return (g.kind === 'euclidean' || g.kind === 'hyperbolic' || g.kind === 'spherical')
        ? transformedGeometry(g, patternToWorldMap(ptc))
        : { kind: 'euclidean', fallback: g.kind };
}

/** a string that is the same for the same geometry (worldGeometry) */
function geometryKey(geom){
    if (geom.kind === 'hyperbolic') return `hyperbolic ${geom.c[0]} ${geom.c[1]} ${geom.r}`;
    if (geom.kind === 'spherical') return `spherical ${geom.c[0]} ${geom.c[1]} ${geom.R}`;
    return 'euclidean';
}

// a shape's point is at most this far from its centre, in the metric of curvature -1 or 1:
// in the hyperbolic plane within 5e-7 of the absolute (in the projective chart), on the
// sphere 86 degrees, short of the hemisphere where the gnomonic chart ends
const REACH_HYPERBOLIC = 8;
const REACH_SPHERICAL = 1.5;

/**
 * where the shapes of a curved geometry are built (Shapes.js): the projective
 * chart of their centre (Klein's model, the gnomonic chart of the sphere),
 * in which the geodesics are straight lines, scaled so that it agrees with
 * the world at the centre of the model; null in the plane. A shape's sizes
 * are lengths of the metric, in world units as the metric has them at the
 * model's centre (the density there is 2/r), so that an isometry keeps them
 * and a small shape at the centre has the numbers of the Euclidean shape:
 *
 *   chart(C)      -> {to(z), from(q)}: the chart of the point C, world to
 *                 chart and back (a chart point past the reach of the
 *                 geometry is brought in to it)
 *   size(L)       the chart radius of a point at the metric length L from
 *                 the centre: (r/2) tanh (2L/r), (R/2) tan (2L/R)
 *   length(l)     the metric length of the chart radius l, the inverse
 *   fit(point, t0, t1)   the cubic pieces along a curve of the world
 *                 (invlib's curveCubics), the arcs of a shape
 *   midpoint(P, Q)   the midpoint of the geodesic from P to Q, null when
 *                 there is none (the box of a shape being dragged)
 *
 * A Kleinian group's space (kleinianOutliner) has at(C) instead, the space
 * of the disk at C (null without one), and midpoint; Shapes.spaceAt takes
 * either
 */
function shapeSpace(geom, unit = null){
    if (geom.kind !== 'hyperbolic' && geom.kind !== 'spherical' && geom.kind !== 'halfplane') return null;
    const k = geom.kind === 'spherical' ? 1 : -1;
    // the scale of the chart and of the sizes: half the model's radius (the unit given for
    // the disks of a Kleinian group, which have many radii, and for a half plane)
    const half = unit || (geom.kind === 'halfplane' ? 0.5 : 0.5*(k > 0 ? geom.R : geom.r));
    const reach = k > 0 ? REACH_SPHERICAL : REACH_HYPERBOLIC;
    const rim = k > 0 ? Math.tan(reach) : Math.tanh(reach);
    const chart = (C) => {
        const s = canonicalChart(geom, C), to = mobiusPointMap(s), from = mobiusPointMap(mobiusInverse(s));
        return {
            // K = 2w/(1 - k|w|^2) of the point w of the standard model
            to: (z) => { const w = to(z); const f = 2*half/(1 - k*(w[0]*w[0] + w[1]*w[1])); return [w[0]*f, w[1]*f]; },
            from: (q) => {
                let x = q[0]/half, y = q[1]/half;
                const n = Math.hypot(x, y);
                if (n > rim) { x *= rim/n; y *= rim/n; }
                const f = 1/(1 + Math.sqrt(1 + k*(x*x + y*y)));
                return from([x*f, y*f]);
            },
        };
    };
    const size = (L) => { const d = Math.min(reach, Math.abs(L)/half); return half*(k > 0 ? Math.tan(d) : Math.tanh(d)); };
    const length = (l) => { const x = Math.min(rim, Math.abs(l)/half); return half*(k > 0 ? Math.atan(x) : Math.atanh(x)); };
    return { chart, size, length, fit: (point, t0, t1) => curveCubics(point, t0, t1), midpoint: (P, Q) => geodesicMidpoint(geom, P, Q) };
}

// ---- Kleinian groups --------------------------------------------------------------------------

// the midpoint of a side settles in so many passes, to this fraction of the chord
const MIDPOINT_PASSES = 40;
const MIDPOINT_TOL = 1.e-9;
// the outliner of a Kleinian group keeps the disks of so many world points
const DISKS_KEPT = 4096;

const mGroupIds = new WeakMap();
let mNextGroupId = 1;
/** a number that tells the group objects apart (the key of a Kleinian outliner) */
function groupId(group){
    if (!group) return 0;
    let id = mGroupIds.get(group);
    if (!id) { id = mNextGroupId++; mGroupIds.set(group, id); }
    return id;
}

/**
 * the outliner of a Kleinian group (geodesicOutliner's members, and disk(w)): the group
 * has no absolute, but at every point of its domain of discontinuity the maximal round
 * disk there (GroupGeometry.maximalDiskFinder, the Kulkarni-Pinkall metric; the local
 * geometry the editor moves shapes by). The lines are drawn by these disks: a side is
 * the arc through its ends that is a geodesic of the disk at its own midpoint (found in
 * a few passes: the chord's middle, the disk there, the midpoint of its geodesic, the disk
 * there, ...), which the group carries, lies on the mirrors, and is the metric's geodesic
 * inside a face of the convex hull's boundary (section 4 of the assessment); a curved
 * side is the cubic of the geometry in that disk, its handles meant in the disks of their
 * nodes (a tangent vector there) and laid out again in the side's disk, so a smooth node
 * keeps its tangent; the chart of a node is its disk's; a shape is built in the disk of
 * its centre (space.at(C)), its sizes lengths of the metric in the units of the disk at
 * the pattern's origin. A side whose ends are not in one disk, or where there is no
 * disk, is straight. A moved path is not rigid (the metric has no isometries but the
 * group's): the nodes are carried and the sides drawn again where they are
 */
function kleinianOutliner(group, ptc){
    const toPattern = worldToPatternMap(ptc), fromPattern = patternToWorldMap(ptc);
    const finder = maximalDiskFinder(group);
    const disks = new Map();
    /** the maximal disk at the world point w, in world coordinates; null without one */
    function disk(w){
        const key = w[0] + ' ' + w[1];
        const had = disks.get(key);
        if (had !== undefined) return had;
        const p = toPattern.map(w[0], w[1]);
        const d = finder(p);
        const out = d ? transformedGeometry(d, fromPattern) : null;
        if (disks.size >= DISKS_KEPT) disks.delete(disks.keys().next().value);
        disks.set(key, out);
        return out;
    }
    // the unit of a shape's sizes: half the radius of the disk at the pattern's origin (or
    // at the first of a few points with a disk; a half plane there, or no disk: half the
    // pattern's unit), so that a shape's numbers are kept by the group and a shape stays
    // its size in the world when the group changes
    let half = 0.5*(fromPattern.scale || 1);
    for (const q of [[0, 0], [0.1, 0.2], [-0.2, 0.3], [0.3, -0.1]]) {
        // (the pattern's origin may lie on the limit set: the real axis of a group of the upper half plane)
        const D = disk(fromPattern.map(q[0], q[1]));
        if (D && D.kind === 'hyperbolic' && D.r > 1.e-6*(fromPattern.scale || 1)) { half = 0.5*D.r; break; }
    }

    /** the disk at the midpoint of the side from P to Q and that midpoint: {D, M}; null where the side has no arc */
    function midpoint(P, Q){
        let M = [0.5*(P[0] + Q[0]), 0.5*(P[1] + Q[1])];
        const chord = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
        if (!(chord > 0)) { const D = disk(P); return D ? { D, M } : null; }
        let D = null;
        for (let pass = 0; pass < MIDPOINT_PASSES; pass++) {
            D = disk(M);
            if (!D) return null;
            const next = geodesicMidpoint(D, P, Q);
            if (!next) return null;
            const moved = Math.hypot(next[0] - M[0], next[1] - M[1]);
            M = next;
            if (moved <= MIDPOINT_TOL*chord) return { D, M };
        }
        return { D, M };
    }
    const pieces = (P, Q) => { const m = midpoint(P, Q); return m ? geodesicCubics(m.D, P, Q) : null; };
    /**
     * the handle H of the node P carried from the disk `from` to the disk `to`: the same
     * tangent vector at P (direction and length in the metric; the canonical charts of
     * the two disks agree in direction at P); H itself when it lies outside the model
     */
    function relay(from, to, P, H){
        if (!from || !to || from === to) return H;
        const w = mobiusPointMap(canonicalChart(from, P))(H);
        if (!(w[0]*w[0] + w[1]*w[1] < 1)) return H;
        const out = mobiusPointMap(mobiusInverse(canonicalChart(to, P)))(w);
        return out.every(Number.isFinite) ? out : H;
    }
    const curve = (P0, C1, C2, P3) => {
        const m = midpoint(P0, P3);
        if (!m) return null;
        return geodesicCurveCubics(m.D, [P0, relay(disk(P0), m.D, P0, C1), relay(disk(P3), m.D, P3, C2), P3]);
    };
    const chart = (p) => {
        const D = disk(p);
        if (!D) return null;
        const s = canonicalChart(D, p);
        return { to: mobiusPointMap(s), from: mobiusPointMap(mobiusInverse(s)) };
    };
    const split = (cp, t) => {
        const m = midpoint(cp[0], cp[3]);
        if (!m) return null;
        const D0 = disk(cp[0]), D3 = disk(cp[3]);
        const r = geodesicCurveSplit(m.D, [cp[0], relay(D0, m.D, cp[0], cp[1]), relay(D3, m.D, cp[3], cp[2]), cp[3]], t);
        if (!r) return null;
        const M = r.left[3], DM = disk(M);
        return { left:  [cp[0], relay(m.D, D0, cp[0], r.left[1]), relay(m.D, DM, M, r.left[2]), M],
                 right: [M, relay(m.D, DM, M, r.right[1]), relay(m.D, D3, cp[3], r.right[2]), cp[3]] };
    };
    const space = {
        at: (C) => { const D = disk(C); return D ? shapeSpace(D, half) : null; },
        // (a box whose corners lie in no one disk is centred at the chord's middle, so the tool still draws)
        midpoint: (P, Q) => { const m = midpoint(P, Q); return m ? m.M : [0.5*(P[0] + Q[0]), 0.5*(P[1] + Q[1])]; },
    };
    return { key: `kleinian ${groupId(group)} ${ptc.centerX} ${ptc.centerY} ${ptc.scale} ${ptc.angle}`, geometry: { kind: 'euclidean', fallback: 'kleinian' },
             outline: (nodes, closed) => geodesicOutline(nodes, closed, pieces, curve), chart, split, space, disk };
}

/**
 * the outliner of a group under a pattern transform: geodesicOutliner of the group's
 * geometry, or kleinianOutliner where it has none
 */
function groupOutliner(group, ptc){
    const g = worldGeometry(group, ptc);
    return g.fallback === 'kleinian' ? kleinianOutliner(group, ptc) : geodesicOutliner(g);
}

/**
 * the maker of the outlines of the geodesic paths in a geometry
 * (worldGeometry):
 *
 *   key, geometry            the geometry and its key (geometryKey)
 *   outline(nodes, closed)   -> {nodes, source} (Paths.geodesicOutline): a
 *                            side without handles the geodesic between its
 *                            ends, a side with handles the cubic of the
 *                            geometry through its control points, both as
 *                            cubic pieces (a side from a node marked plain
 *                            the plain cubic of its handles: the arcs of the
 *                            shapes)
 *   chart(p)                 -> {to(q), from(q)}: the canonical chart of the
 *                            point p, in which p is at the origin and the
 *                            geodesics through it are straight (the edits
 *                            of a node's handles, Paths.js); null in the plane
 *   split(cp, t)             -> {left, right}: the control points of the two
 *                            halves of a curved side split at t; null in
 *                            the plane
 *   space                    where the geodesic shapes are built
 *                            (shapeSpace); null in the plane
 */
function geodesicOutliner(geom){
    const plane = geom.kind === 'euclidean';
    const pieces = (P, Q) => geodesicCubics(geom, P, Q);
    const curve = plane ? null : (P0, C1, C2, P3) => geodesicCurveCubics(geom, [P0, C1, C2, P3]);
    const chart = plane ? null : (p) => {
        const s = canonicalChart(geom, p);
        return { to: mobiusPointMap(s), from: mobiusPointMap(mobiusInverse(s)) };
    };
    const split = plane ? null : (cp, t) => geodesicCurveSplit(geom, cp, t);
    return { key: geometryKey(geom), geometry: geom, outline: (nodes, closed) => geodesicOutline(nodes, closed, pieces, curve), chart, split,
             space: shapeSpace(geom) };
}

export { worldGeometry, geometryKey, shapeSpace, geodesicOutliner, kleinianOutliner, groupOutliner };
