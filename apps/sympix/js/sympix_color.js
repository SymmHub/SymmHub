
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationOverlay,
    OverlayIsolines,
    OverlayWorldGrid,
    OverlayScreenGrid,
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
// Signature: (getGLCtx, getOnChange, getChildren, getInitPar) => ObjectFactory
function SympixLayerFactory(getGLCtx, getOnChange, getChildren, getInitPar) {
    function makeUniqueName(baseName) {
        const existing = getChildren().map(l => l.getId()).filter(Boolean);
        if (!existing.includes(baseName)) return baseName;
        let n = 2;
        while (existing.includes(baseName + n)) n++;
        return baseName + n;
    }
    function make(ctor, baseName, enabled = false) {
        return () => {
            const id    = makeUniqueName(baseName);
            const layer = ctor({ config: { enabled }, id });
            const ctx   = getGLCtx();
            if (ctx) layer.init({ ...(getInitPar ? getInitPar() : {}), glCtx: ctx, onChange: getOnChange() });
            return layer;
        };
    }
    return ObjectFactory({
        defaultName: 'VisualizationColorSym',
        infoArray: [
            { name: 'VisualizationColorSym',   label: 'Color Images', creator: make(VisualizationColorSym, 'Color Images') },
            { name: 'VisualizationColorTiles', label: 'Color Tiles',  creator: make(VisualizationColorTiles, 'Color Tiles') },
            { name: 'VisualizationImage',      label: 'Image',        creator: make(VisualizationImage,    'image'        ) },
            { name: 'VisualizationOverlay',    label: 'Overlay',      creator: make(VisualizationOverlay,  'overlay'      ) },
            // general overlay items, usable as layers of their own (e.g. isolines between the image and the colour tiles)
            { name: 'OverlayIsolines',         label: 'isolines',     creator: make(OverlayIsolines,   'isolines',   true) },
            { name: 'OverlayWorldGrid',        label: 'world grid',   creator: make(OverlayWorldGrid,  'worldGrid',  true) },
            { name: 'OverlayScreenGrid',       label: 'screen grid',  creator: make(OverlayScreenGrid, 'screenGrid', true) },
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
