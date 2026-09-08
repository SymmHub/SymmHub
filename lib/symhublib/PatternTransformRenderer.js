/**
 * PatternTransformRenderer.js
 *
 * Responsible for UI visualization of the PatternTransformHandler's state.
 * Draws the bounding box, corner handles, and the custom pivot point.
 */
import { TORADIANS, sin, cos, iPoint } from './modules.js';

// Module-level constants for styling/colors
const COLOR_BOUNDS = 'rgba(0, 191, 255, 0.85)'; // Modern accent: deep sky blue glow
const COLOR_CORNER_FILL = '#FFFFFFAA';
const COLOR_CORNER_STROKE = 'rgba(0, 191, 255, 0.95)';
const COLOR_PIVOT = 'rgba(255, 140, 0, 0.9)'; // Sleek accent: dark orange
const COLOR_PIVOT_CROSSHAIR = 'rgba(255, 140, 0, 0.8)';
const COLOR_PIVOT_FILL = 'rgba(255, 255, 255, 0.5)';

const COLOR_RED_POINT = 'rgba(255, 0, 0, 0.9)';
const COLOR_RED_CROSSHAIR = 'rgba(255, 0, 0, 0.8)';
const COLOR_RED_FILL = 'rgba(255, 255, 255, 0.5)';

// Module-level constants for sizing
const SIZE_PIVOT_OUTER = 9;
const SIZE_PIVOT_INNER = 3;
const SIZE_PIVOT_CROSSHAIR = 14;
const SIZE_CORNER_RADIUS = 9.

// Configurations for drawPoint
const PIVOT_COLORS = {
    point: COLOR_PIVOT,
    crosshair: COLOR_PIVOT_CROSSHAIR,
    fill: COLOR_PIVOT_FILL
};

const RED_POINT_COLORS = {
    point: COLOR_RED_POINT,
    crosshair: COLOR_RED_CROSSHAIR,
    fill: COLOR_RED_FILL
};

const PIVOT_SIZES = {
    outer: SIZE_PIVOT_OUTER,
    inner: SIZE_PIVOT_INNER,
    crosshair: SIZE_PIVOT_CROSSHAIR
};

/**
 * Draws the dashed bounding box around pattern bounds.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<number>>} cornersScreen
 * @param {string} color - Stroke color for bounding box
 */
function drawBounds(ctx, cornersScreen) {
    function tracePath() {
        ctx.beginPath();
        ctx.moveTo(cornersScreen[0][0], cornersScreen[0][1]);
        for (let i = 1; i < cornersScreen.length; i++) {
            ctx.lineTo(cornersScreen[i][0], cornersScreen[i][1]);
        }
        ctx.closePath();
    }

    ctx.save();
    ctx.setLineDash([]);

    // Wide white pass — visible on dark/coloured backgrounds
    tracePath();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // Thin black pass on top — visible on white/light backgrounds
    tracePath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.stroke();

    ctx.restore();
}

/**
 * Draws a point (pivot or double click target) with rings and crosshairs.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px - Point screen X coordinate
 * @param {number} py - Point screen Y coordinate
 * @param {Object} colors - Object containing point, crosshair, and fill colors
 * @param {Object} sizes - Object containing outer, inner, and crosshair sizes
 */
