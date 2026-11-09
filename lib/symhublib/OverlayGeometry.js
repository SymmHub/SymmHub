import {
    SPLANE_SPHERE,
    SPLANE_PLANE,
} from './modules.js';

//
//  OverlayGeometry - builders of the editing overlay's geometry for the GPU pass
//  (EditingOverlay.js, lib/shaders/overlay_editing.glsl.mjs): world coordinates,
//  styles in pixels. The tools of symhublib (the pattern transform tool, the
//  Dirichlet domain tool) and the drawing editor (lib/drawlib) share these, so the
//  transform boxes of both look the same.
//
//  geometry: {
//    polylines: [{ points: [[x, y], ...], width, color, dash, gap, halo, haloWidth, closed }],
//    points:    [{ p: [x, y], kind: 'disc' | 'square' | 'diamond' | 'cross', size, color, fill, width }],
//    splanes:   [{ circle: [cx, cy, r] | line: [nx, ny, d], range: [u0, u1] | null, width, color, dash, gap, halo, haloWidth }],
//  }
//  a splane is a whole circle (|w - c| = r) or line (n.w = d), or the arc of one in
//  the range of its parameter: the angle about the centre for a circle (u1 may run
//  past PI), the position along the direction (-ny, nx) from the foot n d for a line.
//  colours are straight rgba in 0..1.
//

const WHITE = [1, 1, 1, 0.95];
const BLACK = [0, 0, 0, 0.85];

/** an empty geometry */
export function newGeometry(){
    return { polylines: [], points: [], splanes: [] };
}

/** the geometries in one (the first drawn first) */
export function mergeGeometry(...geos){
    const out = newGeometry();
    for (const g of geos) {
        if (!g) continue;
        if (g.polylines) out.polylines.push(...g.polylines);
        if (g.points) out.points.push(...g.points);
        if (g.splanes) out.splanes.push(...g.splanes);
    }
    return out;
}

/** a CSS colour '#RRGGBB' or '#RRGGBBAA' as rgba in 0..1; alpha replaces the colour's when given */
export function cssColor(str, alpha){
    const h = str.replace('#', '');
    const n = k => parseInt(h.slice(k, k + 2), 16)/255;
    const a = alpha !== undefined ? alpha : (h.length >= 8 ? n(6) : 1);
    return [n(0), n(2), n(4), a];
}

//
//  the transform box, as the pattern transform tool draws it: a solid frame white
//  under black (seen on any background), black discs at the corners, black squares
//  at the sides, the pivot a ringed dot with crosshairs
//

/** the frame: a closed outline (world points) */
export function transformFrameGeometry(geo, outline){
    if (!outline || outline.length < 2) return;
    geo.polylines.push({ points: [...outline, outline[0]], width: 1.5, color: BLACK, halo: [1, 1, 1, 0.9], haloWidth: 3.5 });
}

/** round handles */
export function transformCornersGeometry(geo, corners){
    for (const c of corners) {
        geo.points.push({ p: c, kind: 'disc', size: 8.5, color: null, fill: [1, 1, 1, 0.85], width: 0 });
        geo.points.push({ p: c, kind: 'disc', size: 7, color: [0, 0, 0, 0.95], fill: BLACK, width: 1.5 });
    }
}

/** square handles */
export function transformSquaresGeometry(geo, sides){
    for (const q of sides) {
        geo.points.push({ p: q, kind: 'square', size: 7.5, color: null, fill: [1, 1, 1, 0.85], width: 0 });
        geo.points.push({ p: q, kind: 'square', size: 6, color: [0, 0, 0, 0.95], fill: BLACK, width: 1.5 });
    }
}

/** the pivot's mark: crosshairs white under black, a ring, a dot */
export function transformPivotGeometry(geo, pivot){
    if (!pivot) return;
    geo.points.push({ p: pivot, kind: 'cross', size: 14, color: [1, 1, 1, 0.9], width: 3 });
    geo.points.push({ p: pivot, kind: 'cross', size: 14, color: BLACK, width: 1.2 });
    geo.points.push({ p: pivot, kind: 'disc', size: 10.5, color: null, fill: [1, 1, 1, 0.85], width: 0 });
    geo.points.push({ p: pivot, kind: 'disc', size: 9, color: [0, 0, 0, 0.9], fill: null, width: 2 });
    geo.points.push({ p: pivot, kind: 'disc', size: 4.5, color: null, fill: [1, 1, 1, 0.85], width: 0 });
    geo.points.push({ p: pivot, kind: 'disc', size: 3, color: null, fill: [0, 0, 0, 0.9], width: 0 });
}

/** the whole box: the frame through the corners, the handles, the pivot */
export function transformBoxGeometry(geo, corners, sides, pivot){
    transformFrameGeometry(geo, corners);
    transformCornersGeometry(geo, corners);
    transformSquaresGeometry(geo, sides);
    transformPivotGeometry(geo, pivot);
}

/** a disc of a radius in pixels: {size, fill, color (the stroke), width} */
export function discGeometry(geo, p, style){
    if (!p) return;
    geo.points.push({ p: [p[0], p[1]], kind: 'disc', size: style.size || 4, color: style.color || null, fill: style.fill || null, width: style.width === undefined ? 1 : style.width });
}

/**
 * the trace of an inversive splane (lib/invlib) in the plane z = 0: {circle: [cx, cy, r]}
 * or {line: [nx, ny, d]} (n a unit normal, n.w = d); null when it has none
 */
export function splaneTrace(splane){
    if (!splane || !splane.v) return null;
    const v = splane.v;
    if (splane.type === SPLANE_SPHERE) {
        const r2 = v[3]*v[3] - v[2]*v[2];
        if (!(r2 > 1e-24)) return null;
        return { circle: [v[0], v[1], Math.sqrt(r2)] };
    }
    if (splane.type === SPLANE_PLANE) {
        const len = Math.hypot(v[0], v[1]);
        if (!(len > 1e-12)) return null;
        return { line: [v[0]/len, v[1]/len, v[3]/len] };
    }
    return null;
}

/**
 * a splane as a curve: the whole trace, or its arcs in the ranges of the parameter
 * (the arcs of grouplib's dirichletCell: angles on a circle, positions on a line,
 * ±Infinity for the rays); style {width, color, dash, gap, halo, haloWidth}
 */
export function splaneGeometry(geo, splane, style, ranges = null){
    const trace = splaneTrace(splane);
    if (!trace) return;
    const s = { width: style.width || 1, color: style.color || [0, 0, 0, 1], dash: style.dash || 0, gap: style.gap || 0, halo: style.halo || null, haloWidth: style.haloWidth || 0 };
    if (!ranges) {
        geo.splanes.push({ ...trace, range: null, ...s });
        return;
    }
    for (const r of ranges) {
        if (!r || !(r[1] > r[0])) continue;
        geo.splanes.push({ ...trace, range: [r[0], r[1]], ...s });
    }
}
