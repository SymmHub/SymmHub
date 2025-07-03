///////////////////////////////////////////
///
///   This is the version of PatternTextures that is used in Kaleidesign
///



export const TEX_CAMERA = '[camera]';

import {iDrawPoint, iDrawSegment} from '../../../lib/invlib/IDrawing.js';
import {add,sub,distance1,eDistance} from '../../../lib/invlib/LinearAlgebra.js';

import {cMul,complexN,transformFromCenterToPoint} from '../../../lib/invlib/ComplexArithmetic.js';



import {
    getParam,
    TORADIANS,
    cos,sin,asin,log,
    isDefined, 
    isFunction,
    getCanvasPnt,
} from '../../../lib/invlib/Utilities.js';

import {
  iCumPackTransforms,
   iPackRefCumulativeCount,
   iPackTransforms,
} from '../../../lib/invlib/Inversive.js';


import {
    TW as twgl,
    iSplane,
    objectToString,
    iTransformU4,
} from '../../../lib/invlib/modules.js';

// We need this to reset the centers into the FD. 
// TBD This kind of functionality will be lifted off into some sort
// of texture/layer controller class.
import {
    WallPaperGroup_General
} from './WallPaperGroup_General.js'

const DEFAULT_TEXTURE_SIZE = 1024;

export class TextureManager {
  
	constructor(gl){
    
    this.canvasWidth = DEFAULT_TEXTURE_SIZE;
    this.canvasHeight = DEFAULT_TEXTURE_SIZE;
    
    this.debug = false;
    this.gl = gl;
    // array of texures already loaded 
    this.textures = {};
    if(this.debug) console.log('TextureManager.constructor');
    
    //TODO make sensible default texure 
    this.defaultTexture = {texture:twgl.createTexture(this.gl, {src: [255,255,255,255, 192,192,192,255,192,192,192,255,255,255,255,255],})};
  }
  
  //
  //  return existing texture reference or load new 
  //
  getTexture(url, callback){
    
    var debug = this.debug;
    
    var gl = this.gl;
    //if(debug)console.log('getTexture(%s)', url);
    var textures = this.textures;
    var t = textures[url];
    
    
    if(isDefined(t)){
    
      if(isDefined(t.texture)) {
        // texture loaded 
        //if(debug)console.log('return loaded texture:%s', url); 
        
        if(isDefined(t.video)){
          
          if(isDefined(t.canvas)){
            
            // canvas ready for rendering, render video into canvas
            //if(debug)console.log('render video to canvas'); 
            
            var context = t.canvas.getContext('2d');          
            
            let 
              sx = (t.video.videoWidth - t.video.videoHeight)/2,
              sy = 0,
              sWidth = t.video.videoHeight,
              sHeight = t.video.videoHeight,
              dWidth = t.canvas.width,
              dHeight = t.canvas.height,
              dx = 0, 
              dy = 0;
                         
            context.drawImage(t.video, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            
            // render video into square canvas 
            this.gl.bindTexture(gl.TEXTURE_2D, t.texture);
            //var tt = new Uint8Array([0xFF,0x00,0xFF,0xFF]);
            //this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, tt);//t.video);          
            this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.canvas);
            //this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.video);
            this.gl.generateMipmap(gl.TEXTURE_2D);
          }
          
          return t;
           
        } else {        
        
          // still texture 
          return t;
          
        }
      } else {
        if(debug) console.log('return default for loading texture(%s)', url);        
        return this.defaultTexture;        
      }
    } else {
      
      // non existing texture 
      if(url == TEX_CAMERA){        
        this.createCameraTexture(url, callback);        
        callback();        
        
      } else if(this.isVideoFile(url)){
          // play the video 
          this.createVideoTexture(url, callback);
          callback();
          
      } else { // try to load the image
      
        // will load texture from url 
        textures[url] = {};
        var res = twgl.createTexture(this.gl, {src:url, min:gl.LINEAR_MIPMAP_LINEAR}, function(opt, tex, img){
          textures[url].texture = tex;
          if(debug)console.log('texture loaded: %s', url);
          callback();
        });
        if(debug)console.log('return default texture');        
      }
    }
    return this.defaultTexture;
    
  }
  
