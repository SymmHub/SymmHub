import {
    canvasToLocalFile,
    writeFile,
    ParamInt,
    ParamFunc,
} from './modules.js';

const MYNAME = 'TestWriter';
const DEBUG  = true;

/**
 * TestWriter — batch regression tester for SymRenderer.
 *
 * options:
 *   renderFrame    — function() — forces one synchronous render pass
 *   makeThumbnail  — function() → canvas
 *   readParamText  — function(text, name) — loads a JSON preset string
 *   getParamsAsJSON — function(name) → string
 */
export function TestWriter(options = {}) {

    const { renderFrame, makeThumbnail, readParamText, getParamsAsJSON,
            waitForIdle, displayConfig, loadFromFolder, saveToFolder } = options;

    let mConfig = {
        warmupFrames: 2,
        quietFrames:  1,  // extra idle frames after textures load before capture
    };

    // ------------------------------------------------------------------ //
    //  Helpers
    // ------------------------------------------------------------------ //

    /** Resolves after `n` animation-frame ticks. */
    function waitFrames(n) {
        return new Promise(resolve => {
            if (n <= 0) { resolve(); return; }
            let count = 0;
            function step() {
                if (++count >= n) resolve();
                else requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }

    // Required display settings for reproducible thumbnails.
    const REQUIRED_CANVAS_SIZE       = 'HD/2';
    const REQUIRED_SIZE_MULTIPLIER   = 1;

    /**
     * Verify that canvas size settings are locked to the expected values.
     * Shows an alert and returns false if anything is wrong.
     */
    function checkDisplayConfig() {
        if (!displayConfig) {
            alert(`${MYNAME}: displayConfig not provided — cannot verify canvas settings.`);
            return false;
        }
        const errors = [];
        if (displayConfig.canvasSize !== REQUIRED_CANVAS_SIZE)
            errors.push(`canvasSize is "${displayConfig.canvasSize}" (expected "${REQUIRED_CANVAS_SIZE}")`);
        if (displayConfig.sizeMultiplier !== REQUIRED_SIZE_MULTIPLIER)
            errors.push(`sizeMultiplier is ${displayConfig.sizeMultiplier} (expected ${REQUIRED_SIZE_MULTIPLIER})`);
        if (errors.length > 0) {
            alert(`${MYNAME}: Wrong display settings — batch aborted.\n\n` + errors.join('\n'));
            return false;
        }
        return true;
    }


    // ------------------------------------------------------------------ //
    //  HTML generation
    // ------------------------------------------------------------------ //

    function generateComparisonHtml(results) {

        const diffCount = results.filter(r => r.sizeChanged).length;

        const summaryClass = diffCount > 0 ? 'summary-warn' : 'summary-ok';
        const summaryText  = diffCount > 0
            ? `⚠ ${diffCount} of ${results.length} pairs have different thumbnail size`
            : `✓ All ${results.length} thumbnails match in size`;

        const rows = results.map(({ name, hasOriginal, origSize, newSize, sizeChanged }) => {
            // original thumbnail lives one level up (in srcFolder)
            const origCell = hasOriginal
                ? `<img src="../${name}.png" alt="original">`
                : '<span class="missing">no original</span>';
            // new thumbnail is a sibling in outFolder (test-out/)
            const newCell = `<img src="${name}.png" alt="new">`;

            const badge = sizeChanged
                ? `<span class="badge-diff">different size ${origSize}→${newSize} B</span>`
                : '';
            const rowClass = sizeChanged ? ' class="row-diff"' : '';

            return `
  <tr${rowClass}>
    <td class="name">${name}${badge}</td>
    <td class="thumb">${origCell}</td>
    <td class="thumb">${newCell}</td>
  </tr>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rendering Test Comparison</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #ffffff;
      color: #1f2328;
      padding: 24px;
    }
    h1 { margin-bottom: 12px; font-size: 1.4rem; color: #0969da; }
    .summary-ok   { margin-bottom: 20px; font-size: 0.9rem; color: #1a7f37; font-weight: 600; }
    .summary-warn { margin-bottom: 20px; font-size: 0.9rem; color: #9a6700; font-weight: 600; }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th {
      background: #f6f8fa;
      color: #57606a;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #d0d7de;
    }
    td {
      border-bottom: 1px solid #e6e8eb;
      padding: 8px 12px;
      vertical-align: top;
    }
    td.name {
      font-size: 0.78rem;
      color: #57606a;
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    td.thumb { width: 280px; }
    td.thumb img {
      display: block;
      max-width: 256px;
      max-height: 256px;
      border-radius: 4px;
      border: 1px solid #d0d7de;
    }
    .missing { color: #6e7781; font-style: italic; }
    tr:hover td { background: #f6f8fa; }
    tr.row-diff td { border-left: 3px solid #d1242f; }
    tr.row-diff td.name { color: #d1242f; }
    .badge-diff {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      font-size: 0.68rem;
      font-weight: 600;
      color: #fff;
      background: #d1242f;
      border-radius: 10px;
      vertical-align: middle;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <h1>Rendering Test Comparison</h1>
  <p class="${summaryClass}">${summaryText}</p>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Original thumbnail</th>
        <th>New thumbnail</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>`;
    }

    // ------------------------------------------------------------------ //
    //  Batch run
    // ------------------------------------------------------------------ //

    async function runBatch(srcFolder, outFolder) {

        if (DEBUG) console.log(`${MYNAME}.runBatch()`, srcFolder, outFolder);

        // 1. Collect all .json files from source folder.
        const jsonEntries = [];
        for await (const [name, handle] of srcFolder.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json')) {
                jsonEntries.push({ name, handle });
            }
        }
        jsonEntries.sort((a, b) => a.name.localeCompare(b.name));

        if (DEBUG) console.log(`${MYNAME}: found ${jsonEntries.length} JSON files`);

        const results = [];

        for (const { name, handle } of jsonEntries) {

            if (DEBUG) console.log(`${MYNAME}: processing ${name}`);

            // 2. Load preset — use binary-aware path when available.
            if (loadFromFolder) {
                await loadFromFolder(srcFolder, name);
            } else {
                const file     = await handle.getFile();
                const jsonText = await file.text();
                readParamText(jsonText, name);
            }

            // 3. Wait for warmup frames (attractor / sim settle).
            await waitFrames(mConfig.warmupFrames);

            // 4. Wait until all async resources (textures, etc.) are fully loaded.
            //    Then wait quietFrames extra ticks to catch any chain-loaded assets.
            if (waitForIdle) {
                await waitForIdle(mConfig.quietFrames);
            }

            // 5. Force a render and let the GPU flush.
            renderFrame();
            await waitFrames(1);

            // 6. Capture thumbnail.
            const tmbCanvas = makeThumbnail();

            // 7. Save new outputs — use binary-aware path when available:
            //    foo.json (+ foo.json.bin if needed) → outFolder/
            //    foo.json.png                        → outFolder/
            const baseName = name.replace(/\.json$/, '');
            if (saveToFolder) {
                await saveToFolder(outFolder, baseName);
            } else {
                const jsonOut = getParamsAsJSON(baseName);
                await writeFile(outFolder, name, jsonOut);
            }
            await canvasToLocalFile(tmbCanvas, outFolder, name + '.png', 'image/png');

            // 6. Compare original and new thumbnail sizes.
            let hasOriginal = false;
            let origSize    = 0;
            let newSize     = 0;
            try {
                const origHandle = await srcFolder.getFileHandle(name + '.png');
                const origFile   = await origHandle.getFile();
                hasOriginal = true;
                origSize    = origFile.size;
            } catch (_) {
                // No original thumbnail.
            }
            try {
                const newHandle = await outFolder.getFileHandle(name + '.png');
                const newFile   = await newHandle.getFile();
                newSize = newFile.size;
            } catch (_) {
                // Could not read newly written thumbnail.
            }

            const sizeChanged = hasOriginal && (origSize !== newSize);
            if (DEBUG && sizeChanged)
                console.log(`${MYNAME}: size diff for ${name}: ${origSize} → ${newSize}`);

            results.push({ name, hasOriginal, origSize, newSize, sizeChanged });
        }

        // 7. Write comparison HTML.
        const html = generateComparisonHtml(results);
        await writeFile(outFolder, 'comparison.html', html);

        if (DEBUG) console.log(`${MYNAME}: done. ${results.length} items processed.`);

        return results;
    }

    // ------------------------------------------------------------------ //
    //  Entry point — opens directory pickers then runs the batch
    // ------------------------------------------------------------------ //

    async function runTestAsync() {

        if (DEBUG) console.log(`${MYNAME}.runTestAsync()`);

        // Pre-flight: verify canvas settings before touching any files.
        if (!checkDisplayConfig()) return;

        // Single picker — source folder must be opened readwrite so we can
        // create the test-out subfolder inside it.
        const srcFolder = await showDirectoryPicker({ id: 'test_src', mode: 'readwrite' });
        const outFolder = await srcFolder.getDirectoryHandle('test-out', { create: true });

        if (DEBUG) console.log(`${MYNAME}: outFolder =`, outFolder);

        const results = await runBatch(srcFolder, outFolder);

        // Final summary message.
        const total    = results.length;
        const diffCount = results.filter(r => r.sizeChanged).length;
        const noOrigCount = results.filter(r => !r.hasOriginal).length;

        if (diffCount === 0 && noOrigCount === 0) {
            alert(`✅ Test passed!\n\n${total} presets rendered. All thumbnails match the originals.`);
        } else {
            const lines = [`❌ Test finished with issues.`, ``, `Processed: ${total} presets`];
            if (noOrigCount > 0) lines.push(`No original:    ${noOrigCount}`);
            if (diffCount  > 0) lines.push(`Size changed:   ${diffCount}`);
            lines.push(``, `Open comparison.html for details.`);
            alert(lines.join('\n'));
        }
    }

    /** Sync wrapper — dat.gui dislikes async functions (reads the returned Promise as a value). */
    function runTest() {
        runTestAsync();
    }

    // ------------------------------------------------------------------ //
    //  Params (ParamObj-compatible)
    // ------------------------------------------------------------------ //

    function getParams() {
        return {
            warmupFrames: ParamInt({obj: mConfig, key: 'warmupFrames', min: 0, max: 500, step: 1, name: 'warmup frames'}),
            quietFrames:  ParamInt({obj: mConfig, key: 'quietFrames',  min: 0, max: 10,  step: 1, name: 'quiet frames'}),
            runTest: ParamFunc({ func: runTest, name: 'Run Test...' }),
        };
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    return {
        getParams,
        getClassName: () => MYNAME,
        run: runTest,
    };

} // TestWriter
