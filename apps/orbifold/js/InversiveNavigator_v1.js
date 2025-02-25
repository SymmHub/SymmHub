//import {CanvasTransform} from './CanvasTransform.js';

import {
    iPackTransforms,
    iTransformU4,
    iInverseTransformU4,
    iReflectU4,
   // iGetFactorizationU4,
    iSphere,
    iPoint,
    iPlane,
    iDrawSplane,

    PI,
    abs,
    sqrt,
    sin,
    cos,
    isDefined,

    add,
    mul,
    sub, 
    eLength,

    eDistanceSquared,

    cExp,
    cDiv,
    cLog,
    cDisk2Band,
    cBand2Disk,
    GroupUtils,
    getCanvasPnt,
    CanvasTransform,

    ParamFloat,
    ParamFunc,
    ParamChoice,
    ParamBool,
    ParamString,
    createParamUI,
    setParamValues,
}
from './modules.js';

import {
    iGetFactorizationU4
} from './iGetFactorizationU4.js';

export const PROJECTION_NAMES = [
    'circle',
    'log',
    'band',
    'uhp',
    'exp',
    'sphere',
];

const DEFAULT_INCREMENT = (1.e-10);
const DEBUG = true;
const MYNAME = 'InversiveNavigator_v1';

const WHEEL_NORM = 125;

/**

 */
function _setParamValues(paramMap, ctrlMap) {

    for (var name in paramMap) {
        if (paramMap.hasOwnProperty(name)) {
            if (isDefined(ctrlMap[name]))
                ctrlMap[name].setValue(paramMap[name]);
        }
    }
}

/**
perform simple plane navigation - drag left/right and Zoom
report uniform parameters needed for gpu rendering
 */
export class InversiveNavigator {

    //
    //
    //
    constructor(options) {

        this.isInitialized = false;
        // array of inversive transforms 
        this.invtrans = [];

        if (options)
            this.init(options);
        

    }

    //
    // this should be called for proper initialization
    //
    //
    init(options) {

        console.log(`${MYNAME}.init()`, options);
        if(this.isInitialized) 
            return;
        
        this.isInitialized = true;
        
        
        this.setCanvas(options.canvas);
        if(options.onChanged) this.onChanged = options.onChanged;

        if (options.canvasTransform)
            this.canvasTransform = options.canvasTransform;
        else
            this.canvasTransform = new CanvasTransform({canvas:this.canvas});


        this.config = {
            // navigation
            resetView: this.onResetView.bind(this),
            hasGrid: false,
            projection: PROJECTION_NAMES[0],
            offsetZ: 0.,
            transString: this.getTransformString(this.invtrans),
            centerX: 0.1,
            centerY: 0.2,
            zoom: 1,
            
            expScale: {
                enabled: false,
                a1x: 1,
                a1y: 0,
                a2x: 0,
                a2y: 1,
                n1: 1,
                n2: 0,
            }
        }
        this.controllers = {};

        this.hyperDelta = {
            defaultDelta: 0.0001,
            maxDelta: 0.01,
            direction: 0,
            factor: 1.5
        }; ;
        this.zoomDelta = {
            defaultDelta: 0.001,
            maxDelta: 0.05,
            direction: 0,
            factor: 1.5
        };
        this.ellipticDelta = {
            defaultDelta: PI / (8 * 360),
            maxDelta: PI / (100),
            direction: 0,
            factor: 1.2
        };


        this.mParams = this.makeParams();

    }

    //
    //
    //
    getParams() {

        return this.mParams;

    }

    onChanged() {
        
        //console.log(`${MYNAME}.onChanged()`);
    }

    onZoomChanged(){
        this.canvasTransform.setZoom(this.config.zoom);
        this.informListener();
    }

    onCenterChanged(){
        this.canvasTransform.setCenter([this.config.centerX, this.config.centerY]);
        this.informListener();
    }

