import {
    runGrayScott,
} from './modules.js';
import { presets }      from './presets_wp.js';

runGrayScott({ presets, presetsPath: 'presets/wp/', groupName: 'Wallpaper' });
