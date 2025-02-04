//import {complexN} from './ComplexArithmetic.js';
//import {ObjectId} from './ObjectId.js';
//import {splaneToString} from './ISplane.js';

import {
  complexN,
  ObjectId,
  splaneToString,
} from './modules.js';


//////////////////////////////////////////////
/////
/////    Miscellaneous general utilities
/////
/////

//// 

////  First, many functions for objects and arrays
//// Second, many math shortcuts

//////////////////////////////////////////////
/////
/////    Functions for strings and arrays
/////
/////

//
//  convenient check if variable is defined 
//
export function isDefined(p){
	return (p != null && p !== undefined);
}


//
//  convenient check if function is defined 
//
export function isFunction(func){
  return (typeof func === 'function');
}


//
//  return value if value is defined
//  return defaultValue otherwise 
//
export function getParam(value, defaultValue){
	
	if(isDefined(value)) 
		return value;
	else 
		return defaultValue;
}

//
//  assign values from map to params if params[key] is defined 
//
export function setParamsIfDefined(params, map){

  var keys = Object.keys(map);
  for(var i = 0; i < keys.length; i++){
    var key = keys[i];
    if(isDefined(params[key]))params[key] = map[key];
  }      
}




//
// inspect object properties 
//
export function inspectProperties(obj){
  for (const prop in obj) {
    console.log(`${prop}: ${obj[prop]}`);        
  }
}

//
//
//
export function addLineNumbers( string ) {
	var lines = string.split( '\n' );
	for ( var i = 0; i < lines.length; i ++ ) {
		lines[ i ] = ( i + 1 ) + ': ' + lines[ i ];
	}
	return lines.join( '\n' );
}


export function arrayEqualArray(a,b){
	if(Array.isArray(a)){
		if(Array.isArray(b)){
			var matchSoFarQ = (a.length==b.length);
			var i=0;
			while(matchSoFarQ && i<a.length)
			{
				matchSoFarQ = (arrayEqualArray(a[i],b[i]));
				i++;
			}
			return matchSoFarQ;
		}
		else return false;
	}
	else if (Array.isArray(b)){return false;}
	else return (a==b);
}

export function arrayInArray(outer,inner){
  
	if(Array.isArray(outer)){
    
		if(Array.isArray(inner)){
      
			var foundQ = false;
			var i = 0;
			while(!foundQ && i<outer.length){
				foundQ = arrayEqualArray(inner, outer[i]);
				i++;
			}
			return foundQ;
		}	else {
      return outer.includes(inner);
    }
	}	else {
    return false
  }
}

export function arrayReverse(a){
	var revArray=[];
	for(i=0;i<a.length; i++){
		revArray.unshift(a[i])
	}
	return revArray
}

export function objectToString(object, forMathematicaQ=false,prec = 4){
	// we'll assume we are only dealing with arrays, objects, NaN, null, undefined, number, boolean
  if(!isDefined(object))
    return 'undefined';
  
	let out="";
	let cnt = 0;
	var C="{",D="}"; 
	var type = typeof object;
	if (object == null){type = "null"}
	if (Array.isArray(object)){
    type = "array";
    if(!forMathematicaQ){
      C="[";
      D="]";
    }
	}
	//if (isDefined(object.constructor)){type = object.constructor;}
	switch(type){
		//default:   return object.constructor + object.toString(forMathematicaQ,prec); break;
		case "boolean": if(forMathematicaQ){if(object){return "True"}else {return "False"}; break;}
			else{if(object){return "T"}else {return "F"}}; break;
		case "number": 
			if (isNaN(object)){return "NaN";}
			else if(Number.isInteger(object)){return object.toString();}
			else{return object.toFixed(prec)}; break;
		case "undefined": return "undefined"; break;
		case "null": return "null"; break;
		case "string": return object; break;
		case "array":
			out=C;
      cnt=0;
			object.forEach(function(element){cnt++; out+=objectToString(element,forMathematicaQ,prec)+","})
			if(cnt>0){out=out.slice(0,-1);}
			out+=D;
			return out; break;
		case "object": 
      if(isDefined(object.constructor))out += object.constructor.name;
      out += C;
			Object.keys(object).forEach(function(key){
				cnt++; if(forMathematicaQ){
					out+=C+objectToString(key,forMathematicaQ,prec)+","+objectToString(object[key],forMathematicaQ,prec)+D+",";
				} 
				else 
					{out+=objectToString(key,forMathematicaQ,prec)+":"+objectToString(object[key],forMathematicaQ,prec)+","}
			})
			if(cnt>0){out=out.slice(0,-1);}
			out+=D;
			return out; break;
	}
}

