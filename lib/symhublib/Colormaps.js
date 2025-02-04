import {
  DataPacking,
  isDefined,
  ShaderFragments,
} from './modules.js';

let cold_hot_rgba = [
0.9, 0.9, 1.0,  1, 0.01, 
0.5, 0.5, 1.0,  1,  0.1, 
0.1, 0.1, 1.0,  1,  0.2, 
0.0, 0.0, 0.9,  1,  0.3, 
0.0, 0.0, 0.7,  1,  0.4, 
0.0, 0.0, 0.5,  1,  0.499, 
0.5, 0.0, 0.0,  1,  0.501, 
0.7, 0.0, 0.0,  1,  0.6, 
0.9, 0.0, 0.0,  1,  0.7, 
1.0, 0.1, 0.1,  1,  0.8, 
1.0, 0.5, 0.5,  1,  0.9, 
1.0, 0.9, 0.9,  1,  0.99, 
];

let red_blue_rgb = [
0.229,0.298,0.754,  0., 
0.406,0.537,0.934, 0.1, 
0.602,0.731,0.999, 0.2, 
0.788,0.845,0.939, 0.3, 
0.930,0.820,0.761, 0.4, 
0.967,0.657,0.537, 0.5, 
0.887,0.413,0.324, 0.6, 
0.706,0.015,0.150, 0.7,
];

let red_blue_rgba = [
0.229,0.298,0.754, 1, 0., 
0.406,0.537,0.934, 1, 0.1, 
0.602,0.731,0.999, 1, 0.2, 
0.788,0.845,0.939, 1, 0.3, 
0.930,0.820,0.761, 1, 0.4, 
0.967,0.657,0.537, 1, 0.5, 
0.887,0.413,0.324, 1, 0.6, 
0.706,0.015,0.150, 1, 0.7,
];

let red_blue2 = [
0.229,0.298,0.754,  0., 
0.229,0.298,0.754,  0.1,
 
0.406,0.537,0.934, 0.101, 
0.406,0.537,0.934, 0.2, 

0.602,0.731,0.999, 0.201, 
0.602,0.731,0.999, 0.3, 

0.788,0.845,0.939, 0.301, 
0.788,0.845,0.939, 0.4, 

0.930,0.820,0.761, 0.401, 
0.930,0.820,0.761, 0.5, 

0.967,0.657,0.537, 0.501, 
0.967,0.657,0.537, 0.6, 

0.887,0.413,0.324, 0.601, 
0.887,0.413,0.324, 0.7, 

0.706,0.015,0.150, 0.701,
0.706,0.015,0.150, 0.8,

0.606,0.015,0.150, 0.801,
0.606,0.015,0.150, 0.9,

];

let red_blue2_rgba = [
0.229,0.298,0.754, 1, 0., 
0.229,0.298,0.754, 1, 0.1,
 
0.406,0.537,0.934, 0,0.101, 
0.406,0.537,0.934, 0,0.2, 

0.602,0.731,0.999, 1,0.201, 
0.602,0.731,0.999, 1,0.3, 

0.788,0.845,0.939, 0,0.301, 
0.788,0.845,0.939, 0,0.4, 

0.930,0.820,0.761, 1,0.401, 
0.930,0.820,0.761, 1,0.5, 

0.967,0.657,0.537, 0,0.501, 
0.967,0.657,0.537, 0,0.6, 

0.887,0.413,0.324, 1,0.601, 
0.887,0.413,0.324, 1,0.7, 

0.706,0.015,0.150, 0,0.701,
0.706,0.015,0.150, 0,0.8,

0.606,0.015,0.150, 1,0.801,
0.606,0.015,0.150, 1,0.9,

];


let gradColors0 = [ 
  0, 0,0,0,   
  0, 1, 0, 0.2,   
  1, 1, 0, 0.2001,   
  1, 0, 0, 0.4,   
  1, 1, 1, 0.6];
