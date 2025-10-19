
import { 
    Group_KLM, 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    IteratedAttractorCreator,
} from "./modules.js";

import {
    presets
} from './presets_klm.js';
 
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
      groupMaker: new Group_KLM({k:2, l:3, m:3, s:true}), // maker of the groups
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/klm/'),
});

app.run();

