import {
  isDefined,
  iArrayToString,
  EPSILON,
} from './Utilities.js';


export const SPLANE_NONE = 0;   // identity transform 
export const SPLANE_SPHERE = 1; // reflection is sphere 
export const SPLANE_PLANE = 2;  // reflection in plane 
export const SPLANE_POINT  = 3;
export const SPLANE_INFINITY = 4;

const DEBUG = true;
/**
  represents splane in inversive geometry 
*/
export class iSplane {
    
  constructor(opt){
    
    this.v = (isDefined(opt.v))?opt.v:[0,0,0,1];
    this.type = (isDefined(opt.type))?opt.type:SPLANE_SPHERE;
    if(isDefined(opt.ends))
      this.ends = ends;
    if(isDefined(opt.bounds))
      this.bounds = opt.bounds; 
  }
  
  /**
    deep clone of the splane 
    */
  clone(){
    //if(DEBUG) console.log('isplane.clone(), v: ', this.v);   
    let vc = [...this.v];
    let typec = this.type;
    //if(DEBUG) console.log('    vc: ', vc, 'typec:', typec); 
    return new iSplane({v:vc, type:typec});
    
  }
  
  toStr(precision=6){
    return splaneToString(this, precision);
  }
  
  
}; // class iSplane



//
//  convert single splane to string 
//
export function splaneToString(p, precision=6){
  if(!isDefined(p)) return "[undefined]";
  
  if(!(p instanceof iSplane))
      return 'Object(' + p + ')';
  
	switch(p.type){
	  default: return "[unknown]";
	  case SPLANE_NONE: return "[none]";
	  case SPLANE_SPHERE: return 'Sphere(' + iArrayToString(p.v, precision) + ')';
	  case SPLANE_PLANE:  return 'Plane(' + iArrayToString(p.v, precision) + ')';
    case SPLANE_POINT:  return 'Point(' + iArrayToString(p.v, precision) + ')';
	  case SPLANE_INFINITY: return 'Infinity';
	}
}




// iPlane will always be normalized. This is presumed in
// iReflect and elsewhere. OR SHOULD BE. Somewhere non-normalized planes are appearing.
// if ends are defined, they are in units perp to v[0],v[1], presumed in the plane
export function iPlane(v,ends){
  var ss = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  if(ss != 1. && Math.abs(ss)>EPSILON) {
      // make unit normal if necessary 
      v[0] /= ss;
      v[1] /= ss;
      v[2] /= ss;      
  }
    
  return new iSplane({v:v, type:SPLANE_PLANE,ends:ends});

/*
  let n = normalize([v[0],v[1],v[2]]);  
  return {v: [n[0],n[1],n[2], v[3]], type:SPLANE_PLANE,ends:ends};*/
  // this doesn't normalize v[3], changing the distance to the origin.
}

// if ends, then returns angular bounds, presumed in plane
export function iSphere(v,ends){
  
  if(!ends) {
      
    return new iSplane({v:v, type:SPLANE_SPHERE});
    
  } else {
    var angles = ends.map(e=>{
                            var x = e[0]-v[0], y = e[1]-v[1];
                            return Math.atan2(y,x);
                        });
    
    var a1=-angles[0],a2=-angles[1],min,max;
    
    // the angles are - for some reason I've forgotten;
    // having to do with the way js draws things. SO again 
    // negate whenever calculating coords from them in mathworld.
    // now put into the right order; 
    if(Math.abs(a1-a2)<Math.PI){if(a1>a2){min=a1;max=a2}else{min=a2;max=a1}} 
    // this is backwards seeming because angles go clockwise but iDraw defaults to ccwise
    else{if(a1<0){min=a1;max=a2}else{min=a2;max=a1}}
    
    return new iSplane({v:v, type:SPLANE_SPHERE, bounds:[min,max]});
  }
}

export function iPoint(v){
  
  switch(v.length){
  default:
  case 4:
    return new iSplane({v:v, type:SPLANE_POINT});
  case 3:
    v.push(0.);
    return new iSplane({v:v, type:SPLANE_POINT});
  case 2:
    v.push(0.);
    v.push(0.);
    return new iSplane({v:v, type:SPLANE_POINT});
   }
}
  

