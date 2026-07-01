/**
 * SymRendererScripting.js
 *
 * Encapsulates all scripting-related logic for SymRenderer:
 *   - ScriptAPI facade construction
 *   - Script loading (from URL or local file)
 *   - Animation time callback dispatch (setTime)
 *   - "Open Script..." UI handler
 *   - "Restart" animation handler
 *   - Dynamic toolbar button injection
 *
 * Usage inside SymRenderer:
 *
 *   const mScripting = createSymRendererScripting({
 *       // param/render hooks for ScriptAPI
 *       getParams, scheduleRepaint, renderFrame,
 *       getPattern, getVisualization, getGroup, loadPresetUrl,
 *       // UI hooks for toolbar button injection
 *       getToolbox, resPath, onToggleRun, LABEL_RUN,
 *       // config/params for restart
 *       getConfig, getUIParams,
 *   });
 *
 *   // In renderFrame():
 *   mScripting.callSetTime(animTime);
 *
 *   // In Files menu:
 *   ParamFunc({func: () => mScripting.onOpenScript(), name: 'Open Script...'})
 *
 *   // Public facade:
 *   app.getScriptAPI()  =>  mScripting.getScriptAPI()
 */

import { createScriptAPI, createScriptEvents } from './ScriptAPI.js';
import { DatGUI, createParamUI, ParamFunc, ParamChoice } from './modules.js';

const MYNAME = 'SymRendererScripting';
const DEBUG  = false;

/**
 * Create the scripting controller for a SymRenderer instance.
 *
 * @param {object} hooks
 *
 * Hooks for ScriptAPI:
 * @param {()=>object}           hooks.getParams        — live root ParamGroup
 * @param {()=>void}             hooks.scheduleRepaint  — trigger a RAF repaint
 * @param {()=>void}             hooks.renderFrame      — synchronous single frame
 * @param {()=>object}           hooks.getPattern       — mPattern
 * @param {(name?)=>object}      hooks.getVisualization — mVisualization (or named layer)
 * @param {()=>object}           hooks.getGroup         — current symmetry group
 * @param {(url:string)=>Promise} hooks.loadPresetUrl   — load a preset by URL
 *
 * Hooks for toolbar button injection:
 * @param {()=>object|null}   hooks.getToolbox    — current mToolbox (may be null)
 * @param {(name:string)=>string} hooks.resPath   — resource path resolver
 * @param {()=>void}          hooks.onToggleRun   — Run/Stop button action
 * @param {string}            hooks.LABEL_RUN     — label for the Run button
 *
 * Hooks for animation restart:
 * @param {()=>object}  hooks.getConfig    — mConfig ({ recording: { animTime } })
 * @param {()=>object}  hooks.getUIParams  — mParams (UI param tree with updateDisplay)
 */
