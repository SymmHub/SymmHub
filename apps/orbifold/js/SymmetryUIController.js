import {
    GroupRenderer,
    getCanvasPnt, 
} from './modules.js'

import {
    WallPaperGroup_General,
    TWISTMAXVALUE,
    TWISTMINVALUE,
    LENGTHMAXVALUE,
    LENGTHMINVALUE
} from './WallPaperGroup_General.js';

import {
    
    lengthKeys,
    twistKeys
    
} from './OrbifoldGeometrization.js';

import {
    objectToString,
    isDefined, 
    getParam,
    sign,
    isFunction,
    sin,
    cos,
    abs,
    sqrt,
    SHORTEPSILON
} from '../../../lib/invlib/Utilities.js';

import {
    nearArcQ,
    iGetFactorizationU4
} from '../../../lib/invlib/Inversive.js';

import {
    iDrawSplane,iDrawLargeCircle,iDrawPoint
} from '../../../lib/invlib/IDrawing.js';

import {
    iPoint
} from '../../../lib/invlib/ISplane.js';


import {
    getCopy
} from '../../../lib/invlib/LinearAlgebra.js';  

import {
    sPlaneThroughPerp,
    sPlaneSwapping,
    complexN,
    poincareMobiusTranslateFromToByD,
    sPlanesMovingEdge1ToEdge2,
    poincareMobiusFromSPlanesList
} from '../../../lib/invlib/ComplexArithmetic.js';

const DEBUG = false;
const MYNAME = 'SymmetryUIController';

/////////////////////
//
//
//  Changing parameters, appearance, etc for a particular interface or look
//

//
//  This changes the way the interface is handled and works
//  without having to change the code in the common library

//
//  The basic interface will be the canvases handled under the grouprenderer, 
//  the gui hidden under the group renderer
//  with the following appearance and behavior changes:
//
/*
Short version: 
two basic states: 
1) only the pattern is shown; unmodified mousing moves the pattern, 
  keeping infinity fixed
2) the domain is in red with walls, corners, cone pts and interior lines lightly shown.
  as well as some sort of texture handle.
  mousing over any of these highlights the item, which then can be wheeled to modified.
  The texture handle can be dragged, rotated, mobiused.
For clarity, adding additional params by hand (such as bending) and for
restraining the number of reflections, group choices are limited to 

Replacing any p with 22 doesn't change # params
        #params   #reflections  #generators
pqx     1         15            7
pqrx    5         31            21
pqrst
pqr*
pq*rs
etc
*/




// 
// events are passed in through the grouphandler -- awkward but compatible with
// the groupRenderer. 

// this should supercede any other control or conflicting rendering

// need to insert this someplace:
// this.renderer.domainBuilder.folder.__controllers.find(x=>x.property=="showBaseGens").setValue(false) // keep this turned off.


export class SymmetryUIController{ 
  
  constructor(options)
  {
    this.domainShowingQ = getParam(options.domainShowingQ,true);
    this.overlayCanvas = options.overlayCanvas;
    this.styles = options.styles;
    
    
    // When the mouse moves, we check to see if it is 
    // over a parametrizable part of the fundamental domain. If the mouse is,
    // we need to keep track of which arc, and how far along it, the mouse is over
    // so that we may pull the world transform back into position as the parameter shifts.
    
   
    this.FDPoints=[];
    this.activeFDPart=-1; // corner, wall or interior edge that is able to be manipulated.
    this.midDist = -1000; // a proportation along the edge, as a fraction of distance.
    this.stashedTransforms=[];
   
    //When the FD is drawn, FDPoints is created; this is either an array of splane arrays,
    //or an array of arrays of pixels. 
    // The indexing is [...exterior boundaries,... interior slices/tubes]
    
    // this.FDPoints is passed into isOnArcQ; 
    // For all other purposes, the original splanes from the FD domain are used
    
    // isOnArcQ returns the proportion along the arc that the mouse lies,
    // either as hyperbolic distance, or as a fraction of the length of the list of points
    
    // All we really need to keep track of is the original location of the mouse, in 
    // unprojected, untransformed world coordinates, and another point along the unprojected,
    // untransformed arc, at, say, distance 1 towards the other end. 
    
    // In order to reduce error, we save the original transform, making a temporary copy, 
    // and updating only when the mouse moves.
    
  }
  
  init(options){
    this.renderer=options.renderer;
    this.groupMaker=this.renderer.groupMaker;
    this.transform = options.transform;
    this.onChanged = options.onChanged;
  }
  
