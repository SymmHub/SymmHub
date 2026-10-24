/**
 * lib/orbilib/modules.js
 *
 * Internal aggregator for the orbilib library.
 * All files in orbilib/ import from here; invlib and uilib are reached
 * through their public modules invlib.js and uilib.js.
 */

// ── Utilities ─────────────────────────────────────────────────────────────

export {
    PI, HPI, TPI, TORADIANS, EPSILON,
    abs, pow, log, cos, sin, sec, csc, tan, cot,
    cosh, sinh, tanh, coth, acosh, asinh, atanh, asin, atan, atan2,
    sqrt, exp, min, max, mod,
    random, sign, lerp,
    isDefined, isFunction, getParam, objectToString,
    arrayToString, iArrayToString,
} from '../invlib/invlib.js';

// ── Complex arithmetic ─────────────────────────────────────────────────────

export {
    complexN,
    cDiv, cMul, cSub, cAdd,
    cExp, cLog, cPolar, cAbs, cAbs2, cArg, conj, cPow,
} from '../invlib/invlib.js';

// ── Complex arithmetic — splanes and Moebius maps of the Poincare disk ────

export {
    sPlaneThrough,
    sPlaneSwapping,
    sPlanesOfRotation,
    poincareTurtleMove,
    poincareMobiusEdgeToEdge,
    poincareMobiusTranslateFromToByD,
    poincareMobiusRotationAboutPoint,
    sPlaneReflectAcross,
    makeMobius,
    poincarePt,
    poincareMobiusTranslateToO,
    sPlanesMovingEdge1ToEdge2,
    splaneIt,
    sPlaneThroughPerp,
    poincareMobiusFromSPlanesList,
    poincareDerivativeAt,
    transformFromCenterToPoint,
} from '../invlib/invlib.js';

// ── Inversive geometry ─────────────────────────────────────────────────────

export {
    iDistanceU4,
    iTransformU4,
    iGetFactorizationU4,
} from '../invlib/invlib.js';

export {
    iToFundDomainWBounds,
    iGetInverseTransform,
    iGetFactorizationOfSplanes,
    derivativeOfSplaneList,
    nearArcQ,
} from '../invlib/invlib.js';

// ── symbols used by OrbifoldUITool ────────────────────────────────────────

export {
    iDrawSplane,
} from '../invlib/invlib.js';

export {
    getCanvasPnt,
    SHORTEPSILON,
} from '../invlib/invlib.js';

export {
    getCopy,
    mul,
    dot,
    normalize,
} from '../invlib/invlib.js';

// ── ISplane ───────────────────────────────────────────────────────────────

export {
    iSplane,
    iPlane,
    iSphere,
    iPoint,
    SPLANE_POINT,
    SPLANE_PLANE,
    SPLANE_SPHERE,
} from '../invlib/invlib.js';

// ── Group & EventProcessor ────────────────────────────────────────────────

export {
    Group,
} from '../invlib/invlib.js';

export {
    EventProcessor,
} from '../invlib/invlib.js';

// ── Param system ──────────────────────────────────────────────────────────

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
    getParamValues,
    setParamValues,
} from '../uilib/uilib.js';

// ── orbilib internal modules ──────────────────────────────────────────────
// These are re-exported here so WallPaperGroup_General can import
// everything (including sibling modules) from a single place.

export {
    // raw group geometry functions
    keys, lengthKeys, twistKeys,
    hashOrbifoldString, countParameters,
    hashOrbifold, atomizeOrbifold, unfoldAtom,
    assembleFundamentalDomain, produceGenerators,
    willOrbifoldFitQ,
    calcCrownTransformsDataFromTransform,
    getTransformsForTexture,
    resetTransformfromPtAndTransform,
    getAngleOfTransform,
    getAngleOfTurn,
    getLength,
    getTwist,
} from './OrbifoldGeometrization.js';

export {
    nonNegHashOrbifold,
    WallpaperGroups, WallpaperGroupNames, getWallpaperGroupIndex,
    getNonnegativeGroupData,
    iWallpaperGroup,
    iGroup_Trivial, iGroup_S442, iGroup_442, iGroup_4S2,
    iGroup_S632, iGroup_632, iGroup_3S3, iGroup_S333, iGroup_333,
    iGroup_S2222, iGroup_2222_, iGroup_2222, iGroup_2S22, iGroup_22S,
    iGroup_SS, iGroup_SX, iGroup_22X, iGroup_XX, iGroup_O,
    iGroup_SN, iGroup_N, iGroup_SNN, iGroup_NN, iGroup_NX,
    iGroup_NS, iGroup_S22N, iGroup_22N, iGroup_2SN,
    iGroup_S532, iGroup_532, iGroup_S432, iGroup_432,
    iGroup_S332, iGroup_332, iGroup_3S2,
} from './WallpaperGroups_NonNegative.js';

export {
    WallPaperGroup_General,
    TWISTMAXVALUE,
    TWISTMINVALUE,
    LENGTHMAXVALUE,
    LENGTHMINVALUE,
} from './WallPaperGroup_General.js';

export {
    OrbifoldUITool,
} from './OrbifoldUITool.js';
