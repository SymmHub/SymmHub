import {
    ParamBool,
    ParamChoice,
    ParamMenu,
    createFileSelectionDialog,
    writeBlobToFile,
    showWarningBanner,
    addImageListener,
    itemsToSvg,
    patternSvg,
    ParamObjArray,
    createSwatchPair,
    createLayerList,
    createPropertyBar,
    ParamCustom,
    ParamString,
    setParamValues,
    DataPacking,
    EventDispatcher,
    createDoubleFBO,
    createFBO,
    makePatternData,
    enableBlending,
    DrawingDocument,
    drawItem,
    foldItems,
    Sprites,
    DrawingPrograms,
    DrawingEditor,
    PolylineTool,
    PenTool,
    ShapeTool,
    SelectTool,
    NodeTool,
    styleProperties,
    DrawingCommands,
    imageListNameProblem,
} from './modules.js';

//
//  PatternDrawing - a vector drawing as a SymmHub pattern
//
//  The drawing (DrawingDocument) is in world coordinates, as the attractors
//  of symchaos are. When something changed - the drawing, the group, the
//  pattern box (patternTransConfig) or the resolution - getPatternData()
//  renders it once into the pattern buffer:
//    1. foldItems(): every item gets its fold element h, which moves it next
//       to the fundamental domain (a group's members each their own);
//    2. per fold group, the items are drawn with Canvas2D at their own place
//       and splatted into the buffer through h (program drawingSplat), exact
//       for any map of the group;
//    3. with 'crown' on, the pattern's own crown pass adds the copies through
//       the side pairings (program drawingCrown), for layers without a crown
//       of their own (VisualizationImage). Color Images has its own crown.
//  The layers then fold and sample the buffer as for any pattern.
//
//  The pattern data is multi-component, like sympix's PatternImageArray: the
//  main buffer is the whole drawing, and every drawing layer is a component
//  named by its id, so a Color Images layer with images = 'layer2' shows that
//  drawing layer alone, with its own colour symmetry. So is every group and
//  every item of a layer (not those a shape holds: they are drawn with it),
//  by its id: a group's component is its members. A component gets its
//  buffer when a layer first asks for it, is re-rendered with the main buffer
//  while layers keep asking, and is freed when none does. A drawing layer,
//  a group or an item renamed fires 'componentRenamed', so that the layers
//  naming it follow. getComponentTree() lists these names and
//  getSelectedIds() the selected items, for the images chips of the colour
//  layers (ParamImageList). pushUndo(entry) puts a step of the owner's on
//  the drawing's undo stack (the visualization layers window's edits).
//
//  createUITool() gives SymRenderer the drawing tools (SelectTool, NodeTool,
//  PolylineTool, PenTool, a ShapeTool per kind, in the tool palette's order)
//  and makes their DrawingEditor, whose style settings are saved with the
//  pattern's params (the style panel shows them), with the layers list and
//  the layer new items go into. With the tool palette, createToolUI() puts
//  the style's stroke and fill swatches under the palette's tools and makes
//  the style panel (the style of every tool) and the layers window (a tree
//  of the layers, their groups and items: their ids, visibility,
//  selection),
//  getToolboxCommands() gives
//  the toolbox undo, redo and the add menu, getExportItems() the SVG exports.
//

const MYNAME = 'PatternDrawing';
const DEBUG = false;

const RESOLUTIONS = ['512', '1024', '2048', '4096'];
const SPRITE_RESOLUTIONS = ['256', '512', '1024', '2048'];
// largest side of the canvas a fold group is drawn into
const MAX_SOURCE_SIZE = 4096;
// margin of that canvas, in its pixels, for the antialiased edges
const SOURCE_PAD = 2;

// what a new drawing shows: a zigzag and a small triangle, in world coordinates
const SAMPLE_ITEMS = [
    { type: 'polyline', points: [-0.30, -0.20, -0.10, 0.15, 0.10, -0.10, 0.30, 0.20],
      style: { stroke: { rgba: [0.85, 0.15, 0.10, 1] }, strokeWidth: 0.03 } },
    { type: 'polyline', closed: true, points: [0.05, 0.25, 0.20, 0.30, 0.12, 0.42],
      style: { stroke: { rgba: [0.10, 0.10, 0.30, 1] }, strokeWidth: 0.01, fill: { rgba: [0.20, 0.45, 0.90, 1] } } },
];

const DEFAULT_PTC = { centerX: 0, centerY: 0, scale: 1, angle: 0 };

/** what an item is, as the layers window says it: group, frame, image, svg, tile, a shape's kind, path, polyline */
function itemKind(item){
    if (item.type === 'group') return 'group';
    if (item.type === 'image') return (typeof item.src === 'string' && item.src.startsWith('data:image/svg')) ? 'svg' : 'image';
    // a frame (Frames.js): a rect that paints nothing, holding an image or an SVG
    const style = item.style || {};
    if (item.children && item.children.length && !style.stroke && !style.fill && item.shape && item.shape.kind === 'rect') return 'frame';
    if (item.tile) return 'tile';
    if (item.shape) return item.shape.kind;
    return item.type || 'polyline';
}

// the drawing's toolbox buttons (getToolboxCommands)
const ICON_UNDO = new URL('./res/btn_undo.svg', import.meta.url).pathname;
const ICON_REDO = new URL('./res/btn_redo.svg', import.meta.url).pathname;
const ICON_ADD  = new URL('./res/btn_add.svg', import.meta.url).pathname;

