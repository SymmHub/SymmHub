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
    ParamObj,
    ParamString,
    ParamCustom,
    ParamGroup,
    createParamUI,
    setParamValues,
    getParamValues,
    iGetFactorizationU4,
    ProjectionTransform,
    
    AnimatedPointer,
    fa2s,
}
from './modules.js';

const DEBUG = false;


export const PROJECTION_NAMES = [
    'circle',
    'log',
    'band',
    'uhp',
    'exp',
    'sphere',
];

const DEFAULT_INCREMENT = (1.e-10);
const MYNAME = 'InversiveNavigator_v1';
const MS = 0.001;
const WHEEL_NORM = 125;
const DEFAULT_WHEEL_INCREMENT = 100;
const MIN_DRAG = 0.01;
const WHEEL_FACTOR_EUC = 0.1/WHEEL_NORM;
const WHEEL_FACTOR_ELL = 0.02;
const WHEEL_FACTOR_HYP = 0.02;

// params for AnimatedPointer
const AP_PARAMS_EUC_DRAG = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_HYP_DRAG = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_ELL_DRAG = {springForce: 50, freeFrictionFactor: 0.01,dragFrictionFactor: 2.};
const AP_PARAMS_ELL_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_HYP_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_EUC_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};

//
//
//  
//
export class InversiveNavigator {

    //
    //
    //
    constructor(options) {

        this.isInitialized = false;
        this.mAnimatedPointer = null;        
        this.mWheelTimeout = 0;
        this.mPointerDown = false;
        if(DEBUG){
            this.pointerData = null;
            this.timeoutId = 0;
        }

        this.config = {
            // navigation
            //projection: PROJECTION_NAMES[0],
            options: {
                animation: true,
            },
            euclidean: {
                enabled: true,
                centerX: 0.1,
                centerY: 0.2,
                zoom: 1.,                
                offsetZ: 0.,            
            },
            inversive:  {
                enabled: true,
                itrans: [],                
            },
            spherical: {
                enabled: false,                
            }
        }
        
        this.prevPointerPos = [0,0];
        // array of inversive transforms 
        //if (options) this.init(options);
        
        this.hyperDelta = {
            defaultDelta: 0.001,
            maxDelta: 0.01,
            direction: 0,
            factor: 1.5,
            delta: 0,
        }; 
        this.zoomDelta = {
            defaultDelta: 0.01, //0.01,
            maxDelta: 0.01, // 0.05
            direction: 0,
            factor: 1.2,
            delta: 0,            
        };
        this.ellipticDelta = {
            defaultDelta: PI / (8 * 360),
            maxDelta: PI / (100),
            direction: 0,
            factor: 1.2,
            delta: 0,            
        };
        
        this.mProjection = ProjectionTransform({ onChange:this.onProjectionChanged.bind(this), groupMaker: this});
        
    }

    getGroup(){
        if(this.mGroupMaker)
            return this.mGroupMaker.getGroup();
        else 
            return null;
    }

    //
    // this should be called for proper initialization
    //
    //
    init(options) {
        
        if(DEBUG)console.log(`${MYNAME}.init() options: `, options);                      
        
        if(options.groupMaker) {
            this.mGroupMaker = options.groupMaker;
        };
        if(isDefined(options.useAnimatedPointer)){
            this.config.options.animation = options.useAnimatedPointer;
            if(DEBUG)console.log(`${MYNAME} setting this.config.options.animation to `,options.useAnimatedPointer);
        }
        //if(DEBUG)console.log(`${MYNAME}.init() config.options : `, this.config.options);
        //if(DEBUG)console.log(`${MYNAME}.init() config: `, this.config);
        if(options.canvas)    this.setCanvas(options.canvas);
        if(options.onChanged) this.onChanged = options.onChanged;

        if (options.canvasTransform)
            this.canvasTransform = options.canvasTransform;
        else
            this.canvasTransform = new CanvasTransform({canvas:this.canvas});
               
        if(!this.mParams)
            this.mParams = this.makeParams();

    }

    getClassName(){
        return MYNAME;
    }



    //
    //
    //
    getParams() {

        return this.mParams;

    }


    onProjectionChanged(){
        if(DEBUG)console.log(`${MYNAME}.onProjectionChanged()`);
        this.informListener();
    }
    
