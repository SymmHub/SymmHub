/**
 * ParamColorStrip.js
 *
 * A dat.gui row with a strip of color swatches that the user edits one swatch
 * at a time: a click opens the browser's color picker for that swatch, a right
 * click gives the swatch its original (generated) color back. Under each swatch
 * there can be an alpha bar: drag to set the alpha of that color. The owner keeps
 * the colors; the strip only displays them and reports the edits, so it is not
 * serializable.
 *
 * Usage:
 *   ParamColorStrip({
 *       getItems: () => [{ color: '#rrggbb', opacity: 1, alpha: 1, marked: false }, ...],
 *       onPick:   (index, hex, final) => { ... },  // 'input' while the picker is
 *                                                  // dragged, final on its 'change'
 *       onReset:  (index) => { ... },              // right click on a marked swatch
 *       onAlpha:  (index, alpha, final) => { ... },// shows the alpha bars; final when
 *                                                  // the drag ends
 *       onAlphaReset: (index) => { ... },          // right or double click on an alpha bar
 *       menu: () => [{ label, title, disabled, action }, { separator: true }, ...],
 *                                                  // shows a small button (a hamburger) at the
 *                                                  // left of the strip, it opens a popup menu of
 *                                                  // these items (asked each time it opens, see
 *                                                  // PopupMenu.js)
 *       menuTooltip: 'what the menu holds',        // the tooltip of that button
 *   })
 *
 *   strip.flash()   // a check mark takes the place of the hamburger for a moment: a command of
 *                   // the menu went through, e.g. a copy, which shows nothing else
 *
 *   marked:  the color was edited by hand (the swatch shows a dot, can be reset)
 *   alpha:   0..1, the value the alpha bar shows and sets
 *   opacity: 0..1, how opaque the swatch is drawn over a checkerboard (default:
 *            alpha); it can differ from alpha, e.g. for a color that is masked out
 *
 * The alpha bar: drag sets steps of 0.05 (Shift: 0.01), the outer 5% of the bar
 * are exactly 0 and 1; the mouse wheel changes it by 0.05 (Shift: 0.01).
 *
 * The owner calls updateDisplay() whenever its colors change.
 */

import { showPopupMenu } from './PopupMenu.js';

const STYLE_ID = 'param-color-strip-style';

const CSS = `
/* dat.gui collapses a closed folder with height:0 on its rows, an inline
   height would block that rule (same trick as .param-image-row) */
.dg ul:not(.closed) > li.param-color-strip-row { height: auto; }
.param-color-strip-layout { display: flex; align-items: flex-start; gap: 5px; }
.param-color-strip-layout > .param-color-strip { flex: 1 1 0; min-width: 0; }
.param-color-strip {
    position: relative; display: grid; gap: 2px 3px; padding: 4px 0 5px 0;
}
/* the menu button: as high as the swatches, level with the first row of them */
.param-color-strip-menu-button {
    flex: 0 0 auto; width: 26px; height: 26px; margin: 4px 0 0 0; padding: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    color: var(--ui-button-color, #606060);
    background: var(--ui-button-background-color, #fff);
    border: 1px solid var(--ui-button-border-color, rgba(0, 0, 0, 0.4)); border-radius: 3px;
    cursor: pointer;
}
.param-color-strip-menu-button:hover,
.param-color-strip-menu-button[aria-expanded="true"] {
    color: var(--ui-button-hover-color, #000);
    background: var(--hover-background-color, #f0f0f0);
}
.param-color-strip-menu-button svg { width: 15px; height: 15px; display: block; }
.param-color-strip-unit {
    min-width: 0; display: flex; flex-direction: column; gap: 3px;
}
.param-color-strip-cell {
    position: relative; height: 26px; box-sizing: border-box; overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.35); border-radius: 2px; cursor: pointer;
    background-color: #fff;
    background-image: conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0);
    background-size: 8px 8px;
}
.param-color-strip-cell > i { position: absolute; inset: 0; }
.param-color-strip-cell:hover {
    outline: 2px solid var(--ui-button-hover-color, #1756a9); outline-offset: -1px;
}
.param-color-strip-cell.marked::after {
    content: ''; position: absolute; right: 2px; bottom: 2px; width: 5px; height: 5px;
    background: #fff; box-shadow: 0 0 0 1px #000;
}
.param-color-strip-alpha {
    position: relative; height: 9px; box-sizing: border-box; overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.35); border-radius: 2px; cursor: ew-resize;
    background: var(--input-background-color, #e9e9ed); touch-action: none;
}
.param-color-strip-alpha > b {
    position: absolute; left: 0; top: 0; bottom: 0; background: var(--slider-fill-color, #2fa1d6);
}
.param-color-strip-alpha:hover {
    outline: 1px solid var(--ui-button-hover-color, #1756a9); outline-offset: -1px;
}
.param-color-strip-picker {
    position: absolute; left: 0; top: 0; width: 1px; height: 1px;
    padding: 0; border: 0; opacity: 0; pointer-events: none;
}
`;

