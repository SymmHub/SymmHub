import {

    ParamFloat,
    ParamGroup,
    ParamBool, 
    ParamFunc, 
} from './modules.js';

const PI = Math.PI;
const MYNAME = 'ParamsAnimator';
const DEBUG = true;
const initialOffsets = [-1.85, -2.5, -1.05, 0.585, 0.5];

const CODE_a = 'a'.charCodeAt(0);
const CODE_A = 'A'.charCodeAt(0);

export function ParamsAnimator(arg){

    
    let mParams;
    
    let mConfig = {
        isModified: true,
        count:      4,
        enabled:    false,
        period:     10., // animation period in seconds 
        fraction:   0,  // current fraction of period 
        
        values: [
        ],
        
    };
    
    init(arg);
    
    function init(arg = {}){
    
        console.log(`${MYNAME}.init() `, arg);
        mConfig.onChange = (arg.onChange)? arg.onChange: null;
       
        mConfig.count = (arg.count)? arg.count: 4;
        mConfig.values = initValues(mConfig.count);
        mConfig.paramSource = arg.paramSource;
        mParams = makeParams(mConfig);       
    }
    
    function setParamSource(paramSource){
        mConfig.paramSource = paramSource;
    }

    function initValues(count){
    
        let values = [];
        
        for(let i = 0; i < count; i++){
        
            values[i] = {
                offset: initialOffsets[i], 
                freq: 1,
                phase: 0,
                amplitude: 0, 
                
            }
        }
        return values;
    }
        
    function makeParams(config){
        let onc = onParamChanged;
        let params = {
            enabled:    ParamBool({obj: config, key: 'enabled', onChange: onc}),
            period:     ParamFloat({obj: config, key: 'period', onChange: onc}), 
            fraction:   ParamFloat({obj: config, key: 'fraction', onChange: onc}), 
            copyOffsets: ParamFunc({func: onCopyOffsets, name:'copy offsets'}), 
            //values: {},
        };
        
        if(DEBUG)console.log(`${MYNAME} paramsCount: `, config.count); 
        let pargroup = {                               
        };
        for(let i=0; i < config.count; i++){        
            let groupName = String.fromCharCode(CODE_A + i);
            if(DEBUG)console.log(`${MYNAME} groupName:  `, groupName); 
            pargroup[groupName] = makeValueParams(groupName, config.values[i], onc);
        }

        params.params = ParamGroup({name:'animParams', params:pargroup}) 
        return params;
    }
  
    function onCopyOffsets(){
        
        console.log(`${MYNAME}.onCopyOffsets() `, mConfig);
        const {paramSource} = mConfig;
        console.log(`${MYNAME} paramSource: `, paramSource);
        const params = paramSource.getParams();
        const {count} = mConfig;
        for(let i = 0; i < count; i++){
            let pkey = String.fromCharCode(CODE_a+i);
            if(params[pkey]){
                let value = params[pkey].getValue();
                let gkey = String.fromCharCode(CODE_A+i);
                console.log(`${MYNAME}  ${pkey}: ${value}`);
                let valuesGroup = mParams.params[gkey];
                mConfig.values[i]['offset'] = value;
                valuesGroup['offset'].updateDisplay();
                console.log(`${MYNAME}  ${gkey}:`,valuesGroup);
            }
        }            
    }
  
    function makeValueParams(name, value, onchange){
    
        return ParamGroup({
            name: name,
            params: {
                offset:     ParamFloat({obj: value, key: 'offset', onChange:onchange}),
                amplitude:  ParamFloat({obj: value, key: 'amplitude',onChange:onchange}),
                freq:       ParamFloat({obj: value, key: 'freq',onChange:onchange}),
                phase:      ParamFloat({obj: value, key: 'phase',onChange:onchange}),
            }
        });        
    }

    function onParamChanged(){
       mConfig.isModified = true;
       if(mConfig.onChange) mConfig.onChange();
    }

    function setTime(time){
    
        const t = time;
        const config = mConfig;
        let fraction = (time/config.period) % 1.;
        config.fraction = fraction;
        mConfig.isModified = true;
        mParams.fraction.updateDisplay();
    }

    //
    // calculate and return array of values of this animator 
    // 
    function getValues(){

        let config = mConfig;
        if(!config.isModified) return config.lastValues;
        
        let values = [];
        
        let t = config.fraction;//* config.period;
        
        for(let i = 0; i < config.count; i++){
            let v = config.values[i];
            values[i] = v.offset + v.amplitude * Math.sin(2*PI*(t*v.freq + v.phase));
        }
        config.isModified = false;
        config.lastValues = values;
        return values;            
    }
    
    function getParams(){
        return mParams;
    }
    
    const myself = {
        init:           init,
        setParamSource: setParamSource,
        getParams:      getParams,
        setTime:        setTime, 
        getValues:      getValues, 
        get enabled()   {return mConfig.enabled}, 
        get isModified() {return mConfig.isModified},
        getName:        () => MYNAME,
    };

    return myself;
    
}