    onChanged() {
        
        //console.log(`${MYNAME}.onChanged()`);
    }

    onZoomChanged(){
        let euc = this.config.euclidean;        
        this.canvasTransform.setZoom(euc.zoom);
        this.informListener();
    }

    onCenterChanged(){
        let euc = this.config.euclidean;
        this.canvasTransform.setCenter([euc.centerX, euc.centerY]);
        this.informListener();
    }

    makeParams() {
        
        let p = {
            projection: ParamObj({obj: this.mProjection, name: 'transforms'}),
            inversive:  this.makeInversiveParams(),
            spherical:  this.makeSphericalParams(), 
            euclidean:  this.makeEuclideanParams(),
            options:    this.makeOptionsParams(),
            
        };

        return p;

    }

    onResetInversiveTrans(){
        console.log(`${MYNAME}.onResetInversiveTrans()`);           
        
        this.config.inversive.itrans = [];
        this.mParams.inversive.itrans.updateDisplay();
        this.informListener();
    }

    onResetEuclideanTrans(){
        
        console.log(`${MYNAME}.onResetEuclideanTrans()`);
        this.canvasTransform.reset();        
        this.updateCanvasParams();

        this.informListener();
        
    }

    onResetSphericalTrans(){
        
        console.log(`${MYNAME}.onResetSphericalTrans()`);           
        
    }

    // 
    //  animation param changed
    //    
    onAnimationChanged(){
        
        if(this.config.options.animation){
            
           this.informListener(); // start animation callback  
           
        } else {
            
            this.mAnimatedPointer = null; // stop animation callback 
            
        }
    }

    makeOptionsParams(){
        let opt = this.config.options;
        let onc = this.onAnimationChanged.bind(this);
        return ParamGroup({
            name: 'options',
            params: {
                animation: ParamBool({obj:opt, key: 'animation', onChange: onc})
            }
        });
    }
    
    makeEuclideanParams(){
        
        let obj = this.config.euclidean;
        let ret = this.onResetEuclideanTrans.bind(this);
        let occ = this.onCenterChanged.bind(this);
        let ozc = this.onZoomChanged.bind(this);
        
        return ParamGroup({
            name: 'euclidean',
            params: {
            //enabled: ParamBool({obj: obj, key: 'enabled', onChange:opc}),
            reset:      ParamFunc({func:ret,  name: 'reset'}),
            centerX:    ParamFloat({obj:obj,  key:'centerX', name: 'x-center', onChange:occ}),
            centerY:    ParamFloat({obj:obj,  key:'centerY', name: 'y-center', onChange:occ}),
            zoom:       ParamFloat({obj:obj,  key:'zoom',                      onChange:ozc}),
        }
        });
    }
    
    makeInversiveParams(){
        
        let obj = this.config.inversive;
        let otc = this.onTransStringChanged.bind(this);
        let opc = this.onChanged.bind(this);
        let ort = this.onResetInversiveTrans.bind(this);
        
        return ParamGroup({
            name: 'inversive',
            params: {
                enabled: ParamBool({obj: obj, key: 'enabled', onChange:opc}),
                itrans:  ParamInvTrans({obj: obj, key: 'itrans', name: 'inv trans', onChange:otc}),
                reset:  ParamFunc({func: ort, name: 'reset'}),
            }
        });
    }

    makeSphericalParams(){
        
        let obj = this.config.spherical;
        let opc = this.onChanged.bind(this);
        return ParamGroup({
            name: 'spherical',
            params: {
                enabled: ParamBool({obj: obj, key: 'enabled', onChange:opc}),
                reset:  ParamFunc({func: this.onResetSphericalTrans.bind(this), name: 'reset'}),
            }
        });
    }


    onTransStringChanged(){
        if(DEBUG)console.log(`${MYNAME}.onTransChanged()`);
    }

    
    getParamsMap() {
        
        return getParamValues(this.mParams);

    }
    