// three lines: a hamburger
const MENU_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/>' +
    '</svg>';

// a check mark, shown for a moment by flash()
const CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="5 12.5 10 17.5 19 7"/>' +
    '</svg>';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round2  = (v) => Math.round(v * 100) / 100;

/**
 * @param {object}   arg
 * @param {function} arg.getItems      () => [{color, opacity, alpha, marked}]
 * @param {function} [arg.onPick]      (index, hex, final)
 * @param {function} [arg.onReset]     (index)
 * @param {function} [arg.onAlpha]     (index, alpha, final), without it there are no alpha bars
 * @param {function} [arg.onAlphaReset](index)
 * @param {function} [arg.menu]        () => [{label, title, disabled, action}], without it there is no menu button
 * @param {string}   [arg.menuTooltip]
 */
export function ParamColorStrip(arg) {

    const mGetItems = arg.getItems;
    const hasAlpha  = typeof arg.onAlpha === 'function';
    const hasMenu   = typeof arg.menu === 'function';

    let mStrip  = null;   // grid of the units
    let mPicker = null;   // the hidden <input type="color">, moved under the clicked cell
    let mActive = -1;     // index of the swatch the picker edits
    let mDrag   = -1;     // index of the alpha bar being dragged
    let mMenuButton = null;
    let mFlashTimer = 0;
    const mUnits = [];    // { unit, cell, fill, bar, level }

    function openPicker(index) {
        const cell = mUnits[index]?.cell;
        const item = mGetItems()[index];
        if (!cell || !item) return;
        mActive = index;
        mPicker.value = item.color;
        // the browser anchors its popup at the input
        mPicker.style.left = cell.offsetLeft + 'px';
        mPicker.style.top  = (cell.offsetTop + cell.offsetHeight) + 'px';
        try {
            mPicker.showPicker();
        } catch (e) {
            mPicker.click();
        }
    }

    // alpha under the pointer on the bar of the unit
    function alphaAt(e, bar) {
        const r = bar.getBoundingClientRect();
        const f = (e.clientX - r.left) / Math.max(1, r.width);
        const v = clamp01((f - 0.05) / 0.9);          // the outer 5% give exactly 0 and 1
        return e.shiftKey ? round2(v) : Math.round(v * 20) / 20;
    }

    function makeAlphaBar(index, unit) {
        const bar = document.createElement('div');
        bar.className = 'param-color-strip-alpha';
        const level = document.createElement('b');
        bar.appendChild(level);

        bar.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            mDrag = index;
            bar.setPointerCapture(e.pointerId);
            arg.onAlpha(index, alphaAt(e, bar), false);
        });
        bar.addEventListener('pointermove', (e) => {
            if (mDrag === index) arg.onAlpha(index, alphaAt(e, bar), false);
        });
        const end = (e) => {
            if (mDrag !== index) return;
            mDrag = -1;
            arg.onAlpha(index, alphaAt(e, bar), true);
        };
        bar.addEventListener('pointerup', end);
        bar.addEventListener('pointercancel', () => { mDrag = -1; });
        bar.addEventListener('lostpointercapture', () => { mDrag = -1; });

        // right click and double click give the alpha 1 back
        bar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            arg.onAlphaReset?.(index);
        });
        bar.addEventListener('dblclick', () => arg.onAlphaReset?.(index));

        bar.addEventListener('wheel', (e) => {
            e.preventDefault();
            const item = mGetItems()[index];
            if (!item) return;
            const step = e.shiftKey ? 0.01 : 0.05;
            const v = round2(clamp01((item.alpha ?? 1) + (e.deltaY < 0 ? step : -step)));
            arg.onAlpha(index, v, true);
        }, { passive: false });

        unit.appendChild(bar);
        return { bar, level };
    }

    function makeUnit(index) {
        const unit = document.createElement('div');
        unit.className = 'param-color-strip-unit';

        const cell = document.createElement('div');
        cell.className = 'param-color-strip-cell';
        const fill = document.createElement('i');
        cell.appendChild(fill);
        cell.addEventListener('click', () => openPicker(index));
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const item = mGetItems()[index];
            if (item && item.marked) arg.onReset?.(index);
        });
        unit.appendChild(cell);

        const alpha = hasAlpha ? makeAlphaBar(index, unit) : null;
        return { unit, cell, fill, bar: alpha?.bar, level: alpha?.level };
    }

    function updateDisplay() {
        if (!mStrip) return;
        const items = mGetItems() || [];
        const n = items.length;
        // one row up to 12 swatches, then two rows
        const cols = n <= 12 ? Math.max(n, 1) : Math.ceil(n / 2);
        mStrip.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

        while (mUnits.length < n) {
            const u = makeUnit(mUnits.length);
            mUnits.push(u);
            mStrip.insertBefore(u.unit, mPicker);
        }
        while (mUnits.length > n) {
            mUnits.pop().unit.remove();
        }
        items.forEach((item, i) => {
            const u = mUnits[i];
            const alpha = item.alpha ?? 1;
            u.fill.style.backgroundColor = item.color;
            u.fill.style.opacity = String(item.opacity ?? alpha);
            u.cell.classList.toggle('marked', !!item.marked);
            const alphaText = hasAlpha ? `  alpha ${alpha}` : '';
            u.cell.title = `[${i}] ${item.color}${alphaText}` +
                (item.marked ? ' (edited) - click to change, right click to reset'
                             : ' - click to change');
            if (u.bar) {
                u.level.style.width = `${alpha * 100}%`;
                u.bar.title = `[${i}] alpha ${alpha} - drag to change (Shift: fine steps), ` +
                              'mouse wheel +-0.05, right or double click for 1';
            }
        });
    }

    function createUI(gui) {
        ensureStyle();

        const li = document.createElement('li');
        li.className = 'cr param-color-strip-row';

        mStrip = document.createElement('div');
        mStrip.className = 'param-color-strip';

        mPicker = document.createElement('input');
        mPicker.type = 'color';
        mPicker.className = 'param-color-strip-picker';
        mPicker.addEventListener('input',  () => arg.onPick?.(mActive, mPicker.value, false));
        mPicker.addEventListener('change', () => arg.onPick?.(mActive, mPicker.value, true));
        mStrip.appendChild(mPicker);

        // the menu button at the left of the strip
        const layout = document.createElement('div');
        layout.className = 'param-color-strip-layout';
        if (hasMenu) {
            mMenuButton = document.createElement('button');
            mMenuButton.type = 'button';
            mMenuButton.className = 'param-color-strip-menu-button';
            const tooltip = arg.menuTooltip ?? 'Menu';
            mMenuButton.title = tooltip;
            mMenuButton.setAttribute('aria-label', tooltip);
            mMenuButton.setAttribute('aria-haspopup', 'menu');
            mMenuButton.setAttribute('aria-expanded', 'false');
            mMenuButton.innerHTML = MENU_ICON;
            mMenuButton.addEventListener('click', () => {
                showPopupMenu({ anchor: mMenuButton, items: arg.menu() });
            });
            layout.appendChild(mMenuButton);
        }
        layout.appendChild(mStrip);

        li.appendChild(layout);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(li);

        updateDisplay();
    }

    // a check mark in the place of the hamburger for a moment
    function flash() {
        if (!mMenuButton) return;
        clearTimeout(mFlashTimer);
        mMenuButton.innerHTML = CHECK_ICON;
        mFlashTimer = setTimeout(() => { mMenuButton.innerHTML = MENU_ICON; }, 1100);
    }

    return {
        createUI,
        updateDisplay,
        flash,
        serializable: false,   // the owner stores the colors
    };

} // ParamColorStrip
