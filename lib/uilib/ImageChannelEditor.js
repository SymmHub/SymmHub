/**
 * ImageChannelEditor.js
 *
 * A window that paints a channel over a picture: the picture alone on a
 * canvas of its own (panned and zoomed, without anything around it), a
 * height field (HeightField.js, 0 to 1 per pixel) over it as a colour ramp or
 * contours, and brushes that paint the field. The owner gives the picture and
 * the channel and gets the channel back after every stroke; undo and redo are
 * the owner's (its stack holds the strokes), and the owner gives the channel
 * again after them (setChannel).
 *
 * Usage:
 *   const ed = createImageChannelEditor({ title: 'image', storageId: 'my_image_editor' });
 *   await ed.open({
 *       title:    'image p3',
 *       picture:  url,                 // the picture
 *       channel:  url | null,          // a grey PNG of the channel (red = value), null: all 0
 *       onStroke: (url) => { ... },    // after each stroke or command: the channel as a grey PNG data URL, null when all 0
 *       undo, redo,                    // the owner's undo and redo (Ctrl+Z, Ctrl+Y in the window too)
 *       controls: [...],               // PropertyBar controls of the owner's, after the window's own
 *   });
 *   ed.setChannel(url);                // the owner's channel changed (an undo): shown
 *   ed.close();
 *
 * The pointer: drag paints with the tool; the wheel zooms about the pointer;
 * middle drag or Space+drag pans; [ and ] change the radius. The field has the
 * channel's size, or without one the picture's, at most MAX_SIDE on its longer
 * side. "Only on the picture" scales the paint by the picture's alpha.
 */

import {
    createInternalWindow,
    createPropertyBar,
    createHeightField,
    heightFieldFromRGBA,
    heightFieldToRGBA,
    isFlatField,
    brushDab,
    brushStroke,
    gradientFill,
    invertField,
    fillField,
    fieldSizeFor,
} from './modules.js';

const MAX_SIDE = 1024;
// the overlay's contour lines: this many levels
const CONTOURS = 10;

const STYLE_ID = 'image-channel-editor-style';
const CSS = `
.image-channel-editor { display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; }
.image-channel-editor__view { position: relative; flex: 1 1 auto; min-height: 60px; overflow: hidden; background: #6b6b6b; outline: none; }
.image-channel-editor__view canvas { position: absolute; left: 0; top: 0; touch-action: none; }
`;

const S = 'fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;
const ICONS = {
    raise:    svg(`<path d="M3 20 C8 20 8 7 12 7 C16 7 16 20 21 20" ${S}/><path d="M12 4 V1 M10 3 L12 1 L14 3" ${S}/>`),
    lower:    svg(`<path d="M3 7 C8 7 8 20 12 20 C16 20 16 7 21 7" ${S}/><path d="M12 1 V4 M10 2 L12 4 L14 2" ${S}/>`),
    level:    svg(`<path d="M3 18 C6 18 7 10 9 10 H15 C17 10 18 18 21 18" ${S}/><path d="M6 6 H18" fill="none" stroke="#303030" stroke-width="1.2" stroke-dasharray="2 2"/>`),
    smooth:   svg(`<path d="M3 15 L6 9 L9 16 L12 8 L15 15 L18 10 L21 14" fill="none" stroke="#9a9a9a" stroke-width="1.2"/><path d="M3 13 C8 11 16 11 21 12" ${S}/>`),
    gradient: svg(`<defs><linearGradient id="icegr"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#303030"/></linearGradient></defs><rect x="3" y="6" width="18" height="12" fill="url(#icegr)" stroke="#303030" stroke-width="1.2"/>`),
    masked:   svg(`<path d="M12 3 C7 9 5 12 5 15 A7 7 0 0 0 19 15 C19 12 17 9 12 3 Z" ${S}/><path d="M9 15 A3 3 0 0 0 12 18" ${S}/>`),
    ramp:     svg(`<defs><linearGradient id="icerp"><stop offset="0" stop-color="#2b5cff"/><stop offset="0.5" stop-color="#ffe14d"/><stop offset="1" stop-color="#e8322b"/></linearGradient></defs><rect x="3" y="6" width="18" height="12" fill="url(#icerp)" stroke="#303030" stroke-width="1.2"/>`),
    contours: svg(`<ellipse cx="12" cy="12" rx="9" ry="7" ${S}/><ellipse cx="12" cy="12" rx="5.5" ry="4" ${S}/><ellipse cx="12" cy="12" rx="2" ry="1.4" ${S}/>`),
    noOverlay: svg(`<rect x="3" y="5" width="18" height="14" ${S}/><path d="M3 17 L9 11 L13 15 L16 12 L21 17" ${S}/>`),
    invert:   svg(`<path d="M3 16 C8 16 8 8 12 8 C16 8 16 16 21 16" ${S}/><path d="M3 8 C8 8 8 16 12 16 C16 16 16 8 21 8" fill="none" stroke="#9a9a9a" stroke-width="1.2"/>`),
    clear:    svg(`<path d="M3 17 H21" ${S}/><path d="M7 13 L17 3 M17 13 L7 3" fill="none" stroke="#9a9a9a" stroke-width="1.4" stroke-linecap="round"/>`),
    fitView:  svg(`<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" ${S}/>`),
    undo:     svg(`<path d="M9 14 L4 9 L9 4" ${S}/><path d="M4 9 H14 A6 6 0 0 1 14 21 H10" ${S}/>`),
    redo:     svg(`<path d="M15 14 L20 9 L15 4" ${S}/><path d="M20 9 H10 A6 6 0 0 0 10 21 H14" ${S}/>`),
};