    //
    // set parameters value from the map  
    //
    setParamsMap(pmap, initialize=false) {
        // legacy compatibility 
        if(DEBUG) console.log(`${MYNAME}.setParamsMap()`, pmap);
        if(this.mAnimatedPointer) this.mAnimatedPointer.stop();
        
        if(isDefined(pmap.centerX)){
            // legacy files 
            pmap.euclidean = {centerX: pmap.centerX, centerY: pmap.centerY, zoom:pmap.zoom };
            if(DEBUG)console.log(`${MYNAME}.  euclidean`, pmap);        
        }
        setParamValues(this.mParams, pmap, initialize);
        
        
        //return;
        
        /*
        //setParamValues(this.mParams, paramsMap);        
        if(pmap.transforms) {
            
        //    pmap = upgradeParamMap_v0(pmap);
       // }
        
            // legacy names 
            this.config.inversive.itrans = (pmap.transforms) ? pmap.transforms : [];
            this.mParams.inversive.itrans.updateDisplay();
        }
        if(pmap.position){
            this.canvasTransform.setCenter(pmap.position);
            //this.mParams.centerX.setValue(pmap.position[0]);
            //this.mParams.centerY.setValue(pmap.position[1]);
        }
        //if(pmap.zoom)this.canvasTransform.setZoom(pmap.zoom);
        if(pmap.zoom){
            this.mParams.euclidean.zoom.setValue(pmap.zoom);
            this.canvasTransform.setZoom(pmap.zoom);
        }
        //if(pmap.projection)this.mParams.projection.setValue(pmap.projection);
        */
    }

    upgradeParams_v0(pmap){
        return {
            
        }
    }

    //
    // convert projection form string into numerical id used in GPU
    // 
    getProjectionID() {

        return PROJECTION_NAMES.indexOf(this.config.projection);

    }

    //
    //  init GUI controls
    //
    initGUI(options) {
        if(DEBUG) console.log(`${MYNAME}.initGUI()`, this.config);
        if(options.folder)
            createParamUI(options.folder, this.mParams);
        if(options.onChanged) this.onChanged = options.onChanged;

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
        
        this.config.inversive.itrans = [];
        this.mParams.inversive.itrans.updateDisplay();
        this.updateCanvasParams();

        this.informListener();

    }

    updateCanvasParams(){
        
        let cfg = this.config.euclidean;
        let par = this.mParams.euclidean;
        
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
        
        if(this.pointerData)this.pointerData.log.push({log: `${MYNAME}.informListener()`, timeStamp: this.timeStamp});
        if (this.onChanged) {
            this.onChanged();
        }
    }
    //
    //
    //
    setCanvas(canvas) {

        this.canvas = canvas;

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
    // apply only canvas transform
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
        var iw = iTransformU4(this.config.inversive.itrans, iPoint([w[0], w[1], 0, 0]));

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
        if(false)console.log('wp-> sp:[', fa2s(w, 4), ',', fa2s(iw.v,4), sp[0].toFixed(1), sp[1].toFixed(1));
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
        var pw = iInverseTransformU4(this.config.inversive.itrans, iPoint([v[0], v[1], 0, 0]));
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
        return this.config.inversive.itrans;
    }

    setInversiveTransform(trans) {
        //note: not the inverse transform, but the transform in inversive form!
        this.config.inversive.itrans = trans;
        this.mParams.inversive.itrans.updateDisplay();
    }

