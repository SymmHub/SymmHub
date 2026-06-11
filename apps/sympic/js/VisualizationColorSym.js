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
} from './modules.js';




const DEBUG = true;
const MYNAME = 'VisualizationColorSym';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;


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

    // Cell color generator (cosine palette → uCellColors uniform).


    // Parsed permutation data ready to upload as uPermData / uPermSize.
    // mPermData: flat Uint32Array(MAX_GEN_COUNT * 4) with packed uvec4 values.
    const MAX_GEN_COUNT = 6;
    let mPermData = new Uint32Array(MAX_GEN_COUNT * 4); // zeroed = all identity-like
    let mPermSize = 0;

    // Per-texture-layer alpha mask (0.0 = hidden, 1.0 = visible), padded with 1s.
    const MAX_TEX_COUNT = 24;
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
    //  Pack a plain integer array (values 0-23) into a uvec4 using 5-bit packing:
    //  6 values per uint32 component (6 * 5 = 30 bits used, 2 spare).
    //  Mirrors perm_identity / compose_perms in the shader.
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
    //  Format: space-separated words, each word encodes one permutation.
    //  Each character maps its position: 'a'->0, 'b'->1, ..., 'z'->25.
    //  Identity of size n is "abcde..." (first n letters in order).
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
            // Write the 4 uint32s into the flat buffer at slot k.
            mPermData.set(packed, k * 4);
        }

        if(DEBUG) console.log(`${MYNAME}.onPermChanged(): ${words.length} perms, size=${mPermSize}`, mPermData);
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
            imageId:       ParamString({obj: cf, key: 'imageId', onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            permIndex:     ParamInt({obj: cf, key: 'permIndex', min: 0, max: 23, step: 1, onChange: oc}),
            useCrown:      ParamBool({obj: cf, key: 'useCrown', onChange: oc}),
            leftCoset:     ParamBool({obj: cf, key: 'leftCoset', onChange: oc}),
            mask:          ParamString({obj: cf, key: 'mask', onChange: onMaskChanged}),

            subgroups:     ParamObj({name: 'subgroups', obj: mSubgroups}),

            interpolation: ParamChoice({obj: cf, key: 'interpolation', choice: InterpolationNames, onChange: oc}),
            useMipmap:     ParamBool({obj: cf, key: 'useMipmap', onChange: oc}),
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
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            mArrayTexCache = { tex, count, size };
        }

        // Copy each image's current render result into the corresponding array layer.
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
        const doubleFBOs = ids
            .map(id => par.patternData?.getComponentBuffer(id))
            .filter(Boolean);

        // Fall back to the default buffer when no ids are resolved.
        const buffers = doubleFBOs.length > 0 ? doubleFBOs : [par.dataBuffer];

        const arrayTex = updateImageArrayTex(gl, buffers);

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

            // cell color tiles disabled in this layer
            uFillCells:          false,
            uCellColors:         new Float32Array(24 * 4), // dummy array
            uCellColorPermIndex: 0,
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
