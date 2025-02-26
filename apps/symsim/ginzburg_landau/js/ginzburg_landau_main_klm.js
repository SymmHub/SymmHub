import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_KLM,
    makeSamplesArray,    
    InversiveNavigator,
}
from './modules.js';

import {
    presets
}
from './presets_klm.js';

try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, 'presets/klm/'),
        groupMaker:  new Group_KLM(), // maker of the groups
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}