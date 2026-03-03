import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    makeSamplesArray,
    InversiveNavigator,
    GroupMakerFactory,
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
        groupMakerFactory: GroupMakerFactory({defaultName: 'Wallpaper'}),         
        navigator:  new InversiveNavigator(),
    });
    ss.run();
//} catch (err) {
//    console.error('error: ', err);
//}