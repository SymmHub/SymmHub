/**
 * FileSelectionDialog.js
 *
 * A folder-browser dialog built on imageSelector + File System Access API.
 *
 * Features:
 *  - User selects a root folder (readwrite permission)
 *  - Subfolders shown with a folder icon; click navigates in
 *  - '..' parent item navigates up
 *  - JSON files shown with their .json.png thumbnail (or a generic icon)
 *  - Image files mode for future use (filter: 'image')
 *
 * Usage:
 *   const dlg = createFileSelectionDialog({
 *       title:    'Open Document',
 *       filter:   'json',         // 'json' | 'image'
 *       onSelect: (item) => { ... },
 *       storageId: 'docDialog',
 *   });
 *   dlg.show();
 *
 * onSelect(item) shapes:
 *   JSON  → { getName, jsonHandle, binHandle }
 *   Image → { getName, imageHandle }
 */

import { createImageSelector } from './imageSelector.js';

const MYNAME = 'FileSelectionDialog';
const DEBUG  = false;
const IDB_NAME    = 'FileSelectionDialog';
const IDB_VERSION = 1;
const IDB_STORE   = 'handles';

// ── IndexedDB handle persistence ──────────────────────────────────────────────

/**
 * Open (or create) the IDB database, returning the db object.
 * @returns {Promise<IDBDatabase>}
 */
function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess       = e => resolve(e.target.result);
        req.onerror         = e => reject(e.target.error);
    });
}

/**
 * Persist a FileSystemDirectoryHandle to IndexedDB under `key`.
 * @param {string} key
 * @param {FileSystemDirectoryHandle} handle
 */
async function saveHandleToIDB(key, handle) {
    try {
        const db = await openHandleDB();
        await new Promise((resolve, reject) => {
            const tx  = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(handle, key);
            tx.oncomplete = resolve;
            tx.onerror    = e => reject(e.target.error);
        });
        if (DEBUG) console.log(`${MYNAME}: handle saved to IDB ('${key}')`);
    } catch (e) {
        console.warn(`${MYNAME}: could not save handle to IDB`, e);
    }
}

/**
 * Restore a FileSystemDirectoryHandle from IndexedDB.
 * Returns null if nothing was stored or IDB is unavailable.
 * @param {string} key
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
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

/**
 * Try to restore a saved handle and verify/request readwrite permission.
 * Returns the handle if permission is granted, or null if the user must
 * re-select a folder.
 *
 * Note: must be called from a user-gesture context (button click etc.)
 * @param {string} key
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
async function restoreHandle(key) {
    const handle = await loadHandleFromIDB(key);
    if (!handle) return null;

    try {
        // Check existing permission first (no prompt)
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            if (DEBUG) console.log(`${MYNAME}: permission already granted for saved handle`);
            return handle;
        }
        // Ask for permission — shows a lightweight browser prompt, not OS picker
        perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            if (DEBUG) console.log(`${MYNAME}: permission granted after prompt`);
            return handle;
        }
        if (DEBUG) console.log(`${MYNAME}: permission denied — will open OS picker`);
        return null;
    } catch (e) {
        console.warn(`${MYNAME}: could not verify handle permission`, e);
        return null;
    }
}

// ── Inline SVG thumbnails (no external file dependencies) ────────────────────

const FOLDER_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FFC107' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E`;

const PARENT_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FF9800' d='M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z'/%3E%3Cpath fill='white' d='M11 17l-4-4 4-4v3h4v2h-4z'/%3E%3C/svg%3E`;

const DEFAULT_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%232196F3' d='M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'/%3E%3C/svg%3E`;

// ── FileSelectionDialog ───────────────────────────────────────────────────────

/**
 * @param {object}   [options]
 * @param {string}   [options.title='Select File']
 * @param {string}   [options.filter='json']   'json' | 'image' | 'folder'
 * @param {function} [options.onSelect]        called with the selected item data (json/image modes)
 * @param {function} [options.onFolderChange]  (dirHandle, pathStr) => void  called on every navigation
 * @param {string}   [options.storageId]       passed to imageSelector for position persistence
 * @param {string}   [options.width='500px']
 * @param {string}   [options.height='450px']
 * @param {string}   [options.left='100px']
 * @param {string}   [options.top='50px']
 */
