import {iDrawSplane, 
        iMakeDefaultGenNames, 
        iGetMaxRefCount, 
        iPackDomain,
        iPackRefCount,
        iPackTransforms,
        iGetInverseTransforms,
        iParseGenerators,
        iPoint,
        iGetFactorizationU4,
        iTransformU4,
        iGetBisectorU4,
        iGetInverseTransform,
        iMakeTransformedPoints,
        iMakeBisectors,
        iDrawCircle,
        iGetGenNames,
        iDrawPoint,
        iMakeDefaultTransforms,
        } from './Inversive.js';
import {isDefined, isFunction, getParam} from './Utilities.js';

//
// class to build dirichlet domain from group data 
//
export class DirichletDomainBuilder {
  
  constructor(options){
    
    var opt = isDefined(options)? options: {};
    
		this.params = {
      
      showUI:false,
      showDirichlet:false,
			dirichletX:0.01,
			dirichletY:0.02,
			dirichletZ:0.,
			dirichletW:0.01,
			dirichletDepth:1,
      dirichletMin:0.01,
			dirichletPlanes:false,
			dirichletShadows:false,
			showBaseGens: false,
			showCrown: false,      
			crownGenerators:"",
      useCrown: false,
      debug: getParam(opt.debug, false),
      iterations: 1000,
    };

    this.USESAMPLER = getParam(opt.USESAMPLER, false);
    this.USEPACKING = getParam(opt.USEPACKING, false);
    this.MAX_TOTAL_REF_COUNT = getParam(options.MAX_TOTAL_REF_COUNT,20);
    this.MAX_REF_COUNT = getParam(options.MAX_TOTAL_REF_COUNT,4);
    this.MAX_GEN_COUNT = getParam(options.MAX_GEN_COUNT,3);
    
    this.DIRICHLET_BASE_RADIUS = 8;
    this.DIRICHLET_BASE_STYLE = {radius:this.DIRICHLET_BASE_RADIUS, fill:'#FFFF22', stroke:'#000000'};
    this.DIRICHLET_POINT_STYLE = {radius:3.5, fill:'#CC00CC'};

    this.editPoints = [];    
    
  } // constructor 
  
  /**
    return params to save 
  */  
  getParamsMap(){
    
    var p = this.params;
    
    return {
      showUI:p.showUI,
      showDirichlet:p.showDirichlet,
			dirichletX:p.dirichletX,
			dirichletY:p.dirichletY,
			dirichletZ:p.dirichletZ,
			dirichletW:p.dirichletW,
			dirichletDepth:p.dirichletDepth,
      dirichletMin:p.dirichletMin,
			dirichletPlanes:p.dirichletPlanes,
			dirichletShadows:p.dirichletShadows,
			showBaseGens:p.showBaseGens,
			showCrown:p.showCrown,
			crownGenerators:p.crownGenerators,
      useCrown:p.useCrown,

    };
  }

  /**
    set params from saved map 
  */  
  setParamsMap(paramsMap){
    
    var ctr = this.controllers;

    ctr.showUI.setValue(getParam(paramsMap.showUI,false));
    ctr.showDirichlet.setValue(getParam(paramsMap.showDirichlet,false));
    ctr.dirichletX.setValue(getParam(paramsMap.dirichletX,0.01));
		ctr.dirichletY.setValue(getParam(paramsMap.dirichletY,0.02));
		ctr.dirichletZ.setValue(getParam(paramsMap.dirichletZ,0));
		ctr.dirichletW.setValue(getParam(paramsMap.dirichletW,0.01));
		ctr.dirichletDepth.setValue(getParam(paramsMap.dirichletDepth,1));
    ctr.dirichletMin.setValue(getParam(paramsMap.dirichletMin,0.01));
    ctr.dirichletPlanes.setValue(getParam(paramsMap.dirichletPlanes,false));
		ctr.dirichletShadows.setValue(getParam(paramsMap.dirichletShadows,false));
		ctr.showBaseGens.setValue(getParam(paramsMap.showBaseGens,false));
		ctr.showCrown.setValue(getParam(paramsMap.showCrown,false));
		ctr.crownGenerators.setValue(getParam(paramsMap.crownGenerators,""));
    ctr.useCrown.setValue(getParam(paramsMap.useCrown,false));
    
  }
  
