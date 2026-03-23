
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
} from './presets_klx.js';
 
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
      patternCreator:       PatternImageCreator,
      visualization:    visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'KLx'}),
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/klx/'),
});

app.run();

