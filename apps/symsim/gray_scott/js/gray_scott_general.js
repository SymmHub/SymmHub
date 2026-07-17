/**
 * gray_scott_general.js
 *
 * Entry point for the generalised Gray-Scott app using PipelineManager.
 *
 * Pipeline of three workers:
 *   1. GrayScottInitializer  — fills the buffer (clear / noise / sym noise)
 *   2. GrayScottWorker       — runs the GS PDE step shader
 *   3. SymmetrizationWorker  — applies symmetry to the buffer each frame
 *
 * Old gray_scott_main_klm.js and friends remain unchanged and still use
 * the legacy GrayScottSimulation.
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

import { presets }               from './presets_klm.js';
import { GrayScottUpgradeData }  from './GrayScottUpgradeData.js';

// ── Worker factory ────────────────────────────────────────────────────────────
//
// Called by PipelineManager with four getter functions.
// Returns an ObjectFactory that can create new workers on demand (UI "+" button).
//
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

// ── App startup ───────────────────────────────────────────────────────────────

try {

    const creator = makePipelineManagerCreator({
        gridSize:      512,
        workerFactory: makeGSWorkerFactory,
        defaultWorkers: [
            GrayScottInitializer(),   // uninitialised — PipelineManager calls init(glCtx)
            GrayScottWorker(),
            SymmetrizationWorker(),
        ],
    });

    const ss = SymRenderer({
        patternCreator:    creator,
        samples:           makeSamplesArray(presets, 'presets/klm/'),
        groupMakerFactory: GroupMakerFactory({ defaultName: 'KLM' }),
        navigator:         new InversiveNavigator(),
        dataUpgrader:      GrayScottUpgradeData,
    });

    ss.run();

} catch (err) {
    console.error('gray_scott_general error:', err);
}
