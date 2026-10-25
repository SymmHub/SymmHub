import {
    SPLANE_PLANE,
    generatorElements,
    worldToPatternMap,
    applyTransform,
    localScale,
    foldPoint,
    boxCopies,
} from './modules.js';

//
//  SnapIndex - snapping to the vertices of all copies of the items and to the
//  symmetry elements (mirrors, cone points) of the group
//
//  Every vertex is folded into the fundamental domain; its copies near the
//  domain (within the snap radius of its bounding box) go into a uniform grid,
//  all in pattern coordinates. A query folds the pointer into the domain the
//  same way, finds the nearest stored point and maps it back to the copy the
//  pointer is on - so a vertex snaps to every copy of every vertex, its own
//  copies included, which is snapping to a symmetry element when the copy is
//  of the point being dragged; that point is left out of the index, and the
//  mirrors and cone points of the generators are offered instead.
//
//  build() once per drag (the radius follows the zoom), query() per pointer move.
//

const SNAP_VERTEX = 'vertex';
const SNAP_CONE = 'cone';
const SNAP_MIRROR = 'mirror';

/** the bounding box of the fundamental domain, from folded points of the pattern box */
function domainBox(group){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const n = 12;
    for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
            const p = foldPoint(group, [-1 + 2*i/n, -1 + 2*j/n]).pnt;
            if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
            x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
            x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
        }
    }
    return [x0, y0, x1, y1];
}

/** the point of the splane (line or circle) nearest to p, and its distance */
function nearestOnSplane(sp, p){
    const v = sp.v;
    if (sp.type === SPLANE_PLANE) {
        const t = v[0]*p[0] + v[1]*p[1] - v[3];
        const q = [p[0] - t*v[0], p[1] - t*v[1]];
        return { pnt: q, dist: Math.abs(t) };
    }
    const dx = p[0] - v[0], dy = p[1] - v[1], d = Math.hypot(dx, dy);
    const r = Math.abs(v[3]);
    if (d < 1.e-12) return { pnt: [v[0] + r, v[1]], dist: r };
    return { pnt: [v[0] + r*dx/d, v[1] + r*dy/d], dist: Math.abs(d - r) };
}

function SnapIndex() {

    let mGroup = null;
    let mCell = 1;
    let mGrid = new Map();
    let mCones = [];
    let mMirrors = [];

    function key(ix, iy){
        return ix + ',' + iy;
    }

    /**
     * index the vertices of the items
     *   items:   document items (world coordinates)
     *   group:   the group in pattern coordinates
     *   ptc:     the pattern transform
     *   radius:  snap radius in pattern units, at the domain
     *   exclude: {itemId, vertex} to leave out (the point being dragged), or null
     */
    function build({ items, group, ptc, radius, exclude = null }){
        mGroup = group;
        mCell = Math.max(radius, 1.e-9);
        mGrid = new Map();
        mCones = [];
        mMirrors = [];
        const toPattern = worldToPatternMap(ptc);
        const copies = boxCopies(group);
        const box = group ? domainBox(group) : [-Infinity, -Infinity, Infinity, Infinity];
        const m = 2*radius;
        const near = (q) => q[0] >= box[0] - m && q[0] <= box[2] + m && q[1] >= box[1] - m && q[1] <= box[3] + m;

        for (const item of items) {
            const pts = item.points;
            for (let i = 0; i + 1 < pts.length; i += 2) {
                const vertex = i/2;
                if (exclude && exclude.itemId === item.id && exclude.vertex === vertex) continue;
                const s = toPattern.map(pts[i], pts[i + 1]);
                const p = foldPoint(group, s).pnt;
                for (const c of copies) {
                    const q = applyTransform(c.fromFD, p);
                    if (!near(q)) continue;
                    const k = key(Math.floor(q[0]/mCell), Math.floor(q[1]/mCell));
                    if (!mGrid.has(k)) mGrid.set(k, []);
                    mGrid.get(k).push({ pnt: q, kind: SNAP_VERTEX, itemId: item.id, vertex });
                }
            }
        }

        if (group) {
            try {
                for (const e of generatorElements({ group })) {
                    if (e.kind === 'cone' && e.center) mCones.push({ pnt: e.center, order: e.order });
                    if (e.kind === 'mirror' && e.axis) mMirrors.push(e.axis);
                }
            } catch (err) {
                // a group without pairing generators in this form: no element snapping
            }
        }
    }

    /**
     * the snap target for the pointer at s (pattern coordinates) within
     * radius (pattern units at s): {pnt (pattern coordinates, next to s),
     * kind, itemId, vertex} or null
     */
    function query(s, radius){
        const f = foldPoint(mGroup, s);
        const p = f.pnt;
        const r = radius*localScale(f.transform, s);
        let best = null, bestD = r;

        const ix = Math.floor(p[0]/mCell), iy = Math.floor(p[1]/mCell);
        const reach = Math.ceil(r/mCell);
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dy = -reach; dy <= reach; dy++) {
                const cell = mGrid.get(key(ix + dx, iy + dy));
                if (!cell) continue;
                for (const e of cell) {
                    const d = Math.hypot(e.pnt[0] - p[0], e.pnt[1] - p[1]);
                    if (d <= bestD) { bestD = d; best = e; }
                }
            }
        }
        if (!best) {
            for (const c of mCones) {
                const d = Math.hypot(c.pnt[0] - p[0], c.pnt[1] - p[1]);
                if (d <= bestD) { bestD = d; best = { pnt: c.pnt, kind: SNAP_CONE, order: c.order }; }
            }
        }
        if (!best) {
            for (const sp of mMirrors) {
                const n = nearestOnSplane(sp, p);
                if (n.dist <= bestD) { bestD = n.dist; best = { pnt: n.pnt, kind: SNAP_MIRROR }; }
            }
        }
        if (!best) return null;
        const back = f.transform ? applyTransform(f.transform.getInverse(), best.pnt) : best.pnt;
        return { ...best, pnt: back };
    }

    return { build, query };

} // function SnapIndex()

export { SnapIndex, SNAP_VERTEX, SNAP_CONE, SNAP_MIRROR };
