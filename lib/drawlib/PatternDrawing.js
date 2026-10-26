import {
    ParamBool,
    ParamChoice,
    ParamMenu,
    openFile,
    addImageListener,
    ParamObjArray,
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
    SelectTool,
} from './modules.js';

//
//  PatternDrawing - a vector drawing as a SymmHub pattern
//
//  The drawing (DrawingDocument) is in world coordinates, as the attractors
//  of symchaos are. When something changed - the drawing, the group, the
//  pattern box (patternTransConfig) or the resolution - getPatternData()
//  renders it once into the pattern buffer:
//    1. foldItems(): every item gets its fold element h, which moves it next
//       to the fundamental domain;
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
//  drawing layer alone, with its own colour symmetry. A component gets its
//  buffer when a layer first asks for it, is re-rendered with the main buffer
//  while layers keep asking, and is freed when none does.
//
//  createUITool() gives SymRenderer the drawing tools (PolylineTool,
//  SelectTool) and makes their DrawingEditor, whose style settings join the
//  pattern's params with the layers list and the layer new items go into.
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
    // the items as sprites (Sprites), made when the colour layers first ask
    let mSpriteSet = null;
    let mPtc = { ...DEFAULT_PTC };
    let mPtcKey = '';
    let mNeedToRender = true;
    let mOnIdChange = null;
    let mEditor = null;
    let mTools = null;

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
            layer:      ParamChoice({obj: mConfig, key: 'layer', choice: layerIds(), name: 'draw into',
                                     onChange: () => mDocument.setActiveLayer(mConfig.layer)}),
            add:        ParamMenu({name: 'add', tooltip: 'a tile of the domain, an image, an SVG file', menu: () => [
                { label: 'Tile from domain', title: 'the fundamental domain as a tile whose edges follow their pairs',
                  action: () => { if (mEditor) mEditor.addTileFromDomain(); } },
                { label: 'Image…', title: 'an image file into the shape being edited, else into the pattern box', action: openImage },
                { label: 'SVG…', title: 'the shapes of an SVG file', action: openSvg },
            ]}),
        };
        if (mEditor) params.style = mEditor.getStyleParams();
        params.layers = ParamObjArray({obj: mLayersHolder, key: 'layers', name: 'layers',
                                       factory: mDocument.getLayerFactory(), onChange: onLayersChanged});
        return params;
    }

    function getParams(){
        if (!mParams) {
            mParams = makeParams();
            mLayersValue = layersValue();
        }
        return mParams;
    }

    // the layers list as saved, the state an undo of a list edit returns to
    let mLayersValue = null;
    let mLayersRestoring = false;

    function layersValue(){
        return JSON.stringify(mParams.layers.getValue());
    }

    function restoreLayers(json){
        mLayersRestoring = true;
        try { mParams.layers.setValue(JSON.parse(json), true); }
        finally { mLayersRestoring = false; }
        mLayersValue = json;
    }

    // a layer was added, removed, moved or renamed in the layers list
    function onLayersChanged(){
        const ids = layerIds();
        if (!ids.includes(mConfig.layer)) mConfig.layer = ids[ids.length - 1];
        mDocument.setActiveLayer(mConfig.layer);
        if (mParams) {
            mParams.layer.updateChoices(ids);
            mParams.layer.updateDisplay();
        }
        mDocument.layersChanged();
        // an edit of the list is an undo step, between the item edits
        if (mParams && mEditor && !mLayersRestoring) {
            const now = layersValue();
            if (mLayersValue !== null && now !== mLayersValue) {
                const before = mLayersValue, after = now;
                mEditor.pushUndo({ label: 'layers', undo: () => restoreLayers(before), redo: () => restoreLayers(after) });
            }
            mLayersValue = now;
        }
    }

    //
    //  restore from a document; drawings saved in phase 0 kept all layers in
    //  one 'drawing' value: they go through the layers list, which shows them
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
    // an image file placed into the shape being edited, else into the pattern box
    async function openImage(){
        const file = await openFile([{ description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'] } }]);
        if (file && mEditor) await mEditor.importImageBlob(file);
    }

    async function openSvg(){
        const file = await openFile([{ description: 'SVG', accept: { 'image/svg+xml': ['.svg'] } }]);
        if (file && mEditor) mEditor.importSvgText(await file.text());
    }

    // an image of the drawing decoded: the buffers show it from now
    addImageListener(() => onChanged());

    function onChanged(){
        mNeedToRender = true;
        freeComponents(id => !mDocument.getLayer(id));
        informListeners();
    }

    function componentKey(id){
        return mGeometryVersion + '|' + mDocument.getLayerVersion(id);
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

    /** frees the component buffers of the layer ids that pass the test */
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
            render(mDocument.getLayerItems(id), comp.buffer);
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

    /** the items shown, as the sprites take them: [{item, layerId, opacity, cls}], bottom first */
    function spriteEntries(){
        const entries = [];
        for (const layer of mDocument.getLayers()) {
            if (!layer.isVisible()) continue;
            const opacity = layer.getOpacity();
            for (const item of layer.getItems()) entries.push({ item, layerId: layer.getId(), opacity, cls: item.style.motifClass ?? -1 });
        }
        return entries;
    }

    function getPatternData(renderParams){
        updatePatternTransform(renderParams && renderParams.patternTransConfig);
        if (renderParams && renderParams.visLayers) mMainUsed = needsMainBuffer(renderParams.visLayers);
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
    //  the buffer of the drawing layer with the id (a component of the pattern
    //  data), or null for an unknown id; the main buffer when that layer is the
    //  only visible one. A component asked for the first time is rendered here,
    //  while a visualization layer draws: it then leaves the GL state those
    //  layers set again (framebuffer, viewport, blending, program) at their
    //  defaults. It reads no GL state: that would wait for the GPU.
    //
    function getComponentBuffer(id){
        if (!mGL || !mDocument.getLayer(id)) return null;
        const visible = mDocument.getLayers().filter(l => l.isVisible());
        if (visible.length === 1 && visible[0].getId() === id) {
            renderMain();
            return mBuffer;
        }
        let comp = mComponents.get(id);
        if (!comp) {
            comp = { buffer: createPatternBuffer(), key: null, asked: false };
            mComponents.set(id, comp);
        }
        comp.asked = true;
        const key = componentKey(id);
        if (comp.key !== key) {
            const gl = mGL;
            render(mDocument.getLayerItems(id), comp.buffer);
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
        const groups = foldItems(items, mGroup, mPtc);
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
        };
    }

    function createUITool(par = {}){
        if (!mTools) {
            mEditor = DrawingEditor({
                document:   mDocument,
                getContext: () => ({ group: mGroup, ptc: mPtc, sprites: mConfig.sprites }),
                view:       par.view || canvasView(par.canvasTransform),
                repaint:    par.repaint,
            });
            mTools = [PolylineTool({ editor: mEditor }), SelectTool({ editor: mEditor })];
            mParams = null;     // the params get the editor's style settings
        }
        return mTools;
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
        getDocument:      () => mDocument,
        getEditor:        () => mEditor,
    };

    return myself;

} // function PatternDrawing()

const PatternDrawingCreator = {
    create:       (options) => PatternDrawing(options),
    getName:      () => `${MYNAME}-factory`,
    getClassName: () => MYNAME,
};

export { PatternDrawing, PatternDrawingCreator };
