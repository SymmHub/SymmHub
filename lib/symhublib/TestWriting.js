import {
    canvasToLocalFile,
    writeFile,
    ParamFunc,
    createInternalWindow,
    DatGUI,
} from './modules.js';

const MYNAME = 'TestWriter';
const DEBUG  = true;

/**
 * TestWriter — batch regression tester for SymRenderer.
 * "Run Test..." opens a dat.GUI dialog with folder selection and live progress.
 */
export function TestWriter(options = {}) {

    const { renderFrame, makeThumbnail, readParamText, getParamsAsJSON,
            waitForIdle, displayConfig, loadFromFolder, saveToFolder,
            applyCanvasSize } = options;

    // ── Editable config ───────────────────────────────────────────────────────

    const mConfig = {
        warmupFrames: 2,
        quietFrames:  1,
    };

    // ── Runtime state ─────────────────────────────────────────────────────────

    let mSrcFolder = null;
    let mRunning   = false;
    let mCancelled = false;

    // dat.GUI display state — polled live via .listen()
    const mState = {
        folder:       '(none selected)',
        totalCount:   0,
        currentCount: 0,
        errorCount:   0,
    };

    // ── Dialog ────────────────────────────────────────────────────────────────

    let mDialog = null;

    function ensureDialog() {
        if (mDialog) return;

        const win = createInternalWindow({
            title:     'Render Files Comparison',
            width:     '252px',
            height:    '264px',
            left:      '200px',
            top:       '120px',
            storageId: 'renderFilesComparisonDialog',
            canClose:  true,
            canResize: true,
        });

        const gui = new DatGUI({ autoPlace: false, width: 250 });
        gui.domElement.style.cssText =
            'position:absolute; top:0; left:0; width:100%; box-sizing:border-box;';
        win.interior.appendChild(gui.domElement);

        // Folder display (read-only string, auto-updates via .listen())
        const folderCtrl = gui.add(mState, 'folder').name('Folder').listen();
        makeReadOnly(folderCtrl);

        // Change Folder button
        gui.add({ fn: () => onChangeFolder() }, 'fn').name('Change Folder...');

        // Editable warmup / quiet frames
        gui.add(mConfig, 'warmupFrames', 0, 500, 1).name('Warmup Frames');
        gui.add(mConfig, 'quietFrames',  0, 10,  1).name('Quiet Frames');

        // Read-only progress counters
        makeReadOnly(gui.add(mState, 'totalCount'  ).name('Total'  ).listen());
        makeReadOnly(gui.add(mState, 'currentCount').name('Current').listen());
        makeReadOnly(gui.add(mState, 'errorCount'  ).name('Errors' ).listen());

        // Run / Cancel
        gui.add({ fn: () => onRunClick()    }, 'fn').name('Run');
        gui.add({ fn: () => onCancelClick() }, 'fn').name('Cancel Run');

        mDialog = { setVisible: (v) => win.setVisible(v) };
    }

    /** Make a dat.GUI controller non-editable by the user. */
    function makeReadOnly(ctrl) {
        const input = ctrl.domElement.querySelector('input');
        if (input) {
            input.readOnly = true;
            input.style.cssText += '; cursor:default; pointer-events:none;';
        }
        return ctrl;
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    async function onChangeFolder() {
        try {
            const folder = await showDirectoryPicker({ id: 'test_src', mode: 'readwrite' });
            mSrcFolder = folder;
            mState.folder = folder.name;

            // Count JSON files and update Total immediately
            let count = 0;
            for await (const [name, handle] of folder.entries()) {
                if (handle.kind === 'file' && name.endsWith('.json')) count++;
            }
            mState.totalCount   = count;
            mState.currentCount = 0;
            mState.errorCount   = 0;
        } catch (_) {
            // User cancelled picker
        }
    }

    function onRunClick() {
        if (mRunning) return;
        if (!mSrcFolder) {
            alert(`${MYNAME}: Please select a source folder first.`);
            return;
        }
        runBatchAsync();
    }

    function onCancelClick() {
        if (mRunning) mCancelled = true;
    }

    // ── Display config check ──────────────────────────────────────────────────

    const REQUIRED_CANVAS_SIZE     = 'HD/2';
    const REQUIRED_SIZE_MULTIPLIER = 1;

    function checkDisplayConfig() {
        if (!displayConfig) {
            alert(`${MYNAME}: displayConfig not provided.`); return false;
        }
        const errors = [];
        if (displayConfig.canvasSize !== REQUIRED_CANVAS_SIZE)
            errors.push(`canvasSize is "${displayConfig.canvasSize}" (expected "${REQUIRED_CANVAS_SIZE}")`);
        if (displayConfig.sizeMultiplier !== REQUIRED_SIZE_MULTIPLIER)
            errors.push(`sizeMultiplier is ${displayConfig.sizeMultiplier} (expected ${REQUIRED_SIZE_MULTIPLIER})`);
        if (errors.length > 0) {
            alert(`${MYNAME}: Wrong display settings.\n\n` + errors.join('\n')); return false;
        }
        return true;
    }

    // ── Frame helpers ─────────────────────────────────────────────────────────

    function waitFrames(n) {
        return new Promise(resolve => {
            if (n <= 0) { resolve(); return; }
            let count = 0;
            function step() { if (++count >= n) resolve(); else requestAnimationFrame(step); }
            requestAnimationFrame(step);
        });
    }

    // ── Batch run ─────────────────────────────────────────────────────────────

    async function runBatchAsync() {
        if (!checkDisplayConfig()) return;

        const srcFolder = mSrcFolder;
        const outFolder = await srcFolder.getDirectoryHandle('test-out', { create: true });

        const jsonEntries = [];
        for await (const [name, handle] of srcFolder.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json'))
                jsonEntries.push({ name, handle });
        }
        jsonEntries.sort((a, b) => a.name.localeCompare(b.name));

        mState.totalCount   = jsonEntries.length;
        mState.currentCount = 0;
        mState.errorCount   = 0;
        mCancelled = false;
        mRunning   = true;

        const results = [];

        for (const { name, handle } of jsonEntries) {
            if (mCancelled) break;
            if (DEBUG) console.log(`${MYNAME}: processing ${name}`);

            try {
                if (loadFromFolder) {
                    await loadFromFolder(srcFolder, name);
                } else {
                    const file = await handle.getFile();
                    readParamText(await file.text(), name);
                }

                await waitFrames(mConfig.warmupFrames);
                if (waitForIdle) await waitForIdle(mConfig.quietFrames);

                renderFrame();
                await waitFrames(1);
                const tmbCanvas = makeThumbnail();

                const baseName = name.replace(/\.json$/, '');
                if (saveToFolder) {
                    await saveToFolder(outFolder, baseName);
                } else {
                    await writeFile(outFolder, name, getParamsAsJSON(baseName));
                }
                await canvasToLocalFile(tmbCanvas, outFolder, name + '.png', 'image/png');

                // Compare thumbnail sizes
                let hasOriginal = false, origSize = 0, newSize = 0;
                try {
                    origSize = (await (await srcFolder.getFileHandle(name + '.png')).getFile()).size;
                    hasOriginal = true;
                } catch (_) {}
                try {
                    newSize = (await (await outFolder.getFileHandle(name + '.png')).getFile()).size;
                } catch (_) {}

                const sizeChanged = hasOriginal && (origSize !== newSize);
                if (sizeChanged) {
                    mState.errorCount++;
                    if (DEBUG) console.log(`${MYNAME}: diff ${name}: ${origSize} → ${newSize}`);
                }
                results.push({ name, hasOriginal, origSize, newSize, sizeChanged });

            } catch (err) {
                console.error(`${MYNAME}: error processing ${name}:`, err);
                mState.errorCount++;
                results.push({ name, hasOriginal: false, origSize: 0, newSize: 0,
                               sizeChanged: false, error: err.message });
            }

            mState.currentCount++;
        }

        await writeFile(outFolder, 'comparison.html', generateComparisonHtml(results));
        mRunning = false;

        // Summary alert
        const noOrigCount = results.filter(r => !r.hasOriginal && !r.error).length;
        if (mCancelled) {
            alert(`Cancelled after ${mState.currentCount}/${mState.totalCount}.` +
                  (mState.errorCount > 0 ? `\n${mState.errorCount} differences found.` : ''));
        } else if (mState.errorCount === 0 && noOrigCount === 0) {
            alert(`✅ Test passed!\n\n${mState.totalCount} presets rendered. All thumbnails match.`);
        } else {
            const lines = [`❌ Test finished with issues.`, ``, `Processed: ${mState.totalCount}`];
            if (noOrigCount      > 0) lines.push(`No original:   ${noOrigCount}`);
            if (mState.errorCount > 0) lines.push(`Differences:   ${mState.errorCount}`);
            lines.push(``, `Open comparison.html for details.`);
            alert(lines.join('\n'));
        }
    }

    // ── Comparison HTML ───────────────────────────────────────────────────────

    function generateComparisonHtml(results) {
        const diffCount    = results.filter(r => r.sizeChanged).length;
        const summaryClass = diffCount > 0 ? 'summary-warn' : 'summary-ok';
        const summaryText  = diffCount > 0
            ? `⚠ ${diffCount} of ${results.length} pairs differ`
            : `✓ All ${results.length} thumbnails match`;

        const rows = results.map(({ name, hasOriginal, origSize, newSize, sizeChanged, error }) => {
            const origCell = hasOriginal
                ? `<img src="../${name}.png" alt="original">`
                : `<span class="missing">${error ? '⚠ ' + error : 'no original'}</span>`;
            const badge = sizeChanged
                ? `<span class="badge-diff">${origSize}→${newSize} B</span>` : '';
            return `<tr${sizeChanged || error ? ' class="row-diff"' : ''}>
    <td class="name">${name}${badge}</td>
    <td class="thumb">${origCell}</td>
    <td class="thumb"><img src="${name}.png" alt="new"></td>
  </tr>`;
        }).join('');

        return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Rendering Test Comparison</title><style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#1f2328; padding:24px; }
h1 { margin-bottom:12px; font-size:1.4rem; color:#0969da; }
.summary-ok   { margin-bottom:20px; font-size:.9rem; color:#1a7f37; font-weight:600; }
.summary-warn { margin-bottom:20px; font-size:.9rem; color:#9a6700; font-weight:600; }
table { border-collapse:collapse; width:100%; }
th { background:#f6f8fa; color:#57606a; font-size:.75rem; text-transform:uppercase;
     padding:8px 12px; text-align:left; border-bottom:1px solid #d0d7de; }
td { border-bottom:1px solid #e6e8eb; padding:8px 12px; vertical-align:top; }
td.name { font-size:.78rem; color:#57606a; white-space:nowrap; max-width:240px;
          overflow:hidden; text-overflow:ellipsis; }
td.thumb img { display:block; max-width:256px; max-height:256px; border-radius:4px;
               border:1px solid #d0d7de; }
.missing { color:#6e7781; font-style:italic; }
tr.row-diff td { border-left:3px solid #d1242f; }
tr.row-diff td.name { color:#d1242f; }
.badge-diff { display:inline-block; margin-left:6px; padding:1px 6px; font-size:.68rem;
              font-weight:600; color:#fff; background:#d1242f; border-radius:10px; }
</style></head><body>
<h1>Rendering Test Comparison</h1>
<p class="${summaryClass}">${summaryText}</p>
<table><thead><tr><th>File</th><th>Original</th><th>New</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function openDialog() {
        ensureDialog();
        // Switch canvas to the required size for reproducible renders.
        if (displayConfig) {
            displayConfig.canvasSize     = REQUIRED_CANVAS_SIZE;
            displayConfig.sizeMultiplier = REQUIRED_SIZE_MULTIPLIER;
            applyCanvasSize?.();   // actually resize the GL canvas
        }
        mDialog.setVisible(true);
    }

    function getParams() {
        return {
            runTest: ParamFunc({ func: openDialog, name: 'Render Files Comparison...' }),
        };
    }

    return {
        getParams,
        getClassName: () => MYNAME,
        run: openDialog,
    };

} // TestWriter
