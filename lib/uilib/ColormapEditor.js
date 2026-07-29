import {
    createInternalWindow,
    ColorInput,
    DatGUI,
    convertPointsToIntervals,
    convertIntervalsToPoints,
    drawHorizontalRuler,
} from './modules.js';

/**
 * Converts RGBA array [0..1] to hex string #rrggbbaa
 */
function rgbaToHex(rgba) {
    if (!rgba) return '#000000ff';
    const r = Math.round(Math.max(0, Math.min(1, rgba[0] ?? 0)) * 255).toString(16).padStart(2, '0');
    const g = Math.round(Math.max(0, Math.min(1, rgba[1] ?? 0)) * 255).toString(16).padStart(2, '0');
    const b = Math.round(Math.max(0, Math.min(1, rgba[2] ?? 0)) * 255).toString(16).padStart(2, '0');
    const a = Math.round(Math.max(0, Math.min(1, rgba[3] ?? 1)) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
}

/**
 * Converts hex string #rrggbb or #rrggbbaa to RGBA array [0..1]
 */
function hexToRgba(hex) {
    if (!hex) return [0, 0, 0, 1];
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    const a = hex.length >= 9 ? parseInt(hex.substring(7, 9), 16) / 255 : 1.0;
    return [r, g, b, a];
}

/**
 * Rebuild colormap.data from intervals array
 */
function rebuildData(intervals, colormap) {
    // Ensure intervals are sorted by x0 and x0 < x1
    intervals.sort((a, b) => a.x0 - b.x0);
    intervals.forEach(iv => {
        if (iv.x1 <= iv.x0) iv.x1 = parseFloat(Math.min(1.0, iv.x0 + 0.001).toFixed(4));
    });

    const data = convertIntervalsToPoints(intervals);
    const existingTex = (colormap.data && colormap.data.tex) ? colormap.data.tex : (colormap.tex || null);
    colormap.data = data;
    colormap.intervals = intervals;
    if (existingTex) {
        colormap.data.tex = existingTex;
        colormap.tex = existingTex;
    }
    colormap.dirty = true; // Mark colormap dirty for GPU texture re-upload
    return colormap;
}

/**
 * Color blending helper matching GLSL shader logic (linear -> gamma -> premult)
 */
function toLinear(c) {
    return [
        Math.pow(Math.max(0, c[0]), 2.2),
        Math.pow(Math.max(0, c[1]), 2.2),
        Math.pow(Math.max(0, c[2]), 2.2),
        c[3] ?? 1.0
    ];
}

function toGamma(c) {
    return [
        Math.pow(Math.max(0, c[0]), 1 / 2.2),
        Math.pow(Math.max(0, c[1]), 1 / 2.2),
        Math.pow(Math.max(0, c[2]), 1 / 2.2),
        c[3] ?? 1.0
    ];
}

function sampleColormapAt(intervals, x) {
    if (!intervals || intervals.length === 0) return [0, 0, 0, 0];

    x = Math.max(0, Math.min(1, x));

    for (const iv of intervals) {
        if (x >= iv.x0 && x <= iv.x1) {
            const span = iv.x1 - iv.x0;
            if (span <= 1e-6) return [...iv.color0];
            const factor = (x - iv.x0) / span;

            const c0 = toLinear(iv.color0);
            const c1 = toLinear(iv.color1);

            const blendedLinear = [
                c0[0] + (c1[0] - c0[0]) * factor,
                c0[1] + (c1[1] - c0[1]) * factor,
                c0[2] + (c1[2] - c0[2]) * factor,
                c0[3] + (c1[3] - c0[3]) * factor
            ];

            return toGamma(blendedLinear);
        }
    }

    // Gap area -> transparent
    return [0, 0, 0, 0];
}

/**
 * Copies colormap JSON data directly to system clipboard
 */
async function copyColormapToClipboard(colormap, intervals, btn) {
    const exportObj = {
        name: colormap.name || 'Custom',
        intervals: intervals.map(iv => ({
            x0: Number(iv.x0.toFixed(4)),
            x1: Number(iv.x1.toFixed(4)),
            color0: iv.color0.map(v => Number(v.toFixed(4))),
            color1: iv.color1.map(v => Number(v.toFixed(4)))
        }))
    };
    const jsonText = JSON.stringify(exportObj, null, 2);

    let success = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(jsonText);
            success = true;
        }
    } catch (err) {
        // Fallback if clipboard API blocked
    }

    if (!success) {
        fallbackCopyText(jsonText);
    }

    if (btn) {
        const oldTitle = btn.title;
        btn.title = 'Copied!';
        setTimeout(() => { btn.title = oldTitle; }, 1500);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(textarea);
}

/**
 * Validates whether parsed object is a valid colormap format ({ intervals: [...] } or { points: [...] })
 */
