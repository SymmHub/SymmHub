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
from './presets_5splanes.js';

let presets_dir = 'presets/5splanes/';
try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, presets_dir),
        groupMakerFactory: GroupMakerFactory({defaultName: '5 Splanes'}),         
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}