function drawPoint(ctx, px, py, colors, sizes) {
    ctx.save();
    ctx.setLineDash([]);

    // Outer ring — white halo, then black stroke on top
    ctx.beginPath();
    ctx.arc(px, py, sizes.outer + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, sizes.outer, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.0)';   // transparent fill — ring only
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Inner center dot — white halo, then black fill on top
    ctx.beginPath();
    ctx.arc(px, py, sizes.inner + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, sizes.inner, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fill();

    // Crosshairs — wide white first, thin black on top
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(px - sizes.crosshair, py);
    ctx.lineTo(px + sizes.crosshair, py);
    ctx.moveTo(px, py - sizes.crosshair);
    ctx.lineTo(px, py + sizes.crosshair);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.moveTo(px - sizes.crosshair, py);
    ctx.lineTo(px + sizes.crosshair, py);
    ctx.moveTo(px, py - sizes.crosshair);
    ctx.lineTo(px, py + sizes.crosshair);
    ctx.stroke();

    ctx.restore();
}


/**
 * Draws the corner handles as simple filled circles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<number>>} cornersScreen
 * @param {string} strokeColor - Stroke color for corner handles
 */
function drawCorners(ctx, cornersScreen) {
    ctx.save();
    ctx.setLineDash([]);
    cornersScreen.forEach(corner => {
        const cx = corner[0];
        const cy = corner[1];

        // White halo ring behind the black handle
        ctx.beginPath();
        ctx.arc(cx, cy, SIZE_CORNER_RADIUS + 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();

        // Black filled handle on top
        ctx.beginPath();
        ctx.arc(cx, cy, SIZE_CORNER_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
    ctx.restore();
}

/**
 * Draws a lighter outline for a secondary (per-image texture) box, with a
 * small centre tick. Style is deliberately distinct from the main pattern box.
 */
function drawImageBox(ctx, cornersScreen, centerScreen, active) {
    function tracePath() {
        ctx.beginPath();
        ctx.moveTo(cornersScreen[0][0], cornersScreen[0][1]);
        for (let i = 1; i < cornersScreen.length; i++)
            ctx.lineTo(cornersScreen[i][0], cornersScreen[i][1]);
        ctx.closePath();
    }
    ctx.save();
    ctx.setLineDash(active ? [] : [6, 4]);      // selected image -> solid outline

    tracePath();
    ctx.lineWidth = active ? 4 : 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    tracePath();
    ctx.lineWidth = active ? 2 : 1.25;
    ctx.strokeStyle = 'rgba(255, 140, 0, 0.95)'; // dark-orange, matches pivot accent
    ctx.stroke();

    if (centerScreen) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(centerScreen[0], centerScreen[1], active ? 4.5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 140, 0, 0.95)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.stroke();
    }
    ctx.restore();
}

/** Corner grab handles for an image box (dimmer than the pattern-box handles). */
function drawImageHandles(ctx, cornersScreen, active) {
    ctx.save();
    ctx.setLineDash([]);
    const r = active ? 6 : 4.5;
    for (const [cx, cy] of cornersScreen) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = active ? 'rgba(255, 140, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        ctx.fill();
        ctx.lineWidth = active ? 2 : 1.25;
        ctx.strokeStyle = 'rgba(170, 85, 0, 0.95)';
        ctx.stroke();
    }
    ctx.restore();
}

function PatternTransformRenderer(params) {
    const mConfig = params.config;
    const mHandler = params.handler;
    // Optional: () => [{centerX,centerY,scale,angle,id}, ...] in pattern/buffer
    // space. Drawn as secondary dashed boxes (e.g. one per texture image).
    const mGetExtraBoxes = params.getExtraBoxes || null;
    // Optional: () => {minX,minY,maxX,maxY} in pattern space. When present the
    // main box/handles use this union rect instead of [-1,1]^2.
    const mGetPatternBox = params.getPatternBox || null;

    /**
     * Map a point from pattern space coordinates to world space coordinates
     * based on translation, rotation, scale, and origin of the pattern.
     */
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

    /**
     * Render the UI elements on the 2D overlay canvas.
     *
     * @param {CanvasRenderingContext2D} ctx - The 2D overlay canvas context.
     * @param {CanvasTransform} canvasTransform - Coordinate conversion utility.
     */
    function renderUI(ctx, canvasTransform) {
        if (!canvasTransform || !ctx) return;

        // Pattern-space box corners. Default is [-1,1]x[-1,1]; when a
        // getPatternBox() supplier is present (multi-image pattern) the box is
        // the axis-aligned union of the image boxes instead.
        const pb = mGetPatternBox ? mGetPatternBox() : null;
        const cornersPattern = pb
            ? [
                [pb.minX, pb.maxY],   // Top-Left
                [pb.maxX, pb.maxY],   // Top-Right
                [pb.maxX, pb.minY],   // Bottom-Right
                [pb.minX, pb.minY],   // Bottom-Left
              ]
            : [
                [-1, 1], [1, 1], [1, -1], [-1, -1]
              ];

        // Map corners from pattern -> world -> screen space
        const cornersScreen = cornersPattern.map(p => {
            const wp = patternToWorld(p);
            return canvasTransform.world2screen(wp);
        });

        // Matches [pivotX, pivotY] in pattern space mapped to world coordinates
        const pivotWorld = patternToWorld([mConfig.pivotX || 0, mConfig.pivotY || 0]);
        const pivotScreen = canvasTransform.world2screen(pivotWorld);

        // Draw boundaries, pivot, and corner handles
        drawBounds(ctx, cornersScreen);
        drawPoint(ctx, pivotScreen[0], pivotScreen[1], PIVOT_COLORS, PIVOT_SIZES);
        drawCorners(ctx, cornersScreen);

        // Secondary boxes — each texture image's placement box.
        // Box corners are u∈[±1,±1] -> center + scale·R(angle)·u  in pattern
        // space, then patternToWorld() (the global pattern transform).
        if (mGetExtraBoxes) {
            const UNIT_CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
            const boxes = mGetExtraBoxes() || [];
            const sel = (mHandler && mHandler.getSelection) ? mHandler.getSelection() : null;
            for (const b of boxes) {
                const a = (b.angle || 0) * TORADIANS;
                const s = b.scale === undefined ? 1 : b.scale;
                const ca = cos(a), sa = sin(a);
                const local = ([ux, uy]) => [
                    (b.centerX || 0) + s * (ca * ux - sa * uy),
                    (b.centerY || 0) + s * (sa * ux + ca * uy),
                ];
                const cs = UNIT_CORNERS.map(u =>
                    canvasTransform.world2screen(patternToWorld(local(u))));
                const centerScreen = canvasTransform.world2screen(
                    patternToWorld([b.centerX || 0, b.centerY || 0]));

                const active = !!(sel && sel.kind === 'image' && sel.id === b.id);
                drawImageBox(ctx, cs, centerScreen, active);
                drawImageHandles(ctx, cs, active);
            }
        }

        // Draw double click point and its image point if present
        if (mHandler) {
            const dbPoint = mHandler.getDoubleClickPoint();
            const dbImage = mHandler.getDoubleClickImage();
            if (dbPoint) {
                const dbPointScreen = canvasTransform.world2screen(dbPoint);
                drawPoint(ctx, dbPointScreen[0], dbPointScreen[1], RED_POINT_COLORS, PIVOT_SIZES);
            }
            if (dbImage) {
                const dbImageScreen = canvasTransform.world2screen(dbImage);
                drawPoint(ctx, dbImageScreen[0], dbImageScreen[1], RED_POINT_COLORS, PIVOT_SIZES);
            }

            // Draw image of the pattern box under inverse of the mFundDomainTransform
            const fundDomainTrans = mHandler.getFundDomainTransform();
            if (fundDomainTrans) {
                const invT = fundDomainTrans.getInverse();

                // 1. Map corners: pattern -> world -> invT -> screen
                const cornersScreenTransformed = cornersPattern.map(p => {
                    const wp = patternToWorld(p);
                    const tip = invT.transform(iPoint(wp));
                    const twp = [tip.v[0], tip.v[1]];
                    return canvasTransform.world2screen(twp);
                });

                // 2. Map pivot: pattern -> world -> invT -> screen
                const tipPivot = invT.transform(iPoint(pivotWorld));
                const twpPivot = [tipPivot.v[0], tipPivot.v[1]];
                const pivotScreenTransformed = canvasTransform.world2screen(twpPivot);

                // 3. Draw bounds, corners, and pivot point under the inverse transform
                drawBounds(ctx, cornersScreenTransformed);
                drawCorners(ctx, cornersScreenTransformed);
                drawPoint(ctx, pivotScreenTransformed[0], pivotScreenTransformed[1], RED_POINT_COLORS, PIVOT_SIZES);
            }
        }
    }

    return {
        renderUI: renderUI
    };
}

export {
    PatternTransformRenderer
};
