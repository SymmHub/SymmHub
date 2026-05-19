import {    
    ParamObjArray,
    ObjArray,
    setParamValues,

    VisualizationOptions,
    VisualizationLayerFactory,
    makeDefaultLayers,

} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationManager';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;


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
    // Falls back to the standard set (colormap / texmap / bumpmap / overlay).
    const mUpgradeMapping = options.upgradeMapping || [
        { key: 'colormap',  cls: 'VisualizationColormap' },
        { key: 'colormap2', cls: 'VisualizationColormap' },
        { key: 'texmap',    cls: 'VisualizationTexmap'   },
        { key: 'bumpmap',   cls: 'VisualizationBumpmap'  },
        { key: 'overlay',   cls: 'VisualizationOverlay'  },
    ];

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
        if (DEBUG) console.log(`${MYNAME}.setParamsMap() input:`, par);
        par = upgradeData(par);
        console.log(`${MYNAME}.setParamsMap() after upgradeData:`, JSON.parse(JSON.stringify(par)));
        setParamValues(mParams, par, initialize);
    }

    // ── upgrade paths ─────────────────────────────────────────────────────────

    function upgradeData(par) {
        if (par.renderStyle) par = upgradeData_v1(par);  // very old format
        if (!par.layers)     par = upgradeData_v2(par);  // old flat-key format → ObjArray
        return par;
    }

    // Convert very old format (renderStyle field) — pre-existing logic.
    function upgradeData_v1(par) {
        let renderStyle = par.renderStyle;
        par.texmap  = par.texture;
        par.bumpmap = par.bump;
        par.colormap.enabled = false;
        par.bumpmap.enabled  = false;
        par.texmap.enabled   = false;

        let dataSource = DataSourceNames[0];
        switch (par.options?.visualComponent) {
            default: break;
            case 0: dataSource = 'u';        break;
            case 1: dataSource = 'v';        break;
            case 4: dataSource = 'mod(uv)';  break;
            case 5: dataSource = 'arg(uv)';  break;
        }

        if (par.overlayVis)  par.overlay = par.overlayVis;
        if (!par.overlay)    par.overlay = {};
        if (par.isolines)    par.overlay.isolines = par.isolines;

        if (par.colormap.transparency)
            par.colormap.opacity = 1 - par.colormap.transparency;

        let activePar = par.colormap;
        switch (renderStyle) {
            case 'bumpmap':  activePar = par.bumpmap;  break;
            case 'texture':  activePar = par.texmap;   break;
            case 'colormap': activePar = par.colormap; break;
        }
        activePar.enabled    = true;
        activePar.dataSource = dataSource;

        return par;
    }

    // Convert old flat-key format { imageColorSym:{...}, overlay:{...}, ... }
    // to the new ObjArray envelope expected by ParamObjArray.setValue().
    function upgradeData_v2(par) {
        const children = mUpgradeMapping
            .filter(({ key }) => par[key] !== undefined)
            .map(({ key, cls }) => {
                const raw = par[key];
                // par[key] may be a plain flat object (very old format) or already
                // ParamObj-serialized ({ className, params }) from the previous code.
                // Unwrap the inner params if present to avoid double-nesting.
                const flatParams = (raw && raw.params && typeof raw.params === 'object')
                    ? raw.params
                    : raw;
                return {
                    className: cls,
                    // Inject the id so it is restored as the folder name.
                    params: { id: key, ...flatParams },
                };
            });

        return {
            layers: {
                className: 'ObjArray',
                params: { id: 'layers', children },
            },
        };
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        getParams:    getParams,
        getClassName: () => MYNAME,
        setParamsMap: setParamsMap,
        init:         init,
        render:       render,
    };

} // VisualizationManager

export { VisualizationManager };