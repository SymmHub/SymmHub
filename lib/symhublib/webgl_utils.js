import {
  hashCode,
  isDefined, 
  TW,
  fetchTextFiles,
  DataPacking,
} from './modules.js';

// common GL defines to make shaders portable 
// WebGL header 
const GL1_HEADER = [
        "#define VS_OUT varying",
        "#define VS_IN attribute",
        "#define FS_IN varying\n",        
      ].join("\n");      
      
// WebGL2 header 
const GL2_HEADER = [
        "#version 300 es",
        "#define VS_OUT out",
        "#define VS_IN in",
        "#define FS_IN in\n",        
        "precision highp float;\n",
        "precision highp sampler2D;\n",
        //"precision mediump float;\n",
        //"precision mediump sampler2D;\n",
       
        ].join("\n");

let glHeader = GL2_HEADER;

/**
*
*/
export function getWebGLContext (canvas, extParams={}) {
  
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    Object.assign(params, extParams);
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    //console.log('gl: ', gl);
    if (!isWebGL2){
        gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
        console.log('gl: ', gl);
        glHeader = GL1_HEADER;
    } 
    console.log('WebGL version: ', gl.getParameter(gl.VERSION));
    console.log('Shading Language Version:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
    // flip y-axis in input images 
    // so, the (0,0) will be in the lower left corner of textures 
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
    

    let halfFloat;
    let supportLinearFiltering;
    let colorBufferExt;
    let webGlDrawBuffers = gl.getExtension("WEBGL_draw_buffers");
    
    if (isWebGL2) {
        colorBufferExt = gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    console.log('supportLinearFiltering:', supportLinearFiltering);
    console.log('colorBufferExt:', colorBufferExt);
    //console.log('gl:', gl);
    console.log('webGlDrawBuffers:', webGlDrawBuffers);
    
    
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2)
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    }
    else
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }


    return {
        gl,
        ext: {
            formatRGBA,
            formatRG,
            formatR,
            halfFloatTexType,
            supportLinearFiltering
        }
    };
}

/**
*
*/
function getSupportedFormat (gl, internalFormat, format, type)
{
    if (!supportRenderTextureFormat(gl, internalFormat, format, type))
    {
        switch (internalFormat)
        {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }

    return {
        internalFormat,
        format
    }
}

/**
*
*/
function supportRenderTextureFormat (gl, internalFormat, format, type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status == gl.FRAMEBUFFER_COMPLETE;
}

/**
*
*/
export function getResolution (gl, resolution) {
  
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1)
        aspectRatio = 1.0 / aspectRatio;

    let min = Math.round(resolution);
    let max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
    else
        return { width: min, height: max };
}


/**
*
*/
export function framebufferToTextureData (gl, target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    let length = target.width * target.height * 4;
    let textureData = new Float32Array(length);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
    return textureData;
}

/**
*
*/
export function createProgram (gl, vertexShader, fragmentShader) {
    if(vertexShader == null || fragmentShader  == null) 
      return null;
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        console.trace(gl.getProgramInfoLog(program));

    return program;
}


/**
*
*/
function addKeywords (source, keywords) {
  
    if (keywords == null) return source;
    let keywordsString = '';
    keywords.forEach(keyword => {
        keywordsString += '#define ' + keyword + '\n';
    });
    return keywordsString + source;
}


function addGLHeader(source){
  return glHeader + source;
}

/**
*
*/
export function compileShader(gl, shaderType, source, keywords=null, sourceURL=null) {
  
    source = addKeywords(addGLHeader(source), keywords);

    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        
        const lastError = gl.getShaderInfoLog(shader);
        let listing = addLineNumbersWithError(source, lastError);
        console.error(`${listing}\nError compiling shader\n source: '${sourceURL}'\n ${lastError}`);
        return null;
        //console.trace(gl.getShaderInfoLog(shader));
        
    }
    return shader;
};


