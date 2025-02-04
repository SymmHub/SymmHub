import {
  EPSILON
} from './modules.js';

/**
  various vector functions to work with n-vectors represented as arrays 
  
*/
//
//  dot product of two arbitrary vectors 
//
export function dot(u,v){
  var d = 0;
  for(var i = 0; i < u.length; i++){
    d += u[i]*v[i];
  }
  return d;
}

//
//  cross product of two 3-vectors 
//
export function cross(u,v){
  return [u[1]*v[2] - u[2]*v[1],
      u[2]*v[0] - u[0]*v[2], 
      u[0]*v[1] - u[1]*v[0]];
}

//
// multiply in place vector u by scalar a and return result 
//
export function mulSet(u,a){

  for(var i = 0; i < u.length; i++){
    u[i] *= a;
  }
  return u;
}

//
// multiply vector u by scalar a and return result 
//
export function mul(u,a){
  
  var v = [];
  for(var i = 0; i < u.length; i++){
    v[i] = u[i]*a;
  }
  return v;
}

export function getCopy(u){
  
  var v = [];
  for(var i = 0; i < u.length; i++){
    v[i] = u[i];
  }
  return v;
}

/**
  copy v into u 
  return u
*/
export function copy(dest,src){

  for(let k = 0;  k < dest.length; k++){
    dest[k] = src[k];
  }
  return dest;
}


export function subSet(u,v){

  for(var i = 0; i < u.length; i++){
    u[i] -= v[i];
  }
  return u;
}

export function sub(u,v){
  
  var w = [];
  for(var i = 0; i < u.length; i++){
    w[i] = u[i]-v[i];
  }
  return w;
}

export function addSet(u,v){

  for(var i = 0; i < u.length; i++){
    u[i] += v[i];
  }
  return u;
}

export function add(u,v){
  
  var w = [];
  for(var i = 0; i < u.length; i++){
    w[i] = u[i]+v[i];
  }
  return w;
}

export function normalize(v){
  
  var len = Math.sqrt(dot(v,v));
  if(len == 0.) {
    console.error('attempt to normalizable vector of zero length: ', v);
    return v;
  }
  mulSet(v,1./len);
  return v;
}

/**
  makes vector v orthogoanl to vector u
  
*/
export function orthogonalize(v, u){
  
  let uv = dot(u,v);
  let uu = dot(u,u); 
  if(uu < EPSILON) {
    console.error('attempt to orthogonalize to vector of zero length: ', u);
    return v;
  }
  
  let ort = combineV(v,u,1, -uv/uu);
  
  copy(ort, v);
  return v;
  
}


//
//  return distance between points in L1 metric; 
//
export function distance1(u,v){
  var d = Math.abs(u[0]- v[0]);
  for(var i = 1; i < u.length; i++){
    d = Math.max(d, Math.abs(u[i]-v[i]));
  }
  return d;
}


//
//  return euclidean distance between two vectors 
//
export function eDistanceSquared(v1, v2){
  var n = v1.length;
  var s = 0;
  for(var i = 0; i < n; i++){
    var d = v1[i] - v2[i];
    s += d*d;
  }
  return s;
}

//
// euclidean distance between two vectors
//
export function eDistance(v1, v2){
  
  return Math.sqrt(eDistanceSquared(v1,v2));
  
}

export function eLengthSquared(v){
  
  var n = v.length;
  var s = 0;
  for(var i = 0; i < n; i++){
    var d = v[i];
    s += d*d;
  }
  return s;    
}

export function eLength(v){
    return Math.sqrt(eLengthSquared(v));
}

//
// linear interpolation of two vectors 
//
export function lerpV(v1, v2, t){
  var v = [];
    for(var i = 0; i < v1.length; i++){
        v[i] = (1-t)*v1[i] + t*v2[i];
    }  
  return v;
}

/**
  return linear combination of two vectors a*v1 + b*v2
*/
export function combineV(v1, v2, a, b){
  var v = [];
    for(var i = 0; i < v1.length; i++){
        v[i] = a*v1[i] + b*v2[i];
    }  
  return v;
}
