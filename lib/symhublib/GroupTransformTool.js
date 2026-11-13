/*
  GroupTransformTool.js — the group transform as a frame round the group's
  fundamental domain, the Symmetry tool's transform handles
  (docs/symmetry_tool_plan.md sections 4 and 15; the math in
  GroupTransformFrame.js). It looks like the other transform boxes, the
  pattern box and the select tool's box (OverlayGeometry's and
  PatternTransformRenderer's transform-box drawing), and its handles do the
  transform's three things and no other:

    the centre   the pivot's mark at the frame's centre c = g(a), a the centre
                 of the domain's box: a drag moves the group
    the corners  black discs: a drag turns and scales the group about c, the
                 corner grabbed following the pointer; Shift turns only, in
                 steps of 15°, Alt scales only

  The frame is the box of the maker's fundamental domain (arg.domainBox: the
  maker's coordinates, before the transform and before the Dirichlet domain;
  GeneratorElements domainBox), MARGIN_PX outside it and MIN_HALF_PX at least
  from the centre to a side, in pixels at the frame's centre, carried to the
  world by the transform g: it turns and scales with the group. A drag carries
  the frame of the press along (as the select tool's box), so the corner
  grabbed stays under the pointer; the margin is the pixels' again after it.
  The frame's inside takes no press: a drag there is the view's.

  Escape during a drag puts the transform back as it was at the press. The
  handles are found by the distance in pixels between the pointer's world
  point and theirs, by the view's scale at the pointer, so they are where the
  picture shows them, the corners before the centre; the GPU editing overlay
  draws them (getOverlayGeometry), the 2D canvas where there is no such pass
  (renderUI).

  Usage (SymRenderer):
    const tool = GroupTransformTool({ config, view, domainBox, canvas, repaint, onChanged });
    tool.setActive(on)        shown and taking events (the Symmetry tool, its toggle on)
    tool.handleEvent(e)       e.canvasX, e.canvasY: canvas pixels; sets e.isConsumed
    tool.handleKey(e)
    tool.getFrame()           the frame now: {anchor, centre, corners, angle, scale}
    tool.getOverlayGeometry()
    tool.renderUI(ctx, canvasTransform)

  config     the stored numbers, symmetry.transform: {translationX, translationY,
             rotation (degrees), scale}; the tool sets them
  view       {toWorld(cpnt) -> [x, y], toCanvas(w) -> [x, y], scaleAt(cpnt): world
             units per canvas pixel}
  domainBox  () -> [x0, y0, x1, y1] or null: the box of the maker's fundamental
             domain in the maker's coordinates; without one (a group with no sides)
             the frame is the box of side 1 round the maker's origin
  inReach    () -> bool, optional: the view shows the world the frame is in (the
             group's); while false the frame is not drawn and takes no press (a drag
             goes on)
  onChanged  called after the tool set the numbers (a step of a drag, an Escape)
*/

import {
    newGeometry,
    transformFrameGeometry,
    transformCornersGeometry,
    transformPivotGeometry,
    drawTransformFrame,
    drawTransformPivot,
    drawTransformCorners,
    groupTransformMaps,
    frameBox,
    transformFrame,
    startFrameDrag,
    frameDragTo,
} from './modules.js';

// the reach of the handles, canvas pixels (the select tool's)
const HANDLE_PX = 10;
// the frame stands this far outside the domain's box (the select tool's box margin)
const MARGIN_PX = 12;
// at least this far from the frame's centre to a side, so the corners stay off the centre
const MIN_HALF_PX = 16;
// the turn's steps with Shift, degrees
const TURN_STEP = 15;
// the frame of a group with no domain: round the maker's origin
const UNIT_BOX = [-0.5, -0.5, 0.5, 0.5];

function isPoint(p) {
    return !!p && isFinite(p[0]) && isFinite(p[1]);
}

