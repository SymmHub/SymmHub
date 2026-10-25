import {
    iPoint,
    CrownCalculator,
    elementKey,
    sameElement,
} from './modules.js';

//
//  points and items under the group, in pattern coordinates
//
//  The group acts on the pattern coordinates (the pattern box is [-1,1]^2),
//  as PatternDrawing receives it. Every map is an ITransform, a chain of
//  reflections in lines or circles, so nothing here assumes isometries.
//
//  A click (or a vertex) p is folded into the fundamental domain by k; the
//  copies of the domain that cover the pattern box are the elements boxCopies()
//  finds; an item lies in the box at its fold element h. The copy of an item
//  the user sees around p is then reached by the frame
//      c = h^-1 . T^-1 . k     (apply k, then T^-1, then h^-1)
//  which maps the neighbourhood of p (pattern coordinates) onto the item's own
//  place (pattern coordinates); c^-1 maps the item onto that copy.
//

const MAX_FOLD_ITERATIONS = 200;
const BOX_PTC = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
const EPS_SCALE = 1.e-4;
// most copies of the domain the editor looks at (the tiles of the box)
const MAX_COPIES = 1000;
// the grid the shown region is sampled on
const SHOWN_GRID = 64;

/** an ITransform applied to [x, y] */
function applyTransform(t, p){
    if (!t) return [p[0], p[1]];
    const q = t.transform(iPoint([p[0], p[1]]));
    return [q.v[0], q.v[1]];
}

/** the transforms applied one after the other, as one ITransform */
function composeTransforms(...ts){
    const list = ts.filter(Boolean);
    if (!list.length) return null;
    const r = list[0].getCopy();
    for (let i = 1; i < list.length; i++) r.concat(list[i]);
    return r;
}

/** |t'| at p, from the image of a small step */
function localScale(t, p){
    if (!t) return 1;
    const p0 = applyTransform(t, p);
    const px = applyTransform(t, [p[0] + EPS_SCALE, p[1]]);
    const py = applyTransform(t, [p[0], p[1] + EPS_SCALE]);
    const s = 0.5*(Math.hypot(px[0] - p0[0], px[1] - p0[1]) + Math.hypot(py[0] - p0[0], py[1] - p0[1]))/EPS_SCALE;
    return (Number.isFinite(s) && s > 0) ? s : 1;
}

/** the point folded into the fundamental domain: {pnt, transform k} (k maps p to pnt) */
function foldPoint(group, p){
    if (!group) return { pnt: [p[0], p[1]], transform: null };
    const res = group.toFundDomain({ pnt: iPoint([p[0], p[1]]), maxIterations: MAX_FOLD_ITERATIONS });
    return { pnt: [res.pnt.v[0], res.pnt.v[1]], transform: res.transform };
}

/**
 * the copies of the fundamental domain covering the pattern box: for each,
 * fromFD maps the domain onto the copy (the identity is among them when the
 * domain meets the box)
 */
function boxCopies(group){
    if (!group) return [{ fromFD: null, toFD: null }];
    return CrownCalculator.calculate(group, BOX_PTC, { gridRadius: 15, maxIterations: MAX_FOLD_ITERATIONS, maxCount: MAX_COPIES })
        .map(t => ({ toFD: t, fromFD: t.getInverse() }));
}

/**
 * the shown region: the part of the pattern box that Color Images shows at
 * every copy, the box within the domain and the copies of it its crown draws
 * (the copies nearest tiles of the box, as Color Images takes them; 0 when
 * no layer draws a crown). Content there is shown where it is, each copy in
 * its own colour, so an item inside needs no folding. Sampled on a grid of
 * cells; a cell counts when its corners fold into the domain from shown
 * copies.
 * returns {containsBox([x0, y0, x1, y1]): true when the box (pattern
 *          coordinates) lies in shown cells,
 *          copies: [{toFD, fromFD}] the shown copies, nearest first, the
 *          domain itself (null maps) first}
 */
