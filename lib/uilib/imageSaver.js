import {
    canvasToLocalFile,
    writeFile,
} from './modules.js';

const DEBUG = true;
const TYPE_PNG = 'image/png';
const TYPE_JPG = 'image/jpeg';
const EXT_PNG = '.png';
const EXT_JPG = '.jpg';
const EXT_JSON = '.json';

const MYNAME = 'ImageSaver';

function getExt(imageType){
    
    switch(imageType){
        default: 
        case TYPE_PNG: return EXT_PNG;
        case TYPE_JPG: return EXT_JPG;
    }
}

//
//  return object used to save images
//
export function getImageSaver(id = 'images'){


    let mRootFolder = null;
    let mSubfolders = {};  // map of created subfolders 
    let mCurrentSubfolder = null;

    //
    // save image into current folder 
    //
    function saveImage(canvas, name, jsontxt=null, imageType = TYPE_PNG){
                
        if (!mRootFolder){
            selectFolder(id).then((res) => {
                mRootFolder = res;
                mCurrentSubfolder = mRootFolder;
                return realSaveImage();
            });
        } else {
            return realSaveImage();
        }
        
        
        function realSaveImage() {
            
            let imgFileName = name + getExt(imageType);
            console.log('writing image to: ', imgFileName);
            //
            // all promises 
            let pr = [];
            pr.push(canvasToLocalFile(canvas, mCurrentSubfolder, imgFileName, imageType));

            if(jsontxt) {
                let parFileName = imgFileName + EXT_JSON;                
                pr.push(writeFile(mCurrentSubfolder, parFileName, jsontxt));
            } 
            // return promise which will wait for all 
            return Promise.all(pr);
            
        };
        
    }

    //
    // select output folder 
    //
    function selectRootFolder(name){
        
        return selectFolder(id).then((res) => {
                    console.log('folder selected: ', res);
                    mRootFolder = res;
                    mCurrentSubfolder = mRootFolder;
                    return res;
               });
        
    }
    
    //
    //  creates subfolder in the current exportFolder and use it 
    //
    function createSubfolder(name){
        
        console.log(`${MYNAME}.createSubfolder()`, name); 
        
        return mRootFolder.getDirectoryHandle(name,{create:true}).then((res)=> {
            mSubfolders[name] = res;
            mCurrentSubfolder = res;
            console.log('currentFolder: ', mCurrentSubfolder);
            return mCurrentSubfolder;
       });
       
    }
    
    //
    //   
    //
    function setCurrentSubfolder(name){
         mCurrentSubfolder = subfolders[name];
         console.log('currentSubfolder: ', mCurrentSubfolder);
    }
    
    return {
        saveImage:           saveImage,
        createSubfolder:     createSubfolder, 
        setCurrentSubfolder: setCurrentSubfolder,         
        selectRootFolder:    selectRootFolder,
    }

}


async function selectFolder(id) {

    if (DEBUG)
        console.log('selectFolder()');

    let folderHandle = await showDirectoryPicker({id: id, mode: 'readwrite'});

    if (DEBUG)
        console.log('directoryHandle:', folderHandle);

    //folderHandle.requestPermission({
    //    writable: true
    //});

    //const relativePaths = await paramFolderHandle.resolve(handle);
    //console.log('relativePaths:', relativePaths);

    //listFiles(paramFolderHandle);

    if (DEBUG)
        console.log('in selectFolder() folderHandle: ', folderHandle);
    return new Promise(resolve => resolve(folderHandle));

}
