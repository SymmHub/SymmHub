import { runGinzburgLandau } from './ginzburg_landau_app.js';
import { presets }           from './presets_klmn.js';

runGinzburgLandau({ presets, presetsPath: 'presets/klmn/', groupName: 'KLMN' });