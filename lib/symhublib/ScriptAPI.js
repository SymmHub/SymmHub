/**
 * ScriptAPI.js
 *
 * Scripting facade for SymRenderer — gives external JS code a clean, stable
 * surface to drive the renderer programmatically for animations, testing, or
 * custom UIs.
 *
 * Animation model
 * ───────────────
 * SymRenderer is fully in control of the animation clock. When the user
 * presses Play, SymRenderer increments `animationTime` (in seconds) each RAF
 * frame and calls the script object's `setTime(t)` method before rendering.
 * The script simply sets whatever params it needs inside `setTime`.
 *
 * Script file pattern:
 *
 *   // my_script.js
 *   export default function(api) {
 *
 *       // one-time setup — subscribe to events, pre-compute, etc.
 *       api.events.on('groupChanged', group => console.log('group:', group));
 *
 *       // return the animation controller object
 *       return {
 *           setTime(t) {
 *               api.setParam('pattern.patternParams.adjHueShift', (t / 20) % 1);
 *           }
 *       };
 *   }
 *
 * Path notation for setParam / getParam:
 *   Dot-separated strings walk the param tree returned by getParams().
 *   e.g. 'pattern.patternParams.adjHueShift'
 *        'visualization.layers.imageColorSym.coloringType'
 */

import { setParamValues, getParamValues } from '../uilib/uilib.js';

const MYNAME = 'ScriptAPI';
const DEBUG  = false;

/**
 * Create the scripting API facade.
 *
 * @param {object} hooks
 * @param {() => object}            hooks.getParams        — live root ParamGroup
 * @param {() => void}              hooks.scheduleRepaint  — trigger a RAF repaint
 * @param {() => void}              hooks.renderFrame      — synchronous single frame
 * @param {() => object}            hooks.getPattern       — mPattern
 * @param {(name?:string)=>object}  hooks.getVisualization — mVisualization or named layer
 * @param {() => object}            hooks.getGroup         — current symmetry group
 * @param {(url:string)=>Promise}   hooks.loadPresetUrl    — load a preset by URL
 * @param {ScriptEvents}            hooks.events           — shared event dispatcher
 * @param {(opt?)=>object}          hooks.createScriptUI   — create a floating DatGUI panel
 */
export function createScriptAPI(hooks) {

    // ── Path-notation param helpers ──────────────────────────────────────────

    /**
     * Resolve a dot-separated path inside the param tree.
     * Returns { parent, key } or null if the path is invalid.
     * @param {string} path
     */
    function resolvePath(path) {
        const params = hooks.getParams();
        const parts  = path.split('.');
        let   node   = params;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!node || !node[part]) {
                console.warn(`${MYNAME}.resolvePath() — no node for '${parts.slice(0, i+1).join('.')}'`);
                return null;
            }
            node = node[part];
        }

        const lastKey = parts[parts.length - 1];
        if (!node || !(lastKey in node)) {
            console.warn(`${MYNAME}.resolvePath() — key '${lastKey}' not found at '${path}'`);
            return null;
        }
        return { parent: node, key: lastKey };
    }

    /**
     * Set a single param by dot-separated path.
     * @param {string} path   e.g. 'pattern.patternParams.adjHueShift'
     * @param {*}      value
     */
    function setParam(path, value) {
        const r = resolvePath(path);
        if (!r) return;
        const param = r.parent[r.key];
        if (typeof param.setValue === 'function') {
            param.setValue(value);
        } else {
            console.warn(`${MYNAME}.setParam() — param at '${path}' has no setValue()`);
        }
        hooks.scheduleRepaint();
    }

    /**
     * Read a single param value by dot-separated path.
     * @param {string} path
     * @returns {*}
     */
    function getParam(path) {
        const r = resolvePath(path);
        if (!r) return undefined;
        const param = r.parent[r.key];
        if (typeof param.getValue === 'function') {
            return param.getValue();
        }
        return undefined;
    }

    /**
     * Apply a nested plain object to the param tree.
     * Only keys that exist in the tree are applied; extra keys are ignored.
     * @param {object} obj
     */
    function setParams(obj) {
        const params = hooks.getParams();
        setParamValues(params, obj);
        hooks.scheduleRepaint();
    }

    /**
     * Snapshot the full param state as a plain nested object.
     * @returns {object}
     */
    function getParamsSnapshot() {
        return getParamValues(hooks.getParams());
    }

    // ── Convenience render controls ───────────────────────────────────────────

    /**
     * Force a synchronous render of the current frame.
     */
    function render() {
        hooks.renderFrame();
    }

    /**
     * Load a preset from a URL.
     * @param {string} url
     */
    async function loadPreset(url) {
        return hooks.loadPresetUrl(url);
    }

    // ── Public API object ─────────────────────────────────────────────────────

    const api = {
        // Param access
        setParam,
        getParam,
        setParams,
        getParams:        getParamsSnapshot,

        // Manual render trigger
        render,
        loadPreset,

        // Component accessors
        getPattern:       hooks.getPattern,
        getVisualization: hooks.getVisualization,
        getGroup:         hooks.getGroup,

        // Events
        events:           hooks.events,

        // UI factory — creates a floating InternalWindow+DatGUI for the script
        createScriptUI:   hooks.createScriptUI,
    };

    return api;

} // createScriptAPI


// ── ScriptEvents — minimal synchronous event dispatcher ───────────────────────

/**
 * A lightweight synchronous event dispatcher.
 * Supports: on(event, handler), off(event, handler), fire(event, data).
 *
 * Events fired by SymRenderer:
 *   'beforeRender'  — before each renderFrame() call
 *   'afterRender'   — after each renderFrame() call
 *   'groupChanged'  — after the symmetry group changes  (data: group)
 */
export function createScriptEvents() {
    const mHandlers = {};

    function on(event, handler) {
        if (!mHandlers[event]) mHandlers[event] = new Set();
        mHandlers[event].add(handler);
    }

    function off(event, handler) {
        mHandlers[event]?.delete(handler);
    }

    function fire(event, data) {
        const set = mHandlers[event];
        if (!set) return;
        for (const h of set) {
            try {
                h(data);
            } catch(e) {
                console.error(`${MYNAME}.ScriptEvents: handler error for '${event}'`, e);
            }
        }
    }

    return { on, off, fire };
}
