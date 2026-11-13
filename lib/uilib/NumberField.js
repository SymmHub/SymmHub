/**
 * NumberField.js
 *
 * A number in a text field, stepped digit by digit, as the number box of the
 * dat.gui in lib/datgui (NumberControllerBox) does it, for the panels that
 * are not dat.gui (the tool bars of PropertyBar, the layer list):
 *
 *   - the wheel over the focused field, or the Up / Down keys, add or take
 *     one unit of the digit after the caret: with the caret before the 3 of
 *     12.345 a notch steps by 0.1, before the 1 by 10; the caret at the end
 *     steps one digit finer than the last one, which then shows (an integer
 *     field stops at 1);
 *   - the caret stays before the digit it steps (also across a carry, 9.9 to
 *     10.0, and a sign), so the next notch steps the same digit; a click,
 *     Left / Right choose another;
 *   - with the whole text selected (the field reached by Tab) the field's
 *     own step's digit is stepped;
 *   - the small up / down arrows at the right of the field (as those of an
 *     <input type=number>) step the same digit: the one after the caret in
 *     the focused field (a click on them keeps the focus and the caret), else
 *     the one the caret was on when the field was left (at first the step's
 *     digit); held down, they repeat; their tooltip tells the step;
 *   - a typed number is set as it is typed, kept to as many decimals as it
 *     has; Enter or Escape leave the field (the keys go back to the canvas).
 *
 * The value shows with `digits` decimals (trailing zeros too, so that every
 * digit is there to put the caret before); once a finer digit was stepped
 * or typed, the finer decimals too where they are not zeros.
 *
 * Usage:
 *   const field = createNumberField({
 *       get: () => cfg.radius, set: (v) => { cfg.radius = v; },
 *       min: 0, max: 10, digits: 3, title: 'radius',
 *       onCommit: () => {...},     // a step done, or the field left
 *   });
 *   parent.appendChild(field.el);  // the field: its input (field.input) and the arrows
 *   field.update();                // shows the value again (the owner changed it)
 *
 * The digit arithmetic (digitUnitAt, caretBeforeUnit, stepNumber,
 * formatNumber, formatShown) is exported for tests: tests/uilib/number_field.mjs.
 */

const STYLE_ID = 'number-field-style';

// px of the spin buttons' column, inside the field's border at its right
const SPIN_W = 11;

const CSS = `
.number-field { position: relative; display: inline-flex; vertical-align: middle; box-sizing: border-box; height: 22px; }
.number-field__input { width: 100%; height: 100%; margin: 0; box-sizing: border-box; padding: 0 ${SPIN_W + 2}px 0 3px;
                       font: inherit; font-variant-numeric: tabular-nums;
                       border: 1px solid #767676; border-radius: 2px; background: #fff; color: inherit; }
.number-field__input:disabled { opacity: 0.5; }
.number-field__spin { position: absolute; top: 1px; bottom: 1px; right: 1px; width: ${SPIN_W}px;
                      display: flex; flex-direction: column; }
.number-field__spin button { flex: 1 1 0; min-height: 0; margin: 0; padding: 0; border: 0; border-radius: 1px;
                             display: flex; align-items: center; justify-content: center;
                             background: transparent; color: #707070; cursor: default; }
.number-field__spin button:hover { background: #e2e2e2; color: #303030; }
.number-field__spin button:active { background: #c8c8c8; }
.number-field__spin button:disabled { opacity: 0.4; background: transparent; }
.number-field__spin svg { width: 7px; height: 4px; pointer-events: none; }
`;

// the spin buttons' arrows
const ARROW_UP = '<svg viewBox="0 0 7 4"><path d="M0 4 L3.5 0 L7 4 Z" fill="currentColor"/></svg>';
const ARROW_DOWN = '<svg viewBox="0 0 7 4"><path d="M0 0 L3.5 4 L7 0 Z" fill="currentColor"/></svg>';
// a spin button held: the first repeat after SPIN_DELAY ms, then one every SPIN_REPEAT ms
const SPIN_DELAY = 400;
const SPIN_REPEAT = 70;

