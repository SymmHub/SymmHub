//
//  parametric shapes: an item with
//
//    shape: { kind: 'rect' | 'ellipse' | 'polygon' | 'star' | 'spiral',
//             cx, cy, rx, ry, angle, round, skew, n, ratio, twist, curved,
//             handles, smooth, phase, dir }
//
//  keeps its numbers, and its outline (nodes or points) is made from them
//  (shapeGeometry; DrawingDocument.normalizeItem does it at every change),
//  so that the numbers can be edited afterwards (the node tool). A shape
//  keeps its kind for good: a rect stays a rect, a star a star. Every kind
//  lives on an ellipse frame: cx, cy its centre, rx, ry the half sizes
//  along its axes, angle that of the first axis (radians). A rect has
//  round, its corner radius as a fraction of the shorter half size, and
//  skew, its shear: the point (x, y) of its frame stands x + skew y along
//  the first axis (a parallelogram; none unless a map sheared it); a
//  polygon n corners on the ellipse from the parameter phase on; a star n
//  outer corners on the ellipse from phase on and n inner ones at the
//  fraction ratio of it (its aspect), the k-th at k + 1/2 + twist steps of
//  2 pi/n from phase (twist 0: halfway between two outer corners, 0.5: at
//  the next one's angle, 1: halfway between the next two; below 0
//  clockwise); a curved polygon or star (curved) joins its corners by
//  cubics, every outer corner with the same two handles and every inner
//  one too: handles {o1, o2} and a star's {i1, i2}, each [radial,
//  tangential] from its corner in the unit frame turned to the corner's
//  direction (1: incoming, 2: outgoing; kept when the shape is made
//  straight again), and smooth {o} and a star's {i}: the corners of a kind
//  whose handles stay in line when one is dragged (a smooth node of a path;
//  else a sharp corner, whose handles move apart; not given, found from the
//  handles); a spiral n turns from the centre
//  out to the ellipse, from phase on, turning with dir (+1
//  counterclockwise). Under an affine map the numbers follow (shapeMapped):
//  an ellipse's frame goes to the image ellipse's, a polygon, star or
//  spiral with it (its phase found again in the new frame, a reflection
//  turning a star's twist, the corners' handles and a spiral the other way), a
//  rect's frame with its skew. A map that is not affine
//  (the copies of a curved geometry) is taken as its affine approximation
//  at the shape's centre, so the shape keeps its kind there too.
//

const KAPPA = 4*(Math.SQRT2 - 1)/3;   // a quarter circle as a cubic: the handle length
const SPIRAL_STEPS = 24;              // points per turn
const EPS = 1e-9;
const MAX_SKEW = 1e3;
const MAX_TWIST = 1e3;
const MAX_HANDLE = 1e3;
const IN_LINE = 1e-6;                 // the sine of the angle below which two handles are in line

const SHAPE_KINDS = ['rect', 'ellipse', 'polygon', 'star', 'spiral'];

function isShape(shape){
    return !!shape && SHAPE_KINDS.includes(shape.kind);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** the kinds of corner of a polygon or star: 'o' outer, and a star's 'i' inner */
function cornerKinds(s){
    return s.kind === 'star' ? ['o', 'i'] : ['o'];
}

/**
 * a polygon's or star's handles, complete: those given, the rest
 * tangential, a third of a side long (a smooth outline); a side of a star
 * from an outer corner to the next inner one
 */
function cornerHandles(h, s){
    let side;
    if (s.kind === 'star') {
        const a = 2*Math.PI*(0.5 + (s.twist || 0))/s.n;
        side = Math.hypot(1 - s.ratio*Math.cos(a), s.ratio*Math.sin(a));
    } else {
        side = 2*Math.sin(Math.PI/s.n);
    }
    const L = Math.max(0.02, side/3);
    const out = {};
    for (const c of cornerKinds(s)) {
        for (const [k, q] of [['1', -L], ['2', L]]) {
            const v = h && h[c + k];
            out[c + k] = (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))
                ? [clamp(+v[0], -MAX_HANDLE, MAX_HANDLE), clamp(+v[1], -MAX_HANDLE, MAX_HANDLE)] : [0, q];
        }
    }
    return out;
}

/** are a corner's two handles in line, on either side of it (a nil one is in line with any) */
function inLine(a, b){
    const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    if (la < EPS || lb < EPS) return true;
    return Math.abs(a[0]*b[1] - a[1]*b[0]) <= IN_LINE*la*lb && a[0]*b[0] + a[1]*b[1] < 0;
}

/** which kinds of corner are smooth: as given, else as their handles are (in line: smooth) */
function cornerSmooth(sm, s){
    const out = {};
    for (const c of cornerKinds(s)) {
        out[c] = typeof (sm && sm[c]) === 'boolean' ? sm[c] : inLine(s.handles[c + '1'], s.handles[c + '2']);
    }
    return out;
}