  //
  //  return true is url is video file 
  //
  isVideoFile(url){
    
    if(url.endsWith(".mp4")||
       url.endsWith(".webm")
    )
      return true;
    else 
      return false;
  }
  
  createVideoTexture(url, callback){
    
    if(this.debug)console.log('createVideoTexture(url, callback)'); 
    
    var gl = this.gl;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    video.autoPlay = true;
    video.muted = true;
    video.loop = true;
    video.defaultPlaybackRate = 1;//playbackRate;

    const tex = twgl.createTexture(gl, {
      //minMag: gl.LINEAR,
      min: gl.LINEAR_MIPMAP_LINEAR,
      src: [
        192, 192, 192, 255,
        192, 192, 192, 255,
        192, 192, 192, 255,
        192, 192, 192, 255,
      ],
    });
    
    var texInfo = {texture:tex, video:video, canvas:canvas, isAnimation:true};
    this.textures[url] = texInfo;
    var playing = false;
    var timeupdate = false;
        
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);

    function onTimeUpdate(){
       timeupdate = true;
       checkReady();      
    }
    
    function onPlaying() {
       playing = true;
       checkReady();
    }
    
    video.src = url;
    video.play();

    function checkReady() {
      if (playing && timeupdate) {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('timeupdate', onTimeUpdate);
        // video is ready 
        //console.log('video ready');
        texInfo.canvas = canvas;
      }
    }
        
  }
  
  createCameraTexture(url, callback){
    
    let playing = false;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    
    video.autoPlay = true;
    video.muted = true;

    var gl = this.gl;
    const tex = twgl.createTexture(gl, {
      //minMag: gl.LINEAR,
      min: gl.LINEAR_MIPMAP_LINEAR,
      src: [
        192, 192, 192, 255,
        192, 192, 192, 255,
        192, 192, 192, 255,
        192, 192, 192, 255,
      ],
    });
    
    this.textures[url] = {texture:tex, video:video, canvas:canvas, isAnimation:true};
    
    var debug = this.debug;
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video:true }).then(function(stream) {
            video.addEventListener('playing', () => {
              
              playing = true;
              if(debug)console.log('video texture loaded: %s [%d x %d]', url, video.videoWidth, video.videoHeight);              
             
            });
            video.srcObject = stream;
            video.play();
            //stream.getTracks()[0].stop();  // if only one media track              
            callback();
        });
                
    }
    
  }
  
} // class TextureManager 


////////////////////////////////////
//                                //
//                                //
//    Pattern Textures            //
//                                //
//                                //
//                                //
////////////////////////////////////


/*
  pattern formed by several layered textures 
*/
export class PatternTextures {
		
	constructor(options){
    
    this.debug = false;
    
    this.textures = getParam(options.textures[0],/*so as to not limit the change to a single texture to this module*/
      [{name:'red arrow', path:'../../library/images/arrow_red.png'}]);
		this.params = {
      showUI:true,
      active:true,
      scale:0,
      angle:0,
      cx:.1,
      cy:.2

    };
    var opt = getParam(options, {});
    this.texCount = 1; // There will be only one texture henceforth.
    // all indices are being eliminated.

    this.baseDir = getParam(opt.baseDir,'images/');
    this.texNames = this.makeTexNames(this.textures);
    if(this.debug)console.log('this.texNames.length:%d',this.texNames.length);
    this.extension = getParam(opt.extension,'.png');
    this.editPoints = [];
    this.dragging = false;
   


   // this.imageGluedToOriginQ = true; 

    this.angleAdjustment = 0;
    this.imagetransform = [];

    
    
      //this is actually going to be a separate transform for each layer, but for now this is fine.
    

    // After initialization, orbifoldmain.js ensures that 
    //
    //    this.groupHandler 
    //
    // will be defined, and in particular, is able to record
    //the transformation moving the texture rooted at the math-origin.
    // It will also be able to walk the transformation back to the origin.


    ///////////
    //
    //  We are now assuming there is just one texture, which itself always has its center at 00 and is not rotated in math coords.
    //  center now becomes the center of a transformed copy of the image, which we
    // render the outline of. 

    // We will later have some functionality that allows the center of the transform to be 
    // someplace else; for now, this.

    // Later, the textures and each layer of the composited image 
    // will each have their own structure.  Adapting TextureManager above seems simplest.

    
	}

