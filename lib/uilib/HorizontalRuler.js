import {
    getParam,
    isDefined,
} from './modules.js';

import {
    BoxTransform
} from './BoxTransform.js';

const MIN_MARKS_INTERVAL = 8;
const RULER_FILL = '#e8e8e8ff';
const DEFAULT_RULER_WIDTH = 20;

function hp(x) {
    return Math.floor(x) + 0.5;
}

export function drawHorizontalRuler(context, canvas, params) {
    const gridStroke = '#555555ff';
    const textFill = '#222222ff';

    if (!isDefined(params)) params = {};

    let pixelRatio = params.pixelRatio || (window.devicePixelRatio || 1);
    let overlayWidth = canvas.width;
    let overlayHeight = canvas.height;

    let hasGrid = getParam(params.hasGrid, false);
    let hasRuler = getParam(params.hasRuler, true);
    let hasLeftRuler = getParam(params.hasLeftRuler, false);

    let rulerLeftMargin = (hasLeftRuler) ? (params.rulerWidth || DEFAULT_RULER_WIDTH) * pixelRatio : 0;
    let rulerHeight = overlayHeight;
    let rulerMarkWidth = Math.max(1, Math.round(1 * pixelRatio));

    let xRulerLength = overlayWidth - rulerLeftMargin;
    let yRulerLength = overlayHeight - rulerHeight;

    let rulerXmin = (params.rulerXmin !== undefined) ? params.rulerXmin : -1;
    let rulerYmin = (params.rulerYmin !== undefined) ? params.rulerYmin : -1;
    let rulerXmax = (params.rulerXmax !== undefined) ? params.rulerXmax : 1;
    let rulerYmax = (params.rulerYmax !== undefined) ? params.rulerYmax : 1;

    if (params.canvasTransform) {
        let canTrans = params.canvasTransform;
        let spt0 = [rulerLeftMargin, overlayHeight];
        let spt1 = [overlayWidth, 0];
        let wpt0 = [];
        let wpt1 = [];
        canTrans.invTransform(spt0, wpt0);
        canTrans.invTransform(spt1, wpt1);
        rulerXmin = wpt0[0];
        rulerYmin = wpt0[1];
        rulerXmax = wpt1[0];
        rulerYmax = wpt1[1];
    }

    let minIntervalPx = (params.minInterval || MIN_MARKS_INTERVAL) * pixelRatio;
    let markStepX = getRulerStep((rulerXmax - rulerXmin) / Math.max(1, xRulerLength), minIntervalPx);

    let decimalDigitsX = getDecimalDigits(markStepX);

    let fontSize = Math.round(10 * pixelRatio);
    let fontStyle = params.fontStyle || `${fontSize}px Verdana, sans-serif`;

    if (params.backgroundFill) {
        context.fillStyle = params.backgroundFill;
        context.fillRect(0, 0, overlayWidth, overlayHeight);
    }

    let markLen0 = 0.45;
    let markLen1 = 0.25;
    let markLen2 = 0.125;

    let ct = BoxTransform({
        wBox: { xmin: rulerXmin, xmax: rulerXmax, ymin: 0, ymax: 1 },
        sBox: { xmin: rulerLeftMargin, xmax: overlayWidth, ymin: 0, ymax: rulerHeight }
    });
    let ctGrid = BoxTransform({
        wBox: { xmin: rulerXmin, xmax: rulerXmax, ymin: rulerYmin, ymax: rulerYmax },
        sBox: { xmin: rulerLeftMargin, xmax: overlayWidth, ymin: overlayHeight - rulerHeight, ymax: 0 }
    });

    context.strokeStyle = gridStroke;
    context.fillStyle = textFill;
    context.lineWidth = rulerMarkWidth;
    context.lineCap = 'square';
    context.font = fontStyle;
    context.textAlign = 'center';
    context.textBaseline = 'top';

    let i0 = Math.ceil(rulerXmin / markStepX);
    let i1 = Math.floor(rulerXmax / markStepX);

    if (i0 > i1) {
        let ii = i0; i0 = i1; i1 = ii;
    }

    for (let i = i0; i <= i1; i++) {
        let drawNumber = false;
        let x = i * markStepX;
        let markWidth = rulerMarkWidth;

        let markLen = markLen2;
        if (((i | 0) % 10) === 0) {
            markLen = markLen0;
            drawNumber = true;
        } else if (((i | 0) % 5) === 0) {
            markWidth = Math.max(1, markWidth * 0.75);
            markLen = markLen1;
        } else {
            markWidth = Math.max(1, markWidth * 0.5);
        }

        if (hasRuler) {
            context.strokeStyle = gridStroke;
            context.fillStyle = textFill;
            let sp0 = ct.world2screen([x, 0]);
            let sp1 = ct.world2screen([x, markLen]);

            context.lineWidth = markWidth;
            context.beginPath();
            context.moveTo(hp(sp0[0]), hp(sp0[1]));
            context.lineTo(hp(sp1[0]), hp(sp1[1]));
            context.stroke();

            if (drawNumber) {
                let marginPx = 14 * pixelRatio;
                let labelX = Math.max(marginPx, Math.min(overlayWidth - marginPx, sp0[0]));
                context.fillText(x.toFixed(decimalDigitsX), labelX, hp(sp1[1]) + (2 * pixelRatio));
            }
        }

        if (hasGrid) {
            context.strokeStyle = gridStroke;
            context.lineWidth = Math.max(1, markWidth / 4);
            let sp0 = ctGrid.world2screen([x, rulerYmin]);
            let sp1 = ctGrid.world2screen([x, rulerYmax]);
            context.beginPath();
            context.moveTo(hp(sp0[0]), hp(sp0[1]));
            context.lineTo(hp(sp1[0]), hp(sp1[1]));
            context.stroke();
        }
    }
}

// Alias for backwards compatibility
export const drawGridAndRuler = drawHorizontalRuler;

function getDecimalDigits(markStep) {
    if (markStep <= 0) return 0;
    let logVal = Math.log10(markStep);
    if (logVal < 0) {
        return Math.min(6, Math.ceil(-logVal + 0.0001));
    }
    return 0;
}

export function getRulerStep(pixelSize, minInterval) {
    if (!minInterval) minInterval = MIN_MARKS_INTERVAL;
    let minMarkStep = Math.abs(minInterval * pixelSize);
    if (Math.abs(minMarkStep) <= 1.e-10) return 1;

    let logscale = Math.floor(Math.log10(minMarkStep));
    let scale = Math.pow(10, logscale);
    let fract = minMarkStep / scale;

    let markStep = scale;
    if (fract <= 1.0) {
        markStep = scale;
    } else if (fract <= 2.0) {
        markStep = 2 * scale;
    } else if (fract <= 5.0) {
        markStep = 5 * scale;
    } else {
        markStep = 10 * scale;
    }

    return markStep;
}
