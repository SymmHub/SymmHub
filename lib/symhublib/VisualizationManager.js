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
    // Signature: (getGLCtx, getOnChange, getChildren) => ObjectFactory
    const layerFactoryFn = options.layerFactory || VisualizationLayerFactory;
    const mFactory = layerFactoryFn(
        () => mGLCtx,
        () => mOnChange,
        () => mLayerArray.getChildren(),
    );

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



    // ── public API ────────────────────────────────────────────────────────────

    return {
        getParams:       getParams,
        getClassName:    () => MYNAME,
        setParamsMap:    setParamsMap,
        init:            init,
        render:          render,
        checkLayerNames: checkLayerNames,  // debug — call anytime to inspect layer ids
    };

} // VisualizationManager

export { VisualizationManager };