  /**
      return params map to save
  */
  getParamsMap(){
    
    var pm = {};
    var p = this.params;
    
    pm.showUI = p.showUI;
    
    pm.textures = [];
    
    pm.textures = this.getTexParamsMap();

    return pm;
  }

  /**
    set params values from the map 
  */
  setParamsMap(pm){
    
    var p = this.params;
    var c = this.controllers;
    
    //inspectProperties(p);

    c.showUI.setValue(pm.showUI);
    
    var len = 1;

    
    
    this.setTexParamsMap(pm.textures[0]);
      //*******//
      // the parameters upstream still are using arrays.

    
    //inspectProperties(p);
  }

  /**
    return params map for specific texture 
  */
  getTexParamsMap(){
    

    var p = this.params;
    return {
      showUI: p['showUI'],
      active: p['active'],
      name: p['tex'],
      alpha: p['alpha'],
      scale: p['scale'],
      angle: p['angle'],
      center: [p['cx'],p['cy']]
    };
    
  }

/////////////////////////
  // parameters
  //
  /**
    set params of specific texture from map 
  */

     /// In math coordinates, we are now assuming that
    // a texture is always at the origin, from ±scale/2
    // In whatever geometry, there is an image transform
    // (named imagetransform)
    // taking this box to one centered at center, rotated by angle.
    // All of this is handled elsewhere -- this class is currently more of 
    // a wrapper than a renderer. However, we do call on 
    // grouprenderer for a transform t back to the FD; 
    // with which we follow imagetransform.

  setTexParamsMap(pm){
    
    var c = this.controllers;
    
    c['active'].setValue(pm.active);
    c['tex'].setValue(pm.name);
    c['alpha'].setValue(pm.alpha);
    c['scale'].setValue(pm.scale);//scalar 
    c['angle'].setValue(pm.angle);
    c['cx'].setValue(pm.center);
    c['cy'].setValue(pm.center);

    console.log('updating imagetransform from setTexParamsMap')
  //this.onChanged(); // no need to trigger an update of this.imagetransform



    
  }
  
  
  makeTexNames(textures){
    
    var tnames = [];
    
    
      let nn = []; // names for texture  t 
      tnames = nn;
      let tn = textures;
      //console.log('tnames[%d]',t);      
      for(var n = 0;  n < tn.length; n++){
          //console.log('tname:',tn[n].name);
          nn.push(tn[n].name);
           
    }
    return tnames;
  }

  //
  // return URL for texture tindex
  //
  getTexPath() {
    
    // currently selected name for texture t 
    let selectedName = this.params['tex'];
    var tnames = this.texNames;

    
    let selectedIndex = Math.max(0,tnames.indexOf(selectedName)); 
    
    return this.textures[selectedIndex].path;
    
  }
  
  getDefines(un, timeStamp){
    
    var defines = `#define MAX_TEX_COUNT ${Math.max(2,this.texCount)}\n`;  
    
    return defines;
  }
  
