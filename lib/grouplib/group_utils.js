import {
    abs, 
    cos,
    sin,
    sqrt, 
    iSphere, 
    iPlane, 
} from './modules.js';


const EPSILON = 1.e-6;

export function getQuadDomain(a13, a23, a14, a24, ratio, bend4) {

    var shift = 0; // unused

    //var shift = 0; // horizontal shift of origin

    var b4 = bend4;

    var r1 = ratio;
    var r2 = 1.;

    var fd = {
        s: []
    };
    fd.s[0] = iSphere([shift, 0., 0., r2]);
    fd.s[1] = iSphere([shift, 0., 0., -r1]);

    var den3 = (2. * (r1 * cos(a13) + r2 * cos(a23)));
    var r3,
    r4,
    c3,
    c4;

    if (abs(den3) > EPSILON) {
        r3 = (r2 * r2 - r1 * r1) / den3;
        c3 = sqrt(r1 * r1 + 2. * r1 * r3 * cos(a13) + r3 * r3);
        fd.s[2] = iSphere([c3 + shift, 0., 0., -r3]);
    } else {
        fd.s[2] = iPlane([1., 0., 0., shift]);
    }
    var den4 = (2. * (r1 * cos(a14) + r2 * cos(a24)));
    if (abs(den4) > EPSILON) {
        r4 = (r2 * r2 - r1 * r1) / den4;
        c4 = sqrt(r1 * r1 + 2. * r1 * r4 * cos(a14) + r4 * r4);
        fd.s[3] = iSphere([-c4 * cos(b4) + shift, c4 * sin(b4), 0., -r4]);
    } else {
        fd.s[3] = iPlane([-cos(b4), sin(b4), 0., -shift]);
    }

    return fd;

}

//
//  convert fraction to angle
//
export function getAngle(fraction) {

    if (fraction >= 20 || fraction < 2)
        return 0;
    else
        return Math.PI / fraction;
}



//
//  return params of a splane which has given angles with two concentric spheres 
//
export function getRollingSplaneParams(r1, r2, a1, a2){
    
    var den = (2. * (r1 * cos(a1) + r2 * cos(a2)));    
    
    if(abs(den) > EPSILON) {
        
        let r = (r2 * r2 - r1 * r1) / den;
        let c = sqrt(r1 * r1 + 2. * r1 * r * cos(a1) + r * r);
        return {c:c, r: r};
        
    } else {
        // it is a plane 
        return {};
    }
}

//
//  return splane which has given angles with two concentric spheres 
//
export function getRollingSplane(r1, r2, a1, a2, angle){
    
    var den = (2. * (r1 * cos(a1) + r2 * cos(a2)));
    
    if(abs(den) > EPSILON) {
        let r = (r2 * r2 - r1 * r1) / den;
        let c = sqrt(r1 * r1 + 2. * r1 * r * cos(a1) + r * r);
        return iSphere([c*cos(angle), c*sin(angle), 0., -r]);
    } else {
        return iPlane([cos(angle), sin(angle), 0., 0.]);
    }
}


