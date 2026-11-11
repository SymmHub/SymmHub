//
//  ImageTool - lands frames holding a picture (docs/symdraw_images_ui_plan.md 4.1)
//
//  A SymRenderer pattern tool (pattern.createUITool), as ShapeTool's rect: a
//  drag lands a frame (Frames.js) over the box dragged, holding the tool's
//  picture placed by the tool's fit (cover by default). Until a picture is
//  chosen the picture is a placeholder drawing (ImageItems.placeholderPicture);
//  the property bar's thumbnail opens the image dialog, and the file chosen
//  becomes the picture of the next frames and replaces the pictures of the
//  frames selected (ToolProperties.pictureProperties). The frame landed is
//  selected and the tool stays, so the next drag lands another.
//    drag             the box of a frame, snapped at both corners to the
//                     vertices of all copies; Shift: in the proportions of the
//                     picture, the press corner staying
//    click            a frame or filled shape holding a picture (any copy)
//                     selected, its picture in the bar; elsewhere a frame of
//                     the picture's proportions, DEFAULT_PX on its longer side,
//                     centred at the click
//    Delete           the selection removed
//    Escape           drop the drag, else the selection
//    Ctrl+Z, Ctrl+Y   undo, redo
//  Frames are plain (Euclidean) rects, also while the lines drawn are geodesic.
//  The bar also adds a file as it is, through the image dialog
//  (editor.chooseImport): an image in its own proportions in the shape being
//  edited, else in the pattern box; the shapes of an SVG file, editable.
//

