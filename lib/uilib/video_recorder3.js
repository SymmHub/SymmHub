import {
    //Globals,
    //loadJS,
    getParam,
    isDefined,
    writeBlobToFile,
    date2s,
    getTime,
    writeFile,
}
from './modules.js'

const DEBUG = true;
const MYNAME = 'VideoRecorder3';
const TYPE_JPG = 'image/jpeg';
const EXT_JPG = '.jpg';
const BASE_FOLDER_ID='VideoRecording';
const MAXZIP_WRITERS = 3;
//
// have to make delayed loading because Globals.LIBRARY_PATH is defined in htlm page AFTER this module is loaded
//

//setTimeout(loadJSZip, 10);

// max size of a single zip file
//const MAX_ZIP_SIZE = 10000000; // 10MB
const MAX_ZIP_SIZE = 100000000; // 100MB


/*
function loadJSZip(){

if(DEBUG)console.log('VideoRecorder Globals.LIBRARY_PATH:',Globals.LIBRARY_PATH);
if(DEBUG)console.log('VideoRecorder JSZip defined: ', isDefined(window.JSZip));
if(isDefined(Globals.LIBRARY_PATH)){
const zipPath = Globals.LIBRARY_PATH + 'lib/jszip.js';
if(DEBUG)console.log('VideoRecorder loading:', zipPath);

function onLoaded(){
if(DEBUG)console.log('VideoRecorder loading finished:', zipPath);
if(DEBUG)console.log('VideoRecorder window.JSZip defined: ', isDefined(window.JSZip));
//console.log('VideoRecorder JSZip defined: ', isDefined(JSZip), JSZip);
};

loadJS(zipPath,onLoaded);

} else {
console.error('VideoRecorder Globals.LIBRARY_PATH is undefined, JSzip is not loaded');
}
}
 */
const MAX_END_FRAME = 100000;

