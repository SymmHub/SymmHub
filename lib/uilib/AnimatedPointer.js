import {
    isDefined,
}
from './modules.js'

const DEBUG = false;

const MS = 0.001; // millisecond
const UNDEFINED_LOCATION = -314.15925; // some odd number
const MYNAME = 'AnimatedPointer';

const MIN_SPEED2 = 16; // square of minimal detectable speed (pixels per second)
const MIN_DIST2 = 1;

const MAX_DELTAT = 100 * MS; // max simulation interval (in seconds)

//    Animated pointer is implemented as physical simulation of a virtual pointer.
//    The pointer represented as a physical particle of unit mass movining in a fluid
//    The pointer is pulled with a spring attached to the current mouse position.
//    The spring force is proportional to the distance between pointer and the mouse.
//    Pointer is damped by a fluid friction force.
//    The friction force is proportional to the pointer speed.
//
//    params:
//    params.dragFrictionFactor  friction coefficient while dragging the mouse is
//    params.freeFrictionFactor  friction coefficient during free motion


function AnimatedPointer(params = {}) {

    if (DEBUG)
        console.log(`${MYNAME}()`, params);

    let timeStep = 1 * MS; // time step used for simulation
    let springForce = 200; // 10 - pointer relaxation time will be about 1 second
    //let springForce = 0.1; // pointer relaxation time will be about 1 second
    let freeFrictionFactor = 0.05;
    let dragFrictionFactor = 2.; // 2 is critical value, larger value causes relaxation delay, smaller value causes oscillations

    let dragFriction = 0;
    let freeFriction = 0;

    setParams(params);

    // friction force during mouse drag
    //let dragFriction = dragFriction*Math.sqrt(springForce);
    //let freeFriction = freeFriction*dragFriction; // friction during free spin. set 0 to spin forever.

    // location and speed of the virtual pointer
    let locationX = UNDEFINED_LOCATION;
    let locationY = UNDEFINED_LOCATION;
    let speedX = 0;
    let speedY = 0;
    let forceX = 0;
    let forceY = 0;

    let dragState = false;
    let lastFrameTime = -1;
    //let timeNow = 0;
    let mouseX = 0;
    let mouseY = 0;

    function setParams(params) {

        if (isDefined(params.timeStep)) {
            timeStep = params.timeStep;
        }

        if (isDefined(params.springForce)) {
            springForce = params.springForce;
        }
        if (isDefined(params.freeFrictionFactor)) {
            freeFrictionFactor = params.freeFrictionFactor;
        }

        if (isDefined(params.dragFrictionFactor)) {
            dragFrictionFactor = params.dragFrictionFactor;
        }

        dragFriction = dragFrictionFactor * Math.sqrt(springForce);
        freeFriction = freeFrictionFactor * dragFriction;

    }

    //
    //
    //
    function performSimulation(timeNow) {

        //locationX = mouseX;
        //locationY = mouseY;


        // do stuff for current frame
        if (lastFrameTime < 0.)
            lastFrameTime = timeNow;

        let friction = (dragState) ? dragFriction : freeFriction;

        let deltaT = Math.min((timeNow - lastFrameTime), MAX_DELTAT); // simulation deltaT (seconds)

        //if(DEBUG) console.log('deltaT: ', deltaT/MS);
        let t = 0.;
        while (t < deltaT) {

            t += timeStep; // last step should be smaller
            let dt = timeStep;

            if (t > deltaT) {

                // last step may be shorter in time
                dt -= (t - deltaT);
                //if(DEBUG) console.log('last step: ', dt/MS);
                t = deltaT;

            }

            forceX = -friction * speedX;
            forceY = -friction * speedY;

            if (dragState) {

                let dx = (mouseX - locationX);
                let dy = (mouseY - locationY);
                forceX += dx * springForce;
                forceY += dy * springForce;

            }

            // new pointer speed
            let newSpeedX = speedX + forceX * dt;
            let newSpeedY = speedY + forceY * dt;

            let deltaX = dt * (speedX + newSpeedX) * 0.5;
            let deltaY = dt * (speedY + newSpeedY) * 0.5;

            // update pointer speed and location
            speedX = newSpeedX;
            speedY = newSpeedY;
            locationX += deltaX;
            locationY += deltaY;

        } // while(t < deltaT)

        lastFrameTime = timeNow;

    }

    function setDragState(state, time) {

        if(DEBUG)console.log(`${MYNAME}.setDragState() `, state, time);
        dragState = state;
        //mouseX = locationX;
        //mouseY = locationY;

    }

    function setMouse(x, y) {

        //console.log('setMouse(x,y):', x, y, speedX,speedY);

        mouseX = x;
        mouseY = y;
        if (locationX == UNDEFINED_LOCATION)
            synchronize();

    }

    function incrementMouse(dx, dy) {
        mouseX += dx;
        mouseY += dy;
    }

    function getMouse() {
        return [mouseX, mouseY];
    }

    function getX() {

        return locationX;

    }

    function getY() {

        return locationY;

    }

    function getPnt() {

        return [locationX, locationY];

    }

    function getSpeed() {

        return [speedX, speedY];

    }

    function getForce() {

        return [forceX, forceY];

    }

    function synchronize() {

        locationX = mouseX;
        locationY = mouseY;

    }

    function stop() {

        speedX = 0;
        speedY = 0;

    }

    //
    // perform physics simulation to the given time (*in milliseconds)
    //
    function calculate(time) {
        if(DEBUG) console.log(`${MYNAME}.calculate()`, time);
        performSimulation(time*MS);

    }

    //
    //  return if pointer is moving (time  in ms)
    //
    function isMoving(time) {
        if(DEBUG)console.log(`${MYNAME}.isMoving()`, time);
        return dragState || ((speedX * speedX + speedY * speedY) > MIN_SPEED2);
        
/*
        if(locationX == UNDEFINED_LOCATION) {
            console.warn('isMoving() return false 0');
            return false;
        }
        let dx = (mouseX - locationX);
        let dy = (mouseY - locationY);
        if((dx*dx + dy*dy) > MIN_DIST2) {
            console.warn('isMoving() return true 1: ');
            return true;
        }
        if((speedX * speedX + speedY * speedY) > MIN_SPEED2){
            console.warn('isMoving() return true 2: ');
            return true;
        }
        console.warn('isMoving() return false 1', speedX, speedY);
        return false;
        */

    }

    return {

        setParams: setParams, // set parameters of simulation
        setMouse: setMouse, // set current mouse position
        getMouse: getMouse,
        incrementMouse: incrementMouse, // increment mouse position 
        setDragState: setDragState, // set mouse down state
        calculate: calculate, // perform simulation to the given time
        getX: getX, // return position of pointer X-position
        getY: getY, // return position of pointer X-position
        getPnt: getPnt, // return point position as array
        stop: stop, // set pointer speed to zero
        synchronize: synchronize, // set pointer location to the mouse location
        getSpeed: getSpeed,
        getForce: getForce,
        isMoving: isMoving,

    }
}

export {
    AnimatedPointer
};
