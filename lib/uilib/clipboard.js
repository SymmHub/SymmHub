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
 *
 * More than text, for other programs (the async API; a copy event's
 * DataTransfer takes text only):
 *
 *   await writeClipboardItems({ 'text/plain': text, 'image/svg+xml': text,
 *                               'image/png': () => svgPngBlob(text, { unitPx }) });   // false: refused, the clipboard as it was
 *   clipboardSupports('image/svg+xml');        // can the async API write it
 *   svgOfHtml(html);                           // the first <svg> of a web page's copy, as an SVG document, or null
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

/**
 * can the async clipboard write this type: ClipboardItem.supports where the
 * browser has it, else the three types every browser with ClipboardItem
 * writes; false without ClipboardItem
 */
export function clipboardSupports(type) {
    if (typeof ClipboardItem === 'undefined') return false;
    if (typeof ClipboardItem.supports === 'function') {
        try {
            return !!ClipboardItem.supports(type);
        } catch (e) {
            return false;
        }
    }
    return ['text/plain', 'text/html', 'image/png'].includes(type);
}

/**
 * several types at once onto the system clipboard through the async API, as
 * one item: entries {type: string | Blob | Promise<Blob> | () => Promise<Blob>}
 * (a promise: drawn while the write waits; a function: called only when its
 * type is written); a type the browser does not write is left out.
 * true when written; false where the API is missing or the write was refused
 * or a promise failed, the clipboard then as it was
 * @returns {Promise<boolean>}
 */
export async function writeClipboardItems(entries) {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    const data = {};
    for (const [type, value] of Object.entries(entries || {})) {
        if (value === null || value === undefined || !clipboardSupports(type)) continue;
        const v = (typeof value === 'function') ? value() : value;
        // a promise that fails fails the write; a write refused before it looks leaves its failure unseen
        if (v && typeof v.then === 'function') v.then(null, () => {});
        data[type] = (typeof v === 'string') ? new Blob([v], { type }) : v;
    }
    if (!Object.keys(data).length) return false;
    try {
        await navigator.clipboard.write([new ClipboardItem(data)]);
        return true;
    } catch (e) {
        return false;
    }
}

/** the root <svg ...> tag of an SVG text, or null */
function rootTag(svgText) {
    const m = typeof svgText === 'string' ? svgText.match(/<svg\b[^>]*>/i) : null;
    return m ? m[0] : null;
}

/**
 * the size {width, height} in pixels of a picture of an SVG text: unitPx
 * pixels to a unit of its viewBox (its width and height without one), the
 * longer side at most maxSide and the shorter at least a pixel; null when
 * the SVG has no size
 */
export function svgPictureSize(svgText, { unitPx = 1, maxSide = 4096 } = {}) {
    const tag = rootTag(svgText);
    if (!tag) return null;
    const attr = (name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
    let w = NaN, h = NaN;
    const vb = attr('viewBox');
    if (vb) {
        const v = vb.trim().split(/[\s,]+/).map(Number);
        if (v.length === 4) { w = v[2]; h = v[3]; }
    }
    if (!(w > 0 && h > 0)) { w = parseFloat(attr('width')); h = parseFloat(attr('height')); }
    if (!(w > 0 && h > 0) || !(unitPx > 0)) return null;
    let s = unitPx;
    if (Math.max(w, h)*s > maxSide) s = maxSide/Math.max(w, h);
    return { width: Math.max(1, Math.round(w*s)), height: Math.max(1, Math.round(h*s)) };
}

/**
 * a picture of an SVG text: a PNG blob drawn on a transparent canvas, its
 * size by svgPictureSize (unitPx pixels to a unit of its viewBox, maxSide
 * at most); rejects where the browser cannot draw it
 * @returns {Promise<Blob>}
 */
export function svgPngBlob(svgText, opt = {}) {
    return new Promise((resolve, reject) => {
        const size = svgPictureSize(svgText, opt);
        if (!size || typeof document === 'undefined' || typeof Image === 'undefined') {
            reject(new Error('the SVG cannot be drawn here'));
            return;
        }
        // the picture's size in the SVG itself: the browser draws it at that size, not scaled up
        const sized = svgText.replace(rootTag(svgText), tag => tag
            .replace(/\s(width|height)="[^"]*"/g, '')
            .replace(/^<svg\b/i, `<svg width="${size.width}" height="${size.height}"`));
        const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = size.width;
                canvas.height = size.height;
                canvas.getContext('2d').drawImage(img, 0, 0, size.width, size.height);
                canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('the canvas gave no PNG'))), 'image/png');
            } catch (e) {
                reject(e);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('the SVG could not be drawn')); };
        img.src = url;
    });
}

/**
 * the first <svg> element of an HTML text (what a copy from a web page puts
 * on the clipboard) as an SVG document text, or null without one: through the
 * browser's HTML parser where there is one, else cut out of the text (an
 * xmlns put on it when missing)
 */
export function svgOfHtml(html) {
    if (typeof html !== 'string' || !/<svg[\s>]/i.test(html)) return null;
    if (typeof DOMParser === 'function' && typeof XMLSerializer === 'function') {
        try {
            const svg = new DOMParser().parseFromString(html, 'text/html').querySelector('svg');
            return svg ? new XMLSerializer().serializeToString(svg) : null;
        } catch (e) {
            // the text's own cut below
        }
    }
    const start = html.search(/<svg[\s>]/i);
    const re = /<(\/?)svg\b[^>]*?(\/?)>/gi;
    re.lastIndex = start;
    let depth = 0, m, out = null;
    while ((m = re.exec(html))) {
        if (m[1]) depth--;
        else if (!m[2]) depth++;
        if (depth === 0) { out = html.slice(start, m.index + m[0].length); break; }
    }
    if (!out) return null;
    const tag = rootTag(out);
    let fixed = tag;
    if (!/\sxmlns="/.test(fixed)) fixed = fixed.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    if (/\bxlink:/.test(out) && !/\sxmlns:xlink="/.test(fixed)) fixed = fixed.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    return fixed + out.slice(tag.length);
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
