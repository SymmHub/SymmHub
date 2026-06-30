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

uniform sampler2D uCrownData;
uniform bool uUseCrown;

vec3 srgbToLinear(vec3 c) {
    vec3 low = c / 12.92;
    vec3 high = pow((c + vec3(0.055)) / 1.055, vec3(2.4));
    return mix(high, low, lessThanEqual(c, vec3(0.04045)));
}

vec3 linearToSrgb(vec3 c) {
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - vec3(0.055);
    return mix(high, low, lessThanEqual(c, vec3(0.0031308)));
}

vec3 rgb2oklch(vec3 rgb) {
    vec3 rgbL = srgbToLinear(rgb);

    mat3 M_RGB_to_LMS = mat3(
        0.4122214708, 0.2119034982, 0.0883024619,
        0.5363325363, 0.6806995451, 0.2817188376,
        0.0514459929, 0.1073969566, 0.6299787005
    );
    vec3 lms = M_RGB_to_LMS * rgbL;

    vec3 lms_ = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));

    mat3 M_LMS_to_Lab = mat3(
        0.2104542553, 1.9779984951, 0.0259040371,
        0.7936177850, -2.4285922050, 0.7827717662,
        -0.0040720468, 0.4505937099, -0.8086758033
    );
    vec3 lab = M_LMS_to_Lab * lms_;

    float C = length(lab.yz);
    float H = atan(lab.z, lab.y) * (180.0 / 3.1415926535);
    if (H < 0.0) H += 360.0;

    return vec3(lab.x, C, H);
}

vec3 oklch2rgb(vec3 oklch) {
    float hRad = oklch.z * (3.1415926535 / 180.0);
    vec3 lab = vec3(oklch.x, oklch.y * cos(hRad), oklch.y * sin(hRad));

    mat3 M_Lab_to_LMS = mat3(
        1.0, 1.0, 1.0,
        0.3963377774, -0.1055613458, -0.0894841775,
        0.2158037573, -0.0638541728, -1.2914855480
    );
    vec3 lms_ = M_Lab_to_LMS * lab;

    vec3 lms = lms_ * lms_ * lms_;

    mat3 M_LMS_to_RGB = mat3(
        4.0767416621, -1.2684380046, -0.0041960863,
        -3.3077115913, 2.6097574011, -0.7034186147,
        0.2309699292, -0.3413193965, 1.7076147010
    );
    vec3 rgbL = M_LMS_to_RGB * lms;

    return clamp(linearToSrgb(rgbL), 0.0, 1.0);
}

vec3 rgb2hsl(vec3 color) {
    float maxVal = max(max(color.r, color.g), color.b);
    float minVal = min(min(color.r, color.g), color.b);
    float h = 0.0;
    float s = 0.0;
    float l = (maxVal + minVal) * 0.5;

    if (maxVal != minVal) {
        float d = maxVal - minVal;
        s = l > 0.5 ? d / (2.0 - maxVal - minVal) : d / (maxVal + minVal);
        if (maxVal == color.r) {
            h = (color.g - color.b) / d + (color.g < color.b ? 6.0 : 0.0);
        } else if (maxVal == color.g) {
            h = (color.b - color.r) / d + 2.0;
        } else if (maxVal == color.b) {
            h = (color.r - color.g) / d + 4.0;
        }
        h /= 6.0;
    }
    return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    vec3 rgb;
    if (hsl.y == 0.0) {
        rgb = vec3(hsl.z); // Achromatic
    } else {
        float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
        float p = 2.0 * hsl.z - q;
        rgb.r = hue2rgb(p, q, hsl.x + 1.0 / 3.0);
        rgb.g = hue2rgb(p, q, hsl.x);
        rgb.b = hue2rgb(p, q, hsl.x - 1.0 / 3.0);
    }
    return rgb;
}

vec4 getImageData(vec2 pnt, sampler2D image, vec2 imageScale,  vec2 imageCenter){

    // map world point into sampler coordinates
    vec2 tc = cMul(imageScale,(pnt.xy - imageCenter));
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
    
    if (uUseOKLCH) {
        vec3 oklch = rgb2oklch(rgb);
        oklch.z = oklch.z + uHueShift * 360.0;
        oklch.z = mod(oklch.z, 360.0);
        if (oklch.z < 0.0) oklch.z += 360.0;
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