let gradColors1 = [ 
   0, 0,0,0,              0.5, 0.5, 0.5, 0.1, 
   0.9, 0.5, 0.5,0.11,    0.9, 0.5, 0.5, 0.2, 
   0.5, 0.5, 0., 0.21,    0.5, 0.5, 0., 0.3, 
   0.5, 0.0, 0.5,0.31,    0.5, 0.0, 0.5,0.4,  
   0.0, 0.5, 0.5,0.41,    0.0, 0.5, 0.5,0.5,
   0.5, 0.5, 0.9,0.51,    0.5, 0.5, 0.9,0.6,
   0.8, 0.3, 0.8,0.61,    0.8, 0.3, 0.8,0.7, 
   0.9, 0.5, 0.9,0.71,    0.9, 0.5, 0.9,0.8, 
   0.9, 0.7, 0.7,0.81,    0.9, 0.7, 0.7,0.9, 
   0.9, 0.8, 0.8,0.91,    0.9, 0.8, 0.8,1.0, 
    
   ];
const red_green = [
      0, 0, 0.0, 0, 
      0, 1, 0, 0.2,
      1, 1, 0, 0.201,
      1, 0, 0, 0.4, 
      1, 0.9, 0.9, 0.6, 
      0.4, 0.4, 1, 0.601, 
      0, 0, 0.4, 0.8,       
      ];

const black_rgba = [
      0,   0,   0.0,    1,    0.0, 
      0,   0,   0,      1,    0.1,
      1,   1,   0,      0.0,  0.2,
      1,   1,   0,      0.0,  0.3, 
      1,   0.0, 0.0,    1.0,  0.4, 
      1.,  0.0, 0.0,    1.0,  0.5, 
      0,   1.0, 0.0,    0.0,  0.6,       
      0,   1.0, 0.0,    0.0,  0.7,       
      0,   0.0, 1.4,    1.0,  0.8,       
      0,   0.0, 1.0,    1.0,  0.9,       
      0,   0.0, 0.0,    0.0,  1.0,       
];

  
    /*
    let gradColors01 =  [ 0, 0,0,0,   0, 1, 0, 0.2,   1, 1, 0, 0.21,   0.5, 0., 0., 0.4,   1, 1, 1, 0.6];
    let gradColors2 = [ 0, 0,0,0,    1, 1, 0.5, 0.2,   0.5, 0, 0.8, 0.22,   0.9, 0.8, 1.0, 0.4,   1, 1, 1, 0.6];
                       */

let names_rgb = null;


let colormaps_rgb = {
  
  red_blue:    red_blue_rgb,
  red_blue2:   red_blue2,
  gradColors0: gradColors0,
  gradColors1: gradColors1,
  red_green:   red_green,
  
}

let back_red_rgba = [

   0,    0,    0,       0,   0, 
   0,    0,    0,       0.1,   0.05, 
   0,    0,    0,       0.2,   0.1, 
   0,    0,    0,       0.3,   0.15, 
   0,    0,    0,       0.4,   0.20, 
   0,    0,    0,       0.8,   0.25, 
   0.0,  0.0,  0.0,     0.9,   0.30, 
   0.0,  0.0,  0.0,     1,   0.35, 
   0.0,  0.0,  0.0,     1,   0.40, 
   0.0,  0.0,  0.0,     1,   0.45, 
      
   0,1,0,   1, 1.0, 
      
];

let names_rgba = null;

let colormaps_rgba = {
  
  red_blue:       toRGBA(colormaps_rgb.red_blue),
  red_blue2:      toRGBA(colormaps_rgb.red_blue2),
  cold_hot:      cold_hot_rgba,
  red_blue_rgba:  red_blue_rgba,
  red_blue2_rgba: red_blue2_rgba,
  gradColors0:    toRGBA(colormaps_rgb.gradColors0),
  gradColors1:    toRGBA(colormaps_rgb.gradColors1),
  red_green:      toRGBA(colormaps_rgb.red_green),
  black_rgba:     black_rgba,
  gray:           makeGrayRGBA(20),
  black_red:      back_red_rgba,
  
  
}

