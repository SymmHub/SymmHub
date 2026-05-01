import {    
    ParamBool,
    ParamFloat,
    ParamChoice,
    ParamString,
    setViewport,
    enableBlending,
    VisualizationOptions,
    Sympix_programs,

    InterpolationNames, 
    getInterpolationId, 
} from './modules.js';

const DEBUG = false;
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
            //dataSource: ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
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
            // uDataSource:    DataSourceValues[cmCfg.dataSource],
            uTransparency:  (1. - cmCfg.opacity),
            uInterpolation: getInterpolationId(cmCfg.interpolation),
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
        getParams:  getParams, 
        init:           init,
        render:         render,
        get enabled(){return mConfig.enabled;},
    }

} // function VisualizationColorSym


export {
   VisualizationColorSym
}
