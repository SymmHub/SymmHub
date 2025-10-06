
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

    const pcount = 100000;
    const mConfig = {
        a:-1.85, 
        b: -2.5, 
        c:-1.05, 
        d:0.585,
        startCount: 15,
        avgDist: 0,
        totalCount: 0,
    };
    
    //let p = {a:-1.85, b: -2.5, c:-1.05, d:0.585};
    //let p = { a: -1.4, b: -1.3, c: -1.8, d: -1.9 };
    //let p = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };
    //let p = { a: 1.7, b: 1.7, c: 0.6, d: 1.2 };
    //let p = { a: 1.7, b: 0.7, c: 1.4, d: 2.0 };
    let batchSize = pcount;
    //let mIterationsArray = new Array(4*batchSize);
    //let mIterationsArray = new Float64Array(4*batchSize);
    let mIterationsArray = new Float32Array(4*batchSize);
    let mFloat32Array = new Float32Array(4*batchSize);
    let mTotalCount = 0;
    let mParams;
    let mNeedToRestart = true;
    let myself = null;
    
    
    initialize();
    
    function initialize(){
        if(DEBUG) console.log('initialize()');
        cpuInitialize(mIterationsArray);
        console.log('mIterationsArray: ', mIterationsArray);
        mFloat32Array = new Float32Array(mIterationsArray.length);
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
            totalCount: ParamInt({obj:cfg, key:'totalCount'}), 
            avgDist:    ParamFloat({obj:cfg, key:'avgDist'}), 
            random:     ParamFunc({func: onRandom, name: 'Random!'}),
        }
        return params;
    }
    
    function cpuIterate(array) {
        
        let avgDist = 0;
        let pnt0 = {x:0, y:0};
        let pnt1 = {x:0, y:0};
        for (let i = 0; i < array.length; i += 4) {
            pnt0.x = array[i];
            pnt0.y = array[i+1];            
            cpuIteratePoint(pnt0, pnt1);
            //let x = array[i];
            //let y = array[i + 1];
            //calculate(xy, xy1);
            let x1 = pnt1.x;
            let y1 = pnt1.y;            
            let dx = x1 - pnt0.x;
            let dy = y1 - pnt0.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            avgDist += dist;
            array[i    ] = x1;
            array[i + 1] = y1;
            array[i + 2] = dist;
            array[i + 3] = i >> 2;
        }
        
        avgDist /= (array.length/4);
        mConfig.avgDist = avgDist;
        mParams.avgDist.updateDisplay();
        mTotalCount += batchSize;
        mConfig.totalCount = mTotalCount;
        mParams.totalCount.updateDisplay();
        
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
    
    function cpuInitialize(array) {
        console.log(`${MYNAME}.cpuInitialize(array)`);
        mTotalCount = 0;
        
        let ox = Math.random() * 2 - 1;
        let oy = Math.random() * 2 - 1;
        //console.log('ox: ', ox, ' oy:', oy);
        let w = Math.sqrt(batchSize);
        let pnt0 = {x:0, y:0};
        let pnt1 = {x:0, y:0};        
        let pt = {};
        
        let {startCount} = mConfig;
   
        for (let i = 0; i < array.length; i += 4) {
            let ii = array.length * Math.random();
            
            //pnt0.x = (4 * ((ii / 2) % w)) / w + ox;
            //pnt0.y = (4 * ii) / 2 / w / w + oy;
            let x = (4 * ((ii / 2) % w)) / w + ox;
            let y = (4 * ii) / 2 / w / w + oy;
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            for (let j = 0; j < startCount; j++) {
                pnt0.x = x;
                pnt0.y = y;
                cpuIteratePoint(pnt0, pnt1);
                pt = pnt1;
                pnt0 = pnt1;
                pnt1 = pt;
                //let y1 = pnt1.y;
                x = pnt1.x;
                y = pnt1.y;
            }
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            array[i]   = x;
            array[i+1] = y;
            array[i+2] = 0.;
            array[i+3] = 0.;
            
        }
    }
    
    function getPoints(){
        mFloat32Array.set(mIterationsArray);
        return mFloat32Array;
    }
    
    function restart(){
        
        if(DEBUG) console.log('restart()');
        cpuInitialize(mIterationsArray);    
        mNeedToRestart = false;
            
    }
    
    function iterate(){
        
        if(mNeedToRestart){
            if(DEBUG) console.log('iterate() mNeedToRestart:',mNeedToRestart);                        
            restart(); 
        }
        cpuIterate(mIterationsArray);
        
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