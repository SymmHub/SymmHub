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
    
    // Inject styles
    const styleId = 'folder-picker-dialog-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .folder-picker-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 100000;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(3px);
                -webkit-backdrop-filter: blur(3px);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .folder-picker-modal-card {
                background: #ffffff;
                border-radius: 12px;
                width: 450px;
                max-width: 90vw;
                height: 500px;
                max-height: 85vh;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(0, 0, 0, 0.1);
                color: #333333;
            }
            .folder-picker-modal-header {
                padding: 16px 20px;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .folder-picker-modal-header h3 {
                font-size: 16px;
                font-weight: 600;
                margin: 0;
                color: #212529;
            }
            .folder-picker-modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #ffffff;
            }
            .folder-picker-modal-footer {
                padding: 14px 20px;
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .folder-picker-btn {
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                background: #fff;
                color: #333;
                transition: all 0.15s ease;
                outline: none;
                border: 1px solid #dee2e6;
            }
            .folder-picker-btn:hover {
                background: #e9ecef;
                border-color: #ced4da;
            }
            .folder-picker-btn:active {
                transform: scale(0.98);
            }
            .folder-picker-btn-primary {
                background: #1976d2;
                color: #fff;
                border: none;
            }
            .folder-picker-btn-primary:hover {
                background: #1565c0;
            }
            .folder-picker-btn-primary:disabled {
                background: #90caf9;
                color: #e3f2fd;
                cursor: not-allowed;
                transform: none;
            }
        `;
        document.head.appendChild(style);
    }

    let mRootHandle = null;
    let mTempSelectedHandle = null;
    let mTempSelectedPath = "";
    let mSelectedRow = null;
    let mSelectBtn = null;

    // Create modal elements
    const backdrop = document.createElement('div');
    backdrop.className = 'folder-picker-modal-backdrop';
    backdrop.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'folder-picker-modal-card';
    backdrop.appendChild(card);

    // Header
    const header = document.createElement('div');
    header.className = 'folder-picker-modal-header';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    header.appendChild(h3);
    card.appendChild(header);

    // Content (Tree Container)
    const content = document.createElement('div');
    content.className = 'folder-picker-modal-content';
    card.appendChild(content);

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

    card.appendChild(footer);
    document.body.appendChild(backdrop);

    // Tree Node Renderer Function
    function renderFolderNode(dirHandle, pathStr, isRoot = false) {
        const li = document.createElement('li');
        li.style.cssText = 'list-style:none; margin: 4px 0;';

        const row = document.createElement('div');
        row.style.cssText = [
            'display:flex', 'align-items:center', 'gap:6px',
            'padding:4px 8px', 'border-radius:4px', 'cursor:pointer',
            'transition:background 0.1s ease', 'user-select:none'
        ].join('; ');
        li.appendChild(row);

        // Toggle arrow
        const arrow = document.createElement('span');
        arrow.style.cssText = 'width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; color:#666; cursor:pointer;';
        arrow.textContent = '\u25B8'; // ▶
        row.appendChild(arrow);

        // Folder Icon
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size:14px;';
        icon.textContent = '\ud83d\udcc1'; // 📁
        row.appendChild(icon);

        // Folder Name
        const nameLabel = document.createElement('span');
        nameLabel.style.cssText = 'font-size:13px; font-weight: 500;';
        nameLabel.textContent = dirHandle.name;
        row.appendChild(nameLabel);

        // Subfolders list container
        const subList = document.createElement('ul');
        subList.style.cssText = 'padding-left: 20px; display: none;';
        li.appendChild(subList);

        // Hover effect
        row.addEventListener('mouseenter', () => {
            if (mSelectedRow !== row) row.style.background = '#f1f3f5';
        });
        row.addEventListener('mouseleave', () => {
            if (mSelectedRow !== row) row.style.background = 'transparent';
        });

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
                arrow.textContent = '';
                arrow.style.cursor = 'default';
            }
        }

        // Toggle expansion handler
        async function toggleExpand(expand) {
            await populateChildren();
            if (subList.children.length === 0) return;
            
            const isCollapsed = subList.style.display === 'none';
            const shouldExpand = (expand !== undefined) ? expand : isCollapsed;
            
            if (shouldExpand) {
                subList.style.display = 'block';
                arrow.textContent = '\u25be'; // ▼
                icon.textContent = '\ud83d\udcc2'; // Open folder 📂
            } else {
                subList.style.display = 'none';
                arrow.textContent = '\u25B8'; // ▶
                icon.textContent = '\ud83d\udcc1'; // Closed folder 📁
            }
        }

        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand();
        });

        // Select row handler
        row.addEventListener('click', () => {
            if (mSelectedRow) {
                mSelectedRow.style.background = 'transparent';
                mSelectedRow.style.color = '#333';
            }
            mSelectedRow = row;
            row.style.background = '#e7f5ff';
            row.style.color = '#1c7ed6';
            
            mTempSelectedHandle = dirHandle;
            mTempSelectedPath = pathStr;
            mSelectBtn.disabled = false;
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

            // Render root node
            const rootLi = renderFolderNode(mRootHandle, mRootHandle.name, true);
            const ul = document.createElement('ul');
            ul.style.paddingLeft = '0';
            ul.appendChild(rootLi);
            content.appendChild(ul);

            backdrop.style.display = 'flex';

            const previousActive = document.activeElement;
            setTimeout(() => {
                cancelBtn.focus();
            }, 60);

            const closeDialog = (result) => {
                window.removeEventListener('keydown', keydownHandler);
                backdrop.style.display = 'none';
                if (previousActive && typeof previousActive.focus === 'function') {
                    previousActive.focus();
                }
                resolve(result);
            };

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
