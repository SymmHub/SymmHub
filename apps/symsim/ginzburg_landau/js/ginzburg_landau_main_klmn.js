import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_KLMN,
    makeSamplesArray,
    InversiveNavigator
    
}
from './modules.js';

import {
    presets
}
from './presets_klmn.js';

try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, 'presets/klmn/'),
        groupMaker:  new Group_KLMN(), // maker of the groups
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}