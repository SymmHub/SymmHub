/**
 * GinzburgLandauWorker.js
 *
 * ProcessingWorker: runs the Ginzburg-Landau PDE step shader on a shared DoubleFBO.
 *
 * The PDE step is spatially local — it does NOT use symmetry group data.
 * No setGroup() method.  All group-related initialisation lives in
 * GinzburgLandauInitializer.
 *
 * Interface:
 *   init(glCtx)
 *   process(buffer, time)   — runs glStep shader N times (stepsCount) on the shared buffer
 *   getParams()
 *   getName() / getClassName()
 */

import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    GinzburgLandauPresets,
    createDataPlot,
} from './modules.js';

import { GL_programs } from './ginzburg_landau_programs.js';

const MYNAME  = 'GinzburgLandauWorker';
const DEBUG   = false;
const Presets = GinzburgLandauPresets;

// ── Worker ───────────────────────────────────────────────────────────────────

function GinzburgLandauWorker(options = {}) {

    let mGLCtx    = null;
    let mParams    = null;
    let mFirstStep = true;  // log uniforms once on first process()

    const mConfig = {
        simParams: {
            stepsCount:    options.stepsCount    ?? 4,
            alpha:         options.alpha         ?? 0.84,
            beta:          options.beta          ?? 0.84,
            alphaGradient: options.alphaGradient ?? 0,
            betaGradient:  options.betaGradient  ?? 0,
            Da:            options.Da            ?? 2.0,
            Db:            options.Db            ?? 2.0,
            timestep:      options.timestep      ?? 0.06,
            useHMetric:    options.useHMetric    ?? false,
        },
    };

    // ── presets plot (created at construction; not serialised) ─────────────────

    const mPresetsPlot = makePresetsPlot();

    function makePresetsPlot() {
        return createDataPlot({
            left:                '2%',
            top:                 '2px',
            width:               '40%',
            height:              '40%',
            bounds:              Presets.getBounds(),
            plotType:            1,
            eventHandler:        makePresetsHandler(),
            backgroundImagePath: 'images/gl_map_2048_trans.png',
            plotName:            'Ginzburg-Landau parameters',
            floating:            true,
            storageId:           `${MYNAME}.paramsPlot`,
        });
    }

    function makePresetsHandler() {
        let mouseDown = false;

        function handlePresetsEvent(evt) {
            switch (evt.type) {
            case 'mouseup':
                mouseDown = false;
                break;
            case 'mousedown':
                mouseDown = true;
                if (evt.ctrlKey) setParamsFromPlot(evt.wpnt);
                break;
            case 'mousemove':
                if (mouseDown && evt.ctrlKey) setParamsFromPlot(evt.wpnt);
                break;
            }
        }
        return { handleEvent: handlePresetsEvent };
    }

    /** Set alpha/beta from a 2-element [alpha, beta] point on the plot. */
    function setParamsFromPlot(p) {
        const params = getParams();
        params.alpha.setValue(p[0]);
        params.beta.setValue(p[1]);
        mPresetsPlot.setPlotData(p, 1);
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        if (DEBUG) console.log(`${MYNAME}.init()`);
        mGLCtx = glCtx;

        // Trigger compilation of all GL programs
        GL_programs.getProgram(glCtx.gl, 'glStep');

        // Populate preset dots on the 2D parameter plot
        mPresetsPlot.setPlotData(Presets.getPlotData(), 0);
    }

    // ── processing ────────────────────────────────────────────────────────────

    /**
     * Run `stepsCount` PDE steps on the shared buffer.
     * @param {DoubleFBO} buffer
     * @param {number}    time   — unused (kept for interface conformance)
     */
    function process(buffer, time) {
        const gl      = mGLCtx.gl;
        const program = GL_programs.getProgram(gl, 'glStep');

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        // Map [-1,1] quad range into [0,1] sampler input
        program.setUniforms({
            u_aspect: buffer.height / buffer.width,
            u_scale:  0.5,
            u_center: [0.5, 0.5],
        });

        const par = mConfig.simParams;
        const simUni = {
            alpha:         par.alpha,
            beta:          par.beta,
            alphaGradient: par.alphaGradient,
            betaGradient:  par.betaGradient,
            useHMetric:    par.useHMetric,
            Da:            par.Da,
            Db:            par.Db,
            timestep:      par.timestep,
        };

        if (mFirstStep) {
            console.log(`${MYNAME} simUni:`, simUni);
            mFirstStep = false;
        }

        program.setUniforms(simUni);

        const stepsCount = par.stepsCount;
        for (let i = 0; i < stepsCount; i++) {
            program.setUniforms({ tSource: buffer.read });
            program.blit(buffer.write);
            buffer.swap();
        }
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const cfg = mConfig.simParams;
        return {
            // ── 2D parameter plot (UI only — not serialised to JSON) ──────────
            presetsPlot: ParamObj({ name: 'presets', obj: mPresetsPlot, serializable: false }),

            // ── simulation parameters ─────────────────────────────────────────
            alpha:         ParamFloat({ obj: cfg, key: 'alpha',         min: -0.1, max: 1.0, step: 0.0000001 }),
            beta:          ParamFloat({ obj: cfg, key: 'beta',          min: -0.1, max: 1.0, step: 0.0000001 }),
            alphaGradient: ParamFloat({ obj: cfg, key: 'alphaGradient', step: 0.0000001, name: 'a-grad' }),
            betaGradient:  ParamFloat({ obj: cfg, key: 'betaGradient',  step: 0.0000001, name: 'b-grad' }),
            stepsCount:    ParamInt({   obj: cfg, key: 'stepsCount',    min: 1, max: 10000, name: 'steps' }),
            timestep:      ParamFloat({ obj: cfg, key: 'timestep',      name: 'Time Step' }),
            useHMetric:    ParamBool({  obj: cfg, key: 'useHMetric',    name: 'H-metric' }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        getId:        () => 'GL simulation',
        getName:      () => 'GL simulation',
        getClassName: () => MYNAME,
        getParams,
        process,
    };

} // GinzburgLandauWorker

export { GinzburgLandauWorker };