    //
    //
    //
    getUniforms(un, timestamp) {
        
        this.timeStamp = timestamp;
            
        if(this.mAnimatedPointer){
            
            let ap = this.mAnimatedPointer;
            
            if(ap.isMoving(timestamp)) {
                switch(ap.eventData.type){
                    case 'pointermove': {
                        ap.calculate(timestamp); 
                        let pnt  = ap.getPnt();
                        this.onPointerDrag(pnt, ap.eventData);
                        if(DEBUG && this.pointerData) {
                            this.pointerData.log.push({log: 'pointer moving', timestamp: timestamp});
                            this.pointerData.pointerX.push({x: timestamp, y: pnt[0]});
                        }                        
                    }                    
                    break;
                    
                    case 'wheel':{
                        let w0 = ap.getX();  // wheel position before motion 
                        ap.calculate(timestamp); 
                        let w1  = ap.getX(); // position after motion 
                        //if(DEBUG) console.log('w0: w1: ', w0, w1);
                        this.onPointerWheel(w1-w0, ap.eventData);
                        if(DEBUG && this.pointerData) {
                            let pd = this.pointerData;
                            pd.log.push({log: 'wheel', timestamp: timestamp});
                            pd.pointerX.push({x: timestamp, y: w1});
                        }                        
                    }
                    break;
                }
                this.informListener();
            } else {
                //if(DEBUG && this.pointerData) this.pointerData.log.push({log: 'pointer stopped', timestamp: timestamp});
                if(true) console.log('   pointer stopped ',timestamp);
                ap.stop();
                this.mAnimatedPointer = null;
            }
            
        }
        //console.log(`${MYNAME}.getUniforms()`);
        var ct = this.canvasTransform;

        if (ct.getUniforms) un = ct.getUniforms(un, timestamp);
        if(false)console.log(`${MYNAME}.getUniforms() un: `, un);
        if(false) console.log(`${MYNAME} invtras: `, );
        let itc = this.config.inversive;
        if (itc.enabled){
            this.normalizeTransforms();
            //
            // we have to send inverse transform because gpu works in pixel mode
            un.u_moebiusTransformData = iPackTransforms([GroupUtils.getInverseTransform(itc.itrans)], 1, 5);
            un.u_hasMoebiusTransform = true;
            //console.log("transformArray: " + iArrayToString(un.u_moebiusTransformData,3));
        } else {
            un.u_hasMoebiusTransform = false;            
        }

        un.u_sphericalProjectionEnabled = this.config.spherical.enabled;

        un = this.mProjection.getUniforms(un, timestamp);
        
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
            this.onPointerEnter(evt);
            break;
        case 'pointerleave':
            this.onPointerLeave(evt);
            break;
        case 'pointermove':
            this.onPointerMove(evt);
            break;
        case 'pointerdown':
            this.onPointerDown(evt);
            break;
        case 'pointerup':
            this.onPointerUp(evt);
            break;
        case 'wheel':
            this.onWheel(evt);
            break;

        default:
            return;
        }
    }

    onButtonClicked(evt) {

        if(DEBUG)console.log(`${MYNAME}.onButtonClicked()`, evt);

    }

    onPointerEnter(evt){
        if(DEBUG)console.log('onPointerEnter', evt);
        const spnt = getCanvasPnt(evt);
        this.prevPointerPos = spnt;
    }

    onPointerLeave(evt){
       
        if(DEBUG) console.log('onPointerLeave', evt);
        // equivalent to 
        this.onPointerUp(evt);
        //this.mPointerDown = false;
        
    }

    //
    //
    //
    onPointerDown(evt) {
        
        const spnt = getCanvasPnt(evt);
        this.prevPointerPos = spnt;
        if(DEBUG)console.log(`${MYNAME}.onPointerDown()`, evt);
        this.mPointerDown = true;
        
        if(this.config.options.animation){ 
            
            if(!this.mAnimatedPointer){
                this.mAnimatedPointer = new AnimatedPointer();
            }
            
            let ap = this.mAnimatedPointer;
            ap.setMouse(spnt[0], spnt[1]);            
            ap.synchronize();
            ap.setDragState(true, this.timeStamp);
            ap.eventData = evt; // remember the mouse state 
            ap.setParams(this.getPointerDragParams(evt));
            if(DEBUG) {
                this.pointerData = this.getEmptyPointerData();
                this.pointerData.log.push({log:'onPointerDown()', evt: evt});
            }
            
            // to initiate rendering call
            this.informListener();
            
        } else {        
        
            var pw = this.canvasTransform.screen2world(spnt);
            var pr = Math.max(0, Math.floor(-Math.log(this.gridIncrement) * Math.LOG10E)) + 2;
            this.config.position = '[' + pw[0].toFixed(pr) + ',' + pw[1].toFixed(pr) + ']';
            //console.log("down [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.config.fs[0]);
            this.mouseDown = true;
        }
    }

    //
    //
    //
    onPointerUp(evt) {
        
        if(DEBUG)console.log(`${MYNAME}.onPointerUp()`, evt);
        //let spnt = getCanvasPnt(evt);
        this.mPointerDown = false;
        if(this.mAnimatedPointer){
            
            this.mAnimatedPointer.setDragState(false, this.timeStamp);
            
            //if(DEBUG)this.timeoutId = setTimeout(this.printPointerData.bind(this), 3000);
        
        } else {
            //console.log("up [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.config.fs[0]);
            this.mouseDown = false;
        }
    }

    //
    //  simulate wheel release event 
    //
    onWheelTimeout(){
        // simulate mouse wheel release 
        if(this.mAnimatedPointer)
            this.mAnimatedPointer.setDragState(false, this.timeStamp);
        this.mWheelTimeout = null;
    }
    //
    //
    //
    onWheel(evt) {

        if(DEBUG) console.log(`${MYNAME}.onWheel()`, evt);                   
        evt.preventDefault();
        if(! evt.deltaY) {
            console.error(`${MYNAME}.onWheel() ignoring event with missing evt.deltaY: `, evt);
            return;
        }
        // this is bad for smooth scroll 
        let wheelIncrement = getNormalizedDelta(evt);// * DEFAULT_WHEEL_INCREMENT;
        
            
        if(this.config.options.animation) {           
        
            if(this.mWheelTimeout){
                window.clearTimeout(this.mWheelTimeout);
            } 
            // to simulate wheel release event 
            this.mWheelTimeout = window.setTimeout(this.onWheelTimeout.bind(this), 1000);
            
            let ap = this.mAnimatedPointer;            
            if(!ap){
                // create new animated pointer 
                ap = new AnimatedPointer();   
                ap.setMouse(0,0);
                ap.synchronize();
                this.mAnimatedPointer = ap;
                if(DEBUG) {
                    this.pointerData = this.getEmptyPointerData();
                    //this.timeoutId = window.setTimeout(this.printPointerData.bind(this), 10000);
                }
            }            
            ap.setParams(this.getPointerWheelParams(evt));
            ap.incrementMouse(wheelIncrement,0.);
            ap.setDragState(true, this.timeStamp);
            ap.eventData = evt;
            if(DEBUG) {
                this.pointerData.log.push({log:'onWheel()', evt: evt, timestamp: this.timeStamp});
                this.pointerData.mouseX.push({x:this.timeStamp, y: ap.getMouse()[0]});
            }

        } else {
            
            // no animation 
            this.onPointerWheel(wheelIncrement, evt);
            
            this.informListener();
        }
        
        this.informListener();

    }

    //
    //
    //
    onPointerMove(evt) {

        if(evt.buttons != 1)
            return;
        if(!this.mPointerDown)
            return;
        
        const spnt = getCanvasPnt(evt);

        //if(DEBUG) console.log('onPointerMove()',fa2s(spnt,2));
        
        if(this.mAnimatedPointer) {           
            
            let ap = this.mAnimatedPointer;
            ap.setMouse(spnt[0], spnt[1]);  
            ap.eventData = evt;
            if(DEBUG && this.pointerData) this.pointerData.mouseX.push({x: this.timeStamp, y: spnt[0]});
            this.informListener(); // initialize the repaint 
            
        } else {
            
            this.onPointerDrag(spnt, evt);
            this.informListener(spnt);
            
        }
        //console.log(`${MYNAME}.onPointerMove()`, evt);
    }

    
    //
    //  react on wheel event (real or animated) 
    // 
    onPointerWheel(increment, evt){
        
        let spnt = getCanvasPnt(evt);
        if(DEBUG) console.log(`${MYNAME}.onPointerWheel(): `, spnt, increment, evt);        
        if (evt.ctrlKey) {
            
            this.onWheelHyperbolic(spnt, increment/WHEEL_NORM);
            
        } else if (evt.shiftKey) {
            
            this.onWheelElliptic(spnt, increment/WHEEL_NORM);
            
        } else {
            
            this.onWheelEuclidean(spnt, increment);
            
        }
        
    }

    //
    //  
    //
    getPointerDragParams(evt){
        
        if(evt.shiftKey) 
            return AP_PARAMS_ELL_DRAG;
        if(evt.ctrlKey) 
            return AP_PARAMS_HYP_DRAG;
        else 
            return AP_PARAMS_EUC_DRAG;
        
    }

    //
    //
    //
    getPointerWheelParams(evt){
        
        if(evt.shiftKey) 
            return AP_PARAMS_ELL_WHEEL;
        if(evt.ctrlKey) 
            return AP_PARAMS_HYP_WHEEL;
        else 
            return AP_PARAMS_EUC_WHEEL;
        
    }


    //
    //  for debugging
    //
    printPointerData(){
        
        console.log('pointerData: ', this.pointerData);
        this.pointerData = null;
        this.mAnimatedPointer = null;
        this.timeoutId = 0;
        
    }

    //
    //  process pointer dragging event 
    //
    onPointerDrag(spnt, eventData){
                
        //let oldp = this.prevPointerPos;        
        if(this.pointerData) this.pointerData.log.push({log:'onPointerDrag():', spnt: fa2s(spnt, 2)});

        let evt = eventData;
        
        if(evt.buttons != 1)
            return;
        
        if(evt.shiftKey){
            this.onDragElliptic(spnt);
        } else if(evt.ctrlKey){
            this.onDragHyperbolic(spnt);
        } else {
            this.onDragEuclidean(spnt);
        }
        
    }
    
    //
    //  makes empty pointerData and clears timeout if exists (for debugging) 
    //
    getEmptyPointerData(){
        if(this.timeoutId){
            clearTimeout(this.timeoutId);
        }
        return {log: [], pointerX: [], mouseX:[]};    
    }

    //
    // hyperbolic motion with 2 fixed points: 1 - the mouse position and 2 - reflected
    //
    onWheelHyperbolic(spnt, wheelIncrement) {

        var delta = Math.sign(wheelIncrement);
        //var increment = this.getIncrement(wheelIncrement, this.hyperDelta);
        var increment = wheelIncrement*WHEEL_FACTOR_HYP;
        //var pos = this.mousePosition;
        var pos = this.canvasTransform.screen2world(spnt);
        var p0 = iPoint([pos[0], pos[1], 0, 0]);
        // polar opposite point
        var p1 = iReflectU4(iPoint([0, 0, 0, 1]), p0);
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1]);
        var s2 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1 + increment]);
        var tr = this.config.inversive.itrans;

    if (true) { //if(delta > 0) {
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
        //this.informListener();

    }
    
    
    //
    // elliptic motion with 2 fixed points: 1 - the mouse position and 2 - reflected
    //
    onWheelElliptic(spnt, wheelIncrement) {

        var delta = Math.sign(wheelIncrement);

        var increment = this.getIncrement(delta, this.ellipticDelta);
        var angle = wheelIncrement * WHEEL_FACTOR_ELL;//increment;

        var pos = this.canvasTransform.screen2world(spnt);
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
        var tr = this.config.inversive.itrans;
        if (true) {//delta > 0) {
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
        //this.informListener();
    }

    //
    // euclidean wheel - zoom at the given point
    //
    onWheelEuclidean(spnt, wheelIncrement) {

        if(DEBUG) console.log(`${MYNAME}.onWheelEuclidean() spnt: `, spnt, ` wheelIncrement:`, wheelIncrement);
        var delta =  Math.sign(wheelIncrement);
        
        let increment = this.getIncrement(delta, this.zoomDelta);

        if(DEBUG) console.log(`${MYNAME}.onWheelEuclidean() delta: `, delta);
        if(DEBUG) console.log(`${MYNAME}    increment: `, increment);
        let zoomFactor = Math.exp(-(wheelIncrement*WHEEL_FACTOR_EUC));
        if(DEBUG) console.log(`${MYNAME} zoomFactor: `, zoomFactor);
        this.canvasTransform.appendZoom(zoomFactor, spnt[0], spnt[1]);        
        this.updateCanvasParams();
        
        //this.informListener();

    }

    //
    //
    //
    onDragEuclidean(spnt){
        
        const oldPos = this.prevPointerPos;
        
        this.canvasTransform.appendPan(spnt[0] - oldPos[0], spnt[1] - oldPos[1]);
        this.prevPointerPos = spnt;
        this.updateCanvasParams();
        //this.informListener();        
    }

    //
    //
    //
    onDragElliptic(spnt){

        //let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = spnt;
        
        if(eLength(sub(newPos, oldPos)) < MIN_DRAG)
            return;

        this.prevPointerPos = newPos;

        if(false) console.log( 'onDragElliptic:', oldPos, newPos);
        
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
        var tr = this.config.inversive.itrans;
        tr.push(si); // conjugate rotation by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);

        this.normalizeTransforms();        
        //this.informListener();

    }

    //
    //
    //
    onDragHyperbolic(spnt){

        //let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = spnt; //getCanvasPnt(evt);
        if(eLength(sub(newPos, oldPos)) < MIN_DRAG)
            return;
        this.prevPointerPos = newPos;

        if(false) console.log( 'onDragHyperbolic:', oldPos, newPos);
        
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
        
        var tr = this.config.inversive.itrans;        
        tr.push(si); // conjugate rotation by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);
        
        this.normalizeTransforms();

        //this.informListener();

    }

    //
    // 
    //
    parabolicScroll(spnt){

        //let spnt = getCanvasPnt(evt);
        const oldPos = this.prevPointerPos;
        const newPos = spnt;//getCanvasPnt(evt);
        if(eLength(sub(newPos, oldPos)) < 1.)
            return;
        this.prevPointerPos = newPos;

        if(false) console.log( 'parabolicScroll:', oldPos, newPos);
        
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
        var tr = this.config.inversive.itrans;
        tr.push(si); // conjugate scaling by the inversion sphere
        tr.push(s1);
        tr.push(s2);
        tr.push(si);

        this.normalizeTransforms();

        //this.informListener();

    }

    //
    //
    //
    normalizeTransforms() {
        let itr = this.config.inversive.itrans;
        if (itr.length > 5) {
            this.config.inversive.itrans = iGetFactorizationU4(itr);
            this.mParams.inversive.itrans.updateDisplay();
        }
    }

    getIncrement(direction, deltaData) {

        if (direction == deltaData.direction) {
            // accelerate increment
            //if(DEBUG)console.log("accelerate increment");
            deltaData.delta *= deltaData.factor;
            deltaData.delta = Math.min(deltaData.delta, deltaData.maxDelta);
            
        } else {
            // reset delta
            //if(DEBUG) console.log("reset delta");
            deltaData.delta = deltaData.defaultDelta;
            deltaData.direction = direction;
        }
        //console.log("return ", deltaData.delta);
        return deltaData.delta;

    }
} // class InversiveNavigator


