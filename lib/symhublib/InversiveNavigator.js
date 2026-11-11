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
    SPLANE_SPHERE,

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
    viewChainToWorld,
    viewChainScale,
    inversiveDrag,
    inversiveDilation,
    inversiveTurn,
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

// the geometry the Moebius transform moves in (see the class comment)
export const NAVIGATION_MODES = [
    'euclidean',
    'hyperbolic',
    'spherical',
    'inversive',
];

const DEFAULT_INCREMENT = (1.e-10);
const MYNAME = 'InversiveNavigator_v1';
const MS = 0.001;
const MIN_DRAG = 0.01;
// the wheel, its deltas in CSS pixels (a notch is about 100)
const WHEEL_ZOOM = 0.002;           // zoom by exp(-delta*WHEEL_ZOOM): 1.22 a notch
const WHEEL_ROTATION = PI/1200;     // radians a pixel: 15 degrees a notch, as in Inkscape

// params for AnimatedPointer
const AP_PARAMS_EUC_DRAG = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_HYP_DRAG = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_ELL_DRAG = {springForce: 50, freeFrictionFactor: 0.01,dragFrictionFactor: 2.};
const AP_PARAMS_ELL_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_HYP_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};
const AP_PARAMS_EUC_WHEEL = {springForce: 200, freeFrictionFactor: 0.05,dragFrictionFactor: 2.};

