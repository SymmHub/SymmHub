/**
 * SymRendererConfig.js
 *
 * Persistent, UI-editable configuration for SymRenderer.
 * Settings are stored in localStorage and surfaced as a dat.GUI param group.
 *
 * Usage:
 *   const mRendererConfig = createSymRendererConfig({ storageKey: 'myapp_config' });
 *   // Mount in makeParams():
 *   settings: mRendererConfig.params
 *   // Read live value:
 *   mRendererConfig.useBinaryStorage   // → boolean
 */

import {
    ParamBool,
    ParamInt,
    DatGUI,
    createParamUI,
    createInternalWindow,
} from '../uilib/uilib.js';

const MYNAME = 'SymRendererConfig';
const DEBUG = true;
const DEFAULT_STORAGE_KEY = 'symrenderer_config';

/** Default values — used when nothing is saved yet */
const DEFAULTS = {
    useBinaryStorage: false,
    exportWidth: 2048,
    exportHeight: 2048,
    exportTileSize: 2048,
};

/**
 * @param {object} [options]
 * @param {string} [options.storageKey]  localStorage key (default 'symrenderer_config')
 */
export function createSymRendererConfig(options = {}) {

    const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

    // ── Load persisted values ─────────────────────────────────────────────────

    let mValues = { ...DEFAULTS };

    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const saved = JSON.parse(raw);
            // Merge: known keys only, so stale/unknown keys don't linger
            for (const key of Object.keys(DEFAULTS)) {
                if (key in saved) mValues[key] = saved[key];
            }
            if (DEBUG) console.log(`${MYNAME}: loaded config from '${storageKey}'`, mValues);
        }
    } catch(e) {
        console.warn(`${MYNAME}: could not load saved config`, e);
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    function save() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(mValues));
            if (DEBUG) console.log(`${MYNAME}: saved config`, mValues);
        } catch(e) {
            console.warn(`${MYNAME}: could not save config`, e);
        }
    }

    // ── Settings params (dat.GUI) ─────────────────────────────────────────────

    const mParams = {
        useBinaryStorage: ParamBool({
            obj:      mValues,
            key:      'useBinaryStorage',
            name:     'use .bin',
            onChange: save,
        }),
        exportWidth: ParamInt({
            obj:      mValues,
            key:      'exportWidth',
            name:     'export width',
            onChange: save,
        }),
        exportHeight: ParamInt({
            obj:      mValues,
            key:      'exportHeight',
            name:     'export height',
            onChange: save,
        }),
        exportTileSize: ParamInt({
            obj:      mValues,
            key:      'exportTileSize',
            name:     'export tile size',
            onChange: save,
        }),
    };

    // ── Public API ────────────────────────────────────────────────────────────

    let _window = null;

    /**
     * Lazily create a draggable InternalWindow containing the settings GUI.
     * Subsequent calls toggle its visibility.
     */
    function toggleUI() {

        if (!_window) {
            _window = createInternalWindow({
                title:     'settings',
                width:     '280px',
                height:    '200px',
                left:      'calc(100% - 620px)',
                top:       '4px',
                canClose:  true,
                canResize: true,
                storageId: storageKey + '_ui',
            });

            const gui = new DatGUI({ width: 280 });
            // Render inline inside the window interior, not as a fixed overlay
            gui.domElement.style.position = 'relative';
            gui.domElement.style.width    = '100%';
            _window.interior.appendChild(gui.domElement);
            createParamUI(gui, mParams);
        } else {
            const visible = _window.wnd.style.visibility !== 'hidden';
            _window.setVisible(!visible);
        }

    }

    return {
        /** ParamGroup — can be passed to createParamUI independently */
        params: mParams,

        /** Live getter — always reflects the current saved value */
        get useBinaryStorage() { return mValues.useBinaryStorage; },

        get exportWidth() { return mValues.exportWidth; },
        set exportWidth(val) { mValues.exportWidth = val; save(); },

        get exportHeight() { return mValues.exportHeight; },
        set exportHeight(val) { mValues.exportHeight = val; save(); },

        get exportTileSize() { return mValues.exportTileSize; },
        set exportTileSize(val) { mValues.exportTileSize = val; save(); },

        /** Toggle (lazily create) the standalone settings GUI panel */
        toggleUI,
    };

} // createSymRendererConfig
