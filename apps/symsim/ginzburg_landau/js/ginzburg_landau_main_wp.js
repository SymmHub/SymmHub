import {
    runGinzburgLandau,
} from './modules.js';
import { presets }           from './presets_wp.js';

runGinzburgLandau({ presets, presetsPath: 'presets/wp/', groupName: 'Wallpaper' });