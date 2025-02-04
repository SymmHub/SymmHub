import {
  
  getParam,
  isDefined,
  isFunction,
  cos,
  sin,
  
} from './Utilities.js';

import {
  
  splaneToString,
  SPLANE_NONE,
  SPLANE_SPHERE,
  SPLANE_PLANE,
  SPLANE_POINT,
  SPLANE_INFINITY,
  iSplane,
  iSphere
  
} from './ISplane.js';

import {
  
  iTransformU4
  
} from './Inversive.js';

import {
  
  lerpV as lerp 
  
} from './LinearAlgebra.js';

import {
  
  iArrayToString
  
} from './modules.js';


// drawing function on inversive plane 
//
// draw splane in the given drawing context using given transform (navigator)
// default params 
// param.lineWidth = 2
// param.lineStyle = "#0000FF"
// param.shadowWidth = 0;
//  param.shadowStyle = "#00007733";
//  param.debug = false;
// 
//
export function iDrawSplane(splane, context, transform, param){
  
  if(!isDefined(splane))
    return;
  var lineWidth = getParam(param.lineWidth,2);
  var lineStyle = getParam(param.lineStyle,"#0000FF");
  var shadowWidth = getParam(param.shadowWidth,0);
  var shadowStyle = getParam(param.shadowStyle, "#00007733");
  var debug = getParam(param.debug,false);
  
  
  var proj;
  
  if(transform.params == undefined) {// then transform is just a canvas transform  
    proj= 'circle'// just for routing 
  } else {
    proj = transform.params.projection;
  }
  
  if(proj == 'circle'){
    if(isDefined(transform.getInversiveTransform))
    //if there is an inversive transform, transform the splane
    {
      var itrans = transform.getInversiveTransform();
      // if there are bounds, we handle these separately, to avoid
      // having to rewrite U4toH4, etc etc.
      if(splane.bounds == undefined){
        
        // just transform the splane 
         splane = iTransformU4(itrans, splane);
         
      } else {
        
        var b = splane.bounds;
        // now work out what the bounds are:
        // we just flip the points around and then recalculate.
        // This should be moved into another function.

        // we are assuming that the splane is a circle in the splane[2]=0 plane
        // note that b is -angles due to js perversion.
        switch(splane.type){
          case SPLANE_SPHERE:
            var cx=splane.v[0];
            var cy=splane.v[1];
            var r = Math.abs(splane.v[3]);
            var b0= [cx+r*cos(-b[0]), cy+r*sin(-b[0]),0];
            var b1= [cx+r*cos(-b[1]), cy+r*sin(-b[1]),0];
            for(var i = 0; i<itrans.length;i++)
              { b0 = iReflect(itrans[i],b0);
                b1 = iReflect(itrans[i],b1);
              }
            splane = iTransformU4(itrans,splane);
            splane = iSphere(splane.v,[b0,b1]);
            break;
        }
      }   
    }
    // now, with the (possibly transformed) splane
    switch(splane.type){
  
    case SPLANE_SPHERE:
      {
        //console.log("draw SPHERE");
        var center = splane.v; // center of sphere 
        var rad = splane.v[3]; // signed radius 
        var scenter = transform.world2screen(center);
        var srad = Math.abs(rad) / transform.getPixelSize();
        if(debug) console.log("iDrawSplane Circle{rad:" + srad.toFixed(3) + ", center: [" + iArrayToString(scenter,3) + "]}");
        context.strokeStyle = lineStyle;
        context.lineWidth = lineWidth;
        if(srad > 10000){ // radius of circle in pixels 
          // large circle needs to drawn differently 
          var angle = 0.2;
          iDrawLargeCircle(scenter, srad, angle,context,splane.bounds);
          if(shadowWidth > 0) {
            context.strokeStyle = shadowStyle;
            context.lineWidth = shadowWidth;
            var offset = (rad > 0)?shadowWidth/2:-shadowWidth/2; // interior or exterior 
            iDrawLargeCircle(scenter, srad-offset, angle,context,splane.bounds);                   
          }
          return splane;// note this is the transformed splane
        
        } else {
          // regular circle
          context.beginPath();
          // note the new addition of bounds
          var min,max;
          if(splane.bounds){
            min=splane.bounds[0]; max = splane.bounds[1]
          } else {
            min=0; max = Math.PI*2
          }
          context.arc(scenter[0],scenter[1],srad,min,max,1);
          context.stroke();      
          if(shadowWidth > 0) {
            // draw shadow
            context.strokeStyle = shadowStyle;
            context.lineWidth = shadowWidth;
            var offset = (rad > 0)?shadowWidth/2:-shadowWidth/2; // interior or exterior 
            if(srad-offset >= 0){
              context.beginPath();
              context.arc(scenter[0],scenter[1],srad-offset,min,max,1);
              context.stroke();      
            }
          }
        }
        return splane;
      }
    case SPLANE_PLANE:
      { //TO DO: ADD ENDPOINTS; needed in Euclidean case.
        var normal = [splane.v[0],splane.v[1]];
        var len = 10; // length of the line segment 
        var dist = splane.v[3];
        // point on the line 
        var px = normal[0]*dist;
        var py = normal[1]*dist;
        var p1 = [px - len * normal[1],py + len * normal[0]];
        var p2 = [px + len * normal[1],py - len * normal[0]];
        //console.log("p1:(%5.4f %5.4f), P2:(%5.4f %5.4f)",p1[0], p1[1],p2[0], p2[1]);
        var sp1 = transform.world2screen(p1);
        var sp2 = transform.world2screen(p2);
      
        context.strokeStyle = lineStyle;
        context.lineWidth = lineWidth;      
        context.beginPath();
        context.moveTo(sp1[0], sp1[1]);
        context.lineTo(sp2[0], sp2[1]);
        context.stroke();
        if(debug) console.log("iDrawSplane - Line{[" + iArrayToString(sp1,3) + "],[" + iArrayToString(sp2, 3) + "]}");
        
        if(shadowWidth > 0) {
          
          var offset = [-normal[0]*shadowWidth/2,-normal[1]*shadowWidth/2];      
          context.strokeStyle = shadowStyle;
          context.lineWidth = shadowWidth;
          context.beginPath();
          context.moveTo(sp1[0]+offset[0], sp1[1]-offset[1]);
          context.lineTo(sp2[0]+offset[0], sp2[1]-offset[1]);
          context.stroke();      
        }
        return splane;
      }
    }
  } // end of transform.projection = 'circle'
  else{
    // the projection is something else;
    var trans = ((isFunction(transform.transform2screen))? transform.transform2screen : transform.world2screen).bind(transform);
    
    switch(splane.type){

    case SPLANE_SPHERE:
      {
        //console.log("draw SPHERE");
        // this is presumed to be in the plane, so we ignore splane.v[2]
        var x= splane.v[0];
        var y= splane.v[1];
        var rad = splane.v[3]; // signed radius 
        var r = Math.abs(rad);
        if(splane.bounds){
          min=splane.bounds[0]; max = splane.bounds[1];
          // are these really in good shape?
          }
        else {min=0; max = Math.PI*2}
        
        var pnt1 =[x+ r*cos(-max),y+r*sin(-max)]
        var spnt1 = trans(pnt1);
        var xyBounds = [[spnt1[0],spnt1[1]],[spnt1[0],spnt1[1]]];
        var spnts=[spnt1];
  
  
        context.strokeStyle = lineStyle;
        context.lineWidth = lineWidth;
        context.beginPath();
        context.beginPath();
        context.moveTo(spnt1[0],spnt1[1]);
        
        //segCount, and the stepping, can be more finely tuned, using the derivative of the 
        //projection map; for now let's just do this dumb thing:
        var segCount=100;
        // remember that min to max is clockwise (!), from x axis
        // typically 
        var Dtheta = (min-max)/segCount;
        for(var theta = max+Dtheta; theta<=min; theta+=Dtheta){
          var spnt = trans([x+ r*cos(-theta),y+r*sin(-theta)]);
          spnts.push(spnt);
          if(spnt[0]<xyBounds[0][0]){xyBounds[0][0]=spnt[0];}
          else if(spnt[0]>xyBounds[1][0]){xyBounds[1][0]=spnt[0];}
          if(spnt[1]<xyBounds[0][1]){xyBounds[0][1]=spnt[1];}
          else if(spnt[1]>xyBounds[1][1]){xyBounds[1][1]=spnt[1];}
          context.lineTo(spnt[0],spnt[1]);  
        }
        context.stroke();
        return [xyBounds,spnts];
      }
   //case SPLANE_PLANE:ADD ENDPOINTS IF NEEDED
      
    }
  }
}

