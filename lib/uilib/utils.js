
export const $ = (s)=>document.querySelector(s);

export function getTextureScale (texture, width, height) {
    return {
        x: width / texture.width,
        y: height / texture.height
    };
}

export function getPixelRatio(){
  return window.devicePixelRatio || 1;
}
export function scaleByPixelRatio (input) {
    //console.log("window.devicePixelRatio: ", window.devicePixelRatio);
    let pixelRatio = window.devicePixelRatio || 1;    
    return Math.floor(input * pixelRatio);
}

export function hashCode (s) {
    if (s.length == 0) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};


export function wrap (value, min, max) {
    let range = max - min;
    if (range == 0) return min;
    return (value - min) % range + min;
}

export function normalizeColor (input) {
    let output = {
        r: input.r / 255,
        g: input.g / 255,
        b: input.b / 255
    };
    return output;
}

export function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r,
        g,
        b
    };
}

export function hexColorToArray(h) {
    let c = hexToColor(h);
    return [c.r,c.g,c.b,c.a];
}

export function premultColorArray(ca) {
  
    let a = ca[3];
    return [ca[0]*a,ca[1]*a,ca[2]*a,a];
    
}

export function hexToPremult(h){
  return premultColorArray(hexColorToArray(h));
}
export function hexToColor(h) {
  
  let r = 0, g = 0, b = 0, a = 1;

  // 3 digits
  if (h.length == 4) {
    r = "0x" + h[1] + h[1];
    g = "0x" + h[2] + h[2];
    b = "0x" + h[3] + h[3];

  // 6 digits
  } else if (h.length == 7) {
    r = "0x" + h[1] + h[2];
    g = "0x" + h[3] + h[4];
    b = "0x" + h[5] + h[6];
    
  } else if (h.length == 5) {
    
    r = "0x" + h[1] + h[1];
    g = "0x" + h[2] + h[2];
    b = "0x" + h[3] + h[3];
    a = "0x" + h[4] + h[4];
    
  } else if (h.length == 9) {
    r = "0x" + h[1] + h[2];
    g = "0x" + h[3] + h[4];
    b = "0x" + h[5] + h[6];
    a = "0x" + h[7] + h[8];
  }
  
  return { r:r/255, g: g/255, b: b/255, a: a/255};
  
}

export function generateColor () {
    let c = HSVtoRGB(Math.random(), 1, Math.random());
    //c.r *= 0.15;
    //c.g *= 0.15;
    //c.b *= 0.15;
    return c;
}


export function correctDeltaX (canvas, delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
}

export function correctDeltaY (canvas, delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
}



export function updatePointerDownData (canvas, pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
}

