import {
    savedItem,
    euclideanItem,
    withoutGeodesic,
    itemsToSvg,
    applyTransform,
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
//                                             the same generators
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
//  (pastedItems): the colour words only in the same group, the geodesic paths
//  and shapes of another geometry as the plain curves they were drawn with,
//  tiles as plain shapes.
//

const FORMAT = 'symdraw-clipboard';
const VERSION = 1;
const META_ID = 'symdraw-clipboard';
const IMAGE_ID = 'symdraw-img-';
// pattern points the generators are applied to for a group's fingerprint
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

/**
 * a string that is the same for the same group, whatever pattern box it is
 * in: its generators' names and where they take a few points (pattern
 * coordinates); '' without a group
 */
function groupFingerprint(group){
    if (!group || !group.getGenNames || !group.getReverseITransforms) return '';
    const r = v => (Math.round(v*ROUND)/ROUND).toString();
    const parts = [group.getGenNames().join(',')];
    for (const t of group.getReverseITransforms()) {
        for (const p of PROBES) {
            const q = t ? applyTransform(t, p) : p;
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
 * do two places draw the geodesics alike: the same geometry; a group of no
 * absolute (a Kleinian group's local disks) only the same group in the same
 * pattern box
 */
function sameGeometry(a, b, sameGroup, samePtc){
    if (!samePlain(a, b)) return false;
    return !a.fallback || (sameGroup && samePtc);
}

/** the source or target of a paste as plain JSON: {page, geometry, group (its fingerprint), ptc} */
function clipboardPlace({ page = '', geometry = null, group = null, ptc = null } = {}){
    return {
        page,
        geometry: plainGeometry(geometry),
        group:    typeof group === 'string' ? group : groupFingerprint(group),
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
 * clipboardPlace): {items, sameGroup, sameGeometry, asDrawn (how many came as
 * the plain curves they were drawn with)}. In the same group the colour
 * words stay; in another geometry the geodesic paths and shapes come as drawn
 */
function pastedItems(record, target){
    const src = record.source || {};
    const sameGroup = !!src.group && src.group === target.group;
    const samePtc = !!src.ptc && !!target.ptc && samePlain(src.ptc, target.ptc);
    const same = sameGeometry(src.geometry, target.geometry, sameGroup, samePtc);
    let asDrawn = 0;
    const items = record.items.map((item, k) => {
        const drawn = !same && record.drawn ? record.drawn[k] : null;
        if (drawn) asDrawn++;
        return cleanedItem(drawn || item, sameGroup);
    });
    return { items, sameGroup, sameGeometry: same, asDrawn };
}

export { clipboardContent, recordOfText, pastedItems, clipboardPlace, groupFingerprint, drawnItem, pointsBox };