/** the shape's numbers complete, as the document keeps them */
function normalShape(shape){
    const kind = SHAPE_KINDS.includes(shape.kind) ? shape.kind : 'rect';
    const s = { kind, cx: +shape.cx || 0, cy: +shape.cy || 0,
                rx: Math.max(EPS, Math.abs(+shape.rx || 0)), ry: Math.max(EPS, Math.abs(+shape.ry || 0)), angle: +shape.angle || 0 };
    if (kind === 'rect') {
        s.round = clamp(+shape.round || 0, 0, 1);
        const skew = clamp(+shape.skew || 0, -MAX_SKEW, MAX_SKEW);
        if (Math.abs(skew) > EPS) s.skew = skew;
    }
    if (kind === 'polygon' || kind === 'star' || kind === 'spiral') {
        s.n = Math.max(kind === 'spiral' ? 1 : (kind === 'star' ? 2 : 3), Math.round(+shape.n || 5));
        s.phase = Number.isFinite(+shape.phase) ? +shape.phase : (kind === 'spiral' ? 0 : Math.PI/2);
    }
    if (kind === 'star') {
        s.ratio = Number.isFinite(+shape.ratio) ? clamp(+shape.ratio, 0, 2) : 0.5;
        const twist = clamp(+shape.twist || 0, -MAX_TWIST, MAX_TWIST);
        if (Math.abs(twist) > EPS) s.twist = twist;
    }
    if (kind === 'polygon' || kind === 'star') {
        if (shape.curved) s.curved = true;
        if (s.curved || shape.handles) {
            s.handles = cornerHandles(shape.handles, s);
            s.smooth = cornerSmooth(shape.smooth, s);
        }
    }
    if (kind === 'spiral') s.dir = (+shape.dir < 0) ? -1 : 1;
    return s;
}

/** a shape of a kind in the box [x0, y0, x1, y1], its axes along the world's; cfg: n, ratio, round */
function shapeFromBox(kind, x0, y0, x1, y1, cfg = {}){
    return normalShape({ kind, cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), rx: 0.5*Math.abs(x1 - x0), ry: 0.5*Math.abs(y1 - y0), angle: 0,
                         round: cfg.round, n: cfg.n, ratio: cfg.ratio });
}

/**
 * a shape of a kind round about (cx, cy), its frame a circle of radius r
 * whose first axis, at the angle, goes through its first corner; cfg: n,
 * ratio, twist, curved, smoothO and smoothI (its corners smooth, outer and
 * inner)
 */
function shapeFromCentre(kind, cx, cy, r, angle, cfg = {}){
    return normalShape({ kind, cx, cy, rx: r, ry: r, angle, phase: 0, n: cfg.n, ratio: cfg.ratio, twist: cfg.twist, curved: cfg.curved,
                         smooth: { o: cfg.smoothO, i: cfg.smoothI } });
}

/**
 * the point of a polygon's or star's k-th corner, outer or (a star's)
 * inner, or of its handle h (1: incoming, 2: outgoing) in the unit frame:
 * [x, y] (the frame's point [rx x, ry y])
 */
function cornerPoint(s, k, inner, h = 0){
    const t = s.phase + 2*Math.PI*(k + (inner ? 0.5 + (s.twist || 0) : 0))/s.n;
    const f = inner ? s.ratio : 1, c = Math.cos(t), sn = Math.sin(t);
    if (!h || !s.handles) return [f*c, f*sn];
    const [r, q] = s.handles[(inner ? 'i' : 'o') + h];
    return [f*c + r*c - q*sn, f*sn + r*sn + q*c];
}

/**
 * the shape with its corners of a kind ('o' outer, 'i' inner) smooth or
 * sharp; made smooth, their handles are put in line, along the way from the
 * incoming one to the outgoing one, their lengths kept
 */
function cornersSmoothed(shape, c, smooth){
    const s = normalShape(shape);
    if (!s.smooth || !(c in s.smooth)) return s;
    const out = { ...s, smooth: { ...s.smooth, [c]: !!smooth } };
    if (!smooth) return out;
    const a = s.handles[c + '1'], b = s.handles[c + '2'];
    let d = [b[0] - a[0], b[1] - a[1]];
    if (Math.hypot(d[0], d[1]) < EPS) d = [0, 1];
    const len = Math.hypot(d[0], d[1]), la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    out.handles = { ...s.handles, [c + '1']: [-d[0]/len*la, -d[1]/len*la], [c + '2']: [d[0]/len*lb, d[1]/len*lb] };
    return out;
}

/** the world point of the point (x, y) of the shape's frame: x (+ skew y) along its first axis, y along the second */
function shapePoint(s, x, y){
    const c = Math.cos(s.angle), sn = Math.sin(s.angle), xs = x + (s.skew || 0)*y;
    return [s.cx + xs*c - y*sn, s.cy + xs*sn + y*c];
}

/** the point (x, y) of the shape's frame at the world point p */
function shapeLocal(s, p){
    const c = Math.cos(s.angle), sn = Math.sin(s.angle);
    const dx = p[0] - s.cx, dy = p[1] - s.cy;
    const y = -dx*sn + dy*c;
    return [dx*c + dy*sn - (s.skew || 0)*y, y];
}

