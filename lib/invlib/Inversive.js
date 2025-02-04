/**
  methods to work with inversive geometry 

*/

// note that many more generic functions, consts, etc, have been moved to Utilities
// Vector tools are still here.
import {
     PI,
     acosh, 
     sinh, 
     EPSILON, 
     atan2, 
     sqrt, 
     abs, 
     min,
     max, 
     sin, 
     cos, 
     getParam, 
    isDefined, 
    isFunction,
    objectToString,
    INFINITY,
} from './Utilities.js';

import {dot, mulSet, eDistance} from './LinearAlgebra.js';
import {SpatialHashMap} from './SpatialHashMap.js';
import {complexN} from './ComplexArithmetic.js';

import {
  splaneToString,
  SPLANE_NONE,
  SPLANE_SPHERE,
  SPLANE_PLANE,
  SPLANE_POINT,
  SPLANE_INFINITY,
  iSplane,
  iPoint, 
  iPlane,
  iSphere,
} from './ISplane.js';

import {
  ITransform,
} from './ITransform.js';

import {
  GroupUtils
} from './modules.js';


// iReflect presumes normal is unit length, but iPlane constructor doesn't ensure this.


const REF_DATA_SIZE = 5;  // packed data size of single reflection: [ref[0],...,ref[3],type]

//const iPointAtInfinity = iPoint(INFINITY,0,0,0);
const iPointAtInfinity = iPoint(1.e10,0,0,0);



export function isProperReflection(splane){
  return (splane.type == SPLANE_SPHERE) || (splane.type == SPLANE_PLANE);
}

export function iDistance(splane, point){
  return iDistanceU4(splane, point);
}

//
// signed distance between splane and point in U4 
//
export function iDistanceU4(splane, point){
  
  if(point.type != SPLANE_POINT) throw new Error('point shall be POINT, got: ' + point);
  switch(splane.type){
    case SPLANE_SPHERE:  
      {
        var r = splane.v[3];
        var pv = point.v;
        var sv = splane.v;
        var v = [pv[0]-sv[0],pv[1]-sv[1],pv[2]-sv[2],pv[3]]; 
        var d = sqrt(dot(v,v)) - abs(r);
        if(r > 0.) // solid interior 
          return d;   
        else 
          return -d;  // solid exterior 
      }
    case SPLANE_PLANE:
      {  
        var sv = splane.v;
        var distance = sv[3]; // distance to origin 
        var pv = point.v;
        var normal = [sv[0],sv[1],sv[2]];
        var pnt = [pv[0],pv[1],pv[2]];
        return (dot(pnt, normal) - distance);        
      }        
    case SPLANE_POINT:
      {
        return eDistance(splane.v,point.v);
      }
    default: 
      throw Error('undefined splane type: ', splane);
  }
}

export function getSphereCenter(s){
  return [s.v[0],s.v[1],s.v[2]];
}

export function getSphereRadius(s){
  return s.v[3];
}

export function isInfinity(x){
  return (x > 1/EPSILON);
}

//
// reflect splane x in splane p in H4 representation 
// return ref_p(x) 
//
export function iReflectH4(p, x){
  //console.log('iReflect()', p, x);
    // X = X - 2*P*<P,X>/<P,P>
    var f = 2*inner(p, x)/inner(p, p);
  var y = [];
    for(var i = 0; i < p.length; i++){
        y[i] = x[i] - f*p[i];
    }
    return y;
  
}

/**
  return true if pnt1 equals to pnt2 with precision eps 
*/
export function isEpsilonEqualU4(pnt1, pnt2, eps){
  
  if(pnt1.type != pnt2.type)
    return false;
  
  for(var i = 0; i < pnt1.v.length; i++){
    if(abs(pnt1.v[i] - pnt2.v[i]) > eps) 
      return false;
  }
  return true;
  
}


//
// reflect splane x in splane p in U4 representation 
// return ref_p(x)
//
export function iReflectU4(p, x){
  var ph = U4toH4(p);
  var xh = U4toH4(x);
  if(isDefined(ph) && isDefined(xh)){
    return H4toU4(iReflectH4(ph,xh));    
  } else {
    console.error("undefined ph: " + splaneToString(p) + "\n  p: " + splaneToString(p,4) + "\n x: ", splaneToString(x,4));
    return x;
  }
  
}

