import {
    SymRenderer,
    GinzburgLandauSimulationCreator,
    Group_WP,
}
from './modules.js';

import {
    ginzburg_landau_samples_wp
}
from './ginzburg_landau_samples_wp.js';

//try {
    let ss = SymRenderer({
        simCreator: GinzburgLandauSimulationCreator,
        samples: ginzburg_landau_samples_wp,
        groupMaker:  new Group_WP({type: '2222',a: 0.4}), // maker of the groups
    });
    ss.run();
//} catch (err) {
//    console.error('error: ', err);
//}