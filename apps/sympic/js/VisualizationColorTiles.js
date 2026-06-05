import {    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamString,
    ParamObj,
    setViewport,
    enableBlending,
    Sympix_programs,
    Subgroups,
} from './modules.js';

import { ColorTiles } from './ColorTiles.js';


const DEBUG = true;
const MYNAME = 'VisualizationColorTiles';
const MAX_COLORS_COUNT = 24;


//
//  Color Tiles visualization layer.
//  Renders only the colored cells (colorTiles) of VisualizationColorSym.
//  Reuses the colorImageArray shader program with uUseCrown and image rendering disabled.
//
//  par.config - optional initial values 
//
function VisualizationColorTiles(par={}){
    
    let mConfig = {
        enabled: true,
        opacity: 1,
        permutations: '',
        leftCoset: false,
        permIndex: 0,
        mask:      '',
    };

    if(par.config){
        Object.assign(mConfig, par.config);
    }

    // ── id / name management ─────────────────────────────────────────────────
    const mIdRef = { id: par.id ?? '' };
    let mOnIdChange = null;

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    // Cache for the TEXTURE_2D_ARRAY
    let mArrayTexCache = { tex: null, count: 0, size: 0 };

    // Cell color generator (cosine palette → uCellColors uniform).
    const mColorTiles = ColorTiles({
        getAlpha:     () => 1.0,
        getColorMask: () => mConfig.mask,
        getPermIndex: () => mConfig.permIndex,
    });

    const mSubgroups = Subgroups({
        getParentPermutations: () => mConfig.permutations,
        onSubgroupSelected: (subgroup) => {
            if (subgroup) {
                const params = getParams();
                if (params && params.permutations) {
                    params.permutations.setValue(subgroup.invcos);
                } else {
                    mConfig.permutations = subgroup.invcos;
                    onPermChanged();
                }
                mColorTiles.getParams().count.setValue(subgroup.index);
                if (params && params.permIndex) {
                    params.permIndex.setMax(subgroup.index - 1);
                }
            }
        },
        onChange: () => onChange(null)
    });

    // Parsed permutation data ready to upload as uPermData / uPermSize.
    const MAX_GEN_COUNT = 6;
    let mPermData = new Uint32Array(MAX_GEN_COUNT * 4); // zeroed = all identity-like
    let mPermSize = 0;

    // Per-texture-layer alpha mask filled with 0.0 to disable image rendering.
    const MAX_TEX_COUNT = 24;
    let mTexAlpha = new Float32Array(MAX_TEX_COUNT).fill(0.0);


    function onChange(param){
      if(DEBUG) console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
    }

    //
    //  Pack a plain integer array (values 0-23) into a uvec4 using 5-bit packing:
    //  6 values per uint32 component (6 * 5 = 30 bits used, 2 spare).
    //
    function packPerm(perm) {
        const result = new Uint32Array(4);
        for (let i = 0; i < perm.length; i++) {
            const comp  = Math.floor(i / 6);
            const shift = (i % 6) * 5;
            result[comp] |= (perm[i] << shift);
        }
        return result;
    }

    //
    //  Parse mConfig.permutations into packed GPU data.
    //
    function onPermChanged() {
        const str   = mConfig.permutations;
        const words = str ? str.trim().split(/\s+/).filter(Boolean) : [];

        mPermData = new Uint32Array(MAX_GEN_COUNT * 4);
        mPermSize = 0;

        if (words.length === 0) {
            if(DEBUG) console.log(`${MYNAME}.onPermChanged(): empty — using identity`);
            onChange(null);
            return;
        }

        mPermSize = words[0].length;

        for (let k = 0; k < Math.min(words.length, MAX_GEN_COUNT); k++) {
            const word = words[k];
            const perm = Array.from(word).map(c => c.charCodeAt(0) - 97); // 'a'=0
            const packed = packPerm(perm);
            mPermData.set(packed, k * 4);
        }

        if(DEBUG) console.log(`${MYNAME}.onPermChanged(): ${words.length} perms, size=${mPermSize}`, mPermData);
        onChange(null);
    }

    function makeParams(cf) {
        let oc = onChange;
        let ocColors = () => {
            mColorTiles.update();
            onChange(null);
        };
        return {
            name: ParamString({ obj: mIdRef, key: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:       ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:       ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            leftCoset:     ParamBool({obj: cf, key: 'leftCoset', onChange: oc}),
            
            // Moved parameters
            permIndex:     ParamInt({obj: cf, key: 'permIndex', min: 0, max: MAX_COLORS_COUNT - 1, step: 1, onChange: ocColors}),
            mask:          ParamString({obj: cf, key: 'mask', onChange: ocColors}),

            subgroups:     ParamObj({name: 'subgroups', obj: mSubgroups}),

            colorTiles:    ParamObj({name: 'tile colors', obj: mColorTiles}),
        }
    }

    // Build (or reuse) a dummy TEXTURE_2D_ARRAY.
    function updateImageArrayTex(gl, doubleFBOs) {
        const count = doubleFBOs.length;
        const size  = doubleFBOs[0].width;

        if (!mArrayTexCache.tex || mArrayTexCache.count !== count || mArrayTexCache.size !== size) {
            if (mArrayTexCache.tex) gl.deleteTexture(mArrayTexCache.tex);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, size, size, count, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            mArrayTexCache = { tex, count, size };
        }

        gl.bindTexture(gl.TEXTURE_2D_ARRAY, mArrayTexCache.tex);
        for (let i = 0; i < count; i++) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, doubleFBOs[i].read.fbo);
            gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 0, 0, size, size);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        return mArrayTexCache.tex;
    }

    function render(par){
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;
        
        let dataBuffer   = par.dataBuffer; 
        let renderUni    = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas       = par.canvas;
        let renderTarget = null;

        // Use the default dataBuffer as a fallback since no image is rendered
        const buffers = [par.dataBuffer];
        const arrayTex = updateImageArrayTex(gl, buffers);

        const imageUni = {
            uImageArray:    arrayTex,
            uNumImages:     buffers.length,
            uTransparency:  (1. - cmCfg.opacity),
            uInterpolation: 0,
            uPermData:      mPermData,
            uPermSize:      mPermSize,
            uTexPermIndex:  0,
            uUseCrown:      false,       // Crown disabled
            uLeftCoset:     cmCfg.leftCoset,
            uTexAlpha:      mTexAlpha,   // Alpha = 0.0 to disable all image rendering

            // cell color uniforms from ColorTiles
            uFillCells:          mColorTiles.enabled,
            uCellColors:         mColorTiles.getColors(),
            uCellColorPermIndex: mColorTiles.getPermIndex(),
        };

        enableBlending(gl); 
        const progName = 'colorImageArray';
        let renderProg = mPrograms.getProgram(gl, progName);                     
        if(!renderProg) throw new Error(`${MYNAME}.render(): failed to get program ${progName}`);
        renderProg.bind();
        
        renderProg.setUniforms(navigatorUni);
        renderProg.setUniforms(renderUni);
        renderProg.setUniforms(imageUni);
        renderProg.setUniforms({uOpacity: cmCfg.opacity}); 
        setViewport(gl, canvas);
        renderProg.blit(renderTarget);                     
    }
    
    function init(par){
       if(DEBUG) console.log(`${MYNAME}.init()`, par);
        mGLCtx = par.glCtx;        
        mOnChange = par.onChange;        
        mPrograms = Sympix_programs;
        mColorTiles.setOnChange(() => {
            const count = mColorTiles.getCount();
            const params = getParams();
            if (params && params.permIndex) {
                params.permIndex.setMax(count - 1);
            }
            onChange(null);
        });
    }
    
    function getParams(){
        if(!mParams)
            mParams = makeParams(mConfig);
        return mParams;
    }
    
    return {
        getParams:    getParams,
        getClassName: (() => MYNAME),
        getId:        () => mIdRef.id,
        setId:        (id) => { mIdRef.id = id; },
        setOnIdChange:(fn) => { mOnIdChange = fn; },
        init:         init,
        render:       render,
        get enabled(){ return mConfig.enabled; },
    }

} // function VisualizationColorTiles


export {
   VisualizationColorTiles
}
