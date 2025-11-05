import {
    ParamGroup,
    ParamBool,
    ParamFloat, 
    ParamInt, 
    ParamColor, 
    ParamChoice,
    hexToPremult,
    SymRendererPrograms,
    enableBlending,
    setViewport,
    VisualizationOptions,
    getRulerStep,
} from './modules.js';


const MYNAME = 'VisualizationOverlay';
const DEBUG = false;

const INCREMENT = 1.e-10;
const gridTypeNames = VisualizationOptions.gridTypeNames;
const gridTypeValues = VisualizationOptions.gridTypeValues;
const DataSourceNames = VisualizationOptions.dataSourceNames;
const DataSourceValues = VisualizationOptions.dataSourceValues;

//
//  isoconf - isolines config , oc
//  oc - onChange function 
//
function makeIsolinesParams(cfg, oc) {

    let mi = -1000., ma = 1000., inc = INCREMENT;
    return ParamGroup({
        name: 'isolines',
        params: {
            enabled: ParamBool({obj:cfg, key: 'enabled', onChange: oc}),
            type:    ParamChoice({obj:cfg,key: 'dataSource', choice: DataSourceNames, onChange: oc}),
            step:    ParamFloat({obj:cfg, key: 'step',   onChange: oc}),
            offset:  ParamFloat({obj:cfg, key: 'offset', onChange: oc}),
            width:   ParamFloat({obj:cfg, key: 'width',   min:-1, max: 100, step: 0.1, onChange: oc}),
            levels:  ParamInt({obj:cfg, key: 'levels',  min:1, max: 6, onChange: oc}),
            color:   ParamColor({obj: cfg, key: 'color',  onChange: oc}),
        }
    });

} // function makeIsolinesParams()

function makeLimitsetParams(cfg, oc){
    return ParamGroup({
        name: 'limitset',
        params: {
            enabled: ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            color:   ParamColor({obj:cfg, key: 'color', onChange: oc}),
            width: ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
        }
    });
}


function makeScreenGridParams(cfg, oc){
    return ParamGroup({
        name: 'screen grid',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            step:       ParamFloat({obj: cfg, key: 'step', onChange: oc}),   
            stepAuto:   ParamBool({obj: cfg, key: 'stepAuto', onChange: oc}),   
            //levels:     ParamInt({obj: cfg, key: 'levels', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            
        }
    });
}

function makeWorldGridParams(cfg, oc){
    return ParamGroup({
        name: 'world grid',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            type:       ParamChoice({obj: cfg,key: 'type', choice: gridTypeNames, onChange: oc}),
            stepx:      ParamFloat({obj: cfg, key: 'stepx', onChange: oc}),   
            stepy:      ParamFloat({obj: cfg, key: 'stepy', onChange: oc}),   
            offsetx:    ParamFloat({obj: cfg, key: 'offsetx', onChange: oc}),   
            offsety:    ParamFloat({obj: cfg, key: 'offsety', onChange: oc}),   
            levels:     ParamInt({obj: cfg, key: 'levels', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            
        }
    });
}

function makeRulerParams(cfg, oc){
    return ParamGroup({
        name: 'ruler',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            //step:       ParamFloat({obj: cfg, key: 'step', onChange: oc}),   
            //levels:     ParamInt({obj: cfg, key: 'levels', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),
            background: ParamColor({obj:cfg, key: 'background', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            
        }
    });
}

function makeShadowsParams(cfg, oc){
    return ParamGroup({
       name: 'shadow',
        params: {
            enabled: ParamBool({obj: cfg, key: 'enabled', onChange: oc}),               
            color:   ParamColor({obj:cfg, key: 'color', onChange: oc}),
            width:   ParamFloat({obj:cfg, key: 'width', onChange: oc}),
        }
    });
};

function makeGeneratorsParams(cfg, oc){
    return ParamGroup({
        name: 'generators',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
            shadow:     makeShadowsParams(cfg.shadows, oc)
            
        }
    });
}

function makeFundDomainFillParams(cfg, oc){
    return ParamGroup({
        name: 'fill',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
        }
    });
}

function makeFundDomainOutlineParams(cfg, oc){
    return ParamGroup({
        name: 'outline',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
            shadowsWidth:      ParamFloat({obj: cfg, key: 'shadowsWidth', onChange: oc}),   
            shadowsColor:      ParamColor({obj:cfg, key: 'shadowsColor', onChange: oc}),            
        }
    });
}

function makeFundDomainParams(cfg, oc){
    return ParamGroup({
        name: 'fundDomain',
        params: {
            fill:       makeFundDomainFillParams(cfg.fill, oc),
            outline:    makeFundDomainOutlineParams(cfg.outline, oc),
            
        }
    });
}

function makeBufferFillParams(cfg, oc){
    return ParamGroup({
        name: 'fill',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
        }
    });
}

