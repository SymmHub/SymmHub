/*
  tests of fills, what a closed shape holds (lib/drawlib/Frames.js, DrawingEditor.js)

    node tests/drawlib/fills.mjs

  1. fillBox: along the box the item shows, turned by at most an eighth of a turn; a skew
     shears nothing
  2. imageCovering: unstretched, centred, every point of the outline covered, tight
  3. what takes a fill: closed shapes, not images, groups or open lines
  4. fillWithImage: a star holds the image, the solid fill stays, a new fill replaces the
     old one, several shapes at once; undo and redo keep the ids an edit inside needs
  5. Selection as fill: which shape takes it, the order, what stays out; undo and redo
  6. Remove fill: the shape stays, a frame painting nothing goes; undo and redo
*/

import { frameItem, fillBox, fillMap, imageCovering } from '../../lib/drawlib/Frames.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';

globalThis.window = globalThis.window || { addEventListener(){} };
// an image of 400 by 100 pixels, whatever the blob
globalThis.createImageBitmap = async () => ({ width: 400, height: 100, close(){} });
globalThis.FileReader = class { readAsDataURL(){ this.result = 'data:image/png;base64,AAAA'; this.onload(); } };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const RED = { rgba: [1, 0, 0, 1] };

const square = (cx, cy, h, style = {}, extra = {}) => ({ type: 'polyline', closed: true, points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
                                                         style: { stroke: null, strokeWidth: 0, fill: { rgba: [0, 0, 1, 1] }, ...style }, ...extra });
const image = (points) => ({ type: 'image', closed: true, src: 'data:image/png;base64,BBBB', points, style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 } });
const rect = (cx, cy, rx, ry, more = {}) => ({ kind: 'rect', cx, cy, rx, ry, angle: 0, ...more });
const frameOf = (cx, cy, h) => frameItem(rect(cx, cy, h, h), [image([cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h])]);
const star = (cx, cy, r) => {
    const points = [];
    for (let k = 0; k < 10; k++) {
        const a = Math.PI/2 + k*Math.PI/5, q = k % 2 ? 0.4*r : r;
        points.push(cx + q*Math.cos(a), cy + q*Math.sin(a));
    }
    return { type: 'polyline', closed: true, points, style: { stroke: null, strokeWidth: 0, fill: RED } };
};