export function createSymRendererScripting(hooks) {

    // The event dispatcher shared between SymRenderer and scripts.
    // Created immediately so scripts can subscribe before startApplication() fires.
    const mScriptEvents = createScriptEvents();

    // The animation controller returned by the script's default export.
    // SymRenderer calls setTime(t) on this every frame while running.
    let mScriptObj = null;

    // Reference to the 'script params' DatGUI subfolder inside the 'scripting' folder.
    // Set by initGUI() after the main GUI is built.
    let mScriptParamsFolder = null;

    // Script state deferred during preset load: set by scriptParams.setValue() before
    // the async script finishes loading, applied by _loadFromUrl() after it completes.
    let mPendingScriptState = null;

    // ── Controller-state helpers ──────────────────────────────────────────────

    /**
     * Recursively read current values from a DatGUI folder's controllers.
     * Returns a plain object `{ propertyName: value, subFolderName: {...} }`.
     */
    function getControllerStates(folder) {
        if (!folder) return {};
        const state = {};
        for (const c of (folder.__controllers || [])) {
            state[c.property] = c.getValue();
        }
        for (const [name, sub] of Object.entries(folder.__folders || {})) {
            state[name] = getControllerStates(sub);
        }
        return state;
    }

    /**
     * Recursively restore values into a DatGUI folder's controllers.
     * @param {object} folder — DatGUI folder
     * @param {object} state  — plain object from getControllerStates()
     */
    function applyControllerStates(folder, state) {
        if (!folder || !state || typeof state !== 'object') return;
        for (const c of (folder.__controllers || [])) {
            if (Object.prototype.hasOwnProperty.call(state, c.property)) {
                try {
                    c.setValue(state[c.property]);
                    c.updateDisplay?.();
                } catch(e) {
                    console.warn(`${MYNAME}: failed to restore '${c.property}'`, e);
                }
            }
        }
        for (const [name, sub] of Object.entries(folder.__folders || {})) {
            if (Object.prototype.hasOwnProperty.call(state, name)) {
                applyControllerStates(sub, state[name]);
            }
        }
    }


    // ── Params — makes mScripting usable as a ParamObj target ────────────────

    // State object backing the script-selection ParamChoice.
    const mScriptState = { selectedScript: '(none)' };

    // Memoized params: MUST be the same object instances across calls.
    // ParamObj.setValue() calls obj.getParams() afresh each time — if we returned
    // new ParamChoice objects, their dat.gui controllers would be null and
    // controller.updateDisplay() (which refreshes the dropdown display) would be a no-op.
    let mCachedParams = null;

    /**
     * Called by ParamObj/createParamUI when building the 'scripting' GUI folder.
     * Returns (memoized):
     *   - a dropdown to pick from the available scripts  (when scriptUrls provided)
     *   - a synthetic 'scriptParams' entry for serialization of script param values
     *   - an 'Open Script...' file-picker button
     * The 'script params' DatGUI subfolder is added separately in initGUI().
     */
    function getParams() {
        if (mCachedParams) return mCachedParams;

        const params = {};

        // Script-selector dropdown (only shown when a scripts list was provided)
        const scriptUrls = hooks.scriptUrls || [];
        if (scriptUrls.length > 0) {
            const names = ['(none)', ...scriptUrls.map(s => s.name)];
            params.script = ParamChoice({
                obj:      mScriptState,
                key:      'selectedScript',
                choice:   names,
                name:     'script',
                onChange:  onScriptSelected,
            });
        }

        // Synthetic serializable param — persists/restores script UI param values.
        // getValue() snapshots the current dat.gui controller values.
        // setValue(state) always defers into mPendingScriptState.
        //
        // We must ALWAYS defer, never apply immediately — even when the folder
        // already has controllers.  During a preset load, params.script.setValue()
        // fires first and triggers onScriptSelected() → _loadFromUrl() (async).
        // That async call will clear and repopulate the folder, overwriting any
        // values we applied immediately.  Deferring lets _loadFromUrl() apply
        // the saved state after the repopulation.
        params.scriptParams = {
            getValue:     () => getControllerStates(mScriptParamsFolder),
            setValue:     (state) => {
                mPendingScriptState = (state && typeof state === 'object') ? state : null;
            },
            serializable: true,
        };

        params.openScript = ParamFunc({ func: onOpenScript, name: 'Open Script...' });

        mCachedParams = params;
        return mCachedParams;
    }


    /**
     * Called when the user picks a script from the dropdown.
     * Loads the script at the matching URL, or clears params if '(none)'.
     */
    function onScriptSelected() {
        const selected = mScriptState.selectedScript;
        if (selected === '(none)') {
            mScriptObj = null;
            clearScriptParamsFolder();
            mPendingScriptState = null;  // no script — no state to restore
            return;
        }
        const scriptUrls = hooks.scriptUrls || [];
        const entry = scriptUrls.find(s => s.name === selected);
        if (entry) {
            loadScriptUrl(entry.url);
        } else {
            console.warn(`${MYNAME}.onScriptSelected(): no entry for '${selected}'`);
        }
    }


    // ── ScriptAPI construction ────────────────────────────────────────────────

    /**
     * Build a fresh ScriptAPI facade bound to this SymRenderer instance.
     * Called once per script load.
     */
    function getScriptAPI() {
        return createScriptAPI({
            getParams:        hooks.getParams,
            scheduleRepaint:  hooks.scheduleRepaint,
            renderFrame:      hooks.renderFrame,
            getPattern:       hooks.getPattern,
            getVisualization: hooks.getVisualization,
            getGroup:         hooks.getGroup,
            loadPresetUrl:    hooks.loadPresetUrl,
            events:           mScriptEvents,
            createScriptUI:   createScriptUI,
        });
    }

    // ── Core script loading ───────────────────────────────────────────────────

    /**
     * Load a script module from a URL.
     * Calls mod.default(api), stores the returned controller in mScriptObj.
     * @param {string} url — absolute or blob URL to an ES module
     * @returns {Promise<object|null>} — the controller object, or null on failure
     */
    async function _loadFromUrl(url) {
        try {
            const mod = await import(url);
            if (typeof mod.default !== 'function') {
                console.warn(`${MYNAME}: module has no default export function`);
                return null;
            }
            const result = mod.default(getScriptAPI());
            mScriptObj = (result && typeof result === 'object') ? result : null;

            // Apply any script state that was deferred during preset load.
            // (setParamValues called scriptParams.setValue before the async import finished)
            if (mPendingScriptState !== null) {
                applyControllerStates(mScriptParamsFolder, mPendingScriptState);
                mPendingScriptState = null;
            }

            return mScriptObj;
        } catch(err) {
            console.error(`${MYNAME}: failed to load script`, err);
            return null;
        }
    }

    /**
     * Load a script from a URL supplied at startup (relative to location.href).
     * Called by SymRenderer.startApplication() when options.scriptUrl is set.
     * @param {string} scriptUrl — URL as passed in SymRenderer options
     * @returns {Promise<object|null>}
     */
    async function loadScriptUrl(scriptUrl) {
        const resolvedUrl = new URL(scriptUrl, location.href).href;
        if (DEBUG) console.log(`${MYNAME}.loadScriptUrl()`, resolvedUrl);
        return _loadFromUrl(resolvedUrl);
    }

    // ── "Open Script..." file picker handler ─────────────────────────────────

    /**
     * Open a browser file picker, load the selected .js/.mjs file as an
     * ES module via a Blob URL, and install it as the active script.
     *
     * Note: relative imports *inside* the chosen file won't resolve against
     * its original path (blob URL has no path context).  For scripts that
     * import other modules, serve them from a dev server and use scriptUrl.
     */
    function onOpenScript() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.js,.mjs';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const blobUrl = URL.createObjectURL(file);
            try {
                const result = await _loadFromUrl(blobUrl);
                if (result !== null) {
                    // If Run/Restart buttons weren't created at startup
                    // (no scriptUrl option), inject them now.
                    ensureScriptButtons();
                    console.log(`${MYNAME}: loaded '${file.name}'`, result);
                }
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        };
        input.click();
    }

    // ── Animation time dispatch ───────────────────────────────────────────────

    /**
     * Call the script controller's setTime(t) if a script is loaded.
     * Called by SymRenderer.renderFrame() every frame while simulationRunning.
     * @param {number} t — accumulated animation time in seconds
     */
    function callSetTime(t) {
        if (mScriptObj?.setTime) {
            mScriptObj.setTime(t);
        }
    }

    // ── Restart handler ───────────────────────────────────────────────────────

    /**
     * Reset the animation clock to zero and immediately notify the script.
     * Works whether the animation is running or paused.
     */
    function onRestartAnimation() {
        const config = hooks.getConfig();
        config.recording.animTime = 0;

        const uiParams = hooks.getUIParams();
        if (uiParams?.recording?.animTime) {
            uiParams.recording.animTime.updateDisplay();
        }

        // Notify script immediately so visuals snap to t=0
        callSetTime(0);
        hooks.scheduleRepaint();
    }

    // ── Toolbar button injection ──────────────────────────────────────────────

    /**
     * Dynamically insert Run and Restart buttons into the toolbar if they
     * don't already exist.  Called after a script is loaded at runtime via
     * "Open Script..." (i.e. no scriptUrl was set at startup).
     */
    function ensureScriptButtons() {
        const toolbox = hooks.getToolbox();
        if (!toolbox || toolbox.buttons.run) return; // already present

        function makeBtn(opt = {}) {
            const btn       = document.createElement('input');
            btn.type        = 'image';
            btn.src         = opt.src;
            btn.title       = opt.title;
            btn.onclick     = opt.action;
            btn.className   = 'imgbutton';
            return btn;
        }

        const runBtn     = makeBtn({
            title: hooks.LABEL_RUN,
            src:   hooks.resPath('btn_play.svg'),
            action: hooks.onToggleRun,
        });
        const restartBtn = makeBtn({
            title:  'Restart',
            src:    hooks.resPath('btn_restart.svg'),
            action: () => onRestartAnimation(),
        });

        toolbox.buttons.run     = runBtn;
        toolbox.buttons.restart = restartBtn;

        // Insert right after the 'options' button (first in toolbar)
        const toolsBtn = toolbox.buttons.tools;
        toolsBtn.insertAdjacentElement('afterend', restartBtn);
        toolsBtn.insertAdjacentElement('afterend', runBtn);
    }

    // ── Script UI — DatGUI-folder-based approach ─────────────────────────────

    /**
     * Called once after createParamUI() has built the main GUI.
     * Locates the 'scripting' DatGUI folder and creates the 'script params'
     * subfolder inside it.
     *
     * @param {object} scriptingDatGuiFolder
     *   The DatGUI folder object for the 'scripting' section
     *   (i.e. mGUI.__folders['scripting'] from SymRenderer).
     */
    function initGUI(scriptingDatGuiFolder) {
        if (!scriptingDatGuiFolder) {
            console.warn(`${MYNAME}.initGUI(): scripting DatGUI folder not found`);
            return;
        }
        mScriptParamsFolder = scriptingDatGuiFolder.addFolder('script params');
        if (DEBUG) console.log(`${MYNAME}.initGUI() script params folder created`, mScriptParamsFolder);
    }

    /**
     * Remove all controllers and subfolders from the 'script params' DatGUI folder.
     * Called before populating it with a newly loaded script's params.
     */
    function clearScriptParamsFolder() {
        if (!mScriptParamsFolder) return;
        // Remove all controllers
        const controllers = [...(mScriptParamsFolder.__controllers || [])];
        controllers.forEach(c => { try { mScriptParamsFolder.remove(c); } catch(_) {} });
        // Remove all subfolders
        const subFolders = Object.values(mScriptParamsFolder.__folders || {});
        subFolders.forEach(f => { try { mScriptParamsFolder.removeFolder(f); } catch(_) {} });
    }

    /**
     * Called by scripts via api.createScriptUI().
     * Clears the 'script params' folder and returns a reference to it
     * so the script can populate it with gui.add(...) calls.
     *
     * Options are accepted for backwards compat but window-specific
     * properties (title, left, top) are ignored — params now live
     * inside the main dat.gui panel.
     *
     * @returns {{ gui: DatGUI|null, window: null, addParams(params): void }}
     */
    function createScriptUI(options = {}) {
        clearScriptParamsFolder();

        if (!mScriptParamsFolder) {
            console.warn(`${MYNAME}.createScriptUI(): GUI not yet initialized`);
            return { gui: null, window: null, addParams: () => {} };
        }

        function addParams(params) {
            createParamUI(mScriptParamsFolder, params);
        }

        return { gui: mScriptParamsFolder, window: null, addParams };
    }

    // ── Public interface ──────────────────────────────────────────────

    return {
        /** Shared event bus — fire 'beforeRender', 'afterRender', 'groupChanged' */
        events: mScriptEvents,

        /** Expose as a uilib-compatible object for ParamObj wrapping */
        getParams,

        /** Called after initGUI() — creates the 'script params' DatGUI subfolder */
        initGUI,

        /** Build and return the ScriptAPI for use by scripts */
        getScriptAPI,

        /** Load a script from a URL provided in SymRenderer options */
        loadScriptUrl,

        /** Call script.setTime(t) — invoke every frame from renderFrame() */
        callSetTime,

        /** Files menu handler: open file picker and load chosen script */
        onOpenScript,

        /** Restart button handler: reset animTime to 0 */
        onRestartAnimation,

        /** Create / refresh the 'script params' folder — called from scripts via api.createScriptUI() */
        createScriptUI,

        /** Inject Run/Restart buttons into the toolbar (called at startup when scriptUrls are provided) */
        ensureScriptButtons,

        /** Direct access to the current script controller (may be null) */
        getScriptObj: () => mScriptObj,
    };

} // createSymRendererScripting
