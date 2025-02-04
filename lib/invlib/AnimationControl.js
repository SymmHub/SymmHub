import {
  Globals,
  getParam,
  isFunction,
  isDefined,
  writeCanvasToFile,
  writeBlobToFile,
  loadJS,  
  objectToString,
} from './modules.js'

const DEBUG = false;

//if(typeof(JSZip) == 'undefined'){
//  loadJS(Globals.LIBRARY_PATH + 'libm/jszip.js',onZipLoaded);
//}

//
// have to make delayed loading because Globals.LIBRARY_PATH is defined in htlm page AFTER this module is loaded 
//
setTimeout(loadJSZip, 10);

const MAX_ZIP_SIZE = 100000000; // 100MB 

function loadJSZip(){ 

  if(DEBUG)console.log('AnimationControl Globals.LIBRARY_PATH:',Globals.LIBRARY_PATH);
  if(DEBUG)console.log('AnimationControl JSZip:', window.JSZip);
  
  if(isDefined(Globals.LIBRARY_PATH)){
    const zipPath = Globals.LIBRARY_PATH + 'lib/jszip.js';
    if(DEBUG)console.log('AnimationControl loading:', zipPath);
    
    function onLoaded(){
      if(DEBUG)console.log('AnimationControl loading finished:', zipPath);          
      if(DEBUG)console.log('AnimationControl windwos.JSZip: ', isDefined(window.JSZip));          
    };
    
    loadJS(zipPath,onLoaded);
    
  } else {
    console.error('AnimationControl Globals.LIBRARY_PATH is undefined, JSzip is not loaded');
  }
}

const IMAGE_TYPE = 'image/jpeg';

export class AnimationControl {
    
  constructor(opt){
    
    this.imageType = getPtram(opt.imageType, IMAGE_TYPE);
    this.startTime = getParam(opt.startTime, 0);
    this.framePrefix = getParam(opt.framePrefix, 'frame_');
    this.endFrame = getParam(opt.endFrame, 100);
    this.frameInterval = getParam(opt.frameInterval, 1000./60.);
    this.currentFrame  = getParam(opt.strartFrame, 0);
    this.frameExt = getParam(opt.frameExt, '.jpg');
    this.zipPrefix = getParam(opt.zipPrefix, 'animation_');
    this.zipExt = getParam(opt.zipExt, '.zip'); 
    this.zipCount = 0; // count of parts 
    this.zip = new JSZip();
    this.readyToWrite = true;
    this.currentZipSize = 0;
    this.isStopped = false;
    

  }

  isReady(){
    
    return this.readyToWrite;
    
  }
  
  hasNextFrame(){
    
    return this.currentFrame < this.endFrame;
    
  }

  getTime(){
    
    return this.startTime + (this.currentFrame * this.frameInterval);
    
  }
  
  getZipName(){
    
    return this.zipPrefix + (this.zipCount.toFixed(0).padStart(3,'0')) + this.zipExt;
    
  }
  
  getFrameName(){
    
    return  this.framePrefix + (this.currentFrame.toFixed(0).padStart(6,'0')) + this.frameExt;
    
  }

  stop(){
    
    this.isStopped = true;
  
  }

  
  incrementFrame(){
    this.currentFrame++;
  }
  
  //getReady(){
  //  return this.isReady;
  //}
  
  writeFrame(canvas){
    
    if(this.isStopped){
        return;      
    }
    //this.isReady = false;
    const fname = this.getFrameName();
    console.log(fname);
    const zip = this.zip;
    const _this = this;
    
    function writeZip(content){
      
      const zipName = _this.getZipName();
      console.warn('AnimationControl downloading animation:', zipName);
      writeBlobToFile(content, zipName);
      if(!_this.isStopped){
        // make new zip 
        _this.currentZipSize = 0;
        _this.zipCount++;
        _this.zip = new JSZip();
        _this.readyToWrite = true;
      }
    };    
    
    function writeBlob(blob) {
      
      _this.readyToWrite = true;
      zip.file(fname,blob);
      //console.log(fname, ',', blob.size);
      _this.currentZipSize += blob.size;
        // TODO wait until all frames are saved 
      if(_this.isStopped){
        console.warn('saving animation: ', _this.getZipName()); 
        _this.zip.generateAsync({type:'blob'}).then(writeZip);
        _this.hasFinished = true;
        _this.readyToWrite = false;
      }
      if(_this.currentZipSize > MAX_ZIP_SIZE){
        console.warn('saving part: ', _this.getZipName()); 
        _this.readyToWrite = false;
        _this.zip.generateAsync({type:'blob'}).then(writeZip);
      }
    }    

    this.readyToWrite = false;
    canvas.toBlob(writeBlob, this.imageType); 
    
    //writeCanvasToFile(canvas, this.getFrameName(),IMAGE_TYPE);
    
  }
  
};