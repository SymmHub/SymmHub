import {
    savedItem,
    euclideanItem,
    withoutGeodesic,
    itemsToSvg,
    applyTransform,
    mappedItem,
    worldToPatternMap,
    patternToWorldMap,
} from './modules.js';

//
//  Clipboard - the drawing's shapes on the system clipboard, between
//  documents, pages and programs (docs/clipboard_plan.md)
//
//  A copy keeps the selected items as they are seen in a record,
//
//    { format: 'symdraw-clipboard', version: 1,
//      source: { page,                        the page copied from
//                geometry: {kind, ...},       the group's geometry in world
//                                             coordinates (worldGeometry)
//                group,                       groupFingerprint: the same for
//                                             the same generators (in the
//                                             group maker's coordinates)
//                groupTransform: {translationX, translationY, rotation, scale},
//                                             the Symmetry tool's transform
//                                             from the maker's coordinates to
//                                             the world
//                ptc: {centerX, centerY, scale, angle} },   the pattern box
//      centre: [x, y],                        the centre of the items' box
//      items:  [...],                         the items as saved (savedItem),
//                                             world coordinates of the tools
//      drawn:  [...] }                        per item, null or the item as
//                                             the plain curves it is drawn with
//                                             (it holds geodesic paths or shapes)
//
//  and goes on the clipboard as text: an SVG document of the items
//  (SvgExport.itemsToSvg) whose <metadata id="symdraw-clipboard"> holds the
//  record as JSON, its <, > and & written as <, > and & so that
//  the JSON is plain XML text. A picture is written once: an <image> of the
//  SVG's defs, which the items <use>, and the record's src is '#' and its id.
//  Every browser and
//  program passes text; SymDraw finds the record in it again (recordOfText),
//  any other reader sees the SVG.
//
//  A paste takes the items as the document pasted into wants them
//  (pastedItems). In the same group they go by the group: from the source's
//  world to the group maker's coordinates and on to the target's world
//  (groupCarry, by the two group transforms), so a motif lands on the same
//  mirrors and centres of the tiling, its size following the tiling's, its
//  colour words and geodesics kept. The pattern box plays no part: the group
//  stays where it is in the world when the box moves. In another group they go
//  by the world: no colour words, the geodesic paths and shapes of another
//  geometry as the plain curves they were drawn with. Tiles come as plain
//  shapes.
//

const FORMAT = 'symdraw-clipboard';
const VERSION = 1;
const META_ID = 'symdraw-clipboard';
const IMAGE_ID = 'symdraw-img-';
// points of the maker's coordinates the generators are applied to for a group's fingerprint
const PROBES = [[0.0123, 0.0457], [0.3141, -0.1732], [-0.2236, 0.4142]];
const ROUND = 1e8;

/** a 64-bit FNV-1a hash of the text, as 16 hex digits */
function hashText(text){
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x01000193 ^ 0x2545f491) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** the group transform as plain JSON (no transform: none, scale 1) */
function plainGroupTransform(t){
    return { translationX: num(t && t.translationX, 0), translationY: num(t && t.translationY, 0),
             rotation: num(t && t.rotation, 0), scale: num(t && t.scale, 1) };
}

/**
 * the group transform (the Symmetry tool's, SymRenderer's
 * mConfig.symmetry.transform: {translationX, translationY, rotation in
 * degrees, scale}) as the similarity from the group maker's coordinates to the
 * world, w = s R (p + t), as symhublib's groupTransformMaps has it:
 * {toWorld(p), fromWorld(w), scale}
 */
function groupTransformMaps(t){
    const { translationX: tx, translationY: ty, rotation, scale: s } = plainGroupTransform(t);
    const a = rotation*Math.PI/180, cs = Math.cos(a), sn = Math.sin(a);
    return {
        toWorld:   (p) => { const x = p[0] + tx, y = p[1] + ty; return [s*(cs*x - sn*y), s*(sn*x + cs*y)]; },
        fromWorld: (w) => [(cs*w[0] + sn*w[1])/s - tx, (-sn*w[0] + cs*w[1])/s - ty],
        scale: s,
    };
}

