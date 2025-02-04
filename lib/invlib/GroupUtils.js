import {
  iPoint,
  ITransform,
  iSplane,
  isEpsilonEqualU4,
  isDefined,
  getParam, 
  Group, 
  SpatialHashMap,
  objectToString, 
  
} from './modules.js';


const DEBUG = false;



/**
  return a,b,c,d,e,.. for index 0,1,2,3,...
*/
function getGenName(index){
  
   return String.fromCharCode("a".charCodeAt(0) + index);
   
}

/**
  return A,B,C,D,E,... for index 0,1,2,3,...
*/
function getInvGenName(index){
  
   return String.fromCharCode("A".charCodeAt(0) + index);    
   
}

/**
  makes canonical names for group generators. 
  Paired generators are receiving names of low and upper case a <-> A
  AND 
  stores canonical names into group.genNames for future re-use 
*/
function getCanonicalGenNames(group){
 
  if(DEBUG) console.log('GroupUtils.getCanonicalGenNames)()');
  
  if(isDefined(group.genNames))
    return group.genNames;
  
  const trans = group.t;
  const names = [];
  const count = trans.length;
  let pairCount = 0;
  const pnt = iPoint([0.4, 0.3, 0.2, 0.1]);
  const EPS = 1.e-8;
  //if(DEBUG)console.log('pnt:'+splaneToString(pnt));
  
  for(let i = 0; i < count; i++){
    
    let t0 = new ITransform(trans[i]);
    let t0p = t0.transform(pnt);
    //if(DEBUG)console.log('t0p:'+splaneToString(t0p));
    let name = names[i];
    //if(DEBUG) console.log('name['+i+']='+names[i]);
    if(!isDefined(name)){
      names[i] = getGenName(pairCount++);
      //if(DEBUG) console.log('name['+i+']='+names[i]);
                    
      // find pair to that generator 
      for(let j = i; j < count; j++){
        
        //if(DEBUG) console.log('j='+j);  
        
        let t1 = new ITransform(trans[j]);
        let t1t0p = t1.transform(t0p);
        //if(DEBUG)console.log('t1t0p:'+splaneToString(t1t0p));
        if(isEpsilonEqualU4(pnt, t1t0p, EPS)){
          //if(DEBUG) console.log('equals!');
          if(j > i) {
            names[j] = getInvGenName(i);
            //if(DEBUG) console.log('name['+j+']='+names[j]);
          } 
          break;
        }
      }
    }
  }  
  group.genNames = names;
  
  return group.genNames;
} // function getCanonicalGenNames


function makeCanonicalGenNames(group){
 
  if(DEBUG) console.log('GroupUtils.makeCanonicalGenNames()');
    
  const trans = group.getTransforms();
  const names = [];
  const count = trans.length;
  let pairCount = 0;
  const pnt = iPoint([0.4, 0.3, 0.2, 0.1]);
  const EPS = 1.e-8;
  //if(DEBUG)console.log('pnt:'+splaneToString(pnt));
  
  for(let i = 0; i < count; i++){
    
    let t0 = new ITransform(trans[i]);
    let t0p = t0.transform(pnt);
    //if(DEBUG)console.log('t0p:'+splaneToString(t0p));
    let name = names[i];
    //if(DEBUG) console.log('name['+i+']='+names[i]);
    if(!isDefined(name)){
      names[i] = getGenName(pairCount++);
      //if(DEBUG) console.log('name['+i+']='+names[i]);
                    
      // find pair to that generator 
      for(let j = i; j < count; j++){
        
        //if(DEBUG) console.log('j='+j);  
        
        let t1 = new ITransform(trans[j]);
        let t1t0p = t1.transform(t0p);
        //if(DEBUG)console.log('t1t0p:'+splaneToString(t1t0p));
        if(isEpsilonEqualU4(pnt, t1t0p, EPS)){
          //if(DEBUG) console.log('equals!');
          if(j > i) {
            names[j] = getInvGenName(i);
            //if(DEBUG) console.log('name['+j+']='+names[j]);
          } 
          break;
        }
      }
    }
  }  
  
  return names;
} // function makeCanonicalGenNames


/**
  
*/
function wrapGroup(group){
  
  if(group instanceof Group){
    return group;
  } else {
    // old style group data 
    return new Group(group);
  }
}


//
// makes reflection transforms for reflection group 
//
function makeReflections(sides){
  
  return sides.map(s => [s]);
  
}

function makeInverseTransform(trans){
  
  const len = trans.length;
  return trans.map((s,index) => trans[len-1-index]);
  
}

