import {
    
    getParamValues,
    writeFile, 
} from './modules.js';

import { BinaryStore, BinaryLoader } from './BinaryStore.js';


const EXT_JSON = '.json';
const EXT_JSON_BIN = '.json.bin';
const EXT_JSON_PNG = ".json.png";
const EXT_PNG = '.png';
const EXT_JPEG = '.jpg';
const TMB_EXT = EXT_PNG;
const TYPE_PNG = 'image/png';
const TMB_TYPE = TYPE_PNG;



const DEFAULT_THUMB_URL = 'images/ui/btn_no_image.png';

function getFileName(path){
    
    let dot = path.lastIndexOf('.');
    let slash = path.lastIndexOf('/');
    
    return path.substring(slash, dot);
    
}

const DEBUG = true;
const DEFAULT_DOC_FOLDER_ID = 'doc_folder_id';


//let selectedFolder = null;

const MYNAME = 'Document';

// ── Global current-document accessor ─────────────────────────────────────────
//
// Set to the active document just before any getParamValues / setParamValues
// traversal so that ParamCustom implementations can call getCurrentDocument()
// to obtain the active BinaryStore (save) or BinaryLoader (load).

let _currentDocument = null;

/**
 * Returns the document that is currently being saved or loaded, or null.
 * Call from within a ParamCustom getValue() / setValue() to access binary data.
 *
 * @returns {object|null}  The active document, or null outside a save/load.
 */
function getCurrentDocument() {
    return _currentDocument;
}

// ─────────────────────────────────────────────────────────────────────────────

