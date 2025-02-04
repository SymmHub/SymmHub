import {
    ITransform,
    isDefined,     
} from './modules.js';

const DEBUG = false;

export function transformGroup(group, params){
    
    if(DEBUG)console.log('transformGroup()');
    if(DEBUG)console.log('group:', group);
    
    let tr = ITransform.getIdentity();
    if(isDefined(params.translation)){
        tr = tr.concat(ITransform.getTranslation(params.translation));
    }
    
    if(isDefined(params.rotation)){
        let angle = params.rotation;
        if(DEBUG)console.log('angle:', angle);
        if(angle != 0.) 
          tr = tr.concat(ITransform.getRotation([0,0,1], angle));
    }
    if(isDefined(params.scale)){
        tr = tr.concat(ITransform.getScale(params.scale));
    }
    
    if(DEBUG)console.log('tr:', tr);

    // transform group into texture space 
    //let tr3 = ITransform.getScale(1/config.texScale);
    //let tr2 = ITransform.getRotation([0,0,1], -TORADIANS*config.texAngle);
    //let tr1 = ITransform.getTranslation([-config.texCenterX,-config.texCenterY]);
    //let tr = tr1.concat(tr2).concat(tr3);
           
    let transGroup = group.clone();      
    if(DEBUG)console.log('transGroup1:', transGroup);
    
    transGroup.applyTransform(tr);

    if(DEBUG)console.log('transGroup2:', transGroup);
    //throw new Error('end of game');

    return transGroup;
    //return group;      
      
}

