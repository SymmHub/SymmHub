import { runGinzburgLandau } from './ginzburg_landau_app.js';
import { presets }           from './presets_5splanes.js';

runGinzburgLandau({ presets, presetsPath: 'presets/5splanes/', groupName: '5 Splanes' });