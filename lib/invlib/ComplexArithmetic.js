///////////////////////////////////////////////////////////////////////////
// Complex Arithmetic
// complex numbers are [re,im]

import {sin,cos,cosh, sinh, sqrt,tanh,atanh,abs,SHORTEPSILON,EPSILON,arrayToString,objectToString} from './modules.js'
import {SPLANE_PLANE,SPLANE_SPHERE,iPlane,iSphere} from './modules.js'

export class complexN{
  constructor(x,y){
    this.re=x,
    this.im=y
  }
  
  //convert to string
  toString(forMathematicaQ=false,prec=4){
    if(forMathematicaQ){
      return this.re.toFixed(prec)+"+ "+this.im.toFixed(prec)+" I"}
    else return arrayToString([this.re,this.im], forMathematicaQ, prec)
  }

    
  // the argument of this; returns a real number
  arg(){ /*
    var r=this.re, i = this.im;
    // returns 0 for [0,0]
    if(r==0){ 
      if(i==0) {return 0} 
      else if(i<0){return -hpi} 
      else return hpi}
    else if (r<0){
      if(i>0){
        return atan(i/r)+pi}
      else {return atan(i/r)-pi} 
      }
    else {return atan(i/r)}*/
    return Math.atan2(this.im, this.re)
  }
  
  // the modulus, or absolute value of this; returns a real number
  abs(){
      return Math.sqrt(this.re*this.re+this.im*this.im)
  }
  
  toArray(){
    return [this.re,this.im]
  }
  
  copy(){
    return new complexN(this.re, this.im)
  }
  
  
  //  Note that these arithmetic operations change this, and return this.
  // Further commands below return a new complexN.
  
  // inverts this and returns this
  inv(){
    var ss = this.re*this.re+this.im*this.im;
    this.re = this.re/ss;
    this.im = this.im/ss;
    return this;
  }
  
  // conjugates this and returns this
  conj(){
    this.im=-this.im;
    return this;
  }
  
  // takes the square root of this and returns this
  rt(){
      var a = this.abs();
    var sign; if(this.im<0){sign = -1} else{sign = 1};
      this.im = sqrt(a)*sqrt(.5*(1+this.re/a));
    this.re = sign*sqrt(a)*sqrt(.5*(1-this.re/a));
      return this;
  }
  
  // add a complex number c to this; return this
  add(c){
    this.re+=c.re;
    this.im+=c.im;
    return this;
  }
  
  // subtract a complex number c to this; return this
  sub(c){
    this.re-=c.re;
    this.im-=c.im;
    return this;
  }
  
  // multiply a complex number or number  c to this; return this
  mul(c){
    if(c instanceof complexN){
      var re = this.re*c.re-this.im*c.im;
      this.im = this.re*c.im+this.im*c.re;
      this.re = re;
    }
    else if((typeof c)== "number"){
      this.re = this.re * c;
      this.im = this.im * c;
    }
    
    return this;
  }
  

  // divide a complex number c to this; return this
  div(c){
    var r = c.re, i = c.im;
    this.times(c.invert());
    c.re = r; 
    c.im = i;
    return this;
  }
  
  /*
  // returns the (real) distance in the poincare disk from this to a point c.
  // the version below is superior, using 
  poincareDiskDistanceTo(c){
    var v = this.copy();
    var w = c.copy();
    var one = new complexN(1,0);
    var vv = v.copy().conj();
    
    return 2*atanh(
      ((w.sub(v)).div(one.min(vv.conj().mul(w)))).abs())
    
  }*/
  
  
  //  Note that these arithmetic operations do not change this, and return a new copy.
  
  // returns a new complexN = 1/this
  invert(){
    var ss = this.re*this.re+this.im*this.im;
    return new complexN(this.re/ss,-this.im/ss)
  }
  
  // returns a new complexN = conjugate of this
  conjugate(){
    return new complexN(this.re, -this.im);
  }
  
