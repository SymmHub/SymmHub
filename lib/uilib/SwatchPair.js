/**
 * SwatchPair.js
 *
 * The stroke and fill colours as two overlapping swatches, as drawing
 * programs show them under their tools: the fill in front, top left, the
 * stroke behind it, bottom right, as a ring. A click on a swatch opens the
 * browser's colour picker for it; the small arrows swap the two colours;
 * the slash turns the fill off and on (a fill that is off shows a red
 * slash). It fits the column of a ToolPalette (its bottom slot).
 *
 * Usage:
 *   const pair = createSwatchPair({
 *       stroke: { get: () => '#cc1a1a', set: (hex) => { ... } },
 *       fill:   { get: () => '#3366e6', set: (hex) => { ... }, isOn: () => true, setOn: (on) => { ... } },
 *       onSwap: () => { ... },     // optional; by default each is set to the other's colour
 *   });
 *   palette.bottom.appendChild(pair.element);
 *   pair.refresh();                // the colours read again
 */

const STYLE_ID = 'swatch-pair-style';

const CSS = `
.swatch-pair { position: relative; width: 34px; height: 34px; margin: 2px 0 1px; }
.swatch-pair__swatch { position: absolute; width: 20px; height: 20px; box-sizing: border-box; padding: 0;
                       border-radius: 2px; cursor: pointer; }
.swatch-pair__stroke { left: 12px; top: 12px; border: 5px solid #000; background: #fff;
                       box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); }
.swatch-pair__fill { left: 2px; top: 2px; border: 1px solid rgba(0, 0, 0, 0.55); }
.swatch-pair__fill--off { background: linear-gradient(to top right, #fff 45%, #d02020 45%, #d02020 55%, #fff 55%) !important; }
.swatch-pair__small { position: absolute; width: 11px; height: 11px; padding: 0; border: none; background: transparent;
                      cursor: pointer; color: #404040; }
.swatch-pair__small:hover { color: #0284c7; }
.swatch-pair__small svg { width: 11px; height: 11px; display: block; }
.swatch-pair__swap { right: 0; top: 0; }
.swatch-pair__none { left: 0; bottom: 0; }
.swatch-pair__input { position: absolute; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
`;

// two arrows: swap
const SWAP_ICON =
    '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 4 H9 M7 2 L9 4 L7 6"/><path d="M10 8 H3 M5 6 L3 8 L5 10"/></svg>';

// a box with a slash: no fill
const NONE_ICON =
    '<svg viewBox="0 0 12 12" fill="none" stroke-linecap="round">' +
    '<rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" stroke-width="1.2"/>' +
    '<path d="M2 10 L10 2" stroke="#d02020" stroke-width="1.6"/></svg>';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function makeSmallButton(cls, icon, title, action){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-pair__small ' + cls;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = icon;
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', action);
    return btn;
}

/**
 * @param {object} arg
 * @param {{get, set}} arg.stroke
 * @param {{get, set, isOn, setOn}} arg.fill
 * @param {Function} [arg.onSwap]
 */
export function createSwatchPair(arg) {
    ensureStyle();
    const stroke = arg.stroke;
    const fill = arg.fill;

    const element = document.createElement('div');
    element.className = 'swatch-pair';

    // a swatch opens the browser's colour picker of a hidden input under it
    function makeSwatch(cls, title, side){
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'swatch-pair__swatch ' + cls;
        swatch.title = title;
        swatch.setAttribute('aria-label', title);
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'swatch-pair__input';
        input.tabIndex = -1;
        input.addEventListener('input', () => { side.set(input.value); refresh(); });
        swatch.addEventListener('pointerdown', (e) => e.preventDefault());
        swatch.addEventListener('click', () => {
            if (side === fill && fill.isOn && !fill.isOn()) fill.setOn(true);
            input.value = side.get() || '#000000';
            refresh();
            input.click();
        });
        swatch.appendChild(input);
        return swatch;
    }

    const strokeEl = makeSwatch('swatch-pair__stroke', 'stroke colour', stroke);
    const fillEl = makeSwatch('swatch-pair__fill', 'fill colour', fill);
    const swapEl = makeSmallButton('swatch-pair__swap', SWAP_ICON, 'swap stroke and fill', () => {
        if (arg.onSwap) arg.onSwap();
        else { const s = stroke.get(), f = fill.get(); stroke.set(f); fill.set(s); }
        refresh();
    });
    const noneEl = makeSmallButton('swatch-pair__none', NONE_ICON, 'fill on or off', () => {
        fill.setOn(!fill.isOn());
        refresh();
    });
    // the fill in front of the stroke
    element.appendChild(strokeEl);
    element.appendChild(fillEl);
    element.appendChild(swapEl);
    if (fill.setOn) element.appendChild(noneEl);

    function refresh(){
        strokeEl.style.borderColor = stroke.get() || '#000000';
        const on = fill.isOn ? !!fill.isOn() : true;
        fillEl.style.background = fill.get() || '#ffffff';
        fillEl.classList.toggle('swatch-pair__fill--off', !on);
        fillEl.title = on ? 'fill colour' : 'no fill (a click turns it on)';
    }

    refresh();

    return { element, refresh };
}
