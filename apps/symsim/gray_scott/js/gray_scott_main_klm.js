import {
    runGrayScott,
} from './modules.js';
import { presets }      from './presets_klm.js';

runGrayScott({ presets, presetsPath: 'presets/klm/', groupName: 'KLM' });