//
//
// hyperbolic interpolation between two normalized vectors 
//
function iLerpH4_v0(v1,v2,t){
  var s = 1;//(v1[4]*v2[4] > 0)? 1: -1;
  var v = [];
  for(var i = 0; i < v1.length; i++){
    v[i] = v1[i] + t*(v2[i]-v1[i]);
  }  
  //return normalizeH4(v);
  return v;
}

//
// proper hyperboloic interplolation 
//
function iLerpH4_v1(u,v,t){
  //
  //  d = acosh(p,q);
  //  s = 1-t;
  //  (sinh(sd)u + sinh(td)v)/sinh(d) 
  //
  var d = acosh(abs(inner(u,v)));
  var sinhd = sinh(d);
  var a = sinh((1-t)*d)/sinhd;
  var b = sinh(t*d)/sinhd;
  
  var w = [];
  for(var i = 0; i < v.length; i++){
    w[i] = a*u[i] + b*v[i];
  }  
  return w;
}

//
//  wrapper for debugging
//
export function iLerpH4(v1,v2,t){
    
  return iLerpH4_v1(v1,v2,t);
}



//


export function iLerpU4(u1, u2, a){
  
  var v1 = U4toH4(u1);
  var v2 = U4toH4(u2);
  return H4toU4(iLerpH4(v1,v2,a));
  
}

//
//  transform splane P using sequence of reflections 
//
export function iTransformU4(transform, p){
  
  if(transform instanceof ITransform) 
      return transform.transformU4(p);
    
  if(transform.length == 0) 
    return p;
  
  var tp = U4toH4(p);
  // work in H4 representation 
  for(var i = 0; i < transform.length; i++){    
    tp = iReflectH4(U4toH4(transform[i]), tp);
  }
  return H4toU4(tp);
}

//
//  applies inverse(transform) to splane P using sequence of reflections 
//
export function iInverseTransformU4(transform, p){
  var tp = U4toH4(p);
  // work in H4 representation 
  for(var i = transform.length-1; i >= 0; i--){    
    tp = iReflectH4(U4toH4(transform[i]), tp);
  }
  return H4toU4(tp);
}

export function iGetInverseWord(word){
  return word.split('').reverse().join('');  
}

//
//  invert single transform 
//
export function iGetInverseTransform(trans){
  var inv = [];
  for(var i = 0; i < trans.length; i++){
    inv[i] = trans[trans.length - i -1];
  }
  if(isDefined(trans.word)){
    inv.word = iGetInverseWord(trans.word);
  }
  return inv;
}

/**

  inverse list of transformations 
  
*/
export function iGetInverseTransforms(trans){
  
  var inv = [];
  for(var i = 0; i < trans.length; i++){
    inv[i] =  iGetInverseTransform(trans[i]);
  }
  return inv;
  
}

//
// makes default transforms for reflection group 
//
export function iMakeDefaultTransforms(sides){
  var t = [];
  for(var i = 0; i < sides.length; i++){
    t[i] = [sides[i]];
  }
  return t;
}


//
//  return fixed points of transformation [s1, s2]
//  both splanes are spheres 
//
export function iGetFixedPoints(s1, s2) {
  
  // both splanes have to be spheres 
  if(!(s1.type == SPLANE_SPHERE && s2.type == SPLANE_SPHERE))
    return null;
  // distance between centers 
    var c1 = getSphereCenter(s1);
    var c2 = getSphereCenter(s2);
  var dd = eDistanceSquared(c1,c2);
  var d = sqrt(dd);
  //console.log("c1:",c1[0], c1[1],c1[2]);
  //console.log("c2:",c2[0], c2[1],c2[2]);
  //console.log("d:",d);
  var r1 = getSphereRadius(s1);
  var r2 = getSphereRadius(s2);
  
  // distance of center of common orthogonal sphere from center of sphere1 
  var c = (r1*r1 - r2*r2 + dd)/(2*d);
  var r = sqrt(c*c - r1*r1); // TODO deal with case if spheres intersect
  var p1 = (c-r)/d;  // normalized fixed point closest to s1 
  var p2 = (c+r)/d;  // normalized fixed point closest to s2
  
  // make 
  var fp1 = add(c1,mul(sub(c2,c1),p1));
  var fp2 = add(c1,mul(sub(c2,c1),p2));
  
  return [fp1,fp2];
  
}

