/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 */
import { sqrt, cos, sin, atan2, PI, TORADIANS } from './modules.js';

const TODEGREE = 180 / PI;
const DEBUG = true;

function PatternTransformHandler(params) {
    const mConfig = params.config;
    const mOnChanged = params.onChanged;

    let oldPointer = null;
    let isDragging = false;

    function worldToPattern(wpnt) {
        if (!wpnt) return [0, 0];
        const angle = (mConfig.angle || 0) * TORADIANS;
        const scale = mConfig.scale || 1;
        const cx = mConfig.centerX || 0;
        const cy = mConfig.centerY || 0;
        const s = scale === 0 ? 0 : 1 / scale;
        // Pw = S*Pp + T  ->   Pp = Sinv*(Pw - T)
        const sa = sin(angle);
        const ca = cos(angle);
        let x = wpnt[0];
        let y = wpnt[1];
        x -= cx;
        y -= cy;
        const px = s * (ca * x + sa * y)
        const py = s * (-sa * x + ca * y)
        
        return [px, py];
    }

    function handleEvent(evt) {
        evt.preventDefault();
        evt.isConsumed = true;

        switch (evt.type) {
            case 'pointerdown':
                if (isDragging) break;
                if (evt.buttons & 1) { // Left-click drag
                    if (evt.wpnt) {
                        const tpnt = worldToPattern(evt.wpnt);
                        if(DEBUG) console.log(`PatternTransformHandler pointerdown - world coordinates: [${evt.wpnt[0].toFixed(4)}, ${evt.wpnt[1].toFixed(4)}], pattern coordinates: [${tpnt[0].toFixed(4)}, ${tpnt[1].toFixed(4)}]`);
                        if (tpnt[0] >= -1 && tpnt[0] <= 1 && tpnt[1] >= -1 && tpnt[1] <= 1) {
                            oldPointer = evt.wpnt;
                            isDragging = true;
                        }
                    }
                }
                break;

            case 'pointermove':
                if (isDragging && oldPointer && evt.wpnt) {
                    if (!(evt.buttons & 1)) {
                        isDragging = false;
                        oldPointer = null;
                        break;
                    }
                    const currentPointer = evt.wpnt;

                    if (evt.shiftKey) {
                        // Rotation and scaling around the pattern center
                        const cx = mConfig.centerX;
                        const cy = mConfig.centerY;

                        const dx1 = oldPointer[0] - cx;
                        const dy1 = oldPointer[1] - cy;
                        const dx2 = currentPointer[0] - cx;
                        const dy2 = currentPointer[1] - cy;

                        const r1 = sqrt(dx1 * dx1 + dy1 * dy1);
                        const r2 = sqrt(dx2 * dx2 + dy2 * dy2);

                        if (r1 > 0.001 && r2 > 0.001) {
                            const a1 = atan2(dy1, dx1);
                            const a2 = atan2(dy2, dx2);
                            let da = a2 - a1;

                            // Normalize angle delta to [-PI, PI]
                            while (da > PI) da -= 2 * PI;
                            while (da < -PI) da += 2 * PI;

                            mConfig.angle += da * TODEGREE;
                            
                            // Normalize angle to [-180, 180]
                            while (mConfig.angle > 180) mConfig.angle -= 360;
                            while (mConfig.angle < -180) mConfig.angle += 360;

                            mConfig.scale *= (r2 / r1);
                        }
                    } else {
                        // Translation
                        const dx = currentPointer[0] - oldPointer[0];
                        const dy = currentPointer[1] - oldPointer[1];

                        mConfig.centerX += dx;
                        mConfig.centerY += dy;
                    }

                    oldPointer = currentPointer;

                    if (mOnChanged) {
                        mOnChanged();
                    }
                }
                break;

            case 'pointerup':
                isDragging = false;
                oldPointer = null;
                break;

            case 'wheel':
                const factor = evt.deltaY < 0 ? 1.1 : 0.9;
                mConfig.scale *= factor;
                if (mOnChanged) {
                    mOnChanged();
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
