export const fsMain = 
`
/////////////////////   
/**  fsMain.glsl */

precision highp float; 
precision highp int;
 
FS_IN vec2 vUV;

#if __VERSION__ < 300
#define FRAG_COLOR gl_FragColor
#else 
out vec4 FRAG_COLOR;
#endif 

uniform float u_time;
uniform float u_pixelSize;    

vec4 getColor(vec2 z);
void init();

void main()	{
    
    init();
	    
    FRAG_COLOR = getColor(vUV);
        
}        
`;