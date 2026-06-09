import { createFolderPickerDialog } from '../../../lib/uilib/uilib.js';

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

let mFolderPicker = null;
let mRootHandle = null;
let mLastSelectedHandle = null;

async function initPicker() {
    if (!mFolderPicker) {
        mFolderPicker = createFolderPickerDialog({
            title: 'Test Folder Selection'
        });
    }
}

document.getElementById('btnOpenPicker').addEventListener('click', async () => {
    logClear();
    log('Opening folder picker modal...', 'warn');
    
    try {
        await initPicker();
        
        // Let's pass the root handle (if available) and the last selected handle
        const result = await mFolderPicker.show(mRootHandle, mLastSelectedHandle);
        if (result) {
            mLastSelectedHandle = result.handle;
            log('✔ Folder Selection Confirmed!', 'ok');
            log(`  Name: ${result.handle.name}`);
            log(`  Path: ${result.path}`);
        } else {
            log('✘ Folder selection cancelled by user.', 'err');
        }
    } catch (e) {
        log(`Error opening picker: ${e.message}`, 'err');
        console.error(e);
    }
});

log('Harness ready. Click "Open Folder Picker" to test.');
