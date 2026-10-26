//
//  SVG export: the drawing's items as an SVG document, and the symmetric
//  pattern - the items and their copies under the group over a region -
//  as one
//
//  The coordinates are the world's (y up): the document's content sits in
//  a group with scale(1 -1) and the viewBox is the region flipped, so the
//  numbers in the file are the drawing's own. A path keeps its cubics, a
//  polyline its segments, an image goes on its quad (a unit square under a
//  matrix), a group is a <g>, a closed item with items inside a <g> with
//  its fill, the items clipped by its outline, and its stroke on top (as
//  ItemRenderer draws it). In the pattern a copy under an affine map keeps
//  its curves (the control points mapped); under any other map it is the
//  outline, flattened finely, mapped point by point.
//

import {
    CrownCalculator,
    worldToPatternMap,
    patternToWorldMap,
    applyTransform,
    composeTransforms,
    localScale,
    itemCopies,
    mappedItem,
    flattenedItem,
} from './modules.js';

const MARGIN = 0.05;            // of the content's size round a drawing export
const PATTERN_TILES = 4000;     // at most this many tiles of the region
const PATTERN_GRID = 12;        // the crown's grid radius for the region
const EXPORT_FLAT_TOL = 5e-4;   // flattening of curves mapped point by point, of their extent
const TINY = 1e-5;              // a copy smaller than this (of the region) is left out
const INTRINSIC_PX = 1000;      // the document's longer side, in px, for viewers

const fmt = v => {
    const s = (Math.round(v*1e6)/1e6).toString();
    return s === '-0' ? '0' : s;
};

const hex = rgba => '#' + rgba.slice(0, 3).map(c => Math.round(255*Math.min(1, Math.max(0, c))).toString(16).padStart(2, '0')).join('');

function paintAttrs(name, paint){
    if (!paint) return `${name}="none"`;
    const a = paint.rgba[3] ?? 1;
    return `${name}="${hex(paint.rgba)}"` + (a < 1 ? ` ${name}-opacity="${fmt(a)}"` : '');
}

function strokeAttrs(style){
    if (!style.stroke || !(style.strokeWidth > 0)) return 'stroke="none"';
    return `${paintAttrs('stroke', style.stroke)} stroke-width="${fmt(style.strokeWidth)}" stroke-linecap="${style.lineCap || 'round'}" stroke-linejoin="${style.lineJoin || 'round'}"`;
}

function opacityAttr(style){
    const o = style.opacity ?? 1;
    return o < 1 ? ` opacity="${fmt(o)}"` : '';
}

/** the path data of a shape: its cubics, else its segments */
function pathData(item){
    if (item.nodes && item.nodes.length) {
        const nodes = item.nodes, n = nodes.length;
        let d = `M ${fmt(nodes[0].p[0])} ${fmt(nodes[0].p[1])}`;
        const segs = item.closed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
            const a = nodes[i], b = nodes[(i + 1) % n];
            if (!a.h2 && !b.h1) d += ` L ${fmt(b.p[0])} ${fmt(b.p[1])}`;
            else { const c1 = a.h2 || a.p, c2 = b.h1 || b.p; d += ` C ${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(b.p[0])} ${fmt(b.p[1])}`; }
        }
        return item.closed ? d + ' Z' : d;
    }
    const p = item.points;
    if (p.length < 4) return '';
    let d = `M ${fmt(p[0])} ${fmt(p[1])}`;
    for (let i = 2; i + 1 < p.length; i += 2) d += ` L ${fmt(p[i])} ${fmt(p[i + 1])}`;
    return item.closed ? d + ' Z' : d;
}

