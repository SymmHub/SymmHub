/**
 * PromptDialog.js
 *
 * A small modal dialog asking for one line of text (a name), or for a
 * confirmation - the in-app counterpart of window.prompt() / confirm(),
 * in the look of SaveAsDialog and FolderPickerDialog.
 *
 *   const dlg  = createPromptDialog();
 *
 *   const name = await dlg.prompt({
 *       title:    'Rename',
 *       label:    'Name:',
 *       value:    'old name',
 *       okLabel:  'Rename',
 *       message:  'an optional line above the field',
 *       validate: async (v) => (v ? null : 'The name is empty.'),  // null: accepted
 *   });                         // the trimmed text, or null when cancelled
 *
 *   const yes  = await dlg.confirm({
 *       title:   'Delete',
 *       message: 'Delete "x.json" and its companion files?',
 *       okLabel: 'Delete',
 *   });                         // true / false
 *
 * Enter confirms (Enter on the focused Cancel button cancels), Escape
 * cancels, Tab stays inside the dialog. One instance serves any number of
 * calls; a call made while the dialog is open cancels the pending one.
 */

import { createInternalWindow } from './modules.js';

const MYNAME = 'PromptDialog';
const FONT   = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';

// The backdrop sits in the always-on-top band; the dialog is a modal window,
// which the window manager keeps in the band above it (see internalWindow.js).
const Z_BACKDROP = 100000;

