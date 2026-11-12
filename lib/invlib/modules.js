
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
    TODEGREE,
    normalizeAngle,
    EPSILON,
    INFINITY,
    SHORTEPSILON,
    SHORTEREPSILON,

    // for convenience; could convert to, say, Stampfli's Fast methods

    pow,
    log,
    cos,
    sin,
    sec,
    csc,
    tan,
    cot,
    cosh,
    tanh,
    acosh,
    asin,
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
    getCanvasPnt, 
}
from './Utilities.js';

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
    eDistanceSquared,
}
from './LinearAlgebra.js';

export {
    SpatialHashMap
}
from './SpatialHashMap.js';

export {
    complexN,
    cDiv,
    cMul, 
    cSub,
    cAdd,
    cBand2Disk,
    cDisk2Band,
    cExp,
    cLog,
    cPolar,
    cAbs,
    cAbs2, 
    cArg,
    conj, 
    cPow,     
    sPlaneThrough,
    sPlaneThroughPerp,
    sPlaneSwapping,
    sPlanesOfRotation,
    sPlaneReflectAcross,
    sPlanesMovingEdge1ToEdge2,
    splaneIt,
    makeMobius,
    poincarePt,
    poincareTurtleMove,
    poincareMobiusEdgeToEdge,
    poincareMobiusTranslateFromToByD,
    poincareMobiusRotationAboutPoint,
    poincareMobiusTranslateToO,
    poincareMobiusFromSPlanesList,
    poincareDerivativeAt,
    transformFromCenterToPoint,
}
from './ComplexArithmetic.js';

export {
    splaneToString,
    SPLANE_NONE,
    SPLANE_POINT,
    SPLANE_PLANE,
    SPLANE_SPHERE,
    iPlane,
    iSphere,
    iPoint,
}
from './ISplane.js';

export {
    iSplane,
    SPLANE_INFINITY,
}
from './ISplane.js';

export {
    ITransform
}
from './ITransform.js'

// planar transforms as Moebius matrices
export {
    isPlanarTransform,
    getMatrixMobius,
    mobiusDistance,
    mobiusToSplanes,
    classifyMobiusU4,
    MOBIUS_PRECISION,
}
from './MobiusMatrix.js';

// the factorization of a transform in the U4 representation throughout (2026-11-11)
export {
    iReflectSplaneU4,
    iTransformSplaneU4,
    iBisectorU4,
    iFactorizeU4,
}
from './FactorizationU4.js';

// the motions of the plane, the hyperbolic plane and the sphere as Möbius maps (2026-11-08)
export {
    mobiusIdentity,
    mobiusCompose,
    mobiusInverse,
    mobiusApply,
    mobiusDerivative,
    mobiusPointMap,
    modelMap,
    chartTo,
    canonicalChart,
    moveTo,
    anchorPlace,
    anchoredMoveTo,
    translationTo,
    rotationAbout,
    similarityAbout,
    reflectionAbout,
    affineAbout,
    geodesicDistance,
    density,
    transformedGeometry,
    clampToModel,
}
from './GeometryMotions.js';

// the segments of the plane, the hyperbolic plane and the sphere as arcs (2026-11-09)
export {
    geodesicLift,
    geodesicUnlift,
    geodesicMidpoint,
    geodesicArc,
    arcPoint,
    arcCubics,
    geodesicCubics,
    geodesicRayPoint,
    geodesicCurvePoint,
    geodesicCurveCubics,
    geodesicCurveSplit,
    curveCubics,
}
from './Geodesics.js';

export {
    isEpsilonEqualU4,
    H4toU4,
    H4toU4Point,
    U4toH4,
    iReflect,
    iReflectH4,
    iReflectU4,
    iDistanceU4,
    iPackDomain,
    iPackRefCount,
    iPackTransforms,
    iLerpU4,
    iGetFixedPoints,
    getInversiveRotation,
    iGetFactorizationU4,
    iInverseTransformU4,
    iTransformU4,
    iTransformH4,
    iDifferenceU4,
    iGetBisectorU4, 
    iGetBisectorH4, 
    isProperReflection,
    nearArcQ,
    iMakeDefaultGenNames,
    iGetMaxRefCount,
    iCumPackTransforms,
    iMakeDefaultTransforms,
    iPackRefCumulativeCount,
    iToFundDomainWBounds,
    iGetInverseTransform,
    iGetFactorizationOfSplanes,
    derivativeOfSplaneList,
    iGetInverseTransforms,
    iParseGenerators,
    iMakeTransformedPoints,
    iMakeBisectors,
    iGetGenNames,
}
from './Inversive.js';

export {
    AnimationControl
}
from './AnimationControl.js';


export {
    getCSSColor,
    CSSColors,
}
from './CSSColors.js';

export {
    Globals,
}
from './Globals.js';

export {
    IdentityWorldTransform,
}
from './IdentityWorldTransform.js';


export {
    ObjectId
}
from './ObjectId.js';


export {
    PlaneNavigator
}
from './PlaneNavigator.js';

export {
    CanvasTransform
}
from './CanvasTransform.js';

export {
    Group
}
from './Group.js';

export {
    GroupUtils
}
from './GroupUtils.js';


export {
    U4
}
from './U4.js';

export {
    iDrawSplane,
    iViewSplane,
    iDrawCircle, 
    iDrawPoint,
    iDrawSegment,
    iDrawLargeCircle,
}
from './IDrawing.js';

export {
    EventProcessor,
}
from './EventProcessor.js';

export {
    FilesLoader,
} from './FilesLoader.js';

/*export {
    PatternTextures,
    TextureManager,
    TEX_CAMERA,
}
from './PatternTextures.js';

/*export {
    GroupRenderer
}
from './GroupRenderer.js'
*/

import * as TW from '../extlib/twgl-full.module.js';
export {
    TW
}

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
    updateParamDisplay,
    loadJS, 
}
from '../uilib/uilib.js';
