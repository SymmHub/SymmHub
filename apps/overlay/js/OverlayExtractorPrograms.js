/**
 * OverlayExtractorPrograms.js
 *
 * Defines all WebGL shader fragments and program descriptors for the
 * OverlayExtractor app, following the same pattern as sympix_programs.js.
 *
 * Usage (in OverlayExtractor.js):
 *
 *   import { Overlay_programs } from './OverlayExtractorPrograms.js';
 *
 *   const prog = Overlay_programs.getProgram(gl, 'overlayExtractor');
 *   prog.bind();
 *   prog.setUniforms(uni);
 *   prog.blit(target);   // target = null → render to screen
 */

import { ShaderFragments as SF, programBuilder } from './modules.js';

// ── Fragment references ───────────────────────────────────────────────────────

const fragBaseVertex = {
    obj: SF,
    id: 'canvasVertexShader',
};

const fragOverlayExtractor = {
    obj: SF,
    id: 'overlayExtractorShader',
};

// ── Program descriptor ────────────────────────────────────────────────────────

const progOverlayExtractor = {
    name: 'overlayExtractor',
    vs: { frags: [fragBaseVertex] },
    fs: { frags: [fragOverlayExtractor] },
};

// ── Registry ──────────────────────────────────────────────────────────────────

const programs = {
    overlayExtractor: progOverlayExtractor,
};

/**
 * Lazy-compiling program registry.
 * Call Overlay_programs.getProgram(gl, 'overlayExtractor') to get the live
 * Program object (compiled on first use).
 */
export const Overlay_programs = programBuilder(programs);
