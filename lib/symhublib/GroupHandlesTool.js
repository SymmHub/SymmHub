/*
  GroupHandlesTool.js — the group maker's handles on the canvas: the Symmetry tool's
  group handles for the makers that list them (getHandles(); the kinds and the
  makers' helpers in lib/grouplib/GroupHandles.js; docs/symmetry_tool_plan.md 5.1):

    point   a disc (a free point) or a diamond (a point along a path): a drag sets
            the maker's values the handle stands for, which the maker makes of the
            pointer's point; Shift: fine, the pointer's move counts a tenth; Escape:
            the values of the press back. Its values show by it while it is hovered
            or dragged
    order   a label with the number at a corner of the domain, moved a little into
            the domain: the wheel over it, a click on its − and + marks (shown while
            it is hovered), the keys - and + (or =) while it is hovered, or a drag up
            and down on it (a step per 20 pixels; Escape puts the number back). A step
            moves the corner: the label stays where it is while the pointer is on it
            (its leader follows the corner) and goes back by its corner when the
            pointer leaves

  The handles are in the maker's coordinates: the group transform g carries them to
  the world (toWorld, fromWorld), the view to the canvas. Points are found by the
  distance in pixels between the pointer's world point and theirs (the view's scale
  at the pointer), the labels by their boxes on the canvas. The GPU editing overlay
  draws the points and the hovered one's guide (getOverlayGeometry), the 2D canvas
  the labels and values (renderText); without the GPU pass all of it goes on the 2D
  canvas (renderUI).

  Usage (SymRenderer, updateGroupUITool):
    const tool = GroupHandlesTool({ getHandles, toWorld, fromWorld, view, canvas,
                                    repaint, inReach, labelsShown });
    tool.setActive(on)        shown and taking events (the Symmetry tool, its group toggle on)
    tool.handleEvent(e)       e.canvasX, e.canvasY: canvas pixels; sets e.isConsumed
    tool.handleKey(e)
    tool.getOverlayGeometry()
    tool.renderText(ctx)
    tool.renderUI(ctx)

  getHandles   () -> the maker's handles, asked anew for every frame and event: they
               follow the maker's values and type
  toWorld, fromWorld   g and its inverse on points [x, y]
  view         {toWorld(cpnt) -> [x, y], toCanvas(w) -> [x, y], scaleAt(cpnt): world
               units per canvas pixel}
  inReach      () -> bool, optional: the view shows the group's world (not the anchored
               world off home); while false nothing is drawn or taken (a drag goes on)
  labelsShown  () -> bool, optional: the view has a single valued map to the canvas
               (no projection maps), so text can be placed; the labels are left out else
*/

import {
    newGeometry,
} from './modules.js';

// the reach of a point handle, canvas pixels
const HANDLE_PX = 10;
// Shift: the pointer's move counts this much
const FINE = 0.1;
// a drag up or down on an order label: a step per this many pixels
const SCRUB_PX = 20;
// the wheel's delta in pixels per step of an order
const WHEEL_STEP = 40;
// the order label: its centre from the corner toward the domain, its box, the marks
const LABEL_OFFSET = 20;
const BOX_H = 18;
const CHAR_W = 7.5;
const BOX_PAD = 9;
const BOX_MIN_W = 20;
const MARK_R = 7.5;
const MARK_GAP = 3;

const ORANGE = [0.86, 0.42, 0.04, 0.95];
const ORANGE_HOT = [1.0, 0.56, 0.0, 1.0];
const ORANGE_FAINT = [0.86, 0.42, 0.04, 0.75];
const WHITE = [1, 1, 1, 0.92];

function css(c) {
    return `rgba(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)}, ${c[3]})`;
}

const finite = (p) => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);

