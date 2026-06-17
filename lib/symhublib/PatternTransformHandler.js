/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 */
import { sqrt, cos, sin, atan2, PI, TORADIANS, TODEGREE, normalizeAngle } from './modules.js';
const DEBUG = true;

function PatternTransformHandler(params) {
    const mConfig = params.config;
    const mOnChanged = params.onChanged;
    const mCanvasTransform = params.canvasTransform;
    const mOverlay = params.overlay;
    const mCursorMove = params.cursorMove || 'move';
    const mCursorTransform = params.cursorTransform || 'pointer';

    let oldPointer = null;
    let isDragging = false;
    let dragMode = null; // can be 'translate', 'rotateScale', 'pivot', or null

    function worldToPattern(wpnt) {
        if (!wpnt) return [0, 0];
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale || 1;
        const cx = mConfig.centerX || 0;
        const cy = mConfig.centerY || 0;
        const ox = mConfig.pivotX || 0;
        const oy = mConfig.pivotY || 0;
        const s = scale === 0 ? 0 : 1 / scale;
        // Pw = S*(Pp - O) + T  ->   Pp = Sinv*(Pw - T) + O
        const sa = sin(angle);
        const ca = cos(angle);
        let x = wpnt[0];
        let y = wpnt[1];
        x -= cx;
        y -= cy;
        const px = s * (ca * x + sa * y) + ox;
        const py = s * (-sa * x + ca * y) + oy;
        
        return [px, py];
    }

    function rotateAndScale(oldP, currentP) {
        const cx = mConfig.centerX;
        const cy = mConfig.centerY;

        const dx1 = oldP[0] - cx;
        const dy1 = oldP[1] - cy;
        const dx2 = currentP[0] - cx;
        const dy2 = currentP[1] - cy;

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
        }
    }

    function translate(oldP, currentP) {
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

    function changePivot(worldPoint, patternPoint) {
        mConfig.centerX = worldPoint[0];
        mConfig.centerY = worldPoint[1];
        mConfig.pivotX = patternPoint[0];
        mConfig.pivotY = patternPoint[1];
        mConfig.oldPivotX = patternPoint[0];
        mConfig.oldPivotY = patternPoint[1];
        onChanged();
    }

    function handleWheel(evt) {
        if (evt.shiftKey) {
            const angleDelta = evt.deltaY < 0 ? 1 : -1;
            mConfig.angle = TODEGREE * normalizeAngle((mConfig.angle + angleDelta) * TORADIANS);
        } else {
            const factor = evt.deltaY < 0 ? 1.1 : 0.9;
            mConfig.scale *= factor;
        }
        onChanged();
    }

    function patternToWorld(ppnt) {
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale !== undefined ? mConfig.scale : 1;
        const cx = mConfig.centerX || 0;
        const cy = mConfig.centerY || 0;
        const ox = mConfig.pivotX || 0;
        const oy = mConfig.pivotY || 0;

        const sa = sin(angle);
        const ca = cos(angle);

        const dx = scale * (ca * (ppnt[0] - ox) - sa * (ppnt[1] - oy));
        const dy = scale * (sa * (ppnt[0] - ox) + ca * (ppnt[1] - oy));

        return [dx + cx, dy + cy];
    }

    function getInteractionTarget(pointerX, pointerY) {
        if (!mCanvasTransform) return null;

        // 1. Check pivot point
        const pivotWorld = [mConfig.centerX || 0, mConfig.centerY || 0];
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

    function handleEvent(evt) {
        if (evt.type === 'wheel') {
            return;
        }

        switch (evt.type) {
            case 'pointerdown':
                if (isDragging) break;
                if (evt.buttons & 1) { // Left-click
                    if (evt.wpnt && evt.canvasX !== undefined && evt.canvasY !== undefined) {
                        const checkRes = getInteractionTarget(evt.canvasX, evt.canvasY);
                        if (checkRes) {
                            dragMode = checkRes.mode;
                            oldPointer = evt.wpnt;
                            isDragging = true;
                            
                            evt.preventDefault();
                            evt.isConsumed = true;
                        } else {
                            const tpnt = worldToPattern(evt.wpnt);
                            if(DEBUG) console.log(`PatternTransformHandler pointerdown - world coordinates: [${evt.wpnt[0].toFixed(4)}, ${evt.wpnt[1].toFixed(4)}], pattern coordinates: [${tpnt[0].toFixed(4)}, ${tpnt[1].toFixed(4)}]`);
                            if (evt.ctrlKey) {
                                changePivot(evt.wpnt, tpnt);
                                evt.preventDefault();
                                evt.isConsumed = true;
                            } else {
                                if (tpnt[0] >= -1 && tpnt[0] <= 1 && tpnt[1] >= -1 && tpnt[1] <= 1) {
                                    dragMode = 'translate';
                                    oldPointer = evt.wpnt;
                                    isDragging = true;
                                    
                                    evt.preventDefault();
                                    evt.isConsumed = true;
                                }
                            }
                        }
                    }
                }
                break;

            case 'pointermove':
                if (isDragging && oldPointer && evt.wpnt) {
                    if (!(evt.buttons & 1)) {
                        isDragging = false;
                        dragMode = null;
                        oldPointer = null;
                        checkCloseToPoint(evt);
                        break;
                    }
                    const currentPointer = evt.wpnt;

                    if (dragMode === 'rotateScale') {
                        rotateAndScale(oldPointer, currentPointer);
                    } else if (dragMode === 'pivot') {
                        changePivot(currentPointer, worldToPattern(currentPointer));
                    } else if (dragMode === 'translate') {
                        translate(oldPointer, currentPointer);
                    }

                    oldPointer = currentPointer;

                    onChanged();

                    evt.preventDefault();
                    evt.isConsumed = true;
                } else if (!isDragging) {
                    checkCloseToPoint(evt);
                }
                break;

            case 'pointerup':
                if (isDragging) {
                    isDragging = false;
                    dragMode = null;
                    oldPointer = null;
                    checkCloseToPoint(evt);
                    evt.preventDefault();
                    evt.isConsumed = true;
                }
                break;

            case 'pointerleave':
            case 'pointerout':
                if (!isDragging && mOverlay) {
                    mOverlay.style.cursor = Array.isArray(mCursorMove) ? mCursorMove.join(', ') : mCursorMove;
                }
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