  // returns a new complexN = a sqrt of this
  sqrt(){
      var a = this.abs();
    var sign; if(this.im<0){sign = -1} else{sign = 1};
      return new complexN(sqrt(a)*sqrt(.5*(1+this.re/a)),sign*sqrt(a)*sqrt(.5*(1-this.re/a)))
  }
  
  // returns a new complexN = this + c
  plus(c){
    return new complexN(this.re+c.re,this.im+c.im);
  }
  
  // returns a new complexN = this - c
  minus(c){
    return new complexN(this.re-c.re,this.im-c.im);
  }
  
  // returns a new complexN = this * c
  times(c){
    if(c instanceof complexN){
      return new complexN(this.re*c.re-this.im*c.im,this.re*c.im+this.im*c.re);
    }
    else if((typeof c)== "number"){
      return new complexN(this.re*c, this.im*c);
    }
    // othewise, nothing happens
  }
  

  // returns a new complexN = this / c
  // maybe better to call this "dividedBy"
  divide(c){
    return this.times(c.invert());
  }
  
  // returns the (real) distance in the poincare disk from this to a point c.

  poincareDiskDistanceTo(v){
    var one = new complexN(1,0);
    var w=this;
    return 2*atanh(
      ((w.minus(v)).divide(one.minus(v.conjugate().times(w)))).abs())
  }
  
  
  // applies a mobius transformation to c
  // c.applyMobius(m) has the same functionality as m.applyTo(c)
  applyMobius(m){
    if(m instanceof diskPreservingMobiusTransform){
      var Z = m.opQ ? this : this.conjugate();
        return (Z.times(m.a).plus(m.c.conjugate())).divide(Z.times(m.c).plus(m.a.conjugate()))
    }
    else if (m instanceof mobiusTransform)
    {  var Z = m.opQ ? this : this.conjugate();
        return (Z.times(m.a).plus(m.b)).divide(Z.times(m.c).plus(m.d));
    }
    else // presuming that m is an array [A,C,opQ]
    {
      return this.applyMobius(new diskPreservingMobiusTransform(m));
    }
  }
  
}

// returns the complexN that is distance d along the real axis from the origin.

export function poincarePt(d){
  return new complexN(tanh(d/2),0)
}

// in general...
export class mobiusTransform{
  constructor([a,b,c,d,opQ]){
    this.a=a;
    this.b=b;
    this.c=c;
    this.d=d;
    this.opQ=opQ; // is the transform orientation preserving?
  }
  
  // None of this has been written!!
  
}






// a mobius transform preserving the unit disk is specified by a,c, opQ
// where a and c are complexN's opQ is boolean. The transform takes
// z-> (a.times(Z) + c.conjugate()).divide((c.times(Z) + a.conjugate())
// where Z = z if opQ (orientation preserving), or z.conjugate() otherwise


export class diskPreservingMobiusTransform{
  constructor([a,c,opQ]){ 
    // this can accept a, c in array form, or as complex numbers, independently
    this.a = (Array.isArray(a) && a.length>1)? (new complexN(a[0],a[1])) : a;
    this.c = (Array.isArray(c) && c.length>1)? (new complexN(c[0],c[1])) : c;
    this.opQ = opQ;
  }
  
  
  // puts a mobius transform in standard form, so that equivalence can be tested.
  // We DO affect this -- there is no reason to keep the unnormalized transform
  normalize(){
    var a = this.a.re, A = this.a.im, c = this.c.re, C = this.c.im;
    var ss = a*a+A*A-c*c-C*C;
    ss = sqrt(ss);
    // gotta like this operator
    var sign = a<0? -1: a>0? 1 : A<0? -1: A>0? 1: c<0? -1 : c>0? 1 : C<0? -1 : 1;
    
    this.a.re *= sign/ss;
    this.a.im *= sign/ss;
    this.c.re *= sign/ss;
    this.c.im *= sign/ss;
    return this
  }
  
