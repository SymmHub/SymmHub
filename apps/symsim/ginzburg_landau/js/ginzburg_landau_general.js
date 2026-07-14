/**
 * ginzburg_landau_general.js
 *
 * Entry point for the generalised Ginzburg-Landau app.
 *
 * Uses ProcessingManager with a pipeline of three workers:
 *   1. GinzburgLandauInitializer — fills the buffer with initial data (clear / noise)
 *   2. GinzburgLandauWorker      — runs the GL PDE step shader
 *   3. SymmetrizationWorker      — applies symmetry to the buffer each frame
 *
 * The old ginzburg_landau_main_klm.js and friends are unchanged.
 */

import {
    SymRenderer,
    makeSamplesArray,
    InversiveNavigator,
    GroupMakerFactory,
    ObjectFactory,
} from './modules.js';

import { makePipelineManagerCreator } from '../../../../lib/symhublib/PipelineManager.js';
import { SymmetrizationWorker }         from '../../../../lib/symhublib/SymmetrizationWorker.js';

import { GinzburgLandauWorker }      from './GinzburgLandauWorker.js';
import { GinzburgLandauInitializer } from './GinzburgLandauInitializer.js';

import { presets } from './presets_klm.js';
import { GinzburgLandauUpgradeData } from './GinzburgLandauUpgradeData.js';

// ── Worker factory ────────────────────────────────────────────────────────────
//
// Called by ProcessingManager with four getter functions.
// Returns an ObjectFactory that can create new workers on demand (UI "+" button).
//
// Signature: (getGLCtx, getBuffer, getGroup, getChildren) => ObjectFactory
//
function makeGLWorkerFactory(getGLCtx, getBuffer, getGroup, getChildren) {

    /**
     * Build a creator thunk for a given worker constructor.
     * The new worker is init()ed immediately if the GL context is available,
     * and receives the current group if the worker has setGroup().
     */
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
        ],
    });
}

// ── App startup ──────────────────────────────────────────────────────────────

try {

    const creator = makePipelineManagerCreator({
        gridSize:      512,
        workerFactory: makeGLWorkerFactory,
        defaultWorkers: [
            GinzburgLandauInitializer(),  // uninitialised — PM will call init(glCtx)
            GinzburgLandauWorker(),
            SymmetrizationWorker(),
        ],
    });

    let ss = SymRenderer({
        patternCreator:   creator,
        samples:          makeSamplesArray(presets, 'presets/klm/'),
        groupMakerFactory: GroupMakerFactory({ defaultName: 'KLM' }),
        navigator:        new InversiveNavigator(),
        dataUpgrader:     GinzburgLandauUpgradeData,
    });

    ss.run();

} catch (err) {
    console.error('ginzburg_landau_general error:', err);
}
