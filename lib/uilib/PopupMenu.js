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
 *       items: [
 *           { label: 'Copy', title: 'a tooltip', disabled: false, action: () => { ... } },
 *           { separator: true },    // a gap between two groups of items
 *       ],
 *   });
 *   showPopupMenu({ x: 120, y: 80, items: [...] });   // at a point of the viewport
 *   closePopupMenu();
 *
 * One menu is open at a time. It closes when an item is picked (the action runs
 * after that), on a click or a right click anywhere else, on Escape, and when the
 * window loses focus, scrolls or resizes. The anchor gets aria-expanded.
 */

const STYLE_ID = 'popup-menu-style';

const CSS = `
.gui-popup__item--disabled { opacity: 0.45; cursor: default; }
.gui-popup__item--disabled:hover { background: var(--background-color, #f9f9f9); }
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
 * @param {Array}       arg.items     [{ label, title, disabled, action }]
 */
export function showPopupMenu({ anchor = null, x = 0, y = 0, items = [] } = {}) {
    const toggleOff = !!anchor && anchor === sAnchor;
    closePopupMenu();
    if (toggleOff || items.length === 0) return;
    ensureStyle();

    const menu = document.createElement('div');
    menu.className = 'gui-popup';
    menu.style.position = 'fixed';
    menu.setAttribute('role', 'menu');
    menu.addEventListener('contextmenu', (e) => e.preventDefault());

    for (const item of items) {
        if (item.separator) {
            const gap = document.createElement('div');
            gap.className = 'gui-popup__separator';
            gap.setAttribute('role', 'separator');
            menu.appendChild(gap);
            continue;
        }
        const el = document.createElement('div');
        el.className = 'gui-popup__item' + (item.disabled ? ' gui-popup__item--disabled' : '');
        el.setAttribute('role', 'menuitem');
        el.textContent = item.label;
        if (item.title) el.title = item.title;
        if (item.disabled) el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.disabled) return;
            close();
            item.action?.();
        });
        menu.appendChild(el);
    }

    const box = anchor ? anchor.getBoundingClientRect() : null;
    menu.style.left = `${box ? box.left : x}px`;
    menu.style.top  = `${box ? box.bottom + 2 : y}px`;
    document.body.appendChild(menu);

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
        [window,   'scroll',      () => close(), true],
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
