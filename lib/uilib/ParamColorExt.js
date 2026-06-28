import { ColorInput } from './ColorInput.js';

/**
 * ParamColorExt
 *
 * A drop-in replacement for ParamColor that uses ColorInput (hex text field +
 * native browser color swatch) instead of dat.gui's built-in compact swatch.
 *
 * Accepts the same argument shape as ParamColor:
 *   { obj, key, name, onChange, listen }
 *
 * Returns the same interface:
 *   { createUI(gui), getValue(), setValue(v), updateDisplay() }
 *
 * createUI() injects a native <li class="cr"> row into dat.gui's <ul> so the
 * row blends visually with the surrounding dat.gui panel.
 */
export function ParamColorExt(arg) {

    const obj  = arg.obj;
    const key  = arg.key;
    const name = arg.name || key;

    let ci = null;   // ColorInput instance — created lazily inside createUI()

    // ── createUI ─────────────────────────────────────────────────────────────
    function createUI(gui) {

        // Build a row that matches dat.gui's native controller row structure:
        //   <li class="cr color-ext">
        //     <span class="property-name">label</span>
        //     <div  class="c">  ← dat.gui's right-hand "control" column
        //       [ColorInput widgets]
        //     </div>
        //   </li>

        const li = document.createElement('li');
        li.className = 'cr color-ext';
        // .cr.color already has overflow:visible; our class needs it too
        li.style.overflow = 'visible';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'property-name';
        labelSpan.textContent = name;
        li.appendChild(labelSpan);

        // Don't use class="c" — it inherits .c input[type=text] { width:100%; float:right }
        // which forces the text field to full width and hides the color swatch.
        // Mirror .c's layout manually instead.
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
            'float:left; width:60%; display:flex; align-items:center;' +
            ' padding:2px 4px; box-sizing:border-box; overflow:visible;';
        li.appendChild(wrapper);

        ci = new ColorInput(wrapper, false);
        ci.setValue(obj[key]);

        // ── Restyle ColorInput elements ───────────────────────────────────────

        // 1. Text field: just wide enough for '#rrggbb'
        ci.textElement.style.width    = '68px';
        ci.textElement.style.flex     = '0 0 68px';
        ci.textElement.style.fontSize = '11px';
        ci.textElement.style.padding  = '2px 3px';

        // 2. Remove the spacer between text and swatch
        ci.firstSpace.style.display = 'none';

        // 3. Make the native <input type="color"> invisible but functional —
        //    it still handles the browser color-picker dialog.
        ci.colorElement.style.cssText =
            'position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;';

        // 4. Wide colored swatch div that triggers the hidden picker on click
        let swatch = null;
        swatch = document.createElement('div');
        swatch.style.cssText =
            'flex:1; height:20px; min-width:30px; border-radius:3px;' +
            ' cursor:pointer; border:1px solid #666; box-sizing:border-box; margin-left:4px;';
        swatch.style.backgroundColor = ci.getValue();
        swatch.addEventListener('click', () => ci.colorElement.click());
        wrapper.appendChild(swatch);

        // 5. Eyedropper button — pick color from any pixel on screen.
        //    Uses the browser EyeDropper API (Chrome/Edge 95+).
        if (window.EyeDropper) {

            const pickBtn = document.createElement('div');
            pickBtn.title = 'Pick colour from screen';
            const BASE =
                'flex:0 0 18px; width:18px; height:18px; border-radius:2px;' +
                ' cursor:pointer; margin-left:3px; box-sizing:border-box; border:none;' +
                ' display:flex; align-items:center; justify-content:center;' +
                ' user-select:none; transition:background 0.1s;';
            const IDLE_STYLE   = BASE + ' background:transparent; color:var(--ui-button-color, #606060);';
            const HOVER_STYLE  = BASE + ' background:var(--hover-background-color, rgba(0,0,0,0.07)); color:var(--ui-button-hover-color, #000);';
            const ACTIVE_STYLE = BASE + ' background:var(--active-button-background-color, #cbe2ff); color:var(--button-color, #1756a9);';
            pickBtn.style.cssText = IDLE_STYLE;
            pickBtn.innerHTML =
                `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                   <path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.41-1.41
                            -1.42 1.41 1.41 1.42L5 15.25V19h3.75l7.42-7.42 1.41 1.41
                            1.42-1.41-1.42-1.41 3.12-3.12a1 1 0 0 0 .01-1.42z"/>
                 </svg>`;

            pickBtn.onmouseenter = () => { if (!mPicking) pickBtn.style.cssText = HOVER_STYLE; };
            pickBtn.onmouseleave = () => { if (!mPicking) pickBtn.style.cssText = IDLE_STYLE; };

            let mPicking = false;
            pickBtn.addEventListener('click', async () => {
                if (mPicking) return;
                mPicking = true;
                pickBtn.style.cssText = ACTIVE_STYLE;
                try {
                    const dropper = new EyeDropper();
                    const result  = await dropper.open();
                    ci.updateValue(result.sRGBHex);
                } catch (_) {
                    // user pressed Escape or browser denied — silently ignore
                } finally {
                    mPicking = false;
                    pickBtn.style.cssText = IDLE_STYLE;
                }
            });

            wrapper.appendChild(pickBtn);
        }

        // ── Wire onChange ─────────────────────────────────────────────────────
        ci.onChange = (color) => {
            obj[key] = color;
            swatch.style.backgroundColor = color;
            if (arg.onChange) arg.onChange(color);
        };

        // Keep swatch in sync when setValue is called externally
        const _baseSetValue = setValue;
        setValue = (value) => {
            _baseSetValue(value);
            if (swatch) swatch.style.backgroundColor = value;
        };

        // Append to dat.gui's internal <ul> (same node addRow() uses)
        gui.__ul.appendChild(li);
    }

    // ── getValue / setValue / updateDisplay ───────────────────────────────────

    function getValue() {
        return obj[key];
    }

    function setValue(value) {
        obj[key] = value;
        if (ci) ci.setValue(value);
        if (arg.onChange) arg.onChange(value);
    }

    function updateDisplay() {
        if (ci) ci.setValue(obj[key]);
    }

    return {
        createUI,
        getValue,
        setValue,
        updateDisplay,
    };
}
