import {
    ParamBool,
    ParamChoice,
    ParamFloat,
    ParamInt,
    MAX_COLORS_COUNT,
    SPLANE_PLANE,
    SPLANE_SPHERE,
    getGroupGeometry,
    getDomainBounds,
    evaluateSweepSplane,
} from './modules.js';

//
//  ColorTransition — shared animatable transition sub-object for color layers
//  (VisualizationColorSym and VisualizationColorTiles).
//
//  Provides two geometric transition families driven by one animated iSPlane:
//    - World Curtain Split ('curtain' within one layer, or 'clip' across two layers)
//    - Solution 1 Placement SPlane Mix ('domain' inside D_0, or 'shape' inside each
//      motif/sprite box), splitting points between the layer's primary placement
//      (outside) and placement2 (inside).
//
//  All parameters are scriptable via ScriptAPI (`...transition.mode`, `.progress`, etc.)
//  and stay inactive (zero shader overhead) when mode === 'none'.
//

const SPLANE_IDENTITY = 0;
const TORADIANS = Math.PI / 180;

const MODES_FULL  = ['none', 'curtain', 'domain', 'shape', 'clip'];
const MODES_TILES = ['none', 'curtain', 'domain', 'clip'];
const SPLANES     = ['line', 'circle', 'geodesic'];

const ZERO_SPLANE = new Float32Array([0, 0, 0, 0]);
const DEFAULT_LINE_COLOR = new Float32Array([0.98 * 0.85, 0.84 * 0.85, 0.48 * 0.85, 0.85]);

const INACTIVE_UNIFORMS = {
    uClipEnabled:    false,
    uClipSpace:      0,
    uClipSplaneType: SPLANE_IDENTITY,
    uClipSplaneData: ZERO_SPLANE,
    uClipBlur:       0,
    uClipInvert:     false,
    uMixEnabled:     false,
    uMixPlacement2:  0,
    uMixSpace:       0,
    uMixSplaneType:  SPLANE_IDENTITY,
    uMixSplaneData:  ZERO_SPLANE,
    uMixBlur:        0,
    uMixInvert:      false,
    uMixShowLine:    false,
    uMixLineColor:   DEFAULT_LINE_COLOR,
};

/**
 * Compute an exact Poincare-disk orthogonal geodesic iSPlane sweeping across
 * the disk `|z - c| = R` as `t` goes from 0 to 1 along normal angle `angleRad`.
 */
function hyperbolicGeodesicSplane(t, geom, angleRad) {
    const tc = Math.max(0, Math.min(1, t));
    if (tc <= 0.0005) return { type: SPLANE_IDENTITY, data: [0, 0, 0, 0] };
    if (tc >= 0.9995) return { type: SPLANE_PLANE, data: [1, 0, 0, 1e4] };
    const c = geom.c;
    const R = geom.r;
    const a = (tc * 2 - 1) * 0.992;
    const nx = Math.cos(angleRad);
    const ny = Math.sin(angleRad);
    if (Math.abs(a) < 1e-3) {
        return { type: SPLANE_PLANE, data: [nx, ny, 0, nx * c[0] + ny * c[1]] };
    }
    const sc = ((1 + a * a) / (2 * a)) * R;
    const sr = ((1 - a * a) / (2 * Math.abs(a))) * R * (a < 0 ? 1 : -1);
    return {
        type: SPLANE_SPHERE,
        data: [c[0] + sc * nx, c[1] + sc * ny, 0, sr],
    };
}

/**
 * @param {object} [options]
 * @param {boolean} [options.allowShape=true]  include 'shape' mode (Color Images / Sprites)
 * @param {() => void} [options.onChange]
 */
