import {
  iMakeDefaultGenNames, 
  iGetMaxRefCount, 
  iPackDomain,
  iPackRefCount,
  iPackTransforms,
  iCumPackTransforms,
  iMakeDefaultTransforms,
  iPackRefCumulativeCount
  
} from '../../../lib/invlib/Inversive.js';
  
import {
  iDrawSplane, 
} from '../../../lib/invlib/IDrawing.js';
  
//import {
//} from '../../../lib/invlib/Utilities.js';

import {
  isDefined, 
  getParam,
  splaneToString,
  transformToString,
  objectToString,
} from '../../../lib/invlib/modules.js';


//
// default DomainBuilder 
//  only renders sides of group fundamental domain 
//
export class DefaultDomainBuilder {
  
  constructor(options){
    
    if(!isDefined(options))
      options = {};
    
    var opt = isDefined(options)? options: {};
    this.USE_SAMPLER = getParam(opt.USE_SAMPLER, false);
    this.USE_PACKING = getParam(opt.USE_PACKING, false);
    this.USE_PERMUTATIONS = getParam(opt.USE_PERMUTATIONS, false);
    this.MAX_TOTAL_REF_COUNT = getParam(opt.MAX_TOTAL_REF_COUNT,20);
    this.MAX_REF_COUNT = getParam(opt.MAX_REF_COUNT,4);
    this.MAX_GEN_COUNT = getParam(opt.MAX_GEN_COUNT,3);
    this.MAX_PERM_SIZE  = getParam(opt.MAX_PERM_SIZE,3);
    this.MAX_CROWN_COUNT = getParam(opt.MAX_CROWN_COUNT,3);
    this.MAX_TOTAL_CROWN_COUNT = getParam(opt.MAX_TOTAL_CROWN_COUNT,20);
        
		this.params = {
      showBaseGens: false,
      debug: false,
    };
    this.fdpts=[]; //for checking to see if we are clicking on the walls of a fd

    //this.USESAMPLER = getParam(options.USESAMPLER, false);
    //this.USEPACKING = getParam(options.USEPACKING, false);
    //this.MAX_TOTAL_REF_COUNT = getParam(options.MAX_TOTAL_REF_COUNT,20);
    //this.MAX_REF_COUNT = getParam(options.MAX_TOTAL_REF_COUNT,4);
    //this.MAX_GEN_COUNT = getParam(options.MAX_GEN_COUNT,3);

    
  } // constructor 
  
  /**
    return params to save 
  */  
  getParamsMap(){
    
    var p = this.params;
    
    return {
      showBaseGens:p.showBaseGens,
    };
  }

  /**
    set params from saved map 
  */  
  setParamsMap(paramsMap){
    this.controllers.showBaseGens.setValue(paramsMap.showBaseGens);
  }
  
  
  
  
  //
  //
  //
  initGUI(options){
    
    this.onChanged = options.onChanged;
    this.groupMaker = options.groupMaker;  
    var gui = options.gui;
    var folder = options.folder;
    this.folder = folder;
    var onc = options.onChanged;
    
    var par = this.params;
    this.controllers = {};
    
    this.controllers.showBaseGens = folder.add(par, 'showBaseGens').onChange(onc).name("generators");
		folder.add(par, 'debug');
        
    gui.remember(par);
    
  } // initGUI()


  /**
    return defines to be used for GPU rendering 
  */
  getDefines(un, timeStamp){
    
    var defines = '';
    
    defines += `#define MAX_GEN_COUNT ${this.MAX_GEN_COUNT} \n`;
    defines += `#define MAX_REF_COUNT ${this.MAX_REF_COUNT} \n`;
    defines += `#define MAX_CROWN_COUNT ${this.MAX_CROWN_COUNT} \n`;
   defines += `#define MAX_TOTAL_CROWN_COUNT ${this.MAX_TOTAL_CROWN_COUNT} \n`;
   defines += `#define TRANSFORMS_DATA_SIZE ${this.MAX_TOTAL_REF_COUNT} \n`;
    if(this.USE_SAMPLER)
      defines += '#define USE_SAMPLER 1\n';
    else if(this.USE_PACKING){
      defines += `#define MAX_TOTAL_REF_COUNT ${this.MAX_TOTAL_REF_COUNT} \n`;    
      defines += '#define USE_PACKING 1\n';  
    }
    
    if(this.USE_PERMUTATIONS) {     
      
      defines += `#define USE_PERMUTATIONS\n`;  
      defines += `#define PERM_SIZE ${this.MAX_PERM_SIZE}\n`;  
    }
    
    return defines;
  }

