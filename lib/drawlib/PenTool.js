//
//  PenTool - draws paths of Bezier curves (Paths.js) node by node, in world
//  coordinates
//
//  A SymRenderer pattern tool (pattern.createUITool), as PolylineTool.
//    click            a corner node (snapped to the vertices of all copies,
//                     to mirrors and cone points)
//    drag             a smooth node: the drag pulls its handles out, the
//                     curve follows
//    click the first node   close the path (filled with 'fill closed')
//    double click     finish the path (Enter too)
//    Backspace        remove the last node
//    Escape           drop the path
//    Ctrl+Z, Ctrl+Y   undo, redo
//  Wheel and other unused events fall through to the navigator. A path of
//  corner nodes only is a polyline.
//

import {
    flattenNodes,
    withNodes,
} from './modules.js';

const ICON = new URL('./res/btn_pen.svg', import.meta.url).pathname;
const DRAG_PX = 4;              // a press moving further pulls the node's handles out
const CLOSE_PX = 8;             // reach of the first node for closing
const SAME_PX = 1;              // a click this close to the last node adds none

function PenTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    let mNodes = [];        // the nodes drawn so far, world coordinates
    let mHover = null;      // world point under the pointer, snapped
    let mSnapTarget = null;
    let mPress = null;      // {canvas, index} while the button is down on the node just added

    function isDrawing(){
        return mNodes.length > 0;
    }

    /** the point the pointer stands for: snapped */
    function constrain(w){
        mSnapTarget = null;
        const target = mEditor.snap(w);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    function nearFirst(canvas){
        if (mNodes.length < 3) return false;
        const c0 = mView.toCanvas(mNodes[0].p);
        return Math.hypot(canvas[0] - c0[0], canvas[1] - c0[1]) <= CLOSE_PX;
    }

    /** a corner node at w, unless the last node is there already; returns the node's index */
    function addNode(w, canvas){
        if (mNodes.length) {
            const a = mView.toCanvas(mNodes[mNodes.length - 1].p);
            if (Math.hypot(a[0] - canvas[0], a[1] - canvas[1]) <= SAME_PX) return mNodes.length - 1;
        }
        mNodes.push({ p: [w[0], w[1]], h1: null, h2: null });
        return mNodes.length - 1;
    }

    function finish(closed = false){
        const nodes = mNodes;
        mNodes = [];
        mPress = null;
        mSnapTarget = null;
        if (nodes.length >= 2 && !(closed && nodes.length < 3)) {
            const base = { closed, style: mEditor.getStyle() };
            if (nodes.some(n => n.h1 || n.h2)) mEditor.addItem(withNodes({ ...base, type: 'path' }, nodes));
            else mEditor.addItem({ ...base, type: 'polyline', points: nodes.flatMap(n => n.p) });
        }
        mRepaint();
    }

    function cancel(){
        mNodes = [];
        mPress = null;
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
            if (nearFirst(canvas)) { finish(true); break; }
            mPress = { canvas, index: addNode(constrain(e.wpnt), canvas) };
            mRepaint();
            break;
        case 'pointermove':
            if (mPress && (e.buttons & 1)) {
                e.isConsumed = true;
                if (Math.hypot(canvas[0] - mPress.canvas[0], canvas[1] - mPress.canvas[1]) > DRAG_PX) {
                    // the handles of the node pressed, pulled out symmetrically
                    const n = mNodes[mPress.index];
                    n.h2 = [e.wpnt[0], e.wpnt[1]];
                    n.h1 = [2*n.p[0] - e.wpnt[0], 2*n.p[1] - e.wpnt[1]];
                    n.smooth = true;
                    mRepaint();
                }
            } else {
                mHover = constrain(e.wpnt);
                mRepaint();
            }
            break;
        case 'pointerup':
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            mPress = null;
            mRepaint();
            break;
        case 'dblclick':
            if (isDrawing()) {
                e.preventDefault();
                e.isConsumed = true;
                finish(false);
            }
            break;
        case 'pointerleave':
            mHover = null;
            mSnapTarget = null;
            mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (!isDrawing()) {
            if (mEditor.handleCommonKey(e)) e.isConsumed = true;
            return;
        }
        switch (e.key) {
        case 'Enter':     finish(false); e.isConsumed = true; break;
        case 'Escape':    cancel(); e.isConsumed = true; break;
        case 'Backspace': mNodes.pop(); mRepaint(); e.isConsumed = true; break;
        default: break;
        }
    }

    /** world points as canvas points, the steps between them subdivided where the view bends them */
    function canvasPath(flat){
        const sub = mView.isLinear() ? 1 : 4;
        const out = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
            if (i > 0 && sub > 1) {
                const ax = flat[i - 2], ay = flat[i - 1], bx = flat[i], by = flat[i + 1];
                for (let k = 1; k < sub; k++) out.push(mView.toCanvas([ax + (bx - ax)*k/sub, ay + (by - ay)*k/sub]));
            }
            out.push(mView.toCanvas([flat[i], flat[i + 1]]));
        }
        return out;
    }

    //
    //  the path being drawn, the next segment to the pointer, the nodes and
    //  the handles of the last node, on the 2D overlay
    //
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mNodes.length) {
            const preview = (mHover && !mPress) ? [...mNodes, { p: mHover, h1: null, h2: null }] : mNodes;
            mEditor.drawOutline(ctx, canvasPath(flattenNodes(preview, false)));
            mNodes.forEach((n, i) => mEditor.drawHandle(ctx, mView.toCanvas(n.p), i === mNodes.length - 1, !!n.smooth));
            const last = mNodes[mNodes.length - 1];
            const c = mView.toCanvas(last.p);
            for (const h of [last.h1, last.h2]) if (h) mEditor.drawControlHandle(ctx, c, mView.toCanvas(h));
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'pen',
        title:     'pen: click adds a corner node (snapped to the copies), drag pulls its handles out (a smooth node), click the first node closes, double click or Enter ends, Backspace removes the last node, Escape drops',
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) cancel(); },
    };

} // function PenTool()

export { PenTool };
