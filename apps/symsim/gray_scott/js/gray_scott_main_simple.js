import { runGrayScott } from './gray_scott_app.js';
import { presets }      from './presets_wp.js';

const samples = { presets, presetsPath: 'presets/wp/' };
runGrayScott({
    ...samples,
    groupName: 'Wallpaper',
    rendererOpts: { useSimpleUI: true },
});