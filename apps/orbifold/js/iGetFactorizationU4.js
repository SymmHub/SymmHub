import {
    iPlane,
    iSphere,
    iPoint,
    iTransformU4,
   // iReflectU4,
    GroupUtils,
    isProperReflection,
    //iGetBisectorU4,
    iGetBisectorH4,
    iDifferenceU4,
    sqrt,
    eLength,
    mul,
    sin,
    cos,
} from './modules.js';

//
//  basis splanes for U4 
//
//const iBasisSplanes = [iPlane([-1,0,0,0]),iPlane([0,-1,0,0]),iPlane([0,0,-1,0]),iSphere([0,0,0,-1]),iPoint([0,0,0,1])];
const iBasisSplanes1 = [iPlane([-1,0,0,0]),iPlane([0,-1,0,0]),iPlane([0,0,-1,0]),iSphere([0,0,0,-1]),iPoint([0,0,0,1])];



let iBasisSplanes2 = makeTetraBase(1.);
let iBasisSplanes3 = makeShiftedBase([0.123, 0.545, 0.376]);


//
//  makes 4 spheres in the vertices of a tetrahedron inscided in a cube (v,v,v), (-v,-v,-v)
//
function makeTetraBase(v){
    
    // radius of the spheres 
    let r = 2*v;
    
    return [
        iSphere([ v, v, v, r]),
        iSphere([-v,-v, v, r]),
        iSphere([-v, v,-v, r]),
        iSphere([ v,-v,-v, r]),
        iPoint( [0,0,0,    v])];
}

//
//  makes base vectors shifted from origin by p = [x,y,z]
//
function makeShiftedBase(p = [0,0,0]){
    
    
    return [
        iPlane ([1,0,0,p[0]]),
        iPlane ([0,1,0,p[1]]),
        iPlane ([0,0,1,p[2]]),
        iSphere([p[0],p[1],p[2],-1]),
        iPoint ([p[0],p[1],p[2], 1])
        ];
}


const DEBUG = false;

const SPLANE_SPHERE = 1;
const SPLANE_PLANE = 2;
const SPLANE_POINT = 3;