function shownRegion(group, copies){
    if (!group) return { containsBox: () => false, copies: [{ fromFD: null, toFD: null }] };
    const shown = [{ toFD: null, fromFD: null }];
    const keys = [elementKey(null)];
    if (copies > 0) {
        // the crown's tiles, the domain itself (found by the crown too) once
        CrownCalculator.calculate(group, BOX_PTC, { gridRadius: 15, maxIterations: MAX_FOLD_ITERATIONS, maxCount: copies })
            .slice(0, copies).forEach(t => {
                const key = elementKey(t);
                if (keys.some(k => sameElement(k, key))) return;
                shown.push({ toFD: t, fromFD: t.getInverse() });
                keys.push(key);
            });
    }
    const n = SHOWN_GRID;
    const node = new Uint8Array((n + 1)*(n + 1));
    for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
            const key = elementKey(foldPoint(group, [-1 + 2*i/n, -1 + 2*j/n]).transform);
            node[j*(n + 1) + i] = keys.some(k => sameElement(k, key)) ? 1 : 0;
        }
    }
    const cell = new Uint8Array(n*n);
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const a = j*(n + 1) + i;
            cell[j*n + i] = node[a] & node[a + 1] & node[a + n + 1] & node[a + n + 2];
        }
    }
    const index = (v) => Math.min(n - 1, Math.floor((v + 1)*n/2));
    function containsBox(b){
        if (!(b[0] >= -1 && b[1] >= -1 && b[2] <= 1 && b[3] <= 1)) return false;
        for (let j = index(b[1]); j <= index(b[3]); j++) {
            for (let i = index(b[0]); i <= index(b[2]); i++) if (!cell[j*n + i]) return false;
        }
        return true;
    }
    return { containsBox, copies: shown };
}

/** squared distance from p to the segment ab */
function segmentDistance2(p, ax, ay, bx, by){
    const dx = bx - ax, dy = by - ay;
    const len2 = dx*dx + dy*dy;
    let t = len2 > 0 ? ((p[0] - ax)*dx + (p[1] - ay)*dy)/len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t*dx - p[0], qy = ay + t*dy - p[1];
    return qx*qx + qy*qy;
}

/** inside the closed polygon (even-odd) */
function insidePolygon(p, pts){
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
        const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
        if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi)*(p[1] - yi)/(yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

/**
 * does the point p hit the polyline pts (pattern coordinates) within tol,
 * on its stroke or, for a closed filled item, inside it
 */
function hitsPolyline(p, pts, closed, filled, tol){
    const n = pts.length;
    const tol2 = tol*tol;
    for (let i = 0; i + 3 < n; i += 2) {
        if (segmentDistance2(p, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= tol2) return true;
    }
    if (closed && n >= 4 && segmentDistance2(p, pts[n - 2], pts[n - 1], pts[0], pts[1]) <= tol2) return true;
    return closed && filled && n >= 6 && insidePolygon(p, pts);
}

/** the vertex of pts (pattern coordinates) nearest to p within tol, or -1 */
function nearestVertex(p, pts, tol){
    let best = -1, bestD = tol*tol;
    for (let i = 0; i + 1 < pts.length; i += 2) {
        const dx = pts[i] - p[0], dy = pts[i + 1] - p[1];
        const d = dx*dx + dy*dy;
        if (d <= bestD) { bestD = d; best = i/2; }
    }
    return best;
}

/** the segment of pts nearest to p within tol: {index (of its first vertex), point}, or null */
function nearestSegment(p, pts, closed, tol){
    let best = null, bestD = tol*tol;
    const n = pts.length/2;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
        const j = (i + 1) % n;
        const ax = pts[2*i], ay = pts[2*i + 1], bx = pts[2*j], by = pts[2*j + 1];
        const d = segmentDistance2(p, ax, ay, bx, by);
        if (d <= bestD) {
            const dx = bx - ax, dy = by - ay, len2 = dx*dx + dy*dy;
            const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax)*dx + (p[1] - ay)*dy)/len2)) : 0;
            bestD = d;
            best = { index: i, point: [ax + t*dx, ay + t*dy] };
        }
    }
    return best;
}

export {
    applyTransform,
    composeTransforms,
    localScale,
    foldPoint,
    boxCopies,
    shownRegion,
    hitsPolyline,
    nearestVertex,
    nearestSegment,
};
