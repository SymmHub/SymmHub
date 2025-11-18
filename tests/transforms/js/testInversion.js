
import {

    iSphere, 
    iReflect,
    sqrt,    
}

from '../../../lib/invlib/modules.js';

function toStr(v,digits){
    let s = '[';
    for(let i = 0; i < v.length; i++){
        s += v[i].toFixed(digits);
        s += ' ';
    }
    s += ']';
    
    return s;
}


function testInversion(){

    console.log('testInversion()');

    let s3 = sqrt(3);
    let s5 = sqrt(5);
    let fi = (s5+1)/2;
    //
    //coord of icosahedral vertex
    //
    let p = [(fi-1)/s3, 0, (fi/s3)];
    let q = [1/sqrt(fi*fi+1), 0, fi/sqrt(fi*fi+1)];
    
    let sphere = iSphere([0,0,-1, sqrt(2)]);    
    let p1 = iReflect(sphere, p);    
    let q1 = iReflect(sphere, q);    
        
    let s = (fi-1)/(fi+s3);     
    let s1 = 4*(s5-1)/(s5+2*s3+1);
    
    let pp = 1/(2 * fi + sqrt(fi*fi+1));
    
    console.log('p: ', toStr(p, 16));
    console.log('p1: ', toStr(p1, 16));
    console.log('q: ', toStr(q, 16));
    console.log('q1: ', toStr(q1, 16));
    console.log('s: ', s.toFixed(16));
    console.log('s1: ', s1.toFixed(16));
    console.log('pp: ', pp.toFixed(16));
    
        
}


testInversion();