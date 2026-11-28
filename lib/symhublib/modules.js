export {
    VisualizationOptions
} from './VisualizationOptions.js';

export {
    GUI as DatGUI
}
from "../datgui/datgui.js";

export {
    createProgramInfoFromProgram
}
from "../extlib/twgl-full.module.js";

import * as TW from '../extlib/twgl-full.module.js';
export {
    TW
}

export {
    Jama
} from '../extlib/JamaJS/JamaJS.js';

export {
    ShaderFragments
}
from '../shaders/shaders.js';

export {
    $,
    hashCode,
    scaleByPixelRatio,
    getPixelRatio,
    getTextureScale,
    wrap,
    normalizeColor,
    HSVtoRGB,
    generateColor,
    correctDeltaX,
    correctDeltaY,
    updatePointerDownData,
    updatePointerUpData,
    updatePointerMoveData,
    correctRadius,
    resizeCanvas,
    normalizeTexture,
    clamp01,
    downloadURI,
    textureToCanvas,
    isDefined,
    isFunction,
    getParam,
    hexToColor,
    premultColorArray,
    hexColorToArray,
    hexToPremult,
    pointerPrototype,
    iArrayToString,
    fa2s,
    a2s,
    date2s,
    distance,
    distanceSquared,
    lerp_arrays,
    lerp,
    rotateXY,
    getTime,
    fa2str,
    str2fa,
    fa2stra,
    
    getSquareThumbnailCanvas,    

    openFile,
    saveTextFile,
    saveTextFileAs,
    saveFile,
    saveFileAs,
    canvasToLocalFile,
    getImageSaver, 

    createVideoRecorder,
    createVideoRecorder2,
    createVideoRecorder3,

    ParamChoice,
    ParamColor,
    ParamInt,
    ParamBool,
    ParamFunc,
    ParamFloat,
    ParamGroup,
    ParamObj,
    ParamString,
    ParamCustom,
    ParamImage,
    createParamUI,
    getParamValues,
    setParamValues,
    updateParamDisplay,
    initParamValues,
    createInternalWindow,
    resetWindowLayouts,
    createDockShell,
    createToolPalette,
    createToolbox,
    createPropertyBar,
    createLayerList,
    createParamPanel,
    createParamListUndo,
    createParamValueUndo,
    createInputWatch,
    UndoStack,
    showPopupMenu,
    windowMenuItems,
    createStatsWindow,
    createFileSelectionDialog,
    createSaveAsDialog,
    createExportImageDialog,
    createFolderPickerDialog,
    createImageSelector,
    FOLDER_THUMB,
    PARENT_THUMB,
    createPresetsFilesFilter,
    createDefaultImageFilesFilter,    
    writeFile,
    supportsDirectoryPicker,
    sanitizeFileName,

    TreeNode,
    createTreeView,
    createTreeWindow,

    AnimatedPointer,
    getHashParams,
    initTheme,
    getTheme,
    getResolvedTheme,
    setTheme,
    cycleTheme,
    onThemeChange,
    themeLabel,
    getFileNameFromURL,
    getFileNameFromPath,
    getDocumentHandler, 
    getCurrentDocument,
    reorderKeys,
    showWarningBanner,
    ObjectFactory,
    ObjArray,
    ParamObjArray,
    BinaryStore,
    BinaryLoader,
    ChunkRef,
    CustomImageManager,
    createColormapEditor,
    Colormaps,
    convertPointsToIntervals,
    convertIntervalsToPoints,
    saveBufferData,
    loadBufferData,
    ColormapFragments,
    controllers,
    ParamColorStrip,
    ParamImageList,
    parseImageList,
    formatImageList,
    imageListNames,
    imageListEntry,
    imageListCosets,
    renameInImageList,
    imageListNameProblem,
    imageListEntryCosets,
    setImageListEntry,
    toggleImageListName,
    addImageListEntry,
    removeImageListEntry,
    copyNextImageListEntry,
    ParamFloatVector,
    ParamUiFolder,
    ParamUiRow,
    ParamList,
    ParamMenu,
    createPromptDialog,
    writeClipboardText,
    readClipboardText,
    imageSizeError,
    exportViewZoom,
    exportPixelScale,
    createDocumentStateStore,
}
from '../uilib/uilib.js';

