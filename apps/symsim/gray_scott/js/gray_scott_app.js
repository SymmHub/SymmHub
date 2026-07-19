/**
 * gray_scott_app.js
 *
 * Shared startup logic for all Gray-Scott app variants.
 * Each variant (klm, klmn, wp, wp_inv, simple) imports runGrayScott()
 * and passes only what differs: presets, preset path, group name,
 * and any extra SymRenderer options.
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

import { GrayScottWorker }      from './GrayScottWorker.js';
import { GrayScottInitializer } from './GrayScottInitializer.js';
import { GrayScottUpgradeData } from './GrayScottUpgradeData.js';

// ── Worker factory (shared across all variants) ────────────────────────────────

function makeGSWorkerFactory(getGLCtx, getBuffer, getGroup, getChildren) {

    function make(Ctor) {
        return () => {
            const worker = Ctor();
            const ctx = getGLCtx();
            if (ctx) worker.init(ctx);
            const grp = getGroup();
            if (grp && typeof worker.setGroup === 'function') worker.setGroup(grp);
            return worker;
        };
    }

    return ObjectFactory({
        defaultName: 'GrayScottWorker',
        infoArray: [
            { name: 'GrayScottInitializer', label: 'GS initialization', creator: make(GrayScottInitializer) },
            { name: 'GrayScottWorker',      label: 'GS simulation',     creator: make(GrayScottWorker)      },
            { name: 'SymmetrizationWorker', label: 'Symmetrization',    creator: make(SymmetrizationWorker)  },
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
export function runGrayScott({ presets, presetsPath, groupName, gridSize = 512, rendererOpts = {} }) {

    try {

        const creator = makePipelineManagerCreator({
            gridSize,
            workerFactory: makeGSWorkerFactory,
            defaultWorkers: [
                GrayScottInitializer(),
                GrayScottWorker(),
                SymmetrizationWorker(),
            ],
        });

        const ss = SymRenderer({
            patternCreator:    creator,
            samples:           makeSamplesArray(presets, presetsPath),
            groupMakerFactory: GroupMakerFactory({ defaultName: groupName }),
            navigator:         new InversiveNavigator(),
            dataUpgrader:      GrayScottUpgradeData,
            ...rendererOpts,
        });

        ss.run();

    } catch (err) {
        console.error('gray_scott error:', err);
    }
}
