/*
  tests of copy and paste through the system clipboard (docs/clipboard_plan.md):
  lib/drawlib/Clipboard.js, DrawingEditor's clipboard, DrawingDocument's ids

    node tests/drawlib/clipboard.mjs

  1. the record round trip: items of every kind written as the SVG text (the
     record in its metadata) and read back the same; a picture written once
     however many items show it; ids with <, > and & kept; the text is an SVG
     with nothing of the record outside its metadata; text without a record
     gives none
  2. ids: a pasted or duplicated group's members get ids free in the document
     (two items never share one); into another document the ids are kept
  3. the editor: a copy pasted in place lands where it was copied, at the
     pointer centred there (a right click's point before the pointer),
     without a pointer at the view's centre; a cut
     removes, undo brings back; paste is one undo step
  4. colour words: kept between documents of the same group, dropped from
     another (groupFingerprint: the same for one group made twice, another for
     another group, whatever the pattern box and the group transform)
  5. geometry: geodesic paths and shapes into another geometry come as the
     plain curves they were drawn with; in the same geometry they stay
     geodesic; a group of no absolute only in the same group
  6. the hyperbolic plane: a paste at the pointer is a move of the geometry
     (the shape and its stroke shrink towards the absolute as the metric says)
  7. a paste of another program's SVG text is taken as an import (whose
     reading then fails here, without a DOM, which it logs: "DOMParser is not
     defined"; tests/drawlib/svg_import.html tests the import in a browser)
  8. the same group put elsewhere in the world by the group transform goes
     by the group (world A -> the maker's coordinates -> world B): in place
     where the tiling has it, its stroke scaled, its colour word kept; at the
     pointer carried, then moved; another pattern box (the group stays in
     the world) or another group by the world; a hyperbolic geodesic path
     stays geodesic; a group drawn by its Dirichlet domain has the
     fingerprint of the group it was made from
  9. what a paste takes (pasteChoice, plan 3.3): a record before anything,
     an SVG (image/svg+xml, a file, text, a web page's <svg>) before a
     picture, a picture alone said so, else what the clipboard holds named;
     a web page's <svg> cut out of its HTML without a DOM (svgOfHtml)
 10. the richer copy (uilib writeClipboardItems with a stubbed async
     clipboard): the types the browser writes, a function called only for a
     type written, a refusal; the PNG's size (svgPictureSize); the editor's
     copy event writes the text, the SVG and the PNG, and without the PNG
     (it cannot be drawn without a DOM) the text and the SVG
 11. the copy's SVG has pixels for its own units (viewBox = width x
     height) and its content's group takes the world to them, so a program
     that pastes the root's children without the viewBox (Inkscape) gets
     the size seen on the screen; kept between 16 and 16384 pixels a side,
     1000 without a scale; the editor writes it at its view's scale
 12. a paste event that names an SVG it does not give (Chrome's paste event
     on Windows with Inkscape's clipboard: types ['image/svg+xml'], its text
     empty): svgHeldBack, then the editor reads the clipboard through the
     async API (stubbed) and imports its SVG; refused, the "Nothing to
     paste" banner says how to let the page read
*/

import { Group_KLM, dirichletBase, selectDirichletSides, makeDirichletGroup } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { clipboardContent, recordOfText, pastedItems, clipboardPlace, groupFingerprint, drawnItem, pasteChoice, svgHeldBack } from '../../lib/drawlib/Clipboard.js';
import { savedItem } from '../../lib/drawlib/Paths.js';
import { poseInverseTransform } from '../../lib/symhublib/PatternPose.js';
import { groupTransformITransform } from '../../lib/symhublib/sym_utils.js';
import { writeClipboardItems, svgPictureSize, svgOfHtml } from '../../lib/uilib/clipboard.js';

// the editors' copy, cut and paste listeners, the last editor's last
const listeners = {};
globalThis.window = globalThis.window || { addEventListener(kind, fn){ (listeners[kind] ||= []).push(fn); }, removeEventListener(){} };

// banners shown while a section lends a document (showWarningBanner)
const banners = [];
async function withBanners(run){
    const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
    globalThis.document = {
        createElement: () => ({ style: {}, addEventListener(){}, remove(){}, set textContent(t){ banners.push(t); } }),
        body: { appendChild(){} },
    };
    try {
        const out = run();
        // what the run left pending (an import's reading) done while the document is lent
        await new Promise(r => setTimeout(r, 20));
        return out;
    } finally {
        if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document;
    }
}

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const PTC = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
// group: in pattern coordinates (placedGroup), as PatternDrawing has it
function newEditor(group = null, ptc = PTC, groupTransform = null){
    const doc = DrawingDocument();
    doc.clear();
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group, ptc, groupTransform, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc, editor };
}

/**
 * the group as a drawing gets it (SymRenderer.prepareGroupData,
 * updateTransGroup): the maker's group put in the world by the group transform
 * ({translationX, translationY, rotation in degrees, scale}), its Dirichlet
 * domain made there (dirichlet(group)), then the whole put into the pattern box
 */
