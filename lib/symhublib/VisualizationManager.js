import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice, 
    ParamGroup,
    setParamValues,
    
    TextureFile,
    Textures,
    setViewport, 
    enableBlending,
    SymRendererPrograms,

    VisualizationOverlay,
    VisualizationColormap,
    VisualizationBumpmap,
    VisualizationTexmap,
    VisualizationOptions,
    
} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationManager';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;

const INCREMENT = 1.e-12;
const INTERP_LINEAR = 'linear';
const INTERP_QUADRATIC = 'biquadratic';
const INTERP_NAMES = [
    INTERP_LINEAR,
    INTERP_QUADRATIC
];


function VisualizationManager(options = {}){
    
    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    
    const cfgDisabled = {config:{enabled:false}};
    const cfgEnabled = {config:{enabled:true}};
    
    
    let mVisLayers;
    
    if(options.visLayers){ 
    
        mVisLayers = options.visLayers;
        
    } else {
        // default layers;
        mVisLayers = [
            {
                name: 'colormap',
                visLayer: VisualizationColormap(cfgEnabled)
            },
            {
                name: 'colormap2',
                visLayer: VisualizationColormap(cfgDisabled)
            },
            {
                name: 'texmap',            
                visLayer: VisualizationTexmap(cfgDisabled),
            },
            {
                name: 'bumpmap',
                visLayer: VisualizationBumpmap(cfgDisabled),
            },               
            { 
                name: 'overlay',
                visLayer: VisualizationOverlay(cfgDisabled),
            }            
        ];  
    }
    
    let mConfig = {

        visualComponent: 0,

        options: {
            showGrid:    true,
            showRuler:   true,
            showChecker: false,
            useMipmap:   false,
            mipmapLevel: 0,
            interpolation: INTERP_QUADRATIC,
            plotType: 0,
            dataSlice: 0.5,
            visualComponent: 0,
        },

    };


    function onChange(param){
      console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
    }

    function onTextureChanged(param){
      console.log(`${MYNAME}.onTextureChanged()`, param);
    }
    
    
    function makeParams(cfg) {

        //let oc = onChange;
        let par = {};
        for(let i = 0; i < mVisLayers.length; i++) {
            let name = mVisLayers[i].name;
            par[name] = ParamObj({obj: mVisLayers[i].visLayer, name:name});
        }
        par['options'] = makeVisOptionsParams(cfg.options);
        return par;
        /*
        return {
            colormap:   ParamObj({obj: mColormapVis, name:'colormap'}),
            colormap2:  ParamObj({obj: mColormapVis2, name:'colormap2'}),
            texmap:     ParamObj({obj: mTexmapVis, name: 'texmap'}),
            bumpmap:    ParamObj({obj: mBumpmapVis, name: 'bumpmap'}),
            overlay:    ParamObj({obj:mOverlayVis, name: 'overlay'}),
            options:    makeVisOptionsParams(cfg.options),
            //dataPlot:   ParamObj({name:   'plot', obj:    mDataPlot}),
        }
        */
    } // function makeParams()

   
    //
    //
    //
    function makeVisOptionsParams(ocfg) {

        let oc = onChange;
        return ParamGroup({
            name: 'options',
            params: {
                visualComponent: ParamInt({obj:   ocfg,key: 'visualComponent',name: 'Component',min: 0, max: 5,onChange: oc}),
                interpolation:  ParamChoice({obj: ocfg,key: 'interpolation', name: 'Interpolation', choice: INTERP_NAMES,onChange: oc}),
                showChecker:    ParamBool({obj:   ocfg,key: 'showChecker', name: 'Checker', onChange: oc}),
                useMipmap:      ParamBool({obj:   ocfg,key: 'useMipmap',name:'Mipmap',onChange: oc}),
            }
        });
    } // function makeVisOptionsParams()
    
    function init(par){
        
        mGLCtx = par.glCtx;
        mOnChange = par.onChange;
        
        for(let i = 0; i < mVisLayers.length; i++){
            mVisLayers[i].visLayer.init(par);
        }
                               
        mParams = makeParams(mConfig);
       
    }
    
    function render(par){
        
        //if(DEBUG)console.log(`${MYNAME}.render()`, par);
        
        let dataBuffer = par.dataBuffer;
        let timeStamp = par.timeStamp;
        
        //if(mConfig.colormap.enabled) renderColormap(par);
        
        for(let i = 0; i < mVisLayers.length; i++){
            let visLayer = mVisLayers[i].visLayer;
            if(visLayer.enabled)visLayer.render(par);
        }
                   
    }

    //
    //
    //
    function getParams(){
        if(!mParams)
            mParams = makeParams(mConfig);
        return mParams;
        
    }
    //
    //  custom setParamsMap 
    //
    function setParamsMap(par, initialize){
        console.log(`${MYNAME}.setParamsMap()`, par);
        par = upgradeData(par);
        setParamValues(mParams, par, initialize);
    }


    function upgradeData(par){
        
        if(par.renderStyle)
            par = upgradeData_v1(par);
        return par;
    }
    
    function upgradeData_v1(par){
        
        let renderStyle = par.renderStyle;
        par.texmap  = par.texture;
        par.bumpmap = par.bump;
        par.colormap.enabled = false;
        par.bumpmap.enabled = false;
        par.texmap.enabled = false;
        
        // TODO - migrate visComponent 
        let dataSource = DataSourceNames[0];
        switch(par.options.visualComponent){
            default: break;
            case 0: dataSource = 'u'; break;
            case 1: dataSource = 'v'; break;
            case 4: dataSource = 'mod(uv)'; break;
            case 5: dataSource = 'arg(uv)'; break;
        }
            
        
        //par.colormap.visComponent
        
        if(par.overlayVis) {
            par.overlay = par.overlayVis;
        }
        if(!par.overlay) par.overlay = {};
        if(par.isolines) par.overlay.isolines = par.isolines;
        
        if(par.colormap.transparency)
            par.colormap.opacity = 1-par.colormap.transparency;
        let activePar = par.colormap;
        switch(renderStyle){
        case 'bumpmap':   activePar = par.bumpmap; break;
        case 'texture':   activePar = par.texmap;  break;
        case 'colormap':  activePar = par.colormap;break;
        }
        activePar.enabled = true;
        activePar.dataSource = dataSource;
        
        return par;
    }
    
    return {
        getParams:  getParams, 
        setParamsMap: setParamsMap,
        init:           init,
        render:         render,
    }
} // function renderVisColormap()

export {
    VisualizationManager
};