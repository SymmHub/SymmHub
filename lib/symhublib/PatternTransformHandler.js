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
 *
 * A pattern of several images (sympix's PatternImageArray) gives the places
 * of its images through params.getImageTransforms(): [{id, get, set}], the
 * shown ones only; get() is {centerX, centerY, scale, angle}, the image's
 * square in the pattern box (half side scale, turned by angle degrees). The
 * pattern box is selected at first, so a drag inside it moves it as before. A
 * click (no drag) on the selection selects the next thing under the pointer:
 * the images from the topmost down, then the box again; a press on an image
 * away from the selection selects the topmost image there. The selected image
 * moves with the body and turns and scales about its centre with its corners,
 * in the coordinates of the pattern box (the pose carries it to the world, bent
 * with the box); the box keeps its own corners and pivot.
 *
 * The pivot and the corners are found by the distance in pixels between the
 * pointer's world point and theirs, by the view's scale at the pointer
 * (params.scaleAt(canvasPnt): world units per pixel there, the local scale under
 * a projection of the view), so the handles are where the picture shows them.
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
    TORADIANS,
    TODEGREE,
} from './modules.js';

const DEBUG = false;
const PLANE = { kind: 'euclidean' };
// the geometries of the group at the last points asked for (a drag asks for its pivot on every move)
const GEOMETRIES_KEPT = 32;
// the reach of the pivot and the corner handles, screen pixels
const HANDLE_PX = 12;
// a press that moves less than this many pixels is a click
const CLICK_PX = 3;

