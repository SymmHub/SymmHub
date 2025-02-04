import {
  getParam,
  //writeBlobToFile,
  date2s,
  getImageSaver,
} from './modules.js'

const DEBUG = true;

const EXT_JPG = '.jpg';
const TYPE_JPG = 'image/jpeg';
const TYPE_PNG = 'image/png';

const MAX_END_FRAME = 100000;

const MYNAME='VideoRecorder2';

// ID of folder selector for root folder to store animations
const FOLDER_ID = 'animations';

//
//
//
export function createVideoRecorder2(options) {
  
  
  let m_isRecording = false;
  let m_isReady = false;
  let m_frameCount = 0;
  
  let m_animName;
  let m_animNamePrefix;
  let m_framePrefix;
  let m_imageType;
  let m_endFrame;
  let m_startFrame;
  let m_onEnd = ()=>{};
  let m_onFrameWritten = ()=>{};
  let m_frameName = 'f_';
  
  let m_imageWriter = null;
  
  function startRecording(options){
    
      if(DEBUG)console.log(`${MYNAME}.startRecording()`);
      if(!m_imageWriter)
          m_imageWriter = getImageSaver(FOLDER_ID);
      
      m_animNamePrefix = getParam(options.animNamePrefix, 'v');
      m_framePrefix = getParam(options.framePrefix, 'f_');
      m_imageType = getParam(options.imageType, TYPE_JPG);
      //m_imageType = TYPE_PNG;
      m_endFrame  = getParam(options.endFrame, MAX_END_FRAME);
      m_startFrame = getParam(options.startFrame, 0);
      m_onEnd = getParam(options.onEnd, ()=>{});
      m_frameCount = 0;
      m_animName = m_animNamePrefix + date2s(new Date(), '-');
      m_isRecording = true;
      m_imageWriter.selectRootFolder().
                        then((res) => 
                                    m_imageWriter.createSubfolder(m_animName)
                             ).
                        then((res)=>{
                                m_isReady = true;
                                console.log(`${MYNAME}.startRecording(name:${m_animName}) into:`,res);
                                return res;
                                }
                            );
                    
    
  }

  function stopRecording(){
    
    console.warn(`${MYNAME}.stopRecording()`);

    m_isRecording = false;
    
  }
    
  function saveRecording(){
    console.warn(`${MYNAME}.saveRecording()`);
  } 
  
  function isRecording(){
    return m_isRecording;
  }

  function isReady(){
    return m_isReady;
  }
  
  function appendFrame(canvas){
      
    if(!m_isRecording) return;
    
    console.log(`${MYNAME}.appendFrame(${m_frameCount})`);
    m_isReady = false;
    m_frameName = getFrameName();
    m_imageWriter.saveImage(canvas, m_frameName, null, m_imageType).
                        then((res)=>{
                            m_isReady = true;
                            if(DEBUG)console.log(`${m_frameName} done`);                            
                            m_frameCount++;
                            if((m_startFrame + m_frameCount) >= m_endFrame) {
                                m_onEnd();
                                stopRecording();
                            }      
                            }
                        )
        
  }
 
  function getFrameName(){
    return m_framePrefix + (m_startFrame + m_frameCount).toFixed(0).padStart(6,'0');
  }
        
  return {
    appendFrame:    appendFrame,
    isRecording:    isRecording,
    isReady:        isReady,
    startRecording: startRecording,
    stopRecording:  stopRecording,
    saveRecording:  saveRecording,
  }

}