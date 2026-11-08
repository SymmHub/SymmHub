import {
  getParam,
  TORADIANS,
  cos,
  sin,
  isDefined,
  } from './modules.js';

/**
  class to handle 2D motion transformation from one system into another
  it supports scale, rotations, translation, and the bend of a pose (PatternPose.js)
  transform (box to world)
  p = rot(angle, q/(1 - k q))*scale + center
  invTransform (world to box)
  q = rot(-angle, ((p-center) /scale)),  then  q/(1 + k q)
  angle is given in radians, the bend k as [kx, ky] (none: a similarity)
*/
export class TransformMotion2D {

  // default transform values
  // {scale:0, angle:0, center:[0,0], bend:[0,0]}
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
    tp.bend = getParam(tranParams.bend, [0, 0]);
    this.tranParams = tp;
  }

  //
  //  convert from box to world
  //
  transform(bpnt, wpnt){

    let tp = this.tranParams;
    let x = bpnt[0];
    let y = bpnt[1];
    // the bend: q/(1 - k q)
    const k = tp.bend;
    const dr = 1 - (k[0]*x - k[1]*y), di = -(k[0]*y + k[1]*x);
    const dd = dr*dr + di*di;
    const qx = (x*dr + y*di)/dd, qy = (y*dr - x*di)/dd;
    var angle = tp.angle;
    var s = tp.scale;
    let sa = sin(angle);
    let ca = cos(angle);
    wpnt[0] = s*(ca*qx - sa*qy) + tp.center[0];
    wpnt[1] = s*(sa*qx + ca*qy) + tp.center[1];

  }

  //
  //  convert from world to box
  //
  invTransform(wpnt,  bpnt){

    let tp = this.tranParams;
    let x = wpnt[0] - tp.center[0];
    let y = wpnt[1] - tp.center[1];
		var angle = tp.angle;
    var s = 1./tp.scale;
    let sa = sin(angle);
    let ca = cos(angle);
    // the similarity's inverse
    let qx = s*(ca*x + sa*y);
    let qy = s*(-sa*x + ca*y);
    // the bend's inverse: q/(1 + k q)
    const k = tp.bend;
    const dr = 1 + (k[0]*qx - k[1]*qy), di = (k[0]*qy + k[1]*qx);
    const dd = dr*dr + di*di;
    bpnt[0] = (qx*dr + qy*di)/dd;
    bpnt[1] = (qy*dr - qx*di)/dd;

  }

} //class TransformMotion2D