  //
  //
  //
  initGUI(options){
    
    this.onChanged = options.onChanged;
    this.groupMaker = options.groupMaker;
    this.group = this.groupMaker.getGroup();
    this.MAX_GEN_COUNT = options.MAX_GEN_COUNT;
    this.MAX_REF_COUNT = options.MAX_REF_COUNT;
    this.canvas = options.canvas;

    
    var gui = options.gui;
    var folder = options.folder;
    var onc = options.onChanged;
    
    var odc = this.onDirichletChanged.bind(this);
    var occ = this.onCrownChanged.bind(this);
    
    
    var par = this.params;
    var minIncrement = 1.e-10;
    this.controllers = {};
    var ctr = this.controllers;
		ctr.showUI = folder.add(par, 'showUI').onChange(onc);
		ctr.showBaseGens = folder.add(par, 'showBaseGens').onChange(onc).name("generators");
    ctr.showDirichlet = folder.add(par, 'showDirichlet').onChange(onc).name("dirichlet");	    
		ctr.dirichletX = folder.add(par, 'dirichletX', -10, 10, minIncrement).onChange(odc).name("base X");
		ctr.dirichletY = folder.add(par, 'dirichletY', -10, 10, minIncrement).onChange(odc).name("base Y");
		ctr.dirichletZ = folder.add(par, 'dirichletZ', -10, 10, minIncrement).onChange(odc).name("base Z");
		ctr.dirichletW = folder.add(par, 'dirichletW', 0.0001, 10, minIncrement).onChange(odc).name("base W");
		ctr.dirichletDepth = folder.add(par, 'dirichletDepth', 1, 50, 1).onChange(odc).name("max depth");		
		ctr.dirichletMin = folder.add(par, 'dirichletMin',0,1,minIncrement).onChange(odc).name("min scale");		
		ctr.dirichletPlanes = folder.add(par, 'dirichletPlanes').onChange(odc).name("planes");
		ctr.dirichletShadows = folder.add(par, 'dirichletShadows').onChange(odc).name("shadows");
		ctr.crownGenerators = folder.add(par, 'crownGenerators').onFinishChange(occ).name("crown");
		ctr.showCrown = folder.add(par, 'showCrown').onChange(occ).name("show crown");
		ctr.useCrown = folder.add(par, 'useCrown').onChange(occ).name("use crown");  
		ctr.debug = folder.add(par, 'debug');    
    
    gui.remember(par);
    
  } // initGUI()


  //
  // return uniforms needed for group rendering in GPU 
  //
  getUniforms(un){
    
    if(!isDefined(this.groupMaker))
      return un;
    
    this.calculateAll();
    
    var group = this.group;
    
    var fd = group.s;
    var trans = group.t;    
    
    var p = this.params;
    //if(this.params.debug)console.log("this.crownFD:", splanesToString(this.crownFD, 3)); 
    if(p.useCrown && isDefined(this.crownFD)){
      fd = this.crownFD;
      trans = this.crownTransforms;
    }
     
		un.u_genCount = fd.length;
		un.u_domainData = iPackDomain(fd, this.MAX_GEN_COUNT);
		un.u_groupRefCount = iPackRefCount(trans, this.MAX_GEN_COUNT);
		un.u_groupTransformsData = iPackTransforms(trans, this.MAX_GEN_COUNT, this.MAX_REF_COUNT);
    
    return un;
  }  
  
