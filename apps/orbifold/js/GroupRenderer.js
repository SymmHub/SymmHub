
import {
    GroupRendererConfig
}
from './GroupRendererConfig.js'

import {
    getParam,
    isFunction,
    isDefined,
    writeToJSON,
    writeCanvasToFile,
    AnimationControl,
    lerp,
    FileLoader,
    //ParamGui,
    GUI as DatGui,
    twgl,
    createInternalWindow,
    createLayeredCanvas,
    buildProgramsCached,
    getWebGLContext,
    resizeCanvas,
    getPixelRatio,
    createDoubleFBO,
    createFBO,
    CanvasTransform,
}

from './modules.js';

const LIBRARYPATH = "../library/";

const CANVAS_FIT_TO_WINDOW = {
    name: 'Fit To Window'
};
const CANVAS_CUSTOM = {
    name: 'Custom'
};
const CANVAS_HALF_HD = {
    name: 'HD/2 [960 × 540]',
    width: 960,
    height: 540
};
const CANVAS_HD = {
    name: 'HD [1920 × 1080]',
    width: 1920,
    height: 1080
};
const CANVAS_4K = {
    name: '4K [3840 × 2160]',
    width: 3840,
    height: 2160
};
const CANVAS_8K = {
    name: '8K [7680 × 4320]',
    width: 7680,
    height: 4320
};

const GL_CANVAS_STYLES = [
    CANVAS_FIT_TO_WINDOW.name,
    CANVAS_HALF_HD.name,
    CANVAS_HD.name,
    CANVAS_4K.name,
    CANVAS_8K.name,
    CANVAS_CUSTOM.name
];

const MYNAME = 'GroupRenderer';
const DEBUG = false;
const EXPORT_ANIMATION = 'Animation Export';
const STOP_EXPORT_ANIMATION = 'Stop Animation Export';

//
//  class handles general group rendering
//
export class GroupRenderer {

    //
    //
    //
    constructor(options) {

        this.renderDebugCount = 10;
        this.constructorParams = options;
        if (options.useInternalWindows) {

            this.mCanvas = createLayeredCanvas({
                onresize: this.onCanvasResize.bind(this),
                title: 'vizualization',
                storageId: 'viz'
            });

        } else {
            this.mCanvas = {
                glCanvas: options.glCanvas,
                overlay: options.overlayCanvas,
                container: options.container
            };
        }

        if (isDefined(this.mCanvas.overlay)) {
            this.drawContext = this.mCanvas.overlay.getContext("2d");
        }

        // maps world onto canvas pixels
        this.mCanvasTransform = CanvasTransform({
            canvas: this.mCanvas.overlay
        });

        this.groupMaker = options.groupMaker;

        this.config = (isDefined(options.config)) ? (options.config) : (new GroupRendererConfig());

        
        this.myNavigator = options.navigator;
        this.myNavigator.init({
                                canvas: this.mCanvas.overlay, 
                                onChanged: this.onNavigationChanged.bind(this),
                                canvasTransform: this.mCanvasTransform,
                                groupMaker: this, // to let navigator get the group 
                                //useAnimatedPointer: false,
                                });


        this.patternMaker = options.patternMaker;

        this.domainBuilder = (isDefined(options.domainBuilder)) ? (options.domainBuilder) : (new DefaultDomainBuilder());
        this.fragShader = options.fragShader;
        this.vertShader = options.vertShader;

        this.programs = options.programs;

        this.gSimBuffer = null;
        this.params = {

            groupParamChanged: true,
            cronwParamChanged: true,
            dirichletParamChanged: true,
            paramsName: 'paramSet',
            revertParams: this.onRevertParams.bind(this),
            saveParams: this.onSaveParams.bind(this),
            saveParamsAs: this.onSaveParamsAs.bind(this),
            readParams: this.onReadParams.bind(this),
            glCanvasStyle: getParam(options.canvasStyle, GL_CANVAS_STYLES[0]),
            glCanvasWidth: getParam(options.canvasWidth, 800),
            glCanvasHeight: getParam(options.canvasHeight, 800),
            saveImage: this.onSaveImage.bind(this),
            imageName: 'image',
            imageCount: 0,
            showTiming: false,
            timing: '0 ms',

            //recordAnimation:false,
            animationFramePrefix: 'frame_',
            animationFrameTime: 1000. / 60,
            animationStartFrame: 0,
            animationEndFrame: 100,
            startAnimationExport: this.onStartAnimationExport.bind(this),

        };

        if (isDefined(options.JSONpresets)) {
            // init presets
            this.JSONpresets = {};
            this.JSONpresetNames = [];
            for (var i = 0; i < options.JSONpresets.length; i++) {
                this.JSONpresetNames[i] = options.JSONpresets[i].name;
                this.JSONpresets[this.JSONpresetNames[i]] = options.JSONpresets[i].path;
            }
            this.params.JSONpreset = (isDefined(options.JSONpreset)) ? options.JSONpreset : ((this.JSONpresetNames.length > 0) ? this.JSONpresetNames[0] : '');
        }

        //to order the folders in the GUI
        // if new components are added, change the default in initGUI

        this.guiOrder = getParam(options.guiOrder, []);


    } // constructor

