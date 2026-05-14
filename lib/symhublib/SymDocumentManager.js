/**
 * SymDocumentManager.js
 *
 * Manages document loading, saving, and the file/sample selector panels.
 * Extracted from SymRenderer to keep that module focused on rendering.
 *
 * Usage:
 *   const docManager = createDocumentManager({ appInfo, params, ... });
 *   docManager.init();           // call once after construction
 *   docManager.onHashChange();   // call when window hash changes
 */

import {
    createImageSelector,
    createPresetsFilesFilter,
} from '../uilib/imageSelector.js';

import { BinaryLoader } from '../uilib/BinaryStore.js';

import {
    getHashParams,
    getFileNameFromPath,
    showWarningBanner,
} from '../uilib/utils.js';

import { setParamValues } from '../uilib/param.js';

import { openFile } from '../uilib/files.js';

import { SymRendererUpgradeData } from './SymRendererUpgradeData.js';

import { getDocumentHandler } from '../uilib/document.js';

const DEBUG = true;
const MYNAME = 'DocManager';

const EXT_JSON     = '.json';
const EXT_JSON_PNG = '.png';
const EXT_JSON_BIN = '.json.bin';

/**
 * @param {object} options
 * @param {object}   options.appInfo            - app metadata object
 * @param {object}   options.params             - root param tree (never replaced)
 * @param {object}   [options.rendererConfig]   - SymRendererConfig instance (reads .useBinaryStorage live)
 * @param {object}   [options.groupMakerFactory]
 * @param {string}   [options.docFolderId]
 * @param {Array}    [options.samples]          - array of imageItems for samples panel
 *
 * Callbacks injected from SymRenderer (keep their private state there):
 * @param {function} options.getThumbMaker      - () => thumbMaker object
 * @param {function} options.setTool            - (toolName: string) => void
 * @param {function} options.getToolName        - () => string
 * @param {function} options.setTitle           - (title: string) => void
 * @param {function} options.getNewDocName      - () => string  (auto-generated name)
 * @param {function} options.onLoadDocumentText - (text, name) => void  (readParamText in SymRenderer)
 */
