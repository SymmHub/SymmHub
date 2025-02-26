import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_WP,
    PlaneNavigator, 
    makeSamplesArray,
    InversiveNavigator,
}
from './modules.js';

import {
    presets as presets_wp
} from './presets_wp.js';

//try {
    let ss = SymRenderer({
        simCreator: GrayScottSimulationCreator,
        samples: makeSamplesArray(presets_wp, 'presets/wp/'),
        groupMaker:  new Group_WP({type: '333',a: 0.4}), // maker of the groups
        navigator:   new InversiveNavigator(),
    });
    ss.run();

//} catch (err) {
//    console.error('error: ', err);
//}