/**
 * SymRendererConfig.js
 *
 * Persistent, UI-editable configuration for SymRenderer.
 * Settings are stored in localStorage and surfaced as a dat.GUI param group;
 * the UI builders show them in the Global Options window
 * (ui/parts/GlobalOptionsWindow.js).
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
    ParamChoice,
    ParamInt,
    ParamFunc,
    QUALITY_MODES,
} from './modules.js';

const MYNAME = 'SymRendererConfig';
const DEBUG = true;
const DEFAULT_STORAGE_KEY = 'symrenderer_config';

/** Default values — used when nothing is saved yet */
const DEFAULTS = {
    useBinaryStorage: false,
    // Interactive canvas resolution policy:
    // 'auto' caps DPR & pixel budget on integrated/mobile/software/slow GPUs;
    // 'high' renders full native resolution; 'medium'/'low' force reduced live resolution.
    // Exports, thumbnails, and explicit custom canvas sizes always render full-res.
    renderQuality: 'auto',
    // the size of the last image export, offered by the next one; 0 before
    // any export: the canvas size is offered then
    exportWidth: 0,
    exportHeight: 0,
    exportTileSize: 2048,
};

/**
 * @param {object} [options]
 * @param {string} [options.storageKey]  localStorage key (default 'symrenderer_config')
 * @param {string} [options.fallbackKey] read when nothing is kept under storageKey yet
 *                                       (the apps' shared config before each had its own)
 */
export function createSymRendererConfig(options = {}) {

    const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    const fallbackKey = options.fallbackKey ?? null;
    const onQualityChange = options.onQualityChange || null;

    // ── Load persisted values ─────────────────────────────────────────────────

    let mValues = { ...DEFAULTS };

    try {
        let raw = localStorage.getItem(storageKey);
        if (raw === null && fallbackKey && fallbackKey !== storageKey) raw = localStorage.getItem(fallbackKey);
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
        renderQuality: ParamChoice({
            obj:      mValues,
            key:      'renderQuality',
            name:     'render quality',
            choice:   QUALITY_MODES,
            tooltip:  'Interactive canvas resolution (exports always stay full-res): auto caps integrated/mobile/slow GPUs; high = native 4K/DPR; medium/low = faster panning',
            onChange: () => { save(); if (onQualityChange) onQualityChange(mValues.renderQuality); },
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
            name:     'Reset to default',
            func: () => {
                if (confirm("Are you sure you want to reset the application? This will clear all settings, local storage, and IndexedDB database handles.")) {
                    reset();
                }
            },
        }),
    };

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        /** ParamGroup — can be passed to createParamUI independently */
        params: mParams,

        /** the localStorage key of the values (the Global Options window keeps its place under it + '_ui') */
        storageKey,

        /** Live getter — always reflects the current saved value */
        get useBinaryStorage() { return mValues.useBinaryStorage; },

        get renderQuality() { return QUALITY_MODES.includes(mValues.renderQuality) ? mValues.renderQuality : 'auto'; },
        set renderQuality(val) {
            if (!QUALITY_MODES.includes(val)) return;
            mValues.renderQuality = val;
            save();
            if (onQualityChange) onQualityChange(val);
        },

        get exportWidth() { return mValues.exportWidth; },
        set exportWidth(val) { mValues.exportWidth = val; save(); },

        get exportHeight() { return mValues.exportHeight; },
        set exportHeight(val) { mValues.exportHeight = val; save(); },

        get exportTileSize() { return mValues.exportTileSize; },
        set exportTileSize(val) { mValues.exportTileSize = val; save(); },

        reset,
        Reset: reset,
    };

} // createSymRendererConfig
