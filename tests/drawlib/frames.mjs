/*
  tests of frames, an image or an SVG as an object (lib/drawlib/Frames.js)

    node tests/drawlib/frames.mjs

  1. framedImage: the frame's outline is the image's quad, straight, turned, sheared and
     mirrored; the frame takes the image's place (id, pivot, axes, opacity, colour word)
  2. withImagesFramed: an image on its own, in a group; what has none stays the same object
  3. coverQuad: same centre, the new image's proportions, the old quad covered; itemCopy
  4. DrawingDocument: an image on a layer or in a group is framed, in a closed item it is
     not; older documents through fromJSON and through a layer's items param; itemChain;
     a group's box follows a child that changed; an old colour class (motifClass) is dropped
  5. DrawingEditor (no group, no colour layers: hitTopmost): a frame is picked by its
     content; levels entered one within the other, Escape a level at a time, entering a
     sibling; children cut off at every outline around them; what goes where while inside
  6. Release: a frame goes, a shape that paints stays, opacity and colours kept, an image
     back in a whole frame; undo and redo
  7. the style settings on a frame: a stroke brings no fill; opacity; the next shape keeps
     its stroke after a frame was selected
*/

import { framedImage, withImagesFramed, frameItem } from '../../lib/drawlib/Frames.js';
import { coverQuad, itemCopy } from '../../lib/drawlib/ImageItems.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// a parallelogram as an image's quad: top-left corner o, top edge a, left edge (down the image) b
function quad(o, a, b){
    return [o[0] + b[0], o[1] + b[1], o[0] + a[0] + b[0], o[1] + a[1] + b[1], o[0] + a[0], o[1] + a[1], o[0], o[1]];
}
const corners = p => [0, 2, 4, 6].map(i => [p[i], p[i + 1]]);
const sameCorners = (p, q) => corners(p).every(a => corners(q).some(b => near(a[0], b[0], 1e-9) && near(a[1], b[1], 1e-9)));

const image = (points, extra = {}) => ({ type: 'image', closed: true, src: null, points, style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 }, ...extra });
const square = (cx, cy, h, style = {}) => ({ type: 'polyline', closed: true, points: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
                                             style: { stroke: null, strokeWidth: 0, fill: { rgba: [0, 0, 1, 1] }, ...style } });
const rect = (cx, cy, rx, ry) => ({ kind: 'rect', cx, cy, rx, ry, angle: 0 });

// 1 ───────────────────────────────────────────────────────────────────────────

const quads = {
    straight: quad([-1, 1], [2, 0], [0, -1]),
    turned:   quad([0.3, -0.2], [Math.cos(0.7), Math.sin(0.7)], [Math.sin(0.7), -Math.cos(0.7)]),
    scaled:   quad([5, 7], [0.01, 0], [0, -0.02]),
    sheared:  quad([0, 0], [1, 0.4], [0.6, -1]),
    mirrored: quad([1, 1], [-2, 0], [0, -1]),
};
for (const [name, p] of Object.entries(quads)) {
    const frame = framedImage(image(p));
    check(frame.shape && frame.shape.kind === 'rect' && frame.closed, `${name}: a closed rect`);
    check(sameCorners(frame.points, p), `${name}: the outline ${frame.points} is the quad ${p}`);
    check(frame.children.length === 1 && frame.children[0].points === p, `${name}: the quad is the child's`);
    check(!frame.style.fill && !frame.style.stroke, `${name}: paints nothing`);
}
check(framedImage(image(quads.sheared)).shape.skew, 'a sheared quad gives a skew');

{
    const frame = framedImage(image(quads.straight, { id: 'p9', pivot: [1, 2], axes: [0, 1, -1, 0], colorWord: 'aB',
                                                      style: { stroke: null, fill: null, strokeWidth: 0, opacity: 0.4 } }));
    const child = frame.children[0];
    check(frame.id === 'p9' && !child.id, 'the frame takes the id');
    check(frame.pivot && !child.pivot && frame.axes && !child.axes, 'the frame takes the pivot and the axes');
    check(frame.colorWord === 'aB' && !child.colorWord, 'the frame takes the colour word');
    check(frame.style.opacity === 0.4 && child.style.opacity === 1, 'the frame takes the opacity');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const plain = square(0, 0, 1);
    check(withImagesFramed(plain) === plain, 'a shape stays the same object');
    const held = frameItem(rect(0, 0, 1, 1), [image(quads.straight)]);
    check(withImagesFramed(held) === held, 'an image in a frame stays');
    const group = { type: 'group', children: [plain, image(quads.straight), { type: 'group', children: [image(quads.turned)] }] };
    const out = withImagesFramed(group);
    check(out.children[0] === plain && out.children[1].children && out.children[2].children[0].children, 'the images of a group are framed, nested too');
    const none = { type: 'group', children: [plain] };
    check(withImagesFramed(none) === none, 'a group without images stays the same object');
}

