import {
    runGrayScott,
    SimpleUI,
} from './modules.js';
import { presets }      from './presets_wp.js';

const samples = { presets, presetsPath: 'presets/wp/' };
runGrayScott({
    ...samples,
    groupName: 'Wallpaper',
    // the picture with the toolbox over it, the settings hidden
    rendererOpts: { ui: SimpleUI },
});
