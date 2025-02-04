import {CanvasTransform} from './CanvasTransform.js';
import {
  iPackTransforms, 
  iTransformU4,
  iInverseTransformU4,  
  iReflectU4,
  iGetFactorizationU4,
} from './Inversive.js';

import {
  iDrawSplane,
} from './IDrawing.js';

import {
  iSphere, 
  iPoint, 
  iPlane,
} from './ISplane.js';


import {
  GroupUtils,
  ParamFunc,
  ParamChoice,
  ParamString,
} from './modules.js';

        
import {PI,abs, sqrt, sin, cos, isDefined} from './Utilities.js';
import {add,mul,eDistanceSquared} from './LinearAlgebra.js';
import {cExp,cDiv, cLog,cDisk2Band,cBand2Disk} from './ComplexArithmetic.js';

export const PROJECTION_NAMES = ['circle', 'log','band','uhp', 'exp'];


const WHEEL_NORM = 125;
const MY_NAME = 'InversiveNavigator';

/**
  
*/
function setParamValues(paramMap, ctrlMap){
  
 for (var name in paramMap) {
  if (paramMap.hasOwnProperty(name)) {
    if(isDefined(ctrlMap[name]))
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
      if (options)
          this.init(options);

    }
    
    //
    // this should be called for proper initialization 
    // 
    //
    init(options) {

        console.log(`${MY_NAME}.init()`,options);
        this.isInitialized = true;

        this.setCanvas(options.canvas);
        
        if(options.canvasTransform)
            this.canvasTransform = options.canvasTransform;
        else 
            this.canvasTransform = new CanvasTransform(this.canvas);
            
        this.params = {
            // navigation
            resetView:  this.onResetView.bind(this),
            hasGrid:    false,
            projection: PROJECTION_NAMES[0],
            offsetZ: 0.,
            transform:  this.getTransformString(),
            position: "[0,0]",
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

    }
    
    //
    //
    //
    getParams(){
        
        if(!this.mParams) {
            this.mParams = this.makeParams();
        }
        return this.mParams;
        
    }
        
    onChanged(){
        //console.log(`${MY_NAME}.onChanged()`);
    }
    
    makeParams(){
        
        let ctParams = this.canvasTransform.getParams();
        let par = this.params;
        let onc = this.onChanged.bind(this);
        let otc = this.onTransformChanged.bind(this);
        
        let p = {
            resetView:  ParamFunc({func: this.onResetView.bind(this), name:'reset view'}),            
            projection: ParamChoice({obj: par, key:'projection', choice:PROJECTION_NAMES, onChange: onc}),
            centerX:    ctParams.centerX,
            centerY:    ctParams.centerY,
            zoom:       ctParams.zoom,
            transform:  ParamString({obj: par, key:'transform', onChange: otc}),
        };
        
        return p;
        
    }
    
    //
    //  return map of parameters 
    //
    getParamsMap(){

        var par = this.params;
        var ctrans = this.canvasTransform;

        var pm = {
            hasGrid:    par.hasGrid,
            projection: par.projection,
            offsetZ:    par.offsetZ, 
            zoom:       ctrans.zoom,
            position:   ctrans.position,
            transforms: this.transforms, // take world to distorted world, which is then taken to the screen
            expScale:   par.expScale,
        };
        return pm;
    }

  /**
    set parameters value from the map 
  */
  setParamsMap(paramsMap){
    
    //console.log('InversiveNavigator.setParamsMap(paramsMap)');
        
    var ctrls = this.controllers;
    
    ctrls.hasGrid.setValue(paramsMap.hasGrid);
    ctrls.projection.setValue(paramsMap.projection); 
    if(isDefined(paramsMap.offsetZ))ctrls.offsetZ.setValue(paramsMap.offsetZ);
    // transformation is stored in this.transforms and this.canvasTransform
    this.transforms = paramsMap.transforms;    
    this.canvasTransform.zoom = paramsMap.zoom;
    this.canvasTransform.position = paramsMap.position;
    
    ctrls.transform.setValue(this.getTransformString());
    
    if(isDefined(paramsMap.expScale))
      setParamValues(paramsMap.expScale,ctrls.expScale);
    
  }
  
  /**
    convert projection form string into numerical id used in GPU 
  */
  getProjectionID(){
    
    return PROJECTION_NAMES.indexOf(this.params.projection);
    
  }
  
  //
  //  init GUI controls 
  //
  initGUI(options){
    
    var folder = options.folder;
    var gui = options.gui;
    var onChanged = options.onChanged;
    
    this.onChanged = onChanged;

    var amin = -1, amax = 10, inc = 1.e-10;
    var nmin = -20, nmax = 20, ninc = 1;
    
    var par = this.params;
    var cntrs = this.controllers;
    
		folder.add(par, 'resetView').name("Reset View");
    
		cntrs.hasGrid    = folder.add(par, 'hasGrid').onChange(onChanged).name("grid");
		cntrs.projection = folder.add(par, 'projection',PROJECTION_NAMES).onChange(onChanged);    
		cntrs.offsetZ = folder.add(par, 'offsetZ',-1, 1, inc).onChange(onChanged);        
		cntrs.transform  = folder.add(par, 'transform').onChange(this.onTransformChanged.bind(this)).listen().name("transformation");
    
    var sfolder = folder.addFolder('expScale');
    cntrs.expScale = {};
    var sctrl = cntrs.expScale;
    var pscale = par.expScale;
    
    sctrl.enabled = sfolder.add(pscale, 'enabled').onChange(onChanged);
    sctrl.a1x = sfolder.add(pscale, 'a1x',amin,amax,inc).onChange(onChanged);
    sctrl.a1y = sfolder.add(pscale, 'a1y',amin,amax,inc).onChange(onChanged);
    sctrl.a2x = sfolder.add(pscale, 'a2x',amin,amax,inc).onChange(onChanged);
    sctrl.a2y = sfolder.add(pscale, 'a2y',amin,amax,inc).onChange(onChanged);
    sctrl.n1  = sfolder.add(pscale, 'n1',nmin,nmax, ninc).onChange(onChanged);
    sctrl.n2  = sfolder.add(pscale, 'n2',nmin,nmax, ninc).onChange(onChanged);
    //gui.remember(par);
    
  }

  //
  //  transform param was changed via controller 
  // 
  onTransformChanged(){
    this.setTransformFromString(this.params.transform);
  }
  //
  //  called form UI on resetView button click 
  //
  onResetView(){
    
    this.reset();    
    
  }
  
  //
  // set navigation params to default 
  //
  reset(){
    
    this.canvasTransform.reset();
    this.transforms = []; 
    this.informListener();
    
  }    
  
  //
  // render UI onto canvas 
  //
  render(context, transform){
    
    if(!this.params.hasGrid)
       return;
      
    var thickLine = {lineStyle:"#2222FF",lineWidth:3,shadowWidth:0};
    var thinLine = {lineStyle:"#2222FF",lineWidth:1,shadowWidth:0};
    var superThinLine = {lineStyle:"#2222FF",lineWidth:0.2,shadowWidth:0};
    
    var ctrans = transform.getCanvasTransform();
    
    switch(this.params.projection){        
    
      case 'circle':
      case 'uhp':
        iDrawSplane(iSphere([0,0,0,1]), context, ctrans, thickLine);				
        //iDrawSplane(iPlane([1,0,0,0]), context, ctrans,thickLine);				
        //iDrawSplane(iPlane([0,1,0,0]), context, ctrans,thickLine); 
        break;
    }      
    
    var lt = ctrans.screen2world([0,0]);
    var cw = context.canvas.width;
    var ch = context.canvas.height;
    var br = ctrans.screen2world([cw,ch]);
    var gridMinX = abs(lt[0]);
    
    
    
    var srad = 20;
    context.beginPath();
    
    var gridIncrement = this.getGridIncrement(br[0] - lt[0]);
    // rememeber the increment 
    this.gridIncrement = gridIncrement;
    
    
    var nx = (br[0] - lt[0])/gridIncrement;
    var gridX0 = Math.ceil(lt[0]/gridIncrement)*gridIncrement;           
    var ny = (lt[1] - br[1])/gridIncrement;
    var gridY0 = Math.ceil(br[1]/gridIncrement)*gridIncrement;
    
    
    context.strokeStyle = thinLine.lineStyle;
    context.lineWidth = thinLine.lineWidth;    
    this.drawGrid(context, ctrans, [gridX0,br[1]],[gridX0,lt[1]],[gridIncrement,0],nx);
    this.drawGrid(context, ctrans, [lt[0],gridY0],[br[0], gridY0],[0,gridIncrement],ny);

    // draw another fine grid 
    gridIncrement /= 10;    
    nx = (br[0] - lt[0])/gridIncrement;
    gridX0 = Math.ceil(lt[0]/gridIncrement)*gridIncrement;           
    ny = (lt[1] - br[1])/gridIncrement;
    gridY0 = Math.ceil(br[1]/gridIncrement)*gridIncrement;    
    
    context.strokeStyle = superThinLine.lineStyle;
    context.lineWidth = superThinLine.lineWidth;    
    this.drawGrid(context, ctrans, [gridX0,br[1]],[gridX0,lt[1]],[gridIncrement,0],nx);
    this.drawGrid(context, ctrans, [lt[0],gridY0],[br[0], gridY0],[0,gridIncrement],ny);
    
    //this.drawGridCaptions(context, ctrans, [gridX0,br[1]], nx);
        
  } // render

  //
  //  draw set of parallel segments with given ends and increment 
  //
  drawGrid(context, transform, p0, p1, increment, count){
    
    for(var c = 0; c < count; c++){
      
      var x0 = p0[0] + c * increment[0];
      var y0 = p0[1] + c * increment[1];

      var x1 = p1[0] + c * increment[0];
      var y1 = p1[1] + c * increment[1];
      
      var s0 = transform.world2screen([x0,y0]);
      var s1 = transform.world2screen([x1,y1]);
            
      context.moveTo(s0[0], s0[1]);
      context.lineTo(s1[0], s1[1]);
    } 
    context.stroke();    
  }
  
  //
  //  return appropriate grid increment for given region size 
  //
  getGridIncrement(size){
    
    // log of smallest size with rounded ends 
    var logsize = Math.log(size)*Math.LOG10E;
    var fl = Math.floor(logsize-0.3);    
    return 1 * Math.pow(10, fl);      

    //var fract = logsize-fl;    
    //if(fract < 0.1) 
    //  return 0.1 * Math.pow(10, fl);
    //else if(fract < 0.5)
    //  return 0.5 * Math.pow(10, fl);      
    //else 
    //  return 1 * Math.pow(10, fl);      
        
  }
  
    setListener(listener){
        this.listener = listener;
    }
  
  //
  //  inform listener that navigation param was changed
  //
  informListener() {

      this.params.transform = this.getTransformString();
     // console.log('this.params.transform:',this.params.transform);
      this.mParams.transform.updateDisplay();

      if (isDefined(this.onChanged)) {
          this.onChanged();
      }
  }
  //
  //
  //
  setCanvas(canvas){
    
    //console.log("InversiveNavigator.setCanvas()");
    
    this.canvas = canvas;
            
    //this.canvasTransform = new CanvasTransform({canvas:this.canvas});
    this.transforms = [];
  }
  
  //
  //  return transformation which maps pixels into world coordinates 
  //
  getCanvasTransform(){
    
    return this.canvasTransform;
    
  }
  
  release(){
    
      if(isDefined(this.canvas)){
        this.canvas = undefined;
      }
  }
  
  
  getPixelSize(){
    return this.canvasTransform.pixelSize;
  }
  
  //
  // apply only canvas trasnform 
  //
  world2screen(pnt){
    return this.canvasTransform.world2screen(pnt);
  }

  //
  // apply only canvas transform 
  //
  screen2world(pnt){
    return this.canvasTransform.screen2world(pnt);
  }
  
  //
  //  apply complete composite transformation World2Screen(ITransform(pnt))
  //
  transform2screen(w){
    //console.log('InversiveNavigator.transform2screen(%7.5f,%7.5f,)',w[0],w[1]);
    // apply ITransform 
    var iw = iTransformU4(this.transforms, iPoint([w[0],w[1],0,0]));
    
    // apply projection 
    switch(this.params.projection){
      default:  this.inversiveTransformQ=true;
                break;
      case 'log': // log 
        this.inversiveTransformQ=false;
         var vw = cLog(iw.v);
         iw.v[0] = vw[0];
         iw.v[1] = vw[1];         
      break;
      case 'band': // band
         this.inversiveTransformQ=false;
         var vw = cDisk2Band(iw.v);
         iw.v[0] = vw[0];
         iw.v[1] = vw[1];         
      break;
      // TO DO ADD UHP, and in frag
    }
    //console.log('vw:(%7.5f,%7.5f,)',iw.v[0],iw.v[1]);
    return this.canvasTransform.world2screen([iw.v[0],iw.v[1]]);
  }

  //
  //  apply complete inverse transformation (iT^(-1) o Screen2World) (s))
  //
  transform2world(sPnt){
    
    // apply inverse canvas transform 
    var v = this.canvasTransform.screen2world(sPnt);
    //console.log("transform2world[%d, %d] -> [%f, %f] ", s[0], s[1],v[1], v[1]);
    // apply inverse transform  
    var pw = iInverseTransformU4(this.transforms, iPoint([v[0],v[1],0,0]));
    var w = pw.v;
    // apply projection 
    switch(this.params.projection){
      default:
      break;
      case 'band': //Band
         var ww = cBand2Disk(w);
         w[0]=ww[0];
         w[1]=ww[1];
      case 'log': // Log 
         var ww = cExp(w);
         w[0] = ww[0];
         w[1] = ww[1];               
      break;
    }
    return [w[0],w[1]];
    
  }
  
  //
  // 
  //
  getInversiveTransform(){
      return this.transforms;
      //note: not the inverse transform, but the transform in inversive form!
  }
  
  //
  // return current navigation transform 
  //
  getTransformString(){
    
    var tp = {
      
      //position:     this.canvasTransform.position,
      //zoom:         this.canvasTransform.zoom,     
      transforms:   this.transforms, 
      // this has to be converted into raw form 
    };
    //console.log('tp: ', tp);
    var jstr = JSON.stringify(tp);
    //console.log("jstr:" + jstr);
    return jstr;
    
  }
  
  //
  // set navigation transform 
  //  
  setTransformFromString(jsString){
    
    var tr = JSON.parse(jsString);
    //this.canvasTransform.position = tr.position;
    //this.canvasTransform.zoom = tr.zoom;
    this.transforms = tr.transforms;
    this.informListener();
    
  }

    //
    //
    //  
    getUniforms(un){
    
        //console.log(`${MY_NAME}.getUniforms()`);
        var trans = this.canvasTransform;
        //trans.initTransform();
        
        un = trans.getUniforms(un);

    
		un.u_projection = this.getProjectionID();
                
        un.u_offsetZ = this.params.offsetZ;
        //console.log("transforms.length:" + this.transforms.length);
        if(this.transforms.length >= 5){
            this.transforms = iGetFactorizationU4(this.transforms);
        }
        //console.log("  -> transforms.length:" + this.transforms.length);
        //console.log("transform to send: " + transformToString(this.transforms,3));
        //
        // we have to send inverse transform because gpu works in pixel mode 
        un.u_moebiusTransformData = iPackTransforms([GroupUtils.getInverseTransform(this.transforms)], 1, 5);
        //console.log("transformArray: " + iArrayToString(un.u_moebiusTransformData,3));
    
        var scale = this.params.expScale;
        un.u_cScaleEnabled = (scale.enabled)?(1):(0);
        var a1 = [scale.a1x,scale.a1y];    
        var a2 = [scale.a2x,scale.a2y];
        var n1 = scale.n1;
        var n2 = scale.n2;
    
        var s = add(mul(a1,n1),mul(a2,n2));
        // scale and rotate the lattice to make it periodic along vector [0,2*pi] 
        un.u_cScale = cDiv(s,[0,2*PI]);
    
        //console.log(`${MY_NAME}.getUniforms() return: `, un);
    
        return un;
    
  }
  
	//
	// handler of all registered events 
	//
	handleEvent(evt){		
    
		evt.preventDefault();
        //console.log(`${MY_NAME}.handleEvent()`, evt);
		switch(evt.type) {
		case 'click':
			this.onButtonClicked(evt);
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

	onButtonClicked(evt){
        
        console.log(`${MY_NAME}.onButtonClicked()`, evt);		
        
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
	onMouseMove(evt){
                
        //console.log(`${MY_NAME}.onMouseMove()`, evt);		
        let spnt = [evt.canvasX, evt.canvasY];   
        let wpnt = this.canvasTransform.invTransform(spnt, [0,0]);      
        let sp = this.canvasTransform.transform(wpnt,[0,0]);
        
        //console.log("mouseMove() ", spnt, " -> ", wpnt[0].toFixed(5), wpnt[1].toFixed(5), " -> ", sp[0].toFixed(0), sp[1].toFixed(0));		
        //console.log("mouseMove() ", evt);	
        //console.log("    rect: ",this.canvasTransform.getCanvas().getBoundingClientRect());    
		if(this.mouseDown){
      
            const oldPos = this.prevPointerPos;
			this.canvasTransform.appendPan(evt.canvasX-oldPos[0], evt.canvasY-oldPos[1]);
            oldPos[0] = evt.canvasX;
            oldPos[1] = evt.canvasY;      
		}
	}
    
    //
    //
    //
    onMouseDown(evt){
    
		var pw = this.canvasTransform.screen2world([evt.canvasX,evt.canvasY]);
        var pr = Math.max(0,Math.floor(-Math.log(this.gridIncrement)*Math.LOG10E))+2;
        this.params.position = '[' + pw[0].toFixed(pr) + ',' + pw[1].toFixed(pr) + ']';
            //console.log("down [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);
        this.mouseDown = true;
		//this.mouseDownPos = pw;
		this.prevPointerPos = [evt.canvasX,evt.canvasY];
        
	}
  
    //
    //
    //
	onMouseUp(evt){
		var pw = this.canvasTransform.screen2world([evt.canvasX,evt.canvasY]);
		//console.log("up [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);
		this.mouseDown = false;
	}

    //
    //   
    //
    normalizeTransforms(){
        //console.log(`${MY_NAME}.normalizeTransform()`, this.transforms);
        if(this.transforms.length >= 5){
            this.transforms = iGetFactorizationU4(this.transforms);
        }        
    }

  
    //
    // hyperbolic motion with 2 fixed points - the mouse position and reflected
    //
    hyperbolicIncrement(evt) {

        var delta = Math.sign(evt.deltaY);
        var increment = this.getIncrement(delta, this.hyperDelta);

        //var pos = this.mousePosition;
        var pos = this.canvasTransform.screen2world([evt.canvasX, evt.canvasY]);
        var p0 = iPoint([pos[0], pos[1], 0, 0]);
        // polar opposite point
        var p1 = iReflectU4(iPoint([0, 0, 0, 1]), p0);
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1]);
        var s2 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1 + increment]);
        var tr = this.transforms;

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

        //var pos = this.mousePosition;
        var pos = this.canvasTransform.screen2world([evt.canvasX, evt.canvasY]);
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
        var tr = this.transforms;
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
    //
    //
    euclideanZoom(evt){
        
		var delta = evt.wheelDelta;
        if(!isDefined(delta)) return;

        //console.log('mouseWheel X:',evt.deltaX," Y:", evt.deltaY, "Z:", evt.deltaZ, " mode:", evt.deltaMode, " delta:", evt.wheelDelta);

        let zoomFactor = Math.exp(0.1*(delta/WHEEL_NORM));

        this.canvasTransform.appendZoom(zoomFactor, evt.canvasX,evt.canvasY);
        
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