function placedGroup(group, ptc = PTC, transform = null, dirichlet = null){
    let g = group.clone();
    if (transform) g.applyTransform(groupTransformITransform({ rotation: transform.rotation*Math.PI/180,
        translation: [transform.translationX, transform.translationY], scale: transform.scale }));
    if (dirichlet) g = dirichlet(g);
    if (!g) return null;
    const out = g.clone();
    out.applyTransform(poseInverseTransform(ptc));
    return out;
}

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}

const RED = { rgba: [1, 0, 0, 1] }, BLUE = { rgba: [0, 0, 1, 1] };
const square = (cx, cy, h, extra = {}) => ({ type: 'polyline', closed: true,
    points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
    style: { stroke: RED, strokeWidth: 0.01, fill: BLUE }, ...extra });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const image = (x, y, h, id) => ({ type: 'image', id, src: PNG, size: [1, 1], points: [x - h, y + h, x + h, y + h, x + h, y - h, x - h, y - h], style: {} });
const sel = (id) => ({ id, frame: null, frameInv: null });
const allIds = (doc) => {
    const out = [];
    const walk = (it) => { out.push(it.id); (it.children || []).forEach(walk); };
    doc.getLayers().forEach(l => l.getItems().forEach(walk));
    return out;
};
const unique = (ids) => new Set(ids).size === ids.length;
const boxCentre = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    return [0.5*(x0 + x1), 0.5*(y0 + y1), x1 - x0, y1 - y0];
};

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { doc } = newEditor();
    const items = [
        doc.insertItem(square(0, 0, 0.2, { id: 'sq', pivot: [0.1, 0.1], axes: [1, 0, 0, 1], colorWord: 'aB' })),
        doc.insertItem({ type: 'path', id: 'pa', closed: false, nodes: [{ p: [0, 0], h1: null, h2: [0.1, 0.2] }, { p: [0.5, 0], h1: [0.4, 0.2], h2: null, smooth: true }],
                         style: { stroke: RED, strokeWidth: 0.02, fill: null } }),
        doc.insertItem({ id: 'rc', style: { stroke: RED, strokeWidth: 0.01, fill: BLUE }, shape: { kind: 'rect', cx: 1, cy: 1, rx: 0.2, ry: 0.1, angle: 0.3, round: 0.05 } }),
        doc.insertItem({ type: 'group', id: 'gr', children: [square(-1, 0, 0.1, { id: 'g1' }), square(-1.5, 0, 0.1, { id: 'g2' })] }),
        doc.insertItem({ ...square(2, 0, 0.4, { id: 'fr' }), children: [image(2, 0, 0.3, 'im1')] }),
        doc.insertItem({ ...square(3, 0, 0.4, { id: 'f<2>&' }), children: [image(3, 0, 0.3, 'im2')] }),
    ];
    const tile = doc.insertItem(square(4, 0, 0.3, { id: 'ti', tile: { edges: [{ pair: 1 }, { pair: 0 }, { pair: 3 }, { pair: 2 }] } }));
    items.push(tile);
    const { record, text } = clipboardContent(items, { page: 'test.html', geometry: { kind: 'euclidean' }, group: null, ptc: PTC });
    check(text.startsWith('<svg') && text.includes('<metadata id="symdraw-clipboard">'), 'an SVG with the record in its metadata');
    const meta = text.match(/<metadata id="symdraw-clipboard">([^<]*)<\/metadata>/);
    check(!!meta && !/[<>&]/.test(meta[1]), 'the record is plain XML text (no <, > or &)');
    check(text.split(PNG).length - 1 === 1, `a picture shown twice written once (${text.split(PNG).length - 1})`);
    const back = recordOfText(text);
    check(!!back, 'the record read back');
    const same = JSON.stringify(back.items) === JSON.stringify(items.map(savedItem));
    check(same, 'every kind of item read back as saved');
    if (!same) console.log(JSON.stringify(back.items).slice(0, 400), '\n', JSON.stringify(items.map(savedItem)).slice(0, 400));
    check(back.items.some(it => it.id === 'f<2>&'), 'an id with <, > and & kept');
    check(back.source.page === 'test.html' && back.source.geometry.kind === 'euclidean' && near(back.source.ptc.scale, 1), 'the source read back');
    check(near(back.centre[0], record.centre[0]) && near(back.centre[1], record.centre[1]), 'the centre read back');
    check(recordOfText('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>') === null, 'an SVG of another program: no record');
    check(recordOfText('hello') === null && recordOfText('') === null && recordOfText(null) === null, 'plain text: no record');
    // pasted: no tile, ids as they were
    const pasted = pastedItems(back, clipboardPlace({ geometry: { kind: 'euclidean' } }));
    check(pasted.items.every(it => !it.tile), 'a tile pasted as a plain shape');
    check(!pasted.items[0].colorWord, 'without a group: no colour words');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const g = doc.insertItem({ type: 'group', id: 'g', children: [square(0, 0, 0.1, { id: 'a' }), square(0.5, 0, 0.1, { id: 'b' })] });
    editor.setSelection([sel(g.id)]);
    editor.duplicateSelection();
    check(unique(allIds(doc)), 'a duplicated group: every id once (' + allIds(doc).join(' ') + ')');
    editor.setSelection([sel(g.id)]);
    const { text } = editor.selectionClipboard();
    editor.pasteContent({ text }, true);
    check(unique(allIds(doc)) && allIds(doc).length === 9, 'a pasted group: every id once (' + allIds(doc).join(' ') + ')');
    // into another document the free ids are kept
    const other = newEditor();
    other.editor.pasteContent({ text }, true);
    check(allIds(other.doc).join(' ') === 'g a b', 'into another document the ids kept: ' + allIds(other.doc).join(' '));
    // an id taken by a layer is renewed
    other.doc.getLayers()[0].setId('a');
    const third = newEditor();
    third.doc.getLayers()[0].setId('a');
    third.editor.pasteContent({ text }, true);
    check(!allIds(third.doc).includes('a') && allIds(third.doc).length === 3, 'an id that names a layer is renewed: ' + allIds(third.doc).join(' '));
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const s = doc.insertItem(square(1, 2, 0.25));
    editor.setSelection([sel(s.id)]);
    const { text } = editor.selectionClipboard();
    // in place
    editor.pasteContent({ text }, true);
    const inPlace = doc.getItems()[1];
    check(inPlace && JSON.stringify(inPlace.points) === JSON.stringify(s.points) && inPlace.id !== s.id, 'in place: where it was copied, a new id');
    check(editor.getSelection().length === 1 && editor.getSelection()[0].id === inPlace.id, 'the paste selected');
    editor.undo();
    check(doc.getItems().length === 1, 'a paste is one undo step');
    // at the pointer
    editor.notePointer([-3, 0.5]);
    editor.pasteContent({ text });
    const atPointer = doc.getItems()[1];
    const c = boxCentre(atPointer.points);
    check(near(c[0], -3) && near(c[1], 0.5) && near(c[2], 0.5) && near(c[3], 0.5), `at the pointer: centred there, the same size (${c.map(v => v.toFixed(6)).join(' ')})`);
    // a right click's point (the context menu's Paste) wins over the pointer
    editor.pasteContent({ text }, false, [4, -1]);
    const atClick = boxCentre(doc.getItems()[2].points);
    check(near(atClick[0], 4) && near(atClick[1], -1), 'a right click\'s point before the pointer');
    editor.undo();
    // without a pointer: the view's centre (the pattern box's here)
    editor.notePointer(null);
    editor.pasteContent({ text });
    const atCentre = boxCentre(doc.getItems()[2].points);
    check(near(atCentre[0], 0) && near(atCentre[1], 0), 'without a pointer: at the centre');
    // cut
    editor.setSelection([sel(s.id)]);
    editor.cutSelection();
    check(!doc.getItem(s.id), 'a cut removes');
    editor.undo();
    check(!!doc.getItem(s.id), 'undo brings it back');
    check(editor.hasClipboard(), 'the page keeps its last copy');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const g632 = klm(6, 2, 3, false), g632b = klm(6, 2, 3, false), g237 = klm(2, 3, 7, false);
    check(groupFingerprint(g632) && groupFingerprint(g632) === groupFingerprint(g632b), 'one group made twice: one fingerprint');
    check(groupFingerprint(g632) !== groupFingerprint(g237), 'another group: another fingerprint');
    check(groupFingerprint(null) === '', 'no group: none');
    const ptc2 = { centerX: 0.3, centerY: -0.2, scale: 1.5, angle: 0.4 };
    const t2 = { translationX: -0.3, translationY: 0.25, rotation: -40, scale: 0.7 };
    check(groupFingerprint(placedGroup(g632b, ptc2), ptc2) === groupFingerprint(g632), 'another pattern box: the same fingerprint');
    check(groupFingerprint(placedGroup(g632b, ptc2, t2), ptc2, t2) === groupFingerprint(g632), 'another group transform too');
    check(groupFingerprint(placedGroup(g632b, ptc2), PTC) !== groupFingerprint(g632), 'the group moved in the world: another');
    const a = newEditor(g632), b = newEditor(placedGroup(g632b, ptc2), ptc2), c = newEditor(g237);
    const s = a.doc.insertItem(square(0.1, 0.1, 0.05, { colorWord: 'a' }));
    a.editor.setSelection([sel(s.id)]);
    const { text } = a.editor.selectionClipboard();
    b.editor.pasteContent({ text }, true);
    check(b.doc.getItems()[0].colorWord === 'a', 'the same group in another pattern box: the colour word kept');
    c.editor.pasteContent({ text }, true);
    check(!c.doc.getItems()[0].colorWord, 'another group: the colour word dropped');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const outlineNodes = [{ p: [0, 0], h1: null, h2: [0.1, 0.05] }, { p: [0.4, 0], h1: [0.3, 0.05], h2: null }];
    const geo = { type: 'path', id: 'geo', closed: false, geodesic: true,
                  nodes: [{ p: [0, 0], h1: null, h2: null }, { p: [0.4, 0], h1: null, h2: null }],
                  outline: { nodes: outlineNodes, key: 'hyperbolic 0 0 1' }, points: [0, 0, 0.4, 0],
                  style: { stroke: RED, strokeWidth: 0.01, fill: null } };
    const shape = { type: 'path', id: 'gs', closed: true, geodesic: true, shape: { kind: 'polygon', cx: 0, cy: 0, rx: 0.2, ry: 0.2, n: 5 },
                    nodes: [{ p: [0, 0], h1: null, h2: null }], outline: { key: 'hyperbolic 0 0 1' }, points: [0, 0, 0.1, 0, 0.1, 0.1],
                    style: { stroke: RED, strokeWidth: 0.01, fill: null } };
    const holder = { ...square(0, 0, 1, { id: 'h' }), children: [geo] };
    const d = drawnItem(geo);
    check(!d.geodesic && !d.outline && JSON.stringify(d.nodes.map(n => n.p)) === JSON.stringify(outlineNodes.map(n => n.p)) && d.nodes[0].h2, 'a geodesic path as drawn: the nodes of its outline, plain');
    const ds = drawnItem(shape);
    check(!ds.geodesic && !ds.shape && ds.type === 'polyline' && ds.points.length === 6, 'a geodesic shape of points as drawn: its polyline, no numbers');
    check(!drawnItem(holder).children[0].geodesic, 'what an item holds as drawn too');
    const hyper = { kind: 'hyperbolic', c: [0, 0], r: 1 };
    const { text } = clipboardContent([geo, shape, holder, square(3, 3, 0.1)], { geometry: hyper, group: null, ptc: PTC });
    const record = recordOfText(text);
    const into = (geometry, extra = {}) => pastedItems(record, clipboardPlace({ geometry, ptc: PTC, ...extra }));
    const same = into(hyper);
    check(same.sameGeometry && same.items[0].geodesic && same.items[1].shape && same.asDrawn === 0, 'the same geometry: geodesic kept');
    const plane = into({ kind: 'euclidean' });
    check(!plane.sameGeometry && !plane.items[0].geodesic && !plane.items[1].shape && !plane.items[2].children[0].geodesic && plane.asDrawn === 3,
          `another geometry: as drawn (${plane.asDrawn} of them)`);
    check(JSON.stringify(plane.items[3].points) === JSON.stringify(square(3, 3, 0.1).points), 'an item of no geodesic the same');
    const moved = into({ kind: 'hyperbolic', c: [0, 0], r: 2 });
    check(!moved.sameGeometry, 'another disk: another geometry');
    // a group of no absolute: the same in the same group (put elsewhere:
    // carried, section 8), never in another group
    const kl = { kind: 'euclidean', fallback: 'kleinian' };
    const k1 = recordOfText(clipboardContent([geo], { geometry: kl, group: klm(6, 2, 3, false), ptc: PTC }).text);
    check(pastedItems(k1, clipboardPlace({ geometry: kl, group: klm(6, 2, 3, false), ptc: PTC })).sameGeometry, 'no absolute, same group and box: the same');
    const box2 = { ...PTC, scale: 2 };
    const k2 = pastedItems(k1, clipboardPlace({ geometry: kl, group: placedGroup(klm(6, 2, 3, false), box2), ptc: box2 }));
    check(k2.sameGeometry && !k2.carried, 'no absolute, the same group in another pattern box: the same, nothing carried');
    check(!pastedItems(k1, clipboardPlace({ geometry: kl, group: klm(4, 4, 2, false), ptc: PTC })).sameGeometry, 'no absolute, another group: another');
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
    const g237 = klm(2, 3, 7, false);
    const { doc, editor } = newEditor(g237);
    const geom = editor.drawingGeometry();
    check(geom.kind === 'hyperbolic', '237 is hyperbolic: ' + geom.kind);
    if (geom.kind === 'hyperbolic') {
        const c0 = [geom.c[0], geom.c[1]], r = geom.r;
        const h = 0.01*r;
        const s = doc.insertItem(square(c0[0], c0[1], h));
        editor.setSelection([sel(s.id)]);
        const { text } = editor.selectionClipboard();
        const to = [c0[0] + 0.6*r, c0[1]];
        editor.notePointer(to);
        editor.pasteContent({ text });
        const pasted = doc.getItems()[1];
        const b = boxCentre(pasted.points);
        // the conformal factor of the disk: lengths shrink by (r^2 - |p - c|^2)/r^2 from its centre
        const ratio = (r*r - (0.6*r)*(0.6*r))/(r*r);
        check(Math.hypot(b[0] - to[0], b[1] - to[1]) < 0.05*b[2], 'the hyperbolic paste centred at the pointer');
        check(Math.abs(b[2]/(2*h) - ratio) < 0.02*ratio, `its size as the metric says (${(b[2]/(2*h)).toFixed(4)} for ${ratio.toFixed(4)})`);
        check(Math.abs(pasted.style.strokeWidth/s.style.strokeWidth - ratio) < 0.02*ratio, 'its stroke too');
    }
}