import {
    shapeFromBox,
    snapProperty,
    pictureProperties,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_image.svg', import.meta.url).pathname;
const HELP = 'drag the box of a frame holding the picture (Shift: in its proportions), a click places one; ' +
             'the thumbnail in the bar chooses the picture (and replaces it in the selected frames); click a frame to select it; Escape drops';
// the bar's imports: a picture in a dashed box; a curve with its nodes
const IMPORT_STROKE = 'fill="none" stroke="#303030" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const ICON_IMPORT_IMAGE = `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="none" stroke="#303030" stroke-width="1.2" stroke-dasharray="2 2"/>` +
    `<rect x="5" y="7" width="14" height="10" fill="#7dd3fc" stroke="#303030" stroke-width="1.2"/><path d="M5 15 L9 11 L12 14 L14 12 L19 16" ${IMPORT_STROKE}/></svg>`;
const ICON_IMPORT_SVG = `<svg viewBox="0 0 24 24"><path d="M4 18 C6 6 14 4 20 7" ${IMPORT_STROKE}/>` +
    `<rect x="2.5" y="16.5" width="3" height="3" fill="#fff" stroke="#303030" stroke-width="1.2"/><rect x="18.5" y="5.5" width="3" height="3" fill="#fff" stroke="#303030" stroke-width="1.2"/>` +
    `<text x="13" y="21" font-size="7" font-family="sans-serif" font-weight="bold" fill="#303030" text-anchor="middle">SVG</text></svg>`;
const DRAG_PX = 3;          // a smaller box is a click
const DEFAULT_PX = 160;     // a frame placed by a click: its longer side on the screen

function ImageTool(par) {

    const mEditor = par.editor;
    const mRepaint = mEditor.repaint;
    const mCommands = DrawingCommands(mEditor);

    let mPress = null;      // {canvas, w0, w} while the button is down (w0 snapped)
    let mPreview = null;    // the frame being dragged, an item
    let mSnapTarget = null;

    /** the point the pointer (at the canvas point) stands for: snapped */
    function constrain(w, canvas){
        mSnapTarget = null;
        const target = mEditor.snap(w, null, canvas);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    /** the picture's proportions, width over height */
    function aspect(){
        const [w, h] = mEditor.getImageToolConfig().picture.size;
        return w/Math.max(h, 1e-9);
    }

    /** the frame over the box from the press to w (proportioned: the picture's proportions), as a document item; null for a box too small */
    function frameOver(w, proportioned){
        const [x0, y0] = mPress.w0;
        let [x1, y1] = w;
        if (proportioned) {
            const a = aspect(), dx = x1 - x0, dy = y1 - y0;
            // the larger box of the picture's proportions within the drag
            const sx = Math.max(Math.abs(dx), Math.abs(dy)*a);
            x1 = x0 + Math.sign(dx || 1)*sx;
            y1 = y0 + Math.sign(dy || 1)*sx/a;
        }
        if (mEditor.pxDistance([x0, y0], [x1, y0], mPress.canvas) < DRAG_PX || mEditor.pxDistance([x0, y0], [x0, y1], mPress.canvas) < DRAG_PX) return null;
        return mEditor.document.normalizeItem(mEditor.framedPicture(shapeFromBox('rect', x0, y0, x1, y1, { round: 0 })));
    }

    /** a frame of the picture's proportions, DEFAULT_PX on its longer side on the screen, centred at w */
    function frameAt(w, canvas){
        const unit = mEditor.pxDistance(w, [w[0] + 1, w[1]], canvas);
        const half = 0.5*DEFAULT_PX/Math.max(unit, 1e-12), a = aspect();
        const hx = a >= 1 ? half : half*a, hy = a >= 1 ? half/a : half;
        return mEditor.framedPicture(shapeFromBox('rect', w[0] - hx, w[1] - hy, w[0] + hx, w[1] + hy, { round: 0 }));
    }

    /** a holder of a picture under w selected on that copy: true, else false */
    function pick(w, canvas){
        const hit = mEditor.hitTest(w, canvas);
        if (!hit || !hit.item.children || !hit.item.children.some(c => c.type === 'image')) return false;
        mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        return true;
    }

    /** the frame added, selected (on the copy of the container being edited, if any) */
    function add(item){
        const it = mEditor.addItem(item);
        const c = mEditor.getContainer();
        mEditor.setSelection([{ id: it.id, frame: c ? c.frame : null, frameInv: c ? c.frameInv : null }]);
    }

    /** the release at w: the frame dragged added, else a click's pick or a frame at the click */
    function release(w, shift){
        const item = frameOver(w, shift);
        if (item) add(item);
        else if (!pick(mPress.w, mPress.canvas)) add(frameAt(mPress.w0, mPress.canvas));
    }

    function cancel(){
        mPress = null;
        mPreview = null;
        mSnapTarget = null;
        mRepaint();
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown':
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            mPress = { canvas, w0: constrain(e.wpnt, canvas), w: e.wpnt };
            mPreview = null;
            mRepaint();
            break;
        case 'pointermove':
            if (mPress && (e.buttons & 1)) {
                e.isConsumed = true;
                mPreview = frameOver(constrain(e.wpnt, canvas), e.shiftKey);
            } else {
                constrain(e.wpnt, canvas);
            }
            mRepaint();
            break;
        case 'pointerup':
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            release(constrain(e.wpnt, canvas), e.shiftKey);
            cancel();
            break;
        case 'pointerleave':
            mSnapTarget = null;
            mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (e.key === 'Escape') {
            if (mPress) cancel();
            else if (mEditor.getSelection().length) mEditor.clearSelection();
            else return;
            e.isConsumed = true;
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !mPress && mEditor.getSelection().length) {
            mEditor.removeItems(mEditor.getSelection().map(s => s.id));
            e.isConsumed = true;
            return;
        }
        if (mEditor.handleCommonKey(e)) e.isConsumed = true;
    }

    /** the frame being dragged, else the selection's outlines, in world coordinates for the GPU pass */
    function getOverlayGeometry(){
        const geo = mEditor.newGeometry();
        mEditor.containerGeometry(geo);
        if (mPreview) mEditor.outlineGeometry(geo, mEditor.itemWorldPath(mPreview, null));
        else {
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.outlineGeometry(geo, mEditor.itemWorldPath(item, sel.frameInv));
            }
        }
        mEditor.snapGeometry(geo, mSnapTarget);
        return geo;
    }

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mPreview) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(mPreview, null));
        else {
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            }
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'image',
        label:     'Image',
        key:       'G',
        group:     'shapes',
        title:     'image: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        getOverlayGeometry,
        // the picture's controls last: its thumbnail ends them on a line of its own
        getProperties: () => [
            { kind: 'group', title: 'add a file as it is', controls: [
                { kind: 'button', icon: ICON_IMPORT_IMAGE,
                  title: 'Add an image file in its own proportions into the shape being edited, else into the pattern box (an SVG as a picture): the image dialog opens',
                  action: () => mEditor.chooseImport('image') },
                { kind: 'button', icon: ICON_IMPORT_SVG,
                  title: 'Add the shapes of an SVG file, editable, in a frame over its viewport, into the pattern box (a picture of it if it has none): the image dialog opens',
                  action: () => mEditor.chooseImport('svg') },
            ] },
            snapProperty(mEditor),
            ...pictureProperties(mEditor, mCommands, true),
        ],
        setActive: (active) => { if (!active) cancel(); },
    };

} // function ImageTool()

export { ImageTool };
