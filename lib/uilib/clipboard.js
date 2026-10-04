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