	//
	//  return group description
	//
	getUniforms(un){
    
    
      var paramcenter = [this.params['cx'],this.params['cy']];
      var paramangle = -this.params['angle']*TORADIANS+this.angleAdjustment;
      var paramscale = this.params['scale'];

     this.crowntransforms = this.groupHandler.calcCrownTransformsData(
      paramcenter, paramangle, paramscale
      );

     console.log("hey", toString(this.groupHandler.getGroup().c.crowntransformregistry))


     this.crowntransforms = this.crowntransforms.crowntransformregistry
      // send in the current transform, remove references back to PT

    /*  var whatsup;  
     if(!this.imagetransforms){console.log('n')} else{console.log('y');
	   whatsup = this.groupHandler.calcCrownTransformsDataFromTransform(this.imagetransforms);
		}*/
    
    let debug = this.debug;
    var par = this.params;

    // this.imagetransforms =[];// for the moment, we wipe these each pass;
    // soon these will be initiated on load and updated with the dragging.
    
    var samplers;
    var centers;
    var scales;
    var alphas;
    
    //var tcount = 0;
    
    var hasAnimation = false;
    
   // for(var i = 0; i < this.texCount; i++) 
    //{
      
      if(par['active']){
        
        var url = this.getTexPath();
                
        var tex = this.texManager.getTexture(url, this.onChanged);
        
        
        // The texture unit sized at the origin, then transformed by imagetransform, 
        // and then crowntransforms, some of the left imagetransform coset.

   
/* #### */     
        
       
        samplers=tex.texture;
        if(tex.isAnimation){
          hasAnimation = true;
        }          
        alphas=par['alpha'];

/* #### */ 
        
      }
    //}

    
		un.u_texCount = 1;
		un.u_textures = [samplers];// still to turn into a scalar on the webgl side.
		un.u_texAlphas = [alphas];

    un.u_imagetransforms =  iPackTransforms(this.imagetransforms, this.tcount, 5);
      
    var ctrans
    if(this.groupHandler.getGroup().c){
      //var ctrans = this.crowntransforms//
      ctrans = this.groupHandler.getGroup().c.crowntransformregistry;}
    else ctrans = [];
   
    un.u_cTransCumRefCount=iPackRefCumulativeCount(ctrans, this.MAX_CROWN_COUNT);
    un.u_cTransformsData=iCumPackTransforms(ctrans,  this.MAX_TOTAL_CROWN_COUNT);
    un.u_crownCount = 0;/******/ // ctrans.length;

    
    if(hasAnimation)
      this.startAnimation();
    else 
      this.stopAnimation();
    
    return un;
		
	}
	
  //
  //  init custom GUI 
  //
  initGUI(options){
    
    var gui = options.gui;
    var folder = options.folder;
    //var onChanged = options.onChanged;

    this.gl = options.gl;
    this.onChanged = options.onChanged; //  updatePatternData; for when center etc changes
    this.canvas = options.canvas;
    var onModified = this.onModified.bind(this);
    
    this.texManager = new TextureManager(this.gl);
    
    var eps = 1.e-10;
    var par = this.params;
    var texNames = this.texNames;
    this.controllers = {};
    var ctrls = this.controllers;
    

    par['showUI'] = true; 
    ctrls.showUI = folder.add(par, 'showUI').name('showUI').onChange(onModified);	// this goes to updatePatternData

    par['active'] = true;      
    ctrls.active = folder.add(par, 'active').name('active').onChange(onModified);	//updatePatternData
    
    par['tex'] = texNames[0];      
    ctrls['tex'] = folder.add(par, 'tex', texNames).name('tex').onChange(onModified);	

    par['alpha'] = 1;      
    ctrls['alpha'] = folder.add(par, 'alpha', 0, 1,  eps).name('alpha').onChange(onModified);	
    
    par['scale'] = 0;      
    ctrls['scale'] = folder.add(par, 'scale', -6, 6,  eps).name('scale').onChange(onModified);	
    
    par['angle'] = 0;            
    ctrls['angle'] = folder.add(par, 'angle', -360, 360,  eps).name('angle').onChange(onModified);	

    par['cx'] = 0;            
    ctrls['cx'] = folder.add(par, 'cx', -10, 10,  eps).name('cx').onChange(onModified);	
    
    par['cy'] = 0;            
    ctrls['cy'] = folder.add(par, 'cy', -10, 10,  eps).name('cy').onChange(onModified);	
    
    console.log('updating image transforms from initGUI')
    this.onModified()   
     
  }

