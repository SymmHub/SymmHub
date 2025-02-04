//
//  responsible for transformation between canvas pixel coordinates and world coordinates 
//  default world bounds are ([-1,1][-1,1]) 
//  bounds rectange width fit into into canvas width 
//

import {
  getParam, 
  isDefined
} from './modules.js';


export class CanvasTransform {
	
	constructor(param){
		
		var canvas = param.canvas;
		this.canvas = canvas;
		this.width = getParam(param.width, 100);
		this.height = getParam(param.height, 100);
		
		this.zoom = 1;
		this.position = [0,0];
		
		this.initTransform();
		
	}

	initTransform(){
		
		var canvas = this.canvas;
		if(isDefined(canvas)){
			this.width = canvas.clientWidth;
			this.height = canvas.clientHeight;
		} 
		this.aspect = this.height/this.width;
		this.pixelSize = 2./(this.width*this.zoom);
    
    //console.log("canvas: [%d x %d]",this.width,this.height);
    
	}
	
  //
  //  reset transform to default 
  //
  reset(){
    
		this.zoom = 1;
		this.position = [0,0];    
    
  }
  
  getPixelSize(){
    return this.pixelSize;
  }
  
	screen2worldX(x){
				
		return (2*x/this.width - 1)/this.zoom + this.position[0];
	}
	
	screen2worldY(y){
		
		return (-(2*y/this.height - 1)*this.aspect)/this.zoom  + this.position[1];
	}

	world2screenX(x){
		return ((x - this.position[0])*this.zoom + 1)*this.width/2;
	}
	
	world2screenY(y){
		return (1. - (y - this.position[1])*this.zoom/this.aspect)*this.height/2;
	}
	
	screen2world(s){
		
		return [this.screen2worldX(s[0]),this.screen2worldY(s[1])];
		
	}			

	world2screen(w){
		return [this.world2screenX(w[0]),this.world2screenY(w[1])];
	}
	
} // class CanvasTransform
