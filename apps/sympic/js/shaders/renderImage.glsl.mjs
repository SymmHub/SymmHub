export const renderImage = 
`
in vec2 vUv;

layout(location = 0) out vec4 outColor;
//layout(location = 1) out vec4 outPnt;

uniform float u_pixelSize; // important for AA. Set from CanvasTransform uniforms 

uniform sampler2D uImage;

uniform vec2 uImageCenter;// = vec2(0.,0.);   // location of imagfe center in world coord 
uniform vec2 uImageScale;// = vec2(1.,0.);    // complex scaling (with rotation) which maps world UV coordinates into image coordinates 
uniform float uImageTransparency;

uniform sampler2D uCrownData;
uniform bool uUseCrown;



vec4 getImageData(vec2 pnt, sampler2D image, vec2 imageScale,  vec2 imageCenter){

    // map world point into sampler coordinates
    vec2 tc = cMul(imageScale,(pnt.xy - imageCenter));
    // point in texture coordinates [0,1]
    vec2 tpnt = tc +  vec2(0.5,0.5); 
    
    float sdb = max(abs(tc.x), abs(tc.y))-0.5; // signed distance to the texture box 
    float blurWidth = 0.;//u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);

    return mask*premultColor(texture(image, tpnt));

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