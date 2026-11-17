/*
  tests of the stroke switch (docs/clipboard_plan.md 3.8): the style setting
  `stroked` of lib/drawlib/DrawingEditor.js

    node tests/drawlib/stroke_switch.mjs

  1. on by default; off, the style has no stroke (forced: the stroke's paint
     all the same); saved with the style, a saved style without it leaves it
  2. new items: a closed one drawn with the stroke off has none, an open one
     takes the stroke whatever the switch says
  3. a selected shape without a stroke shows the switch off, and a change of
     its fill no longer gives it a stroke (an SVG import with stroke="none")
  4. the switch on a selection: closed shapes lose their stroke and get it
     back, open lines keep theirs; one undo step each
*/

import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}

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

const square = (cx, cy, h, style) => ({ type: 'polyline', closed: true,
    points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h], style });
const line = (x0, y0, x1, y1, style) => ({ type: 'polyline', closed: false, points: [x0, y0, x1, y1], style });
const RED = { rgba: [1, 0, 0, 1] }, BLUE = { rgba: [0, 0, 1, 1] };

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { editor } = newEditor();
    const cfg = editor.getStyleConfig();
    check(cfg.stroked === true, 'the stroke is on by default');
    check(!!editor.getStyle().stroke, 'on: the style has a stroke');
    editor.setStyleValue('stroked', false);
    check(editor.getStyle().stroke === null, 'off: the style has no stroke');
    check(!!editor.getStyle(true).stroke, 'off, forced: the stroke\'s paint');
    const saved = editor.getStyleParams().getValue();
    check(saved.stroked === false, 'saved with the style');
    const other = newEditor().editor;
    other.getStyleParams().setValue({ stroke: '#00ff00' });
    check(other.getStyleConfig().stroked === true, 'a saved style without it (an older document) leaves it on');
    other.getStyleParams().setValue(saved);
    check(other.getStyleConfig().stroked === false, 'read back off');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { editor } = newEditor();
    editor.setStyleValue('stroked', false);
    editor.setStyleValue('filled', true);
    const closed = editor.addItem({ type: 'polyline', closed: true, points: [0, 0, 1, 0, 1, 1] });
    check(closed.style.stroke === null && !!closed.style.fill, 'a closed shape drawn with the stroke off: no stroke, its fill');
    const open = editor.addItem({ type: 'polyline', closed: false, points: [0, 0, 1, 1], style: editor.getStyle() });
    check(!!open.style.stroke && open.style.strokeWidth > 0, 'an open line drawn with the stroke off still takes one');
    editor.setStyleValue('stroked', true);
    const again = editor.addItem({ type: 'polyline', closed: true, points: [0, 0, 1, 0, 1, 1] });
    check(!!again.style.stroke, 'on again: strokes again');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const s = doc.insertItem(square(0, 0, 0.3, { stroke: null, strokeWidth: 0.01, fill: BLUE }));
    check(editor.getStyleConfig().stroked === true, 'on before the selection');
    editor.setSelection([{ id: s.id, frame: null, frameInv: null }]);
    check(editor.getStyleConfig().stroked === false, 'a selected shape without a stroke shows the switch off');
    editor.setStyleValue('fill', '#00ff00');
    const after = doc.getItem(s.id);
    check(after.style.stroke === null, 'a change of its fill gives it no stroke');
    check(Math.abs(after.style.fill.rgba[1] - 1) < 1e-9, 'the fill changed');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const a = doc.insertItem(square(0, 0, 0.3, { stroke: RED, strokeWidth: 0.02, fill: BLUE }));
    const b = doc.insertItem(line(-1, -1, 1, 1, { stroke: RED, strokeWidth: 0.02, fill: null }));
    editor.setSelection([{ id: a.id, frame: null, frameInv: null }, { id: b.id, frame: null, frameInv: null }]);
    check(editor.getStyleConfig().stroked === true, 'stroked shapes selected: on');
    editor.setStyleValue('stroked', false);
    check(doc.getItem(a.id).style.stroke === null, 'off: the closed shape loses its stroke');
    check(!!doc.getItem(b.id).style.stroke, 'off: the open line keeps its stroke');
    editor.undo();
    check(!!doc.getItem(a.id).style.stroke, 'undo: the stroke back');
    editor.redo();
    check(doc.getItem(a.id).style.stroke === null, 'redo: off again');
    // undo and redo leave nothing selected
    editor.setSelection([{ id: a.id, frame: null, frameInv: null }]);
    check(editor.getStyleConfig().stroked === false, 'the shape without its stroke selected: off');
    editor.setStyleValue('stroked', true);
    check(!!doc.getItem(a.id).style.stroke && doc.getItem(a.id).style.strokeWidth > 0, 'on again: stroked');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
