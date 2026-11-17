/**
 * clipboard.js
 *
 * Text on the system clipboard, for commands that copy something out of a panel
 * or paste it in.
 *
 *   if (await writeClipboardText(text)) { ... copied ... }
 *   const text = await readClipboardText();    // null: this page may not read it
 *
 * The async clipboard API needs a secure context (https, localhost) and a user
 * gesture, and the browser may ask the user to allow reading. Where it is missing
 * or refused, copying falls back to execCommand('copy'). Reading has no fallback:
 * the caller asks the user to paste the text into a field of its own.
 *
 * Several types at once, and the page's own copy, cut and paste:
 *
 *   const items = await readClipboardItems();  // [{types, get(type) -> Promise<Blob>}], null: may not read
 *   const remove = installClipboardHandlers({
 *       copy:  (dataTransfer) => true,         // true: taken (the data set), the browser's own copy not done
 *       cut:   (dataTransfer) => true,
 *       paste: (dataTransfer) => true,
 *   });
 *   if (copyByCommand()) { ... the copy handler ran ... }
 *
 * The handlers get the events of the keys (Ctrl+C, Ctrl+X, Ctrl+V) and of the
 * browser's menus, which need no permission; never while a text field has the
 * focus, where the browser copies and pastes text.
 */

/**
 * @returns {Promise<boolean>} true when the text is on the clipboard
 */
export async function writeClipboardText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        // refused (no focus, no permission): try the old way
    }

    if (typeof document === 'undefined') return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed; top:0; left:0; opacity:0; pointer-events:none;';
    document.body.appendChild(area);
    const active = document.activeElement;
    area.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (e) {
        copied = false;
    }
    area.remove();
    active?.focus?.();
    return copied;
}

/**
 * @returns {Promise<string|null>} the text on the clipboard, null when it can not be read
 */
export async function readClipboardText() {
    try {
        if (navigator.clipboard?.readText) {
            return await navigator.clipboard.readText();
        }
    } catch (e) {
        // refused or no permission
    }
    return null;
}

/**
 * the items on the system clipboard, each {types, get(type) -> Promise<Blob>};
 * the text alone where the browser reads no more; null when this page may not
 * read it (no permission, no API)
 * @returns {Promise<Array<{types: string[], get: Function}>|null>}
 */
export async function readClipboardItems() {
    try {
        if (navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            return items.map(it => ({ types: [...it.types], get: (type) => it.getType(type) }));
        }
    } catch (e) {
        // refused, or no permission: the text may still be readable
    }
    const text = await readClipboardText();
    if (text === null) return null;
    return [{ types: ['text/plain'], get: async () => new Blob([text], { type: 'text/plain' }) }];
}

/** is the element one the user types into: the browser's own copy and paste are for it */
export function isTextTarget(t) {
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
}

/**
 * routes the page's copy, cut and paste events to the handlers (each optional,
 * given the event's DataTransfer, true when it took the event); the browser's
 * own action where a text field has the focus or a handler returns false.
 * Returns the function that removes them
 */
export function installClipboardHandlers(handlers) {
    if (typeof window === 'undefined' || !window.addEventListener) return () => {};
    const listeners = ['copy', 'cut', 'paste'].map(kind => {
        const listener = (e) => {
            const handler = handlers[kind];
            if (!handler || !e.clipboardData || isTextTarget(e.target)) return;
            if (handler(e.clipboardData, e)) e.preventDefault();
        };
        window.addEventListener(kind, listener);
        return [kind, listener];
    });
    return () => listeners.forEach(([kind, listener]) => window.removeEventListener(kind, listener));
}

/**
 * a copy as from Ctrl+C, from a command (a menu item, a button) during the
 * click: the copy handler fills the clipboard; false where the browser fires
 * no copy event for it
 */
export function copyByCommand() {
    if (typeof document === 'undefined' || !document.execCommand) return false;
    try {
        return document.execCommand('copy');
    } catch (e) {
        return false;
    }
}