    makeParams() {

        let ctpar = this.canvasTransform.getParams();
        let par = this.config;
        let onc = this.onChanged.bind(this);
        let otc = this.onTransformChanged.bind(this);
        let ozc = this.onZoomChanged.bind(this);
        let occ = this.onCenterChanged.bind(this);
        
        let p = {
            resetView: ParamFunc({func: this.onResetView.bind(this), name: 'reset view'}),
            hasGrid:    ParamBool({obj: par,  key: 'hasGrid',                               onChange: onc}),
            projection: ParamChoice({obj:par, key: 'projection', choice: PROJECTION_NAMES,  onChange: onc}),
            centerX:    ParamFloat({obj:par, key:'centerX', onChange:occ}),
            centerY:    ParamFloat({obj:par, key:'centerY', onChange:occ}),
            //ctpar.centerX,
           // centerY:    ctpar.centerY,
            zoom:       ParamBool({obj:par,key:'zoom',onChange:ozc}),
            //ctpar.zoom,
            transString: ParamString({obj: par,key: 'transString',name:'inv trans', onChange: otc}),
        };

        return p;

    }

    //
    //  return map of parameters
    //
    getParamsMap() {
        
        var cfg = this.config;
        var ct = this.canvasTransform;

        var pm = {
            hasGrid:    cfg.hasGrid,
            projection: cfg.projection,
            offsetZ:    cfg.offsetZ,
            zoom:       cfg.zoom,
            position:   [cfg.centerX, cfg.centerY],
            transforms: this.invtrans, 
            expScale:   cfg.expScale,
        };
        return pm;
    }

    //
    // set parameters value from the map
    //
    setParamsMap(pmap) {

        console.log(`${MYNAME}.setParamsMap()`, pmap);
        
        //setParamValues(this.mParams, paramsMap);
        
        if(pmap.transforms) {
            // legacy names 
            this.invtrans = pmap.transforms;
            this.config.transString = this.getTransformString(this.invtrans);
            this.mParams.transString.updateDisplay();
        }
        if(pmap.position){
            this.canvasTransform.setCenter(pmap.position);
            //this.mParams.centerX.setValue(pmap.position[0]);
            //this.mParams.centerY.setValue(pmap.position[1]);
        }
        //if(pmap.zoom)this.canvasTransform.setZoom(pmap.zoom);
        if(pmap.zoom){
            this.mParams.zoom.setValue(pmap.zoom);
            this.canvasTransform.setZoom(pmap.zoom);
        }
        if(pmap.hasGrid)this.mParams.hasGrid.setValue(pmap.hasGrid);
        if(pmap.projection)this.mParams.projection.setValue(pmap.projection);
        
        /*
        var ctrls = this.controllers;

        ctrls.hasGrid.setValue(paramsMap.hasGrid);
        ctrls.projection.setValue(paramsMap.projection);
        if (isDefined(paramsMap.offsetZ))
            ctrls.offsetZ.setValue(paramsMap.offsetZ);
        // transformation is stored in this.invtrans and this.canvasTransform
        this.invtrans = paramsMap.transforms;
        this.canvasTransform.zoom = paramsMap.zoom;
        this.canvasTransform.position = paramsMap.position;

        ctrls.transform.setValue(this.getTransformString());

        if (isDefined(paramsMap.expScale))
            setParamValues(paramsMap.expScale, ctrls.expScale);
        */
    }

    /**
    convert projection form string into numerical id used in GPU
     */
    getProjectionID() {

        return PROJECTION_NAMES.indexOf(this.config.projection);

    }

