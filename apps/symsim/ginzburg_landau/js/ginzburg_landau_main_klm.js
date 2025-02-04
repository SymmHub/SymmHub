import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_KLM,
}
from './modules.js';

import {
    ginzburg_landau_samples_klm
}
from './ginzburg_landau_samples_klm.js';

try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: ginzburg_landau_samples_klm,
        groupMaker:  new Group_KLM(), // maker of the groups
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}