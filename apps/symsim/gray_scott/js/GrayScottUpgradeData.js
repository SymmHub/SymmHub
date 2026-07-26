/**
 * GrayScottUpgradeData.js
 *
 * Upgrades JSON documents saved by the old GrayScottSimulation
 * (className "Gray-Scott") to the new PipelineManager format with
 * three workers: GrayScottInitializer, GrayScottWorker, SymmetrizationWorker.
 *
 * Old patternParams structure:
 *   { className: "Gray-Scott",
 *     params: {
 *       simParams:   { feedCoeff, killCoeff, feedGradient, killGradient,
 *                      stepsCount, deltaT, useHMetric, HMetricScale,
 *                      buffer },
 *       simInit:     { initType, initParams: { noiseCell, noiseFactor, … } },
 *       simSymmetry: { useSym, symInterval, symIterations, symMix },
 *     }
 *   }
 *
 * New patternParams structure:
 *   { className: "PipelineManager",
 *     params: {
 *       buffer: { … },           ← lifted from simParams.buffer
 *       workers: {
 *         className: "ObjArray",
 *         params: {
 *           id: "workers",
 *           children: [
 *             { className: "GrayScottInitializer", params: { initType, feedCoeff, killCoeff, noiseParams } },
 *             { className: "GrayScottWorker",      params: { feedCoeff, killCoeff, … } },
 *             { className: "SymmetrizationWorker", params: { enabled, symMix, symIterations } },
 *           ]
 *         }
 *       }
 *     }
 *   }
 */

const MYNAME = 'GrayScottUpgradeData';

// Class names used by old GrayScott simulation objects:
//   'simulation'  — original name (files saved ~2024 and earlier)
//   'Gray-Scott'  — intermediate name before PipelineManager migration
//   (none)        — "flat" format: no className, simParams is directly inside
//                   patternParams (files saved with GrayScottSimulation while
//                   fileFormatRelease was already 1, around early 2026)
const OLD_CLASS_NAMES = new Set(['Gray-Scott', 'simulation']);

/** True when pp looks like any old non-PipelineManager GrayScott format. */
function isOldGSFormat(pp) {
    if (!pp) return false;
    // Named-class formats
    if (OLD_CLASS_NAMES.has(pp.className)) return true;
    // Flat format: no className but simParams is directly present
    if (pp.className == null && pp.simParams != null) return true;
    return false;
}

function upgrade(data) {
    const pattern = data?.params?.pattern;
    if (!pattern) return;

    const pp = pattern.patternParams;
    if (!isOldGSFormat(pp)) return;

    console.log(`${MYNAME}: upgrading old "${pp.className ?? 'flat'}" format to PipelineManager`);

    // Named-class formats wrap their content under pp.params;
    // the flat format puts simParams etc. directly in pp.
    const old = (pp.className != null) ? (pp.params ?? {}) : pp;

    // ── GrayScottInitializer params ───────────────────────────────────────────
    // Old: simInit.initType and simInit.initParams.*
    // The noise params were stored in a nested "initParams" group.
    const oldInitParams = old.simInit?.initParams ?? {};
    const initParams = {
        initType:  old.simInit?.initType ?? 'noise',
        // Use feedCoeff/killCoeff from simParams for clear-uniform computation
        feedCoeff: old.simParams?.feedCoeff ?? 0.062,
        killCoeff: old.simParams?.killCoeff ?? 0.0609,
        noiseParams: {
            noiseCell:           oldInitParams.noiseCell           ?? 0.2,
            noiseFactor:         oldInitParams.noiseFactor         ?? 0.3,
            lineThickness:       oldInitParams.lineThickness       ?? 0.005,
            noiseX:              oldInitParams.noiseX              ?? 0,
            noiseY:              oldInitParams.noiseY              ?? 0,
            noiseCapSizeX:       oldInitParams.noiseCapSizeX       ?? 0.2,
            noiseCapSizeY:       oldInitParams.noiseCapSizeY       ?? 0.2,
            noiseCapCenterX:     oldInitParams.noiseCapCenterX     ?? 0.2,
            noiseCapCenterY:     oldInitParams.noiseCapCenterY     ?? 0,
            noiseCrownWordCount: oldInitParams.noiseCrownWordCount ?? 1,
        },
    };

    // ── GrayScottWorker params ────────────────────────────────────────────────
    // getParams() returns a FLAT object — spread simParams directly.
    // Extract 'buffer' separately: old sim stored it inside simParams, but
    // PipelineManager expects it at its own top-level params.buffer.
    const { buffer: oldBuffer, ...simFields } = old.simParams ?? {};
    const workerParams = { ...simFields };

    // ── SymmetrizationWorker params ────────────────────────────────────────────
    // Old: simSymmetry.useSym → enabled, simSymmetry.symMix, simSymmetry.symIterations
    const symParams = {
        enabled:       old.simSymmetry?.useSym        ?? false,
        symMix:        old.simSymmetry?.symMix        ?? 1.0,
        symIterations: old.simSymmetry?.symIterations ?? 2,
    };

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
                        { className: 'GrayScottInitializer', params: initParams   },
                        { className: 'GrayScottWorker',      params: workerParams },
                        { className: 'SymmetrizationWorker', params: symParams    },
                    ],
                },
            },
        },
    };

    console.log(`${MYNAME}: upgrade complete`, pattern.patternParams);
}

export const GrayScottUpgradeData = { upgrade };