export {
    getWebGLContext,
    getResolution,
    framebufferToTextureData,
    createProgram,
    compileShader,
    addLineNumbersWithError,
    getUniforms,
    initBlit,
    blit,
    blitVP,
    createTextureAsync,
    Material,
    Program,
    resizeDoubleFBO,
    resizeFBO,
    createDoubleFBO,
    createFBO,
    compileShaders,
    buildPrograms,
    makePrograms,
    ST_NONE,
    ST_VERT,
    ST_FRAG,
    getBlitMaker,
    getFileFetcher,
    buildProgram,
    buildProgramsArray,

    points2texture,
    
    setViewport,
    enableBlending,
    getStandardTexTransUni,
    printBufferData, 
}
from "./webgl_utils.js";

export {
    EventDispatcher
}
from './EventDispatcher.js';

export {
    CanvasTransform
}
from './CanvasTransform.js';

export {
    TransformMotion2D
}
from './TransformMotion2D.js';

// the kinds of steps of the view's chain of conformal transformations: the numbers the
// shaders get and the same steps on the CPU (2026-11-19, docs/conformal_transforms_plan.md)
export {
    CONFORMAL_KINDS,
    VIEW_CHAIN_MAX_STEPS,
    VIEW_CHAIN_DATA_SIZE,
    RATIONAL_MAX_POINTS,
    moebiusSteps,
    rationalStep,
    scaleStep,
    periodicStep,
    bandStep,
    plainStep,
    powerStep,
    packViewChain,
    viewChainRoom,
    rationalRoots,
}
from './conformal/ConformalKinds.js';

// the view's chain of maps on the CPU, as the shaders apply it to a pixel (2026-11-08),
// and the other way, a world point to its place on a seed's sheet (2026-11-19)
export {
    viewChainToWorld,
    viewChainToScreen,
    viewChainPath,
    viewChainHasSheets,
    viewChainScale,
    viewChainIsIdentity,
    viewChainMirrors,
    viewChainBand,
}
from './ViewChain.js';

// the moves of the navigator's inversive mode: Euclidean moves conjugated by an
// inversion about a pole (2026-11-11)
export {
    inversiveDrag,
    inversiveDilation,
    inversiveTurn,
    invertPoint,
    invertSplane,
    similarityMirrors,
    frameToModel,
    frameMirrors,
    frameReverses,
}
from './InversiveMoves.js';

// the document view: the view saved with a document apart from the working view
// (2026-11-16, docs/document_view_plan.md)
export {
    VIEW_PARTS,
    PLACE_PARTS,
    LEGACY_ASPECT,
    cloneViewValue,
    sameViewValue,
    pickView,
    filePartValue,
    fileAspect,
    validAspect,
    fitViewZoom,
    viewStamp,
    // the frame of a document view (phase 4); frameAxes stays in DocumentView.js
    // (drawlib has one of its own)
    frameSize,
    framePoint,
    frameLocal,
    frameCorners,
    frameOutline,
    FRAME_CORNERS,
    movedFrame,
    resizedFrame,
    turnedFrame,
    normalAngle,
}
from './DocumentView.js';

// the placement of the pattern box as a Möbius map (2026-11-08)
export {
    poseBend,
    poseIsSimilarity,
    poseMatrix,
    poseConfig,
    poseToWorld,
    poseToPattern,
    poseBendUniform,
    poseKey,
    poseInverseTransform,
    poseBoxOutline,
}
from './PatternPose.js';

