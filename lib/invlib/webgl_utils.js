//
//
//
export function createShaderFromSource(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.error('error compiling %s shader\n%s', ((type === gl.VERTEX_SHADER) ? 'VERTEX' : 'FRAGMENT'),gl.getShaderInfoLog(shader));
  console.warn("shader source:\n%s", addLineNumbers( source) );
  
  gl.deleteShader(shader);
  return null;
}

//
//
//
export function createProgramFromSources(gl, vsSource, fsSource) {

  var vertexShader = createShaderFromSource(gl, gl.VERTEX_SHADER, vsSource);
  if(!isDefined(vertexShader)) 
	return null;
  var fragmentShader = createShaderFromSource(gl, gl.FRAGMENT_SHADER, fsSource);
  if(!isDefined(fragmentShader)) 
	return null;

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.warn(gl.getProgramInfoLog(program));  
  gl.deleteProgram(program);
  return null;
}
