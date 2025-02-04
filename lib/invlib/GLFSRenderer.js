//
//  gl renderer renders mesh consisting of 2 triangles. 
//
//  all the rendering happens inside of fragment shader 
//
import {FilesLoader} from './FilesLoader.js';
import {isDefined,addLineNumbers, getParam} from './modules.js';


import * as twgl from '../libm/twgl/twgl.js';

const DEBUG = false;
const DEBUG_SHADER = false;

/**
  wrapper for static streing of defines 
*/
class SimpleDefinesMaker {
  constructor(def){
    if(isDefined(def)){
      this.defines = def;
    } else {
      this.defines = "";
    }
  }
  getDefines(){
    return this.defines;
  }
} // class SimpleDefinesMaker

export class GLFSRenderer {
  
  constructor(params){
    
    params.vs = getParam(params.vs,[]);
    params.fs = getParam(params.fs,[]);

    this.params = params;
    this.canvas = params.canvas;
    //this.canvasTransform = new CanvasTransform({canvas:this.canvas})
    
    // TODO this is optional 
    if(isDefined(params.navigator)) {
      this.navigator = params.navigator;
    } else {      
      this.navigator = new PlaneNavigator(this.canvas, this);
    }
        
    if(isDefined(params.definesMaker)){
      this.definesMaker = params.definesMaker;
    } else {
       this.definesMaker = new SimpleDefinesMaker(params.defines);
    }

    console.log("GLFSRenderer got defines:\n", this.definesMaker.getDefines());    
    console.log("end defines");
    
    this.init();
    
  }
  
  /**
    return gl context 
  */ 
  getGL(){
    
    return this.gl;
    
  }
  
  
  initVersion(gl){
    
    var versionName = gl.getParameter(gl.VERSION);
    console.log("webgl version:", gl.getParameter(gl.VERSION)); 
    //console.log("glsl version:", gl.getParameter(gl.SHADING_LANGUAGE_VERSION)); 
    
    if(versionName.indexOf("WebGL 2.0") >= 0)      
      this.webGLVersion = 2;
    else
      this.webGLVersion = 1;
    
    switch(this.webGLVersion){
    case 1: 
      this.glHeader = [
        "#define VS_OUT varying",
        "#define VS_IN attribute",
        "#define FS_IN varying\n",        
      ].join("\n");
      break;
      
    case 2: 
      this.glHeader = [
        "#version 300 es",
        "#define VS_OUT out",
        "#define VS_IN in",
        "#define FS_IN in\n",        
        ].join("\n");
      break;
    }
  }
    
  onLoadError(url){
    
    console.error("shaders load error:'"+url+"'");
    
  }

  onLoadSuccess(){
    
    if(DEBUG) console.log("GLFSRenderer.onLoadSuccess()");
    
    this.vsText = this.loader.text.slice(0,this.params.vs.length);
    this.fsText = this.loader.text.slice(this.params.vs.length);
   
    this.reCompileProgram();
    
  }
  
  /**
    compile and itring program from sources 
  */
  compileProgram(){
    
        
    if(!this.needToCompile) return;
    
    if(DEBUG) console.log('GLFSRenderer.compileProgram()');
    
    const gl = this.gl;
    // split result into fragment and vertex shader 
    
    if(!this.vsText || !this.fsText)
      return;
    
    const def = this.definesMaker.getDefines();
    var vertShader = this.glHeader.concat(def).concat(this.vsText.join('\n'));
    var fragShader = this.glHeader.concat(def).concat(this.fsText.join('\n'));
    
    if(DEBUG_SHADER) {
      console.log("vertexShader:\n");
      console.log(vertShader);
      console.log("fragmentShader:");
      console.log(fragShader);
    }
    
    let pr =  twgl.createProgramFromSources(gl,[vertShader,fragShader], this.onCompileError.bind(this));
    if(!pr){
      this.programInfo = null;
      return;
    }
      
    let pi = twgl.createProgramInfoFromProgram(gl,pr);
    
    if(isDefined(pi.program)){
      gl.useProgram( pi.program );
    }
    
    this.programInfo = pi;
    
    this.needToCompile = false;

        
  }

  onCompileError(info){
     console.error('shader compile error\n',info);     
  }

