export {
    normalize,
    dot, 
    mul, 
    abs,
    sin,
    cos,
    atan2, 
    sqrt,
    PI,
    getParam,
    isDefined, 
    iPlane,
    TORADIANS,
    EventProcessor,
    iReflectU4,
    iSphere,
    Group, 
    splaneToString,
    objectToString, 
    iLerpU4,  
    iGetBisectorU4,
    iTransformU4,
    iTransformH4,
    U4toH4,
    H4toU4,
    iGetFixedPoints,
    getInversiveRotation,
    iPoint,
    iDistanceU4,
    iGetFactorizationU4,
    GroupUtils,
    SPLANE_SPHERE,
    SPLANE_PLANE,
    iSplane,
    isPlanarTransform,
    getMatrixMobius,
    mobiusDistance,
    mobiusToSplanes,
    cMul,
    cDiv,
    cAdd,
    cSub,
    cAbs,
} from '../invlib/invlib.js';

export {
    getQuadDomain,
    getAngle,
    getRollingSplaneParams,
    getRollingSplane,
    chainOfOrthogonalCircles,
    toPoincareDisk,
} from './group_utils.js';


export {
  Group_WP
} from './Group_WP.js';


export {
  Group_Frieze
} from './Group_Frieze.js';

export {
  Group_Spherical
} from './Group_Spherical.js';


export {
  Group_KLM,
  makeSphericalTriangle,
  makeEuclideanTriangle,
  makeHyperbolicTriangle,  
} from './Group_KLM.js';

export {
  Group_KLMN
} from './Group_KLMN.js';

export {
  Group_KLx
} from './Group_KLx.js';

export {
  Group_5splanes
} from './Group_5splanes.js';

export {
  Group_6splanes
} from './Group_6splanes.js';

// groups imported from the Orb repo (2026-10-26)
export {
  Group_Cyclic
} from './Group_Cyclic.js';

export {
  Group_ON
} from './Group_ON.js';

export {
  Group_s22222
} from './Group_s22222.js';

export {
  Group_22222
} from './Group_22222.js';

export {
  Group_s222222
} from './Group_s222222.js';

// groups given by Möbius matrices (Indra's Pearls): the helpers, then the makers
export {
  csqrt,
  mmul,
  minverse,
  mtrace,
  mdet,
  mobius,
  wordMatrix,
  isometricCircle,
  generatorSide,
  carrierGroup,
  dirichletDomain,
} from './MobiusGenerators.js';

// the two-generator groups of Grandma's recipe (Indra's Pearls), 2026-11-04
export {
  Group_Grandma
} from './Group_Grandma.js';

// Maskit's groups of the twice punctured torus (Indra's Pearls p. 367), 2026-11-05
export {
  Group_Maskit2
} from './Group_Maskit2.js';

// the Dirichlet domain of a group as an operation on the group (from the Orb repo, 2026-10-26)
export {
  DEFAULT_FOLD_ITERATIONS,
  parseWords,
  wordsToString,
  expandWord,
  compactWord,
  wordAlphabet,
  inverseWord,
  normalizeWord,
  sameAction,
  involutionLetters,
  reduceWord,
  isValidWord,
  dirichletBase,
  dirichletImage,
  dirichletSide,
  makeDirichletGroup,
  dirichletSourceWord,
  dirichletImages,
  dirichletCellAt,
  dirichletCell,
  sideCutsCell,
  sideArcPoint,
  sideArcContains,
  selectDirichletSides,
  checkDirichletDomain,
} from './DirichletDomain.js';

// the automatic sides in a worker (DirichletWorker.js), with a time limit
export {
  DEFAULT_SEARCH_SECONDS,
  groupToData,
  groupFromData,
  startDirichletSearch,
  prepareDirichletSearch,
} from './DirichletSearch.js';

export {
    ParamChoice,
    ParamFloat, 
    ParamInt,
    ParamGroup, 
    ParamObj,
    ParamFunc,
    ParamBool,
    getParamValues,
    setParamValues,
    createParamUI,
    ObjectFactory, 
} from '../uilib/uilib.js';

export {
  iWallpaperGroup,
  WallpaperGroupNames,
  WallpaperDomainShapes,
  DEFAULT_DOMAIN_SHAPE,
  getWallpaperDomainShapes,
  resolveWallpaperDomainShape,
} from './WallpaperGroups.js';

export {
    splaneIntersections,
    findConvexTransversal,
    isUnionConvex,
} from './SubgroupConvex.js';

// subgroup domains and the symmetry elements of generators, for the overlays
export {
    buildSubgroupDomain,
    packSubgroupDomainToSampler,
    subgroupDomainTable,
    sameTransform,
} from './SubgroupDomain.js';

export {
  groupPresentation,
  derivedPresentation,
  domainCorners,
} from './GroupPresentation.js';

export {
    GroupMakerFactory
} from './GroupMakerFactory.js';

// color symmetry: the subgroup chooser and the color permutations of words
export {
    ParamString,
    ParamMenu,
    openFile,
    createPromptDialog,
    writeClipboardText,
} from '../uilib/uilib.js';

export {
    subgroupsData,
    getPreset,
    makePresentation,
    findByPermutations,
    klmPresentation,
    sklmPresentation,
} from '../sublib/src/sublib.js';

export {
    computeFrame,
    subgroupKey,
    subgroupClassKey,
    wallpaperTypeOfKey,
} from './SubgroupKey.js';

export {
    makeSubgroupNamer,
    compareSubgroupNames,
} from './SubgroupNames.js';

export {
    composePerms,
    invertPerm,
    wordToPerm,
    sidePermutations,
    strToPermutations,
} from './Permutations.js';

// the table of subgroups from a presentation, for the colour layers and the overlays
export {
    DEFAULT_MAX_INDEX,
    MAX_MAX_INDEX,
    TABLE_MAX_SUBGROUPS,
    TABLE_DEADLINE_MS,
    clampMaxIndex,
    presentationSpec,
    presentationKey,
    presentationText,
    tableRequest,
    subgroupTable,
    tableUpTo,
    tableHidden,
    restoreHidden,
    checkPermutations,
    entryPermutations,
} from './SubgroupTable.js';

export {
    makeNameJobs,
} from './SubgroupNameJobs.js';

export {
    MAX_CACHED_TABLES,
    NO_TABLE,
    makeGroupTables,
} from './SubgroupTables.js';

export {
    Subgroups
} from './Subgroups.js';


export {
    generatorElements,
    subgroupGeneratorElements,
    packGeneratorElementsToSampler,
    domainPolygon,
} from './GeneratorElements.js';

// a sample of the limit set of a Kleinian group (2026-11-08)
export {
    limitSetSample,
    clearLimitSetSample,
} from './LimitSet.js';

// the geometry of a group read off the sides of its domain, and the local geometry of a
// Kleinian group at a point (2026-11-08)
export {
    domainAbsolute,
    groupGeometry,
    minEnclosingCircle,
    maximalDiskAt,
    maximalDisk,
    maximalDiskFinder,
    localGeometry,
} from './GroupGeometry.js';

// the view anchor: the element folding the view's centre into F, for endless
// panning (2026-11-11, docs/infinite_navigation_plan.md)
export {
    makeViewAnchor,
    viewAnchorMath,
    mirrorsToMap,
    composeMaps,
    mapSize,
} from './ViewAnchor.js';
