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

/**
 * @param {object}   arg
 * @param {string}   arg.name
 * @param {string}   [arg.tooltip]
 * @param {() => Array} arg.menu   the items of the popup menu
 */
export function ParamMenu(arg) {

    let mButton = null;
    let mFlashTimer = null;

    function createUI(gui) {
        ensureStyle();

        const li = document.createElement('li');
        li.className = 'cr param-menu-row';

        const row = document.createElement('div');
        const label = document.createElement('span');
        label.className = 'property-name';
        label.textContent = arg.name ?? '';
        row.appendChild(label);

        const c = document.createElement('div');
        c.className = 'c';
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
        serializable: false,
    };

} // ParamMenu
