function CliffordAttractor(){

    const pcount = 1000000;
    let p = {a:-1.85, b: -2.5, c:-1.05, d:0.585};

    let data = initialize(pcount);
    
    function initialize(N, data = null){

    
        let a1 = p.a;
        let a2 = p.c;
        let a3 = p.a;
        let b1 = p.b;
        let b2 = p.d;
        let b3 = p.b;
    
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
            let x2 = Math.sin(a1 * y) + a2 * Math.cos(a3 * x);
            let y2 = Math.sin(b1 * x) + b2 * Math.cos(b3 * y);
            x = x2;
            y = y2;
            points[2*i] = (x);
            points[2*i+1] = (y);
            colors[3*i] =   Math.sqrt(x*x + y*y)*0.5;
            colors[3*i+1] = 0;//(y + 1)*0.5;
            colors[3*i+2] = 0;//(y + 1)*0.5 * (y + 1)*0.5;
          
        }
        return data;
    }
    
    function getPoints(){
        return data.points;
    }

    function getColors(){
        return data.colors;
    }
    
    function iterate(){
        console.log('iterate()');
    }
    return {
        iterate: iterate,
        getPoints: getPoints,
        getColors: getColors,
        getPointsCount: ()=>{return pcount;},
    }
}


export {
    CliffordAttractor
}