export function createDocumentManager(options) {

    const mAppInfo           = options.appInfo;
    const mParams            = options.params;
    const mRendererConfig    = options.rendererConfig;  // live source of useBinaryStorage
    const mGroupMakerFactory = options.groupMakerFactory;
    const mSamplesData       = options.samples;

    // Callbacks
    const getThumbMaker       = options.getThumbMaker;
    const cbSetTool           = options.setTool;
    const cbGetToolName       = options.getToolName;
    const cbSetTitle          = options.setTitle;
    const cbGetNewDocName     = options.getNewDocName;
    const cbOnLoadDocumentText = options.onLoadDocumentText; // readParamText stays in SymRenderer

    // Private state
    let mDocHandler        = getDocumentHandler({ docFolderId: options.docFolderId });
    let mCurrentDocument   = null;
    let mDocumentsSelector = null;
    let mSamplesSelector   = null;

    // ── Public API ────────────────────────────────────────────────────────────

    const myself = {
        init,
        onHashChange,
        onSaveDocument,
        onSaveDocumentAs,
        onSaveNewDocument,
        onShowDocuments,
        onShowSamples,
        onSelectFolder,
        onOpenDocument,
        onDocumentSelected,
        loadPresetUrl: readParamsUrl,
        // Exposed so SymRenderer's readParamText can call back into us
        setDocumentData,
        createInitialDocument,
        getCurrentDocument: () => mCurrentDocument,
        getSamplesSelector: () => mSamplesSelector,
    };

    return myself;

    // ── Initialisation ────────────────────────────────────────────────────────

    /**
     * Call once after construction.
     * Populates the samples panel (if samples were provided) and wires the
     * hashchange listener.
     */
    function init() {

        window.addEventListener('hashchange', onHashChange);

        if (mSamplesData) {
            onShowSamples();
            mSamplesSelector.addItems(mSamplesData);
        }

    }

    /**
     * Create the initial (empty) document at startup.
     * Returns the document so SymRenderer can call setName() on it.
     */
    function createInitialDocument() {
        mCurrentDocument = mDocHandler.createDocument({
            appInfo:        mAppInfo,
            params:         mParams,
            thumbMaker:     getThumbMaker(),
            rendererConfig: mRendererConfig,
        });
        return mCurrentDocument;
    }

    // ── Hash navigation ───────────────────────────────────────────────────────

    function onHashChange() {

        let opt = getHashParams();
        if(DEBUG)console.log(`${MYNAME}.onHashChange()`, opt);
        if(opt.preset) {
            readParamsUrl(opt.preset);
        }

    }

    // ── Loading ───────────────────────────────────────────────────────────────

    async function setDocumentData(jsonObj, binBuffer = null, baseUrl = null) {

        if(false)console.log(`${MYNAME}.setDocumentData()`, JSON.stringify(jsonObj, null, 2));
        SymRendererUpgradeData(jsonObj, { groupMakerFactory: mGroupMakerFactory });

        if (jsonObj.binary_data) {
            // Load .bin sidecar if not already supplied
            let buf = binBuffer;
            if (!buf) {
                try {
                    // baseUrl may be a root-relative path ("/foo/bar.json") or absolute URL.
                    // new URL(relative, base) requires `base` to have a scheme, so we first
                    // resolve baseUrl against the page URL, then resolve the bin filename from that.
                    const absBase = baseUrl
                        ? new URL(baseUrl, window.location.href).href
                        : window.location.href;
                    const binUrl = new URL(jsonObj.binary_data.file, absBase).href;
                    if(DEBUG) console.log(`${MYNAME}: fetching bin sidecar: ${binUrl}`);
                    const resp = await fetch(binUrl);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
                    buf = await resp.arrayBuffer();
                } catch(e) {
                    console.warn(`${MYNAME}: could not load binary sidecar`, e);
                }
            }
            if (buf) {
                const { manifest, binData } = BinaryLoader.parseFileBuffer(buf);
                mCurrentDocument.beginLoad(new BinaryLoader(manifest, binData));
            }
        }

        setParamValues(mParams, jsonObj.params, true);
        mCurrentDocument.endLoad();

        cbSetTitle(mCurrentDocument.getName());
        cbSetTool(cbGetToolName());

    }

    async function readParamsUrl(jsonUrl) {

        if(DEBUG)console.log(`${MYNAME}.readParamsUrl()`, jsonUrl);
        let docName = getFileNameFromPath(jsonUrl);
        if(DEBUG) console.log(`${MYNAME} docName:`, docName);
        mCurrentDocument = mDocHandler.createDocument({
            appInfo:        mAppInfo,
            params:         mParams,
            thumbMaker:     getThumbMaker(),
            name:           docName,
            rendererConfig: mRendererConfig,
        });

        const response = await fetch(jsonUrl);
        const json = await response.json();
        await setDocumentData(json, null, jsonUrl);

    }

    async function readParamsFile(jsonFile, binFile = null) {

        if(DEBUG)console.log(`${MYNAME}.readParamsFile():`, jsonFile, 'bin:', binFile);
        const jsonText = await jsonFile.text();
        let jsonObj;
        try {
            jsonObj = JSON.parse(jsonText);
        } catch(e) {
            console.error(`${MYNAME}.readParamsFile(): JSON parse error`, e);
            return;
        }

        // Read binary sidecar from the paired File object (avoids fetch() for local files)
        let binBuffer = null;
        if (jsonObj.binary_data) {
            if (binFile) {
                binBuffer = await binFile.arrayBuffer();
                if (binBuffer.byteLength === 0) {
                    console.warn(`${MYNAME}.readParamsFile(): binary sidecar is empty`);
                    binBuffer = null;
                }
            } else {
                // Fallback: try fetch (works for URL-based presets)
                try {
                    const resp = await fetch(jsonObj.binary_data.file);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
                    binBuffer = await resp.arrayBuffer();
                } catch(e) {
                    console.warn(`${MYNAME}.readParamsFile(): could not load binary sidecar`, e);
                }
            }

            if (!binBuffer) {
                const binName = jsonObj.binary_data.file ?? '<unknown>.bin';
                const msg = `Cannot load "${jsonObj.name ?? jsonFile.name}":\n`
                          + `Binary data file "${binName}" is missing or could not be loaded.\n`
                          + `Select both the .json and the matching .bin file together.`;
                console.error(`${MYNAME}:`, msg);
                showWarningBanner(msg, 20000);
                return; // ← abort: don't apply any params
            }
        }

        // Update the document name
        if(jsonObj.name && mCurrentDocument.setName) mCurrentDocument.setName(jsonObj.name);
        cbSetTitle(jsonObj.name || jsonFile.name);

        await setDocumentData(jsonObj, binBuffer);

    }

    // ── Document selection ────────────────────────────────────────────────────

    function onDocumentSelected(itemData) {

        if(DEBUG)console.log(`${MYNAME}.onDocumentSelected():`, itemData);

        if(itemData.isDocument) {

            if(DEBUG) console.log(`${MYNAME} reading params from document: `, itemData);
            mCurrentDocument = itemData;
            // readParamText stays in SymRenderer; call via injected callback
            cbOnLoadDocumentText(mCurrentDocument.getJsonText(), mCurrentDocument.getName());

        } else if(itemData.isSample) {

            if(DEBUG) console.log(`${MYNAME} reading params from URL: `, itemData);
            // Update the hash so the URL always reflects the active preset.
            // onHashChange() is the single load-point for URL-based presets.
            const currentPreset = getHashParams().preset;
            if (currentPreset === itemData.jsonUrl) {
                // Hash unchanged → hashchange event won't fire, trigger manually.
                onHashChange();
            } else {
                window.location.hash = JSON.stringify({ preset: itemData.jsonUrl });
                // hashchange fires automatically → onHashChange() → readParamsUrl()
            }

        } else if(itemData.jsonFile) {

            if(DEBUG) console.log(`${MYNAME}.onDocumentSelected() reading params from file:`, itemData);
            mCurrentDocument = mDocHandler.createDocument({
                appInfo:        mAppInfo,
                jsonFile:       itemData.jsonFile,
                params:         mParams,
                thumbMaker:     getThumbMaker(),
                rendererConfig: mRendererConfig,
            });
            let jsonFile = mCurrentDocument.getJsonFile();
            if(jsonFile) {
                readParamsFile(jsonFile, itemData.binFile);
            }

        }

    }

    // ── Saving ────────────────────────────────────────────────────────────────



    function onSaveNewDocument() {

        let newName = cbGetNewDocName();
        saveDocAs(newName);

    }

    function onSaveDocumentAs() {

        let suggestedName = mCurrentDocument.getName();
        let newName = prompt(' save document as:', suggestedName);
        if(newName != null){
            saveDocAs(newName);
        }

    }

    function saveDocAs(newName) {

        let newDoc = mCurrentDocument.clone();
        newDoc.setName(newName);
        newDoc.save().then(newDocSaved);

        function newDocSaved(res){
            if(DEBUG)console.log(`${MYNAME}.newDocSaved()`, res);
            mCurrentDocument = newDoc;
            onShowDocuments();
            let tmb = newDoc.getTmb();
            mDocumentsSelector.addItems([{tmb: tmb, data: newDoc}]);
            let item = mDocumentsSelector.findItem(newDoc);
            mDocumentsSelector.selectItem(item);
            return res;
        }

    }

    function onSaveDocument() {

        let doc = mCurrentDocument;
        if(DEBUG)console.log(`${MYNAME}.onSaveDocument()`, mCurrentDocument);
        doc.save().then(docSaved);

        function docSaved(res){
            if(DEBUG)console.log(`${MYNAME}.docSaved()`, res);
            onShowDocuments();
            let item = mDocumentsSelector.findItem(doc);
            if(DEBUG)console.log(`${MYNAME} item found: `, item);
            if(item) {
                mDocumentsSelector.updateItem({tmb: doc.getTmb(), data: doc});
            } else {
                mDocumentsSelector.addItems([{tmb: doc.getTmb(), data: doc}]);
            }
            return res;
        }

    }

    // ── Panel management ──────────────────────────────────────────────────────

    function onShowDocuments() {

        if(DEBUG)console.log(`${MYNAME}.onShowDocuments()`);
        if(!mDocumentsSelector){
            mDocumentsSelector = createImageSelector({
                width:       '95%',
                height:      '20%',
                left:        '1%',
                top:         '75%',
                title:       'my files',
                filesFilter: createPresetsFilesFilter(),
                onSelect:    onDocumentSelected,
                storageId:   'files',
            });
        } else {
            mDocumentsSelector.setVisible(true);
        }

    }

    function onShowSamples() {

        if(DEBUG)console.log(`${MYNAME}.onShowSamples()`);
        if(!mSamplesSelector){
            mSamplesSelector = createImageSelector({
                width:     '600px',
                height:    '160px',
                left:      '1px',
                top:       '500px',
                title:     'samples',
                onSelect:  onDocumentSelected,
                storageId: 'samples',
            });
        } else {
            mSamplesSelector.setVisible(true);
        }

    }

    function onSelectFolder() {

        if(DEBUG)console.log(`${MYNAME}.onSelectFolder()`);
        mDocHandler.selectDocFolder();

    }

    function onOpenDocument() {

        if(DEBUG)console.log(`${MYNAME}.onOpenDocument()`);
        const type = [{
            description: 'presets',
            accept: {
                'presets/*': [EXT_JSON_PNG, EXT_JSON, EXT_JSON_BIN],
            },
        }];

        openFile(type, true).then(addDocumentFiles);

    }

    function addDocumentFiles(files) {

        if(DEBUG)console.log(`${MYNAME}.addDocumentFiles()`, files);
        onShowDocuments();
        mDocumentsSelector.addFiles(files);

    }

} // createDocumentManager
