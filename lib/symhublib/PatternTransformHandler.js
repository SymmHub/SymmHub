/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 *
 * The transform is a pose (PatternPose.js): the box [-1, 1]^2 placed in the
 * world by the similarity of its centre, scale and angle, bent by the Möbius
 * map of bendX, bendY. A drag composes the pose of the drag's start with a
 * motion, so every drag is path independent and a drag back restores the
 * transform:
 *
 *   translate    the pose moves as a shape of the select tool does: the pivot
 *                is the anchor of the move and the grabbed point follows the
 *                pointer (GeometryMotions.anchoredMoveTo), in the geometry of
 *                the group at the pivot (grouplib localGeometry: the plane,
 *                the hyperbolic plane, the sphere, a Kleinian group's maximal
 *                disk) when the pattern can take a bent placement
 *                (params.canBend) and the transform's `geometric` is on; else
 *                in the plane, a plain translation as before
 *   rotateScale  the turn and scaling about the pivot by the pointer's turn
 *                and distance ratio in the pivot's chart (similarityAbout)
 *   pivot        the pivot dragged, kept in the box's coordinates
 *   Ctrl+click   the pivot put at the click
 *   double click the point folded into the fundamental domain, shown with
 *                the box's image under the fold (the renderer draws them)
 */

import {
    sqrt,
    iPoint,
    mobiusApply,
    mobiusCompose,
    canonicalChart,
    anchoredMoveTo,
    similarityAbout,
    localGeometry,
    poseMatrix,
    poseConfig,
    poseToWorld,
    poseToPattern,
} from './modules.js';

const DEBUG = false;
const PLANE = { kind: 'euclidean' };
// the geometries of the group at the last points asked for (a drag asks for its pivot on every move)
const GEOMETRIES_KEPT = 32;
// the reach of the pivot and the corner handles, screen pixels
const HANDLE_PX = 12;

