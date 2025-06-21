import {
    ParamGroup,
    ParamBool,
    ParamFloat, 
    ParamInt, 
    ParamColor, 
    hexToPremult,
} from './modules.js';


const MYNAME = 'GLOverlayRenderer';
const DEBUG = true;

const INCREMENT = 1.e-10;

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


function makeGridParams(cfg, oc){
    return ParamGroup({
        name: 'grid',
        params: {
            enabled:    ParamBool({obj: cfg,key: 'enabled', onChange: oc}),
            step:       ParamFloat({obj: cfg, key: 'step', onChange: oc}),   
            levels:     ParamInt({obj: cfg, key: 'levels', onChange: oc}),   
            color:      ParamColor({obj:cfg, key: 'color', onChange: oc}),
            width:  ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
            
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
            width:  ParamFloat({obj: cfg, key: 'width', onChange: oc}),   
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
    return ParamGroup({
        name: 'overlay',
        params: {
            isolines:   makeIsolinesParams(cf.isolines, oc),
            limitset:   makeLimitsetParams(cf.limitset, oc),
            grid:       makeGridParams(cf.grid, oc),
            ruler:      makeRulerParams(cf.ruler, oc),
            generators: makeGeneratorsParams(cf.generators, oc),
            fundDomain: makeFundDomainParams(cf.fundDomain, oc),
            tiling:     makeTilingParams(cf.tiling, oc),
        }
    });
    
}


export function makeOverlayConfig() {

    return {
        enabled: true,
        isolines: {
            enabled: false,
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
            enabled: false,
            color: '#000000ff',
            width: 1,
            levels: 1,
            step: 1,
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
            },
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


function getOverlayUniforms(cfg){
    
    let iconf = cfg.isolines;
    let lsConf = cfg.limitset;
    let genConf = cfg.generators;
    
    
    let overUni = {
        // isolines 
        uIsoEnabled:    iconf.enabled,
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
            
    };
    
    return overUni;
    
}

export function GLOverlayRenderer(){
    
    let mConfig = makeOverlayConfig();
    let mParams = makeOverlayParams(mConfig, onChange);
    let onChangeCallback = null;
    
    function onChange(obj){
       //if(DEBUG)console.log(`${MYNAME}.onChange()`, obj);
       if(onChangeCallback){
            //if(DEBUG)console.log(`${MYNAME}.onChange() calling: `, onChangeCallback);
            onChangeCallback(myself);
       }
    }
    
    function setOptions(opt){
        if(opt.onChanged){
            onChangeCallback = opt.onChanged;
        }
    }
    
    let myself = {
        getConfig: (() => mConfig),
        getParams: (() => mParams),
        setOptions: setOptions,
        getUniforms: (() => getOverlayUniforms(mConfig)),
    }    
    
    return myself;
}