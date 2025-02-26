import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_WP,
    makeSamplesArray,
    InversiveNavigator,
}
from './modules.js';

import {
    presets
}
from './presets_wp.js';

//try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, 'presets/wp/'),
        groupMaker:  new Group_WP({type: '2222',a: 0.4}), // maker of the groups
        navigator:  new InversiveNavigator(),
    });
    ss.run();
//} catch (err) {
//    console.error('error: ', err);
//}