  //
  // render UI onto canvas 
  //
  render(context, transform){

    var par = this.params;
    
    this.transform = transform;
  
    //this.calculateAll();  

    var editPoints = [];
    this.editPoints = editPoints;
        
    var trans = ((isFunction(transform.transform2screen))? transform.transform2screen : transform.world2screen).bind(transform);
    
		if(par.showBaseGens){
			var fd = this.group.s;
			for(var i = 0; i < fd.length; i++){
				iDrawSplane(fd[i], context, transform, {lineStyle:"#0000FF",shadowStyle:"#00007733", lineWidth:2,shadowWidth:20, debug:par.debug});
			}
		}
   
		if(par.showDirichlet){
      
			var par = this.params;
      var dc = this.getDirichletCenter().v;
			iDrawCircle(dc, context, transform, this.DIRICHLET_BASE_STYLE);
      
			editPoints.push({p:trans(dc),type:0});
      
			if(isDefined(par.dirichletData)){
				var dirData = par.dirichletData;
				var transPnt = dirData.points; 
				if(isDefined(transPnt)){
					for(var k = 1; k < transPnt.length; k++){				
						iDrawCircle(transPnt[k].v, context, transform, this.DIRICHLET_POINT_STYLE);				
					}
					if(par.dirichletPlanes){
						var planes = dirData.planes;
						var sw = (par.dirichletShadows)?20:0;
						for(var k = 1; k < planes.length; k++){
              //console.log("draw splane:", splaneToString(planes[k],4));
							iDrawSplane(planes[k], context, transform, {lineStyle:"#00AA00",shadowStyle:"#00FF0033", lineWidth:2,shadowWidth:sw});				
						}					
					}
				}
				//console.log("dirData.selectedSplane:%s", dirData.selectedSplane);
				if(isDefined(dirData.selectedSplane)){
					iDrawSplane(dirData.selectedSplane, context, transform, {lineStyle:"#FF0000",shadowStyle:"#FF000033", lineWidth:2,shadowWidth:10});									
				}
				if(isDefined(par.selectedSplane)){
					iDrawSplane(par.selectedSplane, context, transform, {lineStyle:"#AAA00",shadowStyle:"#AAAA0033", lineWidth:2,shadowWidth:10});									          
        }                
				if(isDefined(par.selectedPoint)){
					iDrawPoint(par.selectedPoint.v, context, transform, {radius:4, style:"#AAAA00"});				
        }                
			}
		}	
		if(par.showCrown){
      
			var group = this.group;
			var fd = group.s;
			var t = group.t;
      
			var gnames = iGetGenNames(group);
			var gen = {};
			for(var i = 0; i < t.length; i++){
				gen[gnames[i]] = t[i];
			}
			var dc = this.getDirichletCenter();
      
      var crownStyle = "#AA00AA";
      var crownShadowStyle = "#AA00AA33";
      var crownShadowWidth = 10;
      
      var ctrans = this.group.crownTrans;
      
      if(isDefined(ctrans)){
        
        for(var i = 0; i < ctrans.length; i++){
          var ctr = ctrans[i];
          var dc1 = iTransformU4(ctr, dc);
					iDrawPoint(dc1.v, context, transform, {radius:4, style:"#AA00AA"});				
          var bs1 = iGetBisectorU4(dc1, dc);
          iDrawSplane(bs1, context, transform, {lineStyle:crownStyle,lineWidth:3,shadowStyle:crownShadowStyle,shadowWidth:crownShadowWidth});
        }
      }
		}	// if(par.crown)
   
    
  } // render 


  //
  // calculates all data needed for render 
  //
  calculateAll(){
    
    this.calculateGroup();    		
    this.calculateCrown();    		
    this.calculateDirichlet(); 
    
  }

