import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_KLMN,
}
from './modules.js';

import {
    ginzburg_landau_samples_klmn
}
from './ginzburg_landau_samples_klmn.js';

try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: ginzburg_landau_samples_klmn,
        groupMaker:  new Group_KLMN(), // maker of the groups
    });
    ss.run();
} catch (err) {
    console.error('error: ', err);
}