
import { 
    Group_WP, 
    InversiveNavigator,
    VisualizationManager,
    VisualizationColormap,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    IteratedAttractorCreator,
} from "./modules.js";

import {
    presets
} from './presets.js';
 
const visManager = VisualizationManager({
      visLayers: [
        {
            name: 'colormap',
            visLayer: VisualizationColormap(),
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
      groupMaker: new Group_WP({type: '2222',a: 0.4}), // maker of the groups
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/'),
});

app.run();

