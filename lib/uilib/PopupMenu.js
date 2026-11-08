/**
 * PopupMenu.js
 *
 * A small popup menu in the look of the other popups of the panels (the
 * .gui-popup classes of dat-gui-mod.css): a column of items under an anchor
 * element, or at a point.
 *
 *   showPopupMenu({
 *       anchor: button,    // the menu opens under it; a second call for the same
 *                          // anchor while the menu is open closes it (a toggle)
 *       title: 'Add',      // optional: a header row above the items
 *       items: [
 *           { label: 'Copy', title: 'a tooltip', disabled: false, action: () => { ... } },
 *           { label: 'Layers', checked: true, action: () => { ... } },   // a check mark before
 *                              // it while checked (an item with checked has a column for it)
 *           { separator: true },    // a gap between two groups of items
 *           { label: 'sun', hint: 'group', indent: 1, checked: false, keepOpen: true,
 *             action: () => { ... } },   // hint: grey text at the right; indent: steps
 *                              // to the right (a tree); keepOpen: the menu stays open after
 *                              // the action, its items asked again when items is a function
 *           { label: 'gone', alert: true },   // in the attention colour (red)
 *       ],
 *   });
 *   showPopupMenu({ anchor, items: () => [...] });   // the items asked again after a
 *                              // keepOpen item's action (they show what it changed)
 *   showPopupMenu({ x: 120, y: 80, items: [...] });   // at a point of the viewport
 *   closePopupMenu();
 *
 * A menu is above every window and dialog (Z_POPUP). One menu is open at a time.
 * It closes when an item is picked (the action runs
 * after that; not for a keepOpen item), on a click or a right click anywhere else,
 * on Escape, and when the window loses focus, scrolls or resizes. A menu higher
 * than most of the window scrolls. The anchor gets aria-expanded.
 */

// above the modal dialogs (internalWindow.js has the bands of the windows)
export const Z_POPUP = 110000;

const STYLE_ID = 'popup-menu-style';

