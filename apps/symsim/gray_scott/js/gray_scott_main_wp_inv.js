import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_WP,
    InversiveNavigator,
    PlaneNavigator, 
    makeSamplesArray,
}
from './modules.js';

import {
    presets
}
from './presets_wp_inv.js';

//try {
    let ss = SymRenderer({
        simCreator:  GrayScottSimulationCreator,
        samples:     makeSamplesArray(presets, 'presets/wp_inv/'),
        groupMaker:  new Group_WP({type: '333',a: 0.4}), // maker of the groups
        navigator:   new InversiveNavigator(),
    });
    ss.run();

//} catch (err) {
//    console.error('error: ', err);
//}