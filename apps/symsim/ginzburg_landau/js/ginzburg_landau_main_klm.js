import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_KLM,
    makeSamplesArray,    
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
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}