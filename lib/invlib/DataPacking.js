import {
  max, 
  isDefined,
  iSplane, 
  splaneToString,
  Group, 
  ITransform,
} from './modules.js';


const DEBUG = false;

const TRANSFORM_HEADER_SIZE = 1;

const REF_DATA_SIZE = 5;  // packed data size of single reflection: [ref[0],...,ref[3],type]


/**
  write single float number into vec4 
*/
function writeNumberToFloat32Array(array, offset, value){ 
  
      offset *= 4;
      array[offset] = value;
      array[offset+1] = 0;
      array[offset+2] = 0;
      array[offset+3] = 0;      
      
}


function writeSplanesToFloat32Array(data, offset, splanes){
  
  writeNumberToFloat32Array(data, offset, splanes.length);
  offset++;
  for(let i = 0; i < splanes.length; i++){
    writeSplaneToFloat32Array(data,offset + 2*i, splanes[i]);      
  }
}

/**
  write array of splanes into two vec4 at the given offset 
*/
function float32ArrayToString(data){
  
  let s = "";
  for(let i = 0; i < data.length; i+=4){   
    s += data[i] + ' ' + data[i+1] + ' ' + data[i+2] + ' ' + data[i+3] + '\n';    
  }
  return s;
}

/**
  write splane into two vec4 at the given offset 
*/
function writeSplaneToFloat32Array(array, offset, splane){
    if(!(splane instanceof iSplane)){
        console.error(`param @splane should be iSplane but got:`, splane)
        throw new Error('wrong @splane parameter');
    }
    
    offset *= 4;
    array[offset++] = splane.v[0];
    array[offset++] = splane.v[1];
    array[offset++] = splane.v[2];
    array[offset++] = splane.v[3];
    array[offset++] = splane.type;
    array[offset++] = 0;
    array[offset++] = 0;
    array[offset++] = 0; 

}

function getValue(data, offset=0, component=0){  
  return data[offset*4 + component]
}

function get4Value(data, offset=0){  

  let off = offset*4;
  return [data[off],data[off+1],data[off+2],data[off+3]];
  
}

function getSplane(data, offset){
  
  let sdata = get4Value(data, offset);
  let type = getValue(data, offset + 1);  
  //console.log('stype:' + type);
  return new iSplane({v:sdata, type:type});
    
}

/**
  converts encoded group data into human readable string 
  
*/
function groupDataToString(groupData){
  
  let domainOffset = getValue(groupData, 0);
  let transformsOffset = getValue(groupData, 1);
  let domainSize = (domainOffset != 0) ? getValue(groupData, domainOffset): 0;
  let domainSplanesOffset = domainOffset+1;
  let transformsCount = getValue(groupData, transformsOffset);
  
  let str = '{\n';
  str += 'domainOffset:' + domainOffset + ',\n';
  str += 'transformsOffset:' + transformsOffset + ',\n';
  str += 'domainSize:' + domainSize + ',\n';
  str += 'transformsCount:' + transformsCount + ',\n';
  str += 'domain:[\n';
  
  for(let k = 0; k < domainSize; k++){
    
    str += ' ' + splaneToString(getSplane(groupData,domainSplanesOffset + k*2))+',\n';
  }
  str += '],\n';
  str += 'transforms:[\n';
  let marg = '   ';
  let marg1 = marg + '  ';
  
  for(let k = 0; k < transformsCount; k++){    
  
    str += marg + 'Transform {\n'
    let transformOffset = getValue(groupData, transformsOffset + k + 1);
    let transformSplanesOffset = transformOffset+1;
    
    str += marg1 + 'offset: ' + transformOffset + ',\n';
    let refCount = getValue(groupData, transformOffset);
    str += marg1 + 'refCount: ' + refCount + ',\n';  
    str += marg1 + 'splanes: [\n'; 
    let marg2 = marg1 + '  ';
    
    for(let r = 0; r < refCount; r++){
      
      str += marg2 + splaneToString(getSplane(groupData,transformSplanesOffset + r*2))+',\n';      
    }
    str += marg + '],\n'
    str += marg + '},\n'
  }
  str += '],\n';
  
  str += '}\n';
  
  return str;
  
}


