/**
 * PatternTransformRenderer.js
 *
 * Responsible for UI visualization of the PatternTransformHandler's state.
 * Draws the bounding box, corner handles, and the custom pivot point.
 */
import { TORADIANS, sin, cos } from './modules.js';

// Module-level constants for styling/colors
const COLOR_BOUNDS = 'rgba(0, 191, 255, 0.85)'; // Modern accent: deep sky blue glow
const COLOR_CORNER_FILL = '#FFFFFFAA';
const COLOR_CORNER_STROKE = 'rgba(0, 191, 255, 0.95)';
const COLOR_PIVOT = 'rgba(255, 140, 0, 0.9)'; // Sleek accent: dark orange
const COLOR_PIVOT_CROSSHAIR = 'rgba(255, 140, 0, 0.8)';
const COLOR_PIVOT_FILL = 'rgba(255, 255, 255, 0.5)';

// Module-level constants for sizing
const SIZE_PIVOT_OUTER = 9;
const SIZE_PIVOT_INNER = 3;
const SIZE_PIVOT_CROSSHAIR = 14;
const SIZE_CORNER_RADIUS = 7.

/**
 * Draws the dashed bounding box around pattern bounds.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<number>>} cornersScreen
 */
function drawBounds(ctx, cornersScreen) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cornersScreen[0][0], cornersScreen[0][1]);
    for (let i = 1; i < cornersScreen.length; i++) {
        ctx.lineTo(cornersScreen[i][0], cornersScreen[i][1]);
    }
    ctx.closePath();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLOR_BOUNDS;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
}

/**
 * Draws the custom pivot point (origin) with rings and crosshairs.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px - Pivot screen X coordinate
 * @param {number} py - Pivot screen Y coordinate
 */
function drawPivot(ctx, px, py) {
    ctx.save();
    ctx.setLineDash([]);

    // Outer circular ring/glow
    ctx.beginPath();
    ctx.arc(px, py, SIZE_PIVOT_OUTER, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR_PIVOT_FILL;
    ctx.fill();

    ctx.strokeStyle = COLOR_PIVOT;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Inner pivot center dot
    ctx.beginPath();
    ctx.arc(px, py, SIZE_PIVOT_INNER, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR_PIVOT;
    ctx.fill();

    // Pivot crosshairs
    ctx.beginPath();
    ctx.moveTo(px - SIZE_PIVOT_CROSSHAIR, py);
    ctx.lineTo(px + SIZE_PIVOT_CROSSHAIR, py);
    ctx.moveTo(px, py - SIZE_PIVOT_CROSSHAIR);
    ctx.lineTo(px, py + SIZE_PIVOT_CROSSHAIR);
    ctx.strokeStyle = COLOR_PIVOT_CROSSHAIR;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
}

/**
 * Draws the corner handles as simple filled circles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<number>>} cornersScreen
 */
function drawCorners(ctx, cornersScreen) {
    ctx.save();
    cornersScreen.forEach(corner => {
        const cx = corner[0];
        const cy = corner[1];

        ctx.beginPath();
        ctx.arc(cx, cy, SIZE_CORNER_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = COLOR_CORNER_FILL;
        ctx.fill();
        ctx.strokeStyle = COLOR_CORNER_STROKE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
    ctx.restore();
}

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

        // Matches [centerX, centerY] in world coordinates
        const pivotWorld = [mConfig.centerX || 0, mConfig.centerY || 0];
        const pivotScreen = canvasTransform.world2screen(pivotWorld);

        // Draw boundaries, pivot, and corner handles
        drawBounds(ctx, cornersScreen);
        drawPivot(ctx, pivotScreen[0], pivotScreen[1]);
        drawCorners(ctx, cornersScreen);
    }

    return {
        renderUI: renderUI
    };
}

export {
    PatternTransformRenderer
};
