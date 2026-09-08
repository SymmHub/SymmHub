/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 */
import { sqrt, cos, sin, atan2, TORADIANS, TODEGREE, normalizeAngle, iPoint } from './modules.js';
const DEBUG = false;

function PatternTransformHandler(params) {
    const mConfig = params.config;
    const mOnChanged = params.onChanged;
    const mCanvasTransform = params.canvasTransform;
    const mOverlay = params.overlay;
    const mCursorMove = params.cursorMove || 'move';
    const mCursorTransform = params.cursorTransform || 'pointer';
    // Optional: () => {minX,minY,maxX,maxY} in pattern space. When present the
    // box outline / corner hit targets use this union rect instead of [-1,1]^2.
    // The drag math (rotate/scale about pivot, translate) is unchanged — it
    // still acts on mConfig in world coordinates.
    const mGetPatternBox = params.getPatternBox || null;
    // Optional: () => [{id, get, set}] — one live get/set handle per texture
    // image. get() -> {centerX,centerY,scale,angle} in pattern/buffer space.
    const mGetImageTransforms = params.getImageTransforms || null;

    // Corners of the pattern box in pattern space (TL, TR, BR, BL).
    function patternBoxCorners() {
        const b = mGetPatternBox && mGetPatternBox();
        if (b) return [[b.minX, b.maxY], [b.maxX, b.maxY], [b.maxX, b.minY], [b.minX, b.minY]];
        return [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    }

    // Is a pattern-space point inside the pattern box?
    function patternBoxContains(p) {
        const b = mGetPatternBox && mGetPatternBox();
        if (b) return p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY;
        return p[0] >= -1 && p[0] <= 1 && p[1] >= -1 && p[1] <= 1;
    }

    // ── per-image boxes (pattern/buffer space) ───────────────────────────────

    function imageTargets() {
        if (!mGetImageTransforms) return [];
        const list = mGetImageTransforms();
        return Array.isArray(list) ? list : [];
    }

    // corners of image t's box, in pattern/buffer space
    function imageCorners(t) {
        const c  = t.get();
        const a  = (c.angle || 0) * TORADIANS;
        const s  = (c.scale === undefined ? 1 : c.scale);
        const ca = cos(a), sa = sin(a);
        return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([ux, uy]) => [
            (c.centerX || 0) + s * (ca * ux - sa * uy),
            (c.centerY || 0) + s * (sa * ux + ca * uy),
        ]);
    }

    // is pattern/buffer-space point P inside image t's box?
    function imageContains(t, P) {
        const c  = t.get();
        const a  = (c.angle || 0) * TORADIANS;
        const s  = (c.scale === undefined ? 1 : c.scale) || 1e-6;
        const ca = cos(a), sa = sin(a);
        const dx = P[0] - (c.centerX || 0), dy = P[1] - (c.centerY || 0);
        const qx = ( ca * dx + sa * dy) / s;
        const qy = (-sa * dx + ca * dy) / s;
        return Math.abs(qx) <= 1 && Math.abs(qy) <= 1;
    }

    // ── drag selection + interior click cycling ──────────────────────────────

    let mSelection    = null;   // {kind:'pattern'} | {kind:'image', id}
    let mActiveSel    = null;   // resolved target for the current drag (has .target for images)
    let mCycleAnchor  = null;   // pattern-space point of the last interior click
    let mCycleList    = [];     // candidate selections captured at that anchor
    let mCycleIdx     = 0;
    let mArmedCycle   = false;  // a same-spot press that will advance the cycle on release (if not dragged)
    let mDidDrag      = false;  // pointer moved between down and up
    const CYCLE_TOL   = 0.06;   // pattern-space radius that counts as "the same spot"

    function selFromCand(cand) {
        return cand.kind === 'image' ? { kind: 'image', id: cand.id } : { kind: 'pattern' };
    }

    function candidatesAt(P) {
        const cands = [];
        for (const t of imageTargets())
            if (imageContains(t, P)) cands.push({ kind: 'image', id: t.id, target: t });
        if (patternBoxContains(P)) cands.push({ kind: 'pattern' });
        return cands;
    }

    function sameCandList(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i].kind !== b[i].kind) return false;
            if (a[i].kind === 'image' && a[i].id !== b[i].id) return false;
        }
        return true;
    }

    // Interior press at pattern-space P. A *new* spot selects the first covering
    // image right away. Pressing the *same* spot again arms a cycle step that
    // fires on release — but only if the press wasn't a drag. So a click cycles
    // (images at that point, then the whole pattern, then wrap); a press-drag
    // just moves whatever is currently selected.
    function beginInterior(P) {
        const cands = candidatesAt(P);
        if (cands.length === 0) return null;

        const sameSpot = mCycleAnchor
            && Math.hypot(P[0] - mCycleAnchor[0], P[1] - mCycleAnchor[1]) < CYCLE_TOL
            && sameCandList(mCycleList, cands);

        if (sameSpot) {
            mArmedCycle = true;                 // advance on release-without-drag
        } else {
            mCycleAnchor = P;
            mCycleList   = cands;
            mCycleIdx    = 0;
            mArmedCycle  = false;
        }
        const cand = mCycleList[mCycleIdx] || cands[0];
        mSelection = selFromCand(cand);
        return cand;
    }

    // Fire the armed cycle step (called from pointerup for a click, not a drag).
    function commitCycle() {
        if (!mArmedCycle || !mCycleList.length) return;
        mCycleIdx  = (mCycleIdx + 1) % mCycleList.length;
        mSelection = selFromCand(mCycleList[mCycleIdx]);
        onChanged();
    }

    let mOldPointer = null;
    let mIsDragging = false;
    let mDragMode = null; // can be 'translate', 'rotateScale', 'pivot', or null
    let mFundDomainTransform = null;
    let mDoubleClickPoint = null;
    let mDoubleClickImage = null;

    function worldToPattern(wpnt) {
        if (!wpnt) return [0, 0];
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale || 1;
        const cx = mConfig.centerX || 0;
        const cy = mConfig.centerY || 0;
        const s = scale === 0 ? 0 : 1 / scale;

        const sa = sin(angle);
        const ca = cos(angle);
        let x = wpnt[0] - cx;
        let y = wpnt[1] - cy;
        const px = s * (ca * x + sa * y);
        const py = s * (-sa * x + ca * y);
        
        return [px, py];
    }

    function patternToWorld(ppnt) {
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale !== undefined ? mConfig.scale : 1;
        const cx = mConfig.centerX || 0;
        const cy = mConfig.centerY || 0;

        const sa = sin(angle);
        const ca = cos(angle);

        const dx = scale * (ca * ppnt[0] - sa * ppnt[1]);
        const dy = scale * (sa * ppnt[0] + ca * ppnt[1]);

        return [dx + cx, dy + cy];
    }

    function applyRotationAndScale(oldP, currentP) {
        const ox = mConfig.pivotX || 0;
        const oy = mConfig.pivotY || 0;
        // The pivot point in world coordinates remains fixed
        const P_w = patternToWorld([ox, oy]);

        const dx1 = oldP[0] - P_w[0];
        const dy1 = oldP[1] - P_w[1];
        const dx2 = currentP[0] - P_w[0];
        const dy2 = currentP[1] - P_w[1];

        const r1 = sqrt(dx1 * dx1 + dy1 * dy1);
        const r2 = sqrt(dx2 * dx2 + dy2 * dy2);

        if (r1 > 0.001 && r2 > 0.001) {
            const a1 = atan2(dy1, dx1);
            const a2 = atan2(dy2, dx2);
            let da = a2 - a1;

            // Normalize angle delta to [-PI, PI]
            da = normalizeAngle(da);

            mConfig.angle += da * TODEGREE;
            
            // Normalize angle to [-180, 180]
            mConfig.angle = TODEGREE * normalizeAngle(mConfig.angle * TORADIANS);

            mConfig.scale *= (r2 / r1);

            // Relocate center (centerX, centerY) to rotate/scale around the pivot P_w
            const angleRad = mConfig.angle * TORADIANS;
            const sa = sin(angleRad);
            const ca = cos(angleRad);
            const newScale = mConfig.scale;

            const dxNew = newScale * (ca * ox - sa * oy);
            const dyNew = newScale * (sa * ox + ca * oy);

            mConfig.centerX = P_w[0] - dxNew;
            mConfig.centerY = P_w[1] - dyNew;
        }
    }

    function applyTranslation(oldP, currentP) {
        const dx = currentP[0] - oldP[0];
        const dy = currentP[1] - oldP[1];

        mConfig.centerX += dx;
        mConfig.centerY += dy;
    }

    // ── image drag ops (centre/scale/angle live in pattern/buffer space) ─────

    function applyImageTranslate(t, oldW, curW) {
        const a = worldToPattern(oldW);
        const b = worldToPattern(curW);          // affine: the -centre cancels, leaving s*R(-angle)*delta
        const c = t.get();
        t.set({ centerX: (c.centerX || 0) + (b[0] - a[0]),
                centerY: (c.centerY || 0) + (b[1] - a[1]) });
    }

    function applyImageRotateScale(t, oldW, curW) {
        const c = t.get();
        const Cx = c.centerX || 0, Cy = c.centerY || 0;
        const o = worldToPattern(oldW);
        const q = worldToPattern(curW);
        const r1 = sqrt((o[0] - Cx) ** 2 + (o[1] - Cy) ** 2);
        const r2 = sqrt((q[0] - Cx) ** 2 + (q[1] - Cy) ** 2);
        if (r1 > 1e-4 && r2 > 1e-4) {
            const da = normalizeAngle(atan2(q[1] - Cy, q[0] - Cx) - atan2(o[1] - Cy, o[0] - Cx));
            const angle = TODEGREE * normalizeAngle(((c.angle || 0) + da * TODEGREE) * TORADIANS);
            const scale = Math.max(1e-4, (c.scale === undefined ? 1 : c.scale) * (r2 / r1));
            t.set({ angle, scale });
        }
    }

    function onChanged() {
        if (mOnChanged) {
            mOnChanged();
        }
    }

    function changePivot(patternPoint) {
        mConfig.pivotX = patternPoint[0];
        mConfig.pivotY = patternPoint[1];
        onChanged();
    }

    // Pointer coords arrive in internal canvas pixels (offset * sizeMultiplier
    // * devicePixelRatio), so scale the hit tolerance the same way — otherwise
    // the target is only ~6 CSS px on a Retina display.
    const HIT_DPR     = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const HIT_PIVOT   = 15 * HIT_DPR;
    const HIT_CORNER  = 20 * HIT_DPR;
    // A press that never moves past this (canvas px) is a click, not a drag —
    // it cycles/selects but must not translate or rotate anything.
    const DRAG_THRESH = 4 * HIT_DPR;
    let   mDownCanvas  = null;  // [canvasX, canvasY] captured at pointerdown
    let   mLeftGesture = false; // left button held after a pointerdown we claimed

    function near(px, py, patternPt, tol) {
        const sp = mCanvasTransform.world2screen(patternToWorld(patternPt));
        return Math.hypot(px - sp[0], py - sp[1]) <= tol;
    }

    // Returns { mode, sel } — sel identifies which box was hit.
    //   mode: 'pivot' | 'rotateScale'
    //   sel : {kind:'pattern'} | {kind:'image', id, target}
    function getInteractionTarget(pointerX, pointerY) {
        if (!mCanvasTransform) return null;

        // 1. pattern pivot
        if (near(pointerX, pointerY, [mConfig.pivotX || 0, mConfig.pivotY || 0], HIT_PIVOT))
            return { mode: 'pivot', sel: { kind: 'pattern' } };

        // 2. image-box corners (smaller / drawn on top -> take precedence)
        for (const t of imageTargets()) {
            for (const p of imageCorners(t)) {
                if (near(pointerX, pointerY, p, HIT_CORNER))
                    return { mode: 'rotateScale', sel: { kind: 'image', id: t.id, target: t } };
            }
        }

        // 3. union / pattern box corners
        for (const p of patternBoxCorners()) {
            if (near(pointerX, pointerY, p, HIT_CORNER))
                return { mode: 'rotateScale', sel: { kind: 'pattern' } };
        }

        return null;
    }

    function checkCloseToPoint(evt) {
        if (!mOverlay || evt.canvasX === undefined || evt.canvasY === undefined) return;
        const target = getInteractionTarget(evt.canvasX, evt.canvasY);
        if (target) {
            mOverlay.style.cursor = 'pointer';
            return;
        }

        // Check if inside pattern box
        if (evt.wpnt) {
            const tpnt = worldToPattern(evt.wpnt);
            if (patternBoxContains(tpnt)) {
                mOverlay.style.cursor = Array.isArray(mCursorTransform) ? mCursorTransform.join(', ') : mCursorTransform;
                return;
            }
        }

        // Default cursor (outside pattern box and handles)
        mOverlay.style.cursor = Array.isArray(mCursorMove) ? mCursorMove.join(', ') : mCursorMove;
    }

    function onPointerDown(evt) {
        if (mIsDragging) return;
        mDidDrag = false;
        mDownCanvas = (evt.canvasX !== undefined) ? [evt.canvasX, evt.canvasY] : null;

        if (!(evt.buttons & 1)) return;   // left button only

        // The transform tool owns every left-button gesture: it never lets the
        // navigator pan the view. Anything not on a handle/box just does nothing.
        mLeftGesture = true;
        evt.preventDefault();
        evt.isConsumed = true;

        if (!(evt.wpnt && evt.canvasX !== undefined && evt.canvasY !== undefined)) return;

        const checkRes = getInteractionTarget(evt.canvasX, evt.canvasY);
        if (checkRes) {
            mDragMode = checkRes.mode;
            mActiveSel = checkRes.sel;
            // grabbing a corner also selects that box (pivot doesn't change selection)
            if (checkRes.mode !== 'pivot')
                mSelection = checkRes.sel.kind === 'image'
                    ? { kind: 'image', id: checkRes.sel.id }
                    : { kind: 'pattern' };
            mOldPointer = evt.wpnt;
            mIsDragging = true;
            onChanged();
            return;
        }

        const tpnt = worldToPattern(evt.wpnt);
        if (evt.ctrlKey) {
            changePivot(tpnt);
            return;
        }

        // interior press: select (and arm the click-cycle)
        const cand = beginInterior(tpnt);
        if (cand) {
            mActiveSel = cand;
            mDragMode = 'translate';
            mOldPointer = evt.wpnt;
            mIsDragging = true;
            onChanged();
        }
    }

    function onPointerMove(evt) {
        if (mIsDragging && mOldPointer && evt.wpnt) {
            if (!(evt.buttons & 1)) {
                if (!mDidDrag) commitCycle();
                mArmedCycle = false;
                mDidDrag = false;
                mIsDragging = false;
                mDragMode = null;
                mOldPointer = null;
                checkCloseToPoint(evt);
                return;
            }
            const currentPointer = evt.wpnt;

            // Below the drag threshold this is still a click: consume the event
            // (so the navigator doesn't pan) but don't move anything yet.
            if (!mDidDrag) {
                const moved = mDownCanvas && evt.canvasX !== undefined
                    ? Math.hypot(evt.canvasX - mDownCanvas[0], evt.canvasY - mDownCanvas[1])
                    : Infinity;
                if (moved < DRAG_THRESH) {
                    mOldPointer = currentPointer;
                    evt.preventDefault();
                    evt.isConsumed = true;
                    return;
                }
                mDidDrag = true;
            }

            const onImage = mActiveSel && mActiveSel.kind === 'image' && mActiveSel.target;

            if (mDragMode === 'rotateScale') {
                if (onImage) applyImageRotateScale(mActiveSel.target, mOldPointer, currentPointer);
                else         applyRotationAndScale(mOldPointer, currentPointer);
            } else if (mDragMode === 'pivot') {
                changePivot(worldToPattern(currentPointer));
            } else if (mDragMode === 'translate') {
                if (onImage) applyImageTranslate(mActiveSel.target, mOldPointer, currentPointer);
                else         applyTranslation(mOldPointer, currentPointer);
            }

            mOldPointer = currentPointer;

            onChanged();

            evt.preventDefault();
            evt.isConsumed = true;
        } else if (mLeftGesture) {
            // left button held but not on a draggable target — still ours,
            // don't let the navigator pan
            evt.preventDefault();
            evt.isConsumed = true;
        } else if (!mIsDragging) {
            checkCloseToPoint(evt);
        }
    }

    function onPointerUp(evt) {
        if (mLeftGesture || mIsDragging) {
            // a press with no drag over an interior spot = a click -> cycle
            if (mIsDragging && !mDidDrag) commitCycle();
            mLeftGesture = false;
            mArmedCycle = false;
            mDidDrag = false;
            mIsDragging = false;
            mDragMode = null;
            mOldPointer = null;
            checkCloseToPoint(evt);
            evt.preventDefault();
            evt.isConsumed = true;
        }
    }

    function onPointerLeave(evt) {
        if (!mIsDragging && !mLeftGesture && mOverlay) {
            mOverlay.style.cursor = Array.isArray(mCursorMove) ? mCursorMove.join(', ') : mCursorMove;
        }
    }

    function onDoubleClick(evt) {
        if (evt.wpnt && typeof params.getGroup === 'function') {
            const group = params.getGroup();
            if (group) {
                const ipnt = iPoint(evt.wpnt);
                const res = group.toFundDomain({ pnt: ipnt });
                mFundDomainTransform = res.transform;
                mDoubleClickPoint = evt.wpnt;
                mDoubleClickImage = [res.pnt.v[0], res.pnt.v[1]];
                console.log('mFundDomainTransform:', mFundDomainTransform.toStr());
                onChanged();
                evt.preventDefault();
                evt.isConsumed = true;
            }
        }
    }

    function handleEvent(evt) {
        if (evt.type === 'wheel') {
            return;
        }

        switch (evt.type) {
            case 'pointerdown':
                onPointerDown(evt);
                break;

            case 'pointermove':
                onPointerMove(evt);
                break;

            case 'pointerup':
                onPointerUp(evt);
                break;

            case 'pointerleave':
            case 'pointerout':
                onPointerLeave(evt);
                break;

            case 'dblclick':
                onDoubleClick(evt);
                break;
        }
    }

    return {
        handleEvent: handleEvent,
        getFundDomainTransform: () => mFundDomainTransform,
        getDoubleClickPoint: () => mDoubleClickPoint,
        getDoubleClickImage: () => mDoubleClickImage,
        // {kind:'pattern'} | {kind:'image', id} | null — current drag selection
        getSelection: () => mSelection,
        // screen-space positions of every interactive handle (for tests/tools)
        getHandles: () => {
            const w2s = (p) => mCanvasTransform.world2screen(patternToWorld(p));
            return {
                pivot: w2s([mConfig.pivotX || 0, mConfig.pivotY || 0]),
                patternCorners: patternBoxCorners().map(w2s),
                imageCorners: imageTargets().map(t => ({ id: t.id, corners: imageCorners(t).map(w2s) })),
            };
        },
    };
}

export {
    PatternTransformHandler
};
