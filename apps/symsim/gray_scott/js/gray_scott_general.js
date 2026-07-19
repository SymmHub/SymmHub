/**
 * gray_scott_general.js
 *
 * KLM variant using PipelineManager — the canonical "general" app.
 * All shared logic (pipeline, worker factory, SymRenderer wiring) lives in
 * gray_scott_app.js; only the variant-specific config is supplied here.
 */

import { runGrayScott } from './gray_scott_app.js';
import { presets }      from './presets_klm.js';

runGrayScott({ presets, presetsPath: 'presets/klm/', groupName: 'KLM' });