export {
    iPlane,
    iSphere,
    iPoint,
    splaneToString,
    iDrawSplane,
    iPackDomain,
    iPackRefCount,
    iPackTransforms,
    DataPacking,
    TORADIANS,
    TODEGREE,
    normalizeAngle,
    ITransform,
    sin,
    cos,
    exp, 
    sqrt,
    atan2,

    Group,
    GroupUtils,
    writeCanvasToFile,
    AnimationControl,
    Globals,
    loadJS,
    writeBlobToFile,
    writeToJSON,
    //InversiveNavigator, 
    abs,
    add,
    sub,
    mul,
    dot, 
    cross,
    normalize,
    cDiv,
    PI,
    iGetFactorizationU4, 
    iFactorizeU4,
    cBand2Disk,
    cDisk2Band,
    cExp, 
    cLog,
    cPolar,
    cAdd,
    cMul,
    eDistance,
    eDistanceSquared,
    eLength,
    getCanvasPnt, 
    iInverseTransformU4,
    iReflectU4,
    iTransformU4,
    H4toU4,
    U4toH4,
    iDistanceU4,
    iDrawCircle, 
    iLerpU4,
    combineV,
    orthogonalize,
    SPLANE_SPHERE,
    SPLANE_PLANE,
    isPlanarTransform,
    classifyMobiusU4,
    MOBIUS_PRECISION,
    cSub,
    // the motions of the group's geometry (GeometryMotions.js), for the pattern transform tool
    mobiusApply,
    mobiusCompose,
    mobiusInverse,
    mobiusDerivative,
    mobiusToSplanes,
    canonicalChart,
    anchoredMoveTo,
    similarityAbout,
}
from '../invlib/invlib.js';


export{
    TextureManager,
    TEX_CAMERA,
} from './PatternTextures.js';

export {
    transformGroup,
    groupTransformITransform,
    transformSplane,
}
from './sym_utils.js'

export {
    PlaneNavigator
}
from './PlaneNavigator.js';


export {
    PointerAnimator
}
from './PointerAnimator.js';

export {
    BoxTransform
}
from './BoxTransform.js';

export {
    drawGridAndRuler,
    getRulerStep, 
}
from './GridAndRuler.js';

export {
    DrawingToolRenderer
}
from './DrawingToolRenderer.js';

export {
    DrawingToolHandler
}
from './DrawingToolHandler.js';

export {
    PatternTransformHandler
}
from './PatternTransformHandler.js';

// the editing overlay's geometry builders, shared by the tools and the drawing editor (2026-11-08)
export {
    newGeometry,
    mergeGeometry,
    cssColor,
    transformFrameGeometry,
    transformCornersGeometry,
    transformSquaresGeometry,
    transformPivotGeometry,
    transformBoxGeometry,
    discGeometry,
    splaneTrace,
    splaneGeometry,
}
from './OverlayGeometry.js';

export {
    PatternTransformRenderer,
    drawTransformFrame,
    drawTransformPivot,
    drawTransformCorners,
} from './PatternTransformRenderer.js';

// the editing overlay drawn by the GPU through the view's chain (2026-11-08)
export {
    EditingOverlay,
    packGeometry,
}
from './EditingOverlay.js';

// the document view's frame on the canvas, the Orientation tool's (2026-11-16,
// docs/document_view_plan.md 3.7)
export {
    createDocumentFrame,
}
from './DocumentFrame.js';

// the group transform as a frame on the canvas, the Symmetry tool's transform handles (2026-11-12)
export {
    groupTransformMaps,
    transformFromFrame,
    frameBox,
    transformFrame,
    startFrameDrag,
    frameDragTo,
}
from './GroupTransformFrame.js';

export {
    GroupTransformTool,
}
from './GroupTransformTool.js';

// the group makers' handles on the canvas (getHandles), the Symmetry tool's group handles
export {
    GroupHandlesTool,
}
from './GroupHandlesTool.js';

// the undo steps of the symmetry's edits, on the page's stack or one of their own
export {
    createSymmetryUndo,
    symmetryUndoValue,
    describeSymmetryStep,
}
from './SymmetryUndo.js';

export {
    CrownCalculator
} from './CrownCalculator.js';

export {
    FrameTiming
} from './FrameTiming.js';


