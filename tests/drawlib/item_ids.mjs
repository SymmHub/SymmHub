/*
  tests of the ids and the visibility of a drawing's items (lib/drawlib
  DrawingDocument, DrawingEditor), which the layers window's tree edits, and
  of a shape's names in a colour layer's images list (lib/symhublib/ImageList.js)

    node tests/drawlib/item_ids.mjs

  1. visible: false kept by the document and saved (true, the default, is
     not), a hidden item left out of what is shown and of what can be picked,
     with all it holds; isItemShown follows layer and holders
  2. names: one list for layers and items; a taken name refused; new items and
     layers take free ones; an item named as a layer is named again
  3. the editor: selectItem enters the items holding the item, refuses what is
     not seen; Ctrl adds and takes out on one level
  4. the editor: setItemVisible and renameItem are undo steps; the selection
     and the containers follow; onRenamed told on undo and redo too
  5. picking: a hidden item is not hit, nor what a hidden group holds
  6. imageListCosets of several names: a shape shown where its layer, a group
     of it or itself is named
*/

import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { drawItem } from '../../lib/drawlib/ItemRenderer.js';
import { itemsToSvg } from '../../lib/drawlib/SvgExport.js';
import { parseImageList, imageListCosets } from '../../lib/symhublib/ImageList.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const ids = items => items.map(it => it.id).join(' ');
const bits = mask => [...Array(4)].map((_, k) => (mask >>> k) & 1).join('');

const square = (cx, cy, h, extra = {}) => ({ type: 'polyline', closed: true,
    points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
    style: { stroke: null, fill: { rgba: [0, 0, 1, 1] } }, ...extra });