/** the items as SVG elements, one line each, indented */
function itemsSvg(items, indent, ids){
    const lines = [];
    for (const item of items) {
        const style = item.style || {};
        if (item.type === 'group') {
            lines.push(`${indent}<g${opacityAttr(style)}>`);
            lines.push(...itemsSvg(item.children || [], indent + '  ', ids));
            lines.push(`${indent}</g>`);
            continue;
        }
        if (item.type === 'image') {
            const p = item.points;
            if (!item.src || p.length < 8) continue;
            // the unit square onto the quad: its x axis the top edge, its y axis down the left edge
            const m = [p[4] - p[6], p[5] - p[7], p[0] - p[6], p[1] - p[7], p[6], p[7]].map(fmt).join(' ');
            lines.push(`${indent}<image width="1" height="1" preserveAspectRatio="none" transform="matrix(${m})"${opacityAttr(style)} href="${item.src}"/>`);
            continue;
        }
        const d = pathData(item);
        if (!d) continue;
        const fill = item.closed ? paintAttrs('fill', style.fill) : 'fill="none"';
        if (item.closed && item.children && item.children.length) {
            // the fill, the items inside clipped by the outline, the stroke on top
            const id = 'clip' + (++ids.n);
            lines.push(`${indent}<g${opacityAttr(style)}>`);
            if (style.fill) lines.push(`${indent}  <path d="${d}" ${fill} stroke="none"/>`);
            lines.push(`${indent}  <clipPath id="${id}"><path d="${d}"/></clipPath>`);
            lines.push(`${indent}  <g clip-path="url(#${id})">`);
            lines.push(...itemsSvg(item.children, indent + '    ', ids));
            lines.push(`${indent}  </g>`);
            if (style.stroke && style.strokeWidth > 0) lines.push(`${indent}  <path d="${d}" fill="none" ${strokeAttrs(style)}/>`);
            lines.push(`${indent}</g>`);
            continue;
        }
        lines.push(`${indent}<path d="${d}" ${fill} ${strokeAttrs(style)}${opacityAttr(style)}/>`);
    }
    return lines;
}

/** the box [x0, y0, x1, y1] round the items, their stroke widths in, or null */
function itemsBox(items){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = (it) => {
        const half = (it.style && it.style.stroke) ? 0.5*(it.style.strokeWidth || 0) : 0;
        for (let i = 0; i + 1 < it.points.length; i += 2) {
            x0 = Math.min(x0, it.points[i] - half);     x1 = Math.max(x1, it.points[i] + half);
            y0 = Math.min(y0, it.points[i + 1] - half); y1 = Math.max(y1, it.points[i + 1] + half);
        }
        if (it.children) it.children.forEach(take);
    };
    items.forEach(take);
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
}

/**
 * an SVG document of the items (world coordinates) over the region [x0,
 * y0, x1, y1]; without a region, over the items with a margin
 */
function itemsToSvg(items, region = null){
    let box = region;
    if (!box) {
        box = itemsBox(items) || [-1, -1, 1, 1];
        const m = MARGIN*Math.max(box[2] - box[0], box[3] - box[1], 1e-6);
        box = [box[0] - m, box[1] - m, box[2] + m, box[3] + m];
    }
    const w = box[2] - box[0], h = box[3] - box[1];
    // the document's size: INTRINSIC_PX on its longer side
    const px = INTRINSIC_PX/Math.max(w, h, 1e-9);
    const lines = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(box[0])} ${fmt(-box[3])} ${fmt(w)} ${fmt(h)}" width="${fmt(w*px)}" height="${fmt(h*px)}">`,
        '  <g transform="scale(1 -1)">',
        ...itemsSvg(items, '    ', { n: 0 }),
        '  </g>',
        '</svg>',
        '',
    ];
    return lines.join('\n');
}

/** is the map affine on the box: the midpoints of two chords map to the midpoints of their images */
function isAffine(map, box){
    const size = Math.max(box[2] - box[0], box[3] - box[1], 1e-9);
    const chords = [[[box[0], box[1]], [box[2], box[3]]], [[box[0], box[3]], [box[2], box[1]]]];
    for (const [a, b] of chords) {
        const ma = map(a), mb = map(b), mm = map([0.5*(a[0] + b[0]), 0.5*(a[1] + b[1])]);
        if (Math.hypot(mm[0] - 0.5*(ma[0] + mb[0]), mm[1] - 0.5*(ma[1] + mb[1])) > 1e-9*size) return false;
    }
    return true;
}