const TOOLS = [
    { value: 'raise',    icon: ICONS.raise,    title: 'Raise: the height goes up under the brush' },
    { value: 'lower',    icon: ICONS.lower,    title: 'Lower: the height goes down under the brush' },
    { value: 'level',    icon: ICONS.level,    title: 'Level: the height goes towards the level under the brush' },
    { value: 'smooth',   icon: ICONS.smooth,   title: 'Smooth: the height evened out under the brush' },
    { value: 'gradient', icon: ICONS.gradient, title: 'Gradient: drag a ramp from 0 at the press to the level at the release, flat beyond its ends' },
];

const DEFAULT_BRUSH = { tool: 'raise', radius: 24, strength: 0.15, softness: 0.5, level: 0.5, masked: true, overlay: 'ramp', overlayOpacity: 0.55 };

function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/** the overlay's colour of a height h > 0: blue, yellow, red */
function rampColor(h){
    const stops = [[0, [43, 92, 255]], [0.5, [255, 225, 77]], [1, [232, 50, 43]]];
    for (let k = 1; k < stops.length; k++) {
        if (h <= stops[k][0]) {
            const [t0, c0] = stops[k - 1], [t1, c1] = stops[k];
            const t = (h - t0)/(t1 - t0);
            return c0.map((c, i) => c + (c1[i] - c)*t);
        }
    }
    return stops[stops.length - 1][1];
}

async function loadImage(url){
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    return img;
}

/**
 * @param {object} arg
 * @param {string} [arg.title]
 * @param {string} [arg.storageId]  where the window is put, its size, and the brush settings
 * @param {string} [arg.left]
 * @param {string} [arg.top]
 * @param {string} [arg.width]
 * @param {string} [arg.height]
 */
