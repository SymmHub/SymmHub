
import { 
    GroupMakerFactory, 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    PatternImageCreator,
    SympixLayerFactory,
} from "./modules.js";

import {
    presets
} from './presets_22222.js';
 

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
      patternCreator:       PatternImageCreator,
      visualization:    visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'22222'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/22222/'),
});

app.run();