//
//  custom parameter for sequence of inversive transformations 
//
function ParamInvTrans(options){
    
    let obj = options.obj;
    let key = options.key;
    let name = options.name;
    let onChange = options.onChange;
    const MYNAME = 'ParamInvTrans';
    
    if(!obj[key]) 
        throw Error(`obj[${key}] is not defined`, options);

    let initialValue = obj[key];
    
    let conf = {
        str: JSON.stringify(obj[key]),
    }
    
    let pStr = ParamString({obj:conf, key: 'str', name: name, onChange:onStringChange});
    
    function onStringChange(){
        let str = conf.str;
        let tr = JSON.parse(conf.str);
        console.log(`${MYNAME}.onStringChange()`, str, tr);
        obj[key] = tr;
    }
    
    function setValue(value){
        //if(DEBUG)console.log(`${MYNAME}.setValue()`, value);
        obj[key] = value;
        updateDisplay();
        if(onChange) onChange();
    }
    
    function getValue(){
        //console.log(`${MYNAME}.getValue()`, obj[key]);
        return obj[key];
    }
    
    function createUI(gui){

        //console.log(`${MYNAME}.createUI()`);
        return pStr.createUI(gui);
    }
    
    function updateDisplay(){
        
        //if(DEBUG)console.log(`${MYNAME}.updateDisplay()`);
        conf.str = JSON.stringify(obj[key]);
        pStr.updateDisplay();
    }
    
    function init(){
        obj[key] = initialValue;
        pStr.updateDisplay();
    }
    
    return {
        
       setValue: setValue,
       getValue: getValue,
       createUI: createUI,
       init:     init,
       updateDisplay: updateDisplay,
    }
} // function ParamInvTrans(options)

function getNormalizedDelta(evt){
    let delta = evt.deltaY;
        switch (evt.deltaMode) {
        case 1: return delta * 16;
        case 2: return delta * 800;
        default: return delta;
    }    
}