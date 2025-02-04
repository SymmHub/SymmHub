import {
  ITransform 
} from './modules.js'

function isIdentity(transform){
  
  if(transform instanceof ITransform) 
    return transform.isIdentity();
  else 
    return (transform.length == 0)
}

/*

//
//  default transform tester which accepts everything 
//

export class DefaultTransformTester {
  constructor(){
  }
  testTransform(transform, transformedPoint){
    return true;
  }
} // class DefaultTransformTester


//
//  makes group transforms given generators 
//  
//  generators - array of ITransform 
//  param.maxWordLength - maximal word length 
//  param.basePoint - base point 
//  param.tester - optional tester which check if transform needed to be stored 
//                  it is supposed to have method testTransform(transform, transformedPoint) 
//                  transform is saved only if method return true 
//  params.maxCount - max count of transforms to collect
//
export function makeGroupTransforms(generators, param){
  
  if(!(generators instanceof Array))    
    throw new Exception('generators is not array');
  if(!(generators[0] instanceof ITransform)){
    throw 'generators[0] is not ITransform';      
  }
  //console.log('makeGroupTransforms():', objectToString(generators));
  let maxCount = getParam(param.maxCount, 10);
  let basePoint = getParam(param.basePoint, iPoint([0.1, 0.2, 0.3, 0.1]));
  let maxWordLength = getParam(param.maxWordLength, 1);
  let tester = getParam(param.tester, new DefaultTransformTester());
    
  var pointMap = new SpatialHashMap({maxSize:maxCount});
  pointMap.add(basePoint);
  
  let transforms = [];
  transforms.push(new ITransform());// add identity transform 
  addLayerOfTransforms(pointMap, generators, maxWordLength, tester, transforms);
  
  return transforms; 
}

//
//
//
function addLayerOfTransforms(pointMap, generators, maxDepth, tester, transforms){
  
  //console.log('addLayerOfTransforms()', maxDepth);
  if(maxDepth < 1) 
    return;
  
  var size = transforms.length;
  
  for(var i = 0; i < size; i++){    
    var pnt = pointMap.get(i);    
    
    for(var k = 0; k < generators.length; k++){
      var tpnt = iTransformU4(generators[k],pnt);
      //tpnt.word = pnt.word + transNames[k];
      if(pointMap.getIndex(tpnt) < 0){        
        let newTransform = transforms[i].getCopy();
        newTransform.concat(generators[k]);
        if(tester.testTransform(newTransform, tpnt)){
          if(pointMap.add(tpnt)){
            //console.log('new transform:', objectToString(newTransform));
            transforms.push(newTransform);
          } else {
            // overfill 
            return;
          }        
        }
      }
    }  
  }
  // add another layer 
  addLayerOfTransforms(pointMap, generators, maxDepth-1, tester, transforms);
}
*/


//
//
//
export const TransformUtils = {
  
  isIdentity: isIdentity,  
}
