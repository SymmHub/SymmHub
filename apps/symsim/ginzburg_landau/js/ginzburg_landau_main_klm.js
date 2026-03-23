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
from './presets_klm.js';

try {
    let ss = SymRenderer({
        patternCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, 'presets/klm/'),
        groupMakerFactory: GroupMakerFactory({defaultName: 'KLM'}),         
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}