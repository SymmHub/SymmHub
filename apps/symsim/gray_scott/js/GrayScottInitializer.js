/**
 * GrayScottInitializer.js
 *
 * ProcessingWorker: fills the shared DoubleFBO with initial Gray-Scott data.
 *
 * Supports four init types (matching the old GrayScottSimulation):
 *   'clear uniform' — fills with the stable uniform solution UV for (feedCoeff, killCoeff)
 *   'clear 10'      — fills with [1, 0, 0, 1] (U=1, V=0)
 *   'noise'         — simplex noise via the gsNoise1 shader
 *   'sym noise'     — symmetrised noise via the symNoise shader (requires setGroup())
 *
 * process(buffer, time) is a no-op — this worker only runs via
 * initialize(buffer), called by PipelineManager.initSimulation().
 *
 * Interface:
 *   init(glCtx)
 *   initialize(buffer)      — fills buffer according to initType
 *   process(buffer, time)   — no-op
 *   setGroup(group)         — provides the current symmetry group for sym noise
 *   getParams()
 *   getName() / getClassName()
 */

import {
    ParamChoice,
    ParamFloat,
    ParamInt,
    ParamGroup,
    DataPacking,
    GroupUtils,
    gs_uniformUV,
} from './modules.js';

import { GS_programs } from './gray_scott_programs.js';

const MYNAME = 'GrayScottInitializer';
const DEBUG  = false;

const INIT_TYPE_UNIFORM   = 'clear uniform';
const INIT_TYPE_CLEAR10   = 'clear 10';
const INIT_TYPE_NOISE     = 'noise';
const INIT_TYPE_SYM_NOISE = 'sym noise';

const initTypeNames = [INIT_TYPE_UNIFORM, INIT_TYPE_CLEAR10, INIT_TYPE_NOISE, INIT_TYPE_SYM_NOISE];

// ── Worker ───────────────────────────────────────────────────────────────────