// 7 ───────────────────────────────────────────────────────────────────────────
{
    // the writes the cut of section 3 left pending (refused here: no clipboard, no document) done first
    await new Promise(r => setTimeout(r, 20));
    const { editor } = newEditor();
    // the SVG import needs a DOM: what pasteContent hands it is enough here
    banners.length = 0;
    const taken = await withBanners(() => editor.pasteContent({ text: 'plain words' }));
    check(taken === false, 'plain text is not taken (the browser\'s own paste)');
    check(banners.length === 1 && /Nothing to paste: no shapes, SVG or picture on the clipboard \(it holds only text\)/.test(banners[0]), `a banner says what the clipboard holds (${banners[0]})`);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    banners.length = 0;
    const svgImported = await withBanners(() => editor.pasteContent({ text: svg }));
    check(svgImported === true, 'another program\'s SVG text taken as an import');
    check(banners.length === 1 && /could not be read/.test(banners[0]), 'whose reading fails here, which a banner says');
}

// 8 ───────────────────────────────────────────────────────────────────────────
{
    // the similarity of a group transform, maker -> world: w = s R (p + t), by hand
    const tw = (t, p) => { const a = t.rotation*Math.PI/180, x = p[0] + t.translationX, y = p[1] + t.translationY;
        return [t.scale*(Math.cos(a)*x - Math.sin(a)*y), t.scale*(Math.sin(a)*x + Math.cos(a)*y)]; };
    const TB = { translationX: 0.1, translationY: -0.2, rotation: 30, scale: 1.5 };
    const ptcA = { centerX: 0.2, centerY: -0.1, scale: 0.8, angle: 10 };
    const ptcB = { centerX: -0.5, centerY: 0.3, scale: 1.6, angle: -25 };
    // A has no group transform: world A is the maker's coordinates
    const carry = (w) => tw(TB, w);
    const carriedAll = (src, out) => {
        let ok = src.length === out.length;
        for (let i = 0; ok && i + 1 < src.length; i += 2) { const e = carry([src[i], src[i + 1]]); ok = near(e[0], out[i], 1e-9) && near(e[1], out[i + 1], 1e-9); }
        return ok;
    };
    const G = () => klm(6, 2, 3, false);
    const a = newEditor(placedGroup(G(), ptcA), ptcA), b = newEditor(placedGroup(G(), ptcB, TB), ptcB, TB);
    const s = a.doc.insertItem(square(0.3, 0.1, 0.05, { colorWord: 'a' }));
    a.editor.setSelection([sel(s.id)]);
    const { text } = a.editor.selectionClipboard();
    b.editor.pasteContent({ text }, true);
    const p = b.doc.getItems()[0];
    check(carriedAll(s.points, p.points), 'the same group put elsewhere by the group transform: in place where the tiling has it');
    check(near(p.style.strokeWidth, 1.5*s.style.strokeWidth, 1e-12), 'its stroke follows the tiling\'s scale');
    check(p.colorWord === 'a', 'its colour word kept');
    // at the pointer: carried, then moved there
    b.editor.notePointer([1, 1]);
    b.editor.pasteContent({ text });
    const q = b.doc.getItems()[1];
    const qc = boxCentre(q.points);
    check(near(qc[0], 1, 1e-9) && near(qc[1], 1, 1e-9), 'at the pointer: centred there');
    check(near(Math.hypot(q.points[2] - q.points[0], q.points[3] - q.points[1]), 0.15, 1e-9), 'at the pointer: the size of the tiling\'s scale');
    // the same group transform in another pattern box (the box moved, the group stays in the world): where it was
    const c = newEditor(placedGroup(G(), ptcB), ptcB);
    c.editor.pasteContent({ text }, true);
    check(JSON.stringify(c.doc.getItems()[0].points) === JSON.stringify(s.points) && c.doc.getItems()[0].colorWord === 'a',
          'another pattern box: where it was copied, the colour word kept');
    // another group: by the world, no colour word
    const d = newEditor(placedGroup(klm(4, 4, 2, false), ptcB, TB), ptcB, TB);
    d.editor.pasteContent({ text }, true);
    check(JSON.stringify(d.doc.getItems()[0].points) === JSON.stringify(s.points) && !d.doc.getItems()[0].colorWord, 'another group: by the world');

    // the hyperbolic plane: a geodesic path stays geodesic, carried with the tiling
    const H = () => klm(2, 3, 7, false);
    const ha = newEditor(placedGroup(H(), ptcA), ptcA), hb = newEditor(placedGroup(H(), ptcB, TB), ptcB, TB);
    const ga = ha.editor.drawingGeometry(), gb = hb.editor.drawingGeometry();
    check(ga.kind === 'hyperbolic' && near(gb.r, 1.5*ga.r, 1e-9) && near(carry(ga.c)[0], gb.c[0], 1e-9) && near(carry(ga.c)[1], gb.c[1], 1e-9),
          'the group transform takes the one disk onto the other');
    if (ga.kind === 'hyperbolic') {
        const r = ga.r, c0 = ga.c;
        const geo = ha.doc.insertItem({ type: 'path', closed: false, geodesic: true,
            nodes: [{ p: [c0[0] - 0.3*r, c0[1] + 0.1*r], h1: null, h2: null }, { p: [c0[0] + 0.4*r, c0[1] + 0.2*r], h1: null, h2: null }],
            style: { stroke: RED, strokeWidth: 0.01, fill: null } });
        ha.editor.setSelection([sel(geo.id)]);
        const t = ha.editor.selectionClipboard().text;
        const rec = recordOfText(t);
        const pasted = pastedItems(rec, clipboardPlace({ geometry: gb, group: placedGroup(H(), ptcB, TB), ptc: ptcB, groupTransform: TB }));
        check(pasted.sameGroup && pasted.sameGeometry && pasted.carried && pasted.asDrawn === 0, 'a geodesic path into the same group put elsewhere: not as drawn');
        hb.editor.pasteContent({ text: t }, true);
        const hp = hb.doc.getItems()[0];
        check(!!hp.geodesic, 'it stays geodesic');
        check(carriedAll(geo.nodes.flatMap(n => n.p), hp.nodes.flatMap(n => n.p)), 'its nodes where the tiling has them');
        // the same group transform in another pattern box: nothing moves
        const hc = newEditor(placedGroup(H(), ptcB), ptcB);
        hc.editor.pasteContent({ text: t }, true);
        check(!!hc.doc.getItems()[0].geodesic && JSON.stringify(hc.doc.getItems()[0].nodes.map(n => n.p)) === JSON.stringify(geo.nodes.map(n => n.p)),
              'another pattern box: where it was, geodesic');
    }

    // a group drawn by its Dirichlet domain is the group it was made from
    const wp = G();
    const base = dirichletBase({ baseX: 0.03, baseY: 0.07 });
    const words = selectDirichletSides(wp, { base, depth: 2 }).words;
    const dg = makeDirichletGroup(wp, { base, words });
    check(!!dg && groupFingerprint(dg) === groupFingerprint(wp), 'with the Dirichlet domain: the same fingerprint');
    check(!!dg && groupFingerprint(dg.clone()) === groupFingerprint(wp), 'a clone of it too');
    // as SymRenderer draws it: the domain of the group put in the world, then the whole into the pattern box
    const placedDg = placedGroup(G(), ptcB, TB, (g) => makeDirichletGroup(g, { base: dirichletBase({ baseX: 0.2, baseY: 0.1 }), words }));
    check(!!placedDg && !!placedDg.dirichletWords && groupFingerprint(placedDg, ptcB, TB) === groupFingerprint(wp), 'its domain put in the world and the box: the same fingerprint');
}

