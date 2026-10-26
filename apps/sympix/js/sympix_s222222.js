
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
} from './presets_s222222.js';
 

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
      groupMakerFactory: GroupMakerFactory({defaultName:'*222222'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/s222222/'),
});

app.run();

