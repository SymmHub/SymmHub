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

// the Dirichlet domain of a group as an operation on the group (from the Orb repo, 2026-10-26)
export {
  DEFAULT_FOLD_ITERATIONS,
  parseWords,
  wordsToString,
  sameAction,
  involutionLetters,
  reduceWord,
  isValidWord,
  dirichletBase,
  dirichletImage,
  dirichletSide,
  makeDirichletGroup,
  dirichletImages,
  dirichletCellAt,
  dirichletCell,
  sideArcPoint,
  selectDirichletSides,
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
    sameTransform,
} from './SubgroupDomain.js';

export {
  groupPresentation,
  domainCorners,
} from './GroupPresentation.js';

export {
    GroupMakerFactory
} from './GroupMakerFactory.js';

// color symmetry: the subgroup chooser and the color permutations of words
export {
    ParamString,
    openFile,
} from '../uilib/uilib.js';

export {
    subgroupsData,
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
    strToPermutations,
} from './Permutations.js';

export {
    Subgroups
} from './Subgroups.js';


export {
    generatorElements,
    subgroupGeneratorElements,
    packGeneratorElementsToSampler,
    domainPolygon,
} from './GeneratorElements.js';
