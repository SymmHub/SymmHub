//
//  SVG import: the shapes of an SVG document as path and polyline items
//
//  Paths (all commands; curves kept as cubics, quadratics and arcs as the
//  cubics they are or nearly are), rects, circles, ellipses (four cubic
//  arcs), lines, polylines and polygons, in groups with transforms, with
//  the presentation attributes fill, stroke, stroke-width, opacity,
//  fill-opacity, stroke-opacity (attributes or the style attribute,
//  inherited). A shape of straight segments is a polyline item, one with
//  curves a path item (Paths.js); a <g> of several shapes is a group item
//  (its opacity the group's own), a <g> of one shape that shape. The
//  drawing is fitted into a square box of the world, y up. Not taken: text,
//  images, use, gradients, patterns, style sheets.
//

import {
    flattenNodes,
    mappedNodes,
} from './modules.js';


// ── transforms: [a, b, c, d, e, f] of x' = a x + c y + e, y' = b x + d y + f

const IDENTITY = [1, 0, 0, 1, 0, 0];

function multiply(m, n){
    return [
        m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1],
        m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3],
        m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5],
    ];
}

function apply(m, x, y){
    return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
}

/** the scale of lengths under m (the root of |det|) */
function scaleOf(m){
    return Math.sqrt(Math.abs(m[0]*m[3] - m[1]*m[2]));
}

