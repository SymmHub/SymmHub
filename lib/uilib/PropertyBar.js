/**
 * PropertyBar.js
 *
 * The settings of the active tool in a few compact rows: an internal window
 * that shows a list of controls the owner describes, and a hint line under
 * them (what the tool does with the pointer and the keys). Controls in a
 * group stay side by side (a group wider than the bar wraps too); the
 * groups wrap into rows within the bar's width, which the corner grip sets
 * (arg.width at first, remembered with the window's place). The window's
 * height fits its controls; the hint wraps within their width, two lines
 * of it until a click opens it. A "?" button at the end hides or shows the hint (remembered with the
 * window's place). Without a hint (arg.hint false) it is a panel of
 * settings of its own, as symdraw's style. The [x] of its header hides the
 * window (bar.window.setVisible(true) shows it again).
 *
 * Usage:
 *   const bar = createPropertyBar({ title: 'tool', storageId: 'tool_properties', left: '1px', top: '66px' });
 *   bar.setName('Polyline');     // the title: 'tool: Polyline'
 *   bar.setControls([
 *       { kind: 'toggle', icon: 'res/snap.svg', title: 'snap', get: () => cfg.snap, set: (v) => { cfg.snap = v; } },
 *       { kind: 'separator' },
 *       { kind: 'number', label: 'n', min: 3, max: 64, step: 1, get: () => cfg.n, set: (v) => { cfg.n = v; } },
 *   ]);
 *   bar.setHint('click adds a vertex, drag draws freehand');
 *   bar.refresh();     // the values and enabled states read again, after the owner changed them
 *
 * Controls; every one may have title (the tooltip), enabled() and visible(),
 * and a label shown before it:
 *   { kind: 'label',      text }
 *   { kind: 'toggle',     icon | text, get() -> bool, set(bool) }
 *   { kind: 'iconChoice', options: [{ value, icon | text, title }], get(), set(value) }
 *   { kind: 'number',     label, min, max, step, digits, width, get(), set(number) }
 *                         a NumberField: the wheel over the focused field,
 *                         Up / Down and its small arrows step the digit after
 *                         the caret; dragging
 *                         the label left or right steps the value by step;
 *                         digits: decimals shown (the step's when absent),
 *                         width: in characters (by the range when absent)
 *   { kind: 'choice',     options: [value | { value, label }], get(), set(value) }
 *   { kind: 'color',      get() -> '#rrggbb', set('#rrggbb') }
 *   { kind: 'button',     icon | text, action(), image() -> URL | null, imageSize: [w, h] }
 *                         with image, the button shows that picture (a
 *                         thumbnail, read again on refresh), the icon or
 *                         text while it gives none; imageSize: the picture's
 *                         size in px (40 by 22 when absent), the button grows
 *   { kind: 'menu',       icon | text, items() -> [PopupMenu items] }
 *   { kind: 'popover',    icon | text, controls: [...] }  a button opening a
 *                         panel of more controls, one per line with its label
 *   { kind: 'group',      controls: [...] }  controls kept side by side; the
 *                         group is hidden when all of them are
 *   { kind: 'separator' }
 *   { kind: 'spacer' }    the controls after it go to the right end of their row
 *   { kind: 'break' }     the controls after it start a new row
 *   { kind: 'hint' }      the place of the "?" button (at the end of the
 *                         controls when there is none)
 * An icon is the URL of an image, or the text of an inline <svg>.
 */

import {
    createInternalWindow,
    createNumberField,
    showPopupMenu,
    Z_POPUP,
} from './modules.js';

const STYLE_ID = 'property-bar-style';

// the bar's first width, and the least one the grip gives
const WIDTH = 440;
const MIN_WIDTH = 160;
// px at the right of the controls, where the window's corner grip is
const GRIP_ROOM = 16;

