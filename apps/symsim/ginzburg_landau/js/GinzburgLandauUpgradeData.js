/**
 * GinzburgLandauUpgradeData.js
 *
 * Upgrades JSON documents saved by the old GinzburgLandauSimulation
 * (className "Ginzburg-Landau") to the new PipelineManager format with
 * three workers: GinzburgLandauInitializer, GinzburgLandauWorker, and
 * SymmetrizationWorker.
 *
 * Old patternParams structure:
 *   { className: "Ginzburg-Landau",      (or "simulation" in files before mid 2025)
 *     params: {
 *       simParams:   { stepsCount, alpha, beta, alphaGradient, betaGradient, Da, Db, timestep, useHMetric,
 *                      buffer },
 *       simInit:     { initType: "noise" | "clear" | "sym noise" },
 *       simmetry:    { useSym, symIterations, symMix },     (sic: the files spell it so)
 *       clearValue:  { value0, value1 },
 *       simpleNoise: { noiseForce, noiseOffset, noiseCell },
 *     }
 *   }
 *
 * The oldest files (2024, e.g. the local presets) saved the same content
 * without the class: params.simulation = { preset, presetsPlot, simParams,
 * simInit, simmetry }, with the buffer inline as { width, height, buffer: <string> }.
 * SymRendererUpgradeData moves params.simulation to params.pattern.patternParams
 * as it is, so here it arrives as patternParams with no className and with
 * simParams directly inside ("flat" format).
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
// Class names of the old simulation objects:
//   'simulation'       — original name (files saved 2024 to mid 2025)
//   'Ginzburg-Landau'  — the name before the PipelineManager migration
const OLD_CLASS_NAMES = new Set(['Ginzburg-Landau', 'simulation']);

/** True when pp is one of the named old formats or the flat (no className) one. */
function isOldGLFormat(pp) {
    if (!pp) return false;
    if (OLD_CLASS_NAMES.has(pp.className)) return true;
    return pp.className == null && pp.simParams != null;
}

function upgrade(data) {
    const pattern = data?.params?.pattern;
    if (!pattern) return;

    const pp = pattern.patternParams;
    if (!isOldGLFormat(pp)) return;

    console.log(`${MYNAME}: upgrading old "${pp.className ?? 'flat'}" format to PipelineManager`);

    // the named format wraps its content in pp.params, the flat one is pp itself
    const old = (pp.className != null) ? (pp.params ?? {}) : pp;
    // the files spell the symmetry group "simmetry"
    const oldSym = old.simmetry ?? old.symmetry ?? {};

    // ── GinzburgLandauInitializer params ──────────────────────────────────────
    // Old key "simpleNoise" becomes "noiseParams" in the new initializer.
    const initParams = {
        initType:   old.simInit?.initType ?? old.initType ?? 'noise',
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
                            enabled:       oldSym.useSym ?? oldSym.symSim ?? true,
                            symMix:        oldSym.symMix        ?? 1.0,
                            symIterations: oldSym.symIterations ?? 2,
                        }},
                    ],
                },
            },
        },
    };

    console.log(`${MYNAME}: upgrade complete`, pattern.patternParams);
}

export const GinzburgLandauUpgradeData = { upgrade };
