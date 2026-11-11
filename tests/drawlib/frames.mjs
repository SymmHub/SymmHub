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
  8. frameAxes, the transform box of a frame without axes of its own: along the picture's
     bottom edge (turned, sheared, mirrored, turned by a map), a frame of an SVG along its
     rect, none for what is not a frame; the box's w and h along those axes: a turned
     picture measured along its sides, a typed width stretches it along its side unsheared
  9. the picture in its holder: placedPicture by cover, fit and stretch, in a turned and a
     skewed box; pictureOrientation snapped, orientedBy flips and turns; the editor's
     placePicture (fit mode kept on the frame, flips and turns about the box, a reset after a
     move inside, a star's fill, one undo step each); size and fit kept by the document
 10. the Image tool: framedPicture (the placeholder, a chosen picture, the tool's fit); a
     drag lands a frame over the box, Shift in the picture's proportions, a click places one
     of the picture's proportions or selects a frame; the placeholder flag kept by the
     document and dropped by a replace; Escape, Delete, undo
*/

import { framedImage, withImagesFramed, frameItem, frameAxes, holderBox, pictureOrientation, orientedBy, placedPicture, holderFit } from '../../lib/drawlib/Frames.js';
import { mappedItem } from '../../lib/drawlib/Paths.js';
import { boxProperties } from '../../lib/drawlib/ToolProperties.js';
import { coverQuad, itemCopy } from '../../lib/drawlib/ImageItems.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { ImageTool } from '../../lib/drawlib/ImageTool.js';
import { placeholderPicture } from '../../lib/drawlib/ImageItems.js';

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

// 8 ───────────────────────────────────────────────────────────────────────────
{
    const deg = Math.PI/180;
    const turnedQuad = (t, w = 2, h = 1) => {
        const c = Math.cos(t), s = Math.sin(t);
        const at = (x, y) => [c*x - s*y, s*x + c*y];
        return [...at(-w, -h), ...at(w, -h), ...at(w, h), ...at(-w, h)];
    };
    const axesNear = (a, t, what) => check(near(a[0], Math.cos(t), 1e-9) && near(a[1], Math.sin(t), 1e-9) &&
                                           near(a[2], -Math.sin(t), 1e-9) && near(a[3], Math.cos(t), 1e-9), what + ': ' + a.map(x => x.toFixed(4)));

    axesNear(frameAxes(framedImage(image(turnedQuad(0)))), 0, 'a straight picture: the world axes');
    axesNear(frameAxes(framedImage(image(turnedQuad(30*deg)))), 30*deg, 'a picture turned by 30 degrees');
    axesNear(frameAxes(framedImage(image(turnedQuad(-135*deg)))), -135*deg, 'a picture turned by -135 degrees');
    // sheared: along the bottom edge, the second axis square to it
    axesNear(frameAxes(framedImage(image([0, 0, 2, 0, 3, 1, 1, 1]))), 0, 'a sheared picture: along its bottom edge');
    // mirrored (its top-left where the top-right would be): a box all the same, along the bottom edge
    const mirrored = frameAxes(framedImage(image([0, 0, -2, 0, -2, 1, 0, 1])));
    axesNear(mirrored, Math.PI, 'a mirrored picture: along its bottom edge, which runs to the left');
    check(mirrored[0]*mirrored[3] - mirrored[1]*mirrored[2] > 0, 'the axes of a mirrored picture keep their hand');

    // the box follows the picture under maps that set no axes: a turn by 45 degrees, a flip
    const frame = framedImage(image(turnedQuad(0)));
    const turn = (t) => p => [Math.cos(t)*p[0] - Math.sin(t)*p[1], Math.sin(t)*p[0] + Math.cos(t)*p[1]];
    const turned = mappedItem(frame, turn(45*deg));
    check(!turned.axes, 'a turn sets no axes of the item');
    axesNear(frameAxes(turned), 45*deg, 'a frame turned by 45 degrees: its box too');
    axesNear(frameAxes(mappedItem(turned, p => [-p[0], p[1]])), 135*deg, 'flipped across y: along the bottom edge of the picture');

    // an SVG's frame (no image): along its rect
    const svg = frameItem({ kind: 'rect', cx: 0, cy: 0, rx: 1, ry: 0.5, angle: 20*deg }, [square(0, 0, 0.2)]);
    axesNear(frameAxes(svg), 20*deg, 'an SVG frame: along its rect');
    check(frameAxes(square(0, 0, 1)) === null, 'a shape that holds nothing is not a frame');
    check(frameAxes(null) === null, 'nothing');

    // the box's numbers along the axes of a picture turned by 30 degrees
    const { doc, editor } = newEditor();
    const t = 30*deg;
    const fr = doc.insertItem(framedImage(image(turnedQuad(t), { src: 'data:image/png;base64,AAAA' })));
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    const getAxes = () => frameAxes(doc.getItem(fr.id));
    const fields = Object.fromEntries(boxProperties(editor, getAxes).map(f => [f.label, f]));
    check(near(fields.w.get(), 4, 1e-9) && near(fields.h.get(), 2, 1e-9), `w, h along the picture's sides: ${fields.w.get()}, ${fields.h.get()}`);
    check(near(fields.x.get(), 0, 1e-9) && near(fields.y.get(), 0, 1e-9), 'x, y the centre');
    fields.w.set(6);
    let it = doc.getItem(fr.id), q = it.children[0].points;
    const len = (i, j) => Math.hypot(q[j] - q[i], q[j + 1] - q[i + 1]);
    check(near(len(0, 2), 6, 1e-9) && near(len(0, 6), 2, 1e-9), `a typed width stretches along the bottom edge: ${len(0, 2)}, ${len(0, 6)}`);
    const dot = (q[2] - q[0])*(q[6] - q[0]) + (q[3] - q[1])*(q[7] - q[1]);
    check(near(dot, 0, 1e-9), 'not sheared');
    axesNear(frameAxes(it), t, 'the turn stays');
    check(near(fields.w.get(), 6, 1e-9), 'the field reads what was typed');
    fields.h.set(3);
    it = doc.getItem(fr.id); q = it.children[0].points;
    check(near(len(0, 6), 3, 1e-9) && near(len(0, 2), 6, 1e-9), 'a typed height along the left edge');
    fields.x.set(1);
    check(near(fields.x.get(), 1, 1e-9) && near(fields.y.get(), 0, 1e-9), 'x moves along the world x');
    // without axes the world's, as before
    const plain = Object.fromEntries(boxProperties(editor).map(f => [f.label, f]));
    const c = Math.cos(t), sn = Math.sin(t);
    check(near(plain.w.get(), 2*(6/2*c + 3/2*sn), 1e-9), `without axes: the world box, ${plain.w.get()}`);
}

// 9 ───────────────────────────────────────────────────────────────────────────
{
    const deg = Math.PI/180;
    const pts = (q) => [0, 2, 4, 6].map(i => [q[i], q[i + 1]]);
    const quadNear = (a, b, what, eps = 1e-9) => check(a.length === b.length && a.every((v, i) => near(v, b[i], eps)), what + ': ' + a.map(v => v.toFixed(4)).join(' ') + ' vs ' + b.map(v => v.toFixed(4)).join(' '));
    const side = (q, i, j) => Math.hypot(q[j] - q[i], q[j + 1] - q[i + 1]);
    // a box 4 by 2 (half 2, 1), straight; a picture of 300 by 300 pixels
    const box = { kind: 'rect', cx: 0, cy: 0, rx: 2, ry: 1, angle: 0 };
    quadNear(placedPicture(box, 300, 300, 'cover'), [-2, -2, 2, -2, 2, 2, -2, 2], 'cover: a square over a 4 by 2 box is 4 by 4');
    quadNear(placedPicture(box, 300, 300, 'fit'), [-1, -1, 1, -1, 1, 1, -1, 1], 'fit: a square inside a 4 by 2 box is 2 by 2');
    quadNear(placedPicture(box, 300, 300, 'stretch'), [-2, -1, 2, -1, 2, 1, -2, 1], 'stretch: the box');
    // a picture 2:1 turned a quarter left: its width along the box's height
    const left = { right: [0, 1], up: [-1, 0] };
    const q = placedPicture(box, 200, 100, 'fit', left);
    check(near(side(q, 0, 2), 2, 1e-9) && near(side(q, 0, 6), 1, 1e-9), `fit, turned: the 2:1 picture 2 by 1 standing up, ${side(q, 0, 2)}, ${side(q, 0, 6)}`);
    check(near(q[2] - q[0], 0, 1e-9) && q[3] > q[1], 'its bottom edge runs up the box');
    // turned and skewed boxes: stretch lands on the box's corners
    const turned = { kind: 'rect', cx: 1, cy: 2, rx: 2, ry: 1, angle: 30*deg, skew: 0.3 };
    const corners = [[-2, -1], [2, -1], [2, 1], [-2, 1]].flatMap(([x, y]) => { const c = Math.cos(30*deg), sn = Math.sin(30*deg), xs = x + 0.3*y; return [1 + xs*c - y*sn, 2 + xs*sn + y*c]; });
    quadNear(placedPicture(turned, 640, 480, 'stretch'), corners, 'stretch in a turned, skewed box: on its corners');
    // orientation read back, snapped
    for (const o of [{ right: [1, 0], up: [0, 1] }, { right: [-1, 0], up: [0, 1] }, { right: [0, 1], up: [-1, 0] }, { right: [0, -1], up: [-1, 0] }]) {
        const back = pictureOrientation(turned, placedPicture(turned, 300, 200, 'cover', o));
        check(back.right.join() === o.right.join() && back.up.join() === o.up.join(), `orientation read back: ${JSON.stringify(o)} -> ${JSON.stringify(back)}`);
    }
    // a picture turned a little in the box counts as straight
    const tilted = turnedQuadOf(10*deg);
    function turnedQuadOf(t){ const c = Math.cos(t), sn = Math.sin(t); return [[-2, -1], [2, -1], [2, 1], [-2, 1]].flatMap(([x, y]) => [c*x - sn*y, sn*x + c*y]); }
    const o10 = pictureOrientation(box, tilted);
    check(o10.right.join() === '1,0' && o10.up.join() === '0,1', 'turned by 10 degrees: straight');
    // the eight orientations from flips and turns
    const st = { right: [1, 0], up: [0, 1] };
    const seq = (o, ops) => ops.reduce((a, op) => orientedBy(a, op), o);
    check(JSON.stringify(seq(st, ['flipH'])) === JSON.stringify({ right: [-1, 0], up: [0, 1] }), 'flipH');
    check(JSON.stringify(seq(st, ['flipV'])) === JSON.stringify({ right: [1, 0], up: [0, -1] }), 'flipV');
    check(JSON.stringify(seq(st, ['turnLeft', 'turnLeft', 'turnLeft', 'turnLeft'])) === JSON.stringify(st), 'four quarter turns: back');
    check(JSON.stringify(seq(st, ['turnLeft', 'turnRight'])) === JSON.stringify(st), 'left then right: back');
    check(JSON.stringify(seq(st, ['flipH', 'flipV'])) === JSON.stringify(seq(st, ['turnLeft', 'turnLeft'])), 'both flips: a half turn');
    // holderBox: a rect frame's own numbers, a star's fill box
    check(holderBox(frameItem(turned, [])).angle === turned.angle, 'a frame: its rect');
    check(holderFit({}) === 'cover' && holderFit({ fit: 'fit' }) === 'fit' && holderFit({ fit: 'x' }) === 'cover', 'fit modes');

    // the editor
    const { doc, editor } = newEditor();
    const img = (q, extra = {}) => image(q, { src: 'data:image/png;base64,AAAA', size: [200, 100], ...extra });
    const fr = doc.insertItem(frameItem({ kind: 'rect', cx: 0, cy: 0, rx: 1, ry: 1, angle: 0 }, [img([-2, -1, 2, -1, 2, 1, -2, 1])]));
    const pic = () => doc.getItem(fr.id).children[0];
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    check(editor.getPictureHolders().length === 1 && editor.pictureFit() === 'cover', 'a frame holds a picture, cover');
    editor.placePicture('fit');
    check(doc.getItem(fr.id).fit === 'fit', 'fit kept on the frame');
    quadNear(pic().points, [-1, -0.5, 1, -0.5, 1, 0.5, -1, 0.5], 'fit: 2 by 1 in the 2 by 2 frame');
    check(pic().size.join() === '200,100' && pic().src === 'data:image/png;base64,AAAA', 'size and source kept');
    editor.placePicture(null, 'turnLeft');
    let o = pictureOrientation(holderBox(doc.getItem(fr.id)), pic().points);
    check(o.right.join() === '0,1' && o.up.join() === '-1,0', 'turned left in the frame');
    check(near(side(pic().points, 0, 2), 2, 1e-9) && near(side(pic().points, 0, 6), 1, 1e-9), 'still fit, standing up: 2 by 1');
    editor.placePicture(null, 'flipH');
    o = pictureOrientation(holderBox(doc.getItem(fr.id)), pic().points);
    check(o.right.join() === '0,1' && o.up.join() === '1,0', `then flipped left to right: the up turned over, ${JSON.stringify(o)}`);
    editor.placePicture('stretch');
    quadNear(pic().points.map(Math.abs), [1, 1, 1, 1, 1, 1, 1, 1], 'stretch: on the frame, flipped and turned');
    o = pictureOrientation(holderBox(doc.getItem(fr.id)), pic().points);
    check(o.right.join() === '0,1' && o.up.join() === '1,0', 'the mode keeps the orientation');
    editor.undo(); editor.undo(); editor.undo();
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    quadNear(pic().points, [-1, -0.5, 1, -0.5, 1, 0.5, -1, 0.5], 'one undo step each');
    editor.undo();
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    check(!doc.getItem(fr.id).fit, 'cover is the default, not written');
    quadNear(pic().points, [-2, -1, 2, -1, 2, 1, -2, 1], 'back to the import');
    // a picture moved inside, reset
    doc.updateItem(fr.id, { ...doc.getItem(fr.id), children: [{ ...pic(), points: pic().points.map((v, i) => v + (i % 2 ? 0.2 : 0.3)) }] });
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    editor.placePicture();
    quadNear(pic().points, [-2, -1, 2, -1, 2, 1, -2, 1], 'reset after a move inside');
    // an older image without its size: the quad's sides
    doc.updateItem(fr.id, { ...doc.getItem(fr.id), children: [{ ...pic(), size: undefined }] });
    editor.setSelection([{ id: fr.id, frame: null, frameInv: null }]);
    editor.placePicture('fit');
    quadNear(pic().points, [-1, -0.5, 1, -0.5, 1, 0.5, -1, 0.5], 'no size kept: the quad gives it');
    check(pic().size && near(pic().size[0]/pic().size[1], 2, 1e-9), 'and it is kept from then on');
    // a star filled with an image
    const star = doc.insertItem({ type: 'polyline', closed: true, points: [0, 3, 1, 1, 3, 0, 1, -1, 0, -3, -1, -1, -3, 0, -1, 1],
                                  style: { stroke: null, fill: { rgba: [1, 0, 0, 1] }, strokeWidth: 0, opacity: 1 },
                                  children: [img([-1, -0.5, 1, -0.5, 1, 0.5, -1, 0.5])] });
    editor.setSelection([{ id: star.id, frame: null, frameInv: null }]);
    editor.placePicture('cover');
    const sq = doc.getItem(star.id).children[0].points;
    check(near(side(sq, 0, 2), 12, 1e-9) && near(side(sq, 0, 6), 6, 1e-9), `a star's fill covers its 6 by 6 box: ${side(sq, 0, 2)} by ${side(sq, 0, 6)}`);
    // groups and shapes without a picture are left alone
    const plain = doc.insertItem(square(5, 5, 1));
    editor.setSelection([{ id: plain.id, frame: null, frameInv: null }]);
    check(editor.getPictureHolders().length === 0 && editor.placePicture('fit') === false && editor.pictureFit() === null, 'nothing to place');
    // the document keeps size and fit
    const json = JSON.parse(JSON.stringify(doc.getItem(fr.id)));
    const { doc: doc2 } = newEditor();
    const back = doc2.insertItem(json);
    check(back.fit === 'fit' && back.children[0].size && back.children[0].size.length === 2, 'size and fit through the document');
}

// 10 ──────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const side = (q, i, j) => Math.hypot(q[j] - q[i], q[j + 1] - q[i + 1]);
    const ph = placeholderPicture();
    check(ph.placeholder && ph.size.join() === '256,192' && ph.src.startsWith('data:image/svg+xml;base64,'), 'the placeholder picture');
    check(editor.getImageToolConfig().picture.placeholder && editor.getImageToolConfig().fit === 'cover', 'the tool starts with the placeholder, cover');

    // framedPicture: a 4 by 2 rect, the placeholder (4:3) covering it
    let fr = editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 2, ry: 1, angle: 0 });
    let im = fr.children[0];
    check(fr.shape.kind === 'rect' && !fr.fit && im.type === 'image' && im.placeholder === true, 'a frame of the placeholder, cover');
    check(near(side(im.points, 0, 2), 4, 1e-9) && near(side(im.points, 0, 6), 3, 1e-9), `covering 4 by 2 with 4:3: 4 by 3, ${side(im.points, 0, 2)} by ${side(im.points, 0, 6)}`);
    editor.setImageToolPicture({ src: 'data:image/png;base64,AAAA', size: [100, 200] });
    editor.setImageToolValue('fit', 'fit');
    fr = editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 2, ry: 1, angle: 0 });
    im = fr.children[0];
    check(fr.fit === 'fit' && !im.placeholder && im.src === 'data:image/png;base64,AAAA', 'a chosen picture, the tool\'s fit');
    check(near(side(im.points, 0, 2), 1, 1e-9) && near(side(im.points, 0, 6), 2, 1e-9), '1:2 fitting 4 by 2: 1 by 2');
    editor.setImageToolPicture(ph);
    editor.setImageToolValue('fit', 'cover');

    // the tool, through pointer events on the identity view (a pixel is 0.001 of a world unit there)
    const tool = ImageTool({ editor });
    const ev = (type, x, y, extra = {}) => { const e = { type, button: 0, buttons: type === 'pointerup' ? 0 : 1, wpnt: [x, y], canvasX: x, canvasY: y, shiftKey: false, preventDefault(){}, ...extra }; tool.handleEvent(e); return e; };
    const items = () => doc.getItems();
    ev('pointerdown', 0, 0); ev('pointermove', 40, 20); ev('pointerup', 40, 20);
    check(items().length === 1, 'a drag lands a frame');
    let f = items()[0];
    check(f.shape.kind === 'rect' && near(2*f.shape.rx, 40, 1e-9) && near(2*f.shape.ry, 20, 1e-9) && near(f.shape.cx, 20, 1e-9), `over the box dragged: ${2*f.shape.rx} by ${2*f.shape.ry}`);
    check(f.children.length === 1 && f.children[0].placeholder === true && f.children[0].size.join() === '256,192', 'holding the placeholder, its size kept');
    check(editor.getSelection().length === 1 && editor.getSelection()[0].id === f.id, 'selected');
    check(editor.getPictureHolders().length === 1, 'a holder of a picture for the bar');
    // Shift: the picture's proportions, 4:3
    // a tall drag: the larger 4:3 box, as high as the drag
    ev('pointerdown', 100, 0); ev('pointerup', 110, 60, { shiftKey: true });
    f = items()[1];
    check(near(2*f.shape.rx, 80, 1e-9) && near(2*f.shape.ry, 60, 1e-9), `Shift: 4:3, ${2*f.shape.rx} by ${2*f.shape.ry}`);
    // a click on a frame selects it, elsewhere places one of the picture's proportions
    ev('pointerdown', 20, 10); ev('pointerup', 20, 10);
    check(items().length === 2 && editor.getSelection()[0].id === items()[0].id, 'a click on a frame selects it');
    ev('pointerdown', 500, 500); ev('pointerup', 500, 500);
    f = items()[2];
    check(items().length === 3 && near(2*f.shape.rx, 0.16, 1e-9) && near(2*f.shape.ry, 0.12, 1e-9) && near(f.shape.cx, 500, 1e-9), `a click elsewhere: 160 by 120 pixels (of 0.001) at the click, ${2*f.shape.rx} by ${2*f.shape.ry}`);
    // the document keeps the placeholder flag; a replace drops it
    check(JSON.parse(JSON.stringify(f)).children[0].placeholder === true, 'the placeholder flag saved');
    editor.setSelection([{ id: f.id, frame: null, frameInv: null }]);
    editor.replacePictures({ src: 'data:image/png;base64,BBBB', size: [300, 100] });
    let g = doc.getItem(f.id).children[0];
    check(!g.placeholder && g.src === 'data:image/png;base64,BBBB' && g.size.join() === '300,100', 'a replace drops the placeholder');
    check(near(side(g.points, 0, 2)/side(g.points, 0, 6), 3, 1e-9), 'the new picture unstretched');
    editor.undo();
    check(doc.getItem(f.id).children[0].placeholder === true, 'undo brings the placeholder back');
    // Escape drops a drag; Delete removes the selection; undo of the landing
    ev('pointerdown', 0, 300); ev('pointermove', 50, 350);
    const esc = { type: 'keydown', key: 'Escape' };
    tool.handleKey(esc);
    ev('pointerup', 50, 350, { buttons: 0 });
    check(items().length === 3 && esc.isConsumed, 'Escape drops the drag');
    editor.setSelection([{ id: f.id, frame: null, frameInv: null }]);
    tool.handleKey({ type: 'keydown', key: 'Delete' });
    check(items().length === 2, 'Delete removes the selection');
    editor.undo(); editor.undo();
    check(items().length === 2 && !doc.getItem(f.id), 'undo: the delete, then the landing');
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
