/*
  DocumentView.js — the document view: the view saved with a document, apart
  from the working view the navigator shows (docs/document_view_plan.md).

  A view is the canvas part alone, the pan and zoom (and the canvas's turn):
    euclidean   {centerX, centerY, zoom, angle}   the canvas transform
  in the form a document holds it (JSON values). The document view adds
  the frame's aspect (height / width): the frame is 2/zoom wide and
  aspect * 2/zoom high, centred and turned as the canvas.

  The transforms the picture is seen through, the Moebius part, the sphere
  view and the conformal maps, are no part of a view: they are the document's
  content and are saved as they are (2026-11-19,
  docs/conformal_transforms_plan.md section 10; from 2026-11-16 until then a
  view held them too).

  Pure functions, no imports: the navigator (InversiveNavigator.js) keeps the
  views and sets its params from them.
*/

// the parts of the navigator's params a view holds, and the keys of each part
// (null: the whole part)
export const VIEW_PARTS = {
    euclidean:  ['centerX', 'centerY', 'zoom', 'angle'],
};

// the place of the view: what a jump of the view by the user changes (home,
// the resets), its canvas part and the Moebius transform. Back (the navigator's
// goToPreviousView) returns both; the sphere view and the maps, which no jump
// changes, are not in it
export const PLACE_PARTS = {
    euclidean:  ['centerX', 'centerY', 'zoom', 'angle'],
    inversive:  ['itrans', 'anchored'],
};

// the aspect of a document saved before the document view: a square frame
export const LEGACY_ASPECT = 1;

/** a deep copy of JSON values (undefined stays undefined) */
export function cloneViewValue(v) {
    return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v));
}