//
//
//
function getDocumentHandler(options){
    
    if(DEBUG)console.log(`${MYNAME}.getDocumentHandler()`, options);
    let mDocFolderId = (options.docFolderId)? options.docFolder: DEFAULT_DOC_FOLDER_ID;
    let mWritableFolderHandle = null;
    
    //
    //
    //
    function createDocument(docData = {}){
                   
        if(DEBUG)console.log(`${MYNAME}.createDocument()`, docData);
        if(DEBUG)console.trace();
        
        let docName = 'unnamed';
        let jsonFile = docData.jsonFile;
        let docParams = docData.params;
        let jsonText = docData.jsonText;
        let thumbMaker = docData.thumbMaker;
        let docTmb = docData.tmb;
        let mAppInfo = docData.appInfo;
        // Live config reference (preferred) or static fallback
        const mRendererConfig    = docData.rendererConfig ?? null;
        const _useBinaryFallback = !!docData.useBinaryFiles;

        // Returns the current useBinaryStorage value — live if config is available.
        function getUseBinaryFiles() {
            return mRendererConfig ? mRendererConfig.useBinaryStorage : _useBinaryFallback;
        }

        // Active binary store/loader — non-null only during beginSave/beginLoad
        let _activeStore  = null;
        let _activeLoader = null;
        
        if(DEBUG)console.log(`${MYNAME} appInfo: `, mAppInfo);
        
        if(docData.jsonFile){
            
            docName = getFileName(docData.jsonFile.name);
            if(DEBUG)console.log('docName: ', docName);        
            
        } else if(docData.name){
            
            docName = docData.name;
            
        }
        
        let myself = {
            isDocument:   true,
            getName:      () => docName,
            setName:      setName,
            getJsonText:  ()=>jsonText,
            getJsonFile:  ()=>jsonFile,
            getImageItem: getImageItem,
            clone:        clone,
            save:         save,
            getTmb:       () => docTmb,   
            appInfo:      mAppInfo,

            // ── Binary accessors (valid only inside beginSave / beginLoad) ───

            /** Active BinaryStore during a save traversal, otherwise null. */
            getBinaryStore:  () => _activeStore,

            /** Active BinaryLoader during a load traversal, otherwise null. */
            getBinaryLoader: () => _activeLoader,

            // ── Lifecycle methods used by SymRenderer during load ────────────

            /**
             * Mark the start of a load traversal with the given BinaryLoader.
             * Sets this document as the global current document.
             * @param {BinaryLoader} loader
             */
            beginLoad(loader) {
                _activeLoader  = loader;
                _currentDocument = myself;
            },

            /** Mark the end of a load traversal and clear the global reference. */
            endLoad() {
                _activeLoader    = null;
                _currentDocument = null;
            },
        };
        
        
        function setName(name){
            docName = name;
        }
        
        function getParamsAsJSON(name) {

            let pset = {
                name: name,
                appInfo: mAppInfo,
                params: getParamValues(docParams),
            };
            return JSON.stringify(pset, null, 4);

        }
        
        function saveDocTo(name){
            
            if(DEBUG)console.log(`${MYNAME}.saveDocTo(${name})`);
            if(DEBUG)console.log(`appInfo:`, mAppInfo);

            let fileName = name + EXT_JSON;

            if (getUseBinaryFiles()) {
                // ── Binary mode ───────────────────────────────────────────
                const store   = new BinaryStore();
                const binName = name + EXT_JSON_BIN;

                // Make ourselves globally accessible and activate the store
                _activeStore     = store;
                _currentDocument = myself;

                const params = getParamValues(docParams);

                _activeStore     = null;
                _currentDocument = null;

                const manifest = store.toManifest(binName);
                const pset = {
                    name:        name,
                    appInfo:     mAppInfo,
                    binary_data: manifest,
                    params,
                };
                jsonText = JSON.stringify(pset, null, 4);
                writeFile(mWritableFolderHandle, fileName, jsonText);
                // Write the SYMM-format .bin sidecar (header + manifest text + raw chunks)
                const binBlob = new Blob([store.toFileBuffer(manifest)]);
                writeFile(mWritableFolderHandle, binName, binBlob);
            } else {
                // ── Legacy mode ───────────────────────────────────────────
                jsonText = getParamsAsJSON(name);
                writeFile(mWritableFolderHandle, fileName, jsonText);
            }

            // Save thumbnail
            if(thumbMaker){
                let tmbName = fileName + TMB_EXT;
                let tmbCanvas = thumbMaker.getThumbnail();
                if(DEBUG)console.log('wring thumbnail to :', tmbName);
                tmbCanvas.toBlob((blob => writeFile(mWritableFolderHandle, tmbName, blob)), TMB_TYPE);
                docTmb = tmbCanvas.toDataURL();
            }        
            
            return myself;
        }
        
        function saveDocToHandle(){
            
            if(DEBUG)console.log(`${MYNAME}.saveDocToHandle() writing to jsonFile: `, jsonFile);
            if(DEBUG)console.log(`${MYNAME}.saveDocToHandle() tmbFile: `, jsonFile);
            let jsonText = getParamsAsJSON(docName);
            saveFile(jsonFile.handle, jsonText);
            
            
        }
        
        async function save(){
             
            if(DEBUG)console.log(`${MYNAME}.save() name: `, docName, ` jsonFile: `, jsonFile);
            if(jsonFile){
               jsonFile = null;
                //return;
            }            
            if(!mWritableFolderHandle){
                
                function success(fhandle){
                    mWritableFolderHandle = fhandle;
                    if(DEBUG)console.log(`${MYNAME}.save() writable folder: `, mWritableFolderHandle);
                    return saveDocTo(docName);
                } 
                function failure(){
                    console.error(`${MYNAME}.save() failed to select folder`);
                }
                
                return selectFolder().then(success, failure);            
                
            } else {
                 return saveDocTo(docName); 
            }
                            
        }
        
        //
        //  return representation suitable for ImageSelector component 
        //
        function getImageItem(){
            
            // TODO return usable data 
            return {tbm:DEFAULT_THUMB_URL, data: {json:'{}'}};
            
        }
        
     
        function clone(){
            if(DEBUG)console.log(`${MYNAME}.clone()`, mAppInfo);
            return createDocument({name: docName, 
                                    appInfo: mAppInfo,
                                    jsonText: jsonText, 
                                    params: docParams,
                                    thumbMaker: thumbMaker,
                                    rendererConfig:  mRendererConfig,
                                    useBinaryFiles:  _useBinaryFallback});
            
        }
            
             
        return myself;
        
    } // function createDocument
    
    async function selectFolder() {

        if (DEBUG)
            console.log('selectFolder()');

        //let folderHandle = await 
        let prom = showDirectoryPicker({id: mDocFolderId, mode:'readwrite'});//, startIn:'downloads'});

        if (DEBUG)
            console.log('selectFolder(), promice', prom);

        return prom;

    }
    
    function selectDocFolder(){
        
        function onSuccess(fhandle){
            mWritableFolderHandle = fhandle;
            if(DEBUG)console.log(`${MYNAME}.selectDocFolder() selected doc folder: `, mWritableFolderHandle);
        } 
        function onFail(){
            console.error(`${MYNAME}.selectDocFolder() failed to select folder`);
        }
        
        selectFolder().then(onSuccess, onFail);
    }
    
            
    return {
        createDocument: createDocument,
        selectDocFolder: selectDocFolder,
    }
    
} // function getDocumentHandler(options)


const saveFile = async ( handle, data ) =>
{
  // can't get here unless a handle was returned earlier, so no need for feature detection
  try {
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (err) {
    // Fail silently if the user has simply canceled the dialog.
    if (err.name !== 'AbortError') {
      console.error(err.name, err.message);
    }
    return { success: false };
  }
  return { success: true };
}


export {
    getDocumentHandler,
    getCurrentDocument,
};
