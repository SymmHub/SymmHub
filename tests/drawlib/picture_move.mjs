/*
 node tests/drawlib/picture_move.mjs

 Alt-drag of a picture inside its frame (docs/symdraw_images_ui_plan.md 4.2):
  1. Frames.pictureShifted: the picture moves, the frame and the rest stay; none without one picture
  2. the node tool: Alt+drag inside a selected frame moves its picture, one undo step;
     the frame is selected when it was not; a plain drag or a click moves nothing;
     an Alt+press outside the frame does not move it; Reset places the picture again
  3. on a copy: the drag is read through the copy's frame
  4. the select tool: Alt+drag moves the picture, a plain drag the frame with it
  5. inside a frame (a double click entered it): Alt+drag on its picture moves it in both tools,
     the selection kept; a press outside leaves it, one Escape leaves it (with a selection too),
     the bar's "inside" label and Leave button; the picture selected inside stands for its frame
     in the picture controls (Reset, Edit image), a replace keeps it where it is
*/

import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import { SelectTool } from '../../lib/drawlib/SelectTool.js';
import { containerProperties } from '../../lib/drawlib/ToolProperties.js';
import { pictureShifted } from '../../lib/drawlib/Frames.js';

globalThis.window = globalThis.window || { addEventListener(){} };
// the pictures never decode here: a click finds them on their quads
globalThis.fetch = () => new Promise(() => {});

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const PNG = 'data:image/png;base64,AAAA';

function setup(){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        // a canvas pixel is a hundredth of a world unit
        view: { toCanvas: w => [100*w[0], 100*w[1]], toWorld: c => ({ pnt: [c[0]/100, c[1]/100] }), isLinear: () => true, pixelSize: () => 0.01 },
    });
    const tool = NodeTool({ editor });
    const frame = document.insertItem(editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 2, ry: 1, angle: 0 }, { src: PNG, size: [200, 100] }, 'cover'));
    return { doc: document, editor, tool, id: frame.id };
}

/** a pointer event at the world point w */
function ev(type, w, extra = {}){
    return { type, wpnt: w, canvasX: 100*w[0], canvasY: 100*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1, preventDefault(){}, ...extra };
}
function drag(tool, from, to, mods = {}){
    tool.handleEvent(ev('pointerdown', from, mods));
    const mid = [(from[0] + to[0])/2, (from[1] + to[1])/2];
    tool.handleEvent(ev('pointermove', mid, mods));
    tool.handleEvent(ev('pointermove', to, mods));
    tool.handleEvent(ev('pointerup', to, mods));
}
const pictureOf = (doc, id) => doc.getItem(id).children[0];

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, id } = setup();
    const holder = doc.getItem(id);
    const moved = pictureShifted(holder, 0.5, -0.25);
    const a = holder.children[0].points, b = moved.children[0].points;
    check(b.every((v, i) => near(v, a[i] + (i % 2 ? -0.25 : 0.5))), 'the picture moves by (dx, dy)');
    check(JSON.stringify(moved.points) === JSON.stringify(holder.points) && moved.shape.rx === 2 && moved.id === holder.id, 'the frame stays');
    check(moved.children[0].src === PNG && holder.children[0].points === a, 'the picture kept, the holder before untouched');
    check(pictureShifted({ type: 'polyline', closed: true, points: [0, 0, 1, 0, 1, 1], style: {} }, 1, 1) === null &&
          pictureShifted({ type: 'group', children: [holder.children[0]], style: {} }, 1, 1) === null, 'none without one picture');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor, tool, id } = setup();
    const before = pictureOf(doc, id).points.slice();
    // not selected: an Alt+drag on the picture selects the frame and moves the picture
    drag(tool, [0.3, 0.2], [0.8, 0.1], { altKey: true });
    const after = pictureOf(doc, id).points;
    check(editor.isSelected(id), 'the frame selected');
    check(after.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5))), 'the picture moved with the pointer');
    check(JSON.stringify(doc.getItem(id).points) === JSON.stringify(editor.document.getItem(id).points) && doc.getItem(id).shape.cx === 0, 'the frame stays');
    editor.undo();
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i])), 'one undo step brings it back');
    editor.redo();
    // selected: inside its outline, even where the picture would not be hit
    drag(tool, [-1.5, 0.5], [-1.5, 0.0], { altKey: true });
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.6 : 0.5))), 'again, from inside the selected frame');
    // without Alt the picture stays (the node tool has no move of whole items)
    const now = pictureOf(doc, id).points.slice();
    drag(tool, [0.3, 0.2], [1.0, 0.6]);
    check(JSON.stringify(pictureOf(doc, id).points) === JSON.stringify(now), 'a plain drag: nothing moves');
    // an Alt+click: nothing moves, no undo step
    tool.handleEvent(ev('pointerdown', [0.3, 0.2], { altKey: true }));
    tool.handleEvent(ev('pointerup', [0.3, 0.2], { altKey: true }));
    editor.undo();
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5))), 'an Alt+click is no step (the undo took the drag before)');
    editor.redo();
    // outside the frame: no move
    const kept = pictureOf(doc, id).points.slice();
    drag(tool, [5, 5], [6, 6], { altKey: true });
    check(JSON.stringify(pictureOf(doc, id).points) === JSON.stringify(kept), 'an Alt+drag outside: nothing moves');
    // Reset: covering the frame again
    editor.setSelection([{ id, frame: null, frameInv: null }]);
    editor.placePicture();
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i])), 'Reset places it again');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor, tool, id } = setup();
    const before = pictureOf(doc, id).points.slice();
    // a copy half turned about (5, 0): the item's place x is seen at (10 - x, -y), and back the same
    const halfTurn = { transform: (p) => ({ v: [10 - p.v[0], -p.v[1]] }) };
    editor.setSelection([{ id, frame: halfTurn, frameInv: halfTurn }]);
    drag(tool, [10.3, -0.2], [9.8, -0.1], { altKey: true });
    // the pointer moved by (-0.5, +0.1) on the copy: by (+0.5, -0.1) on the item
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5))), 'on a turned copy: it follows the pointer there');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor, id } = setup();
    const tool = SelectTool({ editor });
    const before = pictureOf(doc, id).points.slice(), frame = JSON.stringify(doc.getItem(id).points);
    drag(tool, [0.3, 0.2], [0.8, 0.1], { altKey: true });
    check(editor.isSelected(id) && pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5))), 'select tool: Alt+drag moves the picture');
    check(JSON.stringify(doc.getItem(id).points) === frame, 'the frame stays');
    editor.undo();
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i])), 'one undo step');
    drag(tool, [0.3, 0.2], [0.8, 0.1]);
    const f = doc.getItem(id).points, f0 = JSON.parse(frame);
    check(near(f[0], f0[0] + 0.5, 1e-6) && pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5), 1e-6)), 'a plain drag moves the frame, the picture with it');
}