function makeBufferOutlineParams(cfg, oc){
    return ParamGroup({
        name: 'outline',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
        }
    });
}

function makeBufferParams(cfg, oc){
    return ParamGroup({
        name: 'buffer',
        params: {
            fill:       makeBufferFillParams(cfg.fill, oc),
            outline:    makeBufferOutlineParams(cfg.outline, oc),            
        }
    });
}

function makeTilingFillParams(cfg, oc){
    return ParamGroup({
        name: 'fill',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
        }
    });
}

function makeTilingOutlineParams(cfg, oc){
    return ParamGroup({
        name: 'outline',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            width:      ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),            
        }
    });
}
function makeTilingParams(cfg, oc){
    return ParamGroup({
        name: 'tiling',
        params: {
            fill:       makeTilingFillParams(cfg.fill, oc),            
            outline:    makeTilingOutlineParams(cfg.outline, oc),
        }
    });
}

//
//
// 
export function makeOverlayParams(oconfig, onchange){
    
    let cf = oconfig;
    let oc = onchange;
    return {
        enabled:    ParamBool({obj:cf, key:'enabled', onChange:oc}),
        opacity:    ParamFloat({obj:cf, key:'opacity', min:0, max:1,onChange:oc}),
        fundDomain: makeFundDomainParams(cf.fundDomain, oc),
        buffer:     makeBufferParams(cf.buffer, oc),        
        isolines:   makeIsolinesParams(cf.isolines, oc),
        tiling:     makeTilingParams(cf.tiling, oc),
        limitset:   makeLimitsetParams(cf.limitset, oc),
        generators: makeGeneratorsParams(cf.generators, oc),
        worldGrid:  makeWorldGridParams(cf.grid.worldGrid, oc),
        screenGrid: makeScreenGridParams(cf.grid.screenGrid, oc),
        ruler:      makeRulerParams(cf.ruler, oc),
    };
    
} 


export function makeOverlayConfig() {

    return {
        enabled: true,
        opacity: 1,
        isolines: {
            enabled: false,
            dataSource: DataSourceNames[0],
            step: 0.1,
            offset: 0.,
            width: 1,
            levels: 1,
            color: '#000000ff',
        },
        limitset: {
            enabled: false,
            color: '#000000ff',
            width: 1,
        },
        grid: {
            worldGrid: {
                enabled: false,
                type:  gridTypeNames[0],
                color: '#000000ff',
                width: 1,
                levels: 1,            
                stepx: 0.1,
                stepy: 0.1,
                offsetx: 0,
                offsety: 0,                
            },            
            screenGrid: {
                enabled: false,
                stepAuto: true, 
                color: '#000000ff',
                width: 1,
                levels: 1,
                step: 0.1,
            },
        },
        ruler: {
            enabled: false,
            color: '#000000ff',
            background: '#AAAAAAAA',
            width: 20,
        },
        generators: {
            enabled: false,
            width: 2,
            color: '#0000AAAA',
            shadows: {
                enabled: true,
                width: 10,
                color: '#0000AA55',
            }
        },
        fundDomain: {
            fill: {
                enabled: false,
                color: '#FF0000AA',
            },
            outline: {
                enabled: false,
                width: 1,
                color: '#000000AA',
                shadowsWidth: 10,
                shadowsColor: '#0000FFAA',                
            }
        },
        buffer: { // visualization of simulation buffer shape
            fill: {
                enabled: false,
                color: '#00FF0022',
            },
            outline: {
                enabled: false, 
                width: 1,
                color: '#00AA00AA',
            }
        },
        tiling: {
            fill: {
                enabled: false,
                color: '#FFFF0055',
            },
            outline: {
                enabled: false,
                width: 1,
                color: '#000000FF',
            }
        },

    };
} // function makeOverlayConfig()


