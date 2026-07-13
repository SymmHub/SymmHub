/**
 * PipelineManager.js
 *
 * Generic GPU processing pipeline manager for SymRenderer.
 *
 * Manages an ordered list of Workers.  Each worker must implement:
 *
 *   worker.init(glCtx)
 *   worker.process(buffer, time)   — reads buffer.read, writes buffer.write, calls buffer.swap()
 *   worker.getParams()             — param tree for UI / serialisation
 *   worker.getName()               — human-readable name
 *   worker.getClassName()          — stable class id (used for serialisation)
 *
 * Optional worker methods (called when present):
 *   worker.setGroup(group)         — receive the current symmetry group
 *   worker.initialize(buffer)      — fill/reset the buffer (called by initSimulation())
 *
 * PipelineManager itself implements the SymRenderer patternCreator.create() interface:
 *   init(glCtx), getName(), getClassName(), getParams(), setGroup(group),
 *   initSimulation(), doStep(), getPatternData(), addEventListener(), canAnimate
 *
 * Usage:
 *   const creator = makePipelineManagerCreator({
 *       gridSize:      512,
 *       workerFactory: myWorkerFactory,   // (getGLCtx, getBuffer, getGroup, getChildren) => ObjectFactory
 *       defaultWorkers: [ glInit, glSim, symm ],  // uninitialised worker instances
 *   });
 *   SymRenderer({ patternCreator: creator, ... }).run();
 */

import {
    ObjArray,
    ParamObjArray,
    ParamFunc,
    ParamGroup,
    ParamCustom,
    EventDispatcher,
    createDoubleFBO,
    fa2str,
    str2fa,
} from './modules.js';

import {
    saveBufferData,
    loadBufferData,
} from '../uilib/BinaryStoreUtils.js';

import {
    makePatternData,
} from './PatternData.js';

const DEBUG = true;
const MYNAME = 'PipelineManager';

// ── PipelineManager ───────────────────────────────────────────────────────────

