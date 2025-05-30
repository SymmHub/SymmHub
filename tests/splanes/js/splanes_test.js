
import {
    Shaders,
    buildProgramsCached,
    createFBO,
    getWebGLContext,
    resizeCanvas,
    setCanvasSize,
    ParamFloat,
    ParamInt,
    ParamBool,
    createParamUI,
    DatGUI as GUI,
    getRulerStep,
} from './modules.js';

function test_splanes() {
    
    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('WebGL2 not supported');
        throw new Error('WebGL2 not supported');
    }
    const fragVert     = { obj:Shaders, id:'vert'};
    const fragIsoUtil = { obj:Shaders, id:'iso_util'};
    const fragIsoMain = { obj:Shaders, id:'iso_main'};
    const fragGridUtil     = { obj:Shaders, id:'grid_util'};
    const fragGridMain     = { obj:Shaders, id:'grid_main'};
    const fragSplanesMain     = { obj:Shaders, id:'splanes_main'};
    const fragDrawBufferMain = { obj:Shaders, id:'draw_buffer_main'};
    
    const progISO = {
        name:   'progISO', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragIsoUtil, fragIsoMain]},  
    };
    const progGrid = {
        name:   'progGrid', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragGridUtil, fragGridMain]},  
    };

    const progSplanes = {
        name:   'progSplanes', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragIsoUtil, fragSplanesMain]},  
    };

    const progDrawBuffer = {
        name:   'progDrawBuffer', 
        vs:  {frags: [ fragVert]},
        fs: { frags: [ fragDrawBufferMain]},  
    };

    const programs = {
        isolines:     progISO,
        grid:         progGrid,
        splanes:      progSplanes, 
        drawBuffer:   progDrawBuffer,
    };
    let res = buildProgramsCached(gl, programs);
    console.log('build programs result: ', res);
    console.log('programs: ', programs);
    
    let config = {
        zoom: 1., 
        cx: 0,
        cy: 0,
        sx: 0,
        sy: 0,
        time: 0, 
        animation: false,
        blur: 0.2,
        period: 0.5,
        symOrder: 4,
        axesWidth: 3,
        isoWidth: 0.5, 
        isoShadowWidth: 5, 
        isoShadowIntensity: 0.3,
        isoStep: 0.1,
        isoOffset: 0.0,
        isoAlg: 3,
        pixelZoom: 1,
        showIsolines: true,
        showSplanes: true,
        showGrid: true,
    };

    
    let cwidth = 1920, cheight = 1080;    
    
    let pixelZoom = config.pixelZoom;
    let bwidth = (cwidth/pixelZoom), bheight = (cheight/pixelZoom); 
        
    const backBuffer = createFBO(gl, bwidth, bheight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST);
    
    let mGUI = null;
    let needRedraw = true;
    let mParams;
    initGUI();
   
    let startTime = Date.now();
    requestAnimationFrame(renderFrame);
            
    function renderFrame(){
        
        //console.log('renderFrame()');
        if(!needRedraw) {
            requestAnimationFrame(renderFrame);
            return;
        }
        needRedraw = config.animation;
        let time = config.time;
        if(config.animation){
            time = (Date.now()-startTime)/1000.; 
            config.time = time;
            mParams.time.updateDisplay();
        }
        
        
        setCanvasSize(canvas, cwidth, cheight);        
        resizeCanvas(canvas);
        
        let center = [config.cx,config.cy];

        let pixelZoom = Math.max(0.1, config.pixelZoom);
        
        bwidth = (cwidth/pixelZoom);
        bheight = (cheight/pixelZoom);

        backBuffer.resize(bwidth, bheight);
        gl.viewport(0, 0, bwidth, bheight);
        clearBuffer(backBuffer);
        
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND); 
        
        if(config.showIsolines) {
        
            let prog = programs.isolines.program;
            prog.bind();                
            gl.viewport(0, 0, bwidth, bheight);
            let scale = 1/(config.zoom);
            prog.setUniforms({u_scale: scale, u_center: center, u_aspect: bheight/bwidth});
            prog.setUniforms({u_symCenter: [config.sx,config.sy]});
            prog.setUniforms({u_time: time});
            prog.setUniforms({u_blur: config.blur});
            prog.setUniforms({u_period: config.period});
            prog.setUniforms({u_symOrder: config.symOrder});
            prog.setUniforms({u_isoWidth: config.isoWidth,u_isoAlg: config.isoAlg, u_isoColor: [0,0,0.05,0.25]});

            switch(config.isoAlg) {
            case 0: 
            case 1: 
            {
                let step = config.isoStep/10;
                let factors = [2,5];            
                for(let k = 0; k < 4; k++){
                    prog.setUniforms({u_isoStep: step});
                    prog.blit(backBuffer);
                    step *= factors[k % 2];
                }
            } break;
            case 2: 
                prog.setUniforms({u_isoStep: config.isoStep, u_isoColor: [0,0,0.05,0.99]});
                prog.blit(backBuffer);
                break;
            case 3: 
            case 4: 
                prog.setUniforms({u_isoStep: config.isoStep, 
                                  u_isoOffset: config.isoOffset,
                                  u_isoShadowWidth: config.isoShadowWidth, 
                                  u_isoShadowIntensity: config.isoShadowIntensity,
                                  u_isoColor: [0,0,0.05,0.8]});  
                prog.blit(backBuffer);                
                break;
            case 5: 
                prog.setUniforms({u_isoStep:   config.isoStep, 
                                  u_isoOffset: config.isoOffset,
                                  });              
                prog.blit(backBuffer);                
                break;            
            }    
        }

        if(config.showSplanes) {
            let prog = programs.splanes.program;
            prog.bind();                            
            let scale = 1/(config.zoom);
            prog.setUniforms({u_scale: scale, u_center: center, u_aspect: bheight/bwidth});
            prog.setUniforms({u_lineWidth:  config.isoWidth,
                              u_shadowWidth: config.isoShadowWidth, 
                              u_shadowIntensity: config.isoShadowIntensity,
                              u_lineColor: [0.3,0.,0.05,0.8]});
            prog.blit(backBuffer);                
            
        }
        
        if(config.showGrid){
            //printGridData();
            let gprog = programs.grid.program;
            gprog.bind(); 
            gl.viewport(0, 0, bwidth, bheight);
            let scale = 1/(config.zoom);
            let pixelSize = (2. /config.zoom)/bwidth; 
            let gridStep = getRulerStep(pixelSize);
            let uni1 = {u_scale: scale, u_center: center, u_aspect: bheight/bwidth};
            gprog.setUniforms(uni1);
            gprog.setUniforms({u_lineWidth: 1, u_lineColor: [0.3,0.,0.0,0.8], u_gridStep:gridStep, u_axesWidth: config.axesWidth});
            
            gprog.blit(backBuffer);
        }        
            
        const progDrawBuff = programs.drawBuffer.program; 
        progDrawBuff.bind();
        progDrawBuff.setUniforms({u_tex:backBuffer, u_scaling:1./pixelZoom});
        gl.viewport(0, 0, cwidth, cheight);
        progDrawBuff.blit(null);

        requestAnimationFrame(renderFrame);
        
    }   

    function clearBuffer(buffer){
        
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.fbo);
        gl.viewport(0,0,buffer.width, buffer.height);
        //console.log('c:', c);
        gl.clearColor(1,1,1,1);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
    }
    
    
    function onParamChanged(){
        //console.log('onParamChanged() ', config);
        needRedraw = true;
    }
    
    function onAnimChanged(){
        if(config.animation) {
            // animation started             
            needRedraw = true;
        }
    }
    
    function makeParams() {

        return {
            zoom:           ParamFloat({obj:config, key:'zoom', onChange: onParamChanged}),
            cx:             ParamFloat({obj:config, key:'cx', onChange: onParamChanged}),
            cy:             ParamFloat({obj:config, key:'cy', onChange: onParamChanged}),
            sx:             ParamFloat({obj:config, key:'sx', onChange: onParamChanged}),
            sy:             ParamFloat({obj:config, key:'sy', onChange: onParamChanged}),
            blur:           ParamFloat({obj:config, key:'blur', onChange: onParamChanged}),
            period:         ParamFloat({obj:config, key:'period', onChange: onParamChanged}),
            symOrder:       ParamInt({obj:config, key:'symOrder', min: 2, max: 20, onChange: onParamChanged}),
            time:           ParamFloat({obj:config, key:'time', onChange: onParamChanged}),
            animation:      ParamBool({obj:config, key:'animation', onChange: onAnimChanged}),
            axesWidth:      ParamFloat({obj:config, key:'axesWidth', onChange: onParamChanged}),
            isoWidth:       ParamFloat({obj:config, key:'isoWidth', onChange: onParamChanged}),
            isoShadowWidth: ParamFloat({obj:config, key:'isoShadowWidth', name: 'shadow width', onChange: onParamChanged}),
            isoShadowIntensity: ParamFloat({obj:config, key:'isoShadowIntensity', name: 'shadow intens', onChange: onParamChanged}),
            isoStep:        ParamFloat({obj:config, key:'isoStep', onChange: onParamChanged}),
            isoOffset:      ParamFloat({obj:config, key:'isoOffset', onChange: onParamChanged}),
            isoAlg:         ParamInt({obj:config,   key:'isoAlg', min: 0, max:5, onChange: onParamChanged}),
            pixelZoom:      ParamFloat({obj:config, key:'pixelZoom', onChange: onParamChanged}),
            showIsolines:   ParamBool({obj:config, key:'showIsolines', onChange: onParamChanged}),
            showSplanes:    ParamBool({obj:config, key:'showSplanes', onChange: onParamChanged}),
            showGrid:       ParamBool({obj:config, key:'showGrid', onChange: onParamChanged}),
        };
    }
    
    //
    //
    //
    function initGUI() {

        mGUI = new GUI({
            width: 300
        });
        mParams = makeParams();
        createParamUI(mGUI, mParams); //.createUI(mGUI);
    } // initGUI()

    function printGridData(){
        
        let zoom = config.zoom;
        let ps = (2 / zoom)/bwidth; 
        const LN10 = 2.3025850929940456;
        let grid = (10.*Math.exp(LN10*Math.round(Math.log(ps)/LN10)));
        console.log('ps: ', ps, ' grid: ', grid, 'ratio: ', (grid/ps));
    }
} 

test_splanes();
