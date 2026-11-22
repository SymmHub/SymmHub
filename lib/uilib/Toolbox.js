/**
 * Toolbox.js
 *
 * A row of image buttons (commands, tool choices) in a small always-on-top
 * window that fits its buttons, or in an element of the owner's without a
 * window. Its look is uilib.css's: input.imgbutton, .pressed (the button's
 * "on" state), .vbar-separator, .toolbox-row, .toolbox-interior.
 *
 * Usage:
 *   const box = createToolbox({ buttons: [
 *       { name: 'settings', title: 'settings', src: 'res/settings.svg', action: toggleSettings },
 *       { separator: true, src: 'res/vbar.svg' },
 *       { name: 'move', title: 'move', src: 'res/move.svg', action: () => setTool('move') },
 *   ] });
 *   box.buttons.settings              // the button element by its name
 *   box.setPressed('move', true)      // the "on" look and aria-pressed
 *   box.add({ name: 'run', ... }, { after: 'settings' })   // a button added later
 *
 * Without a window (arg.inWindow false) the owner puts box.container where it
 * wants it.
 */

import {
    createInternalWindow,
} from './modules.js';

// a button's size in uilib.css (input.imgbutton), for the window's first width
const BUTTON_SIZE = 40;
const TITLE_HEIGHT = 22;
const EXTRA_WIDTH = 22;

/**
 * @param {object}  arg
 * @param {Array}   [arg.buttons]    [{ name, title, src, action, className } | { separator: true, src }]
 * @param {boolean} [arg.inWindow]   false: no window, the owner places box.container
 * @param {string}  [arg.title]      the window's title, 'toolbox' by default
 * @param {string}  [arg.storageId]  the window's place kept under this id, 'toolbox' by default
 * @param {string}  [arg.left]
 * @param {string}  [arg.top]
 */
export function createToolbox(arg = {}) {

    const container = document.createElement('div');
    container.className = 'toolbox-row';
    const buttons = {};

    function makeButton(spec) {
        if (spec.separator) {
            const sep = document.createElement('div');
            sep.className = 'vbar-separator';
            sep.setAttribute('role', 'separator');
            sep.setAttribute('aria-hidden', 'true');
            if (spec.className) sep.classList.add(spec.className);
            return sep;
        }
        const btn = document.createElement('input');
        btn.type = 'image';
        btn.src = spec.src;
        if (spec.title) btn.title = spec.title;
        if (spec.action) btn.onclick = spec.action;
        btn.className = 'imgbutton';
        if (spec.className) btn.classList.add(spec.className);
        if (spec.name) buttons[spec.name] = btn;
        return btn;
    }

    // a button at the end, or after the button named opt.after
    function add(spec, opt = {}) {
        const btn = makeButton(spec);
        const after = opt.after ? buttons[opt.after] : null;
        if (after) after.insertAdjacentElement('afterend', btn);
        else container.appendChild(btn);
        return btn;
    }

    (arg.buttons || []).forEach(spec => add(spec));

    function setPressed(name, on) {
        const btn = buttons[name];
        if (!btn) return;
        btn.classList.toggle('pressed', !!on);
        btn.setAttribute('aria-pressed', String(!!on));
    }

    let intWin = null;
    if (arg.inWindow !== false) {
        const count = container.children.length;
        intWin = createInternalWindow({
            width:         Math.ceil(BUTTON_SIZE*count + EXTRA_WIDTH) + 'px',
            height:        (BUTTON_SIZE + TITLE_HEIGHT) + 'px',
            left:          arg.left || '1px',
            top:           arg.top || '1px',
            title:         arg.title ?? 'toolbox',
            canResize:     false,
            canClose:      false,
            alwaysOnTop:   true,
            alwaysVisible: true,
            storageId:     arg.storageId ?? 'toolbox',
        });
        intWin.interior.classList.add('toolbox-interior');
        intWin.interior.appendChild(container);
        // the window fits its buttons (sized by the page's style), also when
        // some are added later
        const fit = () => intWin.setInteriorSize(container.offsetWidth, container.offsetHeight);
        fit();
        new ResizeObserver(fit).observe(container);
    }

    return {
        container,
        buttons,
        intWin,
        add,
        setPressed,
    };
}
