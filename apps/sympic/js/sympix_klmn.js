
import { 
    Group_KLMN, 
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
} from './presets_klmn.js';
 
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
      groupMaker:       new Group_KLMN(), // maker of the groups
      navigator:        new InversiveNavigator(),
      samples:          makeSamplesArray(presets, 'presets/klmn/'),
});

app.run();

