
/**
  seeded random number generator 
*/
export class Random {
  
  //
  // the initial seed
  //
  constructor(seed){
    
    seed = seed || 1;    
    this.seed = seed || 0;
    this.period = 233280 || 0;
    this.a = 9301||0;
    this.b = 49297||0;
    
  }
 
  //
  // return neext random in the range min, max 
  //
  nextDouble(min, max){
    
    max = max || 1;
    min = min || 0;
 
    var rnd = this.next()/this.period;
 
    return min + rnd * (max - min);
  } 

  next(){
    this.seed = (this.seed * this.a + this.b) % this.period;
    return this.seed;
  }
  
  nextInt(){
    
    //max = max || this.period;
    //min = min || 0;

    var rnd = this.next();
 
    return rnd;
    
  }
  
} // class Random
