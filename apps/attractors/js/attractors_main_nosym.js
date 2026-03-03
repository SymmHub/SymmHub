
import { 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    IteratedAttractorCreator,
    GroupMakerFactory,
} from "./modules.js";

import {
    presets
} from './presets_nosym.js';
 
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
      simCreator: IteratedAttractorCreator,
      visualization: visManager, 
      groupMakerFactory: GroupMakerFactory(), 
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/nosym/'),
});

app.run();