function PatternTransformHandler(params) {

    const mConfig = params.config;
    const mOnChanged = params.onChanged;
    const mCanvasTransform = params.canvasTransform;
    const mOverlay = params.overlay;
    const mCursorMove = params.cursorMove || 'move';
    const mCursorTransform = params.cursorTransform || 'pointer';
    const mCanBend = params.canBend || (() => false);
    // world units per canvas pixel at a canvas point: the view's local scale, else the canvas transform's
    const mScaleAt = params.scaleAt || ((cpnt) => (mCanvasTransform && mCanvasTransform.getPixelSize) ? mCanvasTransform.getPixelSize() : 1);
    // the places of the pattern's images: [{id, get, set}] or null
    const mGetImageTransforms = params.getImageTransforms || (() => null);

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
    // the selected image's id, null: the pattern box
    let mSelectedId = null;
    let mImageTarget = null;        // the image a drag moves
    let mStartImage = null;         // its place at the drag's start
    let mClickCycles = false;       // the press was on the selected image: a click selects the next one
    let mDidDrag = false;

    // -- the images of the pattern ----------------------------------------------

    function imageTargets() {
        const list = mGetImageTransforms();
        return Array.isArray(list) ? list : [];
    }

    function findImage(id) {
        if (id === null) return null;
        return imageTargets().find(t => t.id === id) || null;
    }

    /** a point u of the square [-1, 1]^2 in the pattern box, by the image's place c */
    function imageToPattern(c, u) {
        const a = (c.angle || 0) * TORADIANS, s = (c.scale === undefined) ? 1 : c.scale;
        const ca = Math.cos(a), sa = Math.sin(a);
        return [(c.centerX || 0) + s * (ca * u[0] - sa * u[1]), (c.centerY || 0) + s * (sa * u[0] + ca * u[1])];
    }

    /** a point p of the pattern box in the image's square */
    function patternToImage(c, p) {
        const a = (c.angle || 0) * TORADIANS, s = ((c.scale === undefined) ? 1 : c.scale) || 1.e-9;
        const ca = Math.cos(a), sa = Math.sin(a);
        const dx = p[0] - (c.centerX || 0), dy = p[1] - (c.centerY || 0);
        return [(ca * dx + sa * dy) / s, (-sa * dx + ca * dy) / s];
    }

    function insideSquare(u) {
        return u[0] >= -1 && u[0] <= 1 && u[1] >= -1 && u[1] <= 1;
    }

    /** the images under the pattern point p, the topmost (the last) first, then the pattern box (null) */
    function candidatesAt(p) {
        const out = imageTargets().filter(t => insideSquare(patternToImage(t.get(), p))).map(t => t.id).reverse();
        if (insideSquare(p)) out.push(null);
        return out;
    }

    /**
     * the outlines of the shown images in the world (a bent box bends them too):
     * [{id, selected, outline, corners}], perEdge points to an edge from a corner round
     */
    function getImageOutlines(perEdge = 12) {
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
        return imageTargets().map(t => {
            const c = t.get();
            const outline = [];
            for (let e = 0; e < 4; e++) {
                const a = corners[e], b = corners[(e + 1) % 4];
                for (let i = 0; i < perEdge; i++) {
                    const k = i / perEdge;
                    outline.push(patternToWorld(imageToPattern(c, [a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])])));
                }
            }
            return { id: t.id, selected: t.id === mSelectedId, outline, corners: [0, 1, 2, 3].map(i => outline[i * perEdge]) };
        });
    }

    /** the selection: {kind: 'image', id} or {kind: 'pattern'} */
    function getSelection() {
        return findImage(mSelectedId) ? { kind: 'image', id: mSelectedId } : { kind: 'pattern' };
    }

    function select(id) {
        if (id === mSelectedId) return;
        mSelectedId = id;
        onChanged();
    }

    /** the image moved in the pattern box by the pointer's move there, from the drag's start */
    function applyImageTranslation(currentP) {
        const a = worldToPattern(mOldPointer), b = worldToPattern(currentP);
        mImageTarget.set({ centerX: (mStartImage.centerX || 0) + b[0] - a[0], centerY: (mStartImage.centerY || 0) + b[1] - a[1] });
    }

    /** the image turned and scaled about its centre by the pointer's turn and distance ratio there */
    function applyImageRotationAndScale(currentP) {
        const c = [mStartImage.centerX || 0, mStartImage.centerY || 0];
        const o = worldToPattern(mOldPointer), q = worldToPattern(currentP);
        const u = [o[0] - c[0], o[1] - c[1]], v = [q[0] - c[0], q[1] - c[1]];
        const ru = Math.hypot(u[0], u[1]), rv = Math.hypot(v[0], v[1]);
        if (ru < 1.e-9 || rv < 1.e-9) return;
        let angle = (mStartImage.angle || 0) + TODEGREE * Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
        angle = ((angle + 180) % 360 + 360) % 360 - 180;
        const scale = ((mStartImage.scale === undefined) ? 1 : mStartImage.scale) * rv / ru;
        mImageTarget.set({ angle, scale });
    }

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

    /** the drag's start: the pose and the pivot's place in the world; the image a drag moves, if any */
    function startDrag(mode, wpnt, image = null) {
        mDragMode = mode;
        mOldPointer = wpnt;
        mIsDragging = true;
        mDidDrag = false;
        mImageTarget = image;
        mStartImage = image ? { ...image.get() } : null;
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

    /** pixels between the world points a and b at the canvas point cpnt */
    function pxDistance(a, b, cpnt) {
        const s = mScaleAt(cpnt) || 1;
        return sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])) / s;
    }

    /** the handle under the pointer (its world point wpnt at the canvas point cpnt): the pivot first, then a corner */
    function getInteractionTarget(wpnt, cpnt) {
        if (!wpnt) return null;

        // 1. Check pivot point
        const pivotWorld = patternToWorld([mConfig.pivotX || 0, mConfig.pivotY || 0]);
        if (pxDistance(wpnt, pivotWorld, cpnt) <= HANDLE_PX) {
            return { mode: 'pivot' };
        }

        // 2. Check the selected image's corners, then the box's
        const cornersPattern = [
            [-1, 1], [1, 1], [1, -1], [-1, -1]
        ];
        const image = findImage(mSelectedId);
        if (image) {
            const c = image.get();
            for (const u of cornersPattern) {
                if (pxDistance(wpnt, patternToWorld(imageToPattern(c, u)), cpnt) <= HANDLE_PX) {
                    return { mode: 'rotateScale', image };
                }
            }
        }
        for (const p of cornersPattern) {
            if (pxDistance(wpnt, patternToWorld(p), cpnt) <= HANDLE_PX) {
                return { mode: 'rotateScale' };
            }
        }

        return null;
    }

    function checkCloseToPoint(evt) {
        if (!mOverlay || evt.canvasX === undefined || evt.canvasY === undefined) return;
        const target = getInteractionTarget(evt.wpnt, [evt.canvasX, evt.canvasY]);
        if (target) {
            mOverlay.style.cursor = 'pointer';
            return;
        }

        // Check if inside the pattern box or an image
        if (evt.wpnt) {
            const tpnt = worldToPattern(evt.wpnt);
            if (candidatesAt(tpnt).length) {
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
                const checkRes = getInteractionTarget(evt.wpnt, [evt.canvasX, evt.canvasY]);
                mClickCycles = false;
                if (checkRes) {
                    startDrag(checkRes.mode, evt.wpnt, checkRes.image || null);
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
                        // the selection stays when it is under the pointer (a click then selects the next one), else the topmost
                        const cands = candidatesAt(tpnt);
                        const current = findImage(mSelectedId) ? mSelectedId : null;
                        if (cands.length) {
                            mClickCycles = cands.length > 1 && cands.includes(current);
                            if (!cands.includes(current)) select(cands[0]);
                            startDrag('translate', evt.wpnt, findImage(mSelectedId));
                            evt.preventDefault();
                            evt.isConsumed = true;
                        } else {
                            select(null);
                        }
                    }
                }
            }
        }
    }

    function endDrag() {
        mImageTarget = null;
        mStartImage = null;
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

            // a press that has not left its place yet is still a click
            if (!mDidDrag) {
                const cpnt = (evt.canvasX !== undefined) ? [evt.canvasX, evt.canvasY] : null;
                if (cpnt && pxDistance(mOldPointer, currentPointer, cpnt) < CLICK_PX) {
                    evt.preventDefault();
                    evt.isConsumed = true;
                    return;
                }
            }
            mDidDrag = true;
            mClickCycles = false;
            // every move from the drag's start: the drag is path independent
            if (mImageTarget) {
                if (mDragMode === 'rotateScale') applyImageRotationAndScale(currentPointer);
                else applyImageTranslation(currentPointer);
            } else if (mDragMode === 'rotateScale') {
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
            // a click on the selected image: the next one under the pointer, the box after the last
            if (!mDidDrag && mClickCycles && mOldPointer) {
                const cands = candidatesAt(worldToPattern(mOldPointer));
                const i = cands.indexOf(findImage(mSelectedId) ? mSelectedId : null);
                if (i >= 0) select(cands[(i + 1) % cands.length]);
            }
            mClickCycles = false;
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
        // the images of the pattern, for the renderer and the tests
        getSelection,
        getImageOutlines,
        selectImage: (id) => select(findImage(id) ? id : null),
    };
}

export {
    PatternTransformHandler
};
