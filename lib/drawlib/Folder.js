import {
    iPoint,
    wordToPerm,
} from './modules.js';

//
//  folding of the drawing next to the fundamental domain
//
//  The items are in world coordinates and stay there. To render them into
//  the pattern buffer, each item is moved by its fold element h. An item that
//  lies in the shown region (Orbits.shownRegion: the part of the pattern box
//  the layers show at every copy) is not moved (h = null): it is shown where
//  it is, as a sympix image is. Any other item gets the group element that
//  toFundDomain() returns for its anchor (the centre of its bounding box),
//  which puts it next to the fundamental domain.
//  Without colours the symmetric picture is the same for every choice of h.
//  With colour symmetry it is not: the item is shown in the colour of the copy
//  h^-1, so moving an item from one h to another changes its colour, and
//  leaving items where they are keeps their colour while they are dragged
//  inside the shown region. Outside it, colorKeeper() picks an h that keeps
//  the colour: an element of the colour subgroup (the permutation of its
//  word fixes the slot shown) that brings the item into a shown copy.
//
//  All of it works on the pattern coordinates (the pattern box is [-1,1]^2)
//  and with the group in those coordinates, as the pattern receives it in
//  setGroup(). h is an ITransform, a chain of reflections in lines or
//  circles, so it is not assumed to be an isometry: the local scale |h'| at
//  the anchor sets the pixel size the item is drawn with.
//

const MAX_FOLD_ITERATIONS = 200;
// a point in general position; equal images mean the same group element
const BASE_POINT = iPoint([0.1, 0.2, 0.3, 0.1]);
const EPS_SAME = 1.e-7;
const EPS_SCALE = 1.e-4;

/**
 * the map from world to pattern coordinates of a pattern transform
 * (patternTransConfig: the box [-1,1]^2 placed at center, scaled by scale,
 * turned by angle degrees, the inverse of SymRenderer's mPatternTransform)
 * returns {map(x, y) -> [px, py], scale: pattern units per world unit}
 */
function worldToPatternMap(ptc){
    const a = -(ptc.angle || 0)*Math.PI/180;
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1/(ptc.scale || 1);
    const cx = ptc.centerX || 0, cy = ptc.centerY || 0;
    return {
        map: (x, y) => {
            const dx = x - cx, dy = y - cy;
            return [k*(c*dx - s*dy), k*(s*dx + c*dy)];
        },
        scale: k,
    };
}

/** the inverse of worldToPatternMap(ptc): pattern to world coordinates */
function patternToWorldMap(ptc){
    const a = (ptc.angle || 0)*Math.PI/180;
    const c = Math.cos(a), s = Math.sin(a);
    const k = ptc.scale || 1;
    const cx = ptc.centerX || 0, cy = ptc.centerY || 0;
    return {
        map: (x, y) => [cx + k*(c*x - s*y), cy + k*(s*x + c*y)],
        scale: k,
    };
}

/**
 * an item in pattern coordinates: its points, its style with the stroke width
 * in pattern units, the box of its points and the box of its strokes
 */
function patternItem(item, toPattern){
    const pts = [];
    for (let i = 0; i + 1 < item.points.length; i += 2) pts.push(...toPattern.map(item.points[i], item.points[i + 1]));
    const style = { ...item.style, strokeWidth: (item.style.strokeWidth || 0)*toPattern.scale };
    const box = bboxOf(pts);
    const half = (style.stroke ? style.strokeWidth : 0)/2;
    return { id: item.id, pts, style, box, strokeBox: [box[0] - half, box[1] - half, box[2] + half, box[3] + half] };
}

/**
 * the fold element of an item in pattern coordinates (patternItem()): null
 * when it lies in the shown region or without a group; else the element the
 * colour keeper picks, or the transform toFundDomain() returns for the centre
 * of its box
 */
function foldElementOf(pItem, group, shown, keeper){
    if (!group) return null;
    if (shown && shown.containsBox(pItem.strokeBox)) return null;
    const b = pItem.box;
    const k = group.toFundDomain({ pnt: iPoint([0.5*(b[0] + b[2]), 0.5*(b[1] + b[3])]),
                                   maxIterations: MAX_FOLD_ITERATIONS }).transform;
    return (keeper && keeper.fold(pItem, k)) || k;
}

/**
 * the fold element of one item (world coordinates), as foldItems() gives it:
 * null when it is not moved
 */
function itemFoldElement(item, group, ptc, shown = null, keeper = null){
    if (!group || !item.points || item.points.length < 2) return null;
    return foldElementOf(patternItem(item, worldToPatternMap(ptc)), group, shown, keeper);
}

/**
 * the fold of items outside the shown region when colour layers show them
 *
 * layers:  [{permutations, invPermutations, useOrbit, permIndex, imageIds}],
 *          the colour symmetry of each colour layer (VisualizationColorSym
 *          .getColorSymmetry()); a layer with no permutations keeps every
 *          colour, one with imageIds shows only those drawing layers
 * layerOf: item id -> the id of its drawing layer
 * shown:   the shown region (Orbits.shownRegion), with its copies
 * returns {fold(pItem, k)}: for the item (patternItem()) with the fold k of
 * its anchor, the element h = T . k, T one of the shown copies (the domain
 * first), that keeps the item's colour in every colour layer showing its
 * drawing layer - the permutation of h's word fixes the slot the layer
 * shows - and fits the item into the shown region; failing a fit, the
 * nearest colour-keeping one; null when none keeps the colour
 */
