import {
    getParam,
    isDefined,
    BoxTransform,
    drawGridAndRuler,
    resizeCanvas,
    getPixelRatio,
    ParamChoice,
    ParamInt,
    ParamBool,
    ParamFunc,
    ParamFloat,
    ParamGroup,
    ParamObj,
    createParamUI,
    createInternalWindow,
    TW as twgl,
    
}
from './modules.js';

const DEBUG = false;

const WHEEL_NORM = 125;

const fillColors = ['#B00', '#0B0', '#00B'];
const outlineColors = ['#700', '#070', '#007'];

const MY_NAME = 'DataPlot';

let count = 0;

//
// createDataPlot(params)
//
export function createDataPlot(params) {

    if (DEBUG)console.log('createDataPlot()', );

    let mCanvas = params.canvas;
    if (!mCanvas) {
        mCanvas = document.createElement('canvas');
        mCanvas.className = 'dataPlot';
    }

    let config = {
        visible: false,
        plotType: 0,
        xmin: -1.3,
        xmax: 1.3,
        ymin: -0.2,
        ymax: 1.1,
        height: 20,
        width: 50,
        left: 1,
        bottom: 0,
        centerX: 0, 
        centerY: 0,
        zoom: 1,
        
    };
   
    let mParams = makeParams(); // UI parameters
    let mFloating = params.floating;
    let plotName = getParam(params.plotName, 'unnamed plot');

    if (DEBUG)
        console.log('createDataPlot:', plotName);
    
    let mWindow = null; // interior floating window 
    
    if(mFloating) {
        
        mWindow = createInternalWindow({
                                        width:  config.width + '%',
                                        height: config.height + '%',
                                        left:   config.left + '%',
                                        top:    config.top + '%%',
                                        title:  plotName,
                                        canClose: true,
                                        canResize: true,
                                        onResize:  onResize,
                                        storageId: params.storageId,
                                        });    
        let interior = mWindow.interior;
        mCanvas.style.width = '100%';
        mCanvas.style.height = '100%';
        
        interior.style.overflowY = "hidden";
        interior.style.overflowX = "hidden";
        interior.appendChild(mCanvas);
        
    } else {  
    
        document.body.appendChild(mCanvas);
        
    }

    // inform parent that repaint is needed

    let parentRepaint = getParam(params.repainter, () => {});
    let eventHandler = params.eventHandler;

    config.left   = getParam(params.left, config.left);
    config.width  = getParam(params.width, config.width);
    config.height = getParam(params.height, config.height);
    config.bottom = getParam(params.bottom, config.bottom);
    config.plotType = getParam(params.plotType, config.plotType);
    config.visible = getParam(params.visible, config.visible);

    //if (isDefined(params.background_image))
    //    mCanvas.style['background-image'] = params.background_image;
    
    let backgroundImage = null;
    if(isDefined(params.backgroundImagePath)){
        backgroundImage = twgl.loadImage(params.backgroundImagePath, false, imageLoaded);
    }
    

    if (params.bounds) {
        setPlotBounds(params.bounds);
    }

    let context = mCanvas.getContext('2d');

    let plotData = [[]];

    let gNeedRepaint = true;

    let canvasTransform = getCanvasTransform();

    //if (isDefined(eventHandler)) {
        initEventHandler();
    //}

    onVisible();

    function makeParams() {

        return {
            showPlot: ParamFunc({
                name: 'show plot',
                func: onShowPlot,
            }),
            //visible: ParamBool({
            //    obj: config,
            //    key: 'visible',
            //    onChange: onVisible
            //}),
            potType: ParamInt({
                obj: config,
                key: 'plotType',
                onChange: redraw
            }),
            viewport: ParamGroup({
                name: 'viewport',
                params: {
                    xmin: ParamFloat({
                        obj: config,
                        key: 'xmin',
                        onChange: redraw
                    }),
                    xmax: ParamFloat({
                        obj: config,
                        key: 'xmax',
                        onChange: redraw
                    }),
                    ymin: ParamFloat({
                        obj: config,
                        key: 'ymin',
                        onChange: redraw
                    }),
                    ymax: ParamFloat({
                        obj: config,
                        key: 'ymax',
                        onChange: redraw
                    }),
                }
            }),
            viewbox: ParamGroup({
                name: 'viewbox',
                params: {
                    width: ParamFloat({
                        obj: config,
                        key: 'width',
                        name: 'plot width',
                        onChange: redraw
                    }),
                    height: ParamFloat({
                        obj: config,
                        key: 'height',
                        name: 'plot height',
                        onChange: redraw
                    }),
                    left: ParamFloat({
                        obj: config,
                        key: 'left',
                        name: 'plot left',
                        onChange: redraw
                    }),
                    bottom: ParamFloat({
                        obj: config,
                        key: 'bottom',
                        name: 'plot bottom',
                        onChange: redraw
                    }),
                    centerX: ParamFloat({
                        obj: config,
                        key: 'centerX',
                        name: 'center X',
                        onChange: redraw
                    }),
                    centerY: ParamFloat({
                        obj: config,
                        key: 'centerY',
                        name: 'center Y',
                        onChange: redraw
                    }),
                    zoom: ParamFloat({
                        obj: config,
                        key: 'zoom',
                        name: 'zoom',
                        onChange: redraw
                    }),
                },
            }),
        };
    }

    function initEventHandler() {

        let evtHandler = makeEventHandler();

        mCanvas.addEventListener('mousedown', evtHandler);
        mCanvas.addEventListener('mouseup', evtHandler);
        mCanvas.addEventListener('mousemove', evtHandler);
        mCanvas.addEventListener('wheel', evtHandler);
        mCanvas.addEventListener('click', evtHandler);
        mCanvas.addEventListener('mouseout', evtHandler);

    }

    function makeEventHandler() {

        function handleEvent(e) {
            
            // map pointer coord into internal canvas pixels
            let pixelRadio = getPixelRatio();
            e.canvasX = e.offsetX * pixelRadio;
            e.canvasY = e.offsetY * pixelRadio;
            e.wpnt = canvas2world([e.canvasX, e.canvasY]);
            //console.log('wpnt: ', e.wpnt);
            wasProcessed = false;
            switch(e.type) {
            case 'wheel':     onWheel(e); break;
            case 'mousedown': onMouseDown(e);break;
            case 'mouseup':   onMouseUp(e);break;
            case 'mousemove': onMouseMove(e);break;
            default: 
                break;
            }
            if(!wasProcessed)
                if(eventHandler) eventHandler.handleEvent(e);
        }
        return {
            handleEvent: handleEvent
        };
    }
    
    let oldMouseX = 0;
    let oldMouseY = 0;
    let mouseDown = false;
    let wasProcessed = false;
    
    function onMouseDown(e){
       oldMouseX = e.canvasX;
       oldMouseY = e.canvasY;
       mouseDown = true;
    }

    function onMouseUp(e){
        
       oldMouseX = e.canvasX;
       oldMouseY = e.canvasY;
       mouseDown = false;
    }

    function onMouseMove(e){
        if(mouseDown && !(e.ctrlKey ||e.shiftKey)){
            wasProcessed = true;
            let res = canvasTransform.translate(e.canvasX-oldMouseX, e.canvasY-oldMouseY);
            oldMouseX = e.canvasX;
            oldMouseY = e.canvasY;            
            updateTransform(res);
            drawPlot();        
        }
       //let ldMouseX = e.canvasX;
       //oldMouseY = e.canvasY;
       //mouseDown = true;
    }
    
    function onWheel(e){
        //console.log('onWheel()',e.canvasX, e.canvasY);
        wasProcessed = true;
		var delta = e.wheelDelta;
        if(!isDefined(delta)) return;
        let zoomFactor = Math.exp(0.1*(delta/WHEEL_NORM));
        let res = canvasTransform.appendZoom(zoomFactor, e.canvasX, e.canvasY);
        updateTransform(res);
        
        drawPlot();        
    }

    function updateTransform(data){
        
        config.zoom    = data.zoom;
        config.centerX = data.centerX;
        config.centerY = data.centerY;
        
        mParams.viewbox.zoom.updateDisplay();
        mParams.viewbox.centerX.updateDisplay();
        mParams.viewbox.centerY.updateDisplay();
    }
    
    function canvas2world(cpnt) {

        let wpnt = [0, 0]; // point in world coordinates
        canvasTransform.invTransform(cpnt, wpnt);
        return wpnt;

    }

    function initGUI(gui) {

        console.warn('DataPlot.initGUI(gui) should not be called ');
        createParamUI(gui, mParams);

    }

    function onResize(entries, observer){
        //console.log('DataPlot.onResize()', entries);
        redraw();
    }
    
    function onVisible() {
        
        if(mFloating){
            
            mWindow.setVisible(config.visible);
            
        } else {
            
            mCanvas.style.visibility = (config.visible) ? 'visible' : 'hidden';
            if (DEBUG)
                console.log('onVisible: ', mCanvas.style.width, mCanvas.style.height);
        }
        redraw();
    }
    
    function onShowPlot(){
        config.visible = true;
        onVisible();
    }

    function setVisible(value) {

        config.visible = value;
        onVisible();
    }

    function isVisible() {
        return config.visible;
    }

    function imageLoaded(){
        if(DEBUG)console.log('background image loaded: ', backgroundImage);
    }

    //
    //  return current transform from world to screen
    //
    function getCanvasTransform() {
        
        if(DEBUG)console.log('getCanvasTransform()', plotName);
        let wBox = {
            xmin: config.xmin,
            xmax: config.xmax,
            ymin: config.ymin,
            ymax: config.ymax
        };
        let sBox = {
            xmin: 0,
            xmax: mCanvas.width,
            ymin: mCanvas.height,
            ymax: 0
        };
        return BoxTransform({
            wBox: wBox,
            sBox: sBox,
            centerX: config.centerX,
            centerY: config.centerY,
            zoom:   config.zoom,
        });
    }

    function redraw() {
        moveCanvas();
        drawPlot();
    }

    function moveCanvas() {
        
        if(mFloating){
            // canvas style is 100% width and height
            
        } else {
            
            let iwidth = window.innerWidth;
            let iheight = window.innerHeight;

            let width = Math.floor(iwidth * config.width / 100);
            let height = Math.floor(iheight * config.height / 100);
            let left = Math.floor(iwidth * config.left / 100);
            let bottom = Math.floor(iheight * config.bottom / 100);
            //console.log('moveCanvas()', width, height, left, bottom);
            mCanvas.style.height = height + 'px';
            mCanvas.style.width = width + 'px';
            mCanvas.style.left = left + 'px';
            mCanvas.style.bottom = bottom + 'px';

        }
        resizeCanvas(mCanvas);
    }

    function drawPlot() {

        //console.log("drawPlot()", plotName);

        if (!(config.visible))
            return;

        context.clearRect(0, 0, mCanvas.width, mCanvas.height);
        

        //if(!canvasTransform)
        canvasTransform = getCanvasTransform();
        //console.log('canvasTransform:',canvasTransform);

        if(backgroundImage) {
            let pnt1 = canvasTransform.world2screen([config.xmin, config.ymax]);
            let pnt2 = canvasTransform.world2screen([config.xmax, config.ymin]);   
            //console.log('pnt1: ', pnt1);
            //console.log('pnt2: ', pnt2);
            context.drawImage(backgroundImage, pnt1[0],pnt1[1], pnt2[0] - pnt1[0],pnt2[1] - pnt1[1]);
        }

        for (let i = 0; i < plotData.length; i++) {
            let data = plotData[i];
            if (isDefined(data) && data != null) {
                switch (config.plotType) {
                default:
                case 0:
                    drawLinearPlot(context, canvasTransform, data, outlineColors[i]);
                    break;
                case 1:
                    drawPointPlot(context, canvasTransform, data, fillColors[i]);
                    break;
                }
            }
        }
        drawGridAndRuler(context, mCanvas, {
            canvasTransform: canvasTransform
        });
    }

    //
    // set data as array of (x,y) points x0,y0,x1,y1,...
    //
    function setPlotData(data, dataSlot) {

        //console.log('setPlotData: ', data, dataSlot, plotName);
        if (!isDefined(dataSlot))
            dataSlot = 0;

        plotData[dataSlot] = data;
        redraw();
        scheduleRepaint();

    }

    function scheduleRepaint() {
        //console.log('scheduleRepaint()', plotName);
        gNeedRepaint = true;
        parentRepaint();

    }

    function setPlotBounds(bounds) {

        //console.log('setPlotBounds()', name, bounds);
        config.xmin = bounds.xmin;
        config.xmax = bounds.xmax;
        config.ymin = bounds.ymin;
        config.ymax = bounds.ymax;

    }

    function repaint() {

        if (gNeedRepaint) {
            drawPlot();
            gNeedRepaint = false;
        }
    }

    //
    //  return UI parameters
    //
    function getParams() {
        return mParams;
    }

    return {
        setVisible: setVisible,
        isVisible: isVisible,
        repaint: repaint,
        initGUI: initGUI,
        setPlotData: setPlotData,
        setPlotBounds: setPlotBounds,
        getParams: getParams,

    };
} // createDataPlot(params) 