export function compileShaders(gl, ext, shaders){
  
  const debug = false;
  
  if(debug)console.log('compileShaders()');
  let success = true;
  for(const prop in shaders){    
    let sh = shaders[prop];
    if(debug)console.log('compiling shader: ', prop, '['+ sh.fragments.join(',')+']',);
    if(sh.type != ST_NONE) {
      let gltype =  (sh.type == ST_VERT)? gl.VERTEX_SHADER: gl.FRAGMENT_SHADER;
      if(isDefined(sh.txt)){
        sh.shader = compileShader(gl, gltype, sh.txt, sh.opt, sh.url);
        if(sh.shader == null)
          success = false;
      } else {
          console.error('shader source undefined:',prop)
          success = false;        
      }
    }
  }
  if(debug)console.log('compileShaders() success: ', success);
  return success;
  
}

export function buildProgramsArray(gl, programs){
  
    for(let i = 0; i < programs.length; i++){
      buildProgram(gl, programs[i]); 
    }
}

export function buildPrograms(gl, programs, shaders){
  
  const debug = false;
  if(debug)console.log('buildPrograms()');
  let success = true;
  for(const prop in programs){    
    let prg = programs[prop];
    try {
      let vs = shaders[prg.vsName].shader;
      let fs = shaders[prg.fsName].shader;      
      if(vs != null && fs != null) {
        if(debug)console.log('building program: ', prop, ' from: ',  vs, ' and ', fs);      
        prg.program = new Program(gl, vs, fs);
      } else {
        if(debug)console.log('building program: ', prop, ' from: ',  vs, ' and ', fs, ' bad shader!'); 
        success = false;
      }
    } catch(ex){
      console.error('error building program:', prop);
      success = false;
    }
  }
  if(debug)console.log('buildPrograms() success:', success);
  return success;
  
}


//
// instance of single file fetcher;
//
let theFileFetcher; 

/**
  return instance of file fetcher 
  it keeps cache of fetched files and loads only new files 
*/
export function getFileFetcher(){
  
  if(isDefined(theFileFetcher)){
    return theFileFetcher;
  }
  
  //
  // fetch array of fragments 
  //
  function fetchFrags(frags, onSuccess, onFail){
    
    console.log('fileFetcher.fetchFrags()', frags);
    fetchTextFiles(frags, onSuccess, onFail);
    
  }
  
  theFileFetcher =  {
    fetchFrags: fetchFrags,
  }
  
  return theFileFetcher;
}

/**
 build webgl program using new program structure 
 program = {
   vs: vertexShader 
   fs: fragmentSHader,
   program: Program  the build program 
   
 }
*/
export function buildProgram(gl, program){
  
  let fetcher = getFileFetcher();
  
  console.log('buildProgram: ', program.name);
  
  let frags = getShaderFrags(program.vs);
  frags = frags.concat(getShaderFrags(program.fs));
  
  function onSucc(){
    
    console.log('Fragments Loaded: ', frags);
    console.log('joining vertex shader for:', program.name);
    combineShaderFragments(program.vs);
    console.log('joining fragment shader for:', program.name);
    combineShaderFragments(program.fs); 
    program.vs.shader = compileShader(gl, gl.VERTEX_SHADER, program.vs.txt);
    program.fs.shader = compileShader(gl, gl.FRAGMENT_SHADER, program.fs.txt);
    
    console.log('vs: ', program.vs.shader);
    console.log('fs: ', program.fs.shader);
    program.program = new Program(gl, program.vs.shader, program.fs.shader); 
    console.log('program: ', program.program);    
    
  }
  
  function onFail(){
    console.log('failed to load fragments: ', frags);
  }
  fetcher.fetchFrags(frags, onSucc, onFail);
  
}

function combineShaderFragments(shader){
  
    let frags = shader.frags;
    console.log('     frags:', frags);
    let txt = '';
    for(let k = 0; k < frags.length; k++){
      let fr = frags[k];
      if(!isDefined(fr.txt)) console.error('undefined fragment:', fr);
      else txt += fr.txt;
    }  
    shader.txt = txt;
}


