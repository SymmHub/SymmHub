
import {
    ParamFloat,
    ParamInt,
    ParamFunc,
    EventDispatcher,
    AttPrograms,
} from './modules.js';

const MYNAME = 'TinkerbellAttractor';

const DEBUG = false;


const paramNames = ['a','b', 'c', 'd'];

function TinkerbellAttractor(){

    let mEventDispatcher = new EventDispatcher();

    //const pcount = 100000;
    const mConfig = {
        a: 0.9, 
        b: -0.6013, 
        c: 2.,
        d: 0.5,
    };
    
    let mParams;
    let myself = null;
        
    initialize();
    
    function initialize(){
        if(DEBUG) console.log(`${MYNAME}.initialize()`);
        mParams = makeParams(mConfig, onParamChanged);
    }
    
        
    function onRandomParams(){
       mConfig.a = (2*Math.random()-1);
       mConfig.b = (2*Math.random()-1);
       mConfig.c = 2.+(2*Math.random()-1);
       mConfig.d = (2*Math.random()-1);
       mParams.a.updateDisplay();
       mParams.b.updateDisplay();
       mParams.c.updateDisplay();
       mParams.d.updateDisplay();
       onParamChanged();
       
    }
        
    function makeParams(cfg, onc){
        let params = {
            a: ParamFloat({obj:cfg, key:'a', onChange: onc}),
            b: ParamFloat({obj:cfg, key:'b', onChange: onc}),
            c: ParamFloat({obj:cfg, key:'c', onChange: onc}),
            d: ParamFloat({obj:cfg, key:'d', onChange: onc}),

            random:     ParamFunc({func: onRandomParams, name: 'Random!'}),
        }
        return params;
    }
    
    function getUniforms(){
        let {a,b,c,d} = mConfig;        
        return {
            u_a: a,
            u_b: b,
            u_c: c,
            u_d: d,
        };
    }
    function cpuIteratePoint(pnt0, pnt1){
        
        let {a,b, c, d } = mConfig;        
        let x = pnt0.x;
        let y = pnt0.y;     
        
        let x1 = x*x - y*y + a*x + b*y;
        let y1 = 2*x*y + c*x + d*y;
        
        pnt1.x = x1;
        pnt1.y = y1;
                
    }
        
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener( evtType, listener );      
    };
 
    function scheduleRepaint(){ 
        informListeners();
    }

    function informListeners(){

        mEventDispatcher.dispatchEvent({type: 'attractorChanged', target: myself});
      
    }

    function onParamChanged(){

        if(DEBUG)console.log(`${MYNAME}.onParamChanged()`);
        scheduleRepaint();
        
    }
 
    function setParamValues(values){        
        for(let i =0; i < values.length; i++){
            let pname = paramNames[i];            
            if(mParams[pname]) {
                mConfig[pname] = values[i];
                mParams[pname].updateDisplay(); 
            }
        }        
        onParamChanged();
    }
    
    function getIteratorProgram(gl){
        return AttPrograms.getProgram(gl, 'iteratorTinkerbell');
    }
    
    myself = {
        getParams:          ()=>mParams,
        getClassName:       ()=>MYNAME,
        addEventListener:   addEventListener,
        cpuIteratePoint:    cpuIteratePoint,
        getUniforms:        getUniforms,
        setParamValues:     setParamValues,
        getIteratorProgram: getIteratorProgram,
    }
    return myself;
}


export {
    TinkerbellAttractor
}