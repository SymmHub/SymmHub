import {
    Jama
} from './JamaJS.js';


console.log('Jama: ', Jama);

let n = 5;
let m = new Jama.Matrix(n,n);
let id = new Jama.Matrix.identity(n,n);
console.log('m: ', m);

console.log('id: ', id);
let d = id.det();
console.log('id.det(): ', d);

for(let i = 0; i < n; i++){
    for(let k = 0; k < n; k++){
        m.set(i,k,10*Math.random());
    }    
}

console.log('m: ', m);
console.log('m.det(): ', m.det());