  onModified(){
    //
    // start/stop texture animation here 
    //
    
    this.onChanged();//updatePatternData
  }

  startAnimation(){
    
    this.animationRunning = true;
    setTimeout(this.animate.bind(this),60);
  }

  stopAnimation(){
    
    this.animationRunning = true;    
    
  }
  
  animate(){

    if(!this.animationRunning)
      return;
        
    this.onChanged();
    
    setTimeout(this.animate.bind(this),60);
    
  }

  /// THIS is this.onChanged = this.onModified.
  // is what is called when any of the data in the panel changes. However, it should not
  /// be changing otherwise.

  updatePatternData(){
     
    // this is called any time that the image transform 
    // needs to be calculated from the center, scale and angle, all from scratch. 
    // We hit this when the controls are changed, etc. 
    // We could call this while dragging the mouse
    
      var centerx = this.params['cx'];
      var centery = this.params['cy'];
      var delta = Math.sqrt(centerx*centerx+centery*centery);
      var scale = Math.exp(this.params['scale']);
      var angle =  this.params['angle'];

      var c = scale*Math.cos(angle); 
      var s = scale*Math.sin(angle);

      var imagetransform = [];

      //var newtransform;
      var complexcenter = [centerx,centery]
      var complexscale = [c,s];


      if(delta>.000001 /*say*/)
      { 
        
        this.imagetransforms = transformFromCenterToPoint(complexcenter,complexscale);
        
       //imagetransform =imagetransform.concat(newtransform);
	  }
      else this.imagetransforms = 
        [ new iSplane({v:[0,1,0,0],type:2}),
          new iSplane({v:[0,1,0,0],type:2})];

      //this.imagetransforms = imagetransform;

    
    console.log(objectToString(this.imagetransforms))

    // each image transform should be set to the identity upon initialization
    // then upon loading a json file, need to calculate from scratch. Thence this function updates the transform.



  }


  render(context, transform){
    
    var par = this.params;
    if(!par.showUI)
      return;
    
    this.transform = transform;// this is the world transform

    // writing this for rendering into fixed disk
    // transform is a further shift of this disk. 

    
    var trans = ((isFunction(transform.transform2screen))? transform.transform2screen : transform.world2screen).bind(transform);
    
    //need to composite 
    var temp  = this.groupHandler.getGroup();
    if(!temp.c){return}
    var imagetransform = temp.c.imagetransformAsMobius;

    var opt = {radius:14, style:"#FFFFAA"};
    var opta = {radius:12, style:"#0000DD"};
    
    var opt1 = {radius:5, style:"#000000"};
    var opt2 = {width:1, style:"#000000", segCount:100};
    var opt1a = {radius:7, style:"#FFFFAA"};
    var opt2a = {width:3, style:"#FFFFAA", segCount:100};

     var opt2a = {width:3, style:"#FFFFAA", segCount:100};


     var xtraoptA = {width:7, style:"#FF00FF", segCount:10};
     var xtraoptB = {width:5, style:"#FF00FF", segCount:10};


    


    var editPoints = [];
    
    
     
      // draw a little circle at the center of the various image transforms
      // use the inversive library to do this because many functions in complexTransforms
      // presume that the unit disk is preserved. 

      var newimagetransform;
      if(this.imagetransforms)
        newimagetransform = this.imagetransforms;
      else 
        newimagetransform = []

      var newpoint = iTransformU4(newimagetransform, new iSplane({v:[0,0,0,0],type:3})).v;
    // newpoint = [newpoint[0],newpoint[1]];

     var optZ = {radius:11, style:"#20F0F0"};
    
     iDrawPoint(newpoint, context, transform, optZ);


     
      if(par['active']){
        


        // here is where we can work out center, etc in terms of the newimagetransform

				var s = 0.5*Math.exp(par['scale']);
			
				
				

        var centerpnt, temppt;

        
        centerpnt = [newpoint[0],newpoint[1]];
        this.params['cx'] = centerpnt[0];
        this.params['cy'] = centerpnt[1];


      // we're going to need some help from Complex.js to figure out how scale changes. 




        var corners = [];

        temppt = iTransformU4(newimagetransform, new iSplane({v:[s,s,0,0],type:3})).v;
        corners.push([temppt[0],temppt[1]]);
        temppt = iTransformU4(newimagetransform, new iSplane({v:[-s,s,0,0],type:3})).v;
        corners.push([temppt[0],temppt[1]]);
        temppt = iTransformU4(newimagetransform, new iSplane({v:[-s,-s,0,0],type:3})).v;
        corners.push([temppt[0],temppt[1]]);
        temppt = iTransformU4(newimagetransform, new iSplane({v:[s,-s,0,0],type:3})).v;
        corners.push([temppt[0],temppt[1]]);
        

        editPoints.push({p:trans(centerpnt), type:0}); // center point type 0
        
        iDrawPoint(centerpnt, context, transform, opt);
        iDrawPoint(centerpnt, context, transform, opta);
        
        for(var k = 0; k < 4; k++){
          
          iDrawPoint(corners[k], context, transform, opt1a);

// need to fix!!
          iDrawSegment(corners[k],corners[(k+1)%4], context, transform, opt2a);  
        }

        
        for(var k = 0; k < 4; k++){
          
          editPoints.push({p:trans(corners[k]), type:(k+1)});
          
          iDrawPoint(corners[k], context, transform, opt1);


          iDrawSegment(corners[k],corners[(k+1)%4], context, transform, opt2);
        }   
      }
    
    this.editPoints = editPoints;
    
  }

