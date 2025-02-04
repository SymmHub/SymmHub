
import {GroupRendererConfig} from './GroupRendererConfig.js'
import {GLFSRenderer} from './GLFSRenderer.js'
import {InversiveNavigator} from './InversiveNavigator.js'
import {FileLoader} from './FileLoader.js'
import {
  getParam, 
  isFunction, 
  isDefined, 
  writeToJSON,
  writeCanvasToFile,
  AnimationControl,
  lerp, 
  } from './modules.js';
  
import {ParamGui} from '../libm/paramgui/paramGui.js'
import {resizeCanvasToDisplaySize as twglResizeCanvasToDisplaySize} from '../libm/twgl/twgl.js';
import {GUI as DatGui} from '../libm/dat.gui.module.js'

const LIBRARYPATH = "../library/";

const CANVAS_FIT_TO_WINDOW = {name:'Fit To Window'};
const CANVAS_CUSTOM = {name:'Custom'};
const CANVAS_HALF_HD = 
                  {name:'HD/2 [960 × 540]', width:960, height:540};
const CANVAS_HD = {name:'HD [1920 × 1080]', width:1920, height:1080};
const CANVAS_4K = {name:'4K [3840 × 2160]', width:3840, height:2160};
const CANVAS_8K = {name:'8K [7680 × 4320]', width:7680, height:4320};

 
const GL_CANVAS_STYLES = [
    CANVAS_FIT_TO_WINDOW.name, 
    CANVAS_HALF_HD.name,
    CANVAS_HD.name,
    CANVAS_4K.name, 
    CANVAS_8K.name, 
    CANVAS_CUSTOM.name
  ];

const EXPORT_ANIMATION = 'Animation Export';
const STOP_EXPORT_ANIMATION = 'Stop Animation Export';



//
//  class handles general group rendering 
//    
export class GroupRenderer {
  
  //
  //
  //
  constructor(options){
    
    
    
    this.constructorParams = options;
    
    this.glCanvas = options.glCanvas;
    
    this.overlayCanvas = options.overlayCanvas;
    
    if(isDefined(this.overlayCanvas)){
      this.drawContext = this.overlayCanvas.getContext("2d");
    }
    
    this.groupMaker = options.groupMaker;  
    
    this.config = (isDefined(options.config)) ? (options.config): (new GroupRendererConfig());
        
    this.domainBuilder = (isDefined(options.domainBuilder)) ? (options.domainBuilder) : (new DefaultDomainBuilder());
    
    this.myNavigator = new InversiveNavigator({canvas:this.overlayCanvas});
    
    this.patternMaker = options.patternMaker;
  
    this.fragShader = getParam(options.fragShader,
        [LIBRARYPATH+"frag/fsMain.frag",
         LIBRARYPATH+"frag/inversive.frag",
         LIBRARYPATH+"frag/complex.frag",                
         LIBRARYPATH+"frag/reflectionGroup.frag"]);
    this.vertShader = getParam(options.vertShader,[LIBRARYPATH+"frag/vertexShader.frag"]);
      
    this.params = {                
    
      groupParamChanged:true,
      cronwParamChanged:true,
      dirichletParamChanged:true,
      paramsName:'paramSet',
      revertParams: this.onRevertParams.bind(this),
      saveParams: this.onSaveParams.bind(this),
      saveParamsAs: this.onSaveParamsAs.bind(this),
      readParams: this.onReadParams.bind(this),
      glCanvasStyle: getParam(options.canvasStyle,GL_CANVAS_STYLES[0]),
      glCanvasWidth: getParam(options.canvasWidth, 800),
      glCanvasHeight: getParam(options.canvasHeight, 800),
      saveImage: this.onSaveImage.bind(this),
      imageName: 'image',
      imageCount:0,
      showTiming:false,
      timing: '0 ms',
      
      //recordAnimation:false,
      animationFramePrefix:'frame_',
      animationFrameTime:1000./60,
      animationStartFrame:0,
      animationEndFrame:100,
      startAnimationExport:this.onStartAnimationExport.bind(this),
      
    };
    
    if(isDefined(options.JSONpresets)){
      // init presets 
      this.JSONpresets = {};
      this.JSONpresetNames = [];
      for(var i = 0; i <  options.JSONpresets.length; i++){
        this.JSONpresetNames[i] = options.JSONpresets[i].name;
        this.JSONpresets[this.JSONpresetNames[i]] = options.JSONpresets[i].path;
      } 
      this.params.JSONpreset = (isDefined(options.JSONpreset))?options.JSONpreset:((this.JSONpresetNames.length > 0)?this.JSONpresetNames[0]:'');
    }
    
    //to order the folders in the GUI
    // if new components are added, change the default in initGUI
    
    this.guiOrder=getParam(options.guiOrder,[])
                
    // start animation loop 
    requestAnimationFrame(this.animationFrame.bind(this));    
    
  } // constructor 

