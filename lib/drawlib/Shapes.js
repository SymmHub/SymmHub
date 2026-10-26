//
//  parametric shapes: an item with
//
//    shape: { kind: 'rect' | 'ellipse' | 'polygon' | 'star' | 'spiral',
//             cx, cy, rx, ry, angle, round, n, ratio, phase, dir }
//
//  keeps its numbers, and its outline (nodes or points) is made from them
//  (shapeGeometry; DrawingDocument.normalizeItem does it at every change),
//  so that the numbers can be edited afterwards. Every kind lives on an
//  ellipse frame: cx, cy its centre, rx, ry the half sizes along its axes,
//  angle that of the first axis (radians). A rect has round, its corner
//  radius as a fraction of the shorter half size; a polygon n corners on
//  the ellipse from the parameter phase on; a star n points on the ellipse
//  and n more at the fraction ratio of it between them; a spiral n turns
//  from the centre out to the ellipse, from phase on, turning with dir
//  (+1 counterclockwise). Under an affine map the numbers follow
//  (shapeMapped): an ellipse's frame goes to the image ellipse's, a polygon,
//  star or spiral with it (its phase found again in the new frame), a rect
//  only while its sides stay at right angles; under any other map the item
//  is a plain path from then on. An edit of the outline itself (a vertex, a
//  handle) drops the shape too.
//

const KAPPA = 4*(Math.SQRT2 - 1)/3;   // a quarter circle as a cubic: the handle length
const SPIRAL_STEPS = 24;              // points per turn
const EPS = 1e-9;

const SHAPE_KINDS = ['rect', 'ellipse', 'polygon', 'star', 'spiral'];

function isShape(shape){
    return !!shape && SHAPE_KINDS.includes(shape.kind);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** the shape's numbers complete, as the document keeps them */
function normalShape(shape){
    const kind = SHAPE_KINDS.includes(shape.kind) ? shape.kind : 'rect';
    const s = { kind, cx: +shape.cx || 0, cy: +shape.cy || 0,
                rx: Math.max(EPS, Math.abs(+shape.rx || 0)), ry: Math.max(EPS, Math.abs(+shape.ry || 0)), angle: +shape.angle || 0 };
    if (kind === 'rect') s.round = clamp(+shape.round || 0, 0, 1);
    if (kind === 'polygon' || kind === 'star' || kind === 'spiral') {
        s.n = Math.max(kind === 'spiral' ? 1 : (kind === 'star' ? 2 : 3), Math.round(+shape.n || 5));
        s.phase = Number.isFinite(+shape.phase) ? +shape.phase : (kind === 'spiral' ? 0 : Math.PI/2);
    }
    if (kind === 'star') s.ratio = clamp(+shape.ratio || 0.5, 0.01, 1);
    if (kind === 'spiral') s.dir = (+shape.dir < 0) ? -1 : 1;
    return s;
}

/** a shape of a kind in the box [x0, y0, x1, y1], its axes along the world's; cfg: n, ratio, round */
function shapeFromBox(kind, x0, y0, x1, y1, cfg = {}){
    return normalShape({ kind, cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), rx: 0.5*Math.abs(x1 - x0), ry: 0.5*Math.abs(y1 - y0), angle: 0,
                         round: cfg.round, n: cfg.n, ratio: cfg.ratio });
}

/** the world point of the shape's frame at the parameter t, a fraction f of the way out */
function pointAt(s, t, f = 1){
    const c = Math.cos(s.angle), sn = Math.sin(s.angle);
    const x = f*s.rx*Math.cos(t), y = f*s.ry*Math.sin(t);
    return [s.cx + x*c - y*sn, s.cy + x*sn + y*c];
}

