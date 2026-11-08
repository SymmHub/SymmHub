export const bufferPose =
/*glsl*/`
//
//  the placement of the pattern box in the world as a Möbius map, the pose of the
//  pattern transform (lib/symhublib/PatternPose.js): the similarity
//  t = uBufScale (w - uBufCenter) puts the world point w in the texture box
//  [-0.5, 0.5]^2 as before, then the bend t / (1 + uBufBend t) follows; uBufBend
//  is zero for a plain similarity. The bend's scale at the point multiplies the
//  scale of the mipmap level (SymRenderer.getRenderUni sets the uniforms)
//
uniform vec2 uBufBend;

// the texture box coordinates (the box [-0.5, 0.5]^2) of the similarity's t
vec2 bufBentCoord(vec2 t, out float bendScale){
    vec2 den = vec2(1., 0.) + cMul(uBufBend, t);
    bendScale = 1./dot(den, den);
    return cDiv(t, den);
}

// the texture coordinates ([0, 1]^2) of the world point w
vec2 world2texBent(vec2 w, vec2 bufScale, vec2 bufCenter, out float bendScale){
    return bufBentCoord(cMul(bufScale, w - bufCenter), bendScale) + vec2(0.5, 0.5);
}
/*glsl*/`;