// 9 ───────────────────────────────────────────────────────────────────────────
{
    const { text } = clipboardContent([square(0, 0, 0.1)], {});
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' });
    const svgFile = new File([svg], 'shape.svg', { type: 'image/svg+xml' });
    const page = '<html><body><p>a drawing</p><svg viewBox="0 0 4 4"><circle r="2"/></svg></body></html>';
    const kind = (got) => pasteChoice(got).kind + (pasteChoice(got).from ? ':' + pasteChoice(got).from : '');
    check(kind({ text, svg, html: page, files: [png] }) === 'record', 'a record first');
    check(kind({ text: 'words', svg: text }) === 'record', 'a record in the SVG');
    check(kind({ svg, files: [svgFile, png] }) === 'svg:svg', 'image/svg+xml next');
    check(kind({ files: [png, svgFile] }) === 'svgFile', 'an SVG file before a picture');
    check(kind({ text: svg, files: [png] }) === 'svg:text', 'SVG text before a picture (shapes before a picture of them)');
    check(kind({ html: page, files: [png] }) === 'svg:html', 'a web page\'s <svg> before a picture');
    const alone = pasteChoice({ files: [png], types: ['Files'] });
    check(alone.kind === 'picture' && alone.file === png && alone.only, 'a picture alone: said so');
    const withPage = pasteChoice({ html: '<img src="x.png">', files: [png] });
    check(withPage.kind === 'picture' && !withPage.only, 'a picture copied from a page (HTML with it): not alone');
    check(pasteChoice({ text: 'words' }).what === 'only text', 'text alone: "only text"');
    const none = pasteChoice({ text: 'words', html: '<b>words</b>', types: ['text/plain', 'text/html', 'Files'],
                               files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] });
    check(none.kind === 'none' && none.what === 'text/plain, text/html, application/pdf', `nothing usable: its types named (${none.what})`);
    check(pasteChoice({}).what === 'nothing', 'an empty clipboard: "nothing"');

    // a web page's <svg> without a DOM: cut out, nested ones inside, an xmlns put on
    const cut = svgOfHtml('<p>x</p><svg viewBox="0 0 1 1"><svg><rect/></svg><use xlink:href="#a"/></svg><svg>second</svg>');
    check(!!cut && cut.startsWith('<svg') && /\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(cut) && /\sxmlns:xlink=/.test(cut)
          && cut.endsWith('<use xlink:href="#a"/></svg>') && !cut.includes('second'), 'the first <svg> with what it holds, namespaces put on');
    check(svgOfHtml('<svg viewBox="0 0 1 1"/>') === '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', 'an empty <svg/>');
    check(svgOfHtml('<p>no drawing</p>') === null && svgOfHtml(null) === null, 'no <svg>: none');
}