const CSS = `
.gui-popup__item--disabled { opacity: 0.45; cursor: default; }
.gui-popup__item--disabled:hover { background: var(--background-color, #f9f9f9); }
.gui-popup__check { display: inline-block; width: 1.2em; flex: 0 0 auto; }
.gui-popup--scroll { max-height: 80vh; overflow-y: auto; }
.gui-popup__item--hinted { display: flex; gap: 10px; }
.gui-popup__label { flex: 1 1 auto; }
.gui-popup__hint { flex: 0 0 auto; color: var(--ui-hint-color, #888); }
.gui-popup__item--alert .gui-popup__label { color: var(--ui-attention-color, #d03030); }
.gui-popup__separator {
    height: 5px; box-sizing: border-box;
    background: var(--input-background-color, #e9e9ed);
    border-bottom: 1px solid var(--tile-border-color, rgba(27, 31, 36, 0.15));
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

let sAnchor = null;   // the anchor of the open menu
let sClose  = null;   // closes the open menu

export function closePopupMenu() {
    if (sClose) sClose();
}

/**
 * @param {object}      arg
 * @param {HTMLElement} [arg.anchor]  the menu opens under it
 * @param {number}      [arg.x]       without an anchor: where, in pixels of the viewport
 * @param {number}      [arg.y]
 * @param {string}      [arg.title]   a header row above the items
 * @param {Array|function} arg.items  [{ label, title, disabled, checked, action, keepOpen,
 *                                    hint, indent, alert }], or a function giving them
 */
export function showPopupMenu({ anchor = null, x = 0, y = 0, title = '', items = [] } = {}) {
    const toggleOff = !!anchor && anchor === sAnchor;
    closePopupMenu();
    const getItems = typeof items === 'function' ? items : () => items;
    const first = getItems() || [];
    if (toggleOff || first.length === 0) return;
    ensureStyle();

    const menu = document.createElement('div');
    menu.className = 'gui-popup';
    menu.style.position = 'fixed';
    menu.style.zIndex = String(Z_POPUP);
    menu.setAttribute('role', 'menu');
    menu.addEventListener('contextmenu', (e) => e.preventDefault());

    if (title) {
        const header = document.createElement('div');
        header.className = 'gui-popup__title';
        header.textContent = title;
        menu.appendChild(header);
    }
    const body = document.createElement('div');
    menu.appendChild(body);

    function itemElement(item, list) {
        if (item.separator) {
            const gap = document.createElement('div');
            gap.className = 'gui-popup__separator';
            gap.setAttribute('role', 'separator');
            return gap;
        }
        const el = document.createElement('div');
        el.className = 'gui-popup__item' + (item.disabled ? ' gui-popup__item--disabled' : '') +
                       (item.hint ? ' gui-popup__item--hinted' : '') + (item.alert ? ' gui-popup__item--alert' : '');
        const checkable = typeof item.checked === 'boolean';
        el.setAttribute('role', checkable ? 'menuitemcheckbox' : 'menuitem');
        if (checkable) {
            el.setAttribute('aria-checked', String(item.checked));
            const mark = document.createElement('span');
            mark.className = 'gui-popup__check';
            mark.textContent = item.checked ? '\u2713' : '';
            el.appendChild(mark);
        }
        const label = document.createElement('span');
        label.className = 'gui-popup__label';
        if (item.indent) label.style.paddingLeft = `${1.3*item.indent}em`;
        label.textContent = item.label;
        el.appendChild(label);
        if (item.hint) {
            const hint = document.createElement('span');
            hint.className = 'gui-popup__hint';
            hint.textContent = item.hint;
            el.appendChild(hint);
        }
        if (item.title) el.title = item.title;
        if (item.disabled) el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.disabled) return;
            if (!item.keepOpen) {
                close();
                item.action?.();
                return;
            }
            item.action?.();
            if (sClose === close) fill(getItems() || []);
        });
        return el;
    }

    // the items, again after a keepOpen item's action, scrolled as they were
    function fill(list) {
        const scroll = menu.scrollTop;
        body.replaceChildren(...list.map(item => itemElement(item, list)));
        menu.scrollTop = scroll;
    }
    fill(first);

    const box = anchor ? anchor.getBoundingClientRect() : null;
    menu.style.left = `${box ? box.left : x}px`;
    menu.style.top  = `${box ? box.bottom + 2 : y}px`;
    document.body.appendChild(menu);
    if (menu.offsetHeight > window.innerHeight*0.8) menu.classList.add('gui-popup--scroll');

    // pulled back into the viewport when it does not fit
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) {
        menu.style.left = `${Math.max(0, window.innerWidth - r.width - 4)}px`;
    }
    if (r.bottom > window.innerHeight) {
        const above = (box ? box.top - 2 : y) - r.height;
        menu.style.top = `${Math.max(0, above >= 0 ? above : window.innerHeight - r.height - 4)}px`;
    }

    // a press anywhere else closes the menu; the anchor decides for itself (it toggles)
    const onPress = (e) => {
        if (menu.contains(e.target) || anchor?.contains(e.target)) return;
        close();
    };
    const onKeyDown = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    const listeners = [
        [document, 'pointerdown', onPress,   true],
        [document, 'contextmenu', onPress,   true],
        [window,   'keydown',     onKeyDown, true],
        [window,   'blur',        () => close(), false],
        [window,   'resize',      () => close(), false],
        // not a scroll of the menu itself (a long one scrolls)
        [window,   'scroll',      (e) => { if (!(e.target instanceof Node && menu.contains(e.target))) close(); }, true],
    ];

    function close() {
        for (const [target, type, handler, capture] of listeners) {
            target.removeEventListener(type, handler, capture);
        }
        menu.remove();
        anchor?.setAttribute('aria-expanded', 'false');
        if (sClose === close) {
            sAnchor = null;
            sClose  = null;
        }
    }

    for (const [target, type, handler, capture] of listeners) {
        target.addEventListener(type, handler, capture);
    }
    anchor?.setAttribute('aria-expanded', 'true');
    sAnchor = anchor;
    sClose  = close;
}
