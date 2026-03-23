import {
    SymRenderer,
    GrayScottSimulationCreator,
    makeSamplesArray,
    InversiveNavigator,
    GroupMakerFactory,
}
from './modules.js';

import {
    presets 
} from './presets_wp.js';


let samples = makeSamplesArray(presets, 'presets/wp/');

console.log('samples[0]: ', samples[0]);
try {

    let ss = SymRenderer({
        simCreator: GrayScottSimulationCreator,
        samples: samples, 
        groupMakerFactory: GroupMakerFactory({defaultName: 'Wallpaper'}), 
        navigator:   new InversiveNavigator(),
        preset:  samples[0].data.jsonUrl,
        useSimpleUI: true,
    });
    ss.run();

} catch (err) {
    console.error('error: ', err);
}