import {
  ITransform ,
  U4toH4,
  H4toU4,
  splaneToString,
  dot,
  abs,
  iDistanceU4,
  GroupUtils,
  getParam,
  isDefined,
  Jama,
  isPlanarTransform,
  classifyMobiusU4,
  MOBIUS_PRECISION,
} from './modules.js'


function isIdentity(transform){
  
  if(transform instanceof ITransform) 
    return transform.isIdentity();
  else 
    return (transform.length == 0)
}

export const TransformUtils = {
  isIdentity: isIdentity,  
}



/**
   return H4 matrix corresponding to the reflection in splane p
*/
export function getReflectionMatrixH4(p){

    let n = p.length;
    let t = new Jama.Matrix(n,n);
    
    for(let i = 0; i < n; i++){
        for(let j = 0; j < n; j++){
            
            let a=0;
            if(i == j) a = 1;
            
            if(j < (n-1)) 
                a -= 2*p[i]*p[j];
            else 
                a += 2*p[i]*p[j];

            t.set(i,j,a);
        }
    }
    return t;
    
}


/**
   return H4 matrix corresponding to the given transform ITransform 
*/
export function getMatrixH4(itrans){
        
    // array of reflections 
    let ref = itrans.getRef();
    let total = new Jama.Matrix.identity(5,5);
    //console.log('total:', total);
    
    for(let i = 0; i < ref.length; i++){
        //console.log('ref:', ref[i]);
        let p = U4toH4(ref[i]);
        //console.log('p:', p);
        let m = getReflectionMatrixH4(p);
        //console.log('m:', m);
        total = total.times(m);
        //console.log('total:', total);
    }
    
    return total;
    
}


/**
  apply transform in H4 representation 
  transform is given as 5x5 matrix
  p is 5-vector 
  
*/
export function transformH4(transm, p){
    
    let n = p.length;
    let res = [];
    for(let i = 0; i < n; i++){
        
        let a = 0;
        for(let j = 0; j < n; j++){
            
            a += transm.get(i,j)*p[j];
            
        }
        res[i]= a;
    }
    return res;

}

export function analyzeTransformH4(m){
    
    const EPS = 0.0001;

    const debug = false;
    let res = {};
    
    let eig = new Jama.EigenvalueDecomposition(m);
        
    let diag = eig.getD();
    let mev = eig.getV();
    let det = m.det();
    let re = eig.getRealEigenvalues();
    let im = eig.getImagEigenvalues();
    
    if(debug){
        console.log("re:",re);
        console.log("im:",im);
        console.log("matr:", m);
        console.log("determinant:%s\n", det);            
        console.log('diag:\n',diag);
    }
    let uv = [];  // vectors n U4
    let hv = [];   // vector in H4
    let sev = []; // string representgation of splanes
    let periods = [];
    let rotations = [];
    let elliptics = [];
    let fp = [];   // fixed points 
    let hasTranslation= false;
    let hasRotation = false;
    
    
    let n = 5;
    let dm = new Jama.Matrix(n,n);  // matrix of dot(vi,vj)
    //console.log('mev:', mev);
    for(let i = 0; i < n; i++){
        let p = [];
        for(let j = 0; j < n; j++){
            p.push(mev.get(j,i));            
        }
        let pu = H4toU4(p); 
        hv.push(p);
        uv.push(pu);
        sev.push(splaneToString(pu));        
        //periods.push(Math.log(re[i]));
    }

    
    for(let i = 0; i < n; i++){
        
        if(abs(im[i]) < EPS) {
           // candidate for hyperbolic translation, they re cominmg in pairs s, 1/s
           if(abs(abs(re[i]) - 1.0) > EPS ){ 
               // hyperbolic translation 
               hasTranslation = true;
               periods.push(Math.log(re[i]));
               fp.push(uv[i]);
           }
       } else {  // has rotation they are coming in pairs           
           hasRotation = true;
           rotations.push( Math.atan2(im[i], re[i])/Math.PI);
           elliptics.push(uv[i]);
       }
    }
    if(debug){
        if(hasTranslation){
            for(let j = 0; j < fp.length; j++){
                let f = fp[j]; 
                console.log(`fp[${j}] = ${splaneToString(f)}`);                
                for (let i = 0; i < uv.length; i++) {
                    let u = uv[i];
                    let dist = iDistanceU4(u, f);
                    console.log(`dist[${i}] = ${dist.toFixed(7)}`);
                }
            }
        }
    }
            
    //res.hv = hv;
    res.det = det;
    res.uv = uv;
    res.re = re;
    res.im = im;    
    res.hasRotation = hasRotation;
    res.hasTranslation = hasTranslation;
    res.periods = periods;
    res.rotations = rotations;
    //res.sev = sev;
    res.fp = fp;
    res.elliptics = elliptics;
    
    if(debug)console.log("res:",res);        
           
    return res;
}

export const TRANSFORM_TYPES = ['identity', 'reflection', 'half turn',
                                'elliptical(-)', 'elliptical(+)',
                                'parabolic(-)', 'parabolic(+)',
                                'hyperbolic(-)', 'hyperbolic(+)',
                                'loxodromic(-)', 'loxodromic(+)'];

