import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_WP,
    PlaneNavigator, 
    makeSamplesArray,
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
    });
    ss.run();

//} catch (err) {
//    console.error('error: ', err);
//}