// 3 ───────────────────────────────────────────────────────────────────────────

for (const [name, p] of Object.entries({ straight: quads.straight, turned: quads.turned })) {
    const edge = (q) => [Math.hypot(q[4] - q[6], q[5] - q[7]), Math.hypot(q[0] - q[6], q[1] - q[7])];
    const [w0, h0] = edge(p);
    for (const [W, H] of [[100, 100], [400, 100], [100, 400], [640, 480]]) {
        const q = coverQuad(p, W, H);
        const [w, h] = edge(q);
        check(near(w/h, W/H, 1e-9), `${name} ${W}x${H}: proportions ${w/h}`);
        check(w >= w0 - 1e-9 && h >= h0 - 1e-9, `${name} ${W}x${H}: covers: ${w} ${h} of ${w0} ${h0}`);
        check(near(w, w0) || near(h, h0), `${name} ${W}x${H}: one way stays: ${w} ${h} of ${w0} ${h0}`);
        check(near(q[0] + q[4], p[0] + p[4]) && near(q[1] + q[5], p[1] + p[5]), `${name} ${W}x${H}: the same centre`);
    }
}
{
    const p = quads.straight, q = coverQuad(p, 2, 1);
    check(sameCorners(p, q), 'the same proportions: the same quad');
}

{
    const frame = framedImage(image(quads.straight, { src: 'data:image/png;base64,AAAA' }));
    const copy = itemCopy(frame);
    check(JSON.stringify(copy) === JSON.stringify(frame), 'a copy is equal');
    copy.children[0].points[0] = 99;
    copy.style.opacity = 0.5;
    check(frame.children[0].points[0] !== 99 && frame.style.opacity === 1, 'a copy is deep');
    check(itemCopy(null) === null && itemCopy(3) === 3, 'plain values stay');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const doc = DrawingDocument();
    const top = doc.insertItem(image(quads.straight, { id: 'pic' }));
    check(top.id === 'pic' && top.children && top.children[0].type === 'image' && top.children[0].id && top.children[0].id !== 'pic', 'on a layer: framed, in its id; the image gets one');
    const held = doc.insertItem(image(quads.turned), null, null, top.id);
    check(held.type === 'image', 'in a frame: an image');
    const group = doc.insertItem({ type: 'group', children: [square(0, 0, 1), square(3, 0, 1)] });
    const inGroup = doc.insertItem(image(quads.straight), null, null, group.id);
    check(inGroup.children, 'in a group: framed');
    check(doc.itemChain(held.id).map(it => it.id).join() === [top.id, held.id].join(), 'the chain down to an item');
    check(doc.itemChain('nothing').length === 0, 'the chain of nothing');

    const box0 = doc.getItem(group.id).points;
    const first = doc.getItem(group.id).children[0];
    doc.updateItem(first.id, { ...first, points: first.points.map(v => v - 5) });
    const box1 = doc.getItem(group.id).points;
    check(box1[0] < box0[0] - 4, `a group's box follows a child: ${box0[0]} to ${box1[0]}`);

    const old = { version: 1, layers: [{ id: 'old', items: [image(quads.sheared, { id: 'o1', pivot: [0, 0] }), square(0, 0, 1)] }] };
    const read = DrawingDocument();
    read.fromJSON(JSON.parse(JSON.stringify(old)));
    const frame = read.getItem('o1');
    check(frame.shape && frame.pivot && sameCorners(frame.points, quads.sheared), 'an older document: an image becomes a frame');
    check(frame.children[0].id, 'its image gets an id');

    const layer = read.getLayers()[0];
    layer.getParams().items.setValue([image(quads.straight, { id: 'o2' })]);
    read.layersChanged();
    check(read.getItem('o2').shape && read.getItem('o2').children[0].id, 'through the items param too');
    const saved = layer.getParams().items.getValue();
    check(saved[0].children[0].type === 'image', 'saved as a frame');

    // a colour class per shape is no longer read (a colour layer's images list says what each coset shows)
    const classed = { version: 1, layers: [{ id: 'old', items: [{ ...square(0, 0, 1), id: 'c1', style: { stroke: null, fill: { rgba: [1, 0, 0, 1] }, opacity: 1, motifClass: 1 } },
                                                                image(quads.straight, { id: 'c2', style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1, motifClass: 2 } })] }] };
    const noClass = DrawingDocument();
    noClass.fromJSON(JSON.parse(JSON.stringify(classed)));
    check(!('motifClass' in noClass.getItem('c1').style), 'an old colour class is dropped');
    check(!('motifClass' in noClass.getItem('c2').style) && !('motifClass' in noClass.getItem('c2').children[0].style), 'from a framed image too');
    check(!JSON.stringify(noClass.getLayers()[0].getParams().items.getValue()).includes('motifClass'), 'and not saved');
}

