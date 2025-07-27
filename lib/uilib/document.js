import {
    
    getParamValues,
    writeFile, 
} from './modules.js';


const EXT_JSON = '.json';
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
            
            jsonText = getParamsAsJSON(name);
            let fileName = name + EXT_JSON;

            writeFile(mWritableFolderHandle, fileName, jsonText);

            // save thumbnail
            if(thumbMaker){
                let tmbName = fileName + TMB_EXT;
                let tmbCanvas = thumbMaker.getThumbnail();
                if(DEBUG)console.log('wring thumbnail to :', tmbName);
                tmbCanvas.toBlob((blob => writeFile(mWritableFolderHandle, tmbName, blob)), TMB_TYPE);
                docTmb = tmbCanvas.toDataURL();
                //createImageBitmap(tmbCanvas).then(bitmap=>{docTmb = bitmap; return bitmap;});
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
                                    thumbMaker: thumbMaker});
            
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
};
