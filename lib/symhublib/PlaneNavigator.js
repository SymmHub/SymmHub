import { 
  EventDispatcher,
  CanvasTransform, 
  isDefined 
} from './modules.js';


//const ZOOM_IN = 1.05;
//const ZOOM_OUT = 1./ZOOM_IN;
const WHEEL_NORM = 125;
const MY_NAME = 'PlaneNavigator';

/**
  perform simple plane navigation - drag left/right and Zoom
  report uniform parameters needed for gpu rendering 
*/
export class PlaneNavigator {
  
  //
  //
  //
  constructor(){
            
      
  }
  
  init(options){
      
      this.canvasTransform = options.canvasTransform;
      
  }
  
  getParams(){
      return this.canvasTransform.getParams();
  }
  
  //
  //  return canvasTransform controlled by this navigator 
  //
  getCanvasTransform(){
    
    return this.canvasTransform;
    
  }
     

    getUniforms(un){
    
        //console.log(`${MY_NAME}.getUniforms()`);
        
        this.canvasTransform.getUniforms(un);
        
        //console.log(`${MY_NAME}.getUniforms() return: `, un);
        
        return un;
        
    }
 
	//
	// handler of all registered events 
	//
	handleEvent(evt){		
  
    //console.log("PlaneNavigator.handleEvent():", evt);
    
		evt.preventDefault();
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
        console.log(`${MY_NAME}.onButtonClicked()`,evt);
    }

    //
    //
    //
	onMouseWheel(evt){

        this.euclideanZoom(evt);
    
	}	

    euclideanZoom(evt){
        
		var delta = evt.wheelDelta;
        if(!isDefined(delta)) return;

        //console.log('mouseWheel X:',evt.deltaX," Y:", evt.deltaY, "Z:", evt.deltaZ, " mode:", evt.deltaMode, " delta:", evt.wheelDelta);

        let zoomFactor = Math.exp(0.1*(delta/WHEEL_NORM));

        this.canvasTransform.appendZoom(zoomFactor, evt.canvasX,evt.canvasY);
        
    }
    
    //
    //
    //
	onMouseMove(evt){
                
        let spnt = [evt.canvasX, evt.canvasY];   
        //let wpnt = this.canvasTransform.screen2world(spnt);
        let wpnt = this.canvasTransform.invTransform(spnt, [0,0]);      
        //let sp = this.canvasTransform.world2screen(wpnt);
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
		//console.log("down [%s %s]:%s",pw[0].toFixed(8),pw[1].toFixed(8), this.params.fs[0]);
		this.mouseDown = true;
		this.prevPointerPos = [evt.canvasX,evt.canvasY];
	}
  
    //
    //
    //
	onMouseUp(evt){
    
		this.mouseDown = false;
    
	}

} // class PlaneNavigator 