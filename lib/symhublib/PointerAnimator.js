import {
  isDefined,
} from './modules.js'


const MS = 0.001; // millisecond 
const UNDEFINED_LOCATION = -1.234e4; // some odd number 

/*
pointer animation is implemented as physical simulation of virtual pointer in xy plane and in z direction (mouse wheel position) .
The pointer represented as a physical particle of unit mass moving in a viscous fluid 
The pointer is pulled with a spring attached to the current mouse position. 
Spring parametetrs in x,y,z directions may be different 
The spring force is proportional to the distance between pointer and the mouse. 
Pointer is damped by a fluid friction force. The friction force is proportional to the pointer speed. 

*/
function PointerAnimator(params){
  
  //
  // initialization of default params 
  //
  let timeStep = 1*MS;  // time step used for simulation 
  let springForceX = 375;      
  let springForceY = 375;      
  let springForceZ = 375;      
  
  let freeSpinFrictionFactor = 0.05; 
  let dragFrictionFactor = 2; // 2 is critical value, larger value causes relaxation delay, smaller value causes oscillations 

  //setParams(params);
  
  // friction force during mouse drag                          
  let dragFrictionForceX = dragFrictionFactor*Math.sqrt(springForceX);    
  let dragFrictionForceY = dragFrictionFactor*Math.sqrt(springForceY);    
  let dragFrictionForceZ = dragFrictionFactor*Math.sqrt(springForceZ);    
  
  let freeFrictionForceX = freeFrictionFactor*dragFrictionForceX; // friction during free motion. set 0 to move forever.
  let freeFrictionForceY = freeFrictionFactor*dragFrictionForceY; // friction during free motion. set 0 to move forever.
  let freeFrictionForceZ = freeFrictionFactor*dragFrictionForceZ; // friction during free motion. set 0 to move forever.

  // location and speed of the virtual pointer 
  let pointerLocationX = UNDEFINED_LOCATION;  
  let pointerLocationY = UNDEFINED_LOCATION;
  let pointerLocationZ = UNDEFINED_LOCATION;
  
  let pointerSpeedX = 0;
  let pointerSpeedY = 0;
  let pointerSpeedZ = 0;
  
  
  let mouseDown = false;
  
  let lastFrameTime = -1; // uninitialized time 

  let mouseLocationX = 0;
  let mouseLocationY = 0;
  let mouseLocationZ = 0;
  
  let currentFreeFrictionForce = freeFrictionForce;
  
  //
  //  set actual params 
  //
  setParams(params);
  
    
  //
  //
  // 
  function setParams(params){
    
    if(!isDefined(params))
      return;
    springForceX = getParam(params.springForceX,springForceX);
    springForceY = getParam(params.springForceX,springForceY);
    springForceZ = getParam(params.springForceX,springForceZ);
    dragFrictionFactor = getParam(params.dragFrictionFactor,dragFrictionFactor); 
    freeFrictionFactor = getParam(params.freeFrictionFactor,freeFrictionFactor);    
        
    dragFrictionForceX = dragFrictionFactor*Math.sqrt(springForceX);    
    dragFrictionForceY = dragFrictionFactor*Math.sqrt(springForceY);    
    dragFrictionForceZ = dragFrictionFactor*Math.sqrt(springForceZ);    
    
    freeFrictionForceX = freeFrictionFactor*dragFrictionForceX; 
    freeFrictionForceY = freeFrictionFactor*dragFrictionForceY; 
    freeFrictionForceZ = freeFrictionFactor*dragFrictionForceZ; 
       
  }

  //
  //  
  //
  function performSimulation(timeNow){
        
    
    // do stuff for current frame
    if(lastFrameTime < 0.)
      lastFrameTime = timeNow;

    let frictionX = (mouseDown)? dragFrictionForceX: freeFrictionForceX;
    let frictionY = (mouseDown)? dragFrictionForceY: freeFrictionForceY;
    let frictionZ = (mouseDown)? dragFrictionForceZ: freeFrictionForceZ;

    let deltaT = (timeNow - lastFrameTime);// simulation deltaT (seconds)
    

    let t = 0.;
    
    while(t < deltaT){

      t += timeStep; // last step should be smaller
      let dt = timeStep;
      
      if(t > deltaT) {
        
        t = deltaT;
        
      }
      
      // friction force 
      let pointerForceX = -frictionX * pointerSpeedX;
      let pointerForceY = -frictionY * pointerSpeedY;
      let pointerForceZ = -frictionZ * pointerSpeedZ;
      
      if(mouseDown){
        //
        // spring force on pointer active only if mouseDown        
        //
        let dx = (mouseLocationX - pointerLocationX);
        let dy = (mouseLocationY - pointerLocationY);
        let dz = (mouseLocationZ - pointerLocationZ);
        pointerForceX += dx * springForceX;
        pointerForceY += dy * springForceY;
        pointerForceZ += dz * springForceZ;
        
      }

      // new pointer speed
      let newPointerSpeedX = pointerSpeedX + pointerForceX * dt;
      let newPointerSpeedY = pointerSpeedY + pointerForceY * dt;
      let newPointerSpeedZ = pointerSpeedZ + pointerForceZ * dt;

      let deltaX = dt*(pointerSpeedX + newPointerSpeedX)/2;
      let deltaY = dt*(pointerSpeedY + newPointerSpeedY)/2;
      let deltaZ = dt*(pointerSpeedZ + newPointerSpeedZ)/2;
      
      // update pointer speed and location 
      pointerSpeedX = newPointerSpeedX;
      pointerSpeedY = newPointerSpeedY;
      pointerSpeedZ = newPointerSpeedZ;
      pointerLocationX += deltaX;
      pointerLocationY += deltaY;
      pointerLocationZ += deltaZ;
      
    } // while(t < deltaT)
    
    lastFrameTime = timeNow;
        
  } 

  // 
  //  sets mouse state (to continue simulation after mouse release) 
  //
  function setMouseDown(state){
    
    //console.log('setMouseDown(state): ', state);
    mouseDown = state;
    
  }

  //
  //  set current mouse position 
  //
  function setMousePosition(x,y){
    
    //console.log('setMousePosition(x,y):', x, y, pointerSpeedX,pointerSpeedY);
    
    mouseLocationX = x;
    mouseLocationY = y;    
    if(pointerLocationX == UNDEFINED_LOCATION) 
      synchronizePointer();
        
  }

  function synchronizePointer(){
    
      pointerLocationX = mouseLocationX;
      pointerLocationY = mouseLocationY;

  }
  
  function stopPointer(){
    
    pointerSpeedX = 0;
    pointerSpeedY = 0;    
    pointerSpeedX = 0;    
    
  }
  
  //
  // perform physics simulation to the given time 
  // 
  function calculatePosition(time){
    //console.log('calculatePosition:', time);
    performSimulation(time*MS);
    
  }
  
  function getPointerX(){
    
    return pointerLocationX;
    
  }

  function getPointerY(){
    
    return pointerLocationY;
    
  }

  function getPointerZ(){
    
    return pointerLocationZ;
    
  }
  

  return {
    
    setParams:          setParams,                // set parameters of the simulation
    setMousePosition:   setMousePosition,         // set current mouse XY position 
    setMousePosition:   setMouseZ,                // set current mouse Z position 
    setMouseDown:       setMouseDown,             // set mouse down state
    calculatePosition:  calculatePosition,        // perform simulation to the given time 
    getPointerX:        getPointerX,              // return pointer X-position 
    getPointerY:        getPointerY,              // return pointer Y-position 
    getPointerZ:        getPointerZ,              // return pointer Z-position   (wheel) 
    stopPointer:        stopPointer,              // set pointer speed to zero
    synchronizePointer: synchronizePointer,       // set pointer location to the mouse location 
        
  }
} 


export {PointerAnimator};