  //
  // informs the renderer, that the program needs to be recompiled 
  //
  reCompileProgram(){
    
    if(DEBUG) console.log('reCompileProgram()');
    this.needToCompile = true;
    this.repaint();
    
  }
  
  onNavigationChanged(){
    console.log("onNavigationChanged()");
    this.repaint();
    
  }
  
  printUnforms(gl, program){
    
     var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (var ii = 0; ii < numUniforms; ++ii) {
    var uniformInfo = gl.getActiveUniform(program, ii);
    var name = uniformInfo.name;
    var type = uniformInfo.type;
    //var typeInfo = typeMap[type];
      console.log("uniform:" + name + ", type:" + type.toString(16));
    }  
  }

  //
  // handler of all registered events 
  //
  handleEvent(evt){    
    if(isDefined(this.navigator)){
      this.navigator.handleEvent(evt);
    }
  }
    
  //
  //  webgl canvas initialization 
  //  
  init(){      
  
    if(DEBUG)console.log("GLFSRenderer.init()");  

    this.needToCompile = true;
    if(this.canvas !== undefined){
      // this is to allow  screenshots 
      var webglOptions = {preserveDrawingBuffer: true};
      //var webglOptions = {};
      
      //this.gl = this.canvas.getContext(this.WebGLName,{preserveDrawingBuffer: true});
      if(isDefined(this.WebGLName)){
        this.gl = this.canvas.getContext(this.WebGLName,webglOptions);
      } else {
        this.gl = twgl.getContext(this.canvas, webglOptions);
      }
      
      if(this.gl == null){
        console.error("webgl not found");
        return;
      }
      this.initVersion(this.gl);
      
      var gl = this.gl;
      
      // Create Vertex buffer (2 triangles)
      var vertices = [ - 1.0, - 1.0, 1.0, - 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0 ] ;
      this.vertBuffer = gl.createBuffer();
      gl.bindBuffer( gl.ARRAY_BUFFER, this.vertBuffer);
      gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW );
      
      //console.log("SHADING_LANGUAGE_VERSION:", gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
      //console.log("MAX_VERTEX_ATTRIBS:", gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
      
      this.gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 

      // load shaders text 
      this.loader = new FilesLoader();
      this.allFrag = this.params.vs.concat(this.params.fs);
      this.loader.loadFiles(this.allFrag, this);  
      
    }    
  };
  
  setUniforms(uniforms){
    twgl.setUniforms(this.programInfo, uniforms);
  }

  repaint(){
    
    this.needToRender = true;
    
  }
  
  //
  //  draw current program
  //
  render(timeStamp){
    
    if(DEBUG)console.log('GLFSRenderer.render()');
    this.needToRender = false;
    this.compileProgram();             
    
    let pi = this.programInfo;
    if(!pi)
      return;
    
    if ( !pi.program ) return;
    var gl = this.gl;
    
    twgl.resizeCanvasToDisplaySize(this.canvas);
    
    //var trans = this.canvasTransform;
    //trans.initTransform();
    
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    let uniforms = {};
    
    if(isDefined(this.params.model))
      this.params.model.getUniforms(uniforms, timeStamp);
    if(isDefined(this.navigator))  
      this.navigator.getUniforms(uniforms, timeStamp);
    
    twgl.setUniforms(pi, uniforms);
        
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
     // Get var locations 
    var vertexPositionLocation = gl.getAttribLocation( pi.program, 'position' );
 
    // Set values to program variables
  
    // Render geometry
 
    gl.bindBuffer( gl.ARRAY_BUFFER, this.vertBuffer );
    gl.vertexAttribPointer( vertexPositionLocation, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vertexPositionLocation );
    gl.drawArrays( gl.TRIANGLES, 0, 6 );
    gl.disableVertexAttribArray( vertexPositionLocation );
    
  }
  
  setShaders(shaders){
    
    this.vsText = null;
    this.fsText = null;    
    let allFrag = shaders.vs.concat(shaders.fs);
    this.loader.loadFiles(allFrag, this);  
  
  }
  
  setDefines(defines){
    
    if(DEBUG)console.log('GLFSRenderer.setDefines()\n',defines); 
    this.definesMaker = new SimpleDefinesMaker(defines); 
    this.reCompileProgram();
     
  }
  
  setProgramChanged(){
    
    if(DEBUG)console.log('GLFSRenderer.setProgramChanged()\n');
    this.reCompileProgram();
  }
  
};