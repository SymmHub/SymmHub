import {
    VisualizationImage,
    VisualizationOverlay,
    ObjectFactory,
} from './modules.js';

//
// ImageLayerFactory
//
// Standard layer factory for apps that render data as a plain image plus an overlay.
// Offers two layer types: VisualizationImage and VisualizationOverlay.
// Signature: (getGLCtx, getOnChange, getChildren) => ObjectFactory
//
// Pass as options.layerFactory to VisualizationManager.
// The companion upgradeMapping for VisualizationManager.options.upgradeMapping is:
//   [
//       { key: 'image',   cls: 'VisualizationImage'   },
//       { key: 'overlay', cls: 'VisualizationOverlay'  },
//   ]
//
function ImageLayerFactory(getGLCtx, getOnChange, getChildren) {
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
            if (ctx) layer.init({ glCtx: ctx, onChange: getOnChange() });
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

// Standard upgrade mapping for old flat-key JSON files saved by these apps.
const ImageLayerUpgradeMapping = [
    { key: 'image',   cls: 'VisualizationImage'  },
    { key: 'overlay', cls: 'VisualizationOverlay' },
];

export { ImageLayerFactory, ImageLayerUpgradeMapping };
