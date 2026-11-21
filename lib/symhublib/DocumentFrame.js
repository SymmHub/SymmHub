/*
  DocumentFrame.js — the document view's frame on the canvas
  (docs/document_view_plan.md 3.7, phase 4).

  The frame is the rectangle the canvas shows at the document view, in the plane
  of the canvas transform (DocumentView.js framePoint). A view is the canvas part
  alone (the transforms are the document's content, the same in the document view
  and on the canvas), so the frame is a rectangle on the canvas under any Moebius
  transform, sphere view or conformal maps. It is shown while its toggle in the
  Orientation bar is on, in every tool: drawn on the 2D overlay with the outside
  dimmed, and in the Orientation tool edited by its handles: the sides and the
  centre move it, the corners resize it (the opposite corner stays; Shift keeps
  its shape), the round handle beyond the top side turns it about its centre
  (Shift: 15 degree steps). A gesture is one undo step (onDocumentViewSet).

  createDocumentFrame(nav) takes the navigator (InversiveNavigator): its document
  view, canvas transform and canvas, informListener and onDocumentViewSet.
*/

import {
    frameSize,
    framePoint,
    frameCorners,
    FRAME_CORNERS,
    movedFrame,
    resizedFrame,
    turnedFrame,
    normalAngle,
    sameViewValue,
} from './modules.js';

// sizes in CSS pixels
const CORNER_HALF   = 4.5;  // half the side of a corner's square
const TURN_OFFSET   = 22;   // the turn handle beyond the middle of the top side
const TURN_RADIUS   = 5;
const SIDE_BAND     = 5;    // either side of a side: the side moves the frame
const CENTRE_ARM    = 7;    // the centre's cross
const PICK_MARGIN   = 3;    // a handle taken this far outside its mark
const MIN_SIDE_PX   = 8;    // the smallest side a corner leaves
const TURN_STEP     = 15;   // degrees, with Shift

const DIM    = 'rgba(0, 0, 0, 0.35)';
const LINE   = '#1c1c1c';
const HALO   = 'rgba(255, 255, 255, 0.9)';
const ACCENT = '#1f6fd0';