function GrayScottInitializer(options = {}) {

    let mGLCtx  = null;
    let mGroup  = null;
    let mParams = null;

    const mConfig = {
        initType:  options.initType  ?? INIT_TYPE_NOISE,
        feedCoeff: options.feedCoeff ?? 0.062,
        killCoeff: options.killCoeff ?? 0.0609,
        noiseParams: {
            noiseCell:           options.noiseCell           ?? 0.2,
            noiseFactor:         options.noiseFactor         ?? 0.3,
            noiseX:              options.noiseX              ?? 0,
            noiseY:              options.noiseY              ?? 0,
            noiseCapSizeX:       options.noiseCapSizeX       ?? 0.2,
            noiseCapSizeY:       options.noiseCapSizeY       ?? 0.2,
            noiseCapCenterX:     options.noiseCapCenterX     ?? 0.2,
            noiseCapCenterY:     options.noiseCapCenterY     ?? 0,
            noiseCrownWordCount: options.noiseCrownWordCount ?? 1,
            lineThickness:       options.lineThickness       ?? 0.005,
        },
    };

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        if (DEBUG) console.log(`${MYNAME}.init()`);
        mGLCtx = glCtx;
        // Trigger compilation of all GS programs (compileAll=true in programBuilder)
        GS_programs.getProgram(glCtx.gl, 'gsNoise1');
    }

    function setGroup(group) {
        mGroup = group;
    }

    // ── initialisation ────────────────────────────────────────────────────────

    function initialize(buffer) {
        if (!mGLCtx) return;
        if (DEBUG) console.log(`${MYNAME}.initialize() initType:`, mConfig.initType);

        switch (mConfig.initType) {
        case INIT_TYPE_UNIFORM:
            _clearUniform(buffer);
            break;
        case INIT_TYPE_CLEAR10:
            _clearBuffer(buffer, [1, 0, 0, 1]);
            break;
        case INIT_TYPE_SYM_NOISE:
            if (mGroup) { _applySymNoise(buffer); break; }
            // Fall through to regular noise if no group is set
        case INIT_TYPE_NOISE:
        default:
            _applyNoise(buffer);
            break;
        }
    }

    /** Fill both FBO sides with a constant RGBA colour. */
    function _clearBuffer(buffer, color) {
        const gl = mGLCtx.gl;
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.write.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.read.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    /** Fill with the stable uniform (U, V) solution for (feedCoeff, killCoeff). */
    function _clearUniform(buffer) {
        const uv = gs_uniformUV(mConfig.feedCoeff, mConfig.killCoeff);
        _clearBuffer(buffer, [uv[0], uv[1], 0, 1]);
    }

    /** Fill with simplex noise via the gsNoise1 shader. */
    function _applyNoise(buffer) {
        const gl      = mGLCtx.gl;
        const program = GS_programs.getProgram(gl, 'gsNoise1');
        const n       = mConfig.noiseParams;
        const c       = mConfig;

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        program.setUniforms({
            u_aspect: buffer.height / buffer.width,
            u_scale:  1,
            u_center: [0, 0],
        });

        program.setUniforms({
            killCoeff:   c.killCoeff,
            feedCoeff:   c.feedCoeff,
            NoiseCell:   n.noiseCell,
            NoiseFactor: n.noiseFactor,
            NoiseCenter: [n.noiseX, n.noiseY],
        });

        program.blit(buffer.write);
        buffer.swap();
    }

    /** Fill with symmetrised noise via the symNoise shader (requires a group). */
    function _applySymNoise(buffer) {
        const gl      = mGLCtx.gl;
        const program = GS_programs.getProgram(gl, 'symNoise');
        const n       = mConfig.noiseParams;
        const c       = mConfig;
        const group   = mGroup;

        const gens  = group.getReverseITransforms();
        const trans = GroupUtils.makeTransforms(gens, { maxWordLength: n.noiseCrownWordCount });

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        program.setUniforms({
            u_aspect: buffer.height / buffer.width,
            u_scale:  1,
            u_center: [0, 0],
        });

        const fd                = group.getFundDomain();
        const crownDataSampler  = DataPacking.createGroupDataSampler(gl);
        DataPacking.packGroupToSampler(gl, crownDataSampler, { s: fd, t: trans });

        const uv = gs_uniformUV(c.feedCoeff, c.killCoeff);

        program.setUniforms({
            GroupData:      crownDataSampler,
            NoiseCell:      n.noiseCell,
            NoiseFactor:    n.noiseFactor,
            NoiseCenter:    [n.noiseX, n.noiseY],
            uLineThickness: n.lineThickness,
            CapRadius:      [n.noiseCapSizeX,   n.noiseCapSizeY  ],
            CapCenter:      [n.noiseCapCenterX, n.noiseCapCenterY],
            uBaseColor:     [uv[0], uv[1], 0, 0],
        });

        // Blit twice to initialise both FBO sides (matching old GrayScottSimulation)
        program.blit(buffer.write);
        buffer.swap();
        program.blit(buffer.write);
    }

    // ── process (no-op) ───────────────────────────────────────────────────────

    function process(buffer, time) { /* no-op: only runs via initialize() */ }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        const n = c.noiseParams;
        return {
            initType:  ParamChoice({ obj: c, key: 'initType',  choice: initTypeNames, name: 'init type' }),
            feedCoeff: ParamFloat({  obj: c, key: 'feedCoeff', min: -0.1, max: 1.0, step: 0.0000001, name: 'Feed' }),
            killCoeff: ParamFloat({  obj: c, key: 'killCoeff', min: -0.1, max: 1.0, step: 0.0000001, name: 'Kill' }),
            noiseParams: ParamGroup({
                name: 'noise params',
                params: {
                    noiseCell:           ParamFloat({ obj: n, key: 'noiseCell',           min: 0, max: 1,   step: 0.00001, name: 'noise cell'     }),
                    noiseFactor:         ParamFloat({ obj: n, key: 'noiseFactor',         min: -1, max: 1,  step: 0.00001, name: 'noise factor'   }),
                    lineThickness:       ParamFloat({ obj: n, key: 'lineThickness',       min: 0, max: 1,   step: 0.00001, name: 'line thickness'  }),
                    noiseX:              ParamFloat({ obj: n, key: 'noiseX',              min: -10, max: 10, step: 0.00001, name: 'noise x'        }),
                    noiseY:              ParamFloat({ obj: n, key: 'noiseY',              min: -10, max: 10, step: 0.00001, name: 'noise y'        }),
                    noiseCapSizeX:       ParamFloat({ obj: n, key: 'noiseCapSizeX',       min: 0, max: 10,  step: 0.00001, name: 'cap size x'     }),
                    noiseCapSizeY:       ParamFloat({ obj: n, key: 'noiseCapSizeY',       min: 0, max: 10,  step: 0.00001, name: 'cap size y'     }),
                    noiseCapCenterX:     ParamFloat({ obj: n, key: 'noiseCapCenterX',     min: 0, max: 10,  step: 0.00001, name: 'cap center x'   }),
                    noiseCapCenterY:     ParamFloat({ obj: n, key: 'noiseCapCenterY',     min: 0, max: 10,  step: 0.00001, name: 'cap center y'   }),
                    noiseCrownWordCount: ParamInt({   obj: n, key: 'noiseCrownWordCount', min: 0, max: 10,               name: 'crown count'    }),
                },
            }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        process,
        initialize,
        setGroup,
        getId:        () => 'GS initialization',
        getName:      () => 'GS initialization',
        getClassName: () => MYNAME,
        getParams,
    };

} // GrayScottInitializer

export { GrayScottInitializer };
