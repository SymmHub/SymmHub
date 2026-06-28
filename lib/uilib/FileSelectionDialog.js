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
import { DatGUI, ParamFunc, ParamGroup, createFolderPickerDialog, ParamColor, ParamBool } from './modules.js';

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

export const FOLDER_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FFC107' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E`;

export const PARENT_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23FF9800' d='M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z'/%3E%3Cpath fill='white' d='M11 17l-4-4 4-4v3h4v2h-4z'/%3E%3C/svg%3E`;

// Transparent placeholder shown while a thumbnail is loading.
const LOADING_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E`;

// Blue folder with a right-arrow — indicates "pick a new root folder"
// (kept for potential future use; currently the hamburger menu is used instead)

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

    let mRootHandle      = null;  // top-most folder (set on first OS-picker selection)
    let mDirHandle       = null;  // currently displayed folder
    let mParentStack     = [];    // stack of parent handles for '..' navigation
    let mPopulatedHandle = null;  // handle that was last passed to populateFromFolder
    let mConstrained     = false; // true when show() was called with a rootHandle

    // ── imageSelector ─────────────────────────────────────────────────────────

    const mSelector = createImageSelector({
        title,
        width, height, left, top,
        storageId,
        onSelect: onItemSelected,
        onContextMenu: showContextMenu,
    });

    // ── Hamburger menu ────────────────────────────────────────────────────────
    // Small ☰ button injected into the dialog title bar (left side).
    // Clicking it toggles a dat.gui dropdown panel with options.
    // Only shown when NOT in constrained mode (caller-supplied rootHandle).

    const mHamburger = document.createElement('button');
    mHamburger.textContent = '\u2630';  // ☰
    mHamburger.title = 'Options';
    mHamburger.style.cssText = [
        'background:none', 'border:none', 'color:inherit', 'font-size:14px',
        'cursor:pointer', 'padding:1px 6px', 'margin-right:2px',
        'line-height:1', 'flex-shrink:0',
    ].join(';');

    const mMenuGUI = new DatGUI({ autoPlace: false, hideable: false, width: 240 });
    const mMenuEl  = mMenuGUI.domElement;
    mMenuEl.style.cssText = 'position:fixed; display:none; z-index:10000;';
    document.body.appendChild(mMenuEl);

    // dat.gui button: 'Root...'
    ParamFunc({
        name: 'Root...',
        func: () => { mMenuEl.style.display = 'none'; selectFolder(); },
    }).createUI(mMenuGUI);

    // dat.gui button: 'Folder...'
    let mFolderPicker = null;
    ParamFunc({
        name: 'Folder...',
        func: async () => {
            mMenuEl.style.display = 'none';
            if (!mFolderPicker) {
                mFolderPicker = createFolderPickerDialog({
                    title: 'Select Folder',
                });
            }
            const result = await mFolderPicker.show(mRootHandle, mDirHandle);
            if (result) {
                await navigateToHandle(result.handle);
                await populateFromFolder(mDirHandle);
            }
        },
    }).createUI(mMenuGUI);

    const bgColorKey = (storageId ?? 'fileDialog') + '_bgColor';
    const bgCheckerKey = (storageId ?? 'fileDialog') + '_bgChecker';

    const bgConfig = {
        backgroundColor: localStorage.getItem(bgColorKey) ?? '#ffffff',
        checker: (localStorage.getItem(bgCheckerKey) ?? 'false') === 'true',
    };

    // Thumbnail BG selection (top level in menu)
    ParamColor({
        obj: bgConfig,
        key: 'backgroundColor',
        name: 'Background',
        onChange: () => {
            mSelector.updateBgSettings(bgConfig.backgroundColor, bgConfig.checker);
        }
    }).createUI(mMenuGUI);

    ParamBool({
        obj: bgConfig,
        key: 'checker',
        name: 'Checker',
        onChange: () => {
            mSelector.updateBgSettings(bgConfig.backgroundColor, bgConfig.checker);
        }
    }).createUI(mMenuGUI);


    // Toggle the menu panel; auto-close on outside clicks.
    mHamburger.addEventListener('click', () => {
        if (mMenuEl.style.display === 'none') {
            const r = mHamburger.getBoundingClientRect();
            mMenuEl.style.top  = r.bottom + 'px';
            mMenuEl.style.left = r.left   + 'px';
            mMenuEl.style.display = 'block';
        } else {
            mMenuEl.style.display = 'none';
        }
    });
    document.addEventListener('click', (e) => {
        if (!mMenuEl.contains(e.target) && e.target !== mHamburger) {
            mMenuEl.style.display = 'none';
        }
    });

    // Inject into the title bar (getHeader exposed by imageSelector).
    // Make the header a flex row so the ☰ button and title sit side-by-side.
    const mHeader   = mSelector.getHeader?.();
    const mTitleDiv = mSelector.getTitleDiv?.();
    if (mHeader) {
        mHeader.style.display    = 'flex';
        mHeader.style.alignItems = 'center';
        // Let the title fill remaining space and shrink with ellipsis.
        // min-width:0 is required for a flex item to shrink below its content width.
        if (mTitleDiv) {
            mTitleDiv.style.flex        = '1';
            mTitleDiv.style.minWidth    = '0';
            mTitleDiv.style.width       = '';   // clear fixed calc() width — flex handles it
            mTitleDiv.style.marginRight = 'calc(var(--drag-header-size) + 4px)';
        }
        mHeader.insertBefore(mHamburger, mHeader.firstChild);
    }

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

    function showContextMenu(itemData, event) {
        event.preventDefault();

        // Don't show context menu for folders or parent navigation
        if (itemData.isFolder) return;

        // Remove any stale context menu
        const existing = document.getElementById('_file-dialog-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id    = '_file-dialog-context-menu';
        menu.className = 'gui-popup';

        const mainFileName = itemData.jsonHandle 
            ? itemData.jsonHandle.name 
            : (itemData.imageHandle ? itemData.imageHandle.name : itemData.getName());

        const deleteItem = document.createElement('div');
        deleteItem.textContent = `delete file "${mainFileName}"`;
        deleteItem.className   = 'gui-popup__item';
        
        deleteItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeMenu();

            if (confirm(`Are you sure you want to delete the file "${mainFileName}" and its companion files?`)) {
                if (itemData.jsonHandle) {
                    const baseName = itemData.jsonHandle.name;
                    try {
                        await mDirHandle.removeEntry(baseName);
                    } catch (err) {
                        console.warn(`${MYNAME}: Failed to delete JSON file`, err);
                    }
                    try {
                        await mDirHandle.removeEntry(baseName + '.png');
                    } catch (err) {}
                    try {
                        await mDirHandle.removeEntry(baseName + '.bin');
                    } catch (err) {}
                } else if (itemData.imageHandle) {
                    try {
                        await mDirHandle.removeEntry(itemData.imageHandle.name);
                    } catch (err) {
                        console.warn(`${MYNAME}: Failed to delete image file`, err);
                    }
                }
                // Remove the thumbnail from display
                mSelector.removeItem(itemData);
            }
        });
        menu.appendChild(deleteItem);

        // Position at click coordinates
        menu.style.top  = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;
        document.body.appendChild(menu);

        function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
            document.removeEventListener('contextmenu', closeMenu, true);
        }

        setTimeout(() => {
            document.addEventListener('click', closeMenu, true);
            document.addEventListener('contextmenu', closeMenu, true);
        }, 0);
    }

    // ── Folder population ─────────────────────────────────────────────────────

    async function populateFromFolder(dirHandle) {

        mPopulatedHandle = null;  // clear while populating (guards re-entrant calls)
        mSelector.clear();

        // Persist the last-viewed folder so the next session can reopen here.
        // Fire-and-forget: do not block UI on the IDB write.
        saveHandleToIDB(mSubKey, dirHandle);
        mPopulatedHandle = dirHandle;  // mark this folder as currently displayed

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

        if (!imgNames.length) return;

        // Pre-build item data objects (needed by both addItems and updateItem).
        const itemDatas = imgNames.map(name => ({
            getName:     () => name,
            imageHandle: entries[name],
        }));

        // 1. Show all items immediately with a loading placeholder so the
        //    folder appears populated without waiting for any file I/O.
        mSelector.addItems(itemDatas.map(data => ({ tmb: LOADING_THUMB, data })));

        // 2. Load thumbnails in parallel; each updates its cell as soon as
        //    it is ready. A stale-guard skips updates if the user navigated
        //    to a different folder while loading was in progress.
        const capturedHandle = mPopulatedHandle;
        await Promise.all(imgNames.map(async (name, i) => {
            try {
                const tmb = await fileHandleToDataUrl(entries[name]);
                if (mPopulatedHandle !== capturedHandle) return;
                mSelector.updateItem({ tmb, data: itemDatas[i] });
            } catch (e) {
                console.warn(`${MYNAME}: could not load thumbnail for '${name}'`, e);
            }
        }));
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
            mParentStack = [];
            mDirHandle   = mRootHandle;
        }
    }

    /**
     * Resolve path to a target handle relative to root, and walk the directories
     * to populate mParentStack and set mDirHandle to targetHandle.
     */
    async function navigateToHandle(targetHandle) {
        if (!targetHandle || !mRootHandle) return;
        try {
            const relative = await mRootHandle.resolve(targetHandle);
            if (relative === null) return; // not inside root
            if (relative.length === 0) {
                mDirHandle = mRootHandle;
                mParentStack = [];
                return;
            }
            let current = mRootHandle;
            mParentStack = [];
            for (let i = 0; i < relative.length - 1; i++) {
                mParentStack.push(current);
                current = await current.getDirectoryHandle(relative[i]);
            }
            mParentStack.push(current);
            mDirHandle = await current.getDirectoryHandle(relative[relative.length - 1]);
        } catch (e) {
            if (DEBUG) console.warn(`${MYNAME}: navigateToHandle failed`, e);
        }
    }

    /**
     * Show the dialog.
     * @param {object} [showOpts]
     * @param {FileSystemDirectoryHandle} [showOpts.rootHandle]
     *   When provided, the dialog starts from this folder (IDB bypassed) and
     *   navigation is constrained within it (no '..' above root).
     * @param {FileSystemDirectoryHandle} [showOpts.startHandle]
     *   When provided, the dialog will try to navigate to this folder on open.
     */
    async function show(showOpts = {}) {
        mSelector.setVisible(true);

        if (showOpts.rootHandle) {
            // Caller supplies a root — bypass IDB, reset to that folder;
            // navigation is constrained within it (no Change Root item shown).
            mConstrained = true;
            mRootHandle  = showOpts.rootHandle;
            mDirHandle   = showOpts.rootHandle;
            mParentStack = [];
            mHamburger.style.display = 'none';  // no root change in constrained mode
            if (showOpts.startHandle) {
                await navigateToHandle(showOpts.startHandle);
            }
            await populateFromFolder(mDirHandle);
            return;
        }

        mConstrained = false;
        mHamburger.style.display = '';  // show hamburger in free-navigation mode
        if (!mRootHandle) {
            // First open: try to restore the root folder from IDB
            const restored = await restoreHandle(mHandleKey);
            if (restored) {
                mRootHandle  = restored;
                mDirHandle   = restored;
                mParentStack = [];
                // Then try to restore the last subfolder within that root
                await restoreLastSubfolder();
            } else {
                await selectFolder();
                // selectFolder handles population, return early
                return;
            }
        }

        if (showOpts.startHandle) {
            await navigateToHandle(showOpts.startHandle);
        }

        if (mDirHandle !== mPopulatedHandle) {
            await populateFromFolder(mDirHandle);
        }
        // else: same folder already displayed — just make the dialog visible
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
     * If name and folderHandle are specified, checks if the folder matches the
     * currently displayed folder. If so, updates or appends the single item's
     * thumbnail without full folder refilling. Otherwise, does a full refresh.
     */
    async function reload(name = null, folderHandle = null) {
        if (!mDirHandle) return;

        if (!name || !folderHandle) {
            await populateFromFolder(mDirHandle);
            return;
        }

        let isSame = false;
        try {
            isSame = await mDirHandle.isSameEntry(folderHandle);
        } catch (e) {
            if (DEBUG) console.warn(`${MYNAME}: isSameEntry check failed`, e);
        }

        if (!isSame) {
            // Saved in a different folder, ignore this event
            return;
        }

        // Saved in the currently displayed folder!
        let jsonHandle = null;
        let tmbHandle = null;
        let binHandle = null;

        try {
            jsonHandle = await folderHandle.getFileHandle(name + '.json');
        } catch (e) {
            // JSON file doesn't exist, ignore
            return;
        }

        try {
            tmbHandle = await folderHandle.getFileHandle(name + '.json.png');
        } catch (e) {}

        try {
            binHandle = await folderHandle.getFileHandle(name + '.json.bin');
        } catch (e) {}

        const tmb = tmbHandle
            ? await fileHandleToDataUrl(tmbHandle)
            : DEFAULT_THUMB;

        const itemData = {
            getName:    () => name,
            jsonHandle,
            binHandle,
        };

        const existing = mSelector.findItem(itemData, true);
        if (existing) {
            mSelector.updateItem({ tmb, data: itemData });
        } else {
            mSelector.addItems([{ tmb, data: itemData }]);
        }
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
