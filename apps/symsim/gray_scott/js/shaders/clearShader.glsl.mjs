export const clearShader = 

`
in vec2 vUv;
out vec4 outValue;

uniform vec2 clearValue;

void main() {
  
    outValue = vec4(clearValue, 0.0, 1.0);
    
}
`;