  //
  //  animation loop
  //  it renders only if changes were made   
  //
  animationFrame(time){
    
    if(!this.startTime) {
      this.startTime = time;
      this.renderTime = 0;
      this.oldTimeStamp = time;
    }
        
    this.timeStamp = time - this.startTime;
    this.renderTime = lerp((this.timeStamp - this.oldTimeStamp), this.renderTime, 0.02);
    this.oldTimeStamp = this.timeStamp;
    
    if(this.params.showTiming){      
      this.controls.timing.setValue(this.renderTime.toFixed(1) + ' ms');
    }
       
   
    if(isDefined(this.animationControl)){
      
      // exporting animation 
      
      if(this.animationControl.isReady()){
        
        //if(this.params.showTiming)
        //console.log('anim time:', this.timeStamp.toFixed(0));         

        this.timeStamp = this.animationControl.getTime();
        this.render(this.timeStamp);
        this.animationControl.writeFrame(this.glCanvas);
        this.animationControl.incrementFrame();

        if(!this.animationControl.hasNextFrame()){
                 
          this.animationControl.stop();
          this.animationControl = undefined;
          
          this.controls.startAnimationExport.name(EXPORT_ANIMATION);
          
        }      
      }
    } else {      
      // regular animation 
      this.render(this.timeStamp);
      //}
      
    }
    
    requestAnimationFrame(this.animationFrame.bind(this));
    
  }
    
  //
  //
  //
  repaint(){
    
    this.glRenderer.repaint();
    this.needToRender = true;
    
  };
  
  //
  //  return all uniforms needed for the rendering 
  //  this is called by the GLFSRenderer before rendering the frame 
  //
  getUniforms(un){
    
    if(!isDefined(un)) un = {};
    this.getExtUniforms(this.domainBuilder, un, this.timeStamp);   
    this.getExtUniforms(this.config, un, this.timeStamp);
    this.getExtUniforms(this.patternMaker, un, this.timeStamp);   
    this.getExtUniforms(this.myNavigator, un, this.timeStamp);   
    this.getExtUniforms(this.groupMaker,un, this.timeStamp);
    
    return un;
  }

  //
  //  collect uniforms from generic uniforms maker 
  //
  getExtUniforms(uniMaker, uniforms, timeStamp){

    if(isDefined(uniMaker) && isFunction(uniMaker.getUniforms)){      
      return uniMaker.getUniforms(uniforms, timeStamp);
    } 
  }

  //
  //   start the whole program 
  //
  init() {

    var canvas = this.overlayCanvas;
    canvas.setAttribute('tabindex', '100');
    canvas.focus();
    
    canvas.addEventListener('mousemove', this);
    canvas.addEventListener('mouseenter', this);
    canvas.addEventListener('mousedown', this);
    canvas.addEventListener('mouseup', this);
    canvas.addEventListener('keydown', this);
    canvas.addEventListener('keyup', this);
    canvas.addEventListener('wheel', this);
      
    this.glRenderer = new GLFSRenderer({
              canvas:this.glCanvas,
              model: this,
              vs:this.vertShader,
              fs:this.fragShader,
              defines: this.getDefines(),
              renderOverlay: this.render.bind(this),
              navigator: this.myNavigator
              });                        
                  
    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
    
    this.initGUI(); 
    
    
    requestAnimationFrame(this.animationFrame.bind(this));
    
  }

  
  getDefines(){
    
    var def = "";

    // collect defines from components 

    if(isFunction(this.domainBuilder.getDefines))
      def += this.domainBuilder.getDefines();

    if(isFunction(this.config.getDefines))
      def += this.config.getDefines();
        
    if(isFunction(this.patternMaker.getDefines))
      def += this.patternMaker.getDefines();


    if(this.params.debug)console.log("defines:\n" + def);
    return def;
  }
      