    //
    //  init GUI controls
    //
    initGUI(options) {
        
        createParamUI(options.folder, this.mParams);
        /*
        var folder = options.folder;
        var gui = options.gui;
        var onChanged = options.onChanged;

        this.onChanged = onChanged;

        var amin = -1,
        amax = 10,
        inc = DEFAULT_INCREMENT;
        var nmin = -20,
        nmax = 20,
        ninc = 1;

        var par = this.config;
        var cntrs = this.controllers;

        folder.add(par, 'resetView').name("Reset View");

        cntrs.hasGrid = folder.add(par, 'hasGrid').onChange(onChanged).name("grid");
        cntrs.projection = folder.add(par, 'projection', PROJECTION_NAMES).onChange(onChanged);
        cntrs.offsetZ = folder.add(par, 'offsetZ', -1, 1, inc).onChange(onChanged);
        cntrs.transform = folder.add(par, 'transform').onChange(this.onTransformChanged.bind(this)).listen().name("transformation");

        var sfolder = folder.addFolder('expScale');
        cntrs.expScale = {};
        var sctrl = cntrs.expScale;
        var pscale = par.expScale;

        sctrl.enabled = sfolder.add(pscale, 'enabled').onChange(onChanged);
        sctrl.a1x = sfolder.add(pscale, 'a1x', amin, amax, inc).onChange(onChanged);
        sctrl.a1y = sfolder.add(pscale, 'a1y', amin, amax, inc).onChange(onChanged);
        sctrl.a2x = sfolder.add(pscale, 'a2x', amin, amax, inc).onChange(onChanged);
        sctrl.a2y = sfolder.add(pscale, 'a2y', amin, amax, inc).onChange(onChanged);
        sctrl.n1 = sfolder.add(pscale, 'n1', nmin, nmax, ninc).onChange(onChanged);
        sctrl.n2 = sfolder.add(pscale, 'n2', nmin, nmax, ninc).onChange(onChanged);
        //gui.remember(par);
        */
    }

    //
    //  transform param was changed via controller
    //
    onTransformChanged() {
        this.setTransformFromString(this.config.transString);
    }
    //
    //  called form UI on resetView button click
    //
    onResetView() {

        this.reset();
        
    }

    //
    // set navigation params to default
    //
    reset() {

        this.canvasTransform.reset();
        
        this.invtrans = [];
        this.updateCanvasParams();

        this.informListener();

    }

    updateCanvasParams(){
        
        let cfg = this.config;
        let par = this.mParams;
        let ct = this.canvasTransform;
        let center = ct.getCenter();
        
        cfg.centerX = center[0];
        cfg.centerY = center[1];
        cfg.zoom = ct.getZoom();
        
        par.centerX.updateDisplay();
        par.centerY.updateDisplay();
        par.zoom.updateDisplay();
                        
    }
    
    //
    // render UI onto canvas
    //
    render(context, transform) {

        if (!this.config.hasGrid)
            return;

        var thickLine = {
            lineStyle: "#2222FF",
            lineWidth: 3,
            shadowWidth: 0
        };
        var thinLine = {
            lineStyle: "#2222FF",
            lineWidth: 1,
            shadowWidth: 0
        };
        var superThinLine = {
            lineStyle: "#2222FF",
            lineWidth: 0.2,
            shadowWidth: 0
        };

        var ctrans = transform.getCanvasTransform();

        switch (this.config.projection) {

        case 'circle':
        case 'uhp':
            iDrawSplane(iSphere([0, 0, 0, 1]), context, ctrans, thickLine);
            //iDrawSplane(iPlane([1,0,0,0]), context, ctrans,thickLine);
            //iDrawSplane(iPlane([0,1,0,0]), context, ctrans,thickLine);
            break;
        }

        var lt = ctrans.screen2world([0, 0]);
        var cw = context.canvas.width;
        var ch = context.canvas.height;
        var br = ctrans.screen2world([cw, ch]);
        var gridMinX = abs(lt[0]);

        var srad = 20;
        context.beginPath();

        var gridIncrement = this.getGridIncrement(br[0] - lt[0]);
        // remember the increment
        this.gridIncrement = gridIncrement;

        var nx = (br[0] - lt[0]) / gridIncrement;
        var gridX0 = Math.ceil(lt[0] / gridIncrement) * gridIncrement;
        var ny = (lt[1] - br[1]) / gridIncrement;
        var gridY0 = Math.ceil(br[1] / gridIncrement) * gridIncrement;

        context.strokeStyle = thinLine.lineStyle;
        context.lineWidth = thinLine.lineWidth;
        this.drawGrid(context, ctrans, [gridX0, br[1]], [gridX0, lt[1]], [gridIncrement, 0], nx);
        this.drawGrid(context, ctrans, [lt[0], gridY0], [br[0], gridY0], [0, gridIncrement], ny);

        // draw another fine grid
        gridIncrement /= 10;
        nx = (br[0] - lt[0]) / gridIncrement;
        gridX0 = Math.ceil(lt[0] / gridIncrement) * gridIncrement;
        ny = (lt[1] - br[1]) / gridIncrement;
        gridY0 = Math.ceil(br[1] / gridIncrement) * gridIncrement;

        context.strokeStyle = superThinLine.lineStyle;
        context.lineWidth = superThinLine.lineWidth;
        this.drawGrid(context, ctrans, [gridX0, br[1]], [gridX0, lt[1]], [gridIncrement, 0], nx);
        this.drawGrid(context, ctrans, [lt[0], gridY0], [br[0], gridY0], [0, gridIncrement], ny);

        //this.drawGridCaptions(context, ctrans, [gridX0,br[1]], nx);

    } // render