  // returns a boolean, true if sufficiently close together
  equal(m){
    return (
      (this.opQ == m.opQ) &&
      (  (  (abs(this.a.re-m.a.re)<SHORTEPSILON) && (abs(this.a.im-m.a.im)<SHORTEPSILON) &&
          (abs(this.c.re-m.c.re)<SHORTEPSILON) && (abs(this.c.im-m.c.im)<SHORTEPSILON))
        ||
        (  (abs(this.a.re+m.a.re)<SHORTEPSILON) && (abs(this.a.im+m.a.im)<SHORTEPSILON) &&
          (abs(this.c.re+m.c.re)<SHORTEPSILON) && (abs(this.c.im+m.c.im)<SHORTEPSILON))
      )
    )
  }
    
  

  applyTo(z){
    if(z instanceof "complexN"){
      var Z = this.opQ ? z : z.conjugate();
        return (Z.times(this.a).plus(this.c.conjugate())).divide(Z.times(this.c).plus(this.a.conjugate()))}
    else // a short cut, if z is an array [x,y]
    {  return this.applyTo(new complexN(z[0],z[1]));
    }
  }
  
  // returns a new mobius transform;
  // z.applyMobius(this.composeWith(m))  ==  z.applyMobius(this).applyMobius(m)
  // Less clearly:
  // (this.composeWith(m)).applyTo(z)) == m.applyTo(this.applyTo(z))
  // In other words, the action is really left to right: z acted on by this acted on by m.
  // Presumes these are both of the correct instanceof
  composeWith(m){
    var ta = m.opQ ? this.a : this.a.conjugate();
    var  tc = m.opQ ? this.c : this.c.conjugate();
    var ma = m.a, mc = m.c;
  
    return new diskPreservingMobiusTransform(
      [ma.times(ta).plus(tc.times(mc.conjugate())),
      ta.times(mc).plus(tc.times(ma.conjugate())),
      (m.opQ && this.opQ)|| !(m.opQ || this.opQ)])
    }
  
    
    
  //convert to string
  toString(forMathematicaQ=false,prec=10){
    var out="";
    if(forMathematicaQ)
    {
      if(this.opQ)
      {
        out="Mobius[{";
      }
      else
      {
        out ="ConjugateMobius[{";
      }
      out+=this.a.toString(forMathematicaQ,prec)+","+this.c.toString(forMathematicaQ,prec)+"}]";
    }
    else{
      out=objectToString(this) // not really sure about this....
        // TO DO:   keep a registry of types that handle their own print commands
        // objectToString checks this 
      
    }
    return out
  }
  
}


// this is shorthand, to make the code more readable:
export function makeMobius(x){
  return new diskPreservingMobiusTransform(x);
}

// compose a bunch of mobius transformations, 0th one applied first
export function composeListOfMobiusTransforms(mobList){
    var mob = makeMobius([[1,0],[0,0],true]);
    mobList.forEach(function(m){
        mob = mob.composeWith(m)
    })
    return mob
}

// a shortcut

export function compMob(moblist){
  return composeListOfMobiusTransforms(mobList);
}

// Miscellaneous transforms;
// Functions that return a mobius transformation that preserves the unit
// disk have names that begin with poincareMobius

/*
// returns a point
function poincareRotationAbout0(cc,theta){
  return cc.times(new complexN(cos(theta),sin(theta)))
}

// returns a point
function poincareRotationAboutW(cc,ww,theta){
  return cc.applyMobius(poincareMobiusRotationAboutPoint(ww,theta));
}
*/

// returns a transform
export function poincareMobiusRotationAboutPoint(ww,theta){
    var ep = new complexN(cos(theta/2),sin(theta/2));
    var em = ep.conjugate();
    var WW = ww.conjugate();
    return makeMobius(
    [ep.minus(em.times(WW).times(ww)),
      WW.times(ep.minus(em)),true]);
}

/*
// returns a point
// move cc by the transform taking vv towards ww by distance dd
function poincareTranslate(cc,v,w,dd){
    return  cc.applyMobius(poincareMobiusTranslateByD(v,w,dd));
}
*/

// from v towards w by distance dd
export function poincareMobiusTranslateFromToByD(v,w,dd){
    var W = w.conjugate();
    var V = v.conjugate();
    var t = tanh(dd/2);
  var one = new complexN(1,0);
  var d = new complexN(-(((w.minus(v)).times(v.times(W).minus(one)))).abs(),0)
   return makeMobius(
    [d.plus(w.times(V).minus(v.times(W)).times(t)),
      (V.plus(V.times(w).times(W))).minus(W.plus(W.times(v).times(V))).times(t),
    true]);
}

