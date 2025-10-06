import {    
    EventDispatcher,
    createDoubleFBO, 
    createFBO, 
    CliffordAttractor,
    AttPrograms,
    ParamFloat, 
    ParamBool, 
    ParamObj,
    ParamFunc,
} from './modules.js';


const MYNAME = 'IteratedAttractor';
const DEBUG = true;

function IteratedAttractor(options){
    
    let mEventDispatcher = new EventDispatcher();
    
    
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener( evtType, listener );      
    };

    function setGroup(group) {
        
      if(DEBUG)console.log(`${MYNAME}.setGroup()`, group );
      
    };

    let mRenderedBuffer;
    let mAttractor = null;
    let mBufferWidth = 1024;
    let mAccumulator;
    let mPosBuffer; // points buffer
    let mPosLoc;
    
    let mConfig = {
        running:    false,
        gamma:      2.2,
        contrast:   1, 
        brightness: 0.3,
        saturation: 0.8,
        dynamicRange:0.1,
        invert: false,  
        colorSpeed:   0.22,
        colorPhase:   Math.PI,
        pointSize:    1,
        colorSign:    1.,
        jitter:       1.25,
        histCenterX:  0,
        histCenterY:  0,
        histWidth:    5,
        iterate:    true,         
        
        
    };
    let mParams = null;
    let myself = null; 
    let mGL = null;
    let mNeedToRender = true;
    let mNeedToClear = true;
    
    function init(glContext) {

        mGL = glContext.gl;
        let gl = mGL;
        
        mAttractor = CliffordAttractor(); 
        mAttractor.addEventListener('attractorChanged', onAttractorChanged);
        mRenderedBuffer = createImageBuffer(gl, mBufferWidth);
        mAccumulator = createAccumBuffer(gl, mBufferWidth);
        mParams = makeParams(mConfig);

        if(DEBUG)console.log(`${MYNAME}.init() gl:`,gl);
        
        mPosBuffer = gl.createBuffer();

        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        
        mPosLoc = gl.getAttribLocation(cpuAcc.program, "a_position");
        
    }

    function clearAccumulator(gl, buffer){
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function getSimBuffer(options){
        
        if(mNeedToRender) {
            render(options);            
        }
        
        if(mConfig.running) 
            scheduleRepaint();
        return mRenderedBuffer;
    }
     
    //
    //  render the image buffer 
    //
    function render(options){
        
        if(DEBUG)console.log(`${MYNAME}.render()`, options);
        mNeedToRender = mConfig.running;
        let gl = mGL;
        
        if(false)console.log(`${MYNAME}.render()`);
            
        if(mNeedToClear){
            
            if(DEBUG)console.log(`${MYNAME}.clearAccumulator()`);
            clearAccumulator(gl, mAccumulator);
            mAttractor.restart();
            mNeedToClear = false;
        }
        //mAttractor.render(gl, mRenderedBuffer.read);
        let buffer = mRenderedBuffer.read;
        
        if(false)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        gl.viewport(0, 0, mAccumulator.width, mAccumulator.height);              
        gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);

        // enable blend to accumulate histogram 
        gl.enable(gl.BLEND);   
        gl.blendFunc(gl.ONE, gl.ONE);        
        gl.blendEquation(gl.FUNC_ADD);
        
        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        cpuAcc.bind();
        let cfg = mConfig;
        
        if(cfg.iterate) {
            // add points to histogram 
            mAttractor.iterate();
            gl.bindBuffer(gl.ARRAY_BUFFER, mPosBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getPoints(), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(mPosLoc);
            gl.vertexAttribPointer(mPosLoc, 4, gl.FLOAT, false, 0, 0);        
                        
            let cpuAccUni = {
              colorSpeed:   cfg.colorSpeed,
              colorPhase:   cfg.colorPhase,
              pointSize:    1,
              colorSign:    1.,
              jitter:        1.25,
              resolution:   [mAccumulator.width, mAccumulator.height],
              uHistScale:   2./cfg.histWidth,
              uHistCenter:  [cfg.histCenterX,cfg.histCenterY],
            };
            cpuAcc.setUniforms(cpuAccUni);
            
            gl.drawArrays(gl.POINTS, 0, mAttractor.getPointsCount());
        }    
        
        let histRenderer = AttPrograms.getProgram(gl, 'renderHistogram');        
        gl.viewport(0, 0, buffer.width, buffer.height);  
                
        histRenderer.bind();
        
        
        let histUni = {
            src:        mAccumulator,
            scale:      mAttractor.getTotalCount()/(mBufferWidth*mBufferWidth),
            gamma:      cfg.gamma,
            contrast:   cfg.contrast,
            brightness: cfg.brightness,
            saturation: cfg.saturation,
            dynamicRange:cfg.dynamicRange,
            invert:      cfg.invert,            
        };
        
        histRenderer.setUniforms(histUni);
        gl.disable(gl.BLEND);        
        histRenderer.blit(buffer);
        
                       
    } // render()

    function informListeners(){


        mEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
    }

    function scheduleRepaint(){
        
        informListeners();

    }
      
    function onAttractorChanged(){
        
        if(DEBUG)console.log(`${MYNAME}.onAttractorChanged()`); 
        onRestart();
    }
    
    function onStep(){
        mAttractor.iterate();
        scheduleRepaint();
    }
    
    function makeParams(cfg){
                
        console.log(`${MYNAME}.makeParams() mAttractor:`, mAttractor);
        let onc = onRerender;
        let onres = onRestart;
        
        let params = {
            attractor:  ParamObj({name:'attractor params', obj: mAttractor}),
            running:    ParamBool({obj:cfg,key:'running', onChange:onc}),   
            iterate:    ParamBool({obj:cfg,key:'iterate', onChange:onc}),   
            makeStep:   ParamFunc({func:onStep, name:'step!'}),
            gamma:      ParamFloat({obj:cfg,key:'gamma', onChange:onc}),
            contrast:   ParamFloat({obj:cfg,key:'contrast', onChange:onc}),
            brightness: ParamFloat({obj:cfg,key:'brightness', onChange:onc}),
            saturation: ParamFloat({obj:cfg,key:'saturation', onChange:onc}),
            dynamicRange: ParamFloat({obj:cfg,key:'dynamicRange', onChange:onc}),
            invert:     ParamBool({obj:cfg,key:'invert', onChange:onc}),   
                        
            colorSpeed:     ParamFloat({obj:cfg,key:'colorSpeed', onChange:onres}),
            colorPhase:     ParamFloat({obj:cfg,key:'colorPhase', onChange:onres}),
            pointSize:      ParamFloat({obj:cfg,key:'pointSize', onChange:onres}),
            colorSign:      ParamFloat({obj:cfg,key:'colorSign', onChange:onres}),
            jitter:         ParamFloat({obj:cfg,key:'jitter', onChange:onres}),
            histWidth:      ParamFloat({obj:cfg,key:'histWidth', onChange:onres}),
            histCenterX:    ParamFloat({obj:cfg,key:'histCenterX', onChange:onres}),
            histCenterY:    ParamFloat({obj:cfg,key:'histCenterY', onChange:onres}),

        }
        return params;
        
    }
    
    function onRerender(){
        mNeedToRender = true;
        scheduleRepaint();
    }

    function onRestart(){
        
        mNeedToRender = true;
        mNeedToClear = true;        
        scheduleRepaint();
    }
    
    myself = {
        getName         : () => MYNAME,
        addEventListener: addEventListener, 
        setGroup        : setGroup, 
        init            : init,
        getParams:  ()=>{return mParams;},
        getSimBuffer    : getSimBuffer,
        render          : render,
        //get canAnimate() {return true;},
    };
    return myself;
}
    
function createAccumBuffer(gl, width){
        
    const filtering = gl.NEAREST;
    const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
    return createFBO( gl, width, width, intFormat, format, texType, filtering );

}

function createImageBuffer(gl, width) {

  const filtering = gl.LINEAR;
  const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;              
  return createDoubleFBO( gl, width, width, intFormat, format, texType, filtering );

}

    
//
//  factory of iterated attracrtors 
//
const IteratedAttractorCreator = {
    //
    create:         ()=> {return IteratedAttractor();},
    getName:        () => {return `${MYNAME}-factory`;},
    getClassName:   ()=>{return `${MYNAME}-class`;}
    
}


    

export {IteratedAttractorCreator}