  //
  //  calculate group and all 
  //
  calculateGroup(){
    
    var par = this.params;
    if(!getParam(par.groupParamChanged, true)){      
      return;
    }
    par.groupParamChanged = false;
    
    if(par.debug)console.log("re-calculating group");    

		var group = this.groupMaker.getGroup();
    this.group = group;
    
    //
    // to recalculate dirichlet and crown 
    //
    this.invalidateDirichlet();
    this.invalidateCrown();
    
    //if(!isDefined(this.group.genNames)){
      group.genNames = iMakeDefaultGenNames(this.group.t);
    //}
    
    if(!isDefined(this.group.t)){
        group.t = iMakeDefaultTransforms(group.s);
    }
        
    // give name to each side 
    for(var i = 0; i < group.s.length; i++){
      group.s[i].word = group.genNames[i];
      if(isDefined(group.t[i]))group.t[i].word = group.genNames[i];      
    }
        
    this.genCount = group.s.length;
    this.maxRefCount = iGetMaxRefCount(group.t);
    
    if(this.params.debug){
      console.log("genCount:" + this.genCount);
      console.log("maxRefCount:" + this.maxRefCount);
    }
    
    if(this.genCount > this.MAX_GEN_COUNT){
      //this.MAX_GEN_COUNT = genCount; 
      this.invalidateProgram(); 
      console.error("!!!  genCount > MAX_GEN_COUNT: ",(this.genCount + " > " + this.MAX_GEN_COUNT));
    }
    
    if(this.maxRefCount > this.MAX_REF_COUNT){
      //this.MAX_REF_COUNT = maxRefCount;
      this.invalidateProgram(); 
      console.error("!!! maxRefCount > MAX_REF_COUNT:", (this.maxRefCount + " > "+this.MAX_REF_COUNT));     
    }
    
    
    if(false){//if(this.params.debug){
      console.log("FD:");
      this.group.s.forEach(function(p,index){console.log(index + ":" + splaneToString(p, 4))});
      console.log("Transforms:");
      this.group.t.forEach(function(p,index){console.log(index + ":" + transformToString(p, 4))});
    }
        
  } // calculateGroup 
  
  //
  //  called when crown param was changed 
  //
  onCrownChanged(){
    
    this.params.crownChanged = true;
    this.onChanged();
    
  }

  //
  // called when dirichlet params was changed 
  //
  onDirichletChanged(){
    
    this.params.dirichletChanged = true;
    this.params.crownChanged = true;
    this.onChanged();
    
  }
  
  onGroupChanged(){
    
    this.params.groupParamChanged = true;
    
  }
  
  //
  //  
  //
  calculateCrown(){
    
    var par = this.params;
		//if(par.debug)console.log("calculateCrown()");    

    if(!getParam(par.crownChanged, true)){      
      return;
    }
		if(par.debug)console.log("re-calculating crown");    
    par.crownChanged = false;

    this.group.crownTrans = iGetInverseTransforms(iParseGenerators(this.group, this.params.crownGenerators)); 
    
    
    if(this.params.useCrown){
              
        var ctrans = this.group.crownTrans;
        var crownFD = [];  
        var par = this.params;
        var dc = iPoint([par.dirichletX, par.dirichletY,par.dirichletZ,par.dirichletW]);
        for(var i = 0; i < ctrans.length; i++){
        if(par.debug) console.log("ctrans[" + i + "]=" + transformToString(ctrans[i]));
        
          var ctr =  iGetFactorizationU4( ctrans[i]);          
          ctr.word = ctrans[i].word;
          
          ctrans[i] = ctr;
          var tdc = iTransformU4(ctrans[i], dc);
          crownFD[i] = iGetBisectorU4(dc, tdc);
          
          ctrans[i] = iGetInverseTransform(ctrans[i]);
        }
      
      this.crownFD = crownFD;
      this.crownTransforms = ctrans;
      
      if(this.params.debug)console.log("crownFD ready:", this.crownFD);    
      
    }
  } // calculateCrown 
  
  //
  //  calculate dirichlet planes if needed 
  //
  calculateDirichlet(){
      
		var par = this.params;
    if(!getParam(par.dirichletChanged, true)){      
      return;
    }
    par.dirichletChanged = false;
    
    if(par.debug)console.log("re-calculating dirichlet");

		if(par.showDirichlet){
			var dc = [par.dirichletX, par.dirichletY,par.dirichletZ,par.dirichletW];
			par.dirichletData = {};
			par.dirichletData.points = iMakeTransformedPoints(iGetInverseTransforms(this.group.t), {point:iPoint(dc), layersCount:this.params.dirichletDepth, minW:this.params.dirichletMin});
      if(par.debug)console.log('dirichlet points count:%d',par.dirichletData.points.length);
			if(par.dirichletPlanes){
				par.dirichletData.planes = iMakeBisectors(par.dirichletData.points);
			}
			//console.log("dirichlet points:", par.dirichletData.planes.length);
			//console.log("dirichlet planes count:", par.dirichletData.planes.length);
      //par.dirichletData.planes.forEach(function(p,index){console.log(index + ":" + splaneToString(p, 5))});

		} else {
			par.dirichletData = undefined;
		}
    
	} // calculateDirichlet 

  
  invalidateCrown(){
     this.params.crownChanged = true;    
  }

