export const GRID_MAIN=
`
in vec2 vUv;

uniform float u_gridStep;
uniform float u_lineWidth;
uniform vec4  u_lineColor;
uniform float u_axesWidth;

layout(location = 0) out vec4 outColor;

void main(){

    outColor = u_lineColor * getCartesianGrid(vUv, vec2(u_gridStep),u_lineWidth, u_axesWidth);
    
}
`;