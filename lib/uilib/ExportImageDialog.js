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

import {
    createInternalWindow,
    createFileSelectionDialog,
    DatGUI,
    createParamUI,
    ParamString,
    ParamInt,
    ParamFunc,
    ParamChoice,
} from './uilib.js';

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
        height:    '310px',
        left:      '200px',
        top:       '150px',
        title:     'Export Image',
        canClose:  true,
        canResize: true,
        storageId,
    });

    const interior = mWindow.interior;

    const gui = new DatGUI({ width: 320 });
    gui.domElement.style.position = 'relative';
    gui.domElement.style.width    = '100%';
    interior.appendChild(gui.domElement);

    // ── Values and Parameters ─────────────────────────────────────────────────

    const mValues = {
        name: '',
        folder: '(none selected)',
        imgFormat: 'PNG',
        width: 800,
        height: 600,
    };

    const nameParam = ParamString({
        obj: mValues,
        key: 'name',
        name: 'Name',
    });

    const folderParam = ParamString({
        obj: mValues,
        key: 'folder',
        name: 'Folder',
        readOnly: true,
        tooltip: true,
    });

    const changeFolderParam = ParamFunc({
        func: onChangeFolderClick,
        name: 'Change Folder...',
    });

    const imgFormatParam = ParamChoice({
        obj: mValues,
        key: 'imgFormat',
        name: 'Format',
        choice: ['PNG', 'JPG', 'WEBP', 'TIFF'],
    });

    const widthParam = ParamInt({
        obj: mValues,
        key: 'width',
        name: 'Width',
    });

    const heightParam = ParamInt({
        obj: mValues,
        key: 'height',
        name: 'Height',
    });

    const exportParam = ParamFunc({
        func: onExportClick,
        name: 'Export',
    });

    const cancelParam = ParamFunc({
        func: onCancelClick,
        name: 'Cancel',
    });

    const mParams = {
        name: nameParam,
        folder: folderParam,
        changeFolder: changeFolderParam,
        imgFormat: imgFormatParam,
        width: widthParam,
        height: heightParam,
        exportAction: exportParam,
        cancelAction: cancelParam,
    };

    createParamUI(gui, mParams);

    // Setup input listeners and enter/escape actions
    const listItems = gui.domElement.querySelectorAll('li');
    const nameInput = listItems[0]?.querySelector('input');
    const folderInput = listItems[1]?.querySelector('input');
    const widthInput = listItems[4]?.querySelector('input');
    const heightInput = listItems[5]?.querySelector('input');

    if (nameInput) {
        nameInput.addEventListener('input', () => { nameInput.style.borderColor = ''; });
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter')  onExportClick();
            if (e.key === 'Escape') onCancelClick();
        });
    }
    if (widthInput) {
        widthInput.addEventListener('input', () => { widthInput.style.borderColor = ''; });
        widthInput.addEventListener('keydown', e => {
            if (e.key === 'Enter')  onExportClick();
            if (e.key === 'Escape') onCancelClick();
        });
    }
    if (heightInput) {
        heightInput.addEventListener('input', () => { heightInput.style.borderColor = ''; });
        heightInput.addEventListener('keydown', e => {
            if (e.key === 'Enter')  onExportClick();
            if (e.key === 'Escape') onCancelClick();
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function setFolder(handle, displayPath = null) {
        mFolderHandle = handle;
        const fullText = displayPath ?? (handle ? handle.name : '(none selected)');
        mValues.folder = fullText;
        folderParam.setValue(fullText);

        if (folderInput) {
            setTimeout(() => {
                folderInput.scrollLeft = folderInput.scrollWidth;
            }, 0);
        }
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
        const name = mValues.name.trim();
        const width = mValues.width;
        const height = mValues.height;

        let valid = true;

        if (nameInput) nameInput.style.borderColor = '';
        if (folderInput) folderInput.style.borderColor = '';
        if (widthInput) widthInput.style.borderColor = '';
        if (heightInput) heightInput.style.borderColor = '';

        if (!name) {
            if (nameInput) {
                nameInput.style.borderColor = '#c00';
                nameInput.focus();
            }
            valid = false;
        }
        if (!mFolderHandle) {
            if (folderInput) {
                folderInput.style.borderColor = '#c00';
            }
            valid = false;
        }
        if (isNaN(width) || width <= 0) {
            if (widthInput) {
                widthInput.style.borderColor = '#c00';
                widthInput.focus();
            }
            valid = false;
        }
        if (isNaN(height) || height <= 0) {
            if (heightInput) {
                heightInput.style.borderColor = '#c00';
                if (valid && widthInput) {
                    heightInput.focus();
                }
            }
            valid = false;
        }

        if (!valid) return;
        mWindow.setVisible(false);
        saveHandleToIDB(idbKey, mFolderHandle);
        localStorage.setItem(storageId + '_format', mValues.imgFormat);
        if (mOnSave) mOnSave(name, mFolderHandle, width, height, mValues.imgFormat);
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

        if (nameInput) nameInput.style.borderColor = '';
        if (folderInput) folderInput.style.borderColor = '';
        if (widthInput) widthInput.style.borderColor = '';
        if (heightInput) heightInput.style.borderColor = '';

        mValues.name = suggestedName;
        mValues.width = suggestedWidth;
        mValues.height = suggestedHeight;
        mValues.imgFormat = localStorage.getItem(storageId + '_format') ?? 'PNG';

        nameParam.updateDisplay();
        widthParam.updateDisplay();
        heightParam.updateDisplay();
        imgFormatParam.updateDisplay();

        let folderHandle  = suggestedHandle;
        let folderPath    = (suggestedHandle && suggestedPath) ? suggestedPath : null;
        if (!folderHandle) {
            const saved = await loadHandleFromIDB(idbKey);
            if (saved) { folderHandle = saved; }
        }
        setFolder(folderHandle, folderPath);

        mWindow.setVisible(true);
        setTimeout(() => { if (nameInput) { nameInput.focus(); nameInput.select(); } }, 60);
    }

    return {
        show,
        setVisible: (v) => mWindow.setVisible(v),
    };

} // createExportImageDialog
