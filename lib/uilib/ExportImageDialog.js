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
 *       gpuSide:  8192,                  // the largest side the GPU draws, optional
 *       documentAspect: 0.75,            // the document frame's height / width, with options.views
 *       onSave:   (name, folderHandle, width, height, format, { marks, view }) => { ... },
 *       onCancel: () => { ... },
 *   });
 *
 * options.marks (a label, or true for 'Handles and marks') adds a toggle,
 * off by default and remembered, whose value onSave gets as `marks`: the
 * app draws its editing marks into the image or leaves them out.
 *
 * options.storageId keeps the window's place and size, the folder last
 * exported to and the choices; options.pickerId goes to the folder picker
 * behind Change… (FolderPickerDialog): an app passes its own of both.
 *
 * options.views adds a View choice, remembered, whose value onSave gets as
 * `view`: 'document' (the document's frame, as saved with it) or 'current'
 * (the view on screen, scaled). Without it `view` is 'current'.
 *
 * 'Keep aspect' (on by default, remembered like the format) ties width and
 * height to an aspect ratio: in the current view the suggested size's,
 * turned off and on again the size shown then; in the document view the
 * frame's (show's documentAspect), the height from the width. A size beyond
 * the format's limits (ImageSize.js) is refused with the reason under the
 * fields.
 */

import {
    createInternalWindow,
    createFolderPickerDialog,
    DatGUI,
    createParamUI,
    ParamString,
    ParamInt,
    ParamFunc,
    ParamChoice,
    ParamBool,
    imageSizeError,
    lockedImageSize,
    showWarningBanner,
    supportsDirectoryPicker,
    sanitizeFileName,
} from './modules.js';