export function GroupHandlesTool(arg) {

    const getHandles = arg.getHandles || (() => []);
    const toWorld = arg.toWorld || ((p) => p);
    const fromWorld = arg.fromWorld || ((w) => w);
    const view = arg.view;
    const canvas = arg.canvas || null;
    const repaint = arg.repaint || (() => {});
    const inReach = arg.inReach || (() => true);
    const labelsShown = arg.labelsShown || (() => true);

    let mActive = false;
    let mHover = null;      // {id, part: 'point' | 'box' | 'minus' | 'plus'}
    let mDrag = null;       // {kind: 'point', id, saved, target, last} or {kind: 'scrub', id, saved, y0, n0}
    // {id, centre}: the label of the order under the pointer stays where it was when the
    // pointer came onto it, while the pointer is on it or scrubs it: a step moves the corner,
    // and the next turn of the wheel or click on a mark finds the label where it was
    let mAnchor = null;
    let mPressed = false;   // the tool took the last press: the click that ends it is the tool's
    let mWheel = 0;         // the wheel's delta since the last step
    let mWarned = false;
    // the canvas's cursor and tooltip before the tool set its own, put back after
    let mCursorSaved = false;
    let mSavedCursor = '';
    let mTitleSaved = false;
    let mSavedTitle = '';

    /** the maker's handles now ([] when it has none or fails) */
    function handles() {
        try {
            return getHandles() || [];
        } catch (err) {
            if (!mWarned) {
                console.warn('GroupHandlesTool: the maker\'s getHandles() failed', err);
                mWarned = true;
            }
            return [];
        }
    }

    function handleById(id) {
        return handles().find((h) => h.id === id) || null;
    }

    function worldAt(cpnt) {
        const w = view.toWorld(cpnt);
        return finite(w) ? w : null;
    }

    /** the canvas point of a point in the maker's coordinates */
    function canvasOf(m) {
        const w = toWorld(m);
        if (!finite(w)) return null;
        const c = view.toCanvas(w);
        return finite(c) ? c : null;
    }

    function atOf(h) {
        const a = h.at ? h.at() : null;
        return finite(a) ? a : null;
    }

    /** an order label's box on the canvas: its centre, size, text, the places of its marks */
    function orderBox(h) {
        const a = atOf(h);
        const c = a && canvasOf(a);
        if (!c) return null;
        let dir = [0, -1];
        let dist = LABEL_OFFSET;
        const t = finite(h.toward) ? canvasOf(h.toward) : null;
        if (t) {
            const dx = t[0] - c[0], dy = t[1] - c[1];
            const len = Math.hypot(dx, dy);
            if (len > 1e-6) {
                dir = [dx/len, dy/len];
                dist = Math.min(LABEL_OFFSET, len/2);
            }
        }
        const text = h.text(h.get());
        const w = Math.max(BOX_MIN_W, text.length*CHAR_W + BOX_PAD);
        const centre = (mAnchor && mAnchor.id === h.id) ? mAnchor.centre : [c[0] + dir[0]*dist, c[1] + dir[1]*dist];
        const mx = w/2 + MARK_GAP + MARK_R;
        return { corner: c, centre, w, h: BOX_H, text,
                 minus: [centre[0] - mx, centre[1]], plus: [centre[0] + mx, centre[1]] };
    }

    /** the part of an order label at the canvas point: its marks (shown while it is hovered), its box */
    function hitOrder(b, cpnt, withMarks) {
        if (withMarks) {
            if (Math.hypot(cpnt[0] - b.minus[0], cpnt[1] - b.minus[1]) <= MARK_R + 2) return 'minus';
            if (Math.hypot(cpnt[0] - b.plus[0], cpnt[1] - b.plus[1]) <= MARK_R + 2) return 'plus';
        }
        if (Math.abs(cpnt[0] - b.centre[0]) <= b.w/2 + 2 && Math.abs(cpnt[1] - b.centre[1]) <= b.h/2 + 2) return 'box';
        return null;
    }

    /** the handle and its part at the canvas point: the hovered label with its marks, the labels, the nearest point */
    function pick(cpnt) {
        if (!inReach()) return null;
        const hs = handles();
        if (labelsShown()) {
            if (mHover && mHover.part !== 'point') {
                const h = hs.find((x) => x.id === mHover.id && x.kind === 'order');
                const b = h && orderBox(h);
                const part = b && hitOrder(b, cpnt, true);
                if (part) return { id: h.id, part };
            }
            for (const h of hs) {
                if (h.kind !== 'order') continue;
                const b = orderBox(h);
                const part = b && hitOrder(b, cpnt, false);
                if (part) return { id: h.id, part };
            }
        }
        const w = worldAt(cpnt);
        if (!w) return null;
        const px = view.scaleAt(cpnt) || 1;
        let best = null;
        for (const h of hs) {
            if (h.kind !== 'point') continue;
            const a = atOf(h);
            const p = a && toWorld(a);
            if (!finite(p)) continue;
            const d = Math.hypot(p[0] - w[0], p[1] - w[1])/px;
            if (d <= HANDLE_PX && (!best || d < best.d)) best = { id: h.id, d };
        }
        return best ? { id: best.id, part: 'point' } : null;
    }

    function cursorOf(hit, pressed) {
        if (!hit) return '';
        if (hit.part === 'point') return pressed ? 'grabbing' : 'grab';
        if (hit.part === 'box') return 'ns-resize';
        return 'pointer';
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

    function setTitle(t) {
        if (!canvas) return;
        if (t) {
            if (!mTitleSaved) {
                mSavedTitle = canvas.title || '';
                mTitleSaved = true;
            }
            canvas.title = t;
        } else if (mTitleSaved) {
            canvas.title = mSavedTitle;
            mTitleSaved = false;
        }
    }

    function titleOf(hit) {
        const h = hit && handleById(hit.id);
        if (!h) return '';
        if (h.kind === 'order') return `${h.title} (the wheel, − and +, the keys - and +, or a drag up and down)`;
        return `${h.title}${h.title ? ' ' : ''}(Shift: fine; Escape: back)`;
    }

    /** the label under the pointer stays where it is (mAnchor); a point or nothing lets it go */
    function anchorLabel(hit) {
        if (!hit || hit.part === 'point') {
            mAnchor = null;
            return;
        }
        if (mAnchor && mAnchor.id === hit.id) return;
        mAnchor = null;
        const h = handleById(hit.id);
        const b = h && h.kind === 'order' ? orderBox(h) : null;
        if (b) mAnchor = { id: hit.id, centre: b.centre };
    }

    function setHover(hit) {
        anchorLabel(hit);
        const same = (!hit && !mHover) || (hit && mHover && hit.id === mHover.id && hit.part === mHover.part);
        if (same) return;
        if (!hit || !mHover || hit.id !== mHover.id) mWheel = 0;
        mHover = hit;
        setCursor(cursorOf(hit, false));
        setTitle(titleOf(hit));
        repaint();
    }

    function stepOrder(h, dir) {
        const n = h.get();
        const m = h.step(n, dir);
        if (m !== n) h.set(m);
        repaint();
    }

    function endDrag() {
        mDrag = null;
        setCursor(cursorOf(mHover, false));
        repaint();
    }

    function dragTo(cpnt, fine) {
        const h = handleById(mDrag.id);
        if (!h) {
            endDrag();
            return;
        }
        if (mDrag.kind === 'scrub') {
            const steps = Math.round((mDrag.y0 - cpnt[1])/SCRUB_PX);
            let n = mDrag.n0;
            for (let i = 0; i < Math.abs(steps); i++) n = h.step(n, Math.sign(steps));
            if (n !== h.get()) h.set(n);
            repaint();
            return;
        }
        const w = worldAt(cpnt);
        const m = w && fromWorld(w);
        if (!finite(m)) return;
        const f = fine ? FINE : 1;
        mDrag.target = [mDrag.target[0] + (m[0] - mDrag.last[0])*f, mDrag.target[1] + (m[1] - mDrag.last[1])*f];
        mDrag.last = [m[0], m[1]];
        h.set(mDrag.target);
        repaint();
    }

    function handleEvent(e) {
        if (!mActive) return;
        const cpnt = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown': {
            mPressed = false;
            if (e.button !== undefined && e.button !== 0) return;
            const hit = pick(cpnt);
            const h = hit && handleById(hit.id);
            if (!h) return;
            anchorLabel(hit);
            mHover = hit;
            if (hit.part === 'minus' || hit.part === 'plus') {
                stepOrder(h, hit.part === 'plus' ? 1 : -1);
            } else if (hit.part === 'box') {
                mDrag = { kind: 'scrub', id: h.id, saved: h.save(), y0: cpnt[1], n0: h.get() };
            } else {
                const w = worldAt(cpnt);
                const m = w && fromWorld(w);
                const a = atOf(h);
                if (!finite(m) || !a) return;
                mDrag = { kind: 'point', id: h.id, saved: h.save(), target: [a[0], a[1]], last: [m[0], m[1]] };
            }
            mPressed = true;
            setCursor(cursorOf(hit, true));
            e.isConsumed = true;
            if (e.preventDefault) e.preventDefault();
            repaint();
            break;
        }
        case 'pointermove':
            if (mDrag) {
                // the press was let go where the canvas did not see it
                if (e.buttons !== undefined && !(e.buttons & 1)) {
                    endDrag();
                    return;
                }
                dragTo(cpnt, !!e.shiftKey);
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
        case 'click':
        case 'dblclick':
            // the click of a press the tool took (a mark, a label, a handle) is the tool's
            if (mPressed) e.isConsumed = true;
            break;
        case 'wheel': {
            const hit = pick(cpnt);
            const h = hit && hit.part !== 'point' ? handleById(hit.id) : null;
            if (!h || h.kind !== 'order') {
                mWheel = 0;
                return;
            }
            setHover(hit);
            const k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 100 : 1);
            mWheel += (e.deltaY || 0)*k;
            if (Math.abs(mWheel) >= WHEEL_STEP) {
                stepOrder(h, mWheel < 0 ? 1 : -1);
                mWheel = 0;
            }
            e.isConsumed = true;
            if (e.preventDefault) e.preventDefault();
            break;
        }
        case 'pointerleave':
        case 'pointerout':
            if (mDrag) endDrag();
            setHover(null);
            break;
        }
    }

    function handleKey(e) {
        if (!mActive || e.type !== 'keydown') return;
        if (e.key === 'Escape') {
            if (!mDrag) return;
            const h = handleById(mDrag.id);
            if (h) h.restore(mDrag.saved);
            mDrag = null;
            setCursor(cursorOf(mHover, false));
            e.isConsumed = true;
            repaint();
            return;
        }
        if (!mHover || mHover.part === 'point' || e.ctrlKey || e.metaKey || e.altKey) return;
        const h = handleById(mHover.id);
        if (!h || h.kind !== 'order') return;
        const up = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd';
        const down = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract';
        if (!up && !down) return;
        stepOrder(h, up ? 1 : -1);
        e.isConsumed = true;
    }

    // taken up or left with the Symmetry tool or its toggle; left, a drag and the hover end
    function setActive(on) {
        on = !!on;
        if (on === mActive) return;
        mActive = on;
        if (!on) {
            mDrag = null;
            mPressed = false;
            mHover = null;
            mAnchor = null;
            setCursor('');
            setTitle('');
        }
        repaint();
    }

    /** the handles are drawn: the tool is active, and the view shows the group's world or a drag goes on */
    function isShown() {
        return mActive && (!!mDrag || inReach());
    }

    function hotId() {
        return mDrag ? mDrag.id : (mHover ? mHover.id : null);
    }

    // the guide of a point handle (its circle or segment) in world coordinates
    function guideGeometry(geo, g) {
        if (!g) return;
        const style = { width: 1, color: ORANGE_FAINT, dash: 5, gap: 4, halo: [1, 1, 1, 0.5], haloWidth: 2.5 };
        if (g.circle) {
            const [cx, cy, r] = g.circle;
            const c = toWorld([cx, cy]), q = toWorld([cx + r, cy]);
            if (finite(c) && finite(q)) geo.splanes.push({ circle: [c[0], c[1], Math.hypot(q[0] - c[0], q[1] - c[1])], range: null, ...style });
        } else if (g.segment) {
            const p = toWorld(g.segment[0]), q = toWorld(g.segment[1]);
            if (finite(p) && finite(q)) geo.polylines.push({ points: [p, q], ...style });
        }
    }

    /** the handles as the GPU editing overlay's geometry (OverlayGeometry.js), world coordinates */
    function getOverlayGeometry() {
        if (!isShown()) return null;
        const geo = newGeometry();
        const hot = hotId();
        for (const h of handles()) {
            const a = atOf(h);
            const p = a && toWorld(a);
            if (!finite(p)) continue;
            const isHot = h.id === hot;
            if (h.kind === 'order') {
                // the corner; its label is text (renderText)
                geo.points.push({ p, kind: 'disc', size: isHot ? 4.5 : 3.5, color: WHITE, fill: isHot ? ORANGE_HOT : ORANGE, width: 1.5 });
                continue;
            }
            if (isHot && h.guide) guideGeometry(geo, h.guide());
            const kind = h.shape === 'diamond' ? 'diamond' : 'disc';
            const r = isHot ? 8 : 6.5;
            geo.points.push({ p, kind, size: r + 2, color: null, fill: [1, 1, 1, 0.6], width: 0 });
            geo.points.push({ p, kind, size: r, color: isHot ? ORANGE_HOT : ORANGE, fill: WHITE, width: 2 });
        }
        return geo;
    }

    function drawText(ctx, text, x, y) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillStyle = '#000000';
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawMark(ctx, at, glyph, hot) {
        ctx.beginPath();
        ctx.arc(at[0], at[1], MARK_R, 0, 2*Math.PI);
        ctx.fillStyle = hot ? css(ORANGE_HOT) : css(WHITE);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = css(hot ? ORANGE_HOT : ORANGE);
        ctx.stroke();
        ctx.fillStyle = hot ? '#ffffff' : '#5a2a00';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, at[0], at[1] + 0.5);
    }

    // an order's label: a leader from the corner, the box with the number, the marks while hovered
    function drawOrderBox(ctx, b, hot, part) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = css(ORANGE_FAINT);
        ctx.beginPath();
        ctx.moveTo(b.corner[0], b.corner[1]);
        ctx.lineTo(b.centre[0], b.centre[1]);
        ctx.stroke();
        roundRect(ctx, b.centre[0] - b.w/2, b.centre[1] - b.h/2, b.w, b.h, 5);
        ctx.fillStyle = css(WHITE);
        ctx.fill();
        ctx.lineWidth = hot ? 2 : 1.5;
        ctx.strokeStyle = css(hot ? ORANGE_HOT : ORANGE);
        ctx.stroke();
        ctx.fillStyle = '#5a2a00';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, b.centre[0], b.centre[1] + 0.5);
        if (part) {
            drawMark(ctx, b.minus, '−', part === 'minus');
            drawMark(ctx, b.plus, '+', part === 'plus');
        }
    }

    /** the text on the 2D canvas: the orders' labels, the values of the point hovered or dragged */
    function renderText(ctx) {
        if (!isShown() || !ctx || !labelsShown()) return;
        const hs = handles();
        const hot = hotId();
        ctx.save();
        for (const h of hs) {
            if (h.kind !== 'order') continue;
            const b = orderBox(h);
            if (!b) continue;
            const part = (mHover && mHover.id === h.id && mHover.part !== 'point') ? mHover.part
                       : ((mDrag && mDrag.id === h.id) ? 'box' : null);
            drawOrderBox(ctx, b, h.id === hot, part);
        }
        const h = hot !== null ? hs.find((x) => x.id === hot && x.kind === 'point') : null;
        const a = h && h.label ? atOf(h) : null;
        const c = a && canvasOf(a);
        if (c) drawText(ctx, h.label(), c[0] + 12, c[1] - 10);
        ctx.restore();
    }

    /** everything on the 2D canvas, where there is no GPU pass */
    function renderUI(ctx) {
        if (!isShown() || !ctx) return;
        const hot = hotId();
        ctx.save();
        for (const h of handles()) {
            const a = atOf(h);
            const c = a && canvasOf(a);
            if (!c) continue;
            const isHot = h.id === hot;
            if (h.kind === 'order') {
                ctx.beginPath();
                ctx.arc(c[0], c[1], isHot ? 4.5 : 3.5, 0, 2*Math.PI);
                ctx.fillStyle = css(isHot ? ORANGE_HOT : ORANGE);
                ctx.fill();
                continue;
            }
            const r = isHot ? 8 : 6.5;
            ctx.beginPath();
            if (h.shape === 'diamond') {
                ctx.moveTo(c[0], c[1] - r);
                ctx.lineTo(c[0] + r, c[1]);
                ctx.lineTo(c[0], c[1] + r);
                ctx.lineTo(c[0] - r, c[1]);
                ctx.closePath();
            } else {
                ctx.arc(c[0], c[1], r, 0, 2*Math.PI);
            }
            ctx.fillStyle = css(WHITE);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = css(isHot ? ORANGE_HOT : ORANGE);
            ctx.stroke();
        }
        ctx.restore();
        renderText(ctx);
    }

    return {
        handleEvent,
        handleKey,
        setActive,
        isActive: () => mActive,
        isShown,
        isDragging: () => !!mDrag,
        getHover: () => mHover,
        getOverlayGeometry,
        renderText,
        renderUI,
    };
}
