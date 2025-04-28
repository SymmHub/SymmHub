import {
  H4toU4,
  U4toH4,
  iReflectH4,
  isDefined,
  GroupUtils, 
  dot,
  mul,
  cross, 
  combineV, 
  iPlane, 
  iSphere,
  normalize, 
  orthogonalize,
  eLengthSquared,
  EPSILON,
  iPoint, 
  sqrt,
  eLength,
  atan2,
  abs,
  iGetFactorizationU4,
} from './modules.js';


/**

  represent inversive transform given as an array of reflections (splanes) 
  
*/
export class ITransform {
  
  constructor(reflections=[], word=''){
    
    this.ref = reflections;
    this.word = word;
    
  }

  /**
    return word associated with theis transform 
  */
  getWord(){
    return this.word;
  }

  /**
    makes shallow copy of the transform
  */
  getCopy(){
    return new ITransform(this.ref.slice(), this.word);
  }
  
  /**
    return deep copy of the transform 
  */
  clone(){
    
    let ctr = this.ref.slice();
    
    // clone reflections 
    for(let i=0; i < ctr.length; i++){
      ctr[i] = ctr[i].clone();
    }
    
    return new ITransform(ctr, this.word);
  }

  
  /**
    concatenates this transform with another one 
  */
  concat(trans){
    
    this.ref = this.ref.concat(trans.ref);
    if(isDefined(this.word) && isDefined(trans.word))
      this.word = this.word + trans.word;
    return this;
  }

  /**
    apply to each splane of this transform the given transform
    this = (T^(-1) * this * T) 
  */
  applyTransform(trans){
    
    
    let ref = this.ref;
    for(let i = 0; i < ref.length; i++){    
      ref[i] = trans.transform(ref[i]);
      //console.log(`ref[${i}]:`, ref[i]);
    }
    
    return this;
    
  }

  doFactorization(){
      if(this.ref.length > 5) {
          this.ref = iGetFactorizationU4(this.ref);
      }
  }

  getLength(){
      return this.ref.length;
  }

  /**
    apply transform to the splane in U4
  */
  transform(p){
    
    let tp = U4toH4(p);
    //console.log('reflect: ', tp);
    // work in H4 representation 
    let ref = this.ref;
    for(let i = 0; i < ref.length; i++){    
      tp = iReflectH4(U4toH4(ref[i]), tp);
    }
    return H4toU4(tp);
  }

  //
  //  apply inverse transform to the splane in U4
  //
  inverseTransform(p){
    
    var tp = U4toH4(p);
    // work in H4 representation 
    const ref = this.ref;
    for(var i = ref.length-1; i >= 0; i--){    
      tp = iReflectH4(U4toH4(ref[i]), tp);
    }
    return H4toU4(tp);
    
  }
    
  //
  // TODO make sure the transform is not identity even if it has non zero reflections count 
  //
  isIdentity(){
    
    return (this.ref.length == 0);    
  }
  
  //
  // return array of reflections of this transform 
  //
  getRef(){
    return this.ref;
  }
  
  //
  //  return inverse transform for this transform 
  //
  getInverse(){
    
    return new ITransform(GroupUtils.makeInverseTransform(this.ref), GroupUtils.getInverseWord(this.word));
    
  }
  
  toStr(digits){
      let s = 'ITransform{ \nword: \'' + this.word + '\', \nref: [\n';
      let r = this.ref;
      for(let i = 0; i < r.length; i++){
          s += r[i].toStr(digits);
          if(i < r.length-1) 
          s += ', \n';              
      }
      s += ']}';
      return s;
  }

  static getIdentity(){
      return new ITransform([],'');
  }

  //
  //  return ITransform which corresponds to euclidean translation to the given 3d offset 
  //
  static getTranslation(offset){
    //if(offset.length < 3) 
    let normal = null;
    switch(offset.length) {
      case 3: 
          normal = [offset[0],offset[1],offset[2]]; 
          break;
      case 2: 
          normal = [offset[0],offset[1],0.]; 
          break;
      case 1: 
          normal = [offset[0],0,0]; 
          break;
      default: console.error("illegal offset: ", offset); 
          return new ITransform(); // identity 
    }
    
    let len = dot(normal,normal);
    if(len == 0.0){
      return new ITransform(); // identity 
    }
    
    len = Math.sqrt(len);
    normal = mul(normal, 1./len); 
    
    let p1 = iPlane([...normal, 0]);
    let p2 = iPlane([...normal, len/2]);
    
    return new ITransform([p1, p2]);
    
  }
  
