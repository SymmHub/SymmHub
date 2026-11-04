
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationOverlay,
    VisualizationColorSym,
    SympixColorLayerFactory,
    VisualizationColorTiles,
    VisualizationImage,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_color.js';


const visManager = VisualizationManager({
    layerFactory: SympixColorLayerFactory,
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