const iPointAtInfinity = iPoint(1.e10,0,0,0);



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
export function iGetFactorizationU4(transform, base = iBasisSplanes3){
    
    if(DEBUG)console.log("iGetFactorizationU4()");
    var t = []; // action of transform on basis vectors
    var e = base;
    var bcount = e.length;
    for(var i =0; i < bcount; i++){
      t[i] = iTransformU4(transform, e[i]);
    }
    const EPS = 1.e-3;
    var ref = [];
    //for(var j = 0; j < bcount; j++){ 
    for(var j = bcount-1; j >= 0; j--){ 
        if(DEBUG) console.log(`t[${j}]=`,t[j]);
        if(DEBUG) console.log(`e[${j}]=`,e[j]);        
        let diff = iDifferenceU4(t[j], e[j]);
        if(DEBUG) console.log(`  diff=`,diff);                
        if(diff > EPS) {
            var b = iGetBisectorU4(t[j], e[j]);
            if(DEBUG) console.log(`   bisector =`,b);
            if(abs(b.v[3]) > 100000) 
                console.error('bad bisector:',b);
                
            //console.log("t:" +  splaneToString(t[j],12) +  ", e:" + splaneToString(e[j],12)+ ", b:" + splaneToString(b,3));
            if(isProperReflection(b)){
              ref.push(b);
              for(var i = 0; i < j; i++){ 
                   let oldt = JSON.stringify(t[i]);
                   t[i] = iReflectU4(b,t[i]);
                   if(abs(t[i].v[3]) > 100000) {
                    if(DEBUG)console.error(' bad transform');                                             
                    if(DEBUG)console.log('   bisector:  %s', JSON.stringify(b));                       
                    if(DEBUG)console.log('   old t[%d]: %s', i, oldt);                       
                    if(DEBUG)console.log('   new t[%d]: %s', i, JSON.stringify(t[i]));  
                   }
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


const debug = false;
var PLANE_EPS = 1.e-6;
let EPS = 1.e-6;

export function H4toU4(v) {

    if(debug)console.log('H4toU4()', v);
    let eps = EPS;
    var eps2 = eps * eps;
    var eps34 = eps;
    var dd = dot(v, v);
    if (dd < eps2) { // zero vector - lost of precision?
        return undefined;
    }
    var norm1 = sqrt(dd);
    var ip = inner(v, v);
    var ipn = ip / norm1;
    if (debug)console.log(`ip: ${ip} ipn: ${ipn}`);

    if (ipn > eps) {
        if (debug)console.log("splane");
        // this is splane
        var norm = 1. / sqrt(ip);
        mulSet(v, norm);
        var r1 = v[4] - v[3];
        if (debug)console.log("r1:", r1);
        if (abs(r1) < PLANE_EPS) {
            // this is plane
            if (debug)console.log("plane:", v);
            return iPlane([-v[0], -v[1], -v[2], -v[3]]);
        } else {
            if (debug)console.log("sphere");
            // this is a sphere
            var r = 1 / r1;
            if (abs(r) < eps)
                return iPoint([v[0] * r, v[1] * r, v[2] * r, r]);
            else
                return iSphere([v[0] * r, v[1] * r, v[2] * r, r]);
        }
    } else if (ipn < -eps) {
        // this is regular point inside of H4
        var den = v[4] - v[3];
        if (abs(den) > eps) {
            return iPoint([v[0] / den, v[1] / den, v[2] / den, sqrt(-ip) / den]);
        } else {
            return iPointAtInfinity;
        }
    } else {
        // point at the horizon in R3 (really S3)
        var den = v[4] - v[3];
        if (abs(den) > eps) {
            return iPoint([v[0] / den, v[1] / den, v[2] / den, 0]);
        } else {
            // point at infinity of Riemann sphere S3
            if (debug)console.log("H4toU4 return pointAtInfinity");
            return iPointAtInfinity;
        }
    }
}
const EPSILON = 1.e-8;
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


export function isInfinity(x){
  return (x > 1/EPSILON);
}

//
// reflect splane x in splane p in U4 representation 
// return ref_p(x)
//
export function iReflectU4(p, x){
    if(debug)console.log('iReflectU4: ', p, x);
    var ph = U4toH4(p);
    var xh = U4toH4(x);
    if((ph) && (xh)){
        let rh = iReflectH4(ph,xh);
        let ru = H4toU4(rh);
        if(debug)console.log('ph: ', ph);
        if(debug)console.log('xh: ', xh);
        if(debug)console.log('rh: ', rh);
        if(debug)console.log('ru: ', ru);        
        return ru; 
    } else {
        console.error("undefined ph: " + splaneToString(p) + "\n  p: " + splaneToString(p,4) + "\n x: ", splaneToString(x,4));
        return x;
    }
  
}

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
//  dot product of two arbitrary vectors 
//
export function dot(u,v){
  var d = 0;
  for(var i = 0; i < u.length; i++){
    d += u[i]*v[i];
  }
  return d;
}

//
// multiply in place vector u by scalar a and return result 
//
export function mulSet(u,a){

  for(var i = 0; i < u.length; i++){
    u[i] *= a;
  }
  return u;
}

function abs(x) {
    return Math.abs(x);
}


export function getEllipticScroll(dir, radius){
    
    console.log('getEllipticScroll()', dir, radius);
    
    let len = eLength(dir);    
    let normDir = mul(dir, 1./len);
    let orth = [-normDir[1], normDir[0]];
    
    let angle = len/radius;

    console.log('normDir: ', normDir);
    console.log('orth: ', orth);
    console.log('angle: ', angle);
    
    let p0 = iPoint([-radius*orth[0],-radius*orth[1], 0, 0]);
    let p1 = iPoint([ radius*orth[0], radius*orth[1], 0, 0]);
    
    
    // polar opposite point
    var ri = 2*radius;
    // inversion sphere
    // si keep p0 fixed and moves p1 to infinity
    var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
    
    var s1 = iPlane([1, 0, 0, p0.v[0]]);
    var ca = cos(angle);
    var sa = sin(angle);
    var s2 = iPlane([ca, sa, 0, p0.v[0] * ca + p0.v[1] * sa]);
    var tr = [];
    tr.push(si); // conjugate rotation by the inversion sphere
    tr.push(s1);
    tr.push(s2);
    tr.push(si);
    return tr;
    
} 

export function test1(){
    
    let rh = [2.626809419287167e-9, -1, 0, -1.0508057882163686e-8, -5.5233595475101514e-15];
    console.log('rh:', rh);
    
    let ru = H4toU4(rh);
    
    
    console.log('ru:', ru);
    
    
}

export function testOrthogonality(vectors){

    console.log('testOrthogonality()');
    let e = vectors;

    console.log('    e:', e);

    let h = [];
    for(let i = 0; i < e.length; i++){
        h.push(U4toH4(e[i]));
    }
    console.log('    h:', h);
    
    for(let i = 0; i < e.length; i++){
        let hij = [];
        for(let j = 0; j < e.length; j++){
            let hi = U4toH4(e[i]);
            let hj = U4toH4(e[j]);
            hij.push(inner(hi, hj).toFixed(8));
        }
        console.log(`hij:`, hij);
    }
   
}

function testEllipticScroll(){
    
    console.log('testEllipticScroll(): '); 
    let r = 0.5;
    let transy = getEllipticScroll([0.01, 0.01], r);
    let transx = getEllipticScroll([0.01, 0.0], r);
    console.log('tr1: ', transy);
    
    let p0 = iPoint([0,r,0,0]);   
    console.log('p0:  ', p0);
    let tpx = p0;
    
    for(let i = 0; i < 5; i++){        
        tpx = iTransformU4(transx, tpx);
        console.log('tpx: ', tpx);
    }

    let tpy = iPoint([0,0,0,0]);   
    for(let i = 0; i < 5; i++){        
        console.log('tpy: ', tpy);
        tpy = iTransformU4(transy, tpy);
    }
    
    let tcomby = [].concat(transy, transx, transy, transx);
    
    console.log('tcomby: ', tcomby);
    p0 = iPoint([0,0,0,0]);   ;
    tpy = iTransformU4(tcomby, p0);
    console.log('comb tpy: ', tpy);
    
    let tcombyn = iGetFactorizationU4(tcomby);
    console.log('tcombyn: ', tcombyn);
    tpy = iTransformU4(tcombyn, p0);    
    console.log('tpy: ', tpy);
    
}

function iGetBisectorU4(v0, v1){
    
    var h0 = U4toH4(v0);
    var h1 = U4toH4(v1);
    var bh = iGetBisectorH4(h0,h1);
    let bs = H4toU4(bh);
    return bs;
}

function testBisector(){

    console.log('testBisector()');
    let v0 = iSphere([ 0.12702113994713665, 0.06217419224466105, -0.10000000029124503, 0.20000000058249015]);
    let v1 = iSphere([0.1, -0.1, -0.1,0.2]);
    console.log('v0: ', v0);
    console.log('v1: ', v1);
    
    let bs = iGetBisectorU4(v0, v1);
           
    console.log('bs: ', bs);
    
}

export function runTests(){
    //testOrthogonality(iBasisSplanes2);
    //testEllipticScroll();
    //testBisector();
    testOrthogonality(makeShiftedBase([0.1, 0.3, 0.2]));
}
