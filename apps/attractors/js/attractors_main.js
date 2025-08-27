
import { 
    Group_WP, 
    InversiveNavigator,
    SymRenderer,
    makeSamplesArray,
    IteratedAttractorCreator,
} from "./modules.js";

import {
    presets
} from './presets.js';
 


const app = SymRenderer({
      simCreator: IteratedAttractorCreator,
      groupMaker: new Group_WP({type: '2222',a: 0.4}), // maker of the groups
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/'),
});

app.run();