function isValidColormapData(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;

    // Check intervals format
    if (Array.isArray(parsed.intervals) && parsed.intervals.length > 0) {
        return parsed.intervals.every(iv => {
            if (!iv || typeof iv !== 'object') return false;
            const x0Valid = typeof iv.x0 === 'number' && !isNaN(iv.x0);
            const x1Valid = typeof iv.x1 === 'number' && !isNaN(iv.x1);
            const c0Valid = Array.isArray(iv.color0) && iv.color0.length >= 3 && iv.color0.every(v => typeof v === 'number' && !isNaN(v));
            const c1Valid = Array.isArray(iv.color1) && iv.color1.length >= 3 && iv.color1.every(v => typeof v === 'number' && !isNaN(v));
            return x0Valid && x1Valid && c0Valid && c1Valid;
        });
    }

    // Check points format
    if (Array.isArray(parsed.points) && parsed.points.length >= 2) {
        return parsed.points.every(pt => {
            if (!pt || typeof pt !== 'object') return false;
            const xValid = typeof pt.x === 'number' && !isNaN(pt.x);
            const colorValid = Array.isArray(pt.color) && pt.color.length >= 3 && pt.color.every(v => typeof v === 'number' && !isNaN(v));
            return xValid && colorValid;
        });
    }

    return false;
}

/**
 * Pastes colormap JSON data directly from system clipboard
 */
async function pasteColormapFromClipboard(colormap, intervals, notifyUpdate, btn) {
    let jsonText = '';
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            jsonText = await navigator.clipboard.readText();
        }
    } catch (err) {
        // Permissions blocked or unsupported
    }

    if (!jsonText) {
        jsonText = prompt('Paste Colormap JSON Data:');
    }

    if (!jsonText) return;

    try {
        const parsed = JSON.parse(jsonText.trim());
        if (!isValidColormapData(parsed)) {
            alert('Clipboard content is not a valid colormap JSON format.');
            return;
        }

        let newIntervals = null;
        if (Array.isArray(parsed.intervals)) {
            newIntervals = parsed.intervals.map(iv => ({
                x0: iv.x0,
                x1: iv.x1,
                color0: [iv.color0[0], iv.color0[1], iv.color0[2], iv.color0[3] ?? 1.0],
                color1: [iv.color1[0], iv.color1[1], iv.color1[2], iv.color1[3] ?? 1.0]
            }));
        } else if (Array.isArray(parsed.points)) {
            newIntervals = convertPointsToIntervals(parsed.points);
        }

        if (newIntervals && newIntervals.length > 0) {
            intervals.length = 0;
            newIntervals.forEach(iv => intervals.push(iv));
            if (parsed.name) colormap.name = parsed.name;
            notifyUpdate();
            if (btn) {
                const oldTitle = btn.title;
                btn.title = 'Pasted!';
                setTimeout(() => { btn.title = oldTitle; }, 1500);
            }
        } else {
            alert('Clipboard content is not a valid colormap JSON format.');
        }
    } catch (err) {
        alert('Invalid JSON syntax on clipboard: ' + err.message);
    }
}

