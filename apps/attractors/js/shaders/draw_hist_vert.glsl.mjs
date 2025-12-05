export const draw_hist_vert = 
`
out vec2 texCoord; // texture coordinates in [0,1] 

in vec2 position;

void main () {

    texCoord = position*0.5 + 0.5;
    
    gl_Position = vec4(position, 0, 1);
    
}`;