function getShaderFrags(shader){
  
  return shader.frags;
  
}



// shader types
export const 
  ST_VERT = 0,
  ST_FRAG = 1,
  ST_NONE = 2;


//
//
//
export function getUniforms (gl, program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}


//
// 
let gBlitMaker = null; // single blit maker 
//
//  
//
export function getBlitMaker(gl){
  if(gBlitMaker == null) 
    gBlitMaker = makeBlitMaker(gl);
  return gBlitMaker;
}

//
//  makes new blitMaker 
//
export function makeBlitMaker(gl){

  let buf_ar = gl.createBuffer();
  let buf_ea = gl.createBuffer();
  
  gl.bindBuffer(gl.ARRAY_BUFFER, buf_ar);
  let a = 1.0;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-a, -a, -a, a, a, a, a, -a]), gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf_ea);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  
  function prepare(){
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buf_ar);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf_ea);
    
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    
  }
  
  function blit(target) {
  
    prepare();
    
    if (target == null){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
   
  }
  
  gBlitMaker = {
    blit: blit,
  };
  
  return gBlitMaker;
  
} // function makeBlitMaker(gl)


/**
*
*/
export function initBlit(gl){

    //console.log('init blit');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
  
}

/**
*
*/
export function blit(gl, target, clear = false) {
  
    //console.log('blit(',target,')');
    if (target == null) {
      
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
    } else {
      
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    
    if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // CHECK_FRAMEBUFFER_STATUS();
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

//
//  render into current viewport 
// 
export function blitVP (gl, target, clear = false) {
  
    //console.log('blit(',target,')');
    if (target == null){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // CHECK_FRAMEBUFFER_STATUS();
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

export function createTextureAsync (gl, url) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj = {
        texture,
        width: 1,
        height: 1,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };

    let image = new Image();
    image.onload = () => {
        obj.width = image.width;
        obj.height = image.height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}

//
// stores points into texture 
// each point is array of {x,y,z,size}
// optional parameters
// z - z-coord9nate of all points 
// r - radius of all points 
//
export function points2texture(gl, texture, pnts, z, r){
  
  if(texture == null) {   
    texture = DataPacking.createDataTexture(gl);
    
  }
  
  let count = pnts.length;
  var data = new Float32Array(4*count);
  
  for(let i = 0; i < pnts.length; i++){
    
      let off = i*4;
      let pnt = pnts[i];
      
      for(let k = 0; k < pnt.length; k++){
        
        data[off + k] = pnt[k];
        
      }      
      if(isDefined(z)) data[off + 2] = z;
      if(isDefined(r)) data[off + 3] = r;
      
  }    
  
  gl.bindTexture(gl.TEXTURE_2D, texture); 
  //console.log('texture: ', texture);
  //console.log('data: ', data);
  const level = 0;
  const internalFormat = gl.RGBA32F; 
  const width = count;
  const height = 1;
  const border = 0;
  const format = gl.RGBA; 
  const type = gl.FLOAT;
  
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,format, type, data);  
  return texture;
  
}

/**
*
*/
export class Material {
  
    //
    //    
    //
    constructor (gl, vertexShader, fragmentShaderSource) {
        this.gl = gl;
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = [];
        this.activeProgram = null;
        this.uniforms = [];
    }

    //
    //    
    //
    setKeywords (keywords) {
      
        let hash = 0;
        for (let i = 0; i < keywords.length; i++)
            hash += hashCode(keywords[i]);

        let program = this.programs[hash];
        let gl = this.gl;
        if (program == null)
        {
            let fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
            program = createProgram(gl, this.vertexShader, fragmentShader);
            this.programs[hash] = program;
        }

        if (program == this.activeProgram) return;

        this.uniforms = getUniforms(gl, program);
        this.activeProgram = program;
    }

    //
    //    
    //
    bind () {
        this.gl.useProgram(this.activeProgram);
    }
} // class Material 


/**
*
*/
export class Program {
  
    constructor (gl, vertexShader, fragmentShader) {
        this.uniforms = {};
        this.gl = gl;
        this.program = createProgram(gl, vertexShader, fragmentShader);
        this.uniforms = getUniforms(gl, this.program);
        this.programInfo = TW.createProgramInfoFromProgram(this.gl, this.program);
    }
    
    setUniforms(uniforms){
      
      TW.setUniforms(this.programInfo, uniforms);
      
    }
    
    bind () {
      this.gl.useProgram(this.program);
    }
} // class Program


/**
*
*
*/
export function createFBO(gl, twidth, theight, internalFormat, format, type, filtering) {
  
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
        
    // periodic boundary conditions 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, twidth, theight, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, twidth, theight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let texelSizeX = 1.0 / twidth;
    let texelSizeY = 1.0 / theight;

    return {
        texture,
        fbo,
        width: twidth,
        height: theight,
        texelSizeX,
        texelSizeY,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };
}

/**
*
*
*/
export function createDoubleFBO(gl, w, h, internalFormat, format, type, filtering) {
  
    let fbo1 = createFBO(gl, w, h, internalFormat, format, type, filtering);
    let fbo2 = createFBO(gl, w, h, internalFormat, format, type, filtering);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            return fbo2;
        },
        set write(value) {
            fbo2 = value;
        },
        swap() {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}

/**
*
*
*/
export function resizeFBO(gl, copyProgram, source, w, h, internalFormat, format, type, filtering) {
    let newFBO = createFBO(gl, w, h, internalFormat, format, type, filtering);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, source.attach(0));
    blit(gl,newFBO);
    return newFBO;
}

/**
*
*
*/
export function resizeDoubleFBO (gl,copyProgram, target, w, h, internalFormat, format, type, filtering) {
    if (target.width == w && target.height == h)
        return target;
    target.read = resizeFBO(gl, copyProgram, target.read, w, h, internalFormat, format, type, filtering);
    target.write = createFBO(gl, w, h, internalFormat, format, type, filtering);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
}


/**
*
*
*/
const errorRE = /ERROR:\s*\d+:(\d+)/gi;

export function addLineNumbersWithError(src, log = '', lineOffset = 0) {
  // Note: Error message formats are not defined by any spec so this may or may not work.
  const matches = [...log.matchAll(errorRE)];
  const lineNoToErrorMap = new Map(matches.map((m, ndx) => {
    const lineNo = parseInt(m[1]);
    const next = matches[ndx + 1];
    const end = next ? next.index : log.length;
    const msg = log.substring(m.index, end);
    return [lineNo - 1, msg];
  }));
  return src.split('\n').map((line, lineNo) => {
    const err = lineNoToErrorMap.get(lineNo);
    return `${lineNo + 1 + lineOffset}: ${line}${err ? `\n\n^^^ ${err}` : ''}`;
  }).join('\n');
} // addLineNumbersWithError()


//
// make programs from fragments 
//
export function makePrograms(ctx, fragments, shaders, programs){
  
  const debug = false;
  if(debug)console.log('makePrograms(), ctx:', ctx);
  let gl = ctx.gl;
  let ext = ctx.ext;
  if(debug)console.log('shaders:', shaders);
  
  // combine shaders txt from fragments txt
  if(debug)console.log('combining fragments');
  for(const prop in shaders){    
    if(debug)console.log('  combining shader:', prop);
    let shader = shaders[prop];
    // concatenate fragmens' txt 
    let shfrags = shader.fragments;
    if(debug)console.log('     fragments:', shfrags);
    let txt = '';
    for(let k = 0; k < shfrags.length; k++){
      let fr = fragments[shfrags[k]];
      if(!isDefined(fr)) console.error('undefined fragment:', shfrags[k]);
      else txt += fr.txt;
    }  
    shader.txt = txt;
  }

  let res1 = compileShaders(gl, ctx.ext, shaders);
  let res2 = buildPrograms(gl, programs, shaders);
  if(debug)console.log('compileShaders:', res1, 'buildPrograms:', res2);
  return (res1 && res2);
} // make programs 
