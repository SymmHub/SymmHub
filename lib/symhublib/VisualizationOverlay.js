/*
  VisualizationOverlay.js — the overlay layer: an editable list of overlay items.

  The layer keeps id, enabled and opacity and an ObjArray of overlay items
  (lib/symhublib/overlays/*), shown as a ParamObjArray: "+" menu with the
  kinds, ↑ ↓ ✕ per item, rename through the item's id field.  Every enabled
  item is rendered in list order as its own full screen pass; the layer's
  opacity multiplies the opacity of the items.

  A fresh overlay holds the group properties, in the drawing order of the old
  single pass shader (tiling below the domain), all disabled:
  tiling, fundDomain, generators.  Apps may pass their own list in
  config.overlays as [{className, id, params}] or item instances.

  Old documents (the fixed feature tree) are upgraded on load by
  VisualizationOverlayUpgradeData.js, and their feature keys stay addressable
  by partial patches: { tiling: { outline: { enabled: true } } } reaches the
  item with id 'tiling', made if it does not exist yet.
*/

import {
    ParamBool,
    ParamFloat,
    ParamString,
    ParamObjArray,
    ObjArray,
    setParamValues,
} from './modules.js';

import {
    OverlayItemFactory,
    createOverlayItem,
} from './overlays/OverlayItemFactory.js';

import {
    LEGACY_ORDER,
    LEGACY_CLASS,
    LEGACY_DEFAULTS,
    isLegacyOverlay,
    upgradeOverlayParams,
    legacyToItemParams,
} from './VisualizationOverlayUpgradeData.js';


const MYNAME = 'VisualizationOverlay';
const DEBUG = false;

//
//  items of a fresh overlay: the group properties, drawing order of the old shader, all disabled
//
export function makeDefaultOverlayItems() {
    return [
        { className: 'OverlayTiling',     id: 'tiling'     },
        { className: 'OverlayFundDomain', id: 'fundDomain' },
        { className: 'OverlayGenerators', id: 'generators' },
    ];
}