export function createVideoRecorder3(options) {

    let m_isRecording = false;
    let m_isReady = false;
    let m_frameCount = 0;
    let m_zip;
    let m_zipCount = 0;

    let m_animationName = null;
    let m_zipPrefix;
    let m_zipNamePrefix;
    let m_framePrefix;
    let m_imageType;
    let m_endFrame;
    let m_startFrame;
    let m_onEnd = () => {};

    let m_currentZipSize = 0;
    // count of simultaneous zip writinc threads 
    let m_zipWritingThreadCount = 0;
    
    // base folder to save all animations 
    let m_baseOutputFolderHandle = null;
    // folder to save current animation 
    let m_outputFolder = null; 
    function startRecording(options) {

        if (DEBUG)
            console.log(`${MYNAME}.startRecording()`);

        m_zipNamePrefix = getParam(options.zipNamePrefix, 'v');
        m_framePrefix = getParam(options.framePrefix, 'f_');
        m_imageType = getParam(options.imageType, TYPE_JPG);
        m_endFrame = getParam(options.endFrame, MAX_END_FRAME);
        m_startFrame = getParam(options.startFrame, 0);
        m_onEnd = getParam(options.onEnd, () => {});

        m_zipCount = 0;
        m_frameCount = 0;
        m_animationName = m_zipNamePrefix + date2s(new Date(), '-');
        m_zipPrefix = m_animationName + '-';
        m_zip = new JSZip();
        m_currentZipSize = 0;
        m_isRecording = true;
        m_zipWritingThreadCount = 0;
        if (DEBUG)
            console.log(`${MYNAME}.startRecording() to ${m_zipPrefix}`);
        m_isReady = false;
        prepareOutFolder();

    }

    function prepareOutFolder() {
        
        if(!m_baseOutputFolderHandle){
            let res = selectFolder(BASE_FOLDER_ID);
            if(DEBUG) console.log(`${MYNAME}.preparerOutFolder():`, res);
            res.then(onFolderSelected);
        } else {
            m_baseOutputFolderHandle.getDirectoryHandle(m_animationName,{create:true}).then(onSubfolderCreated);
        }
                
        function onFolderSelected(folder){
            
            m_baseOutputFolderHandle = folder;
            if(DEBUG) console.log(`${MYNAME}  user selected base output folder: `, folder);
            
            m_baseOutputFolderHandle.getDirectoryHandle(m_animationName,{create:true}).then(onSubfolderCreated);
        }
        
        function onSubfolderCreated(subfolder){
            
            if(DEBUG) console.log(`${MYNAME} animation subfolder created: `, subfolder);            
            m_outputFolder = subfolder;
            m_isReady = true;
        }
        
        
    }

    function stopRecording() {

        if (DEBUG)
            console.log(`${MYNAME}.stopRecording()`);

        m_isRecording = false;

    }

    function saveRecording() {
        if (DEBUG)
            console.log(`${MYNAME}.saveRecording()`);
    }

    function isRecording() {
        return m_isRecording;
    }

    function isReady() {
        return m_isReady;
    }

    function appendFrame(canvas) {

        if (DEBUG)
            console.log(`${MYNAME}.appendFrame(${m_frameCount})`);

        //m_isReady = false;

        //setTimeout(()=>{m_isReady = true;}, 500);

        writeFrame(canvas);

        m_frameCount++;
        if ((m_startFrame + m_frameCount) > m_endFrame) {
            m_onEnd();
            stopRecording();
        }

    }

    function getFrameFileName() {
        return m_framePrefix + (m_startFrame + m_frameCount).toFixed(0).padStart(6, '0') + EXT_JPG;
    }

    function getZipName() {
        return m_zipPrefix + m_zipCount.toFixed(0).padStart(3, '0') + '.zip';
    }

    function writeFrame(canvas) {

        const fname = getFrameFileName();
        //console.log(fname);
        m_isReady = false;
        let oldTime = getTime();
        canvas.toBlob(writeBlobToZip, m_imageType);
        //canvas.toBlob(writeToFile, m_imageType);

        let zipName = null;

        function writeToFile(blob) {
            if (DEBUG) console.log(`${MYNAME} canvas.toBlob() ${getTime() - oldTime} ms`);
            let oldTime1 = getTime();
            let res = writeFile(m_outputFolder,fname, blob); 
            res.then(onFrameWritten);
            function onFrameWritten(){
               if (DEBUG) console.log(`${MYNAME} onFrameWritten ${fname} ${getTime() - oldTime1} ms`);
               m_isReady = true;                
            }
            
        }

        function writeZipToFile(content) {

            if (DEBUG) console.log(`genZipAsycn done: ${getTime()-oldTime} ms`);
            if (DEBUG) console.log(`${MYNAME} start writeFile (${zipName})`);
            oldTime = getTime();
            let res = writeFile(m_outputFolder,zipName, content);
            
            if (DEBUG)console.log(`${MYNAME} writeFile done ${getTime() - oldTime} ms:`, res);
            res.then(onZipFileWritten);
            
            function onZipFileWritten(){
                
                if (DEBUG) console.log(`${MYNAME} onZipFileWritten: ${getTime() - oldTime} ms`);
                //if(--m_zipWritingThreadCount < MAXZIP_WRITERS) m_isReady = true;
                m_isReady = true;
                if (isRecording()) {
                    // make new zip
                    m_currentZipSize = 0;
                    m_zipCount++;
                    m_zip = new JSZip();
                    m_isReady = true;
                }
                
            }
        };

        function writeBlobToZip(blob) {

            m_zip.file(fname, blob);
            let t = getTime();
            if (DEBUG)console.log(`${MYNAME} canvas.toBlob() ${t-oldTime} ms`);
            m_currentZipSize += blob.size;

            if (!isRecording()) {
                oldTime = getTime();
                zipName = getZipName();
                if (DEBUG) console.log(`${MYNAME}.last fragment generateAsynch(${zipName})`);
                oldTime = getTime();
                //if(++m_zipWritingThreadCount >= MAXZIP_WRITERS) m_isReady = false;
                
                m_zip.generateAsync({
                    type: 'blob'
                }).then(writeZipToFile);
                
            }

            if (m_currentZipSize > MAX_ZIP_SIZE) {
                // save part
                oldTime = getTime();
                zipName = getZipName();
                if (DEBUG) console.log(`${MYNAME} generateAsynch(${zipName})`);
                //if(++m_zipWritingThreadCount >= MAXZIP_WRITERS) m_isReady = false;
                m_zip.generateAsync({
                    type: 'blob'
                }).then(writeZipToFile);
                return;
            } else {
                // just dumped canvas to blob 
                m_isReady = true;
            }
        }

    } // function writeFrame

    return {
        appendFrame: appendFrame,
        isRecording: isRecording,
        isReady: isReady,
        startRecording: startRecording,
        stopRecording: stopRecording,
        saveRecording: saveRecording,
    }

} // getVideoRecorder3 


function selectFolder(id) {

    if (DEBUG)
        console.log('selectFolder()');

    let folderHandle = showDirectoryPicker({id: id, mode: 'readwrite'});

    if (DEBUG)
        console.log('in selectFolder() folderHandle: ', folderHandle);
    return folderHandle;

}
