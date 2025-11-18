import {
    abs,
    getParam,
    iPlane, 
    iSphere, 
    EventProcessor,
    isDefined, 
    Group, 
    ParamChoice,
    ParamFloat,
    ParamInt,
    ParamBool,
    makeSphericalTriangle,
    sqrt,
    PI,  
} from './modules.js';


const DEBUG = false;
const MYNAME = 'Group_Spherical';

    
const SphericalGroupNames = [
    '*nn',
    'nn',
    'nx',
    'n*',
    '*22n',
    '2*n',
    '22n',  
    '*332',
    '332', 
    '3*2',
    '*432', 
    '432',
    '*532', 
    '532'
];
//
//  provides generators and FD for frieze groups
//
export class Group_Spherical {
	
    
	constructor(opt){
    
        if(!opt)
           opt = {};
        
        this.mConfig = {
          type: getParam(opt.type, '*nn'),
          n:    getParam(opt.n,2),
          subtype: getParam(opt.subtype,0),
          centered:  true,
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
        switch(cfg.type){
            default: 
            case '*nn':
            case 'nn':
            case 'nx':
            case 'n*':
            case '*22n':
            case '2*n':
            case '22n':
                return getDihedralGroup(cfg.type, cfg.subtype, cfg.n, cfg.centered);
            case '*532':
            case '532':  
                return getIcosahedralGroup(cfg.type);
            case '*332':
            case '332':            
            case '3*2':
                return getTetraheralGroup(cfg.type);
            case '*432':
            case '432': 
                return getOctahedralGroup(cfg.type);
         }                       
		
	}

    makeParams(cfg, onc){
        
        return {
          type:     ParamChoice({obj: cfg,key: 'type', name: 'type',choice:   SphericalGroupNames, onChange: onc}),
           n:       ParamInt ({obj: cfg,key: 'n',       onChange: onc}),
           subtype: ParamInt ({obj: cfg,key: 'subtype', onChange: onc}),
           centered: ParamBool ({obj: cfg,key: 'centered', onChange: onc}),
           
        };
    }
	
    //
    //  return copy of this group maker 
    //
    getCopy(){

        return new Group_Spherical(Object.assign({}, this.mConfig));

    }
  
  //
  //  return external params 
  //
  getParams(){
      return this.mParams;
      
  }
  

} // class Group_Spherical


function getDihedralGroup(type, subtype, n, centered){
    
    let phi = Math.PI/n;
    let phi2 = phi/2;
    let sinf = Math.sin(phi);
    let cosf = Math.cos(phi);
    let sinf2 = Math.sin(phi2);
    let cosf2 = Math.cos(phi2);
    
    let s0, s1, s2, s3, sc;
    if(centered){
        // domain is infinite with poles at 0, and oo  
        s0 = iPlane([0,-1,0,0]);
        s1 = iPlane([-sinf2, cosf2, 0, 0]);
        s2 = iPlane([-sinf, cosf, 0, 0]);
        s3 = iPlane([-sinf, -cosf, 0, 0]);
        sc = iSphere([0,0,0,1]);
    } else {
        // fd is finite, poles are at -1 and 1
        let r1, y1, r2, y2;
        r1 = 1./sinf;
        r2 = 1./sinf2;
        y1 = sqrt(r1*r1-1);
        y2 = sqrt(r2*r2-1);
        s0 = iPlane([0,-1,0,0]);
        s1 = iSphere([0,-y2, 0, r2]);
        s2 = iSphere([0,-y1, 0, r1]);
        s3 = iSphere([0,y1, 0, r1]);
        sc = iPlane([-1,0, 0, 0]);
        
    }
    
    
    switch(type){
        default: 
        case '*nn': 
            return new Group({s:[s0, s2]}); 
        case 'nn':
            return new Group({s:[s3, s2], t:[[s3, s0], [s0, s3]]}); 
        case 'nx':
            return new Group({s:[s3, s2], t:[[s3, s0, sc], [s0, s3, sc]]}); 
        case 'n*':
            return new Group({s:[s3, sc, s2], t:[[s3, s0], [sc], [s0, s3]]}); 
        case '*22n':
            return new Group({s:[s0, s2, sc]}); 
        case '2*n':
            return new Group({s:[s0, sc, s2],t:[[s0],[s1, sc],[s2]]});         
        case '22n':
            return new Group({s:[s3, sc, s2],t:[[s3, s0],[s0, sc],[s0, s3]]});                 
        
    }
}

//
// Icosahedral group can be build using 235 triangles with triangle size 
// (fi - 1)/(fi+sqrt(3)) = 0.1844830881382523 
//
export function getIcosahedralGroup(type, subtype){
    // 
    // canonical vertices of icosahedral grid on unit sphere 
    // v0 = [0, 0, 1]
    // v1 = [fi-1, 0, fi]*(1/sqrt(3))
    // v2 = [0, 1, fi] * 1/(fi+2) 
    // where fi = (sqrt(5)+1)/2 - golden ratio
    // apply inversion in Sphere([0,0,-1, sqrt(2)])
    // it converts unit sphere into plane([0,0,1,0])
    // (v1) -> s1 = (fi-1)/(fi+sqrt(3)) = 0.1844830881382523 
    // 1./((2 + sqrt(3))*fi + 1) 
    // 
    let fi = (sqrt(5) + 1)/2;
    //let triSize = (fi-1)/(fi+sqrt(3));
    let triSize = 0.2840790438404124;
    //let itri = makeSphericalTriangle(PI/2, PI/3, PI/5, triSize);
    let itri = makeSphericalTriangle(PI/2, PI/5, PI/3, triSize);
    
    return new Group({s:itri});
    
}

//
// octahedral group can be made out of 423 triangles with triangle size 
//  (sqrt(2)-1) = 0.41421356237309504880
//
export function getOctahedralGroup(type){
    return new Group({});

}

export function getTetrahedralGroup(type){
    return new Group({});
}