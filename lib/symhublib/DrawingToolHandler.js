import {

} from './modules.js';


//
// drawing with the mouse 
// it handles mouse events 
// it calls 
//       renderer.drawDot()
//       renderer.drawSegment)
//       renderer.pickValue()  
//
function DrawingToolHandler(params){

  let mRenderer = params.renderer;
  
  const debug  = true;
  
  let mouseDown = false;
  let oldPointer = null;
  
  
  
  function handleEvent(evt){
    
      evt.preventDefault();
      evt.isConsumed = true;
      if(evt.ctrlKey) {
        handleCtrlEvent(evt);
        return;
      }

      switch(evt.type) {
      case 'click':
        break;
        
      case 'pointerout':
        //mouseDown = false;
        //console.log('mouseout')
      break;
      case 'pointermove':
        //console.log('evt:', evt);
        if((evt.buttons & 1)){ 
          drawSegment(evt);           
        }
      break;
      
      case 'pointerdown':
        oldPointer = evt.wpnt; 
        //mouseDown = true;
        if((evt.buttons & 1)){ 
          drawDot(evt);
        }
      break;
      
      case 'pointerup':
        mouseDown = false;
        oldPointer = null;
      break;
      
      case 'wheel':
        //onMouseWheel(evt);
      break;          
      
      default:
        return;
      }		   
  }

  function handleCtrlEvent(evt){
    // Ctrl is pressed 
      switch(evt.type) {
      case 'click':
        onPick(evt);
        break;
      default: 
         return;
      }    
  }

  //
  //  pick values at the given point 
  //
  function onPick(evt){
    
    mRenderer.pickValue(evt.wpnt, evt);
    
  }
    
  let oldSegTime = -1;
  
  function drawSegment(evt){
    
      if(false) console.log(`DrawingTool1.drawSegment(${evt.wpnt}`);
      mRenderer.drawSegment(oldPointer, evt.wpnt);
      oldPointer = evt.wpnt;

  } // function drawSegment(evt)

  function drawDot(evt){
      if(false) console.log(`GSdrawing.drawDot(${evt.wpnt}`);
      mRenderer.drawDot(evt.wpnt);
      //simulation.drawDot();
  }  // function drawDot(evt)
  
  return { handleEvent: handleEvent};
  
} // function DrawingTool1(canvasTrans)


export {
  DrawingToolHandler
};
