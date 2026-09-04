/*
  VisualizationOverlayUpgradeData.js

  Upgrade of the legacy overlay document format to the overlay item list.

  The legacy VisualizationOverlay serialized one fixed tree of features
  (the keys of LEGACY_ORDER, in the serialized form of makeOverlayParams()):

    { id, enabled, opacity,
      fundDomain: { fill: {...}, outline: {...} }, buffer: {...}, isolines: {...},
      tiling: { fill: {...}, outline: {...} }, limitset: {...}, generators: {...},
      worldGrid: {...}, screenGrid: {...}, ruler: {...} }

  The current format keeps an editable list of overlay items:

    { id, enabled, opacity,
      overlays: { className: 'ObjArray', params: { id: 'overlays', children: [
         { className: 'OverlayTiling', params: { id: 'tiling', enabled, opacity, width, color } },
         ... ] } } }

  This module is pure data mapping (no DOM, no GL, no other imports) so that
  it runs in node tests unchanged.
*/

// legacy features in the drawing order of the old single pass shader, bottom to top
export const LEGACY_ORDER = [
    'isolines', 'tiling', 'limitset', 'fundDomain', 'generators',
    'buffer', 'worldGrid', 'screenGrid', 'ruler',
];

// class of the overlay item which replaces each legacy feature
export const LEGACY_CLASS = {
    isolines:   'OverlayIsolines',
    tiling:     'OverlayTiling',
    limitset:   'OverlayLimitset',
    fundDomain: 'OverlayFundDomain',
    generators: 'OverlayGenerators',
    buffer:     'OverlayBuffer',
    worldGrid:  'OverlayWorldGrid',
    screenGrid: 'OverlayScreenGrid',
    ruler:      'OverlayRuler',
};

// defaults of the legacy features (serialized form of the old makeOverlayConfig())
export const LEGACY_DEFAULTS = {
    isolines: {
        enabled: false, type: 'u', step: 0.1, offset: 0, width: 1, levels: 1, color: '#000000ff',
    },
    limitset: {
        enabled: false, color: '#000000ff', width: 1,
    },
    worldGrid: {
        enabled: false, type: 'cartesian', color: '#000000ff', width: 1, levels: 1,
        stepx: 0.1, stepy: 0.1, offsetx: 0, offsety: 0,
    },
    screenGrid: {
        enabled: false, stepAuto: true, color: '#000000ff', width: 1, step: 0.1,
    },
    ruler: {
        enabled: false, color: '#000000ff', background: '#AAAAAAAA', width: 20,
    },
    generators: {
        enabled: false, width: 2, color: '#0000AAAA',
        shadow: { enabled: true, width: 10, color: '#0000AA55' },
    },
    fundDomain: {
        fill:    { enabled: false, color: '#FF0000AA' },
        outline: { enabled: false, width: 1, color: '#000000AA', shadowsWidth: 10, shadowsColor: '#0000FFAA' },
    },
    buffer: {
        fill:    { enabled: false, color: '#00FF0022' },
        outline: { enabled: false, width: 1, color: '#00AA00AA' },
    },
    tiling: {
        // tiling.fill was serialized but never drawn: not listed, so it never counts
        outline: { enabled: false, width: 1, color: '#000000FF' },
    },
};

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function clone(v) {
    return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v));
}

// loose equality of two leaf values: colours case insensitive, numbers with tolerance
function sameValue(a, b) {
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
    return a === b;
}

/**
 * Is the legacy value of a feature still at its defaults?  Keys missing from
 * the value count as default, keys unknown to the defaults are ignored (the
 * dead tiling.fill among them).
 * @param {object} defaults
 * @param {object} value
 * @param {string[]} [ignore]  keys of defaults to skip
 */
function atDefaults(defaults, value, ignore = []) {
    if (!isPlainObject(value)) return true;
    for (const key of Object.keys(defaults)) {
        if (ignore.includes(key)) continue;
        if (!(key in value)) continue;
        const d = defaults[key], v = value[key];
        if (isPlainObject(d)) {
            if (!atDefaults(d, v)) return false;
        } else if (!sameValue(v, d)) {
            return false;
        }
    }
    return true;
}

/**
 * A legacy feature which is disabled and untouched gives no item.
 * @param {string} key    legacy feature key
 * @param {object} value  its legacy value
 */
export function isLegacyDefault(key, value) {
    const defaults = LEGACY_DEFAULTS[key];
    if (!defaults) return false;
    // the step of the screen grid is recomputed on every zoom when stepAuto is on
    const ignore = (key === 'screenGrid' && (value?.stepAuto ?? true)) ? ['step'] : [];
    return atDefaults(defaults, value, ignore);
}

/**
 * Map the legacy value of a feature onto the params of its item.  Works for
 * partial values (patches): only the keys present are mapped.
 *
 *  - fundDomain, buffer: fill and outline groups are kept; the item is enabled
 *    when either of them is;
 *  - tiling: the outline becomes the item (fill is dropped);
 *  - all others: the keys are the same.
 *
 * @param {string}  key      legacy feature key
 * @param {object}  value    legacy value, complete or partial
 * @param {boolean} partial  true for a patch: an absent enable leaves the item's enable alone
 * @returns {object} item params (without id)
 */
export function legacyToItemParams(key, value, partial = false) {
    if (!isPlainObject(value)) return {};
    switch (key) {
        case 'tiling': {
            const out = {};
            const o = value.outline;
            if (isPlainObject(o)) {
                if ('enabled' in o) out.enabled = o.enabled;
                if ('width'   in o) out.width   = o.width;
                if ('color'   in o) out.color   = o.color;
            }
            return out;
        }
        case 'fundDomain':
        case 'buffer': {
            const out = {};
            if (isPlainObject(value.fill))    out.fill    = clone(value.fill);
            if (isPlainObject(value.outline)) out.outline = clone(value.outline);
            const enables = [value.fill?.enabled, value.outline?.enabled].filter(v => v !== undefined);
            if (enables.some(Boolean)) out.enabled = true;
            else if (!partial)         out.enabled = false;
            if ('enabled' in value)    out.enabled = value.enabled;   // already in item form
            return out;
        }
        default:
            return clone(value);
    }
}

/**
 * Does the value carry legacy feature keys (and not the item list)?
 */
export function isLegacyOverlay(value) {
    if (!isPlainObject(value) || value.overlays !== undefined) return false;
    return LEGACY_ORDER.some(key => key in value);
}

/**
 * Convert a complete legacy overlay document into the item list format.
 * Features which are disabled at their defaults give no item; the others
 * become items with the legacy key as id, in the old drawing order.
 * @param {object} value  legacy overlay params
 * @returns {object} params in the item list format
 */
export function upgradeOverlayParams(value) {
    const out = {};
    for (const key of Object.keys(value)) {
        if (!(key in LEGACY_CLASS)) out[key] = value[key];
    }
    const children = [];
    for (const key of LEGACY_ORDER) {
        if (!(key in value)) continue;
        const legacy = value[key];
        if (isLegacyDefault(key, legacy)) continue;
        children.push({
            className: LEGACY_CLASS[key],
            params: { id: key, ...legacyToItemParams(key, legacy, false) },
        });
    }
    out.overlays = { className: 'ObjArray', params: { id: 'overlays', children } };
    return out;
}
