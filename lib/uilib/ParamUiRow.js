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
 *       flip:  base.contain(ParamBool({...}), { label: 'flip' }),   // a checkbox's text in the row
 *   };
 *
 * Without a name the controls take the whole row.
 *
 * A row can end with a hamburger, a popup menu of commands as ParamMenu's (`menu`
 * gives its items each time it opens), and a label longer than a few letters takes
 * a width of its own:
 *
 *   const move = ParamUiRow({ name: 'transform', labelWidth: 'auto',
 *       menu: () => [{ label: 'Reset', title: 'no transform', action: reset }],
 *       menuTooltip: 'commands of the transform' });
 */

import {
    showPopupMenu,
} from './modules.js';

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
.dg li.param-ui-row .param-ui-row__menu {
    order: 1; flex: 0 0 auto; width: 26px; height: 20px; padding: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    color: var(--ui-button-color, #606060);
    background: var(--ui-button-background-color, #fff);
    border: 1px solid var(--ui-button-border-color, rgba(0, 0, 0, 0.4)); border-radius: 3px;
    cursor: pointer;
}
.dg li.param-ui-row .param-ui-row__menu:hover {
    color: var(--ui-button-hover-color, #000);
    background: var(--hover-background-color, #f0f0f0);
}
.dg li.param-ui-row .param-ui-row__menu svg { width: 16px; height: 16px; }
`;

// three lines: a hamburger (as ParamMenu's)
const MENU_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/>' +
    '</svg>';

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
 * @param {string} [arg.labelWidth]  CSS width of the label (3em by default, 'auto' its text's)
 * @param {() => Array} [arg.menu]  the items of the hamburger's popup menu, which ends the row
 * @param {string} [arg.menuTooltip] tooltip of the hamburger
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
            if (arg.labelWidth) label.style.width = arg.labelWidth;
            mRow.appendChild(label);
        }
        if (arg?.menu) {
            // after the controls that join the row (its flex order)
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'param-ui-row__menu';
            if (arg.menuTooltip) { button.title = arg.menuTooltip; button.setAttribute('aria-label', arg.menuTooltip); }
            button.setAttribute('aria-haspopup', 'menu');
            button.innerHTML = MENU_ICON;
            button.addEventListener('click', () => showPopupMenu({ anchor: button, items: arg.menu() }));
            mRow.appendChild(button);
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
            item.appendChild(document.createTextNode(opt?.label ?? (name ? name.textContent : '')));
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
