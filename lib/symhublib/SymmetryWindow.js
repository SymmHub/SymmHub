/*
  SymmetryWindow.js — the symmetry in a window of its own, the Symmetry
  tool's panel (SymRenderer's option symmetryWindow): the group type, the
  group maker's params, the group transform, the Dirichlet domain and the
  options, as the symmetry folder of the settings panel has them. The
  settings panel then leaves the symmetry out: a param keeps one control,
  the window's. The params are the same, and so is what a document saves.

  The window opens when the tool is taken up (openForTool), unless the user
  closed it: its [x], or the windows menu when nothing covered it. The
  windows menu opens it again, and from then on the tool opens it too. Its
  edits work whatever the tool. A page opened for the first time leaves it
  closed until the tool is taken up.

  Usage:
    const w = createSymmetryWindow({ params, storageId, left, top, openFolders: ['group params'] });
    w.window          the internal window (for the windows menu)
    w.openForTool()   shown and on top, unless the user closed it
*/

import {
    DatGUI,
    createParamUI,
    createInternalWindow,
} from './modules.js';

/**
 * @param {object}   arg
 * @param {object}   arg.params         the panel's params (a ParamGroup's params, without its folder)
 * @param {string}   [arg.storageId]    the window's place, size and visibility, and whether the user closed it
 * @param {string}   [arg.left]         CSS place and size of the window the first time
 * @param {string}   [arg.top]
 * @param {string}   [arg.width]
 * @param {string}   [arg.height]
 * @param {string[]} [arg.openFolders]  the folders open at first
 */
export function createSymmetryWindow(arg) {

    const storageId = arg.storageId || 'symmetry_window';
    const CLOSED_KEY = storageId + '_closed';

    let mClosed = readStorage(CLOSED_KEY) === 'true';   // closed by the user: the tool leaves it closed
    let mByTool = false;                                  // shown or hidden here, not by the user
    let mGui = null;
    const firstTime = readStorage(storageId + '_visible') === null;

    const mWindow = createInternalWindow({
        title:     'symmetry',
        width:     arg.width || '320px',
        height:    arg.height || '520px',
        left:      arg.left || '52px',
        top:       arg.top || '120px',
        canClose:  true,
        canResize: true,
        storageId,
        onClose:   (win, visible) => { if (!mByTool) setClosed(!visible); },
        onResize:  () => fit(),
    });
    if (firstTime) byTool(() => mWindow.setVisible(false));

    const interior = mWindow.interior;
    interior.classList.add('gui-window-interior');
    mGui = new DatGUI({ autoPlace: false, width: 300 });
    mGui.domElement.classList.add('gui-window-panel');
    interior.appendChild(mGui.domElement);
    createParamUI(mGui, arg.params);
    for (const name of arg.openFolders || []) mGui.__folders[name]?.open();
    fit();

    function fit() {
        if (mGui) mGui.width = Math.max(120, interior.clientWidth || 300);
    }

    function byTool(f) {
        mByTool = true;
        try { f(); } finally { mByTool = false; }
    }

    function setClosed(closed) {
        mClosed = closed;
        try { window.localStorage.setItem(CLOSED_KEY, closed ? 'true' : 'false'); } catch (e) { /* no storage */ }
    }

    function openForTool() {
        if (mClosed) return;
        byTool(() => {
            if (mWindow.isVisible()) mWindow.raise();
            else mWindow.setVisible(true);
        });
    }

    return {
        window: mWindow,
        openForTool,
    };
}

function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