const CSS = `
.property-bar { display: block; width: 100%; padding: 3px ${GRIP_ROOM}px 3px 4px; box-sizing: border-box;
                background: var(--bg-panel, #f9f9f9); cursor: default; user-select: none;
                font: 12px var(--font-sans, Verdana, sans-serif); color: var(--text-primary, #303030); }
.property-bar__row { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 10px; white-space: nowrap; min-height: 28px; }
.property-bar__group { display: inline-flex; flex-wrap: wrap; max-width: 100%; align-items: center; gap: 3px 2px; }
.property-bar__hint { white-space: normal; color: var(--text-muted, #707070); font-size: 11px;
                      line-height: 14px; padding: 1px 2px 0; cursor: pointer;
                      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.property-bar__hint--open { display: block; }
.property-bar__hint:empty { display: none; }
.property-bar__label { font-weight: bold; padding: 0 6px 0 2px; }
.property-bar__text { padding: 0 1px 0 4px; color: var(--text-secondary, #505050); }
.property-bar__text--scrub { cursor: ew-resize; touch-action: none; }
.property-bar__sep { align-self: stretch; width: 1px; margin: 3px 4px; background: var(--border-strong, rgba(0, 0, 0, 0.2)); }
.property-bar__spacer { flex: 1 1 auto; min-width: 8px; }
.property-bar__break { flex-basis: 100%; height: 0; }
.property-bar__button {
    min-width: 28px; height: 28px; padding: 3px; margin: 0; box-sizing: border-box;
    display: inline-flex; align-items: center; justify-content: center; font: inherit; color: inherit;
    background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer;
}
.property-bar__button:hover { background: var(--bg-hover, #e8e8e8); }
.property-bar__button img, .property-bar__button svg { width: 20px; height: 20px; pointer-events: none; }
.property-bar__button--on, .property-bar__button--on:hover {
    background-color: var(--bg-active, #bae6fd); border-color: var(--accent-border, #0284c7); box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}
.property-bar__button:disabled { opacity: 0.4; cursor: default; background: transparent; }
.property-bar__button--picture { border-color: var(--border-strong, rgba(0, 0, 0, 0.3)); background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 8px 8px; }
.property-bar__button .property-bar__picture { width: 40px; height: 22px; object-fit: contain; }
.property-bar__choices { display: inline-flex; gap: 1px; }
.property-bar select { height: 22px; font: inherit; }
.property-bar input[type=color] { width: 28px; height: 22px; padding: 0 1px; box-sizing: border-box;
                                  border: 1px solid var(--border-input, rgba(0, 0, 0, 0.4)); border-radius: 3px; cursor: pointer; }
.property-bar__labelled { display: inline-flex; align-items: center; gap: 2px; }
.property-bar__popover { position: fixed; display: grid; grid-template-columns: auto auto;
                         align-items: center; gap: 4px 6px; padding: 6px 8px; width: max-content;
                         max-width: calc(100vw - 12px); max-height: calc(100dvh - 64px); overflow-y: auto; box-sizing: border-box;
                         background: var(--bg-elevated, #f9f9f9); border: 1px solid var(--border-strong, rgba(0, 0, 0, 0.3));
                         border-radius: 4px; box-shadow: var(--shadow-popup, 0 4px 12px rgba(0, 0, 0, 0.2)); color: var(--text-primary, #303030); }
.property-bar__popover > .property-bar__text { padding: 0; }
.property-bar--single-row {
    display: flex; align-items: center; gap: 4px;
    padding: 0; height: 100%; overflow: hidden;
}
.property-bar--single-row .property-bar__row {
    flex: 1 1 auto; min-width: 0; flex-wrap: nowrap;
    gap: 2px 6px; overflow: hidden;
}
.property-bar--single-row .property-bar__row > * { flex: 0 0 auto; }
.property-bar--single-row .property-bar__row > .property-bar__spacer { flex: 1 1 auto; }
.property-bar--single-row .property-bar__group { flex-wrap: nowrap; }
.property-bar__sep--hidden { display: none !important; }
.property-bar--single-row .property-bar__button--picture,
.property-bar__overflow-tray .property-bar__button--picture {
    height: 28px; padding: 2px 3px;
}
.property-bar--single-row .property-bar__button .property-bar__picture,
.property-bar__overflow-tray .property-bar__button .property-bar__picture {
    width: auto; min-width: 22px; max-width: 44px; height: 22px; object-fit: contain;
}
.property-bar__overflow-btn {
    flex: 0 0 auto; height: 24px; min-width: 0; padding: 0 7px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.2));
    background: var(--bg-elevated, #ffffff);
}
.property-bar__overflow-tray {
    position: fixed; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px;
    width: max-content; max-width: min(720px, calc(100vw - 16px));
    max-height: calc(100dvh - 64px); overflow-y: auto;
    padding: 6px 10px; box-sizing: border-box;
    background: var(--bg-elevated, #f9f9f9);
    border: 1px solid var(--border-strong, rgba(0, 0, 0, 0.3));
    border-radius: 6px;
    box-shadow: var(--shadow-popup, 0 4px 12px rgba(0, 0, 0, 0.2));
    color: var(--text-primary, #303030);
}
@media (pointer: coarse) {
    .property-bar__button { min-width: 34px; height: 34px; padding: 4px; }
    .property-bar__overflow-btn { height: 30px; padding: 0 9px; font-size: 12px; }
}
.property-bar__overflow-tray .property-bar__sep--from-break {
    flex-basis: 100%; width: auto; height: 1px; margin: 2px 0;
    background: var(--border-subtle, rgba(0, 0, 0, 0.14));
}
.property-bar__overflow-tray .property-bar__sep:not(.property-bar__sep--from-break) {
    height: 18px; align-self: center;
}
.property-bar__overflow-tray .property-bar__spacer { display: none; }
`;

