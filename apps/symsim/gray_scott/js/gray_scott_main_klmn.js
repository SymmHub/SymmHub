import {
    SymRenderer,
    GrayScottSimulationCreator,
    Group_KLMN,
    makeSamplesArray,
    InversiveNavigator,

}
from './modules.js';

import {
    presets as presets_klmn
}
from './presets_klmn.js';

try {
    let ss = SymRenderer({
        simCreator: GrayScottSimulationCreator,
        samples: makeSamplesArray(presets_klmn, 'presets/klmn/'),
        groupMaker:  new Group_KLMN({}), // maker of the groups
        navigator:   new InversiveNavigator(),
    });
    ss.run();

} catch (err) {
    console.error('error: ', err);
}