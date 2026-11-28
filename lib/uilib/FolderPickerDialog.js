/**
 * FolderPickerDialog.js
 *
 * A modal folder picker dialog that displays directory subfolders in a tree view.
 * 
 * Usage:
 *   import { createFolderPickerDialog } from './FolderPickerDialog.js';
 *   
 *   const picker = createFolderPickerDialog();
 *   const result = await picker.show(rootHandle, startHandle);
 *   if (result) {
 *       // result: { handle, path, root, rootChanged }
 *   }
 *
 * The picker is the single tool for navigating writable folders. Its footer
 * carries a "Change Root…" button (suppress with options.allowRootChange:
 * false) that opens the system directory picker and re-roots the tree, so a
 * user whose target lies outside the current root of permitted folders never
 * leaves the dialog. When the caller supplied the root, the picker does not
 * persist its replacement: it reports { root, rootChanged: true } and the
 * owning dialog persists under its own key. The picker's own IDB key backs
 * only ownerless use (no rootHandle passed to show()).
 *
 * options.pickerId: the OS picker starts in the folder last picked under this id, and
 * the ownerless root is kept under it (pickerId + '_dirHandle'): the documents' dialogs
 * of an app pass the app's id, so two apps keep their folders apart.
 */

import { createInternalWindow, showWarningBanner, supportsDirectoryPicker } from './modules.js';

const ROOT_HANDLE_KEY = 'docDialog_dirHandle';

/**
 * The OS directory picker's options, read-write: with an id (1 to 32 letters, digits,
 * '_' or '-'; another is left out) the browser starts in the folder last picked under it.
 * @param {string} [id]
 */
export function directoryPickerOptions(id) {
    return (typeof id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(id))
        ? { id, mode: 'readwrite' } : { mode: 'readwrite' };
}

// ── IndexedDB Helpers ────────────────────────────────────────────────────────
function openIDB(dbName, version, storeName) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains(storeName)) {
                e.target.result.createObjectStore(storeName);
            }
        };
        req.onsuccess       = e => resolve(e.target.result);
        req.onerror         = e => reject(e.target.error);
    });
}

async function getFromIDB(key) {
    try {
        const db = await openIDB('FileSelectionDialog', 1, 'handles');
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = e => reject(e.target.error);
        });
    } catch(e) {
        console.warn("FolderPickerDialog: failed to read from IDB", e);
        return null;
    }
}

async function putIntoIDB(key, value) {
    try {
        const db = await openIDB('FileSelectionDialog', 1, 'handles');
        await new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e.target.error);
        });
    } catch(e) {
        console.warn("FolderPickerDialog: failed to write to IDB", e);
    }
}

async function verifyHandlePermission(handle) {
    if (!handle) return { handle: null, prompted: false };
    try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return { handle, prompted: false };
        perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') return { handle, prompted: true };
        return { handle: null, prompted: true };
    } catch (e) {
        console.warn("FolderPickerDialog: failed to query/request permission on handle", e);
        return { handle: null, prompted: false };
    }
}

async function pickRootViaOS(pickerId) {
    if (!supportsDirectoryPicker()) {
        const msg = (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function')
            ? 'Folder selection is unavailable inside an embedded frame. Open in a new tab or use Browser Downloads.'
            : 'Folder selection is not supported in this browser or non-HTTPS page. Files can be saved via Browser Downloads.';
        console.warn("FolderPickerDialog:", msg);
        showWarningBanner(msg, 8000);
        return null;
    }
    try {
        return await window.showDirectoryPicker(directoryPickerOptions(pickerId));
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error("FolderPickerDialog: OS directory picker failed", e);
            showWarningBanner(`Could not open folder picker: ${e.message || e}`, 8000);
        }
        return null;
    }
}

async function selectRootFolder(pickerId, rootKey) {
    const handle = await pickRootViaOS(pickerId);
    if (handle) await putIntoIDB(rootKey, handle);
    return handle;
}