//
//  return inversive rotation about axis given as two ends  
//
// rotation is represented as composition of reflections in two spheres 
// arranges symmetrically 
// if angle == 0. those two spheres are equal and have lineEdns as south and north pole 
//
export function getInversiveRotation(end1, end2, normal, angle){
  
  var v12 = sub(end2, end1);
  var dd = 0.25*dot(v12,v12);
  var dy = sqrt(dd);
  var dx = dy*tan(angle);
  var ex = normalize(cross(v12,normal));
  //console.log("ex:",ex[0],ex[1],ex[2]);
  var midpoint = mul(add(end1, end2),0.5);
  var c1 = add(mul(ex, dx), midpoint);  // center of first sphere 
  var c2 = add(mul(ex, -dx), midpoint); // center of opposite sphere 
  var r = sqrt(dx*dx + dd);  // radius of both spheres 
  
  return [iSphere([c1[0],c1[1],c1[2],r]),iSphere([c2[0],c2[1],c2[2],r])];
  
}


export function iGetMaxRefCount(transforms){
  var maxRefCount = 0;
  for(var i = 0; i < transforms.length; i++){
    maxRefCount = max(maxRefCount,transforms[i].length);
  }
  return maxRefCount;
}


//
// pack single pairing transform into float array 
//
function iCumPackTransform(f, start, trans, maxRefCount){
  
  for(var i = 0; i < trans.length; i++){
    var ind = start + i*REF_DATA_SIZE; 
    iPackReflection(f, ind, trans[i]);
  }
  
}

//
// pack single pairing transform into float array 
// adds zeros at the end if necessary 
//
export function iPackTransform(f, start, trans, maxRefCount){
  
  if(trans.length > maxRefCount) {
    console.error('trans.length > maxRefCount: ' + trans.length + ' > ' + maxRefCount);
  }
  for(var i = 0; i < maxRefCount; i++){
    
    var ind = start + i*REF_DATA_SIZE;
    if(i < trans.length){
      // pack real transform 
      iPackReflection(f, ind, trans[i]);
    } else {
      iFillArray(f, ind, REF_DATA_SIZE, 0.0);      
    }
  }
  
}




//
//  fill array f from start with given count values 
//
export function iFillArray(f, start, count, value){
  var end = start + count;
  for(var i = start; i < end; i++){
    f[i] = value;
  }
}

//
// pack reflection ref into float array beginning from start
//
export function iPackReflection(array, start, ref){
  
    if(!isDefined(ref))
      return;
    var len = ref.v.length;
    for(var k = 0; k < len; k++){
      array[start + k] = ref.v[k];
    }
    array[start + len] = ref.type;    
  
}

//
//  return group fundamental domain packed into float[] 
//
export function iPackDomain(domain, maxCount){
  
  
  //var domain = group.s;  
  // packed domain 
  var f = [];
  if(maxCount < domain.length){
    console.error('domain.length > maxCount (' + domain.length + ',' + maxCount + ')');
    return f;
  }
  for(var i = 0; i < maxCount; i++){
    var ind = REF_DATA_SIZE*i;
    if(i < domain.length)
      iPackReflection(f,ind, domain[i]);
    else 
      iFillArray(f, ind,REF_DATA_SIZE, 0.0);
  }
  return f;
}


//
//  return count of reflections in group pairing transforms in array int[]
//

export function iPackRefCount(trans, maxCount){
  
  //var trans = group.t;
  // packed count
  var count = [];

  for(var i = 0; i < trans.length; i++){
    count[i] = trans[i].length;
  }
  // fill the rest with 0 
  for(var i = trans.length; i < maxCount; i++){
      count[i] = 0;
  }
  return count;
}

//  For the purpose of transfer to GPU each transform is padded at the end by identity transforms up to maxRefCount
//  and the whole array is padded by identity transforms the end by 0.0s up to maxTransCount
//

