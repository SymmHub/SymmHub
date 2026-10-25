//
//  splat of a fold group into the pattern buffer
//
//  The items of a fold group are drawn (Canvas2D) at their own place into
//  uSource, which covers uSourceBox in pattern coordinates. Their fold element
//  h moves them next to the fundamental domain; a pattern point q shows the
//  source at h^-1(q). uTransformData holds h^-1 as a reflection chain, packed
//  like a group's transforms ({t: [h^-1]}, DataPacking.packGroupToSampler), so
//  any map of the group works - isometries and Moebius maps alike.
//
export const drawingSplat =
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform sampler2D uSource;          // premultiplied colors of the fold group
uniform vec4 uSourceBox;            // x0, y0, x1, y1 of uSource in pattern coordinates
uniform sampler2D uTransformData;   // h^-1 as transform 0

void main() {

    vec3 p = vec3(vUv, 0.);
    float scale = 1.;

    int transformsOffset = fetchInt(uTransformData, 1);
    int transformOffset  = fetchInt(uTransformData, transformsOffset + 1);
    int refCount         = fetchInt(uTransformData, transformOffset);
    for(int r = 0; r < refCount; r++){
        iSPlane rsp = fetchSplane(uTransformData, transformOffset + 1 + r*2);
        iReflect(rsp, p, scale);
    }

    // canvas rows go down, the pattern's y goes up
    vec2 uv = (p.xy - uSourceBox.xy)/(uSourceBox.zw - uSourceBox.xy);
    uv.y = 1. - uv.y;
    if(uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) {
        outColor = vec4(0.);
        return;
    }
    outColor = texture(uSource, uv);
}
`;
