// two dimensional case 
const g = 1.32471795724474602596;
const q0 = 1.0/ g;
const q1 = 1.0/(g*g);


export function qrand2x(n) {
    return (0.5 + q0 * n) % 1;
}

export function qrand2y(n) {
    return (0.5 + q1 * n) % 1;
}

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

export function splitmix32(a) {
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

export function lcg(s) {
    
  return function () {
    return ((2**31-1 & (s=Math.imul(48271,s)))/2**31);
  }
}

export function antti2(seed) {
  return function(){
    var x = Math.sin(seed++) * 10000;
    return (x - Math.floor(x));
  }
}