    //
    //  draw set of parallel segments with given ends and increment
    //
    drawGrid(context, transform, p0, p1, increment, count) {

        for (var c = 0; c < count; c++) {

            var x0 = p0[0] + c * increment[0];
            var y0 = p0[1] + c * increment[1];

            var x1 = p1[0] + c * increment[0];
            var y1 = p1[1] + c * increment[1];

            var s0 = transform.world2screen([x0, y0]);
            var s1 = transform.world2screen([x1, y1]);

            context.moveTo(s0[0], s0[1]);
            context.lineTo(s1[0], s1[1]);
        }
        context.stroke();
    }

    //
    //  return appropriate grid increment for given region size
    //
    getGridIncrement(size) {

        // log of smallest size with rounded ends
        var logsize = Math.log(size) * Math.LOG10E;
        var fl = Math.floor(logsize - 0.3);
        return 1 * Math.pow(10, fl);

        //var fract = logsize-fl;
        //if(fract < 0.1)
        //  return 0.1 * Math.pow(10, fl);
        //else if(fract < 0.5)
        //  return 0.5 * Math.pow(10, fl);
        //else
        //  return 1 * Math.pow(10, fl);

    }

    setListener(listener) {
        this.listener = listener;
    }

    //
    //  inform listener that navigation param was changed
    //
    informListener() {
    //if(DEBUG) console.log(`${MYNAME}.informListener()`);
        this.config.transString = this.getTransformString(this.invtrans);
        // console.log('this.config.transform:',this.config.transform);
        this.mParams.transString.updateDisplay();

        if (this.onChanged) {
            this.onChanged();
        }
    }
    //
    //
    //
    setCanvas(canvas) {

        //console.log("InversiveNavigator.setCanvas()");

        this.canvas = canvas;

        //this.canvasTransform = new CanvasTransform({canvas:this.canvas});
    }

    //
    //  return transformation which maps pixels into world coordinates
    //
    getCanvasTransform() {

        return this.canvasTransform;

    }

    release() {

        if (isDefined(this.canvas)) {
            this.canvas = undefined;
        }
    }

    getPixelSize() {
        return this.canvasTransform.getPixelSize();
    }

    //
    // apply only canvas trasnform
    //
    world2screen(pnt) {
        return this.canvasTransform.world2screen(pnt);
    }

    //
    // apply only canvas transform
    //
    screen2world(pnt) {
        return this.canvasTransform.screen2world(pnt);
    }