  /**
    return transform which corresponds to uniform scaling centered at the origin 
  */
  static getScale(scale){
    
    if(scale == 1.0) 
      return new ITransform(); // identity 
    let ss = Math.sqrt(scale);
        
    let s1 = iSphere([0.,0.,0.,1.]);
    let s2 = iSphere([0.,0.,0.,ss]);
    
    return new ITransform([s1, s2]);
    
  }

  /**
    return transform which corresponds to rotation about given axis passing through origin 
    angle should be in radians 
  */
  static getRotation(axis, angle = 0.){
    const debug = false;
    if(Number.isNaN(angle)){
       console.error('ITransform.getRotation() illegal angle: ', angle);
       angle = 0.;
    }
    if(angle == 0.0) 
      return new ITransform(); // identity 
    
    normalize(axis);
    if(debug)console.log('axis: ', axis);
    
    // make a vector orthogonal to the axis 
    //TODO - make two vectors orthogoal to the axis and to each other 
    let e1 = [1,0,0];
    if(eLengthSquared(cross(e1, axis)) < EPSILON) {
      // of 
      e1 = [0,1,0];
    } 
    
    e1 = orthogonalize(e1, axis);
    
    if(debug)console.log('orth e1: ', e1);
    
    normalize(e1);
    if(debug)console.log('norm e1: ', e1);

    let e2 = cross(axis, e1);
    
    if(debug)console.log('e2: ', e2);
    normalize(e2);
    
    if(debug)console.log('norm e2: ', e2);
        
    let p1 = iPlane([...e1,0]);
    let n2 = combineV(e1, e2, Math.cos(angle/2),Math.sin(angle/2));
    let p2 = iPlane([...n2,0]);
        
    return new ITransform([p1, p2]);
    
  }
  
