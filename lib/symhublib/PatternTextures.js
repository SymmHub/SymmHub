export const TEX_CAMERA = '[camera]';

import {iDrawPoint, iDrawSegment} from './IDrawing.js';
import {add,sub,distance1,eDistance} from './LinearAlgebra.js';

import {cMul} from './ComplexArithmetic.js';

import {getParam,TORADIANS,cos,sin,asin,log,isDefined, isFunction} from './Utilities.js';
import * as twgl from '../libm/twgl/twgl.js';


export class TextureManager {
  
	constructor(gl){
    
    this.canvasWidth = 512;
    this.canvasHeight = 512;
    
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



/*
  pattern formed by severlay layered textures 
*/
export class PatternTextures {
		
	constructor(options){
    
    this.debug = false;
    
    this.textures = getParam(options.textures, [[{name:'red arrow', path:'../../library/images/arrow_red.png'}]]);
		this.params = {
      showUI:false
    };
    var opt = getParam(options, {});
    this.texCount = getParam(opt.texCount,this.textures.length);
    this.baseDir = getParam(opt.baseDir,'images/');
    //this.texNames = getParam(opt.texNames,[TEX_CAMERA,'arrow_red','arrow_blue','arrow_green', 'arrow_yellow','arrow_magenta','arrow_teal']);
    this.texNames = this.makeTexNames(this.textures);
    if(this.debug)console.log('this.texNames.length:%d',this.texNames.length);
    this.extension = getParam(opt.extension,'.png');
    this.editPoints = [];
    this.dragging = false;
    
	}

  /**
      return params map to save
  */
  getParamsMap(){
    
    var pm = {};
    var p = this.params;
    
    pm.showUI = p.showUI;
    
    pm.textures = [];
    for(var t = 0; t < this.textures.length; t++){
      pm.textures[t] = this.getTexParamsMap(t);
    }
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
    
    var len = Math.min(pm.textures.length, this.textures.length);
    //console.log('len:', len);
    
    for(var t = 0; t < len; t++){
      this.setTexParamsMap(t, pm.textures[t]);
    }
    
    //inspectProperties(p);
  }

  /**
    return params map for specific texture 
  */
  getTexParamsMap(index){
    
    var p = this.params;
    return {
      active: p['active' + index],
      name: p['tex' + index],
      alpha: p['alpha' + index],
      scale: p['scale' + index],
      angle: p['angle' + index],
      center: [p['cx' + index],p['cy' + index]]
    };
    
  }

  /**
    set params of specific texture from map 
  */
  setTexParamsMap(index, pm){
    
    //console.log('setTexParamsMap(',index, 'params:', pm);
    var c = this.controllers;
    
    c['active' + index].setValue(pm.active);
    c['tex' + index].setValue(pm.name);
    c['alpha' + index].setValue(pm.alpha);
    c['scale' + index].setValue(pm.scale);
    c['angle' + index].setValue(pm.angle);
    c['cx' + index].setValue(pm.center[0]);
    c['cy' + index].setValue(pm.center[1]);
    
  }
  
  
  makeTexNames(textures){
    
    var tnames = [];
    
    for(var t = 0;  t < textures.length; t++){
      let nn = []; // names for texture  t 
      tnames.push(nn);
      let tn = textures[t];
      //console.log('tnames[%d]',t);      
      for(var n = 0;  n < tn.length; n++){
          //console.log('tname:',tn[n].name);
          nn.push(tn[n].name);
      }      
    }
    return tnames;
  }

  //
  // return URL for texture tindex
  //
  getTexPath(tindex) {
    
    // currently selected name for texture t 
    let selectedName = this.params['tex'+tindex];
    
    //console.log('getTexPath(%d) ',tindex);
    //console.log('selectedName: %s ',selectedName);
    var tnames = this.texNames[tindex];
   // for(var i = 0; i < tnames.length; i++){
   //   console.log('texName[%d]: %s ',i, tnames[i]);
   // }
    
    let selectedIndex = Math.max(0,tnames.indexOf(selectedName)); 
    
    return this.textures[tindex][selectedIndex].path;
    
  }
  
  getDefines(un, timeStamp){
    
    var defines = `#define MAX_TEX_COUNT ${Math.max(2,this.texCount)}\n`;  
    
    return defines;
  }
  
	//
	//  return group description
	//
	getUniforms(un){
    
    let debug = this.debug;
    var par = this.params;
    
    var samplers = [];
    var centers = [];
    var scales = [];
    var alphas = [];
    
    var tcount = 0;
    
    var hasAnimation = false;
    
    for(var i = 0; i < this.texCount; i++) {
      
      if(par['active' + i]){
        
        var url = this.getTexPath(i);
                
        if(debug)console.log('active texture:%d %s', i, url);
        var tex = this.texManager.getTexture(url, this.onChanged);
        
        //if(debug)console.log("sampler:",samplers[tcount]);
        
				tcount++;
				var s = Math.exp(-par['scale' + i]);
				var angle = par['angle' + i]*TORADIANS;
				scales.push(s*cos(angle)); 
				scales.push(s*sin(angle)); 
				centers.push(par['cx' + i]);
				centers.push(par['cy' + i]);
				samplers.push(tex.texture);
        if(tex.isAnimation){
          hasAnimation = true;
        }          
        alphas.push(par['alpha' + i]);
        
      }
    }
    
		un.u_texCount = tcount;
		un.u_texScales = scales;
    un.u_texCenters = centers;
		un.u_textures = samplers;
		un.u_texAlphas = alphas;
    
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
    this.onChanged = options.onChanged;
    this.canvas = options.canvas;
    var onModified = this.onModified.bind(this);
    
    this.texManager = new TextureManager(this.gl);
    
    var eps = 1.e-10;
    var par = this.params;
    var texNames = this.texNames;
    this.controllers = {};
    var ctrls = this.controllers;
    
    ctrls.showUI = folder.add(par, 'showUI').onChange(onModified);	
    var texFolder = folder.addFolder('tex');
    var acFolder = folder.addFolder('active');
    var alFolder = folder.addFolder('alpha');
    var tranFolder = folder.addFolder('transform');
    var scFolder = tranFolder.addFolder('scale');
    var anFolder = tranFolder.addFolder('angle');
    var cxFolder = tranFolder.addFolder('cx');
    var cyFolder = tranFolder.addFolder('cy');
    
    var tcount = this.texCount;
    
    for(var i = 0; i < tcount; i++){
      //
      // store param names and values into single map par 
      // make separate UI folder for each texture params
      //
      var c = (i);      
      
      var uname = 'active',pname = uname + c;
      par[pname] = false;
      ctrls[pname] = acFolder.add(par, pname).name(pname).onChange(onModified);	
      
      var uname = 'tex', pname = uname + c;
      par[pname] = texNames[i][0];      
      ctrls[pname] = texFolder.add(par, pname, texNames[i]).name(pname).onChange(onModified);	

      var uname = 'alpha', pname = uname + c;
      par[pname] = 1;      
      ctrls[pname] = alFolder.add(par, pname, 0, 1,  eps).name(pname).onChange(onModified);	
      
      var uname = 'scale', pname = uname + c;
      par[pname] = 0;      
      ctrls[pname] = scFolder.add(par, pname, -6, 6,  eps).name(pname).onChange(onModified);	
      
      var uname = 'angle', pname = uname + c;
      par[pname] = 0;            
      ctrls[pname] = anFolder.add(par, pname, -360, 360,  eps).name(pname).onChange(onModified);	

      var uname = 'cx', pname = uname + c;
      par[pname] = 0;            
      ctrls[pname] = cxFolder.add(par, pname, -10, 10,  eps).name(pname).onChange(onModified);	
      
      var uname = 'cy', pname = uname + c;
      par[pname] = 0;            
      ctrls[pname] = cyFolder.add(par, pname, -10, 10,  eps).name(pname).onChange(onModified);	
      
    }
    
    //gui.remember(par);    
     
  }

  onModified(){
    //
    // start/stop texture animation here 
    //
    
    this.onChanged();
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


  render(context, transform){
    
    var par = this.params;
    if(!par.showUI)
      return;
    
    this.transform = transform;
    
    var trans = ((isFunction(transform.transform2screen))? transform.transform2screen : transform.world2screen).bind(transform);
    
    var opt = {radius:8, style:"#FFFFAA"};
    var opta = {radius:6, style:"#0000DD"};
    
    var opt1 = {radius:5, style:"#000000"};
    var opt2 = {width:1, style:"#000000", segCount:100};
    var opt1a = {radius:7, style:"#FFFFAA"};
    var opt2a = {width:3, style:"#FFFFAA", segCount:100};
    
    var editPoints = [];
    
    for(var i = 0; i < this.texCount; i++) {
      
      var texIndex = i;
      var c = (i); 
      if(par['active' + c]){
        
				var s = 0.5*Math.exp(par['scale' + c]);
				var angle = -par['angle' + c]*TORADIANS;
				var cx = par['cx' + c];
				var cy = par['cy' + c];

        var sa = sin(angle);
        var ca = cos(angle);
        var rot = [ca, sa];
        
        
        var corners = [];
        corners.push(add([cx, cy], cMul([s,s],rot)));  // corner point type 1
        corners.push(add([cx, cy], cMul([-s,s],rot))); // corner point type 2
        corners.push(add([cx, cy], cMul([-s,-s],rot)));// corner point type 3
        corners.push(add([cx, cy], cMul([s,-s],rot))); // corner point type 4
        var cpnt = [cx, cy];
                                                       
        editPoints.push({p:trans(cpnt),texIndex:texIndex, type:0}); // center point type 0
        
        iDrawPoint(cpnt, context, transform, opt);
        iDrawPoint(cpnt, context, transform, opta);
        
        for(var k = 0; k < 4; k++){
          
          iDrawPoint(corners[k], context, transform, opt1a);
          iDrawSegment(corners[k],corners[(k+1)%4], context, transform, opt2a);  
        }
        
        for(var k = 0; k < 4; k++){
          
          editPoints.push({p:trans(corners[k]),texIndex:texIndex, type:(k+1)});
          
          iDrawPoint(corners[k], context, transform, opt1);
          iDrawSegment(corners[k],corners[(k+1)%4], context, transform, opt2);
        }   
      }
    }
    this.editPoints = editPoints;
    
  }

  //
  //  handler of all UI events 
  //
  handleEvent(evt){
    
		switch(evt.type) {
		case 'mousemove':
			this.onMouseMove(evt);
		break;
		case 'mousedown':
			this.onMouseDown(evt);
		break;
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
    
    var pnt = [evt.offsetX,evt.offsetY];
    
    if(this.dragging){
      var wpnt = this.transform.transform2world(pnt);
      //this.lastMouse = wpnt;
      //console.log("drag:[%f %f]", wpnt[0],wpnt[1]);
      var apnt = this.activePoint;
      // which point? 
      var texIndex = (apnt.texIndex);
      var type = apnt.type;
      var par = this.params;
      var lastMouse = this.lastMouse;
      //console.log("texIndex: %d, type: %d",texIndex, type);
      
      switch(type){
        
        case 0:  
          // change texture center 
          par['cx' + texIndex] += (wpnt[0] - lastMouse[0]);
          par['cy' + texIndex] += (wpnt[1] - lastMouse[1]);
          this.onChanged();
        break;        
        // corners 
        case 1:
        case 2:
        case 3:
        case 4:
          var factor = this.getCornerFactor([par['cx' + texIndex],par['cy' + texIndex]],lastMouse, wpnt);
          //console.log("scaleDelta:",factor.scaleDelta);
          par['angle' + texIndex] = this.normalizeAngle(par['angle' + texIndex]+(factor.angleDelta/TORADIANS));
          par['scale' + texIndex] += log(factor.scaleDelta); 
          this.onChanged();
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
    
  }
  

  //
  //  process mouseDown event 
  //
  onMouseDown(evt){
    
    var pnt = [evt.offsetX, evt.offsetY];
    
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
  
  // calculates rotation and scale change when uses drad the corner point 
  //  c - the center of rotation 
  //  p0 - initial point 
  //  p1 new point 
  getCornerFactor(c, p0, p1){
    
    var lenP0 = eDistance(c, p0);
    var lenP1 = eDistance(c, p1);
    var lenP0P1 = eDistance(p0, p1);
    var d0 = sub(p0, c);
    var d1 = sub(p1, c);
    
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
