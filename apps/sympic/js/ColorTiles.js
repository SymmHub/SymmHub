import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamChoice,
    ParamString,
    ParamGroup,
    ParamImage,
    ParamFunc,
    MAX_COLORS_COUNT,
} from './modules.js';

import { adjustColorRGB, adjustColorRGB_OKLCH } from './color_uitils.js';


const MYNAME = 'ColorTiles';

const DEBUG = false;

const TWO_PI = 2.0 * Math.PI;

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
//  Call getPremultColors() each frame to obtain the current premultiplied Float32Array for
//  uploading to the GPU as uniform vec4 uCellColors[MAX_COLORS_COUNT].
//
function ColorTiles(options = {}) {

    let mOnChange = options.onChange || null;

    let mConfig = {
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
        // HSL adjustments (neutral defaults = no effect)
        adjHueShift:     0,
        adjSatMult:      1.0,
        adjLightOffset:  0,
        adjContrastMult: 1.0,
    };

    // Getters for parameters that can be optionally moved to the host layer
    const getAlpha = options.getAlpha || (() => mConfig.alpha);
    const getColorMask = options.getColorMask || (() => mConfig.colorMask);
    const getPermIndexVal = options.getPermIndex || (() => mConfig.permIndex);


    // Pre-allocated buffers, zeroed on init.
    // mColors        — straight (non-premultiplied) RGBA, layout [r, g, b, a] per slot.
    // mPremultColors — premultiplied RGBA, safe to upload directly as uCellColors.
    const mColors        = new Float32Array(MAX_COLORS_COUNT * 4);
    const mPremultColors = new Float32Array(MAX_COLORS_COUNT * 4);

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
        const mask = getColorMask() || '';
        const maskFactors = Array.from({ length: n }, (_, i) =>
            i < mask.length ? (mask[i] === '0' ? 0 : 1) : 1
        );

        const alphaVal = getAlpha();
        const adj = {
            hueShift:     mConfig.adjHueShift,
            satMult:      mConfig.adjSatMult,
            lightOffset:  mConfig.adjLightOffset,
            contrastMult: mConfig.adjContrastMult,
        };
        for (let i = 0; i < n; i++) {
            const t     = i / n;
            const idx   = i * 4;
            const alpha = alphaVal * maskFactors[i];

            // Cosine palette: compute raw RGB, then apply HSL adjustments
            let r  = _clamp(a[0] + b[0] * Math.cos(TWO_PI * (c[0] * t + d[0])));
            let g  = _clamp(a[1] + b[1] * Math.cos(TWO_PI * (c[1] * t + d[1])));
            let bv = _clamp(a[2] + b[2] * Math.cos(TWO_PI * (c[2] * t + d[2])));
            //const rgb = adjustColorRGB(r, g, bv, adj);
            const rgb = adjustColorRGB_OKLCH(r, g, bv, adj);

            mColors[idx + 0] = rgb.r;
            mColors[idx + 1] = rgb.g;
            mColors[idx + 2] = rgb.b;
            mColors[idx + 3] = alpha;

            mPremultColors[idx + 0] = rgb.r * alpha;
            mPremultColors[idx + 1] = rgb.g * alpha;
            mPremultColors[idx + 2] = rgb.b * alpha;
            mPremultColors[idx + 3] = alpha;
        }

        // Zero out unused slots so the GPU always receives a valid array.
        for (let i = n; i < MAX_COLORS_COUNT; i++) {
            mColors[i * 4 + 0] = 0;
            mColors[i * 4 + 1] = 0;
            mColors[i * 4 + 2] = 0;
            mColors[i * 4 + 3] = 0;
            mPremultColors[i * 4 + 0] = 0;
            mPremultColors[i * 4 + 1] = 0;
            mPremultColors[i * 4 + 2] = 0;
            mPremultColors[i * 4 + 3] = 0;
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


    function generateColorStripCanvas() {
        const { count: n } = mConfig;
        const canvas = document.createElement('canvas');
        const W = canvas.width = 128;
        const H = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        // Read straight (non-premultiplied) RGBA directly from mColors.
        for (let i = 0; i < n; i++) {
            const idx   = i * 4;
            const r     = mColors[idx + 0];
            const g     = mColors[idx + 1];
            const b     = mColors[idx + 2];
            const alpha = mColors[idx + 3];

            const x0 = Math.round(i * W / n);
            const x1 = Math.round((i + 1) * W / n);

            ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
            ctx.fillRect(x0, 0, x1 - x0, H);
        }
        return canvas;
    }


    function _updateColorStrip() {
        if (!mParams || !mParams.colormap) return;
        const canvas = generateColorStripCanvas();
        mParams.colormap.setDisplayImage(canvas.toDataURL(), '');
    }

    function _onChange() {
        _updateColors();
        _updateColorStrip();
        if (mOnChange) mOnChange();
    }

    function _randomize() {
        const r3 = (lo, hi) => Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;
        const frac = (v) => ((v % 1) + 1) % 1; // positive modulo 1

        // b: amplitude → controls contrast. Allow some per-channel variation for tint.
        const bBase = r3(0.35, 0.5);
        mConfig.bR = Math.min(0.5, bBase + r3(-0.08, 0.08));
        mConfig.bG = Math.min(0.5, bBase + r3(-0.08, 0.08));
        mConfig.bB = Math.min(0.5, bBase + r3(-0.08, 0.08));

        // a: DC offset. Per-channel variation introduces warm/cool cast.
        const aBase = r3(0.3, 0.5);
        mConfig.aR = Math.min(1, aBase + r3(-0.1, 0.1));
        mConfig.aG = Math.min(1, aBase + r3(-0.1, 0.1));
        mConfig.aB = Math.min(1, aBase + r3(-0.1, 0.1));

        // c: not randomized — left at current value.

        // d: phase spread between channels controls saturation:
        //   spread ≈ 0      → near-monochrome (highContrast style)
        //   spread ≈ 0.1    → warm/tinted (sunset style)
        //   spread ≈ 0.33   → full rainbow saturation (pastel style)
        // Full range [0, 0.45] gives equal chance of each style.
        const base   = Math.random();
        const spread = r3(0, 0.45);
        const sign   = Math.random() < 0.5 ? 1 : -1;

        mConfig.dR = Math.round(frac(base)                    * 1000) / 1000;
        mConfig.dG = Math.round(frac(base + sign * spread)     * 1000) / 1000;
        mConfig.dB = Math.round(frac(base + sign * spread * 2) * 1000) / 1000;

        // Refresh UI sliders (skip c — it was not changed).
        if (mParams) {
            ['a', 'b', 'd'].forEach(k => mParams[k]?.updateDisplay());
        }

        _onChange();
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
            ['a', 'b', 'c', 'd'].forEach(k => mParams[k]?.updateDisplay());
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
            count:     ParamInt   ({obj: cf, key: 'count',     min: 1, max: MAX_COLORS_COUNT, step: 1, onChange: oc}),
            colormap:  ParamImage ({width: 128, height: 64, stretch: true, serializable: false}),
            palette:   ParamChoice({obj: cf, key: 'palette',   choice: PALETTE_NAMES, onChange: _onPaletteChanged}),

            a: ParamGroup({
                name: 'a',
                params: {
                    R: ParamFloat({obj: cf, key: 'aR', min: 0, max: 1, step: 0.001, name: 'R', onChange: oc}),
                    G: ParamFloat({obj: cf, key: 'aG', min: 0, max: 1, step: 0.001, name: 'G', onChange: oc}),
                    B: ParamFloat({obj: cf, key: 'aB', min: 0, max: 1, step: 0.001, name: 'B', onChange: oc}),
                }
            }),
            b: ParamGroup({
                name: 'b',
                params: {
                    R: ParamFloat({obj: cf, key: 'bR', min: 0, max: 1, step: 0.001, name: 'R', onChange: oc}),
                    G: ParamFloat({obj: cf, key: 'bG', min: 0, max: 1, step: 0.001, name: 'G', onChange: oc}),
                    B: ParamFloat({obj: cf, key: 'bB', min: 0, max: 1, step: 0.001, name: 'B', onChange: oc}),
                }
            }),
            c: ParamGroup({
                name: 'c',
                params: {
                    R: ParamFloat({obj: cf, key: 'cR', step: 0.001, name: 'R', onChange: oc}),
                    G: ParamFloat({obj: cf, key: 'cG', step: 0.001, name: 'G', onChange: oc}),
                    B: ParamFloat({obj: cf, key: 'cB', step: 0.001, name: 'B', onChange: oc}),
                }
            }),
            d: ParamGroup({
                name: 'd',
                params: {
                    R: ParamFloat({obj: cf, key: 'dR', min: 0, max: 1, step: 0.001, name: 'R', onChange: oc}),
                    G: ParamFloat({obj: cf, key: 'dG', min: 0, max: 1, step: 0.001, name: 'G', onChange: oc}),
                    B: ParamFloat({obj: cf, key: 'dB', min: 0, max: 1, step: 0.001, name: 'B', onChange: oc}),
                }
            }),

            randomize: ParamFunc({ name: 'Randomize', func: _randomize }),

            adjust: ParamGroup({
                name: 'adjust',
                params: {
                    hueShift:     ParamFloat({obj: cf, key: 'adjHueShift',     name: 'hueShift',     min: -1, max: 1, step: 0.005, onChange: oc}),
                    satMult:      ParamFloat({obj: cf, key: 'adjSatMult',      name: 'satMult',      min: 0,    max: 4,   step: 0.01, onChange: oc}),
                    lightOffset:  ParamFloat({obj: cf, key: 'adjLightOffset',  name: 'lightOffset',  min: -1,   max: 1,   step: 0.01, onChange: oc}),
                    contrastMult: ParamFloat({obj: cf, key: 'adjContrastMult', name: 'contrastMult', min: 0,    max: 4,   step: 0.01, onChange: oc}),
                }
            }),
        };
    }

    function getParams() {
        if (!mParams) {
            mParams = makeParams();
            _updateColorStrip();
        }
        return mParams;
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    function setOnChange(fn) { mOnChange = fn; }

    /** Float32Array(MAX_COLORS_COUNT * 4) — premultiplied RGBA, upload as uCellColors each frame. */
    function getPremultColors() { return mPremultColors; }

    /** Float32Array(MAX_COLORS_COUNT * 4) — straight (non-premultiplied) RGBA. */
    function getColors() { return mColors; }

    /** Number of active color slots (== mConfig.count). */
    function getCount() { return mConfig.count; }

    /** Index into the permutation used to look up the active cell color. */
    function getPermIndex() { return getPermIndexVal(); }

    return {
        getParams,
        getColors,
        getPremultColors,
        getCount,
        getPermIndex,
        setOnChange,
        update:          _onChange,
        getClassName:    () => MYNAME,
        get enabled() { return true; },
    };


} // ColorTiles

export { ColorTiles };