  //
  //  return hyperbolic translation which maps points on the unit circle [(-x,y), (x, y)] into [(-1,0), (1,0)]
  //  x*x + y*y = 1
  //
  static getHyperTranslation(x, y){
      
    x = Math.abs(x);  // this is the assumption 
    if(Math.abs(x - 1) < EPSILON)
        return ITransform.getIdentity();
    //
    // construct inversion circle located at (0,c), and radius r
    //
    let c = y / (1 - x); // 
    let r = Math.sqrt(c*c - 1);
    return new ITransform([iSphere([0,c,0,r]),iPlane([0,1,0,0])]);
  }
  
    
    //
    // return ITransform which maps [p0, p1] into [(-1,0) and (1,0)]
    //
    // it is constructed to keep the unit circle intact 
    //  1) stereographic map plane into unit sphere
    //  2) rotate 2 points into xy plane 
    //  3) rotate points in xy-plane to make the symmetric arout y-axis 
    //  4) apply hyperbolic motion between (0,-1) and (0,1)  to move the points into (1,0) and (-1,0)
    //  5) stereographic map sphere back to plane
    //
    static getTransform_1_1(v0, v1){
        
        const debug = false;
        const EZ = [0,0,1];
        const EY = [0,1,0];
        const EX = [1,0,0];
        
        let p0 = iPoint([v0[0], v0[1], 0., 0]); 
        let p1 = iPoint([v1[0], v1[1], 0., 0]); 

        //
        // transform into surface of the unit sphere
        //
        let tr1 = new ITransform([iSphere([0,0,-1, sqrt(2.)])]);        
        if(debug)console.log('p0: ', p0.toStr(8));
        if(debug)console.log('p1: ', p1.toStr(8));
        let p0t = tr1.transform(p0);
        let p1t = tr1.transform(p1);
        let v0t = p0t.toV3();
        let v1t = p1t.toV3();
        //
        //  v0t and v1t are on the surface of the unit sphere 
        //
        if(debug)console.log('v0t: ', v0t);
        if(debug)console.log('v1t: ', v1t);        
        if(debug)console.log('eLengths: ', eLength(v0t), eLength(v1t));        
        // 
        let n01 = cross(v0t, v1t);

        let len01 = eLength(n01);
        if(debug)console.log('len01:', len01); 
        let tr2;
        
        if(len01 < EPSILON) {
            // points are collinear        
            if(debug)console.log('collinear points!');
            // rotate vt0 toward x axis
            let axis2 = cross(v0t,EX); 
            let sina2 = eLength(axis2);
            let cosa2 = dot(v0t, EX);
            let a2 = atan2(sina2, cosa2);
            if(debug)console.log('axis2: ', axis2);                
            if(debug)console.log('cosa2: ', cosa2, 'sina2:', sina2, 'a2:', a2); 
            
            if(abs(a2) < EPSILON) { 
                // no rotation is needed 
                return ITransform.getIdentity();
                //tr1.concat(tr1);
            }
            normalize(axis2); 
            tr2 = ITransform.getRotation(axis2, a2); 
            return tr1.clone().concat(tr2).concat(tr1);
            //console.log('tr2: ', tr2.toStr(8));
        } else {
            if(debug)console.log('n01:', n01); 
            normalize(n01);
            if(debug)console.log('normalize(n01):', n01);        
            let axis2 = cross(n01, EZ); // axis of rotation to bring n01 to EZ
            let sina2 = eLength(axis2);
            if(abs(sina2) < EPSILON){
                // poins are already in XY plane
                tr2 = ITransform.getIdentity();
                
            } else {
                
                let cosa2 = dot(n01, EZ);
                let a2 = atan2(sina2, cosa2);
                if(debug)console.log('axis2: ', axis2);                
                normalize(axis2);        
                if(debug)console.log('normalized axis2: ', axis2);        

                if(debug)console.log('cosa2: ', cosa2, 'sina2:', sina2, 'a2:', a2);        
                tr2 = ITransform.getRotation(axis2, a2);
            }
        }
        
        let p0t2 = tr2.transform(p0t);
        let p1t2 = tr2.transform(p1t);
        let v0t2 = p0t2.toV3();
        let v1t2 = p1t2.toV3();

        if(debug)console.log('v0t2: ', v0t2);  
        if(debug)console.log('v1t2: ', v1t2);  
        // now v0t1 and v1t1 are in xy plane 
        let mp = combineV(v0t2, v1t2, 0.5, 0.5); // midpoint 
        if(debug)console.log('midpoint: ', mp);  
        let lengthMp = eLength(mp);
        if(debug)console.log('lengthMp: ', lengthMp);
        normalize(mp);
        if(debug)console.log('norm mp: ', mp);  
        let axis3 = cross(mp,EY);
        if(debug)console.log('axis3: ', axis3);  
        let cosa3 = dot(mp, EY);
        let sina3 = eLength(axis3);

        let tr3;
        if(Math.abs(sina3) < EPSILON){
            tr3 = ITransform.getIdentity();
        } else {
            let a3 = atan2(sina3, cosa3);
            if(debug)console.log('a3: ', a3);  

            normalize(axis3);
            tr3 = ITransform.getRotation(axis3,a3);
        }
        
        let p0t3 = tr3.transform(p0t2);
        let p1t3 = tr3.transform(p1t2);
                
        let v0t3 = p0t3.toV3();
        let v1t3 = p1t3.toV3();

        if(debug)console.log('v0t3: ', v0t3);  
        if(debug)console.log('v1t3: ', v1t3);  
        let tr4 = ITransform.getHyperTranslation(v0t3[0], v0t3[1]);

        let p0t4 = tr4.transform(p0t3);
        let p1t4 = tr4.transform(p1t3);
                
        let v0t4 = p0t4.toV3();
        let v1t4 = p1t4.toV3();

        if(debug)console.log('v0t4: ', v0t4);  
        if(debug)console.log('v1t4: ', v1t4);  
        
        return tr1.clone().concat(tr2).concat(tr3).concat(tr4).concat(tr1);
            
    }
  
  
  
} // class  ITransform