/** the world point of the shape's frame at the parameter t, a fraction f of the way out */
function pointAt(s, t, f = 1){
    return shapePoint(s, f*s.rx*Math.cos(t), f*s.ry*Math.sin(t));
}

/** the outline of a shape: {closed, nodes} for curves, {closed, points} for straight segments */
function shapeGeometry(shape){
    const s = normalShape(shape);
    const c = Math.cos(s.angle), sn = Math.sin(s.angle), k = s.skew || 0;
    const at = (x, y) => shapePoint(s, x, y);                                     // a local point
    const dir = (x, y) => [(x + k*y)*c - y*sn, (x + k*y)*sn + y*c];               // a local vector
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
    case 'polygon':
    case 'star': {
        const P = (q) => at(s.rx*q[0], s.ry*q[1]);
        const kinds = s.kind === 'star' ? [false, true] : [false];
        if (s.curved) {
            // the nodes of smooth corners smooth, as a path's
            const nodes = [];
            for (let k = 0; k < s.n; k++) {
                for (const inner of kinds) {
                    nodes.push({ p: P(cornerPoint(s, k, inner)), h1: P(cornerPoint(s, k, inner, 1)), h2: P(cornerPoint(s, k, inner, 2)),
                                 ...(s.smooth[inner ? 'i' : 'o'] ? { smooth: true } : {}) });
                }
            }
            return { closed: true, nodes };
        }
        const points = [];
        for (let k = 0; k < s.n; k++) for (const inner of kinds) points.push(...P(cornerPoint(s, k, inner)));
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
 * the shape after a map of the plane (world to world), of the same kind: an
 * affine map's image (null when the map is not affine), or with
 * approximate the image under the map's affine approximation at the
 * shape's centre, for any map
 */
function shapeMapped(shape, map, approximate = false){
    const s = normalShape(shape);
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    // the frame's half axes, to its points (rx, 0) and (0, ry), and their images u, v
    const C = [s.cx, s.cy];
    const U = sub(shapePoint(s, s.rx, 0), C), V = sub(shapePoint(s, 0, s.ry), C);
    const cm = map(C);
    let u, v;
    if (approximate) {
        // across the frame both ways: exact for an affine map
        u = sub(map(add(C, U)), map(sub(C, U))).map(x => 0.5*x);
        v = sub(map(add(C, V)), map(sub(C, V))).map(x => 0.5*x);
    } else {
        u = sub(map(add(C, U)), cm);
        v = sub(map(add(C, V)), cm);
        const w = sub(map(add(add(C, U), V)), cm);
        if (Math.hypot(w[0] - u[0] - v[0], w[1] - u[1] - v[1]) > EPS*(Math.hypot(u[0], u[1]) + Math.hypot(v[0], v[1]))) return null;
    }
    const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
    if (!approximate && (lu < EPS || lv < EPS)) return null;
    // the affine map taking the frame to its image: q = C + a U + b V goes to cm + a u + b v
    const det = U[0]*V[1] - U[1]*V[0];
    const affine = q => {
        const d = sub(q, C), a = (d[0]*V[1] - d[1]*V[0])/det, b = (U[0]*d[1] - U[1]*d[0])/det;
        return [cm[0] + a*u[0] + b*v[0], cm[1] + a*u[1] + b*v[1]];
    };
    if (s.kind === 'rect') {
        // the first axis along u, v split along it and across it; a
        // reflection is taken back, as the rect is symmetric across its first axis
        const t = lu > EPS ? [u[0]/lu, u[1]/lu] : [1, 0];
        let along = v[0]*t[0] + v[1]*t[1], across = -v[0]*t[1] + v[1]*t[0];
        if (across < 0) { along = -along; across = -across; }
        if (!approximate && across < EPS*lv) return null;
        const ry = Math.max(EPS, across);
        return normalShape({ ...s, cx: cm[0], cy: cm[1], rx: lu, ry, angle: Math.atan2(t[1], t[0]), skew: along/ry });
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
        out.phase = param(affine(pointAt(s, tEnd, 1))) - out.dir*2*Math.PI*s.n;
        return out;
    }
    out.phase = param(affine(pointAt(s, s.phase, 1)));
    if ((a*d - b*cc) < 0) {
        // a reflection: the outline runs the other way, each corner's handles
        // swap and turn about its direction
        if (s.twist) out.twist = -s.twist;
        if (s.handles) {
            const m = ([r, q]) => [r, -q], h = s.handles;
            out.handles = {};
            for (const c of cornerKinds(s)) { out.handles[c + '1'] = m(h[c + '2']); out.handles[c + '2'] = m(h[c + '1']); }
        }
    }
    return out;
}

export { SHAPE_KINDS, isShape, normalShape, shapeFromBox, shapeFromCentre, cornerPoint, cornersSmoothed, shapePoint, shapeLocal, shapeGeometry, shapeMapped };