/** true when two JSON values are the same */
export function sameViewValue(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 *  the view in the navigator's param values: the parts and keys of
 *  VIEW_PARTS, copied (parts: PLACE_PARTS for the place of the view)
 *  @param {object} values  {euclidean, inversive, ...}, each a part's value
 *  @param {object} [parts] the parts and their keys to take
 */
export function pickView(values, parts = VIEW_PARTS) {
    const view = {};
    for (const [part, keys] of Object.entries(parts)) {
        const v = values ? values[part] : undefined;
        if (v === undefined) continue;
        if (!keys) { view[part] = cloneViewValue(v); continue; }
        const out = {};
        for (const k of keys) if (v && v[k] !== undefined) out[k] = cloneViewValue(v[k]);
        view[part] = out;
    }
    return view;
}

/**
 *  a view part's value as a document holds it: the live value with the view's
 *  keys in their places (any other key of the part stays live), the frame's
 *  aspect after the euclidean keys
 */
export function filePartValue(part, live, view, aspect) {
    const keys = VIEW_PARTS[part];
    const v = view ? view[part] : undefined;
    if (v === undefined) return live;
    if (!keys) return cloneViewValue(v);
    const out = { ...(live || {}) };
    for (const k of keys) if (k in v) out[k] = cloneViewValue(v[k]);
    if (part === 'euclidean' && validAspect(aspect)) out.aspect = aspect;
    return out;
}

/** a frame's aspect (height / width) when it is one, else null */
export function validAspect(a) {
    a = Number(a);
    return (Number.isFinite(a) && a > 0) ? a : null;
}

/** the aspect a document's euclidean values give, null for a document saved before it */
export function fileAspect(euclidean) {
    return euclidean ? validAspect(euclidean.aspect) : null;
}

/**
 *  a short stamp of a document view {view, aspect}: equal stamps, the same
 *  JSON. A working view kept in the browser carries the stamp of the document
 *  view of the file it was made under; a file whose document view changed
 *  since gets another stamp (docs/document_view_plan.md 3.3)
 */
export function viewStamp(dv) {
    const s = JSON.stringify(dv === undefined ? null : dv);
    // cyrb53: two 32-bit multiplicative hashes of the text
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + ':' + s.length;
}

/**
 *  the zoom that shows a frame of the given zoom and aspect on a canvas of
 *  width x height pixels:
 *    'contain'  the whole frame shows (more round it on a canvas of another shape)
 *    'cover'    the frame fills the canvas (cut on a canvas of another shape)
 *    'exact'    the frame's own zoom (its width across the canvas)
 *  (the canvas transform spans 2/zoom across the canvas's width)
 */
export function fitViewZoom(zoom, aspect, width, height, fit = 'contain') {
    const a = validAspect(aspect);
    if (!(zoom > 0) || !a || !(width > 0) || !(height > 0) || fit === 'exact') return zoom;
    const r = (height / width) / a;      // the canvas's aspect over the frame's
    return (fit === 'cover') ? zoom * Math.max(1, r) : zoom * Math.min(1, r);
}

//
//  The frame of a document view (docs/document_view_plan.md 3.7): the rectangle
//  the canvas shows at the view, in the plane of the canvas transform (before the
//  Moebius part and the conformal maps). e = the view's euclidean values
//  {centerX, centerY, zoom, angle (degrees)}: the frame is centred at the centre,
//  2/zoom wide and aspect * 2/zoom high, along the canvas's axes turned by the
//  angle (CanvasTransform.screenVectorToWorld). A point of the frame is given by
//  (u, v) in [-1, 1]^2: u along its width (the screen's x), v along its height
//  (the screen's up).
//

/** the world directions of the frame's width (ex) and height (ey) at the angle (degrees) */
export function frameAxes(angle) {
    const a = (Number(angle) || 0)*Math.PI/180;
    const c = Math.cos(a), s = Math.sin(a);
    return { ex: [c, -s], ey: [s, c] };
}

/** the frame's [width, height] in world units */
export function frameSize(e, aspect) {
    const w = 2/e.zoom;
    return [w, w*(validAspect(aspect) || LEGACY_ASPECT)];
}

/** the world point (u, v) of the frame */
export function framePoint(e, aspect, u, v) {
    const { ex, ey } = frameAxes(e.angle);
    const [w, h] = frameSize(e, aspect);
    const a = u*w/2, b = v*h/2;
    return [e.centerX + a*ex[0] + b*ey[0], e.centerY + a*ex[1] + b*ey[1]];
}

/** the frame's (u, v) of the world point p */
export function frameLocal(e, aspect, p) {
    const { ex, ey } = frameAxes(e.angle);
    const [w, h] = frameSize(e, aspect);
    const dx = p[0] - e.centerX, dy = p[1] - e.centerY;
    return [2*(dx*ex[0] + dy*ex[1])/w, 2*(dx*ey[0] + dy*ey[1])/h];
}

// the corners' (u, v), counterclockwise from the bottom left
export const FRAME_CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** the frame's corners, world points, counterclockwise from the bottom left */
export function frameCorners(e, aspect) {
    return FRAME_CORNERS.map(([u, v]) => framePoint(e, aspect, u, v));
}

/**
 *  the frame's outline, n points along each side from its first corner (the
 *  corners included, the first not repeated at the end)
 */
export function frameOutline(e, aspect, n = 1) {
    n = Math.max(1, Math.floor(n));
    const out = [];
    for (let k = 0; k < 4; k++) {
        const [u0, v0] = FRAME_CORNERS[k], [u1, v1] = FRAME_CORNERS[(k + 1) % 4];
        for (let i = 0; i < n; i++) {
            const t = i/n;
            out.push(framePoint(e, aspect, u0 + t*(u1 - u0), v0 + t*(v1 - v0)));
        }
    }
    return out;
}

/** the frame moved by the world vector d */
export function movedFrame(e, d) {
    return { ...e, centerX: e.centerX + d[0], centerY: e.centerY + d[1] };
}

/**
 *  the frame with its corner (su, sv) (signs, FRAME_CORNERS) at the world point p,
 *  the opposite corner fixed and the angle kept; keepAspect keeps the frame's
 *  shape (the larger of the two sides' changes). The sides stay at least minSide
 *  (world units): the corner does not go past the opposite one.
 *  returns {euclidean, aspect}
 */
export function resizedFrame(e, aspect, corner, p, keepAspect = false, minSide = 0) {
    const a = validAspect(aspect) || LEGACY_ASPECT;
    const [su, sv] = corner;
    const { ex, ey } = frameAxes(e.angle);
    const [w0, h0] = frameSize(e, a);
    const o = framePoint(e, a, -su, -sv);
    const dx = p[0] - o[0], dy = p[1] - o[1];
    let w = su*(dx*ex[0] + dy*ex[1]);
    let h = sv*(dx*ey[0] + dy*ey[1]);
    if (keepAspect) {
        const s = Math.max(w/w0, h/h0, minSide/Math.min(w0, h0));
        w = w0*s; h = h0*s;
    } else {
        w = Math.max(w, minSide);
        h = Math.max(h, minSide);
    }
    if (!(w > 0) || !(h > 0)) return { euclidean: { ...e }, aspect: a };
    const cx = o[0] + su*w/2*ex[0] + sv*h/2*ey[0];
    const cy = o[1] + su*w/2*ex[1] + sv*h/2*ey[1];
    return { euclidean: { ...e, centerX: cx, centerY: cy, zoom: 2/w }, aspect: h/w };
}

/** an angle in degrees in (-180, 180] */
export function normalAngle(deg) {
    let a = ((Number(deg) || 0) % 360 + 360) % 360;
    return (a > 180) ? a - 360 : a;
}

/**
 *  the frame turned about its centre by the world angle delta (degrees,
 *  counterclockwise in the world); step > 0 rounds the frame's angle to its
 *  multiples. The frame's angle is the canvas's, which turns the world the other
 *  way: the frame turned by delta has the angle less delta
 */
export function turnedFrame(e, delta, step = 0) {
    let angle = normalAngle(e.angle - delta);
    if (step > 0) angle = normalAngle(Math.round(angle/step)*step);
    return { ...e, angle };
}
