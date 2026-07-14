/**
 * GinzburgLandauUpgradeData.js
 *
 * Upgrades JSON documents saved by the old GinzburgLandauSimulation
 * (className "Ginzburg-Landau") to the new PipelineManager format with
 * three workers: GinzburgLandauInitializer, GinzburgLandauWorker, and
 * SymmetrizationWorker.
 *
 * Old patternParams structure:
 *   { className: "Ginzburg-Landau",
 *     params: {
 *       simParams:   { stepsCount, alpha, beta, alphaGradient, betaGradient, Da, Db, timestep, useHMetric },
 *       initType:    "noise" | "clear" | "sym noise",
 *       clearValue:  { value0, value1 },
 *       simpleNoise: { noiseForce, noiseOffset, noiseCell },
 *     }
 *   }
 *
 * New patternParams structure:
 *   { className: "PipelineManager",
 *     params: {
 *       workers: {
 *         className: "ObjArray",
 *         params: {
 *           id: "workers",
 *           children: [
 *             { className: "GinzburgLandauInitializer", params: { initType, clearValue, noiseParams } },
 *             { className: "GinzburgLandauWorker",      params: { simParams } },
 *             { className: "SymmetrizationWorker",      params: {} },
 *           ]
 *         }
 *       }
 *     }
 *   }
 */

const MYNAME = 'GinzburgLandauUpgradeData';
const OLD_CLASS_NAME = 'Ginzburg-Landau';

function upgrade(data) {
    const pattern = data?.params?.pattern;
    if (!pattern) return;

    const pp = pattern.patternParams;
    if (!pp || pp.className !== OLD_CLASS_NAME) return;

    console.log(`${MYNAME}: upgrading old "${OLD_CLASS_NAME}" format to PipelineManager`);

    const old = pp.params ?? {};

    // ── GinzburgLandauInitializer params ──────────────────────────────────────
    // Old key "simpleNoise" becomes "noiseParams" in the new initializer.
    const initParams = {
        initType:   old.initType   ?? 'noise',
        clearValue: old.clearValue ?? { value0: 0, value1: 0 },
        noiseParams: {
            noiseForce:  old.simpleNoise?.noiseForce  ?? 0.5,
            noiseOffset: old.simpleNoise?.noiseOffset ?? -0.5,
            noiseCell:   old.simpleNoise?.noiseCell   ?? 4,
        },
    };

    // ── GinzburgLandauWorker params ───────────────────────────────────────────
    // getParams() returns a FLAT object (alpha, beta, stepsCount, … at top level).
    // Do NOT wrap in simParams — spread the old simParams directly.
    // Extract 'buffer' separately: old sim stored it inside simParams, but
    // PipelineManager expects it at its own top-level params.buffer.
    const { buffer: oldBuffer, ...simFields } = old.simParams ?? {};
    const workerParams = { ...simFields };

    // ── Assemble the new patternParams ────────────────────────────────────────
    pattern.patternParams = {
        className: 'PipelineManager',
        params: {
            // Lift the buffer to PipelineManager level so setBufferData() picks it up.
            ...(oldBuffer != null ? { buffer: oldBuffer } : {}),
            workers: {
                className: 'ObjArray',
                params: {
                    id: 'workers',
                    children: [
                        { className: 'GinzburgLandauInitializer', params: initParams },
                        { className: 'GinzburgLandauWorker',      params: workerParams },
                        { className: 'SymmetrizationWorker', params: {
                            enabled:       old.symmetry?.symSim        ?? true,
                            symMix:        old.symmetry?.symMix        ?? 1.0,
                            symIterations: old.symmetry?.symIterations ?? 2,
                        }},
                    ],
                },
            },
        },
    };

    console.log(`${MYNAME}: upgrade complete`, pattern.patternParams);
}

export const GinzburgLandauUpgradeData = { upgrade };