//
//  par.id      layer id
//  par.config  {enabled, opacity, overlays}
//
export function VisualizationOverlay(par = {}) {

    const { overlays: cfgOverlays, ...cfgRest } = par.config || {};
    const mConfig = { enabled: true, opacity: 1 };
    Object.assign(mConfig, cfgRest);
    // the items of a fresh overlay; also what an old document gets whose overlay was never touched
    const mDefaultSpecs = (cfgOverlays ?? makeDefaultOverlayItems()).map(spec => (spec && spec.getClassName)
        ? { className: spec.getClassName(), id: spec.getId() }
        : spec);

    const mIdRef = { id: par.id ?? '' };  // editable layer name/id
    let mOnIdChange = null;
    let mOnChange   = null;
    let mInitPar    = null;
    let mParams     = null;

    // the item list; the factory makes items for the "+" menu and for documents with more items
    const mFactory   = OverlayItemFactory(() => mInitPar, () => mItemArray.getChildren());
    const mItemArray = ObjArray({
        id:       'overlays',
        children: makeItems(cfgOverlays ?? makeDefaultOverlayItems()),
        factory:  mFactory,
    });
    const mHolder = { overlays: mItemArray };  // ParamObjArray needs obj[key] access

    function makeItems(specs) {
        return specs.map(spec => {
            if (spec && spec.getClassName) return spec;   // an item instance
            const item = createOverlayItem(spec.className, {
                id:     spec.id ?? '',
                config: { enabled: false, ...(spec.params ?? spec.config ?? {}) },
            });
            if (!item) console.warn(`${MYNAME}: unknown overlay item`, spec);
            return item;
        }).filter(Boolean);
    }

    function onChange(obj) {
        if (DEBUG) console.log(`${MYNAME}.onChange()`, obj);
        if (mOnChange) mOnChange(obj);
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const params = {
            id:       ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:  ParamBool({ obj: mConfig, key: 'enabled', onChange }),
            opacity:  ParamFloat({ obj: mConfig, key: 'opacity', min: 0, max: 1, step: 0.001, onChange }),
            overlays: ParamObjArray({
                obj:      mHolder,
                key:      'overlays',
                name:     'overlays',
                factory:  mFactory,
                onChange: onChange,
            }),
        };
        // The legacy feature keys stay addressable by partial patches (the catalog
        // driver's { tiling: { outline: { enabled: true } } }).  A route-only param
        // has setValue() but no getValue()/createUI()/init(), so it is invisible to
        // serialization, the UI and initialization.
        for (const key of LEGACY_ORDER) {
            params[key] = { setValue: (value) => patchLegacyFeature(key, value) };
        }
        return params;
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    function init(par) {
        if (DEBUG) console.log(`${MYNAME}.init()`, par);
        mInitPar  = par;
        mOnChange = par.onChange;
        for (const item of mItemArray.getChildren()) item.init(par);
    }

    function render(par) {
        const itemPar = { ...par, layerOpacity: mConfig.opacity };
        for (const item of mItemArray.getChildren()) {
            if (item.enabled) item.render(itemPar);
        }
    }

    /**
     * The renderer's group changed: items with their own group data react.
     */
    function onGroupChanged(group) {
        for (const item of mItemArray.getChildren()) {
            if (item.onGroupChanged) item.onGroupChanged(group);
        }
    }

    // ── serialization ─────────────────────────────────────────────────────────

    /**
     * Restore the layer.  A document load (initialize) with the legacy feature
     * tree rebuilds the item list from it; a patch with legacy keys is routed
     * to the items through the route-only params.
     * @param {object}  value       params of the layer, current or legacy format
     * @param {boolean} initialize  true for a document load
     */
    function setParamsMap(value, initialize = false) {
        let par = value;
        if (initialize && isLegacyOverlay(par)) {
            par = upgradeOverlayParams(par);
            // an overlay which was never touched gets the items of a fresh overlay
            if (par.overlays.params.children.length === 0) {
                par.overlays.params.children = mDefaultSpecs.map(spec => ({
                    className: spec.className,
                    params: { id: spec.id ?? '', enabled: false, ...(spec.params ?? spec.config ?? {}) },
                }));
            }
            if (DEBUG) console.log(`${MYNAME}.setParamsMap() upgraded legacy overlay:`, JSON.parse(JSON.stringify(par)));
        }
        setParamValues(getParams(), par, initialize);
    }

    /**
     * Apply a legacy feature patch to the item with the legacy key as id.  A
     * missing item is made at its place in the old drawing order, starting
     * from the legacy defaults.
     */
    function patchLegacyFeature(key, value) {
        const params  = getParams();
        const items   = mItemArray.getChildren();
        let idx = items.findIndex(it => it.getId() === key);
        if (idx < 0) {
            const order = LEGACY_ORDER.indexOf(key);
            let insertIdx = items.length;
            for (let i = 0; i < items.length; i++) {
                const o = LEGACY_ORDER.indexOf(items[i].getId());
                if (o > order) { insertIdx = i; break; }
            }
            const item = params.overlays.addChild(LEGACY_CLASS[key], insertIdx);
            if (!item) return;
            item.setId(key);
            setParamValues(item.getParams(), legacyToItemParams(key, LEGACY_DEFAULTS[key], false));
            params.overlays.renameAll();
        }
        params.overlays.setValue({ [key]: legacyToItemParams(key, value, true) });
    }

    // ── item accessors (for scripting) ────────────────────────────────────────

    function getItems() {
        return mItemArray.getChildren();
    }

    function getItem(id) {
        return mItemArray.getChildren().find(it => it.getId() === id);
    }

    /**
     * Add an item of a kind, at the end or at an index; returns the item.
     * @param {string} className  e.g. 'OverlayIsolines'
     * @param {number} [index]
     */
    function addItem(className, index) {
        return getParams().overlays.addChild(className, index);
    }

    /**
     * Remove an item by id or index.
     */
    function removeItem(idOrIndex) {
        const items = mItemArray.getChildren();
        const idx = (typeof idOrIndex === 'number') ? idOrIndex : items.findIndex(it => it.getId() === idOrIndex);
        if (idx < 0 || idx >= items.length) return false;
        getParams().overlays.removeChildAt(idx);
        return true;
    }

    // ── public API ────────────────────────────────────────────────────────────

    const myself = {
        getClassName:  () => MYNAME,
        getParams:     getParams,
        getId:         ()   => mIdRef.id,
        setId:         (id) => { mIdRef.id = id; },
        setOnIdChange: (fn) => { mOnIdChange = fn; },
        init:          init,
        render:        render,
        onGroupChanged: onGroupChanged,
        setParamsMap:  setParamsMap,
        getItems:      getItems,
        getItem:       getItem,
        addItem:       addItem,
        removeItem:    removeItem,
        get enabled() { return mConfig.enabled; },
    };

    return myself;
}
