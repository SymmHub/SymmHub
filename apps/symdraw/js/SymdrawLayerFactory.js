import {
    VisualizationColorSym,
    VisualizationColorTiles,
    VisualizationImage,
    VisualizationOverlay,
    ObjectFactory,
} from './modules.js';

//
// SymdrawLayerFactory
//
// The layers the "+" menu of the visualization layers offers in symdraw.
// Signature: (getGLCtx, getOnChange, getChildren, getInitPar) => ObjectFactory,
// passed as options.layerFactory to VisualizationManager.
//
function SymdrawLayerFactory(getGLCtx, getOnChange, getChildren, getInitPar) {
    function makeUniqueName(baseName) {
        const existing = getChildren().map(l => l.getId()).filter(Boolean);
        if (!existing.includes(baseName)) return baseName;
        let n = 2;
        while (existing.includes(baseName + n)) n++;
        return baseName + n;
    }
    function make(ctor, baseName, config = {}) {
        return () => {
            const id    = makeUniqueName(baseName);
            const layer = ctor({ config: { enabled: true, ...config }, id });
            const ctx   = getGLCtx();
            if (ctx) layer.init({ ...(getInitPar ? getInitPar() : {}), glCtx: ctx, onChange: getOnChange() });
            return layer;
        };
    }
    return ObjectFactory({
        defaultName: 'VisualizationColorSym',
        infoArray: [
            { name: 'VisualizationColorSym',   label: 'Color Images', creator: make(VisualizationColorSym, 'drawing', { useCrown: true }) },
            { name: 'VisualizationColorTiles', label: 'Color Tiles',  creator: make(VisualizationColorTiles, 'colorTiles') },
            { name: 'VisualizationImage',      label: 'Image',        creator: make(VisualizationImage, 'image') },
            { name: 'VisualizationOverlay',    label: 'Overlay',      creator: make(VisualizationOverlay, 'overlay') },
        ],
    });
}

export { SymdrawLayerFactory };