// the most decimals a field shows or steps
const MAX_DECIMALS = 10;
// wheel delta in px of one mouse notch; finer deltas (a touchpad) add up to half of it per step
const WHEEL_NOTCH = 100;
const WHEEL_LINE_PX = 33;
// the smallest notch-sized delta seen (100 px, or 125 with some screen scales): an event
// of several of them (the browser joins fast notches into one event) steps as many times
let gNotch = Infinity;
// the line of the tooltip that tells how to step
const STEP_HINT = 'wheel, ↑ ↓ or the arrows at the right: step the digit after the caret';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// a plain decimal as typed or shown: sign, integer digits, fraction digits
const DECIMAL = /^(\s*[+-]?)(\d*)(?:\.(\d*))?\s*$/;

/**
 * the place of a decimal text's digits: { first, dot, last } with first the
 * index of its first digit, dot the index of its point (or of where it
 * would be), last the index after its last digit; null when the text is no
 * plain decimal (an exponent, letters)
 */
function digitsOf(text){
    const m = DECIMAL.exec(text);
    if (!m || (m[2].length === 0 && !m[3])) return null;
    const first = m[1].length;
    const dot = first + m[2].length;
    const last = m[3] === undefined ? dot : dot + 1 + m[3].length;
    return { first, dot, last };
}

/**
 * the power of ten of the digit after the caret: 1 for the tens, 0 the
 * units, -1 the tenths; a caret before the sign or the point means the
 * next digit; the caret after the last digit one digit finer than that.
 * null when the text is no plain decimal
 */
export function digitUnitAt(text, caret){
    const d = digitsOf(text);
    if (!d) return null;
    let i = Math.max(caret, d.first);
    if (i === d.dot) i++;                       // the point: the first decimal
    if (i < d.dot) return d.dot - 1 - i;
    if (i >= d.last) {
        // after the last digit: one finer than it
        const lastPow = d.last > d.dot ? -(d.last - d.dot - 1) : 0;
        return lastPow - 1;
    }
    return -(i - d.dot);
}

/**
 * the caret's index before the digit of power p in the text: before the
 * first digit when the number has none so large, at the end when it has
 * none so fine
 */
export function caretBeforeUnit(text, p){
    const d = digitsOf(text);
    if (!d) return text.length;
    if (p >= 0) return Math.max(d.first, d.dot - 1 - p);
    return Math.min(text.length, d.dot - p);
}

/** decimals of a typed number */
export function decimalsOf(text){
    const m = DECIMAL.exec(text);
    return m && m[3] ? m[3].length : 0;
}

/** fewest decimals (up to MAX_DECIMALS) that show a value without float noise */
export function autoDecimals(v){
    if (!Number.isFinite(v)) return 0;
    const s = String(Number(v.toFixed(MAX_DECIMALS)));
    if (s.includes('e')) return MAX_DECIMALS;
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
}

/** the value with that many decimals, never "-0.000" */
export function formatNumber(v, decimals){
    if (!Number.isFinite(v)) return '';
    const s = v.toFixed(Math.max(0, Math.min(MAX_DECIMALS, decimals)));
    return Number(s) === 0 ? s.replace('-', '') : s;
}

/**
 * the text a field shows: base decimals always (their trailing zeros too),
 * up to extra ones (a finer digit stepped or typed) where they are not zeros
 */
export function formatShown(v, base, extra){
    let s = formatNumber(v, Math.max(base, extra));
    const dot = s.indexOf('.');
    if (extra > base && dot >= 0) {
        const least = base > 0 ? dot + 1 + base : dot;
        while (s.length > least && s.endsWith('0')) s = s.slice(0, -1);
        if (s.endsWith('.')) s = s.slice(0, -1);
    }
    return s;
}