/** the outline of a shape: {closed, nodes} for curves, {closed, points} for straight segments */
function shapeGeometry(shape){
    const s = normalShape(shape);
    const c = Math.cos(s.angle), sn = Math.sin(s.angle);
    const at = (x, y) => [s.cx + x*c - y*sn, s.cy + x*sn + y*c];     // a local point
    const dir = (x, y) => [x*c - y*sn, x*sn + y*c];                   // a local vector
    switch (s.kind) {
    case 'ellipse': {
        const nodes = [];
        for (let k = 0; k < 4; k++) {
            const t = Math.PI*k/2, ct = Math.cos(t), st = Math.sin(t);
            const p = at(s.rx*ct, s.ry*st), d = dir(-s.rx*st*KAPPA, s.ry*ct*KAPPA);
            nodes.push({ p, h1: [p[0] - d[0], p[1] - d[1]], h2: [p[0] + d[0], p[1] + d[1]], smooth: true });
        }
        return { closed: true, nodes };
    }
    case 'polygon': {
        const points = [];
        for (let k = 0; k < s.n; k++) points.push(...pointAt(s, s.phase + 2*Math.PI*k/s.n));
        return { closed: true, points };
    }
    case 'star': {
        const points = [];
        for (let k = 0; k < 2*s.n; k++) points.push(...pointAt(s, s.phase + Math.PI*k/s.n, (k % 2) ? s.ratio : 1));
        return { closed: true, points };
    }
    case 'spiral': {
        const count = Math.round(s.n*SPIRAL_STEPS), points = [];
        for (let k = 0; k <= count; k++) points.push(...pointAt(s, s.phase + s.dir*2*Math.PI*s.n*k/count, k/count));
        return { closed: false, points };
    }
    default: {
        const r = s.round*Math.min(s.rx, s.ry);
        if (r <= 0) return { closed: true, points: [...at(s.rx, s.ry), ...at(-s.rx, s.ry), ...at(-s.rx, -s.ry), ...at(s.rx, -s.ry)] };
        // the corners rounded by arcs
        const nodes = [];
        const centres = [[s.rx - r, s.ry - r], [-s.rx + r, s.ry - r], [-s.rx + r, -s.ry + r], [s.rx - r, -s.ry + r]];
        centres.forEach((o, k) => {
            const t0 = Math.PI*k/2, t1 = t0 + Math.PI/2;
            const pa = at(o[0] + r*Math.cos(t0), o[1] + r*Math.sin(t0)), pb = at(o[0] + r*Math.cos(t1), o[1] + r*Math.sin(t1));
            const da = dir(-KAPPA*r*Math.sin(t0), KAPPA*r*Math.cos(t0)), db = dir(-KAPPA*r*Math.sin(t1), KAPPA*r*Math.cos(t1));
            nodes.push({ p: pa, h1: null, h2: [pa[0] + da[0], pa[1] + da[1]] });
            nodes.push({ p: pb, h1: [pb[0] - db[0], pb[1] - db[1]], h2: null });
        });
        return { closed: true, nodes };
    }
    }
}

/**
 * the shape after a map of the plane (world to world), or null when the
 * map is not affine or does not keep the kind (a rect's sides must stay at
 * right angles; every other kind follows its ellipse frame)
 */
function shapeMapped(shape, map){
    const s = normalShape(shape);
    const c = Math.cos(s.angle), sn = Math.sin(s.angle);
    const cm = map([s.cx, s.cy]);
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const u = sub(map([s.cx + s.rx*c, s.cy + s.rx*sn]), cm);          // the image of the first half axis
    const v = sub(map([s.cx - s.ry*sn, s.cy + s.ry*c]), cm);          // of the second
    const w = sub(map([s.cx + s.rx*c - s.ry*sn, s.cy + s.rx*sn + s.ry*c]), cm);
    const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
    if (Math.hypot(w[0] - u[0] - v[0], w[1] - u[1] - v[1]) > EPS*(lu + lv)) return null;
    if (lu < EPS || lv < EPS) return null;
    if (s.kind === 'rect') {
        if (Math.abs(u[0]*v[0] + u[1]*v[1]) > EPS*lu*lv) return null;
        return { ...s, cx: cm[0], cy: cm[1], rx: lu, ry: lv, angle: Math.atan2(u[1], u[0]) };
    }
    // the ellipse {cm + cos t u + sin t v}: its axes are the singular values of [u v]
    const a = u[0], b = v[0], cc = u[1], d = v[1];
    const E = 0.5*(a + d), F = 0.5*(a - d), G = 0.5*(cc + b), H = 0.5*(cc - b);
    const Q = Math.hypot(E, H), R = Math.hypot(F, G);
    const a1 = Math.atan2(G, F), a2 = Math.atan2(H, E);
    const out = { ...s, cx: cm[0], cy: cm[1], rx: Q + R, ry: Math.max(EPS, Math.abs(Q - R)), angle: 0.5*(a2 + a1) };
    if (s.kind === 'ellipse') return out;
    // the parameter of a mapped point in the new frame
    const oc = Math.cos(out.angle), os = Math.sin(out.angle);
    const param = q => { const dx = q[0] - cm[0], dy = q[1] - cm[1]; return Math.atan2((-dx*os + dy*oc)/out.ry, (dx*oc + dy*os)/out.rx); };
    if (s.kind === 'spiral') {
        // a reflection turns it the other way; the end point gives the phase
        out.dir = s.dir*((a*d - b*cc) < 0 ? -1 : 1);
        const tEnd = s.phase + s.dir*2*Math.PI*s.n;
        out.phase = param(map(pointAt(s, tEnd, 1))) - out.dir*2*Math.PI*s.n;
        return out;
    }
    out.phase = param(map(pointAt(s, s.phase, 1)));
    return out;
}

export { SHAPE_KINDS, isShape, normalShape, shapeFromBox, shapeGeometry, shapeMapped };