export function updatePointerMoveData (canvas, pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(canvas, pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(canvas, pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

export function updatePointerUpData (canvas, pointer) {
    pointer.down = false;
}

export function correctRadius (canvas, radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1)
        radius *= aspectRatio;
    return radius;
}

//
// makes internal size of the canvas to specific 
// 
export function resizeCanvas (canvas, scaleFactor) {
    //console.log('resizeCanvas:',  scaleFactor);
    if(!isDefined(scaleFactor))
        scaleFactor = 1.;
    let width = scaleFactor*scaleByPixelRatio(canvas.clientWidth);
    let height = scaleFactor*scaleByPixelRatio(canvas.clientHeight);
    
    if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }
    return false;
}

function resizeCanvasToDisplaySize(canvas) {
  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}


export function clamp01 (input) {
    return Math.min(Math.max(input, 0), 1);
}

export function normalizeTexture (texture, width, height) {
    let result = new Uint8Array(texture.length);
    let id = 0;
    for (let i = height - 1; i >= 0; i--) {
        for (let j = 0; j < width; j++) {
            let nid = i * width * 4 + j * 4;
            result[nid + 0] = clamp01(texture[id + 0]) * 255;
            result[nid + 1] = clamp01(texture[id + 1]) * 255;
            result[nid + 2] = clamp01(texture[id + 2]) * 255;
            result[nid + 3] = clamp01(texture[id + 3]) * 255;
            id += 4;
        }
    }
    return result;
}

export function textureToCanvas (texture, width, height) {
    let captureCanvas = document.createElement('canvas');
    let ctx = captureCanvas.getContext('2d');
    captureCanvas.width = width;
    captureCanvas.height = height;

    let imageData = ctx.createImageData(width, height);
    imageData.data.set(texture);
    ctx.putImageData(imageData, 0, 0);

    return captureCanvas;
}

export function downloadURI (filename, uri) {
    let link = document.createElement('a');
    link.download = filename;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function isFunction(x) {
    if (typeof x === "function") 
        return true;
    else 
        return false;
}
    
//
//  convenient check if variable is defined 
//
export function isDefined(p){
	return (p != null && p !== undefined);
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


export function pointerPrototype () {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = [30, 0, 300];
}


export function objectToString(object, forMathematica=false,prec = 4){
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
    if(!forMathematica){
      C="[";
      D="]";
    }
	}
	//if (isDefined(object.constructor)){type = object.constructor;}
	switch(type){
		//default:   return object.constructor + object.toString(forMathematica,prec); break;
		case "boolean": if(forMathematica){if(object){return "True"}else {return "False"}; break;}
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
			object.forEach(function(element){cnt++; out+=objectToString(element,forMathematica,prec)+","})
			if(cnt>0){out=out.slice(0,-1);}
			out+=D;
			return out; break;
		case "object": 
      if(isDefined(object.constructor))out += object.constructor.name;
      out += C;
			Object.keys(object).forEach(function(key){
				cnt++; if(forMathematica){
					out+=C+objectToString(key,forMathematica,prec)+","+objectToString(object[key],forMathematica,prec)+D+",";
				} 
				else 
					{out+=objectToString(key,forMathematica,prec)+":"+objectToString(object[key],forMathematica,prec)+","}
			})
			if(cnt>0){out=out.slice(0,-1);}
			out+=D;
			return out; break;
	}
}

//
//
//
export function a2s(array,params = {forM:false, prec:4}){

  let forM = getParam(params, 'forM');
  
	let out="";
  
  let C    = (forM) ? '{'    : '[';
  let D    = (forM) ? '}'    : ']';
  let tStr = (forM) ? 'True' : 'true';
  let fStr = (forM) ? 'False': 'false';
  
   
	if (typeof array === "boolean"){
    
    if(array) out += tStr;
    else      out += fStr;      
      
	} else if(Array.isArray(array)){
    
    	out = C;
    	let cnt = 0;
      
      array.forEach( function(e){ cnt++; out += a2s(e,params)+","} )
      // remove last comma
      if(cnt > 0) out = out.slice(0,-1);
      
      out+=D;
      
  } else if(isNaN(array)) out += array.toString();
  
    else if(Number.isInteger(array)) out+=array.toString();
    
    else out += array.toFixed(prec);
    
	return out;
  
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
//  convert float array to string with given precision
//
export function fa2s(v, digits){
  let s = '[';
  for(let i = 0; i < v.length; i++){
    let x = v[i];
    if(x >= 0.) 
    s += ' ';
    s += x.toFixed(digits);
    if(i < v.length-1)
      s += ', ';        
  }
  s += ']';
  return s;
}


// prepend zeroes to the number v

export function addZero(v, count){
  let s = v.toFixed(0).padStart(count,'0');
  
  //count -=  s.length;
  //for(let i = 0; i < count; i++){
  //  s = '0' + s;
  //}
  return s;
}

//
//  converts data to a string to be used for file names 
//
export function date2s(date, separator){
  if(!isDefined(separator))
    separator = '-';
  let s = separator + addZero((date.getFullYear()-2000),2)+
          separator + addZero((date.getMonth()+1),2) + 
          separator + addZero(date.getDate(),2) + 
          separator + addZero(date.getHours(),2) + 
          separator + addZero(date.getMinutes(),2) + 
          separator + addZero(date.getSeconds(),2) + 
          separator + addZero(date.getMilliseconds(), 3);
   //console.log(s);
   return s;
}

//
//  return distance between points represented as arrays
//
export function distanceSquared(pnt0, pnt1){
  let d = 0; 
  let dim = Math.min(pnt0.length,pnt1.length);
  for(let i = 0; i < dim; i++){
    let dd = pnt0[i] - pnt1[i];
    d += dd*dd;
  }
  return d;
}

//
//
//
export function distance(pnt0, pnt1){
  
  return Math.sqrt(distanceSquared(pnt0, pnt1));
  
}

export function lerp(a, b, t) {
  return a * (1-t) + b*t;
}

export function lerp_arrays(pnt0, pnt1, t) {
  
  let dim = Math.min(pnt0.length,pnt1.length);
  let out = [];
  for(let i = 0; i < dim; i++){
    out.push(lerp(pnt0[i], pnt1[i], t));
  }
  
  return out;
}

//
//  rotate 2D point around origin 
//
export function rotateXY(p, ca, sa){
  
  let t = p[0] * ca - p[1] * sa;
  p[1] = p[0] * sa + p[1] * ca;
  p[0] = t;
  
}

let startTime = -1;
//
//  returns time from program start 
//
export function getTime(){
    if(startTime < 0) {
        startTime = Date.now();
    }
    return Date.now() - startTime;
}

//
//  convert large array using chunks 
//
function Uint8ToString(u8a){
  var CHUNK_SZ = 0x8000;
  var c = [];
  for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
    c.push(String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ)));
  }
  return c.join("");
}


