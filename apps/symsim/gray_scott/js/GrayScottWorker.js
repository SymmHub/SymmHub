/**
 * GrayScottWorker.js
 *
 * ProcessingWorker: runs the Gray-Scott reaction-diffusion PDE step shader
 * on a shared DoubleFBO.
 *
 * The PDE step is spatially local — it reads/writes the shared RG32F buffer.
 * No setGroup() is required for the step shader itself.
 *
 * Includes a 2D preset parameter plot (feed vs kill) for interactive
 * parameter selection.  The plot is UI-only — serializable: false.
 *
 * Interface:
 *   init(glCtx)
 *   process(buffer, time)  — runs gsSimulation shader stepsCount times
 *   getParams()
 *   getName() / getClassName()
 */

import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    createDataPlot,
} from './modules.js';

import { GrayScottPresets } from './gray_scott_presets.js';


import { GS_programs } from './gray_scott_programs.js';

const MYNAME  = 'GrayScottWorker';
const DEBUG   = false;
const Presets = GrayScottPresets;

// ── Worker ───────────────────────────────────────────────────────────────────

function GrayScottWorker(options = {}) {

    let mGLCtx  = null;
    let mParams = null;

    const mConfig = {
        feedCoeff:    options.feedCoeff    ?? 0.062,
        killCoeff:    options.killCoeff    ?? 0.0609,
        feedGradient: options.feedGradient ?? 0,
        killGradient: options.killGradient ?? 0,
        deltaT:       options.deltaT       ?? 0.8,
        DiffR:        options.DiffR        ?? 0.2097,
        DiffG:        options.DiffG        ?? 0.105,
        useHMetric:   options.useHMetric   ?? false,
        HMetricScale: options.HMetricScale ?? 1,
        useLaplas9:   options.useLaplas9   ?? true,
        stepsCount:   options.stepsCount   ?? 8,
        boundary: {
            useBoundary: false,
            boundaryR:   0,
            boundaryG:   0,
            useDisk:     false,
            diskR:       0.01,
            diskX:       0.5,
            diskY:       0.5,
        },
    };

    // ── presets plot (UI only — not serialised) ───────────────────────────────
    // Note: the plot axes are (x=kill, y=feed) matching the old simulation.
    // wpnt[0] = x (kill), wpnt[1] = y (feed) → setParamsFromPlot([feed, kill]).

    const mPresetsPlot = makePresetsPlot();

    function makePresetsPlot() {
        return createDataPlot({
            left:                2,
            bottom:              2,
            width:               30,
            height:              40,
            bounds:              Presets.getBounds(),
            plotType:            1,
            eventHandler:        makePresetsHandler(),
            backgroundImagePath: 'images/gs_map_2048_trans.png',
            plotName:            'Gray-Scott parameters',
            floating:            true,
            storageId:           'presetParamsPlot',
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
                if (evt.ctrlKey) setParamsFromPlot([evt.wpnt[1], evt.wpnt[0]]);
                break;
            case 'mousemove':
                if (mouseDown && evt.ctrlKey) setParamsFromPlot([evt.wpnt[1], evt.wpnt[0]]);
                break;
            }
        }
        return { handleEvent: handlePresetsEvent };
    }

    /** Set feed/kill from a [feed, kill] point; update the plot marker. */
    function setParamsFromPlot(pnt) {
        const params = getParams();
        params.feedCoeff.setValue(pnt[0]);
        params.killCoeff.setValue(pnt[1]);
        mPresetsPlot.setPlotData([pnt[1], pnt[0]], 1);
    }

    /** Keep plot marker in sync when feed/kill are changed via sliders. */
    function onFeedKillChanged() {
        mPresetsPlot.setPlotData([mConfig.killCoeff, mConfig.feedCoeff], 1);
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        if (DEBUG) console.log(`${MYNAME}.init()`);
        mGLCtx = glCtx;

        // Trigger compilation of all GS shader programs
        GS_programs.getProgram(glCtx.gl, 'gsSimulation');

        // Populate preset dots on the 2D parameter plot
        mPresetsPlot.setPlotData(Presets.getPlotData(), 0);
    }

    // ── processing ────────────────────────────────────────────────────────────

    /**
     * Run `stepsCount` Gray-Scott PDE steps on the shared buffer.
     * @param {DoubleFBO} buffer
     * @param {number}    time   — unused (kept for interface conformance)
     */
    function process(buffer, time) {
        const gl      = mGLCtx.gl;
        const program = GS_programs.getProgram(gl, 'gsSimulation');
        const c       = mConfig;
        const b       = c.boundary;

        gl.disable(gl.BLEND);
        gl.viewport(0, 0, buffer.width, buffer.height);
        program.bind();

        program.setUniforms({
            u_aspect: buffer.height / buffer.width,
            u_scale:  0.5,
            u_center: [0.5, 0.5],
        });

        program.setUniforms({
            killCoeff:    c.killCoeff,
            feedCoeff:    c.feedCoeff,
            killGradient: c.killGradient,
            feedGradient: c.feedGradient,
            deltaT:       c.deltaT,
            DiffR:        c.DiffR,
            DiffG:        c.DiffG,
            useLaplas9:   c.useLaplas9,
            useHMetric:   c.useHMetric,
            HMetricScale: c.HMetricScale,
            useBoundary:  b.useBoundary,
            boundaryR:    b.boundaryR,
            boundaryG:    b.boundaryG,
            useDisk:      b.useDisk,
            diskX:        b.diskX,
            diskY:        b.diskY,
            diskR:        b.diskR,
        });

        for (let i = 0; i < c.stepsCount; i++) {
            program.setUniforms({ tSource: buffer.read });
            program.blit(buffer.write);
            buffer.swap();
        }
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return {
            // ── 2D parameter plot (UI only — not serialised to JSON) ──────────
            presetsPlot:  ParamObj({   name: 'presets',     obj: mPresetsPlot, serializable: false }),

            // ── simulation parameters ─────────────────────────────────────────
            feedCoeff:    ParamFloat({ obj: c, key: 'feedCoeff',    min: -0.1, max: 1.0, step: 0.0000001, name: 'Feed',         onChange: onFeedKillChanged }),
            killCoeff:    ParamFloat({ obj: c, key: 'killCoeff',    min: -0.1, max: 1.0, step: 0.0000001, name: 'Kill',         onChange: onFeedKillChanged }),
            feedGradient: ParamFloat({ obj: c, key: 'feedGradient', step: 0.0000001,                      name: 'feed grad'     }),
            killGradient: ParamFloat({ obj: c, key: 'killGradient', step: 0.0000001,                      name: 'kill grad'     }),
            stepsCount:   ParamInt({   obj: c, key: 'stepsCount',   min: 1, max: 10000,                   name: 'steps/frame'   }),
            deltaT:       ParamFloat({ obj: c, key: 'deltaT',                                             name: 'time step'     }),
            DiffR:        ParamFloat({ obj: c, key: 'DiffR',                                              name: 'DiffR'         }),
            DiffG:        ParamFloat({ obj: c, key: 'DiffG',                                              name: 'DiffG'         }),
            useHMetric:   ParamBool({  obj: c, key: 'useHMetric',                                         name: 'use H-metric'  }),
            HMetricScale: ParamFloat({ obj: c, key: 'HMetricScale',                                       name: 'H-scale'       }),
            useLaplas9:   ParamBool({  obj: c, key: 'useLaplas9',                                         name: 'Laplacian 9'   }),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        init,
        getId:        () => 'GS simulation',
        getName:      () => 'GS simulation',
        getClassName: () => MYNAME,
        getParams,
        process,
    };

} // GrayScottWorker

export { GrayScottWorker };
