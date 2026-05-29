/**
 * ExportImageDialog.js
 *
 * Small floating InternalWindow for exporting canvas images with custom resolution.
 *
 *   const dlg = createExportImageDialog({ storageId: 'exportImageDialog' });
 *   dlg.show({
 *       suggestedName:   'my-image',
 *       suggestedWidth:  1920,
 *       suggestedHeight: 1080,
 *       suggestedHandle: folderHandle,   // FileSystemDirectoryHandle or null
 *       onSave:   (name, folderHandle, width, height) => { ... },
 *       onCancel: () => { ... },
 *   });
 */

import { createInternalWindow } from './internalWindow.js';
import { createFileSelectionDialog } from './FileSelectionDialog.js';

const MYNAME      = 'ExportImageDialog';
const IDB_NAME    = 'ExportImageDialog';
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

// ── createExportImageDialog ───────────────────────────────────────────────────

export function createExportImageDialog(options = {}) {

    const storageId = options.storageId ?? 'exportImageDialog';
    const idbKey    = storageId + '_folder';

    let mFolderHandle = null;
    let mOnSave       = null;
    let mOnCancel     = null;
    let mRootHandle   = null;  // top-most folder: constrains the folder picker navigation
    let mFolderPicker = null;  // lazily-created FileSelectionDialog in 'folder' filter mode

    // ── InternalWindow ────────────────────────────────────────────────────────

    const mWindow = createInternalWindow({
        width:     '320px',
        height:    '215px',
        left:      '200px',
        top:       '150px',
        title:     'Export Image',
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
        if (e.key === 'Enter')  onExportClick();
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

    // ── Size row ──────────────────────────────────────────────────────────────

    const sizeRow = makeRow('Size:');

    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.style.cssText = 'width:70px; padding:4px 6px; border:1px solid #aaa; border-radius:4px; font-size:13px; outline:none; text-align:center;';
    widthInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  onExportClick();
        if (e.key === 'Escape') onCancelClick();
    });
    widthInput.addEventListener('input', () => {
        widthInput.style.borderColor = '#aaa';
    });

    const xLabel = document.createElement('span');
    xLabel.textContent = '×';
    xLabel.style.cssText = 'font-size:14px; color:#555; margin:0 4px;';

    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.min = '1';
    heightInput.style.cssText = 'width:70px; padding:4px 6px; border:1px solid #aaa; border-radius:4px; font-size:13px; outline:none; text-align:center;';
    heightInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  onExportClick();
        if (e.key === 'Escape') onCancelClick();
    });
    heightInput.addEventListener('input', () => {
        heightInput.style.borderColor = '#aaa';
    });

    sizeRow.appendChild(widthInput);
    sizeRow.appendChild(xLabel);
    sizeRow.appendChild(heightInput);
    container.appendChild(sizeRow);

    // ── Button row ────────────────────────────────────────────────────────────

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:auto; padding-bottom:2px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:5px 16px; font-size:13px; cursor:pointer; border-radius:4px; border:1px solid #aaa;';
    cancelBtn.addEventListener('click', onCancelClick);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.style.cssText = 'padding:5px 16px; font-size:13px; font-weight:600; cursor:pointer; background:#1976d2; color:#fff; border:none; border-radius:4px;';
    exportBtn.addEventListener('click', onExportClick);

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(exportBtn);
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
        if (!mFolderPicker) {
            mFolderPicker = createFileSelectionDialog({
                title:          'Select Folder',
                filter:         'folder',
                storageId:      storageId + '_folderPicker',
                width:          '420px',
                height:         '380px',
                left:           '240px',
                top:            '100px',
                onFolderChange: (handle, path) => {
                    setFolder(handle, path);
                },
            });
        }
        mFolderPicker.show(mRootHandle ? { rootHandle: mRootHandle } : {});
        const cur = mFolderPicker.getWriteHandle();
        if (cur) setFolder(cur, mFolderPicker.getWriteHandlePath() ?? null);
    }

    function onExportClick() {
        const name = nameInput.value.trim();
        const width = parseInt(widthInput.value, 10);
        const height = parseInt(heightInput.value, 10);

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
        if (isNaN(width) || width <= 0) {
            widthInput.style.borderColor = '#c00';
            widthInput.focus();
            valid = false;
        }
        if (isNaN(height) || height <= 0) {
            heightInput.style.borderColor = '#c00';
            if (valid) {
                heightInput.focus();
            }
            valid = false;
        }

        if (!valid) return;
        mWindow.setVisible(false);
        saveHandleToIDB(idbKey, mFolderHandle);
        if (mOnSave) mOnSave(name, mFolderHandle, width, height);
    }

    function onCancelClick() {
        mWindow.setVisible(false);
        if (mOnCancel) mOnCancel();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async function show({ suggestedName = '', suggestedWidth = 800, suggestedHeight = 600,
                          suggestedHandle = null, suggestedPath = null,
                          rootHandle = null, onSave, onCancel } = {}) {
        mOnSave      = onSave   ?? null;
        mOnCancel    = onCancel ?? null;
        mRootHandle  = rootHandle ?? null;

        nameInput.style.borderColor = '#aaa';
        folderInput.style.borderColor = '#aaa';
        widthInput.style.borderColor = '#aaa';
        heightInput.style.borderColor = '#aaa';

        nameInput.value = suggestedName;
        widthInput.value = suggestedWidth;
        heightInput.value = suggestedHeight;

        let folderHandle  = suggestedHandle;
        let folderPath    = (suggestedHandle && suggestedPath) ? suggestedPath : null;
        if (!folderHandle) {
            const saved = await loadHandleFromIDB(idbKey);
            if (saved) { folderHandle = saved; }
        }
        setFolder(folderHandle, folderPath);

        mWindow.setVisible(true);
        setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
    }

    return {
        show,
        setVisible: (v) => mWindow.setVisible(v),
    };

} // createExportImageDialog
