import {    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamChoice,
    ParamString,
    ParamObj,
    setViewport,
    enableBlending,
    VisualizationOptions,
    Sympix_programs,

    InterpolationNames, 
    getInterpolationId, 
    Subgroups,
    CrownCalculator,
    DataPacking,
    wordToPerm,
    invertPerm,
    packPerm,
    MAX_COLORS_COUNT,
    transToPackedPerms,
    strToPermutations,
} from './modules.js';

import { ColorTiles } from './ColorTiles.js';




const DEBUG = false;
const MYNAME = 'VisualizationColorSym';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const MAX_CROWN_COUNT = 20;

const COLORING_TYPE_NAMES = ['none', 'mult', 'invMut', 'hueShift'];
const COLORING_TYPE = { 'none': 0, 'mult': 1, 'invMut': 2, 'hueShift': 3 };
const TORADIANS = Math.PI / 180;


//
//  Color Symmetry visualization layer.
//  Renders a PatternImageArray as a composited multi-image using sampler2DArray.
//
//  par.config - optional initial values 
//
function VisualizationColorSym(par={}){
    
    let mConfig = {
        enabled: true,
        opacity: 1,
        interpolation: InterpolationNames[0], 
        dataSource: DataSourceNames[0],
        useMipmap: false,
        imageId: '',
        permutations: '',
        permIndex: 0,
        useCrown: false,
        leftCoset: false,
        mask: '',
        coloringType: 'none',
        patternTiltDirection: 0,
        useTilt: false,
    };

    if(par.config){
        Object.assign(mConfig, par.config);
    }

    // ── id / name management (required by ParamObjArray) ─────────────────────
    const mIdRef = { id: par.id ?? '' };
    let mOnIdChange = null;

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    // Cache for the TEXTURE_2D_ARRAY used in multi-image compositing.
    let mArrayTexCache = { tex: null, count: 0, size: 0 };
    let mCrownGroupData = null;

    // Cell color palette (cosine palette → uCellColors uniform) used when multiplyColors is on.
    const mColorTiles = ColorTiles({
        getAlpha:     () => 1.0,
        getColorMask: () => '',
        getPermIndex: () => mConfig.permIndex,
    });

    let mGeneratorPerms = strToPermutations(mConfig.permutations);
    let mInvGeneratorPerms = mGeneratorPerms.map(p => invertPerm(p));

    // Parsed permutation data ready to upload as uPermData / uPermSize.
    // mPermData: flat Uint32Array(MAX_GEN_COUNT * 4) with packed uvec4 values.
    const MAX_GEN_COUNT = 6;
    let mPermData = new Uint32Array(MAX_GEN_COUNT * 4); // zeroed = all identity-like
    let mPermSize = 0;

    // Per-texture-layer alpha mask (0.0 = hidden, 1.0 = visible), padded with 1s.
    const MAX_TEX_COUNT = MAX_COLORS_COUNT;
    let mTexAlpha = new Float32Array(MAX_TEX_COUNT).fill(1.0);

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


    function onChange(param){
        
      if(DEBUG)console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }



    //
    //  Parse mConfig.permutations into packed GPU data.
    //
    //  Format: space-separated words, each word encodes one permutation.
    //  Each character maps its position: 'a'->0, 'b'->1, ..., 'z'->25.
    //  Identity of size n is "abcde..." (first n letters in order).
    //
    function onPermChanged() {
        const str = mConfig.permutations;
        mGeneratorPerms = strToPermutations(str);
        mInvGeneratorPerms = mGeneratorPerms.map(p => invertPerm(p));

        mPermData = new Uint32Array(MAX_GEN_COUNT * 4);
        mPermSize = 0;

        if (mGeneratorPerms.length === 0) {
            if (DEBUG) console.log(`${MYNAME}.onPermChanged(): empty — using identity`);
            onChange(null);
            return;
        }

        mPermSize = mGeneratorPerms[0].length;

        // Keep ColorTiles count in sync with the permutation size.
        mColorTiles.getParams().count.setValue(mPermSize);
        const params = getParams();
        if (params && params.permIndex) {
            params.permIndex.setMax(mPermSize - 1);
        }

        for (let k = 0; k < Math.min(mGeneratorPerms.length, MAX_GEN_COUNT); k++) {
            const perm = mGeneratorPerms[k];
            const packed = packPerm(perm);
            // Write the 4 uint32s into the flat buffer at slot k.
            mPermData.set(packed, k * 4);
        }

        if (DEBUG) console.log(`${MYNAME}.onPermChanged(): ${mGeneratorPerms.length} perms, size=${mPermSize}`, mPermData);
        onChange(null);
    }

    //
    //  Parse mConfig.mask into mTexAlpha.
    //  Each character: '0' → 0.0, anything else → 1.0.
    //  Positions beyond the string length are filled with 1.0.
    //
    function onMaskChanged() {
        const str = mConfig.mask || '';
        for (let i = 0; i < MAX_TEX_COUNT; i++) {
            mTexAlpha[i] = (i < str.length && str[i] === '0') ? 0.0 : 1.0;
        }
        if(DEBUG) console.log(`${MYNAME}.onMaskChanged(): "${str}"`, mTexAlpha.slice(0, 8));
        onChange(null);
    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            id: ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:       ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:       ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            imageId:       ParamString({obj: cf, key: 'imageId', name: 'images', onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            permIndex:     ParamInt({obj: cf, key: 'permIndex', name:'offset', min: 0, max: 23, step: 1, onChange: oc}),
            leftCoset:     ParamBool({obj: cf, key: 'leftCoset', onChange: oc}),
            mask:          ParamString({obj: cf, key: 'mask', onChange: onMaskChanged}),
            subgroups:     ParamObj({name: 'subgroups', obj: mSubgroups}),
            coloringType:  ParamChoice({obj: cf, key: 'coloringType', name: 'coloring', choice: COLORING_TYPE_NAMES, onChange: oc}),
            colorTiles:    ParamObj({name: 'colors', obj: mColorTiles}),
            useCrown:      ParamBool({obj: cf, key: 'useCrown', name: 'crown', onChange: oc}),
            useTilt:       ParamBool({obj: cf, key: 'useTilt', name: 'depth sort', onChange: oc}),
            patternTiltDirection: ParamFloat({obj: cf, key: 'patternTiltDirection', name: 'tilt angle°', min: -180, max: 180, step: 1, onChange: oc}),
            useMipmap:     ParamBool({obj: cf, key: 'useMipmap', name: 'mipmap', onChange: oc}),
            interpolation: ParamChoice({obj: cf, key: 'interpolation', name: 'interp', choice: InterpolationNames, onChange: oc}),
        }

    } // function makeParams()

    
    // Build (or reuse) a TEXTURE_2D_ARRAY containing one layer per DoubleFBO.
    // doubleFBOs: array of DoubleFBO objects (from patternData.getComponentBuffer()).
    // Each frame the current read framebuffer of every FBO is blitted into its layer.
    function updateImageArrayTex(gl, doubleFBOs) {
        const count = doubleFBOs.length;
        const size  = doubleFBOs[0].width;  // PatternImage buffers are always square

        // Recreate only when count or size changes.
        if (!mArrayTexCache.tex || mArrayTexCache.count !== count || mArrayTexCache.size !== size) {
            if (mArrayTexCache.tex) gl.deleteTexture(mArrayTexCache.tex);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, size, size, count, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            mArrayTexCache = { tex, count, size };
        }

        // Copy each image's current render result into the corresponding array layer.
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, mArrayTexCache.tex);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, mConfig.useMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        for (let i = 0; i < count; i++) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, doubleFBOs[i].read.fbo);
            gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 0, 0, size, size);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

        if (mConfig.useMipmap) {
            gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        return mArrayTexCache.tex;
    }

    /**
     * Calculates the crown transforms, packs them into a GL sampler,
     * and computes the packed permutation data for shader usage.
     * Reverses the transforms list to render inner tiles on top of outer ones.
     * 
     * @param {Group} group - The symmetry group.
     * @param {Object} patternTransform - The current pattern transform.
     * @returns {Object} An object containing { crownData, crownPerms }.
     */
    function prepareCrownData(group, patternTransform) {
        const revTrans = CrownCalculator.calculate(group, patternTransform, { gridRadius: 15 });
        const loopCount = Math.min(revTrans.length, MAX_CROWN_COUNT);
        // dirTrans[g] = revTrans[g]^-1: maps FD → adjacent tile g in world space.
        // Used for both geometry and permutations:
        //   Geometry:     the shader applies dirTrans[g] to a FD point to locate the
        //                 adjacent tile's image in world coords (correct even when
        //                 the pattern center is offset from the FD center).
        //   Permutations: wordToPerm(dirTrans[g].word, ...) produces the correct
        //                 crown color permutation consistent with the FD tiling shader.
        // Reversed so that transforms closer to the center are rendered last (on top).
        let dirTrans = revTrans.slice(0, loopCount).reverse().map(t => t.getInverse());

        const crownGroup = {
            s: group.getFundDomain(),
            t: dirTrans
        };
        const gl = mGLCtx.gl;
        DataPacking.packGroupToSampler(gl, mCrownGroupData, crownGroup);
        const crownData = mCrownGroupData;

        const crownPerms = transToPackedPerms(dirTrans, mGeneratorPerms, mInvGeneratorPerms, mConfig.leftCoset);

        if (DEBUG) {
            const crownPermsInfo = dirTrans.map(t => {
                const perm = wordToPerm(t.getWord(), mGeneratorPerms, mInvGeneratorPerms, mConfig.leftCoset);
                return `${t.getWord() || "identity"}: [${perm.join(",")}]`;
            }).join(", ");
            console.log(`Crown Permutations: ${crownPermsInfo}`);
        }

        return { crownData, crownPerms };
    }

    function render(par){
        
       //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;
        
        let dataBuffer   = par.dataBuffer; 
        let renderUni    = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas       = par.canvas;
        let renderTarget = null;
        //
        //  image uniforms
        //
        // Parse imageId as a space-separated list of component ids.
        const ids = cmCfg.imageId ? cmCfg.imageId.trim().split(/\s+/).filter(Boolean) : [];

        // collect DoubleFBOs for each id.
        // Use optional chaining on getComponentBuffer — simple PatternData
        // objects (from PatternImage) don't implement it.
        const doubleFBOs = ids
            .map(id => par.patternData?.getComponentBuffer?.(id))
            .filter(Boolean);

        // Fall back to the default buffer when no ids are resolved.
        const buffers = doubleFBOs.length > 0 ? doubleFBOs : [par.dataBuffer];

        const arrayTex = updateImageArrayTex(gl, buffers);

        let crownData = renderUni.uGroupData;
        let crownPerms = null;

        if (cmCfg.useCrown && par.group && par.patternTransform) {
            const res = prepareCrownData(par.group, par.patternTransform);
            crownData = res.crownData;
            crownPerms = res.crownPerms;
        } else {
            crownPerms = new Uint32Array(MAX_CROWN_COUNT * 4);
        }

        const imageUni = {
            uImageArray:    arrayTex,
            uNumImages:     buffers.length,
            uTransparency:  (1. - cmCfg.opacity),
            uInterpolation: getInterpolationId(cmCfg.interpolation),
            uPermData:      mPermData,
            uPermSize:      mPermSize,
            uTexPermIndex:  cmCfg.permIndex,
            uUseCrown:      cmCfg.useCrown,
            uLeftCoset:     cmCfg.leftCoset,
            uTexAlpha:      mTexAlpha,
            uCrownData:     crownData,
            uCrownPermData: crownPerms,
            uUseMipmap:     cmCfg.useMipmap,

            // cell color tiles
            uFillCells:          false,
            uCellColors:         mColorTiles.getPremultColors(),
            uCellColorPermIndex: mColorTiles.getPermIndex(),
            uColoringType:       COLORING_TYPE[cmCfg.coloringType] ?? 0,

            // tilt depth-sort
            uUseTilt:    cmCfg.useTilt,
            uTiltVector: (() => {
                const angle = cmCfg.patternTiltDirection * TORADIANS;
                return new Float32Array([Math.cos(angle), Math.sin(angle)]);
            })(),
        };


        //
        // render the complete image 
        // 
        enableBlending(gl); 
        const progName = 'colorImageArray';
        let renderProg = mPrograms.getProgram(gl, progName);                     
        if(!renderProg) throw new Error(`${MYNAME}.render(): failed to get program ${progName}`);
        renderProg.bind();
        
        // uniforms for complete canvas transform 
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

        mCrownGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);

        mColorTiles.setOnChange(() => onChange(null));
    }
    
    //
    //
    //
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

} // function VisualizationColorSym




export {
   VisualizationColorSym
}