function colorKeeper({ layers, layerOf, shown }){

    function keeps(h, colorLayers){
        const word = h ? h.getWord() : '';
        return colorLayers.every(L => {
            if (!L.permutations || !L.permutations.length) return true;
            const perm = wordToPerm(word, L.permutations, L.invPermutations, L.useOrbit);
            return perm[L.permIndex] === L.permIndex;
        });
    }

    function fits(h, pItem){
        const pts = [];
        for (let i = 0; i + 1 < pItem.pts.length; i += 2) {
            const q = h.transform(iPoint([pItem.pts[i], pItem.pts[i + 1]]));
            pts.push(q.v[0], q.v[1]);
        }
        const box = bboxOf(pts);
        const b = pItem.box;
        const half = 0.5*(pItem.style.stroke ? pItem.style.strokeWidth : 0)*localScale(h, 0.5*(b[0] + b[2]), 0.5*(b[1] + b[3]));
        return shown.containsBox([box[0] - half, box[1] - half, box[2] + half, box[3] + half]);
    }

    function fold(pItem, k){
        const layerId = layerOf(pItem.id);
        const colorLayers = layers.filter(L => !L.imageIds.length || L.imageIds.includes(layerId));
        if (!colorLayers.length || !k) return null;
        let first = null;
        for (const copy of shown.copies) {
            // apply k (into the domain), then into the copy
            let h = k;
            if (copy.fromFD) { h = k.getCopy(); h.concat(copy.fromFD); }
            if (!keeps(h, colorLayers)) continue;
            if (fits(h, pItem)) return h;
            if (!first) first = h;
        }
        return first;
    }

    return { fold };
}

/** the image of a point in general position: equal for equal group elements (null: identity) */
function elementKey(t){
    return t ? t.transform(BASE_POINT) : BASE_POINT;
}

function sameElement(p, q){
    if (p.type !== q.type) return false;
    for (let i = 0; i < p.v.length; i++) if (Math.abs(p.v[i] - q.v[i]) > EPS_SAME) return false;
    return true;
}

function pointOf(t, x, y){
    const p = t.transform(iPoint([x, y]));
    return [p.v[0], p.v[1]];
}

/** |h'| at (x, y), from the image of a small step */
function localScale(t, x, y){
    const p0 = pointOf(t, x, y);
    const px = pointOf(t, x + EPS_SCALE, y), py = pointOf(t, x, y + EPS_SCALE);
    const s = 0.5*(Math.hypot(px[0] - p0[0], px[1] - p0[1]) + Math.hypot(py[0] - p0[0], py[1] - p0[1]))/EPS_SCALE;
    return (Number.isFinite(s) && s > 0) ? s : 1;
}

function bboxOf(points){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < points.length; i += 2) {
        x0 = Math.min(x0, points[i]);     x1 = Math.max(x1, points[i]);
        y0 = Math.min(y0, points[i + 1]); y1 = Math.max(y1, points[i + 1]);
    }
    return [x0, y0, x1, y1];
}

/**
 * the items in pattern coordinates, grouped by fold element
 *
 * items: document items (world coordinates)
 * group: the group in pattern coordinates (null: no folding)
 * ptc:   the pattern transform
 * shown: the shown region (Orbits.shownRegion), whose items are not moved;
 *        null: every item is folded by its anchor
 * keeper: the colour keeper (colorKeeper()) for the items outside; null:
 *        they are folded by their anchor
 * returns [{transform: h, inverse: h^-1, items: [item in pattern coordinates],
 *           box: [x0, y0, x1, y1] covering their strokes, scale: |h'|}],
 *         in the order of the items' first appearance
 */
function foldItems(items, group, ptc, shown = null, keeper = null){

    const toPattern = worldToPatternMap(ptc);
    const groups = [];

    for (const item of items) {
        if (!item.points || item.points.length < 2) continue;
        const pi = patternItem(item, toPattern);
        const pItem = { ...item, points: pi.pts, style: pi.style };
        const box = pi.box, itemBox = pi.strokeBox;
        const ax = 0.5*(box[0] + box[2]), ay = 0.5*(box[1] + box[3]);

        const h = foldElementOf(pi, group, shown, keeper);
        const key = elementKey(h);
        let fg = groups.find(g => sameElement(g.key, key));
        if (!fg) {
            fg = { key, transform: h, inverse: h ? h.getInverse() : null, items: [], box: itemBox.slice(),
                   scale: h ? localScale(h, ax, ay) : 1 };
            groups.push(fg);
        } else {
            fg.box = [Math.min(fg.box[0], itemBox[0]), Math.min(fg.box[1], itemBox[1]),
                      Math.max(fg.box[2], itemBox[2]), Math.max(fg.box[3], itemBox[3])];
            if (h) fg.scale = Math.max(fg.scale, localScale(h, ax, ay));
        }
        fg.items.push(pItem);
    }
    return groups;

} // function foldItems()

export { foldItems, worldToPatternMap, patternToWorldMap, itemFoldElement, colorKeeper, elementKey, sameElement };
