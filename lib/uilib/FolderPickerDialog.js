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
 *       // result: { handle, path }
 *   }
 */

import { createInternalWindow } from './internalWindow.js';

const ROOT_HANDLE_KEY = 'docDialog_dirHandle';

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

async function restoreRootHandle() {
    const handle = await getFromIDB(ROOT_HANDLE_KEY);
    if (!handle) return null;
    try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return handle;
        perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') return handle;
    } catch(e) {
        console.warn("FolderPickerDialog: failed to query/request permission on root handle", e);
    }
    return null;
}

async function selectRootFolder() {
    try {
        const handle = await showDirectoryPicker({ mode: 'readwrite' });
        await putIntoIDB(ROOT_HANDLE_KEY, handle);
        return handle;
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error("FolderPickerDialog: OS directory picker failed", e);
        }
        return null;
    }
}

export function createFolderPickerDialog(options = {}) {
    const title = options.title ?? 'Select Folder';
    


    let mRootHandle = null;
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

    function show(rootHandle, startHandle = null) {
        return new Promise(async (resolve) => {
            let activeRoot = rootHandle;
            if (!activeRoot) {
                activeRoot = await restoreRootHandle();
            }
            if (!activeRoot) {
                activeRoot = await selectRootFolder();
            }
            if (!activeRoot) {
                resolve(null);
                return;
            }

            mRootHandle = activeRoot;
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

            backdrop.style.display = 'block';
            mWindow.setVisible(true);
            mWindow.wnd.style.zIndex = '100001';

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
                        path: mTempSelectedPath
                    });
                } else if (e.key === 'Tab') {
                    // Simple focus trap: cancelBtn and selectBtn
                    const focusables = [cancelBtn];
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
                    path: mTempSelectedPath
                });
            };

            // Programmatic initial navigation
            navigateToStartHandle(rootLi, startHandle);
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
