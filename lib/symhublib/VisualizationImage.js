import {
    ParamBool,
    ParamFloat,
    ParamChoice,
    ParamString,
    setViewport,
    enableBlending,
    VisualizationOptions,
    SymRendererPrograms,
    InterpolationNames,
    getInterpolationId,
    CrownCalculator,
    DataPacking,
} from './modules.js';

const DEBUG = false;
const MYNAME = 'VisualizationImage';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;
// the tiles of the crown (the shader's MAX_CROWN_COUNT)
const MAX_CROWN_COUNT = 20;
const TORADIANS = Math.PI / 180;


//
//  renders visualization using the dataBuffer as RGBA image
//
//  one image (the main buffer, or the component named by imageId) goes through
//  the shader bufferToScreenImage as it always did; several images (imageId a
//  list of component ids), the crown, the depth sort and the mipmaps go
//  through bufferToScreenImageArray with the images in a texture array
//  (2026-11-04, the crown, the depth sort and the mipmaps as the Color Images
//  layer has them, without the colour permutations):
//    useCrown   the image is seen through the tiles around the pattern box
//               (CrownCalculator), so a picture larger than the domain shows
//               whole, the tiles farthest from the box first
//    useTilt    the crown tiles sorted by their depth along the tilt direction
//    useMipmap  the image array with mipmaps, the level by the pixel's size
//
//  par.config - optional initial values
//
function VisualizationImage(par={}){

    let mConfig = {
        enabled: true,
        opacity: 1,
        interpolation: InterpolationNames[0],
        dataSource: DataSourceNames[0],
        useMipmap: false,
        imageId: '',
        useCrown: false,
        useTilt: false,
        patternTiltDirection: 0,
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
    // the crown tiles packed for the shader, and the tiles of the last group
    // and box: {group, key, revTrans}
    let mCrownGroupData = null;
    let mCrownCache = null;

    function onChange(param){

      if(DEBUG)console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);

    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            id:         ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:    ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:    ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            interpolation: ParamChoice({obj: cf, key: 'interpolation', choice: InterpolationNames, onChange: oc}),
            dataSource: ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            useMipmap:  ParamBool({obj: cf, key: 'useMipmap', name: 'mipmap', onChange: oc}),
            imageId:    ParamString({obj: cf, key: 'imageId', onChange: oc}),
            useCrown:   ParamBool({obj: cf, key: 'useCrown', name: 'crown', onChange: oc}),
            useTilt:    ParamBool({obj: cf, key: 'useTilt', name: 'depth sort', onChange: oc}),
            patternTiltDirection: ParamFloat({obj: cf, key: 'patternTiltDirection', name: 'tilt angle°', min: -180, max: 180, step: 1, onChange: oc}),
        }
    } // function makeParams()


    // Build (or reuse) a TEXTURE_2D_ARRAY containing one layer per DoubleFBO.
    // doubleFBOs: array of DoubleFBO objects (from patternData.getComponentBuffer()).
    // Each frame the current read framebuffer of every FBO is blitted into its layer,
    // and the mipmaps are generated when they are used
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

    //
    //  the crown tiles packed for the shader: the nearest MAX_CROWN_COUNT tiles
    //  of the pattern box (CrownCalculator, nearest first), kept while the group
    //  and the box stay; the transforms map the domain onto the tiles, the
    //  farthest first so that the nearest draw on top
    //
    function prepareCrownData(group, patternTransform) {
        const key = [patternTransform.centerX, patternTransform.centerY, patternTransform.scale, patternTransform.angle].join(' ');
        if (!mCrownCache || mCrownCache.group !== group || mCrownCache.key !== key) {
            mCrownCache = { group, key, revTrans: CrownCalculator.calculate(group, patternTransform, { gridRadius: 15, maxCount: MAX_CROWN_COUNT }) };
        }
        const revTrans = mCrownCache.revTrans;
        const loopCount = Math.min(revTrans.length, MAX_CROWN_COUNT);
        const dirTrans = revTrans.slice(0, loopCount).reverse().map(t => t.getInverse());
        DataPacking.packGroupToSampler(mGLCtx.gl, mCrownGroupData, { s: group.getFundDomain(), t: dirTrans });
        return mCrownGroupData;
    }

    function render(par){

       //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;

        let renderUni    = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas       = par.canvas;
        let renderTarget = null;
        //
        // Parse imageId as a space-separated list of component ids.
        const ids = cmCfg.imageId ? cmCfg.imageId.trim().split(/\s+/).filter(Boolean) : [];
        // the crown needs the group and the pattern box
        const useCrown = cmCfg.useCrown && !!par.group && !!par.patternTransform;
        const arrayPath = ids.length > 1 || useCrown || cmCfg.useTilt || cmCfg.useMipmap;

        let imageUni;
        let renderProgName;

        if (!arrayPath) {
            // ── single-buffer path ────────────────────────────────────────────
            let selectedBuffer = par.dataBuffer;
            if (ids.length === 1 && par.patternData) {
                const compBuf = par.patternData.getComponentBuffer(ids[0]);
                if (compBuf) selectedBuffer = compBuf;
            }
            renderProgName = 'bufferToScreenImage';
            imageUni = {
                uSimBuffer:     selectedBuffer.read,
                uDataSource:    DataSourceValues[cmCfg.dataSource],
                uTransparency:  (1. - cmCfg.opacity),
                uInterpolation: getInterpolationId(cmCfg.interpolation),
            };
        } else {
            // ── the image array: bufferToScreenImageArray ─────────────────────
            // Collect DoubleFBOs so we can access both .read and .width/.height.
            // Use optional chaining on getComponentBuffer — simple PatternData
            // objects (from PatternImage) don't implement it.
            const doubleFBOs = ids
                .map(id => par.patternData?.getComponentBuffer?.(id))
                .filter(Boolean);
            // Fall back to the main buffer when no ids are resolved.
            const buffers = doubleFBOs.length > 0 ? doubleFBOs : [par.dataBuffer];
            const arrayTex = updateImageArrayTex(gl, buffers);
            const crownData = useCrown ? prepareCrownData(par.group, par.patternTransform) : renderUni.uGroupData;
            const angle = cmCfg.patternTiltDirection * TORADIANS;
            renderProgName = 'bufferToScreenImageArray';
            imageUni = {
                uImageArray:    arrayTex,
                uNumImages:     buffers.length,
                uDataSource:    DataSourceValues[cmCfg.dataSource],
                uTransparency:  (1. - cmCfg.opacity),
                uInterpolation: getInterpolationId(cmCfg.interpolation),
                uUseCrown:      useCrown,
                uCrownData:     crownData,
                uUseTilt:       cmCfg.useTilt,
                uTiltVector:    new Float32Array([Math.cos(angle), Math.sin(angle)]),
                uUseMipmap:     cmCfg.useMipmap,
            };
        }

        //
        // render the complete image
        //
        enableBlending(gl);
        let renderProg = mPrograms.getProgram(renderProgName);
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
        mPrograms = SymRendererPrograms();
        mCrownGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);

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

} // function VisualizationImage


export {
   VisualizationImage
}