// 5 ───────────────────────────────────────────────────────────────────────────

function newEditor(extra = {}){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
        ...extra,
    });
    return { doc: document, editor };
}

{
    const { doc, editor } = newEditor();
    // a frame over [-1, 1]^2 holding a group of a square that overflows it and another; under it a large square
    const under = doc.insertItem(square(0, 0, 3));
    const a = square(-0.5, 0, 0.8), b = square(0.5, 0.5, 0.2);
    const frame = doc.insertItem(frameItem(rect(0, 0, 1, 1), [{ type: 'group', children: [a, b] }]));
    const group = doc.getItem(frame.id).children[0];
    const [ida, idb] = group.children.map(c => c.id);
    const pick = (x, y) => { const hit = editor.hitTest([x, y], null, 0); return hit ? hit.item.id : null; };
    const path = () => (editor.getContainer() ? editor.getContainer().id : null);

    check(pick(-0.5, 0) === frame.id, 'a frame is picked by what it holds');
    check(pick(0.9, -0.9) === under.id, 'an empty place of a frame passes the click on');
    check(pick(-1.2, 0) === under.id, 'what the frame cuts off is not hit');

    editor.enterContainer(frame.id, null, null);
    check(path() === frame.id, 'in the frame');
    const hit = editor.hitTest([-0.5, 0], null, 0);
    check(hit.item.id === group.id && hit.parent.id === frame.id, 'in the frame the group is picked as a whole');
    check(pick(-1.2, 0) === under.id, 'in the frame: what it cuts off stays out');

    editor.enterContainer(group.id, null, null);
    check(path() === group.id, 'in the group, in the frame');
    const hit2 = editor.hitTest([-0.5, 0], null, 0);
    check(hit2.item.id === ida && hit2.parent.id === group.id, 'in the group its members are picked');
    check(pick(0.5, 0.5) === idb, 'the other one too');
    check(pick(-1.2, 0) === under.id, 'in the group: the frame around it still cuts it off');

    editor.enterContainer(ida, null, null);
    check(path() === ida, 'in a shape, in the group, in the frame');
    const drawn = editor.addItem(square(-0.5, 0, 0.1));
    check(doc.itemChain(drawn.id).map(it => it.id).join() === [frame.id, group.id, ida, drawn.id].join(), 'what is drawn goes in the innermost');
    check(pick(-0.5, 0) === drawn.id, 'it is picked');

    editor.enterContainer(idb, null, null);
    check(path() === idb, 'entering a sibling');
    editor.leaveContainer();
    check(path() === group.id, 'a step out from the sibling: the group');
    editor.leaveContainer();
    check(path() === frame.id, 'the next step: the frame');
    editor.leaveContainer();
    check(path() === null, 'the next: the layer');
    check(pick(-0.5, 0) === frame.id, 'and the frame is picked whole');
    editor.leaveContainer();
    check(path() === null, 'no further');

    editor.enterContainer(frame.id, null, null);
    editor.enterContainer(under.id, null, null);
    check(path() === under.id, 'entering an item outside');
    editor.leaveContainer();
    check(path() === null, 'the frame was left on the way');

    const img = doc.insertItem(image(quads.straight), null, null, frame.id);
    editor.enterContainer(img.id, null, null);
    check(path() === null, 'an image holds nothing');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const below = doc.insertItem(square(0, 0, 3));
    const frame = doc.insertItem(framedImage(image(quads.straight, { id: 'pic' })));
    const above = doc.insertItem(square(0, 0, 0.1));
    const ids = () => doc.getLayers()[0].getItems().map(it => it.id).join();
    const start = ids();
    const cropped = { ...doc.getItem(frame.id), shape: { ...doc.getItem(frame.id).shape, rx: 0.2, ry: 0.2 } };
    doc.updateItem(frame.id, cropped);
    const childId = doc.getItem(frame.id).children[0].id;

    editor.setSelection([{ id: frame.id, frame: null, frameInv: null }]);
    editor.releaseContent();
    const items = doc.getLayers()[0].getItems();
    check(items.length === 3 && items[0].id === below.id && items[2].id === above.id, 'in the frame\'s place');
    check(!doc.getItem(frame.id), 'a frame painting nothing goes');
    const out = items[1];
    check(out.id === childId && out.children && out.children[0].type === 'image', 'an image comes out in a frame of its own, in its id');
    check(sameCorners(out.points, quads.straight), 'the whole image: the crop is gone');
    check(editor.getSelection().map(s => s.id).join() === out.id, 'what came out is selected');

    editor.undo();
    check(ids() === start, 'undo: the frame back in its place');
    check(near(doc.getItem(frame.id).shape.rx, 0.2), 'undo: the crop back');
    check(doc.getItem(frame.id).children[0].id === childId, 'undo: the image back');
    editor.redo();
    check(!doc.getItem(frame.id) && doc.getItem(childId).children, 'redo');
    editor.undo();

    // a shape that paints stays, under what it held; opacity and colours go along
    const painted = doc.insertItem({ ...square(5, 0, 1), colorWord: 'a', style: { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.1, fill: null, opacity: 0.5 },
                                     children: [square(5, 0, 0.5, { opacity: 0.5 }), { type: 'group', style: { opacity: 1 }, children: [square(5, 0, 0.2), square(5, 0, 0.3)] }] });
    const [c0, c1] = doc.getItem(painted.id).children.map(c => c.id);
    editor.setSelection([{ id: painted.id, frame: null, frameInv: null }]);
    editor.releaseContent();
    const list = doc.getLayers()[0].getItems().map(it => it.id);
    check(list.indexOf(painted.id) + 1 === list.indexOf(c0) && list.indexOf(c0) + 1 === list.indexOf(c1), 'a shape that paints stays, under its content');
    check(!doc.getItem(painted.id).children, 'it holds nothing now');
    const r0 = doc.getItem(c0), r1 = doc.getItem(c1);
    check(near(r0.style.opacity, 0.25), `the holder's opacity goes into the content: ${r0.style.opacity}`);
    check(near(r1.style.opacity, 0.5), `a group's too: ${r1.style.opacity}`);
    check(r0.colorWord === 'a', 'its colours too');
    check(r1.children.every(c => c.colorWord === 'a'), 'down to a group\'s members');
    editor.undo();
    check(doc.getItem(painted.id).children.length === 2 && !doc.getItem(painted.id).children[1].children.some(c => c.colorWord), 'undo: the shape holds them again');
    check(doc.getItem(painted.id).style.stroke, 'undo: its stroke');

    // nothing to release
    editor.setSelection([{ id: below.id, frame: null, frameInv: null }]);
    const steps = editor.canUndo();
    editor.releaseContent();
    check(editor.canUndo() === steps && doc.getItem(below.id), 'a shape holding nothing: no step');
    check(editor.getSelectedImage() === null, 'no image selected');
    editor.setSelection([{ id: frame.id, frame: null, frameInv: null }]);
    check(editor.getSelectedImage() && editor.getSelectedImage().type === 'image', 'a frame stands for its only image');
    const inside = doc.getItem(frame.id).children[0].id;
    editor.setSelection([{ id: inside, frame: null, frameInv: null }]);
    check(editor.getSelectedImage().id === inside, 'an image held, selected itself');
}