//
//  draw large circle over region of angular size angle, 
// but within angular bounds if they have been specified.
//
function iDrawLargeCircle(center, radius, angle, context,bounds){

  //console.log("iDrawLargeCircle center:"+iArrayToString(center,0) + "radius:"+radius.toFixed(0));
  // direction from the origin to the circle center 
  var phi = Math.PI + Math.atan2(center[1],center[0]);
  var min = phi-angle;
  var max = phi+angle;
  if(bounds){
    if(bounds[0]>min){min=bounds[0];}
    if(bounds[1]<max){max=bounds[1];}
  }
  var N = 100;  // segments count
  var da = (max-min)/N;
  
  context.beginPath();
  
  for(var i = 0; i <= N; i++){
    var aa = min + i*da;
    var x = center[0] + radius*Math.cos(aa);
    var y = center[1] + radius*Math.sin(aa);
    //console.log("[", x.toFixed(0) + "," + y.toFixed(0) + "]");
    if(i == 0) 
      context.moveTo(x,y);
    else 
      context.lineTo(x,y);
  }
  context.stroke();      
}

 //
//  draw small circle of specified size in pixels 
//        
export function iDrawPoint(pnt, context, transform, param){

  //console.log("center: %7.1f, %7.1f", center[0],center[1]);

  var radius = getParam(param.radius,5);
  var style = getParam(param.style,"#000000");
  var scenter = transform.transform2screen(pnt);
  //var scenter = transform.world2screen(pnt);

  //console.log("scenter: %7.1f, %7.1f", scenter[0],scenter[1]);
  context.fillStyle = style;
  context.beginPath();
  context.arc(scenter[0],scenter[1],radius,0,Math.PI*2,1);
  context.fill();

}