// returns the transform taking C all the way to D 
// HOWEVER, this doesn't have the right framing
// Needs to be reimplemented to be fully correct.
export function poincareMobiusTranslateFromTo(c,d){
  var x=c.re, y=c.im, a = d.re, b=d.im;
  var u = 1+x*a-y*b;
  var v = y*a- x*b;
  var w = a-x;
  var z = y-b;
  var s = sqrt(u*u+v*v+w*w+z*z)
   return makeMobius([[u/s,v/s],[w/s,z/s],true])
}


// the transform taking v to 0; v is complexN
export function poincareMobiusTranslateToO(v){
    return makeMobius([[-1,0],v.conjugate(),true])
}


// starting at current, facing away from last, turn by angle and move distance, 
// returning the destination
export function poincareTurtleMove(last,current,angle,distance){
  var temp = last.applyMobius(poincareMobiusRotationAboutPoint(current,angle));
  var dist = last.poincareDiskDistanceTo(current);
  var mob = poincareMobiusTranslateFromToByD(
        current,
        temp,
        distance-dist);
  return temp.applyMobius(mob)
}

// This takes the arc v1-v2 to the arc w1-w2; 
// It is presumed that the arcs have the same length.

export function poincareMobiusEdgeToEdge([v1,v2],[w1,w2],shift=0)//v1,v2,w1,w2 are complexN
{  
    var mm = makeMobius([[-1,0],v1.conjugate(),true]);
    var vv = v2.applyMobius(mm);
  var cc = vv.re/(vv.abs());
  var one = new complexN(1,0);
  var minus = new complexN(-1,0);
   var sign = vv.im<0? -1 : 1;
  var rotMobV = makeMobius(
      [[sqrt(.5*(1+cc)), -sign * sqrt(.5*(1-cc))],[0,0],true]);
   var transX=makeMobius([[1,0],[tanh(shift/2),0],true]);
    var ww = w1.applyMobius(makeMobius([minus,w2.conjugate(),true])); 
  var cc = ww.re/(ww.abs());
    var sign = ww.im<0? sign=-1 : sign = 1;
    var rotMobW = makeMobius([[sqrt(.5*(1+cc)), sign * sqrt(.5*(1-cc))],[0,0],true]);
   return composeListOfMobiusTransforms(
    [makeMobius([minus,v1.conjugate(),true]),
                       rotMobV,transX,rotMobW,
    makeMobius([one,w2.conjugate(),true])])
}


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
//
//  Centers of inversion
// 
// Express transforms as sequences of inversions;
// For each of these,
// The input is complex, the output is sPlane
//
//  NOTE: There are bad numerical problems when a reflection is close to, but not, across a line,
//  i.e. across a very large sphere. MUCH BETTER TO AVOID this by ensuring that we are in general
//  position as much as possible. 
// 
// We use the command convertToSplane as we go, which takes in inversions that preserve the 
// unit circle, specified (prior to conversion) as [c,r]
// r=0 implies c is a normal to a line, with orientation as given.
// r=1 implies c is the center of a circle, oriented "outwards"
// r=-1 implies c is the center of a circle, oriented "inwards"
// The radius of such a circle will be sqrt(c.c - 1)
// convertToSplane checks to see if a circle is very large, and if so, converts it to a line.
// Finally, convertToSplane passes this into the construction functions iSphere, iPlane.

// We may also wish to include the points bounding the ends of an arc or a line segment.

export const MAX_RADIUS_SPHERE_SQD = Number.MAX_SAFE_INTEGER/32; //This is probably larger than necessary


