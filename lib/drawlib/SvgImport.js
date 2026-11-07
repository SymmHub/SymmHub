//
//  SVG import: the shapes of an SVG document as path and polyline items
//
//  Paths (all commands; curves kept as cubics, quadratics and arcs as the
//  cubics they are or nearly are), rects, circles, ellipses (four cubic
//  arcs), lines, polylines and polygons, in groups with transforms, with
//  the presentation attributes fill, stroke, stroke-width, opacity,
//  fill-opacity, stroke-opacity, fill-rule, display and visibility
//  (attributes, style sheets of the document or the style attribute, in
//  that order, inherited), <use> of them and of <symbol>. A shape of straight
//  segments is a polyline item, one with curves a path item (Paths.js), a
//  path of several closed subpaths one compound path, its holes kept; a <g>
//  of several shapes is a group item (its opacity the group's own), a <g> of
//  one shape that shape. A gradient comes in as its first colour. The
//  drawing is fitted into a square box of the world, y up. Not taken:
//  images, patterns, clip paths, masks, filters; itemsOfSvg counts what it
//  left out, so that the import can say so, and gives the document's
//  viewport as a rect, whose frame clips the items as SVG does (Frames.js).
//
//  Text is outlines, a compound path per paint of a <text>. A browser draws
//  text but does not hand over its curves, so outlineText() has it drawn,
//  alone and large, and traces that (OutlineTrace.js): the placing of the
//  letters is the browser's whole, tspans, anchors and spacing, and any font
//  it can draw will do, the one it falls back on too. That takes an image to
//  load, so it runs apart, before itemsOfSvg, which is not asynchronous.
//

import {
    shapeGeometry,
    shapeMapped,
    flattenNodes,
    mappedNodes,
    coverageRings,
    ringNodes,
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

// what a text takes along when it is drawn alone
const TEXT_KEYS = ['font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch', 'font-variant', 'font-kerning', 'font-feature-settings',
                   'letter-spacing', 'word-spacing', 'text-anchor', 'text-decoration', 'direction', 'writing-mode', 'dominant-baseline', 'baseline-shift', 'white-space'];
const STYLE_KEYS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule',
                    'color', 'display', 'visibility', 'stop-color', 'stop-opacity', 'clip-path', 'mask', 'filter', ...TEXT_KEYS];
// the parts of a text that differ in these are paths of their own
const PAINT_KEYS = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'color'];
// what an element can ask for and the import leaves out, by the name it says
const NOT_TAKEN = { 'clip-path': 'clip path', mask: 'mask', filter: 'filter' };

/** the weight of a selector: its ids, then classes, attributes and pseudo-classes, then elements */
function specificity(selector){
    const s = selector.replace(/"[^"]*"|'[^']*'/g, '');
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
    const types = (s.match(/(?:^|[\s>+~])[a-zA-Z][\w-]*|::[\w-]+/g) || []).length;
    return 10000*ids + 100*classes + types;
}

/**
 * the style rules of the document's <style> elements, the weakest first:
 * {selector, declarations [[key, value, important]]}. @media and the like
 * are not read
 */
function styleRules(doc){
    const rules = [];
    for (const el of doc.querySelectorAll('style')) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(el.textContent);
        for (const rule of sheet.cssRules) {
            if (!rule.selectorText) continue;
            const declarations = STYLE_KEYS.filter(key => rule.style.getPropertyValue(key))
                                           .map(key => [key, rule.style.getPropertyValue(key), !!rule.style.getPropertyPriority(key)]);
            if (!declarations.length) continue;
            for (const selector of rule.selectorText.split(',')) rules.push({ selector, declarations, weight: specificity(selector) });
        }
    }
    return rules.sort((a, b) => a.weight - b.weight);
}

function matches(el, selector){
    try { return el.matches(selector); } catch (e) { return false; }
}

