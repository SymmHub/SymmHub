import {
  sqrt, 
  clamp01,
  
  Colormaps, 
  getParam, 
} from "./modules.js";

//
//  calculates value for stable uniform solution 
//
function gs_uniformUV(feed,kill){
 
  let sqrt_F = sqrt(feed);
  
  let U = 1.0;
  let V = 0.0;
  if (kill < (sqrt_F - 2.0 * feed) / 2.0) {
    let A = sqrt_F / (feed + kill);
    U = (A - sqrt(A*A - 4.0)) / (2.0 * A);
    U = clamp01(U);
    V = sqrt_F * (A + sqrt(A*A - 4.0)) / 2.0;
    V = clamp01(V);
  } // else, (U,V) already set to (1,0)
  return [U, V];
}


function drawFDSampler (gl, blitMaker, program, canvasTransform, target, groupSampler, color) {
  
    if(target != null){      
      let {width, height} = target;    
      gl.viewport(0,0,width, height);
    }

    //console.log('drawFDSampler()');
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);        
        
    program.bind();
    
    program.setUniforms(canvasTransform.getUniforms({}));

        
    let fdu = {};
    fdu.u_groupData = groupSampler;
    fdu.u_fdColor = color;
    program.setUniforms(fdu);
    
    blitMaker.blit(target);

}


function drawSpot (gl, blitMaker, program, canvasTrans, target, color,  x, y,radius, blurWidth) {
  
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);        
        
    program.bind();
    
    let ctUni = canvasTrans.getUniforms({});
    //console.log('ctUni:', ctUni);
    program.setUniforms(ctUni);
    
    
    let spUni = {
      point: [x,y], 
      radius:radius, 
      blurWidth:blurWidth, 
      color:color
    };
    //console.log('spUni:', spUni);
    
    program.setUniforms(spUni); // splat uniforms 

    blitMaker.blit(target);
    
    //blitVP(gl,target); 

}

function drawGsBrush (gl, blitMaker, program, canvasTrans, target, srcBuffer, brushColor,  brushCenter, brushRadius, brushBlur) {
  
    gl.disable(gl.BLEND);        
        
    program.bind();
    
    let ctUni = canvasTrans.getUniforms({});
    program.setUniforms(ctUni);
        
    let brushUni = {
      brushCenter: brushCenter, 
      brushRadius : brushRadius, 
      brushBlur : brushBlur, 
      brushColor:brushColor,
      tSource: srcBuffer, 
    };
    
    //console.log('brushUni:', brushUni);
    program.setUniforms(brushUni); // brush uniforms 

    blitMaker.blit(target);
    
}

function drawGsSegment(gl, blitMaker, program, canvasTrans, target, srcBuffer, brushColor,  pointA, pointB, brushRadius, brushBlur) {
  
    gl.disable(gl.BLEND);        
        
    program.bind();
    
    let ctUni = canvasTrans.getUniforms({});
    program.setUniforms(ctUni);
        
    let brushUni = {
      pointA:      pointA, 
      pointB:      pointB, 
      thickness:   brushRadius, 
      blurValue:   brushBlur, 
      color:       brushColor,
      tSource:     srcBuffer, 
    };
    
    //console.log('drawGSSegment brushUni:', brushUni);
    program.setUniforms(brushUni); // brush uniforms 

    blitMaker.blit(target);
    
}

function drawGsDot(gl, blitMaker, program, canvasTrans, target, srcBuffer, brushColor,  pointA, brushRadius, brushBlur) {
  
    gl.disable(gl.BLEND);        
        
    program.bind();
    
    let ctUni = canvasTrans.getUniforms({});
    program.setUniforms(ctUni);
        
    let brushUni = {
      pointA:      pointA, 
      thickness:   brushRadius, 
      blurValue:   brushBlur, 
      color:       brushColor,
      tSource:     srcBuffer, 
    };
    
    console.log('drawGSDot:', pointA);
    program.setUniforms(brushUni); // brush uniforms 

    blitMaker.blit(target);
    
}


//
//  convert GS simulation into RGBA image 
//
function drawGrayScottImage(gl, blitMaker, program, target, simBuffer){
        
    program.bind();
    let {width, height} = target;
    
    gl.viewport(0,0,width, height);
  
    // map [-1,1] into [0,1] 
    let ctUni = { uAspect: (height/width), uScale: 0.5, uCenter: [0.5,0.5] };
    program.setUniforms(ctUni);

    let texUni = {uSimBuffer: simBuffer};
    program.setUniforms(texUni);
    
    blitMaker.blit(target);  
    
} // drawGrayScottImage()

//
//  convert GS simulation into RGBA image using custom colormap
//
function drawGrayScottImage2(gl, blitMaker, program, target, simBuffer, params){

    //console.log('drawGrayScottImage2()');
    program.bind();
    let {width, height} = target;
    
    gl.viewport(0,0,width, height);
  
    // map [-1,1] into [0,1] 
    let ctUni = { uAspect: (height/width), uScale: 0.5, uCenter: [0.5,0.5] };
    program.setUniforms(ctUni);

    let visualComponent = getParam(params.component, 1);
    let cmName = getParam(params.cm_name, 'red_green');    
    //let gradColors = Colormaps.getColormap(cmName); 
    let cmTex = Colormaps.getColormapTexture(gl, cmName); 
    
    let texUni = {
      uSimBuffer: simBuffer,
      uColormapTex: cmTex,
      //uColors: gradColors,
      uVisualComponent: visualComponent, 
      //uColorsCount: cmTex.gradColors.length/4,
    };

    program.setUniforms(texUni);
    
    blitMaker.blit(target);  
    
} // drawGrayScottImage2()

function drawTexture (gl, blitMaker, program, canvasTrans, target, params){

    //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    //gl.enable(gl.BLEND);        
    let texCenter = params.texCenter;
    let texScale = params.texScale;
    let texAlpha = params.texAlpha;
    let texture = params.texture;
        
    program.bind();
    
    let ctUni = canvasTrans.getUniforms({});

    program.setUniforms(ctUni);
        
    //console.log('ctUni:', ctUni);
    
    let texUni = {
      u_texScale: texScale,
      u_texCenter: texCenter, 
      u_texture: texture,
      u_texAlpha: texAlpha,
    };
    //console.log('texUni:', texUni);

    program.setUniforms(texUni);
    
    blitMaker.blit(target);  
} // drawTexture()



export {   
    gs_uniformUV, 
    drawFDSampler,
    drawGsDot,
    drawGsSegment,
    drawGsBrush,
    drawSpot,
    drawGrayScottImage2,
    drawGrayScottImage,
    drawTexture,
};