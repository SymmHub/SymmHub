/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 */
import { sqrt, cos, sin, atan2, TORADIANS, TODEGREE, normalizeAngle } from './modules.js';
const DEBUG = false;

function PatternTransformHandler(params) {
    const mConfig = params.config;
    const mOnChanged = params.onChanged;
    const mCanvasTransform = params.canvasTransform;
    const mOverlay = params.overlay;
    const mCursorMove = params.cursorMove || 'move';
    const mCursorTransform = params.cursorTransform || 'pointer';

    let mOldPointer = null;
    let mIsDragging = false;
    let mDragMode = null; // can be 'translate', 'rotateScale', 'pivot', or null

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
        
        if (distPivot <= 12) {
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
            if (dist <= 12) {
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
                    mDragMode = checkRes.mode;
                    mOldPointer = evt.wpnt;
                    mIsDragging = true;
                    
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
                            mDragMode = 'translate';
                            mOldPointer = evt.wpnt;
                            mIsDragging = true;
                            
                            evt.preventDefault();
                            evt.isConsumed = true;
                        }
                    }
                }
            }
        }
    }

    function onPointerMove(evt) {
        if (mIsDragging && mOldPointer && evt.wpnt) {
            if (!(evt.buttons & 1)) {
                mIsDragging = false;
                mDragMode = null;
                mOldPointer = null;
                checkCloseToPoint(evt);
                return;
            }
            const currentPointer = evt.wpnt;

            if (mDragMode === 'rotateScale') {
                applyRotationAndScale(mOldPointer, currentPointer);
            } else if (mDragMode === 'pivot') {
                changePivot(worldToPattern(currentPointer));
            } else if (mDragMode === 'translate') {
                applyTranslation(mOldPointer, currentPointer);
            }

            mOldPointer = currentPointer;

            onChanged();

            evt.preventDefault();
            evt.isConsumed = true;
        } else if (!mIsDragging) {
            checkCloseToPoint(evt);
        }
    }

    function onPointerUp(evt) {
        if (mIsDragging) {
            mIsDragging = false;
            mDragMode = null;
            mOldPointer = null;
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
        }
    }

    return {
        handleEvent: handleEvent
    };
}

export {
    PatternTransformHandler
};
