
import {
    ParamFloat,
    EventDispatcher,
} from './modules.js';

const MYNAME = 'CliffordAttractor';

const DEBUG = true;

function CliffordAttractor(){

    let mEventDispatcher = new EventDispatcher();

    const pcount = 100000;
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
    let batchSize = pcount;
    let iterationsArray = new Array(4*batchSize);
    let mFloat32Array = new Float32Array(4*batchSize);
    let mTotalCount = 0;
    let mParams;
    let mNeedToRestart = true;
    let myself = null;
    
    
    initialize(pcount);
    
    function initialize(N, data){
        
        cpuInitialize(iterationsArray);
        //cpuIterate(iterationsArray);
        console.log('iterationsArray: ', iterationsArray);
        mFloat32Array = new Float32Array(iterationsArray.length);
        mParams = makeParams(mConfig, onParamChanged);
    }
        
    function makeParams(cfg, onc){
        let params = {
            a: ParamFloat({obj:cfg, key:'a', onChange: onc}),
            b: ParamFloat({obj:cfg, key:'b', onChange: onc}),
            c: ParamFloat({obj:cfg, key:'c', onChange: onc}),
            d: ParamFloat({obj:cfg, key:'d', onChange: onc}),            
        }
        return params;
    }
    
    function cpuIterate(array) {
        
        let {a,b,c,d} = mConfig;        
        
        for (let i = 0; i < array.length; i += 4) {
            let x = array[i];
            let y = array[i + 1];

            let x2 = Math.sin(a * y) + c * Math.cos(a * x);
            let y2 = Math.sin(b * x) + d * Math.cos(b * y);

            let dx = x2 - x;
            let dy = y2 - y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            array[i] = x2;
            array[i + 1] = y2;
            array[i + 2] = dist;
            array[i + 3] = i >> 2;
        }
        
        mTotalCount += batchSize;
                
    }
    
    function cpuInitialize(array) {
        console.log(`${MYNAME}.cpuInitialize(array)`);
        mTotalCount = 0;
        
        let ox = Math.random() * 2 - 1;
        let oy = Math.random() * 2 - 1;
        //console.log('ox: ', ox, ' oy:', oy);
        let w = Math.sqrt(batchSize);

        let {a,b,c,d} = mConfig;

        for (let i = 0; i < array.length; i += 4) {
            let ii = array.length * Math.random();
            let x = (4 * ((ii / 2) % w)) / w + ox;
            let y = (4 * ii) / 2 / w / w + oy;
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            for (let j = 0; j < 15; j++) {
              let x2 = Math.sin(a * y) + c * Math.cos(a * x);
              let y2 = Math.sin(b * x) + d * Math.cos(b * y);
              x = x2;
              y = y2;
            }
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            array[i] = x;
            array[i+1] = y;
            array[i+2] = 0;
            array[i+3] = 0;
            
        }
    }
    
    function getPoints(){
        mFloat32Array.set(iterationsArray);
        return mFloat32Array;
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
        initialize:     initialize,
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