const MYNAME      = 'ExportImageDialog';
const IDB_NAME    = 'ExportImageDialog';
const IDB_VERSION = 1;
const IDB_STORE   = 'handles';
const BROWSER_DOWNLOAD_LABEL = 'Browser Downloads';

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
    const marksLabel = (options.marks === true) ? 'Handles and marks' : (options.marks || null);
    const hasViews  = !!options.views;
    const idbKey    = storageId + '_folder';

    let mFolderHandle = null;
    let mOnSave       = null;
    let mOnCancel     = null;
    let mOnRootChange = null;  // (root, folder) => void — picker re-rooted; propagate
    let mRootHandle   = null;  // top-most folder: constrains the folder picker navigation
    let mFolderPicker = null;  // lazily-created FileSelectionDialog in 'folder' filter mode
    let mAspect       = 1;     // width / height kept while 'Keep aspect' is on
    let mCurrentAspect = 1;    // width / height of the current view's size (the suggested one, or taken)
    let mDocAspect    = null;  // the document frame's height / width (show's documentAspect)
    let mGpuSide      = Infinity;
    let mSizing       = false; // a side being set from the other one
    let mExporting    = false; // guards async permission check during Export click

    // ── InternalWindow ────────────────────────────────────────────────────────

    const mWindow = createInternalWindow({
        width:     '320px',
        height:    '360px',
        left:      '200px',
        top:       '150px',
        title:     'Export Image',
        role:      'dialog',   // transient: Escape closes it
        canClose:  true,
        canResize: true,
        storageId,
        onResize: () => {
            if (gui && interior) {
                gui.width = interior.clientWidth;
            }
        }
    });

    const interior = mWindow.interior;
    interior.style.padding = '0';
    interior.style.boxSizing = 'border-box';
    interior.style.backgroundColor = 'var(--background-color)';
    interior.style.overflowX = 'hidden';
    interior.style.overflowY = 'auto';

    const gui = new DatGUI({ autoPlace: false, width: 320 });
    gui.domElement.style.position = 'relative';
    gui.domElement.style.width    = '100%';
    gui.domElement.style.padding  = '0 8px';
    gui.domElement.style.boxSizing = 'border-box';
    gui.domElement.style.backgroundColor = 'var(--background-color)';
    interior.appendChild(gui.domElement);

    // the size limit, or why the size cannot be exported
    const mMessage = document.createElement('div');
    mMessage.style.cssText = 'padding:4px 10px 8px; font-size:11px; line-height:1.35; white-space:normal;';
    interior.appendChild(mMessage);

    // ── Values and Parameters ─────────────────────────────────────────────────

    const mValues = {
        name: '',
        folder: BROWSER_DOWNLOAD_LABEL,
        imgFormat: 'PNG',
        width: 800,
        height: 600,
        lockAspect: true,
        marks: false,
        view: 'document',
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
        tooltip: 'Optional: pick a local folder (by default, images download via browser)',
    });

    const imgFormatParam = ParamChoice({
        obj: mValues,
        key: 'imgFormat',
        name: 'Format',
        choice: ['PNG', 'JPG', 'WEBP', 'TIFF'],
        onChange: () => showSizeCheck(),
    });

    // the document's frame or the view on screen (options.views)
    const viewParam = hasViews ? ParamChoice({
        obj: mValues,
        key: 'view',
        name: 'View',
        choice: ['document', 'current'],
        onChange: () => onViewChange(),
    }) : null;

    const widthParam = ParamInt({
        obj: mValues,
        key: 'width',
        name: 'Width',
        onChange: () => onSideChange('width'),
    });

    const heightParam = ParamInt({
        obj: mValues,
        key: 'height',
        name: 'Height',
        onChange: () => onSideChange('height'),
    });

    const lockAspectParam = ParamBool({
        obj: mValues,
        key: 'lockAspect',
        name: 'Keep aspect',
        onChange: () => { if (mValues.lockAspect) lockAspect(true); showSizeCheck(); },
    });

    // the app's editing marks in the image (options.marks)
    const marksParam = marksLabel ? ParamBool({
        obj: mValues,
        key: 'marks',
        name: marksLabel,
    }) : null;

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
        ...(viewParam ? { view: viewParam } : {}),
        width: widthParam,
        height: heightParam,
        lockAspect: lockAspectParam,
        ...(marksParam ? { marks: marksParam } : {}),
        exportAction: exportParam,
        cancelAction: cancelParam,
    };

    createParamUI(gui, mParams);

    // ── Helpers ───────────────────────────────────────────────────────────────

    function setFolder(handle, displayPath = null) {
        mFolderHandle = handle || null;
        const fullText = mFolderHandle
            ? (displayPath ?? mFolderHandle.name)
            : BROWSER_DOWNLOAD_LABEL;
        mValues.folder = fullText;
        folderParam.setValue(fullText);
        folderParam.scrollToEnd();
    }

    // the document's frame exported: the View choice, and a frame to export
    function isDocumentView() {
        return !!viewParam && mValues.view === 'document' && mDocAspect > 0;
    }

    function takeAspect() {
        const w = mValues.width, h = mValues.height;
        if (w > 0 && h > 0) mAspect = w / h;
        if (!isDocumentView()) mCurrentAspect = mAspect;
    }

    //
    //  the aspect Keep aspect holds: the document view the frame's, the height
    //  following the width; the current view the size shown (taken: Keep aspect
    //  turned on) or the one it had (the view chosen again)
    //
    function lockAspect(taken) {
        if (isDocumentView()) {
            mAspect = 1 / mDocAspect;
            followSide('width');
        } else if (taken) {
            takeAspect();
        } else {
            mAspect = mCurrentAspect;
            followSide('width');
        }
    }

    // the View chosen: under Keep aspect the size takes the view's aspect
    function onViewChange() {
        if (mValues.lockAspect) lockAspect(false);
        showSizeCheck();
    }

    // the other side from the side changed, under the locked aspect
    function followSide(changed) {
        const value = mValues[changed];
        if (!Number.isFinite(value) || value <= 0) return;
        const size = lockedImageSize(changed, value, mAspect);
        const other = (changed === 'width') ? 'height' : 'width';
        mSizing = true;
        mValues[other] = size[other];
        ((other === 'width') ? widthParam : heightParam).updateDisplay();
        mSizing = false;
    }

    // a side typed: the other follows under the locked aspect
    function onSideChange(changed) {
        if (mSizing) return;
        if (mValues.lockAspect) followSide(changed);
        showSizeCheck();
    }

    function sizeError() {
        return imageSizeError(mValues.width, mValues.height, mValues.imgFormat, mGpuSide);
    }

    // the reason a size is refused in the accent colour, else the format's limit
    function showSizeCheck() {
        const err = sizeError();
        widthParam.setError(!!err);
        heightParam.setError(!!err);
        if (err) {
            mMessage.textContent = err;
            mMessage.style.color = 'var(--ui-attention-color, #d9730d)';
        } else {
            const w = mValues.width, h = mValues.height;
            const mp = (w * h / 1e6).toFixed(1);
            let what = 'the view as on screen, scaled.';
            if (isDocumentView()) {
                // the frame's shape within a pixel: the image is the frame
                what = (Math.abs(h - w * mDocAspect) < 1) ? "the document's frame."
                                                          : "the document's frame, whole, with more round it.";
            }
            mMessage.textContent = `${w} × ${h} pixels (${mp} MP), ${what}`;
            mMessage.style.color = 'var(--text-color-muted, #888)';
        }
        if (mWindow.isVisible()) fitHeight();
        return err;
    }

    // the height of the rows and the message line, whatever size was kept
    function fitHeight() {
        mWindow.setInteriorSize(null, gui.domElement.offsetHeight + mMessage.offsetHeight);
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    async function onChangeFolderClick() {
        if (!mFolderPicker) {
            mFolderPicker = createFolderPickerDialog({
                title: 'Select Folder',
                pickerId: options.pickerId,
            });
        }
        const result = await mFolderPicker.show(mRootHandle, mFolderHandle);
        if (result) {
            if (result.rootChanged) {
                mRootHandle = result.root;
                mOnRootChange?.(result.root, result.handle);
            }
            setFolder(result.handle, result.path);
        }
    }

    async function onExportClick() {
        if (mExporting) return;
        nameParam.syncValue();
        // the sides were tied when they changed; syncing one must not round the other again
        mSizing = true;
        widthParam.syncValue();
        heightParam.syncValue();
        mSizing = false;

        const rawName = mValues.name.trim();
        const name = sanitizeFileName(rawName, '');
        const width = mValues.width;
        const height = mValues.height;

        let valid = true;

        nameParam.setError(false);
        folderParam.setError(false);
        widthParam.setError(false);
        heightParam.setError(false);

        if (!name) {
            nameParam.setError(true);
            nameParam.focus();
            valid = false;
        }
        if (isNaN(width) || width <= 0) {
            widthParam.setError(true);
            widthParam.focus();
            valid = false;
        }
        if (isNaN(height) || height <= 0) {
            heightParam.setError(true);
            if (valid) {
                heightParam.focus();
            }
            valid = false;
        }
        if (valid && showSizeCheck()) {
            widthParam.focus();
            valid = false;
        }

        if (!valid) return;

        // Verify readwrite permission on any chosen folder while user activation is active;
        // when no folder is chosen (null), exportImage falls back to a standard browser download.
        let exportFolder = mFolderHandle;
        if (exportFolder) {
            mExporting = true;
            try {
                let perm = await exportFolder.queryPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    perm = await exportFolder.requestPermission({ mode: 'readwrite' });
                }
                if (perm !== 'granted') {
                    setFolder(null);
                    showWarningBanner(
                        'Folder write permission was not granted. Switched to Browser Downloads — click Export again, or choose another folder.',
                        9000
                    );
                    return;
                }
            } catch (e) {
                console.warn(`${MYNAME}: saved folder is no longer accessible`, e);
                setFolder(null);
                showWarningBanner(
                    'Saved folder is no longer accessible. Switched to Browser Downloads — click Export again, or choose another folder.',
                    9000
                );
                return;
            } finally {
                mExporting = false;
            }
        }

        if (name !== rawName) {
            mValues.name = name;
            nameParam.updateDisplay();
        }

        mWindow.setVisible(false);
        if (exportFolder) {
            saveHandleToIDB(idbKey, exportFolder);
        }
        try {
            localStorage.setItem(storageId + '_format', mValues.imgFormat);
            localStorage.setItem(storageId + '_lockAspect', mValues.lockAspect ? '1' : '0');
            if (marksParam) localStorage.setItem(storageId + '_marks', mValues.marks ? '1' : '0');
            if (viewParam) localStorage.setItem(storageId + '_view', mValues.view);
        } catch (e) { /* storage unavailable */ }
        if (mOnSave) mOnSave(name, exportFolder, width, height, mValues.imgFormat, {
            marks: !!(marksParam && mValues.marks),
            view: isDocumentView() ? 'document' : 'current',
        });
    }

    function onCancelClick() {
        mWindow.setVisible(false);
        if (mOnCancel) mOnCancel();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async function show({ suggestedName = '', suggestedWidth = 800, suggestedHeight = 600,
                          suggestedHandle = null, suggestedPath = null, gpuSide = Infinity,
                          documentAspect = null,
                          rootHandle = null, onSave, onCancel, onRootChange } = {}) {
        mGpuSide      = gpuSide;
        mDocAspect    = (Number.isFinite(documentAspect) && documentAspect > 0) ? documentAspect : null;
        mOnSave       = onSave   ?? null;
        mOnCancel     = onCancel ?? null;
        mOnRootChange = onRootChange ?? null;
        mRootHandle   = rootHandle ?? null;

        nameParam.setError(false);
        folderParam.setError(false);
        widthParam.setError(false);
        heightParam.setError(false);

        const canPickFolder = supportsDirectoryPicker();
        if (changeFolderParam.setVisible) {
            changeFolderParam.setVisible(canPickFolder);
        }

        mValues.name = sanitizeFileName(suggestedName, 'image');
        mValues.width = suggestedWidth;
        mValues.height = suggestedHeight;
        try {
            mValues.imgFormat = localStorage.getItem(storageId + '_format') ?? 'PNG';
            mValues.lockAspect = localStorage.getItem(storageId + '_lockAspect') !== '0';
            mValues.marks = localStorage.getItem(storageId + '_marks') === '1';
            mValues.view = (localStorage.getItem(storageId + '_view') === 'current') ? 'current' : 'document';
        } catch (e) {
            mValues.imgFormat = 'PNG';
            mValues.lockAspect = true;
            mValues.marks = false;
            mValues.view = 'document';
        }
        // the suggested size's aspect is the current view's; the document view takes the frame's
        mAspect = mCurrentAspect = (suggestedWidth > 0 && suggestedHeight > 0) ? suggestedWidth / suggestedHeight : 1;
        if (mValues.lockAspect && isDocumentView()) lockAspect(false);

        nameParam.updateDisplay();
        widthParam.updateDisplay();
        heightParam.updateDisplay();
        lockAspectParam.updateDisplay();
        if (viewParam) viewParam.updateDisplay();
        if (marksParam) marksParam.updateDisplay();
        imgFormatParam.updateDisplay();
        showSizeCheck();

        let folderHandle = null;
        let folderPath   = null;
        if (canPickFolder) {
            const saved = await loadHandleFromIDB(idbKey);
            if (saved) {
                try {
                    const perm = await saved.queryPermission({ mode: 'readwrite' });
                    if (perm !== 'denied') {
                        folderHandle = saved;
                    }
                } catch (e) {
                    console.warn(`${MYNAME}: ignoring stale folder handle from IDB`, e);
                }
            }
            if (!folderHandle && suggestedHandle) {
                folderHandle = suggestedHandle;
                folderPath   = suggestedPath || null;
            }
        }

        // If we don't have a path, but we do have rootHandle and folderHandle, resolve it!
        if (!folderPath && mRootHandle && folderHandle) {
            try {
                const relative = await mRootHandle.resolve(folderHandle);
                if (relative) {
                    folderPath = mRootHandle.name;
                    if (relative.length > 0) {
                        folderPath += ' / ' + relative.join(' / ');
                    }
                }
            } catch (e) {
                console.warn(`${MYNAME}: could not resolve initial folder path`, e);
            }
        }
        setFolder(folderHandle, folderPath);

        mWindow.setVisible(true);
        if (gui && interior) {
            gui.width = interior.clientWidth;
            fitHeight();
        }
        setTimeout(() => {
            nameParam.focus();
            nameParam.select();
        }, 60);
    }

    return {
        show,
        setVisible: (v) => mWindow.setVisible(v),
    };

} // createExportImageDialog
