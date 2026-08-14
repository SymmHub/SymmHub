
import { 
    GroupMakerFactory, 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    PatternImageCreator,
} from "./modules.js";

import {
    presets
} from './presets_5splanes.js';
import { SympixLayerFactory } from './SympixLayerFactory.js';
 

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
      groupMakerFactory: GroupMakerFactory({defaultName:'5 Splanes'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/5splanes/'),
});

app.run();