export function createFolderPickerDialog(options = {}) {
    const title = options.title ?? 'Select Folder';
    const allowRootChange = options.allowRootChange !== false;
    const pickerId = options.pickerId ?? null;
    const rootKey = pickerId ? pickerId + '_dirHandle' : ROOT_HANDLE_KEY;

    let mRootHandle = null;
    let mRootChanged = false;   // root replaced via "Change Root…" this show()
    let mSelfOwnedRoot = false; // show() got no root — picker owns persistence
    let mTempSelectedHandle = null;
    let mTempSelectedPath = "";
    let mSelectedRow = null;
    let mSelectBtn = null;
    let mCloseDialogFn = null; // Hold reference to active show() close function

    // Create modal elements
    const backdrop = document.createElement('div');
    backdrop.className = 'folder-picker-modal-backdrop';
    backdrop.style.display = 'none';
    document.body.appendChild(backdrop);

    // Create internal window
    const mWindow = createInternalWindow({
        title,
        width: '450px',
        height: '500px',
        canClose: true,
        canResize: true,
        storageId: options.storageId ?? 'folderPickerDialog',
        role: 'dialog',   // transient picker: Escape closes it
        modal: true,
    });

    mWindow.wnd.classList.add('folder-picker-window');

    // Make sure it starts hidden
    mWindow.setVisible(false);

    // Bind close button in header to cancel flow
    mWindow.button.onclick = (e) => {
        e.preventDefault();
        if (mCloseDialogFn) {
            mCloseDialogFn(null);
        } else {
            mWindow.setVisible(false);
        }
    };

    // Override interior style for layout flexbox
    const interior = mWindow.interior;

    // Content (Tree Container)
    const content = document.createElement('div');
    content.className = 'folder-picker-modal-content';
    interior.appendChild(content);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'folder-picker-modal-footer';
    
    // "Change Root…" re-roots the tree via the system directory picker.
    // Left-aligned (margin-right:auto) so it reads as scope, not confirmation.
    const rootBtn = document.createElement('button');
    rootBtn.className = 'folder-picker-btn folder-picker-btn-root';
    rootBtn.textContent = 'Change Root…';
    rootBtn.title = 'Pick a different top-level folder (system folder picker)';
    if (!allowRootChange) rootBtn.style.display = 'none';
    footer.appendChild(rootBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'folder-picker-btn';
    cancelBtn.textContent = 'Cancel';
    footer.appendChild(cancelBtn);

    const selectBtn = document.createElement('button');
    selectBtn.className = 'folder-picker-btn folder-picker-btn-primary';
    selectBtn.textContent = 'Select';
    selectBtn.disabled = true;
    mSelectBtn = selectBtn;
    footer.appendChild(selectBtn);

    interior.appendChild(footer);

    // Tree Node Renderer Function
    function renderFolderNode(dirHandle, pathStr, isRoot = false) {
        const li = document.createElement('li');
        li.className = 'folder-picker-li';

        const row = document.createElement('div');
        row.className = 'folder-picker-row';
        li.appendChild(row);

        // Toggle arrow (SVG arrow matching DatGui)
        const arrow = document.createElement('span');
        arrow.className = 'folder-picker-arrow folder-picker-arrow-right';
        row.appendChild(arrow);

        // Folder Icon
        const icon = document.createElement('span');
        icon.className = 'folder-picker-icon';
        icon.textContent = '\ud83d\udcc1'; // 📁
        row.appendChild(icon);

        // Folder Name
        const nameLabel = document.createElement('span');
        nameLabel.textContent = dirHandle.name;
        row.appendChild(nameLabel);

        // Subfolders list container (consistent with TreeView)
        const subList = document.createElement('ul');
        subList.setAttribute('class', 'nested');
        li.appendChild(subList);



        // Populate function to run lazily when expanded
        let isPopulated = false;
        let subDirectoryHandles = [];

        async function populateChildren() {
            if (isPopulated) return;
            isPopulated = true;
            subList.innerHTML = '';
            
            try {
                const subfolders = [];
                for await (const [name, handle] of dirHandle.entries()) {
                    if (handle.kind === 'directory') {
                        subfolders.push({ name, handle });
                    }
                }
                subfolders.sort((a, b) => a.name.localeCompare(b.name));
                
                for (const sub of subfolders) {
                    const subPath = pathStr ? `${pathStr} / ${sub.name}` : sub.name;
                    const childLi = renderFolderNode(sub.handle, subPath);
                    subList.appendChild(childLi);
                    subDirectoryHandles.push({ handle: sub.handle, path: subPath, li: childLi });
                }
            } catch (e) {
                console.warn("Failed to populate subdirectories: ", e);
            }
            
            // Hide arrow if no subfolders
            if (subList.children.length === 0) {
                arrow.className = 'folder-picker-arrow folder-picker-arrow-hidden';
            }
        }

        // Toggle expansion handler (custom SVG arrows matching DatGui)
        async function toggleExpand(expand) {
            await populateChildren();
            if (subList.children.length === 0) return;
            
            const isCollapsed = !subList.classList.contains('active');
            const shouldExpand = (expand !== undefined) ? expand : isCollapsed;
            
            if (shouldExpand) {
                subList.classList.add('active');
                arrow.className = 'folder-picker-arrow folder-picker-arrow-down';
                icon.textContent = '\ud83d\udcc2'; // Open folder 📂
            } else {
                subList.classList.remove('active');
                arrow.className = 'folder-picker-arrow folder-picker-arrow-right';
                icon.textContent = '\ud83d\udcc1'; // Closed folder 📁
            }
        }

        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand();
        });

        // Select row handler (consistent with TreeView)
        row.addEventListener('click', () => {
            if (mSelectedRow) {
                mSelectedRow.classList.remove('selected-node');
            }
            mSelectedRow = row;
            row.classList.add('selected-node');
            
            mTempSelectedHandle = dirHandle;
            mTempSelectedPath = pathStr;
            mSelectBtn.disabled = false;

            mWindow.setTitle('folder: ' + pathStr);
        });

        // Save references on the li element to facilitate programmatic navigation
        li.toggleExpand = toggleExpand;
        li.getSubDirectories = async () => {
            await populateChildren();
            return subDirectoryHandles;
        };

        return li;
    }

    /** Clear and rebuild the tree under mRootHandle, then navigate to startHandle. */
    function rebuildTree(startHandle = null) {
        mTempSelectedHandle = null;
        mTempSelectedPath = "";
        mSelectedRow = null;
        selectBtn.disabled = true;
        content.innerHTML = '';
        mWindow.setTitle('folder: ');

        const rootLi = renderFolderNode(mRootHandle, mRootHandle.name, true);
        const ul = document.createElement('ul');
        ul.appendChild(rootLi);
        content.appendChild(ul);

        navigateToStartHandle(rootLi, startHandle);
    }

    // Re-root via the OS picker. Cancelling the OS picker keeps the current
    // tree. Cancelling the dialog afterwards is still a no-op for the caller:
    // a caller-owned root is only ever adopted through a Select result.
    rootBtn.onclick = async () => {
        const newRoot = await pickRootViaOS(pickerId);
        if (!newRoot) return;
        mRootHandle = newRoot;
        mRootChanged = true;
        if (mSelfOwnedRoot) putIntoIDB(rootKey, newRoot);
        rebuildTree();
    };

    function show(rootHandle, startHandle = null) {
        return new Promise(async (resolve) => {
            if (!supportsDirectoryPicker()) {
                await pickRootViaOS(pickerId);
                resolve(null);
                return;
            }

            let activeRoot = null;
            let pickedNewRoot = false;
            let permissionPrompted = false;

            if (rootHandle) {
                const res = await verifyHandlePermission(rootHandle);
                activeRoot = res.handle;
                permissionPrompted = res.prompted;
            }
            if (!activeRoot && !permissionPrompted) {
                const stored = await getFromIDB(rootKey);
                if (stored) {
                    const res = await verifyHandlePermission(stored);
                    activeRoot = res.handle;
                    permissionPrompted = res.prompted;
                }
            }
            if (!activeRoot) {
                const hasGesture = (typeof navigator === 'undefined'
                    || !navigator.userActivation
                    || navigator.userActivation.isActive);
                if (permissionPrompted && !hasGesture) {
                    showWarningBanner('Folder access was not granted. Click Change Folder… again to pick another folder.', 7000);
                    resolve(null);
                    return;
                }
                activeRoot = await selectRootFolder(pickerId, rootKey);
                pickedNewRoot = !!activeRoot;
            }
            if (!activeRoot) {
                resolve(null);
                return;
            }

            mRootHandle = activeRoot;
            mSelfOwnedRoot = !rootHandle;
            mRootChanged = pickedNewRoot;
            rebuildTree(startHandle);

            backdrop.style.display = 'block';
            mWindow.setVisible(true);

            const previousActive = document.activeElement;
            setTimeout(() => {
                cancelBtn.focus();
            }, 60);

            const closeDialog = (result) => {
                mCloseDialogFn = null;
                window.removeEventListener('keydown', keydownHandler);
                backdrop.style.display = 'none';
                mWindow.setVisible(false);
                if (previousActive && typeof previousActive.focus === 'function') {
                    previousActive.focus();
                }
                resolve(result);
            };
            mCloseDialogFn = closeDialog;

            const keydownHandler = (e) => {
                if (backdrop.style.display === 'none') return;
                
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDialog(null);
                } else if (e.key === 'Enter' && !selectBtn.disabled) {
                    e.preventDefault();
                    closeDialog({
                        handle: mTempSelectedHandle,
                        path: mTempSelectedPath,
                        root: mRootHandle,
                        rootChanged: mRootChanged,
                    });
                } else if (e.key === 'Tab') {
                    // Simple focus trap: rootBtn (when shown), cancelBtn, selectBtn
                    const focusables = allowRootChange ? [rootBtn, cancelBtn] : [cancelBtn];
                    if (!selectBtn.disabled) {
                        focusables.push(selectBtn);
                    }
                    const index = focusables.indexOf(document.activeElement);
                    if (e.shiftKey) {
                        // shift + tab
                        if (index <= 0) {
                            focusables[focusables.length - 1].focus();
                            e.preventDefault();
                        }
                    } else {
                        // tab
                        if (index === -1 || index >= focusables.length - 1) {
                            focusables[0].focus();
                            e.preventDefault();
                        }
                    }
                }
            };
            window.addEventListener('keydown', keydownHandler);

            // Click handlers
            cancelBtn.onclick = () => {
                closeDialog(null);
            };

            selectBtn.onclick = () => {
                closeDialog({
                    handle: mTempSelectedHandle,
                    path: mTempSelectedPath,
                    root: mRootHandle,
                    rootChanged: mRootChanged,
                });
            };

        });
    }

    async function navigateToStartHandle(rootLi, startHandle) {
        if (!mRootHandle) return;
        if (!startHandle) {
            // Select root by default
            const row = rootLi.querySelector('div');
            if (row) row.click();
            return;
        }
        try {
            const relative = await mRootHandle.resolve(startHandle);
            if (!relative) {
                // If it resolves to null, select root by default
                const row = rootLi.querySelector('div');
                if (row) row.click();
                return;
            }
            
            let currentLi = rootLi;
            await currentLi.toggleExpand(true);
            
            for (const name of relative) {
                const subs = await currentLi.getSubDirectories();
                const match = subs.find(s => s.handle.name === name);
                if (!match) break;
                currentLi = match.li;
                await currentLi.toggleExpand(true);
            }
            
            if (currentLi) {
                const row = currentLi.querySelector('div');
                if (row) {
                    row.click();
                    setTimeout(() => {
                        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 50);
                }
            }
        } catch (e) {
            console.warn("Failed to navigate to initial folder:", e);
        }
    }

    return {
        show
    };
}
