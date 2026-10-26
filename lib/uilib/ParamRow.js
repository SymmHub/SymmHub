/**
 * ParamRow.js
 *
 * Several values of an object edited in one dat.gui row: a label, then a
 * control per value side by side (a number box, a checkbox, a choice, a
 * colour swatch), each dat.gui's own controller moved into the first row
 * (as ParamFloatVector does with numbers). For related values that would
 * take a row each: a colour with its opacity and width, a flag with what it
 * enables.
 *
 * It has nothing to save by default (the owner keeps the values, e.g. in
 * ParamCustom params of the same object); with serializable: true it is
 * saved as { key: value } per control.
 *
 * Usage:
 *   ParamRow({
 *       name:    'stroke',                        // label of the row
 *       tooltip: 'stroke colour, opacity and width',
 *       controls: [
 *           { kind: 'color',  obj: cfg, key: 'stroke',  tooltip: 'colour' },
 *           { kind: 'number', obj: cfg, key: 'opacity', min: 0, max: 1, step: 0.01, tooltip: 'opacity' },
 *           { kind: 'bool',   obj: cfg, key: 'filled',  tooltip: 'fill closed shapes' },
 *           { kind: 'choice', obj: cfg, key: 'cap',     choice: ['round', 'butt'], tooltip: 'cap' },
 *       ],
 *       onChange: (key) => { ... },               // the key of the control that changed
 *   })
 *
 * The owner calls updateDisplay() when it changes the values itself.
 */

const STYLE_ID = 'param-row-style';

const CSS = `
.dg li.param-row > div { display: flex; align-items: center; }
.dg li.param-row .property-name { width: 24%; flex: 0 0 24%; }
.dg li.param-row .c { width: auto; flex: 1 1 0; min-width: 0; box-sizing: border-box; padding-right: 3px; }
.dg li.param-row .c:last-child { padding-right: 0; }
.dg li.param-row .c.param-row-bool { flex: 0 0 auto; }
.dg li.param-row .c select { width: 100%; }
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

/**
 * @param {object} arg
 * @param {string} arg.name
 * @param {string} [arg.tooltip]
 * @param {Array}  arg.controls   [{ kind: 'number' | 'bool' | 'choice' | 'color', obj, key, tooltip, min, max, step, choice }]
 * @param {(key: string) => void} [arg.onChange]
 */
export function ParamRow(arg) {

    const mControls = arg.controls || [];
    let mGuiControls = [];

    function makeControl(gui, c) {
        if (c.kind === 'color') return gui.addColor(c.obj, c.key);
        if (c.kind === 'choice') return gui.add(c.obj, c.key, c.choice);
        if (c.kind === 'number') {
            // a box with both bounds given to add() stays a box (see ParamFloatVector)
            const hasRange = isDefined(c.min) && isDefined(c.max) && isDefined(c.step);
            const control = hasRange ? gui.add(c.obj, c.key, c.min, c.max, c.step) : gui.add(c.obj, c.key);
            if (!hasRange) {
                if (isDefined(c.min)) control.min(c.min);
                if (isDefined(c.max)) control.max(c.max);
                if (isDefined(c.step)) control.step(c.step);
            }
            return control;
        }
        return gui.add(c.obj, c.key);
    }

    function createUI(gui) {
        ensureStyle();

        mGuiControls = mControls.map(c => {
            const control = makeControl(gui, c);
            if (arg.onChange) control.onChange(() => arg.onChange(c.key));
            if (c.tooltip) {
                control.domElement.title = c.tooltip;
                const input = control.domElement.querySelector('input, select');
                if (input) input.title = c.tooltip;
            }
            if (c.kind === 'bool') control.domElement.classList.add('param-row-bool');
            return control;
        });
        if (!mGuiControls.length) return;

        const [first, ...rest] = mGuiControls;
        first.name(arg.name ?? '');             // before the move: name() finds the label in the row
        const li = first.__li;
        li.classList.add('param-row');
        if (arg.tooltip) li.setAttribute('title', arg.tooltip);

        // the controls of the others join the first row; their own rows stay,
        // empty and hidden, so that dat.gui can still remove them with the controllers
        const container = li.firstElementChild;
        for (const control of rest) {
            container.appendChild(control.domElement);
            control.__li.style.display = 'none';
        }
    }

    function getValue() {
        const out = {};
        mControls.forEach(c => { out[c.key] = c.obj[c.key]; });
        return out;
    }

    function setValue(value) {
        if (!value) return;
        mControls.forEach(c => { if (isDefined(value[c.key])) c.obj[c.key] = value[c.key]; });
        updateDisplay();
    }

    function updateDisplay() {
        mGuiControls.forEach(control => control.updateDisplay());
    }

    return {
        createUI,
        getValue,
        setValue,
        updateDisplay,
        serializable: (arg.serializable === true),
    };

} // ParamRow
