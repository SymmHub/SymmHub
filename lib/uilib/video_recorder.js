import {
  //Globals,
  //loadJS,  
  getParam,
  isDefined,
  writeBlobToFile,
  date2s,
  getTime,
} from './modules.js'

const DEBUG = true;
const MYNAME = 'VideoRecorder';

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

export function createVideoRecorder(options) {
  
  
  let m_isRecording = false;
  let m_isReady = false;
  let m_frameCount = 0;
  let m_zip;
  let m_zipCount = 0;
  
  let m_zipPrefix;
  let m_zipNamePrefix;
  let m_framePrefix;
  let m_imageType;
  let m_endFrame;
  let m_startFrame;
  let m_onEnd = ()=>{};
  
  let m_currentZipSize = 0;
  
  function startRecording(options){
    
      if(DEBUG)console.log('VideoRecorder.startRecording()');
    
      m_zipNamePrefix = getParam(options.zipNamePrefix, 'v');
      m_framePrefix = getParam(options.framePrefix, 'f_');
      m_imageType = getParam(options.imageType, 'image/jpeg');
      m_endFrame = getParam(options.endFrame, MAX_END_FRAME);
      m_startFrame = getParam(options.startFrame, 0);
      m_onEnd = getParam(options.onEnd, ()=>{});
      
      m_zipCount = 0;
      m_frameCount = 0;
      m_zipPrefix = m_zipNamePrefix + date2s(new Date(), '-')+'-';
      m_zip = new JSZip();
      m_currentZipSize = 0;
      m_isRecording = true;
      m_isReady = true;
      console.log('VideoRecorder.startRecording()',m_zipPrefix);
    
  }

  function stopRecording(){
    
    console.log('VideoRecorder.stopRecording()');

    m_isRecording = false;
    
  }
    
  function saveRecording(){
    console.log('VideoRecorder.saveRecording()');
  } 
  
  function isRecording(){
    return m_isRecording;
  }

  function isReady(){
    return m_isReady;
  }
  
  function appendFrame(canvas){
    
    console.log('VideoRecorder.appendFrame():', m_frameCount);
    
    m_isReady = false;
         
    //setTimeout(()=>{m_isReady = true;}, 500);
    
    writeFrame(canvas);
    
    m_frameCount++;
    if((m_startFrame + m_frameCount) > m_endFrame) {
        m_onEnd();
        stopRecording();
    }
      
  }
 
  function getFrameName(){
    return m_framePrefix + (m_startFrame + m_frameCount).toFixed(0).padStart(6,'0') + '.jpg';
  }
  
    function getZipName(){
        return m_zipPrefix + m_zipCount.toFixed(0).padStart(3,'0') + '.zip';
    }
  
    function writeFrame(canvas){
    
        const fname = getFrameName();
        //console.log(fname);
        m_isReady = false;
        let oldTime = getTime(); 
        canvas.toBlob(writeBlob, m_imageType); 
        
        function writeZip(content){
          
              const zipName = getZipName();
              if(DEBUG) console.log(`genZipAsycn done: ${getTime()-oldTime} ms`);              
              if(DEBUG) console.log(`${MYNAME} start writeBlobToFile:`, zipName);
              oldTime = getTime();
              writeBlobToFile(content, zipName);
              if(DEBUG) console.log(`${MYNAME} writeBlobToFile done ${getTime() - oldTime} ms`);
              if(isRecording()){
                    // make new zip 
                    m_currentZipSize = 0;
                    m_zipCount++;
                    m_zip = new JSZip();
                    m_isReady = true;
              }
        };    
        
        function writeBlob(blob) {
          
          m_zip.file(fname,blob);
          let t = getTime();
          if(DEBUG)console.log(`writeBlob: ${t-oldTime} ms`);
          m_currentZipSize += blob.size;
          
          // TODO wait until all frames are saved 
          
          if(!isRecording()){
            oldTime = getTime();
            if(DEBUG) console.log('last fragment call genZipAsynch()'); 
            oldTime = getTime();
            m_zip.generateAsync({type:'blob'}).then(writeZip);
            m_isReady = false;
          }
          
          if(m_currentZipSize > MAX_ZIP_SIZE){
            // save part 
            oldTime = getTime();
            console.log('call genZipAsynch: ', getZipName()); 
            m_isReady = false;
            m_zip.generateAsync({type:'blob'}).then(writeZip);
            return;
          }
          m_isReady = true;
        }    
    
    }  // function writeFrame  
    
  return {
    appendFrame:    appendFrame,
    isRecording:    isRecording,
    isReady:        isReady,
    startRecording: startRecording,
    stopRecording:  stopRecording,
    saveRecording:  saveRecording,
  }

}