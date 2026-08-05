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
} from './modules.js';

import {
    lengthKeys, twistKeys,
    objectToString, isDefined, getParam, sign, isFunction,
    sin, cos, abs, sqrt, SHORTEPSILON,
    nearArcQ, iGetFactorizationU4,
    iDrawSplane, iDrawPoint,
    getCopy,
    sPlaneThroughPerp, sPlaneSwapping, complexN,
    poincareMobiusTranslateFromToByD,
    sPlanesMovingEdge1ToEdge2,
    poincareMobiusFromSPlanesList,
} from './modules.js';

const DEBUG = false;
const MYNAME = 'SymmetryUIController';

// parameter change per canvas pixel of drag
const LENGTH_DRAG_SPEED = 0.005;
const TWIST_DRAG_SPEED  = 0.002;

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
  
  resetWheel(){
    this.midDist=-1000;
    this.activeFDPart = -1;
  }
  
  handleEvent(evt){
    switch(evt.type) {
    case 'keydown':
      // Only react to keys we actually handle. Resetting the hover state on
      // every keydown would kill shift+wheel twisting (pressing Shift used to
      // clear activeFDPart before the wheel event arrived).
      if(evt.code === "Space"){
        this.resetWheel();
        this.onKeyDown(evt);
      }
      break;
    case 'mousemove':
    case 'pointermove':
      if(this.draggingParam){
        // dragging an edge of the fundamental domain: change its parameter
        this.onParamDrag(evt);
      } else if(evt.buttons){
        // a button is held but we are not the ones dragging (navigation or
        // texture drag in progress) — don't steal the pointer with hit-testing
      } else {
        this.resetWheel();
        this.onMouseMove(evt);
      }
      break;
    case 'wheel':
      this.onWheel(evt);
      break;
    case 'pointerdown':
    case 'mousedown':
      // NOTE: no resetWheel() here — onMouseDown needs activeFDPart
      // to decide whether this press grabs a domain edge.
      this.onMouseDown(evt);
      break;
    case 'pointerup':
    case 'mouseup':
    case 'pointerleave':
      this.onMouseUp(evt);
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

  //
  // locate the splane of the currently active (highlighted) FD part;
  // returns its label ([key, index]) or null.
  //
  getActiveEdgeLabel(){
    let ap = this.activeFDPart;
    if(ap < 0) return null;
    let gp = this.groupMaker.getGroup();
    let changing;
    if(ap >= gp.s.length){
      changing = gp.i[ap - gp.s.length];
    } else {
      changing = gp.s[ap];
    }
    if(changing == undefined || changing[0] == undefined) return null;
    return changing[0].label;
  }

  //
  //  commit a new value of parameter ls (e.g. "conePair_1_l").
  //  Restores the transform stashed when the edge was grabbed, so that
  //  setShift() re-anchors the grabbed point instead of accumulating error.
  //
  applyParamValue(ls, newvalue){
    let gm = this.groupMaker;
    let item = gm.paramGuiFolderItems ? gm.paramGuiFolderItems[ls] : undefined;
    if(item == undefined) return;
    this.transform.setInversiveTransform(getCopy(this.stashedTransforms));
    gm.needsShiftQ = true;
    // this will force a call to setShift before an update of the canvas
    item.setValue(newvalue);
  }

  onMouseDown(evt){
    this.renderer.getOverlay().focus();
    // only the primary button starts a parameter drag
    if(evt.button !== undefined && evt.button !== 0) return;
    // a texture control point under the cursor has priority over edge grabbing
    let pm = this.groupMaker.patternMaker;
    if(pm && isFunction(pm.findActivePoint) && pm.editPoints
        && isDefined(pm.findActivePoint([evt.canvasX, evt.canvasY], pm.editPoints, 5))){
      return;
    }
    // the hover state may be stale (e.g. the pointer teleported without
    // move events) — re-validate the hit at the press position
    this.resetWheel();
    this.onMouseMove(evt);
    if(this.activeFDPart >= 0 && this.midDist != -1000){
      // start dragging the highlighted edge: the drag changes its parameter
      let label = this.getActiveEdgeLabel();
      if(label == null) return;
      this.draggingParam = true;
      this.dragStart = [evt.canvasX, evt.canvasY];
      this.dragStartValues = {};
      let ls = label[0]+"_"+label[1].toString();
      this.dragStartValues[ls+"_l"] = this.groupMaker.guiParams[ls+"_l"];
      this.dragStartValues[ls+"_t"] = this.groupMaker.guiParams[ls+"_t"];
      this.stashedTransforms = getCopy(this.transform.getInversiveTransform());
      // stop a still-gliding pan animation: it would keep mutating the
      // view transform every frame while we anchor against the stash
      if(this.transform.mAnimatedPointer) this.transform.mAnimatedPointer.stop();
      evt.grabInput = true;
    }
  }

  onMouseUp(evt){
    if(this.draggingParam){
      this.draggingParam = false;
      evt.grabInput = true;
    }
  }

  //
  //  dragging a highlighted edge: horizontal/vertical mouse movement
  //  changes the length parameter (shift: the twist parameter) of the edge.
  //
  onParamDrag(evt){
    if(!evt.buttons){
      // the pointerup was lost (e.g. released outside the window)
      this.draggingParam = false;
      return;
    }
    let label = this.getActiveEdgeLabel();
    if(label == null){
      this.draggingParam = false;
      return;
    }
    // dragging right or up increases the value
    let d = (evt.canvasX - this.dragStart[0]) - (evt.canvasY - this.dragStart[1]);
    let twistQ = evt.shiftKey && twistKeys.includes(label[0]);
    let lengthQ = !twistQ && lengthKeys.includes(label[0]);
    let ls = label[0]+"_"+label[1].toString();
    let newvalue;
    if(twistQ){
      ls += "_t";
      newvalue = this.dragStartValues[ls] + d*TWIST_DRAG_SPEED;
      while(newvalue>TWISTMAXVALUE){
        newvalue -= TWISTMAXVALUE-TWISTMINVALUE;
      }
      while(newvalue<TWISTMINVALUE){
        newvalue += TWISTMAXVALUE-TWISTMINVALUE;
      }
    } else if(lengthQ){
      ls += "_l";
      newvalue = this.dragStartValues[ls] + d*LENGTH_DRAG_SPEED;
      newvalue = Math.min(Math.max(newvalue, LENGTHMINVALUE), LENGTHMAXVALUE);
    } else {
      return;
    }
    this.applyParamValue(ls, newvalue);
    evt.grabInput = true;
  }

  onMouseOver(evt){
    //for now, just grab the focus
    this.renderer.getOverlay().focus();
  }




  onKeyDown(evt){
    switch(evt.code){
      case "Space": // toggle domain drawing
      this.domainShowingQ = !this.domainShowingQ;
      if(!this.domainShowingQ){this.FDPoints=[]}
      // the 'domain' controller no longer exists in GroupRendererConfig;
      // update it when present, but do not depend on it
      let domainCtrl = this.renderer && this.renderer.config && this.renderer.config.controllers
            ? this.renderer.config.controllers.domain : undefined;
      if(domainCtrl) domainCtrl.setValue(this.domainShowingQ);
      if(isFunction(this.onChanged)) this.onChanged();
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
      // (defensive: after a group change fd may be shorter than FDPoints,
      // and Euclidean/spherical faces carry no label)
      let part = (i>=gp.s.length) ? gp.i[i-gp.s.length] : gp.s[i];
      edge = part ? part[0] : undefined;
      check = (edge && edge.label) ? edge.label[0] : undefined;
      if(check && lengthKeys.includes(check)){
        // note: not getCanvasPnt(evt) -- it throws on a legitimate 0 coordinate
        this.midDist= nearArcQ([evt.canvasX, evt.canvasY],this.FDPoints[i], this.transform,7);
        //this returns the proportion along the edge, as a distance.
        foundFDQ=!(this.midDist==-1000)}//-1000 is returned if not found
      if(!foundFDQ) i++;
    }//done looking; did we find anything?
    if(!foundFDQ){
      //nope, we didn't, so just move on along.
      this.activeFDPart = -1;
      if(oldAp!=this.activeFDPart){
        this.requestRepaint();}
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
      // highlight feedback: a repaint is enough, the group itself is unchanged
      if(oldAp!=this.activeFDPart){
        this.requestRepaint();}
      let overlay = this.renderer && isFunction(this.renderer.getOverlay) ? this.renderer.getOverlay() : null;
      if(overlay) overlay.style.cursor = 'grab';
      this.stashedTransforms = getCopy(this.transform.getInversiveTransform());
     // console.log("found "+this.activeFDPart.toString()+" "+this.midDist.toString());

      return;}
  }

  //
  // schedule an overlay repaint without recomputing the group
  //
  requestRepaint(){
    if(this.renderer && isFunction(this.renderer.repaint)){
      this.renderer.repaint();
    } else if(isFunction(this.onChanged)){
      this.onChanged();
    }
  }

  onWheel(evt){
    if(this.activeFDPart == -1){return;}
    let label = this.getActiveEdgeLabel();
    if(label == null){return;}
    let gm = this.groupMaker;
    let delta = sign(evt.deltaY);
    let twistQ = evt.shiftKey && twistKeys.includes(label[0]);
    let lengthQ = !twistQ && lengthKeys.includes(label[0]);
    let ls = label[0]+"_"+label[1].toString();
    let newvalue;
    if(twistQ){
      ls+="_t";
      newvalue = gm.guiParams[ls]+delta*.01;
      while(newvalue>TWISTMAXVALUE){
        newvalue -= TWISTMAXVALUE-TWISTMINVALUE;
      }
      while(newvalue<TWISTMINVALUE){
        newvalue+=TWISTMAXVALUE-TWISTMINVALUE;
      }
    }
    else if(lengthQ){
      ls+="_l";
      newvalue = gm.guiParams[ls]+delta*.03;
      if(newvalue<LENGTHMINVALUE)
        {newvalue =LENGTHMINVALUE;}
      if(newvalue>LENGTHMAXVALUE){
        newvalue = LENGTHMAXVALUE;
      }
    } else {
      return;
    }

    this.applyParamValue(ls, newvalue);
    evt.grabInput = true;
  }
  
  setShift(){
     //fix the location of the grabbed point of the edge
    let gp = this.groupMaker.getGroup();
    let edge;

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

        // NOTE: the navigator keeps its transform behind
        // getInversiveTransform()/setInversiveTransform(); the old direct
        // this.transform.transforms access does not exist any more.
        let combined = [...this.transform.getInversiveTransform(), ...newTransforms];
        if(combined.length >= 6){
          // keep the transform list bounded — without this every gesture
          // grows the list by 2 and rendering slows down until it dies
          combined = iGetFactorizationU4(combined);
        }
        this.transform.setInversiveTransform(combined);
        this.transform.informListener();
      }
    }
  }
  
  
  
    render(context,transform){
        if(DEBUG)console.log(`${MYNAME}.render()`,this.domainShowingQ);

     

     /* // for the moment, for some debugging:
      var aa = (this.groupMaker.getGroup()).c;
      var a,b,c;
      
      a = aa.listoftexturesamplingpoints; // this should be the grid of points
      b = aa.trpointregistry; // this should be the images of the reference point
      c = aa.transformedpts;
        // a grid of points showing the sampling; can delete FD.c[1]
     for(var i = 0; i<a.length;i++){
        //var aa = iPoint(a[i][0],a[i][1],0,0);
          iDrawPoint(a[i],context,transform,{
                    style: "#FF000088",
                    radius: 3
                });}


        for(var i = 0; i<b.length;i++){
          iDrawPoint(b[i],context,transform,{
                    style: "#CCCC00FF",
                    radius: 14
                });
          iDrawPoint(b[i],context,transform,{
                    style: "#FF70A0FF",
                    radius: 12
                });
      } // end of drawing the blue points



        for(var i = 0; i<c.length;i++){
          iDrawPoint(c[i],context,transform,{
                    style: "#CCCC00FF",
                    radius: 14
                });
          iDrawPoint(c[i],context,transform,{
                    style: "#A7FF0FFF",
                    radius: 12
                });
      } // end of drawing the purple points


      iDrawSplane(aa[4][3], context, transform, {
                        lineStyle: "#0000AAFF",
                        shadowStyle: "#00007777",
                        lineWidth: 5,
                        shadowWidth: 6
                    })

      iDrawSplane(aa[4][2], context, transform, {
                        lineStyle: "#00AA00FF",
                        shadowStyle: "#00007777",
                        lineWidth: 5,
                        shadowWidth: 6
                    })
      
*/

  // iDrawPoint([0,0],context,transform,{       style: "#FFFFFFFF", radius: 5 });

       // end of a bunch of debugging stuff  
  


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
        if (gm.curvature >= 0) {
            // no drawable edges for these groups; drop stale hyperbolic
            // FDPoints so the hover hit-test does not run against them
            this.FDPoints = [];
            return;
        }
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
                let st = (fd[i][0].label && this.styles[fd[i][0].label[0]]) || { color: "#92C4DD", width: 2 };
                color = st.color;
                width = st.width;
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
        
        // PUT UI FRAG RENDERING STUFF HERE
        return uniforms;
    }
}




