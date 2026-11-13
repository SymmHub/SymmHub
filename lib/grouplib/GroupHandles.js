import {
    SPLANE_SPHERE,
    SPLANE_PLANE,
    iSphere,
    iPlane,
    iReflectU4,
    getAngle,
    getRollingSplane,
    splaneIntersections,
} from './modules.js';

/*
  GroupHandles.js — the on-screen handles of the group makers, in the makers'
  coordinates (docs/symmetry_tool_plan.md section 5.1): what a maker's getHandles()
  returns, and the helpers the makers build them with. symhublib's GroupHandlesTool
  draws them through the group transform, finds them under the pointer and drags
  them; nothing here knows the screen.

  A handle is one of two kinds:

    point   { kind: 'point', id, at() -> [x, y] | null, set(p), shape: 'disc' | 'diamond',
              title, label() -> text, guide() -> {circle: [cx, cy, r]} | {segment: [p, q]} | null,
              save() -> state, restore(state) }
            dragged: set(p) gets the pointer's point (the tool keeps the offset of the
            grab) and the maker's rule makes the values of it (a projection, a clamp);
            the handle is then where the new values put it, under the pointer as far as
            the rule allows

    order   { kind: 'order', id, at() -> [x, y] | null, toward: [x, y] | null, get() -> n,
              set(n), step(n, dir) -> n, text(n) -> string, title, save(), restore(state) }
            the order of a corner: a label with the number at the corner, moved toward
            the point `toward` (inside the domain); the tool steps it by the wheel, its −
            and + marks, the keys - and +, or a drag up and down on it

  The values go to the maker as its own controls would set them (setMakerValues):
  the controls of the window show them and the maker hears one change.
*/

// -----------------------------------------------------------------------------
//  values
// -----------------------------------------------------------------------------

/** the object that holds a maker's values (most makers: params; Group_Frieze, Group_Spherical: mConfig) */
export function makerValues(maker){
    return maker.params || maker.mConfig || {};
}

/**
  sets values of a maker at once, as its controls would: the values are written,
  the controls that show them updated (the maker's params, or the dat.gui
  controllers of the older makers), and the maker hears one change
  (onParamChanged); values that are not numbers, or the same, are left out.
  Returns whether anything changed.
*/
export function setMakerValues(maker, values){
    if(!values) return false;
    const obj = makerValues(maker);
    const params = maker.mParams || null;
    const ctrls = maker.controllers || null;
    let changed = false;
    for(const key of Object.keys(values)){
        const v = values[key];
        if(typeof v !== 'number' || !Number.isFinite(v) || obj[key] === v) continue;
        obj[key] = v;
        if(params && params[key] && params[key].updateDisplay) params[key].updateDisplay();
        else if(ctrls && ctrls[key] && ctrls[key].updateDisplay) ctrls[key].updateDisplay();
        changed = true;
    }
    if(changed && maker.onParamChanged) maker.onParamChanged();
    return changed;
}

/** the values of the keys, to put back (setMakerValues) */
export function pickValues(maker, keys){
    const obj = makerValues(maker);
    const out = {};
    for(const key of keys) out[key] = obj[key];
    return out;
}

export function clamp(v, lo, hi){
    return Math.max(lo, Math.min(hi, v));
}

/** degrees, unwrapped to the nearest turn of the old value: a drag across ±180 goes on */
export function nearAngle(deg, oldDeg){
    if(!Number.isFinite(oldDeg)) return deg;
    return deg + 360*Math.round((oldDeg - deg)/360);
}

/** the angle of a point about a centre, degrees */
export function angleDeg(p, c = [0, 0]){
    return Math.atan2(p[1] - c[1], p[0] - c[0])*180/Math.PI;
}

