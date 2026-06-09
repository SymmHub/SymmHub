/**
 * SaveAsDialog.js
 *
 * Small floating InternalWindow for "Save As" / "Save New" operations.
 *
 *   const dlg = createSaveAsDialog({ storageId: 'saveAsDialog' });
 *   dlg.show({
 *       suggestedName:   'my-preset',
 *       suggestedHandle: folderHandle,   // FileSystemDirectoryHandle or null
 *       onSave:   (name, folderHandle) => { ... },
 *       onCancel: () => { ... },
 *   });
 */

import { createInternalWindow } from './internalWindow.js';
import { createFileSelectionDialog } from './FileSelectionDialog.js';

const MYNAME      = 'SaveAsDialog';
const IDB_NAME    = 'SaveAsDialog';
const IDB_VERSION = 1;
const IDB_STORE   = 'handles';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess       = e => resolve(e.target.result);
        req.onerror         = e => reject(e.target.error);
    });
}

async function saveHandleToIDB(key, handle) {
    try {
        const db = await openHandleDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(handle, key);
            tx.oncomplete = resolve;
            tx.onerror    = e => reject(e.target.error);
        });
    } catch (e) {
        console.warn(`${MYNAME}: could not save handle to IDB`, e);
    }
}

async function loadHandleFromIDB(key) {
    try {
        const db = await openHandleDB();
        return await new Promise((resolve, reject) => {
            const tx  = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = e => reject(e.target.error);
        });
    } catch (e) {
        console.warn(`${MYNAME}: could not load handle from IDB`, e);
        return null;
    }
}

// ── createSaveAsDialog ────────────────────────────────────────────────────────