  //
  //  handler of all UI events 
  //
  handleEvent(evt){
    
		switch(evt.type) {
		case 'pointermove':
		case 'mousemove':
			this.onMouseMove(evt);
		break;
		case 'pointerdown':
		case 'mousedown':
			this.onMouseDown(evt);
		break;
		case 'pointerup':
		case 'mouseup':
			this.onMouseUp(evt);
		default:
			return;
	  }		       
  }

  //
  //  process mouseMove event 
  //
  onMouseMove(evt){
    
    var pnt = [evt.canvasX,evt.canvasY];
    var wpnt = this.transform.transform2world(pnt); //mathpoint

    this.temppoint = wpnt;

    // if we're close to the boundary of the poincaré disk, 
    // don't do anything.

    if(this.groupHandler.curvature<0)
      { if(wpnt[0]*wpnt[0]+wpnt[1]*wpnt[1]>.9){return;}}

    var par = this.params;
    
    // first of all, let's figure out what the _additional_ transform
    // we will apply to the leaf. When the mouse moves, we will update and highlight
    // the nearest image of the center point texture, together with its frame. 
    // This now becomes the control points. 
    // SERIOUS TBD PROBLEM: you can either switch frames, or you can fix
    // one in order to grab it. Overlapping frames are an issue to be resolved. 
    


    if(!this.dragging && !evt.shiftKey){
      // given wpt, find the nearest image of the center point-- and call that the center,
      // adjusting the scale. In other words, among the crown images of the tex center, 
      // which c is closest to the FD image f(w) of wpt?
      // The center point is therefore c(f(w))
      

      // For now just hardwiring in one texture; later this same code will 
      // be incorporated into some texture controller object that handles this
      // for its own texture.
      
      var temp = this.groupHandler.resetCenterfromPt(wpnt,[par['cx'],par['cy']]);
      var resetdata = this.groupHandler.resetTransformfromPt(wpnt,this.imagetransforms);
      //this.imagetransforms[0]=resetdata.imagetransforms[0];
      par['cx']=temp.center[0]; // the new center.
      par['cy']=temp.center[1]; // 
      this.controllers['cx'].setValue(par['cx']);
      this.controllers['cy'].setValue(par['cy']);




      /**** get rid of all this stuff*/ 

      // no need for angleAdjustment

      this.angleAdjustment+=temp.angleAdjustment;
      if(Math.abs(temp.angleAdjustment)>.0001){
      //    console.log("a={",temp.angleAdjustment,",",this.angleAdjustment[0],"}")
        }
      
      while(this.angleAdjustment<0){
        this.angleAdjustment+=6.2831853071795864769;}
      while(this.angleAdjustment>6.2831853071795864769){
        this.angleAdjustment-=6.2831853071795864769;}

      par['angle']+=this.angleAdjustment
      this.onChanged(); // THIS WILL BE REMOVED SHORTLY; only call onChanged when the centerpoint changing triggers a transform change.
    }

    else if(this.dragging){ //we are dragging the mouse
      var apnt = this.activePoint;
      
      var type = apnt.type;
      var lastMouse = this.lastMouse;
      
      switch(type){
        
        case 0:  
          par['cx']= wpnt[0];
          par['cy']= wpnt[1];
          this.controllers['cx'].setValue(par['cx']);
          this.controllers['cy'].setValue(par['cy']);
          // triggers updatePatternData
        break;        
        // corners 
        case 1:
        case 2:
        case 3:
        case 4:
          /****** this is another place to insert a change to transform;
           * does this correctly happen in onChanged?**/
          var factor = this.getCornerFactor([par['cx'],par['cy']],lastMouse, wpnt);
          par['angle'] = this.normalizeAngle(par['angle']+(factor.angleDelta/TORADIANS));
          par['scale'] += log(factor.scaleDelta); 
          this.controllers['angle'].setValue(par['angle']);
          this.controllers['scale'].setValue(par['scale']);
          //triggers updatePatternData
        default: 
        break;
      }
      
      this.lastMouse = wpnt;
            
      evt.grabInput = true;
      return;
    } 
         
    var activePoint = this.findActivePoint(pnt, this.editPoints, 5);
    if(isDefined(activePoint)){
      this.canvas.style.cursor = 'pointer';      
    } 
  }

