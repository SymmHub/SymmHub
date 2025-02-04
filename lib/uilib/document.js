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

let writableFolderHandle = null;

async function selectFolder() {

    if (DEBUG)
        console.log('selectFolder()');

    //let folderHandle = await 
    let prom = showDirectoryPicker({id: 'newfiles',mode:'readwrite'});//, startIn:'downloads'});

    if (DEBUG)
        console.log('selectFolder(), prom', prom);

    return prom;

    //folderHandle.requestPermission({
    //    writable: true
    //});

    //const relativePaths = await paramFolderHandle.resolve(handle);
    //console.log('relativePaths:', relativePaths);

    //listFiles(paramFolderHandle);

    //if (DEBUG)
    //    console.log('in selectFolder() folderHandle: ', folderHandle);
    
    //return new Promise(resolve => resolve(folderHandle));

}

let selectedFolder = null;


export function makeDocument(docData = {}){
               
    let docName = 'unnamed';
    let jsonFile = docData.jsonFile;
    let docParams = docData.params;
    let jsonText = docData.jsonText;
    let thumbMaker = docData.thumbMaker;
    let docTmb = docData.tmb;
    
    if(docData.jsonFile){
        
        docName = getFileName(docData.jsonFile.name);
        console.log('docName: ', docName);        
        
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
    };
    
    
    function setName(name){
        docName = name;
    }
    
    function getParamsAsJSON(name) {

        let pset = {
            name: name,
            params: getParamValues(docParams),
        };
        return JSON.stringify(pset, null, 4);

    }
    
    function saveDocTo(name){
        
        console.log(`saveDocTo(${name})`);
        
        jsonText = getParamsAsJSON(name)
        let fileName = name + EXT_JSON;

        writeFile(writableFolderHandle, fileName, jsonText);

        // save thumbnail
        if(thumbMaker){
            let tmbName = fileName + TMB_EXT;
            let tmbCanvas = thumbMaker.getThumbnail();
            console.log('wring thumbnail to :', tmbName);
            //writeCanvasToLocalFile(tmbCanvas, writableFolderHandle, tmbName, TMB_TYPE);            
            tmbCanvas.toBlob((blob => writeFile(writableFolderHandle, tmbName, blob)), TMB_TYPE);
            docTmb = tmbCanvas.toDataURL();
            //createImageBitmap(tmbCanvas).then(bitmap=>{docTmb = bitmap; return bitmap;});
        }        
        
        return myself;
    }
    
    
    async function save(){
        
        if(!writableFolderHandle){
            
            function success(fhandle){
                writableFolderHandle = fhandle;
                console.log('folder selected: ', writableFolderHandle);
                return saveDocTo(docName);
            } 
            function failure(){
                console.log('failed to select folder');
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
        
        return makeDocument({name: docName, 
                            jsonText: jsonText, 
                            params: docParams,
                            thumbMaker: thumbMaker});
        
    }
        
         
    return myself;
    
}

