
export {
  
  isDefined,
  isFunction,
  getParam,
  setParamsIfDefined,
  setControllersValues,
  inspectProperties,
  addLineNumbers,
  arrayEqualArray,
  arrayInArray,
  arrayReverse,
  objectToString,
  arrayToString,
  iArrayToString,
  splanesToString,
  transformToString,
  // math shortcuts 
  PI,
  TPI,
  HPI,
  TORADIANS,
  EPSILON,
  INFINITY,
  SHORTEPSILON,
  SHORTEREPSILON,

  // for convenience; could convert to, say, Stampfli's Fast methods

  pow,
  log,
  cos,
  sin,
  sec,csc,tan,cot,cosh,
  tanh,acosh,asin,
  atan,
  atan2,
  asinh,
  atanh,
  sinh,
  coth,
  abs,
  sqrt,
  exp,
  min,
  max,
  mod,
  random,
  sign,

  lerp,  

  //color utilities 

  hexToRGBA,
  premultColor,
  
  writeToJSON,
  writeCanvasToFile,
  writeBlobToFile,
  
  
} from './Utilities.js';

export {
  isEpsilonEqualU4,
  H4toU4,
  U4toH4,
  iReflectH4,  
  iReflectU4,
  iDistanceU4,  
  iPackDomain,
  iPackRefCount,
  iPackTransforms,
  iLerpU4,
} from './Inversive.js';

export {
  AnimationControl 
} from './AnimationControl.js';


export {
  distance1,
  eDistance,
  add, 
  addSet, 
  mulSet,
  sub,
  subSet,
  mul,
  dot,
  cross, 
  copy, 
  combineV, 
  lerpV, 
  getCopy, 
  normalize,
  orthogonalize, 
  eLength,
  eLengthSquared,
} from './LinearAlgebra.js';


export {
  getCSSColor,
  CSSColors,
} from './CSSColors.js';

export {
  loadJS,
  loadScripts
} from './LoadJS.js';


export {
  Globals,
} from './Globals.js';


export {
  IdentityWorldTransform,
} from './IdentityWorldTransform.js';

export {
  complexN,
  cDiv,
} from './ComplexArithmetic.js';


export {
  ObjectId
} from './ObjectId.js';

export {
  ITransform
} from './ITransform.js'

export {
  splaneToString,
  SPLANE_PLANE,
  SPLANE_SPHERE,
  iPlane,
  iSphere,
  iPoint,
} from './ISplane.js';

export {
  PlaneNavigator
} from './PlaneNavigator.js';

export {
  CanvasTransform
} from './CanvasTransform.js';

export {
  Group
} from './Group.js';

export {
  GroupUtils
} from './GroupUtils.js';

export {
  SpatialHashMap
} from './SpatialHashMap.js';

export {
  iSplane
} from './ISplane.js';

export {
  U4
} from './U4.js';

export {
  iDrawSplane
} from './IDrawing.js';

export {
  EventProcessor, 
} from './EventProcessor.js';

export {
    PatternTextures,
    TextureManager,
    TEX_CAMERA,
} from './PatternTextures.js';

import * as TW from '../extlib/twgl-full.module.js';
export {TW}

export {
    ParamChoice,
    ParamInt, 
    ParamBool, 
    ParamFloat, 
    ParamFunc,
    ParamGroup, 
    ParamObj,
    ParamColor,
    ParamString,
    ParamCustom,
    createParamUI,
    getParamValues,
    setParamValues,
    updateParamsDisplay,
} from '../uilib/modules.js';