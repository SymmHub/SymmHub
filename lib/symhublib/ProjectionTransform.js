import {
    ParamChoice,
    ParamGroup, 
    ParamFloat, 
    ParamInt,
    ParamBool,
    ParamObj,
    dot,
    cross,
    mul,
    add,
    cDiv,
    PI,
    FixedPointsTransform,
} from './modules.js';

/*
export const PROJECTION_NAMES = [
    'circle',
    'log',
    'band',
    'uhp',
    'exp',
    'sphere',
];
*/
const MYNAME = 'ProjectionTransform';


const INCREMENT = 1.e-12;

const DEBUG = false;

//
//
//
export function ProjectionTransform(options){

    if(DEBUG)console.log(`${MYNAME} ProjectionTransform() options: `, options); 

    let mGroupMaker = null;      
    let onChange = null;
    
    if(options.onChange) onChange = options.onChange;
    if(options.groupMaker) mGroupMaker = options.groupMaker;
    
    
    if(options.groupMaker) setGroupMaker(options.groupMaker);
    
    let mConfig = {
        enabled: true,
        //projection: PROJECTION_NAMES[0],
        scaleMap: {
            enabled: false,
            a1x: 1,
            a1y: 0,
            a2x: 0,
            a2y: 1,
            n1:  10,
            n2:  0,
            shift1: 0., 
            shift2: 0.,
        },
        rationalMap: {
            enabled: false,
            x1:  1,  y1: 0,  n1:  1,
            x2:  0,  y2: 1,  n2: -1,
            x3: -1,  y3: 0,  n3:  1,
            x4:  0,  y4:-1,  n4: -1,
        },  
        bandMap: {
            enabled: false,
            fraction: 1,
        },
        periodicMap:  {
            enabled: false,
            a1x: 1,
            a1y: 0,
            a2x: 0,
            a2y: 1,
            cx:  0., 
            cy:  0.,            
        },
        expMap: { 
            enabled: false, 
        },
        uhpMap: {
            enabled: false,
        },
        fpMap:   {
            enabled: false,
        },
        loxMap:   {
            enabled: false,
        },
        logMap:   {
            enabled: false,
        },
        sphereMap:   {
            enabled: false,
        },
        
    };
    
    
    let mFixedPointsTransform = new FixedPointsTransform({groupMaker: {getGroup: getGroup}, onChange: onChange});
    
    let onc = onParamChanged;
    
    //  [SYM, FIX_POINT, BAND, PWRAP, SCALE, EXP, UHP, RAT, MOBIUS]
    
    let mParams = {
        
        enabled:        ParamBool({obj:mConfig,key: 'enabled', onChange: onc}),
        fpdMap:         makeFpMapParams(),
        bandMap:        makeBandMapParams(),
        logMap:         makeLogMapParams(),
        periodicMap:    makePeriodicMapParams(),
        scaleMap:       makeScaleMapParams(),
        expMap:         makeExpMapParams(),
        loxMap:         makeLoxMapParams(),
        uhpMap:         makeUhpMapParams(),
        rationalMap:    makeRationalMapParams(),

    }

    
    function onParamChanged(){
        //if(DEBUG)console.log(`${MYNAME}.onParamChanged() mConfig.bandMap.enabled: `, mConfig.bandMap.enabled);
        if(onChange) onChange();
    }

    function makeLoxMapParams(){
        
        let obj = mConfig.loxMap;
        let onc = onParamChanged;
        return ParamGroup ({
            name: 'loxodromic',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled', onChange: onc}),
            }
        });
    }
    
    function makeLogMapParams(){
        
        let obj = mConfig.logMap;
        let onc = onParamChanged;
        return ParamGroup ({
            name: 'logarithm',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled', onChange: onc}),
            }
        });
    }

    //
    //
    //
    function makeBandMapParams(){
        
        let obj = mConfig.bandMap;
        let onc = onParamChanged;
        return ParamGroup({
            name: 'band',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled',onChange: onc}),
                fraction: ParamFloat({obj:obj, key:'fraction', onChange:onc}),
            }
        });
    }
    
    //
    //
    //
    function makeUhpMapParams(){
        
        let obj = mConfig.uhpMap;
        let onc = onParamChanged;
        return ParamGroup({
            name: 'upper half plane',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled',onChange: onc}),
            }
        });
    }

    //
    //
    //
    function makeFpMapParams(){
        
        let obj = mConfig.fpMap;
        let onc = onParamChanged;
        
        if(mFixedPointsTransform)
            return new ParamObj({name:'fixed points', obj: mFixedPointsTransform})        
        else 
            return ParamGroup({name: 'fixed points'});
        //return ParamGroup({
        //    name: 'fixed points',
        //    params: {
        //        enabled: ParamBool({obj:obj,key: 'enabled',onChange: onc}),
        //    }
        //});
    }

    //
    //
    //
    function makeExpMapParams(){
        
        let obj = mConfig.expMap;
        let onc = onParamChanged;
        return ParamGroup({
            name: 'exponent',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled',onChange: onc}),
            }
        });
    }

    //
    //
    //
    function makeLogMapParams(){
        
        let obj = mConfig.logMap;
        let onc = onParamChanged;
        return ParamGroup({
            name: 'logarithm',
            params: {
                enabled: ParamBool({obj:obj,key: 'enabled',onChange: onc}),
            }
        });
    }

    //
    //
    //
    function makeScaleMapParams(){

        let es = mConfig.scaleMap;
        let onc = onParamChanged;
        let mi = -100;
        let ma = 100;
        let inc = INCREMENT;
        return ParamGroup({
            name: 'scale',
            params: {
            enabled:ParamBool({obj: es, key: 'enabled', onChange: onc}),
            a1x:    ParamFloat({obj:es, key:'a1x', min:mi, max:ma,step:inc, onChange: onc}),
            a1y:    ParamFloat({obj:es, key:'a1y', min:mi, max:ma,step:inc, onChange: onc}),
            a2x:    ParamFloat({obj:es, key:'a2x', min:mi, max:ma,step:inc, onChange: onc}),
            a2y:    ParamFloat({obj:es, key:'a2y', min:mi, max:ma,step:inc, onChange: onc}),
            n1:     ParamFloat({obj:es, key:'n1', min:-100, max:100,step:inc, onChange: onc}),
            n2:     ParamFloat({obj:es, key:'n2', min:-100, max:100,step:inc, onChange: onc}),
            shift1: ParamFloat({obj:es, key:'shift1', min:mi, max:ma,step:inc, onChange: onc}),
            shift2: ParamFloat({obj:es, key:'shift2', min:mi, max:ma,step:inc, onChange: onc}),            
            }
        });
    }
    
    //
    //
    //
    function makeRationalMapParams(){
        
        let cf = mConfig.rationalMap;
        let onc = onParamChanged;
        let mi = -100;
        let ma = 100;
        let inc = INCREMENT;
        let nmi = -3;
        let nma = 3;
            
        return ParamGroup({
            name: 'rational',
            params: {
                enabled: ParamBool({obj:cf, key:'enabled', onChange:onc}),
                x1: ParamFloat({obj:cf, key:'x1', min:mi,  max:ma, step:inc, onChange:onc}),
                y1: ParamFloat({obj:cf, key:'y1', min:mi,  max:ma, step:inc, onChange:onc}),
                n1: ParamFloat({obj:cf, key:'n1', min:nmi, max:nma, onChange:onc}),
                x2: ParamFloat({obj:cf, key:'x2', min:mi,  max:ma,  step:inc, onChange:onc}),
                y2: ParamFloat({obj:cf, key:'y2', min:mi,  max:ma,  step:inc, onChange:onc}),
                n2: ParamFloat({obj:cf, key:'n2', min:nmi, max:nma, onChange:onc}),
                x3: ParamFloat({obj:cf, key:'x3', min:mi,  max:ma,  step:inc, onChange:onc}),
                y3: ParamFloat({obj:cf, key:'y3', min:mi,  max:ma,  step:inc, onChange:onc}),
                n3: ParamFloat({obj:cf, key:'n3', min:nmi, max:nma, onChange:onc}),
                x4: ParamFloat({obj:cf, key:'x4', min:mi,  max:ma,  step:inc, onChange:onc}),
                y4: ParamFloat({obj:cf, key:'y4', min:mi,  max:ma,  step:inc, onChange:onc}),
                n4: ParamFloat({obj:cf, key:'n4', min:nmi, max:nma, onChange:onc}),                
            }
        });
    }

    //
    //
    //
    function makePeriodicMapParams(){
        
        let cf = mConfig.periodicMap;
        let onc = onParamChanged;
        let mi = -100;
        let ma = 100;
        let inc = INCREMENT;
        let nmi = -3;
        let nma = 3;
            
        return ParamGroup({
            name: 'periodic',
            params: {
            enabled: ParamBool({obj: cf, key: 'enabled', onChange:onc}),
            a1x:    ParamFloat({obj:cf, key:'a1x', min:mi, max:ma,step:inc, onChange: onc}),
            a1y:    ParamFloat({obj:cf, key:'a1y', min:mi, max:ma,step:inc, onChange: onc}),
            a2x:    ParamFloat({obj:cf, key:'a2x', min:mi, max:ma,step:inc, onChange: onc}),
            a2y:    ParamFloat({obj:cf, key:'a2y', min:mi, max:ma,step:inc, onChange: onc}),
            cx:     ParamFloat({obj:cf, key:'cx', min:mi, max:ma,step:inc, onChange: onc}),
            cy:     ParamFloat({obj:cf, key:'cy', min:mi, max:ma,step:inc, onChange: onc}),            
            }
        });
    }

    function getBandFraction(fraction){
        
        if(fraction < 1.) 
            return (1. - 10. ** (-6.*(fraction)))/(1.- 1.e-6);
        else 
            return fraction;

        //return fraction;
    }

    function getUniforms(un, timestamp){
        
        if(DEBUG) console.log(`${MYNAME}.getUniforms() un: `, un);        
        if(DEBUG) console.log(`${MYNAME}.getUniforms() mConfig: `, mConfig);
        
        if(!mConfig.enabled) {
            un.uCScaleEnabled = false;
            un.uRationalMapEnabled = false;
            un.u_periodicWrapEnabled = false;
            un.u_bandEnabled = false; 
            un.u_loxEnabled = false;
            un.u_expEnabled = false;
            un.u_uhpEnabled = false;
            un.u_fpTransformEnabled = false;
            if(DEBUG) console.log(`${MYNAME}.getUniforms() returns: `, un);
            return un;
        }
        
        un.u_loxEnabled = mConfig.loxMap.enabled;
        un.u_expEnabled = mConfig.expMap.enabled;
        un.u_uhpEnabled = mConfig.uhpMap.enabled;
        //fpMap:   false, 
        
        // scaleMap uniforms 
        let scale = mConfig.scaleMap;
        if(scale.enabled){
            un.uCScaleEnabled = true;
            var a1 = [scale.a1x, scale.a1y];
            var a2 = [scale.a2x, scale.a2y];
            var n1 = scale.n1;
            var n2 = scale.n2;
            var s = add(mul(a1, n1), mul(a2, n2));
            // scale and rotate the lattice to make it periodic along vector [0,2*pi]
            un.uCScale = cDiv(s, [0, 2 * PI]);
            un.uCShift = [2 * PI*scale.shift1, 2 * PI*scale.shift2];
        } else {
            un.uCScaleEnabled = false;
            un.uCScale = [1,0];
            un.uCShift = [0,0];
        }
        
        if(mConfig.rationalMap.enabled){
          un.uRationalMapEnabled = true;
          un.uRationalMapData = getRationalMapData();
        } else {
          un.uRationalMapEnabled = false;
        }

        if(mConfig.periodicMap.enabled){
          un.u_periodicWrapEnabled = true;
          un.u_periodicWrapData = getPeriodicWrapData();
        } else {
          un.u_periodicWrapEnabled = false;
            
        }
        if(mConfig.bandMap.enabled){
          un.u_bandEnabled = true;
          un.u_bandFraction = getBandFraction(mConfig.bandMap.fraction);
        } else {
          un.u_bandEnabled = false;            
        }
        
        if(mFixedPointsTransform)mFixedPointsTransform.getUniforms(un, timestamp);
        
        //console.log('ProjectionUni: ', un);
        if(DEBUG) console.log(`${MYNAME}.getUniforms() returns `, un);
        
        return un;       
    }    


    //
    //  we assume 2D 
    //
    function getPeriodicWrapData(){
        
        let cf = mConfig.periodicMap;
        
        let a = [];    
        a[0] = [cf.a1x, cf.a1y,0];;
        a[1] = [cf.a2x, cf.a2y,0];
        a[2] = [1,1,1];
        // TODO 
        let c =  [cf.cx, cf.cy, 0.];
        
        
        let norm = 1./dot(cross(a[0], a[1]), a[2]);
        let d = [];
        // dual basis vectors
        for(let k = 0; k < 3; k++)
            d[k] = mul(cross(a[(k+1)%3], a[(k+2)%3]), norm);        
        
        let data = [];
        for(let k = 0; k < 3; k++){
            data.push(a[k][0]);data.push(a[k][1]);data.push(a[k][2]);
        }
        for(let k = 0; k < 3; k++){
            data.push(d[k][0]);data.push(d[k][1]);data.push(d[k][2]);
        }
        data.push(c[0]); data.push(c[1]); data.push(c[2]);
        //for(let i = 0; i < 3; i++){
        //    console.log(dot(a[i], d[0]),dot(a[i], d[1]),dot(a[i], d[2]));            
        //}    

        return data;
    }

    function getRationalMapData(){
        
        let par = mConfig.rationalMap;
        let rdata = [];
        
        rdata.push(4.); // points count 
        
        for(let i = 1; i <= 4; i++){            
            rdata.push(par['x'+i]);
            rdata.push(par['y'+i]);
            rdata.push(par['n'+i]);
        }
        return rdata;
    }

    function setGroupMaker(groupMaker){
        mGroupMaker = groupMaker;
    }

    function getGroup(){
        
        if(mGroupMaker) 
            return mGroupMaker.getGroup();
        else
            return null;
    }

    return {
        getParams:      ()=> {return mParams},
        getClassName:   ()=> {return MYNAME},
        getUniforms:    getUniforms,
        setGroupMaker:  setGroupMaker,
    };
}