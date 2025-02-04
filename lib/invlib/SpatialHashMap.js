import {
  
  isDefined, 
  getParam,
  objectToString,

  isEpsilonEqualU4,
  splaneToString,
} from './modules.js';


const DEBUG = false;
/**
  stores non equal iPoints 
*/
export class SpatialHashMap {
	
  /**
    options.maxSize - maximal point count to store 
    options.epsilon - tolerance to consider points to be equal 
    
  */
	constructor(options){
    
    if(DEBUG)console.log("SpatialHashMap:", options);	
		this.array = [];
		this.map = {};
		this.epsilon = getParam(options.epsilon, 1.e-5);
		// prevent too many points 
		this.MAX_SIZE = getParam(options.maxSize, 5000) | 0;
	}

  /**
    add new point to the map 
  */
	add(pnt){
		if(DEBUG)console.log('add: ', objectToString(pnt));
		var arr = this.array;
		if(arr.length >= this.MAX_SIZE) 
			return false;
		
		var hash = this.getHash(pnt);
    
		var bucket = this.map[hash];
		if(isDefined(bucket)){
			if(DEBUG)console.log("existng bucket");	
			// check if the point is in the bucket
			for(var i = 0; i < bucket.length; i++){
				if(isEpsilonEqualU4(arr[bucket[i]], pnt, this.epsilon)){
          if(DEBUG)console.log("old point");	
					return true;
				}
			}
			// new point 
      if(DEBUG)console.log("new point");	
			bucket.push(arr.length);
			arr.push(pnt);	
			return true;			
		} else {
			if(DEBUG)console.log("new bucket: ", splaneToString(pnt,10));	
			bucket = [arr.length];
			this.map[hash] = bucket;
			arr.push(pnt);	
			return true;
		}
		
		//for(var i = 0; i < arr.length; i++){
		//	if(isEpsilionEqual(arr[i], pnt, this.epsilon))
		//		return true;
		//}
		//arr.push(pnt);	
		
		return true;
	}
  
  /**
    return index of stored point (or -1) if the point does not exists 
  */
	getIndex(pnt){

		var arr = this.array;
		var hash = this.getHash(pnt);
		var bucket = this.map[hash];
		if(isDefined(bucket)){
			// check for the existing point in the bucket
			for(var i = 0; i < bucket.length; i++){
				if(isEpsilonEqualU4(arr[bucket[i]], pnt, this.epsilon)){
					return bucket[i];
				}
			}
    } else {
      return -1;
    }
  }
  
  /**
    return point at given index 
  */
	get(index){
		return this.array[index];
	}
	
	size(){
		return this.array.length;
	}
	
	getArray(){
		return this.array;
	}	
	
	getHash(p){
		var v = p.v;
    let hash  = (HASH_X * v[0] + HASH_Y*v[1] + HASH_Z*v[2] + HASH_W*v[3] + HASH_U) | 0;
    if(DEBUG) console.log('v:', v, ' hash:', hash);
    return hash;
	}
}

const HASHFACTOR = 1000000;
const HASH_X = HASHFACTOR*1.234665567;
const HASH_Y = HASHFACTOR*2.345446567;
const HASH_Z = HASHFACTOR*3.425545425;
const HASH_W = HASHFACTOR*4.588678567;
const HASH_U = HASHFACTOR*5.588678567