    //
    //  apply complete composite transformation World2Screen(ITransform(pnt))
    //
    transform2screen(w) {
        // apply ITransform
        var iw = iTransformU4(this.invtrans, iPoint([w[0], w[1], 0, 0]));

        if(false)console.log(`${MYNAME}.transform2screen(%7.5f,%7.5f,)`,w[0],w[1]);
        // apply projection
        switch (this.config.projection) {
        default:
            this.inversiveTransformQ = true;
            break;
        case 'log': // log
            this.inversiveTransformQ = false;
            var vw = cLog(iw.v);
            iw.v[0] = vw[0];
            iw.v[1] = vw[1];
            break;
        case 'band': // band
            this.inversiveTransformQ = false;
            var vw = cDisk2Band(iw.v);
            iw.v[0] = vw[0];
            iw.v[1] = vw[1];
            break;
            // TO DO ADD UHP, and in frag
        }
        //console.log('vw:(%7.5f,%7.5f,)',iw.v[0],iw.v[1]);
        let sp = this.canvasTransform.world2screen([iw.v[0], iw.v[1]]);
        if(false)console.log('wp-> sp:[', 
                        w[0].toFixed(4),w[1].toFixed(4), '], ', 
                        iw.v[0].toFixed(4),iw.v[1].toFixed(4), '], [ ',                         
                        sp[0].toFixed(1), sp[1].toFixed(1));
        return sp;
    }

    //
    //  apply complete inverse transformation (iT^(-1) o Screen2World) (s))
    //
    transform2world(sPnt) {

        // apply inverse canvas transform
        var v = this.canvasTransform.screen2world(sPnt);
        //console.log("transform2world[%d, %d] -> [%f, %f] ", s[0], s[1],v[1], v[1]);
        // apply inverse transform
        var pw = iInverseTransformU4(this.invtrans, iPoint([v[0], v[1], 0, 0]));
        var w = pw.v;
        // apply projection
        switch (this.config.projection) {
        default:
            break;
        case 'band': //Band
            var ww = cBand2Disk(w);
            w[0] = ww[0];
            w[1] = ww[1];
        case 'log': // Log
            var ww = cExp(w);
            w[0] = ww[0];
            w[1] = ww[1];
            break;
        }
        return [w[0], w[1]];

    }

    //
    //
    //
    getInversiveTransform() {
        //note: not the inverse transform, but the transform in inversive form!
        return this.invtrans;
    }

    setInversiveTransform(trans) {
        //note: not the inverse transform, but the transform in inversive form!
        this.invtrans = trans;
    }

    //
    // return current navigation transform
    //
    getTransformString(tr) {

        //let tp = this.invtrans;
        /*
        var tp = {

            //position:     this.canvasTransform.position,
            //zoom:         this.canvasTransform.zoom,
            transforms: this.invtrans,
            // this has to be converted into raw form
        };
        //onsole.log('tp: ', tp);
        */
        var jstr = JSON.stringify(tr);
        //console.log("jstr:" + jstr);
        return jstr;

    }

    //
    // set navigation transform
    //
    setTransformFromString(str) {

        if(DEBUG) console.log(`${MYNAME}.setTransformFromString()`, str);
        var tr = JSON.parse(str);
        if(DEBUG) console.log(`${MYNAME} tr: `, tr);
        
        //this.canvasTransform.position = tr.position;
        //this.canvasTransform.zoom = tr.zoom;
        this.invtrans = tr.transforms;
        this.informListener();

    }

