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
from './presets_klmn.js';

try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, 'presets/klmn/'),
        groupMakerFactory: GroupMakerFactory({defaultName: 'KLMN'}),         
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}