function makeInverseTransforms(transArray){
  return transArray.map(t => makeInverseTransform(t));
}

function makeInverseITransforms(iTransArray){
  return iTransArray.map(t => t.getInverse());
}



// static map 
let inverseCaseMap = undefined;

function getInverseCaseMap(){
  
  if(isDefined(inverseCaseMap))
      return inverseCaseMap;
  
  inverseCaseMap = {};
  let A = 'A'.charCodeAt(0);
  let a  ='a'.charCodeAt(0);
  let Z = 'Z'.charCodeAt(0);
  for(let i = 0; i < Z-A; i++){
    inverseCaseMap[String.fromCharCode(i + A)] = String.fromCharCode(i + a);
    inverseCaseMap[String.fromCharCode(i + a)] = String.fromCharCode(i + A);    
  }
  
  return inverseCaseMap;
}



function getInverseChar(name){
  
  let revMap = getInverseCaseMap();
  let revName = revMap[name];
  if(isDefined(revName))
    return revName;
  else 
    return '?';
}

function getInverseWord(word){
  
  if(!isDefined(word))
    return undefined;
  
  let rword = word.split('').reverse();
  let irword = rword.map(x => getInverseChar(x));
  return irword.join('');  
  
}

//
//  invert single transformation 
//
function getInverseTransform(trans){
  var inv = [];
  for(var i = 0; i < trans.length; i++){
    inv[i] = trans[trans.length - i -1];
  }
  if(isDefined(trans.word)){
    inv.word = getInverseWord(trans.word);
  }
  return inv;
}

/**
  inverse list of transformations   
*/
function getInverseTransforms(trans){
  
  var inv = [];
  for(var i = 0; i < trans.length; i++){
    inv[i] =  getInverseTransform(trans[i]);
  }
  return inv;
  
}

/**
  return array of inverses to group generators
*/
function getInverseGenerators(group){
  
  if(isDefined(group.it))
  return group.it;

  var inv = [];
  let trans = group.t;
  for(var i = 0; i < trans.length; i++){
    inv[i] =  getInverseTransform(trans[i]);
  }
  
  group.it = inv;
  
  return inv;
  
}

/**
  return transformation for given generators map and word in generators 
*/
function word2trans(map, word){
  
  let len = word.length;
  let trans = [];
  
  //let map = getPairingMap(group);
  
  for(var i = 0; i < len; i++){
      var tr1 = map[word.charAt(i)];
      if(isDefined(tr1)) {
        trans = trans.concat(tr1);
      } else {
        console.error("undefined generator: " + word.charAt(i));
      }        
  }
  trans.word = word;
  return trans;
}

/**
  convert string of words or permutations into array of int 
*/
function parsePermutations(permStr){
  
  var re = / |,/;   // regexp 
  var words = permStr.split(re); 
  let count = words.length;
  
  //for(let i = 0; i < count; i++){
  //  console.log(`word[${i}]:\'`+words[i]+`\'`);
  //}
  
  let size = words[0].length;
  let out = [count, size];
  let c = 2;
  let aa = 'a'.charCodeAt(0);
  for(let i = 0; i < count; i++){
    let w = words[i];
    for(let k = 0; k < size; k++){
      if(k < w.length)
        out[c++] = w.charCodeAt(k)-aa;
      else 
        out[c++] = k;
    }
  }
  //console.log('permutation:',objectToString(out));
  return out;
}


/**
  default transform tester which accepts everything 
*/
class DefaultTransformTester {
  constructor(){
  }
  testTransform(transform, transformedPoint){
    return true;
  }
} // class DefaultTransformTester


/**
  creates composite transforms from the given set of generators 
  params = {
    maxWordCount:1, 
    maxCount: 100,
    basePoint: iPoint([0.1, 0.2, 0.3, 0.1]),  point to use as test for unique transforms 
    tester: new DefaultTransformTester()
  }
  return ITransform[] 
*/
function makeTransforms(generators, param){
  
  // we expect generators to be array ITransform[]
  // convert it just in case 
  generators = splane2transform(generators);
  
  if(!(generators instanceof Array))    
    throw new Exception('generators are not array');
  if(!(generators[0] instanceof ITransform)){
    throw 'generators[0] is not ITransform';      
  }
  //console.log('makeGroupTransforms():', objectToString(generators));
  let maxCount = getParam(param.maxCount, 100);
  let basePoint = getParam(param.basePoint, iPoint([0.1, 0.2, 0.3, 0.1]));
  let maxWordLength = getParam(param.maxWordLength, 1);
  let tester = getParam(param.tester, new DefaultTransformTester());
    
  var pointMap = new SpatialHashMap({maxSize:param.maxCount});
  pointMap.add(basePoint);
  
  let transforms = [];
  transforms.push(new ITransform());// add identity transform 
  addLayerOfTransforms(pointMap, generators, maxWordLength, tester, transforms);
  
  return transforms; 
  
} // function makeTransforms

