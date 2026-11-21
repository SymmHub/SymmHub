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
    writeClipboardText,
    readClipboardItems,
    installClipboardHandlers,
    copyByCommand,
    writeClipboardItems,
    svgPngBlob,
    svgOfHtml,
    createSwatchPair,
    createLayerList,
    createPropertyBar,
    createImageChannelEditor,
    UndoStack,
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
    groupDomainBase,
    groupModelAbsolute,
    groupWalls,
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
    placeholderPicture,
} from './ImageItems.js';

export {
    SHAPE_KINDS,
    ARC_TYPES,
    isShape,
    normalShape,
    shapeFromBox,
    shapeFromCentre,
    ellipseFromCentre,
    wholeEllipse,
    ellipseParameter,
    isArc,
    arcSpan,
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
    frameAxes,
    FIT_MODES,
    holderBox,
    heightPicture,
    pictureHeightScaleOf,
    pictureShifted,
    pictureOrientation,
    orientedBy,
    placedPicture,
    holderFit,
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
    nodeNeighbour,
    nodeSegments,
    segmentStraight,
    pulledHandle,
    handleRetracted,
    segmentsCurved,
    segmentsStraight,
    bendWeight,
    segmentBent,
    handleSnapped,
    handleLinkedMoved,
    alongHandleLines,
    NODE_TYPES,
    nodeType,
    withType,
    isEndNode,
    autoHandles,
    withAutoHandles,
    nodeTypeSet,
    nextNodeType,
    nodesRemovedKeepingShape,
    reversedNodes,
    brokenPaths,
    joinPoint,
    joinedNodes,
    closedJoin,
} from './Paths.js';

export {
    fitCurve,
    fitOneCubic,
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
    drawItemHeights,
    heightValues,
    sampleHeight,
    contentThumbnail,
    getImagesVersion,
    addImageListener,
} from './ItemRenderer.js';

export {
    exportBufferSize,
    spriteCapacity,
    PATTERN_EXPORT_BYTES,
    SPRITE_EXPORT_BYTES,
} from './ExportBuffers.js';

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
    foldHome,
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
    clipboardContent,
    recordOfText,
    pastedItems,
    clipboardPlace,
    groupFingerprint,
    pasteChoice,
    pointsBox,
    svgHeldBack,
} from './Clipboard.js';

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
    isCurvedTile,
    tileEdgeOfHandle,
    tileHandleFree,
    tileEdgeOfSegment,
    tileWithNodes,
    curvedTile,
    polylineTile,
    releasedTile,
    tileOutline,
} from './Tiles.js';

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
    convertProperties,
    pictureProperties,
    depthProperty,
    handleDepthKey,
    containerProperties,
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
    PictureDrag,
} from './PictureDrag.js';

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
    ImageTool,
} from './ImageTool.js';

export {
    SelectTool,
} from './SelectTool.js';

export {
    NodeTool,
} from './NodeTool.js';

// the Tile tool runs the node tool's editing on tiles
export {
    TileTool,
} from './TileTool.js';

export {
    PatternDrawing,
    PatternDrawingCreator,
} from './PatternDrawing.js';
