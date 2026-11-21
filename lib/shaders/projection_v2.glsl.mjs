export const projection =
/*glsl*/`
#define HAS_PROJECTION

#ifndef TRANSFORM_DATA_SIZE

#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 4
#endif

#ifndef MAX_REF_COUNT
#define MAX_REF_COUNT 4
#endif

// size of array to hold transforms to tiles around fundamental domain (crown transform)
#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif

// size of splane data transfer size
#define SPLANE_DATA_SIZE 5
// fixed size array to transfer sides of fundamental domain via uniform vector
#define DOMAIN_DATA_SIZE (SPLANE_DATA_SIZE*MAX_GEN_COUNT)

// size of single moebius transform data
#define TRANSFORM_DATA_SIZE (MAX_REF_COUNT*SPLANE_DATA_SIZE)

#endif // TRANSFORM_DATA_SIZE


// the navigation's Moebius transform
uniform bool u_hasMoebiusTransform;
uniform float u_moebiusTransformData[TRANSFORM_DATA_SIZE];  // moebius transforms data

//
//  apply moebius transform to the point
//
void transformPoint(inout vec3 v, float td[TRANSFORM_DATA_SIZE], inout float ss){

		for(int r = 0; r  < MAX_REF_COUNT; r++){
			#define RIND (5*(r))
			iSPlane splane = iGeneralSplane(vec4(td[RIND+0],td[RIND+1],td[RIND+2], td[RIND+3]), int(td[RIND+4]));
			#undef RIND
			iReflect(splane, v, ss);
		}
}

//
//  The chain of conformal transformations (lib/symhublib/ProjectionTransform.js: a
//  list of rows the user adds, removes and moves). The shader takes a point of the
//  screen to the world point it shows, so it gets the list from the row nearest the
//  screen to the row nearest the pattern, each row as one or more steps:
//
//     uViewChainCount     the steps
//     uViewChainStep[i]   (the kind of step i, the offset of its numbers in the data)
//     uViewChainData[]    the numbers of the steps, vec4s
//
//  The kinds and their numbers (lib/symhublib/conformal/ConformalKinds.js has the
//  same on the CPU, with the same codes and limits):
//
//     VC_MOEBIUS   4 mirrors, each (splane)(type, 0, 0, 0)      the reflections in order
//     VC_RATIONAL  (n, 0, 0, 0), n points (x, y, exponent, 0)   prod (z - zi)^ni
//     VC_UHP       -                                            the upper half plane to the disk
//     VC_EXP       -                                            log z (the exponent seen from the screen)
//     VC_LOX       -                                            log between the points (-1, 0) and (1, 0)
//     VC_SCALE     (shift, c)                                   (z - shift) c
//     VC_PERIODIC  (a1, a2)(d1, d2)(C, 0, 0)                    z - C into the cell of the lattice a1, a2
//     VC_BAND      (fraction, 0, 0, 0)                          the band to the disk
//     VC_POWER     (n, 0, 0, 0)                                 z^n, n real
//
#define VIEW_CHAIN_MAX_STEPS 16
#define VIEW_CHAIN_DATA_SIZE 64

#define VC_MOEBIUS  1
#define VC_RATIONAL 2
#define VC_UHP      3
#define VC_EXP      4
#define VC_LOX      5
#define VC_SCALE    6
#define VC_PERIODIC 7
#define VC_BAND     8
#define VC_POWER    9

#define VC_MOEBIUS_MIRRORS     4
#define VC_RATIONAL_MAX_POINTS 8

uniform int   uViewChainCount;
uniform ivec2 uViewChainStep[VIEW_CHAIN_MAX_STEPS];
uniform vec4  uViewChainData[VIEW_CHAIN_DATA_SIZE];

//
//  the reflections of a moebius step, its numbers at the offset o
//
void vcMoebius(inout vec3 v, inout float ss, int o){

    for(int r = 0; r < VC_MOEBIUS_MIRRORS; r++){
        iSPlane splane = iGeneralSplane(uViewChainData[o + 2*r], int(uViewChainData[o + 2*r + 1].x));
        iReflect(splane, v, ss);
    }
}

//
//  the rational function prod (z - zi)^ni of a rational step, the exponents -3 ... 3;
//  the scale from its derivative: f'/f = sum ni/(z - zi)
//
void vcRational(inout vec3 p3, inout float scale, int o){

    int count = int(uViewChainData[o].x);
    vec2 q = p3.xy;
    vec2 f = vec2(1., 0.);
    vec2 dl = vec2(0.);

    for(int i = 0; i < VC_RATIONAL_MAX_POINTS; i++){
        if(i >= count) break;
        vec4 d = uViewChainData[o + 1 + i];
        vec2 s = q - d.xy;
        int n = int(d.z);
        switch(n){
            default: n = 0; break;   // an exponent out of range: the point takes no part
            case 3:    f = cMul(f, cMul(s, cMul(s, s))); break;
            case 2:    f = cMul(f, cMul(s, s));          break;
            case 1:    f = cMul(f, s);                   break;
            case -1:   f = cDiv(f, s);                   break;
            case -2:   f = cDiv(f, cMul(s, s));          break;
            case -3:   f = cDiv(f, cMul(s, cMul(s, s))); break;
        }
        if(n != 0) dl += float(n)*cInverse(s);
    }
    p3.xy = f;
    scale *= length(f)*length(dl);
}

//
//  maps [(-1,0), (1,0)] into [(0,0) , oo], then [(0,0) , oo] into [-oo, oo]
//
void vcLox(inout vec3 p, inout float scale){

    iSPlane s = iSphere(vec3(-1.,0,0),2.);
    iReflect(s, p, scale);
    p.x -= 1.;
    plane2band(p, scale);

}

//
//  the shift, then the complex factor
//
void vcScale(inout vec3 p, inout float scale, int o){

    vec4 d = uViewChainData[o];
    p.xy -= d.xy;
    cScale(p, d.zw, scale);

}

//
//  the point into the cell of the lattice a1, a2 about the point C: its
//  coordinates in the dual vectors d1, d2 less their nearest whole numbers
//
void vcPeriodic(inout vec3 p, inout float scale, int o){

    vec4 a = uViewChainData[o];
    vec4 d = uViewChainData[o + 1];
    vec2 q = p.xy - uViewChainData[o + 2].xy;
    vec2 e = vec2(dot(q, d.xy), dot(q, d.zw));

    e -= round(e); // e.xy in [-0.5, 0.5];

    p.xy = e.x*a.xy + e.y*a.zw;

}

//
//  the power z^n, n real: exp(n log z), the logarithm's sheet with the angle from
//  -pi to pi (a whole n needs no cut); the scale from its derivative, |n| |z|^(n - 1)
//
void vcPower(inout vec3 p, inout float scale, float n){

    scale *= abs(n)*pow(length(p.xy), n - 1.);
    p.xy = cPow(p.xy, n);

}

vec2 makeProjection(inout vec2 p, inout float scale){

    vec3 p3 = vec3(p, 0.);
    if(u_hasMoebiusTransform){
        transformPoint(p3, u_moebiusTransformData, scale);
     }

    for(int i = 0; i < VIEW_CHAIN_MAX_STEPS; i++){
        if(i >= uViewChainCount) break;
        ivec2 st = uViewChainStep[i];
        switch(st.x){
            case VC_MOEBIUS:  vcMoebius(p3, scale, st.y);                    break;
            case VC_RATIONAL: vcRational(p3, scale, st.y);                   break;
            case VC_UHP:      uhp2disc(p3, scale);                           break;
            case VC_EXP:      plane2band(p3, scale);                         break;
            case VC_LOX:      vcLox(p3, scale);                              break;
            case VC_SCALE:    vcScale(p3, scale, st.y);                      break;
            case VC_PERIODIC: vcPeriodic(p3, scale, st.y);                   break;
            case VC_BAND:     band2disc(p3, scale, uViewChainData[st.y].x);  break;
            case VC_POWER:    vcPower(p3, scale, uViewChainData[st.y].x);    break;
            default: break;
        }
    }

    p = p3.xy;
    return p;
}

#define HAS_SPHERICAL_PROJECTION

uniform bool u_sphericalProjectionEnabled;
//
// stereographic spherical projection
//
float makeSphericalProjection(inout vec2 p, inout float scale){

    float pp = dot(p,p);
    float sdist = sqrt(pp)-1.;
    if(sdist > 0.)
        return sdist;
    float factor = 1./(1. + sqrt(1.-pp));
    float factor2 = 1./sqrt(1.-pp);
    p *= factor;
    //scale *= factor;
    scale *= factor2;

    return sdist;

}

/*glsl*/`;