export {
    createDataPlot,
    makeSamplePlotData
}
from './DataPlot.js';

export {
    testReadPixels,
    readPixelsFromBuffer
}
from './readPixels.js';

export {
    fetchTextFiles,
    fetchTextFilesCached,
    fetchTextFragments,
    buildProgramsCached,
    initFragments,
    programBuilder,

}
from './program_loader.js';


export {
    CanvasSize
}
from './CanvasSize.js';

//export {
// createVideoRecorder    
//}
//from './video_recorder.js';

export {
    Textures
}
from './Textures.js';

export {
    TextureFile
}
from './TextureFile.js';

/*
export {
    SimulationFactory
}
from './simulation_factory.js';
*/

export {
    appendThumbnails 
} from './appendThumbnails.js';


// the rows of the list of conformal transformations and their factory (2026-11-19);
// ProjectionTransform.js reads the kinds as it is evaluated: they come before it
export {
    ConformalBand,
    ConformalPeriodic,
    ConformalScale,
    ConformalLox,
    ConformalExp,
    ConformalUhp,
    ConformalRational,
    ConformalPower,
    bandMapFraction,
    BAND_DEFAULTS,
    PERIODIC_DEFAULTS,
    SCALE_DEFAULTS,
    RATIONAL_DEFAULTS,
} from './conformal/ConformalMaps.js';

export {
    ConformalMapKinds,
    getConformalMapKind,
    createConformalMap,
    ConformalMapFactory,
} from './conformal/ConformalMapFactory.js';

export {
    ProjectionTransform,
    upgradeProjectionValue,
} from './ProjectionTransform.js';

export {
    SymRendererUpgradeData
} from './SymRendererUpgradeData.js'

export {
    upgradeData as VisualizationManagerUpgradeData,
    checkLayerNames as VisualizationManagerCheckLayerNames,
    defaultUpgradeMapping as VisualizationManagerDefaultUpgradeMapping,
    upgradeData,
    checkLayerNames,
    defaultUpgradeMapping,
} from './VisualizationManagerUpgradeData.js'

export {
    createDocumentManager
} from './SymDocumentManager.js'

export {
    createSymRendererConfig
} from './SymRendererConfig.js'

export {
    createSymRendererScripting
} from './SymRendererScripting.js'

// the look of SymRenderer's UI by name: icons, images, cursors, labels
// (docs/symrenderer_refactor_plan.md)
export {
    DEFAULT_SKIN,
    mergeSkin,
} from './ui/SymRendererSkin.js'

// SymRenderer's own tools, working through its host (docs/symrenderer_refactor_plan.md)
export {
    OrientationTool,
} from './tools/OrientationTool.js'

export {
    SymmetryTool,
} from './tools/SymmetryTool.js'

export {
    PatternBoxTool,
} from './tools/PatternBoxTool.js'

export {
    DrawTool,
    PickTool,
} from './tools/PaintTools.js'

// the parts the UI builders are put together from, and the builders
// (docs/symrenderer_refactor_plan.md phase 4)
export {
    createCanvasWindow,
} from './ui/parts/CanvasWindow.js'

export {
    createSettingsWindow,
} from './ui/parts/SettingsWindow.js'

export {
    createGlobalOptionsWindow,
} from './ui/parts/GlobalOptionsWindow.js'

export {
    createDocumentWindows,
} from './ui/parts/DocumentWindows.js'

export {
    showCommandMenu,
    fileMenuItems,
    exportMenuItems,
    windowsMenuItems,
    listenContextMenu,
} from './ui/parts/Menus.js'

export {
    createToolboxPart,
} from './ui/parts/ToolboxPart.js'

export {
    createToolPaletteBar,
} from './ui/parts/ToolPaletteBar.js'

export {
    createToolWindows,
} from './ui/parts/ToolWindows.js'

export {
    createTopBarPart,
} from './ui/parts/TopBarPart.js'

