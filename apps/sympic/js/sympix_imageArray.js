
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

const visManager = VisualizationManager({
      visLayers: [
        {
            name: 'image',
            visLayer: VisualizationImage(),
        },
        {
            name: 'overlay',
            visLayer: VisualizationOverlay(),
        }
      ]
});

const app = SymRenderer({
      patternCreator:    PatternImageArrayCreator,
      visualization:    visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'Wallpaper'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/imageArray/'),
});

app.run();

