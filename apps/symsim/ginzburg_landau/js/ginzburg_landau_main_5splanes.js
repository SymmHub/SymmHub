import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    makeSamplesArray,    
    InversiveNavigator,
}
from './modules.js';

import {
    Group_5splanes as GroupMaker,
} from './modules.js';


import {
    presets
}
from './presets_5splanes.js';

let presets_dir = 'presets/5splanes/';
try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: makeSamplesArray(presets, presets_dir),
        groupMaker:  new GroupMaker(), // maker of the groups
        navigator: new InversiveNavigator(),
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}