/**
 * v plus n units of the power p, rounded to decimals (at least the step's
 * own), within [min, max]
 */
export function stepNumber(v, p, n, decimals, min, max){
    const dec = Math.min(MAX_DECIMALS, Math.max(decimals, -p));
    let x = Number((v + n*Math.pow(10, p)).toFixed(dec));
    if (min !== undefined && min !== null) x = Math.max(min, x);
    if (max !== undefined && max !== null) x = Math.min(max, x);
    return x;
}

/** the power of ten of a step's leading digit: 0.05 -> -2, 1 -> 0 */
function stepPower(step){
    return Math.floor(Math.log10(step) + 1e-9);
}

/** a power of ten as a step: 2 -> "100", -2 -> "0.01" */
export function unitText(p){
    return p >= 0 ? String(Math.pow(10, p)) : Math.pow(10, p).toFixed(Math.min(MAX_DECIMALS, -p));
}

/** characters a field needs for its range and decimals, between 4 and 9 */
function charsFor(arg, decimals){
    const big = Math.max(Math.abs(arg.min ?? 0), Math.abs(arg.max ?? 10));
    const intDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, big))) + 1);
    const sign = (arg.min === undefined || arg.min < 0) ? 1 : 0;
    const frac = decimals > 0 ? decimals + 1 : 0;
    return Math.max(4, Math.min(9, intDigits + sign + frac));
}

/**
 * @param {object} arg
 * @param {() => number} arg.get        the value shown
 * @param {(v: number) => void} arg.set a value typed or stepped
 * @param {number} [arg.min]
 * @param {number} [arg.max]
 * @param {number} [arg.step]     the step whose digit a field with all its text selected steps;
 *                                with no digits, it gives the decimals shown
 * @param {number} [arg.digits]   decimals shown (at least); without it and the step, as few as show the value
 * @param {boolean} [arg.integer] whole numbers only (digits 0 means it too)
 * @param {number} [arg.width]    the width in characters (by the range and the decimals when absent)
 * @param {string} [arg.title]    the tooltip; a line on the stepping goes under it
 * @param {string} [arg.ariaLabel]
 * @param {() => void} [arg.onCommit] a step done, an arrow let go, or the field left
 * @returns {{ el: HTMLElement, input: HTMLInputElement, update: (force?: boolean) => void, busy: () => boolean }}
 *          el holds the input and the arrows (buttons: an owner disabling
 *          the field disables them too); busy(): the field is focused or an
 *          arrow held, so an owner that draws its controls again waits
 */