    //
    //   start the whole program
    //
    init() {

        var canvas = this.mCanvas.overlay;
        canvas.setAttribute('tabindex', '100');
        canvas.focus();
        this.initEventsHandler(canvas, this);
        this.initGL();

        //resizeCanvas(this.mCanvas.glCanvas);
        //resizeCanvas(this.mCanvas.overlay);

        //window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.initGUI();

        
        // FDbuffer
        //let format = this.mGLCtx.gl.RG;
        //let intFormat = this.mGLCtx.gl.RG32F;
        //let texType = this.mGLCtx.gl.FLOAT;
        //let filtering = this.mGLCtx.gl.LINEAR;     
        //let glc = this.mCanvas.glCanvas;
        //console.log(`${MYNAME} creating gFDBuffer`,glc.width, glc.height);
        //this.gFDBuffer = createFBO(this.mGLCtx.gl, glc.width,  glc.height, intFormat, format, texType, filtering);

        requestAnimationFrame(this.animationFrame.bind(this));

    }

    

    //
    //
    //
    initGL(){
                
        this.mGLCtx = getWebGLContext(this.mCanvas.glCanvas, {preserveDrawingBuffer: true});
        if(DEBUG)console.log(`${MYNAME} creating new GL Context`, this.mGLCtx);
                            
        const defines = this.getDefines();
        let result = buildProgramsCached(this.mGLCtx.gl, this.programs, defines);
        if(DEBUG)console.log('buildProgramsCached() result: ', result);
        
        this.gFDBuffer = this.createFDBuffer();
         
    } // initGL()