export function iPackTransforms(trans, maxTransCount, maxRefCount){
  
  //var trans = group.t;
  var f = [];
  // packed count
  for(var i = 0; i < maxTransCount; i++){
    var ind = i*maxRefCount*REF_DATA_SIZE;
    if( i < trans.length){
      iPackTransform(f,ind, trans[i], maxRefCount);
    } else {
      iFillArray(f, ind, REF_DATA_SIZE * maxRefCount, 0.0);
    }    
  }
  return f;
}





/**
 return count of reflections in group pairing transforms in array int[]
 handle both cases 
  1) transform is array of arrays of splanes
  2) transform is array of splanes 
*/
export function iPackRefCumulativeCount(trans, maxCount){
  
  //var trans = group.t;
  // packed count
  var count = [];
  
  count[0] = ((trans[0] instanceof Array)? trans[0].length: 1);

  for(var i = 1; i < trans.length; i++){
    
    count[i] = count[i-1] + ((trans[i] instanceof Array) ? trans[i].length : 1);
  }
  // fill the rest with 0 
  for(var i = trans.length; i < maxCount; i++){
      count[i] = 0;
  }
  return count;
}

//
//  return group transforms packed into flat array float[] 
//  each transform is represented by sequence of reflections 
//

//  The individual transforms are not padded; instead, the indices are kept in iCumCount
//  and the whole array is padded by identity transforms the end by 0.0s up to maxRefCount
//  (Note that maxRefCount is now the total number of allowed reflections across all transforms)
//

export function iCumPackTransforms(trans, maxTransCount, maxRefCount){
  
  //var trans = group.t;
  var f = [];
  var cumIndex=0;
  // packed count
  for(var i = 0; i < trans.length; i++){
    var ind = cumIndex*REF_DATA_SIZE; 
    var trn = trans[i];
    if(!(trn instanceof Array)){
      // convert into array 
      trn = [trn];
    }
    cumIndex+=trn.length;
    iCumPackTransform(f,ind, trn, trn.length);
  }    
  iFillArray(f, REF_DATA_SIZE *cumIndex, REF_DATA_SIZE * (maxRefCount-cumIndex), 0.0);
  return f;
}

///////////////////////////////////////////////////////////////////
//
//      transformations
//
//
//  reflect in the splane
//
export function iReflect(s/*plane*/, p/*oint*/){
  //same code as in inversive.frag;
  var x=p[0],y=p[1],z=p[2],a=s.v[0],b=s.v[1],c=s.v[2],d=s.v[3];
  
  if(s.type == SPLANE_PLANE){ // plane
    //we  cannot presume that the plane is normalized
    // (not sure everywhere such planes are created)
    var rr = sqrt(a*a+b*b+c*c);
    a=a/rr; b=b/rr;c=c/rr; d=d/rr;
    var vn = 2*((x-a*d)*a+(y-b*d)*b+(z-c*d)*d);
    return [x - vn*a, y - vn*b, z - vn*c]
    } 
  
  else if(s.type == SPLANE_SPHERE){
    x = x-a; 
    y = y-b;
    z = z-c;
    var l = x*x+y*y+z*z;
    if(l==0){return [NaN,NaN,NaN]}
    var f = d*d/l;
    x=x*f; y=y*f;z=z*f;
    x=x+a; y=y+b; z=z+c;
    return [x,y,z]
  } 
}

//
//  convert splane from U4 -> H4 representation 
//
export function U4toH4(s){
  
  //console.log('U4toH4(s):', s);
  switch(s.type){
    
  case SPLANE_SPHERE:
    var x = s.v[0];
    var y = s.v[1];
    var z = s.v[2];
    var r = s.v[3];  
    var pp = x*x + y*y + z*z-r*r;

    return [x/r, y/r, z/r,(pp - 1)/(2*r),(pp + 1)/(2*r)];

  case SPLANE_PLANE:
    {
      var nx = s.v[0];
      var ny = s.v[1];
      var nz = s.v[2];
      var d  = s.v[3];
      var length = sqrt(nx*nx + ny*ny + nz*nz);
      // negative sign to take to make correct sign in inequality         
      var nd = -length;
      var an = -nd*d;
      return [nx/nd, ny/nd, nz/nd, an/nd, an/nd];
      
    }                       
  case SPLANE_POINT:
    {
      var x = s.v[0];
      var y = s.v[1];
      var z = s.v[2];
      var w = s.v[3];      
      if(isInfinity(x)){
        // point at infinity           
        return [0,0,0,1,1];
      }           
      var pp = x*x + y*y + z*z + w*w; 
      var s = (w > 0.)?(1.):(-1.);
        
      if(abs(w) > EPSILON){
        // normalized H4 vector
        return [x/w,y/w, z/w, (pp-1)/(2*w),(pp+1)/(2*w)];
      } else {
        // point on the horizon (can not be normalized)
        return [x,y,z,(pp-1)/2,(pp+1)/2];
      }
    }
  case SPLANE_INFINITY:
    {
      return [0,0,0,1,1];
    }
  default:
    throw new Error('unknown splane type: ' + s);
  }
  
}