function PipelineManager(options = {}) {

    let mGLCtx  = null;
    let mBuffer = null;   // shared DoubleFBO (RG32F)
    let mGroup  = null;

    const mGridSize        = options.gridSize ?? 512;
    const mEventDispatcher = new EventDispatcher();

    // Worker factory — required.
    // Signature: (getGLCtx, getBuffer, getGroup, getChildren) => ObjectFactory
    const workerFactoryFn = options.workerFactory;
    if (!workerFactoryFn) throw new Error(`${MYNAME}: options.workerFactory is required`);

    const mFactory = workerFactoryFn(
        () => mGLCtx,
        () => mBuffer,
        () => mGroup,
        () => mWorkerArray.getChildren(),
    );

    // Build initial worker list from options.defaultWorkers or empty
    const rawWorkers = options.defaultWorkers ?? [];

    const mWorkerArray = ObjArray({
        id:       'workers',
        children: rawWorkers,
        factory:  mFactory,
    });

    // Holder object for ParamObjArray (needs obj[key] form)
    const mWorkerHolder = { workers: mWorkerArray };
    let mParams = null;

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        return ParamGroup({
            name: 'pipeline',
            params: {
                workers: ParamObjArray({
                    obj:     mWorkerHolder,
                    key:     'workers',
                    name:    'workers',
                    factory: mFactory,
                    onChange: () => { /* future: trigger repaint */ },
                }),
                initSimulation: ParamFunc({
                    func: initSimulation,
                    name: 'Initialize',
                }),
                buffer: ParamCustom({
                    getValue: getBufferData,
                    setValue: setBufferData,
                }),
            },
        });
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(glCtx) {
        if (DEBUG) console.log(`${MYNAME}.init()`);
        mGLCtx = glCtx;
        const gl = glCtx.gl;

        // Allocate shared processing buffer (RG32F — same as GL / GrayScott sims)
        mBuffer = createDoubleFBO(gl, mGridSize, mGridSize, gl.RG32F, gl.RG, gl.FLOAT, gl.LINEAR);

        // Initialise all workers in order
        for (const worker of mWorkerArray.getChildren()) {
            worker.init(glCtx);
            // Forward group if already set (e.g., on hot-add from factory)
            if (mGroup && typeof worker.setGroup === 'function') {
                worker.setGroup(mGroup);
            }
        }

        mParams = makeParams();

        // Fill buffer with initial data
        _runInitialize();
    }

    // ── processing ────────────────────────────────────────────────────────────

    /**
     * Run one full processing pass: call worker.process() for each worker in order.
     * @param {number} time  — animation timestamp (seconds)
     */
    function process(time) {
        for (const worker of mWorkerArray.getChildren()) {
            worker.process(mBuffer, time);
        }
    }

    /**
     * Advance the simulation one step (called by SymRenderer's animation loop).
     * Fires 'imageChanged' after completing the pass.
     */
    function doStep() {
        process(0);
        mEventDispatcher.dispatchEvent({ type: 'imageChanged', target: myself });
    }

    // ── initialisation ────────────────────────────────────────────────────────

    /**
     * Call worker.initialize(buffer) on every worker that exposes it.
     * This fills/resets the shared buffer.
     */
    function _runInitialize() {
        for (const worker of mWorkerArray.getChildren()) {
            if (typeof worker.initialize === 'function') {
                worker.initialize(mBuffer);
            }
        }
    }

    /**
     * Public: reset simulation to initial state.
     * Connected to the "Initialize" button in the param UI.
     */
    function initSimulation() {
        if (DEBUG) console.log(`${MYNAME}.initSimulation()`);
        _runInitialize();
        mEventDispatcher.dispatchEvent({ type: 'imageChanged', target: myself });
    }

    // ── group ─────────────────────────────────────────────────────────────────

    /**
     * Forward the symmetry group to all workers that have setGroup().
     * Called by SymRenderer when the user changes the group.
     */
    function setGroup(group) {
        mGroup = group;
        for (const worker of mWorkerArray.getChildren()) {
            if (typeof worker.setGroup === 'function') {
                worker.setGroup(group);
            }
        }
    }

    // ── buffer save / load ────────────────────────────────────────────────────

    function _readBuffer() {
        const gl = mGLCtx.gl;
        const w  = mBuffer.width, h = mBuffer.height;
        const fa = new Float32Array(2 * w * h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, mBuffer.read.fbo);
        gl.readPixels(0, 0, w, h, gl.RG, gl.FLOAT, fa);
        return fa;
    }

    function _writeBuffer(fa, width, height) {
        const gl = mGLCtx.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        mBuffer.read.attach(0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, fa);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    }

    function _getLegacyData()     { return fa2str(_readBuffer()); }
    function _setLegacyData(data) { _writeBuffer(str2fa(data.buffer), data.width, data.height); }

    function getBufferData() {
        if (!mBuffer) return null;
        return saveBufferData({
            name:          `${MYNAME}.simData`,
            width:         mBuffer.width,
            height:        mBuffer.height,
            components:    2,
            useBinary:     true,
            readData:      _readBuffer,
            getLegacyData: _getLegacyData,
        });
    }

    function setBufferData(data) {
        if (!mBuffer) return;
        loadBufferData(data, {
            name:        MYNAME,
            writeData:   _writeBuffer,
            writeLegacy: _setLegacyData,
        });
    }

    // ── pattern data ──────────────────────────────────────────────────────────

    /**
     * Return the shared buffer wrapped in PatternData.
     * Called by SymRenderer for rendering and binary export.
     */
    function getPatternData() {
        return makePatternData({ mainBuffer: mBuffer });
    }

    // ── events ────────────────────────────────────────────────────────────────

    function addEventListener(evtType, listener) {
        mEventDispatcher.addEventListener(evtType, listener);
    }

    // ── public API ────────────────────────────────────────────────────────────

    const myself = {
        init,
        getName:         () => MYNAME,
        getClassName:    () => MYNAME,
        getParams,
        addEventListener,
        setGroup,
        initSimulation,
        doStep,
        getPatternData,
        canAnimate: true,   // tells SymRenderer to show Run/Restart buttons
    };

    return myself;

} // PipelineManager


/**
 * Creates a patternCreator-compatible object for SymRenderer.
 *
 * @param {object} options
 * @param {number}   [options.gridSize=512]      — shared buffer dimensions
 * @param {Function} options.workerFactory        — (getGLCtx, getBuffer, getGroup, getChildren) => ObjectFactory
 * @param {object[]} [options.defaultWorkers=[]]  — uninitialised worker instances
 */
function makePipelineManagerCreator(options) {
    return {
        create:       () => PipelineManager(options),
        getName:      () => MYNAME,
        getClassName: () => MYNAME,
    };
}

export { PipelineManager, makePipelineManagerCreator };