  //
  //  build Graphical User Interface
  //
  initGUI(){
    
    // init canvas style
    this.onGLCanvasStyle();
    
    var guiOpt = {closeOnTop:true, width:340};
    
    var gui;    
    if(getParam(this.constructorParams.useParamGui, false)) {      
      gui = new ParamGui(guiOpt);
    } else {
      gui = new DatGui(guiOpt);
      gui.remember = function(){}; // hack to prevent DatGui from remembering presets 
    }
    
         
    this.controllers = {};
        
    // Be sure to add any new controllers to this list. Any controllers 
    // that are not ordered in  options.guiOrder are added in this order at the end:
    var guiControllerList= ["presets","config","group","navigation","domain","pattern"]
    
    var guiOrder = this.guiOrder;
    
    // build a new list with all elements of guiOrder removed from guiControllerList
    for(var i = 0; i < guiOrder.length; i++){
      guiControllerList=guiControllerList.filter( x=> (x != guiOrder[i]));
    }
    guiOrder=[...guiOrder,...guiControllerList];
    
    // then walk through and add the gui folders; a nonsensical key is ignored.
    for(i=0;i < guiOrder.length;i++){
      switch(guiOrder[i]){
        case "presets":
          this.initPresetsGUI(gui/*that's it until there's an external controller*/);
          break;
        case "config":
          this.initConfigGUI(this.config, gui, gui.addFolder("config"),this.onConfigChanged.bind(this));    
          break;
        case "group":
          this.initGroupGUI(this.groupMaker, gui, gui.addFolder("group"),this.onGroupChanged.bind(this));
          break;
        case "navigation":
          this.myNavigator.initGUI({gui:gui, folder:gui.addFolder("navigation"),onChanged:this.onNavigationChanged.bind(this)});
          break;
        case "domain":
          this.initDomainGUI(this.domainBuilder, gui, gui.addFolder("domain"), this.onDomainChanged.bind(this));
          break;
        case "pattern":
          if(isDefined(this.patternMaker)){
            this.initPatternGUI(this.patternMaker, gui, gui.addFolder("pattern"), this.onPatternChanged.bind(this));
          }
          break;
      }
    }
    
    if(isDefined(this.JSONpresetNames))
      this.onLoadJSONPreset();
  }

  initPresetsGUI(gui){
      // This should be made into an external GUI controller
      
      var par = this.params; 
      var pfolder = gui.addFolder("presets");
      this.controls = {};
      
      if(isDefined(this.JSONpresetNames))
        pfolder.add(par, 'JSONpreset',this.JSONpresetNames).name('Preset').onChange(this.onLoadJSONPreset.bind(this));	

      this.controllers.paramsName = pfolder.add(par, 'paramsName').name('Preset Name');
      
      let onCnvsSz = this.onGLCanvasWidth.bind(this)
      let onCnvsStl  = this.onGLCanvasStyle.bind(this)    
      pfolder.add(par, 'revertParams').name('Revert');	
      pfolder.add(par, 'saveParams').name('Save');	
      pfolder.add(par, 'saveParamsAs').name('Save As...');	
      pfolder.add(par, 'readParams').name('Open...');	
      
      let efolder = pfolder.addFolder('Export');      
                                           efolder.add(par, 'glCanvasStyle',GL_CANVAS_STYLES).name('Canvas Style').onChange(onCnvsStl);
                                           efolder.add(par, 'glCanvasWidth',50, 10000,1).name('Width').onChange(onCnvsSz);
                                           efolder.add(par, 'glCanvasHeight',50, 10000,1).name('Height').onChange(onCnvsSz);
                                           efolder.add(par, 'imageName').name('Image Name');
                                           efolder.add(par, 'saveImage').name('Save Image');      
      this.controls.timing               = efolder.add(par, 'timing').name('Timing');
      this.controls.showTiming           = efolder.add(par, 'showTiming').name('Show Timing');
      this.controls.startAnimationExport = efolder.add(par, 'startAnimationExport').name(EXPORT_ANIMATION);
      this.controls.animationStartFrame  = efolder.add(par, 'animationStartFrame').name('Start Frame');
      this.controls.animationEndFrame    = efolder.add(par, 'animationEndFrame').name('End Frame');
      this.controls.animationFrameTime   = efolder.add(par, 'animationFrameTime').name('Frame Interval');
      this.controls.animationFramePrefix = efolder.add(par, 'animationFramePrefix').name('Frame Prefix');
          
  }


