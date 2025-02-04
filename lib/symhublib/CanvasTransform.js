/**
//  responsible for transformation from canvas pixel coordinates and world coordinates 
//  transform is defined via parameters 
//
//  center zoom 
//  center is point in world coordinates which maps onto canvas center 
//  zoom is scaling factor 


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
  updateParamsDisplay,
} from './modules.js';

const DEBUG = false;

const MY_NAME = 'CanvasTransform';

const _changedEvent = { type: 'transformChanged' };


//export class CanvasTransform {
	
export function CanvasTransform(param){
    
    let eventDispatcher = new EventDispatcher();
    
    
    //super();
    // member variables 
    let canvas = param.canvas;
    let width = getParam(param.width, 100);
    let height = getParam(param.height, 100);

    if(isDefined(canvas)){
        //console.log("CanvasTransform: ", canvas);
        if(isDefined(canvas.width)){
        width = canvas.width;
        height = canvas.height;
        } 
      //else if(isDefined(canvas.width)){
      //  width = canvas.width;
      //  height = canvas.height;   
      //} 
    } 

    let center = getParam(param.center, [0,0]);
    let zoom = getParam(param.zoom, 1);
    
    let config = {
        centerX: center[0], 
        centerY: center[1],
        zoom: zoom,
    };
    // placeholder for external params
    let mParams = null;
    
    //console.log("canvas zoom:", zoom, " center: ", center);

    let aspect = height/width;
    let pixelSize = 2./(width*zoom);
        
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
      
      if(DEBUG)console.log('CanvasTransform.onCanvasResize():', canvas.width);
      width = canvas.width;
      height = canvas.height;
      aspect = height/width;
      pixelSize = 2./(width*zoom);
      
      informListeners();
        
    }
	
    function setZoom(newZoom){
       zoom = newZoom;
       pixelSize = 2./(width*zoom);
       config.zoom = zoom;
       updateParamsDisplay(mParams);
       informListeners();
        
    }
    
    function setCenter(newCenter){
      
      center[0] = newCenter[0];
      center[1] = newCenter[1];
      config.centerX = center[0];
      config.centerY = center[1];
      updateParamsDisplay(mParams);
            
      informListeners();
       
    }
  
    //
    //  reset transform to default 
    //
    function reset(){
      
      zoom = 1;
      center = [0,0];    

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
        
       // console.log(`${MY_NAME}.appendPan()`, deltaX, deltaY);
        center[0] -= deltaX*pixelSize;
        center[1] += deltaY*pixelSize;        
        setCenter(center);

        informListeners();
      
    }

    //
    //  modify transform to simulate zoom centered at the given screeen point 
    //
    function appendZoom(zoomFactor, zoomCenterX, zoomCenterY){
      
      //console.log('appendZoom:', zoomFactor, zoomCenterX, zoomCenterY);
      // new zoom 
      let zoom1 = zoom*zoomFactor;
      // shift center to fix the point position 
      let dx = (2*zoomCenterX/width -1)*(1/zoom - 1/zoom1);
      let dy = -(2*zoomCenterY/height -1)*aspect*(1/zoom - 1/zoom1);
      
      zoom = zoom1;
      center[0] += dx;
      center[1] += dy;
      pixelSize = 2./(width*zoom);
      
      setZoom(zoom);
      setCenter(center);
      informListeners();
      
    }
  
    function getUniforms(uniforms){
      uniforms.uScale = 1./zoom;
      uniforms.uCenter = [center[0],center[1]];
      uniforms.uAspect = aspect;
      uniforms.uPixelSize = pixelSize;
      return uniforms;
    }
  
    function screen2worldX(x){          
      return (2*x/width - 1)/zoom + center[0];
    }
	
    function screen2worldY(y){
      
      return (-(2*y/height - 1)*aspect)/zoom  + center[1];
    }

    function world2screenX(x){
      return ((x - center[0])*zoom + 1)*width/2;
    }
	
    function world2screenY(y){
      return (1. - (y - center[1])*zoom/aspect)*height/2;
    }
	
    function screen2world(s){
      
      return [screen2worldX(s[0]),screen2worldY(s[1])];
      
    }			

    function world2screen(w){
      return [world2screenX(w[0]),world2screenY(w[1])];
    }


    //
    //  direct transform 
    //  transforms from world into canvas
    //
    function transform(pin, pout){
       pout[0] = world2screenX(pin[0]);
       pout[1] = world2screenY(pin[1]);              
       return pout;
    } 
    
    //
    //  inverse transform 
    //  transforms from canvas to world  
    //
    function invTransform(pin, pout){
       //console.log("invTransform()", center, zoom, width, height, aspect);
       pout[0] = screen2worldX(pin[0]);
       pout[1] = screen2worldY(pin[1]);              
       return pout;      
    }

    function world2screen(pin){
      return transform(pin,[0,0]);
    }

    function screen2world(pin){
      return invTransform(pin, [0,0]);
    }
    
    function clone(){
      return new CanvasTransform({ canvas: canvas, width: width, height: height, center: [center[0], center[1]], zoom: zoom});
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
        reset: reset,
        getPixelSize:   getPixelSize,
        transform:      transform,
        invTransform:   invTransform,
        world2screen:   world2screen,
        screen2world:   screen2world,
        onCanvasResize: onCanvasResize,
        setZoom:        setZoom,
        setCenter:      setCenter,
        getUniforms:    getUniforms,
        appendPan:      appendPan,
        appendZoom:     appendZoom,
        addEventListener:   addEventListener,
        clone:              clone,
        getCanvas:          getCanvas,
        
        getParams:          getParams,
        //getClassParamValue: getClassParamValue,
        //setClassParamValue: setClassParamValue,
        getClassName: (() => {return MY_NAME;}),
    }

} // export function CanvasTransform(param)
	
