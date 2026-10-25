//
//  the pattern's own crown: the folded drawing plus its copies through the
//  side pairings of the fundamental domain, for layers that sample the
//  pattern buffer without a crown of their own (VisualizationImage). The same
//  sum as PatternImage's renderImage, without the color adjustments.
//
//  uFolded covers the pattern box [-1,1]^2; its texture repeats, so points
//  outside the box are masked.
//
export const drawingCrown =
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform sampler2D uFolded;      // folded drawing, premultiplied
uniform sampler2D uGroupData;   // the group in pattern coordinates

vec4 foldedAt(vec2 p){
    vec2 tc = 0.5*p;
    if(max(abs(tc.x), abs(tc.y)) > 0.5) return vec4(0.);
    return texture(uFolded, tc + vec2(0.5));
}

void main() {

    vec2 pp = vUv;
    vec4 color = vec4(0.);

    int domainOffset     = fetchInt(uGroupData, 0);
    int domainSize       = fetchInt(uGroupData, domainOffset);
    int transformsOffset = fetchInt(uGroupData, 1);

    for(int g = 0; g < domainSize; g++){
        vec3 v = vec3(pp, 0.);
        float ss = 1.;
        int transformOffset = fetchInt(uGroupData, transformsOffset + g + 1);
        int refCount = fetchInt(uGroupData, transformOffset);
        for(int r = 0; r < refCount; r++){
            iSPlane rsp = fetchSplane(uGroupData, transformOffset + 1 + r*2);
            iReflect(rsp, v, ss);
        }
        color = overlayColor(color, foldedAt(v.xy));
    }

    outColor = overlayColor(color, foldedAt(pp));
}
`;
