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
    SymRendererPrograms,

    VisualizationOverlay,
    VisualizationColormap,
    VisualizationBumpmap,
    VisualizationTexmap,
    
} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationManager';


const INCREMENT = 1.e-12;
const INTERP_LINEAR = 'linear';
const INTERP_QUADRATIC = 'biquadratic';
const INTERP_NAMES = [
    INTERP_LINEAR,
    INTERP_QUADRATIC
];


function VisualizationManager(){
    
    let mParams = null;
    let mGLCtx = null;
    //let mGLOverlayRenderer = null;
    
    let mTextureMaker = null;
    let mPrograms = null;
    let mOnChange = null;
    
    let mColormapVis = VisualizationColormap();
    let mBumpmapVis = VisualizationBumpmap();
    let mTexmapVis = VisualizationTexmap();
    let mOverlayVis = VisualizationOverlay();
    
    let mConfig = {

        visualComponent: 0,
        /*
        colormap: {
            enabled: true,
            opacity: 1,
            colormap: Colormaps.getNames()[0],
            minValue: 0.0,
            maxValue: 1.0,
            cmWrap: Colormaps.wrapNames[0],
            cmBanding: 0.5,
        },
        
        bumpmap: {

            enabled: false,
            opacity: 1,
            bumpHeight: 0.01,
            minValue: -1,
            maxValue: 1,
            bumpSmooth: 0.1,
            delta: 0.001,
        }, 
        */
        texmap: {
            enabled: false,
            opacity: 1,  
            texture: mTextureMaker,
            transform: {
                scale: 1,
                angle: 0,
                texCenterX: 0,
                texCenterY: 0,
                uvOriginX: 0,
                uvOriginY: 0,
            }
        },
                
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

        let oc = onChange;

        return ParamGroup({
            name: 'visualization 2',
            params: {
                colormap:   ParamObj({obj: mColormapVis, name:'colormap'}),
                texmap:     ParamObj({obj: mTexmapVis, name: 'texmap'}),
                //texmap:     makeTexmapParams(cfg.texmap),
                bumpmap:    ParamObj({obj: mBumpmapVis, name: 'bumpmap'}),
                overlay:    ParamObj({obj:mOverlayVis, name: 'overlay'}),
                options:    makeVisOptionsParams(cfg.options),
                //dataPlot:   ParamObj({name:   'plot', obj:    mDataPlot}),
            }
        });
    } // function makeVisParams()

   
    //
    //
    //
    /*
    function makeBumpParams(cf) {

        let oc = onChange;
        const inc = INCREMENT;
        return ParamGroup({
            name: 'bumpmap',
            params: {
                enabled: ParamBool({obj: cf, key:'enabled', onChange: oc}),
                opacity: ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
                bumpHeight: ParamFloat({obj:cf, key: 'bumpHeight',  min: -0.5, max: 0.5, onChange: oc}),
                minValue:   ParamFloat({obj:cf, key: 'minValue',    min: -5,max: 5,step: inc,onChange: oc}),
                maxValue:   ParamFloat({obj:cf, key: 'maxValue',    min: -5,max: 5,step: inc,onChange: oc}),
                bumpSmooth: ParamFloat({obj:cf, key: 'bumpSmooth',  min: -5,max: 5,step: inc,onChange: oc}),
                delta:      ParamFloat({obj:cf, key: 'delta',       min: 0,max: 0.5,step: inc,onChange: oc}),
            }
        });
    } //function makeBumpParams(){
    */

    //
    //
    //
    /*
    function makeTexmapParams(tmc) {

        let oc = onChange;

        return ParamGroup({
            name: 'texmap',
            params: {
                enabled:    ParamBool({obj: tmc, key: 'enabled', onChange: oc}),
                opacity:    ParamFloat({obj: tmc, key: 'opacity'}),
                texture:    ParamObj({name: 'texture', obj: mTextureMaker }),
                transform:  makeTexTransformParams(tmc.transform),
                },
            });

    } // function makeTexVisParams()
    
    function makeTexTransformParams(ttcfg){
        let tt = ttcfg;
        let oc = onChange;        
        return ParamGroup({name: 'transform',
                          params: {
                                scale: ParamFloat({obj: tt, key: 'scale', min: -10, max: 10, step: 0.00001, onChange: oc}),
                                angle: ParamFloat({obj: tt, key: 'angle', min: -360,max: 360,step: 0.00001, onChange: oc}),
                                texCenterX: ParamFloat({obj: tt,key: 'texCenterX', min: -1, max: 1,step: 0.00001,onChange: oc}),
                                texCenterY: ParamFloat({obj: tt,key: 'texCenterY', min: -1, max: 1,step: 0.00001,onChange: oc}),
                                uvOriginX: ParamFloat({obj: tt, key: 'uvOriginX', min: -1, max: 1, step: 0.00001,onChange: oc}),
                                uvOriginY: ParamFloat({obj: tt, key: 'uvOriginY', min: -1, max: 1,step: 0.00001, onChange: oc}),
                            }
        });        
    }
    */
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
        mTextureMaker = new TextureFile({
            texInfo: Textures.t1.concat(Textures.t2).concat(Textures.experimental),
            gl: mGLCtx.gl,
            onChanged: onTextureChanged
        });
        
        mOnChange = par.onChange;
        
        mPrograms = SymRendererPrograms();
        mColormapVis.init(par);
        mBumpmapVis.init(par);
        mTexmapVis.init(par);
        mOverlayVis.init(par);
        //
        //mPrograms.init(mGLCtx.gl);
        
        //mGLOverlayRenderer = VisualizationOverlay();
        //mGLOverlayRenderer.init({onChanged: onChange});
                
                
        mParams = makeParams(mConfig);
       
    }
    
    function render(par){
        
        //if(DEBUG)console.log(`${MYNAME}.render()`, par);
        
        let dataBuffer = par.dataBuffer;
        let timeStamp = par.timeStamp;
        
        //if(mConfig.colormap.enabled) renderColormap(par);
        
        if(mColormapVis.enabled) mColormapVis.render(par);
        if(mTexmapVis.enabled) mTexmapVis.render(par);
        if(mBumpmapVis.enabled) mBumpmapVis.render(par);
        if(mOverlayVis.enabled) mOverlayVis.render(par);
        
        //if(true) renderGLOverlay(par);
            
    }
    /*
    function renderGLOverlay(par) {
        
        let gl = mGLCtx.gl;
        enableBlending(gl);                     
        let prog = mPrograms.getProgram('overlay');
        prog.bind();
        
        prog.setUniforms(par.navigatorUni);
        prog.setUniforms(par.renderUni);

        let overUni = mGLOverlayRenderer.getUniforms();              
        prog.setUniforms(overUni);

        setViewport(gl,par.canvas);
        
        prog.blit(null);
        
    }
    */
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
    }
} // function renderVisColormap()

export {
    VisualizationManager
};