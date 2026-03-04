
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
} from './presets_spherical.js';
 
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
      simCreator:       PatternImageCreator,
      visualization:    visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'Spherical'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/spherical/'),
});

app.run();

