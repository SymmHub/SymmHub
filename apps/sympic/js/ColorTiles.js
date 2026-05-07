import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamChoice,
    ParamString,
} from './modules.js';




const DEBUG = true;

const TWO_PI = 2.0 * Math.PI;
const MAX_COLORS_COUNT = 24;

const PALETTES = {
    pastel: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.0, 0.33, 0.67],
    },
    sunset: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.3, 0.2, 0.2],
    },
    highContrast: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.0, 0.1, 0.2],
    },
};

const PALETTE_NAMES = Object.keys(PALETTES);

//
//  ColorTiles — generates a flat Float32Array of RGBA colors using the
//  cosine palette formula:  color = a + b * cos(2π * (c*t + d))
//
//  Compatible with the ParamObj API: exposes getParams().
//  Call getColors() each frame to obtain the current Float32Array for
//  uploading to the GPU as uniform vec4 uCellColors[MAX_COLORS_COUNT].
//
function ColorTiles(options = {}) {

    let mOnChange = options.onChange || null;

    let mConfig = {
        enabled:   false,
        count:     6,
        palette:   PALETTE_NAMES[0],
        permIndex: 0,
        alpha:     1.0,
        colorMask: '',
        // cosine palette channels (editable independently)
        aR: 0.5, aG: 0.5, aB: 0.5,
        bR: 0.5, bG: 0.5, bB: 0.5,
        cR: 1.0, cG: 1.0, cB: 1.0,
        dR: 0.0, dG: 0.33, dB: 0.67,
    };


    // Pre-allocated buffer, zeroed on init.
    const mColors = new Float32Array(MAX_COLORS_COUNT * 4);

    _updateColors();

    // ------------------------------------------------------------------ //
    //  Internal helpers
    // ------------------------------------------------------------------ //

    function _clamp(v) { return Math.max(0, Math.min(1, v)); }

    function _updateColors() {
        const { count: n } = mConfig;
        const a = [mConfig.aR, mConfig.aG, mConfig.aB];
        const b = [mConfig.bR, mConfig.bG, mConfig.bB];
        const c = [mConfig.cR, mConfig.cG, mConfig.cB];
        const d = [mConfig.dR, mConfig.dG, mConfig.dB];

        // Parse colorMask: string of '0'/'1' chars, one per color slot.
        // Missing positions default to 1 (fully visible).
        const mask = mConfig.colorMask || '';
        const maskFactors = Array.from({ length: n }, (_, i) =>
            i < mask.length ? (mask[i] === '0' ? 0 : 1) : 1
        );

        for (let i = 0; i < n; i++) {
            const t     = i / n;
            const idx   = i * 4;
            const alpha = mConfig.alpha * maskFactors[i];
            mColors[idx + 0] = _clamp(a[0] + b[0] * Math.cos(TWO_PI * (c[0] * t + d[0]))) * alpha;
            mColors[idx + 1] = _clamp(a[1] + b[1] * Math.cos(TWO_PI * (c[1] * t + d[1]))) * alpha;
            mColors[idx + 2] = _clamp(a[2] + b[2] * Math.cos(TWO_PI * (c[2] * t + d[2]))) * alpha;
            mColors[idx + 3] = alpha;
        }

        // Zero out unused slots so the GPU always receives a valid array.
        for (let i = n; i < MAX_COLORS_COUNT; i++) {
            mColors[i * 4 + 0] = 0;
            mColors[i * 4 + 1] = 0;
            mColors[i * 4 + 2] = 0;
            mColors[i * 4 + 3] = 0;
        }

        if(DEBUG) {
            // Debug: log each generated color as [r, g, b] rounded to 3 dp.
            const entries = Array.from({ length: n }, (_, i) => {
                const base = i * 4;
                return `[${mColors[base].toFixed(3)}, ${mColors[base+1].toFixed(3)}, ${mColors[base+2].toFixed(3)}]`;
            });
            console.log(`ColorTiles._updateColors() count=${n}:\n  ${entries.join('\n  ')}`);
        }
    }


    function _onChange() {
        _updateColors();
        if (mOnChange) mOnChange();
    }

    function _onPaletteChanged() {
        const p = PALETTES[mConfig.palette];
        if (!p) return;
        mConfig.aR = p.a[0]; mConfig.aG = p.a[1]; mConfig.aB = p.a[2];
        mConfig.bR = p.b[0]; mConfig.bG = p.b[1]; mConfig.bB = p.b[2];
        mConfig.cR = p.c[0]; mConfig.cG = p.c[1]; mConfig.cB = p.c[2];
        mConfig.dR = p.d[0]; mConfig.dG = p.d[1]; mConfig.dB = p.d[2];

        // Refresh UI widgets for all channel params so sliders show new values.
        if (mParams) {
            ['aR','aG','aB','bR','bG','bB','cR','cG','cB','dR','dG','dB']
                .forEach(k => mParams[k]?.updateDisplay());
        }

        _onChange();
    }


    // ------------------------------------------------------------------ //
    //  Params
    // ------------------------------------------------------------------ //

    let mParams = null;

    function makeParams() {
        const oc = _onChange;
        const cf = mConfig;
        return {
            enabled:   ParamBool  ({obj: cf, key: 'enabled',   onChange: oc}),
            count:     ParamInt   ({obj: cf, key: 'count',     min: 1, max: MAX_COLORS_COUNT, step: 1, onChange: oc}),
            palette:   ParamChoice({obj: cf, key: 'palette',   choice: PALETTE_NAMES, onChange: _onPaletteChanged}),
            permIndex: ParamInt   ({obj: cf, key: 'permIndex', min: 0, max: MAX_COLORS_COUNT - 1, step: 1, onChange: oc}),
            alpha:     ParamFloat ({obj: cf, key: 'alpha',     min: 0, max: 1, step: 0.001, onChange: oc}),
            colorMask: ParamString ({obj: cf, key: 'colorMask', onChange: oc}),

            aR: ParamFloat({obj: cf, key: 'aR', min: 0, max: 1, step: 0.001, name: 'a.R', onChange: oc}),
            aG: ParamFloat({obj: cf, key: 'aG', min: 0, max: 1, step: 0.001, name: 'a.G', onChange: oc}),
            aB: ParamFloat({obj: cf, key: 'aB', min: 0, max: 1, step: 0.001, name: 'a.B', onChange: oc}),
            bR: ParamFloat({obj: cf, key: 'bR', min: 0, max: 1, step: 0.001, name: 'b.R', onChange: oc}),
            bG: ParamFloat({obj: cf, key: 'bG', min: 0, max: 1, step: 0.001, name: 'b.G', onChange: oc}),
            bB: ParamFloat({obj: cf, key: 'bB', min: 0, max: 1, step: 0.001, name: 'b.B', onChange: oc}),
            cR: ParamFloat({obj: cf, key: 'cR', step: 0.001, name: 'c.R', onChange: oc}),
            cG: ParamFloat({obj: cf, key: 'cG', step: 0.001, name: 'c.G', onChange: oc}),
            cB: ParamFloat({obj: cf, key: 'cB', step: 0.001, name: 'c.B', onChange: oc}),
            dR: ParamFloat({obj: cf, key: 'dR', min: 0, max: 1, step: 0.001, name: 'd.R', onChange: oc}),
            dG: ParamFloat({obj: cf, key: 'dG', min: 0, max: 1, step: 0.001, name: 'd.G', onChange: oc}),
            dB: ParamFloat({obj: cf, key: 'dB', min: 0, max: 1, step: 0.001, name: 'd.B', onChange: oc}),
        };
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    function setOnChange(fn) { mOnChange = fn; }

    /** Float32Array(MAX_COLORS_COUNT * 4) — upload as uCellColors each frame. */
    function getColors() { return mColors; }

    /** Number of active color slots (== mConfig.count). */
    function getCount() { return mConfig.count; }

    /** Index into the permutation used to look up the active cell color. */
    function getPermIndex() { return mConfig.permIndex; }

    return {
        getParams,
        getColors,
        getCount,
        getPermIndex,
        setOnChange,
        get enabled() { return mConfig.enabled; },
    };

} // ColorTiles

export { ColorTiles };