export function splaneIt([c,r],ends){ 
  //r will be 1,-1 or 0
  //c will be an array [x,y]; 
  //(There's no reason to use complex #'s because this function is used solely to help 
  //format output from the following as splanes. 
  //ends will be complex but converted to arrays of reals, which iSphere and iPlane will 
  //further convert into a pair of reals. 
  var magCenterSqd = c[0]*c[0]+c[1]*c[1];
  if(r==0){
    if(abs(magCenterSqd)<EPSILON){
      return iPlane([0.,0.,0.,0.])
    }
    else{
      return iPlane([c[0]/sqrt(magCenterSqd),c[1]/sqrt(magCenterSqd),0.,0.])}
    }
  else { 
    if (magCenterSqd<1){
      console.log("uh oh!");
    }
    var radius = sqrt(magCenterSqd-1);
    // we check to see if we have a really big sPlane;
    // assuming the circle is perp to unit circle, the actual
    // radius of the circle is sqrt(magCenter - 1) -- note that magCenter should be >=1
    if(magCenterSqd>MAX_RADIUS_SPHERE_SQD)
    {  var magCenter = sqrt(magCenterSqd);
      if(!ends){
        // note magCenter-radius will be essentially 0.
        return iPlane([-r*c[0]/magCenter,-r*c[1]/magCenter,0,magCenter-radius])
      }
      else
      {
        return iPlane([-r*c[0]/magCenter,-r*c[1]/magCenter,0,magCenter-radius],
          ends.map(x=>x.toArray()))
      }
    }
    else
    {  if(!ends)
      {return iSphere([c[0],c[1],0., r*radius])}
      else
      { return iSphere([c[0],c[1],0., r*radius],ends.map(x=>x.toArray()))
        }
    }
  }
  // if ends not defined, this is checked and caught in iSphere
}


// pt1 and pt2 are complexN's
// returns the center of the circle to invert through to swap pt1 and pt2, 
// and preserving the unit circle, and the geodesic between pt1 and pt2
// We use short epsilon because we can be sure that points really are far apart if they are distinct
export function sPlaneSwapping(pt1,pt2){
    var out;
  var a = pt1.re, A=pt1.im,b=pt2.re,B=pt2.im;
    var AA=a*a+A*A, BB = b*b+B*B, DD = AA-BB;
  if (abs(a-b)<SHORTEPSILON && abs(A-B)<SHORTEPSILON)
  {
    // these are the same point; any inversion preserving the point will do. Let's 
    // take the simplest: 
    out=[[-A,a],0]
  }
  else if(abs(DD)<SHORTEPSILON){
    // the points have the same magnitude, and we reflect across a line through the origin
    // note that the closer in magnitude the points are, the greater the radius of the circle
    // inverting them. 
    out= [[a-b,A-B],0]
  }
  else{ 
      var center = [(b*(AA-1)-a*(BB-1))/DD, (B*(AA-1)-A*(BB-1))/DD];
      out= [center, 1]} //not worrying about orientation
   return splaneIt(out);
}


// the center of the circle through pt1 and pt2 that is also perp to the unit circle.

// If the "circle" is a straight line through the origin, r= 0 and  c is the 
// normal that is 90° clockwise from the vector p2-p1
// Otherwise, c is the center of the circle and r=1 if p1 to p2 is a  clockwise
// short arc, r=-1 otherwise (i.e. r = 1 if the vector to the center is clockwise from 
// the vector p2-p1)

export function sPlaneThrough(pt1,pt2,ends){ //ends is passed to splaneIt
  var a = pt1.re, A=pt1.im,b=pt2.re,B=pt2.im;
  var out;
  if(a==b && A==B){
    // we have a problem if pt1 = pt2
    out=[[0,0],0];
  }
  else if(a==0 && A == 0){ // [a,A] is the origin. 
    // the clockwise from B direction.
    var BB = sqrt(B*B+b*b);
    out= [[B/BB,-b/BB],0]
  }
  else if(b==0 && B == 0){ // [b,B] is the origin. 
    // the counter clockwise from A direction. (clockwise from -A)
    var AA = sqrt(A*A+a*a);
    out= [[-A/AA,a/AA],0]
  }
  else{
    var DD=2*(-A*b+a*B);
    if(abs(DD)<SHORTEPSILON)
    // If DD is very small, we will have a very large circle
    // and will use a line instead.
    // We could go ahead and compute the radius exactly to make this test, 
    // but since we're just guessing anyway, this should be a good stand-in
    { // This is the vector pt2-pt1, rotated 90° and normalized
      var u=b-a, v = B-A, n= sqrt(u*u+v*v);
      out=[[v/n,-u/n],0]
    }
    else{
      var AA=1+a*a+A*A, BB = 1+b*b+B*B;
      var center = [(AA*B-A*BB)/DD,(-AA*b+a*BB)/DD];
      var r=1;
      if (center[0]*(B-A)+center[1]*(a-b)>0){
        // is pt1 to pt2 to c clockwise?
        r=-1};
      out= [center, r ]
    }
  }
  return splaneIt(out,ends);
}