// 10 ──────────────────────────────────────────────────────────────────────────
{
    // the PNG's size: unitPx pixels to a unit of the viewBox, the longer side at most maxSide
    const sz = (t, o) => JSON.stringify(svgPictureSize(t, o));
    const vb = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -0.5 2 1" width="1000" height="500"><g/></svg>';
    check(sz(vb, { unitPx: 100 }) === '{"width":200,"height":100}', 'by the viewBox, not the width');
    check(sz(vb, { unitPx: 100, maxSide: 150 }) === '{"width":150,"height":75}', 'at most maxSide a side');
    check(sz('<svg width="30" height="10"/>', { unitPx: 2 }) === '{"width":60,"height":20}', 'no viewBox: by width and height');
    check(sz('<svg viewBox="0 0 1000 1"/>', { unitPx: 1, maxSide: 100 }) === '{"width":100,"height":1}', 'never below a pixel');
    check(svgPictureSize('<svg/>', { unitPx: 1 }) === null && svgPictureSize('no svg') === null, 'no size: none');

    // a stubbed async clipboard: ClipboardItem with supports, write awaiting each type as Chrome does
    const navWas = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let supported = ['text/plain', 'image/png'];
    let refuse = false;
    const writes = [];
    class FakeItem {
        constructor(data){ this.data = data; this.types = Object.keys(data); }
        async getType(t){ return await this.data[t]; }
        static supports(t){ return supported.includes(t); }
    }
    globalThis.ClipboardItem = FakeItem;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { clipboard: {
        write: async (items) => {
            if (refuse) throw new Error('NotAllowedError');
            const out = {};
            for (const t of items[0].types) out[t] = await (await items[0].getType(t)).text();
            writes.push(out);
        } } } });
    try {
        const called = { svg: false, png: false };
        const ok = await writeClipboardItems({ 'text/plain': 'the text', 'image/svg+xml': () => { called.svg = true; return '<svg/>'; },
            'image/png': () => { called.png = true; return Promise.resolve(new Blob(['png bytes'], { type: 'image/png' })); } });
        check(ok && writes.length === 1 && Object.keys(writes[0]).join() === 'text/plain,image/png' && writes[0]['text/plain'] === 'the text'
              && writes[0]['image/png'] === 'png bytes', 'the types the browser writes, as one item');
        check(called.png && !called.svg, 'a function called only for a type written');
        refuse = true;
        check(await writeClipboardItems({ 'text/plain': 'x' }) === false, 'refused: false');
        refuse = false;
        check(await writeClipboardItems({ 'image/gif': 'x' }) === false, 'no type it writes: false');

        // the editor's copy event: the text at once, then the text, the SVG and the PNG, without the PNG where it cannot be drawn
        supported = ['text/plain', 'image/svg+xml', 'image/png'];
        writes.length = 0;
        const { doc, editor } = newEditor();
        const s = doc.insertItem(square(1, 2, 0.25));
        editor.setSelection([sel(s.id)]);
        const set = {};
        let prevented = false;
        listeners.copy.at(-1)({ clipboardData: { setData: (t, v) => { set[t] = v; } }, target: null, preventDefault: () => { prevented = true; } });
        check(prevented && !!recordOfText(set['text/plain']), 'the copy event: the text with the record, the browser\'s own copy prevented');
        for (let k = 0; k < 20 && !writes.length; k++) await new Promise(r => setTimeout(r, 5));
        check(writes.length === 1 && Object.keys(writes[0]).join() === 'text/plain,image/svg+xml'
              && writes[0]['text/plain'] === set['text/plain'] && writes[0]['image/svg+xml'] === set['text/plain'],
              `then the text and the SVG through the async clipboard, no PNG without a DOM (${writes.map(w => Object.keys(w).join('+')).join(' | ')})`);
        // refused: the event's text stays, nothing more is written
        refuse = true;
        writes.length = 0;
        listeners.copy.at(-1)({ clipboardData: { setData: () => {} }, target: null, preventDefault: () => {} });
        await new Promise(r => setTimeout(r, 30));
        check(writes.length === 0, 'refused: the event\'s text left as it was');
    } finally {
        delete globalThis.ClipboardItem;
        if (navWas) Object.defineProperty(globalThis, 'navigator', navWas); else delete globalThis.navigator;
    }
}

