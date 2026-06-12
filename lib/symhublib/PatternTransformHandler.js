/**
 * PatternTransformHandler.js
 *
 * Mouse/pointer gesture handler for interactively translating, rotating,
 * and scaling the pattern transform.
 */

function PatternTransformHandler(params) {
    const mConfig = params.config;
    const mOnChanged = params.onChanged;

    let oldPointer = null;
    let isDragging = false;

    function handleEvent(evt) {
        evt.preventDefault();
        evt.isConsumed = true;

        switch (evt.type) {
            case 'pointerdown':
                if (evt.buttons & 1) { // Left-click drag
                    oldPointer = evt.wpnt;
                    isDragging = true;
                }
                break;

            case 'pointermove':
                if (isDragging && oldPointer && evt.wpnt) {
                    const currentPointer = evt.wpnt;

                    if (evt.shiftKey) {
                        // Rotation and scaling around the pattern center
                        const cx = mConfig.centerX;
                        const cy = mConfig.centerY;

                        const dx1 = oldPointer[0] - cx;
                        const dy1 = oldPointer[1] - cy;
                        const dx2 = currentPointer[0] - cx;
                        const dy2 = currentPointer[1] - cy;

                        const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                        const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                        if (r1 > 0.001 && r2 > 0.001) {
                            const a1 = Math.atan2(dy1, dx1);
                            const a2 = Math.atan2(dy2, dx2);
                            let da = a2 - a1;

                            // Normalize angle delta to [-PI, PI]
                            while (da > Math.PI) da -= 2 * Math.PI;
                            while (da < -Math.PI) da += 2 * Math.PI;

                            mConfig.angle += da * 180 / Math.PI;
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
            case 'pointerout':
            case 'pointerleave':
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