/** a number for a label: four significant digits, no trailing zeros */
export function fmt(v){
    if(!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    const s = (a >= 1000 || (a > 0 && a < 1e-3)) ? v.toExponential(3) : v.toPrecision(4);
    return s.includes('e') ? s : s.replace(/\.?0+$/, '');
}

// -----------------------------------------------------------------------------
//  the kinds
// -----------------------------------------------------------------------------

/**
  a point handle; def:
    id         unique among the maker's handles (default: keys joined)
    keys       the values it sets (saved at the press, put back on Escape)
    at()       its place, or null (not shown)
    toValues(p) the values for the pointer's point p, or null
    shape      'disc' (free) or 'diamond' (along a path)
    title, label() (shown by it while hovered or dragged), guide()
*/
export function pointHandle(maker, def){
    const keys = def.keys || [];
    return {
        kind:    'point',
        id:      def.id || keys.join(','),
        at:      def.at,
        set:     (p) => setMakerValues(maker, def.toValues(p)),
        shape:   def.shape || 'disc',
        title:   def.title || '',
        label:   def.label || (() => keys.map(k => `${k} ${fmt(makerValues(maker)[k])}`).join('  ')),
        guide:   def.guide || null,
        save:    () => pickValues(maker, keys),
        restore: (state) => setMakerValues(maker, state),
    };
}

/**
  a point handle along a path of one value: the handle is at posOf(v) and a drag
  finds the value whose point is nearest the pointer (followParam); def:
    key, posOf(v) -> [x, y] | null, min, max, id, shape (default diamond), title, label, guide
*/
export function pathHandle(maker, def){
    const key = def.key;
    const get = () => makerValues(maker)[key];
    return pointHandle(maker, {
        id:    def.id || key,
        keys:  [key],
        at:    () => def.posOf(get()),
        toValues: (p) => ({ [key]: followParam(def.posOf, get(), p, def.min, def.max) }),
        shape: def.shape || 'diamond',
        title: def.title,
        label: def.label,
        guide: def.guide,
    });
}

/**
  the order of a corner; def:
    key, at() (the corner), toward (a point inside the domain, where the label goes),
    min, max (default 2 and 20),
    ideal: how the maker reads an ideal corner (angle 0, shown ∞):
      'max'  the values below 2 and from max on (grouplib's getAngle: 0, 1 and 20 are
             ∞), stepped as max: 2, 3, ..., max - 1, ∞
      'low'  the values below 2 (Group_6splanes): ∞, 2, 3, ..., max, ∞ stepped as 1
    id, title
*/
export function orderHandle(maker, def){
    const key = def.key;
    const ideal = def.ideal || null;
    const min = def.min !== undefined ? def.min : (ideal === 'low' ? 1 : 2);
    const max = def.max !== undefined ? def.max : 20;
    const isIdeal = (n) => (ideal === 'max' && (n < 2 || n >= max)) || (ideal === 'low' && n < 2);
    const norm = (n) => isIdeal(n) ? (ideal === 'max' ? max : 1) : clamp(Math.round(n), min, max);
    return {
        kind:    'order',
        id:      def.id || key,
        key,
        at:      def.at,
        toward:  def.toward || null,
        get:     () => makerValues(maker)[key],
        set:     (n) => setMakerValues(maker, { [key]: n }),
        step:    (n, dir) => clamp(norm(n) + Math.sign(dir), min, max),
        text:    (n) => isIdeal(n) ? '∞' : String(n),
        title:   def.title || `${key}: the order of the corner`,
        save:    () => pickValues(maker, [key]),
        restore: (state) => setMakerValues(maker, state),
    };
}

/**
  compute() once for each key (the values the result depends on), kept on the maker:
  the handles are asked for every frame and pointer event
*/
export function memoOnValues(maker, key, compute){
    const k = JSON.stringify(key);
    const m = maker._handlesMemo;
    if(m && m.key === k) return m.value;
    const value = compute();
    maker._handlesMemo = { key: k, value };
    return value;
}

/**
  fn() with the maker's values set to these for its time (a handle that finds a value
  by the maker's own geometry); they are put back after, the maker hears nothing
*/
export function withValues(maker, values, fn){
    const obj = makerValues(maker);
    const saved = {};
    for(const key of Object.keys(values)){
        saved[key] = obj[key];
        obj[key] = values[key];
    }
    try {
        return fn();
    } finally {
        Object.assign(obj, saved);
    }
}

// -----------------------------------------------------------------------------
//  the handles of families of makers
// -----------------------------------------------------------------------------

const DEG = Math.PI/180;

/** the guide of a circle of the half plane model, in the maker's model (null: a line there) */
function modelCircle(c, r, uhp){
    if(uhp) return { circle: [c[0], c[1], r] };
    const t = sphereTrace(iReflectU4(iSphere([DISK_C[0], DISK_C[1], 0, DISK_R]), iSphere([c[0], c[1], 0, r])));
    return t ? { circle: t } : null;
}

function sphereTrace(sp){
    if(!sp || sp.type !== SPLANE_SPHERE) return null;
    return [sp.v[0], sp.v[1], Math.abs(sp.v[3])];
}

/**
  the handles of a quadrilateral of getQuadDomain (Group_KLMN, Group_KLx): the orders
  of its corners and its aspect, the radius of the inner circle (the outer one's is 1),
  a diamond on the inner circle midway between its corners. The quad is the upper half
  plane's; the handles go to the disk where the maker draws there (uhp off)
    quad     getQuadDomain's sides: [outer, inner, side 3, side 4]
    orders   [{key, sides: [i, j], title}]: the order of the corner of the sides i and j
    aspect   {key, min, max, title}
*/
export function quadHandles(maker, { quad, uhp, orders, aspect }){
    const s = quad.s;
    const v = makerValues(maker);
    // of a corner and its mirror image in the x axis, the upper one is the domain's
    const near = [0, 10];
    const others = (i, j) => s.filter((_, k) => k !== i && k !== j);
    const corner = (i, j) => cornerOf(s[i], s[j], others(i, j), near);
    const toModel = (p) => p ? modelPoint(p, uhp) : null;
    const corners = orders.map(o => corner(o.sides[0], o.sides[1]));
    const toward = toModel(centroid(corners));
    const handles = orders.map((o, i) => orderHandle(maker, {
        key: o.key, at: () => toModel(corners[i]), toward, ideal: 'max', title: o.title,
    }));
    if(aspect){
        const a = corner(1, 2), b = corner(1, 3);
        const mid = (a && b) ? (Math.atan2(a[1], a[0]) + Math.atan2(b[1], b[0]))/2 : Math.PI/2;
        const key = aspect.key;
        handles.push(pointHandle(maker, {
            id: key, keys: [key], shape: 'diamond',
            at: () => toModel([v[key]*Math.cos(mid), v[key]*Math.sin(mid)]),
            toValues: (p) => {
                const q = modelPoint(p, uhp);
                return q ? { [key]: clamp(Math.hypot(q[0], q[1]), aspect.min, aspect.max) } : null;
            },
            guide: () => modelCircle([0, 0], v[key], uhp),
            title: aspect.title,
        }));
    }
    return handles;
}

/**
  the handles of a chain of orthogonal circles (chainOfOrthogonalCircles: Group_s22222,
  Group_22222, Group_s222222): the first circle's radius, a diamond on it; the centre
  of every next circle, a disc: its radius and its direction from the one before; the
  centre of the closing circle, on the y axis: the last direction. In the upper half
  plane, carried to the disk where the maker draws there (uhp off)
    radii    the keys of the radii ['R1', 'R2', ...]
    angles   the keys of the directions (degrees), as many as the radii: the steps
             between the centres, then the closing circle's
*/
export function chainHandles(maker, { radii, angles, uhp }){
    const v = makerValues(maker);
    const n = radii.length;
    const R = radii.map(k => v[k]);
    const A = angles.map(k => v[k]*DEG);
    const centres = [[0, 0]];
    for(let k = 1; k < n; k++){
        const d = Math.sqrt(R[k-1]*R[k-1] + R[k]*R[k]);
        const c = centres[k-1];
        centres.push([c[0] + d*Math.cos(A[k-1]), c[1] + d*Math.sin(A[k-1])]);
    }
    const toModel = (p) => p ? modelPoint(p, uhp) : null;
    const RMIN = 0.001, RMAX = 2;
    const handles = [];
    const r0 = radii[0];
    handles.push(pointHandle(maker, {
        id: r0, keys: [r0], shape: 'diamond',
        at: () => toModel([v[r0]*Math.SQRT1_2, v[r0]*Math.SQRT1_2]),
        toValues: (p) => {
            const q = modelPoint(p, uhp);
            return q ? { [r0]: clamp(Math.hypot(q[0], q[1]), RMIN, RMAX) } : null;
        },
        guide: () => modelCircle([0, 0], v[r0], uhp),
        title: `${r0}: the radius of the first circle`,
    }));
    for(let k = 1; k < n; k++){
        const rk = radii[k], ak = angles[k-1];
        const prev = centres[k-1], rPrev = R[k-1];
        handles.push(pointHandle(maker, {
            id: `${rk},${ak}`, keys: [rk, ak],
            at: () => toModel(centres[k]),
            toValues: (p) => {
                const q = modelPoint(p, uhp);
                if(!q) return null;
                const dx = q[0] - prev[0], dy = q[1] - prev[1];
                const r = Math.sqrt(Math.max(0, dx*dx + dy*dy - rPrev*rPrev));
                return { [rk]: clamp(r, RMIN, RMAX), [ak]: clamp(Math.atan2(dy, dx)/DEG, -180, 180) };
            },
            guide: uhp ? () => ({ segment: [prev, centres[k]] }) : null,
            title: `${rk}, ${ak}: the centre of the circle ${k + 1}: its radius and its direction from the circle ${k}`,
        }));
    }
    // the closing circle's centre (0, cy + cx tan(A)), on the y axis
    const last = centres[n - 1];
    const ak = angles[n - 1];
    if(Math.abs(last[0]) > 1e-9){
        handles.push(pointHandle(maker, {
            id: ak, keys: [ak],
            at: () => toModel([0, last[1] + last[0]*Math.tan(A[n - 1])]),
            toValues: (p) => {
                const q = modelPoint(p, uhp);
                return q ? { [ak]: clamp(Math.atan((q[1] - last[1])/last[0])/DEG, -180, 180) } : null;
            },
            title: `${ak}: the closing circle, its centre on the y axis`,
        }));
    }
    return handles;
}

/**
  the middle of a side between two of its points p and q: of a line, the midpoint; of
  a circle, the middle of the arc between them that stays in the annulus r1 <= |z| <= r2
  (nearest its middle radius)
*/
function sideMiddle(sp, p, q, r1, r2){
    if(!p || !q) return null;
    if(sp.type !== SPLANE_SPHERE) return [(p[0] + q[0])/2, (p[1] + q[1])/2];
    const [cx, cy, , rs] = sp.v;
    const r = Math.abs(rs);
    const t1 = Math.atan2(p[1] - cy, p[0] - cx), t2 = Math.atan2(q[1] - cy, q[0] - cx);
    const tm = (t1 + t2)/2;
    const rm = (r1 + r2)/2;
    const at = (t) => [cx + r*Math.cos(t), cy + r*Math.sin(t)];
    const a = at(tm), b = at(tm + Math.PI);
    return (Math.abs(Math.hypot(a[0], a[1]) - rm) <= Math.abs(Math.hypot(b[0], b[1]) - rm)) ? a : b;
}

/**
  the handles of the annulus makers (Group_5splanes, Group_6splanes): the radii of the
  two circles about the origin (diamonds on them in the middle direction of the domain),
  the direction of each rolling side (a disc on it, dragged about the origin; not while
  an order sets it), the orders of the corners of the sides that are on. In the upper
  half plane, carried to the disk where the maker draws there (uhp off)
    radii    the keys of the two radii ['r1', 'r2'] (the smaller is the inner circle)
    inner, outer   the circles are sides (s1, s2)
    sides    [{key: 'a3', on, orders: ['n13', 'n23'], fixed}]: a rolling side, its
             direction's key (degrees), on: it is a side, the orders of its corners with
             the inner and the outer circle, fixed: its direction is set by an order
    line     [{key: 'n35', side: 0}]: the orders of the corners of the rolling sides
             with the x axis, when it is a side (Group_5splanes' s5)
    ideal    as orderHandle's
*/
export function annulusHandles(maker, { radii, inner, outer, sides, line, uhp, ideal = 'max' }){
    const v = makerValues(maker);
    const r1 = Math.min(v[radii[0]], v[radii[1]]);
    const r2 = Math.max(v[radii[0]], v[radii[1]]);
    const rm = (r1 + r2)/2;
    const S1 = iSphere([0, 0, 0, -r1]);
    const S2 = iSphere([0, 0, 0, r2]);
    const order = (n) => (ideal === 'low') ? ((n < 2) ? 0 : Math.PI/n) : getAngle(n);
    const rolling = sides.map(sd => {
        const a = v[sd.key]*DEG;
        return { ...sd, a, sp: getRollingSplane(r1, r2, order(v[sd.orders[0]]), order(v[sd.orders[1]]), a) };
    });
    const X = iPlane([0, -1, 0, 0]);
    const present = [inner ? S1 : null, outer ? S2 : null, ...rolling.map(sd => sd.on ? sd.sp : null), line ? X : null]
        .filter(Boolean);
    const m = rolling.length >= 2 ? (rolling[0].a + rolling[1].a)/2 : Math.PI/2;
    const near = [rm*Math.cos(m), rm*Math.sin(m)];
    const toModel = (p) => p ? modelPoint(p, uhp) : null;
    const toward = toModel(near);
    const corner = (a, b) => cornerOf(a, b, present.filter(s => s !== a && s !== b), near);
    const handles = [];
    for(const key of radii){
        handles.push(pointHandle(maker, {
            id: key, keys: [key], shape: 'diamond',
            at: () => toModel([v[key]*Math.cos(m), v[key]*Math.sin(m)]),
            toValues: (p) => {
                const q = modelPoint(p, uhp);
                return q ? { [key]: clamp(Math.hypot(q[0], q[1]), 0.001, 2) } : null;
            },
            guide: () => modelCircle([0, 0], v[key], uhp),
            title: `${key}: the radius of a circle about the origin`,
        }));
    }
    for(const sd of rolling){
        if(!sd.on) continue;
        if(inner) handles.push(orderHandle(maker, { key: sd.orders[0], at: () => toModel(corner(S1, sd.sp)), toward, ideal }));
        if(outer) handles.push(orderHandle(maker, { key: sd.orders[1], at: () => toModel(corner(S2, sd.sp)), toward, ideal }));
        if(sd.fixed) continue;
        // the middle of the side between its corners with the two circles: the side turns
        // about the origin with its direction, the point with it (at the angle turn from it)
        const place = sideMiddle(sd.sp, cornerOf(S1, sd.sp, [], near), cornerOf(S2, sd.sp, [], near), r1, r2);
        if(!place) continue;
        const turn = Math.atan2(place[1], place[0]) - sd.a;
        const key = sd.key;
        handles.push(pointHandle(maker, {
            id: key, keys: [key],
            at: () => toModel(place),
            toValues: (p) => {
                const q = modelPoint(p, uhp);
                if(!q) return null;
                const deg = (Math.atan2(q[1], q[0]) - turn)/DEG;
                return { [key]: clamp(nearAngle(deg, v[key]), -720, 720) };
            },
            title: `${key}: the direction of a side, about the origin`,
        }));
    }
    for(const l of (line || [])){
        const sd = rolling[l.side];
        if(sd && sd.on) handles.push(orderHandle(maker, { key: l.key, at: () => toModel(corner(sd.sp, X)), toward, ideal }));
    }
    return handles;
}

// -----------------------------------------------------------------------------
//  geometry
// -----------------------------------------------------------------------------

/**
  the value v in [lo, hi] whose point posOf(v) is nearest the target, found from v0
  by Gauss–Newton steps along the path (a drag starts each search where the last one
  ended, so the handle follows the pointer); v0 when the path has no points there
*/
export function followParam(posOf, v0, target, lo, hi, iters = 20){
    let v = clamp(v0, lo, hi);
    const span = (hi - lo) || 1;
    for(let k = 0; k < iters; k++){
        const p = posOf(v);
        if(!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) break;
        const h = Math.max(1e-7*Math.max(1, Math.abs(v)), 1e-9*span);
        const v2 = (v + h <= hi) ? v + h : v - h;
        const p2 = posOf(v2);
        if(!p2 || !Number.isFinite(p2[0]) || !Number.isFinite(p2[1])) break;
        const dv = v2 - v;
        const dx = (p2[0] - p[0])/dv, dy = (p2[1] - p[1])/dv;
        const g2 = dx*dx + dy*dy;
        if(!(g2 > 0)) break;
        const step = clamp(((target[0] - p[0])*dx + (target[1] - p[1])*dy)/g2, -span/4, span/4);
        const vn = clamp(v + step, lo, hi);
        const done = Math.abs(vn - v) <= 1e-13*Math.max(1, Math.abs(v));
        v = vn;
        if(done) break;
    }
    return v;
}

/** the signed distance of a point of the plane from a splane: negative on the side of the domain */
export function sideDistance(sp, p){
    const v = sp.v;
    if(sp.type === SPLANE_SPHERE){
        const d = Math.hypot(p[0] - v[0], p[1] - v[1], v[2]) - Math.abs(v[3]);
        return v[3] > 0 ? d : -d;
    }
    if(sp.type === SPLANE_PLANE) return p[0]*v[0] + p[1]*v[1] - v[3];
    return 0;
}

/** where two splanes nearly touch (an ideal corner the rounding keeps apart): [] when they do not */
function touchPoints(a, b){
    const circle = s => s.type === SPLANE_SPHERE;
    if(circle(a) && circle(b)){
        const [x1, y1, , r1s] = a.v, [x2, y2, , r2s] = b.v;
        const r1 = Math.abs(r1s), r2 = Math.abs(r2s);
        const d = Math.hypot(x2 - x1, y2 - y1);
        if(!(d > 0)) return [];
        const tol = 1e-7*(r1 + r2 + d);
        const ux = (x2 - x1)/d, uy = (y2 - y1)/d;
        if(Math.abs(d - (r1 + r2)) < tol) return [[x1 + ux*r1, y1 + uy*r1]];
        if(Math.abs(d - Math.abs(r1 - r2)) < tol){
            const s = r1 >= r2 ? 1 : -1;
            return [[x1 + s*ux*r1, y1 + s*uy*r1]];
        }
        return [];
    }
    if(circle(a) !== circle(b)){
        const L = circle(a) ? b : a, S = circle(a) ? a : b;
        const [nx, ny, , dl] = L.v;
        const [cx, cy, , rs] = S.v;
        const r = Math.abs(rs);
        const t = dl - (nx*cx + ny*cy);
        if(Math.abs(Math.abs(t) - r) < 1e-7*(1 + r)) return [[cx + t*nx, cy + t*ny]];
    }
    return [];
}

/**
  the corner where the sides a and b meet: of their points in common (two circles
  meet twice), the one on the domain's side of the others (within the rounding),
  and of those the nearest the point `near` (inside the domain: it tells the
  domain's corner from its image in the absolute); a touch point when they only
  touch (an ideal corner); null when they do not meet
*/
export function cornerOf(a, b, others = [], near = [0, 0]){
    if(!a || !b) return null;
    let pts = splaneIntersections(a, b).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if(!pts.length) pts = touchPoints(a, b);
    if(!pts.length) return null;
    const outside = (p) => {
        let m = 0;
        for(const s of others) if(s) m = Math.max(m, sideDistance(s, p));
        return m > 1e-6*(1 + Math.hypot(p[0], p[1])) ? 1 : 0;
    };
    const dist = (p) => Math.hypot(p[0] - near[0], p[1] - near[1]);
    pts.sort((p, q) => (outside(p) - outside(q)) || (dist(p) - dist(q)));
    return [pts[0][0], pts[0][1]];
}

/** the mean of the points that are there */
export function centroid(points){
    const ps = points.filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if(!ps.length) return null;
    return [ps.reduce((s, p) => s + p[0], 0)/ps.length, ps.reduce((s, p) => s + p[1], 0)/ps.length];
}

/** the inversion in the circle (c, r): its own inverse */
export function invertInCircle(p, c, r){
    if(!p) return null;
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const d2 = dx*dx + dy*dy;
    if(!(d2 > 0)) return null;
    const k = r*r/d2;
    return [c[0] + k*dx, c[1] + k*dy];
}

// the circle that takes the upper half plane to the unit disk and back (toPoincareDisk)
const DISK_C = [0, -1];
const DISK_R = Math.SQRT2;

/** a point of the upper half plane in the disk model, and back (the same reflection) */
export function uhpDiskSwap(p){
    return invertInCircle(p, DISK_C, DISK_R);
}

/**
  the point in the maker's model: itself in the upper half plane, else its image in
  the disk (the makers with the option uhp build in the half plane and reflect)
*/
export function modelPoint(p, uhp){
    return uhp ? p : uhpDiskSwap(p);
}