// 7 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor();
    const cfg = editor.getStyleConfig();
    editor.setStyleValue('filled', true);
    const width = cfg.width;
    const frame = doc.insertItem(framedImage(image(quads.straight)));
    editor.setSelection([{ id: frame.id, frame: null, frameInv: null }]);
    check(cfg.width === width && cfg.filled, 'selecting a frame that paints nothing leaves the next shape\'s style');

    editor.setStyleValue('width', 0.05);
    let style = doc.getItem(frame.id).style;
    check(style.stroke && style.strokeWidth === 0.05, 'a width gives it a stroke');
    check(style.fill === null, 'and no fill');
    check(doc.getItem(frame.id).children[0].type === 'image', 'it keeps its image');

    editor.setStyleValue('filled', false);
    editor.setStyleValue('filled', true);
    style = doc.getItem(frame.id).style;
    check(style.fill && style.stroke, 'a fill goes under it, the stroke stays');

    editor.setOpacity(0.3);
    check(doc.getItem(frame.id).style.opacity === 0.3, 'opacity');
    editor.setOpacity(0.2);
    editor.undo();
    check(doc.getItem(frame.id).style.opacity === 1, 'one undo step per value dragged');

    const { doc: doc2, editor: editor2 } = newEditor();
    const shape = doc2.insertItem(square(0, 0, 1, { stroke: { rgba: [0, 1, 0, 1] }, strokeWidth: 0.2 }));
    editor2.setSelection([{ id: shape.id, frame: null, frameInv: null }]);
    check(editor2.getStyleConfig().width === 0.2, 'a shape that paints shows its style');
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
