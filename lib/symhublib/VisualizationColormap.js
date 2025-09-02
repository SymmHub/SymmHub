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

        return {
            enabled: ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity: ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            dataSource:    ParamChoice({obj: cf, key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            colormap:ParamChoice({obj: cf,key: 'colormap', choice: Colormaps.getNames(), onChange: oc}),
            //plotType: ParamInt({obj: cf, key: 'plotType', min: 0, max: 1, onChange: oc}),
            //dataSlice: ParamFloat({obj: cf,key: 'dataSlice',min: 0,max: 1,step: 0.00001, onChange: oc}),
            minValue: ParamFloat({obj: cf, key: 'minValue', min: -10,max: 10, step: 0.00001, onChange: oc}),
            maxValue: ParamFloat({obj: cf,key: 'maxValue',min: -10,max: 10,step: 0.00001,onChange: oc}),
            cmBanding: ParamFloat({obj:cf,key: 'cmBanding',min: -1,max: 1,step: 0.00001,onChange: oc}),
            cmWrap: ParamChoice({obj: cf,key: 'cmWrap',choice: Colormaps.wrapNames,onChange: oc}),
            useMipmap: ParamBool({obj: cf,key: 'useMipmap', onChange: oc}),
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
        };
        
        /*
        let visOpt      = mConfig.options; 
        if(visOpt.useMipmap){
            // make mipmap image 
            
            let progVis = mPrograms.getProgram('bufferVisColormap');
            progVis.bind();

            let cnv = mMipmapBuffer;
            setVieport(cnv);
            // no need to clear because we render the whole viewport and have no blending
            disableBlending();
                    
            // transformation to render data into buffer 
            let transUni = getStandardTexTransUni(cnv);

            progVis.setUniforms(transUni);
            progVis.setUniforms(colormapUni);            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level             
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()            
            gl.generateMipmap(gl.TEXTURE_2D); 
            
        }
        */
        
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
   VisualizationColormap     
}