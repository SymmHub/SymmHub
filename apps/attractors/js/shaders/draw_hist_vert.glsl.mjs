export const draw_hist_vert = 
`
out vec2 uv;

in vec2 position;

void main () {

    uv = 0.5 + 0.5 * position;
    
    gl_Position = vec4(position, 0, 1);
    
}`;