  invalidateDirichlet(){
     this.params.dirichletChanged = true;    
  }

  getDirichletCenter(){
    var p = this.params;
    return iPoint([p.dirichletX, p.dirichletY,p.dirichletZ,p.dirichletW])
    
  }

	//
	//  handles all UI events on canvas 
	//
	handleEvent(evt){	
  
    if(!this.params.showUI)
      return;
		switch(evt.type) {
		case 'mousemove':this.onMouseMove(evt);	break;		
		case 'mousedown':this.onMouseDown(evt);	break;
		case 'mouseup':  this.onMouseUp(evt);   break;
		case 'keydown':  this.onKeyDown(evt);   break;			
		default:
			break;
		}	
  }
  
  //
  //
  //
	onKeyDown(evt){
    
		//console.log("onKeyDown: char:" + evt.charCode + ", code:" + evt.code + ", key:" + evt.key);
    switch(evt.code){
      
      case 'KeyD':{
          var par = this.params;
          this.controllers.dirichletX.setValue(par.mouseWPnt[0]);
          this.controllers.dirichletX.setValue(par.mouseWPnt[1]);		
          this.invalidateDirichlet();	
          if(this.params.useCrown) {
            this.invalidateCrown();	
          }
          this.onChanged();
          break;
      }
      
      case 'KeyT':{
         this.setSelectedTransform(this.findTransform(iPoint([this.params.mouseWPnt[0],this.params.mouseWPnt[1],0,0])));
         
      }        
		}
	}

  //
  //
  //
	onMouseUp(evt){
		
    this.dragging = false;
		
	}
	
	
  //
  //
  //
	onMouseMove(evt){
		

    var pnt = [evt.offsetX,evt.offsetY];
    
    if(this.dragging){
      var wpnt = this.transform.transform2world(pnt);
      //this.lastMouse = wpnt;
      //console.log("drag:[%f %f]", wpnt[0],wpnt[1]);
      var apnt = this.activePoint;
      var par = this.params;
      var lastMouse = this.lastMouse;
      
      switch(apnt.type){  
      
        case 0:  // dirichlet center
          this.controllers.dirichletX.setValue(par.dirichletX + (wpnt[0] - lastMouse[0]));
          this.controllers.dirichletY.setValue(par.dirichletY + (wpnt[1] - lastMouse[1]));
          //this.onDirichletChanged();
          
        default: 
        break;
      }
      
      this.lastMouse = wpnt;
            
      evt.grabInput = true;
      return;
    }      
    
		if(isDefined(this.transform))
      this.params.mouseWPnt = this.transform.screen2world(pnt);
    
    
    var activePoint = this.findActivePoint(pnt, this.editPoints, 5);
    if(isDefined(activePoint)){
      this.canvas.style.cursor = 'pointer';      
    } 

		if(false){//evt.ctrlKey){
			//par.dirichletX = wpnt[0];
			//par.dirichletY = wpnt[1];			
			//this.onDirichletParamChanged();	
      //this.onCrownParamChanged();
		}    
	}		
	
  //
  //  process mouseDown event 
  //
  onMouseDown(evt){
    
    this.canvas.focus();

    var pnt = [evt.offsetX, evt.offsetY];
    var wpnt = this.transform.transform2world(pnt);
    
    var activePoint = this.findActivePoint(pnt, this.editPoints, 5);
    
    if(isDefined(activePoint)){
      
      this.activePoint = activePoint;      
      this.dragging = true;
      this.lastMouse = wpnt;
      // inform event dispatcher that we want to grab input 
      evt.grabInput = true;
      
    } else {
      
      this.activePoint = undefined;
      
    }
    
		if(evt.shiftKey){
      
      this.setSelectedSplane(this.findClosestSplane(iPoint([wpnt[0],wpnt[1],0,0])));
      
		}    
  }

