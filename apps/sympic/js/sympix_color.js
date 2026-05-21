
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationOverlay,
    VisualizationColorSym,
    VisualizationColorTiles,
    VisualizationImage,
    ObjectFactory,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_color.js';

// ── Custom layer factory for sympix_color ─────────────────────────────────────
// Signature: (getGLCtx, getOnChange, getChildren) => ObjectFactory
function SympixLayerFactory(getGLCtx, getOnChange, getChildren) {
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
        defaultName: 'VisualizationColorSym',
        infoArray: [
            { name: 'VisualizationColorSym',   creator: make(VisualizationColorSym, 'imageColorSym') },
            { name: 'VisualizationColorTiles', creator: make(VisualizationColorTiles, 'colorTiles') },
            { name: 'VisualizationImage',      creator: make(VisualizationImage,    'image'        ) },
            { name: 'VisualizationOverlay',    creator: make(VisualizationOverlay,  'overlay'      ) },
        ],
    });
}

const visManager = VisualizationManager({
    layerFactory: SympixLayerFactory,
    upgradeMapping: [
        { key: 'imageColorSym', cls: 'VisualizationColorSym'   },
        { key: 'colorTiles',    cls: 'VisualizationColorTiles' },
        { key: 'image',         cls: 'VisualizationImage'      },
        { key: 'overlay',       cls: 'VisualizationOverlay'    },
    ],
    visLayers: [
        { name: 'colorTiles',    visLayer: VisualizationColorTiles({ config: { enabled: true  } }) },
        { name: 'imageColorSym', visLayer: VisualizationColorSym({ config: { enabled: true  } }) },
        { name: 'overlay',       visLayer: VisualizationOverlay( { config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
    patternCreator:    PatternImageArrayCreator,
    visualization:    visManager, 
    groupMakerFactory: GroupMakerFactory({defaultName:'Wallpaper'}),
    navigator:        new InversiveNavigator(),
    samples:          makeSamplesArray(presets, 'presets/color/'),
});

app.run();