export function ColorTransition(options = {}) {
    const allowShape = options.allowShape !== false;
    const modeChoices = allowShape ? MODES_FULL : MODES_TILES;
    let mOnChange = options.onChange || null;

    const mConfig = {
        mode:       'none',
        placement2: 1,
        splane:     'line',
        progress:   0.5,
        angle:      0,
        blur:       0,
        invert:     false,
        showLine:   false,
    };

    let mParams = null;
    // Cached per-group geometry & fundamental domain bounds
    let mGroupCache = { group: null, geom: null, bounds: null };
    const mSplaneVec = new Float32Array(4);

    function notify(p) {
        if (mOnChange) mOnChange(p);
    }

    function getParams() {
        if (!mParams) {
            mParams = {
                mode:       ParamChoice({ obj: mConfig, key: 'mode',       name: 'mode',        choice: modeChoices, onChange: notify,
                                          tooltip: 'curtain: split placement 1/2 in world; domain/shape: Solution 1 splane mix; clip: 2-layer curtain split' }),
                placement2: ParamInt({    obj: mConfig, key: 'placement2', name: 'placement 2', min: 0, max: MAX_COLORS_COUNT - 1, step: 1, onChange: notify,
                                          tooltip: 'target placement mixed inside the splane (for curtain, domain, and shape modes)' }),
                splane:     ParamChoice({ obj: mConfig, key: 'splane',     name: 'splane',      choice: SPLANES, onChange: notify,
                                          tooltip: 'line (plane), expanding circle (sphere), or Poincare hyperbolic geodesic' }),
                progress:   ParamFloat({  obj: mConfig, key: 'progress',   name: 'progress',    min: 0, max: 1, step: 0.001, onChange: notify,
                                          tooltip: 'normalized sweep position (0 = 100% placement 1, 1 = 100% placement 2)' }),
                angle:      ParamFloat({  obj: mConfig, key: 'angle',      name: 'angle°',      min: -180, max: 180, step: 1, onChange: notify }),
                blur:       ParamFloat({  obj: mConfig, key: 'blur',       name: 'softness',    min: 0, max: 0.5, step: 0.002, onChange: notify }),
                invert:     ParamBool({   obj: mConfig, key: 'invert',     name: 'invert',      onChange: notify,
                                          tooltip: 'swap inside and outside (use opposite invert on two layers for 2-layer curtain split)' }),
                showLine:   ParamBool({   obj: mConfig, key: 'showLine',   name: 'divider',     onChange: notify,
                                          tooltip: 'draw a subtle hairline along the splane boundary' }),
            };
        }
        return mParams;
    }

    function setOnChange(fn) {
        mOnChange = fn;
    }

    function setMaxPlacement(maxVal) {
        const m = Math.max(0, Math.min(MAX_COLORS_COUNT - 1, maxVal | 0));
        if (mParams && mParams.placement2) {
            mParams.placement2.setMax(m);
        }
        if (mConfig.placement2 > m) {
            mConfig.placement2 = m;
        }
    }

    function ensureGroupCache(group) {
        if (mGroupCache.group === group && mGroupCache.bounds) return mGroupCache;
        const geom = group ? getGroupGeometry(group) : { kind: 'euclidean' };
        const bounds = group ? getDomainBounds(group) : { box: [-0.5, -0.5, 0.5, 0.5], incenter: [0, 0], radius: 0.75, inradius: 0.25 };
        mGroupCache = { group, geom, bounds };
        return mGroupCache;
    }

    /**
     * Compute the shader uniforms for placementTransition.glsl.mjs.
     *
     * @param {object} par            render() argument ({ group, navigatorUni })
     * @param {object} [opts]
     * @param {number} [opts.shapeHalf=0.5]  half-width of shape-local coords (0.5 for colorImageArray, 1.0 for colorImageSprites)
     * @param {number} [opts.permSize=0]     active permutation size for clamping placement2
     */
    function getUniforms(par, opts = {}) {
        const mode = mConfig.mode;
        if (!mode || mode === 'none') {
            return INACTIVE_UNIFORMS;
        }

        const t = Math.max(0, Math.min(1, mConfig.progress));
        const angleRad = mConfig.angle * TORADIANS;
        const splaneKind = mConfig.splane;
        const permSize = opts.permSize || 0;
        const p2 = permSize > 0 ? ((mConfig.placement2 % permSize) + permSize) % permSize : (mConfig.placement2 | 0);
        const { geom, bounds } = ensureGroupCache(par?.group || null);

        // Compute world screen viewport bounds from navigatorUni (u_center, u_scale, u_aspect)
        const nav = par?.navigatorUni || {};
        const cx = Array.isArray(nav.u_center) ? nav.u_center[0] : 0;
        const cy = Array.isArray(nav.u_center) ? nav.u_center[1] : 0;
        const scX = typeof nav.u_scale === 'number' && nav.u_scale > 0 ? nav.u_scale : 1.5;
        const aspect = typeof nav.u_aspect === 'number' && nav.u_aspect > 0 ? nav.u_aspect : 1.0;
        const scY = scX * aspect;
        const worldBounds = {
            box: [cx - scX, cy - scY, cx + scX, cy + scY],
            incenter: [cx, cy],
            radius: Math.hypot(scX, scY),
        };

        let sp;
        let space = 0; // 0=screen-world vUv, 1=projected pp, 2=domain FD, 3=shape-local
        let blurScaled = mConfig.blur;

        if (mode === 'clip' || mode === 'curtain') {
            if (splaneKind === 'geodesic' && geom.kind === 'hyperbolic') {
                sp = hyperbolicGeodesicSplane(t, geom, angleRad);
                space = 1;
                blurScaled = mConfig.blur * geom.r;
            } else {
                sp = evaluateSweepSplane(t, {
                    splaneKind: splaneKind === 'circle' ? 'circle' : 'line',
                    angleRad,
                    bounds: worldBounds,
                    margin: Math.max(scX, scY) * 0.03,
                });
                space = 0;
                blurScaled = mConfig.blur * Math.max(scX, scY);
            }
        } else if (mode === 'domain') {
            sp = evaluateSweepSplane(t, {
                splaneKind: splaneKind === 'circle' ? 'circle' : 'line',
                angleRad,
                bounds,
                margin: Math.max(0.005, bounds.inradius * 0.08),
            });
            space = 2;
            blurScaled = mConfig.blur * Math.max(bounds.radius, 0.1);
        } else {
            // 'shape' — normalized motif / sprite box [-shapeHalf, shapeHalf]^2
            const h = opts.shapeHalf ?? 0.5;
            sp = evaluateSweepSplane(t, {
                splaneKind: splaneKind === 'circle' ? 'circle' : 'line',
                angleRad,
                bounds: { box: [-h, -h, h, h], incenter: [0, 0], radius: h * 1.42 },
                margin: h * 0.05,
            });
            space = 3;
            blurScaled = mConfig.blur * h;
        }

        mSplaneVec[0] = sp.data[0];
        mSplaneVec[1] = sp.data[1];
        mSplaneVec[2] = sp.data[2];
        mSplaneVec[3] = sp.data[3];

        if (mode === 'clip') {
            return {
                uClipEnabled:    true,
                uClipSpace:      space,
                uClipSplaneType: sp.type,
                uClipSplaneData: mSplaneVec,
                uClipBlur:       blurScaled,
                uClipInvert:     !!mConfig.invert,
                uMixEnabled:     false,
                uMixPlacement2:  p2,
                uMixSpace:       0,
                uMixSplaneType:  SPLANE_IDENTITY,
                uMixSplaneData:  ZERO_SPLANE,
                uMixBlur:        0,
                uMixInvert:      false,
                uMixShowLine:    !!mConfig.showLine,
                uMixLineColor:   DEFAULT_LINE_COLOR,
            };
        }

        return {
            uClipEnabled:    false,
            uClipSpace:      0,
            uClipSplaneType: SPLANE_IDENTITY,
            uClipSplaneData: ZERO_SPLANE,
            uClipBlur:       0,
            uClipInvert:     false,
            uMixEnabled:     true,
            uMixPlacement2:  p2,
            uMixSpace:       space,
            uMixSplaneType:  sp.type,
            uMixSplaneData:  mSplaneVec,
            uMixBlur:        blurScaled,
            uMixInvert:      !!mConfig.invert,
            uMixShowLine:    !!mConfig.showLine,
            uMixLineColor:   DEFAULT_LINE_COLOR,
        };
    }

    return {
        getParams,
        setOnChange,
        setMaxPlacement,
        getUniforms,
        getPlacement2: () => mConfig.placement2,
        getMode:       () => mConfig.mode,
    };
}
