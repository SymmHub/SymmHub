/*
  catalog_render.js — boot for the catalog batch renderer.

  Same stack as sympix_color.js, plus the catalog driver script loaded at
  startup (SymRenderer options.scriptUrl).  The driver exposes window.catalog
  for interactive use and runs a job when the page URL carries ?job=<url>.
*/

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
        defaultName: 'VisualizationColorSym',
        infoArray: [
            { name: 'VisualizationColorSym',   label: 'Color Images', creator: make(VisualizationColorSym, 'Color Images') },
            { name: 'VisualizationColorTiles', label: 'Color Tiles',  creator: make(VisualizationColorTiles, 'Color Tiles') },
            { name: 'VisualizationImage',      label: 'Image',        creator: make(VisualizationImage,    'image'        ) },
            { name: 'VisualizationOverlay',    label: 'Overlay',      creator: make(VisualizationOverlay,  'overlay'      ) },
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
    scriptUrl:        './scripts/catalog_driver.js',
});

app.run();
