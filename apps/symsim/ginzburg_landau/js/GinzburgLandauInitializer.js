/**
 * GinzburgLandauInitializer.js
 *
 * ProcessingWorker: fills the shared DoubleFBO with initial Ginzburg-Landau data.
 *
 * Supports three init types:
 *   'clear'     — clears both FBO sides to a constant (value0, value1)
 *   'noise'     — fills with simplex noise via the glReset shader
 *   'sym noise' — same as 'noise' for now (sym-noise not yet implemented)
 *
 * setGroup() is provided for future 'sym noise' initialisation that will
 * need the group to apply symmetry to the initial pattern.
 *
 * process(buffer, time) is a no-op — this worker only runs via
 * initialize(buffer), which is called by ProcessingManager.initSimulation().
 *
 * Interface:
 *   init(glCtx)
 *   initialize(buffer)      — fills buffer according to initType
 *   process(buffer, time)   — no-op
 *   setGroup(group)
 *   getParams()
 *   getName() / getClassName()
 */

import {
    DataPacking,
    ParamChoice,
    ParamFloat,
} from './modules.js';

import { GL_programs } from './ginzburg_landau_programs.js';

const MYNAME = 'GinzburgLandauInitializer';

const INIT_TYPE_CLEAR     = 'clear';
const INIT_TYPE_NOISE     = 'noise';
const INIT_TYPE_SYM_NOISE = 'sym noise';
const initTypeNames       = [INIT_TYPE_CLEAR, INIT_TYPE_NOISE, INIT_TYPE_SYM_NOISE];

// ── Worker ───────────────────────────────────────────────────────────────────

function GinzburgLandauInitializer(options = {}) {

    let mGLCtx            = null;
    let mGroup            = null;
    let mGroupDataSampler = null;
    let mParams           = null;

    const mConfig = {
        initType: options.initType ?? INIT_TYPE_NOISE,
        clearValue: {
            value0: options.clearValue0 ?? 0,
            value1: options.clearValue1 ?? 0,
        },
        noiseParams: {
            noiseForce:  options.noiseForce  ?? 0.5,
            noiseOffset: options.noiseOffset ?? -0.5,
            noiseCell:   options.noiseCell   ?? 4,
        },
    };

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        mGLCtx = glCtx;
        const gl = glCtx.gl;

        GL_programs.getProgram(gl, 'glReset');  // trigger compile

        mGroupDataSampler = DataPacking.createGroupDataSampler(gl);
    }

    // ── group ─────────────────────────────────────────────────────────────────

    /**
     * Store the symmetry group for future 'sym noise' initialisation.
     */
    function setGroup(group) {
        mGroup = group;
        if (mGLCtx && mGroupDataSampler && mGroup) {
            DataPacking.packGroupToSampler(mGLCtx.gl, mGroupDataSampler, mGroup);
        }
    }

    // ── initialisation ────────────────────────────────────────────────────────

    /**
     * Fill the shared buffer according to the current initType.
     * Called by ProcessingManager.initSimulation() — NOT by process().
     * @param {DoubleFBO} buffer
     */
    function initialize(buffer) {
        switch (mConfig.initType) {
            case INIT_TYPE_CLEAR:
                _clear(buffer);
                break;
            case INIT_TYPE_SYM_NOISE:
                // TODO: apply symmetrised noise using symNoise program + group
                // Falls through to plain noise for now.
            default:
            case INIT_TYPE_NOISE:
                _noise(buffer);
                break;
        }
    }

    // ── no-op process ─────────────────────────────────────────────────────────

    /**
     * No-op: the initialiser does not participate in the per-frame pipeline.
     * It only runs when ProcessingManager.initSimulation() is called.
     */
    function process(buffer, time) { /* intentional no-op */ }

    // ── private helpers ───────────────────────────────────────────────────────

    function _clear(buffer) {
        const gl = mGLCtx.gl;
        const v  = mConfig.clearValue;

        gl.clearColor(v.value0, v.value1, 0, 0);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.write.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.read.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function _noise(buffer) {
        const gl      = mGLCtx.gl;
        const program = GL_programs.getProgram(gl, 'glReset');

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        const par = mConfig.noiseParams;
        program.setUniforms({
            uNoiseForce:  par.noiseForce,
            uNoiseOffset: par.noiseOffset,
            uNoiseCell:   par.noiseCell,
        });

        program.blit(buffer.write);
        buffer.swap();
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const cfg = mConfig;
        return {
            initType:    ParamChoice({ obj: cfg,            key: 'initType',    choice: initTypeNames, name: 'init type' }),
            noiseForce:  ParamFloat({ obj: cfg.noiseParams, key: 'noiseForce',  name: 'force'  }),
            noiseOffset: ParamFloat({ obj: cfg.noiseParams, key: 'noiseOffset', name: 'offset' }),
            noiseCell:   ParamFloat({ obj: cfg.noiseParams, key: 'noiseCell',   name: 'cell'   }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        getId:        () => 'GL initialization',
        getName:      () => 'GL initialization',
        getClassName: () => MYNAME,
        getParams,
        setGroup,
        process,
        initialize,
    };

} // GinzburgLandauInitializer

export { GinzburgLandauInitializer };
