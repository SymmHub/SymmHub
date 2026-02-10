
import {
    ParamFloat,
    ParamInt,
    ParamFunc,
    EventDispatcher,
    AttPrograms,
} from './modules.js';

const MYNAME = 'ConradiAttractor';

const DEBUG = false;


const paramNames = ['a','b'];

function ConradiAttractor(){

    let mEventDispatcher = new EventDispatcher();

    //const pcount = 100000;
    const mConfig = {
        a: 3.69, 
        b: 4.51, 
        coloring: 0, 
    };
    
    let mParams;
    let myself = null;
        
    initialize();
    
    function initialize(){
        if(DEBUG) console.log(`${MYNAME}.initialize()`);
        mParams = makeParams(mConfig, onParamChanged);
    }
    
        
    function onRandomParams(){
       mConfig.a = 6*(2*Math.random()-1);
       mConfig.b = 6*(2*Math.random()-1);
       mParams.a.updateDisplay();
       mParams.b.updateDisplay();
       onParamChanged();
       
    }
        
    function makeParams(cfg, onc){
        let params = {
            a: ParamFloat({obj:cfg, key:'a', onChange: onc}),
            b: ParamFloat({obj:cfg, key:'b', onChange: onc}),
            random:     ParamFunc({func: onRandomParams, name: 'Random!'}),
        }
        return params;
    }
    
    function getUniforms(){
        let {a,b,coloring} = mConfig;        
        return {
            u_a: a,
            u_b: b,
            //u_coloring: coloring,
        };
    }
    function cpuIteratePoint(pnt0, pnt1){
        
        let {a,b} = mConfig;        
        let x = pnt0.x;
        let y = pnt0.y;     
        
        let x1 = Math.sin(x*x - y*y + a);
        let y1 = Math.cos(2.*x*y + b);
        
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
            if(mParams[pname]){
                mConfig[pname] = values[i];
                mParams[pname].updateDisplay();            
            }
        }        
        onParamChanged();
    }
    
    function getIteratorProgram(gl){
        return AttPrograms.getProgram(gl, 'iteratorConradi');
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
    ConradiAttractor
}