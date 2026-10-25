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
    ParamObjArray,
    ParamString,
    ObjArray,
    ObjectFactory,
    setParamValues,
    openFile,
    getCurrentDocument,
    BinaryLoader,
} from '../uilib/uilib.js';

export {
    iPoint,
    DataPacking,
    SPLANE_PLANE,
} from '../invlib/invlib.js';

export {
    generatorElements,
} from '../grouplib/grouplib.js';

export {
    EventDispatcher,
    CrownCalculator,
    createDoubleFBO,
    createFBO,
    makePatternData,
    programBuilder,
    enableBlending,
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
    imageItemFromBlob,
    placeQuad,
    hasImage,
} from './ImageItems.js';

export {
    svgToItems,
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
    applyTransform,
    composeTransforms,
    localScale,
    foldPoint,
    boxCopies,
    itemCopies,
    hitsPolyline,
    nearestVertex,
    nearestSegment,
} from './Orbits.js';

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
    PolylineTool,
} from './PolylineTool.js';

export {
    SelectTool,
} from './SelectTool.js';

export {
    PatternDrawing,
    PatternDrawingCreator,
} from './PatternDrawing.js';
