//
//  TimingPanel.js: the frame's timing in a window of its own ('timing'): the time of each
//  section of a frame (the simulation step, the layers, the 2D overlay) on the GPU and on
//  the CPU, as live averages and as the means of a benchmark. A panel
//  (docs/symrenderer_refactor_plan.md phase 5); the UI builders add it.
//
//  TimingPanel.create(host) adds the command display > 'show timing...'; the window and
//  its FrameTiming are made when it is first opened. The renderer keeps the hooks: the
//  sections of a frame report to the FrameTiming the panel gives it (host.setFrameTiming),
//  and while that is enabled the animation's frames are measured whole, the host event
//  'frameTimed' after each. Frames rendered for an image export or a script are not
//  measured.
//
import {
    ParamFunc,
    FrameTiming,
    createStatsWindow,
} from '../modules.js';

function create(host) {

    let timing = null;          // FrameTiming of the live frames
    let bench = null;           // FrameTiming of the last benchmark (means of frames rendered back to back)
    let win = null;             // the 'timing' StatsWindow
    let continuous = false;     // render every animation frame while the window is open
    let benchRunning = false;
    let ticking = false;

    host.addParams('display', 'showTiming',
        () => ParamFunc({ func: show, name: 'show timing...' }), { after: 'backgroundColor' });
    host.addEventListener('frameTimed', update);

    function show() {
        if (!timing) {
            timing = FrameTiming({ gl: host.getGLContext().gl });
            host.setFrameTiming(timing);
        }
        if (!win) {
            win = createStatsWindow({
                title:     'timing',
                width:     '420px',
                height:    '300px',
                left:      '10px',
                top:       '60px',
                storageId: 'symrenderer_timing_window',
                buttons: [{
                    label:   'benchmark',
                    title:   'Render 30 frames back to back after a warm-up and show their mean times. '
                           + 'A lightly loaded GPU runs at low clocks, so the live times can be several times longer than the real cost',
                    onClick: () => runBenchmark(30),
                }],
                options: [{
                    label:    'repaint continuously',
                    title:    'Render every animation frame, not only after a change, so the averages settle',
                    checked:  continuous,
                    onChange: (on) => { continuous = on; host.scheduleRepaint(); },
                }],
                onClose: (visible) => {
                    timing.setEnabled(visible);
                    if (visible) {
                        host.scheduleRepaint();
                        startTicking();
                    }
                },
            });
        }
        win.show();
        timing.setEnabled(true);
        host.scheduleRepaint();
        update();
        startTicking();
    }

    // on the animation frames while the window is open: with 'repaint continuously' a
    // frame on each, else the GPU results that came after their frame
    function startTicking() {
        if (ticking) return;
        ticking = true;
        const tick = () => {
            if (!win || !win.isVisible()) {
                ticking = false;
                return;
            }
            if (continuous) host.scheduleRepaint();
            else if (timing.poll()) update();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    //
    //  the benchmark: after a warm-up (the GPU raises its clocks under load) render the
    //  frame `frames` times back to back and keep the means of the sections in `bench`;
    //  the window shows them next to the live averages. A running simulation is stepped
    //  by these frames too.
    //
    async function runBenchmark(frames) {
        if (benchRunning || !timing) return;
        benchRunning = true;
        const gl = host.getGLContext().gl;
        const px = new Uint8Array(4);
        const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        try {
            host.setFrameTiming(null);
            const t0 = performance.now();
            while (performance.now() - t0 < 300) { host.renderFrame(); sync(); }
            bench = FrameTiming({ gl, mean: true });
            bench.setEnabled(true);
            host.setFrameTiming(bench);
            for (let i = 0; i < frames; i++) {
                bench.beginFrame();
                host.renderFrame();
                bench.endFrame();
            }
            sync();
        } finally {
            host.setFrameTiming(timing);
        }
        // the GPU results arrive after returning to the event loop
        for (let k = 0; k < 200 && bench.pendingCount(); k++) {
            await new Promise(r => setTimeout(r, 10));
            bench.poll();
        }
        benchRunning = false;
        host.scheduleRepaint();
        update();
    }

    function update() {
        if (!win || !win.isVisible()) return;
        const st = timing.getStats();
        const ms = (v) => (v === null || v === undefined) ? '—' : v.toFixed(2);
        const benchStats = bench ? bench.getStats() : null;
        const cnv = host.canvas.glCanvas;
        const lines = [
            ['canvas', `${cnv.width} × ${cnv.height} (${(cnv.width * cnv.height / 1e6).toFixed(2)} Mpx)`],
            ['frame interval', st.interval ? `${st.interval.toFixed(1)} ms (${(1000 / st.interval).toFixed(0)} fps)` : '—'],
            ['frames', String(st.frames)],
        ];
        let columns = ['ms', 'GPU', 'CPU'];
        let rows = st.sections.map(s => [s.label, ms(s.gpu), ms(s.cpu)]);
        let footer = ['frame', ms(st.gpuFrame), ms(st.cpuFrame)];
        let note = 'live: averages of the recent frames; the app draws only after a change unless "repaint continuously" is on';
        if (benchStats) {
            // the benchmark columns, rows matched by label; sections only one of them has get a dash
            columns = columns.concat(['bench GPU', 'bench CPU']);
            const labels = st.sections.map(s => s.label);
            for (const b of benchStats.sections) if (!labels.includes(b.label)) labels.push(b.label);
            rows = labels.map(label => {
                const l = st.sections.find(x => x.label === label) || {};
                const b = benchStats.sections.find(x => x.label === label) || {};
                return [label, ms(l.gpu), ms(l.cpu), ms(b.gpu), ms(b.cpu)];
            });
            footer = footer.concat([ms(benchStats.gpuFrame), ms(benchStats.cpuFrame)]);
            note += `; bench: means of ${benchStats.frames} frames rendered back to back`;
        }
        if (!st.gpuAvailable) note = 'GPU time is not available in this browser (EXT_disjoint_timer_query_webgl2); ' + note;
        win.update({ lines, columns, rows, footer, note });
    }
}

export const TimingPanel = { create };