// 5 ───────────────────────────────────────────────────────────────────────────
for (const kind of ['node', 'select']) {
    const { doc, editor, tool: nodeTool, id } = setup();
    const tool = kind === 'node' ? nodeTool : SelectTool({ editor });
    const before = pictureOf(doc, id).points.slice();
    editor.enterContainer(id, null, null);
    const bar = containerProperties(editor);
    const label = bar.controls.find(c => c.kind === 'label'), leave = bar.controls.find(c => c.kind === 'button');
    check(bar.visible() && label.text() === `inside ${id}`, `${kind}: the bar says which item is entered`);
    // a click on the picture inside picks it; an Alt+drag moves it, the selection kept
    tool.handleEvent(ev('pointerdown', [0.3, 0.2])); tool.handleEvent(ev('pointerup', [0.3, 0.2]));
    const picked = editor.getSelection().map(s => s.id).join();
    drag(tool, [0.3, 0.2], [0.8, 0.1], { altKey: true });
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i] + (i % 2 ? -0.1 : 0.5))), `${kind}: inside the frame Alt+drag moves its picture`);
    check(editor.getContainer() && editor.getSelection().map(s => s.id).join() === picked, `${kind}: still inside, the selection kept`);
    check(picked === pictureOf(doc, id).id && editor.getPictureHolders().map(h => h.id).join() === id, `${kind}: the picture picked inside stands for its frame`);
    editor.placePicture();
    check(pictureOf(doc, id).points.every((v, i) => near(v, before[i])), `${kind}: Reset on it places the picture again`);
    editor.undo();
    // one Escape leaves, a selection or not
    tool.handleKey({ type: 'keydown', key: 'Escape' });
    check(!editor.getContainer() && !bar.visible(), `${kind}: one Escape leaves`);
    // a press outside leaves too, and picks what is there
    editor.enterContainer(id, null, null);
    tool.handleEvent(ev('pointerdown', [5, 5])); tool.handleEvent(ev('pointerup', [5, 5]));
    check(!editor.getContainer(), `${kind}: a press outside leaves`);
    editor.enterContainer(id, null, null);
    tool.handleEvent(ev('pointerdown', [1.9, 0.9])); tool.handleEvent(ev('pointerup', [1.9, 0.9]));
    check(!!editor.getContainer(), `${kind}: a press inside stays`);
    leave.action();
    check(!editor.getContainer(), `${kind}: Leave in the bar`);
    // the press outside picks the frame's copy elsewhere: a frame pressed after leaving is selected
    editor.enterContainer(id, null, null);
    const other = doc.insertItem(editor.framedPicture({ kind: 'rect', cx: 6, cy: 0, rx: 1, ry: 1, angle: 0 }, { src: PNG, size: [100, 100] }, 'cover'));
    editor.leaveContainer(); editor.enterContainer(id, null, null);
    tool.handleEvent(ev('pointerdown', [6, 0])); tool.handleEvent(ev('pointerup', [6, 0]));
    check(!editor.getContainer() && editor.isSelected(other.id), `${kind}: a press on another frame leaves and selects it`);
}

console.log(failed ? `${failed} failed` : 'all passed');
