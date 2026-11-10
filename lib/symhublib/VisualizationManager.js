import {    
    ParamObjArray,
    ObjArray,
    setParamValues,

    VisualizationLayerFactory,
    makeDefaultLayers,
    upgradeData as upgradeDataFn,
    checkLayerNames as checkLayerNamesFn,
    defaultUpgradeMapping,
    renameInImageList,
} from './modules.js';

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

    // a change of a layer or of the list: the renderer draws again, and the
    // listeners (the layers window) hear of it. par.components (optional): the
    // pattern's names for the images lists ({getTree, getSelectedIds,
    // addListener}, SymRenderer); the layers get it with the rest, and
    // onComponentsChanged() when the names changed
    function init(par) {
        const outer = par.onChange;
        mOnChange = (p) => { if (outer) outer(p); notify(); };
        mInitPar  = { ...par, onChange: mOnChange };
        mGLCtx    = par.glCtx;
        own(() => {
            for (const layer of mLayerArray.getChildren()) {
                layer.init(mInitPar);
            }
        });
        if (par.components) {
            par.components.addListener(() => own(() => {
                for (const layer of mLayerArray.getChildren()) layer.onComponentsChanged?.();
            }));
        }
        mParams = makeParams();
    }

    // ── listeners ─────────────────────────────────────────────────────────────

    const mListeners = new Set();

    // inside a change the manager makes itself, and inside a load
    let mOwn = 0;
    let mLoading = 0;
    function own(fn) { mOwn++; try { return fn(); } finally { mOwn--; } }

    /**
     * fn(info) is called after any change of the layers: one of their values,
     * the list (add, remove, move, rename), a document loaded. info.system:
     * the manager's own change (a document loaded, the group changed, a name
     * of the pattern changed), not an edit of the user (the layers window's
     * undo records those); info.load: a document loaded.
     */
    function addListener(fn) { mListeners.add(fn); }
    function removeListener(fn) { mListeners.delete(fn); }
    function notify() {
        const info = { system: mOwn > 0, load: mLoading > 0 };
        for (const fn of mListeners) fn(info);
    }

    /**
     * The kinds a new layer can be: [{name, label}], name the class name.
     */
    function getLayerKinds() {
        return mFactory.getNames().map(name => ({ name, label: mFactory.getLabel ? mFactory.getLabel(name) : name }));
    }

    // par.timing (a FrameTiming, optional) gets one section per enabled layer, named by the layer id.
    // The symmetry is the layer's own (useSymmetry, on for a layer without it): its
    // uSymmetry goes over the common uniforms (par.renderUni)
    function render(par) {
        const timing = par.timing;
        for (const layer of mLayerArray.getChildren()) {
            if (!layer.enabled) continue;
            const sym = layer.useSymmetry !== false;
            const lp = { ...par, useSymmetry: sym, renderUni: { ...par.renderUni, uSymmetry: sym } };
            if (timing) timing.section(layer.getId() || layer.getClassName(), () => layer.render(lp));
            else layer.render(lp);
        }
    }

    /**
     * The renderer's group changed.  Layers which keep group dependent data
     * (the subgroup tables of the colour layers) get told, enabled or not.
     * @param {object} group  the new group
     */
    function onGroupChanged(group) {
        own(() => {
            for (const layer of mLayerArray.getChildren()) {
                if (layer.onGroupChanged) layer.onGroupChanged(group);
            }
        });
    }

    /**
     * The table of subgroups of the group is ready (SubgroupTables.js): the message
     * 'Group Presentation Changed'. Layers get it enabled or not, like onGroupChanged.
     * @param {object} info  the table info
     */
    function onPresentationChanged(info) {
        own(() => {
            for (const layer of mLayerArray.getChildren()) {
                if (layer.onPresentationChanged) layer.onPresentationChanged(info);
            }
        });
    }

    /**
     * A component of the pattern data was renamed.  The layers listing it in
     * their imageId follow, in whichever coset it is (ImageList.js); the
     * other ids of their lists stay.
     * @param {string} from  the old id
     * @param {string} to    the new id
     */
    function renameComponent(from, to) {
        own(() => {
            for (const layer of mLayerArray.getChildren()) {
                const param = layer.getParams().imageId;
                if (!param) continue;
                const value = param.getValue() || '';
                const renamed = renameInImageList(value, from, to);
                if (renamed !== value) param.setValue(renamed);
            }
        });
    }

    // ── serialization ─────────────────────────────────────────────────────────

    function setParamsMap(par, initialize) {
        if (DEBUG) console.log(`${MYNAME}.setParamsMap() input:`, JSON.parse(JSON.stringify(par)));
        if (DEBUG) checkLayerNames('BEFORE setParamsMap');
        par = upgradeData(par);
        if(DEBUG)console.log(`${MYNAME}.setParamsMap() after upgradeData():`, JSON.parse(JSON.stringify(par)));
        mLoading++;
        try {
            own(() => setParamValues(mParams, par, initialize));
            if (DEBUG) checkLayerNames('AFTER setParamsMap');
            own(notify);
        } finally {
            mLoading--;
        }
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

    // ── public API ────────────────────────────────────────────────────────────

    return {
        getParams:       getParams,
        getClassName:    () => MYNAME,
        setParamsMap:    setParamsMap,
        init:            init,
        render:          render,
        onGroupChanged:  onGroupChanged,
        onPresentationChanged: onPresentationChanged,
        renameComponent: renameComponent,
        checkLayerNames: checkLayerNames,  // debug — call anytime to inspect layer ids
        getLayer:        getLayer,
        getLayers:       getLayers,
        getLayerKinds:   getLayerKinds,
        addListener:     addListener,
        removeListener:  removeListener,
    };

} // VisualizationManager

export { VisualizationManager };