function newEditor(){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}
const select = (editor, ...items) => editor.setSelection(items.map(it => ({ id: it.id, frame: null, frameInv: null })));
const topIds = doc => doc.getItems().map(it => it.id);

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const b = fillBox(square(1, 2, 0.5));
    check(near(b.cx, 1) && near(b.cy, 2) && near(b.ex, 0.5) && near(b.ey, 0.5) && near(b.angle, 0), 'a square, upright');

    const turned = (a) => {
        const c = Math.cos(a), s = Math.sin(a), h = [2, 1];
        const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(q => [3 + c*h[0]*q[0] - s*h[1]*q[1], 4 + s*h[0]*q[0] + c*h[1]*q[1]]);
        return { closed: true, points, axes: [c, s, -s, c] };
    };
    let t = fillBox(turned(0.5));
    check(near(t.angle, 0.5) && near(t.ex, 2) && near(t.ey, 1), 'a box turned a little turns the fill');
    check(near(t.cx, 3) && near(t.cy, 4), 'around the outline');
    t = fillBox(turned(Math.PI));
    check(near(t.angle, 0, 1e-9) && near(t.ex, 2) && near(t.ey, 1), 'a box turned half way leaves the fill upright');
    t = fillBox(turned(Math.PI/2));
    check(near(t.angle, 0, 1e-9) && near(t.ex, 1) && near(t.ey, 2), 'a quarter turn too, its sizes swapped');
    t = fillBox(turned(Math.PI/2 + 0.3));
    check(near(t.angle, 0.3), 'past a quarter turn the rest of the turn');

    const shape = fillBox({ closed: true, points: turned(0.2).points, shape: { angle: 0.2 } });
    check(near(shape.angle, 0.2) && near(shape.ex, 2), 'a shape with no box of its own: its angle');

    const sheared = fillBox({ closed: true, points: [0, 0, 2, 0, 3, 1, 1, 1], axes: [1, 0, 0.7, 0.7] });
    check(near(sheared.angle, 0) && near(sheared.ex, 1.5) && near(sheared.ey, 0.5), 'a skew: along the first axis');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const inside = (x, y, q) => {
        // the quad's own coordinates, 0 to 1
        const ax = q[2] - q[0], ay = q[3] - q[1], bx = q[6] - q[0], by = q[7] - q[1], det = ax*by - ay*bx;
        const u = ((x - q[0])*by - (y - q[1])*bx)/det, v = (ax*(y - q[1]) - ay*(x - q[0]))/det;
        return u > -1e-9 && u < 1 + 1e-9 && v > -1e-9 && v < 1 + 1e-9;
    };
    for (const [name, item] of Object.entries({
        star:   star(0.3, -0.2, 0.7),
        turned: { ...star(1, 1, 0.5), axes: [Math.cos(0.4), Math.sin(0.4), -Math.sin(0.4), Math.cos(0.4)] },
        wide:   { closed: true, points: [-3, -0.1, 3, -0.1, 3, 0.1, -3, 0.1] },
        tall:   { closed: true, points: [-0.1, -3, 0.1, -3, 0.1, 3, -0.1, 3] },
    })) for (const [w, h] of [[400, 100], [100, 400], [64, 64]]) {
        const box = fillBox(item);
        const q = imageCovering(image([0, 0, 1, 0, 1, 1, 0, 1]), w, h, box).points;
        const top = Math.hypot(q[2] - q[0], q[3] - q[1]), side = Math.hypot(q[6] - q[0], q[7] - q[1]);
        check(near(top/side, w/h, 1e-9), `${name} ${w}x${h}: unstretched`);
        check(near(0.5*(q[0] + q[4]), box.cx) && near(0.5*(q[1] + q[5]), box.cy), `${name} ${w}x${h}: centred`);
        check(near(Math.atan2(q[3] - q[1], q[2] - q[0]), box.angle), `${name} ${w}x${h}: turned with the box`);
        for (let i = 0; i + 1 < item.points.length; i += 2) check(inside(item.points[i], item.points[i + 1], q), `${name} ${w}x${h}: covers point ${i/2}`);
        check(near(top, 2*box.ex) || near(side, 2*box.ey), `${name} ${w}x${h}: tight on one side`);
    }
    const map = fillMap({ cx: 1, cy: 2, ex: 1, ey: 1, angle: Math.PI/2 }, 2, 1);
    const p = map([2, 0]);
    check(near(p[0], 1) && near(p[1], 4), 'fillMap turns, and scales to the larger need');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const shape = doc.insertItem(square(0, 0, 1));
    const open = doc.insertItem({ type: 'polyline', closed: false, points: [0, 0, 1, 1], style: { stroke: RED, strokeWidth: 0.1 } });
    const group = doc.insertItem({ type: 'group', children: [square(3, 3, 1), square(5, 5, 1)] });
    const frame = doc.insertItem(frameOf(7, 7, 1));
    const held = doc.getItem(frame.id).children[0];
    select(editor, shape, open, group, frame);
    check(editor.getFillableItems().map(it => it.id).join() === [shape.id, frame.id].join(), 'closed shapes and frames; no open line, no group');
    select(editor, doc.getItem(held.id));
    check(editor.getFillableItems().length === 0, 'not an image');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const a = doc.insertItem(star(0, 0, 1));
    const id = a.id, blob = new Blob(['x'], { type: 'image/png' });
    select(editor, a);
    check(await editor.fillWithImage(blob, 'one.png') === true, 'filled');
    let item = doc.getItem(id);
    check(item.children.length === 1 && item.children[0].type === 'image', 'the star holds a bare image');
    check(item.children[0].id, 'with an id');
    check(item.style.fill === RED || item.style.fill.rgba[0] === 1, 'its solid fill stays');
    const q = item.children[0].points, side = Math.hypot(q[6] - q[0], q[7] - q[1]);
    check(near(Math.hypot(q[2] - q[0], q[3] - q[1])/side, 4), 'unstretched: 400 by 100');
    const imageId = item.children[0].id;

    // an edit of the image inside, undone over the fill's undo and redo
    const moved = { ...doc.getItem(imageId), points: q.map(v => v + 0.1) };
    const before = new Map([[imageId, doc.getItem(imageId)]]), after = new Map([[imageId, moved]]);
    editor.applyReplace(after);
    editor.pushReplace('move', before, after);
    editor.undo(); editor.undo();
    check(!doc.getItem(id).children, 'undo: no fill');
    editor.redo(); editor.redo();
    check(near(doc.getItem(imageId).points[0], q[0] + 0.1), 'redo: the edit inside finds its image');

    select(editor, doc.getItem(id));
    await editor.fillWithImage(blob, 'two.png');
    check(doc.getItem(id).children.length === 1 && doc.getItem(id).children[0].id !== imageId, 'a new fill replaces the old one');
    editor.undo();
    check(doc.getItem(imageId), 'and undo brings it back');

    const b = doc.insertItem(square(4, 0, 1)), c = doc.insertItem(square(8, 0, 1));
    select(editor, b, c);
    await editor.fillWithImage(blob, 'many.png');
    const kids = [b, c].map(s => doc.getItem(s.id).children[0]);
    check(kids[0].id && kids[1].id && kids[0].id !== kids[1].id, 'several shapes: an image of its own each');
    check(near(0.5*(kids[1].points[0] + kids[1].points[4]), 8), 'each over its own shape');
    editor.undo();
    check(!doc.getItem(b.id).children && !doc.getItem(c.id).children, 'one undo step');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    // an image put over a star goes into the star, whichever was picked first
    for (const first of [0, 1]) {
        const { doc, editor } = newEditor();
        const s = doc.insertItem(star(0, 0, 1)), f = doc.insertItem(frameOf(0.2, 0, 0.5));
        const points = doc.getItem(f.id).points.slice(), order = topIds(doc);
        select(editor, ...(first ? [f, s] : [s, f]));
        check(editor.canSelectionAsFill(), 'can');
        editor.selectionAsFill();
        check(topIds(doc).join() === s.id, 'the frame left the layer');
        const held = doc.getItem(s.id).children;
        check(held.length === 1 && held[0].id === f.id, 'it is in the star, with its id');
        check(held[0].points.every((v, i) => near(v, points[i])), 'where it was seen');
        check(editor.getSelection().length === 1 && editor.getSelection()[0].id === s.id, 'the star selected');
        editor.undo();
        check(topIds(doc).join() === order.join() && !doc.getItem(s.id).children, 'undo');
        check(doc.getItem(f.id).children.length === 1, 'the frame whole');
        editor.redo();
        check(topIds(doc).join() === s.id && doc.getItem(s.id).children[0].id === f.id, 'redo');
    }

    const { doc, editor } = newEditor();
    // on top of what it holds; the topmost that paints takes the rest, in the order they stood
    const low = doc.insertItem(square(0, 0, 1)), mid = doc.insertItem(frameOf(0, 0, 0.5)), high = doc.insertItem(square(0, 0, 0.8));
    const had = doc.insertItem(square(0, 0, 0.1), null, null, high.id);
    select(editor, high, low, mid);
    editor.selectionAsFill();
    check(doc.getItem(high.id).children.map(c => c.id).join() === [had.id, low.id, mid.id].join(), 'the topmost painting shape, on top of what it held, in their order');
    editor.undo();
    check(topIds(doc).join() === [low.id, mid.id, high.id].join(), 'undo puts them back in order');

    const two = newEditor();
    const f1 = two.doc.insertItem(frameOf(0, 0, 1)), f2 = two.doc.insertItem(frameOf(0, 0, 0.5));
    select(two.editor, f1, f2);
    two.editor.selectionAsFill();
    check(topIds(two.doc).join() === f2.id, 'none paints: the topmost frame takes it');

    const three = newEditor();
    const shape = three.doc.insertItem(square(0, 0, 1)), g = three.doc.insertItem({ type: 'group', children: [square(0, 0, 0.3), square(1, 0, 0.3)] });
    const tile = three.doc.insertItem(square(2, 0, 1, {}, { tile: { edges: [] } }));
    select(three.editor, shape);
    check(!three.editor.canSelectionAsFill(), 'one item: nothing to do');
    select(three.editor, g, three.doc.getItem(g.id).children[0]);
    check(!three.editor.canSelectionAsFill(), 'no closed shape takes it: a group is none, nor its own member');
    select(three.editor, shape, g);
    three.editor.selectionAsFill();
    check(three.doc.getItem(shape.id).children[0].type === 'group' && three.doc.getItem(shape.id).children[0].children.length === 2, 'a group goes in as one');
    select(three.editor, three.doc.getItem(shape.id), three.doc.getItem(g.id));
    check(!three.editor.canSelectionAsFill(), 'what it holds already stays');
    const low2 = three.doc.insertItem(frameOf(0, 0, 0.5));
    select(three.editor, tile, low2);
    three.editor.selectionAsFill();
    check(three.doc.getItem(tile.id).children[0].id === low2.id, 'a tile takes a fill');
    const other = three.doc.insertItem(frameOf(0, 0, 0.5));
    three.doc.insertItem(frameOf(0, 0, 0.2));
    select(three.editor, other, three.doc.getItem(shape.id), three.doc.getItem(tile.id));
    three.editor.selectionAsFill();
    check(!!three.doc.findItem(tile.id) && three.doc.findItem(tile.id).parentId === null, 'and goes into nothing');
}

