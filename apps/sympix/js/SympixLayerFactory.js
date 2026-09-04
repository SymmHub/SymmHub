import {
    VisualizationImage,
    VisualizationOverlay,
    ObjectFactory,
} from './modules.js';

//
// SympixLayerFactory
//
// Standard layer factory for sympix apps: VisualizationImage + VisualizationOverlay.
// Signature: (getGLCtx, getOnChange, getChildren, getInitPar) => ObjectFactory
//
// Pass as options.layerFactory to VisualizationManager.
// The companion upgradeMapping for VisualizationManager.options.upgradeMapping is:
//   [
//       { key: 'image',   cls: 'VisualizationImage'   },
//       { key: 'overlay', cls: 'VisualizationOverlay'  },
//   ]
//
function SympixLayerFactory(getGLCtx, getOnChange, getChildren, getInitPar) {
    function makeUniqueName(baseName) {
        const existing = getChildren().map(l => l.getId()).filter(Boolean);
        if (!existing.includes(baseName)) return baseName;
        let n = 2;
        while (existing.includes(baseName + n)) n++;
        return baseName + n;
    }
    function make(ctor, baseName) {
        return () => {
            const id    = makeUniqueName(baseName);
            const layer = ctor({ config: { enabled: false }, id });
            const ctx   = getGLCtx();
            if (ctx) layer.init({ ...(getInitPar ? getInitPar() : {}), glCtx: ctx, onChange: getOnChange() });
            return layer;
        };
    }
    return ObjectFactory({
        defaultName: 'VisualizationImage',
        infoArray: [
            { name: 'VisualizationImage',   creator: make(VisualizationImage,   'image'  ) },
            { name: 'VisualizationOverlay', creator: make(VisualizationOverlay, 'overlay') },
        ],
    });
}

export { SympixLayerFactory };
