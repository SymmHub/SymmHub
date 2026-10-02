/**
 * ParamFloatVector.js
 *
 * Several numbers of an object edited in one dat.gui row: a label and a number
 * box per value, e.g. the R, G, B of a color. The boxes are dat.gui's own
 * number controllers (typing, arrow keys, wheel, clamping), moved into the first row.
 *
 * It is saved as { R, G, B } (the labels), the way a ParamGroup of one ParamFloat
 * per value is, so documents saved with either read in both.
 *
 * Usage:
 *   ParamFloatVector({
 *       name:   'a',                              // label of the row
 *       obj:    cfg,
 *       keys:   ['aR', 'aG', 'aB'],               // the properties of obj
 *       labels: ['R', 'G', 'B'],                  // their names in the saved form (default: keys)
 *       min: 0, max: 1, step: 0.001,              // optional, min and max come together
 *       tooltip: 'what the row is',
 *       onChange: () => { ... },
 *   })
 */

const STYLE_ID = 'param-float-vector-style';

const CSS = `
.dg li.param-vec-row .property-name { width: 14%; }
.dg li.param-vec-row .c { width: 28%; box-sizing: border-box; padding-right: 4px; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function isDefined(v) {
    return v !== undefined;
}

export function ParamFloatVector(arg) {

    const obj      = arg.obj;
    const keys     = arg.keys;
    const labels   = arg.labels ?? keys;
    const hasRange = isDefined(arg.min) && isDefined(arg.max) && isDefined(arg.step);

    let mControls = [];

    function createUI(gui) {
        ensureStyle();

        mControls = keys.map((key, i) => {
            // a box with only one of the bounds, or none, stays a box; both of them
            // would make dat.gui replace it by a slider, so give them to add()
            const control = hasRange ? gui.add(obj, key, arg.min, arg.max, arg.step) : gui.add(obj, key);
            if (!hasRange && isDefined(arg.step)) control.step(arg.step);
            if (arg.onChange) control.onChange(() => arg.onChange());
            const input = control.domElement.querySelector('input[type="text"]');
            if (input) input.title = labels[i];
            return control;
        });

        const [first, ...rest] = mControls;
        first.name(arg.name ?? '');             // before the move: name() finds the label in the row
        const li = first.__li;
        li.classList.add('param-vec-row');
        if (arg.tooltip) li.setAttribute('title', arg.tooltip);

        // the fields of the other controllers join the first row; their own rows stay,
        // empty and hidden, so that dat.gui can still remove them with the controllers
        const container = li.firstElementChild;
        for (const control of rest) {
            container.appendChild(control.domElement);
            control.__li.style.display = 'none';
        }
    }

    function getValue() {
        const out = {};
        keys.forEach((key, i) => { out[labels[i]] = obj[key]; });
        return out;
    }

    function updateDisplay() {
        mControls.forEach(control => control.updateDisplay());
    }

    function setValue(value) {
        labels.forEach((label, i) => {
            if (value && isDefined(value[label])) {
                const v = parseFloat(value[label]);
                if (!isNaN(v)) obj[keys[i]] = v;
            }
        });
        updateDisplay();
        arg.onChange?.();
    }

    function init() {
        mControls.forEach((control, i) => {
            obj[keys[i]] = control.initialValue;
            control.updateDisplay();
        });
    }

    return {
        createUI,
        getValue,
        setValue,
        init,
        updateDisplay,
        serializable: (arg.serializable !== false),
    };

} // ParamFloatVector
