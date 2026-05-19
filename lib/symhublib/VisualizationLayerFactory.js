import {
    ObjectFactory,
    VisualizationColormap,
    VisualizationTexmap,
    VisualizationBumpmap,
    VisualizationOverlay,
} from './modules.js';

// ── Default layer list ───────────────────────────────────────────────────────
// Each entry: { name, visLayer }. The name becomes the layer's editable id.
function makeDefaultLayers() {
    return [
        { name: 'colormap',  visLayer: VisualizationColormap({ config: { enabled: true  } }) },
        { name: 'colormap2', visLayer: VisualizationColormap({ config: { enabled: false } }) },
        { name: 'texmap',    visLayer: VisualizationTexmap(  { config: { enabled: false } }) },
        { name: 'bumpmap',   visLayer: VisualizationBumpmap( { config: { enabled: false } }) },
        { name: 'overlay',   visLayer: VisualizationOverlay( { config: { enabled: false } }) },
    ];
}

// ── Factory ───────────────────────────────────────────────────────────────────
// A factory-creator function for the standard set of visualization layers.
// Signature: (getGLCtx, getOnChange, getChildren) => ObjectFactory
//
// getGLCtx    : () => glCtx   — returns the current GL context (may be null before init)
// getOnChange : () => fn      — returns the current onChange callback
// getChildren : () => layer[] — returns the current live layer list (for unique naming)
//
// Returns an ObjectFactory whose getObject(className) creates a fully initialized
// layer with a collision-free default id (e.g. 'colormap3').
//
function VisualizationLayerFactory(getGLCtx, getOnChange, getChildren) {

    // Return the next unused id for a given base name.
    // E.g. if 'colormap' and 'colormap2' exist, returns 'colormap3'.
    function makeUniqueName(baseName) {
        const existing = getChildren().map(l => l.getId()).filter(Boolean);
        if (!existing.includes(baseName)) return baseName;
        let n = 2;
        while (existing.includes(baseName + n)) n++;
        return baseName + n;
    }

    // Build a creator thunk for a given layer constructor / default config / base name.
    function make(ctor, cfg, baseName) {
        return () => {
            const id    = makeUniqueName(baseName);
            const layer = ctor({ config: cfg, id });
            const ctx   = getGLCtx();
            if (ctx) layer.init({ glCtx: ctx, onChange: getOnChange() });
            return layer;
        };
    }

    return ObjectFactory({
        defaultName: 'VisualizationColormap',
        infoArray: [
            { name: 'VisualizationColormap', creator: make(VisualizationColormap, { enabled: false }, 'colormap') },
            { name: 'VisualizationTexmap',   creator: make(VisualizationTexmap,   { enabled: false }, 'texmap'  ) },
            { name: 'VisualizationBumpmap',  creator: make(VisualizationBumpmap,  { enabled: false }, 'bumpmap' ) },
            { name: 'VisualizationOverlay',  creator: make(VisualizationOverlay,  { enabled: false }, 'overlay' ) },
        ],
    });
}

export { VisualizationLayerFactory, makeDefaultLayers };