/**
 * a string that is the same for the same group, wherever the group transform
 * puts it in the world and whatever pattern box it is in: its generators'
 * names and where they take a few points of the group maker's coordinates;
 * '' without a group. group: in pattern coordinates (the drawing's), ptc: the
 * pattern box, groupTransform: the maker's coordinates to the world. A group
 * drawn by its Dirichlet domain is the group the domain was made from
 * (`dirichletSource`): the colour words are written in its generators
 */
function groupFingerprint(group, ptc = null, groupTransform = null){
    while (group && group.dirichletSource) group = group.dirichletSource;
    if (!group || !group.getGenNames || !group.getReverseITransforms) return '';
    // maker -> world -> pattern, and back
    const T = groupTransformMaps(groupTransform);
    const P = ptc ? patternToWorldMap(ptc) : null, Pinv = ptc ? worldToPatternMap(ptc) : null;
    const toPattern = (p) => { const w = T.toWorld(p); return Pinv ? Pinv.map(w[0], w[1]) : w; };
    const toMaker = (q) => T.fromWorld(P ? P.map(q[0], q[1]) : q);
    const r = v => (Math.round(v*ROUND)/ROUND).toString();
    const parts = [group.getGenNames().join(',')];
    for (const t of group.getReverseITransforms()) {
        for (const p of PROBES) {
            const q = t ? toMaker(applyTransform(t, toPattern(p))) : p;
            parts.push(Number.isFinite(q[0]) && Number.isFinite(q[1]) ? r(q[0]) + ' ' + r(q[1]) : 'inf');
        }
    }
    return hashText(parts.join(';'));
}

/** the geometry (worldGeometry) as plain JSON: its kind, numbers and strings */
function plainGeometry(g){
    if (!g) return null;
    const out = {};
    for (const [key, v] of Object.entries(g)) {
        if (typeof v === 'string' || typeof v === 'number') out[key] = v;
        else if (Array.isArray(v) && v.every(x => typeof x === 'number')) out[key] = v.slice();
    }
    return out;
}

const close = (x, y) => Math.abs(x - y) <= 1e-9*(1 + Math.abs(x) + Math.abs(y));

/** the same plain values (numbers within rounding) */
function samePlain(a, b){
    if (!a || !b) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        const x = a[key], y = b[key];
        if (typeof x === 'number' && typeof y === 'number') { if (!close(x, y)) return false; }
        else if (Array.isArray(x) && Array.isArray(y)) { if (x.length !== y.length || x.some((v, k) => !close(v, y[k]))) return false; }
        else if (x !== y) return false;
    }
    return true;
}

/**
 * do two places of different groups draw the geodesics alike: the same
 * geometry, one with an absolute (a Kleinian group's local disks are its own)
 */
function sameGeometry(a, b){
    return samePlain(a, b) && !a.fallback;
}

/**
 * the source or target of a paste as plain JSON: {page, geometry, group (its
 * fingerprint), groupTransform, ptc}; group: in pattern coordinates (a
 * fingerprint as it is)
 */
function clipboardPlace({ page = '', geometry = null, group = null, ptc = null, groupTransform = null } = {}){
    return {
        page,
        geometry: plainGeometry(geometry),
        group:    typeof group === 'string' ? group : groupFingerprint(group, ptc, groupTransform),
        groupTransform: plainGroupTransform(groupTransform),
        ptc:      ptc ? { centerX: ptc.centerX, centerY: ptc.centerY, scale: ptc.scale, angle: ptc.angle || 0 } : null,
    };
}

/** the box [x0, y0, x1, y1] round the items' points, what they hold too; null for none */
function pointsBox(items){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = (it) => {
        const p = it.points || [];
        for (let i = 0; i + 1 < p.length; i += 2) {
            x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
            y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
        }
        (it.children || []).forEach(take);
    };
    items.forEach(take);
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
}

