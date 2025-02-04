/**
  responsible for transformation between canvas pixel coordinates and world coordinates
  transform is defined via parameters
   wBox (xmin, ymin, xmax, ymax)  world box
   sBox ((xmin, ymin, xmax, ymax) screen box
   zoom - additional zoom after the box mapping transformation
   centerX, centerY - center of zoom relative to the center of sBox (in relative units) 
   

(wxmi, wyma)                          (wxma, wyma)
+---------------------------------------+
|                                       |
|                                       |
|                                       |
|                  [wC]                 |
|                                       |
|                                       |
|                                       |
+---------------------------------------+
(wxmi, wymi)                             (wxma, wymi)

(sxmi, syma)                           (sxma, syma)
+---------------------------------------+
|                                       |
|                                       |
|                         [sC]          |
|                                       |
|                                       |
|                                       |
|                                       |
+---------------------------------------+
(sxmi, symi)                             (sxma, symi)


transform()  transforms from world to screencanvas
invTransform() transforms from canvas to world

the linear transformaition has the form 

sx = Ax*wy + Bx
sy = Ay*wy + By   

wx, wy - world coordinates 
sx,sy  - screen coordinates  

Ax,Ay,Bx, By - parameters of transformation 

mapping from screen -> world is done via 

wx = (sx - Bx)/Ax;
wy = (sy - By)/Ay;

 */

import {
    getParam,
    isDefined,
}
from './modules.js';

const defaultWorldBox = {
    xmin: -1,
    xmax: 1,
    ymin: -1,
    ymax: 1
};
const defaultScreenBox = {
    xmin: 0,
    xmax: 100,
    ymin: 100,
    ymax: 0
};