export {
    showAboutDialog,
    ensureAboutStyles,
    resolveAppInfo,
    formatDiagnosticsReport,
} from './ui/parts/AboutDialog.js'

export {
    createStatusBarPart,
} from './ui/parts/StatusBarPart.js'

export {
    addOwnTools,
} from './ui/parts/OwnTools.js'

export {
    addPanels,
} from './ui/parts/Panels.js'

export {
    ClassicUI,
} from './ui/ClassicUI.js'

export {
    WorkspaceUI,
} from './ui/WorkspaceUI.js'

export {
    StudioUI,
} from './ui/StudioUI.js'

export {
    SimpleUI,
} from './ui/SimpleUI.js'

export {
    pickUI,
} from './ui/pickUI.js'

export {
    APP_CATALOG,
} from './ui/AppCatalog.js'

// the panels a UI builder or a page adds (docs/symrenderer_refactor_plan.md phase 5)
export {
    TimingPanel,
} from './panels/TimingPanel.js'

export {
    DataPlotPanel,
} from './panels/DataPlotPanel.js'

export {
    TRANSFORM_TYPES,
    analyzeTransformH4,
    getMatrixH4,
    getReflectionMatrixH4,
    makeTransformClassificationU4,
} from './TransformUtils.js';

export {
    FixedPointsTransform,
    closeGroupTransformsWindow,
} from './FixedPointsTransform.js';

export {
    SymRendererPrograms
} from './SymRendererPrograms.js';

export {
    makeOverlaySymmetry,
    makeSymmetryConfig,
} from './overlays/OverlaySymmetry.js';


export {
    makeOverlayItem,
    cloneConfig,
} from './overlays/OverlayItem.js';


export { OverlayFundDomain } from './overlays/OverlayFundDomain.js';
export { OverlayGenerators } from './overlays/OverlayGenerators.js';
export { OverlayTiling }     from './overlays/OverlayTiling.js';
export { OverlayIsolines }   from './overlays/OverlayIsolines.js';
export { OverlayLimitset }   from './overlays/OverlayLimitset.js';
export { OverlayBuffer }     from './overlays/OverlayBuffer.js';
export { OverlayWorldGrid }  from './overlays/OverlayWorldGrid.js';
export { OverlayScreenGrid } from './overlays/OverlayScreenGrid.js';
export { OverlayRuler }      from './overlays/OverlayRuler.js';

export {
    OverlayItemFactory,
    OverlayItemKinds,
    createOverlayItem,
    getOverlayItemKind,
} from './overlays/OverlayItemFactory.js';

export {
    upgradeOverlayParams,
    isLegacyOverlay,
    legacyToItemParams,
    LEGACY_ORDER,
    LEGACY_CLASS,
    LEGACY_DEFAULTS,
} from './VisualizationOverlayUpgradeData.js';

export {
   VisualizationOverlay,
   makeDefaultOverlayItems,
} from './VisualizationOverlay.js';

export {
    VisualizationImage,
} from './VisualizationImage.js';

export {
    VisualizationManager
} from './VisualizationManager.js';

export {
    createVisualizationLayersWindow
} from './VisualizationLayersWindow.js';

export {
    createSymmetryWindow
} from './SymmetryWindow.js';

// the undo steps of the edits of the list of conformal transformations
export {
    createTransformsUndo,
} from './TransformsUndo.js';

// a conformal transformation's own handles and marks on the canvas, through the view's chain cut at its row
export {
    createTransformHandles,
} from './TransformHandles.js';

// the list of conformal transformations in a window of its own (2026-11-19)
export {
    createTransformsWindow,
    transformsNodes,
} from './TransformsWindow.js';

export {
    VisualizationLayerFactory,
    makeDefaultLayers,
} from './VisualizationLayerFactory.js';

export {
    ImageLayerFactory,
    ImageLayerUpgradeMapping,
} from './ImageLayerFactory.js';

export {
    PipelineManager,
    makePipelineManagerCreator,
} from './PipelineManager.js';

export {
    SymmetrizationWorker,
} from './SymmetrizationWorker.js';