function makeGrayRGBA(count){
  
  let out = [];
  let step = 1./count;
  let dv = step/100;
  for(let i = 0; i < count; i++){
    let v0 = i*step;
    let v1 = v0 + step - dv;
    let v = v1;
    out.push(v); out.push(v);out.push(v);out.push(1);out.push(v0);
    out.push(v); out.push(v);out.push(v);out.push(1);out.push(v1);         
  }
  return out;
}

/**
  convert 3 component colormap intpo 4 component
*/
function toRGBA(cm){
  
  let out = [];
  let alpha = 1.;
  
  for(let i = 0; i < cm.length; i += 4){
    out.push(cm[i]);
    out.push(cm[i+1]);
    out.push(cm[i+2]);
    out.push(alpha);    
    out.push(cm[i+3]);
  }
  return out;
}

function cm2vec4array(cm, array){
  
  let count = cm.length/5; // 5 numbers per entry 
  
  for(let k = 0; k < count; k++){
    let inOff = k*5;
    let outOff = k*8;
    // 5 values (R,G,B,A,V) packed into two RGBA vectors 
    for(let i = 0; i < 5; i++){
      array[outOff+i] = cm[inOff+i];
    }
    // fill with zeroes 
    for(let i = 5; i < 8; i++){    
      array[outOff+i] = 0.;
    }       
  }
  return array;
}

function premult(cm){
  
  let count = cm.length/5;
  let out = [];
  for(let i = 0; i < count; i++){
    let off = i*5;
    let a =  cm[off + 3];
    out.push(cm[off]*a);
    out.push(cm[off+1]*a);
    out.push(cm[off+2]*a);
    out.push(a);
    out.push(cm[off+4]);
  }
  return out;
  
}

//
//  return texture for given colormap 
//
function getColormapTexture(gl, name){
  
  //console.log(`getColormapTexture(${name})`);
  let cm = colormaps_rgba[name];
  if(!isDefined(cm)){
    cm = colormaps_rgba.red_blue;
  }
  //console.log(`   cm: `, cm);  

  let tex = cm.tex;
  
  if(isDefined(tex)){
    // already allocated 
    return tex;
  }
  console.log('creating new colormapTexture: ', name);
  let newTex = DataPacking.createDataTexture(gl);
  let count = cm.length/5;
  
  var data = new Float32Array(4*2*count);
  cm2vec4array(premult(cm),data);
  console.log(`   data: `, data);  
  
  gl.bindTexture(gl.TEXTURE_2D, newTex);  
  const level = 0;
  const internalFormat = gl.RGBA32F; 
  const width = data.length/4;
  const height = 1;
  const border = 0;
  const format = gl.RGBA; 
  const type = gl.FLOAT;
  console.log(` colormap texture:  ${width} x ${height}`);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,format, type, data);  
  cm.tex = newTex;
  
  return newTex;
  
}

function getColormapRGB(name){
  
  let cm = colormaps_rgb[name];
  if(isDefined(cm))
    return cm;
  else 
    return colormaps_rgb.red_blue2;
  
}

function getColormapRGBA(name){
  
  let cm = colormaps_rgba[name];
  if(isDefined(cm))
    return cm;
  else 
    return colormaps_rgba.red_blue2;
  
}

function getNamesRGB(){
  if(names_rgb == null) 
    names_rgb = getKeyNames(colormaps_rgb);
  return names_rgb;
  
}

function getNamesRGBA(){
  if(names_rgba == null)
    names_rgba = getKeyNames(colormaps_rgba);
  return names_rgba;
}

function getKeyNames(obj){
  
  return Object.keys(obj);
  
}

const CMfragmentsName = 'ColormapsFragments';

const Fragments = {
    name: CMfragmentsName,
    getName:  ()=>{return CMfragmentsName;},
    
    'colormap': ShaderFragments.colormap,
    
}
const shader_cm = {obj: Fragments, id: 'colormap'}
const shaders = {
    'colormap': shader_cm
};



export const Colormaps = {
  
  // named shader fragments 
  shaders:      shaders,  
  getNames:     getNamesRGBA, 
  getColormapTexture: getColormapTexture,
  
}

//export {  Colormaps,  };
