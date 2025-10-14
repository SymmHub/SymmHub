
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

function testRandom() {
    
    const getRand = mulberry32(2345);
    
    //const getRand = mulberry32((Math.random()*2**32)>>>0);
    
    for(let i=0; i< 10; i++) console.log(getRand());
    
}


