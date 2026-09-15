export const renderImage = 
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;
//layout(location = 1) out vec4 outPnt;

uniform float u_pixelSize; // important for AA. Set from CanvasTransform uniforms 

uniform sampler2D uImage;

uniform vec2 uImageCenter;// = vec2(0.,0.);   // location of imagfe center in world coord 
uniform vec2 uImageScale;// = vec2(1.,0.);    // complex scaling (with rotation) which maps world UV coordinates into image coordinates 
uniform float uImageTransparency;

uniform float uHueShift;
uniform float uSatMult;
uniform float uLightOffset;
uniform float uContrastMult;
uniform bool uUseOKLCH;
uniform bool uFlipX;
uniform bool uFlipY;
uniform bool uNegative;

uniform sampler2D uCrownData;
uniform bool uUseCrown;

// ── geometric placement ──────────────────────────────────────────────────────
//
//  With uUseImageTransform the image is not a Euclidean rectangle: it is the
//  image, under a motion T of the hyperbolic / spherical / Euclidean plane, of
//  the square of half-side uImageHalf about the origin. T arrives as a word of at
//  most four reflections (see ImagePlacement.js); applying them in reverse order
//  applies T^-1, which is what carries a buffer point back into the image's own
//  coordinates, where the box test below is the same as it ever was.
//
//  T carries rotation and translation only — the scale stays Euclidean at the
//  origin, as uImageHalf = 0.5/scale — so the source image really is a
//  rectangle and everything curved about it lives in T.
//
#define IMAGE_TRANS_MAX 4
uniform bool  uUseImageTransform;
uniform vec4  uImageTrans[IMAGE_TRANS_MAX];
uniform int   uImageTransType[IMAGE_TRANS_MAX];
uniform int   uImageTransCount;
uniform float uImageHalf;

vec2 imageCoordsOf(vec2 pnt){
    vec3 v = vec3(pnt, 0.);
    float ss = 1.;
    for(int r = uImageTransCount - 1; r >= 0; r--)
        iReflect(iGeneralSplane(uImageTrans[r], uImageTransType[r]), v, ss);
    return v.xy * uImageHalf;
}

vec4 getImageData(vec2 pnt, sampler2D image, vec2 imageScale,  vec2 imageCenter){

    // map world point into sampler coordinates
    vec2 tc = uUseImageTransform ? imageCoordsOf(pnt)
                                 : cMul(imageScale,(pnt.xy - imageCenter));
    vec2 tx = tc;
    if(uFlipX) tx.x = -tc.x;
    if(uFlipY) tx.y = -tc.y;
    // point in texture coordinates [0,1]
    vec2 tpnt = tx +  vec2(0.5,0.5); 
    
    float sdb = max(abs(tc.x), abs(tc.y))-0.5; // signed distance to the texture box 
    float blurWidth = 0.;//u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);

    vec4 texColor = texture(image, tpnt);
    vec3 rgb = texColor.rgb;
    if (uNegative) rgb = vec3(1.0) - rgb;
    
    if (uUseOKLCH) {
        vec3 oklch = rgb2oklch(rgb);
        oklch.z = fract(oklch.z + uHueShift);
        oklch.y = max(0.0, oklch.y * uSatMult);
        oklch.x = (oklch.x - 0.5) * uContrastMult + 0.5;
        oklch.x = clamp(oklch.x + uLightOffset, 0.0, 1.0);
        texColor.rgb = oklch2rgb(oklch);
    } else {
        vec3 hsl = rgb2hsl(rgb);
        hsl.x = fract(hsl.x + uHueShift);
        hsl.y = clamp(hsl.y * uSatMult, 0.0, 1.0);
        hsl.z = (hsl.z - 0.5) * uContrastMult + 0.5;
        hsl.z = clamp(hsl.z + uLightOffset, 0.0, 1.0);
        texColor.rgb = hsl2rgb(hsl);
    }

    return mask*premultColor(texColor);

}


//
//  calculate contribution of textures from the crown . group data stored in sampler2D 
//
vec4 getCrownTexture(vec3 pnt, sampler2D crownData, int dataOffset, sampler2D image, float scale, vec2 imageScale, vec2 imageCenter){
  
    
	vec4 color = vec4(0);

    int domainOffset = int(fetchFloat(crownData, dataOffset));
    int domainSize = int(fetchFloat(crownData, domainOffset));
    int transformsOffset = int(fetchFloat(crownData, dataOffset+1));
    
    for(int g = 0; g < domainSize; g++){
        // remember the original point and scale 
		vec3 v  = pnt;  
		float ss = scale;

        int transformOffset = int(fetchFloat(crownData, transformsOffset + g + 1));
        int refCount = int(fetchFloat(crownData, transformOffset));

        //if(refCount == 2) return vec4(1., 0.5, 0., 1.);

        int transformSplanesOffset = transformOffset+1;

        for(int r = 0; r  < refCount; r++){
      
            iSPlane rsp = fetchSplane(crownData,transformSplanesOffset + r*2); 
            iReflect(rsp, v, ss);
        }
        // uTODO use scaling factor for AA
		color = overlayColor(color, getImageData(v.xy, image, imageScale, imageCenter));	
    }
  
	return color;
    
}


void main() {

    vec2 pp = vUv;    

    vec4 color = vec4(0.);

    //return;
    

    if(uUseCrown){
       color = getCrownTexture(vec3(pp,0.), uCrownData, 0, uImage, 1., uImageScale, uImageCenter);   
    }

    vec4 imgColor = getImageData(pp, uImage, uImageScale,  uImageCenter);
    

    color = overlayColor(color, imgColor);
      
    // writing output 
    outColor = color * (1.-uImageTransparency);

}
`;