function newEditor(){
    const doc = DrawingDocument();
    doc.clear();
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc, editor };
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { doc } = newEditor();
    const a = doc.insertItem(square(-0.5, 0, 0.2, { id: 'a', visible: true }));
    const b = doc.insertItem(square(0.5, 0, 0.2, { id: 'b', visible: false }));
    const g = doc.insertItem({ type: 'group', id: 'g', children: [square(0, 0.5, 0.1, { id: 'c' }), square(0, -0.5, 0.1, { id: 'd', visible: false })] });
    check(doc.getItem('b').visible === false, 'visible: false is kept when inserted');
    check(!('visible' in doc.getItem('a')), 'visible: true, the default, is dropped');
    check(ids(doc.getItems()) === 'a g', 'getItems leaves a hidden item out: ' + ids(doc.getItems()));
    check(ids(doc.getEditableItems()) === 'a g', 'so does getEditableItems');
    check(ids(doc.getAllItems()) === 'a b g', 'getAllItems has it');
    check(doc.getItem('d').visible === false, 'a hidden child kept');
    const saved = JSON.stringify(doc.getLayers()[0].getParams().items.getValue());
    check(saved.split('"visible":false').length === 3 && !saved.includes('"visible":true'), 'visible: false saved twice, true never');
    const read = DrawingDocument();
    read.fromJSON(doc.toJSON());
    check(read.getItem('b').visible === false && read.getItem('d').visible === false && !('visible' in read.getItem('a')), 'visible read back');

    check(doc.setItemVisible('a', false) && doc.getItem('a').visible === false, 'setItemVisible hides');
    check(!doc.setItemVisible('a', false), 'hiding again changes nothing');
    check(doc.setItemVisible('a', true) && !('visible' in doc.getItem('a')), 'showing removes the key');
    check(!doc.setItemVisible('a', true), 'showing a shown item changes nothing');
    check(doc.isItemShown('c') && !doc.isItemShown('d') && !doc.isItemShown('b'), 'isItemShown: the item itself');
    doc.setItemVisible('g', false);
    check(!doc.isItemShown('c'), 'isItemShown: a hidden group hides what it holds');
    doc.setItemVisible('g', true);
    doc.getLayers()[0].setVisible(false);
    check(!doc.isItemShown('a'), 'isItemShown: a hidden layer hides its items');
    doc.getLayers()[0].setVisible(true);

    // drawing: a hidden item and a hidden child paint nothing
    const painted = [];
    const ctx = new Proxy({ globalAlpha: 1 }, { get: (o, k) => (k in o ? o[k] : () => painted.push(k)), set: (o, k, v) => { o[k] = v; return true; } });
    globalThis.Path2D = globalThis.Path2D || class { moveTo(){} lineTo(){} closePath(){} bezierCurveTo(){} };
    painted.length = 0; drawItem(ctx, doc.getItem('b'));
    check(!painted.includes('fill'), 'a hidden item is not drawn');
    painted.length = 0; drawItem(ctx, doc.getItem('g'));
    check(painted.filter(k => k === 'fill').length === 1, 'a group draws its shown child only');
    const svg = itemsToSvg(doc.getAllItems());
    check((svg.match(/<path /g) || []).length === 2, 'SVG export leaves hidden items out: ' + (svg.match(/<path /g) || []).length + ' paths');
    void a; void b; void g;
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { doc } = newEditor();
    doc.insertItem(square(0, 0, 0.1, { id: 'star' }));
    check(doc.isNameTaken('star') && doc.isNameTaken('layer1') && !doc.isNameTaken('moon'), 'isNameTaken: layers and items');
    check(!doc.renameItem('star', 'layer1'), 'an item cannot take a layer name');
    check(doc.renameItem('star', 'moon') && doc.getItem('moon') && !doc.getItem('star'), 'renameItem renames');
    doc.insertItem(square(0, 0, 0.1, { id: 'moon2' }));
    check(!doc.renameItem('moon', 'moon2'), 'nor a taken item name');
    // a new item never takes a layer's name, nor a new layer an item's
    doc.getLayers()[0].setId('p1');
    const fresh = doc.insertItem(square(0, 0, 0.1));
    check(fresh.id !== 'p1', 'a new item skips a layer named p1: ' + fresh.id);
    // a new layer skips an item's name: layer2 is an item's
    doc.renameItem(fresh.id, 'layer2');
    const log = console.log; console.log = () => {};
    const layer = doc.getLayerFactory().getObject('DrawingLayer');
    console.log = log;
    check(layer.getId() !== 'layer2' && layer.getId() !== 'p1', 'a new layer skips an item named layer2: ' + layer.getId());
    // an item named as a layer (from an older document) is named again
    const old = DrawingDocument();
    old.fromJSON({ version: 1, layers: [{ id: 'layer1', items: [square(0, 0, 0.1, { id: 'layer2' })] }, { id: 'layer2', items: [] }] });
    const renamed = old.getAllItems()[0].id;
    check(renamed !== 'layer2' && !old.getLayer(renamed), 'an item named as a layer is named again: ' + renamed);
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    doc.insertItem(square(-0.5, 0, 0.2, { id: 'a' }));
    doc.insertItem({ type: 'group', id: 'g', children: [square(0, 0.5, 0.1, { id: 'c' }), square(0, -0.5, 0.1, { id: 'd' })] });
    doc.insertItem(square(0.5, 0, 0.3, { id: 'f', children: [square(0.5, 0, 0.1, { id: 'e' })] }));
    const sel = () => editor.getSelection().map(s => s.id).join(' ');
    const inside = () => (editor.getContainer() ? editor.getContainer().id : '');

    check(editor.selectItem('a') && sel() === 'a' && inside() === '', 'a top item: selected, nothing entered');
    check(editor.selectItem('c') && sel() === 'c' && inside() === 'g', 'a member: its group entered');
    check(editor.selectItem('d', true) && sel() === 'c d', 'Ctrl adds on the same level');
    check(editor.selectItem('c', true) && sel() === 'd', 'and takes out');
    check(editor.selectItem('a', true) && sel() === 'a' && inside() === '', 'Ctrl on another level selects that alone');
    check(editor.selectItem('e') && sel() === 'e' && inside() === 'f', 'a shape held by a shape: it entered');
    doc.setItemVisible('d', false);
    check(!editor.selectItem('d') && sel() === 'e', 'a hidden item is not selected');
    doc.getLayers()[0].setLocked(true);
    check(!editor.selectItem('a'), 'nor one on a locked layer');
    doc.getLayers()[0].setLocked(false);
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    doc.insertItem({ type: 'group', id: 'g', children: [square(0, 0.5, 0.1, { id: 'c' }), square(0, -0.5, 0.1, { id: 'd' })] });
    const sel = () => editor.getSelection().map(s => s.id).join(' ');
    const inside = () => (editor.getContainer() ? editor.getContainer().id : '');

    editor.selectItem('c');
    check(editor.renameItem('c', 'sun', null) && sel() === 'sun' && doc.getItem('sun'), 'renamed: the selection follows');
    const told = [];
    editor.renameItem('g', 'ring', (from, to) => told.push(from + '>' + to));
    check(inside() === 'ring', 'the container followed');
    editor.undo();
    check(doc.getItem('g') && !doc.getItem('ring') && inside() === 'g', 'undo: the old name back, the container too');
    editor.redo();
    check(doc.getItem('ring') && inside() === 'ring', 'redo');
    check(told.join(' ') === 'g>ring ring>g g>ring', 'onRenamed told every time: ' + told.join(' '));
    editor.undo(); editor.undo();
    // (an undo clears the selection, as every undo does)
    check(doc.getItem('c') && !doc.getItem('sun') && inside() === 'g', 'undo of the first rename: its old name back');

    check(editor.setItemVisible('c', false) && doc.getItem('c').visible === false && sel() === '', 'hidden: it leaves the selection');
    editor.undo();
    check(!('visible' in doc.getItem('c')), 'undo shows it');
    editor.redo();
    check(doc.getItem('c').visible === false, 'redo hides it');
    editor.undo();
    editor.selectItem('d');
    editor.setItemVisible('g', false);
    check(inside() === '' && sel() === '', 'hiding the group leaves it and its selected member');
    check(!editor.setItemVisible('g', false), 'hiding it again is no step');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    doc.insertItem(square(0, 0, 0.5, { id: 'under' }));
    doc.insertItem(square(0, 0, 0.2, { id: 'over' }));
    doc.insertItem({ type: 'group', id: 'g', children: [square(0.4, 0.4, 0.05, { id: 'c' })] });
    const pick = (x, y) => { const hit = editor.hitTest([x, y], 0); return hit ? hit.item.id : null; };
    check(pick(0, 0) === 'over', 'the top one is picked');
    doc.setItemVisible('over', false);
    check(pick(0, 0) === 'under', 'hidden, the one under it is');
    check(pick(0.4, 0.4) === 'g', 'a group by its member');
    doc.setItemVisible('c', false);
    check(pick(0.4, 0.4) === 'under', 'its member hidden, the group is not hit there');
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
    const list = parseImageList('layer1 star ring+moon -');
    check(bits(imageListCosets(list, ['layer1', 'p4'], 4)) === '1000', 'by its layer: coset 0');
    check(bits(imageListCosets(list, ['layer2', 'star'], 4)) === '0100', 'by itself: coset 1');
    check(bits(imageListCosets(list, ['layer2', 'ring', 'p9'], 4)) === '0010', 'by its group: coset 2');
    check(bits(imageListCosets(list, ['layer1', 'ring', 'p9'], 4)) === '1010', 'by its layer and its group: both');
    check(bits(imageListCosets(list, ['layer2', 'p9'], 4)) === '0000', 'not named: nowhere');
    check(bits(imageListCosets(list, 'star', 4)) === '0100', 'a single name still works');
    check(bits(imageListCosets([], ['x'], 4)) === '1111', 'an empty list: everywhere');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
