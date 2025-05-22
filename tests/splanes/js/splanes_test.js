
import {
    Shaders,
    buildProgramsCached,
    createFBO,
    getWebGLContext,
    resizeCanvas,
    setCanvasSize,
    ParamFloat,
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
    const fragIsolines = { obj:Shaders, id:'isolines'};
    const fragGridUtil     = { obj:Shaders, id:'grid_util'};
    const fragGridMain     = { obj:Shaders, id:'grid_main'};
    const fragDrawBufferMain = { obj:Shaders, id:'draw_buffer_main'};
    
    const progISO = {
        name:   'progISO', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragIsolines]},  
    };
    const progGrid = {
        name:   'progGrid', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragGridUtil, fragGridMain]},  
    };

    const progDrawBuffer = {
        name:   'progDrawBuffer', 
        vs:  {frags: [ fragVert]},
        fs: { frags: [ fragDrawBufferMain]},  
    };

    const programs = {
        isolines:     progISO,
        grid:         progGrid,
        drawBuffer:   progDrawBuffer,
    };
    let res = buildProgramsCached(gl, programs);
    console.log('build programs result: ', res);
    console.log('programs: ', programs);
    
    let config = {
        zoom: 1., 
        cx: 0,
        cy: 0,
        axesWidth: 3,
        pixelZoom: 1,
    };

    
    let cwidth = 1920, cheight = 1080;    
    
    let pixelZoom = config.pixelZoom;
    let bwidth = (cwidth/pixelZoom), bheight = (cheight/pixelZoom); 
        
    const backBuffer = createFBO(gl, bwidth, bheight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST);
    
    let mGUI = null;
    let needRedraw = true;
    initGUI();
   
    let startTime = Date.now();
    requestAnimationFrame(renderFrame);
            
    function renderFrame(){
        
        //console.log('renderFrame()');
        if(!needRedraw) {
            requestAnimationFrame(renderFrame);
            return;
        }
        needRedraw = false;
        let time = (Date.now()-startTime)/1000.; 
        setCanvasSize(canvas, cwidth, cheight);        
        resizeCanvas(canvas);
        
        let center = [config.cx,config.cy];
        let worldZoom = config.zoom;

        let pixelZoom = config.pixelZoom;            
        bwidth = (cwidth/pixelZoom);
        bheight = (cheight/pixelZoom);

        backBuffer.resize(bwidth, bheight);
        gl.viewport(0, 0, bwidth, bheight);
        clearBuffer(backBuffer);
        
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND); 
        
        
        //console.log('worldZoom: ', worldZoom);
        if(true) {
        
            let prog = programs.isolines.program;
            prog.bind();                
            gl.viewport(0, 0, bwidth, bheight);
            let pixelZoom = config.pixelZoom;
            let uni1 = {u_time: time, u_scale: 1./(worldZoom*pixelZoom), u_center: center, u_aspect: bheight/bwidth};
            prog.setUniforms(uni1);
            prog.setUniforms({u_direction: [1,0]});
            
            prog.setUniforms({u_lineWidth: 1, u_isoStep: 0.01, u_lineColor: [0,0,0.05,0.05]});
            prog.blit(backBuffer);
            prog.setUniforms({u_lineWidth: 1, u_isoStep: 0.05, u_lineColor: [0,0,0.3,0.3]});
            prog.blit(backBuffer);
            prog.setUniforms({u_lineWidth: 1, u_isoStep: 0.10,  u_lineColor: [0,0,0.5,0.5]});
            prog.blit(backBuffer);
        }
        
        if(true){
            //printGridData();
            let gprog = programs.grid.program;
            gprog.bind(); 
            let pixelZoom = config.pixelZoom;            
            let scale = 1/(worldZoom);//*pixelZoom);
            let pixelSize = 2. /(config.zoom*bwidth); 
            let gridStep = getRulerStep(pixelSize);
            let uni1 = {u_scale: scale, u_center: center, u_aspect: bheight/bwidth};
            gprog.setUniforms(uni1);
            gprog.setUniforms({u_lineWidth: 1, u_lineColor: [0.3,0.,0.0,0.8], u_gridStep:gridStep, u_axesWidth:config.axesWidth});
            
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
    
    function makeParams() {

        return {
            zoom:   ParamFloat({obj:config, key:'zoom', onChange: onParamChanged}),
            cx:     ParamFloat({obj:config, key:'cx', onChange: onParamChanged}),
            cy:     ParamFloat({obj:config, key:'cy', onChange: onParamChanged}),
            axesWidth: ParamFloat({obj:config, key:'axesWidth', onChange: onParamChanged}),
            pixelZoom: ParamFloat({obj:config, key:'pixelZoom', onChange: onParamChanged}),
        };
    }
    
    //
    //
    //
    function initGUI() {

        mGUI = new GUI({
            width: 300
        });
        createParamUI(mGUI, makeParams()); //.createUI(mGUI);
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