// pixels of a drag on a number's label per step of the value
const SCRUB_PX = 4;
// a question mark in a circle: the hint line shown or hidden
const ICON_HINT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 A2.5 2.5 0 1 1 13 11.8 C12.3 12.2 12 12.8 12 13.5 V14"/>' +
    '<circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/** an icon (an image URL or an inline <svg>) or a text inside an element */
function fillFace(el, face){
    if (face.icon) {
        if (face.icon.trim().startsWith('<svg')) {
            el.insertAdjacentHTML('beforeend', face.icon);
        } else {
            const img = document.createElement('img');
            img.src = face.icon;
            img.alt = '';
            el.appendChild(img);
        }
    } else {
        el.textContent = face.text ?? '';
    }
}

function makeButton(face, title){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'property-bar__button';
    if (title) { btn.title = title; btn.setAttribute('aria-label', title); }
    fillFace(btn, face);
    // the button takes no focus on mouse click: keys stay with the canvas and its tools
    btn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') e.preventDefault(); });
    return btn;
}

/** the decimals of a number control: its digits, or its step's */
function roundDigits(c){
    return c.digits ?? Math.max(0, -Math.floor(Math.log10(c.step || 1) + 1e-9));
}

/** a number of a drag on the label: within the range, on the step, without float noise */
function roundTo(c, v){
    let x = Number(v);
    if (!Number.isFinite(x)) return null;
    if (c.min !== undefined) x = Math.max(c.min, x);
    if (c.max !== undefined) x = Math.min(c.max, x);
    return Number(x.toFixed(Math.min(10, roundDigits(c))));
}

/**
 * @param {object} arg
 * @param {string} [arg.title]
 * @param {string} [arg.storageId]
 * @param {string} [arg.left]
 * @param {string} [arg.top]
 * @param {number} [arg.width]     the first width, WIDTH by default (then the grip's)
 * @param {number} [arg.minWidth]  the least width the grip gives, MIN_WIDTH by default
 * @param {boolean} [arg.hint]     false: no hint line, nor its button
 * @param {boolean} [arg.canClose] false: no close button, the window always shows
 * @param {boolean} [arg.singleRow] true: keep controls on one non-wrapping row;
 *                         breaks become vertical dividers and overflowing items
 *                         move into a floating "More ▾" tray
 * @param {HTMLElement} [arg.container] the bar goes into this element, as a
 *                         part of another window: no window of its own
 *                         (result.window is null), its width the element's
 */