/** does the item, or one it holds, have geodesic sides */
function hasGeodesic(item){
    return !!item.geodesic || (item.children || []).some(hasGeodesic);
}

/**
 * the item as the plain curves it is drawn with: a geodesic path or shape as
 * the path of its outline (the polyline of its points without one), its
 * numbers dropped; deep. The item itself when nothing in it is geodesic
 */
function drawnItem(item){
    let out = item;
    if (item.geodesic) {
        if (item.outline && item.outline.nodes) {
            out = euclideanItem(item);
            if (out.shape) { out = { ...out }; delete out.shape; }
        } else {
            const { shape, nodes, ...rest } = withoutGeodesic(item);
            out = { ...rest, type: 'polyline', points: Array.from(item.points || []) };
        }
    }
    if (item.children) {
        const children = item.children.map(drawnItem);
        if (children.some((c, k) => c !== item.children[k])) out = { ...out, children };
    }
    return out;
}

/** JSON as XML text: no <, > or & left in it */
function xmlSafeJson(value){
    return JSON.stringify(value).replace(/[<>&]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** the items with each picture's src replaced by '#' and its <image>'s id (refs: src -> id) */
function withImageRefs(item, refs){
    let out = item;
    if (item.type === 'image' && refs.has(item.src)) out = { ...item, src: '#' + refs.get(item.src) };
    if (item.children) out = { ...out, children: item.children.map(c => withImageRefs(c, refs)) };
    return out;
}

/** the items with each '#id' src back to the picture of that <image> (hrefs: id -> URL); an image whose picture is missing dropped */
function withImagesResolved(items, hrefs){
    const out = [];
    for (const item of items) {
        let it = item;
        if (it.type === 'image' && typeof it.src === 'string' && it.src.startsWith('#')) {
            const href = hrefs.get(it.src.slice(1));
            if (!href) continue;
            it = { ...it, src: href };
        }
        if (it.children) it = { ...it, children: withImagesResolved(it.children, hrefs) };
        out.push(it);
    }
    return out;
}

/**
 * what a copy puts on the clipboard: {record, text}. items: as they are seen
 * (geodesic paths with their outlines, for the SVG and for `drawn`); source:
 * {page, geometry, group, ptc} (clipboardPlace)
 */
function clipboardContent(items, source = {}){
    const box = pointsBox(items);
    const record = {
        format:  FORMAT,
        version: VERSION,
        source:  clipboardPlace(source),
        centre:  box ? [0.5*(box[0] + box[2]), 0.5*(box[1] + box[3])] : [0, 0],
        items:   items.map(savedItem),
        drawn:   items.map(it => (hasGeodesic(it) ? savedItem(drawnItem(it)) : null)),
    };
    // each picture once, in the SVG's defs (picture URL -> id)
    const refs = new Map();
    const svg = itemsToSvg(items, null, { images: refs, imagePrefix: IMAGE_ID });
    const stored = { ...record,
        items: record.items.map(it => withImageRefs(it, refs)),
        drawn: record.drawn.map(it => (it ? withImageRefs(it, refs) : null)) };
    const meta = `  <metadata id="${META_ID}">${xmlSafeJson(stored)}</metadata>\n`;
    const at = svg.indexOf('>\n') + 2;
    return { record, text: svg.slice(0, at) + meta + svg.slice(at) };
}

const unescapeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** the record a clipboard text holds (an SVG written by clipboardContent), or null */
function recordOfText(text){
    if (typeof text !== 'string' || text.indexOf(META_ID) < 0) return null;
    const m = text.match(new RegExp(`<metadata id="${META_ID}"[^>]*>([^<]*)</metadata>`));
    if (!m) return null;
    let record;
    try {
        record = JSON.parse(unescapeXml(m[1]));
    } catch (e) {
        return null;
    }
    if (!record || record.format !== FORMAT || !Array.isArray(record.items)) return null;
    const hrefs = new Map();
    for (const im of text.matchAll(/<image id="([^"]+)"[^>]*? href="([^"]*)"/g)) hrefs.set(im[1], unescapeXml(im[2]));
    const items = withImagesResolved(record.items, hrefs);
    const drawn = Array.isArray(record.drawn) && record.drawn.length === record.items.length
        ? record.drawn.map(it => (it ? (withImagesResolved([it], hrefs)[0] || null) : null)) : record.items.map(() => null);
    // an image dropped for its missing picture drops its drawn version too
    const kept = record.items.map((it, k) => k).filter(k => !(record.items[k].type === 'image' && String(record.items[k].src).startsWith('#') && !hrefs.has(record.items[k].src.slice(1))));
    return { ...record, items, drawn: kept.map(k => drawn[k]), centre: Array.isArray(record.centre) ? record.centre : null };
}

/**
 * the similarity taking the world of one group transform to the world of
 * another through the group maker's coordinates: world A -> maker -> world B
 * (the same group put elsewhere in the world: a motif keeps its place in the
 * tiling). {map([x, y]) -> [x, y], scale}
 */
function groupCarry(fromTransform, toTransform){
    const A = groupTransformMaps(fromTransform), B = groupTransformMaps(toTransform);
    return { map: (p) => B.toWorld(A.fromWorld(p)), scale: B.scale/A.scale };
}

/**
 * the item carried by a similarity of the world ({map, scale}, groupCarry):
 * its points, a shape's numbers (a geodesic shape's too: a similarity taking
 * one geometry's model onto the other's maps its numbers as it maps the
 * plane's), its stroke widths scaled; deep
 */
function similarItem(item, sim){
    const out = mappedItem(item, sim.map, null);
    if (Math.abs(sim.scale - 1) < 1e-12) return out;
    const scaled = (it) => ({ ...it,
        ...(it.style ? { style: { ...it.style, strokeWidth: (it.style.strokeWidth || 0)*sim.scale } } : {}),
        ...(it.children ? { children: it.children.map(scaled) } : {}) });
    return scaled(out);
}

/** the item ready to be added: no tile (a plain shape), no colour words from another group; deep */
function cleanedItem(item, keepWords){
    const out = { ...item };
    delete out.tile;
    delete out.outline;
    if (!keepWords) delete out.colorWord;
    if (out.children) out.children = out.children.map(c => cleanedItem(c, keepWords));
    return out;
}

/**
 * the record's items as the place pasted into wants them (target:
 * clipboardPlace), in the target's world: {items, centre (the record's centre
 * there), sameGroup, sameGeometry, carried (carried to where another group
 * transform puts the group), asDrawn (how many came as the plain curves they
 * were drawn with)}. In the same group the items go by the group (groupCarry),
 * keeping their colour words and geodesics, the group's geometry being the
 * same in the maker's coordinates; in another group by the world, and in
 * another geometry the geodesic paths and shapes come as drawn
 */
function pastedItems(record, target){
    const src = record.source || {};
    const sameGroup = !!src.group && src.group === target.group;
    const from = plainGroupTransform(src.groupTransform), to = plainGroupTransform(target.groupTransform);
    const carry = (sameGroup && !samePlain(from, to)) ? groupCarry(from, to) : null;
    const same = sameGroup || sameGeometry(src.geometry, target.geometry);
    let asDrawn = 0;
    const items = record.items.map((item, k) => {
        const drawn = !same && record.drawn ? record.drawn[k] : null;
        if (drawn) asDrawn++;
        const it = cleanedItem(drawn || item, sameGroup);
        return carry ? similarItem(it, carry) : it;
    });
    const c = record.centre || null;
    return { items, centre: (c && carry) ? carry.map(c) : c, sameGroup, sameGeometry: same, carried: !!carry, asDrawn };
}

export { clipboardContent, recordOfText, pastedItems, clipboardPlace, groupFingerprint, groupCarry, drawnItem, pointsBox };
