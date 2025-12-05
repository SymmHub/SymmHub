
import {
    ParamFloat,
    ParamInt,
    ParamFunc,
    EventDispatcher,
} from './modules.js';

const MYNAME = 'CliffordAttractor';

const DEBUG = true;

function CliffordAttractor(){

    let mEventDispatcher = new EventDispatcher();

    //const pcount = 100000;
    const mConfig = {
        a:-1.85, 
        b: -2.5, 
        c:-1.05, 
        d:0.585,
    };
    
    //let p = {a:-1.85, b: -2.5, c:-1.05, d:0.585};
    //let p = { a: -1.4, b: -1.3, c: -1.8, d: -1.9 };
    //let p = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };
    //let p = { a: 1.7, b: 1.7, c: 0.6, d: 1.2 };
    //let p = { a: 1.7, b: 0.7, c: 1.4, d: 2.0 };
    let mParams;
    let myself = null;
    
    
    initialize();
    
    function initialize(){
        if(DEBUG) console.log(`${MYNAME}.initialize()`);
        //cpuInitArrays();
        //console.log('mIterationsArray: ', mIterationsArray);
        mParams = makeParams(mConfig, onParamChanged);
    }
    
        
    function onRandomParams(){
       mConfig.a = 3*(2*Math.random()-1);
       mConfig.b = 3*(2*Math.random()-1);
       mConfig.c = 3*(2*Math.random()-1);
       mConfig.d = 3*(2*Math.random()-1);
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
        
        let {a,b,c,d} = mConfig;        
        let x = pnt0.x;
        let y = pnt0.y;        
        let x1 = Math.sin(a * y) + c * Math.cos(a * x);
        let y1 = Math.sin(b * x) + d * Math.cos(b * y);
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
 
    
    myself = {
        getParams:          ()=>mParams,
        getClassName:       ()=>{return MYNAME+'-class';},
        addEventListener:   addEventListener,
        cpuIteratePoint:    cpuIteratePoint,
        getUniforms:        getUniforms,
    }
    return myself;
}


export {
    CliffordAttractor
}