// 11 ──────────────────────────────────────────────────────────────────────────
{
    // the root's size and the content group's matrix, as a program pasting the root's children sees them
    const read = (text) => {
        const root = text.match(/<svg[^>]*>/)[0];
        const num = (name) => parseFloat(root.match(new RegExp(`\\s${name}="([^"]*)"`))[1]);
        const vb = root.match(/viewBox="([^"]*)"/)[1].split(' ').map(Number);
        const m = text.match(/<g transform="matrix\(([^)]*)\)">/);
        return { width: num('width'), height: num('height'), vb, m: m ? m[1].split(' ').map(Number) : null };
    };
    const at = (m, p) => [m[0]*p[0] + m[2]*p[1] + m[4], m[1]*p[0] + m[3]*p[1] + m[5]];
    // a square of side 0.5 at (1, 2), its stroke 0.01: the SVG's box round it, with the stroke and a margin
    const sq = square(1, 2, 0.25);
    const r = read(clipboardContent([sq], {}, { unitPx: 200 }).text);
    check(r.vb.join() === `0,0,${r.width},${r.height}` && near(r.width, r.height, 1e-9) && r.width > 100 && r.width < 120,
          `its own units pixels: viewBox 0 0 w h = its size (${r.vb.join(' ')}; ${r.width} x ${r.height})`);
    const c0 = at(r.m, [0.75, 2.25]), c1 = at(r.m, [1.25, 1.75]);
    const margin = 0.5*(r.width - 100);
    check(!!r.m && r.m[0] === 200 && r.m[3] === -200 && near(c0[0], margin, 1e-6) && near(c0[1], margin, 1e-6)
          && near(c1[0], r.width - margin, 1e-6) && near(c1[1], r.height - margin, 1e-6),
          `the content's group takes the world to them, y down, the square in the middle (${c0.map(v => v.toFixed(3))} .. ${c1.map(v => v.toFixed(3))})`);
    // the content alone, its viewBox left out: 100 pixels for the square's 0.5
    check(near(c1[0] - c0[0], 100, 1e-6), 'the root\'s children alone: the size as seen');
    const big = read(clipboardContent([sq], {}, { unitPx: 1e6 }).text), small = read(clipboardContent([sq], {}, { unitPx: 1 }).text);
    const plain = read(clipboardContent([sq], {}).text);
    check(big.m[0] === 16384/0.5 && small.m[0] === 16/0.5 && plain.m[0] === 1000/0.5,
          `the shapes kept to 16 .. 16384 pixels a side, 1000 without a scale (${big.m[0]}, ${small.m[0]}, ${plain.m[0]} a unit)`);
    check(!!recordOfText(clipboardContent([sq], {}, { unitPx: 200 }).text), 'the record as before');
    // the editor: its view's scale (0.001 world units a pixel here, one device pixel to a CSS pixel)
    const { doc, editor } = newEditor();
    const s = doc.insertItem(square(1, 2, 0.25));
    editor.setSelection([sel(s.id)]);
    const e = read(editor.selectionClipboard().text);
    check(e.m[0] === 1000, `the editor's copy at the view's scale: 1000 pixels a unit (${e.m[0]})`);
}

