import {
  abs,
  getParam,
  iPlane, 
  EventProcessor,
  isDefined, 
  Group, 
  ParamChoice,
  ParamFloat,
} from './modules.js';


const DEBUG = false;
const MYNAME = 'Group_Frieze';

const 
    S22OO = '*22∞',
    _22OO = '22∞',
    _2SOO = '2*∞',
    OOS = '∞*',
    SOOOO = '*∞∞',
    OOX = '∞x',
    OOOO = '∞∞';
    
const FriezeGroupNames = [
    S22OO,
    _22OO,
    _2SOO,
    OOS,
    SOOOO,
    OOX,
    OOOO,    
];
//
//  provides generators and FD for frieze groups
//
export class Group_Frieze {
	
    
	constructor(opt){
    
        if(!opt)
           opt = {};
        
        this.mConfig = {
          type: getParam(opt.type, '333'),
          a: getParam(opt.a,0.5),
        };		
        
        this.setOptions(opt);
        
        this.mParams = this.makeParams(this.mConfig, this.onParamChanged.bind(this));
	}

    getClassName(){
        return MYNAME+'-class';
    }

    setOptions(opt){
        
        if(opt.onChanged){
            this.onGroupChanged = opt.onChanged;
            this.eventProcessor = new EventProcessor();
            this.eventProcessor.addEventListener('onChanged', this.onGroupChanged);
        }        
    }
  
    //
    // called from UI when any group param was changed 
    //
    onParamChanged(){
        if(DEBUG)console.log(this.constructor.name + '.onParamChanged()', 'eventProcessor:', this.eventProcessor);
        if(this.eventProcessor)
          this.eventProcessor.handleEvent({type:'onChanged', target: this});

    }

  /*  
  getEventProcessor(){
    
    return this.eventProcessor;
    
  }
  */
	//
	//  return group description
	//
	getGroup(){
            
        var cfg = this.mConfig;
        
        return getFrizeGroup(cfg.type, cfg.a);
		
	}

    makeParams(cfg, onc){
        
        return {
          type: ParamChoice({obj: cfg,key: 'type', name: 'type',choice:   FriezeGroupNames, onChange: onc}),
           a:   ParamFloat ({obj: cfg,key: 'a',onChange: onc}),
        };
    }
	
    //
    //  return copy of this group maker 
    //
    getCopy(){

        return new Group_Frieze(Object.assign({}, this.mConfig));

    }
  
  //
  //  return external params 
  //
  getParams(){
      return this.mParams;
      
  }
  

} // class Group_Frieze


function getFrizeGroup(type, a){
    let s0 = iPlane([0,-1,0,0]);
    let s1 = iPlane([1,0,0,a]);
    let s2 = iPlane([-1,0,0,0]);
    let s3 = iPlane([-1,0,0,a]);
    
    
    switch(type){
        default: 
        case S22OO: 
            return new Group({s:[s0, s1, s2]}); 
        case _22OO:
            return new Group({s:[s1, s2], t:[[s0, s1], [s0, s2]]}); 
        case _2SOO:
            return new Group({s:[s1, s2], t:[[s1], [s0, s2]]}); 
        case OOS:
            return new Group({s:[s0, s1, s3], t:[[s0], [s1, s2], [s2, s1]]}); 
        case SOOOO:
            return new Group({s:[s1, s2]}); 
        case OOX:
            return new Group({s:[s1, s3],t:[[s1,s2,s0],[s2, s1, s0]]});         
        case OOOO:
            return new Group({s:[s1, s3],t:[[s1,s2],[s2, s1]]});                 
        
    }
}