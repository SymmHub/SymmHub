import {
    ITransform,
    isDefined,
    iPoint,
    iSphere,
    iTransformU4,
    SPLANE_SPHERE,
} from './modules.js';

const DEBUG = false;

//
//  the group transform as an ITransform: the translation, then the rotation (about the
//  z axis, radians), then the scale; params {translation: [x, y], rotation, scale}, each
//  optional. A point p goes to s R(rotation) (p + translation)
//
export function groupTransformITransform(params){

    let tr = ITransform.getIdentity();
    if(isDefined(params.translation)){
        tr = tr.concat(ITransform.getTranslation(params.translation));
    }

    if(isDefined(params.rotation)){
        let angle = params.rotation;
        if(angle != 0.)
          tr = tr.concat(ITransform.getRotation([0,0,1], angle));
    }
    if(isDefined(params.scale)){
        tr = tr.concat(ITransform.getScale(params.scale));
    }
    return tr;
}

//
//  a splane carried by the group transform (params as groupTransformITransform's):
//  a circle's arc keeps its ends (the bounds, angles about the centre, carried as
//  points, as invlib's iViewSplane does for the view); the label stays
//
export function transformSplane(splane, params){

    if(!splane || !splane.v) return splane;
    const tr = groupTransformITransform(params);
    let out;
    if(splane.type === SPLANE_SPHERE && splane.bounds){
        const cx = splane.v[0], cy = splane.v[1], r = Math.abs(splane.v[3]);
        const ends = splane.bounds.map(b => {
            const q = tr.transform(iPoint([cx + r*Math.cos(-b), cy + r*Math.sin(-b), 0, 0]));
            return [q.v[0], q.v[1], 0];
        });
        out = iSphere(iTransformU4(tr.ref, splane).v, ends);
    } else {
        out = iTransformU4(tr.ref, splane);
        if(splane.bounds) out.bounds = splane.bounds;
    }
    if(splane.label) out.label = splane.label;
    return out;
}

export function transformGroup(group, params){

    const MYNAME = 'transformGroup';

    if(DEBUG)console.log(`${MYNAME} group:`, group);
    if(DEBUG)console.log(`${MYNAME} params: `, params);

    let tr = groupTransformITransform(params);
    if(DEBUG)console.log(`${MYNAME} tr:`, tr);

    // transform group into texture space 
    //let tr3 = ITransform.getScale(1/config.texScale);
    //let tr2 = ITransform.getRotation([0,0,1], -TORADIANS*config.texAngle);
    //let tr1 = ITransform.getTranslation([-config.texCenterX,-config.texCenterY]);
    //let tr = tr1.concat(tr2).concat(tr3);
           
    if(DEBUG)console.log(`${MYNAME} group:`, group);

    let transGroup = group.clone();      
    
    transGroup.applyTransform(tr);

    if(DEBUG)console.log(`${MYNAME} transGroup2:`, transGroup);
    //throw new Error('end of game');

    return transGroup;
    //return group;      
      
}