function drawLinearPlot(ctx, trans, data, color) {

    let count = data.length / 2;

    ctx.beginPath(); // Start a new path.
    ctx.lineWidth = "2";
    ctx.strokeStyle = color;
    let ps = [0, 0];
    let pw = [0, 0];
    pw[0] = data[0];
    pw[1] = data[1];
    trans.transform(pw, ps);
    ctx.moveTo(ps[0], ps[1]);
    for (let i = 1; i < count; i++) {
        pw[0] = data[2 * i];
        pw[1] = data[2 * i + 1];

        trans.transform(pw, ps);
        ctx.lineTo(ps[0], ps[1]);
    }

    ctx.stroke();

}

function drawPointPlot(ctx, trans, data, color) {

    let count = data.length / 2;

    ctx.lineWidth = "1";
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    //ctx.strokeStyle = color;
    let ps = [0, 0];
    let pw = [0, 0];
    ctx.beginPath(); // Start a new path.
    let pointSize = 5;
    for (let i = 0; i < count; i++) {
        ctx.beginPath(); // Start a new path.
        pw[0] = data[2 * i];
        pw[1] = data[2 * i + 1];
        trans.transform(pw, ps);
        //console.log('ps: ', ps);
        
        ctx.arc(ps[0], ps[1], pointSize, 0, 2 * Math.PI);
        
        ctx.fill();
        ctx.stroke();
    }

}

export function makeSamplePlotData(xmin, xmax, count) {

    let dx = (xmax - xmin) / count;
    let data = [];
    let a = 0.02;
    let f = 100.0;
    let eps = 0.000001;
    for (let i = 0; i < count; i++) {
        let x = xmin + dx * (i);
        let xf = (x - 0.12) * f;
        let y = (Math.abs(xf) > eps) ? Math.sin(xf) / (xf) : (1.0);
        data.push((x));
        data.push(y);
    }
    return data;
}