export function createPromptDialog(options = {}) {

    const width = options.width ?? '380px';

    let mResolve  = null;   // resolve() of the pending prompt() / confirm()
    let mValidate = null;
    let mIsPrompt = true;
    let mBusy     = false;  // a validation is running

    // ── DOM ───────────────────────────────────────────────────────────────────

    const backdrop = document.createElement('div');
    backdrop.style.cssText = [
        'position:fixed', 'inset:0', `z-index:${Z_BACKDROP}`, 'display:none',
        'background:rgba(0,0,0,0.4)',
        'backdrop-filter:blur(3px)', '-webkit-backdrop-filter:blur(3px)',
    ].join(';');
    document.body.appendChild(backdrop);

    const mWindow = createInternalWindow({
        title:     '',
        width,
        height:    '170px',
        left:      '200px',
        top:       '150px',
        canClose:  true,
        canResize: false,
        role:      'dialog',
        modal:     true,
    });
    mWindow.setVisible(false);
    // the close button cancels, like Cancel; Escape reaches it through the
    // window manager when the focus is outside the dialog
    mWindow.button.onclick = (e) => {
        e.preventDefault();
        close(null);
    };

    const box = document.createElement('div');
    box.style.cssText = [
        'position:absolute', 'inset:0', 'box-sizing:border-box',
        'padding:14px 16px',
        'display:flex', 'flex-direction:column', 'gap:8px',
        'overflow:hidden', 'cursor:default',
        `font-family:${FONT}`, 'font-size:13px', 'color:#333',
        'text-shadow:none',
    ].join(';');
    mWindow.interior.appendChild(box);

    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'white-space:pre-wrap; line-height:1.4; overflow-wrap:anywhere;';
    box.appendChild(messageEl);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'flex-shrink:0;';
    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'flex:1; min-width:0; padding:4px 6px; border:1px solid #aaa; border-radius:4px; font-size:13px; outline:none;';
    row.appendChild(labelEl);
    row.appendChild(input);
    box.appendChild(row);

    const errorEl = document.createElement('div');
    errorEl.style.cssText = 'color:#c00; font-size:12px; min-height:15px; overflow-wrap:anywhere;';
    box.appendChild(errorEl);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:auto;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:5px 16px; font-size:13px; cursor:pointer; border-radius:4px; border:1px solid #aaa; background:#fff; color:#333;';
    const okBtn = document.createElement('button');
    okBtn.style.cssText = 'padding:5px 16px; font-size:13px; font-weight:600; cursor:pointer; background:#1976d2; color:#fff; border:none; border-radius:4px;';
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(btnRow);

    cancelBtn.addEventListener('click', () => close(null));
    okBtn.addEventListener('click', onOk);
    input.addEventListener('input', () => setError(''));

    // ── Behaviour ─────────────────────────────────────────────────────────────

    function setError(msg) {
        errorEl.textContent = msg || '';
        input.style.borderColor = msg ? '#c00' : '#aaa';
    }

    async function onOk() {
        if (!mResolve || mBusy) return;
        if (!mIsPrompt) {
            close(true);
            return;
        }
        const value = input.value.trim();
        if (mValidate) {
            mBusy = true;
            let err = null;
            try {
                err = await mValidate(value);
            } catch (e) {
                err = String(e?.message ?? e);
            }
            mBusy = false;
            if (!mResolve) return;          // cancelled meanwhile
            if (err) {
                setError(err);
                input.focus();
                return;
            }
        }
        close(value);
    }

    // Keys are taken before anything else while the dialog is open: Enter
    // confirms, Escape cancels, Tab cycles through the dialog's own controls.
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close(null);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (document.activeElement === cancelBtn) close(null);
            else onOk();
        } else if (e.key === 'Tab') {
            const stops = mIsPrompt ? [input, cancelBtn, okBtn] : [cancelBtn, okBtn];
            const i = stops.indexOf(document.activeElement);
            let next;
            if (e.shiftKey) next = (i <= 0) ? stops.length - 1 : i - 1;
            else            next = (i < 0 || i >= stops.length - 1) ? 0 : i + 1;
            e.preventDefault();
            stops[next].focus();
        }
    }

    function center() {
        const wnd = mWindow.wnd;
        const r   = wnd.getBoundingClientRect();
        wnd.style.left = Math.max(0, Math.round((window.innerWidth  - r.width)  / 2)) + 'px';
        wnd.style.top  = Math.max(0, Math.round((window.innerHeight - r.height) / 3)) + 'px';
    }

    function open({ title, isPrompt, height }) {
        if (mResolve) close(null);          // a pending call is cancelled by the new one
        mIsPrompt = isPrompt;
        mWindow.setTitle(title);
        mWindow.wnd.style.height = height;
        row.style.display     = isPrompt ? '' : 'none';
        errorEl.style.display = isPrompt ? '' : 'none';
        setError('');
        backdrop.style.display = 'block';
        mWindow.setVisible(true);
        center();
        window.addEventListener('keydown', onKeyDown, true);
        return new Promise(resolve => { mResolve = resolve; });
    }

    function close(result) {
        const resolve = mResolve;
        mResolve  = null;
        mValidate = null;
        window.removeEventListener('keydown', onKeyDown, true);
        backdrop.style.display = 'none';
        mWindow.setVisible(false);
        if (resolve) resolve(result);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Ask for a line of text.
     * @param {object}   [p]
     * @param {string}   [p.title]
     * @param {string}   [p.label]     text before the field
     * @param {string}   [p.value]     initial text, shown selected
     * @param {string}   [p.okLabel]
     * @param {string}   [p.message]   a line above the field, when given
     * @param {function} [p.validate]  (value) => string|null, may be async:
     *                                 the reason the value is refused, or null
     * @returns {Promise<string|null>} the trimmed text, null when cancelled
     */
    function prompt({ title = 'Name', label = 'Name:', value = '', okLabel = 'OK',
                      message = '', validate = null } = {}) {
        labelEl.textContent     = label;
        okBtn.textContent       = okLabel;
        messageEl.textContent   = message;
        messageEl.style.display = message ? '' : 'none';
        input.value = value;
        const result = open({ title, isPrompt: true, height: message ? '190px' : '165px' });
        mValidate = validate;   // after open(): a pending call closed there resets it
        setTimeout(() => { input.focus(); input.select(); }, 60);
        return result;
    }

    /**
     * Ask for a confirmation.
     * @param {object} [p]
     * @param {string} [p.title]
     * @param {string} [p.message]
     * @param {string} [p.okLabel]
     * @returns {Promise<boolean>}
     */
    async function confirm({ title = 'Confirm', message = '', okLabel = 'OK' } = {}) {
        okBtn.textContent       = okLabel;
        messageEl.textContent   = message;
        messageEl.style.display = '';
        const result = open({ title, isPrompt: false, height: '160px' });
        setTimeout(() => okBtn.focus(), 60);
        return (await result) === true;
    }

    return {
        prompt,
        confirm,
        isOpen: () => mResolve !== null,
    };

} // createPromptDialog
