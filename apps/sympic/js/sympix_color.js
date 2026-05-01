
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationOverlay,
    VisualizationColorSym,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_color.js';

const visManager = VisualizationManager({
      visLayers: [
        {
            name: 'image',
            visLayer: VisualizationColorSym(),
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
      samples:          makeSamplesArray(presets, 'presets/color/'),
});

app.run();

