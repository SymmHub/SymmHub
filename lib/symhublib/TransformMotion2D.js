import {
  getParam,
  TORADIANS,
  cos,
  sin,
  isDefined, 
  } from './modules.js'; 

/**
  class to handle 2D motion transformation from one system into another 
  it supports scale, rotations, translation 
  
  transform 
  
  p = rot(angle, q)*scale + center 
  
  invTransform 
 
  q = rot(-angle, ((p-center) /scale))
  
  angle is given in radians 
  
*/
export class TransformMotion2D {
  
  // default transform values 
  // {scale:0, angle:0, center:[0,0]}
	constructor(tranParams){
        
    if(!isDefined(tranParams)){
      tranParams = {scale:0, angle:0, center:[0,0]};
    } 
    
    this.setParams(tranParams);
    
  }
  
  
  setParams(tranParams){
    //
    //
    let tp = {};
    tp.scale = getParam(tranParams.scale, 1);
    tp.center = getParam(tranParams.center, [0,0]);
    tp.angle = getParam(tranParams.angle, 0);
    
    this.tranParams = tp;    
  }
  //
  //  convert from box to world
  //
  transform(bpnt, wpnt){
    
    let x = bpnt[0];
    let y = bpnt[1];
    
    let tp = this.tranParams;
    
    
		var angle = -tp.angle;
    var s = tp.scale;
    

    let sa = sin(angle);
    let ca = cos(angle);
    
    x -= tp.center[0];
    y -= tp.center[1];
    
    let tx = s*(ca*x + sa*y);
    let ty = s*(-sa*x + ca*y);
    
    outp[0] = tx;
    outp[1] = ty;
    
  }

  //
  //  convert from world to box
  //
  invTransform(wpnt,  bpnt){
    
    let x = wpnt[0];
    let y = wpnt[1];
    let tp = this.tranParams;
    //console.log('tp:', tp);
		var angle = tp.angle;
    var s = 1./tp.scale;
    
    let sa = sin(angle);
    let ca = cos(angle);
    let wx = s*(ca*x + sa*y) + tp.center[0];
    let wy = s*(-sa*x + ca*y) + tp.center[1];
    
    bpnt[0] = wx;
    bpnt[1] = wy;

  }
  
} //class TransformMotion2D
