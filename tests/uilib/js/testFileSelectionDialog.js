/**
 * testFileSelectionDialog.js
 *
 * Interactive test for createFileSelectionDialog.
 *
 * What it tests:
 *  - Folder selection via OS picker
 *  - JSON preset listing (filter: 'json') with .json.png thumbnails
 *  - Image listing (filter: 'image')
 *  - Subfolder navigation and '..' parent navigation
 *  - Re-selecting a different folder
 *  - Reloading the current folder
 *  - onSelect callback output
 */

import { createFileSelectionDialog } from '../../../lib/uilib/uilib.js';

// ── Log helper ────────────────────────────────────────────────────────────────

const logEl = document.getElementById('log');

function log(msg, cls = '') {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
}

function logClear() {
    logEl.replaceChildren();
}

// ── Dialog state ──────────────────────────────────────────────────────────────

let mDialog = null;

function getFilter() {
    return document.getElementById('filterSel').value;
}

function createDialog() {
    // Recreate when filter changes so we get a fresh instance
    mDialog = createFileSelectionDialog({
        title:     'File Selection Test',
        filter:    getFilter(),
        storageId: 'testFileSelDlg',
        width:     '520px',
        height:    '460px',
        left:      '60px',
        top:       '60px',
        onSelect:  onFileSelected,
    });
}

// ── onSelect handler ──────────────────────────────────────────────────────────

async function onFileSelected(item) {
    logClear();
    log(`✔ File selected: "${item.getName()}"`, 'ok');

    if (item.jsonHandle) {
        log(`  jsonHandle.name : ${item.jsonHandle.name}`);
        log(`  binHandle       : ${item.binHandle ? item.binHandle.name : '(none)'}`);

        // Read and display first 200 chars of the JSON
        try {
            const file = await item.jsonHandle.getFile();
            const text = await file.text();
            log(`  JSON preview    : ${text.slice(0, 200).replace(/\n/g, ' ')}…`);
        } catch(e) {
            log(`  (could not read JSON: ${e.message})`, 'warn');
        }
    }

    if (item.imageHandle) {
        log(`  imageHandle.name: ${item.imageHandle.name}`);
    }
}

// ── Buttons ───────────────────────────────────────────────────────────────────

document.getElementById('btnShow').addEventListener('click', () => {
    if (!mDialog) createDialog();
    mDialog.show();
    log('Dialog shown (folder picker will open on first use).', 'ok');
});

document.getElementById('btnReselect').addEventListener('click', () => {
    if (!mDialog) createDialog();
    mDialog.selectFolder();
    log('Folder picker opened.', 'ok');
});

document.getElementById('btnReload').addEventListener('click', () => {
    if (!mDialog) {
        log('No dialog yet — click "Show Dialog" first.', 'warn');
        return;
    }
    mDialog.reload();
    log('Folder reloaded.', 'ok');
});

document.getElementById('btnHide').addEventListener('click', () => {
    if (!mDialog) {
        log('No dialog yet — nothing to hide.', 'warn');
        return;
    }
    mDialog.setVisible(false);
    log('Dialog hidden.', 'warn');
});

// Recreate dialog when filter changes so it uses the new value next time Show is clicked
document.getElementById('filterSel').addEventListener('change', () => {
    mDialog = null;   // will be lazily recreated on next Show
    logClear();
    log(`Filter changed to "${getFilter()}" — click "Show Dialog" to open a new dialog.`, 'warn');
});

log('Ready. Click "Show Dialog" to start the test.');