function createImageChannelEditor(arg = {}){
    ensureStyle();

    const brushKey = arg.storageId ? arg.storageId + '_brush' : null;
    const mBrush = { ...DEFAULT_BRUSH };
    try { if (brushKey) Object.assign(mBrush, JSON.parse(window.localStorage.getItem(brushKey) || '{}')); } catch (e) { /* no storage */ }
    const saveBrush = () => { try { if (brushKey) window.localStorage.setItem(brushKey, JSON.stringify(mBrush)); } catch (e) { /* no storage */ } };

    const win = createInternalWindow({
        title:     arg.title ?? 'image',
        left:      arg.left || '320px',
        top:       arg.top || '120px',
        width:     arg.width || '520px',
        height:    arg.height || '480px',
        canClose:  true,
        canResize: true,
        minWidth:  260,
        minHeight: 200,
        storageId: arg.storageId,
        onClose:   (w, visible) => { if (!visible) mOpen = null; },
    });
    win.interior.style.overflow = 'hidden';
    const root = document.createElement('div');
    root.className = 'image-channel-editor';
    const barHolder = document.createElement('div');
    const view = document.createElement('div');
    view.className = 'image-channel-editor__view';
    view.tabIndex = 0;
    const canvas = document.createElement('canvas');
    view.appendChild(canvas);
    root.appendChild(barHolder);
    root.appendChild(view);
    win.interior.appendChild(root);
    const bar = createPropertyBar({ container: barHolder, hint: false });

    // what is being edited: {picture, field, mask, undo, redo, onStroke, controls}
    let mOpen = null;
    let mLastUrl = null;            // the channel as last given or sent
    let mToken = 0;                 // the open() or setChannel() whose decoding counts
    const mPic = document.createElement('canvas');      // the picture at the field's size
    const mOver = document.createElement('canvas');     // the overlay at the field's size
    let mOverData = null;
    // the view: canvas px (CSS) per field px, the field's origin on the canvas
    const mView = { s: 1, ox: 0, oy: 0 };
    let mPointer = null;            // the pointer on the canvas (CSS px), for the brush circle
    let mDrag = null;               // {kind: 'paint' | 'gradient' | 'pan', ...}
    let mSpace = false;

    // ── the field and its picture ────────────────────────────────────────────

    function setFieldFromImage(img, w, h){
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h);
        return heightFieldFromRGBA(g.getImageData(0, 0, w, h).data, w, h);
    }

    /** the channel as a grey PNG data URL, null when all 0 */
    function channelUrl(){
        const f = mOpen.field;
        if (isFlatField(f)) return null;
        const c = document.createElement('canvas');
        c.width = f.width; c.height = f.height;
        c.getContext('2d').putImageData(new ImageData(heightFieldToRGBA(f), f.width, f.height), 0, 0);
        return c.toDataURL('image/png');
    }

    /** the overlay's pixels of the box [x0, y0, x1, y1] made again from the field (null: all of it) */
    function updateOverlay(box = null){
        if (!mOpen) return;
        const f = mOpen.field;
        let [x0, y0, x1, y1] = box || [0, 0, f.width, f.height];
        // a contour compares a pixel with the ones right and below: the column before and the row above change too
        x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
        const px = mOverData.data, d = f.data, w = f.width;
        const a = Math.round(255*mBrush.overlayOpacity);
        const band = (h) => Math.min(CONTOURS - 1, Math.floor(h*CONTOURS));
        for (let j = y0; j < y1; j++) {
            for (let i = x0; i < x1; i++) {
                const n = j*w + i, h = d[n];
                let c = null, alpha = 0;
                if (mBrush.overlay === 'ramp' && h > 0) { c = rampColor(h); alpha = a; }
                else if (mBrush.overlay === 'contours') {
                    const b = band(h);
                    const edge = (i + 1 < w && band(d[n + 1]) !== b) || (j + 1 < f.height && band(d[n + w]) !== b);
                    if (edge) { c = rampColor(Math.max(h, 0.05)); alpha = 255; }
                }
                px[4*n] = c ? c[0] : 0; px[4*n + 1] = c ? c[1] : 0; px[4*n + 2] = c ? c[2] : 0; px[4*n + 3] = alpha;
            }
        }
        mOver.getContext('2d').putImageData(mOverData, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }

    // ── the view ─────────────────────────────────────────────────────────────

    function canvasSize(){
        return [view.clientWidth, view.clientHeight];
    }

    function fitView(){
        if (!mOpen) return;
        const [W, H] = canvasSize();
        const f = mOpen.field;
        mView.s = Math.max(1e-3, 0.94*Math.min(W/f.width, H/f.height));
        mView.ox = 0.5*(W - f.width*mView.s);
        mView.oy = 0.5*(H - f.height*mView.s);
        draw();
    }

    const toField = (c) => [(c[0] - mView.ox)/mView.s, (c[1] - mView.oy)/mView.s];

    function draw(){
        const [W, H] = canvasSize();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(W*dpr) || canvas.height !== Math.round(H*dpr)) {
            canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        }
        const g = canvas.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (!mOpen) return;
        const f = mOpen.field;
        const w = f.width*mView.s, h = f.height*mView.s;
        // a checkerboard under the picture: its transparent parts show
        g.save();
        g.beginPath(); g.rect(mView.ox, mView.oy, w, h); g.clip();
        const cell = 8;
        for (let y = Math.floor(mView.oy/cell)*cell; y < mView.oy + h; y += cell) {
            for (let x = Math.floor(mView.ox/cell)*cell; x < mView.ox + w; x += cell) {
                g.fillStyle = ((x + y)/cell) % 2 ? '#d6d6d6' : '#f4f4f4';
                g.fillRect(x, y, cell, cell);
            }
        }
        g.restore();
        g.imageSmoothingEnabled = mView.s < 2;
        g.drawImage(mPic, mView.ox, mView.oy, w, h);
        if (mBrush.overlay !== 'none') g.drawImage(mOver, mView.ox, mView.oy, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
        g.strokeRect(mView.ox - 0.5, mView.oy - 0.5, w + 1, h + 1);
        if (mDrag && mDrag.kind === 'gradient' && mDrag.to) {
            const a = [mDrag.from[0]*mView.s + mView.ox, mDrag.from[1]*mView.s + mView.oy];
            const b = [mDrag.to[0]*mView.s + mView.ox, mDrag.to[1]*mView.s + mView.oy];
            g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
            g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
        }
        if (mPointer && mBrush.tool !== 'gradient' && !(mDrag && mDrag.kind === 'pan')) {
            const r = mBrush.radius*mView.s;
            g.lineWidth = 1;
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(mPointer[0], mPointer[1], r + 1, 0, 2*Math.PI); g.stroke();
            g.strokeStyle = 'rgba(0,0,0,0.9)'; g.beginPath(); g.arc(mPointer[0], mPointer[1], r, 0, 2*Math.PI); g.stroke();
            const core = r*(1 - mBrush.softness);
            if (core > 2 && core < r - 2) { g.setLineDash([3, 3]); g.beginPath(); g.arc(mPointer[0], mPointer[1], core, 0, 2*Math.PI); g.stroke(); g.setLineDash([]); }
        }
    }

    new ResizeObserver(() => draw()).observe(view);

    // ── painting ─────────────────────────────────────────────────────────────

    const brushOpt = () => ({ mode: mBrush.tool, radius: mBrush.radius, strength: mBrush.strength, softness: mBrush.softness,
                              level: mBrush.level, mask: mBrush.masked ? mOpen.mask : null });

    /** the channel changed by a stroke or a command: the overlay, the view, the owner told */
    function changed(box){
        updateOverlay(box);
        draw();
    }

    function emit(){
        mLastUrl = channelUrl();
        if (mOpen.onStroke) mOpen.onStroke(mLastUrl);
        bar.refresh();
    }

    /** a command on the whole channel (invert, clear), sent at once */
    function command(fn){
        if (!mOpen) return;
        changed(fn());
        emit();
    }

    // the drag keeps the pointer outside the canvas too (a pointer the browser does not know, as a test's, is not captured)
    function capture(id, on){
        try { if (on) canvas.setPointerCapture(id); else canvas.releasePointerCapture(id); } catch (err) { /* not an active pointer */ }
    }

    function pointerAt(e){
        const r = canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (!mOpen) return;
        view.focus({ preventScroll: true });
        const c = pointerAt(e);
        mPointer = c;
        if (e.button === 1 || (e.button === 0 && mSpace)) {
            mDrag = { kind: 'pan', c0: c, o0: [mView.ox, mView.oy] };
        } else if (e.button === 0) {
            const p = toField(c);
            if (mBrush.tool === 'gradient') mDrag = { kind: 'gradient', from: p, to: null };
            else {
                mDrag = { kind: 'paint', last: p, painted: false };
                const box = brushDab(mOpen.field, p[0], p[1], brushOpt());
                if (box) { mDrag.painted = true; changed(box); }
            }
        } else return;
        capture(e.pointerId, true);
        e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!mOpen) return;
        const c = pointerAt(e);
        mPointer = c;
        if (!mDrag) { draw(); return; }
        if (mDrag.kind === 'pan') {
            mView.ox = mDrag.o0[0] + c[0] - mDrag.c0[0];
            mView.oy = mDrag.o0[1] + c[1] - mDrag.c0[1];
            draw();
        } else if (mDrag.kind === 'gradient') {
            mDrag.to = toField(c);
            draw();
        } else {
            const p = toField(c);
            const box = brushStroke(mOpen.field, mDrag.last, p, brushOpt());
            mDrag.last = p;
            if (box) { mDrag.painted = true; changed(box); } else draw();
        }
    });

    function endDrag(e){
        if (!mDrag) return;
        const drag = mDrag;
        mDrag = null;
        if (e && e.pointerId !== undefined) capture(e.pointerId, false);
        if (!mOpen) return;
        if (drag.kind === 'gradient') {
            const to = e ? toField(pointerAt(e)) : drag.to;
            if (to && Math.hypot(to[0] - drag.from[0], to[1] - drag.from[1]) > 1) {
                changed(gradientFill(mOpen.field, drag.from, to, 0, mBrush.level, mBrush.masked ? mOpen.mask : null));
                emit();
            } else draw();
        } else if (drag.kind === 'paint') {
            if (drag.painted) emit();
        } else draw();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { if (!mDrag) { mPointer = null; draw(); } });

    canvas.addEventListener('wheel', (e) => {
        if (!mOpen) return;
        e.preventDefault();
        const c = pointerAt(e);
        const p = toField(c);
        const k = Math.exp(-e.deltaY*0.0015);
        mView.s = Math.min(64, Math.max(0.02, mView.s*k));
        mView.ox = c[0] - p[0]*mView.s;
        mView.oy = c[1] - p[1]*mView.s;
        draw();
    }, { passive: false });

    view.addEventListener('keydown', (e) => {
        if (!mOpen) return;
        const ctrl = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (ctrl && k === 'z' && !e.shiftKey) { mOpen.undo?.(); }
        else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { mOpen.redo?.(); }
        else if (e.key === '[') { mBrush.radius = Math.max(1, Math.round(mBrush.radius/1.25)); saveBrush(); bar.refresh(); draw(); }
        else if (e.key === ']') { mBrush.radius = Math.min(512, Math.round(mBrush.radius*1.25)); saveBrush(); bar.refresh(); draw(); }
        else if (e.key === ' ') { mSpace = true; }
        else return;
        e.preventDefault();
        e.stopPropagation();
    });
    view.addEventListener('keyup', (e) => { if (e.key === ' ') mSpace = false; });

    // ── the bar ──────────────────────────────────────────────────────────────

    const setBrush = (key) => (v) => { mBrush[key] = v; saveBrush(); draw(); };
    function ownControls(){
        return [
            { kind: 'group', title: 'the tool', controls: [
                { kind: 'iconChoice', title: 'the brush', options: TOOLS, get: () => mBrush.tool, set: setBrush('tool') },
            ] },
            { kind: 'group', title: 'the brush', controls: [
                { kind: 'number', label: 'size', title: 'the brush radius, in pixels of the picture ([ and ] change it)', min: 1, max: 512, step: 1, digits: 0,
                  get: () => mBrush.radius, set: setBrush('radius'), visible: () => mBrush.tool !== 'gradient' },
                { kind: 'number', label: 'strength', title: 'how much one dab changes the height at its centre (0 to 1)', min: 0.01, max: 1, step: 0.01, digits: 2,
                  get: () => mBrush.strength, set: setBrush('strength'), visible: () => mBrush.tool !== 'gradient' },
                { kind: 'number', label: 'soft', title: 'softness: 0 a hard disk, 1 soft from the centre', min: 0, max: 1, step: 0.05, digits: 2,
                  get: () => mBrush.softness, set: setBrush('softness'), visible: () => mBrush.tool !== 'gradient' },
                { kind: 'number', label: 'level', title: 'the height the level brush goes to, and the gradient ends at (0 to 1)', min: 0, max: 1, step: 0.05, digits: 2,
                  get: () => mBrush.level, set: setBrush('level'), visible: () => mBrush.tool === 'level' || mBrush.tool === 'gradient' },
                { kind: 'toggle', icon: ICONS.masked, title: 'Only on the picture: the paint scaled by the picture’s opacity, none where it is transparent',
                  get: () => mBrush.masked, set: setBrush('masked') },
            ] },
            { kind: 'group', title: 'the height shown', controls: [
                { kind: 'iconChoice', title: 'how the height shows over the picture', get: () => mBrush.overlay,
                  set: (v) => { mBrush.overlay = v; saveBrush(); updateOverlay(); draw(); },
                  options: [
                      { value: 'ramp', icon: ICONS.ramp, title: 'A colour ramp: blue low, red high, none where it is 0' },
                      { value: 'contours', icon: ICONS.contours, title: `Contour lines, ${CONTOURS} levels` },
                      { value: 'none', icon: ICONS.noOverlay, title: 'The picture alone' },
                  ] },
            ] },
            { kind: 'group', title: 'the whole height', controls: [
                { kind: 'button', icon: ICONS.invert, title: 'Invert: high becomes low (only on the picture, when that is on)',
                  action: () => command(() => invertField(mOpen.field, mBrush.masked ? mOpen.mask : null)) },
                { kind: 'button', icon: ICONS.clear, title: 'Clear: all the height to 0',
                  action: () => command(() => fillField(mOpen.field, 0)) },
                { kind: 'button', icon: ICONS.fitView, title: 'The whole picture in the window', action: fitView },
                { kind: 'button', icon: ICONS.undo, title: 'Undo (Ctrl+Z): the drawing’s undo, a stroke a step', action: () => mOpen?.undo?.() },
                { kind: 'button', icon: ICONS.redo, title: 'Redo (Ctrl+Y)', action: () => mOpen?.redo?.() },
            ] },
        ];
    }

    // ── open, close ──────────────────────────────────────────────────────────

    async function open(par){
        const token = ++mToken;
        const picture = await loadImage(par.picture);
        const chan = par.channel ? await loadImage(par.channel) : null;
        if (token !== mToken) return false;
        const [w, h] = chan ? [chan.naturalWidth, chan.naturalHeight] : fieldSizeFor(picture.naturalWidth, picture.naturalHeight, MAX_SIDE);
        mPic.width = mOver.width = w;
        mPic.height = mOver.height = h;
        const pg = mPic.getContext('2d', { willReadFrequently: true });
        pg.clearRect(0, 0, w, h);
        pg.drawImage(picture, 0, 0, w, h);
        const alpha = pg.getImageData(0, 0, w, h).data;
        const mask = new Float32Array(w*h);
        for (let n = 0; n < mask.length; n++) mask[n] = alpha[4*n + 3]/255;
        mOverData = new ImageData(w, h);
        mOpen = { ...par, field: chan ? setFieldFromImage(chan, w, h) : createHeightField(w, h), mask };
        mLastUrl = par.channel || null;
        if (par.title) win.setTitle(par.title);
        bar.setControls([...ownControls(), ...(par.controls || [])]);
        win.setVisible(true);
        updateOverlay();
        fitView();
        bar.refresh();
        return true;
    }

    /** the owner's channel (after an undo): shown, unless it is what the window last sent */
    async function setChannel(url){
        if (!mOpen || url === mLastUrl) return;
        const token = ++mToken;
        const f = mOpen.field;
        let next = createHeightField(f.width, f.height);
        if (url) {
            const img = await loadImage(url);
            if (token !== mToken || !mOpen) return;
            next = setFieldFromImage(img, f.width, f.height);
        }
        mOpen.field = next;
        mLastUrl = url || null;
        updateOverlay();
        draw();
        bar.refresh();
    }

    function close(){
        mToken++;
        mOpen = null;
        mDrag = null;
        win.setVisible(false);
    }

    // a window remembered as open shows nothing until it is opened
    if (win.isVisible()) win.setVisible(false);

    return {
        window:     win,
        open,
        setChannel,
        close,
        isOpen:     () => !!mOpen && win.isVisible(),
        refresh:    () => bar.refresh(),
        // for tests: the field, the view (canvas px of the view element per field px, origin)
        getField:   () => (mOpen ? mOpen.field : null),
        getView:    () => ({ ...mView }),
        getBrush:   () => ({ ...mBrush }),
        setBrush:   (values) => { Object.assign(mBrush, values); saveBrush(); bar.refresh(); updateOverlay(); draw(); },
        canvas,
    };
}

export { createImageChannelEditor };
