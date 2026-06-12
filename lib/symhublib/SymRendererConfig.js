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
    ParamFunc,
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

    async function reset() {
        if (DEBUG) console.log(`${MYNAME}: resetting configuration and application state`);
        
        // 1. Clear localStorage
        try {
            localStorage.clear();
        } catch (e) {
            console.warn(`${MYNAME}: could not clear localStorage`, e);
        }

        // 2. Clear IndexedDB
        const dbs = ['FileSelectionDialog', 'SaveAsDialog', 'ExportImageDialog'];
        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
            try {
                const list = await window.indexedDB.databases();
                for (const dbInfo of list) {
                    if (dbInfo.name && !dbs.includes(dbInfo.name)) {
                        dbs.push(dbInfo.name);
                    }
                }
            } catch (e) {
                console.warn('Could not query IndexedDB databases', e);
            }
        }
        
        const promises = dbs.map(name => {
            return new Promise((resolve) => {
                try {
                    const req = window.indexedDB.deleteDatabase(name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => {
                        console.warn(`Deletion of database '${name}' is blocked`);
                        resolve();
                    };
                } catch (e) {
                    console.warn(`Error requesting deletion of database '${name}'`, e);
                    resolve();
                }
            });
        });
        
        await Promise.all(promises);

        // 3. Restart application with default settings
        window.location.hash = '';
        window.location.reload();
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
        reset: ParamFunc({
            name:     'Reset Settings...',
            func: () => {
                if (confirm("Are you sure you want to reset the application? This will clear all settings, local storage, and IndexedDB database handles.")) {
                    reset();
                }
            },
        }),
    };

    // ── Public API ────────────────────────────────────────────────────────────

    let _window = null;
    let _gui = null;

    /**
     * Lazily create a draggable InternalWindow containing the settings GUI.
     * Subsequent calls toggle its visibility.
     */
    function toggleUI() {

        if (!_window) {
            _window = createInternalWindow({
                title:     'settings',
                width:     '280px',
                height:    '230px',
                left:      'calc(100% - 620px)',
                top:       '4px',
                canClose:  true,
                canResize: true,
                storageId: storageKey + '_ui',
                onResize: () => {
                    if (_gui && _window.interior) {
                        _gui.width = _window.interior.clientWidth;
                    }
                }
            });

            const interior = _window.interior;
            interior.style.padding = '0';
            interior.style.boxSizing = 'border-box';
            interior.style.backgroundColor = 'var(--background-color)';
            interior.style.overflowX = 'hidden';
            interior.style.overflowY = 'auto';

            _gui = new DatGUI({ autoPlace: false, width: 280 });
            _gui.domElement.style.position = 'relative';
            _gui.domElement.style.width    = '100%';
            _gui.domElement.style.padding  = '0 8px';
            _gui.domElement.style.boxSizing = 'border-box';
            _gui.domElement.style.backgroundColor = 'var(--background-color)';
            interior.appendChild(_gui.domElement);
            createParamUI(_gui, mParams);

            if (_gui && interior) {
                _gui.width = interior.clientWidth;
            }
        } else {
            const visible = _window.wnd.style.visibility !== 'hidden';
            _window.setVisible(!visible);
            if (!visible && _gui && _window.interior) {
                _gui.width = _window.interior.clientWidth;
            }
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

        reset,
        Reset: reset,
    };

} // createSymRendererConfig