    //
    //
    //
    getUniforms(un) {

        //console.log(`${MYNAME}.getUniforms()`);
        var trans = this.canvasTransform;
        trans.onCanvasResize();
        //trans.initTransform();
        if (trans.getUniforms) un = trans.getUniforms(un);
        //console.log(`${MYNAME}.getUniforms() trans: `, un);
        un.u_projection = this.getProjectionID();

        un.u_offsetZ = this.config.offsetZ;
        //console.log("transforms.length:" + this.invtrans.length);
        if (this.invtrans.length >= 5) {
            this.invtrans = iGetFactorizationU4(this.invtrans);
        }
        //console.log("  -> transforms.length:" + this.invtrans.length);
        //console.log("transform to send: " + transformToString(this.invtrans,3));
        //
        // we have to send inverse transform because gpu works in pixel mode
        un.u_moebiusTransformData = iPackTransforms([GroupUtils.getInverseTransform(this.invtrans)], 1, 5);
        //console.log("transformArray: " + iArrayToString(un.u_moebiusTransformData,3));

        var scale = this.config.expScale;
        un.u_cScaleEnabled = (scale.enabled) ? (1) : (0);
        var a1 = [scale.a1x, scale.a1y];
        var a2 = [scale.a2x, scale.a2y];
        var n1 = scale.n1;
        var n2 = scale.n2;

        var s = add(mul(a1, n1), mul(a2, n2));
        // scale and rotate the lattice to make it periodic along vector [0,2*pi]
        un.u_cScale = cDiv(s, [0, 2 * PI]);

        //console.log(`${MYNAME}.getUniforms() return: `, un);

        return un;

    }

    //
    // handler of all registered events
    //
    handleEvent(evt) {

        evt.preventDefault();
        //console.log(`${MYNAME}.handleEvent()`, evt);
        switch (evt.type) {
        case 'click':
            this.onButtonClicked(evt);
            break;
        case 'pointerenter':
            this.onMouseEnter(evt);
            break;
        case 'pointerleave':
            this.onMouseLeave(evt);
            break;
        case 'pointermove':
            this.onMouseMove(evt);
            break;
        case 'pointerdown':
            this.onMouseDown(evt);
            break;
        case 'pointerup':
            this.onMouseUp(evt);
            break;
        case 'wheel':
            this.onMouseWheel(evt);
            break;

        default:
            return;
        }
    }

    onButtonClicked(evt) {

        console.log(`${MYNAME}.onButtonClicked()`, evt);

    }

    onMouseEnter(evt){
        //console.log('onMouseEnter', evt);
        const spnt = getCanvasPnt(evt);
        this.prevPointerPos = spnt;
    }

    onMouseLeave(evt){
        
       // console.log('onMouseLeave', evt);
        
    }

    //
    //
    //
    onMouseWheel(evt) {

        //console.log("InversiveNavigator.onMouseWheel()");

        if (evt.ctrlKey) {
            this.hyperbolicIncrement(evt);
            //return;
        } else if (evt.shiftKey) {

            this.ellipticIncrement(evt);
            //return;
        } else {
            this.euclideanZoom(evt);
        }

    }

    //
    //
    //
    onMouseMove(evt) {

        if(evt.buttons != 1)
            return;
        
        //console.log('onMouseDrag', evt);
        if(evt.shiftKey){
            this.ellipticScroll(evt);
        } else if(evt.ctrlKey){
            this.hyperbolicScroll(evt);
        } else {
            this.euclideanDrag(evt);
        }
        //console.log(`${MYNAME}.onMouseMove()`, evt);
    }

    euclideanDrag(evt){
        
        let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        
        this.canvasTransform.appendPan(spnt[0] - oldPos[0], spnt[1] - oldPos[1]);
        this.prevPointerPos = spnt;
        this.updateCanvasParams();
        this.informListener();        
    }


    //
    //
    //
    onMouseDown(evt) {
        
        const spnt = getCanvasPnt(evt);
        var pw = this.canvasTransform.screen2world(spnt);
        var pr = Math.max(0, Math.floor(-Math.log(this.gridIncrement) * Math.LOG10E)) + 2;
        this.config.position = '[' + pw[0].toFixed(pr) + ',' + pw[1].toFixed(pr) + ']';
        //console.log("down [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.config.fs[0]);
        this.mouseDown = true;
        //this.mouseDownPos = pw;
        this.prevPointerPos = spnt;

    }

    //
    //
    //
    onMouseUp(evt) {
        var pw = this.canvasTransform.screen2world(getCanvasPnt(evt));
        //console.log("up [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.config.fs[0]);
        this.mouseDown = false;
    }

    //
    //
    //
    normalizeTransforms() {
        //console.log(`${MYNAME}.normalizeTransform()`, this.invtrans);
        if (this.invtrans.length >= 5) {
            this.invtrans = iGetFactorizationU4(this.invtrans);
        }
    }

