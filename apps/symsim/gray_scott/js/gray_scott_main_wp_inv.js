import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_WP,
    InversiveNavigator,
    PlaneNavigator, 
    makeSamplesArray,
    GroupMakerFactory,
}
from './modules.js';

import {
    presets
}
from './presets_wp_inv.js';

//try {
    let ss = SymRenderer({
        patternCreator:  GrayScottSimulationCreator,
        samples:     makeSamplesArray(presets, 'presets/wp_inv/'),
        groupMakerFactory: GroupMakerFactory({defaultName: 'Wallpaper'}), 
        navigator:   new InversiveNavigator(),
    });
    ss.run();

//} catch (err) {
//    console.error('error: ', err);
//}