export {
    MaskRectangle,
} from './MaskRectangle.js';

export {
    MaskCircle,
} from './MaskCircle.js';

export {
    MaskTruchet,
} from './MaskTruchet.js';

export {
    MaskHexagon,
} from './MaskHexagon.js';

export {
    MaskTriangle,
} from './MaskTriangle.js';

export {
    MaskWorker,
} from './MaskWorker.js';


export {
    VisualizationColormap
} from './VisualizationColormap.js';

export {
    VisualizationBumpmap
} from './VisualizationBumpmap.js';

export {
    VisualizationTexmap
} from './VisualizationTexmap.js';


export {
    InterpolationNames,
    getInterpolationId
} from './interpolation.js';

export {
    TestWriter
} from './TestWriting.js';

export {
    asyncTracker
} from './AsyncTracker.js';

export {
    exportImage
} from './exportImage.js';
export {
    createTiffBlob
} from './tiff_util.js';


export {
    createScriptAPI,
    createScriptEvents,
} from './ScriptAPI.js';

export {
    makePatternData,
} from './PatternData.js';

// color symmetry layers (Color Images, Color Tiles) and their parts; last, so
// that what they use at module level is evaluated before them
export {
    composePerms,
    invertPerm,
    wordToPerm,
    sidePermutations,
    strToPermutations,
    Subgroups,
    getGroupGeometry,
    getDomainBounds,
    findPlacementTargets,
    pickDefaultTarget,
    evaluateTrajectory,
    sampleTrajectoryPoints,
    evaluateSweepSplane,
} from '../grouplib/grouplib.js';

// the Dirichlet domain of the group as an operation on it, and its tool
export {
    parseWords,
    wordsToString,
    compactWord,
    normalizeWord,
    dirichletBase,
    dirichletSide,
    makeDirichletGroup,
    dirichletImages,
    dirichletCellAt,
    dirichletCell,
    checkDirichletDomain,
    sideArcPoint,
    sideArcContains,
    groupToData,
    DEFAULT_SEARCH_SECONDS,
    startDirichletSearch,
    prepareDirichletSearch,
} from '../grouplib/grouplib.js';

export {
    DirichletDomainTool
} from './DirichletDomainTool.js';

export {
    MAX_COLORS_COUNT,
    MAX_PERM_COUNT,
    packPerm,
    packSidePerms,
    transToPackedPerms,
} from './PermutationPacking.js';

export {
    adjustColorHSL,
    adjustColorRGB,
    adjustColorRGB_OKLCH,
    rgbToHsl,
    hslToRgb,
    rgbToHex,
    hexToRgb,
} from './color_utils.js';

export {
    Palettes
} from './Palettes.js';

export {
    ColorTiles
} from './ColorTiles.js';

export {
    ColorTransition
} from './ColorTransition.js';

export {
    ColorSymPrograms
} from './ColorSymPrograms.js';

export {
    VisualizationColorSym
} from './VisualizationColorSym.js';

export {
    VisualizationColorTiles
} from './VisualizationColorTiles.js';

export {
    RELEASE_ID,
} from './BuildInfo.js';

export {
    QUALITY_MODES,
    TIER_BUDGETS,
    collectWebGLInfo,
    detectDeviceTier,
    computeLiveRenderScale,
    createAdaptiveScaler,
} from './RenderQuality.js';

// subgroup domains and generator elements, for the symmetry and generators overlays
export {
    compareSubgroupNames,
    tableUpTo,
    makeGroupTables,
    NO_TABLE,
    buildSubgroupDomain,
    packSubgroupDomainToSampler,
    subgroupDomainTable,
    makeViewAnchor,
    mirrorsToMap,
    composeMaps,
    mapSize,
    centredViewMap,
    viewDisk,
    bandViewFrame,
    generatorElements,
    subgroupGeneratorElements,
    packGeneratorElementsToSampler,
    domainBox,
    groupWalls,
    localGeometry,
    groupGeometry,
} from '../grouplib/grouplib.js';
