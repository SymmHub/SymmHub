/**
 * SymmetrizationWorker.js
 *
 * ProcessingWorker: applies the symSampler shader to a shared DoubleFBO.
 *
 * Blends the original buffer data with its symmetrised version according to
 * the current symmetry group.  The blend factor is controlled by `symMix`:
 *   0 = original unchanged, 1 = fully symmetrised.
 *
 * Requires a symmetry group to be set via setGroup() before process() is
 * useful.  When no group is set, process() is a no-op.
 *
 * Interface:
 *   init(glCtx)
 *   process(buffer, time)   — applies symSampler to the shared DoubleFBO
 *   setGroup(group)         — receives the current symmetry group
 *   getParams()
 *   getName() / getClassName()
 */

import {
    DataPacking,
    ShaderFragments as SF,
    programBuilder,
    ParamBool,
    ParamFloat,
    ParamInt,
} from './modules.js';

const MYNAME = 'SymmetrizationWorker';

// ── Shader programs ──────────────────────────────────────────────────────────
// The symSampler program only needs ShaderFragments — no simulation-specific
// fragments — so it can be compiled independently here.

const fragBaseVertex       = { obj: SF, id: 'canvasVertexShader' };
const fragIsplane          = { obj: SF, id: 'isplane' };
const fragInversiveSampler = { obj: SF, id: 'inversiveSampler' };
const fragSymSampler       = { obj: SF, id: 'symSamplerShader' };

const symmFragments = [
    fragBaseVertex,
    fragIsplane,
    fragInversiveSampler,
    fragSymSampler,
];

const baseVertexShader = { frags: [fragBaseVertex] };

const Symm_programs = programBuilder({
    symSampler: {
        name: 'SymSampler',
        vs:   baseVertexShader,
        fs:   { frags: [fragIsplane, fragInversiveSampler, fragSymSampler] },
    },
}, /* compileAll = */ true);

// ── Worker ───────────────────────────────────────────────────────────────────

function SymmetrizationWorker(options = {}) {

    let mGLCtx            = null;
    let mGroup            = null;
    let mGroupDataSampler = null;
    let mParams           = null;

    const mConfig = {
        enabled:       options.enabled       ?? true,
        symMix:        options.symMix        ?? 1.0,
        symIterations: options.symIterations ?? 2,
    };

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        mGLCtx  = glCtx;
        const gl = glCtx.gl;

        Symm_programs.getProgram(gl, 'symSampler');   // trigger compile

        mGroupDataSampler = DataPacking.createGroupDataSampler(gl);
    }

    // ── group ─────────────────────────────────────────────────────────────────

    function setGroup(group) {
        mGroup = group;
        if (mGLCtx && mGroupDataSampler && mGroup) {
            DataPacking.packGroupToSampler(mGLCtx.gl, mGroupDataSampler, mGroup);
        }
    }

    // ── processing ────────────────────────────────────────────────────────────

    /**
     * Apply symmetrisation in-place to the shared DoubleFBO.
     * @param {DoubleFBO} buffer
     * @param {number}    time   — unused, kept for interface conformance
     */
    function process(buffer, time) {
        if (!mConfig.enabled) return;
        if (!mGLCtx || !mGroup)  return;

        const gl      = mGLCtx.gl;
        const program = Symm_programs.getProgram(gl, 'symSampler');

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        // Map [-1,1] quad into [0,1] sampler space (no scale/offset for sym pass)
        program.setUniforms({
            u_aspect: buffer.height / buffer.width,
            u_scale:  1,
            u_center: [0., 0.],
        });

        program.setUniforms({
            uSource:     buffer.read,
            uGroupData:  mGroupDataSampler,
            uSymMix:     mConfig.symMix,
            uIterations: mConfig.symIterations,
        });

        program.blit(buffer.write);
        buffer.swap();
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        return {
            enabled:       ParamBool({  obj: mConfig, key: 'enabled' }),
            symIterations: ParamInt({   obj: mConfig, key: 'symIterations', min: 0, max: 100, step: 1, name: 'iterations' }),
            symMix:        ParamFloat({ obj: mConfig, key: 'symMix',        name: 'symMix' }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        getId:        () => 'Symmetrization',
        getName:      () => 'Symmetrization',
        getClassName: () => MYNAME,
        getParams,
        setGroup,
        process,
    };

} // SymmetrizationWorker

export { SymmetrizationWorker };
