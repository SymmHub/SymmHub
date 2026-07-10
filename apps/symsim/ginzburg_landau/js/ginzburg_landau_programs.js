/**
 * ginzburg_landau_programs.js
 *
 * GPU shader program definitions for the Ginzburg-Landau simulation.
 * Follows the same pattern as gray_scott_programs.js / sympix_programs.js.
 *
 * Exports:
 *   GL_programs  — programBuilder result; call GL_programs.getProgram(gl, name)
 *   gsFragments  — full fragment list for initFragments() in GinzburgLandauSimulation.init()
 */

import {
    GinzburgLandauFragments as GLF,
    ShaderFragments         as SF,
    programBuilder,
} from './modules.js';

// ── Fragment references ───────────────────────────────────────────────────────

const fragGL_utils      = { obj: GLF, id: 'GL_utils' };
const fragGL_reset      = { obj: GLF, id: 'GL_reset' };
const fragGL_step       = { obj: GLF, id: 'GL_step' };
const fragGL_render_inc = { obj: GLF, id: 'render_inc' };
const fragGL_hist_vp    = { obj: GLF, id: 'hist_vp' };
const fragGL_hist_fp    = { obj: GLF, id: 'hist_fp' };
const fragGL_render_fp  = { obj: GLF, id: 'render_fp' };

const fragBaseVertex       = { obj: SF, id: 'canvasVertexShader' };
const fragColormap         = { obj: SF, id: 'colormap' };
const fragComplex          = { obj: SF, id: 'complex' };
const fragSimplexNoise     = { obj: SF, id: 'simplexNoise' };
const fragSdf2d            = { obj: SF, id: 'sdf2d' };
const fragUtils            = { obj: SF, id: 'utils' };
const fragDrawDot          = { obj: SF, id: 'drawDotShader' };
const fragDrawSegment      = { obj: SF, id: 'drawSegmentShader' };
const fragIsplane          = { obj: SF, id: 'isplane' };
const fragInversiveSampler = { obj: SF, id: 'inversiveSampler' };
const fragSymSampler       = { obj: SF, id: 'symSamplerShader' };
const fragAddNoise         = { obj: SF, id: 'addNoiseShader' };

// ── All fragments — passed to initFragments() before first use ────────────────

export const gsFragments = [
    fragGL_utils,
    fragGL_reset,
    fragGL_step,
    fragGL_render_inc,
    fragGL_hist_vp,
    fragGL_hist_fp,
    fragGL_render_fp,

    fragBaseVertex,
    fragColormap,
    fragComplex,
    fragSimplexNoise,
    fragSdf2d,
    fragUtils,
    fragDrawDot,
    fragIsplane,
    fragInversiveSampler,
    fragSymSampler,
    fragAddNoise,
];

// ── Shared vertex stage ───────────────────────────────────────────────────────

const baseVertexShader = { frags: [fragBaseVertex] };

// ── Program compositions ──────────────────────────────────────────────────────

const progGL_reset = {
    name: 'GL_reset',
    vs: baseVertexShader,
    fs: { frags: [fragGL_utils, fragGL_reset] },
};

const progGL_step = {
    name: 'GL_step',
    vs: baseVertexShader,
    fs: { frags: [fragGL_step] },
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

const glPrograms = {
    glReset:    progGL_reset,
    glStep:     progGL_step,
    symSampler: progSymSampler,
    symNoise:   progSymNoise,
};

export const GL_programs = programBuilder(glPrograms, true);
