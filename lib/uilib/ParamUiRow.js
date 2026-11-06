/**
 * ParamUiRow.js
 *
 * One row in a panel for the controls of several params whose values stay entries of
 * the params they are in: the row is only the place where their UI goes, as
 * ParamUiFolder is for whole rows. Each param makes its own dat.gui control, which
 * moves into the row; its value, its onChange and what a document saves stay as they
 * were. A checkbox comes with its name after it, any other control without one: the
 * label of the row says what they are.
 *
 * Usage (the row comes before the params that go into it):
 *
 *   const base = ParamUiRow({ name: 'base', tooltip: 'the base point' });
 *   const params = {
 *       base,                                       // makes the row, saves nothing
 *       baseX: base.contain(ParamFloat({...})),     // the value is params.baseX, as ever
 *       baseY: base.contain(ParamFloat({...}), { tooltip: 'Y of the base' }),
 *   };
 *
 * Without a name the controls take the whole row.
 */

const STYLE_ID = 'param-ui-row-style';

const CSS = `
.dg li.param-ui-row > div { display: flex; align-items: center; gap: 8px; height: 100%; }
.dg li.param-ui-row .property-name { flex: 0 0 auto; width: 3em; }
.dg li.param-ui-row .c { flex: 1 1 0; width: auto; min-width: 0; float: none; }
.dg li.param-ui-row .param-ui-row__check {
    flex: 0 1 auto; min-width: 0; display: inline-flex; align-items: center; gap: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
}
.dg li.param-ui-row .param-ui-row__check .c { flex: 0 0 auto; display: inline-flex; }
.dg li.param-ui-row .param-ui-row__check input { margin: 0; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * @param {object} [arg]
 * @param {string} [arg.name]     label of the row
 * @param {string} [arg.tooltip]  tooltip of the row
 */
export function ParamUiRow(arg) {

    let mRow = null;     // the row's element, the controls join it
    let mLi = null;
    let mHasKind = false;

    function createUI(gui) {
        ensureStyle();
        mLi = document.createElement('li');
        mLi.className = 'cr param-ui-row';
        if (arg?.tooltip) mLi.title = arg.tooltip;
        mRow = document.createElement('div');
        if (arg?.name) {
            const label = document.createElement('span');
            label.className = 'property-name';
            label.textContent = arg.name;
            mRow.appendChild(label);
        }
        mLi.appendChild(mRow);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(mLi);
    }

    function join(control, opt) {
        const li = control.__li;
        // the colour of the row's edge says the kind of its first control
        if (!mHasKind) {
            li.classList.forEach(c => { if (c !== 'cr' && c !== 'has-slider') mLi.classList.add(c); });
            mHasKind = true;
        }
        const name = li.querySelector('.property-name');
        const isCheck = !!control.domElement.querySelector('input[type="checkbox"]');
        let item = control.domElement;
        if (isCheck) {
            item = document.createElement('label');
            item.className = 'param-ui-row__check';
            item.appendChild(control.domElement);
            item.appendChild(document.createTextNode(name ? name.textContent : ''));
        }
        if (opt?.tooltip) {
            item.title = opt.tooltip;
            const input = control.domElement.querySelector('input, select');
            if (input) input.title = opt.tooltip;
        }
        mRow.appendChild(item);
        // its own row stays, empty and hidden, so that dat.gui can still remove it with the controller
        li.style.display = 'none';
    }

    // a param like the given one, only its control is in the row
    function contain(param, opt) {
        return {
            ...param,
            createUI: (gui) => {
                param.createUI(gui);
                const list = gui.__controllers;
                if (mRow && list && list.length) join(list[list.length - 1], opt);
            },
        };
    }

    return {
        createUI,
        contain,
        serializable: false,
    };

} // ParamUiRow
