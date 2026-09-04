/*
  OverlayItem.js — the boilerplate shared by the overlay item kinds.

  An overlay item has the interface of a visualization layer:

    getClassName(), getParams(), getId()/setId()/setOnIdChange()
    init(par)         par as the layers receive it: {glCtx, onChange, getGroupPresentation}
    render(par)       one full screen pass with the item's program; par.layerOpacity
                      (the opacity of the overlay layer holding the item) multiplies
                      the item's own opacity, absent at the top level
    enabled           getter

  so an item can live inside the overlay layer's list or as a top level layer.

  A kind is described by a spec:

    className    serialization key, e.g. 'OverlayIsolines'
    program      name of the program in SymRendererPrograms, null for an inert item
    defaults     the kind's own config defaults (plain object)
    makeParams   (cfg, onChange, ctx) => { key: Param, ... } the kind's own params,
                 placed after id, enabled and opacity
    getUniforms  (cfg, renderPar, ctx) => uniforms of the program
    init         optional (initPar, ctx) hook
    onGroupChanged optional (group, ctx) hook, makes the item react to group changes

  ctx gives the hooks access to the item: ctx.config, ctx.params, ctx.glCtx, ctx.initPar.
*/

import {
    ParamBool,
    ParamFloat,
    ParamString,
    SymRendererPrograms,
    enableBlending,
    setViewport,
} from '../modules.js';

const DEBUG = false;

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** deep copy of plain config data */
export function cloneConfig(v) {
    return JSON.parse(JSON.stringify(v));
}

/** assign src into dst, recursing into nested plain objects (fill, outline, shadow) */
export function mergeConfig(dst, src) {
    if (!isPlainObject(src)) return dst;
    for (const key of Object.keys(src)) {
        const s = src[key];
        if (isPlainObject(s) && isPlainObject(dst[key])) mergeConfig(dst[key], s);
        else dst[key] = (isPlainObject(s)) ? cloneConfig(s) : s;
    }
    return dst;
}

/**
 * @param {object} spec  the kind, see above
 * @param {object} par   {id, config}: config overrides {enabled, opacity, ...defaults}
 */
export function makeOverlayItem(spec, par = {}) {

    const MYNAME = spec.className;

    const mConfig = { enabled: true, opacity: 1, ...cloneConfig(spec.defaults || {}) };
    mergeConfig(mConfig, par.config);

    const mIdRef = { id: par.id ?? '' };
    let mOnIdChange = null;
    let mOnChange   = null;
    let mInitPar    = null;
    let mGLCtx      = null;
    let mPrograms   = null;
    let mParams     = null;

    function onChange(p) {
        if (DEBUG) console.log(`${MYNAME}.onChange()`, p);
        if (mOnChange) mOnChange(p);
    }

    // what the kind's hooks may reach
    const ctx = {
        get config()  { return mConfig; },
        get params()  { return mParams; },
        get glCtx()   { return mGLCtx; },
        get initPar() { return mInitPar; },
        onChange,
    };

    function getParams() {
        if (!mParams) {
            mParams = {
                id:      ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
                enabled: ParamBool({ obj: mConfig, key: 'enabled', onChange }),
                opacity: ParamFloat({ obj: mConfig, key: 'opacity', min: 0, max: 1, step: 0.001, onChange }),
                ...(spec.makeParams ? spec.makeParams(mConfig, onChange, ctx) : {}),
            };
        }
        return mParams;
    }

    function init(par) {
        if (DEBUG) console.log(`${MYNAME}.init()`, par);
        mInitPar  = par;
        mGLCtx    = par.glCtx;
        mOnChange = par.onChange;
        mPrograms = SymRendererPrograms();
        if (spec.init) spec.init(par, ctx);
    }

    function render(par) {
        if (!spec.program || !mGLCtx) return;
        const gl = mGLCtx.gl;
        const opacity = mConfig.opacity * (par.layerOpacity ?? 1);

        const uni = spec.getUniforms ? spec.getUniforms(mConfig, par, ctx) : {};
        uni.uTransparency = 1. - opacity;

        const prog = mPrograms.getProgram(spec.program);
        if (!prog) return;

        enableBlending(gl);
        prog.bind();
        prog.setUniforms(par.navigatorUni);
        prog.setUniforms(par.renderUni);
        prog.setUniforms(uni);
        setViewport(gl, par.canvas);
        prog.blit(par.renderTarget ?? null);
    }

    const item = {
        getClassName:  () => MYNAME,
        getParams:     getParams,
        getId:         ()   => mIdRef.id,
        setId:         (id) => { mIdRef.id = id; },
        setOnIdChange: (fn) => { mOnIdChange = fn; },
        init:          init,
        render:        render,
        getConfig:     () => mConfig,
        get enabled() { return mConfig.enabled; },
    };
    if (spec.onGroupChanged) item.onGroupChanged = (group) => spec.onGroupChanged(group, ctx);

    return item;
}
