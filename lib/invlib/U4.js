import {
  iDistanceU4
} from './modules.js';

/**
  set of functions to work in the U4 model 
  
*/

// signed distance from splane to a point 
function sigDistanceSP(splane, point){  
  //console.log(`sigDistanceSP():`, splane, point);
  return iDistanceU4(splane, point);
    
}


export const U4 = {
  sigDistanceSP:  sigDistanceSP,
};