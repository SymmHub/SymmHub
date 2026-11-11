/*
 node tests/drawlib/picture_height.mjs

 The height channel of a picture (docs/symdraw_images_ui_plan.md 4.3, phase 5):
  1. the document keeps an image's height and heightScale, drops what is not one
  2. the editor: pictureHeight, setPictureHeight (an undo step per stroke, null removes it),
     the scale (its default half the longer side of the frame, set, typing merged)
  3. editPicture: the owner's hook with the first selected holder; none without one;
     the Edit image button of the picture controls
  4. phase 6: the picture with heights a sprite shows, its scale, the heights sampled for picking
*/

import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { pictureProperties } from '../../lib/drawlib/ToolProperties.js';
import { DrawingCommands } from '../../lib/drawlib/DrawingCommands.js';
import { heightPicture, pictureHeightScaleOf } from '../../lib/drawlib/Frames.js';
import { sampleHeight } from '../../lib/drawlib/ItemRenderer.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const PNG_A = 'data:image/png;base64,AAAA', PNG_B = 'data:image/png;base64,BBBB';

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

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const { doc } = newEditor();
    const img = (extra) => ({ type: 'image', closed: true, src: PNG_A, points: [0, 0, 1, 0, 1, 1, 0, 1], style: {}, ...extra });
    const a = doc.insertItem(img({ height: PNG_B, heightScale: 0.3 }));
    const b = doc.insertItem(img({ height: '', heightScale: -1 }));
    const c = doc.insertItem(img({ height: 5, heightScale: 'x' }));
    // a bare image goes into a frame of its own: its child is the image
    const image = (it) => doc.getItem(it.id).children[0];
    check(image(a).height === PNG_B && image(a).heightScale === 0.3, 'height and heightScale kept');
    check(!('height' in image(b)) && !('heightScale' in image(b)) && !('height' in image(c)) && !('heightScale' in image(c)),
          'an empty or wrong height, a scale not above 0: dropped');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const frame = doc.insertItem(editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 2, ry: 1, angle: 0 }, { src: PNG_A, size: [200, 100] }, 'cover'));
    const id = frame.id;
    check(editor.pictureHeight(id) === null, 'no height at first');
    check(near(editor.pictureHeightScale(id), 2), `the scale by default: half the longer side, ${editor.pictureHeightScale(id)}`);
    check(editor.pictureHeight('nothing') === null && editor.pictureHeightScale('nothing') === null && !editor.setPictureHeight('nothing', PNG_A), 'no such holder');
    check(editor.setPictureHeight(id, PNG_A) && editor.pictureHeight(id) === PNG_A, 'a stroke sets it');
    check(doc.getItem(id).children[0].height === PNG_A && doc.getItem(id).children[0].src === PNG_A, 'on the image item, the picture kept');
    check(!editor.setPictureHeight(id, PNG_A), 'the same again: no step');
    editor.setPictureHeight(id, PNG_B);
    editor.undo();
    check(editor.pictureHeight(id) === PNG_A, 'undo: the stroke before');
    editor.undo();
    check(editor.pictureHeight(id) === null && !('height' in doc.getItem(id).children[0]), 'undo: none again');
    editor.redo(); editor.redo();
    check(editor.pictureHeight(id) === PNG_B, 'redo twice');
    editor.setPictureHeight(id, null);
    check(!('height' in doc.getItem(id).children[0]), 'null removes it (a cleared channel)');
    // the scale, typed: merged
    editor.setPictureHeightScale(id, 0.5);
    editor.setPictureHeightScale(id, 0.55);
    check(editor.pictureHeightScale(id) === 0.55, 'the scale set');
    check(!editor.setPictureHeightScale(id, 0) && !editor.setPictureHeightScale(id, -1), 'not 0 or below');
    editor.undo();
    check(near(editor.pictureHeightScale(id), 2), 'typing the scale: one undo step, the default back');
    // the frame's place is kept by a height stroke
    const before = JSON.stringify(doc.getItem(id).children[0].points);
    editor.setPictureHeight(id, PNG_A);
    check(JSON.stringify(doc.getItem(id).children[0].points) === before && doc.getItem(id).shape.rx === 2, 'a stroke moves nothing');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const asked = [];
    const { doc, editor } = newEditor({ editPicture: (holderId) => asked.push(holderId) });
    const frame = doc.insertItem(editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 1, ry: 1, angle: 0 }, { src: PNG_A, size: [10, 10] }, 'cover'));
    const square = doc.insertItem({ type: 'polyline', closed: true, points: [3, 0, 4, 0, 4, 1, 3, 1], style: {} });
    check(!editor.canEditPicture() && !editor.editPicture() && asked.length === 0, 'nothing selected: no editor');
    editor.setSelection([{ id: square.id, frame: null, frameInv: null }]);
    check(!editor.canEditPicture(), 'a shape without a picture: none');
    editor.setSelection([{ id: square.id, frame: null, frameInv: null }, { id: frame.id, frame: null, frameInv: null }]);
    check(editor.canEditPicture() && editor.editPicture() && asked.join() === frame.id, 'the holder among the selection');
    const rows = pictureProperties(editor, DrawingCommands(editor));
    const btn = rows.flatMap(r => r.controls || []).find(c => /^Edit image/.test(c.title || ''));
    check(!!btn && btn.visible(), 'the Edit image button shows');
    btn.action();
    check(asked.length === 2, 'and opens it');
    const { editor: bare, doc: d2 } = newEditor();
    const f2 = d2.insertItem(bare.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 1, ry: 1, angle: 0 }, { src: PNG_A, size: [10, 10] }, 'cover'));
    bare.setSelection([{ id: f2.id, frame: null, frameInv: null }]);
    check(!bare.canEditPicture(), 'an owner without the window: no button');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const { doc, editor } = newEditor();
    const frame = doc.insertItem(editor.framedPicture({ kind: 'rect', cx: 0, cy: 0, rx: 3, ry: 1, angle: 0 }, { src: PNG_A, size: [300, 100] }, 'cover'));
    check(heightPicture(doc.getItem(frame.id)) === null, 'no height channel: no height picture');
    editor.setPictureHeight(frame.id, PNG_B);
    const holder = doc.getItem(frame.id);
    const hp = heightPicture(holder);
    check(hp && hp.image === holder.children[0] && hp.holder === holder, 'the frame\'s picture, held by it');
    check(near(pictureHeightScaleOf(hp.image, hp.holder), 3), 'its scale by default: half the longer side');
    editor.setPictureHeightScale(frame.id, 0.25);
    const hp2 = heightPicture(doc.getItem(frame.id));
    check(pictureHeightScaleOf(hp2.image, hp2.holder) === 0.25 && editor.pictureHeightScale(frame.id) === 0.25, 'its own scale, the editor\'s the same');
    // in a group, the holder is the frame, not the group
    const group = { type: 'group', children: [{ type: 'polyline', points: [], style: {} }, doc.getItem(frame.id)], style: {} };
    check(heightPicture(group)?.holder === doc.getItem(frame.id), 'in a group: the frame holds it');
    check(heightPicture({ ...group, visible: false }) === null, 'a hidden item shows none');
    const bare = { type: 'image', height: PNG_B, points: [0, 0, 4, 0, 4, 2, 0, 2] };
    check(near(pictureHeightScaleOf(bare, null), 2), 'a bare image: half its quad\'s longer side');
    // the values sampled as the texture is: between pixels' centres, clamped at the edges, 0 off the image
    const values = { data: new Uint8Array([0, 255, 0, 255]), width: 2, height: 2 };
    check(sampleHeight(values, 0.25, 0.5) === 0 && sampleHeight(values, 0.75, 0.5) === 1, 'pixel centres');
    check(near(sampleHeight(values, 0.5, 0.5), 0.5) && sampleHeight(values, 0, 0) === 0 && sampleHeight(values, 1, 1) === 1, 'between them, and at the edges');
    check(sampleHeight(values, 1.01, 0.5) === 0 && sampleHeight(values, 0.5, -0.1) === 0 && sampleHeight(null, 0.5, 0.5) === 0, 'off the image, or while it decodes: 0');
}

console.log(failed ? `${failed} failed` : 'all passed');
