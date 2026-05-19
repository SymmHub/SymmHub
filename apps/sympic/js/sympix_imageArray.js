
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_imageArray.js';
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
      patternCreator:    PatternImageArrayCreator,
      visualization:    visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'Wallpaper'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/imageArray/'),
});

app.run();