// the types of analyzeTransformH4() by the bits (det > 0) | rotation | translation
const H4_TYPES = ['reflection', 'half turn',
                  'elliptical(-)', 'elliptical(+)',
                  'hyperbolic(-)', 'hyperbolic(+)',
                  'loxodromic(-)', 'loxodromic(+)'];

// the transforms of planar groups are classified by their Moebius matrices
// (invlib/MobiusMatrix.js: isPlanarTransform, classifyMobiusU4)

// the largest power of a rotation looked for
const MAX_ROTATION_POWER = 60;

//
//  the difference of two angles in units of PI, in [-1, 1]
//
function angleDiff(a, b){
  let d = (a - b) % 2;
  if(d > 1) d -= 2;
  if(d < -1) d += 2;
  return d;
}

//
//  if the classified transform c is a power g^n (n = +-1, +-2, ...) of the transform
//  classified as b, return n > 0, else 0
//  periods and rotations are matched within their errors (classifyMobiusU4)
//  and the relative tolerance tol; the period of b^n is known only while the error
//  of b, n times, is below half the period of b (a period of b within its error
//  of 0, a rounded elliptic, would take every longer transform for one of its powers)
//
function powerOf(c, b, tol){
  // the tolerance of c against the n-th power of b
  const eps = (n, v) => c.error + n*b.error + tol*v;
  if(isDefined(b.period)){
    const n = Math.round(c.period/b.period);
    if(n < 1 || n*b.error >= b.period/2 || abs(c.period - n*b.period) > eps(n, c.period))
      return 0;
    if(isDefined(b.rotation) && Math.PI*abs(angleDiff(c.rotation, n*b.rotation)) > eps(n, Math.PI))
      return 0;
    return n;
  }
  if(isDefined(b.rotation)){
    // the rotation by t is the rotation by -t about the other fixed point
    for(let n = 1; n <= MAX_ROTATION_POWER; n++){
      const d = Math.min(abs(angleDiff(c.rotation, n*b.rotation)), abs(angleDiff(-c.rotation, n*b.rotation)));
      if(Math.PI*d <= eps(n, Math.PI))
        return n;
    }
    return 0;
  }
  return 1;
}

function bucketKey(b, prec){
  if(isDefined(b.period) && isDefined(b.rotation))
    return '[' + b.period.toFixed(prec) + ',' + b.rotation.toFixed(prec) + ']';
  if(isDefined(b.period))
    return '[' + b.period.toFixed(prec) + ']';
  if(isDefined(b.rotation))
    return '[' + b.rotation.toFixed(prec) + ']';
  switch(b.type){
    case 'identity':     return '[id]';
    case 'reflection':   return '[ref]';
    default:             return '[par]';
  }
}

//
//  put classified transforms of one type into buckets: each bucket holds the powers
//  (positive and negative) of its shortest transform, named by the bucket key
//  items are sorted by period (or rotation) first, so the shortest comes first
//  whichever order the words were made in; the key is taken from the first made of
//  the transforms of the shortest length (the shortest word, the most precise one).
//  The powers are matched against the most precise transform of the shortest length:
//  the first of them by period is the one whose rounding made its period shortest
//  (a conjugate of a long word, 300 times less precise in par_s2223-11)
//
function fillPowerBuckets(buckets, items, prec, tol){

  const value = c => isDefined(c.period) ? c.period : (isDefined(c.rotation) ? c.rotation : 0);
  const sorted = items.slice().sort((x, y) => (value(x) - value(y)) || (x.index - y.index));
  const bases = [];   // [{res, list, name}]
  for(const c of sorted){
    let n = 0;
    let base = bases.find(b => (n = powerOf(c, b.res, tol)) > 0);
    if(!base){
      base = {res: c, list: [], name: c};
      bases.push(base);
    } else if(n == 1){
      if(c.index < base.name.index) base.name = c;
      if(c.error < base.res.error) base.res = c;
    }
    base.list.push(c);
  }
  for(const b of bases){
    let key = bucketKey(b.name, prec);
    while(buckets[key]) key += "'";
    // in the order the words were made
    buckets[key] = b.list.sort((x, y) => x.index - y.index);
    buckets.count += b.list.length;
  }

} // function fillPowerBuckets