    //
    // hyperbolic motion with 2 fixed points - the mouse position and reflected
    //
    hyperbolicIncrement(evt) {

        var delta = Math.sign(evt.deltaY);
        var increment = this.getIncrement(delta, this.hyperDelta);

        //var pos = this.mousePosition;
        var pos = this.canvasTransform.screen2world(getCanvasPnt(evt));
        var p0 = iPoint([pos[0], pos[1], 0, 0]);
        // polar opposite point
        var p1 = iReflectU4(iPoint([0, 0, 0, 1]), p0);
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1]);
        var s2 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1 + increment]);
        var tr = this.invtrans;

        if (delta > 0) {
            tr.push(si); // conjugate scaling by the inversion sphere
            tr.push(s2);
            tr.push(s1);
            tr.push(si);
        } else {
            tr.push(si);
            tr.push(s1);
            tr.push(s2);
            tr.push(si);
        }
        this.normalizeTransforms();
        this.informListener();

    }
    
    
    //
    // elliptic motion with 2 fixed points - the mouse position and reflected
    //
    ellipticIncrement(evt) {

        var delta = Math.sign(evt.deltaY);

        var increment = this.getIncrement(delta, this.ellipticDelta);
        var angle = increment;

        var pos = this.canvasTransform.screen2world(getCanvasPnt(evt));
        var p0 = iPoint([pos[0], pos[1], 0, 0]);
        // polar opposite point
        var p1 = iReflectU4(iPoint([0, 0, 0, 1]), p0);
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        var s1 = iPlane([1, 0, 0, p0.v[0]]);
        var ca = cos(angle);
        var sa = sin(angle);
        var s2 = iPlane([ca, sa, 0, p0.v[0] * ca + p0.v[1] * sa]);
        var tr = this.invtrans;
        if (delta > 0) {
            tr.push(si); // conjugate scaling by the inversion sphere
            tr.push(s2);
            tr.push(s1);
            tr.push(si);
        } else {
            tr.push(si);
            tr.push(s1);
            tr.push(s2);
            tr.push(si);
        }
        this.normalizeTransforms();
        this.informListener();
    }


    ellipticScroll(evt){

        let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = getCanvasPnt(evt);
        
        if(eLength(sub(newPos, oldPos)) < 1.)
            return;

        this.prevPointerPos = newPos;

        if(false) console.log( 'ellipticDrag:', oldPos, newPos);
        
        let pos0 = this.canvasTransform.screen2world(oldPos);
        let pos1 = this.canvasTransform.screen2world(newPos);
        
        let dir = sub(pos1, pos0);
        let len = eLength(dir);
        let normDir = mul(dir, 1./len);
        let orth = [-normDir[1], normDir[0]];
        //let orth = [Math.sign(normDir[1]), 0];
        
        //let scenter = this.canvasTransform.getCenter();        
        //let wsize = this.canvasTransform.getWorldSize();                
        //let rad = 0.5*Math.min(wsize[0], wsize[1]);        
        let scenter = [0,0];
        let radius = 1.;
            
        let angle = len/radius;
        
        let p0 = iPoint([scenter[0] - radius*orth[0], scenter[1] - radius*orth[1], 0, 0]);
        let p1 = iPoint([scenter[0] + radius*orth[0], scenter[1] + radius*orth[1], 0, 0]);
        
        // polar opposite point
        var ri = 2*radius;
        // inversion sphere
        // si keep p0 fixed and moves p1 to infinity
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        
        var s1 = iPlane([1, 0, 0, p0.v[0]]);
        var ca = cos(angle);
        var sa = sin(angle);
        var s2 = iPlane([ca, sa, 0, p0.v[0] * ca + p0.v[1] * sa]);
        var tr = this.invtrans;
        tr.push(si); // conjugate rotation by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);

        //if(DEBUG)console.log('s1: ',this.getTransformString(this.invtrans));        

        this.normalizeTransforms();

        //if(DEBUG)console.log('s2: ',this.getTransformString(this.invtrans));        
        
        this.informListener();

    }

    hyperbolicScroll(evt){

        let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = getCanvasPnt(evt);
        if(eLength(sub(newPos, oldPos)) < 1.)
            return;
        this.prevPointerPos = newPos;

        if(false) console.log( 'ellipticScroll:', oldPos, newPos);
        
        let pos0 = this.canvasTransform.screen2world(oldPos);
        let pos1 = this.canvasTransform.screen2world(newPos);
        
        let dir = sub(pos1, pos0);
        let len = eLength(dir);
        
        let ndir = mul(dir, 1./len);
        
        let scenter = [0,0]; // center of sphere 
        let rad = 1;         // radius of sphere

        let p0 = iPoint([scenter[0] - rad*ndir[0], scenter[1] - rad*ndir[1], 0]);
        let p1 = iPoint([scenter[0] + rad*ndir[0], scenter[1] + rad*ndir[1], 0]);

        // polar opposite point
        var ri = 2*rad;
        // inversion sphere
        // si keep p0 fixed and moves p1 to infinity
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1.]);
        var s2 = iSphere([p0.v[0], p0.v[1], p0.v[2], Math.exp(len)]);
        
        var tr = this.invtrans;        
        tr.push(si); // conjugate rotation by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);
        
        //if(true)console.log('s1: ',this.getTransformString(this.invtrans));        

        this.normalizeTransforms();

        //if(DEBUG)console.log('s2: ',this.getTransformString(this.invtrans));        
        
        this.informListener();

    }

    parabolicScroll(evt){

        let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = getCanvasPnt(evt);
        if(eLength(sub(newPos, oldPos)) < 1.)
            return;
        this.prevPointerPos = newPos;

        if(false) console.log( 'ellipticScroll:', oldPos, newPos);
        
        let pos0 = this.canvasTransform.screen2world(oldPos);
        let pos1 = this.canvasTransform.screen2world(newPos);
        
        let dir = sub(pos1, pos0);
        let len = eLength(dir);
        
        let normDir = mul(dir, 1./len);
        
        let rad = 1;
        
        // inversion sphere
        var si = iSphere([0,0,0,rad]);        
        var s1 = iPlane([normDir[0], normDir[1], 0, len]);
        var s2 = iPlane([normDir[0], normDir[1], 0, 0]);
        var tr = this.invtrans;
        tr.push(si); // conjugate scaling by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);

        //if(DEBUG)console.log('s1: ',this.getTransformString(this.invtrans));        

        this.normalizeTransforms();

        //if(DEBUG)console.log('s2: ',this.getTransformString(this.invtrans));        
        
        this.informListener();

    }



    //
    //
    //
    euclideanZoom(evt) {

        var delta = evt.wheelDelta;
        if (!isDefined(delta))
            return;

        //console.log('mouseWheel X:',evt.deltaX," Y:", evt.deltaY, "Z:", evt.deltaZ, " mode:", evt.deltaMode, " delta:", evt.wheelDelta);

        let zoomFactor = Math.exp(0.1 * (delta / WHEEL_NORM));
        const spnt = getCanvasPnt(evt);
        this.canvasTransform.appendZoom(zoomFactor, spnt[0], spnt[1]);
        
        this.updateCanvasParams();
        
        this.informListener();

    }

    getIncrement(direction, deltaData) {

        if (direction == deltaData.direction) {
            // accelerate increment
            //console.log("accelerate increment");
            deltaData.delta *= deltaData.factor;
            deltaData.delta = Math.min(deltaData.delta, deltaData.maxDelta);

        } else {
            // reset delta
            //console.log("reset delta");
            deltaData.delta = deltaData.defaultDelta;
            deltaData.direction = direction;
        }
        //console.log("return ", deltaData.delta);
        return deltaData.delta;

    }
} // class InversiveNavigator