//
//  convert splane from H4 -> U4 representation 
//  v[5] - array of floats 
//  return iSplane, whcih may be planre, sphere, point or point at infinity 
//
export function H4toU4(v){
  //console.log("H4toU4(%s)", v);
  var eps = 1.e-8;
  var eps2 = eps*eps;
  var eps34 = eps;
  var dd = dot(v,v);
  if(dd < eps2){ // zero vector - lost of precision? 
    return undefined;
  }
  var norm1 = sqrt(dd);
  var ip = inner(v,v);
  var ipn = ip/norm1;
  //console.log("ip: %7.3f ipn: %7.3f",ip, ipn);  
  if( ipn > eps) {
    //console.log("splane");
    // this is splane 
    var norm = 1./sqrt(ip);
    mulSet(v,norm);
    var r1 = v[4] - v[3];
    //console.log("r1:%7.3f",r1);      
    if(abs(r1) < eps34){
      // this is plane 
      //console.log("plane:%s",v);  
      return iPlane([-v[0],-v[1],-v[2],-v[3]]);
    } else {
      //console.log("sphere");      
      // this is a sphere
      var r = 1/r1;
      if(abs(r) < eps) 
        return iPoint([v[0]*r, v[1]*r, v[2]*r, r]);
      else
        return iSphere([v[0]*r, v[1]*r, v[2]*r, r]);                
    }            
  } else if(ipn < -eps){
    // this is regular point inside of H4
    var den = v[4] - v[3];
    if(abs(den) > eps) {
      return iPoint([v[0]/den, v[1]/den, v[2]/den, sqrt(-ip)/den]);
    } else {
      return iPointAtInfinity;
    }
  } else {
    // point at the horizon in R3 (really S3)
    var den = v[4] - v[3];
    if(abs(den) > eps) {
      return iPoint([v[0]/den, v[1]/den, v[2]/den, 0]);
    } else {
      // point at infinity of Riemann sphere S3 
      //console.log("H4toU4 return pointAtInfinity");
      return iPointAtInfinity;
    }
  }        
    
}

//
// inner product of two H4 vectors 
//
export function inner(p,q){
  
  var n = p.length-1;
  var ip = 0;
  for(var i = 0; i < n; i++){
    ip += p[i]*q[i];
  }
  ip -= p[n]*q[n];
  return ip;
}

//
//  normalizes splane in H4 representation 
//
export function normalizeH4(p){
  
  var ip = inner(p,p);

  if(ip < -EPSILON) {
      mulSet(p, 1./sqrt(-ip));
  } else if(ip > EPSILON) { 
      mulSet(p, 1./sqrt(ip));
  } else {
      // point has zero norm - keep it intact
  }
  return p;  
}

//
//  bisector of two splanes in H4 representation 
//
export function iGetBisectorH4(s1, s2){
  normalizeH4(s1);
  normalizeH4(s2);
  var b = [];
  for(var i = 0; i < s1.length; i++){
    b[i] = s1[i] - s2[i];
  }
  normalizeH4(b);
  return b;
  
}

//
//  bisector of two splanes in U4 representation 
//
export function iGetBisectorU4(s1, s2){
  var v1 = U4toH4(s1);
  //console.log("v1:%s\n",iArrayToString(v1, 12));
  var v2 = U4toH4(s2);
  //console.log("v2:%s\n",iArrayToString(v2, 12));
  var b = iGetBisectorH4(v1,v2);
  //console.log("b:%s\n",iArrayToString(b, 12));
  
  return H4toU4(b);
}