  //
  //  create GUI for pattern maker
  //
  initPatternGUI(pmaker, gui, folder, onChanged){          
    
    pmaker.initGUI({
      gui:gui, 
      folder:folder, 
      onChanged:onChanged, 
      gl:  this.glRenderer.getGL(), 
      canvas:this.overlayCanvas, 
      groupMaker:this.groupMaker
    }); 
        
  }
  
  //
  //  create GUI for domain builder
  //
  initDomainGUI(dbuilder, gui, folder, onChanged){
        
    dbuilder.initGUI({
        gui:gui, 
        folder:folder, 
        onChanged:onChanged, 
        groupMaker:this.groupMaker, 
        canvas:this.overlayCanvas,
        gl:  this.glRenderer.getGL(),
      }); 
        
  }
  
  //
  //  createGUI for group builder 
  //
  initGroupGUI(gmaker, gui, folder, onChanged){
    
    gmaker.initGUI({
      gui:gui, 
      folder:folder, 
      onChanged:onChanged, 
      canvas:this.overlayCanvas, 
      renderer:this
    }); 
      
  }

  //
  //  createGUI for config
  //
  initConfigGUI(config, gui, folder, onChanged){
    
    config.initGUI({
      gui:gui, 
      folder:folder, 
      onChanged:onChanged, 
      canvas:this.overlayCanvas
    }); 
      
  }

  //
  //  handles all UI events on canvas 
  //
  handleEvent(evt){  

    try {
      this.overlayCanvas.style.cursor = 'default';  
      
      if(isFunction(this.groupMaker.handleEvent)){//if the group maker can handle it...
        this.groupMaker.handleEvent(evt); 
      }
      if(evt.grabInput)
        return;
     
      
      this.patternMaker.handleEvent(evt);
      if(evt.grabInput)
        return;    
      
      this.domainBuilder.handleEvent(evt);
      if(evt.grabInput)
        return;    
      
      this.myNavigator.handleEvent(evt);
    } catch( e){
      console.error("error in eventHandling:", e.message);
      console.error("call stack:\n", e.stack);
    }
  }
        
  //
  //  draw overlay 
  //
  render(timestamp){
   
    if(!this.needToRender)
      return;
    this.needToRender = false;
    //console.log("onMouseMove["+x +"," + y + "]");
    this.glRenderer.render(timestamp);
    
    var canvas = this.overlayCanvas;
    var context = this.drawContext;
    twglResizeCanvasToDisplaySize(canvas);
    
    var trans = this.myNavigator;
    
    var par = this.params;
    
    context.clearRect(0,0,canvas.width, canvas.height);      

    if(isFunction(this.domainBuilder.render))
      this.domainBuilder.render(context, trans);    
    
    if(isFunction(this.patternMaker.render))
      this.patternMaker.render(context, trans);         
    
    if(isFunction(this.myNavigator.render))
      this.myNavigator.render(context, trans);    
    
    if(isFunction(this.groupMaker.render)){
      this.groupMaker.render(context,trans)
    } //give groupMaker the last word...
    
    //console.timeEnd('startProgram');
    //console.timeEnd('renderFrame');
    //console.time('renderFrame');

  } // render();
  
  
  //
  //  called form UI when config param changed by user
  //
  onConfigChanged(){
    if(this.params.debug)
      console.log("onConfigChanged()");
    this.repaint();
  }

