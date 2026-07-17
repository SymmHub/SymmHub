import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice, 
    ParamGroup,
    ParamString,
    setViewport,
    enableBlending,
    VisualizationOptions,
    
    SymRendererPrograms,
    InterpolationNames,
    getInterpolationId,
    createFBO,
    getStandardTexTransUni,
} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationColormap';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;


//
//  par.config - optional initial values 
//
function VisualizationColormap(par={}){
    
    let mConfig = {
        enabled: true,
        opacity: 1,
        dataSource: DataSourceNames[0],
        colormap: Colormaps.getNames()[0],
        minValue: 0.0,
        maxValue: 1.0,
        cmWrap: Colormaps.wrapNames[0],
        cmBanding: 0.5,
        useMipmap: false,
        interpolation: InterpolationNames[1], 
    };
    if(par.config){
        Object.assign(mConfig, par.config);
    }

    const mIdRef = { id: par.id ?? '' };  // editable layer name/id
    let mOnIdChange = null;

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    let mMipmapBuffer = null;   // RGBA8 FBO for off-screen colormap + mipmap generation
    const MIPMAP_SIZE = 512;    // must be power-of-2
    
    function onChange(param){
        
      console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            id:             ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:        ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:        ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            dataSource:     ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            colormap:       ParamChoice({obj: cf,key: 'colormap', choice: Colormaps.getNames(), onChange: oc}),
            //plotType: ParamInt({obj: cf, key: 'plotType', min: 0, max: 1, onChange: oc}),
            //dataSlice: ParamFloat({obj: cf,key: 'dataSlice',min: 0,max: 1,step: 0.00001, onChange: oc}),
            minValue:       ParamFloat({obj: cf, key: 'minValue', min: -10,max: 10, step: 0.00001, onChange: oc}),
            maxValue:       ParamFloat({obj: cf,key: 'maxValue',min: -10,max: 10,step: 0.00001,onChange: oc}),
            cmBanding:      ParamFloat({obj:cf,key: 'cmBanding',min: -1,max: 1,step: 0.00001,onChange: oc}),
            cmWrap:         ParamChoice({obj: cf,key: 'cmWrap',choice: Colormaps.wrapNames,onChange: oc}),
            useMipmap:      ParamBool({obj: cf,key: 'useMipmap', onChange: oc}),
            interpolation:  ParamChoice({obj: cf, key: 'interpolation', choice: InterpolationNames, onChange: oc}),
            // mipmapLevel: ParamFloat({obj: cf, key: 'mipmapLevel',min: 0, max: 20,step: 0.00001, onChange: oc,} ),                
        }
    } // function makeParams()

    
    function render(par){
        
       //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;
        
        let dataBuffer  = par.dataBuffer; 
        let renderUni   = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas      = par.canvas;
        let renderTarget = null;
        //
        //  colormap uniforms 
        //
        let colormapUni = { 
            uSimBuffer :    dataBuffer.read,//
            uColormap :     Colormaps.getColormapTexture(gl, {name: cmCfg.colormap}),
            uDataSource:    DataSourceValues[cmCfg.dataSource],
            uCmBanding:     cmCfg.cmBanding,
            uCmWrap:        Colormaps.getWrapValue(cmCfg.cmWrap),
            uMinValue:      cmCfg.minValue,
            uMaxValue:      cmCfg.maxValue,
            uTransparency:  (1. - cmCfg.opacity),
            uInterpolation: getInterpolationId(cmCfg.interpolation),
        };
        
        if(cmCfg.useMipmap && mMipmapBuffer){
            // ── Offscreen pass: render colormapped data into the mipmap FBO ──
            // Uses bufferVisColormap which expects uVisualComponent instead of uDataSource.
            let progVis = mPrograms.getProgram('bufferVisColormap');
            progVis.bind();

            let cnv = mMipmapBuffer;
            // Render into the full mipmap FBO (no blending — whole viewport is overwritten)
            gl.viewport(0, 0, cnv.width, cnv.height);
            gl.disable(gl.BLEND);
                    
            // Standard UV transform so the whole buffer maps to [0,1]^2
            let transUni = getStandardTexTransUni(cnv);

            // bufferVisColormap now uses uDataSource + getDataSouceValue() (same as the screen shader)
            let visColormapUni = {
                uSimBuffer:     colormapUni.uSimBuffer,
                uColormap:      colormapUni.uColormap,
                uMinValue:      colormapUni.uMinValue,
                uMaxValue:      colormapUni.uMaxValue,
                uCmBanding:     colormapUni.uCmBanding,
                uCmWrap:        colormapUni.uCmWrap,
                uDataSource:    DataSourceValues[cmCfg.dataSource],
            };

            progVis.setUniforms(transUni);
            progVis.setUniforms(visColormapUni);
            progVis.blit(mMipmapBuffer);      // render to mip level 0
            mMipmapBuffer.attach(0);          // bind texture to unit 0 (required before generateMipmap)
            gl.generateMipmap(gl.TEXTURE_2D); 
        }
        
        //
        // render the complete image 
        // 
        enableBlending(gl);                     
        let renderProg = mPrograms.getProgram('bufferToScreenColormap');
        renderProg.bind();
        
        // uniforms for complete canvas transform 
        renderProg.setUniforms(navigatorUni);
        //console.log('ctUni:', ctUni);
        renderProg.setUniforms(renderUni);
        // colormap uniforms are the same as for mipmap rendering 
        renderProg.setUniforms(colormapUni);
        
        //console.log('renderUni: ', renderUni);
        //console.log('navigatorUni: ', navigatorUni);
        //console.log('colormapUni: ', colormapUni);
        
        // Pass mipmap uniforms: uUseMipmap toggles mipmap path in shader,
        // uMipmapData provides the pre-rendered + mip-chain texture.
        renderProg.setUniforms({
            uUseMipmap:   cmCfg.useMipmap && !!mMipmapBuffer,
            uMipmapData:  mMipmapBuffer ? mMipmapBuffer.texture : null,
        });
        renderProg.setUniforms({uOpacity: cmCfg.opacity}); 
        setViewport(gl, canvas);
        renderProg.blit(renderTarget);                     
       
    }
    
    function init(par){
        
       if(DEBUG) console.log(`${MYNAME}.init()`, par);
        mGLCtx = par.glCtx;        
        mOnChange = par.onChange;        
        mPrograms = SymRendererPrograms();

        // Create the off-screen RGBA8 mipmap FBO.
        // Must be RGBA8 / UNSIGNED_BYTE (not float) for generateMipmap() to work in WebGL2,
        // and size must be a power-of-two so the full mip chain is generated.
        const gl = mGLCtx.gl;
        mMipmapBuffer = createFBO(
            gl, MIPMAP_SIZE, MIPMAP_SIZE,
            gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,
            gl.LINEAR_MIPMAP_LINEAR
        );
        if(DEBUG) console.log(`${MYNAME}.init() mMipmapBuffer created`, mMipmapBuffer);
        
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
        getId:        ()    => mIdRef.id,
        setId:        (id)  => { mIdRef.id = id; },
        setOnIdChange:(fn)  => { mOnIdChange = fn; },
        init:         init,
        render:       render,
        get enabled(){return mConfig.enabled;},
    }

} // function VisualizationColormap


export {
   VisualizationColormap     
}