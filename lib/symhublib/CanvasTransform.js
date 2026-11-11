/**
//  responsible for transformation from canvas pixel coordinates and world coordinates 
//  transform is defined via parameters 
//
//  center zoom angle
//  center is point in world coordinates which maps onto canvas center 
//  zoom is scaling factor 
//  angle (radians) turns the view: the screen shows the world turned by it
//  counterclockwise about the center (the boxes below are for angle 0)


     p01                                    p11
     +---------------------------------------+ 
     |                                       |
     |                                       |
     |                                       |
     |                                       |
     |                                       |
     |                                       |
     |                                       |     
     +---------------------------------------+
     p00                                     p10

// in world coordinates 
p00 = center + [-1, -aspect] * zoom
p10 = center + [ 1, -aspect] * zoom
p11 = center + [ 1,  aspect] * zoom
p01 = center + [-1,  aspect] * zoom

in screen coordinates 
p00 = [0,height]
p10 = [width, height]
p11 = [width, 0]
p01 = [0,0]


transform()  transforms from world to canvas 
invTransform() transforms from canvas to world 

*/

import {
  getParam, 
  isDefined,
  EventDispatcher,
  ParamGroup,
  ParamFloat,
  updateParamDisplay,
} from './modules.js';

const DEBUG = false;

const MYNAME = 'CanvasTransform';
const EPSILON = 0.00000001;
const _changedEvent = { type: 'transformChanged' };


//export class CanvasTransform {
	
