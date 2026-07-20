/**
 * ginzburg_landau_app.js
 *
 * Shared startup logic for all Ginzburg-Landau app variants.
 * Each variant (klm, klmn, wp, 5splanes) imports runGinzburgLandau()
 * and passes only what differs: presets, preset path, and group name.
 *
 * The PipelineManager pipeline (Initializer → Worker → Symmetrization)
 * and the worker factory are defined once here.
 */

import {
    SymRenderer,
    makeSamplesArray,
    InversiveNavigator,
    GroupMakerFactory,
    ObjectFactory,
} from './modules.js';

import { makePipelineManagerCreator } from '../../../../lib/symhublib/PipelineManager.js';
import { SymmetrizationWorker }       from '../../../../lib/symhublib/SymmetrizationWorker.js';
import { MaskWorker }                 from '../../../../lib/symhublib/MaskWorker.js';

import { GinzburgLandauWorker }      from './GinzburgLandauWorker.js';
import { GinzburgLandauInitializer } from './GinzburgLandauInitializer.js';
import { GinzburgLandauUpgradeData } from './GinzburgLandauUpgradeData.js';

// ── Worker factory (shared across all variants) ────────────────────────────────

function makeGLWorkerFactory(getGLCtx, getBuffer, getGroup, getChildren) {

    function make(Ctor) {
        return () => {
            const worker = Ctor();
            const ctx    = getGLCtx();
            if (ctx) worker.init(ctx);
            const grp = getGroup();
            if (grp && typeof worker.setGroup === 'function') worker.setGroup(grp);
            return worker;
        };
    }

    return ObjectFactory({
        defaultName: 'GinzburgLandauWorker',
        infoArray: [
            { name: 'GinzburgLandauInitializer', label: 'GL initialization', creator: make(GinzburgLandauInitializer) },
            { name: 'GinzburgLandauWorker',      label: 'GL simulation',     creator: make(GinzburgLandauWorker)      },
            { name: 'SymmetrizationWorker',      label: 'Symmetrization',    creator: make(SymmetrizationWorker)      },
            { name: 'MaskWorker',                label: 'Mask',              creator: make(MaskWorker)                },
        ],
    });
}

// ── Shared entry point ────────────────────────────────────────────────────────
//
//  options:
//    presets       {string}  — preset file list (template literal from presets_*.js)
//    presetsPath   {string}  — preset subfolder, e.g. 'presets/klm/'
//    groupName     {string}  — GroupMakerFactory defaultName, e.g. 'KLM'
//    gridSize      {number}  — simulation grid size (default: 512)
//    rendererOpts  {object}  — extra options forwarded to SymRenderer (optional)
//
export function runGinzburgLandau({ presets, presetsPath, groupName, gridSize = 512, rendererOpts = {} }) {

    try {

        const creator = makePipelineManagerCreator({
            gridSize,
            workerFactory: makeGLWorkerFactory,
            defaultWorkers: [
                GinzburgLandauInitializer(),
                GinzburgLandauWorker(),
                SymmetrizationWorker(),
            ],
        });

        const ss = SymRenderer({
            patternCreator:    creator,
            samples:           makeSamplesArray(presets, presetsPath),
            groupMakerFactory: GroupMakerFactory({ defaultName: groupName }),
            navigator:         new InversiveNavigator(),
            dataUpgrader:      GinzburgLandauUpgradeData,
            ...rendererOpts,
        });

        ss.run();

    } catch (err) {
        console.error('ginzburg_landau error:', err);
    }
}