//
//  basis splanes for U4 
//
const iBasisSplanes = [iPlane([-1,0,0,0]),iPlane([0,-1,0,0]),iPlane([0,0,-1,0]),iSphere([0,0,0,-1]),iPoint([0,0,0,1])];

//
//  convert arbitrary sequence of U4 reflections into short ( <= 5) sequence  
//
//
// works as follows
//
//  1. calculates result of transform t_i = T(u_i) on 5 basis vectors u_i working in U4 
//  2.  
//  for each j {
//      find bisector 
//      b_j = bisectorU4(t_j, u_i);
//      for(each i){
//          t_i -> reflect(b_j,t_i) 
//       } 
//  }
//
export function iGetFactorizationU4(transform){
    //console.log("iGetFactorizationU4()");
    var t = []; // action of transform on basis vectors
    var e = iBasisSplanes;
    var bcount = e.length;
    for(var i =0; i < bcount; i++){
      t[i] = iTransformU4(transform, e[i]);
    }
    const eps = 1.e-10;
    var ref = [];
    //for(var j = 0; j < bcount; j++){ 
    for(var j = bcount-1; j >= 0; j--){ 
        if(isDefined(t[j]) &&  iDifferenceU4(t[j], e[j]) > eps) {
            var b = iGetBisectorU4(t[j], e[j]);
            //console.log("t:" +  splaneToString(t[j],12) +  ", e:" + splaneToString(e[j],12)+ ", b:" + splaneToString(b,3));
            if(isDefined(b) && isProperReflection(b)){
              ref.push(b);
              for(var i = 0; i < j; i++){ 
              //for(var i = j+1; i < bcount; i++){ 
                  t[i] = iReflectU4(b,t[i]);
                  //printf("t[%d]:%s\n", i, str(f,t[i]));                    
              }
            } else {
              //console.error("undefined bisector\n");              
            }
        } else {
            //printf("   ->equal\n");
        }
    }
    //console.log(transformToString(ref,3));
    return GroupUtils.getInverseTransform(ref);
    
}

//
// return difference between 2 splanes 
//
export function iDifferenceU4(s, p){
  
  return iDifferenceH4(U4toH4(s),U4toH4(p));
  
}

export function iDifferenceH4(u, v){
  
    var maxDist = 0;
    for(var i = 0; i < u.length; i++){
      maxDist = max(maxDist, abs(u[i]-v[i]));
    }
    return maxDist;
    
}


/**
  return domain generators count 
*/
export function iGetGeneratorsCount(fd){
  return fd.s.length;
}




/**
  makes default generators names
*/
export function iMakeDefaultGenNames(transforms){
  var names = [];
  let count = transforms.length;
  
  for(var i = 0; i < count; i++){
    names[i] = String.fromCharCode("a".charCodeAt(0) + i);
  }
  
  return names;
}

/**
  return names of generators or default names
*/
export function iGetGenNames(group){
  //if(isDefined(group.genNames))
  if(isDefined(group.genNames))
    return group.genNames;
  else 
    return iMakeDefaultGenNames(group.t);  
}


/**
  recursively add transformed points to the SpatialHashMap 
  @param points - SpatialHashMap 
  @param transforms array of transforms 
  @param transNames - names of individual transforms 
  @param depth count of transforms to apply 
*/
export function iAddLayerOfTransformedPoints(pointsMap, transforms, transNames, minW, layerCount){
  if(layerCount < 1) 
    return;
  
  var size = pointsMap.size();
  
  for(var i = 0; i < size; i++){    
    var pnt = pointsMap.get(i);    
    //console.log("pnt:", splaneToString(pnt));
    for(var k = 0; k < transforms.length; k++){
      var tpnt = iTransformU4(transforms[k],pnt);
      if(abs(tpnt.v[3]) > minW) {
        tpnt.word = pnt.word + transNames[k];
        if(!pointsMap.add(tpnt))
          return;
      }
    }  
  }
  iAddLayerOfTransformedPoints(pointsMap, transforms, transNames, minW, layerCount-1);
}