export function arrayToString(array,forMathematicaQ=false, prec=4){
	var out="";
    var C,D; if(forMathematicaQ){C="{"; D="}";} else {C="[";D="]";}
	if (typeof array === "boolean"){
		if(forMathematicaQ){if(array){out+="True"}else{out+="False"}}
		else{if(array){out+="true"}else{out+="false"}}
	}
	else if(Array.isArray(array)){
    	out=C;
    	var cnt = 0;
		array.forEach(function(element){cnt++;out+=arrayToString(element,forMathematicaQ)+","})
		if(cnt>0){out = out.slice(0,-1);}
    	out+=D}
	else if(isNaN(array))
    	{out+=array.toString()}
    else if(Number.isInteger(array))
        {out+=array.toString()}
    else {out+=array.toFixed(prec)}
	return out
}


//
// convert float array into a string with given precision, with line breaks
//
export function iArrayToString(f, precision){
	var s = "[";
	var slen = 80;
	for(var i = 0; i < f.length; i++){
		s += f[i].toFixed(precision);
		if(i < f.length-1) s += ", ";
		if(s.length - slen > 80){ 
			s += "\n";
			slen += s.length;
		}
	}
	s += "]";
	return s;
}



//
//  convert array of splanes to string 
//
export function splanesToString(t, precision=6){
  if(!isDefined(t))
    return '[undefined]';
	var s = "[";
	for(var i = 0; i < t.length; i++){
		s += splaneToString(t[i], precision);
    if(i < t.length -1) s += ',\n';
	}
	return s+']';  
}

export function transformToString(t, precision=6){
	
	let str = '{\nsplanes:\n'+splanesToString(t,precision);
  if(isDefined(t.word)) str += ',\nword:'+t.word + '\n}';
  else str += '\n}';
  return str;
  
}



//////////////////////////////////////////////
/////
/////    Math shortcuts
/////
/////



export const PI = Math.PI ;
export const TPI = 2*PI;
export const HPI = PI/2;
export const TORADIANS = PI/180.;
export const EPSILON = 1e-13;
export const INFINITY = 10./EPSILON;
export const SHORTEPSILON = .0000001; 
export const SHORTEREPSILON = .0001;  

// for convenience; could convert to, say, Stampfli's Fast methods

export function pow(x,n){return Math.pow(x,n)}
export function log(x){return Math.log(x)}
export function cos(a){return Math.cos(a)}
export function sin(a){return Math.sin(a)}
export function sec(a){return Math.sec(a)}
export function csc(a){return Math.csc(a)}
export function tan(a){return Math.tan(a)}
export function cot(a){return 1/(Math.tan(a))}
export function cosh(a){return Math.cosh(a)}
export function tanh(a){return Math.tanh(a)}
export function acosh(a){return Math.acosh(a)}
export function asin(a){return Math.asin(a)}
export function atan(a){return Math.atan(a)}
export function atan2(a,b){return Math.atan2(a,b)}
export function asinh(a){return Math.asinh(a)}
export function atanh(a){return Math.atanh(a)}
export function sinh(a){return Math.sinh(a)}
export function coth(a){return 1/(Math.tanh(a))}
export function abs(a) {return Math.abs(a)}
export function sqrt(a){return Math.sqrt(a)}
export function exp(x){return Math.exp(x)}
export function min(x,y){return Math.min(x,y)}
export function max(x,y){return Math.max(x,y)}
export function mod(a,b){
  if(a<0){return (a%b)+abs(b)}
  else return a%b}
export function random(){return Math.random()}
export function sign(a){return Math.sign(a)}

  /**
    convert color in hex representation #RRGGBBAA into array of 4 floats [R,G,B,A]
  */