function PatternTransformHandler(params) {

    const mConfig = params.config;
    const mOnChanged = params.onChanged;
    const mCanvasTransform = params.canvasTransform;
    const mOverlay = params.overlay;
    const mCursorMove = params.cursorMove || 'move';
    const mCursorTransform = params.cursorTransform || 'pointer';
    const mCanBend = params.canBend || (() => false);

    let mOldPointer = null;         // the pointer at the drag's start (world)
    let mStartPose = null;          // the pose at the drag's start, a Möbius matrix
    let mStartPivot = null;         // the pivot in the world at the drag's start
    let mAnchorGuess = null;        // the pivot's place found for the last pointer position
    let mIsDragging = false;
    let mDragMode = null; // can be 'translate', 'rotateScale', 'pivot', or null
    let mFundDomainTransform = null;
    let mDoubleClickPoint = null;
    let mDoubleClickImage = null;
    // the geometries of the group at points (localGeometry), and the group they belong to
    let mGeometryGroup = null;
    const mGeometries = new Map();

    function worldToPattern(wpnt) {
        if (!wpnt) return [0, 0];
        return poseToPattern(mConfig, wpnt);
    }

    function patternToWorld(ppnt) {
        return poseToWorld(mConfig, ppnt);
    }

    /** do the drags move in the geometry of the group: the pattern takes a bent placement and the transform says so */
    function geometric() {
        return mCanBend() && mConfig.geometric !== false;
    }

    /**
     * the geometry of the group at a world point: the group's absolute, or a
     * Kleinian group's maximal disk there; the plane without a group, without
     * a geometry, or when the drags are the plane's
     */
    function geometryAt(w) {
        if (!geometric()) return PLANE;
        const group = (typeof params.getGroup === 'function') ? params.getGroup() : null;
        if (!group) return PLANE;
        if (group !== mGeometryGroup) { mGeometryGroup = group; mGeometries.clear(); }
        const key = w[0] + ' ' + w[1];
        const kept = mGeometries.get(key);
        if (kept) {
            mGeometries.delete(key);
            mGeometries.set(key, kept);
            return kept;
        }
        const g = localGeometry(group, w);
        const out = (g && g.kind !== 'kleinian') ? g : PLANE;
        if (mGeometries.size >= GEOMETRIES_KEPT) mGeometries.delete(mGeometries.keys().next().value);
        mGeometries.set(key, out);
        return out;
    }

    /** the drag's start: the pose and the pivot's place in the world */
    function startDrag(mode, wpnt) {
        mDragMode = mode;
        mOldPointer = wpnt;
        mIsDragging = true;
        mStartPose = poseMatrix(mConfig);
        mStartPivot = patternToWorld([mConfig.pivotX || 0, mConfig.pivotY || 0]);
        mAnchorGuess = null;
    }

    /** the config takes the pose: the motion M after the pose of the drag's start */
    function setPose(M) {
        const cfg = poseConfig(mobiusCompose(M, mStartPose), mConfig);
        if (!cfg) return;
        Object.assign(mConfig, cfg);
    }

    /**
     * the turn and scaling about the pivot: by the pointer's turn about it and
     * its distance ratio, in the canonical chart of the pivot (the plane's
     * similarity about the pivot when the drags are the plane's)
     */
    function applyRotationAndScale(currentP) {
        const geom = geometryAt(mStartPivot);
        const s = canonicalChart(geom, mStartPivot);
        const u = mobiusApply(s, mOldPointer), v = mobiusApply(s, currentP);
        const uu = u[0]*u[0] + u[1]*u[1];
        if (uu < 1.e-18 || Math.hypot(v[0], v[1]) < 1.e-9) return;
        // the factor v/u
        const factor = [(v[0]*u[0] + v[1]*u[1])/uu, (v[1]*u[0] - v[0]*u[1])/uu];
        setPose(similarityAbout(geom, mStartPivot, factor));
    }

    /** the move of the pose: the pivot its anchor, the grabbed point following the pointer */
    function applyTranslation(currentP) {
        const r = anchoredMoveTo(geometryAt(mStartPivot), mStartPivot, mOldPointer, currentP, geometryAt, mAnchorGuess);
        mAnchorGuess = r.anchor;
        setPose(r.m);
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

    function getInteractionTarget(pointerX, pointerY) {
        if (!mCanvasTransform) return null;

        // 1. Check pivot point
        const pivotWorld = patternToWorld([mConfig.pivotX || 0, mConfig.pivotY || 0]);
        const pivotScreen = mCanvasTransform.world2screen(pivotWorld);
        const dxPivot = pointerX - pivotScreen[0];
        const dyPivot = pointerY - pivotScreen[1];
        const distPivot = sqrt(dxPivot * dxPivot + dyPivot * dyPivot);

        if (distPivot <= HANDLE_PX) {
            return { mode: 'pivot' };
        }

        // 2. Check corners
        const cornersPattern = [
            [-1, 1], [1, 1], [1, -1], [-1, -1]
        ];
        for (const p of cornersPattern) {
            const wp = patternToWorld(p);
            const sp = mCanvasTransform.world2screen(wp);
            const dx = pointerX - sp[0];
            const dy = pointerY - sp[1];
            const dist = sqrt(dx * dx + dy * dy);
            if (dist <= HANDLE_PX) {
                return { mode: 'rotateScale' };
            }
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
            if (tpnt[0] >= -1 && tpnt[0] <= 1 && tpnt[1] >= -1 && tpnt[1] <= 1) {
                mOverlay.style.cursor = Array.isArray(mCursorTransform) ? mCursorTransform.join(', ') : mCursorTransform;
                return;
            }
        }

        // Default cursor (outside pattern box and handles)
        mOverlay.style.cursor = Array.isArray(mCursorMove) ? mCursorMove.join(', ') : mCursorMove;
    }

    function onPointerDown(evt) {
        if (mIsDragging) return;
        if (evt.buttons & 1) { // Left-click
            if (evt.wpnt && evt.canvasX !== undefined && evt.canvasY !== undefined) {
                const checkRes = getInteractionTarget(evt.canvasX, evt.canvasY);
                if (checkRes) {
                    startDrag(checkRes.mode, evt.wpnt);
                    evt.preventDefault();
                    evt.isConsumed = true;
                } else {
                    const tpnt = worldToPattern(evt.wpnt);
                    if(DEBUG) console.log(`PatternTransformHandler pointerdown - world coordinates: [${evt.wpnt[0].toFixed(4)}, ${evt.wpnt[1].toFixed(4)}], pattern coordinates: [${tpnt[0].toFixed(4)}, ${tpnt[1].toFixed(4)}]`);
                    if (evt.ctrlKey) {
                        changePivot(tpnt);
                        evt.preventDefault();
                        evt.isConsumed = true;
                    } else {
                        if (tpnt[0] >= -1 && tpnt[0] <= 1 && tpnt[1] >= -1 && tpnt[1] <= 1) {
                            startDrag('translate', evt.wpnt);
                            evt.preventDefault();
                            evt.isConsumed = true;
                        }
                    }
                }
            }
        }
    }

    function endDrag() {
        mIsDragging = false;
        mDragMode = null;
        mOldPointer = null;
        mStartPose = null;
        mStartPivot = null;
        mAnchorGuess = null;
    }

    function onPointerMove(evt) {
        if (mIsDragging && mOldPointer && evt.wpnt) {
            if (!(evt.buttons & 1)) {
                endDrag();
                checkCloseToPoint(evt);
                return;
            }
            const currentPointer = evt.wpnt;

            // every move from the drag's start: the drag is path independent
            if (mDragMode === 'rotateScale') {
                applyRotationAndScale(currentPointer);
            } else if (mDragMode === 'pivot') {
                changePivot(worldToPattern(currentPointer));
            } else if (mDragMode === 'translate') {
                applyTranslation(currentPointer);
            }

            onChanged();

            evt.preventDefault();
            evt.isConsumed = true;
        } else if (!mIsDragging) {
            checkCloseToPoint(evt);
        }
    }

    function onPointerUp(evt) {
        if (mIsDragging) {
            endDrag();
            checkCloseToPoint(evt);
            evt.preventDefault();
            evt.isConsumed = true;
        }
    }

    function onPointerLeave(evt) {
        if (!mIsDragging && mOverlay) {
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
        // the pose's maps, for the renderer and the tests
        patternToWorld,
        worldToPattern,
        isGeometric: geometric,
    };
}

export {
    PatternTransformHandler
};
