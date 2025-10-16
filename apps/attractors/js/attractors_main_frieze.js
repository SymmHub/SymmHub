
import { 
    Group_Frieze, 
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
} from './presets_frieze.js';
 
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
      groupMaker: new Group_Frieze({type: '*22∞',a: 0.4}), // maker of the groups
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/frieze/'),
});

app.run();

