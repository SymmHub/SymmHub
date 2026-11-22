//
//  DataPlotPanel.js: the plot of a row of a simulation's buffer (its first two channels
//  along the row), in a window of its own ('simulation data'). A panel
//  (docs/symrenderer_refactor_plan.md phase 5, D6): the entries of the simulations ask for
//  it, uiOptions.panels: [DataPlotPanel].
//
//  DataPlotPanel.create(host) makes the plot (hidden until its 'show plot'), adds its
//  params as misc > plot (saved with the documents, as before) and, after every frame
//  (the host event 'frameRendered') while the plot shows, takes its numbers from the
//  pattern's main buffer.
//
import {
    createDataPlot,
    readPixelsFromBuffer,
    ParamGroup,
    ParamObj,
} from '../modules.js';

// the row of the buffer, from its bottom (0) to its top (1)
const DATA_SLICE = 0.5;
// how the two channels u, v are drawn: 0 as they are, 1 the modulus and the argument of u + iv
const PLOT_TYPE = 0;

function create(host) {

    const plot = createDataPlot({
        repainter: () => host.scheduleRepaint(),
        left:      17.5,
        bottom:    0,
        width:     65,
        height:    20,
        plotName:  'simulation data',
        floating:  true,
        storageId: 'bufferData',
    });

    // a document of another pattern saved with these params loads as ever, the values left out
    host.addParams('', 'misc', () => ParamGroup({
        name:   'misc',
        params: {
            dataPlot: ParamObj({ name: 'plot', obj: plot }),
        },
    }), { after: 'visualization' });

    host.addEventListener('frameRendered', () => {
        if (!plot.isVisible()) return;
        const [u, v] = plotData(DATA_SLICE, PLOT_TYPE);
        plot.setPlotData(u, 0);
        plot.setPlotData(v, 1);
        plot.repaint();
    });

    // the row's values as [x0, u0, x1, u1, ...] and [x0, v0, ...], x from -1 to 1
    function plotData(dataSliceY, plotType) {
        const gl = host.getGLContext().gl;
        const buffer = host.getPattern().getPatternData({ patternTransConfig: host.patternBox.getConfig() })
                           .getMainBuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.read.fbo);
        const y = Math.round(dataSliceY * buffer.height);
        const data = readPixelsFromBuffer(gl, gl.COLOR_ATTACHMENT0, 0, y, buffer.width, 1);
        const len = data.length / 4;
        const plotU = [];
        const plotV = [];
        for (let i = 0; i < len; i++) {
            const x = i * 2 / len - 1;
            let u = data[4 * i];
            let v = data[4 * i + 1];
            if (plotType === 1) {
                const m = Math.sqrt(u * u + v * v);
                v = Math.atan2(v, u) / Math.PI;
                u = m;
            }
            plotU.push(x, u);
            plotV.push(x, v);
        }
        return [plotU, plotV];
    }
}

export const DataPlotPanel = { create };
