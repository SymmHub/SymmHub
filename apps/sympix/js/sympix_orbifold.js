
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
    SympixLayerFactory,
    buildOrbifoldMenu,
} from "./modules.js";

import {
    presets
} from './presets_orbifold.js';
 

const visManager = VisualizationManager({
    layerFactory: SympixLayerFactory,
    upgradeMapping: [
        { key: 'image',   cls: 'VisualizationImage'   },
        { key: 'overlay', cls: 'VisualizationOverlay'  },
    ],
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
      patternCreator:    PatternImageArrayCreator,
      visualization:     visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'Orbifold'}),
      navigator:         new InversiveNavigator(),
      samples:           makeSamplesArray(presets, 'presets/orbifold/'),
      // the page opens on a pattern of two images in 2*34 rather than the bare defaults
      preset:            'presets/orbifold/basic_default.json',
      // the page's own layout of the settings panel (OrbifoldMenu.js)
      menuBuilder:       buildOrbifoldMenu,
});

app.run();

