import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice, 
    ParamGroup,
    TextureFile,
    Textures,
    setViewport,
    enableBlending,
    VisualizationOverlay,
    SymRendererPrograms,
} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationBumpmap';
const INCREMENT = 1.e-12;

function VisualizationBumpmap(par={}){
    
    let mConfig = {
        enabled: true,
        opacity: 1,
        bumpHeight: 0.01,
        minValue: -1,
        maxValue: 1,
        bumpSmooth: 0.1,
        delta: 0.001,
        useMipmap: false,
    };
    if(par.config){
        Object.assign(mConfig, par.config);
    }

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    
    function onChange(param){
        
      console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }

    function makeParams(cf) {

        let oc = onChange;
        const inc = INCREMENT;
        return {
            enabled: ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity: ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            bumpHeight: ParamFloat({obj:cf, key: 'bumpHeight',  min: -0.5, max: 0.5, onChange: oc}),
            minValue:   ParamFloat({obj:cf, key: 'minValue',    min: -5,max: 5,step: inc,onChange: oc}),
            maxValue:   ParamFloat({obj:cf, key: 'maxValue',    min: -5,max: 5,step: inc,onChange: oc}),
            bumpSmooth: ParamFloat({obj:cf, key: 'bumpSmooth',  min: -5,max: 5,step: inc,onChange: oc}),
            //delta:      ParamFloat({obj:cf, key: 'delta',       min: 0,max: 0.5,step: inc,onChange: oc}),
            useMipmap: ParamBool({obj: cf,key: 'useMipmap', onChange: oc}),
        }
    } // function makeParams()

    
    function render(par){
        
        //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        let bumpConf = mConfig;
        //return;
        
        let dataBuffer  = par.dataBuffer; 
        let renderUni   = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas      = par.canvas;
        let renderTarget = null;
        
        // bumpmap uniforms 
        let bumpUni = {
            uSimBuffer :        dataBuffer.read,//.texture,
            uBumpHeight:        bumpConf.bumpHeight,
            uMinValue:          bumpConf.minValue,
            uMaxValue:          bumpConf.maxValue,
            uBumpSmoothFactor:  bumpConf.bumpSmooth,
            uVisualComponent:   0, //TODO 
            uBumpStyle:         3, //TORO 
            uTransparency:      1.-bumpConf.opacity,
            
        };

        /*
        if(bumpConf.useMipmap){ // create mipmap of grayscale image of data                    
            
            let progVis = mPrograms.getPrograms('bufferVisHeightmap');
            progVis.bind();

            let cnv = mMipmapBuffer;
            gl.viewport(0, 0, cnv.width, cnv.height);
            // no need to clear because we render the whole viewport and have no belnding
            disableBlending();
                                
            let transUni = getStandardTexTransUni(cnv);
            
            progVis.setUniforms(transUni);
            progVis.setUniforms(bumpUni);
            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level             
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()
            
            gl.generateMipmap(gl.TEXTURE_2D); 

        } 
        */
        //
        // render the complete image 
        // 
        enableBlending(gl);
        
        setViewport(gl, canvas);
        let renderProg = mPrograms.getProgram('bufferToScreenBumpmap');

        renderProg.bind();

        renderProg.setUniforms(navigatorUni);
        renderProg.setUniforms(renderUni);
        renderProg.setUniforms(bumpUni);
        
        //let mipmapUni = getMipmapUni();        
        //renderProg.setUniforms(mipmapUni);
        
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
        init:       init,
        render:     render,
        get enabled(){return mConfig.enabled;},
    }

} // function VisualizationBumpmap


export {
   VisualizationBumpmap     
}