/**
* store group data into texture 
* group is stored as an array of vec4 units 
* integer parameters are stored inside of x component, leaving yzw components unused 
* data is stored from the given offset (curretly 0) 
* header:  
* domainOffset - address where domain data is stored 
* transformsOffset - address of transform data
* domainData: 
*   domainCount - count of domain sides 
*   (splane0data, splane0type(integer)) - splane0 representaton 
*   (splane1data, splane1type(integer)) - splane1 representaton 
*   ...
* transformData: 
*   transformCount - count of transforms (may be different from domainCount 
*   transformOffset0  - adress of data to of transform0
*   transformOffset1  - adress of data to of transform1
*    .... 
* transformData0:
*    reflectionsCount0 - count of reflectins in the tranasform0
*    (splane0data, splane0type(integer)) - splane0 representaton for transform0 
*    (splane1data, splane1type(integer)) - splane1 representaton for transform0 
*     ...........
* transformData1:
*    reflectionsCount1 - count of reflectins in the tranasform1
*    (splane0data, splane0type(integer)) - splane0 representaton for transform1 
*    (splane1data, splane1type(integer)) - splane1 representaton for transform1 
*     ...........
* 
*/
function packGroupToSampler(gl, sampler, group){
  
  if(DEBUG)console.log('packGroupToSampler()');
          
  var fd, trans; 

  if(group instanceof Group) {    
  
    // new data style 
    fd = group.getFundDomain();
    trans = group.getReverseTransforms();    
    
  } else {            
  
    // old style (or special case 
    fd = group.s; 
    trans = group.t;
    if(isDefined(trans) && (trans[0] instanceof ITransform))
      trans = trans.map(e => e.getRef());// convert array of ITransform to raw array of splanes 

  }
    
  var groupOffset = 0; // location of the group data 
  
  var groupHeaderSize = 2; // two numbers 
  var domainDataSize = (isDefined(fd)) ? ( fd.length*2 + 1): 0;    
  var transformDataSize = (isDefined(trans)) ? getTransformsBufferSize(trans): 0;
  
  if(DEBUG)console.log("domainDataSize:",domainDataSize);
  if(DEBUG)console.log("transformsDataSize:",transformDataSize);
  
  // allocate array 4 floats for each vec4 
  var data = new Float32Array(4*(groupHeaderSize + domainDataSize + transformDataSize));
  
  let headerOffset = groupOffset;
  let domainOffset = (domainDataSize != 0) ? groupHeaderSize: 0; 
  let transformsOffset = groupHeaderSize + domainDataSize;
  // write location of domain data and transforms data 
  writeNumberToFloat32Array(data, headerOffset, domainOffset);
  writeNumberToFloat32Array(data, headerOffset+1, transformsOffset);
  if(isDefined(fd)){
    // write domain data 
    writeSplanesToFloat32Array(data,domainOffset, fd);
  } 
    
  // write transforms data 
  if(isDefined(trans)){
    // write transforms count 
    writeNumberToFloat32Array(data, transformsOffset, trans.length);
    const transformsOffsets = transformsOffset+1;
    let currentTransformOffset = transformsOffsets + trans.length;
    for(let i = 0; i < trans.length; i++){
      // write offset for each transform 
      let currentTransform = trans[i];
      // write location of current transform 
      writeNumberToFloat32Array(data, transformsOffsets + i, currentTransformOffset);      
      // write the transform 
      writeSplanesToFloat32Array(data,currentTransformOffset, currentTransform);            
      currentTransformOffset += 2*currentTransform.length+TRANSFORM_HEADER_SIZE;      
      
    }
  }   
  if(DEBUG)console.log("packed group data:\n",groupDataToString(data));  
  gl.bindTexture(gl.TEXTURE_2D, sampler);  
  const level = 0;
  const internalFormat = gl.RGBA32F; 
  const width = data.length/4;
  const height = 1;
  const border = 0;
  const format = gl.RGBA; 
  const type = gl.FLOAT;
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,format, type, data);  
  
} // function packGroupToSampler(gl, sampler, group)


  /**
    calculate vec4 buffer size needed to store array of transforms 
    
  */
function getTransformsBufferSize(trans){
    
  // transforms header size
  let size = 1 + trans.length;
  for(let i = 0; i < trans.length; i++){
    // each transform is array of splanes 
    // one unit to store splanes count 
    // and 2 units per each splane 
    size += TRANSFORM_HEADER_SIZE + 2*trans[i].length;
  }
  return size;
  
}

function createGroupDataSampler(gl){
    
  return createDataTexture(gl);
  
}

function createDataTexture(gl){
    
  const alignment = 1;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);

  const sampler = gl.createTexture();
  
  gl.bindTexture(gl.TEXTURE_2D, sampler);  
  // turn off filtering 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);                  
  
  return sampler;
  
}

/**
  convert ITransform[] into SPlanes[][]
*/
function itrans2array(itransforms){
  
  if(DEBUG)console.log('itransforms2array()');
  let trans = [];
  
  itransforms.forEach(element => trans.push(element.getRef()));
  return trans;
  
}

/**
  routines for data packing into raw arrays 
*/
function getMaxRefCount(transforms){
  
  var maxRefCount = 0;
  for(var i = 0; i < transforms.length; i++){
    maxRefCount = max(maxRefCount,transforms[i].length);
  }
  return maxRefCount;
}


//
// pack single pairing transform into float array 
//
function cumPackTransform(f, start, trans, maxRefCount){
  
  for(var i = 0; i < trans.length; i++){
    var ind = start + i*REF_DATA_SIZE; 
    packReflection(f, ind, trans[i]);
  }
  
}

//
// pack single pairing transform into float array 
// adds zeros at the end if necessary 
//
function packTransform(f, start, trans, maxRefCount){
  
  if(trans.length > maxRefCount) {
    console.error('trans.length > maxRefCount: ' + trans.length + ' > ' + maxRefCount);
  }
  for(var i = 0; i < maxRefCount; i++){
    
    var ind = start + i*REF_DATA_SIZE;
    if(i < trans.length){
      // pack real transform 
      packReflection(f, ind, trans[i]);
    } else {
      fillArray(f, ind, REF_DATA_SIZE, 0.0);      
    }
  }
  
}