/** the matrix of a transform attribute */
function parseTransform(str){
    let m = IDENTITY;
    if (!str) return m;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let t;
    while ((t = re.exec(str))) {
        const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
        let n = IDENTITY;
        switch (t[1]) {
        case 'matrix':    if (a.length === 6) n = a; break;
        case 'translate': n = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; break;
        case 'scale':     n = [a[0] || 1, 0, 0, a.length > 1 ? a[1] : (a[0] || 1), 0, 0]; break;
        case 'rotate': {
            const r = (a[0] || 0)*Math.PI/180, c = Math.cos(r), s = Math.sin(r);
            n = [c, s, -s, c, 0, 0];
            if (a.length > 2) n = multiply(multiply([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
            break;
        }
        case 'skewX': n = [1, 0, Math.tan((a[0] || 0)*Math.PI/180), 1, 0, 0]; break;
        case 'skewY': n = [1, Math.tan((a[0] || 0)*Math.PI/180), 0, 1, 0, 0]; break;
        default: break;
        }
        m = multiply(m, n);
    }
    return m;
}

// ── colours

let mColorCtx = null;

/** [r, g, b, a] of a CSS colour, null for none */
function parseColor(str, opacity = 1){
    if (!str || str === 'none' || str === 'transparent') return null;
    if (!mColorCtx) {
        const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
        mColorCtx = cv.getContext('2d');
    }
    mColorCtx.fillStyle = '#000';
    mColorCtx.fillStyle = str.trim();
    const v = mColorCtx.fillStyle;
    let rgba;
    if (v[0] === '#') {
        rgba = [parseInt(v.slice(1, 3), 16)/255, parseInt(v.slice(3, 5), 16)/255, parseInt(v.slice(5, 7), 16)/255, 1];
    } else {
        const a = v.match(/[\d.]+/g).map(Number);
        rgba = [a[0]/255, a[1]/255, a[2]/255, a.length > 3 ? a[3] : 1];
    }
    rgba[3] *= opacity;
    return { rgba };
}

// ── styles

const STYLE_KEYS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin'];

/** the element's presentation attributes over the inherited ones */
function elementStyle(el, inherited){
    const st = { ...inherited };
    for (const key of STYLE_KEYS) {
        const v = el.getAttribute(key);
        if (v !== null) st[key] = v.trim();
    }
    const css = el.getAttribute('style');
    if (css) {
        for (const decl of css.split(';')) {
            const i = decl.indexOf(':');
            if (i < 0) continue;
            const key = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
            if (STYLE_KEYS.includes(key)) st[key] = v;
        }
    }
    return st;
}

/** the item style of an SVG style, with the stroke width in world units */
function itemStyle(st, lengthScale){
    const opacity = parseFloat(st.opacity ?? '1');
    const fillOpacity = parseFloat(st['fill-opacity'] ?? '1');
    const strokeOpacity = parseFloat(st['stroke-opacity'] ?? '1');
    return {
        fill:        parseColor(st.fill ?? '#000', fillOpacity),
        stroke:      parseColor(st.stroke ?? 'none', strokeOpacity),
        strokeWidth: parseFloat(st['stroke-width'] ?? '1')*lengthScale,
        lineCap:     st['stroke-linecap'] || 'butt',
        lineJoin:    st['stroke-linejoin'] || 'miter',
        opacity:     Number.isFinite(opacity) ? opacity : 1,
    };
}

// ── shapes to subpaths: [{nodes: [{p, h1, h2}], closed}] in user coordinates
// (Paths.js nodes: the curves of the path data are kept as cubics)

// a quarter turn of a unit circle as a cubic: the handle length
const KAPPA = 4*(Math.SQRT2 - 1)/3;

function pathSubpaths(d){
    const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    const out = [];
    let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', prev = null, lastCtrl = null;
    let i = 0;
    const num = () => parseFloat(tokens[i++]);
    const more = () => i < tokens.length && !/[a-zA-Z]/.test(tokens[i]);
    const node = (px, py, h1 = null) => ({ p: [px, py], h1, h2: null });
    const start = (px, py) => { cur = { nodes: [node(px, py)], closed: false }; out.push(cur); sx = px; sy = py; };
    const line = (px, py) => { if (!cur) start(x, y); cur.nodes.push(node(px, py)); };
    const cubic = (x1, y1, x2, y2, px, py) => {
        if (!cur) start(x, y);
        cur.nodes[cur.nodes.length - 1].h2 = [x1, y1];
        cur.nodes.push(node(px, py, [x2, y2]));
    };
    // a quadratic as the cubic it is
    const quad = (x1, y1, px, py) => cubic(x + 2*(x1 - x)/3, y + 2*(y1 - y)/3, px + 2*(x1 - px)/3, py + 2*(y1 - py)/3, px, py);
    const arc = (rx, ry, rot, large, sweep, px, py) => {
        // SVG F.6.5: endpoint to centre parameterization
        if (rx === 0 || ry === 0 || (x === px && y === py)) { line(px, py); return; }
        rx = Math.abs(rx); ry = Math.abs(ry);
        const phi = rot*Math.PI/180, cp = Math.cos(phi), sp = Math.sin(phi);
        const dx = (x - px)/2, dy = (y - py)/2;
        const x1 = cp*dx + sp*dy, y1 = -sp*dx + cp*dy;
        const lambda = (x1*x1)/(rx*rx) + (y1*y1)/(ry*ry);
        if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
        const sign = (large === sweep) ? -1 : 1;
        const num0 = rx*rx*ry*ry - rx*rx*y1*y1 - ry*ry*x1*x1;
        const den = rx*rx*y1*y1 + ry*ry*x1*x1;
        const coef = sign*Math.sqrt(Math.max(0, num0/den));
        const cx1 = coef*rx*y1/ry, cy1 = -coef*ry*x1/rx;
        const cx = cp*cx1 - sp*cy1 + (x + px)/2, cy = sp*cx1 + cp*cy1 + (y + py)/2;
        const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux*vy - uy*vx, ux*vx + uy*vy); return a; };
        const t1 = ang(1, 0, (x1 - cx1)/rx, (y1 - cy1)/ry);
        let dt = ang((x1 - cx1)/rx, (y1 - cy1)/ry, (-x1 - cx1)/rx, (-y1 - cy1)/ry);
        if (!sweep && dt > 0) dt -= 2*Math.PI;
        if (sweep && dt < 0) dt += 2*Math.PI;
        // the arc in pieces of at most a quarter turn, each a cubic
        const E = t => [cp*rx*Math.cos(t) - sp*ry*Math.sin(t) + cx, sp*rx*Math.cos(t) + cp*ry*Math.sin(t) + cy];
        const D = t => [-cp*rx*Math.sin(t) - sp*ry*Math.cos(t), -sp*rx*Math.sin(t) + cp*ry*Math.cos(t)];
        const pieces = Math.max(1, Math.ceil(Math.abs(dt)/(Math.PI/2) - 1e-9));
        for (let k = 0; k < pieces; k++) {
            const ta = t1 + dt*k/pieces, tb = t1 + dt*(k + 1)/pieces;
            const kappa = 4*Math.tan((tb - ta)/4)/3;
            const a = E(ta), b = (k === pieces - 1) ? [px, py] : E(tb), da = D(ta), db = D(tb);
            cubic(a[0] + kappa*da[0], a[1] + kappa*da[1], b[0] - kappa*db[0], b[1] - kappa*db[1], b[0], b[1]);
        }
    };
    while (i < tokens.length) {
        if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
        else if (cmd === 'M') cmd = 'L';
        else if (cmd === 'm') cmd = 'l';
        const rel = cmd === cmd.toLowerCase();
        const ox = rel ? x : 0, oy = rel ? y : 0;
        let nx, ny;
        switch (cmd.toUpperCase()) {
        case 'M': nx = ox + num(); ny = oy + num(); start(nx, ny); x = nx; y = ny; lastCtrl = null; break;
        case 'L': nx = ox + num(); ny = oy + num(); line(nx, ny); x = nx; y = ny; lastCtrl = null; break;
        case 'H': nx = ox + num(); line(nx, y); x = nx; lastCtrl = null; break;
        case 'V': ny = oy + num(); line(x, ny); y = ny; lastCtrl = null; break;
        case 'C': {
            const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num();
            nx = ox + num(); ny = oy + num();
            cubic(x1, y1, x2, y2, nx, ny); lastCtrl = [x2, y2]; x = nx; y = ny; break;
        }
        case 'S': {
            const x1 = lastCtrl && prev === 'C' ? 2*x - lastCtrl[0] : x, y1 = lastCtrl && prev === 'C' ? 2*y - lastCtrl[1] : y;
            const x2 = ox + num(), y2 = oy + num();
            nx = ox + num(); ny = oy + num();
            cubic(x1, y1, x2, y2, nx, ny); lastCtrl = [x2, y2]; x = nx; y = ny; break;
        }
        case 'Q': {
            const x1 = ox + num(), y1 = oy + num();
            nx = ox + num(); ny = oy + num();
            quad(x1, y1, nx, ny); lastCtrl = [x1, y1]; x = nx; y = ny; break;
        }
        case 'T': {
            const x1 = lastCtrl && prev === 'Q' ? 2*x - lastCtrl[0] : x, y1 = lastCtrl && prev === 'Q' ? 2*y - lastCtrl[1] : y;
            nx = ox + num(); ny = oy + num();
            quad(x1, y1, nx, ny); lastCtrl = [x1, y1]; x = nx; y = ny; break;
        }
        case 'A': {
            const rx = num(), ry = num(), rot = num(), large = num() !== 0, sweep = num() !== 0;
            nx = ox + num(); ny = oy + num();
            arc(rx, ry, rot, large, sweep, nx, ny); x = nx; y = ny; lastCtrl = null; break;
        }
        case 'Z': if (cur) { cur.closed = true; x = sx; y = sy; cur = null; } lastCtrl = null; break;
        default: i++; break;
        }
        const up = cmd.toUpperCase();
        prev = (up === 'C' || up === 'S') ? 'C' : ((up === 'Q' || up === 'T') ? 'Q' : up);
        if (!more() && i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) break;
    }
    return out.filter(sp => sp.nodes.length >= 2);
}

/** an ellipse as four cubic arcs */
function ellipseSubpath(cx, cy, rx, ry){
    const nodes = [];
    for (let k = 0; k < 4; k++) {
        const a = Math.PI*k/2, c = Math.cos(a), s = Math.sin(a);
        const p = [cx + rx*c, cy + ry*s], d = [-rx*s*KAPPA, ry*c*KAPPA];
        nodes.push({ p, h1: [p[0] - d[0], p[1] - d[1]], h2: [p[0] + d[0], p[1] + d[1]], smooth: true });
    }
    return [{ nodes, closed: true }];
}

/** straight segments through the points */
function polySubpath(points, closed){
    const nodes = [];
    for (let i = 0; i + 1 < points.length; i += 2) nodes.push({ p: [points[i], points[i + 1]], h1: null, h2: null });
    return nodes.length >= 2 ? [{ nodes, closed }] : [];
}

function numberList(str){
    return (str || '').match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) || [];
}