export function createColormapEditor(options = {}) {
    const colormap = options.colormap || {
        name: 'Custom Colormap',
        tex: null,
        data: [
            [0, 0, 0, 0], [0, 0, 0, 1], [0, 0, 0, 1],
            [1, 0, 0, 0], [1, 1, 1, 1], [1, 1, 1, 1]
        ]
    };

    if (!colormap.intervals) {
        colormap.intervals = convertPointsToIntervals(colormap.data);
    }

    const onChangeCallback = options.onChange || null;
    const onCloseCallback = options.onClose || null;

    let minValue = (options.minValue !== undefined) ? options.minValue : 0.0;
    let maxValue = (options.maxValue !== undefined) ? options.maxValue : 1.0;

    function normToData(normX) {
        return minValue + normX * (maxValue - minValue);
    }

    function dataToNorm(dataVal) {
        const range = maxValue - minValue;
        if (Math.abs(range) < 1e-9) return 0.0;
        return (dataVal - minValue) / range;
    }

    let intervals = colormap.intervals;
    let selectedIndex = 0;
    let selectedHandle = 'bar'; // 'bar', 'x0', 'x1'
    let linkColors = false; // Link Start & End colors of selected interval
    let linkedIntervals = false; // Link touching intervals together
    let bgMode = 'checker'; // 'checker', 'white', 'black'
    let showRuler = true;   // boolean

    const SETTINGS_KEY = 'colormap_editor_settings';
    try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            if (parsed.bgMode !== undefined) bgMode = parsed.bgMode;
            if (parsed.showRuler !== undefined) showRuler = parsed.showRuler;
            if (parsed.linkedIntervals !== undefined) linkedIntervals = parsed.linkedIntervals;
        }
    } catch (e) {
        // ignore localStorage read errors
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({ bgMode, showRuler, linkedIntervals }));
        } catch (e) {
            // ignore localStorage write errors
        }
    }

    function selectInterval(index, handle = 'bar') {
        selectedIndex = index;
        selectedHandle = handle;
        updateControls();
        renderPreview();
        renderTrackAndHandles();
    }

    function setupWindowDrag(onMove) {
        function onUp() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    // Create InternalWindow
    const win = createInternalWindow({
        title: options.title || `Colormap Editor - ${colormap.name || 'Custom'}`,
        width: options.width || '560px',
        height: options.height || '520px',
        left: options.left || '100px',
        top: options.top || '100px',
        canClose: true,
        canResize: true,
        storageId: options.storageId || 'colormap_editor'
    });

    const interior = win.interior;
    interior.classList.add('colormap-editor-interior');

    // Top Controls Bar (Background mode & Preset/JSON buttons)
    const topBar = document.createElement('div');
    topBar.className = 'colormap-editor-topbar';

    const bgContainer = document.createElement('div');
    bgContainer.className = 'colormap-editor-flex-row';
    bgContainer.style.width = '100%';

    // Preview Background Mode Group (Checker, White, Black)
    const bgGroup = document.createElement('div');
    bgGroup.className = 'colormap-editor-flex-row';
    bgGroup.style.gap = '3px';

    const bgModes = [
        {
            id: 'checker',
            title: 'Checkerboard background',
            svg: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="0" y="0" width="8" height="8" fill="#888888"/><rect x="8" y="0" width="8" height="8" fill="#ffffff"/><rect x="0" y="8" width="8" height="8" fill="#ffffff"/><rect x="8" y="8" width="8" height="8" fill="#888888"/><rect x="0" y="0" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" rx="2"/></svg>`
        },
        {
            id: 'white',
            title: 'Solid white background',
            svg: `<svg width="14" height="14" viewBox="0 0 16 16"><rect width="16" height="16" fill="#ffffff" rx="2" stroke="currentColor" stroke-width="1.2"/></svg>`
        },
        {
            id: 'black',
            title: 'Solid black background',
            svg: `<svg width="14" height="14" viewBox="0 0 16 16"><rect width="16" height="16" fill="#000000" rx="2" stroke="currentColor" stroke-width="1.2"/></svg>`
        }
    ];

    const bgButtonsMap = {};

    function updateBgBtnsUI() {
        bgModes.forEach(m => {
            const btn = bgButtonsMap[m.id];
            if (btn) {
                const isCurrent = (bgMode === m.id);
                btn.className = isCurrent ? 'colormap-icon-btn pressed' : 'colormap-icon-btn';
                btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
            }
        });
    }

    bgModes.forEach(m => {
        const btn = document.createElement('button');
        btn.innerHTML = m.svg;
        btn.title = m.title;
        btn.onclick = () => {
            bgMode = m.id;
            updateBgBtnsUI();
            saveSettings();
            renderPreview();
        };
        bgButtonsMap[m.id] = btn;
        bgGroup.appendChild(btn);
    });
    updateBgBtnsUI();

    bgContainer.appendChild(bgGroup);

    const rulerBtn = document.createElement('button');
    function updateRulerBtnUI() {
        rulerBtn.className = showRuler ? 'colormap-icon-btn pressed' : 'colormap-icon-btn';
        rulerBtn.title = showRuler ? 'Hide Ruler' : 'Show Ruler';
        rulerBtn.setAttribute('aria-pressed', showRuler ? 'true' : 'false');
        rulerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path><path d="M6 5v5"></path><path d="M10 5v3"></path><path d="M14 5v5"></path><path d="M18 5v3"></path></svg>`;
    }
    rulerBtn.onclick = () => {
        showRuler = !showRuler;
        updateRulerBtnUI();
        saveSettings();
        renderPreview();
    };
    updateRulerBtnUI();
    bgContainer.appendChild(rulerBtn);

    const linkIntervalsBtn = document.createElement('button');
    function updateLinkIntervalsBtnUI() {
        linkIntervalsBtn.className = linkedIntervals ? 'colormap-icon-btn pressed' : 'colormap-icon-btn';
        linkIntervalsBtn.title = linkedIntervals ? 'Unlink Intervals' : 'Link Intervals';
        linkIntervalsBtn.setAttribute('aria-pressed', linkedIntervals ? 'true' : 'false');
        linkIntervalsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    }
    linkIntervalsBtn.onclick = () => {
        linkedIntervals = !linkedIntervals;
        updateLinkIntervalsBtnUI();
        saveSettings();
    };
    updateLinkIntervalsBtnUI();
    bgContainer.appendChild(linkIntervalsBtn);

    // Icon Action Buttons Group (Add, Remove, Split, Copy, Paste)
    const iconActionsGroup = document.createElement('div');
    iconActionsGroup.className = 'colormap-editor-flex-row';
    iconActionsGroup.style.gap = '4px';
    iconActionsGroup.style.marginLeft = 'auto';

    function createIconBtn(iconSvg, title, onClick, isDanger = false) {
        const btn = document.createElement('button');
        btn.innerHTML = iconSvg;
        btn.className = isDanger ? 'colormap-icon-btn colormap-icon-btn-danger' : 'colormap-icon-btn';
        btn.title = title;
        btn.onclick = onClick;
        return btn;
    }

    const addBtn = createIconBtn(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        'Add interval after current interval',
        () => addNewIntervalAfterSelected()
    );

    const delBtn = createIconBtn(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        'Remove active interval',
        () => {
            if (intervals.length <= 1) { alert('A colormap must have at least 1 interval.'); return; }
            intervals.splice(selectedIndex, 1);
            selectedIndex = Math.max(0, selectedIndex - 1);
            notifyUpdate();
        },
        true
    );

    const splitBtn = createIconBtn(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M21 3l-7.5 7.5"></path><path d="M3 21l7.5-7.5"></path></svg>`,
        'Split active interval into two equal halves',
        () => splitCurrentInterval()
    );

    const copyBtn = createIconBtn(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        'Copy colormap JSON data directly to clipboard',
        function() { copyColormapToClipboard(colormap, intervals, this); }
    );

    const pasteBtn = createIconBtn(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
        'Paste colormap JSON data directly from clipboard',
        function() { pasteColormapFromClipboard(colormap, intervals, notifyUpdate, this); }
    );

    iconActionsGroup.appendChild(addBtn);
    iconActionsGroup.appendChild(delBtn);
    iconActionsGroup.appendChild(splitBtn);
    iconActionsGroup.appendChild(copyBtn);
    iconActionsGroup.appendChild(pasteBtn);

    bgContainer.appendChild(iconActionsGroup);
    topBar.appendChild(bgContainer);
    interior.appendChild(topBar);

    // Canvas Preview Strip Container
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'colormap-editor-preview-wrapper';

    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'colormap-editor-preview-canvas';
    previewWrapper.appendChild(previewCanvas);

    const rulerCanvas = document.createElement('canvas');
    rulerCanvas.className = 'colormap-editor-ruler-canvas';
    previewWrapper.appendChild(rulerCanvas);

    interior.appendChild(previewWrapper);

    // Helper to style NumberControllerBox inputs consistently
    function styleNumberInput(ctrl) {
        if (ctrl && ctrl.__input) {
            ctrl.__input.style.width = '85px';
            ctrl.__input.style.padding = '2px 4px';
            ctrl.__input.style.border = '1px solid #ccc';
            ctrl.__input.style.borderRadius = '3px';
            ctrl.__input.style.textAlign = 'center';
            ctrl.__input.style.fontFamily = 'monospace, sans-serif';
        }
    }

    // Update x0 endpoint for interval `idx`
    function updateEndpointX0(idx, rawX, touchState, setTouchState, prevEnd) {
        const iv = intervals[idx];
        if (linkedIntervals && idx > 0) {
            const prevIv = intervals[idx - 1];
            if (!touchState && rawX <= prevIv.x1) {
                touchState = true;
                if (setTouchState) setTouchState(true);
            }
            if (touchState) {
                const minX = prevIv.x0 + 0.0001;
                const maxX = iv.x1 - 0.0001;
                const clampedX = parseFloat(Math.max(minX, Math.min(maxX, rawX)).toFixed(4));
                iv.x0 = clampedX;
                prevIv.x1 = clampedX;
            } else {
                const minX = prevIv.x1;
                const maxX = iv.x1 - 0.0001;
                iv.x0 = parseFloat(Math.max(minX, Math.min(maxX, rawX)).toFixed(4));
            }
        } else {
            iv.x0 = parseFloat(Math.max(prevEnd, Math.min(iv.x1 - 0.001, rawX)).toFixed(4));
        }
    }

    // Update x1 endpoint for interval `idx`
    function updateEndpointX1(idx, rawX, touchState, setTouchState, nextStart) {
        const iv = intervals[idx];
        if (linkedIntervals && idx < intervals.length - 1) {
            const nextIv = intervals[idx + 1];
            if (!touchState && rawX >= nextIv.x0) {
                touchState = true;
                if (setTouchState) setTouchState(true);
            }
            if (touchState) {
                const minX = iv.x0 + 0.0001;
                const maxX = nextIv.x1 - 0.0001;
                const clampedX = parseFloat(Math.max(minX, Math.min(maxX, rawX)).toFixed(4));
                iv.x1 = clampedX;
                nextIv.x0 = clampedX;
            } else {
                const minX = iv.x0 + 0.0001;
                const maxX = nextIv.x0;
                iv.x1 = parseFloat(Math.max(minX, Math.min(maxX, rawX)).toFixed(4));
            }
        } else {
            iv.x1 = parseFloat(Math.max(iv.x0 + 0.001, Math.min(nextStart, rawX)).toFixed(4));
        }
    }

    // Drag helper for x0 or x1 endpoint handle
    function handleEndpointDrag(idx, handle, rectLeft, rectWidth) {
        const iv = intervals[idx];
        const prevEnd = (idx > 0) ? intervals[idx - 1].x1 : 0.0;
        const nextStart = (idx < intervals.length - 1) ? intervals[idx + 1].x0 : 1.0;

        let xTouchState = null;
        if (handle === 'x0' && idx > 0) {
            xTouchState = (Math.abs(iv.x0 - intervals[idx - 1].x1) <= 0.0002);
        } else if (handle === 'x1' && idx < intervals.length - 1) {
            xTouchState = (Math.abs(iv.x1 - intervals[idx + 1].x0) <= 0.0002);
        }

        setupWindowDrag((me) => {
            const rawX = (me.clientX - rectLeft) / rectWidth;
            if (handle === 'x0') {
                updateEndpointX0(idx, rawX, xTouchState, (t) => { xTouchState = t; }, prevEnd);
            } else {
                updateEndpointX1(idx, rawX, xTouchState, (t) => { xTouchState = t; }, nextStart);
            }
            notifyUpdate();
        });
    }

    // Drag helper for whole interval bar
    function handleBarDrag(idx, startClientX, rectWidth) {
        const iv = intervals[idx];
        const startX0 = iv.x0, startX1 = iv.x1, len = startX1 - startX0;

        let leftGlued = (linkedIntervals && idx > 0 && Math.abs(startX0 - intervals[idx - 1].x1) <= 0.0002);
        let rightGlued = (linkedIntervals && idx < intervals.length - 1 && Math.abs(startX1 - intervals[idx + 1].x0) <= 0.0002);

        setupWindowDrag((me) => {
            const deltaX = (me.clientX - startClientX) / rectWidth;
            const targetX0 = startX0 + deltaX;
            const targetX1 = targetX0 + len;

            let minX0 = 0.0, maxX1 = 1.0;

            if (linkedIntervals && idx > 0) {
                const prevIv = intervals[idx - 1];
                if (!leftGlued && targetX0 <= prevIv.x1) leftGlued = true;
                minX0 = leftGlued ? (prevIv.x0 + 0.0001) : prevIv.x1;
            } else {
                minX0 = (idx > 0) ? intervals[idx - 1].x1 : 0.0;
            }

            if (linkedIntervals && idx < intervals.length - 1) {
                const nextIv = intervals[idx + 1];
                if (!rightGlued && targetX1 >= nextIv.x0) rightGlued = true;
                maxX1 = rightGlued ? (nextIv.x1 - 0.0001) : nextIv.x0;
            } else {
                maxX1 = (idx < intervals.length - 1) ? intervals[idx + 1].x0 : 1.0;
            }

            const clampedX0 = parseFloat(Math.max(minX0, Math.min(maxX1 - len, targetX0)).toFixed(4));
            const clampedX1 = parseFloat((clampedX0 + len).toFixed(4));

            iv.x0 = clampedX0;
            iv.x1 = clampedX1;

            if (linkedIntervals && idx > 0) {
                const prevIv = intervals[idx - 1];
                if (leftGlued || clampedX0 <= prevIv.x1 + 0.0001) prevIv.x1 = clampedX0;
            }

            if (linkedIntervals && idx < intervals.length - 1) {
                const nextIv = intervals[idx + 1];
                if (rightGlued || clampedX1 >= nextIv.x0 - 0.0001) nextIv.x0 = clampedX1;
            }

            notifyUpdate();
        });
    }

    // Mouse down on preview canvas to select and drag interval or endpoints
    previewCanvas.onmousedown = (e) => {
        const rect = previewCanvas.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const handleThreshold = 12 / rect.width;
        let hitIndex = -1, hitHandle = 'bar';

        if (intervals[selectedIndex]) {
            const iv = intervals[selectedIndex];
            if (Math.abs(clickX - iv.x0) <= handleThreshold) { hitIndex = selectedIndex; hitHandle = 'x0'; }
            else if (Math.abs(clickX - iv.x1) <= handleThreshold) { hitIndex = selectedIndex; hitHandle = 'x1'; }
        }

        if (hitIndex === -1) {
            for (let i = 0; i < intervals.length; i++) {
                const iv = intervals[i];
                if (Math.abs(clickX - iv.x0) <= handleThreshold) { hitIndex = i; hitHandle = 'x0'; break; }
                else if (Math.abs(clickX - iv.x1) <= handleThreshold) { hitIndex = i; hitHandle = 'x1'; break; }
            }
        }

        if (hitIndex === -1) {
            for (let i = 0; i < intervals.length; i++) {
                if (clickX >= intervals[i].x0 && clickX <= intervals[i].x1) { hitIndex = i; hitHandle = 'bar'; break; }
            }
        }

        if (hitIndex !== -1) {
            e.preventDefault();
            selectInterval(hitIndex, hitHandle);

            if (hitHandle === 'bar') {
                handleBarDrag(selectedIndex, e.clientX, rect.width);
            } else {
                handleEndpointDrag(selectedIndex, hitHandle, rect.left, rect.width);
            }
        }
    };

    previewCanvas.ondblclick = () => addNewIntervalAfterSelected();

    // Timeline Track & Handles Container
    const trackContainer = document.createElement('div');
    trackContainer.className = 'colormap-editor-track-container';

    // Track baseline line
    const trackLine = document.createElement('div');
    trackLine.className = 'colormap-editor-track-line';
    trackContainer.appendChild(trackLine);

    // Double click track line or container to add interval
    trackContainer.ondblclick = (e) => {
        if (e.target !== trackContainer && e.target !== trackLine) return;
        addNewIntervalAfterSelected();
    };

    interior.appendChild(trackContainer);

    // Detail Editor Box (selected interval info, x0, x1, ColorInputs, actions)
    const detailBox = document.createElement('div');
    detailBox.className = 'colormap-editor-detail-box';
    interior.appendChild(detailBox);

    // 2-Column Grid Layout for Line 1 (Headers & Ends x0, x1)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'colormap-editor-grid-2col';

    // Column Headers: Start (Col 1) and End (Col 2)
    const headerStart = document.createElement('div');
    headerStart.textContent = 'Start';
    headerStart.className = 'colormap-editor-col-header';
    gridContainer.appendChild(headerStart);

    const headerEnd = document.createElement('div');
    headerEnd.textContent = 'End';
    headerEnd.className = 'colormap-editor-col-header';
    gridContainer.appendChild(headerEnd);

    // Start Column (x0)
    const colStart = document.createElement('div');
    colStart.className = 'colormap-editor-col';

    const x0Proxy = {
        get position() {
            if (!intervals[selectedIndex]) return minValue;
            return normToData(intervals[selectedIndex].x0);
        },
        set position(val) {
            if (!intervals[selectedIndex]) return;
            const normVal = dataToNorm(val);
            const prevEnd = (selectedIndex > 0) ? intervals[selectedIndex - 1].x1 : 0.0;
            const isTouching = (selectedIndex > 0 && Math.abs(intervals[selectedIndex].x0 - prevEnd) <= 0.0002);
            updateEndpointX0(selectedIndex, normVal, isTouching, null, prevEnd);
            notifyUpdate();
        }
    };

    const x0Controller = new DatGUI.controllers.NumberControllerBox(x0Proxy, 'position', { min: minValue, max: maxValue });
    styleNumberInput(x0Controller);
    colStart.appendChild(x0Controller.domElement);
    gridContainer.appendChild(colStart);

    // End Column (x1)
    const colEnd = document.createElement('div');
    colEnd.className = 'colormap-editor-col';

    const x1Proxy = {
        get position() {
            if (!intervals[selectedIndex]) return maxValue;
            return normToData(intervals[selectedIndex].x1);
        },
        set position(val) {
            if (!intervals[selectedIndex]) return;
            const normVal = dataToNorm(val);
            const nextStart = (selectedIndex < intervals.length - 1) ? intervals[selectedIndex + 1].x0 : 1.0;
            const isTouching = (selectedIndex < intervals.length - 1 && Math.abs(intervals[selectedIndex].x1 - nextStart) <= 0.0002);
            updateEndpointX1(selectedIndex, normVal, isTouching, null, nextStart);
            notifyUpdate();
        }
    };

    const x1Controller = new DatGUI.controllers.NumberControllerBox(x1Proxy, 'position', { min: minValue, max: maxValue });
    styleNumberInput(x1Controller);
    colEnd.appendChild(x1Controller.domElement);
    colEnd.appendChild(x1Controller.domElement);
    gridContainer.appendChild(colEnd);

    detailBox.appendChild(gridContainer);

    // Line 2: Colors Row (Start Color Input, Center Link Button, End Color Input)
    const colorsRow = document.createElement('div');
    colorsRow.className = 'colormap-editor-colors-row';

    // Start Color Group
    const startGroup = document.createElement('div');
    startGroup.className = 'colormap-editor-color-group';

    const startColorDiv = document.createElement('div');
    startGroup.appendChild(startColorDiv);

    const startColorInput = new ColorInput(startColorDiv, true);
    startColorInput.setFontSize(12);
    startColorInput.setWidths(85, 30, 80);

    startColorInput.onChange = (hexColor) => {
        if (!intervals[selectedIndex]) return;
        const rgba = hexToRgba(hexColor);
        intervals[selectedIndex].color0 = rgba;
        if (linkColors) {
            intervals[selectedIndex].color1 = [...rgba];
            endColorInput.setValue(rgbaToHex(rgba));
        }
        notifyUpdate();
    };
    colorsRow.appendChild(startGroup);

    // Link / Unlink Button centered between color controls
    const linkBtn = document.createElement('button');
    
    function updateLinkBtnUI() {
        linkBtn.className = linkColors ? 'colormap-editor-link-btn pressed' : 'colormap-editor-link-btn';
        linkBtn.title = linkColors ? 'Unlink Start & End Colors' : 'Link Start & End Colors';
        linkBtn.setAttribute('aria-pressed', linkColors ? 'true' : 'false');
        linkBtn.innerHTML = linkColors
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#222222" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a5 5 0 0 0-7.07 0l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-1.65-1.16"></path><path d="M9.64 17.36a5 5 0 0 0 7.07 0l1.71-1.71"></path><path d="M10 13a5 5 0 0 0 1.65 1.16"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;
    }

    linkBtn.onclick = () => {
        linkColors = !linkColors;
        updateLinkBtnUI();
        if (linkColors && intervals[selectedIndex]) {
            intervals[selectedIndex].color1 = [...intervals[selectedIndex].color0];
            endColorInput.setValue(rgbaToHex(intervals[selectedIndex].color0));
            notifyUpdate();
        }
    };
    updateLinkBtnUI();
    colorsRow.appendChild(linkBtn);

    // End Color Group
    const endGroup = document.createElement('div');
    endGroup.className = 'colormap-editor-color-group';

    const endColorDiv = document.createElement('div');
    endGroup.appendChild(endColorDiv);

    const endColorInput = new ColorInput(endColorDiv, true);
    endColorInput.setFontSize(12);
    endColorInput.setWidths(85, 30, 80);

    endColorInput.onChange = (hexColor) => {
        if (!intervals[selectedIndex]) return;
        const rgba = hexToRgba(hexColor);
        intervals[selectedIndex].color1 = rgba;
        if (linkColors) {
            intervals[selectedIndex].color0 = [...rgba];
            startColorInput.setValue(rgbaToHex(rgba));
        }
        notifyUpdate();
    };
    colorsRow.appendChild(endGroup);

    detailBox.appendChild(colorsRow);



    // Split current interval into 2 equal-length sub-intervals with linearly interpolated midpoint colors
    function splitCurrentInterval() {
        if (!intervals || intervals.length === 0) return;
        intervals.sort((a, b) => a.x0 - b.x0);
        if (!intervals[selectedIndex]) return;

        const curIv = intervals[selectedIndex];
        const len = curIv.x1 - curIv.x0;
        if (len <= 0.0002) return;

        const midX = parseFloat(((curIv.x0 + curIv.x1) / 2).toFixed(4));
        const midColor = [
            (curIv.color0[0] + curIv.color1[0]) / 2,
            (curIv.color0[1] + curIv.color1[1]) / 2,
            (curIv.color0[2] + curIv.color1[2]) / 2,
            (curIv.color0[3] + curIv.color1[3]) / 2
        ];

        const leftIv = {
            x0: curIv.x0,
            x1: midX,
            color0: [...curIv.color0],
            color1: [...midColor]
        };

        const rightIv = {
            x0: midX,
            x1: curIv.x1,
            color0: [...midColor],
            color1: [...curIv.color1]
        };

        intervals.splice(selectedIndex, 1, leftIv, rightIv);
        selectedIndex = selectedIndex + 1;
        notifyUpdate();
    }

    // Add interval helper: adds a new interval immediately after and adjacent to the current active interval.
    // If available space after current interval is zero (<= 0.0001), the request is ignored.
    function addNewIntervalAfterSelected() {
        if (!intervals || intervals.length === 0) {
            intervals = [{ x0: 0.0, x1: 0.1, color0: [0, 0, 0, 1], color1: [1, 1, 1, 1] }];
            selectedIndex = 0;
            notifyUpdate();
            return;
        }

        intervals.sort((a, b) => a.x0 - b.x0);
        if (!intervals[selectedIndex]) {
            selectedIndex = 0;
        }

        const curIv = intervals[selectedIndex];
        const nextIv = (selectedIndex < intervals.length - 1) ? intervals[selectedIndex + 1] : null;
        const nextStart = nextIv ? nextIv.x0 : 1.0;

        const availableSpace = nextStart - curIv.x1;
        if (availableSpace <= 0.0001) {
            // Zero space right after current active interval -> ignore request
            return;
        }

        const curLen = curIv ? (curIv.x1 - curIv.x0) : 0.1;
        const desiredWidth = (curLen > 0.0001) ? curLen : 0.1;
        const actualWidth = Math.min(desiredWidth, availableSpace);
        if (actualWidth <= 0.0001) {
            return;
        }

        const newX0 = parseFloat(curIv.x1.toFixed(4));
        const newX1 = parseFloat(Math.min(nextStart, newX0 + actualWidth).toFixed(4));

        if (newX1 <= newX0 + 0.0001) {
            return;
        }

        const sampledColor = sampleColormapAt(intervals, newX0);
        const color = (sampledColor[3] === 0) ? [0.5, 0.5, 0.5, 1.0] : [...sampledColor];

        const newIv = {
            x0: newX0,
            x1: newX1,
            color0: [...color],
            color1: [...color]
        };

        intervals.push(newIv);
        intervals.sort((a, b) => a.x0 - b.x0);
        selectedIndex = intervals.indexOf(newIv);
        notifyUpdate();
    }

    // Render Canvas Preview Strip
    function renderPreview() {
        const pixelRatio = window.devicePixelRatio || 1;
        const widthCss = previewWrapper.clientWidth || 400;

        if (showRuler) {
            rulerCanvas.style.display = 'block';
            rulerCanvas.style.width = widthCss + 'px';
            rulerCanvas.style.height = '30px';
            previewCanvas.style.height = '48px';
        } else {
            rulerCanvas.style.display = 'none';
            previewCanvas.style.height = '78px';
        }
        previewCanvas.style.width = widthCss + 'px';

        const previewHeightCss = showRuler ? 48 : 78;
        const rulerHeightCss = 30;

        const widthReal = Math.round(widthCss * pixelRatio);
        const previewHeightReal = Math.round(previewHeightCss * pixelRatio);
        const rulerHeightReal = Math.round(rulerHeightCss * pixelRatio);

        previewCanvas.width = widthReal;
        previewCanvas.height = previewHeightReal;

        if (showRuler) {
            rulerCanvas.width = widthReal;
            rulerCanvas.height = rulerHeightReal;
        }

        const ctx = previewCanvas.getContext('2d');
        const imgData = ctx.createImageData(widthReal, previewHeightReal);
        const buf = imgData.data;

        const checkerSize = Math.round(8 * pixelRatio);

        for (let x = 0; x < widthReal; x++) {
            const t = (widthReal > 1) ? x / (widthReal - 1) : 0;
            const color = sampleColormapAt(intervals, t);

            const r = Math.round(color[0] * 255);
            const g = Math.round(color[1] * 255);
            const b = Math.round(color[2] * 255);
            const a = Math.max(0, Math.min(1, color[3] ?? 1.0));

            for (let y = 0; y < previewHeightReal; y++) {
                const off = (y * widthReal + x) * 4;

                let bgR = 255, bgG = 255, bgB = 255;
                if (bgMode === 'checker') {
                    const isEven = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0;
                    const val = isEven ? 210 : 255;
                    bgR = val; bgG = val; bgB = val;
                } else if (bgMode === 'black') {
                    bgR = 0; bgG = 0; bgB = 0;
                } else if (bgMode === 'white') {
                    bgR = 255; bgG = 255; bgB = 255;
                }

                buf[off]     = Math.round(r * a + bgR * (1 - a));
                buf[off + 1] = Math.round(g * a + bgG * (1 - a));
                buf[off + 2] = Math.round(b * a + bgB * (1 - a));
                buf[off + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        // Draw vertical lines at interval boundaries in real pixels
        ctx.lineWidth = Math.max(1, Math.round(pixelRatio));
        for (let i = 0; i < intervals.length; i++) {
            const iv = intervals[i];
            const px0 = Math.round(iv.x0 * widthReal);
            const px1 = Math.round(iv.x1 * widthReal);

            ctx.strokeStyle = (i === selectedIndex) ? '#ffff00' : 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.moveTo(px0 + 0.5, 0);
            ctx.lineTo(px0 + 0.5, previewHeightReal);
            ctx.moveTo(px1 + 0.5, 0);
            ctx.lineTo(px1 + 0.5, previewHeightReal);
            ctx.stroke();
        }

        // Draw Ruler below preview in real device pixels
        if (showRuler) {
            const rulerCtx = rulerCanvas.getContext('2d');
            drawHorizontalRuler(rulerCtx, rulerCanvas, {
                rulerXmin: minValue,
                rulerXmax: maxValue,
                hasRuler: true,
                hasLeftRuler: false,
                hasGrid: false,
                pixelRatio: pixelRatio,
                minInterval: 8,
                backgroundFill: '#e8e8e8ff'
            });
        }
    }

    // Render Timeline Track & Handles
    function renderTrackAndHandles() {
        trackContainer.querySelectorAll('.colormap-interval-bar, .colormap-handle').forEach(el => el.remove());

        intervals.forEach((iv, i) => {
            const isSel = (i === selectedIndex);

            // Interval Bar
            const bar = document.createElement('div');
            bar.className = isSel ? 'colormap-interval-bar selected' : 'colormap-interval-bar';
            bar.style.left = `${iv.x0 * 100}%`;
            bar.style.width = `${(iv.x1 - iv.x0) * 100}%`;
            bar.style.background = `linear-gradient(to right, ${rgbaToHex(iv.color0)}, ${rgbaToHex(iv.color1)})`;

            bar.onclick = (e) => { e.stopPropagation(); selectInterval(i, 'bar'); };
            bar.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                selectInterval(i, 'bar');
                const rect = trackContainer.getBoundingClientRect();
                handleBarDrag(i, e.clientX, rect.width);
            };
            trackContainer.appendChild(bar);

            // Handle x0
            const h0 = document.createElement('div');
            h0.className = (isSel && selectedHandle === 'x0') ? 'colormap-handle selected active' : (isSel ? 'colormap-handle selected' : 'colormap-handle');
            h0.style.left = `${iv.x0 * 100}%`;
            h0.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                selectInterval(i, 'x0');
                const rect = trackContainer.getBoundingClientRect();
                handleEndpointDrag(i, 'x0', rect.left, rect.width);
            };
            trackContainer.appendChild(h0);

            // Handle x1
            const h1 = document.createElement('div');
            h1.className = (isSel && selectedHandle === 'x1') ? 'colormap-handle selected active' : (isSel ? 'colormap-handle selected' : 'colormap-handle');
            h1.style.left = `${iv.x1 * 100}%`;
            h1.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                selectInterval(i, 'x1');
                const rect = trackContainer.getBoundingClientRect();
                handleEndpointDrag(i, 'x1', rect.left, rect.width);
            };
            trackContainer.appendChild(h1);
        });
    }

    // Update Controls Panel with selected interval values
    function updateControls() {
        if (!intervals[selectedIndex]) {
            selectedIndex = 0;
        }

        const iv = intervals[selectedIndex];
        if (!iv) return;

        x0Controller.updateDisplay();
        x1Controller.updateDisplay();

        startColorInput.setValue(rgbaToHex(iv.color0));
        endColorInput.setValue(rgbaToHex(iv.color1));

        delBtn.disabled = (intervals.length <= 1);
    }

    // Notify state changes
    function notifyUpdate(skipCallback = false) {
        rebuildData(intervals, colormap);
        updateControls();
        renderPreview();
        renderTrackAndHandles();
        if (!skipCallback && onChangeCallback) {
            onChangeCallback(colormap);
        }
    }

    // Handle Window Resize Observer to re-layout preview & handles
    const resizeObs = new ResizeObserver(() => {
        renderPreview();
        renderTrackAndHandles();
    });
    resizeObs.observe(previewWrapper);

    // Initial render
    updateControls();
    setTimeout(() => {
        renderPreview();
        renderTrackAndHandles();
    }, 50);

    return {
        window: win,
        getColormap: () => colormap,
        setColormap: (newCm) => {
            if (!newCm) return;
            colormap.data = newCm.data ? [...newCm.data] : null;
            colormap.name = newCm.name;
            if (newCm.intervals) {
                intervals = JSON.parse(JSON.stringify(newCm.intervals));
            } else {
                intervals = convertPointsToIntervals(colormap.data);
            }
            colormap.intervals = intervals;
            selectedIndex = 0;
            notifyUpdate(true);
        },
        setRange: (minV, maxV) => {
            minValue = (minV !== undefined) ? minV : 0.0;
            maxValue = (maxV !== undefined) ? maxV : 1.0;
            if (x0Controller && x0Controller.min) x0Controller.min(minValue);
            if (x0Controller && x0Controller.max) x0Controller.max(maxValue);
            if (x1Controller && x1Controller.min) x1Controller.min(minValue);
            if (x1Controller && x1Controller.max) x1Controller.max(maxValue);
            updateControls();
            renderPreview();
        },
        setVisible: (visible) => win.setVisible(visible),
        destroy: () => {
            resizeObs.disconnect();
            win.interior.innerHTML = '';
            if (onCloseCallback) onCloseCallback();
        }
    };
}
