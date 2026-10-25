import {
    iPoint,
    CrownCalculator,
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

// most tiles an item's box meets that the editor looks at, and the grid
// radius of their search (the walk finds the rest)
const ITEM_COPIES = 16;
const ITEM_GRID_RADIUS = 7;

/**
 * the copies of the domain meeting an item's box, nearest first: the tiles a
 * sprite is shown through. box: {cx, cy, half} in pattern coordinates
 */
function itemCopies(group, box){
    if (!group) return [{ fromFD: null, toFD: null }];
    return CrownCalculator.calculate(group, { centerX: box.cx, centerY: box.cy, scale: box.half, angle: 0 },
                                     { gridRadius: ITEM_GRID_RADIUS, maxIterations: MAX_FOLD_ITERATIONS, maxCount: ITEM_COPIES })
        .map(t => ({ toFD: t, fromFD: t.getInverse() }));
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
    itemCopies,
    hitsPolyline,
    nearestVertex,
    nearestSegment,
};