export function sPlaneThroughPerp(pt1,pt2){ 
  //through pt1, perp to geodesic through pt1 & pt2
  
  var a = pt1.re, A=pt1.im,b=pt2.re,B=pt2.im;
  var out;
  if(a==b && A==B){
    // we have a problem if pt1 = pt2
    out=[[0,0],0];
  }
  else if(a==0 && A == 0){ // [a,A] is the origin. The normal to the line through B
    // is of course B, normalized.
    var BB = sqrt(B*B+b*b);
      out= [[b/BB,B/BB],0]
  }
  else{
    var AA=1+a*a+A*A, BB = 1+b*b+B*B;
    var DD=2*(-A*b+a*B);
    if(abs(DD)<SHORTEPSILON){
      //then there is a straight line between them, and return the geodesic perp to this
      out= [[(a*a+1)/a/2,(A*A+1)/A/2],1]
    }
    else{
      var c=(AA*B-A*BB)/DD, C = (-AA*b+a*BB)/DD;
      var DD = a*C-c*A;
      if(abs(DD)<SHORTEPSILON){
        // then pt1 is close to the middle of the geodesic arc through pt1 and pt2
        // take the straight line through pt1
        AA=sqrt(AA-1);
        out = [[a/AA,A/AA],0]
      }
      else{out =[[(C*AA/2-A)/DD,(-c*AA/2+a)/DD],1];}
    }
  }
  return splaneIt(out)
  
}

export function sPlanesThrough(ptList){
  var i=0;
  return Array(ptList.length).fill().map(()=>sPlaneThrough(ptList[i],ptList[(i++ +1)%ptList.length]));
}

export function sPlaneReflectAcross(p1,p2){
  return sPlaneThrough(p1,p2)
}


export function sPlanesOfRotation(aboutpt,ang){
  var a = aboutpt.re, A = aboutpt.im;
  var out;
  if(a==0 && A ==0){
    return [
    splaneIt([[cos(ang/2),sin(ang/2)],0]),
    splaneIt([[cos(ang/2),sin(-ang/2)],0])];
  }
  else{
    var angle= ang/4;
    var ss = (a*a+A*A)
    var dd =1+ss*ss-2*ss*cos(angle);
    var s = (-1+ss)*sin(angle);
    var c = (1+ss)*(1-cos(angle));
    var p1 = new complexN((a*c-A*s)/dd,(a*s+A*c)/dd);
    var p2 = new complexN((a*c+A*s)/dd,(-a*s+A*c)/dd);
    var c1 = sPlaneThrough(aboutpt,p1);// includes radius
    var c2 = sPlaneThrough(aboutpt,p2);
    return [c1,c2];
  }
}

  // takes p1 to q1 and p2 to q2, all given as complexN's
  // assumes distances p1 to p2 and q1 to q2 are equal
  // NOTE: this is not correct if p1=q1
  