function getOverlayUniforms(cfg, renderParam, myParams){
    
    let iconf = cfg.isolines;
    let lsConf = cfg.limitset;
    let genConf = cfg.generators;
    let tilConf = cfg.tiling;
    let worldGridCfg = cfg.grid.worldGrid;
    let fdCfg = cfg.fundDomain;
    let bufCfg = cfg.buffer;
    
    let overUni = {
        uTransparency: (1.0 - cfg.opacity),
        // isolines 
        uIsoEnabled:    iconf.enabled,
        uIsoDataSource: DataSourceValues[iconf.dataSource],
        uIsoColor:      hexToPremult(iconf.color),
        uIsoStep:       iconf.step,
        uIsoOffset:     iconf.offset,
        uIsoThickness:  iconf.width,
        uIsoLevels:     iconf.levels,        
    
        // limitset 
        uLsEnabled:     lsConf.enabled,
        uLsThickness:   lsConf.width,
        uLsColor:       hexToPremult(lsConf.color),
        
        // generators 
        uGensEnabled:       genConf.enabled,
        uGensWidth:         genConf.width,
        uGensColor:         hexToPremult(genConf.color),
        uGensShadowsEnabled:genConf.shadows.enabled,
        uGensShadowsColor:  hexToPremult(genConf.shadows.color),
        uGensShadowsWidth:  genConf.shadows.width,
        
        //tiling
        uTilingEnabled:       tilConf.outline.enabled,
        uTilingWidth:         tilConf.outline.width,
        uTilingColor:         hexToPremult(tilConf.outline.color),
        
        // world grid parameters 
        uWorldGridEnabled:       worldGridCfg.enabled, 
        uWorldGridType:          gridTypeValues[worldGridCfg.type], 
        uWorldGridColor:         hexToPremult(worldGridCfg.color),
        uWorldGridStep:          [worldGridCfg.stepx,worldGridCfg.stepy],
        uWorldGridOffset:        [worldGridCfg.offsetx,worldGridCfg.offsety],
        uWorldGridLevels:        worldGridCfg.levels,
        uWorldGridWidth:         worldGridCfg.width,
        
        // fundamental domain params 
        
        uFDfillEnabled:     fdCfg.fill.enabled,
        uFDfillColor:       hexToPremult(fdCfg.fill.color),
        uFDoutlineEnabled:  fdCfg.outline.enabled,
        uFDoutlineWidth:    fdCfg.outline.width,
        uFDoutlineColor:    hexToPremult(fdCfg.outline.color),
        uFDoutlineShadowsWidth: fdCfg.outline.shadowsWidth,
        uFDoutlineShadowsColor: hexToPremult(fdCfg.outline.shadowsColor),
        
        // buffer shape params 
        uBufFillEnabled: bufCfg.fill.enabled,        
        uBufOutlineEnabled: bufCfg.outline.enabled,                
        uBufFillColor: hexToPremult(bufCfg.fill.color),
        uBufOutlineColor: hexToPremult(bufCfg.outline.color),
        uBufOutlineWidth: bufCfg.outline.width,                
                            
    }; // overUni 
        
    Object.assign(overUni, getScreenGridUni(cfg.grid.screenGrid,renderParam, myParams));
    
    return overUni;
    
}

function getScreenGridUni(screenGridCfg, renderParam, myParams){

    //if(DEBUG)console.log(`${MYNAME}.getScreenGridUni() renderParam: `,renderParam);
    if(screenGridCfg.stepAuto){
        let ctrans = renderParam.navigator.canvasTransform;
        let pixelSize = ctrans.getPixelSize();
        if(DEBUG)console.log(`${MYNAME}.getScreenGridUni() pixelSize: `,pixelSize);

        let step = getRulerStep(pixelSize);
        if(DEBUG)console.log(`${MYNAME}.getScreenGridUni() step: `,step);
        
        if(step != screenGridCfg.step){
            screenGridCfg.step = step;
            myParams.screenGrid.step.updateDisplay();
            
        }
    }    
    let scUni = {
     
        // screen grid parameters 
        uScreenGridEnabled:       screenGridCfg.enabled, 
        uScreenGridColor:         hexToPremult(screenGridCfg.color),
        uScreenGridStep:          [screenGridCfg.step,screenGridCfg.step],
        uScreenGridLevels:        screenGridCfg.levels,
        uScreenGridWidth:         screenGridCfg.width,
    };
    return scUni;
};


export function VisualizationOverlay(){
    
    let mConfig = makeOverlayConfig();
    let mParams = makeOverlayParams(mConfig, onChange);
    let mOnChange = null;
    let mPrograms = null;
    let mGLCtx = null;
    
    function onChange(obj){
       if(DEBUG)console.log(`${MYNAME}.onChange()`, obj);
       if(mOnChange){
            mOnChange(obj);
       }
    }
    
    function init(par){

        mGLCtx = par.glCtx;
        mPrograms = SymRendererPrograms();
        mOnChange = par.onChange;

    }
    
    function getUniforms(par){
        
        return getOverlayUniforms(mConfig, par, mParams);
        
    }
    
    function render(par) {
        
        //if(DEBUG)console.log(`${MYNAME}.render()`,par);
        const {
            renderTarget,
            canvas, 
            navigatorUni,
            renderUni,
        } = par;

        let overUni = getUniforms(par);              

        let gl = mGLCtx.gl;

        enableBlending(gl);                     

        let prog = mPrograms.getProgram('overlay');
        prog.bind();
        
        prog.setUniforms(navigatorUni);
        prog.setUniforms(renderUni);

        prog.setUniforms(overUni);

        setViewport(gl,par.canvas);
        
        prog.blit(renderTarget);
        
    }
    
    
    let myself = {
        //getConfig: (() => mConfig),
        getParams: (() => mParams),
        //getUniforms: getUniforms,
        init:       init,
        render:     render,
        get enabled(){return mConfig.enabled;},
    }    
    
    return myself;
}