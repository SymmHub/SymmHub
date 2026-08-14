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
    packPerm,
    MAX_COLORS_COUNT,
} from './modules.js';

import { ColorTiles } from './ColorTiles.js';


const DEBUG = false;
const MYNAME = 'VisualizationColorTiles';


//
//  Color Tiles visualization layer.
//  Renders only colored symmetry cells using the simplified 'colorTiles' shader.
//  No image sampling; only uCellColors + permutations are used.
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
    let mPermData = new Uint32Array(MAX_GEN_COUNT * 4);
    let mPermSize = 0;


    function onChange(param){
      if(DEBUG) console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
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
            id: ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:       ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:       ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            leftCoset:     ParamBool({obj: cf, key: 'leftCoset', onChange: oc}),

            permIndex:     ParamInt({obj: cf, key: 'permIndex', name: 'offset', min: 0, max: MAX_COLORS_COUNT - 1, step: 1, onChange: ocColors}),
            mask:          ParamString({obj: cf, key: 'mask', onChange: ocColors}),

            subgroups:     ParamObj({name: 'subgroups', obj: mSubgroups}),

            colorTiles:    ParamObj({name: 'colors', obj: mColorTiles}),
        }
    }

    function render(par){
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;
        
        let renderUni    = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas       = par.canvas;
        let renderTarget = null;

        const uni = {
            uTransparency:       1. - cmCfg.opacity,
            uPermData:           mPermData,
            uPermSize:           mPermSize,
            uLeftCoset:          cmCfg.leftCoset,

            uFillCells:          mColorTiles.enabled,
            uCellColors:         mColorTiles.getPremultColors(),
            uCellColorPermIndex: mColorTiles.getPermIndex(),
        };

        enableBlending(gl); 
        const progName = 'colorTiles';
        let renderProg = mPrograms.getProgram(gl, progName);                     
        if(!renderProg) throw new Error(`${MYNAME}.render(): failed to get program ${progName}`);
        renderProg.bind();
        
        renderProg.setUniforms(navigatorUni);
        renderProg.setUniforms(renderUni);
        renderProg.setUniforms(uni);
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