/** the subpaths of a shape element, in its user coordinates */
function shapeSubpaths(el){
    const n = name => parseFloat(el.getAttribute(name) || '0');
    switch (el.localName) {
    case 'path':     return pathSubpaths(el.getAttribute('d') || '');
    case 'rect': {
        const x = n('x'), y = n('y'), w = n('width'), h = n('height');
        return w > 0 && h > 0 ? polySubpath([x, y, x + w, y, x + w, y + h, x, y + h], true) : [];
    }
    case 'circle':   return ellipseSubpath(n('cx'), n('cy'), n('r'), n('r'));
    case 'ellipse':  return ellipseSubpath(n('cx'), n('cy'), n('rx'), n('ry'));
    case 'line':     return polySubpath([n('x1'), n('y1'), n('x2'), n('y2')], false);
    case 'polyline': return polySubpath(numberList(el.getAttribute('points')), false);
    case 'polygon':  return polySubpath(numberList(el.getAttribute('points')), true);
    default:         return [];
    }
}

// ── the document

/** the user-space box of the root: its viewBox, else its width and height */
function rootBox(svg){
    const vb = numberList(svg.getAttribute('viewBox'));
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return vb;
    const w = parseFloat(svg.getAttribute('width')) || 100, h = parseFloat(svg.getAttribute('height')) || 100;
    return [0, 0, w, h];
}

