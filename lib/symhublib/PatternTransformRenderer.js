/**
 * PatternTransformRenderer.js
 *
 * Responsible for UI visualization of the PatternTransformHandler's state.
 * Draws the bounding box, internal axes, and the custom pivot (origin) point.
 */
import { TORADIANS, sin, cos } from './modules.js';

function PatternTransformRenderer(params) {
    const mConfig = params.config;

    /**
     * Map a point from pattern space coordinates to world space coordinates
     * based on translation, rotation, scale, and origin of the pattern.
     */
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

    /**
     * Render the UI elements on the 2D overlay canvas.
     * 
     * @param {CanvasRenderingContext2D} ctx - The 2D overlay canvas context.
     * @param {CanvasTransform} canvasTransform - Coordinate conversion utility.
     */
    function renderUI(ctx, canvasTransform) {
        if (!canvasTransform || !ctx) return;

        // Define pattern space corners ([-1, 1] x [-1, 1])
        const cornersPattern = [
            [-1, 1],   // Top-Left
            [1, 1],    // Top-Right
            [1, -1],   // Bottom-Right
            [-1, -1]   // Bottom-Left
        ];

        // Map corners from pattern -> world -> screen space
        const cornersScreen = cornersPattern.map(p => {
            const wp = patternToWorld(p);
            return canvasTransform.world2screen(wp);
        });

        ctx.save();

        // 1. Draw dashed bounding box around pattern bounds
        ctx.beginPath();
        ctx.moveTo(cornersScreen[0][0], cornersScreen[0][1]);
        for (let i = 1; i < cornersScreen.length; i++) {
            ctx.lineTo(cornersScreen[i][0], cornersScreen[i][1]);
        }
        ctx.closePath();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.85)'; // Modern accent: deep sky blue glow
        ctx.setLineDash([6, 4]);
        ctx.stroke();

        // 2. Draw pattern space coordinate axes crosshairs (passing through [0, 0] in pattern space)
        const axisPattern = [
            [-1, 0], [1, 0], // X axis
            [0, -1], [0, 1]  // Y axis
        ];
        const axisScreen = axisPattern.map(p => {
            const wp = patternToWorld(p);
            return canvasTransform.world2screen(wp);
        });

        ctx.beginPath();
        ctx.moveTo(axisScreen[0][0], axisScreen[0][1]);
        ctx.lineTo(axisScreen[1][0], axisScreen[1][1]);
        ctx.moveTo(axisScreen[2][0], axisScreen[2][1]);
        ctx.lineTo(axisScreen[3][0], axisScreen[3][1]);

        ctx.lineWidth = 1.0;
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.4)';
        ctx.setLineDash([2, 4]);
        ctx.stroke();

        // 3. Draw custom pivot point (origin)
        // Matches [centerX, centerY] in world coordinates
        const pivotWorld = [mConfig.centerX || 0, mConfig.centerY || 0];
        const pivotScreen = canvasTransform.world2screen(pivotWorld);
        const px = pivotScreen[0];
        const py = pivotScreen[1];

        // Reset dash for pivot drawing
        ctx.setLineDash([]);

        // Outer circular ring/glow
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)'; // Sleek accent: dark orange
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Inner pivot center dot
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 140, 0, 0.9)';
        ctx.fill();

        // Pivot crosshairs
        ctx.beginPath();
        ctx.moveTo(px - 14, py);
        ctx.lineTo(px + 14, py);
        ctx.moveTo(px, py - 14);
        ctx.lineTo(px, py + 14);
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 4. Draw corner handles (simple circles)
        cornersScreen.forEach(corner => {
            const cx = corner[0];
            const cy = corner[1];
            
            ctx.beginPath();
            ctx.arc(cx, cy, 5.0, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 191, 255, 0.95)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        ctx.restore();
    }

    return {
        renderUI: renderUI
    };
}

export {
    PatternTransformRenderer
};
