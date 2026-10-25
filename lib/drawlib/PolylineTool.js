//
//  PolylineTool - draws polylines into a DrawingDocument, in world coordinates
//
//  A SymRenderer pattern tool (pattern.createUITool): it receives the pointer
//  events with e.wpnt (the world point under the pointer) and the keys.
//    click            add a vertex
//    double click     finish the polyline (Enter too)
//    Backspace        remove the last vertex
//    Escape           drop the polyline
//  Wheel and other unused events fall through to the navigator.
//

const ICON = new URL('./res/btn_polyline.svg', import.meta.url).pathname;
const SAME_POINT = 1.e-9;

function PolylineTool(par) {

    const mDocument = par.document;
    const mRepaint = par.repaint || (() => {});
    const mGetStyle = par.getStyle || (() => ({}));

    let mPoints = [];       // [x, y] in world coordinates
    let mHover = null;      // world point under the pointer

    function isDrawing(){
        return mPoints.length > 0;
    }

    function finish(){
        // a double click adds its point twice
        while (mPoints.length >= 2) {
            const a = mPoints[mPoints.length - 1], b = mPoints[mPoints.length - 2];
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) > SAME_POINT) break;
            mPoints.pop();
        }
        if (mPoints.length >= 2) {
            mDocument.addItem({ type: 'polyline', points: mPoints.flat(), style: mGetStyle() });
        }
        mPoints = [];
        mRepaint();
    }

    function cancel(){
        if (!isDrawing()) return;
        mPoints = [];
        mRepaint();
    }

    function handleEvent(e){
        switch (e.type) {
        case 'pointerdown':
            if (e.button === 0 && e.wpnt) {
                mPoints.push([e.wpnt[0], e.wpnt[1]]);
                e.preventDefault();
                e.isConsumed = true;
                mRepaint();
            }
            break;
        case 'pointermove':
            if (e.wpnt) {
                mHover = [e.wpnt[0], e.wpnt[1]];
                if (isDrawing()) mRepaint();
            }
            break;
        case 'dblclick':
            if (isDrawing()) {
                e.preventDefault();
                e.isConsumed = true;
                finish();
            }
            break;
        case 'pointerleave':
            mHover = null;
            if (isDrawing()) mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown' || !isDrawing()) return;
        switch (e.key) {
        case 'Enter':     finish();  e.isConsumed = true; break;
        case 'Escape':    cancel();  e.isConsumed = true; break;
        case 'Backspace': mPoints.pop(); mRepaint(); e.isConsumed = true; break;
        default: break;
        }
    }

    //
    //  the polyline being drawn, on the 2D overlay in canvas pixels
    //
    function renderUI(ctx, canvasTransform){
        if (!isDrawing()) return;
        const pts = mHover ? [...mPoints, mHover] : mPoints;
        const px = pts.map(p => canvasTransform.transform(p, [0, 0]));
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const [width, color] of [[4, 'rgba(255,255,255,0.8)'], [1.5, 'rgba(20,20,20,0.9)']]) {
            ctx.beginPath();
            px.forEach(([x, y], i) => (i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
            ctx.lineWidth = width;
            ctx.strokeStyle = color;
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(20,20,20,0.9)';
        px.slice(0, mPoints.length).forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2*Math.PI);
            ctx.fill();
        });
        ctx.restore();
    }

    return {
        name:      'polyline',
        title:     'polyline: click adds a vertex, double click or Enter ends, Escape drops',
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) cancel(); },
    };

} // function PolylineTool()

export { PolylineTool };