  //
  //  group waas changed in GroupMaker 
  // 
  onGroupChanged(){
    
    if(this.params.debug)
      console.log("GroupRendederer.onGroupChanged()");
    
    if(isDefined(this.domainBuilder) && isFunction(this.domainBuilder.onGroupChanged)){      
      this.domainBuilder.onGroupChanged();
    }
      
    this.repaint();    
  }
    
  //
  //   called when domain params changed in domain builder 
  //
  onDomainChanged(){
    
    this.repaint();
    
  }  
      
  //
  //   called when pattern params were changed
  //
  onPatternChanged(){
    
    this.repaint();
    
  }  

  //
  // called when navigation params were changed
  //
  onNavigationChanged(){
    
    //console.log("onNavigationChanged()");
    this.repaint();
    
  }
  
  //
  //  called when window was resized 
  //
  onWindowResize( event ) {
    
    this.repaint();
    
  }  

  /**
    return param map and class name of the object in the single pam
  */
  getClassParamsMap(obj){
    
    return {className: obj.constructor.name, params: (isDefined(obj.getParamsMap)) ? obj.getParamsMap():{}};   
    
  }

  /**
    set class params map to the given object 
  */
  setClassParamsMap(obj, map){
    if(map.className != obj.constructor.name){
      console.error('wrong class in preset:\n'+'expecting: ' ,obj.constructor.name, ', actual: ' + map.className);
      //return;
    }
    if(isDefined(obj.setParamsMap)){
      obj.setParamsMap(map.params);
    }
        
  }

  /**
    return js map which represets all the parametetrs
  */
  getParamsMap(){
    
    var par = {};
    
    par.view = this.getClassParamsMap(this.myNavigator);
    par.group = this.getClassParamsMap(this.groupMaker);
    par.config = this.getClassParamsMap(this.config);
    par.pattern = this.getClassParamsMap(this.patternMaker);
    par.domain = this.getClassParamsMap(this.domainBuilder);
    
    return par;
            
  }

  /**
    set program params data from js map 
  */
  setParamsMap(paramsMap){
    
     //console.log('GroupRenderer.setParamsMap(paramsMap)');
     
     this.controllers.paramsName.setValue(paramsMap.name); 
     
     var setParams = paramsMap.params;
     //console.log('className:', setParams.className); // should be GroupRenderer
     var topParams = setParams.params;
     
     this.setClassParamsMap(this.config, topParams.config);
     this.setClassParamsMap(this.groupMaker, topParams.group);
     this.setClassParamsMap(this.domainBuilder, topParams.domain);
     this.setClassParamsMap(this.patternMaker, topParams.pattern);
     this.setClassParamsMap(this.myNavigator, topParams.view);
     
     
  }

  /**
    revert preset values to the saved values
  */
  onRevertParams(){
    this.onLoadJSONPreset();
  }

  /**
    processes saveParams request
  */
  onSaveParams(){
            
    var pm = this.getClassParamsMap(this);       
    var setName = this.params.paramsName; 
    var pset = {name:setName, params:pm};
    
    writeToJSON(pset, setName + '.json');
    
  } 
  
  /**
    processes saveParamsAs request
  */
  onSaveParamsAs(){
            
    var name = prompt("preset name", this.params.paramsName);
    if(name){
      this.controllers.paramsName.setValue(name);
      this.onSaveParams();      
    }        
  } 

  
  /**
    callback for FileLoader called when loaded preset data is ready 
  */
  setJSONPresetData(loadedData){
    
    //console.log('setPresetData', loadedData.url);//, 'content:', loadedData.content);
    if(loadedData.success)
      this.setParamsMap(JSON.parse(loadedData.content));
    
  }
  
  /**
    load selected preset 
  */
  onLoadJSONPreset(){
    
    if(!isDefined(this.fileLoader)){
      this.fileLoader = new FileLoader();
    }
    
    if(isDefined(this.JSONpresets[this.params.JSONpreset]))
      this.fileLoader.loadFile(this.JSONpresets[this.params.JSONpreset], this.setJSONPresetData.bind(this));
    
  }
    
