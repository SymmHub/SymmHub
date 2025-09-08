
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

    const pcount = 500000;
    const mConfig = {
        a:-1.85, 
        b: -2.5, 
        c:-1.05, 
        d:0.585,
        startCount: 15,
        avgDist: 0,
    };
    
    //let p = {a:-1.85, b: -2.5, c:-1.05, d:0.585};
    //let p = { a: -1.4, b: -1.3, c: -1.8, d: -1.9 };
    //let p = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };
    //let p = { a: 1.7, b: 1.7, c: 0.6, d: 1.2 };
    //let p = { a: 1.7, b: 0.7, c: 1.4, d: 2.0 };
    let batchSize = pcount;
    let iterationsArray = new Array(4*batchSize);
    let mFloat32Array = new Float32Array(4*batchSize);
    let mTotalCount = 0;
    let mParams;
    let mNeedToRestart = true;
    let myself = null;
    
    
    initialize();
    
    function initialize(){
        
        cpuInitialize(iterationsArray);
        console.log('iterationsArray: ', iterationsArray);
        mFloat32Array = new Float32Array(iterationsArray.length);
        mParams = makeParams(mConfig, onParamChanged);
    }
        
    function onRandom(){
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
            startCount: ParamInt({obj:cfg, key:'startCount', onChange: onc}), 
            avgDist:    ParamFloat({obj:cfg, key:'avgDist'}), 
            random:     ParamFunc({func: onRandom, name: 'Random!'}),
        }
        return params;
    }
    
    function cpuIterate(array) {
        
        let {a,b,c,d} = mConfig;        
        let avgDist = 0;
        for (let i = 0; i < array.length; i += 4) {
            let x = array[i];
            let y = array[i + 1];

            let x2 = Math.sin(a * y) + c * Math.cos(a * x);
            let y2 = Math.sin(b * x) + d * Math.cos(b * y);

            let dx = x2 - x;
            let dy = y2 - y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            avgDist += dist;
            array[i] = x2;
            array[i + 1] = y2;
            array[i + 2] = dist;
            array[i + 3] = i >> 2;
        }
        
        avgDist /= (array.length/4);
        mConfig.avgDist = avgDist;
        mParams.avgDist.updateDisplay();
        mTotalCount += batchSize;
                
    }
    
    function cpuInitialize(array) {
        console.log(`${MYNAME}.cpuInitialize(array)`);
        mTotalCount = 0;
        
        let ox = Math.random() * 2 - 1;
        let oy = Math.random() * 2 - 1;
        //console.log('ox: ', ox, ' oy:', oy);
        let w = Math.sqrt(batchSize);

        let {a,b,c,d, startCount} = mConfig;

        for (let i = 0; i < array.length; i += 4) {
            let ii = array.length * Math.random();
            let x = (4 * ((ii / 2) % w)) / w + ox;
            let y = (4 * ii) / 2 / w / w + oy;
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            for (let j = 0; j < startCount; j++) {
              let x2 = Math.sin(a * y) + c * Math.cos(a * x);
              let y2 = Math.sin(b * x) + d * Math.cos(b * y);
              x = x2;
              y = y2;
            }
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            array[i] = x;
            array[i+1] = y;
            array[i+2] = 0.;
            array[i+3] = 0.;
            
        }
    }
    
    function getPoints(){
        mFloat32Array.set(iterationsArray);
        return mFloat32Array;
    }
    
    function restart(){
       cpuInitialize(iterationsArray);          
    }
    
    function iterate(){
        
        if(mNeedToRestart){
            mNeedToRestart = false;
            cpuInitialize(iterationsArray);          
        }
        cpuIterate(iterationsArray);
        
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
        mNeedToRestart = true;
        scheduleRepaint();
        
    }
 
    
    myself = {
        getParams:      ()=>{return mParams;},
        getClassName:   ()=>{return MYNAME+'-class';},
        restart:        restart,
        iterate:        iterate,
        getPoints:      getPoints,
        getTotalCount:  ()=>{return mTotalCount;},
        getPointsCount: ()=>{return pcount;},
        addEventListener: addEventListener,
    }
    return myself;
}


export {
    CliffordAttractor
}