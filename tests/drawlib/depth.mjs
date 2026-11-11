/*
 node tests/drawlib/depth.mjs

 The depth of items in the colour layers' depth sort (docs/symdraw_images_ui_plan.md 4.4.1):
  1. the document keeps a depth, drops 0 and what is not a number
  2. the editor sets the selection's depth (a value, a move by, merged typing), one undo step
  3. Alt+PageUp, Alt+PageDown nudge it by depthStep (a tenth of the pattern box's half size)
  4. the depth row of the node tool's bar: shown with a selection, its number and nudges
  5. the sprites take each member's depth, its own and its groups'
*/

import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { depthProperty, handleDepthKey } from '../../lib/drawlib/ToolProperties.js';
import { PatternDrawing } from '../../lib/drawlib/PatternDrawing.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const square = (cx, cy, h) => ({ type: 'polyline', closed: true, points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
                                 style: { stroke: { rgba: [0, 0, 0, 1] }, fill: null, strokeWidth: 0.01, opacity: 1 } });

function newEditor(scale = 1){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { doc } = newEditor();
    const a = doc.insertItem({ ...square(0, 0, 1), depth: 0.25 });
    const b = doc.insertItem({ ...square(0, 0, 1), depth: 0 });
    const c = doc.insertItem({ ...square(0, 0, 1), depth: 'x' });
    check(doc.getItem(a.id).depth === 0.25, 'a depth kept');
    check(!('depth' in doc.getItem(b.id)) && !('depth' in doc.getItem(c.id)), 'a depth of 0, or not a number, dropped');
    check(JSON.parse(JSON.stringify(doc.getItem(a.id))).depth === 0.25, 'saved');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const a = doc.insertItem(square(0, 0, 1)), b = doc.insertItem(square(3, 0, 1));
    check(editor.selectionDepth() === null, 'no selection: no depth');
    editor.setSelection([{ id: a.id, frame: null, frameInv: null }, { id: b.id, frame: null, frameInv: null }]);
    check(editor.selectionDepth() === 0, 'none set: 0');
    check(editor.setSelectionDepth(0.5), 'set');
    check(doc.getItem(a.id).depth === 0.5 && doc.getItem(b.id).depth === 0.5 && editor.selectionDepth() === 0.5, 'both at 0.5');
    check(!editor.setSelectionDepth(0.5), 'the same value: no step');
    editor.setSelection([{ id: b.id, frame: null, frameInv: null }]);
    editor.setSelectionDepth(0, { by: 0.25 });
    check(doc.getItem(b.id).depth === 0.75 && doc.getItem(a.id).depth === 0.5, 'moved by 0.25, the other kept');
    editor.undo();
    check(doc.getItem(b.id).depth === 0.5, 'undo of the move');
    editor.undo();
    check(!('depth' in doc.getItem(a.id)) && !('depth' in doc.getItem(b.id)), 'undo of the set: no depth');
    // typing merges into one step (an undo drops the selection)
    const selectB = () => editor.setSelection([{ id: b.id, frame: null, frameInv: null }]);
    selectB();
    editor.setSelectionDepth(0.1, { mergeKey: 'depth' });
    editor.setSelectionDepth(0.12, { mergeKey: 'depth' });
    editor.setSelectionDepth(0.125, { mergeKey: 'depth' });
    check(doc.getItem(b.id).depth === 0.125, 'typed 0.125');
    editor.undo();
    check(!('depth' in doc.getItem(b.id)), 'one undo step for the typing');
    editor.redo();
    check(doc.getItem(b.id).depth === 0.125, 'redo');
    selectB();
    editor.setSelectionDepth(0);
    check(!('depth' in doc.getItem(b.id)), 'back to 0: the field goes');
    // no float noise from the nudges
    for (let i = 0; i < 3; i++) editor.setSelectionDepth(0, { by: 0.1 });
    check(doc.getItem(b.id).depth === 0.3, `three nudges of 0.1: 0.3, ${doc.getItem(b.id).depth}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor(2);
    const a = doc.insertItem(square(0, 0, 1));
    const key = (k, altKey = true) => { const e = { type: 'keydown', key: k, altKey }; return handleDepthKey(editor, e); };
    check(!key('PageUp'), 'no selection: the key is not taken');
    editor.setSelection([{ id: a.id, frame: null, frameInv: null }]);
    check(editor.depthStep() === 0.2, 'the step: a tenth of the pattern box half size 2');
    check(key('PageUp') && doc.getItem(a.id).depth === 0.2, 'Alt+PageUp: forward');
    check(key('PageDown') && key('PageDown') && doc.getItem(a.id).depth === -0.2, 'Alt+PageDown twice: back');
    check(!key('PageUp', false) && doc.getItem(a.id).depth === -0.2, 'PageUp without Alt is not the depth');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const a = doc.insertItem(square(0, 0, 1));
    const row = depthProperty(editor);
    check(!row.visible(), 'hidden without a selection');
    editor.setSelection([{ id: a.id, frame: null, frameInv: null }]);
    check(row.visible(), 'shown with one');
    const [num, fwd, back] = row.controls;
    num.set(0.4);
    check(num.get() === 0.4 && doc.getItem(a.id).depth === 0.4, 'the number sets it');
    fwd.action();
    check(Math.abs(num.get() - 0.5) < 1e-12, 'forward: +0.1');
    back.action(); back.action();
    check(Math.abs(num.get() - 0.3) < 1e-12, 'back twice: 0.3');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    // the drawing's sprite entries, without GL: its document as the sprites read it
    const pd = PatternDrawing({});
    const doc = pd.getDocument();
    doc.clear();
    const a = doc.insertItem({ ...square(0, 0, 1), depth: 0.5 });
    const g = doc.insertItem({ type: 'group', depth: 1, style: { opacity: 1 }, children: [{ ...square(2, 0, 1), depth: 0.25 }, square(4, 0, 1)] });
    const entries = pd.getSpriteEntries ? pd.getSpriteEntries() : null;
    check(!!entries, 'the sprite entries are read');
    if (entries) {
        const depthOf = id => entries.find(e => e.item.id === id).depth;
        const [m1, m2] = doc.getItem(g.id).children.map(c => c.id);
        check(depthOf(a.id) === 0.5, 'an item: its own depth');
        check(depthOf(m1) === 1.25 && depthOf(m2) === 1, `a group's members: theirs and the group's, ${depthOf(m1)}, ${depthOf(m2)}`);
    }
}

console.log(failed ? `${failed} failed` : 'all passed');