  /**
    procees readParams action 
  */
  onReadParams(){
    
    var myself = this;
    
    function handleFileSelect(evt){
      
      var files = evt.target.files; // FileList object
      // files is a FileList of File objects. List some properties.
      for (var i = 0, f; f = files[i]; i++) {
        console.log("file:", escape(f.name) + ',' + f.type || 'n/a',  f.size + ' bytes');
        var reader = new FileReader();

        reader.onload = 
          (function(theFile) {          
            // Closure to capture theFile information.
            return function(e) {                        
              console.log('file loaded:', theFile.name);//, '\ncontent:\n', e.target.result);
              myself.setParamsMap(JSON.parse(e.target.result));
            };
          })(f);

        // Read the text 
        reader.readAsText(f);        
      }
    }
        
    function readFile(content, fileName, contentType) {
      
        var inp = document.createElement("input");
        inp.type="file";
        inp.name="files[]";
        //inp.multiple = true;
        inp.addEventListener('change', handleFileSelect, false);
        document.body.appendChild(inp);        
        inp.click();        
        inp.remove();        
        
    }
    
    console.log("GroupRenderer.onReadParams()");
    readFile();
    console.log("GroupRenderer.onReadParams() done");
    
  }
    
  /**
  
  
  */
  onGLCanvasWidth(){
    
    // adjust the canvas size 
    this.onGLCanvasStyle();
    
  }

  /**
  
  
  */
  onGLCanvasStyle(){
    
    //return;
    switch(this.params.glCanvasStyle){
      
      default:
      case CANVAS_FIT_TO_WINDOW.name: // fit to window        
        this.glCanvas.style.width = '99vw';
        this.glCanvas.style.height = '99vh';
        this.overlayCanvas.style.width = '99vw';
        this.overlayCanvas.style.height = '99vh';        
        break;
        
      case CANVAS_CUSTOM.name:
        this.setCanvasSize(this.params.glCanvasWidth, this.params.glCanvasHeight);
        break;
      case CANVAS_HD.name:
        this.setCanvasSize(CANVAS_HD.width, CANVAS_HD.height);
        break;
      case CANVAS_4K.name: 
        this.setCanvasSize(CANVAS_4K.width, CANVAS_4K.height); 
        break;
      case CANVAS_8K.name: 
        this.setCanvasSize(CANVAS_8K.width, CANVAS_8K.height); 
        break;
      case CANVAS_HALF_HD.name: 
        this.setCanvasSize(CANVAS_HALF_HD.width, CANVAS_HALF_HD.height); 
        break;
    }    
    this.repaint();
  }

  setCanvasSize(width, height){
    
    var swidth = width + 'px';
    var sheight = height + 'px';
    
    this.glCanvas.style.width = swidth;
    this.glCanvas.style.height = sheight;
    this.overlayCanvas.style.width = swidth;
    this.overlayCanvas.style.height = sheight;

  }
  
  
  /**
  
  
  */
  onSaveImage(){

    //let fileName = prompt('image file name:', this.params.imageFileName);
    //if(fileName == null)
    //  return;
    let p = this.params;
    writeCanvasToFile(this.glCanvas, p.imageName + (p.imageCount++) + '.png');
        
  }
  
  onStartAnimationExport(){
    
    if(isDefined(this.animationControl)){
      
      console.log('Stop Animation Export');
      // stop animation 
      this.animationControl.stop();
      this.animationControl = undefined;
      
      this.controls.startAnimationExport.name(EXPORT_ANIMATION);
      
    } else {
      
      console.log('Start animation export');
      // start animation
      let par = this.params;
      this.controls.startAnimationExport.name(STOP_EXPORT_ANIMATION);
      this.animationControl = new AnimationControl({startTime:this.timeStamp, 
                                                    framePrefix:par.animationFramePrefix, 
                                                    frameInterval:par.animationFrameInterval,
                                                    startFrame:par.animationStartFrame,
                                                    endFrame:par.animationEndFrame,                                                    
                                                    });
    }
  }
  
}
