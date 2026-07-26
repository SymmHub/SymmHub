import {

} from './modules.js';


//
// drawing with the mouse
// it handles mouse events
// it calls
//       renderer.drawDot()
//       renderer.drawSegment()
//       renderer.pickValue()
//
// Events are only consumed (isConsumed = true) when the left mouse button is
// actively being used for drawing.  All other events (wheel, hover moves, etc.)
// are left unconsumed so that they fall through to the navigator, giving the
// same zoom / pan behaviour as the pattern-transform tool.
//
// Coordinate note:
//   e.simPnt — simulation-space point set by SymRenderer for TOOL_DRAW
//   e.wpnt   — world-space fallback (used when simPnt is not available)
//
function DrawingToolHandler(params){

  let mRenderer = params.renderer;

  const debug  = false;

  let mouseDown = false;
  let oldPointer = null;

  /** Return the drawing-space coordinate for this event. */
  function drawPnt(evt) {
    return evt.simPnt ?? evt.wpnt;
  }

  function handleEvent(evt){

      if(evt.ctrlKey) {
        handleCtrlEvent(evt);
        return;
      }

      switch(evt.type) {
      case 'click':
        break;

      case 'pointerout':
        // don't consume — just update state
        mouseDown = false;
        break;

      case 'pointermove':
        if((evt.buttons & 1)){
          evt.preventDefault();
          evt.isConsumed = true;
          drawSegment(evt);
        }
        // No left button: let event fall through to navigator (pan / zoom)
        break;

      case 'pointerdown':
        oldPointer = drawPnt(evt);
        if((evt.buttons & 1)){
          evt.preventDefault();
          evt.isConsumed = true;
          mouseDown = true;
          drawDot(evt);
        }
        break;

      case 'pointerup':
        mouseDown = false;
        oldPointer = null;
        break;

      case 'wheel':
        // Don't consume — navigator handles zoom
        break;

      default:
        return;
      }
  }

  function handleCtrlEvent(evt){
    // Ctrl is pressed
      switch(evt.type) {
      case 'click':
        evt.preventDefault();
        evt.isConsumed = true;
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
    mRenderer.pickValue(drawPnt(evt), evt);
  }

  let oldSegTime = -1;

  function drawSegment(evt){
      if(debug) console.log(`DrawingToolHandler.drawSegment(${evt.simPnt})`);
      const pnt = drawPnt(evt);
      mRenderer.drawSegment(oldPointer, pnt);
      oldPointer = pnt;
  } // function drawSegment(evt)

  function drawDot(evt){
      if(debug) console.log(`DrawingToolHandler.drawDot(${evt.simPnt})`);
      mRenderer.drawDot(drawPnt(evt));
  }  // function drawDot(evt)

  return { handleEvent: handleEvent};

} // function DrawingToolHandler


export {
  DrawingToolHandler
};