export function createSaveAsDialog(options = {}) {

    const storageId = options.storageId ?? 'saveAsDialog';
    const idbKey    = storageId + '_folder';

    let mFolderHandle = null;
    let mOnSave       = null;
    let mOnCancel     = null;
    let mRootHandle   = null;  // top-most folder: constrains the folder picker navigation
    let mFolderPicker = null;  // lazily-created FileSelectionDialog in 'folder' filter mode

    // ── InternalWindow ────────────────────────────────────────────────────────

    const mWindow = createInternalWindow({
        width:     '320px',
        height:    '180px',
        left:      '200px',
        top:       '150px',
        title:     'Save As',
        canClose:  true,
        canResize: true,
        storageId,
    });

    const interior = mWindow.interior;

    // Use a child container so we don't overwrite InternalWindow's
    // position/sizing inline styles on the interior element itself.
    const container = document.createElement('div');
    container.style.cssText = [
        'position:absolute', 'inset:0',
        'padding:14px 16px',
        'display:flex', 'flex-direction:column', 'gap:10px',
        'box-sizing:border-box',
        'overflow:hidden',
    ].join('; ');
    interior.appendChild(container);

    // ── Name row ──────────────────────────────────────────────────────────────

    const nameRow   = makeRow('Name:');
    const nameInput = document.createElement('input');
    nameInput.type  = 'text';
    nameInput.style.cssText = 'flex:1; padding:4px 6px; border:1px solid #aaa; border-radius:4px; font-size:13px; outline:none;';
    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  onSaveClick();
        if (e.key === 'Escape') onCancelClick();
    });
    nameInput.addEventListener('input', () => {
        nameInput.style.borderColor = '#aaa';
    });
    nameRow.appendChild(nameInput);
    container.appendChild(nameRow);

    // ── Folder row ────────────────────────────────────────────────────────────

    const folderRow = makeRow('Folder:');

    const folderInput = document.createElement('input');
    folderInput.type  = 'text';
    folderInput.readOnly = true;
    folderInput.style.cssText = 'flex:1; min-width:0; padding:4px 6px; border:1px solid #aaa; border-radius:4px; font-size:13px; outline:none; background:#f9f9f9; color:#444; cursor:default;';
    folderInput.value = '(none selected)';

    const changeBtn = document.createElement('button');
    changeBtn.textContent = 'Change…';
    changeBtn.style.cssText = 'padding:3px 8px; font-size:12px; cursor:pointer; flex-shrink:0;';
    changeBtn.addEventListener('click', onChangeFolderClick);

    folderRow.appendChild(folderInput);
    folderRow.appendChild(changeBtn);
    container.appendChild(folderRow);


    // ── Button row ────────────────────────────────────────────────────────────

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:auto; padding-bottom:2px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:5px 16px; font-size:13px; cursor:pointer; border-radius:4px; border:1px solid #aaa;';
    cancelBtn.addEventListener('click', onCancelClick);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding:5px 16px; font-size:13px; font-weight:600; cursor:pointer; background:#1976d2; color:#fff; border:none; border-radius:4px;';
    saveBtn.addEventListener('click', onSaveClick);

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    container.appendChild(btnRow);

    // ── Helpers ───────────────────────────────────────────────────────────────

    function makeRow(labelText) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px;';
        const lbl = document.createElement('label');
        lbl.textContent = labelText;
        lbl.style.cssText = 'width:52px; font-size:13px; color:#333; flex-shrink:0;';
        row.appendChild(lbl);
        return row;
    }

    function setFolder(handle, displayPath = null) {
        mFolderHandle     = handle;
        const fullText    = displayPath ?? (handle ? handle.name : '(none selected)');
        folderInput.title = fullText;   // always available on hover
        folderInput.value = fullText;
        folderInput.style.color = '#444';
        folderInput.style.borderColor = '#aaa';
        setTimeout(() => {
            folderInput.scrollLeft = folderInput.scrollWidth;
        }, 0);
    }


    // ── Event handlers ────────────────────────────────────────────────────────

    function onChangeFolderClick() {
        // Lazily create the folder-picker dialog
        if (!mFolderPicker) {
            mFolderPicker = createFileSelectionDialog({
                title:          'Select Folder',
                filter:         'folder',
                storageId:      storageId + '_folderPicker',
                width:          '420px',
                height:         '380px',
                left:           '240px',
                top:            '100px',
                // onFolderChange fires on every navigation — keep SaveAsDialog in sync.
                onFolderChange: (handle, path) => {
                    setFolder(handle, path);
                },
            });
        }
        const showOpts = {};
        if (mRootHandle) {
            showOpts.rootHandle = mRootHandle;
        }
        if (mFolderHandle) {
            showOpts.startHandle = mFolderHandle;
        }
        mFolderPicker.show(showOpts);
        // Immediately capture the picker's current folder so that if the user is
        // already in the right directory and never fires onFolderChange, we still
        // have a valid handle.
        const cur = mFolderPicker.getWriteHandle();
        if (cur) setFolder(cur, mFolderPicker.getWriteHandlePath() ?? null);
    }

    function onSaveClick() {
        const name = nameInput.value.trim();
        let valid = true;
        if (!name) {
            nameInput.style.borderColor = '#c00';
            nameInput.focus();
            valid = false;
        }
        if (!mFolderHandle) {
            folderInput.style.borderColor = '#c00';
            valid = false;
        }
        if (!valid) return;
        mWindow.setVisible(false);
        // Persist the chosen folder so subsequent opens don't need FileSelectionDialog.
        saveHandleToIDB(idbKey, mFolderHandle);
        if (mOnSave) mOnSave(name, mFolderHandle);
    }

    function onCancelClick() {
        mWindow.setVisible(false);
        if (mOnCancel) mOnCancel();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Show the dialog.
     * @param {object} [p]
     * @param {string}                    [p.suggestedName]    pre-filled filename (no .json)
     * @param {FileSystemDirectoryHandle} [p.suggestedHandle]  overrides IDB-persisted folder
     * @param {string}                    [p.suggestedPath]    display path for the folder
     *                                                          (breadcrumb from FileSelectionDialog)
     * @param {FileSystemDirectoryHandle} [p.rootHandle]       constrains the folder picker
     *                                                          to within this top-level folder
     * @param {function}                  [p.onSave]           (name, folderHandle) => void
     * @param {function}                  [p.onCancel]         () => void
     */
    async function show({ suggestedName = '', suggestedHandle = null, suggestedPath = null,
                          rootHandle = null, onSave, onCancel } = {}) {
        mOnSave      = onSave   ?? null;
        mOnCancel    = onCancel ?? null;
        mRootHandle  = rootHandle ?? null;

        // Reset validation highlights
        nameInput.style.borderColor = '#aaa';
        folderInput.style.borderColor = '#aaa';

        nameInput.value = suggestedName;

        let folderHandle = null;
        let folderPath   = null;
        const saved = await loadHandleFromIDB(idbKey);
        if (saved) {
            folderHandle = saved;
        } else {
            folderHandle = suggestedHandle;
            folderPath   = (suggestedHandle && suggestedPath) ? suggestedPath : null;
        }
        setFolder(folderHandle, folderPath);

        mWindow.setVisible(true);
        setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
    }

    return {
        show,
        setVisible: (v) => mWindow.setVisible(v),
    };

} // createSaveAsDialog
