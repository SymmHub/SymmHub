const MYNAME = 'CliffordAttractor';

function CliffordAttractor(){

    const pcount = 500000;
    let p = {a:-1.85, b: -2.5, c:-1.05, d:0.585};
    //let p = { a: -1.4, b: -1.3, c: -1.8, d: -1.9 };
    //let p = { a: -1.4, b: 1.6, c: 1.0, d: 0.7 };
    //let p = { a: 1.7, b: 1.7, c: 0.6, d: 1.2 };
    //let p = { a: 1.7, b: 0.7, c: 1.4, d: 2.0 };
    let batchSize = pcount;
    let iterationsArray = new Array(4*batchSize);


    //let data = initialize(pcount);
    let mData = null;
    initialize(pcount);
    
    function initialize(N, data){

    
        let a1 = p.a;
        let a2 = p.c;
        let a3 = p.a;
        let b1 = p.b;
        let b2 = p.d;
        let b3 = p.b;
    
        let {a,b,c,d} = p;
        
        if(!data){
            data = {
                points: new Float32Array(2*N),
                colors: new Float32Array(3*N),
            };
        }
        const points = data.points;
        const colors = data.colors;
        
        let x = 0.1, y = 0.2;
        for (let i = 0; i < N; i++) {
            let x2 = Math.sin(a * y) + c * Math.cos(a * x);
            let y2 = Math.sin(b * x) + d * Math.cos(b * y);
            x = x2;
            y = y2;
            points[2*i] = (x);
            points[2*i+1] = (y);
            colors[3*i] =   Math.sqrt(x*x + y*y)*0.5;
            colors[3*i+1] = 1-colors[3*i];
            colors[3*i+2] = 0.5;
          
        }
        cpuInitialize(iterationsArray);
        cpuIterate(iterationsArray);
        console.log('iterationsArray: ', iterationsArray);
        mData = data;
        return data;
    }
    
    
    function cpuIterate(array) {
        
        let {a,b,c,d} = p;
        
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
                
    }
    
    function cpuInitialize(array) {
        console.log(`${MYNAME}.cpuInitialize(array)`);
        let ox = Math.random() * 2 - 1;
        let oy = Math.random() * 2 - 1;
        //console.log('ox: ', ox, ' oy:', oy);
        let w = Math.sqrt(batchSize);

        let {a,b,c,d} = p;

        for (let i = 0; i < array.length; i += 4) {
            let ii = array.length * Math.random();
            let x = (4 * ((ii / 2) % w)) / w + ox;
            let y = (4 * ii) / 2 / w / w + oy;
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            for (let j = 0; j < 25; j++) {
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
    
    function getPointsCombined(){
        return new Float32Array(iterationsArray);
    }
    
    function getPoints(){
        return mData.points;
    }

    function getColors(){
        return mData.colors;
    }
    
    function iterate(){
        cpuIterate(iterationsArray);
        //console.log('iterate()');
        
    }
    
    return {
        initialize: initialize,
        iterate:    iterate,
        getPoints:  getPoints,
        getPointsCombined: getPointsCombined,
        getColors:  getColors,
        getPointsCount: ()=>{return pcount;},
    }
}


export {
    CliffordAttractor
}