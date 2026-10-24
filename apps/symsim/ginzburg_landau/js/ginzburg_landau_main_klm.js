import {
    runGinzburgLandau,
} from './modules.js';
import { presets }           from './presets_klm.js';

runGinzburgLandau({ presets, presetsPath: 'presets/klm/', groupName: 'KLM' });