//
//  draw circle of specified size in pixels 
//        
export function iDrawCircle(pnt, context, transform, param){   

  var radius = getParam(param.radius,5);

  var scenter = transform.transform2screen(pnt);

  if(isDefined(param.fill)){
    context.fillStyle = param.fill;
    context.beginPath();
    context.arc(scenter[0],scenter[1],radius,0,Math.PI*2);
    context.fill();
  }

  if(isDefined(param.stroke)){
    context.strokeStyle = param.stroke;
    context.lineWidth = getParam(param.strokeWidth, 1);
    context.beginPath();
    context.arc(scenter[0],scenter[1],radius,0,Math.PI*2);
    context.stroke();    
  }  

}



//
//  draw line segment 
//
// TO DO if the transform is inversive, then we can make a little quicker work of things

export function iDrawSegment(pnt1,pnt2, context, transform, param){
  
  var trans = ((isFunction(transform.transform2screen))? transform.transform2screen : transform.world2screen).bind(transform);
  var lineWidth = getParam(param.width,2);
  var lineStyle = getParam(param.style,"#000000");
  var segCount = getParam(param.segCount,1);
  
  context.strokeStyle = lineStyle;
  context.lineWidth = lineWidth;      
  
  var spnt1 = trans(pnt1);
  
        
  context.beginPath();
  context.moveTo(spnt1[0],spnt1[1]);
  for(var i = 0; i < segCount; i++){
    var t = (i+1.)/segCount;
    var tpnt = lerp(pnt1, pnt2, t);
    var spnt = trans(tpnt);
    context.lineTo(spnt[0],spnt[1]);  
  }
  context.stroke();      
}