/**
  applies group transforms to the initial point 
  
  @params.maxCount - max count of transforms to collect
  @params.layerCount - maximal count of transforms (maximal word length) 
  @param.point - base point to transform 
  @param.minW - minimal (relative) value of W component 
*/
export function iMakeTransformedPoints(transforms, params){
  
  params = getParam(params, {});
  var layerCount = getParam(params.layersCount, 1);
  var transNames = params.transNames;
  if(!isDefined(transNames)){
    console.err('undefined transNames');
    return;
  }

  var point = getParam(params.point, iPoint([0.1,0.2,0.,0.01]));
  // w - component of point is important to be non zero to make correct bisectors
  var minW = point.v[3]*getParam(params.minW, 0.01);
  
  point.word = '';  // initial empty word
  
  var map = new SpatialHashMap({maxSize:params.maxCount});
  
  map.add(point);
  
  iAddLayerOfTransformedPoints(map, transforms, transNames, minW, layerCount);
  
  return map.getArray();
  
}

/**
    convert iSplane or Splane[] into ITransform 
    converts Splane[][] into iTransforms[] 
*/
export function splane2transform(splanes){
  
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
  }
  
  throw 'splane2transform(splanes): unrecognized parametes' + splanes;    
}


/**
   makes set of dirichlet planes from points 
   @points - array of iPoint
   planes[i] = bisector(points[0], points[i])
   planes[0] is undefined 
*/
export function iMakeBisectors(points){
  
  var p0 = points[0];
  var planes = [];
  var len = points.length
  for(var k = 1; k < len; k++){
    var bs = iGetBisectorU4(points[k], p0);
    bs.word = points[k].word;
    planes[k] = bs;
  }          
  return planes;
}

/**
  creates generators map and stores it as group.genMap;
  @return generators map
*/
export function getGroupGenMap(group){
  
  if(!isDefined(group.genMap)){
    // named generators map 
    var genMap = {};  
    let gnames = iGetGenNames(group);
    var trn = group.t;
    for(var i = 0; i < trn.length; i++){
      genMap[gnames[i]] = trn[i];
    }
    group.genMap = genMap;
  }   
  return group.genMap;
}

/**
  creates generators map and stores it as group.invGenMap;
  @return generators map
*/
export function getInvGenMap(group){
  
  if(!isDefined(group.invGenMap)){
    // named generators map 
    var gmap = {};  
    let gnames = iGetGenNames(group);
    var trn = iGetInverseGenerators(group);
    for(var i = 0; i < trn.length; i++){
      gmap[gnames[i]] = trn[i];
    }
    group.invGenMap = gmap;
  }   
  return group.invGenMap;
}

