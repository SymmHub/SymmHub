/**
 * FrameTiming.js
 *
 * Time spent per section of a rendered frame (a visualization layer, the
 * simulation step, ...), on the GPU and on the CPU, as running averages.
 *
 *   const timing = FrameTiming({ gl });
 *   timing.setEnabled(true);          // off by default: then every call is a no-op
 *
 *   timing.beginFrame();
 *   timing.section('simulation', () => pattern.doStep());
 *   timing.section('layer 1',    () => layer.render(par));
 *   timing.endFrame();
 *
 *   timing.poll();                    // on idle animation frames: collects late GPU results, returns their count
 *   timing.getStats() -> {
 *       gpuAvailable,             // EXT_disjoint_timer_query_webgl2 present
 *       frames,                   // frames measured since enabled / reset
 *       interval,                 // ms between consecutive rendered frames (gaps over 250 ms skipped)
 *       cpuFrame,                 // ms of JavaScript from beginFrame to endFrame
 *       gpuFrame,                 // sum of the GPU time of the sections
 *       sections: [ { label, gpu, cpu } ]   // in the order of the last frame
 *   }
 *
 * GPU time comes from timer queries around each section. Their results arrive
 * a frame or more later; endFrame() collects the ready ones without waiting,
 * so measuring does not stall the pipeline. Timer queries cannot nest:
 * sections must not contain sections. Calls of section() outside of
 * beginFrame()/endFrame() (an image export rendering a frame) just run fn.
 *
 * Averages are exponential (weight ALPHA of the newest frame), or plain means
 * of all measured frames with FrameTiming({gl, mean: true}) (a benchmark). A
 * section not seen for DROP_AFTER frames (a layer that was disabled or
 * removed) is dropped.
 */

const ALPHA = 0.1;
const DROP_AFTER = 30;
const MAX_GAP = 250;   // ms; a longer pause between two frames is not a frame interval

export function FrameTiming({ gl, mean = false } = {}) {

    const ext = gl ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;

    let mEnabled = false;
    let mInFrame = false;
    let mFrame = 0;                  // id of the current frame
    let mFrameStart = 0;
    let mLastFrameStart = 0;
    let mOrder = [];                 // labels in the order of the current frame
    let mLastOrder = [];
    const mPending = [];             // { label, query, frame }
    const mFree = [];                // reusable query objects
    const mStats = new Map();        // label -> { gpu, cpu, gpuN, cpuN, seen }
    let mInterval = 0, mIntervalN = 0;
    let mCpuFrame = 0, mCpuFrameN = 0;
    let mFrames = 0;

    const avg = (old, n, v) => (n === 0) ? v : old + (mean ? 1 / (n + 1) : ALPHA) * (v - old);

    function entry(label) {
        let e = mStats.get(label);
        if (!e) { e = { gpu: 0, cpu: 0, gpuN: 0, cpuN: 0, seen: mFrame }; mStats.set(label, e); }
        return e;
    }

    function reset() {
        mStats.clear();
        mInterval = mIntervalN = mCpuFrame = mCpuFrameN = mFrames = 0;
        mLastFrameStart = 0;
        mOrder = []; mLastOrder = [];
        if (ext) {
            for (const p of mPending) mFree.push(p.query);
            mPending.length = 0;
        }
    }

    function setEnabled(on) {
        on = !!on;
        if (on === mEnabled) return;
        mEnabled = on;
        reset();
    }

    function beginFrame() {
        if (!mEnabled) return;
        mInFrame = true;
        mFrame++;
        mOrder = [];
        mFrameStart = performance.now();
        if (mLastFrameStart) {
            const dt = mFrameStart - mLastFrameStart;
            if (dt < MAX_GAP) { mInterval = avg(mInterval, mIntervalN, dt); mIntervalN++; }
        }
        mLastFrameStart = mFrameStart;
        if (ext) gl.getParameter(ext.GPU_DISJOINT_EXT);   // clears the disjoint flag
    }

    function section(label, fn) {
        if (!mInFrame) return fn();
        let query = null;
        if (ext) {
            query = mFree.pop() || gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
        const t0 = performance.now();
        try {
            return fn();
        } finally {
            const t1 = performance.now();
            if (query) {
                gl.endQuery(ext.TIME_ELAPSED_EXT);
                mPending.push({ label, query, frame: mFrame });
            }
            const e = entry(label);
            e.cpu = avg(e.cpu, e.cpuN, t1 - t0); e.cpuN++;
            e.seen = mFrame;
            mOrder.push(label);
        }
    }

    // collect the GPU results that are ready; returns how many arrived
    function collect() {
        if (!ext || mPending.length === 0) return 0;
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        let k = 0;
        for (; k < mPending.length; k++) {
            const p = mPending[k];
            if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) break;   // results come in order
            if (!disjoint) {
                const e = mStats.get(p.label);
                if (e) { e.gpu = avg(e.gpu, e.gpuN, gl.getQueryParameter(p.query, gl.QUERY_RESULT) / 1e6); e.gpuN++; }
            }
            mFree.push(p.query);
        }
        if (k) mPending.splice(0, k);
        // a stuck queue (context lost, driver trouble) must not grow forever
        while (mPending.length > 256) mFree.push(mPending.shift().query);
        return k;
    }

    function endFrame() {
        if (!mInFrame) return;
        mInFrame = false;
        const dt = performance.now() - mFrameStart;
        mCpuFrame = avg(mCpuFrame, mCpuFrameN, dt); mCpuFrameN++;
        mFrames++;
        mLastOrder = mOrder;
        collect();
        for (const [label, e] of mStats) if (mFrame - e.seen > DROP_AFTER) mStats.delete(label);
    }

    function getStats() {
        const sections = [];
        const done = new Set();
        const add = (label) => {
            if (done.has(label)) return;
            const e = mStats.get(label);
            if (!e) return;
            done.add(label);
            sections.push({ label, gpu: e.gpuN ? e.gpu : null, cpu: e.cpu });
        };
        mLastOrder.forEach(add);
        for (const label of mStats.keys()) add(label);
        const gpuFrame = sections.some(x => x.gpu !== null) ? sections.reduce((s, x) => s + (x.gpu || 0), 0) : null;
        return {
            gpuAvailable: !!ext,
            frames: mFrames,
            interval: mIntervalN ? mInterval : null,
            cpuFrame: mCpuFrameN ? mCpuFrame : null,
            gpuFrame,
            sections,
        };
    }

    return {
        setEnabled,
        isEnabled: () => mEnabled,
        reset,
        beginFrame,
        section,
        endFrame,
        poll:       () => (mEnabled && !mInFrame) ? collect() : 0,   // between frames, e.g. on every animation frame
        pendingCount: () => mPending.length,                          // GPU results not arrived yet
        getStats,
    };
}
