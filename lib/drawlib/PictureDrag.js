import {
    hitsPolyline,
    itemBridges,
    itemCopy,
    pictureShifted,
} from './modules.js';

//
//  PictureDrag - Alt+drag inside a frame moves the picture it holds, the
//  frame staying where it is (the select and node tools share it)
//
//  The press: Alt inside a selected frame's outline (on the copy it was
//  picked on), else on a copy of a frame under the pointer, where its picture
//  shows (that frame selected on that copy; Shift adds it). The drag reads
//  the pointer through the copy's frame, so the picture follows the pointer
//  on that copy; one undo step, "move picture". An Alt+click moves nothing.
//  While it moves the picture's whole quad is outlined (the frame cuts it
//  off). Reset in the picture controls places it again by the fit.
//
//    const drag = PictureDrag(editor);
//    pointerdown:  if (drag.press(e)) ...      the tool's own press otherwise
//    pointermove:  if (drag.move(e)) ...
//    pointerup:    if (drag.release()) ...
//    overlay:      drag.geometry(geo), drag.draw(ctx); drag.cancel()
//

const DRAG_PX = 2;          // a press moving less is a click

function PictureDrag(editor){

    const mDoc = editor.document;
    let mDrag = null;

    /**
     * the frame whose picture the press at the pointer moves: {sel (a
     * selection entry of the frame), select (whether the frame is to be
     * selected)}, or null. Inside an entered frame the picture is hit itself:
     * its frame's picture moves, the selection stays
     */
    function frameUnder(e){
        for (const sel of editor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!item || !item.closed || !editor.heldPicture(sel.id)) continue;
            const x = editor.mapWorld(sel.frame, e.wpnt);
            if (hitsPolyline(x, item.points, true, true, 0, item.style.fillRule, itemBridges(item))) return { sel, select: true };
        }
        const hit = editor.hitTest(e.wpnt, [e.canvasX, e.canvasY]);
        if (!hit) return null;
        if (editor.heldPicture(hit.item.id)) return { sel: { id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }, select: true };
        const parent = hit.parent;
        if (hit.item.type === 'image' && parent && editor.heldPicture(parent.id) === mDoc.getItem(parent.id).children.find(c => c.id === hit.item.id)) {
            return { sel: { id: parent.id, frame: hit.frame, frameInv: hit.frameInv }, select: false };
        }
        return null;
    }

    /** an Alt+press on a frame starts the drag of its picture: true when it did */
    function press(e){
        if (!e.altKey || !e.wpnt) return false;
        const found = frameUnder(e);
        if (!found) return false;
        const pic = found.sel;
        const sel = editor.getSelection();
        if (!found.select) { /* inside the frame: the selection stays */ }
        else if (!editor.isSelected(pic.id)) editor.setSelection(e.shiftKey ? [...sel, pic] : [pic]);
        else if (!sel.some(s => s.id === pic.id && s.frame === pic.frame)) editor.setSelection(sel.map(s => (s.id === pic.id ? pic : s)));
        const before = itemCopy(mDoc.getItem(pic.id));
        mDrag = { sel: pic, start: editor.mapWorld(pic.frame, e.wpnt), before, canvas: [e.canvasX, e.canvasY], moved: false, after: null };
        editor.repaint();
        return true;
    }

    /** the picture follows the pointer: true while a drag goes on */
    function move(e){
        if (!mDrag) return false;
        if (!(e.buttons & 1) || !e.wpnt) return true;
        if (!mDrag.moved && Math.hypot(e.canvasX - mDrag.canvas[0], e.canvasY - mDrag.canvas[1]) < DRAG_PX) return true;
        mDrag.moved = true;
        const x = editor.mapWorld(mDrag.sel.frame, e.wpnt);
        const moved = pictureShifted(mDrag.before, x[0] - mDrag.start[0], x[1] - mDrag.start[1]);
        if (moved) {
            mDrag.after = moved;
            editor.applyReplace(new Map([[mDrag.sel.id, moved]]));
        }
        editor.repaint();
        return true;
    }

    /** the drag ends, an undo step when the picture moved: true when there was one */
    function release(){
        if (!mDrag) return false;
        if (mDrag.moved && mDrag.after) {
            editor.pushReplace('move picture', new Map([[mDrag.sel.id, mDrag.before]]), new Map([[mDrag.sel.id, mDrag.after]]));
        }
        mDrag = null;
        editor.repaint();
        return true;
    }

    /** the picture moving, with its frame's selection entry: {image, sel}, or null */
    function moving(){
        if (!mDrag || !mDrag.moved) return null;
        const image = editor.heldPicture(mDrag.sel.id);
        return image ? { image, sel: mDrag.sel } : null;
    }

    return {
        press,
        move,
        release,
        isActive: () => !!mDrag,
        cancel:   () => { mDrag = null; },
        /** the moving picture's quad, for the GPU overlay */
        geometry(geo){
            const pic = moving();
            if (pic) editor.outlineGeometry(geo, editor.itemWorldPath(pic.image, pic.sel.frameInv));
        },
        /** the same with the 2D canvas */
        draw(ctx){
            const pic = moving();
            if (pic) editor.drawOutline(ctx, editor.itemCanvasPath(pic.image, pic.sel.frameInv));
        },
    };

} // function PictureDrag()

export { PictureDrag };
