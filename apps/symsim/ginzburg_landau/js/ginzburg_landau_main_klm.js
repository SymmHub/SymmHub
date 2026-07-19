import { runGinzburgLandau } from './ginzburg_landau_app.js';
import { presets }           from './presets_klm.js';

runGinzburgLandau({ presets, presetsPath: 'presets/klm/', groupName: 'KLM' });