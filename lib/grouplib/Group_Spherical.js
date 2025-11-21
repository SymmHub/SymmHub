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
    iReflectU4,
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
                return getGroup_s532(cfg.subtype);
            case '532':  
                return getGroup_532(cfg.subtype);
            case '*332':
                return getGroup_s332(cfg.subtype);
            case '332':            
                return getGroup_332(cfg.subtype);
            case '*432':
                return getGroup_s432(cfg.subtype);
            case '432': 
                return getGroup_432(cfg.subtype);
            case '3*2':
                return getGroup_3s2(cfg.subtype);
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

export function getGroup_532(subtype){

    let tri = getTriangle_532(subtype)
    return getRotationSubgroup(tri);
    
}

export function getGroup_s532(subtype){

    let tri = getTriangle_532(subtype)
    return new Group({s:tri});
}

export function getGroup_3s2(subtype){

    let tri = getTriangle_432(subtype);

    let s0 = tri[0], s1 = tri[1], s2 = tri[2];
    switch(subtype){
    default: 
    case 0: {
        let s2a = iReflectU4(s1, s2);
        let s0a = iReflectU4(s1, s0);          
        return new Group({s:[s0, s2, s2a, s0a], t: [[s0], [s2, s1], [s2a, s1], [s0a]]} );
     }
     case 1: {
        let s1a = iReflectU4(s0, s1);
        let s2a = iReflectU4(s0, s2);
        return new Group({s:[s1a, s2a, s2, s1], t: [[s1a], [s2a, s0], [s2, s0], [s1]]});
     }
     case 2: {
        let s1a = iReflectU4(s0, s1);
        let s2a = iReflectU4(s0, s2);
        return new Group({s:[s1a, s2a, s2, s1], t: [[s1a, s0], [s2a], [s2], [s1,s0]]});
     }
     case 3: {
        let s0a = iReflectU4(s2, s0);
        let s1a = iReflectU4(s2, s1);
        return new Group({s:[s0, s0a, s1a, s1], t: [[s0], [s0a], [s1a, s2], [s1,s2]]});
     }
     case 4: {
        let s2a = iReflectU4(s0, s2);
        let s1a = iReflectU4(s0, s1);
        return new Group({s:[s1a, s2, s1], t: [[s1a, s0], [s2], [s1, s0]]});
     }
     case 5: {
        let s2a = iReflectU4(s0, s2);
        return new Group({s:[s1, s2a, s2], t: [[s1], [s2a, s0], [s2, s0]]});
     }
   }  
}

export function getGroup_s432(subtype){

    let tri = getTriangle_432(subtype);

     return new Group({s:tri});
     
}

export function getGroup_432(subtype){

    let tri = getTriangle_432(subtype);
    return getRotationSubgroup(tri);
     
}


export function getGroup_s332(subtype){

    let tri = getTriangle_332(subtype);
    return new Group({s:tri});
}

export function getGroup_332(subtype){
    
    let tri = getTriangle_332(subtype);
    return getRotationSubgroup(tri);
    
}


//
//  join 2 triangles to form FD of rotationhal subgroup of reflection group
//
function getRotationSubgroup(tri){

    const s0 = tri[0], s1 = tri[1], s2 = tri[2];
    var s1a = iReflectU4(s0, s1);
    var s2a = iReflectU4(s0, s2);
    var fd = [s1, s2, s1a, s2a];
    var trans = [[s1, s0], [s2, s0], [s0, s1], [s0, s2]];
    return new Group({s: fd, t: trans});    
}

export function getTriangle_332(subtype){

    // [233] [323]
    //  sqrt(2)/(sqrt(3)+1) = 0.517638090205041
    const len23 = 0.517638090205041 
    // [332] 
    // 1/sqrt(2) = 0.7071067811865475
    const len33 = 0.7071067811865475; 
    
    let nn = null;
    let itri = null;
    let triSize = 1;
    switch(subtype){
        default: 
        case 0: nn = [2,3,3]; triSize = len23; break;
        case 1: nn = [3,2,3]; triSize = len23; break;
        case 2: nn = [3,3,2]; triSize = len33; break;
    }
    
    return makeSphericalTriangle(PI/nn[0], PI/nn[1], PI/nn[2], triSize);
    
}

export function getTriangle_432(subtype){

    // [432] , [342] 
    //  sqrt(2)/(sqrt(3)+1) = 0.517638090205041
    const len43 = 0.517638090205041;
    // [423] , [243] 
    // (sqrt(2)-1) = 0.41421356237309504880
    const len42 = 0.41421356237309504880;
    // [324] [234] 
    // 1/(sqrt(3) + sqrt(2)) =  0.3178372451957822
    const len32 = 0.3178372451957822;
    let nn = null;
    let itri = null;
    let triSize = 1;
    switch(subtype){
        default: 
        case 0: nn = [4,2,3]; triSize = len42; break;
        case 1: nn = [4,3,2]; triSize = len43; break;
        case 2: nn = [3,4,2]; triSize = len43; break;
        case 3: nn = [2,4,3]; triSize = len42; break;
        case 4: nn = [3,2,4]; triSize = len32; break;
        case 5: nn = [2,3,4]; triSize = len32; break;                
    }

    return makeSphericalTriangle(PI/nn[0], PI/nn[1], PI/nn[2], triSize);
}


export function getTriangle_532(subtype){
    // 
    // canonical vertices of icosahedral grid on unit sphere 
    // v0 = [0, 0, 1]
    // v1 = [fi-1, 0, fi]*(1/sqrt(3))
    // v2 = [0, 1, fi] * 1/(fi+2) 
    // where fi = (sqrt(5)+1)/2 - golden ratio 1.6180339887498948482045868343656
    //  u = sqrt(fi+2) 1.9021130325903071442328786667588
    // apply inversion in Sphere([0,0,-1, sqrt(2)])
    // it converts unit sphere into plane([0,0,1,0])
    // (v1) -> s1 = (fi-1)/(fi+sqrt(3)) = 0.1844830881382523 
    // 1./((2 + sqrt(3))*fi + 1) 
    // 
    // fi/(u+1)  = 0.55753651583505141013282507491249
    // u - fi =  0.2840790438404122960282918323932
    let fi = (sqrt(5) + 1)/2;
    //let triSize = (fi-1)/(fi+sqrt(3)); // 2,3,5
    let triSize = 0.2840790438404124;   // 2,5,3
    //let itri = makeSphericalTriangle(PI/2, PI/3, PI/5, triSize);
    let nn = [5,3,2];
    let itri = null;
    //let triSize = 0.338261212718422;
    
    const len53 = 0.338261212718422;
    // (fi-1)/(fi+sqrt(3));
    const len52 = 0.2840790438404122;
    // (fi-1)/(fi+sqrt(3))
    const len32 = 0.1844830881382523;
    
    switch(subtype){
        default: 
        case 0:  nn = [5,3,2]; triSize = len53;  break;
        case 1:  nn = [3,5,2]; triSize = len53;  break;
        case 2:  nn = [5,2,3]; triSize = len52;  break;
        case 3:  nn = [2,5,3]; triSize = len52;  break;
        case 4:  nn = [3,2,5];  triSize = len32; break;
        case 5:  nn = [2,3,5];  triSize = len32; break;
        
    }
      
    return makeSphericalTriangle(PI/nn[0], PI/nn[1], PI/nn[2], triSize);
        
}