  //
  //
  //
  /*
	onMouseDown(evt){
		
    var pnt = [evt.offsetX, evt.offsetY];
    
    var activePoint = this.findActivePoint(pnt, 5);
    
    if(isDefined(activePoint)){
      
      this.activePoint = activePoint;      
      this.dragging = true;
      var wpnt = this.transform.transform2world(pnt);
      this.lastMouse = wpnt;
      // inform event dispatcher that we want to grab input 
      evt.grabInput = true;
      
    } else {
      
      this.activePoint = undefined;
      
    }
    
    
		if(this.params.debug) console.log("DirichletDomainBuilder.onMouseDown()");
    
		this.mouseDown = true;
		if(evt.shiftKey){
      this.setSelectedSplane(this.findClosestSplane(iPoint([this.params.mouseWPnt[0],this.params.mouseWPnt[1],0,0])));
		}
		
	}	
*/	

  //
  //  return active edit point (if found)
  //
  findActivePoint(pnt, points, controlSize){
    
    for(var i = 0; i < points.length; i++){
      var p = points[i];
      if(distance1(p.p, pnt) < controlSize){
        //console.log("index: %d, type: %d",p.index, p.type);        
        return p;
      } 
    }
    return undefined;
  }

  
  setSelectedTransform(transInfo){
    
  }
  
  //
  //  find transform which maps given point into FundDomain 
  //
  findTransform(pnt){
    
    if(this.debug) console.log('findTransform(%18.15f, %18.15f)',pnt.v[0],pnt.v[1]);
    var fd = this.group.s;
    var trans = this.group.t;
    if(this.params.useCrown){
      fd = this.crownFD;
      trans = this.crownTransforms;
    }
    
    var info = iToFundDomain(fd, trans, pnt, this.params.iterations);
    
    if(info.inDomain) {
      console.log("found transform word: ", info.word);
      //console.log("      transform: ", transformToString(info.transform,4));
      //transform
      //var trans1 = iGetInverseTransform(info.transform);
      var dc = this.getDirichletCenter();
      var tdc = iInverseTransformU4(info.transform, dc);
      var ss = iGetBisectorU4(tdc, dc);
      this.params.selectedSplane = ss;
      this.params.selectedPoint = tdc;
      this.onChanged();
      return info;
    } else {
      console.log("fund domain transform not found: ");
    }
  } 
  
  
  // 
  //  mark given splane as selected 
  //
  setSelectedSplane(splane){
    
    if(!isDefined(this.params.dirichletData))
      this.params.dirichletData = {};
    
    var dd = this.params.dirichletData;
    if(splane != dd.selectedSplane){
      dd.selectedSplane = splane;
      this.onChanged(); 
      if(isDefined(splane)){
        console.log("selected splane: %s word: %s", splaneToString(splane, 6), splane.word);
      } else {
        console.log("splane undefined"); 
      }
    }
  } // setSelectedSplane(splane)
  
  //
  //  return splane closes to the given point 
  //  
  findClosestSplane(pnt){
    
    if(this.params.debug){
      console.log("findClosestSplane([%7.3f,%7.3f])", pnt.v[0],pnt.v[1]);
    }
    // find closest splane 
    var planes = [];
    var dd = this.params.dirichletData;
    
    if(this.params.dirichletPlanes && isDefined(dd) && isDefined(dd.planes)){
      planes = planes.concat(dd.planes);
    }
    
    //if(this.params.generators){
    //  planes = planes.concat(this.group.s);
   // }
    
    if(planes.length > 0) {
      //TODO this needs to be corrected by stretching factor at given location 
      var minDist = this.transform.getPixelSize()*10; // 10 pixels 
      var bestSplane = undefined;
      for(var i = 1; i < planes.length; i++){
        var plane = planes[i];
        var dist = abs(iDistance(plane, pnt));
        //console.log("splane: %s dist: %7.6f", splaneToString(plane, 6), dist);				
        if(dist < minDist) {
          minDist = dist;
          bestSplane = plane;
        }						
      }        
    }
    
    return bestSplane;
    
	} // findClosestSplane();

} // class DirichletDomainBuilder
