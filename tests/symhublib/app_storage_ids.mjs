/*
  tests of the app's own ids in the browser's storage (2026-11-22): every app kept its
  documents' windows (Files, Save As, Export image) under the same ids, so a second app
  opened its Files window on the first one's folder. The ids now start with the app's id
  (SymRenderer's docFolderId, by default the name of the folder the page is in).

    node tests/symhublib/app_storage_ids.mjs

  1. directoryPickerOptions (uilib FolderPickerDialog.js): the OS picker gets the id when
     it is 1 to 32 letters, digits, '_' or '-', no id otherwise; always read-write
  2. the document handler (uilib document.js) gives the OS picker the app's id (it gave
     the default id whatever the app passed)
  3. SymRendererConfig: an app with nothing of its own yet starts from the config kept
     under the fallback key (the apps' shared one), and saves under its own key only
  4. the document manager: whether the Files window was left open is read under the
     app's id, not another app's
*/

function makeStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
        keys: () => [...m.keys()],
    };
}
const storage = makeStorage();
globalThis.localStorage = storage;
globalThis.window = globalThis.window || { addEventListener(){}, localStorage: storage };

const { directoryPickerOptions, getDocumentHandler } = await import('../../lib/uilib/uilib.js');
const { createSymRendererConfig } = await import('../../lib/symhublib/SymRendererConfig.js');
const { createDocumentManager } = await import('../../lib/symhublib/SymDocumentManager.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}

// 1. the OS picker's options
{
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(same(directoryPickerOptions('gray_scott_doc_folder'), { id: 'gray_scott_doc_folder', mode: 'readwrite' }),
          '1: a valid id goes to the picker');
    check(same(directoryPickerOptions('animated_patterns_doc_folder'), { id: 'animated_patterns_doc_folder', mode: 'readwrite' }),
          '1: the longest app id in apps/ (28 characters) goes to the picker');
    check(same(directoryPickerOptions('a'.repeat(33)), { mode: 'readwrite' }), '1: 33 characters: no id');
    check(same(directoryPickerOptions('my folder'), { mode: 'readwrite' }), '1: a space: no id');
    check(same(directoryPickerOptions(null), { mode: 'readwrite' }), '1: no id given');
}

// 2. the document handler's picker id
{
    let asked = null;
    globalThis.showDirectoryPicker = (opt) => { asked = opt; return Promise.reject(new Error('no picker in the test')); };
    const origError = console.error, origLog = console.log;
    console.error = () => {};
    console.log = () => {};
    getDocumentHandler({ docFolderId: 'gray_scott_doc_folder' }).selectDocFolder();
    await new Promise((r) => setTimeout(r, 0));
    console.error = origError;
    console.log = origLog;
    check(asked && asked.id === 'gray_scott_doc_folder', `2: the OS picker gets the app's id (got ${JSON.stringify(asked)})`);
    delete globalThis.showDirectoryPicker;
}

// 3. the renderer's config: the shared one as the start, saved under the app's own key
{
    storage.clear();
    const origLog = console.log;
    console.log = () => {};
    storage.setItem('symrenderer_doc_folder_config', JSON.stringify({ useBinaryStorage: true, exportWidth: 1234 }));
    const cfg = createSymRendererConfig({ storageKey: 'gray_scott_doc_folder_config',
                                          fallbackKey: 'symrenderer_doc_folder_config' });
    check(cfg.useBinaryStorage === true, '3: the app starts from the shared config (use .bin)');
    check(cfg.exportWidth === 1234, '3: the shared export width');

    // the app's own config wins over the shared one
    storage.setItem('ginzburg_landau_doc_folder_config', JSON.stringify({ useBinaryStorage: false }));
    const own = createSymRendererConfig({ storageKey: 'ginzburg_landau_doc_folder_config',
                                          fallbackKey: 'symrenderer_doc_folder_config' });
    check(own.useBinaryStorage === false, "3: the app's own config is read, not the shared one");

    // a change is saved under the app's key, the shared one stays as it was
    cfg.exportWidth = 999;
    console.log = origLog;
    const sharedNow = JSON.parse(storage.getItem('symrenderer_doc_folder_config'));
    const ownNow = JSON.parse(storage.getItem('gray_scott_doc_folder_config'));
    check(sharedNow.exportWidth === 1234, '3: the shared config is not written');
    check(ownNow && ownNow.exportWidth === 999 && ownNow.useBinaryStorage === true,
          "3: the change is saved under the app's key, with the rest it started from");
}

// 4. the Files window left open: read under the app's id
{
    storage.clear();
    const origLog = console.log;
    console.log = () => {};
    const make = (id) => createDocumentManager({ docFolderId: id, appInfo: {}, params: {} });
    const gs = make('gray_scott_doc_folder');
    const gl = make('ginzburg_landau_doc_folder');
    console.log = origLog;
    storage.setItem('ginzburg_landau_doc_folder_docFileDialog_visible', 'true');
    check(gl.filesWindow.wasLeftOpen() === true, '4: Ginzburg-Landau: its Files window was left open');
    check(gs.filesWindow.wasLeftOpen() === false, "4: Gray-Scott does not read Ginzburg-Landau's Files window");
    storage.setItem('docFileDialog_visible', 'true');
    check(gs.filesWindow.wasLeftOpen() === false, '4: nor the old shared id');
}

console.log(`${checks - failed} of ${checks} checks passed`);
if (failed) process.exit(1);