//
//  navigation of the view: the canvas transform (pan, zoom) and the Moebius
//  transform (config.inversive.itrans) the canvas shows the world through.
//  The mode (config.mode) is the geometry whose motions the gestures give the
//  Moebius transform:
//
//    euclidean   none, the canvas moves only, as in Inkscape
//    hyperbolic  the motions of the hyperbolic plane (the unit disk)
//    spherical   the turns of the sphere whose equator is the unit circle
//
//  With the spherical projection on the navigation is spherical whatever the
//  mode, and the moves turn the sphere: Alt moves the canvas instead.
//
//    gesture                 plane                       sphere view
//    drag, middle drag       pan                         turn, the point follows the pointer
//    wheel                   scroll up / down            turn up / down
//    Shift+wheel             scroll left / right         turn left / right
//    Ctrl+wheel, pinch       zoom at the pointer         zoom at the pointer
//    Alt+drag                move, the point follows     pan
//    Alt+wheel               move up / down              scroll up / down
//    Alt+Shift+wheel         move left / right           scroll left / right
//    Ctrl+Shift+wheel        rotate about the pointer    rotate about the pointer
//    Ctrl+Alt+wheel          the point under the pointer to the centre (up) or away (down)
//
//  "move" is a motion of the geometry (a hyperbolic translation, a turn of
//  the sphere) taking the point under the pointer along. In the euclidean
//  mode (and with the Moebius transform off) the Alt gestures are the plain
//  ones and Ctrl+Shift+wheel does nothing.
//
//  inversive   Moebius maps about a pole O (config.inversive.pole*), which
//              plays the part of infinity (InversiveMoves.js): "move" by a
//              drag is the parabolic map fixing O taking the point along; the
//              wheel's "move" is the hyperbolic map with the fixed points the
//              pointer and O (wheel up: towards the pointer; Shift: the
//              elliptic turn about both), "rotate" and "focus" the turn and
//              the hyperbolic map. O at infinity (none placed) gives the
//              Euclidean moves of the world; with the sphere view O is the
//              antipode of the pointer then. The orientation tool shows O
//              and drags it by its mark.
//
//  In the orientation tool (events marked evt.navigatorTool) the plane
//  column's drag and wheel rows swap with their Alt rows, as on the sphere:
//  the plain gestures make the mode's motions. Space+drag and middle drag,
//  which move the view in every tool, keep the table. Picking a mode other
//  than euclidean turns the Moebius transform on.
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
        this.mAltGesture = false;   // a gesture with Alt since Alt went down
        if(DEBUG){
            this.pointerData = null;
            this.timeoutId = 0;
        }

        this.config = {
            // navigation
            //projection: PROJECTION_NAMES[0],
            mode: NAVIGATION_MODES[0],
            options: {
                animation: true,
            },
            euclidean: {
                enabled: true,
                centerX: 0.1,
                centerY: 0.2,
                zoom: 1.,                
                angle: 0.,      // the turn of the canvas, degrees counterclockwise
                offsetZ: 0.,            
            },
            inversive:  {
                enabled: true,
                itrans: [],
                // the pole of the inversive mode, a point of the plane the Moebius
                // transform maps into; at infinity while poleSet is false
                poleSet: false,
                poleX: 0,
                poleY: 0,
            },
            spherical: {
                enabled: false,                
            }
        }
        
        this.prevPointerPos = [0,0];
        // array of inversive transforms
        //if (options) this.init(options);

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
        // the euclidean params show the view the canvas transform has, not the
        // config's defaults: a document saved before any pan or zoom keeps the
        // view (no updateDisplay here, the params have no UI yet)
        const center = this.canvasTransform.getCenter();
        this.config.euclidean.centerX = center[0];
        this.config.euclidean.centerY = center[1];
        // getZoom() returns [zoom]; the zoom control is made from a number
        this.config.euclidean.zoom = this.canvasTransform.getZoom()[0];
        this.config.euclidean.angle = this.canvasTransform.getAngle ? toDegrees(this.canvasTransform.getAngle()) : 0;

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
        // files saved before 2026-11-02 may have the zoom as [zoom], [[zoom]], ...
        euc.zoom = Number(euc.zoom);
        this.canvasTransform.setZoom(euc.zoom);
        this.informListener();
    }

    onAngleChanged(){
        let euc = this.config.euclidean;
        euc.angle = Number(euc.angle) || 0;
        if (this.canvasTransform.setAngle) this.canvasTransform.setAngle(euc.angle*PI/180);
        this.informListener();
    }

    onCenterChanged(){
        let euc = this.config.euclidean;
        this.canvasTransform.setCenter([euc.centerX, euc.centerY]);
        this.informListener();
    }

    makeParams() {
        
        let p = {
            mode:       ParamChoice({obj: this.config, key: 'mode', choice: NAVIGATION_MODES, onChange: this.onModeChanged.bind(this)}),
            projection: ParamObj({obj: this.mProjection, name: 'transforms'}),
            inversive:  this.makeInversiveParams(),
            spherical:  this.makeSphericalParams(), 
            euclidean:  this.makeEuclideanParams(),
            options:    this.makeOptionsParams(),
            
        };

        return p;

    }

    //
    //  the mode chosen (the gui, the tool bar): the motions of a geometry
    //  are made by the Moebius transform, which is turned on for them
    //
    onModeChanged(){
        if (this.config.mode !== 'euclidean' && !this.config.inversive.enabled) {
            this.config.inversive.enabled = true;
            if (this.mParams) this.mParams.inversive.enabled.updateDisplay();
        }
        this.informListener();
    }

    getMode(){
        return this.config.mode;
    }

    setMode(mode){
        if (!NAVIGATION_MODES.includes(mode) || mode === this.config.mode)
            return;
        // the param shows it in the gui and calls onModeChanged
        this.mParams.mode.setValue(mode);
    }

    //
    //  the sphere view (the spherical projection): the moves turn the sphere,
    //  which the Moebius transform does
    //
    getSphereView(){
        return !!this.config.spherical.enabled;
    }

    setSphereView(on){
        this.config.spherical.enabled = !!on;
        this.mParams.spherical.enabled.updateDisplay();
        if (on && !this.config.inversive.enabled) {
            this.config.inversive.enabled = true;
            this.mParams.inversive.enabled.updateDisplay();
        }
        this.informListener();
    }

    //
    //  the canvas transform's centre and zoom, from the tool bar
    //
    getCenter(){
        return this.canvasTransform.getCenter();
    }

    setCenter(x, y){
        this.canvasTransform.setCenter([x, y]);
        this.updateCanvasParams();
        this.informListener();
    }

    getZoom(){
        return this.canvasTransform.getZoom()[0];
    }

    //  the turn of the canvas, degrees counterclockwise
    getAngle(){
        return this.canvasTransform.getAngle ? toDegrees(this.canvasTransform.getAngle()) : 0;
    }

    setAngle(degrees){
        if (!this.canvasTransform.setAngle || !Number.isFinite(degrees)) return;
        this.canvasTransform.setAngle(degrees*PI/180);
        this.updateCanvasParams();
        this.informListener();
    }

    //
    //  the pole of the inversive mode: [x, y] in the plane the Moebius
    //  transform maps into, null at infinity
    //
    getPole(){
        const c = this.config.inversive;
        return c.poleSet ? [c.poleX, c.poleY] : null;
    }

    setPole(pnt){
        const c = this.config.inversive;
        c.poleSet = !!pnt;
        if (pnt) { c.poleX = pnt[0]; c.poleY = pnt[1]; }
        if (this.mParams) {
            const p = this.mParams.inversive;
            p.poleSet.updateDisplay(); p.poleX.updateDisplay(); p.poleY.updateDisplay();
        }
        this.informListener();
    }

    // the pole at the point the canvas centre shows
    placePoleAtCentre(){
        const cnv = this.canvas;
        const spnt = cnv ? [cnv.width/2, cnv.height/2] : null;
        this.setPole(spnt ? this.planePnt(spnt) : this.canvasTransform.getCenter());
    }

    // the pole the moves at the plane point p use: the placed one, else with the
    // sphere view the antipode of p, else infinity (null)
    movePole(p){
        const pole = this.getPole();
        if (pole || !this.config.spherical.enabled) return pole;
        const pp = p[0]*p[0] + p[1]*p[1];
        return (pp > 1.e-12) ? [-p[0]/pp, -p[1]/pp] : null;
    }

    // the canvas pixel of the pole, null at infinity or on the back of the sphere
    poleScreen(){
        let q = this.getPole();
        if (!q) return null;
        if (this.config.spherical.enabled) {
            const qq = q[0]*q[0] + q[1]*q[1];
            if (qq > 1) return null;
            const f = 2/(1 + qq);
            q = [q[0]*f, q[1]*f];
        }
        return this.canvasTransform.world2screen(q);
    }

    // the pole's mark is shown and dragged in the orientation tool, in the inversive mode
    showsPole(){
        return this.getGeometry() === 'inversive' && !!this.getPole();
    }

    //
    //  the pole's mark on the 2D overlay: a ring with a cross
    //
    renderPole(ctx){
        if (!this.showsPole()) return;
        const s = this.poleScreen();
        if (!s) return;
        const k = (this.canvas && this.canvas.clientWidth) ? this.canvas.width/this.canvas.clientWidth : 1;
        const r = POLE_RADIUS*k;
        ctx.save();
        ctx.lineWidth = 3*k;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 2*PI); ctx.stroke();
        ctx.lineWidth = 1.5*k;
        ctx.strokeStyle = '#d0208a';
        ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 2*PI);
        ctx.moveTo(s[0] - 1.6*r, s[1]); ctx.lineTo(s[0] + 1.6*r, s[1]);
        ctx.moveTo(s[0], s[1] - 1.6*r); ctx.lineTo(s[0], s[1] + 1.6*r);
        ctx.stroke();
        ctx.fillStyle = '#d0208a';
        ctx.font = `${Math.round(12*k)}px sans-serif`;
        ctx.fillText('O', s[0] + 1.3*r, s[1] - 1.3*r);
        ctx.restore();
    }

    // true when the canvas pixel spnt is on the pole's mark
    hitsPole(spnt, evt){
        const s = this.poleScreen();
        if (!s) return false;
        const k = cssScale(evt, this.canvas);
        return Math.hypot(spnt[0] - s[0], spnt[1] - s[1]) <= (POLE_RADIUS + 4)*k;
    }

    setZoom(zoom){
        if (!(zoom > 0)) return;
        this.canvasTransform.setZoom(zoom);
        this.updateCanvasParams();
        this.informListener();
    }

    //
    //  the gestures of the current mode, for the tool's help line; primary:
    //  the orientation tool, where plain gestures make the mode's motions
    //
    gestureHint(primary){
        const geo = this.getGeometry();
        const zoom = 'Ctrl+wheel zooms at the pointer';
        const view = 'Space+drag or middle drag moves the canvas in every tool';
        if (!geo)
            return `drag moves the view, the wheel scrolls (Shift: sideways), ${zoom}, Ctrl+Shift+wheel turns the canvas about the pointer; ${view}`;
        if (geo === 'inversive') {
            const pole = this.getPole() ? 'the pole O (drag its mark)'
                       : (this.config.spherical.enabled ? 'the antipode of the pointer' : 'infinity (place the pole O in the bar)');
            const plain = this.config.spherical.enabled || primary;
            const m = plain ? '' : 'Alt+';
            return `Moebius moves about ${pole}: ${m}drag takes the point along fixing O; ${m}wheel draws towards the pointer ` +
                   `(fixed points the pointer and O), ${m}Shift+wheel turns about both; ${plain ? 'Alt: the canvas instead; ' : ''}` +
                   `${zoom}; Ctrl+Shift+wheel turns about the pointer and O (with Alt: turns the canvas); ${view}`;
        }
        const what = (geo === 'spherical') ? 'turns the sphere' : 'moves the hyperbolic plane';
        const rot = 'Ctrl+Shift+wheel turns about the pointer (with Alt: turns the canvas), Ctrl+Alt+wheel brings the point under the pointer to the centre';
        if (this.config.spherical.enabled || primary)
            return `drag ${what}, the point follows the pointer; the wheel too (Shift: sideways); Alt: the canvas instead; ${zoom}; ${rot}; ${view}`;
        return `drag moves the canvas; Alt+drag ${what}; ${zoom}; ${rot}; ${view}`;
    }

    onResetInversiveTrans(){
        if(DEBUG)console.log(`${MYNAME}.onResetInversiveTrans()`);

        this.config.inversive.itrans = [];
        this.mParams.inversive.itrans.updateDisplay();
        this.informListener();
    }

    onResetEuclideanTrans(){
        
        if(DEBUG)console.log(`${MYNAME}.onResetEuclideanTrans()`);
        this.canvasTransform.reset();        
        this.updateCanvasParams();

        this.informListener();
        
    }

    onResetSphericalTrans(){
        
        console.log(`${MYNAME}.onResetSphericalTrans()`);
        // the turns of the sphere are in the Moebius transform
        this.onResetInversiveTrans();

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
        let oac = this.onAngleChanged.bind(this);
        
        return ParamGroup({
            name: 'euclidean',
            params: {
            //enabled: ParamBool({obj: obj, key: 'enabled', onChange:opc}),
            reset:      ParamFunc({func:ret,  name: 'reset'}),
            centerX:    ParamFloat({obj:obj,  key:'centerX', name: 'x-center', onChange:occ}),
            centerY:    ParamFloat({obj:obj,  key:'centerY', name: 'y-center', onChange:occ}),
            zoom:       ParamFloat({obj:obj,  key:'zoom',                      onChange:ozc}),
            angle:      ParamFloat({obj:obj,  key:'angle', name: 'angle°',      onChange:oac}),
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
                poleSet: ParamBool({obj: obj, key: 'poleSet', name: 'pole placed', onChange: () => this.informListener()}),
                poleX:   ParamFloat({obj: obj, key: 'poleX', name: 'pole x', onChange: () => this.informListener()}),
                poleY:   ParamFloat({obj: obj, key: 'poleY', name: 'pole y', onChange: () => this.informListener()}),
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
        // documents saved before the canvas could turn are upright
        if (pmap.euclidean && !isDefined(pmap.euclidean.angle))
            pmap = {...pmap, euclidean: {...pmap.euclidean, angle: 0}};
        // documents saved before the inversive mode have no pole
        if (pmap.inversive && !isDefined(pmap.inversive.poleSet))
            pmap = {...pmap, inversive: {...pmap.inversive, poleSet: false}};
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
        // getZoom() returns [zoom]
        cfg.zoom = ct.getZoom()[0];
        if (ct.getAngle) cfg.angle = toDegrees(ct.getAngle());
        
        par.centerX.updateDisplay();
        par.centerY.updateDisplay();
        par.zoom.updateDisplay();
        par.angle.updateDisplay();
                        
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
    //  the maps the shaders apply to a canvas point after the canvas transform, as a
    //  view chain descriptor (ViewChain.js), from the same data the uniforms carry:
    //  the sphere, the Moebius transform as the GPU gets it, the projection maps and
    //  the fixed points transform at the last frame's time
    //
    viewChain() {
        const itc = this.config.inversive;
        const parts = this.mProjection.getChainParts ? this.mProjection.getChainParts() : {};
        return {
            sphere:  !!this.config.spherical.enabled,
            moebius: itc.enabled ? gpuTransform(GroupUtils.getInverseTransform(itc.itrans), this.viewReach()) : null,
            ...parts,
        };
    }

    //
    //  the world point the screen shows at the canvas pixel spnt, as the shaders
    //  compute it (makeSphericalProjection, makeProjection): the canvas transform
    //  and the whole view chain. exact is false off the sphere, where nothing is
    //  drawn, and where a map sends the point to infinity.
    //  returns {pnt: [x, y], exact}
    //
    screenToWorld(spnt) {
        return viewChainToWorld(this.viewChain(), this.canvasTransform.screen2world(spnt));
    }

    //
    //  world units per canvas pixel at the canvas pixel spnt: the canvas
    //  transform's pixel size times the chain's local magnification there
    //
    screenScale(spnt) {
        return this.canvasTransform.getPixelSize()*viewChainScale(this.viewChain(), this.canvasTransform.screen2world(spnt));
    }

    //
    //  the canvas pixel showing the world point wpnt: the inverse of the sphere
    //  and the Moebius transform only. The projection maps have no single
    //  valued inverse (the overlay that needs one is to be drawn on the GPU,
    //  docs/gpu_editing_overlay_assessment.md)
    //
    worldToScreen(wpnt) {
        let p = [wpnt[0], wpnt[1]];
        const itc = this.config.inversive;
        if (itc.enabled) {
            const tr = itc.itrans;
            let ip = iPoint([p[0], p[1], 0, 0]);
            for (let i = 0; i < tr.length; i++) ip = iReflectU4(tr[i], ip);
            p = [ip.v[0], ip.v[1]];
        }
        if (this.config.spherical.enabled) {
            const f = 2/(1 + p[0]*p[0] + p[1]*p[1]);
            p = [p[0]*f, p[1]*f];
        }
        return this.canvasTransform.world2screen(p);
    }

    //
    //  the farthest distance from 0 of the points the GPU moves by the
    //  inversive transform: those of the canvas, of the front hemisphere
    //  with the spherical projection
    //
    viewReach() {
        const ct = this.canvasTransform;
        const c = ct.getCenter();
        const s = ct.getWorldSize();
        let x = Math.hypot(c[0], c[1]) + 0.5*Math.hypot(s[0], s[1]);
        if (this.config.spherical.enabled) {
            x = Math.min(x, 1);
            x = x/(1 + sqrt(1 - x*x));
        }
        return x;
    }

    //
    //  true when world to screen is a similarity (lines stay lines)
    //
    isLinearView() {
        return !this.config.inversive.enabled && !this.config.spherical.enabled
            && (!this.mProjection.isIdentity || this.mProjection.isIdentity());
    }

    //
    //  true when one of the projection maps is on: the view has no single valued
    //  inverse then (worldToScreen stops at the Moebius transform)
    //
    hasProjectionMaps() {
        return !!(this.mProjection.isIdentity && !this.mProjection.isIdentity());
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
                        let w0 = ap.getPnt();  // wheel position before motion
                        ap.calculate(timestamp);
                        let w1  = ap.getPnt(); // position after motion
                        //if(DEBUG) console.log('w0: w1: ', w0, w1);
                        this.onPointerWheel([w1[0]-w0[0], w1[1]-w0[1]], ap.eventData);
                        if(DEBUG && this.pointerData) {
                            let pd = this.pointerData;
                            pd.log.push({log: 'wheel', timestamp: timestamp});
                            pd.pointerX.push({x: timestamp, y: w1[1]});
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
            const inv = gpuTransform(GroupUtils.getInverseTransform(itc.itrans), this.viewReach());
            un.u_moebiusTransformData = iPackTransforms([inv], 1, 5);
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

    //
    //  Alt let go after an Alt gesture is not the browser's menu key
    //
    handleKey(evt) {

        if (evt.key !== 'Alt')
            return;
        if (evt.type === 'keydown') {
            if (!evt.repeat) this.mAltGesture = false;
        } else if (this.mAltGesture) {
            this.mAltGesture = false;
            evt.preventDefault();
        }
    }

    onButtonClicked(evt) {

        if(DEBUG)console.log(`${MYNAME}.onButtonClicked()`, evt);

    }

    onPointerEnter(evt){
        if(DEBUG)console.log('onPointerEnter', evt);
        this.prevPointerPos = canvasPnt(evt);
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

        const spnt = canvasPnt(evt);
        this.prevPointerPos = spnt;
        if(DEBUG)console.log(`${MYNAME}.onPointerDown()`, evt);
        // the pole's mark: a drag moves the pole
        this.mPoleDrag = false;
        if (evt.navigatorTool && evt.button === 0 && this.showsPole() && this.hitsPole(spnt, evt)) {
            if (this.mAnimatedPointer) { this.mAnimatedPointer.stop(); this.mAnimatedPointer = null; }
            this.mPoleDrag = true;
            this.mPointerDown = false;
            evt.isConsumed = true;
            return;
        }
        this.mPointerDown = true;
        this.mCoast = null;     // the last geometry step of the drag, for the motion after it

        if(this.config.options.animation){

            // a new pointer: a press stops the motion going on
            let ap = new AnimatedPointer();
            this.mAnimatedPointer = ap;
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
        if (this.mPoleDrag) {
            this.mPoleDrag = false;
            evt.isConsumed = true;
            return;
        }

        if(DEBUG)console.log(`${MYNAME}.onPointerUp()`, evt);
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
    //  the wheel moves a virtual pointer by its [horizontal, vertical] scroll,
    //  the animation applies the pointer's motion (onPointerWheel)
    //
    onWheel(evt) {

        if(DEBUG) console.log(`${MYNAME}.onWheel()`, evt);
        evt.preventDefault();
        const delta = wheelDelta(evt);
        if (!delta[0] && !delta[1])
            return;
        if (evt.altKey) this.mAltGesture = true;

        // no animation, or a drag going on (the pointer is the drag's)
        if (!this.config.options.animation || this.mPointerDown) {
            this.onPointerWheel(delta, evt);
            this.informListener();
            return;
        }

        if(this.mWheelTimeout){
            window.clearTimeout(this.mWheelTimeout);
        }
        // to simulate wheel release event
        this.mWheelTimeout = window.setTimeout(this.onWheelTimeout.bind(this), 1000);

        const action = this.getWheelAction(evt);
        let ap = this.mAnimatedPointer;
        if (ap && ap.wheelAction !== action) {
            // the rest of another motion is made at once
            const type = ap.eventData && ap.eventData.type;
            if (type === 'wheel') {
                const m = ap.getMouse();
                const w = ap.getPnt();
                this.onPointerWheel([m[0] - w[0], m[1] - w[1]], ap.eventData);
            } else if (type === 'pointermove') {
                this.onPointerDrag(ap.getMouse(), ap.eventData);
            }
            ap = null;
        }
        if(!ap){
            // create new animated pointer
            ap = new AnimatedPointer();
            ap.setMouse(0,0);
            ap.synchronize();
            ap.wheelAction = action;
            this.mAnimatedPointer = ap;
            if(DEBUG) {
                this.pointerData = this.getEmptyPointerData();
            }
        }
        ap.setParams(this.getPointerWheelParams(evt));
        ap.incrementMouse(delta[0], delta[1]);
        ap.setDragState(true, this.timeStamp);
        ap.eventData = evt;
        if(DEBUG) {
            this.pointerData.log.push({log:'onWheel()', evt: evt, timestamp: this.timeStamp});
            this.pointerData.mouseX.push({x:this.timeStamp, y: ap.getMouse()[1]});
        }

        this.informListener();

    }

    //
    //
    //
    onPointerMove(evt) {

        if (this.mPoleDrag) {
            if (evt.buttons & 1) {
                this.setPole(this.planePnt(canvasPnt(evt)));
                evt.isConsumed = true;
            } else {
                this.mPoleDrag = false;
            }
            return;
        }
        if(!isDragButtons(evt.buttons))
            return;
        if(!this.mPointerDown)
            return;
        if (evt.altKey) this.mAltGesture = true;

        const spnt = canvasPnt(evt);

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
    //  react on wheel event (real or animated): delta is the [horizontal,
    //  vertical] scroll in CSS pixels
    //
    onPointerWheel(delta, evt){

        const action = this.getWheelAction(evt);
        if(DEBUG) console.log(`${MYNAME}.onPointerWheel(): `, action, delta, evt);
        if (!action)
            return;
        const spnt = canvasPnt(evt);
        const ct = this.canvasTransform;
        const scale = cssScale(evt, this.canvas);   // canvas pixels a CSS pixel
        const ps = ct.getPixelSize()*scale;         // world units a CSS pixel
        const k = curvature(this.getGeometry());
        // one amount for the zoom and the rotations
        const w = delta[1] || delta[0];

        if (this.getGeometry() === 'inversive' && (action === 'move' || action === 'rotate' || action === 'focus')) {
            const p = this.planePnt(spnt);
            const pole = this.movePole(p);
            if (action === 'rotate' || (action === 'move' && !delta[1])) {
                // the elliptic turn about the pointer and the pole, wheel up counterclockwise
                this.appendMotion(inversiveTurn(p, -w*WHEEL_ROTATION, pole));
            } else {
                // the hyperbolic map with the fixed points the pointer and the pole, wheel up towards the pointer
                this.appendMotion(inversiveDilation(p, Math.exp(-w*WHEEL_ZOOM), pole));
            }
            return;
        }

        switch (action) {
        case 'scroll':
            // the view scrolls down: the content goes up
            ct.appendPan(-delta[0]*scale, -delta[1]*scale);
            this.updateCanvasParams();
            break;
        case 'zoom':
            ct.appendZoom(Math.exp(-w*WHEEL_ZOOM), spnt[0], spnt[1]);
            this.updateCanvasParams();
            break;
        case 'turnCanvas':
            // the canvas turns about the pointer, wheel up counterclockwise
            ct.appendRotation(-w*WHEEL_ROTATION, spnt[0], spnt[1]);
            this.updateCanvasParams();
            break;
        case 'move': {
            // the step the content would scroll by, along the screen (y up), in the world
            const sstep = [-delta[0]*ps, delta[1]*ps];
            const step = ct.screenVectorToWorld ? ct.screenVectorToWorld(sstep) : sstep;
            const len = Math.hypot(step[0], step[1]);
            if (len === 0)
                break;
            const dir = [step[0]/len, step[1]/len];
            if (this.config.spherical.enabled) {
                // the sphere turns about an axis of the screen, its front point going the step
                this.appendMotion(gTranslation([0, 0], dir, len, k));
            } else {
                // the point under the pointer goes the step
                const u = this.planePnt(spnt);
                this.appendMotion(gTranslation(u, dir, gDistance(u, len, k), k));
            }
        }
        break;
        case 'rotate': {
            // about the point under the pointer; off the sphere about the screen's axis
            const p = ct.screen2world(spnt);
            const off = this.config.spherical.enabled && (p[0]*p[0] + p[1]*p[1] >= 1);
            const u = off ? [0, 0] : this.planePnt(spnt);
            this.appendMotion(gRotation(u, -w*WHEEL_ROTATION, k));
        }
        break;
        case 'focus': {
            // the point under the pointer goes the step to the centre (wheel up) or away
            const u = this.planePnt(spnt);
            const r = Math.hypot(u[0], u[1]);
            if (r < MIN_FOCUS)
                break;
            const len = -w*ps;
            const d = this.config.spherical.enabled ? len : gDistance(u, len, k);
            this.appendMotion(gTranslation(u, [-u[0]/r, -u[1]/r], d, k));
        }
        break;
        }

    }

    //
    //
    //
    getPointerDragParams(evt){

        if (!this.movesGeometry(evt))
            return AP_PARAMS_EUC_DRAG;
        return (this.getGeometry() === 'spherical') ? AP_PARAMS_ELL_DRAG : AP_PARAMS_HYP_DRAG;

    }

    //
    //
    //
    getPointerWheelParams(evt){

        switch (this.getWheelAction(evt)) {
        case 'scroll':
        case 'zoom':
        case 'turnCanvas':
            return AP_PARAMS_EUC_WHEEL;
        default:
            return (this.getGeometry() === 'spherical') ? AP_PARAMS_ELL_WHEEL : AP_PARAMS_HYP_WHEEL;
        }

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
    //  process pointer dragging event: a pan of the canvas or a motion of the
    //  geometry taking the point under the pointer along
    //
    onPointerDrag(spnt, eventData){

        if(this.pointerData) this.pointerData.log.push({log:'onPointerDrag():', spnt: fa2s(spnt, 2)});

        let evt = eventData;

        if(!isDragButtons(evt.buttons))
            return;

        const oldPos = this.prevPointerPos;
        const len = eLength(sub(spnt, oldPos));
        if(len < MIN_DRAG)
            return;
        this.prevPointerPos = spnt;

        if (this.movesGeometry(evt) && this.getGeometry() === 'inversive') {
            // the parabolic map fixing the pole taking the point along; after the
            // pointer is let go the animated pointer's coast goes on the same way
            const p0 = this.planePnt(oldPos), p1 = this.planePnt(spnt);
            this.appendMotion(inversiveDrag(p0, p1, this.movePole(p0)));
        } else if (this.movesGeometry(evt)) {
            const k = curvature(this.getGeometry());
            if (this.mPointerDown) {
                // the point under the pointer follows it
                const step = gStep(this.planePnt(oldPos), this.planePnt(spnt), k);
                if (step) {
                    this.appendMotion(gTranslationAlong(step.X, step.V, step.d, k));
                    this.mCoast = {X: step.X, V: step.V, perPixel: step.d/len, k};
                }
            } else if (this.mCoast && this.mCoast.k === k) {
                // let go: the motion goes on along the geodesic of the last step,
                // as fast as the animated pointer (it would leave the sphere, the disk)
                const c = this.mCoast;
                this.appendMotion(gTranslationAlong(c.X, c.V, c.perPixel*len, k));
            }
        } else {
            this.canvasTransform.appendPan(spnt[0] - oldPos[0], spnt[1] - oldPos[1]);
            this.updateCanvasParams();
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
    //  the geometry whose motions the gestures make: 'hyperbolic' (the unit
    //  disk), 'spherical' (the sphere whose equator is the unit circle) or null
    //  (the euclidean mode, or the Moebius transform off)
    //
    getGeometry() {

        if (!this.config.inversive.enabled)
            return null;
        const mode = this.config.mode;
        if (mode === 'inversive')
            return 'inversive';
        if (this.config.spherical.enabled)
            return 'spherical';
        return (mode === 'hyperbolic' || mode === 'spherical') ? mode : null;

    }

    //
    //  true when a move (drag, wheel) moves the geometry, false when it moves
    //  the canvas: in the plane Alt moves the geometry, on the sphere the moves
    //  turn it and Alt moves the canvas. In the orientation tool (the
    //  renderer marks its events evt.navigatorTool) the plain moves make the
    //  mode's motions in the plane too, and Alt moves the canvas
    //
    movesGeometry(evt) {

        const plain = this.config.spherical.enabled || !!evt.navigatorTool;
        return !!this.getGeometry() && (plain !== evt.altKey);

    }

    //
    //  what a wheel event does: 'scroll', 'zoom' or 'turnCanvas' the canvas,
    //  'move', 'rotate' or 'focus' the geometry, null nothing. Ctrl+Shift turns
    //  the canvas in the euclidean mode, the geometry in the others (with Alt
    //  the canvas there too)
    //
    getWheelAction(evt) {

        const ctrl = evt.ctrlKey || evt.metaKey;
        const geo = this.getGeometry();
        if (ctrl && evt.shiftKey)
            return (geo && !evt.altKey) ? 'rotate' : (this.canvasTransform.appendRotation ? 'turnCanvas' : null);
        if (ctrl)
            return (geo && evt.altKey) ? 'focus' : 'zoom';
        return this.movesGeometry(evt) ? 'move' : 'scroll';

    }

    //
    //  the point the Moebius transform maps to the canvas pixel spnt: on the
    //  sphere the stereographic image of the point of its front half there
    //  (off the sphere the point of its rim), as screenToWorld() has it
    //
    planePnt(spnt) {

        const p = this.canvasTransform.screen2world(spnt);
        if (!this.config.spherical.enabled)
            return p;
        const pp = p[0]*p[0] + p[1]*p[1];
        if (pp >= 1) {
            const r = sqrt(pp);
            return [p[0]/r, p[1]/r];
        }
        const f = 1/(1 + sqrt(1 - pp));
        return [p[0]*f, p[1]*f];

    }

    //
    //  a motion (two mirrors) after the Moebius transform; null does nothing
    //
    appendMotion(mirrors) {

        if (!mirrors || !mirrors[0] || !mirrors[1])
            return;
        this.config.inversive.itrans.push(mirrors[0], mirrors[1]);
        this.normalizeTransforms();

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

//
//  the event's canvas pixel (SymRenderer sets canvasX, canvasY); unlike
//  getCanvasPnt() a 0 coordinate is a pixel too
//
// radians to degrees in (-180, 180]
function toDegrees(a){
    let d = a*180/PI;
    d -= 360*Math.ceil((d - 180)/360);
    return Math.abs(d) < 1e-12 ? 0 : d;
}

function canvasPnt(evt){
    return [evt.canvasX, evt.canvasY];
}

//
//  drags with the left or the middle button
//
function isDragButtons(buttons){
    return buttons === 1 || buttons === 4;
}

//
//  canvas pixels a CSS pixel
//
function cssScale(evt, canvas){
    if (evt.offsetX) return evt.canvasX/evt.offsetX;
    return (canvas && canvas.clientWidth) ? canvas.width/canvas.clientWidth : 1;
}

//
//  the wheel's [horizontal, vertical] scroll in CSS pixels; Shift scrolls
//  horizontally where the browser leaves it vertical
//
function wheelDelta(evt){
    const f = (evt.deltaMode === 1) ? 16 : (evt.deltaMode === 2) ? 800 : 1;
    let dx = evt.deltaX*f;
    let dy = evt.deltaY*f;
    if (evt.shiftKey && !dx) {
        dx = dy;
        dy = 0;
    }
    return [dx, dy];
}

//
//  The motions of the hyperbolic plane (k = -1, the unit disk) and of the
//  sphere (k = 1, its stereographic image: the unit circle is the equator)
//  as two mirrors in the plane. The plane point q is the point
//  X = (2q, 1 - k|q|^2)/(1 + k|q|^2) of the model with the form
//  <a, b> = a0 b0 + a1 b1 + k a2 b2 (<X, X> = k): the hyperboloid, the unit
//  sphere. A mirror is a plane <N, X> = 0 through the model's centre, a circle
//  |q - c|^2 = |c|^2 + k (c = N_xy/N_t) or a line through 0 in the plane.
//  Outside the unit disk the hyperbolic points are those of the other sheet.
//
const RIM_EPS = 1.e-4;      // the hyperbolic plane's points this close to the unit circle are not moved
const GEO_EPS = 1.e-14;     // smaller squared mirror normals: no motion
const MAX_DISTANCE = 10;    // the longest hyperbolic step
const MIN_FOCUS = 1.e-6;    // nearer the centre the direction to it is not known
const POLE_RADIUS = 7;      // CSS pixels: the pole's mark, its handle a little more

function curvature(geometry){
    return (geometry === 'spherical') ? 1 : -1;
}

function gPoint(q, k){
    const D = 1 + k*(q[0]*q[0] + q[1]*q[1]);
    return [2*q[0]/D, 2*q[1]/D, 2/D - 1];
}

function gDot(a, b, k){
    return a[0]*b[0] + a[1]*b[1] + k*a[2]*b[2];
}

//
//  the unit tangent at q along the plane direction e (|e| = 1), null next to
//  the unit circle of the hyperbolic plane
//
function gTangent(q, e, k){
    const D = 1 + k*(q[0]*q[0] + q[1]*q[1]);
    if (abs(D) < RIM_EPS) return null;
    const a = q[0]*e[0] + q[1]*e[1];
    const f = 1/abs(D);
    return [(e[0]*D - 2*k*a*q[0])*f, (e[1]*D - 2*k*a*q[1])*f, -2*k*a*f];
}

//
//  the plane splane of the mirror <n, X> = 0, null for none
//
function gMirror(n, k){
    if (!n) return null;
    const nn = Math.hypot(n[0], n[1]);
    if (abs(n[2]) <= 1.e-7*nn)
        return iPlane([n[0], n[1], 0, 0]);
    const c = [n[0]/n[2], n[1]/n[2]];
    const rr = c[0]*c[0] + c[1]*c[1] + k;
    if (!(rr > 0)) return null;
    return iSphere([c[0], c[1], 0, sqrt(rr)]);
}

//
//  the transform for the GPU: its circles of a giant radius R as their
//  lines nearest 0. float32 places such a circle only to about 1e-7 R, the
//  line is off it by x^2/2R at the distance x along it; the line is the
//  better one for R > 2000 x, x the reach of the view plus the distance
//  of the circle from 0
//
const GPU_LINE_RADIUS = 2000;

function gpuTransform(trans, reach){
    return trans.map(s => {
        if (s.type !== SPLANE_SPHERE) return s;
        const v = s.v;
        const r = abs(v[3]);
        const cl = Math.hypot(v[0], v[1], v[2]);
        const o = cl - r;
        if (!(cl > 0) || r <= GPU_LINE_RADIUS*(reach + abs(o))) return s;
        return iPlane([v[0]/cl, v[1]/cl, v[2]/cl, o]);
    });
}

//
//  the length in the geometry of a plane step of euclidean length len at q
//
function gDistance(q, len, k){
    const D = abs(1 + k*(q[0]*q[0] + q[1]*q[1]));
    if (D < RIM_EPS) return 0;
    const d = 2*len/D;
    return (k < 0) ? Math.max(-MAX_DISTANCE, Math.min(MAX_DISTANCE, d)) : d;
}

//
//  the step from the point u to v: the model point X of u, the unit tangent
//  V at X toward v and the distance d. null for the same points, points on
//  both sides of the hyperbolic plane's circle and antipodal points of the
//  sphere
//
function gStep(u, v, k){
    if (k < 0 && (abs(1 - (u[0]*u[0] + u[1]*u[1])) < RIM_EPS || abs(1 - (v[0]*v[0] + v[1]*v[1])) < RIM_EPS))
        return null;
    const X = gPoint(u, k);
    const Y = gPoint(v, k);
    const n = [X[0] - Y[0], X[1] - Y[1], X[2] - Y[2]];
    const nn = gDot(n, n, k);   // 4 sin^2(d/2), 4 sinh^2(d/2)
    if (!(nn > GEO_EPS)) return null;
    const h = sqrt(nn)/2;
    const d = (k > 0) ? 2*Math.asin(Math.min(1, h)) : 2*Math.asinh(h);
    // Y less its part along X (<X, X> = k)
    const xy = k*gDot(X, Y, k);
    const W = [Y[0] - xy*X[0], Y[1] - xy*X[1], Y[2] - xy*X[2]];
    const ww = gDot(W, W, k);
    if (!(ww > GEO_EPS)) return null;
    const f = 1/sqrt(ww);
    return {X, V: [W[0]*f, W[1]*f, W[2]*f], d};
}

//
//  a X + b Y
//
function gLin(a, X, b, Y){
    return [a*X[0] + b*Y[0], a*X[1] + b*Y[1], a*X[2] + b*Y[2]];
}

//
//  the translation by d along the geodesic through the model point X with
//  the unit tangent V: two mirrors across the geodesic, the second d/2
//  farther along it. Every such pair makes the same translation; the
//  mirror N at the length s along the geodesic is the circle of radius
//  1/|N_t|, and the pair is the one of the most ordinary circles. The
//  mirrors at X itself are lines and near lines when X is near 0: the GPU
//  keeps such a giant circle in float32 only roughly (par_s2223-4-a.json)
//
function gTranslationAlong(X, V, d, k){
    if (!d) return null;
    const h = d/2;
    let s;
    if (k > 0) {
        // N(s) = -sin(s) X + cos(s) V, N_t is the largest in the middle of the pair
        s = Math.atan2(-X[2], V[2]) - h/2;
    } else {
        // N(s) = sinh(s) X + cosh(s) V; the mirror at s0 is a line through 0,
        // N_t = +-mu sinh(s - s0) grows on both sides of it and the mirrors
        // past tau from s0 are circles of radius below 1, tiny far out
        const s0 = 0.5*Math.log((X[2] - V[2])/(X[2] + V[2]));
        const tau = Math.asinh(1/sqrt(Math.max(1, X[2]*X[2] - V[2]*V[2])));
        let t;
        if (abs(h)/2 >= tau) {
            t = -h/2;
        } else {
            // the pair from the radius 1 on the side of X
            const lo = (s0 <= 0) ? tau : -tau - abs(h);
            t = (h > 0) ? lo : lo + abs(h);
        }
        s = s0 + t;
    }
    const C = (k > 0) ? cos(s) : Math.cosh(s);
    const S = (k > 0) ? sin(s) : Math.sinh(s);
    const Y = gLin(C, X, S, V);       // the point of the first mirror
    const N = gLin(-k*S, X, C, V);    // the tangent there, the first mirror
    const Ch = (k > 0) ? cos(h) : Math.cosh(h);
    const Sh = (k > 0) ? sin(h) : Math.sinh(h);
    return [gMirror(N, k), gMirror(gLin(Ch, N, -k*Sh, Y), k)];
}

//
//  the translation taking the point u to v along the geodesic through them
//
function gMotionTo(u, v, k){
    const s = gStep(u, v, k);
    return s ? gTranslationAlong(s.X, s.V, s.d, k) : null;
}

//
//  the translation by d along the geodesic through u in the plane direction e
//
function gTranslation(u, e, d, k){
    const V = gTangent(u, e, k);
    return V ? gTranslationAlong(gPoint(u, k), V, d, k) : null;
}

//
//  the rotation by the angle a (counterclockwise) about u: two mirrors through
//  u at the angle a/2, on both sides of the one across the line from 0 to u
//  (the smallest circle through u; the one along that line is a line)
//
function gRotation(u, a, k){
    if (!a) return null;
    const b = Math.atan2(u[1], u[0]);
    const n1 = gTangent(u, [cos(b - a/4), sin(b - a/4)], k);
    const n2 = gTangent(u, [cos(b + a/4), sin(b + a/4)], k);
    if (!n1 || !n2) return null;
    return [gMirror(n1, k), gMirror(n2, k)];
}