export function createPropertyBar(arg = {}) {
    ensureStyle();

    const singleRow = !!arg.singleRow;
    // its [x] hides it, and whether it shows is remembered with its place
    const closable = arg.canClose !== false;
    const win = arg.container ? null : createInternalWindow({
        title:         arg.title ?? 'tool',
        left:          arg.left || '1px',
        top:           arg.top || '66px',
        width:         (arg.width ?? WIDTH) + 'px',
        height:        '50px',
        canClose:      closable,
        canResize:     true,
        resizeHeight:  false,
        minWidth:      arg.minWidth ?? MIN_WIDTH,
        alwaysVisible: !closable,
        storageId:     arg.storageId,
    });
    if (win) win.interior.style.overflow = 'hidden';

    const withHint = arg.hint !== false;
    const content = document.createElement('div');
    content.className = singleRow ? 'property-bar property-bar--single-row' : 'property-bar';
    const row = document.createElement('div');
    row.className = 'property-bar__row';
    row.setAttribute('role', 'toolbar');
    const hint = document.createElement('div');
    hint.className = 'property-bar__hint';
    // two lines of the hint; a click shows all of it, another two lines again
    hint.addEventListener('click', () => { hint.classList.toggle('property-bar__hint--open'); fit(); });

    // Single-row automatic overflow trigger & floating tray
    const overflowBtn = singleRow ? makeButton({ text: 'More \u25BE' }, 'More tool controls') : null;
    const overflowTray = singleRow ? document.createElement('div') : null;
    if (overflowBtn && overflowTray) {
        overflowBtn.classList.add('property-bar__overflow-btn');
        overflowBtn.setAttribute('aria-haspopup', 'dialog');
        overflowBtn.setAttribute('aria-expanded', 'false');
        overflowBtn.style.display = 'none';
        overflowBtn.addEventListener('click', () => toggleOverflow());

        overflowTray.className = 'property-bar property-bar__overflow-tray';
        overflowTray.setAttribute('role', 'dialog');
        overflowTray.setAttribute('aria-label', 'More tool controls');
    }

    // the hint shown or hidden by the button at the end of the row
    const hintKey = arg.storageId ? arg.storageId + '_hint' : null;
    let mShowHint = true;
    try { if (hintKey && window.localStorage.getItem(hintKey) === 'false') mShowHint = false; } catch (e) { /* no storage */ }
    const hintButton = makeButton({ icon: ICON_HINT }, 'the help line under the settings: show or hide');
    hintButton.addEventListener('click', () => {
        mShowHint = !mShowHint;
        try { if (hintKey) window.localStorage.setItem(hintKey, String(mShowHint)); } catch (e) { /* no storage */ }
        showHint();
    });

    function showHint(){
        hint.style.display = mShowHint ? '' : 'none';
        hintButton.classList.toggle('property-bar__button--on', mShowHint);
        hintButton.setAttribute('aria-pressed', mShowHint ? 'true' : 'false');
        fit();
    }
    content.appendChild(row);
    if (overflowBtn) content.appendChild(overflowBtn);
    if (withHint) content.appendChild(hint);
    (win ? win.interior : arg.container).appendChild(content);

    // [{ control, el, update() }]
    let mItems = [];

    function makeItem(c){
        switch (c.kind) {
        case 'label': {
            const el = document.createElement('span');
            el.className = 'property-bar__label';
            // text: a string, or a function read again on refresh
            const text = () => (typeof c.text === 'function' ? c.text() : c.text) ?? '';
            el.textContent = text();
            if (c.title) el.title = c.title;
            return { el, update: () => { const t = text(); if (el.textContent !== t) el.textContent = t; } };
        }
        case 'separator': {
            const el = document.createElement('span');
            el.className = 'property-bar__sep';
            return { el, update: () => {} };
        }
        case 'group': {
            const el = document.createElement('span');
            el.className = 'property-bar__group';
            el.setAttribute('role', 'group');
            if (c.title) el.setAttribute('aria-label', c.title);
            const children = (c.controls || []).filter(Boolean).map(makeLabelled).filter(Boolean);
            children.forEach(ch => el.appendChild(ch.el));
            return { el, update: () => {}, children };
        }
        case 'spacer': {
            const el = document.createElement('span');
            el.className = 'property-bar__spacer';
            return { el, update: () => {} };
        }
        case 'break': {
            const el = document.createElement('span');
            el.className = singleRow ? 'property-bar__sep property-bar__sep--from-break' : 'property-bar__break';
            return { el, update: () => {} };
        }
        case 'toggle': {
            const el = makeButton(c, c.title);
            el.addEventListener('click', () => { c.set(!c.get()); refresh(); });
            return { el, update: () => {
                const on = !!c.get();
                el.classList.toggle('property-bar__button--on', on);
                el.setAttribute('aria-pressed', on ? 'true' : 'false');
            } };
        }
        case 'iconChoice': {
            const el = document.createElement('span');
            el.className = 'property-bar__choices';
            el.setAttribute('role', 'radiogroup');
            if (c.title) el.title = c.title;
            const buttons = (c.options || []).map(o => {
                const btn = makeButton(o, o.title);
                btn.setAttribute('role', 'radio');
                btn.addEventListener('click', () => { c.set(o.value); refresh(); });
                el.appendChild(btn);
                return { btn, value: o.value };
            });
            return { el, update: () => {
                const v = c.get();
                buttons.forEach(b => {
                    b.btn.classList.toggle('property-bar__button--on', b.value === v);
                    b.btn.setAttribute('aria-checked', b.value === v ? 'true' : 'false');
                });
            } };
        }
        case 'number': {
            const el = document.createElement('span');
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            // the wheel and Up / Down step the digit after the caret (NumberField.js);
            // a typed number is set as typed, Enter or Escape leave the field
            const field = createNumberField({
                get: () => c.get(), set: (v) => c.set(v),
                min: c.min, max: c.max, step: c.step, digits: roundDigits(c), width: c.width,
                title: c.title, ariaLabel: c.label || c.title || '',
                onCommit: () => refresh(),
            });
            if (c.label) {
                const text = document.createElement('span');
                text.className = 'property-bar__text property-bar__text--scrub';
                text.textContent = c.label;
                if (c.title) text.title = c.title + ' (drag to change)';
                el.appendChild(text);
                scrub(text, c, field);
            }
            el.appendChild(field.el);
            return { el, update: () => field.update(), input: field.input };
        }
        case 'choice': {
            const el = document.createElement('select');
            if (c.title) { el.title = c.title; el.setAttribute('aria-label', c.title); }
            const options = (c.options || []).map(o => (typeof o === 'object' ? o : { value: o, label: String(o) }));
            options.forEach((o, i) => {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = o.label ?? String(o.value);
                el.appendChild(opt);
            });
            el.addEventListener('change', () => {
                const o = options[Number(el.value)];
                if (o) c.set(o.value);
                el.blur();
                refresh();
            });
            return { el, update: () => {
                const i = options.findIndex(o => o.value === c.get());
                el.value = String(Math.max(0, i));
            } };
        }
        case 'color': {
            const el = document.createElement('input');
            el.type = 'color';
            if (c.title) { el.title = c.title; el.setAttribute('aria-label', c.title); }
            el.addEventListener('input', () => c.set(el.value));
            el.addEventListener('change', () => refresh());
            return { el, update: () => { el.value = c.get() || '#000000'; } };
        }
        case 'button': {
            const el = makeButton(c, c.title);
            el.addEventListener('click', () => { c.action?.(); refresh(); });
            if (!c.image) return { el, update: () => {} };
            // a picture in place of the face while c.image() gives one
            el.classList.add('property-bar__button--picture');
            const pic = document.createElement('img');
            pic.alt = '';
            pic.className = 'property-bar__picture';
            if (c.imageSize && !singleRow) {
                pic.style.width = c.imageSize[0] + 'px';
                pic.style.height = c.imageSize[1] + 'px';
                el.style.height = 'auto';
            }
            if (singleRow) {
                pic.addEventListener('load', () => layoutOverflow());
            }
            el.appendChild(pic);
            let shown;
            return { el, update: () => {
                const url = c.image() || null;
                if (url === shown) return;
                shown = url;
                if (url) pic.src = url; else pic.removeAttribute('src');
                pic.style.display = url ? '' : 'none';
                for (const ch of el.children) if (ch !== pic) ch.style.display = url ? 'none' : '';
            } };
        }
        case 'menu': {
            const el = makeButton(c, c.title);
            el.setAttribute('aria-haspopup', 'menu');
            el.addEventListener('click', () => {
                const items = (c.items ? c.items() : []).map(it => (it.action
                    ? { ...it, action: () => { it.action(); refresh(); } } : it));
                showPopupMenu({ anchor: el, items });
            });
            return { el, update: () => {} };
        }
        case 'popover': {
            const el = makeButton(c, c.title);
            el.setAttribute('aria-haspopup', 'dialog');
            el.addEventListener('click', () => togglePopover(el, c));
            return { el, update: () => {} };
        }
        default:
            console.warn('PropertyBar: unknown control kind', c.kind);
            return null;
        }
    }

    /** a drag on the label steps the number: one step per SCRUB_PX pixels */
    function scrub(label, c, field){
        label.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const x0 = e.clientX;
            const v0 = Number(c.get()) || 0;
            const step = c.step || 1;
            const move = (ev) => {
                const v = roundTo(c, v0 + Math.round((ev.clientX - x0)/SCRUB_PX)*step*(ev.shiftKey ? 10 : 1));
                if (v === null || v === Number(c.get())) return;
                c.set(v);
                field.update(true);
            };
            const up = () => {
                label.removeEventListener('pointermove', move);
                label.removeEventListener('pointerup', up);
                label.removeEventListener('pointercancel', up);
                refresh();
            };
            label.addEventListener('pointermove', move);
            label.addEventListener('pointerup', up);
            label.addEventListener('pointercancel', up);
            try { label.setPointerCapture(e.pointerId); } catch (err) { /* untracked pointer */ }
        });
    }

    /** a control's item, with its label before it (a number's label is its own) */
    function makeLabelled(c){
        const item = makeItem(c);
        if (!item) return null;
        item.control = c;
        item.target = item.input || item.el;
        if (c.label && c.kind !== 'number' && c.kind !== 'label') {
            const wrap = document.createElement('span');
            wrap.className = 'property-bar__labelled';
            const text = document.createElement('span');
            text.className = 'property-bar__text';
            text.textContent = c.label;
            if (c.title) text.title = c.title;
            wrap.appendChild(text);
            wrap.appendChild(item.el);
            item.el = wrap;
        }
        return item;
    }

    function setControls(controls){
        closePopover();
        closeOverflow();
        row.replaceChildren();
        if (overflowTray) overflowTray.replaceChildren();
        mItems = [];
        let hintPlaced = false;
        for (const c of (controls || []).filter(Boolean)) {
            if (c.kind === 'hint') {
                // the place of the hint's button
                if (withHint && !hintPlaced) row.appendChild(hintButton);
                hintPlaced = true;
                continue;
            }
            const item = makeLabelled(c);
            if (!item) continue;
            row.appendChild(item.el);
            mItems.push(item);
        }
        if (withHint && !hintPlaced) row.appendChild(hintButton);
        refresh();
    }

    // Single-row overflow tray management
    const SINGLE_ROW_GAP = 6;
    const OVERFLOW_BTN_FALLBACK_W = 68;
    let mOverflowOpen = false;
    let mOverflowCleanup = null;
    let mLastWidth = -1;

    function isSepItem(item) {
        const k = item.control.kind;
        return k === 'separator' || (singleRow && k === 'break');
    }

    function itemVisible(item) {
        return item.el.style.display !== 'none' && !item.el.classList.contains('property-bar__sep--hidden');
    }

    function cleanSeparatorsIn(items) {
        let seenContent = false;
        let lastSep = null;
        for (const item of items) {
            if (isSepItem(item)) item.el.classList.remove('property-bar__sep--hidden');
            if (item.el.style.display === 'none') continue;
            if (isSepItem(item)) {
                if (!seenContent || lastSep) {
                    item.el.classList.add('property-bar__sep--hidden');
                } else {
                    lastSep = item;
                }
            } else if (item.control.kind !== 'spacer') {
                seenContent = true;
                lastSep = null;
            }
        }
        if (lastSep) lastSep.el.classList.add('property-bar__sep--hidden');
    }

    function positionOverflowTray() {
        if (!mOverflowOpen || !overflowTray || !overflowBtn) return;
        const box = overflowBtn.getBoundingClientRect();
        const winW = globalThis.innerWidth || 1280;
        const trayW = overflowTray.offsetWidth || 320;
        const left = Math.max(8, Math.min(box.right - trayW, winW - trayW - 8));
        overflowTray.style.left = `${left}px`;
        overflowTray.style.top = `${box.bottom + 3}px`;
    }

    function closeOverflow() {
        if (!mOverflowOpen) return;
        mOverflowOpen = false;
        if (mOverflowCleanup) {
            mOverflowCleanup();
            mOverflowCleanup = null;
        }
        if (overflowBtn) {
            overflowBtn.setAttribute('aria-expanded', 'false');
            overflowBtn.classList.remove('property-bar__button--on');
        }
        if (overflowTray && overflowTray.parentElement) overflowTray.remove();
    }

    function openOverflow() {
        if (mOverflowOpen || !overflowTray || !overflowBtn) return;
        closePopover();
        mOverflowOpen = true;
        document.body.appendChild(overflowTray);
        overflowTray.style.zIndex = String(Z_POPUP);
        positionOverflowTray();
        overflowBtn.setAttribute('aria-expanded', 'true');
        overflowBtn.classList.add('property-bar__button--on');

        const onPress = (e) => {
            const t = e.target;
            if (overflowTray.contains(t) || overflowBtn.contains(t)) return;
            if (t?.closest?.('.property-bar__popover, .popup-menu')) return;
            closeOverflow();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (mPopover) return;
                e.preventDefault();
                e.stopPropagation();
                closeOverflow();
            }
        };
        document.addEventListener('pointerdown', onPress, true);
        window.addEventListener('keydown', onKey, true);
        mOverflowCleanup = () => {
            document.removeEventListener('pointerdown', onPress, true);
            window.removeEventListener('keydown', onKey, true);
        };
    }

    function toggleOverflow() {
        if (mOverflowOpen) closeOverflow();
        else openOverflow();
    }

    function measureRightEdges(visibleItems) {
        const rowRect = row.getBoundingClientRect?.();
        const useRects = !!(rowRect && rowRect.width > 0 && visibleItems.length > 0 && visibleItems.some(it => {
            const r = it.el.getBoundingClientRect?.();
            return r && r.width > 0;
        }));
        const edges = new Map();
        if (useRects) {
            for (const item of visibleItems) {
                const r = item.el.getBoundingClientRect();
                edges.set(item, r.right - rowRect.left);
            }
        } else {
            let x = 0;
            for (let i = 0; i < visibleItems.length; i++) {
                const item = visibleItems[i];
                if (i > 0) x += SINGLE_ROW_GAP;
                const w = item.el.offsetWidth || 0;
                const extraMargin = isSepItem(item) ? 8 : 0;
                x += w + extraMargin;
                edges.set(item, x);
            }
        }
        return edges;
    }

    function layoutOverflow() {
        if (!singleRow || !overflowBtn || !overflowTray) return;
        // Preserve active input focus inside an open overflow tray
        if (mOverflowOpen && document.activeElement && overflowTray.contains(document.activeElement)) {
            cleanSeparatorsIn(mItems.filter(it => it.el.parentElement === row));
            cleanSeparatorsIn(mItems.filter(it => it.el.parentElement === overflowTray));
            return;
        }

        const availW = content.clientWidth;
        mLastWidth = availW;

        for (const item of mItems) {
            if (item.el.parentElement !== row) row.appendChild(item.el);
        }
        overflowBtn.style.display = 'none';
        cleanSeparatorsIn(mItems);

        if (availW <= 0) {
            closeOverflow();
            return;
        }

        const visibleItems = mItems.filter(itemVisible);
        if (visibleItems.length === 0) {
            closeOverflow();
            return;
        }

        const edges = measureRightEdges(visibleItems);
        const lastRight = edges.get(visibleItems[visibleItems.length - 1]) || 0;
        if (lastRight <= availW + 1) {
            closeOverflow();
            return;
        }

        overflowBtn.style.display = '';
        const btnW = overflowBtn.offsetWidth || OVERFLOW_BTN_FALLBACK_W;
        const budget = Math.max(0, availW - btnW - 4);

        let splitIndex = mItems.length;
        for (let i = 0; i < mItems.length; i++) {
            const item = mItems[i];
            if (!itemVisible(item)) continue;
            const right = edges.get(item) || 0;
            if (right > budget + 1) {
                splitIndex = i;
                break;
            }
        }

        const rowItems = mItems.slice(0, splitIndex);
        const trayItems = mItems.slice(splitIndex);
        for (const item of trayItems) {
            overflowTray.appendChild(item.el);
        }

        cleanSeparatorsIn(rowItems);
        cleanSeparatorsIn(trayItems);

        if (!trayItems.some(itemVisible)) {
            for (const item of trayItems) row.appendChild(item.el);
            cleanSeparatorsIn(mItems);
            overflowBtn.style.display = 'none';
            closeOverflow();
            return;
        }

        if (mOverflowOpen) positionOverflowTray();
    }

    // the open popover: {anchor, el, items, close()}
    let mPopover = null;

    function closePopover(){
        if (mPopover) mPopover.close();
    }

    /** a panel under the anchor with the popover's controls, one per line */
    function togglePopover(anchor, c){
        const same = mPopover && mPopover.anchor === anchor;
        closePopover();
        if (same) return;
        const el = document.createElement('div');
        el.className = 'property-bar property-bar__popover';
        el.setAttribute('role', 'dialog');
        if (c.title) el.setAttribute('aria-label', c.title);
        const items = [];
        for (const pc of (c.controls || []).filter(Boolean)) {
            const item = makeItem(pc);
            if (!item) continue;
            item.control = pc;
            item.target = item.input || item.el;
            // a number's label goes to the first column, its box to the second
            const label = item.el.querySelector?.('.property-bar__text');
            if (label) {
                el.appendChild(label);
            } else {
                const text = document.createElement('span');
                text.className = 'property-bar__text';
                text.textContent = pc.label || '';
                if (pc.title) text.title = pc.title;
                el.appendChild(text);
            }
            el.appendChild(item.el);
            items.push(item);
        }
        document.body.appendChild(el);
        el.style.zIndex = String(Z_POPUP);
        const box = anchor.getBoundingClientRect();
        el.style.left = `${Math.max(0, Math.min(box.left, window.innerWidth - el.offsetWidth - 4))}px`;
        el.style.top  = `${box.bottom + 2}px`;

        const onPress = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopover(); } };
        document.addEventListener('pointerdown', onPress, true);
        window.addEventListener('keydown', onKey, true);
        anchor.setAttribute('aria-expanded', 'true');
        anchor.classList.add('property-bar__button--on');
        mPopover = { anchor, el, items, close: () => {
            document.removeEventListener('pointerdown', onPress, true);
            window.removeEventListener('keydown', onKey, true);
            anchor.setAttribute('aria-expanded', 'false');
            anchor.classList.remove('property-bar__button--on');
            el.remove();
            mPopover = null;
        } };
        refreshItems(items);
    }

    /** the values, enabled and visible states of the items read again */
    function refreshItems(items){
        for (const item of items) {
            const c = item.control;
            let visible = c.visible ? !!c.visible() : true;
            if (item.children) {
                // a group: its controls first, the group hidden with all of them
                if (visible) refreshItems(item.children);
                visible = visible && item.children.some(ch => ch.el.style.display !== 'none');
                item.el.style.display = visible ? '' : 'none';
                continue;
            }
            item.el.style.display = visible ? '' : 'none';
            if (!visible) continue;
            const enabled = c.enabled ? !!c.enabled() : true;
            if ('disabled' in item.target) item.target.disabled = !enabled;
            item.el.querySelectorAll?.('button').forEach(b => { b.disabled = !enabled; });
            item.update();
        }
    }

    /** the values, enabled and visible states read again */
    function refresh(){
        refreshItems(mItems);
        if (mPopover) refreshItems(mPopover.items);
        if (singleRow) layoutOverflow();
        fit();
    }

    function setHint(text){
        hint.textContent = text || '';
        hint.title = text ? text + '\n(click: all of it, or two lines)' : '';
        fit();
    }

    /** the window's height around the controls, which wrap within its width */
    function fit(){
        if (!win) return;
        win.setInteriorSize(null, content.offsetHeight);
        win.clamp();
    }

    showHint();
    // the grip changed the width: the controls wrapped again (or single-row re-laid out)
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => {
            if (singleRow) {
                const w = content.clientWidth;
                if (w !== mLastWidth) {
                    mLastWidth = w;
                    layoutOverflow();
                }
            } else {
                fit();
            }
        }).observe(content);
    }

    // the name of what the settings are of (the active tool) in the window's
    // title, after its own: 'tool: Rectangle'
    const baseTitle = arg.title ?? 'tool';
    function setName(name){
        if (win) win.setTitle(name ? `${baseTitle}: ${name}` : baseTitle);
    }

    return {
        window:       win,
        container:    content,
        overflowBtn,
        overflowTray,
        setControls,
        setName,
        refresh,
        setHint,
        fit,
        layoutOverflow,
    };
}
