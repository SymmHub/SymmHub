import {    
    ParamObjArray,
    ObjArray,
    setParamValues,

    VisualizationLayerFactory,
    makeDefaultLayers,

} from './modules.js';

import {
    upgradeData as upgradeDataFn,
    checkLayerNames as checkLayerNamesFn,
    defaultUpgradeMapping,
} from './VisualizationManagerUpgradeData.js';

const DEBUG = true;
const MYNAME = 'VisualizationManager';


// ── VisualizationManager ──────────────────────────────────────────────────────

function VisualizationManager(options = {}) {

    let mGLCtx    = null;
    let mOnChange = null;

    // Build the initial layer list from options.visLayers or defaults.
    // The entry name becomes the layer's editable id.
    const rawLayers = options.visLayers || makeDefaultLayers();
    rawLayers.forEach(({ name, visLayer }) => visLayer.setId(name));

    // Caller-supplied upgrade mapping for old flat-key JSON files.
    // Each entry: { key: string, cls: string }.
    // Falls back to the standard set defined in VisualizationManagerUpgradeData.
    const mUpgradeMapping = options.upgradeMapping || defaultUpgradeMapping;

    // Factory creator — caller may supply a custom one via options.layerFactory.
    // Signature: (getGLCtx, getOnChange, getChildren, getInitPar) => ObjectFactory
    // getInitPar returns the arguments init() received, so that a layer made
    // later can be initialized like the initial ones.
    const layerFactoryFn = options.layerFactory || VisualizationLayerFactory;
    const mFactory = layerFactoryFn(
        () => mGLCtx,
        () => mOnChange,
        () => mLayerArray.getChildren(),
        () => mInitPar,
    );
    let mInitPar = null;

    // ObjArray wrapping all layers.
    const mLayerArray = ObjArray({
        id:       'layers',
        children: rawLayers.map(({ visLayer }) => visLayer),
        factory:  mFactory,
    });

    // ParamObjArray holder — ParamObjArray needs obj[key] access.
    const mLayerHolder = { layers: mLayerArray };

    let mParams = null;

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        return {
            layers: ParamObjArray({
                obj:      mLayerHolder,
                key:      'layers',
                name:     'visualization layers',
                factory:  mFactory,
                onChange: () => { if (mOnChange) mOnChange(); },
            }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(par) {
        mInitPar  = par;
        mGLCtx    = par.glCtx;
        mOnChange = par.onChange;
        for (const layer of mLayerArray.getChildren()) {
            layer.init(par);
        }
        mParams = makeParams();
    }

    function render(par) {
        for (const layer of mLayerArray.getChildren()) {
            if (layer.enabled) layer.render(par);
        }
    }

    /**
     * The renderer's group changed.  Layers which keep group dependent data
     * (the subgroup tables of the colour layers) get told, enabled or not.
     * @param {object} group  the new group
     */
    function onGroupChanged(group) {
        for (const layer of mLayerArray.getChildren()) {
            if (layer.onGroupChanged) layer.onGroupChanged(group);
        }
    }

    // ── serialization ─────────────────────────────────────────────────────────

    function setParamsMap(par, initialize) {
        if (DEBUG) console.log(`${MYNAME}.setParamsMap() input:`, JSON.parse(JSON.stringify(par)));
        if (DEBUG) checkLayerNames('BEFORE setParamsMap');
        par = upgradeData(par);
        if(DEBUG)console.log(`${MYNAME}.setParamsMap() after upgradeData():`, JSON.parse(JSON.stringify(par)));
        setParamValues(mParams, par, initialize);
        if (DEBUG) checkLayerNames('AFTER setParamsMap');
    }

    function checkLayerNames(tag) {
        return checkLayerNamesFn(tag, mParams, mLayerArray);
    }

    function upgradeData(par) {
        return upgradeDataFn(par, mUpgradeMapping);
    }



    // ── layer accessors (for scripting) ──────────────────────────────────────

    /**
     * Return a visualization layer by its id (the name set in the entry point).
     * @param {string} name  e.g. 'imageColorSym', 'colorTiles', 'overlay'
     * @returns {object|undefined}
     */
    function getLayer(name) {
        return mLayerArray.getChildren().find(l => l.getId() === name);
    }

    /**
     * Return all visualization layers.
     * @returns {object[]}
     */
    function getLayers() {
        return mLayerArray.getChildren();
    }

    /**
     * The union of the image ids that are actually being displayed, across
     * every enabled layer that composites pattern images.
     *
     * Returns null to mean "no filter — treat every image as visible". That is
     * the answer when no enabled layer restricts the set: either because a
     * layer's "visible images" field is blank (blank = show them all), or
     * because no layer composites images at all (every non-image app). Callers
     * use it to filter to the visible images and must handle null.
     *
     * @returns {string[]|null}
     */
    function getVisibleImageIds() {
        const ids = new Set();
        let sawImageLayer = false;

        for (const layer of mLayerArray.getChildren()) {
            if (!layer || !layer.enabled) continue;
            if (typeof layer.getVisibleImageIds !== 'function') continue;
            sawImageLayer = true;
            const layerIds = layer.getVisibleImageIds();
            // blank field on an enabled layer => that layer shows everything
            if (layerIds === null) return null;
            layerIds.forEach(id => ids.add(id));
        }

        // Nothing enabled restricts the set: don't filter. (Notably this keeps
        // the pattern-transform tool usable when every image layer is disabled,
        // rather than leaving it with nothing to grab.)
        if (!sawImageLayer) return null;
        return [...ids];
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        getParams:       getParams,
        getClassName:    () => MYNAME,
        setParamsMap:    setParamsMap,
        init:            init,
        render:          render,
        onGroupChanged:  onGroupChanged,
        checkLayerNames: checkLayerNames,  // debug — call anytime to inspect layer ids
        getLayer:        getLayer,
        getLayers:       getLayers,
        getVisibleImageIds: getVisibleImageIds,
    };

} // VisualizationManager

export { VisualizationManager };