    //
    //  animation loop
    //  it renders only if changes were made
    //
    animationFrame(time) {

        if (!this.startTime) {
            this.startTime = time;
            this.renderTime = 0;
            this.oldTimeStamp = time;
            console.log('this.startTime: ', this.startTime);
        }

        this.timeStamp = time - this.startTime;
        //this.renderTime = lerp((this.timeStamp - this.oldTimeStamp), this.renderTime, 0.);
        this.renderTime = (this.timeStamp - this.oldTimeStamp);
        //console.log('time: ', this.timeStamp.toFixed(0), this.renderTime.toFixed(1));
        this.oldTimeStamp = this.timeStamp;

        if (this.params.showTiming) {
            this.controls.timing.setValue((this.renderTime).toFixed(1) + ' ms');
        }

        if (isDefined(this.animationControl)) {

            // exporting animation

            if (this.animationControl.isReady()) {

                //if(this.params.showTiming)
                //console.log('anim time:', this.timeStamp.toFixed(0));

                this.timeStamp = this.animationControl.getTime();
                this.render(this.timeStamp);
                this.animationControl.writeFrame(this.mCanvas.glCanvas);
                this.animationControl.incrementFrame();

                if (!this.animationControl.hasNextFrame()) {

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

    } // animationFrame(time)

    //
    //
    //
    repaint() {

        this.needToRender = true;

    };

    //
    //  return all uniforms needed for all of the rendering
    //
    //  specific shaders select out the uniforms they need: these 
    // are in orbifold_main.js

    //THIS DOESN"T DO ANYTHING!
   /* getUniforms(un) {
        console.log("getting uniforms");
        if (!isDefined(un))
            un = {};
        this.getExtUniforms(this.domainBuilder, un, this.timeStamp);
            //domainBuilder delivers the fundamental domain, the group, etc.
        this.getExtUniforms(this.config, un, this.timeStamp);
        this.getExtUniforms(this.patternMaker, un, this.timeStamp);
        this.getExtUniforms(this.myNavigator, un, this.timeStamp);
        this.getExtUniforms(this.groupMaker, un, this.timeStamp);
        // groupMaker will handle 

        return un;
    }*/

    //
    //  collect uniforms from generic uniforms maker
    //
    getExtUniforms(uniMaker, uniforms, timeStamp) {

        if (uniMaker && uniMaker.getUniforms) {
            return uniMaker.getUniforms(uniforms, timeStamp);
        }
    }

    //
    //
    //
    getDefines() {

        var def = "";

        // collect defines from components

        if (isFunction(this.domainBuilder.getDefines))
            def += this.domainBuilder.getDefines();

        if (isFunction(this.config.getDefines))
            def += this.config.getDefines();

        if (isFunction(this.patternMaker.getDefines))
            def += this.patternMaker.getDefines();

        if (DEBUG)
            console.log("defines:\n" + def);
        return def;
    }

    //
    //  build Graphical User Interface
    //
    initGUI() {

        // init canvas style
        this.onGLCanvasStyle();

        var guiOpt = {
            closeOnTop: true,
            width: 340
        };

        var gui;
        gui = new DatGui(guiOpt);
        gui.remember = function () {}; // hack to prevent DatGui from remembering presets

        this.controllers = {};

        // Be sure to add any new controllers to this list. Any controllers
        // that are not ordered in  options.guiOrder are added in this order at the end:
        var guiControllerList = ["presets", "config", "group", "navigation", "domain", "pattern"]

        var guiOrder = this.guiOrder;

        // build a new list with all elements of guiOrder removed from guiControllerList
        for (var i = 0; i < guiOrder.length; i++) {
            guiControllerList = guiControllerList.filter(x => (x != guiOrder[i]));
        }
        guiOrder = [...guiOrder, ...guiControllerList];

        // then walk through and add the gui folders; a nonsensical key is ignored.
        for (i = 0; i < guiOrder.length; i++) {
            switch (guiOrder[i]) {
            case "presets":
                this.initPresetsGUI(gui /*that's it until there's an external controller*/);
                break;
            case "config":
                this.initConfigGUI(this.config, gui, gui.addFolder("config"), this.onConfigChanged.bind(this));
                break;
            case "group":
                this.initGroupGUI(this.groupMaker, gui, gui.addFolder("group"), this.onGroupChanged.bind(this));
                break;
            case "navigation":
                this.myNavigator.initGUI({
                    gui: gui,
                    folder: gui.addFolder("navigation"),
                    onChanged: this.onNavigationChanged.bind(this)
                });
                break;
            case "domain":
                this.initDomainGUI(this.domainBuilder, gui, gui.addFolder("domain"), this.onDomainChanged.bind(this));
                break;
            case "pattern":
                if (isDefined(this.patternMaker)) {
                    this.initPatternGUI(this.patternMaker, gui, gui.addFolder("pattern"), this.onPatternChanged.bind(this));
                }
                break;
            }
        }

        if (isDefined(this.JSONpresetNames))
            this.onLoadJSONPreset();
    } // initGUI()

    //
    //
    // 
    initPresetsGUI(gui) {
        // This should be made into an external GUI controller

        var par = this.params;
        var pfolder = gui.addFolder("presets");
        this.controls = {};

        if (isDefined(this.JSONpresetNames))
            pfolder.add(par, 'JSONpreset', this.JSONpresetNames).name('Preset').onChange(this.onLoadJSONPreset.bind(this));

        this.controllers.paramsName = pfolder.add(par, 'paramsName').name('Preset Name');

        let onCnvsSz = this.onGLCanvasWidth.bind(this);
        let onCnvsStl = this.onGLCanvasStyle.bind(this);
        pfolder.add(par, 'revertParams').name('Revert');
        pfolder.add(par, 'saveParams').name('Save');
        pfolder.add(par, 'saveParamsAs').name('Save As...');
        pfolder.add(par, 'readParams').name('Open...');

        let efolder = pfolder.addFolder('Export');
        efolder.add(par, 'glCanvasStyle', GL_CANVAS_STYLES).name('Canvas Style').onChange(onCnvsStl);
        efolder.add(par, 'glCanvasWidth', 50, 10000, 1).name('Width').onChange(onCnvsSz);
        efolder.add(par, 'glCanvasHeight', 50, 10000, 1).name('Height').onChange(onCnvsSz);
        efolder.add(par, 'imageName').name('Image Name');
        efolder.add(par, 'saveImage').name('Save Image');
        
        this.controls.timing = efolder.add(par, 'timing').name('Timing');
        this.controls.showTiming = efolder.add(par, 'showTiming').name('Show Timing');
        this.controls.startAnimationExport = efolder.add(par, 'startAnimationExport').name(EXPORT_ANIMATION);
        this.controls.animationStartFrame = efolder.add(par, 'animationStartFrame').name('Start Frame');
        this.controls.animationEndFrame = efolder.add(par, 'animationEndFrame').name('End Frame');
        this.controls.animationFrameTime = efolder.add(par, 'animationFrameTime').name('Frame Interval');
        this.controls.animationFramePrefix = efolder.add(par, 'animationFramePrefix').name('Frame Prefix');

    } // initPresetsGUI(gui) 

    //
    //  create GUI for pattern maker
    //
    // 
    initPatternGUI(pmaker, gui, folder, onChanged) {

        pmaker.initGUI({
            gui:        gui,
            folder:     folder,
            onChanged:  onChanged,
            gl:         this.mGLCtx.gl,
            canvas:     this.mCanvas.overlay,
            groupMaker: this.groupMaker
        });

    }

    //
    //  create GUI for domain builder
    //
    initDomainGUI(dbuilder, gui, folder, onChanged) {

        dbuilder.initGUI({
            gui:        gui,
            folder:     folder,
            onChanged:  onChanged,
            groupMaker: this.groupMaker,
            canvas:     this.mCanvas.overlay,
            gl:         this.mGLCtx.gl,
        });

    }

    //
    //  createGUI for group builder
    //
    initGroupGUI(gmaker, gui, folder, onChanged) {

        gmaker.initGUI({
            gui: gui,
            folder: folder,
            onChanged: onChanged,
            canvas: this.mCanvas.overlay,
            renderer: this
        });

    }

    //
    //  createGUI for config
    //
    initConfigGUI(config, gui, folder, onChanged) {

        config.initGUI({
            gui: gui,
            folder: folder,
            onChanged: onChanged,
            canvas: this.mCanvas.overlay
        });

    }

    getOverlay(){
        return this.mCanvas.overlay;
    }


    //////////////////////////////////////////
    //
    //  handles all UI events on canvas
    //
    // This is the main dispatching function.
    handleEvent(evt) {
        
        let scaling = getPixelRatio(); // TODO add extra scaling 
        
        // store event coordinates in canvas' pixels 
        evt.canvasX = evt.offsetX * scaling; 
        evt.canvasY = evt.offsetY * scaling;
        try {
            
            let t0 = 0;
            //if(DEBUG) t0 = Date.now();

            this.mCanvas.overlay.style.cursor = 'default';

            if (isFunction(this.groupMaker.handleEvent)) { //if the group maker can handle it...
                this.groupMaker.handleEvent(evt);
            }
            if (evt.grabInput)
                return;

            var tool = this.config.params.whichTool;

            // As different tools and behaviors are developed, this is 
            // where a switch can be put in. 


            // For the moment, we experiment with turning off and on various
            // responses, depending on what mode the program is in.

            // These blocks seem to be basic and expandable. Each has an "option" mode;
            // To each we can add more functionality via the right click and wheel.

            // Navigate 
            // (default) drag a point around natively within the model as drawn on the screen.
            // (option) navigate applies mobius transform to the model
            // (option)-wheel is of the disk model relative to the unit disk.
            // 

            // Draw 
            // For now this just means drag around a single specially prepared texture.
            // Lots more to come in this direction

            // Flex
            // Apply a transformation to the orbifold. This doesn't need to be 
            // a separate state: when navigating, when certain features light up
            // their response overrides the regular navigation tools, 
            // if they have a response.
            // For the forseeable future, this will just be to wheel over a lit-up edge. 
            // In time however, this will become a whole other set of controls. 

            switch(tool){
            case 'draw':
                this.patternMaker.handleEvent(evt);
                //if (evt.grabInput){return;}
                return;

            case 'drag':
                this.myNavigator.handleEvent(evt);
                return


            case 'flex':
                this.domainBuilder.handleEvent(evt);
                //if (evt.grabInput)  return;
                return;

            }
            

            

            
            
        } catch (e) {
            console.error("error in eventHandling:", e.message);
            console.error("call stack:\n", e.stack);
        }
    }

    //
    //
    //
    initEventsHandler(canvas, listener) {

        //canvas.addEventListener('mousemove', listener);
        canvas.addEventListener('pointerenter', listener);
        canvas.addEventListener('pointerleave', listener);
        canvas.addEventListener('pointermove', listener);
        canvas.addEventListener('pointerenter', listener);
        canvas.addEventListener('pointerdown', listener);
        canvas.addEventListener('pointerup', listener);
        canvas.addEventListener('keydown', listener);
        canvas.addEventListener('keyup', listener);
        canvas.addEventListener('wheel', listener);
    }

    //
    //  return buffer for rendering fundamental domain into 
    // 
    createFDBuffer(){
        
        let FD_BUF_SIZE = 1024; // 512
        //let glc = this.mCanvas.glCanvas;
        //let FD_BUF_SIZE = glc.width;
        let gl = this.mGLCtx.gl;
        let format =    gl.RGBA;
        let intFormat = gl.RGBA;           // gl.RGBA32F;
        let texType =   gl.UNSIGNED_BYTE;  // gl.FLOAT;
        //let filtering = gl.LINEAR;         
        let filtering = gl.LINEAR_MIPMAP_LINEAR; // to use this filter we need to generate mipmap 
        
        return createFBO(this.mGLCtx.gl, FD_BUF_SIZE,  FD_BUF_SIZE, intFormat, format, texType, filtering);
        
    }

    //
    //  draw everything
    //
    render(timestamp) {

        if (!this.needToRender)
            return;
        this.needToRender = false;
        // TODO 
        resizeCanvas(this.mCanvas.glCanvas);
        resizeCanvas(this.mCanvas.overlay);

        let starttime = 0;
        //if(DEBUG) starttime = Date.now();

        this.renderGL(timestamp);
        this.renderOverlay(timestamp);

        //if(DEBUG) console.log('redering time: ', (Date.now() - starttime)); 

    } // render();



    //
    //  render GL canvas      
    // 
    renderGL(timestamp){
        //
        // render GL 
        // 
        let glc = this.mCanvas.glCanvas;
        let gl = this.mGLCtx.gl;
        gl.viewport(0, 0, glc.width, glc.height);
        
        let ts = this.timeStamp;

        //getting the uniforms
       
        //let allUni = this.getUniforms({});        
        let domainUni  = this.domainBuilder.getUniforms({},ts);        
        let configUni  = this.config.getUniforms({}, ts);
        let patternUni = this.patternMaker.getUniforms({}, ts);
        let navigUni   = this.myNavigator.getUniforms({}, ts);
        let groupUni   = this.groupMaker.getUniforms({}, ts);
        
        if(this.renderDebugCount && this.renderDebugCount-- > 0 && DEBUG){
            //console.log('allUni: ', allUni);   
            console.log('domainUni: ', domainUni);   
            console.log('configUni: ', configUni);   
            console.log('patternUni: ', patternUni);   
            console.log('navigUni: ',  navigUni);   
            console.log('groupUni: ',  groupUni);               
        }
                
        let fdbuff = this.gFDBuffer;
        
        gl.disable(gl.BLEND);        
        //gl.blendFunc(gl.ONE,gl.ZERO);
       
        // Rather than a new buffer being drawn, gFDBuffer is reading and overwriting itself.

        let progFD = this.programs.FDRenderer.program;
        progFD.bind();
        //let center = allUni.u_center; 
        //allUni.u_center = [0.0,0.0]; 
        //progFD.setUniforms(allUni);
        
        progFD.setUniforms(domainUni);
        progFD.setUniforms(configUni);
        progFD.setUniforms(patternUni);
        // the FD rendering region is a square of size 2 centered at origin 
        let canvasUni = {u_center: [0.,0.], u_scale:1, u_aspect: 1., u_pixelSize: 2./fdbuff.width}; 
        progFD.setUniforms(canvasUni);
        progFD.setUniforms(groupUni);
                
        if(this.config.params.debug){
            
            // draw FD image to screen 
            gl.viewport(0, 0, glc.width, glc.height);      
            progFD.blit(null);            
            
        } else {
            // draw FD image to buffer        
            gl.viewport(0, 0, fdbuff.width, fdbuff.height);      
            progFD.blit(fdbuff);
            
            fdbuff.attach(0); // set as the current texture. Needed for  generateMipmap()            
            gl.generateMipmap(gl.TEXTURE_2D); 
                        
            let progScreen = this.programs.patternFromFDRenderer.program;            
            progScreen.bind();
            
            //allUni.u_FDdata = fdbuff;
            //allUni.u_center = center;
            //progScreen.setUniforms(allUni);
            
            let fdUni = {u_FDdata:fdbuff};//
            progScreen.setUniforms(fdUni);
            progScreen.setUniforms(domainUni);
            progScreen.setUniforms(configUni);
            progScreen.setUniforms(navigUni);
            progScreen.setUniforms(groupUni);
            
            gl.viewport(0, 0, glc.width, glc.height);      
            progScreen.blit(null);   
        }
        
        
        
    }

    //
    //  render overlay canvas 
    //
    renderOverlay(timestamp){
        
        // render overlay
        
        var canvas = this.mCanvas.overlay;
        var context = this.drawContext;

        var trans = this.myNavigator;

        var par = this.params;

        context.clearRect(0, 0, canvas.width, canvas.height);

        if (isFunction(this.domainBuilder.render))
            this.domainBuilder.render(context, trans);

        if (isFunction(this.patternMaker.render))
            this.patternMaker.render(context, trans);

        if (isFunction(this.myNavigator.render))
            this.myNavigator.render(context, trans);

        if (isFunction(this.groupMaker.render)) {
            this.groupMaker.render(context, trans)
        } //give groupMaker the last word...
        
    }

    //
    //  called form UI when config param changed by user
    //
    onConfigChanged() {
        if (this.params.debug)
            console.log("onConfigChanged()");
        this.repaint();
    }

    //
    //  group waas changed in GroupMaker
    //
    onGroupChanged() {
        this.updateGroup();
        this.getGroup();
        if (this.params.debug)
            console.log("GroupRendederer.onGroupChanged()");

        if (isDefined(this.domainBuilder) && isFunction(this.domainBuilder.onGroupChanged)) {
            this.domainBuilder.onGroupChanged();
        }

        this.repaint();
    }

    //
    //   called when domain params changed in domain builder
    //
    onDomainChanged() {

        this.repaint();

    }

    //
    //   called when pattern params were changed
    //
    onPatternChanged() {

        this.patternMaker.updatePatternData(); 

            // for now; we can trim this up if there's any timing issue.

        this.repaint();

    }

    //
    // called when navigation params were changed
    //
    onNavigationChanged() {

        //console.log("onNavigationChanged()");
        this.repaint();

    }

    onCanvasResize(evt) {
        if(DEBUG)console.log(`${MYNAME}.onCanvasResize()`, evt);
        this.mCanvasTransform.onCanvasResize();
        if(DEBUG) {
            let un = this.mCanvasTransform.getUniforms({});
            console.log(`${MYNAME}.onCanvasResize() un:`, un);
        }
        this.repaint();
    }

    //
    //  called when window was resized
    //
    onWindowResize(event) {

        this.repaint();

    }

    /**
        return param map and class name of the object in the single pam
     */
    getClassParamsMap(obj) {

        return {
            className: obj.constructor.name,
            params: (isDefined(obj.getParamsMap)) ? obj.getParamsMap() : {}
        };

    }

    //
    // set class params map to the given object
    //
    setClassParamsMap(obj, map) {
        if (map.className != obj.constructor.name) {
            console.error('wrong class in preset:\n' + 'expecting: ', obj.constructor.name, ', actual: ' + map.className);
            //return;
        }
        if (isDefined(obj.setParamsMap)) {
            obj.setParamsMap(map.params);
        }

    }

    //
    //    return js map which represets all the parametetrs
    //
    getParamsMap() {

        var par = {};

        par.view = this.getClassParamsMap(this.myNavigator);
        par.group = this.getClassParamsMap(this.groupMaker);
        par.config = this.getClassParamsMap(this.config);
        par.pattern = this.getClassParamsMap(this.patternMaker);
        par.domain = this.getClassParamsMap(this.domainBuilder);

        return par;

    }

    //
    // set program params data from js map
    //
    setParamsMap(paramsMap) {

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

    //
    //  revert preset values to the saved values
    //
    onRevertParams() {
        this.onLoadJSONPreset();
    }

    //
    //  processes saveParams request
    //
    onSaveParams() {

        var pm = this.getClassParamsMap(this);
        var setName = this.params.paramsName;
        var pset = {
            name: setName,
            params: pm
        };

        writeToJSON(pset, setName + '.json');

    }

    //
    //  processes saveParamsAs request
    // 
    onSaveParamsAs() {

        var name = prompt("preset name", this.params.paramsName);
        if (name) {
            this.controllers.paramsName.setValue(name);
            this.onSaveParams();
        }
    }

    //
    //  callback for FileLoader called when loaded preset data is ready
    //
    setJSONPresetData(loadedData) {

        //console.log('setPresetData', loadedData.url);//, 'content:', loadedData.content);
        if (loadedData.success)
            this.setParamsMap(JSON.parse(loadedData.content));

    }

    //
    //  load selected preset
    //
    onLoadJSONPreset() {

        if (!isDefined(this.fileLoader)) {
            this.fileLoader = new FileLoader();
        }

        if (isDefined(this.JSONpresets[this.params.JSONpreset]))
            this.fileLoader.loadFile(this.JSONpresets[this.params.JSONpreset], this.setJSONPresetData.bind(this));

    }

    //  
    //  process readParams action
    //
    onReadParams() {

        var myself = this;

        function handleFileSelect(evt) {

            var files = evt.target.files; // FileList object
            // files is a FileList of File objects. List some properties.
            for (var i = 0, f; f = files[i]; i++) {
                console.log("file:", escape(f.name) + ',' + f.type || 'n/a', f.size + ' bytes');
                var reader = new FileReader();

                reader.onload =
                    (function (theFile) {
                    // Closure to capture theFile information.
                    return function (e) {
                        console.log('file loaded:', theFile.name); //, '\ncontent:\n', e.target.result);
                        myself.setParamsMap(JSON.parse(e.target.result));
                    };
                })(f);

                // Read the text
                reader.readAsText(f);
            }
        }

        function readFile(content, fileName, contentType) {

            var inp = document.createElement("input");
            inp.type = "file";
            inp.name = "files[]";
            //inp.multiple = true;
            inp.addEventListener('change', handleFileSelect, false);
            document.body.appendChild(inp);
            inp.click();
            inp.remove();

        }

        console.log("GroupRenderer.onReadParams()");
        readFile();
        console.log("GroupRenderer.onReadParams() done");

    } // function onReadParams

    //
    //
    //
    onGLCanvasWidth() {

        // adjust the canvas size
        this.onGLCanvasStyle();

    }

    //
    //
    //
    onGLCanvasStyle() {

        //return;
        switch (this.params.glCanvasStyle) {

        default:
        case CANVAS_FIT_TO_WINDOW.name: // fit to window
            this.mCanvas.container.style.width = '100%';
            this.mCanvas.container.style.height = '100%';
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
    } // onGLCanvasStyle() {

    //
    //
    //
    setCanvasSize(width, height) {
        //TODO add pixelRatio
        var swidth = width + 'px';
        var sheight = height + 'px';
        this.mCanvas.container.style.width = swidth;
        this.mCanvas.container.style.height = sheight;

    }

    //
    //
    //
    onSaveImage() {

        //let fileName = prompt('image file name:', this.params.imageFileName);
        //if(fileName == null)
        //  return;
        let p = this.params;
        writeCanvasToFile(this.mCanvas.glCanvas, p.imageName + (p.imageCount++) + '.png');

    }
    
    //
    //
    //
    onStartAnimationExport() {

        if (isDefined(this.animationControl)) {

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
            this.animationControl = new AnimationControl({
                startTime: this.timeStamp,
                framePrefix: par.animationFramePrefix,
                frameInterval: par.animationFrameInterval,
                startFrame: par.animationStartFrame,
                endFrame: par.animationEndFrame,
            });
        }
    } // onStartAnimationExport()
    
    updateGroup(){
        this.groupMaker.updateTheGroupGeometry();
        this.onPatternChanged();

    }
    
    getGroup(){
        return this.groupMaker.getGroup();
    }

} // class GroupRenderer

