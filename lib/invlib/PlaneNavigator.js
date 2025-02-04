import { CanvasTransform, isDefined } from './modules.js';


/**
  perform simple plane navigation - drag left/right and Zoom
  report uniform parameters needed for gpu rendering 
*/
export class PlaneNavigator {
  
  //
  //
  //
  constructor(canvas, listener){
    this.setCanvas(canvas);
    this.setListener(listener);
      
  }

  setListener(listener){
    this.listener = listener;
  }
  //
  //  inform listener that navigation param was changed 
  //
  informListener(){
    
    if(isDefined(this.listener)){
      this.listener.onNavigationChanged();
    }
    
  }
  
  //
  //
  //
  setCanvas(canvas){
    
    console.log("PlaneNavigator.setCanvas()");
    
    this.canvas = canvas;
    
    
    canvas.addEventListener('mousemove', this, false );
		canvas.addEventListener('mousedown', this, false );
		canvas.addEventListener('mouseup', this, false );
		canvas.addEventListener('wheel', this, false);
    this.canvasTransform = new CanvasTransform({canvas:this.canvas});

  }
  
  //
  //  return transformation which maps pixels into world coordinates 
  //
  getCanvasTransform(){
    
    return this.canvasTransform;
    
  }
  
  release(){
    
      if(isDefined(this.canvas)){
        var c = this.canvas;
        c.removeEventListener('mousemove', this, false);
        c.removeEventListener('mousedown', this, false);
        c.removeEventListener('mouseup', this, false);
        c.removeEventListener('wheel', this, false);        
        this.canvas = undefined;
      }
  }
  
  
  getUniforms(uniforms){
    
    //console.log("PlaneNavigator.getUniforms()");
    var trans = this.canvasTransform;
   	trans.initTransform();
    var un = uniforms;
    if(!isDefined(un))
      un = {};
    
		un.u_aspect = trans.aspect;
		un.u_scale = 1./trans.zoom;
		un.u_center = trans.position;
		un.u_pixelSize = trans.pixelSize;
		
    return un;
    
  }
  
	//
	// handler of all registered events 
	//
	handleEvent(evt){		
  
    //console.log("PlaneNavigator.handleEvent(evt)");
    
		evt.preventDefault();
		switch(evt.type) {
		case 'click':
			this.buttonClicked(evt);
			break;
		case 'mousemove':
			this.onMouseMove(evt);
		break;
		case 'mousedown':
			this.onMouseDown(evt);
		break;
		case 'mouseup':
			this.onMouseUp(evt);
		break;
		case 'wheel':
			this.onMouseWheel(evt);
		break;
		
		default:
			return;
	  }		   
  }

  //
  //
  //
	onMouseWheel(evt){
    
    console.log("PlaneNavigator.onMouseWheel()");		
		var delta = evt.deltaY;
		var zoomFactor = 1.05;
		// no keys pressed 
		var trans = this.canvasTransform;
		
		var pw = trans.screen2world([evt.offsetX,evt.offsetY]);		
		if(delta > 0) {
			trans.zoom /= zoomFactor;
		} else {
			trans.zoom *= zoomFactor;
		}
		// location with new zoom 
		var pw1 = trans.screen2world([evt.offsetX,evt.offsetY]);		
		//location shall be the same, therefore we adjust camera postion 
		trans.position[0] -= pw1[0] - pw[0];
		trans.position[1] -= pw1[1] - pw[1];
		
		//console.log("zoom:%s",this.CameraZoom.toFixed(8));
		this.informListener();
		
	}	

  //
  //
  //
	onMouseMove(evt){
    
		if(this.mouseDown){
      
      //console.log("PlaneNavigator.onMouseDown()");		
			var trans = this.canvasTransform;
			var pw = trans.screen2world([evt.offsetX,evt.offsetY]);
			trans.position[0] -= (pw[0] - this.mouseDownPos[0]);
			trans.position[1] -= (pw[1] - this.mouseDownPos[1]);
			
			this.informListener();
			
			//console.log("drag [%s:%s]",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);		
		}
	}
	
  //
  //
  //
	onMouseDown(evt){
		var pw = this.canvasTransform.screen2world([evt.offsetX,evt.offsetY]);
		//console.log("down [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);
		this.mouseDown = true;
		this.mouseDownPos = pw;
	}
  
  //
  //
  //
	onMouseUp(evt){
		var pw = this.canvasTransform.screen2world([evt.offsetX,evt.offsetY]);
		//console.log("up [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);
		this.mouseDown = false;
	}

} // class PlaneNavigator 