export function sPlanesMovingEdge1ToEdge2([p1,p2],[q1,q2]){
  var c1,c2;
  
  // we take a moment to see if reflecting across a line will do the job:
  var n0=p1.re-q1.re, n1=p1.im-q1.im;
  var nn = (n0*p2.re + n1*p2.im)/(n0*n0+n1*n1);
  if( (abs(p2.re - 2*n0*nn - q2.re)<SHORTEPSILON)&& 
    (abs(p2.im - 2*n1*nn - q2.im)<SHORTEPSILON)){
    c1 = splaneIt([[n0,n1],0]);
    c2=sPlaneReflectAcross(q1,q2);
  }
  else{
    c1 = sPlaneSwapping(p1,q1);
    var q3 = p2.applyMobius(poincareMobiusFromSplane(c1));
    if(abs(q2.re-q3.re)<SHORTEPSILON && abs(q2.im-q3.im)<SHORTEPSILON){
      c2=sPlaneReflectAcross(q1,q2)
    }
    else{c2 = sPlaneSwapping(q2,q3)}
  }
  return [c1,c2]
}
  

// returns the or. reversing mob transform  inverting through the circle with 
// the given center splane.v[0], splane.v[1] and radius splane.v[3]
// We SHOULD check  (TO DO) to see if the sPlane is perp to the unit circle, to see what kind of mobius
// transform we should use.


//REWORK-- THIS WILL NOT WORK IN GENERAL
// We are assuming the splane preserves the unit disk. 
export function poincareMobiusFromSplane(splane){
  var c= splane.v;
  if(splane.type == SPLANE_PLANE)
  {
    return makeMobius([[-c[1],c[0]],[0,0],false])
  }
  else{
    return makeMobius([[-c[1],c[0]],[0,1],false])
  }
}

export function poincareMobiusFromSPlanesList(cList){
  var m = makeMobius([[1,0],[0,0],true]);
  cList.forEach(function(c){
    m=m.composeWith(poincareMobiusFromSplane(c))
  })
  return m
}

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//
//   Old commands from Inversive.js
//

//
//  return product of 2 complex numbers 
//
export function cDot(a,b){
  return a[0]*b[0] + a[1]*b[1];
}

export function cMul(a,b){
  return [a[0]*b[0]-a[1]*b[1],a[0]*b[1] + a[1]*b[0]];
}

export function cDiv(a,b){
 
  let d = cDot(b,b);
  return [cDot(a,b)/d, (a[1]*b[0] - a[0]*b[1])/d];
  
}

export function cSub(a,b){
  return [a[0]-b[0],a[1]-b[1]];
}

function eLength(v){
  return Math.sqrt(v[0]*v[0] +v[1]*v[1]);
}

export function cLog(v){
  
  var b =  Math.atan2(v[1],v[0]);
  //if (b > 0.0) b -= 2.0*PI;
  return [Math.log(eLength(v)),b];
  
}

export function cExp(v){
  
  // (exp(p.x) * cos(p.y), exp(p.x) * sin(p.y));
  
  var a = Math.exp(v[0]);
  //if (b > 0.0) b -= 2.0*PI;
  return [a*cos(v[1]), a*sin(v[1])];
  
}

export function cArcTanh(v){
  
    var t1 = [1+v[0], v[1]];
    var t2 = [1-v[0], -v[1]];
    
    return  cMul(cSub(cLog(t1),cLog(t2)),[0.5,0]);
}

export function cTanh(v){
    var x = v[0];
    var y = v[1];
    var dd = cosh(x)*cosh(x)*cos(y)*cos(y)+sinh(x)*sinh(x)*sin(y)*sin(y);
    if(dd == 0){ // then what? 
        return NaN;
      }
    else{
      var r = cosh(x)*sinh(x)/dd;
      var i = cos(y)*sin(y)/dd;
    }
    
    return  [r,i];
}

//
//  conformally maps unit disk onto infinite band (-1 < y < 1)
//
export function cDisk2Band(v){
  
  //console.log('cDisk2Band(%7.5f,%7.5f)',v[0], v[1]);
  var at = cArcTanh(v);  
  var b = cMul(at,[4./Math.PI,0]);
  
  //console.log('b: (%7.5f,%7.5f)',b[0], b[1]);
  
  return b;
}

//
//  conformally maps unit disk onto infinite band (-1 < y < 1)
//
export function cBand2Disk(v){
  var b = cMul(v,[(Math.PI)/4.,0]);
  var a = cTanh(b); 

  return a;
}