export function hexToRGBA(hex) {
    
  var r = 0, g = 0, b = 0, a = 1;
  
  switch(hex.length){
    case 9: // #RRGGBBAA
      a = parseInt(hex.slice(7, 9), 16)/255;
      // no break;
    case 7: // #RRGGBB
      r = parseInt(hex.slice(1, 3), 16)/255.;
      g = parseInt(hex.slice(3, 5), 16)/255.;
      b = parseInt(hex.slice(5, 7), 16)/255.;
    break;
    case 5: //#RGBA
      a = parseInt(hex.slice(4, 5), 16)/15.;      
      // no break;
    case 4: //#RGB
      r = parseInt(hex.slice(1, 2), 16)/15.;
      g = parseInt(hex.slice(2, 3), 16)/15.;
      b = parseInt(hex.slice(3, 4), 16)/15.;
    break;
  }
  //console.log('rgba:',r,g,b,a);
  return [r,g,b,a];    
}

/**
  convert full color into premult color 
*/
export function premultColor(color){
  const a = color[3];
  return [color[0]*a, color[1]*a, color[2]*a, a];
}


/**
  set values from map to each member of controllers object 
  
  controllers is expected to be an object with the same named keys as keys in the map
  call setValue() on each controller 
*/
export function setControllersValues(controllers, map){
  
  var keys = Object.keys(map);
  for(var i = 0; i < keys.length; i++){
    var key = keys[i];
    //console.log('key:', key, ' value:', map[key]);
    if(isDefined(controllers[key]))controllers[key].setValue(map[key]);
  }      
}


const theAnch = document.createElement("a");
theAnch.style.display = "none";
document.body.appendChild(theAnch);

export function saveBlobAsFile_new(blob, fileName){
  
  //const a = document.createElement("a");
  const objURL = URL.createObjectURL(blob);
  theAnch.href = objURL;//URL.createObjectURL(blob);
  theAnch.download = fileName;
  //document.body.appendChild(a);
  theAnch.click();
  URL.revokeObjectURL(objURL);
  //a.remove();        
  
}

export function writeBlobToFile(blob, fileName){
  
  //console.log('writeBlobToFile()', fileName);
  const a = document.createElement("a");
  const objURL = URL.createObjectURL(blob);
  a.href = objURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(objURL);
  a.remove();        
  //console.log('writeBlobToFile() done', fileName);
  
}

  /**
    save paramers
  */
export function writeToJSON(object, fileName){
      
  console.log('writeToJSON(', fileName,')');
  var jsdata = JSON.stringify(object, null, 2);
  writeBlobToFile(new Blob([jsdata],{type: 'text/plain'}), fileName);
  //console.log('writeToJSON() done');
    
} // writeToJSON(object, fileName)


export function writeCanvasToFile(canvas, fileName, type='image/png'){
  
  canvas.toBlob(function(blob) {
      writeBlobToFile(blob, fileName);
  }, type);    
  //console.log('writeCanvasToFile() done');
}


/**
  return linear interpolation between a and b 
*/
export function lerp(a, b, t) {
  return a * (1-t) + b*t;
}


/**
 * Resize a canvas to match the size it's displayed.
 * @param {HTMLCanvasElement} canvas The canvas to resize.
 * @param {number} [multiplier] So you can pass in `window.devicePixelRatio` if you want to.
 * @return {boolean} true if the canvas was resized.
 */
export function resizeCanvasToDisplaySize(canvas, multiplier) {
  
  multiplier = multiplier || 1;
  multiplier = Math.max(1, multiplier);
  var width = canvas.clientWidth * multiplier | 0;
  var height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}


/**
  return readable name of the object 
*/
export function getName(item){
  
  if(isDefined(item)){
    
    if(isDefined(item.constructor)){
      
      return item.constructor.name;
      
    } else {
      
      return (typeof item);
      
    }
    
  } else {
    
    return '[undefined]';
    
  }
}

export function getNameAndId(item){
  return getName(item) + '[' + ObjectId(item) + ']';
}


export function callEventHandlers(eventHandlers, evt){
  
  for(let i = 0; i < eventHandlers.length; i++){
    let handler = eventHandlers[i];
    if(isFunction(handler.handleEvent)){
      handler.handleEvent(evt); 
      if(evt.grabInput)
      return;        
    }     
  }      
}


