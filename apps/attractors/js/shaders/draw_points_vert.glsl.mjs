// Vertex shader
export const draw_points_vert = 
`
//#version 300 es
in vec2 a_position;

void main() {
    gl_PointSize = 8.0;  // set size of each point
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;