{
    // across layers: the upper layer's shape takes the lower one's image
    const { doc, editor } = newEditor();
    const below = doc.getActiveLayer().getId();
    const f = doc.insertItem(frameOf(0, 0, 1), below);
    const shape = doc.insertItem(square(0, 0, 2), below);
    select(editor, f, shape);
    check(editor.canSelectionAsFill(), 'can');

    // inside a group: the group stays round the shape, the image leaves the layer
    const held = doc.insertItem({ type: 'group', children: [square(5, 5, 1), square(7, 7, 1)] });
    const member = doc.getItem(held.id).children[0];
    const f2 = doc.insertItem(frameOf(5, 5, 1));
    select(editor, doc.getItem(member.id), f2);
    editor.selectionAsFill();
    check(doc.getItem(member.id).children[0].id === f2.id && doc.findItem(member.id).parentId === held.id, 'the shape stays in its group');
    check(doc.getItem(held.id).points.length > 0, 'the group has its box');
    editor.undo();
    check(!doc.getItem(member.id).children && doc.findItem(f2.id).parentId === null, 'undo');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const s = doc.insertItem(star(0, 0, 1)), f = doc.insertItem(frameOf(3, 0, 1)), under = doc.insertItem(square(3, 3, 1));
    await (select(editor, s), editor.fillWithImage(new Blob(['x'], { type: 'image/png' }), 'a.png'));
    const held = doc.getItem(s.id).children[0].id;
    const order = topIds(doc);
    select(editor, doc.getItem(s.id), doc.getItem(f.id), doc.getItem(under.id));
    editor.removeFill();
    check(!doc.getItem(s.id).children && !doc.getItem(held), 'the star stays, its image gone');
    check(!doc.getItem(f.id), 'a frame painting nothing goes');
    check(doc.getItem(under.id), 'one that holds nothing stays');
    check(editor.getSelection().map(e => e.id).join() === [s.id, under.id].join(), 'what stays stays selected');
    editor.undo();
    check(topIds(doc).join() === order.join() && doc.getItem(held) && doc.getItem(f.id).children.length === 1, 'undo');
    editor.redo();
    check(!doc.getItem(f.id) && !doc.getItem(held), 'redo');

    const { doc: doc2, editor: editor2 } = newEditor();
    const plain = doc2.insertItem(square(0, 0, 1));
    select(editor2, plain);
    const steps = editor2.canUndo();
    editor2.removeFill();
    check(editor2.canUndo() === steps, 'nothing to remove: no undo step');
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