let _nextId = 1;

function PatternDrawing(options = {}) {

    const mConfig = {
        id:         `drawing${_nextId++}`,
        resolution: '1024',
        useCrown:   false,
        layer:      'layer1',   // the layer new items go into
        // the items as sprites (one buffer each, never folded) for the colour
        // layers; off: the colour layers sample the main buffer
        sprites:    true,
        spriteResolution: '1024',
    };

    const mDocument = DrawingDocument({ items: options.items ?? SAMPLE_ITEMS });
    const mEventDispatcher = new EventDispatcher();

    let mGL = null;
    let mFolded = null;         // the folded drawing (FBO), input of the crown pass
    let mBuffer = null;         // the pattern buffer (DoubleFBO) the layers sample
    // drawing layer id -> {buffer, key, asked}: the layers' own buffers,
    // made when a visualization layer names them; asked: named since the
    // buffer was last rendered
    const mComponents = new Map();
    // counts the changes of what every buffer shows (group, box, resolution,
    // crown); a component is current when its key (componentKey) is the one
    // it was rendered with
    let mGeometryVersion = 0;
    let mGroupData = null;      // the group in pattern coordinates, for the crown pass
    let mTransformData = null;  // h^-1 of the fold group being splatted
    let mSourceTex = null;      // a fold group's drawing, uploaded
    let mSourceCanvas = null;

    let mGroup = null;
    // the main buffer is rendered when an enabled layer samples it (the last
    // frame's layers tell, needsMainBuffer); the colour layers show the sprites
    let mMainUsed = true;
    // the last frame's visualization layers: the editor picks what they show
    let mVisLayers = [];
    // the items as sprites (Sprites), made when the colour layers first ask
    let mSpriteSet = null;
    let mPtc = { ...DEFAULT_PTC };
    let mPtcKey = '';
    let mNeedToRender = true;
    let mOnIdChange = null;
    let mEditor = null;
    let mTools = null;
    // with SymRenderer's tool palette (createUITool's par.toolPalette): the
    // layers window chooses the layer new items go into, the toolbox has the
    // add and export menus, the panel shows neither nor the layers list
    let mPaletteMode = false;
    let mLayerList = null;      // the layers window (createToolUI)
    let mImportDialog = null;   // the file dialog of Image..., SVG... and Replace image...
    let mImportFile = null;     // what it does with a file

    // made at the first getParams(), after createUITool() made the editor
    let mParams = null;
    const mLayersHolder = { layers: mDocument.getLayersArray() };
    mDocument.onChange(onChanged);

    function layerIds(){
        return mDocument.getLayers().map(l => l.getId());
    }

    function makeParams(){
        const params = {
            id:         ParamString({obj: mConfig, key: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); }}),
            resolution: ParamChoice({obj: mConfig, key: 'resolution', choice: RESOLUTIONS, name: 'resolution', onChange: onResolutionChanged}),
            useCrown:   ParamBool  ({obj: mConfig, key: 'useCrown', name: 'crown', onChange: onGeometryChanged}),
            sprites:    ParamBool  ({obj: mConfig, key: 'sprites', name: 'sprites', onChange: onSpritesChanged}),
            spriteResolution: ParamChoice({obj: mConfig, key: 'spriteResolution', choice: SPRITE_RESOLUTIONS, name: 'sprite size', onChange: onSpritesChanged}),
        };
        if (mPaletteMode) {
            params.layer = ParamCustom({ getValue: () => mConfig.layer,
                                         setValue: (v) => { if (v !== undefined) { mConfig.layer = v; mDocument.setActiveLayer(v); } } });
        } else {
            params.layer  = ParamChoice({obj: mConfig, key: 'layer', choice: layerIds(), name: 'draw into',
                                         onChange: () => mDocument.setActiveLayer(mConfig.layer)});
            params.add    = ParamMenu({name: 'add', tooltip: 'a tile of the domain, an image, an SVG file', menu: addItems});
            params.export = ParamMenu({name: 'export', tooltip: 'SVG files of the drawing and of the pattern', menu: exportItems});
        }
        // the style of new items, saved with the drawing; the property bar
        // of the tool palette shows it (the panel does not)
        if (mEditor) params.style = mEditor.getStyleParams();
        params.layers = ParamObjArray({obj: mLayersHolder, key: 'layers', name: 'layers',
                                       factory: mDocument.getLayerFactory(), onChange: onLayersChanged,
                                       ...(mPaletteMode ? { createUI: () => {} } : {})});
        return params;
    }

    /** the add menu: a tile of the domain, an image, an SVG file */
    function addItems(){
        return [
            { label: 'Tile from domain', title: 'the fundamental domain as a tile whose edges follow their pairs',
              action: () => { if (mEditor) mEditor.addTileFromDomain(); } },
            { label: 'Image…', title: 'an image file (an SVG as a picture) into the shape being edited, else into the pattern box', action: openImage },
            { label: 'SVG…', title: 'the shapes of an SVG file, a picture of it if it has none', action: openSvg },
        ];
    }

    /** the export menu: SVG files of the drawing and of the pattern */
    function exportItems(){
        return [
            { label: 'Drawing SVG…', title: 'the shapes as drawn, with a margin', action: () => exportSvg('drawing') },
            { label: 'Pattern SVG, the box…', title: 'the shapes and their copies over the pattern box', action: () => exportSvg('box') },
            { label: 'Pattern SVG, the view…', title: 'the shapes and their copies over what the canvas shows', disabled: !(mEditor && mEditor.view.canvasSize), action: () => exportSvg('view') },
        ];
    }

    function getParams(){
        if (!mParams) {
            mParams = makeParams();
            mLayersValue = layersValue();
            mLayersActive = mConfig.layer;
        }
        return mParams;
    }

    // the layers list as saved, the state an undo of a list edit returns to,
    // and the layer new items went into then
    let mLayersValue = null;
    let mLayersActive = null;
    let mLayersRestoring = false;

    function layersValue(){
        return JSON.stringify(mParams.layers.getValue());
    }

    function restoreLayers(json, active){
        mLayersRestoring = true;
        try {
            if (active) mConfig.layer = active;
            mParams.layers.setValue(JSON.parse(json), true);
            // the active layer checked against the list, the layers window shown
            // (no undo step of its own: restoring)
            onLayersChanged();
        } finally { mLayersRestoring = false; }
        mLayersValue = json;
        mLayersActive = mConfig.layer;
    }

    // an edit of the layers window made of several changes of the list (a
    // duplicate adds a layer, then fills it) is one undo step
    let mLayersBatch = false;

    function batchLayers(fn){
        // the list as it is now: drawing and the layers' own edits do not come
        // here, and an undo of this edit must not take them back
        mLayersValue = layersValue();
        mLayersBatch = true;
        try { return fn(); }
        finally { mLayersBatch = false; onLayersChanged(); }
    }

    /** the layer an edit of the list renamed, as [from, to], or null: lists of
     *  one length with one id changed (a move changes two places at least) */
    function renamedLayer(before, after){
        const idsOf = (json) => JSON.parse(json).params.children.map(c => c.params.id);
        const a = idsOf(before), b = idsOf(after);
        const changed = a.filter((id, i) => id !== b[i]);
        if (a.length !== b.length || changed.length !== 1) return null;
        return [changed[0], b[a.indexOf(changed[0])]];
    }

    function layerRenamed(from, to){
        mEventDispatcher.dispatchEvent({type: 'componentRenamed', target: myself, from, to});
    }

    // a layer was added, removed, moved or renamed in the layers list
    function onLayersChanged(){
        const ids = layerIds();
        if (!ids.includes(mConfig.layer)) mConfig.layer = ids[ids.length - 1];
        mDocument.setActiveLayer(mConfig.layer);
        if (mParams && mParams.layer.updateChoices) {
            mParams.layer.updateChoices(ids);
            mParams.layer.updateDisplay();
        }
        mDocument.layersChanged();
        if (mLayerList) mLayerList.refresh();
        // an edit of the list is an undo step, between the item edits
        if (mParams && mEditor && !mLayersRestoring && !mLayersBatch) {
            const now = layersValue();
            if (mLayersValue !== null && now !== mLayersValue) {
                const before = mLayersValue, after = now;
                const activeBefore = mLayersActive, activeAfter = mConfig.layer;
                const renamed = renamedLayer(before, after);
                if (renamed) layerRenamed(renamed[0], renamed[1]);
                mEditor.pushUndo({ label: 'layers',
                    undo: () => { restoreLayers(before, activeBefore); if (renamed) layerRenamed(renamed[1], renamed[0]); },
                    redo: () => { restoreLayers(after, activeAfter); if (renamed) layerRenamed(renamed[0], renamed[1]); } });
            }
            mLayersValue = now;
            mLayersActive = mConfig.layer;
        }
    }

    //
    //  restore from a document; drawings saved in phase 0 kept all layers in
    //  one 'drawing' value: they go through the layers list, which shows them.
    //  initialize: a document loaded (SymDocumentManager), not a patch of a
    //  script: the undo steps go, they were of the drawing before it (and the
    //  visualization layers' steps on the same stack with them)
    //
    function setParamsMap(values, initialize = false){
        const v = { ...values };
        const params = getParams();
        mLayersRestoring = true;
        try {
            if (v.drawing) {
                const d = v.drawing;
                if (d && Array.isArray(d.layers)) {
                    params.layers.setValue({ className: 'ObjArray', params: { id: 'layers', children: d.layers.map((l, i) => ({
                        className: 'DrawingLayer',
                        params: { id: l.id || ('layer' + (i + 1)), enabled: l.visible !== false, locked: !!l.locked,
                                  opacity: l.opacity ?? 1, items: l.items || [] },
                    })) } }, true);
                }
                delete v.drawing;
            }
            setParamValues(params, v, initialize);
            onLayersChanged();
        } finally {
            mLayersRestoring = false;
        }
        mLayersValue = layersValue();
        mLayersActive = mConfig.layer;
        if (initialize && mEditor) mEditor.clearUndo();
    }

    function addEventListener(evtType, listener){
        mEventDispatcher.addEventListener(evtType, listener);
    }

    function informListeners(){
        mEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
    }

    // what every buffer shows has changed
    function invalidate(){
        mNeedToRender = true;
        mGeometryVersion++;
    }

    function onGeometryChanged(){
        invalidate();
        informListeners();
    }

    // the drawing changed: the main buffer, and the components whose layer changed
    /**
     * the file dialog of Image..., SVG..., Replace image... and the fills: made on first use, it stays open
     * for more files and has a storage id of its own (folder, place, size),
     * as it can be open beside the documents' and the textures' dialogs;
     * addFile(file) takes the file double clicked
     */
    function showImportDialog(title, extensions, addFile){
        mImportFile = addFile;
        if (!mImportDialog) {
            mImportDialog = createFileSelectionDialog({
                title,
                filter:    'image',
                storageId: 'imageImportDialog',
                // clear of the toolbox and the tool palette
                left:      '120px',
                top:       '90px',
                onSelect:  async (item) => {
                    if (!mEditor) return;
                    try {
                        await mImportFile(await item.imageHandle.getFile());
                    } catch (e) {
                        console.error(`could not read the file "${item.getName()}"`, e);
                        showWarningBanner(`"${item.getName()}" could not be read: ${e.message}`);
                    }
                },
            });
        }
        return mImportDialog.show({ title, extensions });
    }

    // an image file placed into the shape being edited, else into the pattern box
    function openImage(){
        return showImportDialog('Add Image', null, file => mEditor.importImageBlob(file));
    }

    function openSvg(){
        return showImportDialog('Add SVG', ['.svg'], async file => mEditor.importSvgText(await file.text(), file.name));
    }

    /**
     * the SVG text of the drawing ('drawing': the shapes with a margin) or
     * of the pattern over a region (world): 'box' the pattern box, 'view'
     * what the canvas shows, or [x0, y0, x1, y1]
     */
    function svgText(kind){
        const items = mDocument.getItems();
        if (kind === 'drawing') return itemsToSvg(items);
        let region = Array.isArray(kind) ? kind : null;
        if (kind === 'view' && mEditor && mEditor.view.canvasSize) {
            const [w, h] = mEditor.view.canvasSize();
            const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(c => mEditor.view.toWorld(c).pnt);
            region = [Math.min(...corners.map(c => c[0])), Math.min(...corners.map(c => c[1])), Math.max(...corners.map(c => c[0])), Math.max(...corners.map(c => c[1]))];
        }
        if (!region) region = [mPtc.centerX - mPtc.scale, mPtc.centerY - mPtc.scale, mPtc.centerX + mPtc.scale, mPtc.centerY + mPtc.scale];
        return patternSvg({ items, group: mGroup, ptc: mPtc, region });
    }

    function exportSvg(kind){
        const name = (mConfig.id || 'drawing') + (kind === 'drawing' ? '' : '_pattern') + '.svg';
        writeBlobToFile(new Blob([svgText(kind)], { type: 'image/svg+xml' }), name);
    }

    // an image of the drawing decoded: the buffers show it from now
    addImageListener(() => onChanged());

    function onChanged(){
        mNeedToRender = true;
        freeComponents(key => componentNames(key).some(id => !mDocument.isNameTaken(id)));
        informListeners();
        refreshTreeSoon();
    }

    // the layers window shows the items as they are, once the change is done
    // (a drag changes the drawing at every move: the window is drawn again
    // only when what it shows changed)
    let mTreeQueued = false;
    function refreshTreeSoon(){
        if (!mLayerList || mTreeQueued) return;
        mTreeQueued = true;
        queueMicrotask(() => { mTreeQueued = false; if (mLayerList) mLayerList.refresh(); });
    }

    // a component is the drawing layers, groups and items whose ids its key
    // lists, with spaces between them (no id has one), in the document's order
    const componentNames = key => key.split(' ');

    /** what changes when the layer, group or item with the name changes */
    function nameVersion(name){
        if (mDocument.getLayer(name)) return mDocument.getLayerVersion(name);
        const at = mDocument.findItem(name);
        return at ? at.layer.getId() + ':' + mDocument.getLayerVersion(at.layer.getId()) : '-';
    }

    function componentKey(key){
        return mGeometryVersion + '|' + componentNames(key).map(nameVersion).join(',');
    }

    /** the items a component shows: the members named by a name of its key, each as getItems() shows it */
    function componentItems(key){
        const wanted = new Set(componentNames(key));
        return shownMembers().filter(e => e.names.some(n => wanted.has(n)))
                             .map(e => (e.opacity === 1 ? e.item : { ...e.item, style: { ...e.item.style, opacity: (e.item.style.opacity ?? 1)*e.opacity } }));
    }

    // the sprites are made again at the next frame
    function onSpritesChanged(){
        if (mSpriteSet) mSpriteSet.free();
        mSpriteSet = null;
        if (mEditor) mEditor.onGeometryChanged();
        informListeners();
    }

    function onResolutionChanged(){
        if (mGL) {
            freeBuffers();
            freeComponents(() => true);
            createBuffers();
        }
        onGeometryChanged();
    }

    // ── GL resources ─────────────────────────────────────────────────────────

    function init(glContext){
        mGL = glContext.gl;
        const gl = mGL;
        createBuffers();
        mGroupData = DataPacking.createGroupDataSampler(gl);
        mTransformData = DataPacking.createGroupDataSampler(gl);
        mSourceTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, mSourceTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        mSourceCanvas = (typeof OffscreenCanvas !== 'undefined')
            ? new OffscreenCanvas(1, 1)
            : document.createElement('canvas');
        if (mGroup) DataPacking.packGroupToSampler(gl, mGroupData, mGroup);
        invalidate();
    }

    function getResolution(){
        return parseInt(mConfig.resolution) || 1024;
    }

    function createPatternBuffer(){
        const gl = mGL, res = getResolution();
        return createDoubleFBO(gl, res, res, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.LINEAR);
    }

    function createBuffers(){
        const gl = mGL, res = getResolution();
        mFolded = createFBO(gl, res, res, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.LINEAR);
        mBuffer = createPatternBuffer();
    }

    function freeFBO(fbo){
        mGL.deleteFramebuffer(fbo.fbo);
        fbo.textures.forEach(t => mGL.deleteTexture(t));
    }

    function freeDoubleFBO(dfbo){
        freeFBO(dfbo.read);
        freeFBO(dfbo.write);
    }

    function freeBuffers(){
        if (mFolded) freeFBO(mFolded);
        if (mBuffer) freeDoubleFBO(mBuffer);
        mFolded = mBuffer = null;
    }

    /** frees the component buffers whose keys pass the test */
    function freeComponents(test){
        for (const [id, comp] of mComponents) {
            if (!test(id)) continue;
            if (mGL) freeDoubleFBO(comp.buffer);
            mComponents.delete(id);
        }
    }

    // ── group and pattern box ────────────────────────────────────────────────

    /** the group in pattern coordinates (SymRenderer.updateTransGroup) */
    function setGroup(group){
        mGroup = group;
        if (mGL) DataPacking.packGroupToSampler(mGL, mGroupData, mGroup);
        if (mEditor) mEditor.onGeometryChanged();
        invalidate();
        informListeners();
    }

    function updatePatternTransform(ptc){
        if (!ptc) return;
        const key = [ptc.centerX, ptc.centerY, ptc.scale, ptc.angle].join(' ');
        if (key === mPtcKey) return;
        mPtcKey = key;
        mPtc = { centerX: ptc.centerX, centerY: ptc.centerY, scale: ptc.scale, angle: ptc.angle };
        if (mEditor) mEditor.onGeometryChanged();
        invalidate();
    }


    function renderMain(){
        if (mNeedToRender && mGL) {
            render(mDocument.getItems(), mBuffer);
            mNeedToRender = false;
        }
    }

    //
    //  renders the components that are out of date with the main buffer, before
    //  the visualization layers draw; a component no layer named since it was
    //  last rendered is no longer shown and is freed
    //
    function renderComponents(){
        for (const [id, comp] of mComponents) {
            const key = componentKey(id);
            if (comp.key === key) continue;
            if (!comp.asked) {
                freeComponents(cid => cid === id);
                continue;
            }
            render(componentItems(id), comp.buffer);
            comp.key = key;
            comp.asked = false;
        }
    }

    //
    //  does an enabled layer of the frame sample the main buffer: a layer says
    //  with usesPatternBuffer() (the colour layers: not while they show
    //  sprites); a layer without the method is taken to
    //
    function needsMainBuffer(visLayers){
        if (!visLayers.length) return true;
        return visLayers.some(vl => vl && vl.enabled && (!vl.usesPatternBuffer || vl.usesPatternBuffer()));
    }

    /**
     * the items shown, every group replaced by its members, hidden ones and
     * hidden layers left out: [{item, layerId, names, opacity}], bottom first.
     * A group is drawn as its members, each in the group's place in the order,
     * the group's opacity and its layer's in their opacity; names: the
     * layer's id, the groups' holding the member and its own, what the
     * colour layers' images lists show it by. The items themselves are given
     * (a sprite is drawn again when its item object changes)
     */
    function shownMembers(){
        const out = [];
        const add = (item, layerId, opacity, names) => {
            if (item.visible === false) return;
            if (item.type === 'group') {
                const a = opacity*(item.style.opacity ?? 1);
                for (const child of item.children || []) add(child, layerId, a, [...names, item.id]);
            } else {
                out.push({ item, layerId, opacity, names: [...names, item.id] });
            }
        };
        for (const layer of mDocument.getLayers()) {
            if (!layer.isVisible()) continue;
            for (const item of layer.getItems()) add(item, layer.getId(), layer.getOpacity(), [layer.getId()]);
        }
        return out;
    }

    /** the items shown, as the sprites take them (each a sprite of its own,
     *  its own box and tiles): [{item, layerId, names, opacity, word}], bottom first */
    function spriteEntries(){
        return shownMembers().map(e => ({ ...e, word: e.item.colorWord || '' }));
    }

    /** the items with every group replaced by its members, the group's
     *  opacity in theirs, hidden ones left out: each member folds by its own element */
    function memberItems(items){
        const out = [];
        const add = (item, opacity) => {
            if (item.visible === false) return;
            if (item.type === 'group') {
                const a = opacity*(item.style.opacity ?? 1);
                for (const child of item.children || []) add(child, a);
            } else {
                out.push(opacity === 1 ? item : { ...item, style: { ...item.style, opacity: (item.style.opacity ?? 1)*opacity } });
            }
        };
        for (const item of items) add(item, 1);
        return out;
    }

    function getPatternData(renderParams){
        updatePatternTransform(renderParams && renderParams.patternTransConfig);
        if (renderParams && renderParams.visLayers) {
            mVisLayers = renderParams.visLayers;
            mMainUsed = needsMainBuffer(mVisLayers);
        }
        if (mGL) {
            if (mMainUsed) renderMain();
            renderComponents();
        }
        const data = { ...makePatternData({mainBuffer: mBuffer}), getComponentBuffer };
        if (mConfig.sprites && mGL) {
            if (!mSpriteSet) mSpriteSet = Sprites({ gl: mGL, size: parseInt(mConfig.spriteResolution) || 1024 });
            mSpriteSet.update(spriteEntries());
            data.getSprites = () => mSpriteSet.getData();
        }
        return data;
    }

    //
    //  the buffer of the drawing layer, group or item with the id (a component
    //  of the pattern data), or of those with the ids of an array together (a
    //  coset of Color Images' list showing several, ImageList.js); null when
    //  no id is known, unknown ones left out. The main buffer when they name
    //  every visible layer. A component asked for the first time is rendered
    //  here, while a visualization layer draws: it then leaves the GL state
    //  those layers set again (framebuffer, viewport, blending, program) at
    //  their defaults. It reads no GL state: that would wait for the GPU.
    //
    function getComponentBuffer(ids){
        if (!mGL) return null;
        const wanted = new Set(Array.isArray(ids) ? ids : [ids]);
        // the names known, in the document's order: the layers', then the items'
        const known = [...mDocument.getLayers().map(l => l.getId()), ...mDocument.allItems().map(it => it.id)].filter(n => wanted.has(n));
        if (!known.length) return null;
        const visible = mDocument.getLayers().filter(l => l.isVisible());
        if (visible.length && visible.every(l => wanted.has(l.getId()))) {
            renderMain();
            return mBuffer;
        }
        const id = known.join(' ');
        let comp = mComponents.get(id);
        if (!comp) {
            comp = { buffer: createPatternBuffer(), key: null, asked: false };
            mComponents.set(id, comp);
        }
        comp.asked = true;
        const key = componentKey(id);
        if (comp.key !== key) {
            const gl = mGL;
            render(componentItems(id), comp.buffer);
            comp.key = key;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.disable(gl.BLEND);
            gl.useProgram(null);
        }
        return comp.buffer;
    }

    // ── rendering ────────────────────────────────────────────────────────────

    function clearTarget(target){
        const gl = mGL;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /** draw a fold group's items into the source canvas; returns the box it covers */
    function drawFoldGroup(fg, res){
        // pattern units per pixel: the buffer's, finer where h enlarges
        let pix = (2/res)/fg.scale;
        let [x0, y0, x1, y1] = fg.box;
        x0 -= SOURCE_PAD*pix; y0 -= SOURCE_PAD*pix;
        x1 += SOURCE_PAD*pix; y1 += SOURCE_PAD*pix;
        let cw = Math.ceil((x1 - x0)/pix), ch = Math.ceil((y1 - y0)/pix);
        const big = Math.max(cw, ch);
        if (big > MAX_SOURCE_SIZE) {
            cw = Math.ceil(cw*MAX_SOURCE_SIZE/big);
            ch = Math.ceil(ch*MAX_SOURCE_SIZE/big);
        }
        cw = Math.max(cw, 1);
        ch = Math.max(ch, 1);

        const canvas = mSourceCanvas;
        canvas.width = cw;      // also clears it
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        const sx = cw/(x1 - x0), sy = ch/(y1 - y0);
        // pattern (x, y) -> canvas (sx (x - x0), sy (y1 - y)): canvas rows go down
        ctx.setTransform(sx, 0, 0, -sy, -x0*sx, y1*sy);
        fg.items.forEach(item => drawItem(ctx, item));
        return [x0, y0, x1, y1];
    }

    function uploadSource(){
        const gl = mGL;
        gl.bindTexture(gl.TEXTURE_2D, mSourceTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mSourceCanvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /** renders the items into the buffer (a DoubleFBO), with the crown pass when it is on */
    function render(items, buffer){

        const gl = mGL;
        const res = buffer.width;
        const useCrown = mConfig.useCrown && !!mGroup;
        const target = useCrown ? mFolded : buffer.read;
        const canvasUni = { u_aspect: 1., u_scale: 1., u_center: [0., 0.], u_pixelSize: 2./res };

        clearTarget(target);
        const groups = foldItems(memberItems(items), mGroup, mPtc);
        if (DEBUG) console.log(`${MYNAME}.render(): ${groups.length} fold groups`, groups);

        if (groups.length > 0) {
            const prog = DrawingPrograms.getProgram(gl, 'drawingSplat');
            prog.bind();
            prog.setUniforms(canvasUni);
            for (const fg of groups) {
                const box = drawFoldGroup(fg, res);
                uploadSource();
                // an empty chain is the identity
                DataPacking.packGroupToSampler(gl, mTransformData, { t: [fg.inverse ? fg.inverse : []] });
                gl.viewport(0, 0, res, res);
                enableBlending(gl);
                prog.setUniforms({ uSource: mSourceTex, uSourceBox: box, uTransformData: mTransformData });
                prog.blit(target);
            }
            gl.disable(gl.BLEND);
        }

        if (useCrown) {
            const crown = DrawingPrograms.getProgram(gl, 'drawingCrown');
            crown.bind();
            gl.viewport(0, 0, res, res);
            gl.disable(gl.BLEND);
            crown.setUniforms(canvasUni);
            crown.setUniforms({ uFolded: mFolded, uGroupData: mGroupData });
            crown.blit(buffer.read);
        }

    } // render()

    // ── tool ─────────────────────────────────────────────────────────────────

    /** the map between canvas and world when the host gives none: the canvas transform alone */
    function canvasView(canvasTransform){
        return {
            toWorld:   (c) => ({ pnt: canvasTransform.invTransform(c, [0, 0]), exact: true }),
            toCanvas:  (w) => canvasTransform.transform(w, [0, 0]),
            isLinear:  () => true,
            pixelSize: () => {
                const a = canvasTransform.invTransform([0, 0], [0, 0]), b = canvasTransform.invTransform([1, 0], [0, 0]);
                return Math.hypot(b[0] - a[0], b[1] - a[1]);
            },
            // the world rectangle on the canvas [x0, y0, x1, y1] (the editor's fit to the view)
            visible:   () => {
                const c = canvasTransform.getCenter(), s = canvasTransform.getWorldSize();
                return [c[0] - s[0]/2, c[1] - s[1]/2, c[0] + s[0]/2, c[1] + s[1]/2];
            },
        };
    }

    function createUITool(par = {}){
        mPaletteMode = !!par.toolPalette;
        if (!mTools) {
            mEditor = DrawingEditor({
                document:   mDocument,
                // visLayers and getSprites (the sprites the colour layers
                // show) tell the editor's picking what is seen
                getContext: () => ({ group: mGroup, ptc: mPtc, sprites: mConfig.sprites, visLayers: mVisLayers,
                                     getSprites: () => (mConfig.sprites && mSpriteSet) ? mSpriteSet.getData() : null }),
                view:       par.view || canvasView(par.canvasTransform),
                repaint:    par.repaint,
                propertiesChanged: par.propertiesChanged,
                activateTool: par.setTool,
                chooseImage: () => showImportDialog('Replace Image', null, file => mEditor.replaceSelectedImage(file)),
                chooseFill:  (kind) => (kind === 'svg'
                    ? showImportDialog('SVG Fill', ['.svg'], async file => mEditor.fillWithSvg(await file.text(), file.name))
                    : showImportDialog('Image Fill', null, file => mEditor.fillWithImage(file))),
            });
            mTools = [SelectTool({ editor: mEditor }), NodeTool({ editor: mEditor }), PolylineTool({ editor: mEditor }), PenTool({ editor: mEditor }),
                      ...['rect', 'ellipse', 'polygon', 'star', 'spiral'].map(kind => ShapeTool({ editor: mEditor, kind }))];
            mParams = null;     // the params get the editor's style settings
        }
        return mTools;
    }

    //
    //  the parts of SymRenderer's tool palette that are the drawing's: the
    //  stroke and fill swatches of the style under the tools (par.paletteBottom),
    //  the style panel (the style of new items and of the selection, for all
    //  the tools) and the layers window; refresh() when the style or the
    //  layers changed
    //
    function createToolUI(par = {}){
        if (!mEditor) return null;
        const cfg = mEditor.getStyleConfig();
        const set = (key) => (v) => mEditor.setStyleValue(key, v);
        const pair = createSwatchPair({
            stroke: { get: () => cfg.stroke, set: set('stroke') },
            fill:   { get: () => cfg.fill, set: set('fill'), isOn: () => cfg.filled, setOn: set('filled'), image: () => mEditor.fillThumbnail() },
        });
        if (par.paletteBottom) par.paletteBottom.appendChild(pair.element);
        // an image of the fill has decoded: the swatch shows it
        addImageListener(() => pair.refresh());

        // under the layers window (LayerList's place: 120px down, 170px high), at the right edge
        const style = createPropertyBar({
            title:     'style',
            storageId: 'symdraw_style',
            left:      'calc(100% - 290px)',
            top:       '300px',
            hint:      false,
            width:     290,
        });
        style.setControls(styleProperties(mEditor, DrawingCommands(mEditor)));

        const layers = () => getParams().layers;
        const layerById = (id) => mDocument.getLayers().find(l => l.getId() === id) || null;
        const indexOf = (id) => layerIds().indexOf(id);
        const activeId = () => (mDocument.getActiveLayer() ? mDocument.getActiveLayer().getId() : null);
        // the layer chosen between edits is the one an undo of the next edit returns to
        const drawInto = (id) => { mConfig.layer = id; mDocument.setActiveLayer(id); if (!mLayersBatch) mLayersActive = id; };
        // the shapes of a layer that is hidden or locked are no longer picked
        const leave = (gone) => { if (gone) mEditor.clearSelection(); };
        // the tree of a layer's items: groups and the shapes holding content open
        const itemNode = (it, selected) => ({
            id: it.id, kind: itemKind(it), visible: it.visible !== false, selected: selected.has(it.id),
            ...(it.children && it.children.length ? { children: it.children.map(c => itemNode(c, selected)) } : {}),
        });
        const layerNodes = () => {
            const selected = new Set(mEditor.getSelection().map(s => s.id));
            return mDocument.getLayers().map(l => ({ id: l.getId(), visible: l.isVisible(), locked: l.isLocked(),
                                                     opacity: l.getOpacity(), active: l.getId() === activeId(),
                                                     children: l.getItems().map(it => itemNode(it, selected)) }));
        };
        // an item picked in the window: its layer becomes the one drawn into
        // (as a click on its row does), it the selection
        const selectItem = (id, add) => {
            const at = mDocument.findItem(id);
            if (!at) return;
            if (at.layer.getId() !== activeId()) drawInto(at.layer.getId());
            mEditor.selectItem(id, add);
        };
        // the commands on an item (the window adds Rename... and Hide or Show);
        // the window selected it first, if it can be
        const itemMenu = (id) => {
            const picked = mEditor.isSelected(id);
            const reorder = (where) => () => mEditor.reorderSelection(where);
            const not = picked ? '' : 'hidden, or on a hidden or locked layer: it cannot be selected';
            return [
                { label: 'Raise', title: not || 'one step up in the drawing order', disabled: !picked, action: reorder('up') },
                { label: 'Lower', title: not || 'one step down in the drawing order', disabled: !picked, action: reorder('down') },
                { label: 'Raise to top', title: not, disabled: !picked, action: reorder('top') },
                { label: 'Lower to bottom', title: not, disabled: !picked, action: reorder('bottom') },
                { separator: true },
                { label: 'Delete', title: 'the item and all it holds', action: () => mEditor.removeItems([id]) },
            ];
        };
        mLayerList = createLayerList({
            title:       'layers',
            storageId:   'symdraw_layers',
            getLayers:   layerNodes,
            onActivate:  drawInto,
            onSelect:    selectItem,
            onVisible:   (id, v) => {
                const layer = layerById(id);
                if (layer) { layer.setVisible(v); leave(!v); }
                else mEditor.setItemVisible(id, v);
            },
            onLocked:    (id, v) => { layerById(id)?.setLocked(v); leave(v); },
            onOpacity:   (id, v) => layerById(id)?.setOpacity(v),
            itemMenu,
            onRename:    (id, name) => {
                const problem = imageListNameProblem(name);
                if (problem) return problem;
                if (mDocument.isNameTaken(name)) return `"${name}" is taken`;
                const layer = layerById(id);
                if (!layer) {
                    // an item: the names of new layers stay free
                    if (/^layer\d+$/.test(name)) return `names like "${name}" are kept for new layers`;
                    mEditor.renameItem(id, name, layerRenamed);
                    return null;
                }
                batchLayers(() => {
                    layer.setId(name);
                    if (mConfig.layer === id) mConfig.layer = name;
                    layers().renameAll();
                });
                return null;
            },
            onAdd:       (where) => batchLayers(() => {
                const layer = layers().addChild('DrawingLayer', indexOf(activeId()) + (where === 'below' ? 0 : 1));
                if (layer) drawInto(layer.getId());
            }),
            onDuplicate: (id) => batchLayers(() => { const copy = layers().duplicateChild(indexOf(id)); if (copy) drawInto(copy.getId()); }),
            onRemove:    (id) => { if (layerIds().length > 1) { mEditor.clearSelection(); batchLayers(() => layers().removeChildAt(indexOf(id))); } },
            onMove:      (from, to) => batchLayers(() => layers().moveChildTo(from, to)),
        });
        return {
            refresh: () => { pair.refresh(); style.refresh(); mLayerList.refresh(); },
            // for the toolbox's windows menu
            windows: [
                { label: 'Style', title: 'the style of new shapes, and of the selected ones', window: style.window },
                { label: 'Layers', title: 'the drawing layers, their groups and shapes', window: mLayerList.window },
            ],
        };
    }

    /**
     * the names the colour layers' images lists can give (ImageList.js): the
     * layers, under each its groups and items, under a group its members,
     * bottom first as drawn: [{id, kind, children}] (an item a shape holds
     * is drawn with it and has no name of its own)
     */
    function getComponentTree(){
        const node = (it) => ({ id: it.id, kind: itemKind(it),
                                children: it.type === 'group' ? (it.children || []).map(node) : [] });
        return mDocument.getLayers().map(l => ({ id: l.getId(), kind: 'layer', children: l.getItems().map(node) }));
    }

    /** the ids of the selected items */
    function getSelectedIds(){
        return mEditor ? mEditor.getSelection().map(s => s.id) : [];
    }

    // the drawing's commands in the toolbox of SymRenderer's tool palette
    function getToolboxCommands(){
        if (!mEditor) return [];
        return [
            { name: 'undo', icon: ICON_UNDO, title: 'undo (Ctrl+Z)', action: () => mEditor.undo(), enabled: () => mEditor.canUndo() },
            { name: 'redo', icon: ICON_REDO, title: 'redo (Ctrl+Y)', action: () => mEditor.redo(), enabled: () => mEditor.canRedo() },
            { name: 'add',  icon: ICON_ADD,  title: 'add a tile of the domain, an image, an SVG file', items: addItems },
        ];
    }

    const myself = {
        getClassName:     () => MYNAME,
        getName:          () => MYNAME,
        getId:            () => mConfig.id,
        setOnIdChange:    (cb) => { mOnIdChange = cb; },
        addEventListener,
        init,
        setGroup,
        getParams,
        setParamsMap,
        getPatternData,
        createUITool,
        createToolUI,
        getToolboxCommands,
        // the toolbox's export menu shows these after its image export
        getExportItems:   exportItems,
        getComponentTree,
        getSelectedIds,
        // a step of the owner's on the drawing's undo stack ({label, undo(), redo(), mergeKey}):
        // the visualization layers' edits, undone in turn with the drawing's
        pushUndo:         (entry) => { if (mEditor) mEditor.pushUndo(entry); },
        getDocument:      () => mDocument,
        getEditor:        () => mEditor,
        svgText,
    };

    return myself;

} // function PatternDrawing()

const PatternDrawingCreator = {
    create:       (options) => PatternDrawing(options),
    getName:      () => `${MYNAME}-factory`,
    getClassName: () => MYNAME,
};

export { PatternDrawing, PatternDrawingCreator };
