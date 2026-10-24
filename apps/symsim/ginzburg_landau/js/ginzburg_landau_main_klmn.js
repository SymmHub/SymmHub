import {
    runGinzburgLandau,
} from './modules.js';
import { presets }           from './presets_klmn.js';

runGinzburgLandau({ presets, presetsPath: 'presets/klmn/', groupName: 'KLMN' });