export function createFileSelectionDialog(options = {}) {

    const {
        title          = 'Select File',
        filter         = 'json',
        onSelect       = () => {},
        onFolderChange = null,   // (dirHandle, pathStr) => void — called on every navigation
        storageId,
        width    = '500px',
        height   = '450px',
        left     = '100px',
        top      = '50px',
    } = options;

    // IDB key for persisting the chosen folder handle across sessions
    const mHandleKey  = (storageId ?? 'fileDialog') + '_dirHandle';
    const mSubKey     = mHandleKey + '_sub';  // last navigated subfolder

    let mRootHandle   = null;  // top-most folder (set on first OS-picker selection)
    let mDirHandle    = null;  // currently displayed folder
    let mParentStack  = [];    // stack of parent handles for '..' navigation

    // ── imageSelector ─────────────────────────────────────────────────────────

    const mSelector = createImageSelector({
        title,
        width, height, left, top,
        storageId,
        onSelect: onItemSelected,
    });

    // ── Item click handler ────────────────────────────────────────────────────

    async function onItemSelected(itemData) {
        if (itemData.isFolder) {
            if (itemData._isParent) {
                // Navigate up
                mDirHandle = mParentStack.pop();
            } else {
                // Navigate into subfolder
                mParentStack.push(mDirHandle);
                mDirHandle = itemData.handle;
            }
            await populateFromFolder(mDirHandle);
        } else {
            // File selected — call the user callback
            onSelect(itemData);
        }
    }

    // ── Folder population ─────────────────────────────────────────────────────

    async function populateFromFolder(dirHandle) {

        mSelector.clear();

        // Persist the last-viewed folder so the next session can reopen here.
        // Fire-and-forget: do not block UI on the IDB write.
        saveHandleToIDB(mSubKey, dirHandle);

        // Build breadcrumb path
        const pathParts = [...mParentStack, dirHandle].map(h => h.name);
        const pathStr   = pathParts.join(' / ');

        // Notify caller that the current folder has changed (passes path string as 2nd arg)
        if (onFolderChange) onFolderChange(dirHandle, pathStr);

        // Update window title
        mSelector.setTitle(title ? `${title}: ${pathStr}` : pathStr);

        // Collect all directory entries into a plain map for O(1) lookups
        const entries = {};
        for await (const [name, handle] of dirHandle.entries()) {
            entries[name] = handle;
        }

        // 1. '..' parent item (only when not at root)
        if (mParentStack.length > 0) {
            mSelector.addItems([{
                tmb:  PARENT_THUMB,
                data: { getName: () => '..', isFolder: true, _isParent: true },
            }]);
        }

        // 3. Subfolders
        const folderItems = [];
        for (const [name, handle] of Object.entries(entries)) {
            if (handle.kind === 'directory') {
                folderItems.push({
                    tmb:  FOLDER_THUMB,
                    data: { getName: () => name, isFolder: true, handle },
                });
            }
        }
        if (folderItems.length) mSelector.addItems(folderItems);

        // 4. Files (not shown in folder mode)
        if (filter === 'json') {
            await populateJsonFiles(entries);
        } else if (filter === 'image') {
            await populateImageFiles(entries);
        }
        // filter === 'folder': subfolders only, no files

    }

    async function populateJsonFiles(entries) {

        // Identify .json files (skip .json.png and .json.bin sidecars)
        const jsonNames = Object.keys(entries).filter(
            n => n.endsWith('.json') && entries[n].kind === 'file'
        );

        const fileItems = await Promise.all(jsonNames.map(async (name) => {
            const baseName  = name.replace(/\.json$/, '');
            const tmbHandle = entries[name + '.png']  ?? null;
            const binHandle = entries[name + '.bin']  ?? null;

            const tmb = tmbHandle
                ? await fileHandleToDataUrl(tmbHandle)
                : DEFAULT_THUMB;

            return {
                tmb,
                data: {
                    getName:    () => baseName,
                    jsonHandle: entries[name],
                    binHandle,
                },
            };
        }));

        if (fileItems.length) mSelector.addItems(fileItems);
    }

    async function populateImageFiles(entries) {

        const IMAGE_RE = /\.(png|jpg|jpeg|webp|gif|avif|svg)$/i;
        const imgNames = Object.keys(entries).filter(
            n => IMAGE_RE.test(n) && entries[n].kind === 'file'
        );

        const fileItems = await Promise.all(imgNames.map(async (name) => {
            const handle = entries[name];
            return {
                tmb:  await fileHandleToDataUrl(handle),
                data: { getName: () => name, imageHandle: handle },
            };
        }));

        if (fileItems.length) mSelector.addItems(fileItems);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    async function fileHandleToDataUrl(fileHandle) {
        const file = await fileHandle.getFile();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * After the root handle is restored, try to return to the last subfolder
     * the user was browsing.  Uses rootHandle.resolve(subHandle) to get the
     * relative path, then re-walks it with getDirectoryHandle() to produce
     * fresh handles derived from the root we already have permission for.
     */
    async function restoreLastSubfolder() {
        try {
            const subHandle = await loadHandleFromIDB(mSubKey);
            if (!subHandle) return;  // no subfolder persisted

            // resolve() returns null when subHandle is not within mRootHandle,
            // or [] when subHandle IS the root.
            const relative = await mRootHandle.resolve(subHandle);
            if (!relative || relative.length === 0) return;  // stay at root

            // Walk the path, rebuilding the parent stack with fresh handles.
            let current = mRootHandle;
            mParentStack = [];
            for (let i = 0; i < relative.length - 1; i++) {
                mParentStack.push(current);
                current = await current.getDirectoryHandle(relative[i]);
            }
            mParentStack.push(current);
            mDirHandle = await current.getDirectoryHandle(relative[relative.length - 1]);

        } catch (e) {
            // Subfolder may have been deleted or renamed — silently fall back to root.
            if(DEBUG) console.warn(`${MYNAME}: could not restore last subfolder`, e);
            mParentStack = [];
            mDirHandle   = mRootHandle;
        }
    }

    /**
     * Show the dialog.
     * @param {object} [showOpts]
     * @param {FileSystemDirectoryHandle} [showOpts.rootHandle]
     *   When provided, the dialog starts from this folder (IDB bypassed) and
     *   navigation is constrained within it (no '..' above root).
     */
    async function show(showOpts = {}) {
        mSelector.setVisible(true);

        if (showOpts.rootHandle) {
            // Caller supplies a root — bypass IDB, reset to that folder
            mRootHandle  = showOpts.rootHandle;
            mDirHandle   = showOpts.rootHandle;
            mParentStack = [];
            await populateFromFolder(mDirHandle);
            return;
        }

        if (!mDirHandle) {
            // First open: try to restore the root folder from IDB
            const restored = await restoreHandle(mHandleKey);
            if (restored) {
                mRootHandle  = restored;
                mDirHandle   = restored;
                mParentStack = [];
                // Then try to restore the last subfolder within that root
                await restoreLastSubfolder();
                await populateFromFolder(mDirHandle);
            } else {
                await selectFolder();
            }
        } else {
            await populateFromFolder(mDirHandle);
        }
    }

    /**
     * Trigger the OS directory picker to (re-)select the root folder.
     * The chosen handle is persisted to IndexedDB for future sessions.
     */
    async function selectFolder() {
        try {
            mDirHandle   = await showDirectoryPicker({ mode: 'readwrite' });
            mRootHandle  = mDirHandle;  // track root for getRootHandle()
            mParentStack = [];
            await saveHandleToIDB(mHandleKey, mDirHandle);  // persist root for next session
            saveHandleToIDB(mSubKey, mDirHandle);            // reset last subfolder to root
            await populateFromFolder(mDirHandle);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error(`${MYNAME}: folder picker failed`, e);
            }
        }
    }

    /**
     * Restore root + last subfolder from IDB **without showing the dialog UI**.
     * Useful when a caller needs getRootHandle() / getWriteHandle() before the
     * user has ever opened the Files… dialog.
     * Safe to call repeatedly — returns immediately if state is already loaded.
     * @returns {Promise<FileSystemDirectoryHandle|null>} the root handle, or null
     */
    async function loadRootHandle() {
        if (mRootHandle) return mRootHandle;  // already initialised

        const restored = await restoreHandle(mHandleKey);
        if (restored) {
            mRootHandle  = restored;
            mDirHandle   = restored;
            mParentStack = [];
            await restoreLastSubfolder();  // sets mDirHandle to last visited subfolder
        }
        return mRootHandle ?? null;
    }

    /**
     * Refresh the current folder view without changing the directory.
     */
    async function reload() {
        if (mDirHandle) await populateFromFolder(mDirHandle);
    }

    return {
        /** Show the dialog. Accepts optional { rootHandle } to bypass IDB and constrain navigation. */
        show,
        /** Programmatically show or hide. */
        setVisible: (v) => mSelector.setVisible(v),
        /** Re-open the OS folder picker. */
        selectFolder,
        /** Refresh the current folder listing. */
        reload,
        /**
         * Restore root + last subfolder from IDB without showing the UI.
         * Returns the root handle (or null if none stored).
         */
        loadRootHandle,
        /** Returns the currently displayed FileSystemDirectoryHandle (or null). */
        getWriteHandle: () => mDirHandle,
        /** Returns the top-most folder handle (set when the user picks via OS picker). */
        getRootHandle:  () => mRootHandle,
        /**
         * Returns the full breadcrumb path of the current folder as a string
         * (e.g. "presets / chapter1 / scenes"), or null if no folder is open.
         */
        getWriteHandlePath() {
            if (!mDirHandle) return null;
            return [...mParentStack, mDirHandle].map(h => h.name).join(' / ');
        },
    };

} // createFileSelectionDialog