  updateSymmetryUI()
  {
    // this will all be fleshed out later; the task now is to try to get 
    // the parameter controllers drawn and working.
    
  }
  
  resetWheel(){
    this.midDist=-1000;
    this.activeFDPart = -1;
  }
  
  handleEvent(evt){
    switch(evt.type) {
    case 'keydown': // We'll take all the keydowns 
      this.resetWheel();
      this.onKeyDown(evt);
      break;
    case 'mousemove':
    case 'pointermove':
      this.resetWheel();
      this.onMouseMove(evt);
      break;
    case 'wheel':
      this.onWheel(evt);
      break;
    case 'pointerdown':
    case 'mousedown':
      this.resetWheel();
      this.onMouseDown(evt);
      break;
    case 'pointerenter':
    case 'mouseenter':
        this.resetWheel();
        this.onMouseOver(evt);
        break;
    case 'pointerover':
    case 'mouseover':
        this.resetWheel();
        this.onMouseOver(evt);
        break;
    case '':
      this.resetWheel();
    }
  }
  
  onMouseDown(evt){
    //for now, just grab the focus
    this.renderer.getOverlay().focus();
  }
  
  onMouseOver(evt){
    //for now, just grab the focus
    this.renderer.getOverlay().focus();
  }
  
  
  
  
  onKeyDown(evt){
    switch(evt.code){
      case "Space": // toggle domain drawing
      this.domainShowingQ = !this.domainShowingQ;
      if(!this.domainShowingQ){this.fdpts=[]}
      this.renderer.config.controllers.domain.setValue(this.domainShowingQ)
      evt.grabInput = true;
    }
  }
  
  
  onMouseMove(evt){
    // we want to check to see if we are over any of the edges of the fundamental domain
    
    // If the fundamental domain is not being displayed, it will be an array of length 0
    let i=0;
    let foundFDQ=false;
    this.midDist=-1000;
    let oldAp = this.activeFDPart;
    this.activeFDPart = -1;
    let gp = this.groupMaker.getGroup();
    let fd = [...gp.s,...gp.i];
    let check,edge;
   
   // when the fundamental domain is drawn, a list of (lists of points) or splanes
   // is returned; this includes interior edges
   // The splanes are in transformed world coordinates; 
   // The list of points are in pixel coordinates.
   
    while(i<this.FDPoints.length && !foundFDQ){
      // don't bother looking unless this is a value that can be changed -- does the corresponding
      // arc have a length parameter?
      if(i>=gp.s.length){
        edge = gp.i[i-gp.s.length][0];
        check = edge.label[0];
      }
      else{
        edge = gp.s[i][0];
        check = edge.label[0];}
      if(lengthKeys.includes(check)){
        this.midDist= nearArcQ(getCanvasPnt(evt),this.FDPoints[i], this.transform,7);
        //this returns the proportion along the edge, as a distance. 
        foundFDQ=!(this.midDist==-1000)}//-1000 is returned if not found
      if(!foundFDQ) i++;
    }//done looking; did we find anything?
    if(!foundFDQ){
      //nope, we didn't, so just move on along. 
      this.activeFDPart = -1; 
      if(oldAp!=this.activeFDPart){
        this.onChanged();}
      return;}
    //otherwise, we did find something.
    // We need to save a copy of the original point, in transformed coordinates. 
    if(foundFDQ) {
      this.activeFDPart = i; 
      let savedEdge = this.FDPoints[i]; //transformed by savedTransform; no need to copy, since FDPoints is replaced, rather than updated.
      
      // FOR THE MOMENT, FDPoints[i] is a splane. ADD A CHECK.
      
      // keep the hit point, and a point distance 1 along the edge, 
      let end1 = new complexN(
        savedEdge.v[0]+cos(savedEdge.bounds[0])*abs(savedEdge.v[3]),
        savedEdge.v[1]-sin(savedEdge.bounds[0])*abs(savedEdge.v[3]));
      let end2 =   new complexN(
        savedEdge.v[0]+cos(savedEdge.bounds[1])*abs(savedEdge.v[3]),
        savedEdge.v[1]-sin(savedEdge.bounds[1])*abs(savedEdge.v[3]));
      this.savedMid = end1.applyMobius(
        poincareMobiusTranslateFromToByD(
          end1,end2,this.midDist*(end1.poincareDiskDistanceTo(end2))));
      this.savedPt = this.savedMid.applyMobius(poincareMobiusTranslateFromToByD(
        this.savedMid,end1,1));
        
      //We thus are keeping (in world coords)
      // the proportation of the mid point along the edge -- midDist
      // the mid point along the edge -- mid
      // a point distance 1 back towards the first end, from mid -- savedPt
      
      
      evt.grabInput = true; 
      this.onChanged();  
      this.stashedTransforms = getCopy(this.transform.getInversiveTransform()); 
     // console.log("found "+this.activeFDPart.toString()+" "+this.midDist.toString());
      
      return;}
  }
  
