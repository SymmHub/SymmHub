/**
 * gray_scott_programs.js
 *
 * GPU shader program definitions for the Gray-Scott reaction-diffusion simulation.
 * Follows the same pattern as sympix_programs.js / Sympix_programs.
 *
 * Exports:
 *   GS_programs  — programBuilder result; call GS_programs.getProgram(gl, name)
 *   gsFragments  — full fragment list for initFragments() in GrayScottSimulation.init()
 */

import {
    GrayScottFragments as GS,
    ShaderFragments    as SF,
    programBuilder,
} from './modules.js';

// ── Fragment references ───────────────────────────────────────────────────────

const fragGsSimulation     = { obj: GS, id: 'grayScottShader' };
const fragGsNoise1         = { obj: GS, id: 'gsNoise1Shader' };

const fragSdf2d            = { obj: SF, id: 'sdf2d' };
const fragUtils            = { obj: SF, id: 'utils' };
const fragBaseVertex       = { obj: SF, id: 'canvasVertexShader' };
const fragSimplexNoise     = { obj: SF, id: 'simplexNoise' };
const fragIsplane          = { obj: SF, id: 'isplane' };
const fragInversiveSampler = { obj: SF, id: 'inversiveSampler' };
const fragAddNoise         = { obj: SF, id: 'addNoiseShader' };
const fragSymSampler       = { obj: SF, id: 'symSamplerShader' };

// ── All fragments — passed to initFragments() before first use ────────────────

export const gsFragments = [
    fragGsSimulation,
    fragGsNoise1,
    fragBaseVertex,
    fragSimplexNoise,
    fragSdf2d,
    fragUtils,
    fragIsplane,
    fragInversiveSampler,
    fragSymSampler,
    fragAddNoise,
];

// ── Shared vertex stage ───────────────────────────────────────────────────────

const baseVertexShader = { frags: [fragBaseVertex] };

// ── Program compositions ──────────────────────────────────────────────────────

const progGsSimulation = {
    name: 'GsSimulation',
    vs: baseVertexShader,
    fs: { frags: [fragSdf2d, fragGsSimulation] },
};

const progGsNoise1 = {
    name: 'GsNoise1',
    vs: baseVertexShader,
    fs: { frags: [fragSimplexNoise, fragGsNoise1] },
};

const progSymSampler = {
    name: 'SymSampler',
    vs: baseVertexShader,
    fs: { frags: [fragIsplane, fragInversiveSampler, fragSymSampler] },
};

const progSymNoise = {
    name: 'SymNoise',
    vs: baseVertexShader,
    fs: { frags: [fragUtils, fragIsplane, fragInversiveSampler, fragSimplexNoise, fragAddNoise] },
};

// ── Program registry ─────────────────────────────────────────────────────────

const gsPrograms = {
    gsSimulation: progGsSimulation,
    gsNoise1:     progGsNoise1,
    symSampler:   progSymSampler,
    symNoise:     progSymNoise,
};

export const GS_programs = programBuilder(gsPrograms, /* compileAll = */ false);