export function CanvasTransform(param={}){

    if(DEBUG) console.log(`${MYNAME} param: `, param);
    let eventDispatcher = new EventDispatcher();
        
    //super();
    // member variables 
    let canvas = param.canvas;
    let width = getParam(param.width, 100);
    let height = getParam(param.height, 100);

    if(canvas && canvas.width){
        //console.log("CanvasTransform: ", canvas);
        width = canvas.width;
        height = canvas.height;
         
    } 

    let center = getParam(param.center, [0,0]);
    let zoom = getParam(param.zoom, 1);
    let angle = getParam(param.angle, 0);
    let cosA = Math.cos(angle), sinA = Math.sin(angle);
    
    if(DEBUG) console.log(`${MYNAME} width, height, zoom: `,width, height, zoom);
    // duplication of center and zoom to pass to Param    
    let config = {
        
        centerX: center[0], 
        centerY: center[1],
        zoom: zoom,
    };
    
    
    // placeholder for external params
    let mParams = makeParams();
    
    //console.log("canvas zoom:", zoom, " center: ", center);

    let aspect = height/width;
    let pixelSize = 2./(width*zoom);
    
    if(DEBUG)console.log(`${MYNAME}.CanvasTransform()`);
    
    function addEventListener(type, listener){
    
      eventDispatcher.addEventListener(type, listener);
      
    }
    
    function informListeners(){
      
        eventDispatcher.dispatchEvent(_changedEvent);
        
    }
    //
    // is called when canvas was resized
    //
    function onCanvasResize(){
      
      if(DEBUG)console.log(`${MYNAME}.onCanvasResize():`, canvas.width, canvas.height);
      width = canvas.width;
      height = canvas.height;
      aspect = height/width;
      pixelSize = 2./(width*zoom);
      
      informListeners();
        
    }
	
    function setZoom(newZoom){
    if(DEBUG) console.log(`${MYNAME}.setZoom() `, newZoom);
       zoom = newZoom;
       pixelSize = 2./(width*zoom);
       config.zoom = zoom;
       updateParamDisplay(mParams);
       informListeners();
        
    }

    function getZoom(){
        
        return [zoom];
        
    }
    
    function setCenter(newCenter){
      
      center[0] = newCenter[0];
      center[1] = newCenter[1];
      config.centerX = center[0];
      config.centerY = center[1];
      updateParamDisplay(mParams);
            
      informListeners();
       
    }

    function getCenter(){
        
        return [config.centerX,config.centerY];
        
    }
  

    //
    //  the turn of the view, radians: the screen shows the world turned by it
    //  counterclockwise about the center
    //
    function setAngle(newAngle){
        if (!Number.isFinite(newAngle)) return;
        angle = newAngle;
        cosA = Math.cos(angle);
        sinA = Math.sin(angle);
        informListeners();
    }

    function getAngle(){
        return angle;
    }

    //
    //  a vector along the screen's axes (x right, y up), in world units, as a
    //  world vector: turned back by the angle
    //
    function screenVectorToWorld(v){
        return [cosA*v[0] + sinA*v[1], -sinA*v[0] + cosA*v[1]];
    }

    // the world vector from the center to the canvas pixel's point, along the screen's axes
    function pixelOffset(x, y){
        return [(2*x/width - 1)/zoom, -(2*y/height - 1)*aspect/zoom];
    }

    // the center that puts the world point w at the canvas pixel [x, y]
    function centerFor(w, x, y){
        const d = screenVectorToWorld(pixelOffset(x, y));
        return [w[0] - d[0], w[1] - d[1]];
    }

    //
    //  turn the view by the angle da (radians, counterclockwise) about the
    //  world point at the canvas pixel [x, y]
    //
    function appendRotation(da, x, y){
        if (!Number.isFinite(da) || !da) return;
        const w = screen2world([x, y]);
        angle += da;
        cosA = Math.cos(angle);
        sinA = Math.sin(angle);
        setCenter(centerFor(w, x, y));
    }

    //
    //  the world box [x0, y0, x1, y1] the view shows: the canvas's own box at
    //  angle 0; on a turned view the largest box of the canvas's proportions
    //  about its centre that is all on the canvas
    //
    function getVisibleBox(){
        const W = width*pixelSize, H = height*pixelSize;
        const c = Math.abs(cosA), s = Math.abs(sinA);
        const t = Math.min(1, W/(c*W + s*H), H/(s*W + c*H));
        const a = t*W/2, b = t*H/2;
        return [center[0] - a, center[1] - b, center[0] + a, center[1] + b];
    }

    function getWorldSize(){
        return [width * pixelSize, height * pixelSize];
    }
    //
    //  reset transform to default 
    //
    function reset(){
      
      zoom = 1;
      center = [0,0];    
      angle = 0;
      cosA = 1;
      sinA = 0;
      pixelSize = 2./(width*zoom);
      
      config.centerX = center[0];
      config.centerY = center[1];
      config.zoom = zoom;
      
      informListeners();
      
    }
  
    function getPixelSize(){
      return pixelSize;
    }
  
    //
    //  modify transform to translate screen image by given increment (in pixels)
    //  Y-axis points down 
    //
    function appendPan(deltaX, deltaY){
        
        //console.log(`${MYNAME}.appendPan()`, deltaX, deltaY);
        // the step along the screen (y down), in the world
        const d = screenVectorToWorld([deltaX*pixelSize, -deltaY*pixelSize]);
        center[0] -= d[0];
        center[1] -= d[1];
        setCenter(center);

        informListeners();
      
    }

    //
    //  modify transform to simulate zoom centered at the given screeen point 
    //
    function appendZoom(zoomFactor, zoomCenterX, zoomCenterY){
        
      if(Number.isNaN(zoomFactor) || Number.isNaN(zoomCenterX) || Number.isNaN(zoomCenterY)){
          console.error(`${MYNAME}.appendZoom() ignoring bad params: `,zoomFactor, zoomCenterX, zoomCenterY);
          return;
      }
          
      if(DEBUG)console.log(`${MYNAME}.appendZoom() `, zoomFactor, zoomCenterX, zoomCenterY);
      // new zoom 
      let zoom1 = zoom*zoomFactor;
      if(DEBUG)console.log(`${MYNAME}.appendZoom() zoom, width, height: `, zoom, width, height);
      // shift center to fix the point position 
      const w = screen2world([zoomCenterX, zoomCenterY]);
      zoom = zoom1;
      pixelSize = 2./(width*zoom);
      center = centerFor(w, zoomCenterX, zoomCenterY);

      if(DEBUG)console.log(`${MYNAME}  zoom: `, zoom, 'center: ', center, ' pixelSize: ', pixelSize);
      
      setZoom(zoom);
      setCenter(center);
      informListeners();
      
    }
  
    function getUniforms(uniforms){
        
      if(Number.isNaN(zoom) || Math.abs(zoom) < EPSILON) {
          console.error(`${MYNAME} BAD zoom: `, zoom);
          zoom = 1;
          center = [0,0];
          pixelSize = 2./(width*zoom);
          aspect = height/width;
      }
      
      uniforms.u_scale = 1./zoom;
      uniforms.u_center = [center[0],center[1]];
      uniforms.u_aspect = aspect;
      uniforms.u_pixelSize = pixelSize;
      // the canvas vertex shader turns the world point back by it
      uniforms.u_rotation = angle;
      return uniforms;
    }
  
    //
    //  direct transform 
    //  transforms from world into canvas
    //
    function transform(pin, pout){
       // the world vector from the center, along the screen's axes
       const dx = pin[0] - center[0], dy = pin[1] - center[1];
       const vx = cosA*dx - sinA*dy, vy = sinA*dx + cosA*dy;
       pout[0] = (vx*zoom + 1)*width/2;
       pout[1] = (1. - vy*zoom/aspect)*height/2;
       return pout;
    } 
    
    //
    //  inverse transform 
    //  transforms from canvas to world  
    //
    function invTransform(pin, pout){
       //console.log("invTransform()", center, zoom, width, height, aspect);
       const v = pixelOffset(pin[0], pin[1]);
       const x = center[0] + cosA*v[0] + sinA*v[1];
       const y = center[1] - sinA*v[0] + cosA*v[1];
       pout[0] = x;
       pout[1] = y;
       return pout;      
    }

    function world2screen(pin){
      return transform(pin,[0,0]);
    }

    function screen2world(pin){
      return invTransform(pin, [0,0]);
    }
    
    function clone(){
      return new CanvasTransform({ canvas: canvas, width: width, height: height, center: [center[0], center[1]], zoom: zoom, angle: angle});
    }
    
    function getCanvas(){
      return canvas;
    }
    
    function onTransformChanged(){
    
        if(DEBUG)console.log('onTransformChanged()');
        setZoom(config.zoom);
        setCenter([config.centerX,config.centerY]);
               
    }
    
    function makeParams(){
        
        
        return {
               centerX: 
                    ParamFloat({
                        name:   'centerX',
                        obj:    config,
                        key:    'centerX',
                        name:   'center X', 
                        onChange: onTransformChanged,
                    }),
               centerY: 
                    ParamFloat({
                        name: 'centerY',
                        obj:   config,
                        key:   'centerY',
                        name: 'center Y',                        
                        onChange: onTransformChanged,
                    }),
               zoom: 
                    ParamFloat({
                        obj: config,
                        key: 'zoom',                        
                        onChange: onTransformChanged,
                    }),
                    
           };
    }
    
    //
    //  return params object 
    //
    function getParams(){
        
        if(!mParams) {
            mParams = makeParams();
        }
        return mParams;
        
    }
        
    return {
        reset:          reset,
        getPixelSize:   getPixelSize,
        transform:      transform,
        invTransform:   invTransform,
        world2screen:   world2screen,
        screen2world:   screen2world,
        onCanvasResize: onCanvasResize,
        setZoom:        setZoom,
        getZoom:        getZoom,        
        setCenter:      setCenter,
        getWorldSize:   getWorldSize,
        getVisibleBox:  getVisibleBox,
        getCenter:      getCenter,
        getUniforms:    getUniforms,
        appendPan:      appendPan,
        appendZoom:     appendZoom,
        appendRotation: appendRotation,
        setAngle:       setAngle,
        getAngle:       getAngle,
        screenVectorToWorld: screenVectorToWorld,
        addEventListener:   addEventListener,
        clone:              clone,
        getCanvas:          getCanvas,
            
        getParams:          getParams,
        //getClassParamValue: getClassParamValue,
        //setClassParamValue: setClassParamValue,
        getClassName: (() => {return MYNAME;}),
    }

} // export function CanvasTransform(param)
	