/** the element's style over the inherited one: its attributes, the rules matching it, its style attribute */
function elementStyle(el, inherited, rules = []){
    const st = { ...inherited }, important = {};
    for (const key of STYLE_KEYS) {
        const v = el.getAttribute(key);
        if (v !== null) st[key] = v.trim();
    }
    for (const rule of rules) {
        if (!matches(el, rule.selector)) continue;
        for (const [key, value, strong] of rule.declarations) (strong ? important : st)[key] = value;
    }
    const css = el.getAttribute('style');
    if (css) {
        for (const decl of css.split(';')) {
            const i = decl.indexOf(':');
            if (i < 0) continue;
            const key = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
            if (STYLE_KEYS.includes(key)) (/!important$/i.test(v) ? important : st)[key] = v.replace(/\s*!important$/i, '');
        }
    }
    Object.assign(st, important);
    for (const key of Object.keys(st)) {
        if (st[key] !== 'inherit') continue;
        if (key in inherited) st[key] = inherited[key]; else delete st[key];
    }
    return st;
}

/** the item style of an SVG style, with the stroke width in world units */
function itemStyle(st, lengthScale){
    const opacity = parseFloat(st.opacity ?? '1');
    const fillOpacity = parseFloat(st['fill-opacity'] ?? '1');
    const strokeOpacity = parseFloat(st['stroke-opacity'] ?? '1');
    const miterLimit = parseFloat(st['stroke-miterlimit'] ?? '4');
    return {
        fill:        parseColor(st.fill ?? '#000', fillOpacity),
        stroke:      parseColor(st.stroke ?? 'none', strokeOpacity),
        strokeWidth: parseFloat(st['stroke-width'] ?? '1')*lengthScale,
        lineCap:     st['stroke-linecap'] || 'butt',
        lineJoin:    st['stroke-linejoin'] || 'miter',
        miterLimit:  miterLimit >= 1 ? miterLimit : 4,
        opacity:     Number.isFinite(opacity) ? opacity : 1,
        ...(st['fill-rule'] === 'evenodd' ? { fillRule: 'evenodd' } : {}),
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
        case 'Z':
            if (cur) {
                cur.closed = true;
                // a last node on the first one is the first one (its handle in)
                const nodes = cur.nodes, first = nodes[0], last = nodes[nodes.length - 1];
                if (nodes.length > 2 && Math.hypot(last.p[0] - first.p[0], last.p[1] - first.p[1]) < 1e-9) { first.h1 = last.h1; nodes.pop(); }
                x = sx; y = sy; cur = null;
            }
            lastCtrl = null; break;
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

/** the numbers of a rect, circle or ellipse element (Shapes.js, user coordinates), or null */
function parametricShape(el){
    const n = name => parseFloat(el.getAttribute(name) || '0');
    switch (el.localName) {
    case 'rect': {
        const w = n('width'), h = n('height');
        if (!(w > 0 && h > 0)) return null;
        const rx = el.hasAttribute('rx') ? n('rx') : n('ry'), ry = el.hasAttribute('ry') ? n('ry') : rx;
        return { kind: 'rect', cx: n('x') + w/2, cy: n('y') + h/2, rx: w/2, ry: h/2, angle: 0, round: Math.max(rx, ry) > 0 ? Math.max(rx, ry)/Math.min(w/2, h/2) : 0 };
    }
    case 'circle':  return n('r') > 0 ? { kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('r'), ry: n('r'), angle: 0 } : null;
    case 'ellipse': return n('rx') > 0 && n('ry') > 0 ? { kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('rx'), ry: n('ry'), angle: 0 } : null;
    default: return null;
    }
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

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SHAPE_NAMES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
// elements that show nothing where they stand
const UNSHOWN_NAMES = new Set(['defs', 'symbol', 'clipPath', 'mask', 'marker', 'metadata', 'title', 'desc', 'style', 'script',
                               'linearGradient', 'radialGradient', 'pattern', 'filter']);
// uses in one document: nesting them doubles what they draw at every level
const MAX_USES = 100000;

/** the user-space box of the root: its viewBox, else its width and height */
function rootBox(svg){
    const vb = numberList(svg.getAttribute('viewBox'));
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return vb;
    const w = parseFloat(svg.getAttribute('width')) || 100, h = parseFloat(svg.getAttribute('height')) || 100;
    return [0, 0, w, h];
}

/** a length of an attribute: a percentage of whole, whole when there is none */
function lengthOf(str, whole){
    const v = parseFloat(str);
    if (!Number.isFinite(v)) return whole;
    return /%\s*$/.test(str) ? v/100*whole : v;
}

/** the map of an element's viewBox onto the box x, y, w, h, as its preserveAspectRatio says (by default centred, whole) */
function viewBoxMatrix(el, x, y, w, h){
    const vb = numberList(el.getAttribute('viewBox'));
    if (vb.length !== 4 || !(vb[2] > 0 && vb[3] > 0)) return [1, 0, 0, 1, x, y];
    const [align, fit] = (el.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim().split(/\s+/);
    let sx = w/vb[2], sy = h/vb[3];
    if (align !== 'none') sx = sy = fit === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
    const fx = /xMin/.test(align) ? 0 : /xMax/.test(align) ? 1 : 0.5, fy = /YMin/.test(align) ? 0 : /YMax/.test(align) ? 1 : 0.5;
    return [sx, 0, 0, sy, x - vb[0]*sx + fx*(w - vb[2]*sx), y - vb[1]*sy + fy*(h - vb[3]*sy)];
}

/** a path item of the mapped subpaths: a closed one, or several as one compound path (Paths.js) */
function ringsItem(rings, map, style){
    const nodes = rings.flatMap((sp, k) => mappedNodes(sp.nodes, map).map((nd, i) => (
        k < rings.length - 1 && i === sp.nodes.length - 1 ? { ...nd, ringEnd: true } : nd)));
    return { type: 'path', closed: true, nodes, points: flattenNodes(nodes, true), style };
}

const elementById = (doc, id) => doc.querySelector(`[id="${CSS.escape(id)}"]`);

/** the element a use, a gradient's or a textPath's href names in its document */
function hrefOf(el){
    const href = el.getAttribute('href') ?? el.getAttributeNS(XLINK_NS, 'href') ?? '';
    return href.startsWith('#') ? elementById(el.ownerDocument, href.slice(1)) : null;
}

// ── text as outlines

// a text is drawn with an em this many pixels long, on a canvas no longer than this
const TRACE_EM = 1536;
const TRACE_SIDE = 4096;
// how far its outlines may stray from what is drawn, and how far they look for corners, in ems
const TRACE_TOLERANCE = 0.0005;
const TRACE_REACH = 0.004;
// more texts than this stay left out: each takes a canvas to draw
const MAX_TRACED_TEXTS = 200;
const DRAWN_BLACK = '*{fill:#000!important;stroke:none!important;fill-opacity:1!important;stroke-opacity:1!important;opacity:1!important;'
                  + 'filter:none!important;mask:none!important;clip-path:none!important;transform:none!important}';

/**
 * the parts of a text by their paint: {parts, the elements holding its
 * letters; chain, the elements from the text down to the first of them}.
 * What is hidden is in none
 */
function textRuns(el, st, rules){
    const runs = new Map();
    const visit = (part, own, chain) => {
        if (own.display === 'none') return;
        const shown = own.visibility !== 'hidden' && own.visibility !== 'collapse';
        if (shown && [...part.childNodes].some(n => (n.nodeType === 3 || n.nodeType === 4) && n.textContent.trim())) {
            const key = PAINT_KEYS.map(k => own[k]).join('|');
            if (!runs.has(key)) runs.set(key, { chain, parts: new Set() });
            runs.get(key).parts.add(part);
        }
        for (const child of part.children) {
            if (child.localName !== 'title' && child.localName !== 'desc') visit(child, elementStyle(child, own, rules), [...chain, child]);
        }
    };
    visit(el, st, []);
    return [...runs.values()];
}

/** an SVG holding a copy of the text and all it needs, nothing else, in the coordinates the text had: {root, copy} */
function textAlone({ doc, svg }, el, st){
    const make = (name) => doc.createElementNS(SVG_NS, name);
    const root = make('svg'), force = make('style'), defs = make('defs'), inner = make('svg'), copy = el.cloneNode(true), vb = rootBox(svg);
    force.textContent = DRAWN_BLACK;
    for (const path of el.querySelectorAll('textPath')) {
        const target = hrefOf(path);
        if (target) defs.append(target.cloneNode(true));
    }
    // a percentage in the text is of the document's box still, whatever part of it is drawn
    const box = { x: vb[0], y: vb[1], width: vb[2], height: vb[3], viewBox: vb.join(' '), overflow: 'visible' };
    Object.entries(box).forEach(([key, value]) => inner.setAttribute(key, value));
    const font = TEXT_KEYS.filter(key => st[key]).map(key => `${key}:${st[key]}`).join(';');
    copy.setAttribute('style', `${copy.getAttribute('style') || ''};${font}`);
    inner.append(copy);
    root.append(...[...doc.querySelectorAll('style')].map(style => style.cloneNode(true)), force, defs, inner);
    return { root, copy };
}

/** the box a text takes up in its own coordinates and its em, measured out of sight; its styles stay in a shadow */
function measuredText(root){
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
    const live = document.importNode(root, true);
    host.attachShadow({ mode: 'open' }).append(live);
    document.body.append(host);
    try {
        const text = live.querySelector('text'), em = parseFloat(getComputedStyle(text).fontSize);
        // at the size it will be drawn: a font of a fraction of a pixel has no good box
        live.setAttribute('width', 1000);
        live.setAttribute('height', 1000);
        live.setAttribute('viewBox', `0 0 ${1000*em/TRACE_EM} ${1000*em/TRACE_EM}`);
        const { x, y, width, height } = text.getBBox();
        return { x, y, width, height, em };
    } finally {
        host.remove();
    }
}

/** how much of each pixel an SVG covers, as drawn by the browser */
async function drawnCoverage(root, width, height){
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }));
    try {
        const image = new Image();
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
        const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data, values = new Float32Array(width*height);
        for (let i = 0; i < values.length; i++) values[i] = data[4*i + 3]/255;
        return values;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function touchesEdge(values, width, height){
    for (let x = 0; x < width; x++) if (values[x] > 0 || values[(height - 1)*width + x] > 0) return true;
    for (let y = 0; y < height; y++) if (values[y*width] > 0 || values[y*width + width - 1] > 0) return true;
    return false;
}

/** the rings ({nodes}, the text's coordinates) of an SVG drawn around a box with a margin; null when ink reaches the margin's end, unless told to take what there is */
async function tracedRings(root, box, pad, last){
    const wide = box.width + 2*pad, high = box.height + 2*pad;
    const scale = Math.min(TRACE_EM/box.em, TRACE_SIDE/Math.max(wide, high));
    const width = Math.ceil(wide*scale), height = Math.ceil(high*scale), left = box.x - pad, top = box.y - pad;
    root.setAttribute('viewBox', `${left} ${top} ${width/scale} ${height/scale}`);
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    const values = await drawnCoverage(root, width, height);
    if (!last && touchesEdge(values, width, height)) return null;
    const em = box.em*scale, tolerance = Math.max(0.5, TRACE_TOLERANCE*em), reach = Math.max(3, Math.round(TRACE_REACH*em));
    // a pixel's value stands at its middle
    const toText = q => [left + (q[0] + 0.5)/scale, top + (q[1] + 0.5)/scale];
    return coverageRings(values, width, height).map(ring => ({ nodes: mappedNodes(ringNodes(ring, tolerance, reach), toText) }));
}

/** the outlines of a text, one {chain, rings} per paint of its parts */
async function tracedText(source, el, st){
    const runs = textRuns(el, st, source.rules), { root, copy } = textAlone(source, el, st);
    const box = measuredText(root);
    if (!runs.length || !(box.width > 0 && box.height > 0 && box.em > 0)) return [];
    const parts = [el, ...el.querySelectorAll('*')], copies = [copy, ...copy.querySelectorAll('*')];
    const styles = copies.map(c => c.getAttribute('style') || '');
    const out = [];
    for (const { chain, parts: shown } of runs) {
        // what is not of this paint keeps its place, unseen
        copies.forEach((c, i) => c.setAttribute('style', `${styles[i]};visibility:${shown.has(parts[i]) ? 'visible' : 'hidden'}!important`));
        // what is drawn can reach beyond the box measured
        let rings = null;
        for (let tries = 0, pad = 0.25*box.em; !rings; tries++, pad *= 3) rings = await tracedRings(root, box, pad, tries === 2);
        out.push({ chain, rings });
    }
    return out;
}

/** the text of a parsed SVG (parseSvg) traced for itemsOfSvg; a text that cannot be stays left out */
async function outlineText(source){
    const reached = new Map();
    itemsOfSvg({ ...source, reached }, { cx: 0, cy: 0, half: 1 }, 0);
    for (const [el, st] of [...reached].slice(0, MAX_TRACED_TEXTS)) {
        try {
            source.outlines.set(el, await tracedText(source, el, st));
        } catch (e) {
            console.warn('a text could not be traced', e);
        }
    }
}

/** an SVG text parsed, for outlineText and itemsOfSvg; throws when it is none */
function parseSvg(text){
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('not a valid SVG document');
    return { doc, svg, rules: styleRules(doc), outlines: new Map() };
}

/**
 * the items of a parsed SVG fitted into the square box {cx, cy, half} of
 * the world (the largest fit leaving the margin, y up), in drawing order;
 * returns {items, skipped, viewport}: skipped counts what was left out by
 * name, viewport is the rect (Shapes.js) of the document's box in the world
 */
function itemsOfSvg({ doc, svg, rules, outlines, reached = null }, box, margin = 0.1){
    const vb = rootBox(svg);
    const skipped = {};
    const skip = (what) => { skipped[what] = (skipped[what] || 0) + 1; };
    // the elements being drawn through a use, and how many have been
    const using = new Set();
    let uses = 0;
    const s = 2*box.half*(1 - margin)/Math.max(vb[2], vb[3]);
    const vcx = vb[0] + vb[2]/2, vcy = vb[1] + vb[3]/2;
    const toWorld = (x, y) => [box.cx + (x - vcx)*s, box.cy - (y - vcy)*s];

    /** the first stop of a gradient, or of the one it takes its stops from */
    function firstStop(gradient, seen = new Set()){
        if (!gradient || seen.has(gradient)) return null;
        seen.add(gradient);
        return [...gradient.children].find(c => c.localName === 'stop') || firstStop(hrefOf(gradient), seen);
    }

    /**
     * a paint (fill or stroke) as {color, opacity}: currentColor the element's
     * colour; a reference a gradient's first colour, a pattern grey, else
     * the fallback after it, or nothing, as in SVG
     */
    function flatPaint(paint, st, what){
        const value = (paint ?? '').trim();
        if (/^currentcolor$/i.test(value)) return { color: st.color ?? '#000', opacity: 1 };
        const ref = value.match(/^url\(\s*["']?#([^"')\s]+)["']?\s*\)\s*(.*)$/);
        if (!ref) return { color: paint, opacity: 1 };
        const target = elementById(doc, ref[1]);
        if (target && target.localName === 'pattern') {
            skip(`pattern ${what} as grey`);
            return { color: '#808080', opacity: 1 };
        }
        if (!target || !/Gradient$/.test(target.localName)) return { color: ref[2] || 'none', opacity: 1 };
        skip(`gradient ${what} as one colour`);
        const stop = firstStop(target);
        if (!stop) return { color: 'none', opacity: 1 };
        const own = elementStyle(stop, {}, rules);
        const opacity = parseFloat(own['stop-opacity'] ?? '1');
        const color = own['stop-color'] ?? '#000';
        return { color: /^currentcolor$/i.test(color) ? own.color ?? st.color ?? '#000' : color, opacity: Number.isFinite(opacity) ? opacity : 1 };
    }

    /** an item's style from an element's, m its map to the document */
    function paintStyle(st, m){
        const fill = flatPaint(st.fill ?? '#000', st, 'fill'), stroke = flatPaint(st.stroke ?? 'none', st, 'stroke');
        return itemStyle({ ...st, fill: fill.color, stroke: stroke.color,
                           'fill-opacity': String(parseFloat(st['fill-opacity'] ?? '1')*fill.opacity),
                           'stroke-opacity': String(parseFloat(st['stroke-opacity'] ?? '1')*stroke.opacity) }, scaleOf(m)*s);
    }

    /** a text's items, a path per paint of its parts, once it has been traced (outlineText); until then it is left out */
    function textItems(el, st, m){
        if (!el.textContent.trim()) return [];
        if (reached && !reached.has(el)) reached.set(el, st);
        const runs = outlines.get(el);
        if (!runs) { skip('text'); return []; }
        const map = q => { const p = apply(m, q[0], q[1]); return toWorld(p[0], p[1]); };
        return runs.flatMap(({ chain, rings }) => {
            // the opacity of a text is of the whole of it
            const own = { ...chain.reduce((inner, part) => elementStyle(part, inner, rules), st), opacity: st.opacity };
            const style = paintStyle(own, m);
            // the rings of a trace come in any direction
            return rings.length && (style.fill || style.stroke) ? [ringsItem(rings, map, { ...style, fillRule: 'evenodd' })] : [];
        });
    }

    /** the items of an element: a shape's, a group's (one group item for a <g> of several), the root's */
    function walk(el, ctm, inherited, used = null){
        if (el.nodeType !== 1) return [];
        const name = el.localName;
        if (UNSHOWN_NAMES.has(name) && !(name === 'symbol' && used)) return [];
        let m = multiply(ctm, parseTransform(el.getAttribute('transform')));
        const st = elementStyle(el, inherited, rules);
        for (const key of Object.keys(NOT_TAKEN)) {
            if (st[key] && st[key] !== 'none') skip(NOT_TAKEN[key]);
            delete st[key];
        }
        if (st.display === 'none') return [];
        const nested = name === 'svg' && el !== svg;
        if (name === 'g' || name === 'svg' || name === 'a' || name === 'use' || name === 'symbol') {
            // a group's opacity is the group's own, applied to it as a whole, not its children's
            const whole = name !== 'a' && (name !== 'svg' || nested);
            const passed = { ...st };
            if (whole) delete passed.opacity;
            let inside = [...el.children], target = null;
            if (name === 'use') {
                target = hrefOf(el);
                if (!target) { skip('broken use'); return []; }
                if (using.has(target) || ++uses > MAX_USES) { skip('use within itself'); return []; }
                m = multiply(m, [1, 0, 0, 1, lengthOf(el.getAttribute('x'), 0), lengthOf(el.getAttribute('y'), 0)]);
                inside = [target];
            } else if (name === 'symbol' || nested) {
                // its viewBox onto the use's size or its own, by default the document's
                const side = (key, whole0) => lengthOf((used && used.getAttribute(key)) ?? el.getAttribute(key), whole0);
                m = multiply(m, viewBoxMatrix(el, nested ? lengthOf(el.getAttribute('x'), 0) : 0, nested ? lengthOf(el.getAttribute('y'), 0) : 0,
                                              side('width', vb[2]), side('height', vb[3])));
            }
            const children = [];
            if (target) using.add(target);
            for (const child of inside) children.push(...walk(child, m, passed, target ? el : null));
            if (target) using.delete(target);
            if (!whole || !children.length) return children;
            const own = parseFloat(elementStyle(el, {}, rules).opacity ?? '1');
            const opacity = Number.isFinite(own) ? own : 1;
            if (children.length === 1) {
                // no group for one shape: it takes the opacity
                const only = children[0];
                return [{ ...only, style: { ...only.style, opacity: (only.style.opacity ?? 1)*opacity } }];
            }
            return [{ type: 'group', children, style: { opacity } }];
        }
        if (name === 'text') return textItems(el, st, m);
        if (!SHAPE_NAMES.has(name)) {
            // an editor's own elements are no loss (Inkscape's sodipodi:namedview)
            if (!el.namespaceURI || el.namespaceURI === SVG_NS) skip(name);
            return [];
        }
        if (st.visibility === 'hidden' || st.visibility === 'collapse') return [];
        const style = paintStyle(st, m);
        if (!style.fill && !style.stroke) return [];
        // a rect, circle or ellipse keeps its numbers when the map keeps its kind
        const param = parametricShape(el);
        if (param) {
            const shape = shapeMapped(param, q => { const p = apply(m, q[0], q[1]); return toWorld(p[0], p[1]); });
            if (shape) {
                const g = shapeGeometry(shape);
                return [g.nodes ? { type: 'path', closed: true, nodes: g.nodes, points: flattenNodes(g.nodes, true), style, shape }
                                : { type: 'polyline', closed: true, points: g.points, style, shape }];
            }
        }
        const subpaths = shapeSubpaths(el);
        if (!subpaths.length) return [];
        const map = q => { const p = apply(m, q[0], q[1]); return toWorld(p[0], p[1]); };
        const rings = subpaths.filter(sp => sp.closed);
        const items = rings.length > 1 ? [ringsItem(rings, map, style)] : [];
        for (const sp of rings.length > 1 ? subpaths.filter(sp => !sp.closed) : subpaths) {
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
    const items = walk(svg, IDENTITY, {});
    return { items, skipped, viewport: { kind: 'rect', cx: box.cx, cy: box.cy, rx: 0.5*vb[2]*s, ry: 0.5*vb[3]*s, angle: 0 } };
}

export { parseSvg, outlineText, itemsOfSvg };
