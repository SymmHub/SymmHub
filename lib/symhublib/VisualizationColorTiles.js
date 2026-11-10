import {    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamString,
    ParamObj,
    ParamUiRow,
    ParamUiFolder,
    setViewport,
    enableBlending,
    ColorSymPrograms,
    Subgroups,
    strToPermutations,
    sidePermutations,
    packSidePerms,
    MAX_COLORS_COUNT,
    ColorTiles,
} from './modules.js';


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
        useSymmetry: true,
        opacity: 1,
        permutations: '',
        useOrbit: false,
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
    // the mask hides colours: the strip's eyes set it
    const mColorTiles = ColorTiles({
        getAlpha:     () => 1.0,
        getColorMask: () => mConfig.mask,
        getPermIndex: () => mConfig.permIndex,
        mask:         { get: () => mConfig.mask, set: (text) => getParams().mask.setValue(text) },
    });

    // the table of subgroups of the renderer's group, handed over by the renderer at init
    let mGroupTables = null;

    const mSubgroups = Subgroups({
        getGroupTables: () => mGroupTables,
        getLayerParams: () => {
            const params = getParams();
            return {
                permutations: params.permutations,
                permIndex:    params.permIndex,
                useOrbit:     params.useOrbit,
                count:        mColorTiles.getParams().count,
            };
        },
        onChange: () => onChange(null)
    });

    // the document's permutations, of the generators of the renderer's group
    let mGeneratorPerms = [];

    // Parsed permutation data ready to upload as uPermData / uPermSize: of the
    // sides of the group drawn (sidePermutations)
    let mPermData = packSidePerms([]);
    let mPermSize = 0;
    let mSidePermsOf = null;  // {group, useOrbit} they are of, null when to be made


    function onChange(param){
      if(DEBUG) console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
    }



    //
    //  Parse mConfig.permutations into packed GPU data.
    //
    function onPermChanged() {
        mGeneratorPerms = strToPermutations(mConfig.permutations);
        mPermSize = mGeneratorPerms.length ? mGeneratorPerms[0].length : 0;
        mSidePermsOf = null;
        mSubgroups.onPermutationsChanged();

        if(DEBUG) console.log(`${MYNAME}.onPermChanged(): ${mGeneratorPerms.length} perms, size=${mPermSize}`);
        onChange(null);
    }

    function onUseOrbitChanged() {
        mSubgroups.updateCheck();
        onChange(null);
    }

    //
    //  the permutations of the sides of the group about to be drawn
    //
    function updateSidePerms(group) {
        const useOrbit = mConfig.useOrbit;
        if (mSidePermsOf && mSidePermsOf.group === group && mSidePermsOf.useOrbit === useOrbit) return;
        mSidePermsOf = { group, useOrbit };
        mPermData = packSidePerms(sidePermutations(group, mGeneratorPerms, useOrbit));
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
            useSymmetry: ParamBool({obj: cf, key: 'useSymmetry', name: 'symmetry', onChange: oc, tooltip: 'the layer folded by the group (on), or drawn once as it is (off)'}),
            opacity:       ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            useOrbit:     ParamBool({obj: cf, key: 'useOrbit', onChange: onUseOrbitChanged}),

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

        updateSidePerms(par.group);

        const uni = {
            uTransparency:       1. - cmCfg.opacity,
            uPermData:           mPermData,
            uPermSize:           mPermSize,
            uUseOrbit:          cmCfg.useOrbit,

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
        mGroupTables = par.groupTables || null;
        mPrograms = ColorSymPrograms;
        mColorTiles.setOnChange(() => {
            const count = mColorTiles.getCount();
            const params = getParams();
            if (params && params.permIndex) {
                params.permIndex.setMax(count - 1);
            }
            onChange(null);
        });
        mSubgroups.onGroupChanged();
    }
    
    function getParams(){
        if(!mParams)
            mParams = makeParams(mConfig);
        return mParams;
    }

    //
    //  the params as the panel shows them: the colours (count, the strip with
    //  the mask's eyes, the palette), the subgroups, offset and orbits in a
    //  row; closed folders for the permutations and mask as text and the
    //  palette's own. Only the UI: getParams() is what is saved, as before.
    //
    let mPanelParams = null;
    function getPanelParams(){
        if (mPanelParams) return mPanelParams;
        const p = getParams();
        const t = mColorTiles.getParams();
        const offset = ParamUiRow({name: 'offset', tooltip: 'offset: the colour of the domain; orbits: the colours by the orbits of the permutations'});
        const text = ParamUiFolder({name: 'permutations and mask'});
        mPanelParams = {
            id:           p.id,
            enabled:      p.enabled,
            useSymmetry:  p.useSymmetry,
            opacity:      p.opacity,
            count:        t.count,
            strip:        t.strip,
            palette:      t.palette,
            subgroups:    p.subgroups,
            offset,
            permIndex:    offset.contain(p.permIndex),
            useOrbit:     offset.contain(p.useOrbit, {label: 'orbits'}),
            text,
            permutations: text.contain(p.permutations),
            mask:         text.contain(p.mask),
            paletteFolder: t.paletteFolder,
            a: t.a, b: t.b, c: t.c, d: t.d,
            vary:         t.vary,
            adjust:       t.adjust,
        };
        return mPanelParams;
    }
    
    return {
        // the pattern need not render its buffer for this layer
        usesPatternBuffer: () => false,
        getParams:    getParams,
        getPanelParams,
        getClassName: (() => MYNAME),
        getId:        () => mIdRef.id,
        setId:        (id) => { mIdRef.id = id; },
        setOnIdChange:(fn) => { mOnIdChange = fn; },
        init:         init,
        render:       render,
        // another group (or another domain shape of the same group) has other
        // generators: the first says the table is on its way, the second that it is here
        onGroupChanged: () => mSubgroups.onGroupChanged(),
        onPresentationChanged: () => mSubgroups.onPresentationChanged(),
        get enabled(){ return mConfig.enabled; },
        // the symmetry of the layer: folded by the group (VisualizationManager.render sets uSymmetry)
        get useSymmetry(){ return mConfig.useSymmetry !== false; },
    }

} // function VisualizationColorTiles


export {
   VisualizationColorTiles
}
