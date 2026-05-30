export {
  Textures 
} from './Textures.js';

export {
     WallPaperGroup_General
} from '../../../lib/orbilib/orbilib.js';

export {
     SymmetryUIController
} from './SymmetryUIController.js';


export {
    iPlane, 
    iSphere,
    iPoint,
    sin,
    cos, 
    sqrt, 
    PI,
    FileLoader,   
    FilesLoader, 
    AnimationControl,
    getParam, 
    isDefined, 
    isFunction, 
    lerp, 
    writeCanvasToFile, 
    writeToJSON, 
    hexToRGBA,
    premultColor, 
    addLineNumbers, 
    abs, 
    add, 
    mul, 
    sub,
    eLength,

    cBand2Disk, 
    cDisk2Band, 
    cDiv, 
    cExp, 
    cLog, 
    eDistanceSquared, 
    iGetFactorizationU4,
    iInverseTransformU4,  
    iPackTransforms,
    iReflectU4,
    iTransformU4,
    GroupUtils,
    iDrawSplane,
    getCanvasPnt, 
    iDifferenceU4,
    iGetBisectorU4, 
    iGetBisectorH4, 
    isProperReflection,

    //CanvasTransform,    // to use with InversiveNavigator_v0
} from '../../../lib/invlib/invlib.js';

export{
    TEX_CAMERA,
   PatternTextures, 
} from './PatternTextures.js';

export {
    DefaultDomainBuilder
}
from './DefaultDomainBuilder.js';


export {
    buildProgramsCached,
    getWebGLContext,
    CanvasTransform, // to use with InversiveNavigator_v1
    InversiveNavigator, 
    createDoubleFBO,
    createFBO
} from '../../../lib/symhublib/symhublib.js';

export {
    GroupRenderer,
} from './GroupRenderer.js';

export {
    createInternalWindow, 
    resizeCanvas,
    getPixelRatio,
    ParamFloat,
    ParamFunc,
    ParamBool,
    ParamChoice,
    ParamString,
    createParamUI,
    setParamValues,
    getParamValues,
    
} from '../../../lib/uilib/modules.js'

export {
    createLayeredCanvas
} from './ui_utils.js';     
export {
    GUI 
} from '../../../lib/datgui/datgui.js';

import * as twgl from '../../../lib/extlib/twgl-full.module.js';

export {
    twgl
}

// ── Extra Utilities (not re-exported by invlib.js) ────────────────────────
export {
    objectToString,
    transformToString,
    sign,
    SHORTEPSILON,
    TORADIANS,
    asin,
    log,
} from '../../../lib/invlib/Utilities.js';

// ── Extra Inversive symbols ───────────────────────────────────────────────
export {
    nearArcQ,
    iMakeDefaultGenNames,
    iGetMaxRefCount,
    iPackDomain,
    iPackRefCount,
    iCumPackTransforms,
    iMakeDefaultTransforms,
    iPackRefCumulativeCount,
} from '../../../lib/invlib/Inversive.js';

// ── Extra IDrawing symbols ────────────────────────────────────────────────
export {
    iDrawLargeCircle,
    iDrawPoint,
    iDrawSegment,
} from '../../../lib/invlib/IDrawing.js';

// ── ISplane ───────────────────────────────────────────────────────────────
export {
    iSplane,
    splaneToString,
    SPLANE_POINT,
    SPLANE_PLANE,
    SPLANE_SPHERE,
} from '../../../lib/invlib/ISplane.js';

// ── Extra LinearAlgebra symbols ───────────────────────────────────────────
export {
    getCopy,
    distance1,
    eDistance,
} from '../../../lib/invlib/LinearAlgebra.js';

// ── Extra ComplexArithmetic symbols ──────────────────────────────────────
export {
    sPlaneThroughPerp,
    sPlaneSwapping,
    complexN,
    cMul,
    poincareMobiusTranslateFromToByD,
    sPlanesMovingEdge1ToEdge2,
    poincareMobiusFromSPlanesList,
    transformFromCenterToPoint,
} from '../../../lib/invlib/ComplexArithmetic.js';

// ── orbilib — WallPaperGroup_General constants & keys ────────────────────
export {
    TWISTMAXVALUE, TWISTMINVALUE,
    LENGTHMAXVALUE, LENGTHMINVALUE,
    lengthKeys, twistKeys,
} from '../../../lib/orbilib/orbilib.js';