/** the item with its stroke widths (and its children's) times s */
function strokesScaled(item, s){
    const out = { ...item, style: { ...item.style, strokeWidth: (item.style.strokeWidth || 0)*s } };
    if (item.children) out.children = item.children.map(c => strokesScaled(c, s));
    return out;
}

/**
 * an SVG document of the symmetric pattern: every copy of the items under
 * the group that meets the region
 *   items:  the drawing's items (world coordinates)
 *   group:  the group in pattern coordinates
 *   ptc:    the pattern transform (world to pattern)
 *   region: [x0, y0, x1, y1], world
 */
function patternSvg({ items, group, ptc, region }){
    const toP = worldToPatternMap(ptc), fromP = patternToWorldMap(ptc);
    // the region in pattern coordinates, and the tiles meeting it
    let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    for (const c of [[region[0], region[1]], [region[2], region[1]], [region[2], region[3]], [region[0], region[3]]]) {
        const q = toP.map(c[0], c[1]);
        rx0 = Math.min(rx0, q[0]); rx1 = Math.max(rx1, q[0]); ry0 = Math.min(ry0, q[1]); ry1 = Math.max(ry1, q[1]);
    }
    const half = 0.5*Math.max(rx1 - rx0, ry1 - ry0);
    const tiles = group
        ? CrownCalculator.calculate(group, { centerX: 0.5*(rx0 + rx1), centerY: 0.5*(ry0 + ry1), scale: half, angle: 0 }, { gridRadius: PATTERN_GRID, maxCount: PATTERN_TILES })
        : [null];
    const regionSize = Math.max(region[2] - region[0], region[3] - region[1]);
    const meets = (b, pad) => b && b[2] + pad >= region[0] && b[0] - pad <= region[2] && b[3] + pad >= region[1] && b[1] - pad <= region[3];
    const out = [];
    for (const item of items) {
        if (!group) { out.push(item); continue; }
        const box = itemsBox([item]);
        if (!box) continue;
        // the item's own tiles (pattern coordinates): the copies are their images in the region's tiles
        let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
        for (let i = 0; i + 1 < item.points.length; i += 2) {
            const q = toP.map(item.points[i], item.points[i + 1]);
            px0 = Math.min(px0, q[0]); px1 = Math.max(px1, q[0]); py0 = Math.min(py0, q[1]); py1 = Math.max(py1, q[1]);
        }
        const centre = [0.5*(px0 + px1), 0.5*(py0 + py1)];
        const own = itemCopies(group, { cx: centre[0], cy: centre[1], half: 0.5*Math.max(px1 - px0, py1 - py0, 1e-6) });
        const seen = new Set();
        for (const t of tiles) {
            const fromFD = t.getInverse();
            for (const h of own) {
                const g = composeTransforms(h.toFD, fromFD);
                const key = g ? CrownCalculator.elementKey(g) : 'e';
                if (seen.has(key)) continue;
                seen.add(key);
                const map = w => { const q = applyTransform(g, toP.map(w[0], w[1])); return fromP.map(q[0], q[1]); };
                const s = localScale(g, centre);
                const source = isAffine(map, box) ? item : flattenedItem(item, EXPORT_FLAT_TOL);
                const copy = strokesScaled(mappedItem(source, map), s);
                const cb = itemsBox([copy]);
                if (!cb || !meets(cb, 0)) continue;
                if (Math.max(cb[2] - cb[0], cb[3] - cb[1]) < TINY*regionSize) continue;
                out.push(copy);
            }
        }
    }
    return itemsToSvg(out, region);
}

export { itemsToSvg, patternSvg };
