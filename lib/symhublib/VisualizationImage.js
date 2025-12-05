import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice, 
    ParamGroup,
    setViewport,
    enableBlending,
    VisualizationOptions,
    
    SymRendererPrograms,
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
        dataSource: DataSourceNames[0],
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
        
      if(DEBUG)console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            enabled: ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity: ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            dataSource:    ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            useMipmap: ParamBool({obj: cf,key: 'useMipmap', onChange: oc}),
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
        let imageUni = { 
            uSimBuffer :    dataBuffer.read,//
            uDataSource:    DataSourceValues[cmCfg.dataSource],
            uTransparency:  (1. - cmCfg.opacity),
        };
        
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
        let renderProg = mPrograms.getProgram('bufferToScreenImage');
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