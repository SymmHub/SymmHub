
import {
    ParamFloat,
    ParamInt,
    ParamFunc,
    EventDispatcher,
    AttPrograms,
    cLog, 
    cExp,
    cPow, 
    cMul, 
    cAdd,
    cAbs2, 
    conj,
    mul,
} from './modules.js';

const MYNAME = 'FieldIconsAttractor';

const DEBUG = false;


const paramNames = ['a','b'];

function FieldIconsAttractor(){

    let mEventDispatcher = new EventDispatcher();

    //const pcount = 100000;
    const mConfig = {
        n: 3,
        a: 1.336, 
        b: -0.832, 
        c: 1.105,
        d: 0.596,
        e: 0.367,
    };
    
    let mParams;
    let myself = null;
        
    initialize();
    
    function initialize(){
        if(DEBUG) console.log(`${MYNAME}.initialize()`);
        mParams = makeParams(mConfig, onParamChanged);
    }
    
        
    function onRandomParams(){
       mConfig.a = 3*(2*Math.random()-1);
       mConfig.b = -mConfig.a + 0.5*(2*Math.random()-1);
       mConfig.c = 0.5*(2*Math.random()-1);
       mConfig.d = 2*(2*Math.random()-1);
       mConfig.e = 1*(2*Math.random()-1);
       
       mParams.a.updateDisplay();
       mParams.b.updateDisplay();
       mParams.c.updateDisplay();
       mParams.d.updateDisplay();
       mParams.e.updateDisplay();
       onParamChanged();
       
    }
        
    function makeParams(cfg, onc){
        let params = {
            n: ParamInt({obj:cfg, key:'n', onChange: onc}),
            a: ParamFloat({obj:cfg, key:'a', onChange: onc}),
            b: ParamFloat({obj:cfg, key:'b', onChange: onc}),
            c: ParamFloat({obj:cfg, key:'c', onChange: onc}),
            d: ParamFloat({obj:cfg, key:'d', onChange: onc}),
            e: ParamFloat({obj:cfg, key:'e', onChange: onc}),

            random:     ParamFunc({func: onRandomParams, name: 'Random!'}),
        }
        return params;
    }
    
    function getUniforms(){
        let {n, a, b, c, d, e} = mConfig;        
        return {
            u_a: a,
            u_b: b,
            u_c: c,
            u_d: d,
            u_e: e,
            u_n: n,
        };
    }
    
    
    function cpuIteratePoint(pnt0, pnt1){
        
        let {a,b,c,d,e,n} = mConfig;        
        let x = pnt0.x;
        let y = pnt0.y;     
        // z = (a + b*z*conj(z) + c*re(z^n) + d * i )*z + e*conj(z^(n-1))
        let z = [x,y];
        let zn = cPow(z, n);
        let zn1 = cPow(z, n-1);
        
        let z1 = [a + b*cAbs2(z) + c*zn[0],d];        
        let z4 = cMul(z1, z);        
        let e_zn1 = mul(conj(zn1), e);
        let zz = cAdd(z4, e_zn1);
        
        let x1 = zz[0];
        let y1 = zz[1];
        
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
            mConfig[pname] = values[i];
            mParams[pname].updateDisplay();            
        }        
        onParamChanged();
    }
    
    function getIteratorProgram(gl){
        return AttPrograms.getProgram(gl, 'iteratorFieldIcons');
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
    FieldIconsAttractor
}