export function BoxTransform(param) {

    param = getParam(param, {});
    // member variables
    let wBox = getParam(param.wBox, defaultWorldBox);
    let sBox = getParam(param.sBox, defaultScreenBox);
    let zoom = getParam(param.zoom, 1.);
    let centerX = getParam(param.centerX, 0);
    let centerY = getParam(param.centerY, 0);
    // sizes of w and s boxes 
    let sSizeX = (sBox.xmax - sBox.xmin);
    let sSizeY = (sBox.ymax - sBox.ymin);
    let wSizeX = (wBox.xmax - wBox.xmin);
    let wSizeY = (wBox.ymax - wBox.ymin);
    // center of world box 
    let wCenterX = (wBox.xmin + wBox.xmax)/2;
    let wCenterY = (wBox.ymin + wBox.ymax)/2;
    // center of svceen box 
    let sCenterX = (sBox.xmin + sBox.xmax)/2;
    let sCenterY = (sBox.ymin + sBox.ymax)/2;
    
    let pixelSizeX = Math.abs(wSizeX / sSizeX)/zoom;
    let pixelSizeY = Math.abs(wSizeY / sSizeY)/zoom;

    let Ax = zoom*(sSizeX/wSizeX);
    let Ay = zoom*(sSizeY/wSizeY);
    //
    // coeff Bx, By are found from requirement, that center of world box is mapped into shifted center of screen box
    // Ax * wCenterX + Bx = sCenterX + centerX*sSizeX
    // Ay * wCenterY + By = sCenterY + centerY*sSizeY
    //
    let Bx = sCenterX + centerX*sSizeX - Ax * wCenterX;
    let By = sCenterY + centerY*sSizeY - Ay * wCenterY;
    

    function getPixelSizeX() {
        return pixelSizeX;
    }

    function getPixelSizeY() {
        return pixelSizeY;
    }

    function screen2worldX(sx) {

        //let dx1 = (sx-sBox.xmin)/sWidth;
        //let dx = (dx1 - (centerX+0.5))/zoom + (centerX+0.5);
        //let wx = wBox.xmin + dx * wWidth;
        //return wx;
        return (sx - Bx)/Ax;

    }

    function screen2worldY(sy) {

        //let dy1 = (sy - sBox.ymin)/sHeight;
        //let dy = (dy1 - (centerY+0.5))/zoom + (centerY+0.5);
        //let wy = wBox.ymin + dy * wHeight;
        //return wy;
        return (sy - By)/Ay;

    }

    function world2screenX(wx) {
        
        //let dx = (x - wBox.xmin) / wWidth; // dx in [0,1]
        //let dx1 = ((dx - (centerX+0.5))*zoom) + (centerX + 0.5);
        //let sx = sBox.xmin + sWidth * dx1;
        //return sx;
        return Ax * wx + Bx;

    }

    function world2screenY(wy) {
        
        //let dy = (wy - wBox.ymin) / wHeight; // dy in [0,1]
        //let dy1 = ((dy - (centerY+0.5))*zoom) + (centerY + 0.5);
        //let sy = sBox.ymin + sHeight * dy1;
        //return sy;
        return Ay * wy + By;

    }

    function screen2world(s) {

        return [screen2worldX(s[0]), screen2worldY(s[1])];

    }

    function world2screen(w) {
        return [world2screenX(w[0]), world2screenY(w[1])];
    }

    //
    //  direct transform
    //  transforms from world into canvas
    //
    function transform(pin, pout) {
        pout[0] = world2screenX(pin[0]);
        pout[1] = world2screenY(pin[1]);
        return pout;
    }

    //
    //  inverse transform
    //  transforms from canvas to world
    //
    function invTransform(pin, pout) {

        pout[0] = screen2worldX(pin[0]);
        pout[1] = screen2worldY(pin[1]);
        return pout;
    }

    function world2screen(pin) {
        return transform(pin, [0, 0]);
    }

    function screen2world(pin) {
        return invTransform(pin, [0, 0]);
    }

    //
    //  makes newZoom = oldZom*factor
    //  the screen point (sx, sy) remain fixed 
    //
    function appendZoom(factor, sx, sy){
        
        let wx = screen2worldX(sx);
        let wy = screen2worldY(sy);
        let ax = Ax*factor;
        let ay = Ay*factor;
        
        let dx = ax*wx + Bx - sx;
        let dy = ay*wy + By - sy;
        // update Bx,By
        Bx -= dx;
        By -= dy;
        Ax *= factor;
        Ay *= factor;
        // update zoom and centerX, centerY to be used as external params 
        zoom *= factor;        
        // Ax * wCenterX + Bx = sCenterX + centerX*sSizeX
        // Ay * wCenterY + By = sCenterY + centerY*sSizeY
        centerX = (Ax * wCenterX + Bx - sCenterX)/sSizeX;
        centerY = (Ay * wCenterY + By - sCenterY)/sSizeY;
        //console.log('centerX: ', centerX, 'Ax:', Ax, 'sCenterX:',sCenterX, 'sSizeX:', sSizeX, 'Bx:', Bx, 'wx:', wx);
        return {
            zoom: zoom,            
            centerX: centerX,
            centerY: centerY,            
        }
    }

    function translate(tx, ty){
        
        Bx += tx;
        By += ty;
        centerX = (Ax * wCenterX + Bx - sCenterX)/sSizeX;
        centerY = (Ay * wCenterY + By - sCenterY)/sSizeY;
        //console.log('centerX: ', centerX, 'Ax:', Ax, 'sCenterX:',sCenterX, 'sSizeX:', sSizeX, 'Bx:', Bx, 'wx:', wx);
        return {
            zoom: zoom,            
            centerX: centerX,
            centerY: centerY,            
        }
    }



    return {
        getPixelSizeX: getPixelSizeX,
        getPixelSizeY: getPixelSizeY,
        transform: transform,
        invTransform: invTransform,
        world2screen: world2screen,
        screen2world: screen2world,
        appendZoom:   appendZoom,
        translate:    translate,
    }
} // function BoxTransform