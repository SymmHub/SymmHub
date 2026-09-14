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
    // Optional: () => radius | 0 — the largest |p| (in world/math coords) any
    // dragged corner may reach. Used for the hyperbolic plane, where the whole
    // picture lives inside the unit disk and nothing may touch the bounding
    // circle. 0 / null / absent => dragging is unconstrained (the Euclidean
    // and spherical cases, and every app that doesn't supply the hook).
    const mGetMaxRadius = params.getMaxRadius || null;

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

    // ── bounding-circle limit ────────────────────────────────────────────────
    //
    // In the hyperbolic plane the whole picture lives inside the unit disk, so
    // a drag must never push a corner out to (or past) the bounding circle.
    // Checking the four corners suffices: the box is convex and the constraint
    // is "stay inside a disk", so the farthest point of the box from the origin
    // is always a corner.
    //
    // The limit applies to an image's own box while that image is dragged, and
    // to the surrounding pattern box while the pattern is dragged.

    const UNIT_CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

    function maxRadius() {
        const r = mGetMaxRadius && mGetMaxRadius();
        return (typeof r === 'number' && isFinite(r) && r > 0) ? r : 0;   // 0 = no limit
    }

    // pattern-space point -> world, under an arbitrary pattern config
    function toWorldWith(cfg, p) {
        const a  = (cfg.angle || 0) * TORADIANS;
        const s  = (cfg.scale === undefined ? 1 : cfg.scale);
        const ca = cos(a), sa = sin(a);
        return [(cfg.centerX || 0) + s * (ca * p[0] - sa * p[1]),
                (cfg.centerY || 0) + s * (sa * p[0] + ca * p[1])];
    }

    // corners of the pattern box in world coords, under pattern config cfg
    function patternCornersWorld(cfg) {
        return patternBoxCorners().map(p => toWorldWith(cfg, p));
    }

    // corners of one image's box in world coords, for transform c (pattern space)
    function imageCornersWorld(c) {
        const a  = (c.angle || 0) * TORADIANS;
        const s  = (c.scale === undefined ? 1 : c.scale);
        const ca = cos(a), sa = sin(a);
        return UNIT_CORNERS.map(([ux, uy]) => patternToWorld([
            (c.centerX || 0) + s * (ca * ux - sa * uy),
            (c.centerY || 0) + s * (sa * ux + ca * uy),
        ]));
    }

    function worstRadius(pts) {
        let m = 0;
        for (const p of pts) { const d = Math.hypot(p[0], p[1]); if (d > m) m = d; }
        return m;
    }

    // Is the candidate state allowed? Inside the limit: always. Outside it:
    // only if it's no worse than where we started — otherwise a box that is
    // already out of bounds (a preset, or a value typed into the GUI) would be
    // frozen and could never be dragged back in.
    function accepts(candPts, curPts) {
        const lim = maxRadius();
        if (!lim) return true;
        const r = worstRadius(candPts);
        if (r <= lim) return true;
        return r <= worstRadius(curPts) + 1e-9;
    }

    // Take the largest fraction of the pointer move old->cur that `compute`
    // turns into an allowed state. Returns {cand, pnt}: the state to commit
    // (null = nothing allowed, don't move) and the pointer position actually
    // consumed, which becomes the new drag origin so the box stays glued to
    // the cursor's admissible projection instead of drifting away from it.
    const CONSTRAIN_STEPS = 14;
    function bestMove(compute, cornersOf, curPts, oldW, curW) {
        const full = compute(oldW, curW);
        if (!full || accepts(cornersOf(full), curPts)) return { cand: full, pnt: curW };

        let lo = 0, hi = 1, best = null, bestPnt = oldW;
        for (let i = 0; i < CONSTRAIN_STEPS; i++) {
            const t = 0.5 * (lo + hi);
            const p = [oldW[0] + (curW[0] - oldW[0]) * t, oldW[1] + (curW[1] - oldW[1]) * t];
            const c = compute(oldW, p);
            if (c && accepts(cornersOf(c), curPts)) { best = c; bestPnt = p; lo = t; }
            else hi = t;
        }
        return { cand: best, pnt: bestPnt };
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

    // Pure: the pattern config a rotate+scale about the pivot would produce.
    // (rotate + uniform scale about a fixed point = homothety)
    function computePatternRotateScale(oldP, currentP) {
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
        if (!(r1 > 0.001 && r2 > 0.001)) return null;

        const da = normalizeAngle(atan2(dy2, dx2) - atan2(dy1, dx1));

        // Normalize angle to [-180, 180]
        const angle = TODEGREE * normalizeAngle((mConfig.angle + da * TODEGREE) * TORADIANS);
        const scale = mConfig.scale * (r2 / r1);

        // Relocate center (centerX, centerY) to rotate/scale around the pivot P_w
        const angleRad = angle * TORADIANS;
        const sa = sin(angleRad);
        const ca = cos(angleRad);

        return {
            angle, scale,
            centerX: P_w[0] - scale * (ca * ox - sa * oy),
            centerY: P_w[1] - scale * (sa * ox + ca * oy),
        };
    }

    // Pure: the pattern config a translation would produce.
    function computePatternTranslate(oldP, currentP) {
        return {
            centerX: mConfig.centerX + (currentP[0] - oldP[0]),
            centerY: mConfig.centerY + (currentP[1] - oldP[1]),
        };
    }

    // Each apply* commits the largest allowed part of the move and returns the
    // pointer position it consumed (the caller makes that the new drag origin).

    function applyRotationAndScale(oldP, currentP) {
        const cur = patternCornersWorld(mConfig);
        const cornersOf = (cand) => patternCornersWorld({ ...mConfig, ...cand });
        const { cand, pnt } = bestMove(computePatternRotateScale, cornersOf, cur, oldP, currentP);
        if (cand) Object.assign(mConfig, cand);
        return pnt;
    }

    function applyTranslation(oldP, currentP) {
        const cur = patternCornersWorld(mConfig);
        const cornersOf = (cand) => patternCornersWorld({ ...mConfig, ...cand });
        const { cand, pnt } = bestMove(computePatternTranslate, cornersOf, cur, oldP, currentP);
        if (cand) Object.assign(mConfig, cand);
        return pnt;
    }

    // ── image drag ops (centre/scale/angle live in pattern/buffer space) ─────

    function applyImageTranslate(t, oldW, curW) {
        const c0 = t.get();
        const compute = (oldP, curP) => {
            const a = worldToPattern(oldP);
            const b = worldToPattern(curP);      // affine: the -centre cancels, leaving s*R(-angle)*delta
            return { ...c0, centerX: (c0.centerX || 0) + (b[0] - a[0]),
                            centerY: (c0.centerY || 0) + (b[1] - a[1]) };
        };
        const { cand, pnt } = bestMove(compute, imageCornersWorld, imageCornersWorld(c0), oldW, curW);
        if (cand) t.set({ centerX: cand.centerX, centerY: cand.centerY });
        return pnt;
    }

    function applyImageRotateScale(t, oldW, curW) {
        const c0 = t.get();
        const Cx = c0.centerX || 0, Cy = c0.centerY || 0;
        const compute = (oldP, curP) => {
            const o = worldToPattern(oldP);
            const q = worldToPattern(curP);
            const r1 = sqrt((o[0] - Cx) ** 2 + (o[1] - Cy) ** 2);
            const r2 = sqrt((q[0] - Cx) ** 2 + (q[1] - Cy) ** 2);
            if (!(r1 > 1e-4 && r2 > 1e-4)) return null;
            const da = normalizeAngle(atan2(q[1] - Cy, q[0] - Cx) - atan2(o[1] - Cy, o[0] - Cx));
            return {
                ...c0,
                angle: TODEGREE * normalizeAngle(((c0.angle || 0) + da * TODEGREE) * TORADIANS),
                scale: Math.max(1e-4, (c0.scale === undefined ? 1 : c0.scale) * (r2 / r1)),
            };
        };
        const { cand, pnt } = bestMove(compute, imageCornersWorld, imageCornersWorld(c0), oldW, curW);
        if (cand) t.set({ angle: cand.angle, scale: cand.scale });
        return pnt;
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

            // Each apply* returns the part of the pointer move it was allowed
            // to consume — the same point, unless the bounding-circle limit
            // stopped the drag short. That becomes the new drag origin, so a
            // clamped box stays glued to the cursor and starts moving again
            // the moment the cursor comes back.
            let consumed = currentPointer;

            if (mDragMode === 'rotateScale') {
                consumed = onImage ? applyImageRotateScale(mActiveSel.target, mOldPointer, currentPointer)
                                   : applyRotationAndScale(mOldPointer, currentPointer);
            } else if (mDragMode === 'pivot') {
                changePivot(worldToPattern(currentPointer));
            } else if (mDragMode === 'translate') {
                consumed = onImage ? applyImageTranslate(mActiveSel.target, mOldPointer, currentPointer)
                                   : applyTranslation(mOldPointer, currentPointer);
            }

            mOldPointer = consumed || currentPointer;

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
        // A selection naming an image that is no longer among the targets
        // (it was hidden via the visualization's "visible images" field)
        // reports as nothing selected, so no stale highlight is implied.
        getSelection: () => {
            if (mSelection && mSelection.kind === 'image'
                && !imageTargets().some(t => t.id === mSelection.id)) return null;
            return mSelection;
        },
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
