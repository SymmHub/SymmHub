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

import { createImageSelector } from '../uilib/imageSelector.js';

import { createFileSelectionDialog } from '../uilib/FileSelectionDialog.js';

import { createSaveAsDialog } from '../uilib/SaveAsDialog.js';

import { BinaryLoader } from '../uilib/BinaryStore.js';

import {
    getHashParams,
    getFileNameFromPath,
    showWarningBanner,
} from '../uilib/utils.js';

import { setParamValues } from '../uilib/param.js';

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
 * @param {object}   [options.rendererConfig]   - SymRendererConfig instance
 * @param {object}   [options.groupMakerFactory]
 * @param {string}   [options.docFolderId]
 * @param {Array}    [options.samples]          - array of imageItems for samples panel
 *
 * Callbacks injected from SymRenderer:
 * @param {function} options.getThumbMaker      - () => thumbMaker object
 * @param {function} options.setTool            - (toolName: string) => void
 * @param {function} options.getToolName        - () => string
 * @param {function} options.setTitle           - (title: string) => void
 * @param {function} options.getNewDocName      - () => string
 * @param {function} options.onLoadDocumentText - (text, name) => void
 */
export function createDocumentManager(options) {

    const mAppInfo           = options.appInfo;
    const mParams            = options.params;
    const mRendererConfig    = options.rendererConfig;
    const mGroupMakerFactory = options.groupMakerFactory;
    const mSamplesData       = options.samples;

    // Callbacks
    const getThumbMaker        = options.getThumbMaker;
    const cbSetTool            = options.setTool;
    const cbGetToolName        = options.getToolName;
    const cbSetTitle           = options.setTitle;
    const cbGetNewDocName      = options.getNewDocName;
    const cbOnLoadDocumentText = options.onLoadDocumentText;

    // Private state
    let mDocHandler      = getDocumentHandler({ docFolderId: options.docFolderId });
    let mCurrentDocument = null;
    let mFileDialog      = null;   // FileSelectionDialog for local files
    let mSaveAsDialog    = null;   // SaveAsDialog for Save As / Save New
    let mSamplesSelector = null;   // imageSelector for URL-based samples

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
        onDocumentSelected,
        loadPresetUrl: readParamsUrl,
        setDocumentData,
        createInitialDocument,
        getCurrentDocument: () => mCurrentDocument,
        getSamplesSelector: () => mSamplesSelector,
    };

    return myself;

    // ── Initialisation ────────────────────────────────────────────────────────

    function init() {
        window.addEventListener('hashchange', onHashChange);
        if (mSamplesData) {
            onShowSamples();
            mSamplesSelector.addItems(mSamplesData);
        }
    }

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
        if(opt.preset) readParamsUrl(opt.preset);
    }

    // ── Loading ───────────────────────────────────────────────────────────────

    async function setDocumentData(jsonObj, binBuffer = null, baseUrl = null) {

        if(false)console.log(`${MYNAME}.setDocumentData()`, JSON.stringify(jsonObj, null, 2));
        SymRendererUpgradeData(jsonObj, { groupMakerFactory: mGroupMakerFactory });

        if (jsonObj.binary_data) {
            let buf = binBuffer;
            if (!buf) {
                try {
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
        mCurrentDocument = mDocHandler.createDocument({
            appInfo:        mAppInfo,
            params:         mParams,
            thumbMaker:     getThumbMaker(),
            name:           docName,
            rendererConfig: mRendererConfig,
            // No origin — URL-based docs are "samples", Save will open SaveAs
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

        let binBuffer = null;
        if (jsonObj.binary_data) {
            if (binFile) {
                binBuffer = await binFile.arrayBuffer();
                if (binBuffer.byteLength === 0) {
                    console.warn(`${MYNAME}.readParamsFile(): binary sidecar is empty`);
                    binBuffer = null;
                }
            } else {
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
                return;
            }
        }

        if(jsonObj.name && mCurrentDocument.setName) mCurrentDocument.setName(jsonObj.name);
        cbSetTitle(jsonObj.name || jsonFile.name);

        await setDocumentData(jsonObj, binBuffer);
    }

    /**
     * Load a document from a pair of FileSystemFileHandles.
     * Called when the user clicks a JSON file in the FileSelectionDialog.
     */
    async function readParamsHandle(jsonHandle, binHandle) {
        if(DEBUG)console.log(`${MYNAME}.readParamsHandle()`, jsonHandle.name);
        const jsonFile = await jsonHandle.getFile();
        const binFile  = binHandle ? await binHandle.getFile() : null;
        const baseName = jsonHandle.name.replace(/\.json$/, '');

        mCurrentDocument = mDocHandler.createDocument({
            appInfo:              mAppInfo,
            params:               mParams,
            thumbMaker:           getThumbMaker(),
            name:                 baseName,
            rendererConfig:       mRendererConfig,
            originFolderHandle:   mFileDialog?.getWriteHandle() ?? null,
            originFileName:       baseName,
        });
        await readParamsFile(jsonFile, binFile);
    }

    // ── Document selection ────────────────────────────────────────────────────

    function onDocumentSelected(itemData) {
        if(DEBUG)console.log(`${MYNAME}.onDocumentSelected():`, itemData);

        if (itemData.isSample) {
            // URL-based sample — update hash so URL reflects active preset
            const currentPreset = getHashParams().preset;
            if (currentPreset === itemData.jsonUrl) {
                onHashChange();
            } else {
                window.location.hash = JSON.stringify({ preset: itemData.jsonUrl });
            }
        } else if (itemData.jsonFile) {
            // Fallback: drag-and-drop (kept for backward compatibility)
            mCurrentDocument = mDocHandler.createDocument({
                appInfo:        mAppInfo,
                jsonFile:       itemData.jsonFile,
                params:         mParams,
                thumbMaker:     getThumbMaker(),
                rendererConfig: mRendererConfig,
            });
            const jsonFile = mCurrentDocument.getJsonFile();
            if (jsonFile) readParamsFile(jsonFile, itemData.binFile);
        }
    }

    // ── Saving ────────────────────────────────────────────────────────────────

    /**
     * Save the current document.
     * - If it was loaded from a local file (has origin), overwrite in-place.
     * - If it came from a URL/sample, open the Save As dialog.
     */
    function onSaveDocument() {
        const doc          = mCurrentDocument;
        const originFolder = doc.getOriginFolderHandle?.();
        const originName   = doc.getOriginFileName?.();

        if (originFolder && originName) {
            // Local file — overwrite directly
            if(DEBUG)console.log(`${MYNAME}.onSaveDocument(): overwriting`, originName);
            mDocHandler.setWriteFolder(originFolder);
            doc.save().then(() => {
                mFileDialog?.reload();
            });
        } else {
            // Sample or unsaved — redirect to Save As
            if(DEBUG)console.log(`${MYNAME}.onSaveDocument(): no origin, opening Save As`);
            onSaveDocumentAs();
        }
    }

    /** Open Save As dialog with the current document name pre-filled. */
    function onSaveDocumentAs() {
        openSaveAsDialog(mCurrentDocument.getName());
    }

    /** Open Save As dialog with an auto-generated name pre-filled. */
    function onSaveNewDocument() {
        openSaveAsDialog(cbGetNewDocName());
    }

    function openSaveAsDialog(suggestedName) {
        if (!mSaveAsDialog) {
            mSaveAsDialog = createSaveAsDialog({ storageId: 'saveAsDialog' });
        }
        mSaveAsDialog.show({
            suggestedName,
            suggestedHandle: mFileDialog?.getWriteHandle()     ?? null,
            suggestedPath:   mFileDialog?.getWriteHandlePath() ?? null,
            rootHandle:      mFileDialog?.getRootHandle()      ?? null,
            onSave: (name, folderHandle) => {
                mDocHandler.setWriteFolder(folderHandle);
                saveDocAs(name, folderHandle);
            },
        });
    }

    function saveDocAs(newName, folderHandle) {
        if(DEBUG)console.log(`${MYNAME}.saveDocAs()`, newName);
        let newDoc = mCurrentDocument.clone();
        newDoc.setName(newName);
        // Update origin so subsequent Save overwrites directly
        newDoc.setOrigin(folderHandle, newName);

        newDoc.save().then(() => {
            mCurrentDocument = newDoc;
            mFileDialog?.reload();
        });
    }

    // ── Panel management ──────────────────────────────────────────────────────

    /**
     * Show the file browser dialog.
     * On first call: creates the dialog (lazily). Subsequent calls just show it.
     */
    function onShowDocuments() {
        if(DEBUG)console.log(`${MYNAME}.onShowDocuments()`);
        if (!mFileDialog) {
            mFileDialog = createFileSelectionDialog({
                title:          'Documents',
                filter:         'json',
                storageId:      'docFileDialog',
                width:          '520px',
                height:         '460px',
                left:           '60px',
                top:            '60px',
                onSelect:       (item) => readParamsHandle(item.jsonHandle, item.binHandle),
                onFolderChange: (handle) => mDocHandler.setWriteFolder(handle),
            });
        }
        mFileDialog.show();
    }

    /** Show/create the samples panel (URL-based presets). */
    function onShowSamples() {
        if(DEBUG)console.log(`${MYNAME}.onShowSamples()`);
        if (!mSamplesSelector) {
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

    /** Re-select the root folder for the file browser. */
    function onSelectFolder() {
        if(DEBUG)console.log(`${MYNAME}.onSelectFolder()`);
        if (!mFileDialog) {
            // Lazily create and let show() handle folder selection
            onShowDocuments();
        } else {
            mFileDialog.selectFolder();
        }
    }

} // createDocumentManager
