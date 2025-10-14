
//
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
//
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function splitmix32(a) {
 return function() {
   a |= 0;
   a = a + 0x9e3779b9 | 0;
   let t = a ^ a >>> 16;
   t = Math.imul(t, 0x21f0aaad);
   t = t ^ t >>> 15;
   t = Math.imul(t, 0x735a2d97);
   return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
  }
}

function lcg(s) {
    
  return function () {
    return ((2**31-1 & (s=Math.imul(48271,s)))/2**31);
  }
}

// a lot of repeats 
function antti(seed) {

    var m_w = 123456789;
    var m_z = 987654321;
    var mask = 0xffffffff;
    m_w = (123456789 + seed) & mask;
    m_z = (987654321 - seed) & mask;
    return function() {
        m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
        m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
        return (((m_z << 16) + (m_w & 65535)) >>> 0)/4294967296;
    }
}

function antti2(seed) {
  return function(){
    var x = Math.sin(seed++) * 10000;
    return (x - Math.floor(x));
  }
}


function test_random(seed) {
    
    console.log('test_random: ', seed);
    const getRand = mulberry32(seed>>>0);
    
    //const getRand = mulberry32((Math.random()*2**32)>>>0);
    
    for(let i=0; i< 10; i++) console.log(getRand());
    
}

// 2D random points 
// https://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/
// one dimensiopnal uniform "random" numbers 
g = 1.6180339887498948482
a1 = 1.0/g
function qrand1(n){
    return (0.5 + a1*n) % 1;
}


// two dimensional case 
const g = 1.32471795724474602596;
const q0 = 1.0/ g;
const q1 = 1.0/(g*g);


function qrand2x(n) {
    return (0.5 + q0 * n) % 1;
}

function qrand2y(n) {
    return (0.5 + q1 * n) % 1;
}

function qrand2(n) {
    return [qradnx(n), qrandy(n)];
}

// 3d cased 
/*
g = 1.22074408460575947536
a1 = 1.0/g
a2 = 1.0/(g*g)
a3 = 1.0/(g*g*g)
x[n] = (0.5+a1*n) %1 
y[n] = (0.5+a2*n) %1 
z[n] = (0.5+a3*n) %1 
*/

function test_random_points(rnd){
    
    let n = 1000000;
    const canvas = document.getElementById("canvas");
    let gc = canvas.getContext('2d');
    let width  = canvas.width;
    let height  = canvas.height;

    gc.clearRect(0,0, width, height);
    //gc.setFill();
    
    for(let i = 0;i < n; i++){
        let x = rnd();
        let y = rnd();
        //console.log('', x, y);
        gc.fillRect(x*width, y*height, 2, 2);
    }
    
}

function test_qrand2(){
    let n = 1000000;
    const canvas = document.getElementById("canvas");
    let gc = canvas.getContext('2d');
    let width  = canvas.width;
    let height  = canvas.height;

    gc.clearRect(0,0, width, height);
    
    for(let i = 0;i < n; i++){
        let x = qrand2x(i);
        let y = qrand2y(i);
        gc.fillRect(x*width, y*height, 2, 2);
    }
    
}


let seed = Date.now();//1234567;
//test_random_points(lcg(seed));
//test_random_points(mulberry32(seed));
//test_random_points(antti(seed)); 
//test_random_points(antti2(seed));
//test_random_points(splitmix32(seed));

test_qrand2();
