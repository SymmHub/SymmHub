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
    makes shalow copy of the transform
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
    if(isDefined(trans.word))
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

  /**
    apply inverse transform to the splane in U4
  */
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
  
  /**
    return reflections of this transform 
  */
  getRef(){
    return this.ref;
  }
  
  /**
    return inverse transform for this transform 
  */
  getInverse(){
    
    return new ITransform(GroupUtils.makeInverseTransform(this.ref), GroupUtils.getInverseWord(this.word));
    
  }

  /**
    return ITransform which corresponds to translation to the given 3d offset 
  */
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
    
    if(Number.isNaN(angle)){
       console.error('ITransform.getRotation() illegal angle: ', angle);
       angle = 0.;
    }
    if(angle == 0.0) 
      return new ITransform(); // identity 
    
    normalize(axis);
    
    // make a vector orthogonal to the axis 
    //TODO - make two vectors orthogoal to the axis and to each other 
    let e1 = [1,0,0];
    if(eLengthSquared(cross(e1, axis)) < EPSILON) {
      // of 
      e1 = [0,1,0];
    } 
    
    e1 = normalize(orthogonalize(e1, axis));
    
    let e2 = cross(axis, e1);
    //let e2 = [0,1,0];
    
    /*
    let v1 = cross(axis, v0);
    if(dot(v1,v1) == 0.){
      // axis is [1,0,0];
      v0 = [0,1,0];
      v1 = cross(axis, v0);
    }
    
    normalize(v1);
    let v2 = cross(v1, axis);
    */    
    
    let p1 = iPlane([...e1,0]);
    let n2 = combineV(e1, e2, Math.cos(angle/2),Math.sin(angle/2));
    let p2 = iPlane([...n2,0]);
        
    return new ITransform([p1, p2]);
    
  }
  
  static getIdentity(){
      return new ITransform([],'');
  }
  
} // class  ITransform