// 12 ──────────────────────────────────────────────────────────────────────────
{
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' });
    const { text } = clipboardContent([square(0, 0, 0.1)], {});
    check(svgHeldBack({ types: ['image/svg+xml'] }) === true, 'an SVG named, none given: held back');
    check(svgHeldBack({ types: ['image/svg+xml', 'Files'], files: [png] }) === true, 'with a picture beside it: still read (shapes before a picture)');
    check(svgHeldBack({ types: ['image/svg+xml'], svg }) === false, 'the SVG given: not');
    check(svgHeldBack({ types: ['text/plain', 'image/svg+xml'], text }) === false, 'a record beside it: not');
    check(svgHeldBack({ types: ['text/plain', 'image/svg+xml'], text: svg }) === false, 'SVG text beside it: not');
    check(svgHeldBack({ types: ['text/plain'], text: 'words' }) === false, 'no SVG named: not');

    // the editor's Ctrl+V: the event as Chrome gives it with Inkscape's clipboard
    const navWas = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let reads = 0, refuse = false;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { clipboard: {
        read: async () => { reads++; if (refuse) throw new Error('NotAllowedError'); return [{ types: ['image/svg+xml'], getType: async (t) => new Blob([svg], { type: t }) }]; },
    } } });
    try {
        await new Promise(r => setTimeout(r, 20));
        const { doc, editor } = newEditor();
        const event = () => {
            let prevented = false;
            listeners.paste.at(-1)({ clipboardData: { types: ['image/svg+xml'], files: [], getData: () => '' }, target: null, preventDefault: () => { prevented = true; } });
            return prevented;
        };
        banners.length = 0;
        let prevented = await withBanners(event);
        check(prevented && reads === 1, 'the event taken, the clipboard read through the async API');
        // the SVG reached the import (whose reading fails here, without a DOM)
        check(banners.length === 1 && /could not be read/.test(banners[0]), `its SVG imported (${banners[0]})`);
        refuse = true;
        banners.length = 0;
        prevented = await withBanners(event);
        check(prevented && reads === 2 && banners.length === 1 && /^. Nothing pasted\. The browser gives the page the clipboard's SVG only when the page may read the clipboard/.test(banners[0]),
              `refused: nothing pasted, the banner says how to let the page read (${banners[0]})`);
        check(doc.getItems().length === 0, 'nothing added');
    } finally {
        if (navWas) Object.defineProperty(globalThis, 'navigator', navWas); else delete globalThis.navigator;
    }
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