export function GroupTransformTool(arg) {

    const cfg = arg.config;
    const view = arg.view;
    const canvas = arg.canvas || null;
    const repaint = arg.repaint || (() => {});
    const onChanged = arg.onChanged || (() => {});
    const inReach = arg.inReach || (() => true);
    const domainBoxOf = arg.domainBox || (() => null);

    let mActive = false;
    let mHover = null;      // 'centre', 'corner' or null
    let mDrag = null;       // the frame's drag (GroupTransformFrame startFrameDrag) and the frame's box at the press
    // the canvas's cursor before the tool set its own, put back after
    let mCursorSaved = false;
    let mSavedCursor = '';

    /** world units per pixel where the world point w shows */
    function pixelSizeAt(w) {
        const cp = view.toCanvas(w);
        const s = isPoint(cp) ? view.scaleAt(cp) : NaN;
        return (s > 0 && isFinite(s)) ? s : view.scaleAt([0, 0]);
    }

    /** the maker's domain's box, or the unit box round the origin */
    function domainBox() {
        let b = null;
        try { b = domainBoxOf(); } catch (e) { b = null; }
        return (b && b.length === 4 && b.every(x => isFinite(x)) && b[0] <= b[2] && b[1] <= b[3]) ? b : UNIT_BOX;
    }

    /** the frame's box in the maker's coordinates: the press's during a drag, else the domain's with the margin in pixels */
    function frameBoxNow() {
        if (mDrag) return mDrag.box;
        const box = domainBox();
        const m = groupTransformMaps(cfg);
        const anchor = [(box[0] + box[2])/2, (box[1] + box[3])/2];
        // the maker's units per pixel at the frame's centre
        const u = pixelSizeAt(m.toWorld(anchor))/(m.scale || 1);
        return frameBox(box, { pad: MARGIN_PX*u, minHalf: MIN_HALF_PX*u });
    }

    /** the frame in the world: {anchor, centre, corners, angle, scale} */
    function frame() {
        return transformFrame(cfg, frameBoxNow());
    }

    /** the handle at the canvas point: a corner first, then the centre */
    function pick(cpnt) {
        if (!inReach()) return null;
        const w = view.toWorld(cpnt);
        if (!isPoint(w)) return null;
        const px = view.scaleAt(cpnt) || 1;
        const f = frame();
        const near = (p) => Math.hypot(p[0] - w[0], p[1] - w[1])/px <= HANDLE_PX;
        if (f.corners.some(near)) return 'corner';
        if (near(f.centre)) return 'centre';
        return null;
    }

    function cursorOf(kind) {
        return kind === 'centre' ? 'move' : kind === 'corner' ? 'pointer' : '';
    }

    function setCursor(c) {
        if (!canvas) return;
        if (c) {
            if (!mCursorSaved) {
                mSavedCursor = canvas.style.cursor || '';
                mCursorSaved = true;
            }
            canvas.style.cursor = c;
        } else if (mCursorSaved) {
            canvas.style.cursor = mSavedCursor;
            mCursorSaved = false;
        }
    }

    function setHover(kind) {
        if (kind === mHover) return;
        mHover = kind;
        setCursor(cursorOf(kind));
        repaint();
    }

    function apply(values) {
        Object.assign(cfg, values);
        onChanged(values);
        repaint();
    }

    function endDrag() {
        mDrag = null;
        setCursor(cursorOf(mHover));
        repaint();
    }

    function handleEvent(e) {
        if (!mActive) return;
        const cpnt = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown': {
            if (e.button !== undefined && e.button !== 0) return;
            const kind = pick(cpnt);
            if (!kind) return;
            const box = frameBoxNow();
            const anchor = [(box[0] + box[2])/2, (box[1] + box[3])/2];
            mDrag = startFrameDrag(cfg, kind, view.toWorld(cpnt), anchor);
            mDrag.box = box;
            mHover = kind;
            setCursor(kind === 'centre' ? 'move' : 'grabbing');
            e.isConsumed = true;
            if (e.preventDefault) e.preventDefault();
            break;
        }
        case 'pointermove':
            if (mDrag) {
                // the press was let go where the canvas did not see it
                if (e.buttons !== undefined && !(e.buttons & 1)) {
                    endDrag();
                    return;
                }
                const w = view.toWorld(cpnt);
                if (isPoint(w)) {
                    apply(frameDragTo(mDrag, w, { turnOnly: !!e.shiftKey, scaleOnly: !!e.altKey, stepDeg: TURN_STEP }));
                }
                e.isConsumed = true;
                if (e.preventDefault) e.preventDefault();
            } else if (!e.buttons) {
                setHover(pick(cpnt));
            }
            break;
        case 'pointerup':
            if (mDrag) {
                endDrag();
                e.isConsumed = true;
            }
            break;
        case 'pointerleave':
        case 'pointerout':
            if (mDrag) endDrag();
            break;
        }
    }

    function handleKey(e) {
        if (!mActive || e.type !== 'keydown' || e.key !== 'Escape' || !mDrag) return;
        const start = mDrag.start;
        mDrag = null;
        apply(start);
        setCursor(cursorOf(mHover));
        e.isConsumed = true;
    }

    // taken up or left with the Symmetry tool or its toggle; left, a drag and the hover end
    function setActive(on) {
        on = !!on;
        if (on === mActive) return;
        mActive = on;
        if (!on) {
            mDrag = null;
            if (mHover) {
                mHover = null;
                setCursor('');
            }
        }
        repaint();
    }

    /** the frame is drawn: the tool is active, and the view shows the frame's world or a drag goes on */
    function isShown() {
        return mActive && (!!mDrag || inReach());
    }

    /** the frame as the GPU editing overlay's geometry (OverlayGeometry.js), world coordinates */
    function getOverlayGeometry() {
        if (!isShown()) return null;
        const f = frame();
        if (!f.corners.every(isPoint) || !isPoint(f.centre)) return null;
        const geo = newGeometry();
        transformFrameGeometry(geo, f.corners);
        transformCornersGeometry(geo, f.corners);
        transformPivotGeometry(geo, f.centre);
        return geo;
    }

    /** the same on the 2D overlay canvas, placed by the canvas transform */
    function renderUI(ctx, canvasTransform) {
        if (!isShown() || !ctx || !canvasTransform) return;
        const f = frame();
        const s = (w) => canvasTransform.world2screen(w);
        const corners = f.corners.map(s);
        const c = s(f.centre);
        if (!corners.every(isPoint) || !isPoint(c)) return;
        drawTransformFrame(ctx, corners);
        drawTransformPivot(ctx, c[0], c[1]);
        drawTransformCorners(ctx, corners);
    }

    return {
        handleEvent,
        handleKey,
        setActive,
        isActive: () => mActive,
        isShown,
        isDragging: () => !!mDrag,
        getHover: () => mHover,
        getFrame: frame,
        getOverlayGeometry,
        renderUI,
    };
}
