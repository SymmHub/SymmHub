import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_WP,
    PlaneNavigator, 
    makeSamplesArray,
    InversiveNavigator,
    GroupMakerFactory, 
}
from './modules.js';

import {
    presets as presets_wp
} from './presets_wp.js';

//try {
    let ss = SymRenderer({
        patternCreator: GrayScottSimulationCreator,
        samples: makeSamplesArray(presets_wp, 'presets/wp/'),
        groupMakerFactory: GroupMakerFactory({defaultName: 'Wallpaper'}), 
        navigator:   new InversiveNavigator(),
    });
    ss.run();

//} catch (err) {
//    console.error('error: ', err);
//}