/**
 * the items of an SVG text fitted into the square box {cx, cy, half} of
 * the world (the largest fit leaving the margin, y up), in drawing order
 */
function svgToItems(text, box, margin = 0.1){
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (!svg || svg.localName !== 'svg') throw new Error('not an SVG document');
    const vb = rootBox(svg);
    const s = 2*box.half*(1 - margin)/Math.max(vb[2], vb[3]);
    const vcx = vb[0] + vb[2]/2, vcy = vb[1] + vb[3]/2;
    const toWorld = (x, y) => [box.cx + (x - vcx)*s, box.cy - (y - vcy)*s];

    /** the items of an element: a shape's, a group's (one group item for a <g> of several), the root's */
    function walk(el, ctm, inherited){
        if (el.nodeType !== 1) return [];
        const name = el.localName;
        if (name === 'defs' || name === 'symbol' || name === 'clipPath' || name === 'mask' || name === 'marker' || name === 'metadata' || name === 'title' || name === 'desc') return [];
        const m = multiply(ctm, parseTransform(el.getAttribute('transform')));
        const st = elementStyle(el, inherited);
        if (name === 'g' || name === 'svg' || name === 'a') {
            // a group's opacity is the group's own, applied to it as a whole, not its children's
            const passed = { ...st };
            if (name === 'g') delete passed.opacity;
            const children = [];
            for (const child of el.children) children.push(...walk(child, m, passed));
            if (name !== 'g' || !children.length) return children;
            const own = parseFloat(elementStyle(el, {}).opacity ?? '1');
            const opacity = Number.isFinite(own) ? own : 1;
            if (children.length === 1) {
                // no group for one shape: it takes the opacity
                const only = children[0];
                return [{ ...only, style: { ...only.style, opacity: (only.style.opacity ?? 1)*opacity } }];
            }
            return [{ type: 'group', children, style: { opacity } }];
        }
        const subpaths = shapeSubpaths(el);
        if (!subpaths.length) return [];
        const style = itemStyle(st, scaleOf(m)*s);
        const items = [];
        for (const sp of subpaths) {
            const map = q => { const p = apply(m, q[0], q[1]); return toWorld(p[0], p[1]); };
            const nodes = mappedNodes(sp.nodes, map);
            // an open shape has no fill; straight segments only: a polyline
            const itemStyle = { ...style, fill: sp.closed ? style.fill : null };
            const curved = nodes.some(nd => nd.h1 || nd.h2);
            const item = curved ? { type: 'path', closed: sp.closed, nodes, points: flattenNodes(nodes, sp.closed), style: itemStyle }
                                : { type: 'polyline', closed: sp.closed, points: nodes.flatMap(nd => nd.p), style: itemStyle };
            if (!item.style.fill && !item.style.stroke) continue;
            items.push(item);
        }
        return items;
    }
    return walk(svg, IDENTITY, {});
}

export { svgToItems };
