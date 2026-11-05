/**
 * ParamMenu.js
 *
 * A dat.gui row with a label and one small button (a hamburger) that opens a
 * popup menu of commands (PopupMenu.js): for several commands that would take
 * a ParamFunc row each. It has nothing to save.
 *
 * Usage:
 *   ParamMenu({
 *       name:    'add',                           // label of the row
 *       tooltip: 'a tile, an image, an SVG file', // of the button
 *       menu:    () => [                          // asked each time the menu opens
 *           { label: 'Image…', title: 'an image file', disabled: false, action: () => { ... } },
 *           { separator: true },
 *       ],
 *   })
 *
 *   row.flash()   // a check mark takes the place of the hamburger for a moment: a
 *                 // command of the menu went through, which shows nothing else
 *
 * With `action` the row says how something stands and has the one command which
 * changes that as a button of its own before the hamburger. The label takes all the
 * room the buttons leave and can be set:
 *
 *   ParamMenu({
 *       name:   'no table',
 *       menu:   () => [ ... ],
 *       action: { tooltip: 'Calculate', func: () => { ... } },   // icon: svg text, optional
 *   })
 *
 *   row.setName('68 to index 24');       // the label
 *   row.setTitle('all of it in words');  // the tooltip of the label
 *   row.setAttention(true);              // the label and the action in the accent colour
 *   row.setActionEnabled(false);         // a disabled action is dimmed
 */

import {
    showPopupMenu,
} from './modules.js';

const STYLE_ID = 'param-menu-style';

const CSS = `
.dg li.param-menu-row .c { display: flex; justify-content: flex-start; }
.param-menu-button {
    flex: 0 0 auto; width: 26px; height: 20px; margin: 2px 0 0 0; padding: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    color: var(--ui-button-color, #606060);
    background: var(--ui-button-background-color, #fff);
    border: 1px solid var(--ui-button-border-color, rgba(0, 0, 0, 0.4)); border-radius: 3px;
    cursor: pointer;
}
.param-menu-button:hover {
    color: var(--ui-button-hover-color, #000);
    background: var(--hover-background-color, #f0f0f0);
}
.param-menu-button svg { width: 16px; height: 16px; }
.param-menu-button:disabled { opacity: 0.4; cursor: default; }
.dg li.param-menu-row.param-menu-status > div { display: flex; }
.dg li.param-menu-row.param-menu-status .property-name {
    flex: 1 1 auto; width: auto; min-width: 0;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.dg li.param-menu-row.param-menu-status .c { flex: 0 0 auto; width: auto; float: none; gap: 3px; }
.dg li.param-menu-row.param-menu-attention .property-name { color: var(--ui-attention-color, #d9730d); }
.dg li.param-menu-row.param-menu-attention .param-menu-action {
    color: var(--ui-attention-color, #d9730d);
    border-color: var(--ui-attention-color, #d9730d);
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

// a circular arrow: the action's button unless it brings an icon
const ACTION_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><polyline points="20 3 20 8 15 8"/>' +
    '</svg>';

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * @param {object}   arg
 * @param {string}   arg.name
 * @param {string}   [arg.tooltip]
 * @param {() => Array} arg.menu   the items of the popup menu
 * @param {object}   [arg.action]  the row's one command: {func, tooltip, icon}
 */
export function ParamMenu(arg) {

    let mButton = null;
    let mFlashTimer = null;
    let mRow = null;
    let mLabel = null;
    let mActionButton = null;
    let mName = arg.name ?? '';
    let mTitle = '';
    let mAttention = false;
    let mActionEnabled = true;

    // what is set shows in the row, and in a row made later
    function showState() {
        if (!mRow) return;
        mLabel.textContent = mName;
        mLabel.title = mTitle;
        mRow.classList.toggle('param-menu-attention', mAttention);
        if (mActionButton) mActionButton.disabled = !mActionEnabled;
    }

    function createUI(gui) {
        ensureStyle();

        const li = document.createElement('li');
        li.className = 'cr param-menu-row';
        if (arg.action) li.classList.add('param-menu-status');

        const row = document.createElement('div');
        const label = document.createElement('span');
        label.className = 'property-name';
        row.appendChild(label);
        mRow = li;
        mLabel = label;

        const c = document.createElement('div');
        c.className = 'c';
        if (arg.action) {
            mActionButton = document.createElement('button');
            mActionButton.type = 'button';
            mActionButton.className = 'param-menu-button param-menu-action';
            if (arg.action.tooltip) {
                mActionButton.title = arg.action.tooltip;
                mActionButton.setAttribute('aria-label', arg.action.tooltip);
            }
            mActionButton.innerHTML = arg.action.icon ?? ACTION_ICON;
            mActionButton.addEventListener('click', () => arg.action.func());
            c.appendChild(mActionButton);
        }
        mButton = document.createElement('button');
        mButton.type = 'button';
        mButton.className = 'param-menu-button';
        if (arg.tooltip) { mButton.title = arg.tooltip; mButton.setAttribute('aria-label', arg.tooltip); }
        mButton.setAttribute('aria-haspopup', 'menu');
        mButton.setAttribute('aria-expanded', 'false');
        mButton.innerHTML = MENU_ICON;
        mButton.addEventListener('click', () => {
            showPopupMenu({ anchor: mButton, items: arg.menu ? arg.menu() : [] });
        });
        c.appendChild(mButton);
        row.appendChild(c);

        li.appendChild(row);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(li);
        showState();
    }

    // a check mark in the place of the hamburger for a moment
    function flash() {
        if (!mButton) return;
        clearTimeout(mFlashTimer);
        mButton.innerHTML = CHECK_ICON;
        mFlashTimer = setTimeout(() => { mButton.innerHTML = MENU_ICON; }, 1100);
    }

    return {
        createUI,
        flash,
        getName:          () => mName,
        setName:          (text) => { mName = text; showState(); },
        setTitle:         (text) => { mTitle = text; showState(); },
        setAttention:     (on) => { mAttention = !!on; showState(); },
        setActionEnabled: (on) => { mActionEnabled = !!on; showState(); },
        serializable: false,
    };

} // ParamMenu
