//
//  internal module list of drawlib: what its files import, from the public
//  modules of the other libraries and from its own files
//

export {
    ParamBool,
    ParamChoice,
    ParamColor,
    ParamCustom,
    ParamFloat,
    ParamFunc,
    ParamGroup,
    ParamInt,
    ParamMenu,
    ParamObjArray,
    ParamRow,
    ParamString,
    ObjArray,
    ObjectFactory,
    setParamValues,
    createFileSelectionDialog,
    writeBlobToFile,
    showWarningBanner,
    getCurrentDocument,
    BinaryLoader,
    createSwatchPair,
    createLayerList,
    createPropertyBar,
} from '../uilib/uilib.js';

export {
    iPoint,
    ITransform,
    DataPacking,
    SPLANE_PLANE,
    SPLANE_SPHERE,
    // the motions of the group's geometry (GeometryMotions.js)
    mobiusInverse,
    mobiusPointMap,
    canonicalChart,
    moveTo,
    anchoredMoveTo,
    translationTo,
    mobiusCompose,
    rotationAbout,
    similarityAbout,
    reflectionAbout,
    transformedGeometry,
    clampToModel,
    // the segments of the group's geometry as arcs, its cubics (Geodesics.js)
    geodesicCubics,
    geodesicRayPoint,
    geodesicCurveCubics,
    geodesicCurveSplit,
    curveCubics,
    geodesicMidpoint,
} from '../invlib/invlib.js';

export {
    generatorElements,
    domainPolygon,
    dirichletSourceWord,
    groupGeometry,
    maximalDisk,
    maximalDiskFinder,
} from '../grouplib/grouplib.js';

export {
    EventDispatcher,
    CrownCalculator,
    createDoubleFBO,
    createFBO,
    makePatternData,
    programBuilder,
    enableBlending,
    drawTransformFrame,
    drawTransformPivot,
    drawTransformCorners,
    drawTransformSquares,
    transformBoxGeometry,
    imageListNames,
    imageListEntry,
    imageListNameProblem,
} from '../symhublib/symhublib.js';

export {
    ShaderFragments,
} from '../shaders/shaders.js';

export {
    DrawingShaders,
} from './shaders/modules.js';

// drawlib's own files; each after the files it uses at module level

export {
    blobToDataURL,
    dataURLToBytes,
    bytesToDataURL,
    decodeImage,
    imageItemFromBlob,
    placeQuad,
    coverQuad,
    itemCopy,
    hasImage,
    quadUV,
    maskHit,
} from './ImageItems.js';

export {
    SHAPE_KINDS,
    isShape,
    normalShape,
    shapeFromBox,
    shapeFromCentre,
    cornerPoint,
    cornersSmoothed,
    shapePoint,
    shapeLocal,
    shapeGeometry,
    shapeMapped,
    shapeInChart,
    shapeFromChart,
    spaceAt,
    geodesicShape,
    euclideanShape,
} from './Shapes.js';

export {
    frameItem,
    framedImage,
    withImagesFramed,
    fillBox,
    fillMap,
    imageCovering,
} from './Frames.js';

export {
    flattenNodes,
    flattenDetailed,
    nodeRings,
    nextNode,
    prevNode,
    traceNodes,
    itemBridges,
    withNodes,
    mappedNodes,
    movedNodes,
    nodeMoved,
    handleMoved,
    nodeHandlesPulled,
    nodeSmoothToggled,
    splitSegment,
    removeNode,
    mappedItem,
    mappedAxes,
    itemCentre,
    flattenedItem,
    pathFromPolyline,
    polylineFromPath,
    drawnNodes,
    geodesicOutline,
    flattenItem,
    outlinePoint,
    splitItemSegment,
    withoutGeodesic,
    euclideanItem,
    savedItem,
} from './Paths.js';

export {
    fitCurve,
} from './CurveFit.js';

export {
    coverageRings,
    ringNodes,
} from './OutlineTrace.js';

export {
    parseSvg,
    outlineText,
    itemsOfSvg,
} from './SvgImport.js';

export {
    DrawingLayer,
} from './DrawingLayer.js';

export {
    DrawingDocument,
} from './DrawingDocument.js';

export {
    drawItem,
    imageBitmap,
    imageMask,
    contentThumbnail,
    getImagesVersion,
    addImageListener,
} from './ItemRenderer.js';

export {
    Sprites,
    MAX_SPRITES,
} from './Sprites.js';

export {
    foldItems,
    worldToPatternMap,
    patternToWorldMap,
    itemFoldElement,
} from './Folder.js';

export {
    worldGeometry,
    geometryKey,
    shapeSpace,
    geodesicOutliner,
    kleinianOutliner,
    groupOutliner,
} from './DrawingGeometry.js';

export {
    applyTransform,
    composeTransforms,
    localScale,
    foldPoint,
    foldSides,
    boxCopies,
    itemCopies,
    crownCopies,
    spriteCopies,
    hitsPolyline,
    nearestVertex,
    nearestSegment,
} from './Orbits.js';

export {
    itemsToSvg,
    patternSvg,
} from './SvgExport.js';

export {
    tileFromDomain,
    tileEdgeStarts,
    tileEdgeOfVertex,
    tileVertexFixed,
    tilePairedVertex,
    tileMovedVertex,
    tileInsertedVertex,
    tileRemovedVertex,
    tileReplacedEdge,
    wordMap,
} from './Tiles.js';

export {
    UndoStack,
} from './UndoStack.js';

export {
    SnapIndex,
    SNAP_VERTEX,
    SNAP_CONE,
    SNAP_MIRROR,
} from './SnapIndex.js';

export {
    DrawingPrograms,
} from './DrawingPrograms.js';

export {
    DrawingEditor,
} from './DrawingEditor.js';

export {
    snapProperty,
    fitCurvesProperty,
    geodesicProperty,
    geometryProperty,
    incrementalProperty,
    keepInCellProperty,
    opacityProperty,
    boxProperties,
    styleProperties,
    shapeToolProperties,
    selectedShapeProperties,
} from './ToolProperties.js';

export {
    DrawingCommands,
} from './DrawingCommands.js';

export {
    ShapeHandles,
    shapeHandles,
    shapeWithHandleAt,
} from './ShapeHandles.js';

export {
    PolylineTool,
} from './PolylineTool.js';

export {
    PenTool,
} from './PenTool.js';

export {
    ShapeTool,
} from './ShapeTool.js';

export {
    SelectTool,
} from './SelectTool.js';

export {
    NodeTool,
} from './NodeTool.js';

export {
    PatternDrawing,
    PatternDrawingCreator,
} from './PatternDrawing.js';
