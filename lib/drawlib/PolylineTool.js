//
//  PolylineTool - draws polylines into the drawing, in world coordinates
//
//  A SymRenderer pattern tool (pattern.createUITool): it receives the pointer
//  events with e.wpnt (the world point under the pointer) and the keys.
//    click            add a vertex (snapped to the vertices of all copies,
//                     to mirrors and cone points; Shift: 15 degree steps)
//    click the first vertex   close the polyline (filled with 'fill closed')
//    drag             draw a freehand line
//    double click     finish the polyline (Enter too)
//    Backspace        remove the last vertex
//    Escape           drop the polyline
//    Ctrl+Z, Ctrl+Y   undo, redo
//  Wheel and other unused events fall through to the navigator.
//

const ICON = new URL('./res/btn_polyline.svg', import.meta.url).pathname;
const DRAG_PX = 4;              // a press moving further draws freehand
const SIMPLIFY_PX = 0.5;        // tolerance of the freehand line, canvas pixels
const CLOSE_PX = 8;             // reach of the first vertex for closing
const SAME_PX = 1;              // a click this close to the last vertex adds none
const ANGLE_STEP = Math.PI/12;  // Shift: 15 degrees

/** Ramer-Douglas-Peucker on canvas points: the indices kept */
function simplify(pts, tol){
    const n = pts.length;
    if (n <= 2) return pts.map((p, i) => i);
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const [ax, ay] = pts[a], [bx, by] = pts[b];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        let best = -1, bestD = tol;
        for (let i = a + 1; i < b; i++) {
            const d = len > 0 ? Math.abs((pts[i][0] - ax)*dy - (pts[i][1] - ay)*dx)/len
                              : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
            if (d > bestD) { bestD = d; best = i; }
        }
        if (best >= 0) {
            keep[best] = 1;
            stack.push([a, best], [best, b]);
        }
    }
    const out = [];
    keep.forEach((k, i) => { if (k) out.push(i); });
    return out;
}

function PolylineTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    let mPoints = [];       // [x, y] world points of the polyline drawn by clicks
    let mHover = null;      // world point under the pointer, snapped
    let mSnapTarget = null;
    let mPress = null;      // {canvas, wpnt} while the button is down
    let mFreehand = null;   // world points of a freehand line, with their canvas points

    function isDrawing(){
        return mPoints.length > 0 || !!mFreehand;
    }

    /** the point the pointer stands for: snapped, or on a 15 degree ray with Shift */
    function constrain(w, canvas, shift){
        mSnapTarget = null;
        if (shift && mPoints.length) {
            const c0 = mView.toCanvas(mPoints[mPoints.length - 1]);
            const dx = canvas[0] - c0[0], dy = canvas[1] - c0[1];
            const a = Math.round(Math.atan2(dy, dx)/ANGLE_STEP)*ANGLE_STEP;
            const r = Math.hypot(dx, dy);
            return mView.toWorld([c0[0] + r*Math.cos(a), c0[1] + r*Math.sin(a)]).pnt;
        }
        const target = mEditor.snap(w);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    function nearFirst(canvas){
        if (mPoints.length < 3) return false;
        const c0 = mView.toCanvas(mPoints[0]);
        return Math.hypot(canvas[0] - c0[0], canvas[1] - c0[1]) <= CLOSE_PX;
    }

    function addVertex(w){
        if (mPoints.length) {
            const a = mView.toCanvas(mPoints[mPoints.length - 1]), b = mView.toCanvas(w);
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= SAME_PX) return;
        }
        mPoints.push([w[0], w[1]]);
    }

    function finish(closed = false){
        if (mPoints.length >= 2) {
            mEditor.addItem({ type: 'polyline', closed: closed && mPoints.length >= 3, points: mPoints.flat(),
                              style: mEditor.getStyle() });
        }
        mPoints = [];
        mSnapTarget = null;
        mRepaint();
    }

    function cancel(){
        mPoints = [];
        mFreehand = null;
        mPress = null;
        mSnapTarget = null;
        mRepaint();
    }

    function finishFreehand(){
        const fh = mFreehand;
        mFreehand = null;
        if (!fh || fh.world.length < 2) return;
        const kept = simplify(fh.canvas, SIMPLIFY_PX);
        if (kept.length < 2) return;
        mEditor.addItem({ type: 'polyline', points: kept.flatMap(i => fh.world[i]), style: mEditor.getStyle() });
    }

    /** the pointer positions of a move, the coalesced ones included, as canvas points */
    function moveCanvasPoints(e){
        const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        const sx = e.offsetX ? e.canvasX/e.offsetX : 1, sy = e.offsetY ? e.canvasY/e.offsetY : 1;
        return list.map(ce => [ce.offsetX*sx, ce.offsetY*sy]);
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown':
            if (e.button !== 0) break;
            mPress = { canvas, wpnt: e.wpnt };
            e.preventDefault();
            e.isConsumed = true;
            break;
        case 'pointermove':
            if (mPress && (e.buttons & 1)) {
                e.isConsumed = true;
                if (!mFreehand && mPoints.length === 0
                    && Math.hypot(canvas[0] - mPress.canvas[0], canvas[1] - mPress.canvas[1]) > DRAG_PX) {
                    const w0 = constrain(mPress.wpnt, mPress.canvas, false);
                    mFreehand = { world: [w0], canvas: [mView.toCanvas(w0)] };
                }
                if (mFreehand) {
                    for (const c of moveCanvasPoints(e)) {
                        mFreehand.world.push(mView.toWorld(c).pnt);
                        mFreehand.canvas.push(c);
                    }
                    mRepaint();
                }
            } else {
                mHover = constrain(e.wpnt, canvas, e.shiftKey);
                mRepaint();
            }
            break;
        case 'pointerup':
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            if (mFreehand) {
                finishFreehand();
            } else if (nearFirst(canvas)) {
                finish(true);
            } else {
                addVertex(constrain(e.wpnt, canvas, e.shiftKey));
            }
            mPress = null;
            mRepaint();
            break;
        case 'dblclick':
            if (mPoints.length) {
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
        case 'Backspace': mPoints.pop(); mRepaint(); e.isConsumed = true; break;
        default: break;
        }
    }

    /** a world polyline as canvas points, segments subdivided where the view bends them */
    function canvasPath(world){
        const sub = mView.isLinear() ? 1 : 8;
        const out = [];
        for (let i = 0; i < world.length; i++) {
            if (i > 0 && sub > 1) {
                const [ax, ay] = world[i - 1], [bx, by] = world[i];
                for (let k = 1; k < sub; k++) out.push(mView.toCanvas([ax + (bx - ax)*k/sub, ay + (by - ay)*k/sub]));
            }
            out.push(mView.toCanvas(world[i]));
        }
        return out;
    }

    //
    //  the line being drawn and the snap target, on the 2D overlay
    //
    function renderUI(ctx){
        if (mFreehand) {
            mEditor.drawOutline(ctx, mFreehand.canvas);
        } else if (mPoints.length) {
            const pts = mHover ? [...mPoints, mHover] : mPoints;
            mEditor.drawOutline(ctx, canvasPath(pts));
            mPoints.forEach((p, i) => mEditor.drawHandle(ctx, mView.toCanvas(p), i === 0 && mHover && nearFirst(mView.toCanvas(mHover)), true));
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'polyline',
        title:     'polyline: click adds a vertex (snapped to the copies), drag draws freehand, double click or Enter ends, click the first vertex closes, Shift 15 degree steps, Escape drops',
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) cancel(); },
    };

} // function PolylineTool()

export { PolylineTool };
