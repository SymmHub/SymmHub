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
     another group, whatever the pattern box)
  5. geometry: geodesic paths and shapes into another geometry come as the
     plain curves they were drawn with; in the same geometry they stay
     geodesic; a group of no absolute only in the same group and pattern box
  6. the hyperbolic plane: a paste at the pointer is a move of the geometry
     (the shape and its stroke shrink towards the absolute as the metric says)
  7. a paste of another program's SVG text is taken as an import (whose
     reading then fails here, without a DOM, which it logs: "DOMParser is not
     defined"; tests/drawlib/svg_import.html tests the import in a browser)
*/

import { Group_KLM } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { clipboardContent, recordOfText, pastedItems, clipboardPlace, groupFingerprint, drawnItem } from '../../lib/drawlib/Clipboard.js';
import { savedItem } from '../../lib/drawlib/Paths.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const PTC = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
function newEditor(group = null, ptc = PTC){
    const doc = DrawingDocument();
    doc.clear();
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group, ptc, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc, editor };
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
    const a = newEditor(g632), b = newEditor(g632b, ptc2), c = newEditor(g237);
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
    // a group of no absolute: the same only in the same group and pattern box
    const kl = { kind: 'euclidean', fallback: 'kleinian' };
    const k1 = recordOfText(clipboardContent([geo], { geometry: kl, group: klm(6, 2, 3, false), ptc: PTC }).text);
    check(pastedItems(k1, clipboardPlace({ geometry: kl, group: klm(6, 2, 3, false), ptc: PTC })).sameGeometry, 'no absolute, same group and box: the same');
    check(!pastedItems(k1, clipboardPlace({ geometry: kl, group: klm(6, 2, 3, false), ptc: { ...PTC, scale: 2 } })).sameGeometry, 'no absolute, another box: another');
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
    const { editor } = newEditor();
    let svgImported = null;
    // the SVG import needs a DOM: what pasteContent hands it is enough here
    const taken = editor.pasteContent({ text: 'plain words' });
    check(taken === false, 'plain text is not taken (the browser\'s own paste)');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    try {
        svgImported = editor.pasteContent({ text: svg });
    } catch (e) {
        svgImported = e;
    }
    check(svgImported === true, 'another program\'s SVG text taken as an import');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
