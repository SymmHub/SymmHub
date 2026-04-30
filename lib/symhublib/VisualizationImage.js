import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice,
    ParamString,
    ParamGroup,
    setViewport,
    enableBlending,
    VisualizationOptions,
    
    SymRendererPrograms,
    InterpolationNames, 
    getInterpolationId, 
} from './modules.js';

const DEBUG = false;
const MYNAME = 'VisualizationImage';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;


//
//  renders visualization using the dataBuffer as RGBA image 
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
    };
    if(par.config){
        Object.assign(mConfig, par.config);
    }

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    // Cache for the TEXTURE_2D_ARRAY used in multi-image compositing.
    let mArrayTexCache = { tex: null, count: 0, size: 0 };
    
    function onChange(param){
        
      if(DEBUG)console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            enabled:    ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:    ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            interpolation: ParamChoice({obj: cf, key: 'interpolation', choice: InterpolationNames, onChange: oc}),
            dataSource: ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            useMipmap:  ParamBool({obj: cf, key: 'useMipmap', onChange: oc}),
            imageId:    ParamString({obj: cf, key: 'imageId', onChange: oc}),
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
        //  colormap uniforms 
        //
        // Parse imageId as a space-separated list of component ids.
        const ids = cmCfg.imageId ? cmCfg.imageId.trim().split(/\s+/).filter(Boolean) : [];

        let imageUni;
        let renderProgName;

        if (ids.length <= 1) {
            // ── single-buffer path (unchanged) ────────────────────────────────
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
            // ── multi-buffer path: bufferToScreenImageArray ───────────────────
            // Collect DoubleFBOs so we can access both .read and .width/.height.
            const doubleFBOs = ids
                .map(id => par.patternData?.getComponentBuffer(id))
                .filter(Boolean);
            const arrayTex = updateImageArrayTex(gl, doubleFBOs);
            renderProgName = 'bufferToScreenImageArray';
            imageUni = {
                uImageArray:    arrayTex,
                uNumImages:     doubleFBOs.length,
                uDataSource:    DataSourceValues[cmCfg.dataSource],
                uTransparency:  (1. - cmCfg.opacity),
                uInterpolation: getInterpolationId(cmCfg.interpolation),
            };
        }

        /*
        let visOpt      = mConfig.options; 
        if(visOpt.useMipmap){
            // make mipmap image 
            
            let progVis = mPrograms.getProgram('bufferVisImage');
            progVis.bind();

            let cnv = mMipmapBuffer;
            setVieport(cnv);
            // no need to clear because we render the whole viewport and have no blending
            disableBlending();
                    
            // transformation to render data into buffer 
            let transUni = getStandardTexTransUni(cnv);

            progVis.setUniforms(transUni);
            progVis.setUniforms(imageUni);            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level             
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()            
            gl.generateMipmap(gl.TEXTURE_2D); 
            
        }
        */
        
        //
        // render the complete image 
        // 
        enableBlending(gl);                     
        let renderProg = mPrograms.getProgram(renderProgName);
        renderProg.bind();
        
        // uniforms for complete canvas transform 
        renderProg.setUniforms(navigatorUni);
        //console.log('ctUni:', ctUni);
        renderProg.setUniforms(renderUni);
        // colormap uniforms are the same as for mipmap rendering 
        renderProg.setUniforms(imageUni);
                
        //let mipmapUni = getMipmapUni();        
        //renderProg.setUniforms(mipmapUni);
        renderProg.setUniforms({uOpacity: cmCfg.opacity}); 
        setViewport(gl, canvas);
        renderProg.blit(renderTarget);                     
       
    }
    
    function init(par){
        
       if(DEBUG) console.log(`${MYNAME}.init()`, par);
        mGLCtx = par.glCtx;        
        mOnChange = par.onChange;        
        mPrograms = SymRendererPrograms();
        
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
        getParams:  getParams, 
        init:           init,
        render:         render,
        get enabled(){return mConfig.enabled;},
    }

} // function VisualizationColormap


export {
   VisualizationImage
}