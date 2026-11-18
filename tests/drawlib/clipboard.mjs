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
*/

import { Group_KLM, dirichletBase, selectDirichletSides, makeDirichletGroup } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { clipboardContent, recordOfText, pastedItems, clipboardPlace, groupFingerprint, drawnItem } from '../../lib/drawlib/Clipboard.js';
import { savedItem } from '../../lib/drawlib/Paths.js';
import { poseInverseTransform } from '../../lib/symhublib/PatternPose.js';
import { groupTransformITransform } from '../../lib/symhublib/sym_utils.js';

globalThis.window = globalThis.window || { addEventListener(){} };

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

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
