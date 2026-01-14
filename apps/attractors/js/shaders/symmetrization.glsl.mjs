
export const symmetrization_vert = 
`
in vec2 position;

void main () {
   
    gl_Position = vec4(position, 0, 1);
    
}`;


export const  symmetrization_frag = 

`
uniform sampler2D uPointsData;
uniform vec2 uTransScale;
uniform vec2 uTransCenter;
uniform sampler2D uGroupData;
uniform int uMaxIter;

out vec4 outPnt;  // result of iteration 

vec2 symmetrization(vec2 p){

    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;
    float scale = 1.;
    //    let res = group.toFundDomain({pnt: ipnt, maxIterations: mIterParams.symmetry.maxIter});
    vec3 wpnt = vec3(p, 0.);
    
    iToFundamentalDomainSampler(wpnt, uGroupData, groupOffset, inDomain, refcount, scale, uMaxIter);
    
    return wpnt.xy;
    
    // if(p.x < 0.) return -p;
    // else         return p;
}

void main(){

    vec4 p0 = texelFetch(uPointsData, ivec2(gl_FragCoord.xy), 0);

    // point in group coordinates
    vec2 pb =  cMul(uTransScale, p0.xy) + uTransCenter;
        
        // transform to FD 
        
    vec2 ps = symmetrization(pb);

    //
    // transform point back into attractor coordinates  
    //
    vec2 pw = cDiv(ps - uTransCenter, uTransScale);

    
    outPnt = vec4(pw, p0.z, p0.w);

}
`;