  getUniforms(un, timeStamp){
    
    if(!isDefined(this.groupMaker))
      return un;
    
    this.calculateGroup();

    un.u_curvature = Math.round(this.groupMaker.curvature);

    var group = this.group;//Maker.getGroup();
    var fd = group.s;
    var trans = group.t;
        
    var p = this.params;
  
    un.u_genCount = fd.length;
    
   
    /*domains are now a list of 1,2, or 3 splanes, and get packed in*/
      un.u_domainData = iCumPackTransforms(fd, this.MAX_GEN_COUNT/* max number of sides, for the moment,3 max # splanes in a side of a domain, of 1,2 or 3*/);  
      un.u_domainCount = iPackRefCumulativeCount(fd,3*this.MAX_GEN_COUNT);

      un.u_groupCumRefCount = iPackRefCumulativeCount(trans, this.MAX_GEN_COUNT);
      un.u_groupTransformsData = iCumPackTransforms(trans,  this.MAX_TOTAL_REF_COUNT);
      
      /*
      if(this.params.debug) {
         console.log("u_domainCount:", objectToString(un.u_domainCount));
         console.log("u_domainData:", objectToString(un.u_domainData));
         console.log("u_groupCumRefCount:", objectToString(un.u_groupCumRefCount));
         console.log("u_groupTransformsData:", objectToString(un.u_groupTransformsData));
      }*/
      
 
    return un;
  }  
  
  //
  // render UI onto canvas 
  //
  render(context, transform){
  
    this.calculateGroup();
    var group = this.group;
    
    var par = this.params;
    this.fdpts = [];//only needed in the orbifold drawer, so don't store otherwise.
		if(par.showBaseGens){
			var fd = this.group.s;
			for(var i = 0; i < fd.length; i++){
			  // if we are using "double walled" boundaries:
			  if(Array.isArray(fd[i])){
			    this.fdpts.push(
			    iDrawSplane(fd[i][0], context, transform, {lineStyle:"#0000FF",shadowStyle:"#00007733", lineWidth:2,shadowWidth:5, debug:par.debug})
			     ); } 
				else // we are not
				  iDrawSplane(fd[i], context, transform, {lineStyle:"#0000FF",shadowStyle:"#00007733", lineWidth:2,shadowWidth:20, debug:par.debug});
			}
		}
   
  } // render 

  //
  //  calculate group 
  //
  calculateGroup(){
    
    if(this.params.debug)console.log("recalculating group");    

		var group = this.groupMaker.getGroup();
    this.group = group;
        
    //if(!isDefined(group.genNames)){
      group.genNames = iMakeDefaultGenNames(group.t);
    //}
    
    if(!isDefined(group.t)){
        group.t = iMakeDefaultTransforms(group.s);
    }
        
    // give name to each side 
    for(var i = 0; i < group.s.length; i++){
      group.s[i].word = group.genNames[i];
      if(isDefined(group.t[i]))group.t[i].word = group.genNames[i];      
    }
        
    this.genCount = group.s.length;
    this.maxRefCount = iGetMaxRefCount(group.t);
    
    if(this.params.debug){
      console.log("genCount:" + this.genCount);
      console.log("maxRefCount:" + this.maxRefCount);
    }
    
    if(this.genCount > this.MAX_GEN_COUNT){
      //this.MAX_GEN_COUNT = genCount; 
      this.invalidateProgram(); 
      console.error("!!!  genCount > MAX_GEN_COUNT: ",(this.genCount + " > " + this.MAX_GEN_COUNT));
    }
    if(!this.USEPACKING){
      if(this.maxRefCount > this.MAX_REF_COUNT){
        //this.MAX_REF_COUNT = maxRefCount;
        this.invalidateProgram(); 
        console.error("!!! maxRefCount > MAX_REF_COUNT:", (this.maxRefCount + " > "+this.MAX_REF_COUNT));     
      }
    }   
    if(this.params.debug){
      console.log("Fundamental Domain:");
      group.s.forEach(function(p,index){console.log(index + ":" + splaneToString(p, 4))});
      console.log("Pairing Transforms:");
      group.t.forEach(function(p,index){console.log(index + ":" + transformToString(p, 4))});
    }
    
                
  } // calculateGroup 

	//
	//  handles all UI events on canvas 
	//
	handleEvent(evt){	
    // do nothing 
  }
  
} // class DirichletDomainBuilder