//
//  convert float32 array to base64 string 
// 
export function fa2str(array){

    let uint = new Uint8Array( array.buffer );

    //let str = btoa( String.fromCharCode.apply( null, uint ) ); 
    let str = btoa( Uint8ToString(uint));
    return str;
    
}

//
//  convert float32 array to array of base64 string of limited length (< 0x8000 )
// 
export function fa2stra(array){

    let uint = new Uint8Array( array.buffer );
    var CHUNK_SZ = 0x8000;
    var sa = [];
    for (var i=0; i < uint.length; i+=CHUNK_SZ) {
        let str = String.fromCharCode.apply(null, uint.subarray(i, i+CHUNK_SZ));
        sa.push(btoa(str));
    }
        
    return sa;
}

// 
//  convert base64 string to Float32Array 
//
export function str2fa(str){
    
    let blob = atob( str );

    let abuf = new ArrayBuffer( blob.length );
    let dv = new DataView( abuf );
    for( let i = 0; i < blob.length; i++ ) {
        dv.setUint8( i, blob.charCodeAt(i) );
    }
    
    let fa = new Float32Array( abuf );

    return fa;
    
}

//
//   write float32array into a file 
//
export function fa2file(fa, fname){

    let blob = new Blob([fa], {type: {type: 'application/octet-stream'}});
    //writeBlobToFile(blob, fname);      
}


//

export async function  * getFilesRecursively(entry) {

    if (DEBUG)
        console.log('entry: ', entry); //
    if (entry.kind === "file") {
        const file = await entry.getFile();
        if (file !== null) {
            if (DEBUG)
                console.log('file: ', file); //
            //file.relativePath = getRelativePath(entry);
            yield file;
        }
    } else if (entry.kind === "directory") {
        if (DEBUG)
            console.log('directory: ', entry); //
        for await(const handle of entry.values()) {
            yield * getFilesRecursively(handle);
        }
    }
}

export async function listFiles(directoryHandle) {

    for await(const fileHandle of getFilesRecursively(directoryHandle)) {
        console.log(fileHandle);
    }
}


export function getThumbnailCanvas(srcCanvas, width) {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");   
    let height = Math.floor((width * srcCanvas.height) / srcCanvas.width);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(srcCanvas, 0, 0, width, height);
    return canvas;
}

export function getSquareThumbnailCanvas(srcCanvas, size) {

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");   
    
    if(srcCanvas.width >= srcCanvas.height){
        // image is wide 
        let destH = size;
        let destW = Math.floor(size*srcCanvas.width/srcCanvas.height);
        let destY = 0;
        let destX = -(destW - destH)/2;        
        ctx.drawImage(srcCanvas, destX, 0, destW, destH);
    } else {
        // image is tall
        let destH = Math.floor(size*srcCanvas.height/srcCanvas.width);
        let destW = size;
        let destX = 0;
        let destY = -(destH - destW)/2;
        ctx.drawImage(srcCanvas, 0, destY, destW, destH);

    }
    return canvas;
}