  onWheel(evt){
    if(this.activeFDPart == -1){return;}
    this.transform.setInversiveTransform(getCopy(this.stashedTransforms));
    let delta = sign(evt.deltaY);
    //let's locate the active part:
    let gm = this.groupMaker;
    let gp = gm.getGroup();
    let changing;
    let ap = this.activeFDPart;
    //gp.s is the boundaries; gp.i is the internals
    if(ap>=gp.s.length){
      changing = gp.i[gp.s.length-ap][0];}
    else{changing = gp.s[ap][0];}
    let label = changing.label;
    let twistQ = evt.shiftKey && twistKeys.includes(label[0]);
    let lengthQ = lengthKeys.includes(label[0]);
    let ls = label[0]+"_"+label[1].toString();
    let updateQ=false;
    let newvalue = 0;
    if(twistQ){
      ls+="_t";
      newvalue = gm.guiParams[ls]+delta*.01;
      while(newvalue>TWISTMAXVALUE){
        newvalue -= TWISTMAXVALUE-TWISTMINVALUE;
      }
      while(newvalue<TWISTMINVALUE){
        newvalue+=TWISTMAXVALUE-TWISTMINVALUE;
      }
      updateQ=true;
    }
    else if(lengthQ){
      ls+="_l";
      newvalue = gm.guiParams[ls]+delta*.03;
      if(newvalue<LENGTHMINVALUE)
        {newvalue =LENGTHMINVALUE;}
      if(newvalue>LENGTHMAXVALUE){
        newvalue = LENGTHMAXVALUE;
      }
      updateQ=true;
    }
    
    if(updateQ){
      this.groupMaker.needsShiftQ= true; 
      this.lastevt = evt;
        // this will force a call to setShift before an update of the canvas
      gm.paramGuiFolderItems[ls].setValue(newvalue);
      evt.grabInput = true;
    }
  }
  
  setShift(){
     //fix the location of the mouse
    let gp = this.groupMaker.getGroup();
    let edge;
    let evt = this.lastevt;
    let pt = getCanvasPnt(evt);
    let trans = this.transform;
    let toscreen = ((isFunction(trans.transform2screen))? trans.transform2screen : trans.world2screen).bind(trans);
    let toworld = ((isFunction(trans.transform2world))? trans.transform2world : trans.screen2world).bind(trans);
    let pw = toworld(pt); 
    // we must keep this pw inside the unit disk, or things go wrong:
    let pwpw = sqrt(pw[0]*pw[0]+pw[1]*pw[1]);
    if(pwpw>.99){
      pw[0]/=pwpw/.995;
      pw[1]/=pwpw/.995; //.995 * .995 = .99025
    }
    
    //where is this on the found edge?
    //preserve this point, moving along a geodesic to its new location
    let ap= this.activeFDPart;
    if(ap<0){
      return; // some mistake has been made
    }
    else if(ap<gp.s.length){
      edge = gp.s[ap];
    }
    else{edge = gp.i[ap-gp.s.length];}
    //is the edge an arc (array of pts) or an array of splanes?
   //INCORRECT
   
   
   
    if(edge==undefined || !(Array.isArray(edge)) || edge[0]==undefined|| this.midDist==-1000){
      return;
    }
    // now check if edge[0] is a splane or a pt
    if(edge[0].type==1){ //alternatively, undefined, and edge is a list of points
      
      // the ends of the new arc, and the copy of the found point:
      let end1 = new complexN(
        edge[0].v[0]+cos(edge[0].bounds[0])*abs(edge[0].v[3]),
        edge[0].v[1]-sin(edge[0].bounds[0])*abs(edge[0].v[3]));
      let end2 = new complexN(
        edge[0].v[0]+cos(edge[0].bounds[1])*abs(edge[0].v[3]),
        edge[0].v[1]-sin(edge[0].bounds[1])*abs(edge[0].v[3]));
      let d = end1.poincareDiskDistanceTo(end2);
      let mid=end1.applyMobius(poincareMobiusTranslateFromToByD(end1,end2,d*this.midDist));
      let pt =mid.applyMobius(poincareMobiusTranslateFromToByD(mid,end1,1));
      
      // These are all in untransformed coordinates; we transform them:
      
      let trans = poincareMobiusFromSPlanesList(this.transform.getInversiveTransform());
      mid = mid.applyMobius(trans);
      pt = pt.applyMobius(trans);
    
    
      if(abs(mid.re-this.savedMid.re)>SHORTEPSILON && abs(mid.im-this.savedMid.im)>SHORTEPSILON)
      {
      
        let newTransforms = sPlanesMovingEdge1ToEdge2(
          [mid,pt],
          [this.savedMid,this.savedPt]);
    
        this.transform.setInversiveTransform([...this.transform.transforms,...newTransforms]);
        //if(this.transform.transforms.length >= 5){
        //    this.transform.transforms = iGetFactorizationU4(this.transform.transforms);
        //}
        this.transform.informListener();
      }
    }
  
    
  /*  if(ppw[0]!=pw[0] && ppw[1]!=pw[1]){
      let p= new complexN(ppw[0],ppw[1]);// this is just mid
      let q = new complexN(pw[0],pw[1]); 
     let s1=sPlaneSwapping(p,q);
      this.transform.transforms.push(s1);
      let s2=sPlaneThroughPerp(q,p);
      this.transform.transforms.push(s2);
     if(this.transform.transforms.length >= 5){
        this.transform.transforms = iGetFactorizationU4(this.transform.transforms);
      }*/
    
   /*   console.log(
        "p="+p.toString(true,10)+";\n"+"q="+q.toString(true,10)+";\n"+
        "s1="+objectToString(s1,true)+";\n"+
        "s2="+objectToString(s2,true)+";\n"+this.transform.transforms.length.toString()+
        "\n"
        )
       
        
      this.transform.informListener();
    }*/
  }
  
  
  
