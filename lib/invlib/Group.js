
import {
  isDefined,
  getParam, 
  GroupUtils,
  iPoint, 
  objectToString,
  ITransform,
  U4, 
} from './modules.js';


const DEBUG = false;

const DEFAULT_POINT = iPoint([0,1, 0.2, 0.3, 0.01]);

const MY_NAME = 'Group';

export class Group {
  
  // this.fundDomain - array of splanes bounding fundamental domain 
  // this.revTransforms  - array of reverse transforms which map tiles of the first crown into fundamental domain 
  // this.transforms - array or direct tranforms which maps FD into first crown 
  
  constructor(arg){
    
    if(isDefined(arg.s)){
      this.fundDomain = arg.s;
      
      if(DEBUG)console.log('%s constructor arg.s: ', MY_NAME, objectToString(this.fundDomain))       
    }
    
    if(isDefined(arg.genNames)){
      this.genNames = arg.genNames;
    }
    
    if(isDefined(arg.t)){
      // old style group initialization - gives the reverse mappings       
      this.revTransforms = arg.t;
      // direct transforms are inverse 
      this.transforms = GroupUtils.makeInverseTransforms(this.revTransforms);      
      //this.itransforms = GroupUtils.makeInverseTransforms(this.revITransforms); 
      
    }
    
    this.init();
    
  }
  
  //
  //  initialize incomplete data members 
  //
  init(){
    
    if(!isDefined(this.transforms)){
      //
      // reflection group, create default transforms 
      //
      this.revTransforms = GroupUtils.makeReflections(this.fundDomain);
      this.transforms = this.revTransforms;
    }
    
    let names = this.getGenNames();
    
    if(false) names.forEach((n, i) => console.log('gen['+i+']='+n));      
         
    // give name to each side 
    let fd = this.fundDomain;
    let trans = this.transforms;
    let rtrans = this.revTransforms;
    let tmap = {};
    this.genMap = tmap;
    
    for(var i = 0; i < fd.length; i++){
      let word = names[i];
      let tran = trans[i];
      let rtran = rtrans[i];      
      //if(DEBUG)console.log('word:', word);
      if(!isDefined(tran.word))tran.word = word; 
      if(!isDefined(rtran.word))rtran.word = GroupUtils.getInverseWord(word); 
      tmap[tran.word]  = tran;
      tmap[rtran.word]  = rtran;     
    }
    
    this.revITransforms = GroupUtils.trans2itrans(rtrans);
    
    
  } // init()
  
  
  /**
    return the sides of the fundamental domain 
  */
  getFundDomain(){
    if(DEBUG)console.log(this.constructor.name + '.getFundDomain():' + objectToString(this.fundDomain));
    return this.fundDomain;
    
  }
  
  /**
    return transforms which maps domain -> cells
  */
  getTransforms(){
    
    return this.transforms;
    
  }
   
  /**
    return transforms which maps abjacent cell into domain 
  */
  getReverseTransforms(){
    
    return this.revTransforms;
    
  }

  /**
    return reverse transforms
    
  */
  getReverseITransforms(){
    
    return this.revITransforms;
    
  }
    
  /**
    return names of group generators 
  */
  getGenNames(){
    
    if(isDefined(this.genNames)) {
      return this.genNames;
    }
    this.genNames = GroupUtils.makeCanonicalGenNames(this);
    return this.genNames;
  }
  
  /**
    return transform corresponding to the given word in generators 
  */
  word2trans(word){
     return GroupUtils.word2trans(this.genMap, word);
  }
  
  /**
      make reverse transforms of the group 
      reverse transforms transform adjacent cells into fundamental domain
      params = {
        maxWordCount:1, 
        maxCount: 100,
        basePoint: iPoint([0.1, 0.2, 0.3, 0.1]),  point to use as test for unique transforms 
        tester: new DefaultTransformTester()
      }
      return ITransform[] 
    
  */
  makeReverseTransforms(params){
    
    return GroupUtils.makeTransforms(this.getReverseTransforms(), params);
    
  }
  
  
  /**
    maps point into Fundamental Domain using sequence or reverse pairing transforms 
    param.pnt iPoint to map, default iPoint([0.1, 0.2, 0.3, 0]) 
    param.maxIterations - maximal number or iteraitons to use, default 20
  */
  toFundDomain(params){
    
    let pnt = getParam(params.pnt, DEFAULT_POINT);
    const maxIterations = getParam(params.maxIterations, 20);
    
    
    const trs = getParam(params.pairingTransforms, this.getReverseITransforms());
    const fd = getParam(params.fundDomain, this.getFundDomain());
    
    
    // start with identity 
    let totalTrans = new ITransform();
    //console.log('totalTrans:' + objectToString(totalTrans));
    let inDomain = false;
    
    for(let k = 0;  k < maxIterations; k++){
      
      let found = false;
      for(let i = 0; i < fd.length; i++){
          //console.log('fd[i]:', fd[i], ' pnt:', pnt );
          if(U4.sigDistanceSP(fd[i], pnt) > 0) {
            // point is outside of that side 
            let tr = trs[i];
            pnt = tr.transform(pnt);
            totalTrans.concat(tr);
            found = true;
            break;
          }
      }
      if(!found){
        // no wrong sides were found, we are in the fundamental domain now
        inDomain = true;
        break;
      }
    } // for(let k = 0;  k < maxIterations; k++){
    
    //console.log('Group.toFundDomain(params) found word: ', totalTrans.getWord());
  return {
          inDomain:inDomain, 
          transform:totalTrans,
          pnt:pnt,
          word: totalTrans.getWord(),
          };    
  } // toFundDomain()
  
  
  /**
    apply given ITransform to the group fund domain and generators 
  */
  applyTransform(trans){
    
    let fd = this.fundDomain;
    //if(DEBUG) console.log('Group.applyTransform(), trans: ', trans);
    
    for(let i = 0; i < fd.length; i++){
      fd[i] = trans.transform(fd[i]);
    }
    
    let revitr = this.revITransforms;
    
    for(let i = 0; i < revitr.length; i++){
      // transform the transformation 
      revitr[i].applyTransform(trans);
      
      // refresh local copies 
      this.revTransforms[i] = revitr[i].ref;
      this.transforms[i] =   GroupUtils.makeInverseTransform(revitr[i].ref.slice());
    }
    
    
  }
  
  /**
    return deep clone of the group and it's transforms 
  */
  clone(){
      
    //if(DEBUG)console.log('Group.clone()'); 
    
    // clone fd 
    let fd = (this.fundDomain);
    let clonedFD = [];
    //console.log('  fd:', fd);       
    for(let i = 0; i < fd.length; i++){ 
      let clonedSide = fd[i].clone();
      clonedFD.push(clonedSide);
    }
    
    //if(DEBUG)console.log('  clonedFD: ', clonedFD); 

    // clone inv transforms
    let trs = (this.revTransforms);
    let ctrs = [];
   
    for(let i = 0; i < trs.length; i++){
      let tr = trs[i];
      let ctr = [];
      ctrs[i] = ctr;
      for(let j = 0; j < tr.length; j++){
        ctr[j] = tr[j].clone();
      }
    }
    let names = this.genNames;
    let cnames = [];
    for(let i = 0;i < names.length; i++){
      cnames[i] = names[i];
    }
    return new Group({s:clonedFD, t: ctrs, genNames: cnames});
    
  }
  
  
} // class Group 