//
//  fill array f from start with given count values 
//
function fillArray(f, start, count, value){
  var end = start + count;
  for(var i = start; i < end; i++){
    f[i] = value;
  }
}

//
// pack reflection ref into float array beginning from start
//
function packReflection(array, start, ref){
  
    if(!isDefined(ref))
      return;
    var len = ref.v.length;
    for(var k = 0; k < len; k++){
      array[start + k] = ref.v[k];
    }
    array[start + len] = ref.type;    
  
}

//
//  return group fundamental domain packed into float[] 
//
function packDomain(domain, maxCount){
  
  
  //var domain = group.s;  
  // packed domain 
  var f = [];
  if(maxCount < domain.length){
    console.error('domain.length > maxCount (' + domain.length + ',' + maxCount + ')');
    return f;
  }
  for(var i = 0; i < maxCount; i++){
    var ind = REF_DATA_SIZE*i;
    if(i < domain.length)
      packReflection(f,ind, domain[i]);
    else 
      fillArray(f, ind,REF_DATA_SIZE, 0.0);
  }
  return f;
}


//
//  return count of reflections in group pairing transforms in array int[]
//

function packRefCount(trans, maxCount){
  
  //var trans = group.t;
  // packed count
  var count = [];

  for(var i = 0; i < trans.length; i++){
    count[i] = trans[i].length;
  }
  // fill the rest with 0 
  for(var i = trans.length; i < maxCount; i++){
      count[i] = 0;
  }
  return count;
}

//  For the purpose of transfer to GPU each transform is padded at the end by identity transforms up to maxRefCount
//  and the whole array is padded by identity transforms the end by 0.0s up to maxTransCount
//

function packTransforms(trans, maxTransCount, maxRefCount){
  
  //var trans = group.t;
  var f = [];
  // packed count
  for(var i = 0; i < maxTransCount; i++){
    var ind = i*maxRefCount*REF_DATA_SIZE;
    if( i < trans.length){
      packTransform(f,ind, trans[i], maxRefCount);
    } else {
      fillArray(f, ind, REF_DATA_SIZE * maxRefCount, 0.0);
    }    
  }
  return f;
}





/**
 return count of reflections in group pairing transforms in array int[]
 handle both cases 
  1) transform is array of arrays of splanes
  2) transform is array of splanes 
*/
function packRefCumulativeCount(trans, maxCount){
  
  //var trans = group.t;
  // packed count
  var count = [];
  
  count[0] = ((trans[0] instanceof Array)? trans[0].length: 1);

  for(var i = 1; i < trans.length; i++){
    
    count[i] = count[i-1] + ((trans[i] instanceof Array) ? trans[i].length : 1);
  }
  // fill the rest with 0 
  for(var i = trans.length; i < maxCount; i++){
      count[i] = 0;
  }
  return count;
}

//
//  return group transforms packed into flat array float[] 
//  each transform is represented by sequence of reflections 
//

//  The individual transforms are not padded; instead, the indices are kept in iCumCount
//  and the whole array is padded by identity transforms the end by 0.0s up to maxRefCount
//  (Note that maxRefCount is now the total number of allowed reflections across all transforms)
//

function cumPackTransforms(trans, maxTransCount, maxRefCount){
  
  //var trans = group.t;
  var f = [];
  var cumIndex=0;
  // packed count
  for(var i = 0; i < trans.length; i++){
    var ind = cumIndex*REF_DATA_SIZE; 
    var trn = trans[i];
    if(!(trn instanceof Array)){
      // convert into array 
      trn = [trn];
    }
    cumIndex+=trn.length;
    cumPackTransform(f,ind, trn, trn.length);
  }    
  fillArray(f, REF_DATA_SIZE *cumIndex, REF_DATA_SIZE * (maxRefCount-cumIndex), 0.0);
  return f;
}



export var DataPacking = {
  
  createDataTexture:           createDataTexture,
  createGroupDataSampler:      createGroupDataSampler,
  getTransformsBufferSize:     getTransformsBufferSize,
  writeNumberToFloat32Array:   writeNumberToFloat32Array,
  writeSplanesToFloat32Array:  writeSplanesToFloat32Array,
  float32ArrayToString:        float32ArrayToString,
  packGroupToSampler:          packGroupToSampler,
  writeSplaneToFloat32Array:   writeSplaneToFloat32Array,
  
  itrans2array:               itrans2array,

  getMaxRefCount:              getMaxRefCount,
  packTransform:               packTransform,
  packTransforms:              packTransforms,  
  packRefCount:                packRefCount,
  packDomain:                  packDomain,
  
  cumPackTransform:            cumPackTransform,
  cumPackTransforms:           cumPackTransforms,
  packRefCumulativeCount:      packRefCumulativeCount,
  groupDataToString:           groupDataToString,
};