  //
  //  process mouseUp event 
  //
  onMouseUp(evt){
    
    this.dragging = false;

    // reset all of the textures back to the origin.

    var i = 0;


    
  }
  

  //
  //  process mouseDown event 
  //
  onMouseDown(evt){
    
    var pnt = getCanvasPnt(evt);
    
    var activePoint = this.findActivePoint(pnt, this.editPoints, 5);
    
    if(isDefined(activePoint)){
      
      this.activePoint = activePoint;      
      this.dragging = true;
      var wpnt = this.transform.transform2world(pnt);
      this.lastMouse = wpnt;
      // inform event dispatcher that we want to grab input 
      evt.grabInput = true;
      
    } else {
      
      this.activePoint = undefined;
      
    }
  }
  
  findActivePoint(pnt, points, controlSize){
    
    for(var i = 0; i < points.length; i++){
      var p = points[i];
      if(distance1(p.p, pnt) < controlSize){
        //console.log("index: %d, type: %d",p.index, p.type);        
        return p;
      } 
    }
    return undefined;
  }
  

  // calculates rotation and scale change when uses drag the corner point 
  //  c - the center of rotation
  //  p0 - initial point 
  //  p1 new point 
  getCornerFactor(c, p0, p1){
    
    var lenP0 = eDistance(c, p0);
    var lenP1 = eDistance(c, p1);
    var lenP0P1 = eDistance(p0, p1);
    var d0 = sub(p0, c);//subtract
    var d1 = sub(p1, c);//subtract
    
    // z-component of cross product of normalized vectors 
    var z = (d1[0]*d0[1] - d1[1]*d0[0])/(lenP0*lenP1);
    
    return {scaleDelta:(lenP1/lenP0),angleDelta:asin(z)};
  }
  
  //
  // bring angle into canonical range [-180,180]
  //
  normalizeAngle(a){

    while(a > 180) 
      a -= 360;
    while(a < -180) 
      a += 360;

    
    return a;
    
  }
  

} // class PatternTextures