//
//  classify transformation of the group generated with generators
//
//  params:
//    maxCount:  count of transforms to make
//    maxPeriod: transforms with longer translation are ignored
//    precision: relative precision of the splanes of planar groups (classifyMobiusU4)
//    bucketPrecision: relative tolerance of periods and rotations in a bucket of powers (planar groups)
//
export function makeTransformClassificationU4(generators, params= {}){
    
    const FUNNAME = 'makeTransformClassificationU4';
    const debug = false;
    let maxCount = getParam(params.maxCount, 10000);
    let maxPeriod = getParam(params.maxPeriod, 5);
    let precision = getParam(params.precision, MOBIUS_PRECISION);
    let bucketPrecision = getParam(params.bucketPrecision, 1.e-6);

    // container of classified transforms
    let classTrans = {
        acceptedCount: 0,
        ignoredCount: 0,
        count: 0,
     };

    let types = TRANSFORM_TYPES;

    for(let i = 0; i < types.length; i++){
        classTrans[types[i]] = {
            count: 0
        };
    };
    if(debug) console.log(`${FUNNAME}() generators: `, generators);
    //if(debug) console.log(`(generators[0] instanceof ITransform): `, (generators[0] instanceof ITransform));
    if(!(generators[0] instanceof ITransform)){
      generators = GroupUtils.trans2itrans(generators);
      //throw 'generators[0] is not ITransform';
    }

    if(generators.every(isPlanarTransform)){
        // planar group: Moebius matrices, buckets of powers
        classTrans.planar = true;
        let classified = {};  // type -> [res]
        let planarTester = {testTransform: (trans) => {
            classTrans.count++;
            let res = classifyMobiusU4(trans, precision);
            if(res.type === 'unknown' || (isDefined(res.period) && res.period > maxPeriod)){
                classTrans.ignoredCount++;
                return false; // ignore it
            }
            res.word = trans.word;
            res.trans = trans;
            res.index = classTrans.acceptedCount++;
            (classified[res.type] = classified[res.type] || []).push(res);
            return true;
        }};
        GroupUtils.makeTransforms(generators, {maxWordLength:30, maxCount: maxCount, tester: planarTester});
        const prec = 4; // digits of the bucket keys
        for(let type in classified){
            fillPowerBuckets(classTrans[type], classified[type], prec, bucketPrecision);
        }
        return classTrans;
    }

    types = H4_TYPES;
    //
    //  add transform to the buckets 
    //
    function appendTransform(buckets, id, res){ 
        let bucket = buckets[id];                
        if(!bucket){
            bucket = [];  
            buckets[id] = bucket;
        } 
        
        bucket.push(res);
        buckets.count++;
        
    } // function appendTransform
    
    let hyperbolics = [];
    // find into which bucket the new period belongs 
    function findHyperbolicBucket(trans){
        //console.log('findHyperbolicBucket()', trans, hyperbolics.length);
        const EPS = 0.0001; // precision of the bucket 
        for(let i = 0; i < hyperbolics.length; i++){
            let ratio = (trans/hyperbolics[i]);
            //console.log('  ratio: ', ratio);
            if(abs(Math.round(ratio) - ratio) < EPS) {
                // found old bucket 
                //console.log('  found! ');
                return hyperbolics[i];
            } 
        }
        //console.log('  new trans: ', trans);
        // nothing found, add new 
        hyperbolics.push(trans);
        return trans;
    } // function findHyperbolicBucket(trans)

    let loxodromics = [];
    function findLoxodromicBucket(trans, rotation){
        const EPS = 0.0001; // precision of the bucket 
        for(let i = 0; i < loxodromics.length; i++){
            let ratio = (trans/loxodromics[i][0]);
            // we only do search for translation 
            if(abs(Math.round(ratio) - ratio) < EPS) {
                // found old bucket 
                return loxodromics[i];
            } 
        }
        // nothng found, add new 
        loxodromics.push([trans, rotation]);
        return [trans, rotation];
        
    } // function findLoxodromicBucket
    
    // test if it is good transform and store it
    function testTransform(trans, transPoint){
        
        classTrans.count++;
        const prec = 3; // classification buckets precision
        if(debug)console.log('trans: ', trans);
        let m = getMatrixH4(trans);
        let res = analyzeTransformH4(m);
        if(false)console.log('res:', res);
        let typeIndex = 0;
        
        if(res.det > 0)        typeIndex |= 1;
        if(res.hasRotation)    typeIndex |= 2;
        if(res.hasTranslation) typeIndex |= 4;
        let typeName  = types[typeIndex];
        let buckets = classTrans[typeName];
        //console.log('res:', res);
        //console.log('typeName:', typeName);
        let id = 'unknown';
        if(res.hasTranslation){
            // hyperbolic and loxodromic 
            if(abs(res.periods[0]) > maxPeriod){   
                classTrans.ignoredCount++;
                return false; // ignore it                
            } else if(res.hasRotation){
                // loxodromic 
                let lox = findLoxodromicBucket(res.periods[0],res.rotations[0]);
                id = '[' + lox[0].toFixed(prec) + ',' + lox[1].toFixed(prec) + ']';
            } else {
                // hyperbolic 
                let period = findHyperbolicBucket(res.periods[0]);
                id = '[' + period.toFixed(prec) + ']';
            }
        } else if(res.hasRotation){
            // elliptic 
            id =  '[' + res.rotations[0].toFixed(prec) + ']';
        } else {
            id = '[ref]';
        }
        res.word = trans.word;
        res.trans = trans;
        appendTransform(buckets, id, res);
        classTrans.acceptedCount++;
        return true;
    } // function testTransform(trans, transPoint)
    
    let myTester = {testTransform: testTransform};
    
    let transforms = GroupUtils.makeTransforms(generators, {maxWordLength:30, maxCount: maxCount, tester: myTester});
    
    return classTrans;
    
} // function makeTransformClassificationU4