/**
  makes transform from word in generators 
  @param group - the group
  @param word - word of generators
  @return transform (array of reflections) 
*/
export function iWordToTrans(group, word){
  
  let len = word.length;
  let trans = [];
  let genMap = getGroupGenMap(group);
  
  for(var i = 0; i < len; i++){
      var tr1 = genMap[word.charAt(i)];
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
  obsolete 
  return map for pairing transforms 
*/
function getPairingMap(group){
  
  if(!isDefined(group.pairingMap)){
    // named generators map 
    var map = {};  
    let gnames = iGetGenNames(group);
    var trn = group.t;
    for(var i = 0; i < trn.length; i++){
      map[gnames[i]] = trn[i];
    }
    group.pairingMap = map;
  }   
  return group.pairingMap;
}


/**
  obsolete 
  return transform for word in pairing transforms
*/
export function word2trans(group, word){
  
  let len = word.length;
  let trans = [];
  let map = getPairingMap(group);
  
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
  obsolete 
  parses string of generators into array of transforms
*/
export function iParseGenerators(group, genStr){
  //console.log("iParseGenerators('%s')",genStr);
  var re = / *, *| +/;   // regexp comma or space separated words 
  var words = genStr.split(re); 

  var trans = []; // array of transforms (one per word) 
  for(var i = 0; i < words.length; i++){
    var word = words[i];
    if(word.length != 0){
      //console.log("word:\'%s\'",word);      
      var tr = word2trans(group,word);
      tr.word = word;
      trans.push(tr);
    } 
  }
  
  return trans;
}

/**
  maps point into fundamental domain
  fundDomain - array of splanes 
  transforms - array of pairing transforms 
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
export function iToFundDomain(fundDomain, transforms, pnt, maxIterations){
    
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


///////////////////////////////////////////
///
///  checking to see if mouse is near an arc
///

export function nearArcQ(pixel, arc, transform, tolerance = 5){
  // pixel is in xy coords;
  // arc could be a Splane, in which case needs to be converted to pixel coords
  // (presumed that no additional transforms are required)
  // or could be a list of bounds and a list of pixels
  // distance is taxicab, and checked to within the tolerance, measured in pixels.
  // If the pixel is not near the arc, return -1000; if the arc is a list of points,
  // return the index of the closest point found.
  // If the arc is a splane without bounds, return the angle of the vector from the pixel to the center.
  // If the arc is a splane with bounds, return the hyperbolic distance from the first bound.
  
  let x = pixel[0];
  let y = pixel[1];
  if(Array.isArray(arc)){// then the arc is a list of pixels
    bounds=arc[0]; //[[min x, min y],[max x, max y]]
    pts = arc[1]; //[[x0,y0],...]
    if(x<bounds[0][0]||x>bounds[1][0]||y<bounds[0][1]||y>bounds[1][1]){
      return -1000;
    }
    let nearQ = false;
    let i = 0;
    while(!nearQ && i<pts.length){
      nearQ = (abs(pts[i][0]-x)<tolerance)&&(abs(pts[i][1]-y)<tolerance);
      if(!nearQ){i++;}
    }
    if(!nearQ){return -1000;}
    // lets just see if we get a closer point:
    let closesthit=pts[i];
    let gettingCloserQ = true;
    while(i<pts.length-1 && gettingCloserQ){
      i++;
      gettingCloserQ=((abs(pts[i][0]-x)+abs(pts[i][1]-y))<(abs(closesthit[0]-x)+abs(closesthit[1]-y)));
      if(gettingCloserQ){closesthit=pts[i];}
      else{i--;}
    }
    return i; //CHANGE TO A DISTANCE IN WORLD COORDINATES
  }
  else{// else we're dealing with a splane
    switch(arc.type){
      case SPLANE_SPHERE:
        let center = arc.v; // center of sphere 
        let rad = arc.v[3]; // signed radius 
        let scenter = transform.world2screen(center);
        let srad = Math.abs(rad) / transform.getPixelSize();
        let dx = x-scenter[0];
        let dy = y-scenter[1];
        let dd = sqrt(dx*dx+dy*dy); //diff of r^2-R^2 is off by r+R
        if(abs(dd-srad)<tolerance){
          //make sure we're also in the right bounds
          // this is a bit problematic
          let arg = atan2(dy,dx);
          if(arc.bounds==undefined){
            return arg;
          }
          /*if(abs(arc.bounds[0]-arc.bounds[1])<PI){
            if(arg>=min(arc.bounds[0],arc.bounds[1]) && arg<=max(arc.bounds[0],arc.bounds[1]) ){
              return arg;
              }
            }
          else{ //presuming that angles correctly are -PI to PI, this arc straddles
            if(arg<=min(arc.bounds[0],arc.bounds[1]) || arg>=max(arc.bounds[0],arc.bounds[1])){
              return arg;
            }
          }
          */
          if( (       abs(arc.bounds[0]-arc.bounds[1])<PI
                  &&  arg>=min(arc.bounds[0],arc.bounds[1]) 
                  &&  arg<=max(arc.bounds[0],arc.bounds[1])
                )
              ||//presuming that angles correctly are -PI to PI, this arc straddles PI=-PI
                arg<=min(arc.bounds[0],arc.bounds[1]) 
              || arg>=max(arc.bounds[0],arc.bounds[1])
            )
            {
              let end1 = new complexN(
                arc.v[0]+abs(arc.v[3])*cos(arc.bounds[0]),
                arc.v[1]-abs(arc.v[3])*sin(arc.bounds[0])
                );
              let end2 = new complexN(
                  arc.v[0]+abs(arc.v[3])*cos(arc.bounds[1]),
                  arc.v[1]-abs(arc.v[3])*sin(arc.bounds[1])
                );
              let mid = new complexN(
                arc.v[0]+abs(arc.v[3])*cos(arg),
                arc.v[1]-abs(arc.v[3])*sin(arg)
                );
              return (mid.poincareDiskDistanceTo(end1))/(end2.poincareDiskDistanceTo(end1));
            }
        }
        break;
    }
  }
  return -1000;
  
}