    render(context,transform){
        if(DEBUG)console.log(`${MYNAME}.render()`,this.domainShowingQ);

     
/*
      // for the moment, for some debugging:
      var aa = (this.groupMaker.getGroup()).c,a,b;
      if(aa.length>1){
        a = aa[1];
        b = aa[2];
        for(var i = 0; i<a.length;i++){
        //var aa = iPoint(a[i][0],a[i][1],0,0);
          iDrawPoint(a[i],context,transform,{
                    style: "#FF0000",
                    radius: 6
                });}

        for(var i = 0; i<b.length;i++){
          iDrawPoint(b[i],context,transform,{
                    style: "#00F0FF",
                    radius: 12
                });
      }}

*/

        if(!this.domainShowingQ) {
            this.FDPoints=[];
            return;
        }
    
        this.drawEdgesOfFD(context,transform);
    }
  
    //
    // turn off the generator drawing inside of domain builder
    //
    drawEdgesOfFD(context, transform) {
        
        if(DEBUG) console.log(`${MYNAME}.drawEdgesOfFD()`);
        let gm = this.groupMaker;
        let gp = gm.getGroup();
        let fd = [...gp.s, ...gp.i];
        let ap = this.activeFDPart; // -1 if nothing active
        //not yet clear what form this should have if a cone point
        let color,
        width,
        shadowwidth;

        // need to write fd's for spherical and euclidean
        if (gm.curvature < 0) {
            color = this.styles.activeColor.color;
            width = this.styles.activeColor.width;
            shadowwidth = 5;
            if (ap >= 0) {
                iDrawSplane(fd[ap][0], context, transform, {
                    lineStyle: color,
                    shadowStyle: "#00007733",
                    lineWidth: width,
                    shadowWidth: shadowwidth
                });
            }

            var i;
            this.FDPoints = [];
            for (i = 0; i < fd.length; i++) {
                color = this.styles[fd[i][0].label[0]].color;
                width = this.styles[fd[i][0].label[0]].width;
                shadowwidth = 4;
                this.FDPoints.push(
                    iDrawSplane(fd[i][0], context, transform, {
                        lineStyle: color,
                        shadowStyle: "#00007733",
                        lineWidth: width,
                        shadowWidth: shadowwidth
                    }));
            }
        }
    }  // drawEdgesOfFD(context, transform) {
    
    
    getUniforms(uniforms){
        // just for extra UI control
        uniforms.u_fillOutDomain=0; //temp
    }
}