export function createNumberField(arg){
    ensureStyle();

    const integer = arg.integer === true || arg.digits === 0 ||
                    (arg.digits === undefined && arg.step !== undefined && Number.isInteger(arg.step));
    // the decimals shown: the owner's, or the step's, or 'auto' (as many as the value needs)
    const baseDecimals = integer ? 0
        : (arg.digits ?? (arg.step ? Math.max(0, -stepPower(arg.step)) : 'auto'));
    // more decimals, once a finer digit was stepped or typed
    let mExtra = 0;
    // the last step: its power and where it left the caret, so the next one steps the same digit
    let mLast = null;
    // a number is being typed: the shown value does not replace it
    let mTyping = false;
    // the finer wheel deltas, added up
    let mWheel = 0;
    // the power of the digit the caret was on when the field was left: the arrows' step then
    let mUnit = null;
    // an arrow is held down
    let mHeld = false;

    const box = document.createElement('span');
    box.className = 'number-field';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'number-field__input';
    input.inputMode = 'decimal';
    input.spellcheck = false;
    input.autocomplete = 'off';
    const title = arg.title ? arg.title + '\n' + STEP_HINT : STEP_HINT;
    input.title = title;
    if (arg.ariaLabel || arg.title) input.setAttribute('aria-label', arg.ariaLabel || arg.title);
    const chars = arg.width ?? charsFor(arg, baseDecimals === 'auto' ? 3 : baseDecimals);
    box.style.width = `calc(${chars}ch + ${8 + SPIN_W}px)`;
    box.appendChild(input);

    const focused = () => document.activeElement === input;

    // the decimals a step rounds to
    function decimalsFor(v){
        if (integer) return 0;
        const base = baseDecimals === 'auto' ? autoDecimals(v) : baseDecimals;
        return Math.min(MAX_DECIMALS, Math.max(base, mExtra));
    }

    // the text of a value: the base decimals, the extra ones where they are not zeros
    function textOf(v){
        if (integer) return formatNumber(v, 0);
        return formatShown(v, baseDecimals === 'auto' ? autoDecimals(v) : baseDecimals, mExtra);
    }

    function clamp(v){
        if (arg.min !== undefined && arg.min !== null) v = Math.max(arg.min, v);
        if (arg.max !== undefined && arg.max !== null) v = Math.min(arg.max, v);
        return integer ? Math.round(v) : v;
    }

    function value(){
        const v = Number(arg.get());
        return Number.isFinite(v) ? v : 0;
    }

    /** the value in the field; a focused field keeps its caret at the same digit */
    function show(v){
        const text = textOf(v);
        if (input.value === text) return;
        if (!focused() || input.selectionStart !== input.selectionEnd) {
            input.value = text;
            if (mLast) mLast = null;
            return;
        }
        const old = input.value, caret = input.selectionStart;
        const p = (mLast && mLast.caret === caret) ? mLast.p : digitUnitAt(old, caret);
        input.value = text;
        if (p === null) return;
        const at = caretBeforeUnit(text, p);
        input.setSelectionRange(at, at);
        if (mLast) mLast = { p, caret: at };
    }

    /** the power of the step's leading digit, or of the last digit shown */
    function defaultUnit(){
        return arg.step ? stepPower(arg.step) : -decimalsFor(value());
    }

    /** a power as a field steps it: whole for an integer field, not finer than MAX_DECIMALS */
    function allowed(p){
        if (p === null) p = defaultUnit();
        if (integer) p = Math.max(0, p);
        return Math.max(-MAX_DECIMALS, p);
    }

    /** the power of the digit after the caret (the field's step's with a selection) */
    function caretUnit(){
        const s = input.selectionStart, e = input.selectionEnd;
        if (mLast && s === e && s === mLast.caret) return allowed(mLast.p);
        if (s !== e) return allowed(defaultUnit());
        return allowed(digitUnitAt(input.value, s));
    }

    /** the power the arrows step: at the caret of the focused field, else where the caret was left */
    function spinUnit(){
        return focused() ? caretUnit() : allowed(mUnit);
    }

    /** n units of the power p added; in the focused field the caret goes back before that digit */
    function stepBy(p, n){
        if (!integer && -p > mExtra && (baseDecimals === 'auto' || -p > baseDecimals)) mExtra = -p;
        // the number being typed, if it is one, else the owner's value
        const text = input.value;
        const typed = mTyping ? Number(text.trim().replace(',', '.')) : NaN;
        const v0 = Number.isFinite(typed) && text.trim() !== '' ? typed : value();
        const v = stepNumber(v0, p, n, decimalsFor(v0), arg.min, arg.max);
        mTyping = false;
        arg.set(integer ? Math.round(v) : v);
        const shown = value();
        if (focused()) {
            input.value = textOf(shown);
            const at = caretBeforeUnit(input.value, p);
            input.setSelectionRange(at, at);
            mLast = { p, caret: at };
        } else {
            show(shown);
        }
        arg.onCommit?.();
    }

    /** n units of the digit after the caret added */
    function step(n){
        stepBy(caretUnit(), n);
    }

    // the arrows at the right: a press steps once, held it repeats
    const spin = document.createElement('span');
    spin.className = 'number-field__spin';
    const spinButton = (icon, dir) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.tabIndex = -1;
        btn.insertAdjacentHTML('beforeend', icon);
        btn.setAttribute('aria-label', dir > 0 ? 'step up' : 'step down');
        let timer = null;
        const stop = () => {
            clearTimeout(timer); clearInterval(timer); timer = null;
            if (!mHeld) return;
            mHeld = false;
            arg.onCommit?.();
        };
        btn.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            // the focus and the caret stay where they are
            e.preventDefault();
            e.stopPropagation();
            stop();
            mHeld = true;
            stepBy(spinUnit(), dir);
            timer = setTimeout(() => { timer = setInterval(() => stepBy(spinUnit(), dir), SPIN_REPEAT); }, SPIN_DELAY);
            try { btn.setPointerCapture(e.pointerId); } catch (err) { /* untracked pointer */ }
        });
        btn.addEventListener('pointerup', stop);
        btn.addEventListener('pointercancel', stop);
        btn.addEventListener('lostpointercapture', stop);
        // the tooltip tells the step the arrow makes now
        btn.addEventListener('pointerenter', () => {
            btn.title = `${dir > 0 ? '+' : '−'}${unitText(spinUnit())}: ` +
                        (focused() ? 'the digit after the caret'
                                   : mUnit === null ? 'the field’s step' : 'the digit the caret was on');
        });
        spin.appendChild(btn);
        return btn;
    };
    spinButton(ARROW_UP, 1);
    spinButton(ARROW_DOWN, -1);
    box.appendChild(spin);

    input.addEventListener('input', () => {
        mTyping = true;
        mLast = null;
        const text = input.value.trim().replace(',', '.');
        if (text === '' || text === '-' || text === '+' || text === '.') return;
        const v = Number(text);
        if (!Number.isFinite(v)) return;
        if (!integer) mExtra = Math.max(mExtra, Math.min(MAX_DECIMALS, decimalsOf(text)));
        arg.set(clamp(v));
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            step(e.key === 'ArrowUp' ? 1 : -1);
        } else if (e.key === 'Enter' || e.key === 'Escape') {
            // leaving the field gives the keys back to the canvas and its tools
            e.preventDefault();
            input.blur();
        }
    });

    // over the input and the arrows
    box.addEventListener('wheel', (e) => {
        if (!focused()) return;
        e.preventDefault();
        e.stopPropagation();
        // Shift+wheel comes as a horizontal scroll
        let d = e.deltaY || e.deltaX;
        if (e.deltaMode === 1) d *= WHEEL_LINE_PX;
        else if (e.deltaMode === 2) d *= WHEEL_NOTCH;
        if (!d) return;
        let n = 1;
        if (Math.abs(d) >= WHEEL_NOTCH/2) {
            mWheel = 0;
            gNotch = Math.min(gNotch, Math.abs(d));
            n = Math.max(1, Math.min(10, Math.round(Math.abs(d)/gNotch)));
        } else {
            // a touchpad: the small deltas add up to a step
            if (Math.sign(d) !== Math.sign(mWheel)) mWheel = 0;
            mWheel += d;
            if (Math.abs(mWheel) < WHEEL_NOTCH/2) return;
            d = mWheel;
            mWheel = 0;
        }
        step(d < 0 ? n : -n);
    }, { passive: false });

    input.addEventListener('blur', () => {
        // the digit the caret is on: the arrows step it while the field is not focused
        if (input.selectionStart === input.selectionEnd) mUnit = caretUnit();
        mTyping = false;
        mLast = null;
        mWheel = 0;
        show(value());
        arg.onCommit?.();
    });

    /** the value shown again; not over a number being typed unless forced */
    function update(force = false){
        if (mTyping && focused() && !force) return;
        if (force) mTyping = false;
        show(value());
    }

    update();
    return { el: box, input, update, busy: () => focused() || mHeld };
}