export function createDocumentFrame(nav) {

    let mShown = false;
    let mDrag  = null;      // a gesture: {hit, start (the document view at the press), press (world)}

    // canvas pixels a CSS pixel
    function cssK(evt) {
        if (evt && evt.offsetX) return evt.canvasX/evt.offsetX;
        const c = nav.canvas;
        return (c && c.clientWidth) ? c.width/c.clientWidth : 1;
    }

    // the frame on the canvas, canvas pixels: corners, centre, the top side's middle, the turn handle
    function screenFrame(k) {
        const dv = nav.getDocumentView();
        const e = dv.view.euclidean;
        if (!e || !(e.zoom > 0)) return null;
        const T = nav.canvasTransform;
        const corners = frameCorners(e, dv.aspect).map(p => T.world2screen(p));
        const centre = T.world2screen([e.centerX, e.centerY]);
        const top = T.world2screen(framePoint(e, dv.aspect, 0, 1));
        const dx = top[0] - centre[0], dy = top[1] - centre[1];
        const L = Math.hypot(dx, dy) || 1;
        const turn = [top[0] + dx/L*TURN_OFFSET*k, top[1] + dy/L*TURN_OFFSET*k];
        return { dv, e, corners, centre, top, turn };
    }

    function polygon(ctx, pts) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
    }

    //
    //  the frame on the 2D overlay: the outside dimmed, the outline; editable (the
    //  Orientation tool): the handles
    //
    function render(ctx, editable) {
        if (!mShown) return;
        const k = cssK();
        const f = screenFrame(k);
        if (!f) return;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        polygon(ctx, f.corners);
        ctx.fillStyle = DIM;
        ctx.fill('evenodd');
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        polygon(ctx, f.corners);
        ctx.lineWidth = 3.5*k; ctx.strokeStyle = HALO; ctx.stroke();
        ctx.lineWidth = 1.5*k; ctx.strokeStyle = LINE; ctx.stroke();
        if (editable) {
            // the turn handle on a stalk from the top side
            ctx.beginPath();
            ctx.moveTo(f.top[0], f.top[1]); ctx.lineTo(f.turn[0], f.turn[1]);
            ctx.lineWidth = 3*k; ctx.strokeStyle = HALO; ctx.stroke();
            ctx.lineWidth = 1.2*k; ctx.strokeStyle = LINE; ctx.stroke();
            ctx.beginPath(); ctx.arc(f.turn[0], f.turn[1], TURN_RADIUS*k, 0, 2*Math.PI);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.lineWidth = 1.5*k; ctx.strokeStyle = ACCENT; ctx.stroke();
            // the corners: squares along the frame's sides
            const r = CORNER_HALF*k;
            const a = Math.atan2(f.corners[1][1] - f.corners[0][1], f.corners[1][0] - f.corners[0][0]);
            for (const c of f.corners) {
                ctx.save();
                ctx.translate(c[0], c[1]); ctx.rotate(a);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(-r, -r, 2*r, 2*r);
                ctx.lineWidth = 1.5*k; ctx.strokeStyle = ACCENT; ctx.strokeRect(-r, -r, 2*r, 2*r);
                ctx.restore();
            }
            // the centre: a cross
            const s = CENTRE_ARM*k;
            ctx.beginPath();
            ctx.moveTo(f.centre[0] - s, f.centre[1]); ctx.lineTo(f.centre[0] + s, f.centre[1]);
            ctx.moveTo(f.centre[0], f.centre[1] - s); ctx.lineTo(f.centre[0], f.centre[1] + s);
            ctx.lineWidth = 3.5*k; ctx.strokeStyle = HALO; ctx.stroke();
            ctx.lineWidth = 1.5*k; ctx.strokeStyle = ACCENT; ctx.stroke();
        }
        ctx.restore();
    }

    // the distance from p to the segment ab
    function segmentDistance(p, a, b) {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = dx*dx + dy*dy;
        let t = L > 0 ? ((p[0] - a[0])*dx + (p[1] - a[1])*dy)/L : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - a[0] - t*dx, p[1] - a[1] - t*dy);
    }

    //
    //  the handle at the canvas pixel p: {kind: 'corner', corner: [su, sv]},
    //  {kind: 'turn'}, {kind: 'move'} (a side or the centre), or null
    //
    function hitTest(p, k) {
        const f = screenFrame(k);
        if (!f) return null;
        const d = (q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        for (let i = 0; i < 4; i++) {
            if (d(f.corners[i]) <= (CORNER_HALF + PICK_MARGIN)*k) return { kind: 'corner', corner: FRAME_CORNERS[i], screen: f.corners[i], centre: f.centre };
        }
        if (d(f.turn) <= (TURN_RADIUS + PICK_MARGIN)*k) return { kind: 'turn' };
        if (d(f.centre) <= (CENTRE_ARM + PICK_MARGIN)*k) return { kind: 'move' };
        for (let i = 0; i < 4; i++) {
            if (segmentDistance(p, f.corners[i], f.corners[(i + 1) % 4]) <= SIDE_BAND*k) return { kind: 'move' };
        }
        return null;
    }

    function cursorFor(hit, dragging) {
        if (!hit) return '';
        if (hit.kind === 'move') return 'move';
        if (hit.kind === 'turn') return dragging ? 'grabbing' : 'grab';
        // a corner: the resize cursor along its diagonal on screen (y down)
        const dx = hit.screen[0] - hit.centre[0], dy = hit.screen[1] - hit.centre[1];
        return (dx*dy > 0) ? 'nwse-resize' : 'nesw-resize';
    }

    // the frame's handles take a press in the Orientation tool
    function editable(evt) {
        return mShown && !!evt.navigatorTool;
    }

    //
    //  a press on a handle starts a gesture: true when taken
    //
    function pointerDown(evt) {
        mDrag = null;
        if (evt.button !== 0 || !editable(evt)) return false;
        const p = [evt.canvasX, evt.canvasY];
        const hit = hitTest(p, cssK(evt));
        if (!hit) return false;
        mDrag = { hit, start: nav.getDocumentView(), press: nav.canvasTransform.screen2world(p) };
        evt.frameCursor = cursorFor(hit, true);
        return true;
    }

    //
    //  a move: the gesture's frame (true), or over the handles the cursor
    //  (evt.frameCursor, '' off them; false)
    //
    function pointerMove(evt) {
        if (mDrag) {
            if (!(evt.buttons & 1)) { pointerUp(evt); return true; }
            const T = nav.canvasTransform;
            const p = T.screen2world([evt.canvasX, evt.canvasY]);
            const { hit, start, press } = mDrag;
            const e0 = start.view.euclidean;
            let e = e0, aspect = start.aspect;
            if (hit.kind === 'move') {
                e = movedFrame(e0, [p[0] - press[0], p[1] - press[1]]);
            } else if (hit.kind === 'corner') {
                const minSide = MIN_SIDE_PX*cssK(evt)*T.getPixelSize();
                const r = resizedFrame(e0, aspect, hit.corner, p, !!evt.shiftKey, minSide);
                e = r.euclidean; aspect = r.aspect;
            } else if (hit.kind === 'turn') {
                const c = [e0.centerX, e0.centerY];
                const a0 = Math.atan2(press[1] - c[1], press[0] - c[0]);
                const a1 = Math.atan2(p[1] - c[1], p[0] - c[0]);
                e = turnedFrame(e0, (a1 - a0)*180/Math.PI, evt.shiftKey ? TURN_STEP : 0);
            }
            nav.setDocumentView({ view: { ...start.view, euclidean: e }, aspect });
            evt.frameCursor = cursorFor(hit, true);
            nav.informListener();
            return true;
        }
        if (!evt.buttons && evt.navigatorTool) {
            evt.frameCursor = editable(evt) ? cursorFor(hitTest([evt.canvasX, evt.canvasY], cssK(evt)), false) : '';
        }
        return false;
    }

    // the gesture's end: one undo step when the frame changed; true when one was going on
    function pointerUp(evt) {
        if (!mDrag) return false;
        const { start } = mDrag;
        mDrag = null;
        const after = nav.getDocumentView();
        if (!sameViewValue(start, after) && nav.onDocumentViewSet) nav.onDocumentViewSet(start, after);
        if (evt) evt.frameCursor = '';
        nav.informListener();
        return true;
    }

    //
    //  the fields of the bar: the frame's centre, width and height (world units of
    //  the canvas's plane) and angle (degrees)
    //
    function values() {
        const dv = nav.getDocumentView();
        const e = dv.view.euclidean || {};
        if (!(e.zoom > 0)) return { x: 0, y: 0, width: 0, height: 0, angle: 0 };
        const [w, h] = frameSize(e, dv.aspect);
        return { x: e.centerX, y: e.centerY, width: w, height: h, angle: e.angle || 0 };
    }

    // a field set: the document view changed, one undo step
    function setValue(key, value) {
        value = Number(value);
        if (!Number.isFinite(value)) return;
        const before = nav.getDocumentView();
        const e0 = before.view.euclidean;
        if (!e0 || !(e0.zoom > 0)) return;
        const [w0, h0] = frameSize(e0, before.aspect);
        let e = { ...e0 }, aspect = before.aspect;
        switch (key) {
        case 'x':      e.centerX = value; break;
        case 'y':      e.centerY = value; break;
        case 'width':  if (!(value > 0)) return; e.zoom = 2/value; aspect = h0/value; break;
        case 'height': if (!(value > 0)) return; aspect = value/w0; break;
        case 'angle':  e.angle = normalAngle(value); break;
        default: return;
        }
        const after = { view: { ...before.view, euclidean: e }, aspect };
        if (sameViewValue(before, after)) return;
        nav.setDocumentView(after);
        // the keystrokes of a number typed, the steps of its arrows: one undo step
        // (the stack joins the entries of a merge key)
        if (nav.onDocumentViewSet) nav.onDocumentViewSet(before, after, 'document frame ' + key);
        nav.informListener();
    }

    return {
        isShown:    () => mShown,
        setShown:   (v) => { mShown = !!v; if (!mShown) mDrag = null; },
        isDragging: () => !!mDrag,
        render,
        hitTest:    (p, k = cssK()) => hitTest(p, k),
        pointerDown,
        pointerMove,
        pointerUp,
        values,
        setValue,
    };
}
