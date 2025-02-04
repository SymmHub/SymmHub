export function testReadPixels(gl) {
  
  log('testReadPixels(gl)');
  log(glEnumToString(gl, gl.COLOR_ATTACHMENT5));
  log(glEnumToString(gl, gl.RGBA32F));

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    alert("need EXT_color_buffer_float");
    return;
  }
  
  const tex1 = createTexture(gl, [1.1, 2.2, 3.3, 4.4, 11.1, 12.2, 13.3, 14.4, ]);
  const tex2 = createTexture(gl, [0.1, 0.2, 0.3, 0.4, 1.1, 1.2, 1.3, 1.4 ]);
  
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex1, 0);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex2, 0);

  //gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  //gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  
  gl.clearColor(0.17, 0.27, 0.35, 0.45);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  readPixelsFromBuffer(gl, gl.COLOR_ATTACHMENT0);

  readPixelsFromBuffer(gl, gl.COLOR_ATTACHMENT1);

      
}

export function readPixelsFromBuffer(gl, attachment, x,y,width, height) {
  
    //gl.readBuffer(attachment); // select color attachment to read from     
    const data = new Float32Array(4*width*height);
    const format = gl.RGBA;
    //const format = gl.RG;
    const type = gl.FLOAT;
    //const type = gl.UNSIGNED_BYTE;
    gl.readPixels(x, y, width, height, format, type, data);

    //log(glEnumToString(gl, attachment), toString(data,2));

    return data;
    
}

function createTexture(gl, color) {
  
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const level = 0;
  //const internalFormat = gl.RGBA32F;
  const internalFormat = gl.RG32F;
  const width = 2;
  const height = 1;
  const border = 0;
  //const format = gl.RGBA;
  const format = gl.RG;
  const type = gl.FLOAT;
  const data = new Float32Array(color);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, format, type, data);
  // unless we get `OES_texture_float_linear` we can not filter floating point
  // textures
  //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  
  return tex;
}

function glEnumToString(gl, value) {
  for (let key in gl) {
    if (gl[key] === value) {
      return key;
    }
  }
  return `0x${value.toString(16)}`;
}

function log(...args) {
  
  console.log([...args].join(' '));
  //const elem = document.createElement("pre");
  //elem.textContent = [...args].join(' ');
  //document.body.appendChild(elem);
}

function toString(data, digits){
  let res = '[';
  for(let i = 0; i < data.length; i++){
    res += data[i].toFixed(digits);
    if(i < data.length - 1) res += ', ';
  }
  res += ']';
  return res;
}

/**
https://registry.khronos.org/webgl/specs/latest/2.0/#3.7.11

  Consider instead using readPixels into a PIXEL_PACK_BUFFER. Use getBufferSubData to read the data from that buffer. 

  copyBufferSubData

*/




function readData(gl){
    
  const alignment = 1;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);

  /*
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);  
  // turn off filtering 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);                  
  */
  
  let bufWidth = 100;
  let bufHeight = 1;  
  var bufData = new Float32Array(4*bufWidth*bufHeight);
  
  const level = 0;
  const format = gl.RGBA; 
  //const format = gl.RGBA_INTEGER;
  const type = gl.FLOAT;
  gl.readPixels(0,0, bufWidth, bufHeight, format, type, bufData);
  
  return bufData;
    
  
}

function testReadBuffer(gl, use_float, width, height, fbo) {

    // Decide on types to user for texture
    var texType, bufferFmt;
    if (use_float) {
        texType = gl.FLOAT;
        bufferFmt = Float32Array;
    } else {
        texType = gl.UNSIGNED_BYTE;
        bufferFmt = Uint8Array;
    }
    
    var OES_texture_float = gl.getExtension('EXT_color_buffer_float');
    if (OES_texture_float) {
        console.log('EXT_color_buffer_float supported');
    } else {
        console.log('EXT_color_buffer_float not supported');
    }
    
    // Clear
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.clearColor(0.1, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create texture
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, texType, null);

    // Create and attach frame buffer
    //var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
    //    throw new Error("gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE");
    //}

    // Clear
    gl.viewport(0, 0, 512, 512);
    gl.clear(gl.COLOR_BUFFER_BIT);
    var pixels = new bufferFmt(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, texType, pixels);

    if (pixels[0] !== (use_float ? 1.0 : 255)) {
        throw new Error("pixels[0] === " + pixels[0].toString());
    }
}