/**
  add single layer of transforms   
*/
function addLayerOfTransforms(pointMap, generators, maxDepth, tester, transforms){
  
  //console.log('addLayerOfTransforms()', maxDepth);
  if(maxDepth < 1) 
    return;
  
  var size = transforms.length;
  
  for(var i = 0; i < size; i++){    
    var pnt = pointMap.get(i);    
    
    for(var k = 0; k < generators.length; k++){
      var tpnt = generators[k].transform(pnt);
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
  
} // function addLayerOfTransforms

/**
    convert iSplane or Splane[] into ITransform 
    converts Splane[][] into iTransforms[] 
*/
function splane2transform(splanes){
  
  const debug = false;
  if(debug)console.log('splane2transform()', objectToString(splanes));
  if(splanes instanceof iSplane){
    // single splane 
    return new ITransform([splanes]);
  } 
  if(splanes instanceof Array){
    if(splanes[0] instanceof iSplane){
      return new ITransform(splanes);
    } 
    //if((splanes[0] instanceof Array) && (splanes[0][0] instanceof iSplane)){
    if(splanes[0] instanceof Array){
      
      let trans = [];
      for(let i = 0; i < splanes.length; i++){
        trans[i] = new ITransform(splanes[i]);
      }
      return trans;
    }
    if(splanes[0] instanceof ITransform){
      // it is already array of ITransform[]
      return splanes;
    }
  }
  
  throw 'unrecognized parametes';    
}

/**
  maps point into fundamental domain
  fundDomain - array of splanes 
  transforms - array of pairing ITransform
  pnt point
  maxIterations maximal count iterations to use 
  
  @return 
   {
      inDomain:inDomain, // whether we got into FD
      transform:trans,   // transformation which maps point into FD
      pnt:pnt,           // point in the FD
      word:word,  // word of generators 
   };
*/
function toFundDomain(fundDomain, transforms, pnt, maxIterations){
  
    if(!(transforms[0] instanceof ITransform)){
      console.error('transforms should be instanceof ITransform[], instead found the following:\n' + objectToString(transforms));
      return {
        inDomain:false, 
        transform:null,
        pnt:pnt,
        word:''
        };      
    }
    var trans = [];
    var word = [];
    var inDomain = false;
    for(var k = 0;  k < maxIterations; k++){
      var found = false;
      for(var i = 0; i < fundDomain.length; i++){
          if(iDistanceU4(fundDomain[i], pnt) > 0) {
            // point is outside of that side 
            var tr = transforms[i];
            pnt = iTransformU4(tr, pnt);
            trans = trans.concat(tr);
            if(isDefined(tr.word)) word = word.concat(tr.word.split(''));
            found = true;
            break;
          }
      }
      if(!found){
        // no transforms were made 
        inDomain = true;
        break;
      }
    }

  var result = {
      inDomain:inDomain, 
      transform:trans,
      pnt:pnt,
      word:word.join(''),
    };
    
  return result;
}

/**
  converts old style transform Splane[][] into new style ITransform[]
*/
function trans2itrans(tran){
  if(tran[0] instanceof ITransform){
    // already ITransform - nothing to do 
    return tran;
  }
  let itran= [];
  tran.forEach(elem => itran.push(new ITransform(elem, elem.word)));
  return itran;
}


//
//  export all functions as a single map 
//
export const GroupUtils = {  

  getGenName:               getGenName,
  getInvGenName:            getInvGenName,
  getCanonicalGenNames:     getCanonicalGenNames,
  makeCanonicalGenNames:    makeCanonicalGenNames,
  wrapGroup:                wrapGroup,
  makeReflections:          makeReflections,
  makeInverseTransform:    makeInverseTransform,
  makeInverseTransforms:    makeInverseTransforms,
  makeInverseITransforms:   makeInverseITransforms,
  makeInverseTransform:     makeInverseTransform,
  getInverseWord:           getInverseWord,
  word2trans:               word2trans,
  parsePermutations:        parsePermutations,
  getInverseTransform:      getInverseTransform,
  getInverseTransforms:     getInverseTransforms,
  makeTransforms:           makeTransforms,
  splane2transform:         splane2transform,
  toFundDomain:             toFundDomain,
  trans2itrans:             trans2itrans,
};


