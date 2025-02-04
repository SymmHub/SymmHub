import {
    initFragments, 
    isDefined,
    iPoint,
    CanvasTransform,
    getBlitMaker,
    buildProgramsCached,
    readPixelsFromBuffer,
    fa2s,
    ShaderFragments as SF, 
    ParamFloat,
    ParamBool,
    ParamFunc,

} from './modules.js';

const MY_NAME = 'DrawingToolRenderer';

const fragBaseVertex       = {obj:SF,id:'canvasVertexShader'};
const fragSdf2d            = {obj:SF,id:'sdf2d'};
const fragUtils            = {obj:SF,id:'utils'};
const fragDrawDot          = {obj:SF,id:'drawDotShader'};
const fragDrawMultiDot     = {obj:SF,id:'drawMultiDotShader'};
const fragDrawSegment      = {obj:SF,id:'drawSegmentShader'};

const baseVertexShader = {
    frags: [fragBaseVertex],
};

const myFragments = [
    fragBaseVertex,
    fragSdf2d,
    fragUtils,
    fragDrawDot,
    fragDrawMultiDot,
    fragDrawSegment
    
];



const progDrawDot =  {
    name: 'DrawDot', vs:baseVertexShader, 
    fs:  {frags:[fragUtils, fragSdf2d, fragDrawDot]}
};

const progDrawMultiDot =  {
    name: 'DrawMultiDot', vs:baseVertexShader, 
    fs:  {frags:[fragUtils, fragSdf2d, fragDrawMultiDot]}
};

const progDrawSegment =  {
    name: 'DrawSegment', vs:baseVertexShader, 
    fs:  {frags:[fragUtils, fragSdf2d, fragDrawSegment]}
};

const myPrograms = [
    progDrawDot,
    progDrawMultiDot,
    progDrawSegment,    
];


let initialized = false;

//
// renderer interface to be used with DrawingToolHandler
//
function DrawingToolRenderer(options){

    const debug = false;
    const myName = 'DrawingToolRenderer';
    
    let mConfig = {
        brush: {
            symmetry: false,
            brushR: 1, 
            brushG: 0,
            brushB: 0,
            brushA: 1,
            brushRadius: 0.01,
            brushBlur: 0.5,   
            brushX:  0, 
            brushY:  0,
        },
    };     
    
    
    let mGL = null;
    let mSimulation = null;
    let mRepainter = null;
    //let mControllers = [];
    
    let mParams = makeParams();
    
    init(options);
    //
    // is called when renderer becomes active
    //
    function init(options){
        
        if(debug)console.log(`${myName}.init(${options})`);
        if(isDefined(options.gl))
            mGL = options.gl;
        if(!initialized) {
            initFragments(myFragments);
            buildProgramsCached(mGL, myPrograms);  
            initialized = true;
        }
        
        if(isDefined(options.simulation))
            mSimulation = options.simulation;
        if(isDefined(options.repainter))
            mRepainter = options.repainter;
        
    }
    
    // make UI params
    function makeParams(){
        
        let brush = mConfig.brush;
        return {
            symmetry: ParamBool({
                obj: brush,
                key: 'symmetry'
            }), 
            brushR: ParamFloat({
                        obj: brush,
                        key: 'brushR',
                        name: 'R'
                        }),
            brushG: ParamFloat({
                        obj: brush,
                        key: 'brushG',
                        name: 'G'
                        }),
            brushB: ParamFloat({
                        obj: brush,
                        key: 'brushB',
                        name: 'B'
                        }),
            brushA: ParamFloat({
                        obj: brush,
                        key: 'brushA',
                        name: 'A'
                        }),
            brushRadius: ParamFloat({
                        obj: brush,
                        key: 'brushRadius',
                        name: 'radius'
                        }),
            brushBlur: ParamFloat({
                        obj: brush,
                        key: 'brushBlur',
                        name: 'blur'
                        }),
            brushX: ParamFloat({
                        obj: brush,
                        key: 'brushX',
                        name: 'x'
                        }),
            brushY: ParamFloat({
                        obj: brush,
                        key: 'brushY',
                        name: 'y'
                        }),                                   
            drawDot: ParamFunc({
                name: 'Draw Dot',
                func: onDrawDot
            }),
            
        };
    } // makeParams()
    
  
    function scheduleRepaint(){
        if(isDefined(mRepainter))
            mRepainter.scheduleRepaint();
    }

 
 
    function onDrawDot(){
        
        if(debug)console.log(`${myName}.onDrawDot()`);
        let bc = mConfig.brush;
        drawDot([bc.brushX,bc.brushY]);
        
    }
    //
    //  draw dot into simulation buffer 
    //
    function drawDot(pnt){
        
        if(false)console.log(`${myName}.drawDot(${pnt})`);
        if(!isDefined(mSimulation)){
            console.error(`${myName}.drawDot(): mSimulation undefined, exiting`);
            return;
        }
        
        let buffer = mSimulation.getSimBuffer();
                    
        let transform = CanvasTransform({canvas:buffer}); // default transform [-1,1] -> [-1,1]

        mGL.viewport(0, 0, buffer.width, buffer.height);      

        let bc = mConfig.brush;
        let group = mSimulation.getGroup();
        if(bc.symmetry)
          pnt = pnt2fd(group, pnt);

        let brushColor = [bc.brushR,bc.brushG, bc.brushB, bc.brushA];
        let program = progDrawDot.program;
        let bm = getBlitMaker(mGL);
        
        renderDot (mGL,bm, program, transform, buffer.write, buffer.read, brushColor,  pnt, bc.brushRadius, bc.brushBlur);
        buffer.swap();
        if(mConfig.brush.symmetry){
            // array of ITransform
            //let gtrans = group.getTransforms();
            let gtrans = group.getReverseITransforms();            
            for(let i = 0; i < gtrans.length; i++){
                //console.log(`trans[${i}]:`,gtrans);
                let tipnt = gtrans[i].transform(iPoint(pnt));
                let tpnt = [tipnt.v[0],tipnt.v[1]];
                console.log(`tpnt:`,tpnt);                
                renderDot (mGL,bm, program, transform, buffer.write, buffer.read, brushColor,  tpnt, bc.brushRadius, bc.brushBlur);
                buffer.swap();
            }            
            mSimulation.applySymmetry();
        }
        scheduleRepaint();                 
        
    }

    function drawSegment(p, q){
        if(debug)console.log(`${myName}.drawSegment(${p},${q})`);
        //drawSegmentMultiDots(pnt0, pnt1);        
        drawSegment_v1(p,q);
        
    }

    //
    //  draw line segment into simulatipon buffer
    //
    function drawSegment_v1(pnt0, pnt1){

        let buffer = mSimulation.getSimBuffer();

        let transform = CanvasTransform({canvas:buffer}); // default transform [-1,1] -> [-1,1]

        mGL.viewport(0, 0, buffer.width, buffer.height);      

        let pnts = [pnt0,pnt1];
        if(mConfig.brush.symmetry)
          pnts = pnts2fd(mSimulation.getGroup(), [pnt0,pnt1]);

        let bc = mConfig.brush;
        
        let brushColor = [bc.brushR,bc.brushG, bc.brushB, bc.brushA];
        
        renderSegment (mGL, getBlitMaker(mGL), progDrawSegment.program, transform, buffer.write, buffer.read,brushColor, pnts[0],pnts[1],bc.brushRadius,bc.brushBlur);
        buffer.swap();
        
        if(mConfig.brush.symmetry)
            mSimulation.applySymmetry();

        scheduleRepaint();
        
    }
  
    
    //
    //  user wants to pick value at the given point 
    //  
    //   pnt is in simulation coordinates
    //
    function pickValue(pnt){        
        if(debug)console.log(`${myName}.pickValue(${pnt})`);        
              
        // map point to the fundamental domain 
        if(mConfig.brush.symmetry){
          pnt = pnt2fd(mSimulation.getGroup(), pnt);
        }
        let buffer = mSimulation.getSimBuffer();

        let texTrans = CanvasTransform({canvas:buffer}); // default transform [-1,1] -> [-1,1]

        // point in canvas coordinates 
        let cpnt = texTrans.transform(pnt, [0,0]);
        cpnt[0] = Math.round(cpnt[0]); 
        cpnt[1] = Math.round(buffer.height - 1 - cpnt[1]); // y-flip because canvas transform does the flip and webgl canvas does not. 
        let data  = getSimData(cpnt[0], cpnt[1]);
        console.log('pick: ', fa2s(cpnt,0), ' -> ',fa2s(data.slice(0,2), 4));
        
        mParams['brushR'].setValue(data[0]);
        mParams['brushG'].setValue(data[1]);
        mParams['brushB'].setValue(data[2]);
        mParams['brushA'].setValue(data[3]);
        
                 
    }

    //
    //  return simulation data at the given point 
    //
    //      
    function getSimData(x,y){

        let buffer = mSimulation.getSimBuffer();

        //gl.bindFramebuffer(gl.FRAMEBUFFER, gSimBuffer.write.fbo);
        // bind framefuffer to be used 
        mGL.bindFramebuffer(mGL.FRAMEBUFFER, buffer.read.fbo);
        let att = mGL.COLOR_ATTACHMENT0;      
        let ix = Math.round(x);
        let iy = Math.round(y);      
        return readPixelsFromBuffer(mGL, att,ix,iy,1,1);

    }

    function getParams(){
        return mParams;
    }

    //
    //  return public interface 
    //    
    return { 
        
        drawDot:     drawDot,
        drawSegment: drawSegment,
        pickValue:   pickValue,
        init:        init,
        getParams:  getParams
    };
  
} // function DrawingToolRenderer()


//
//   renderSegment(g)
//
function renderSegment(gl, blitMaker, program, canvasTrans, target, srcBuffer, brushColor,  pointA, pointB, brushRadius, brushBlur) {
  
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
    
    //console.log('drawSegment brushUni:', brushUni);
    program.setUniforms(brushUni); // brush uniforms 

    blitMaker.blit(target);
    
} //  drawSegment

//
//    renderDot(gl) 
//
function renderDot(gl, blitMaker, program, canvasTrans, target, srcBuffer, brushColor,  pointA, brushRadius, brushBlur) {
  
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
    
    if(false)console.log('renderDot:', pointA);
    program.setUniforms(brushUni); // brush uniforms 

    blitMaker.blit(target);
    
} // drawDot()

//
// transform array of points to fd using the transformation needed for first point
//
function pnts2fd(group, pnts){
    //if(true)console.log(`point in fd:`, res.pnt.v);    
    let ipnt = iPoint(pnts[0]);
    let res = group.toFundDomain({pnt: ipnt});
    let v = res.pnt.v;
    let trans = res.transform; // this is the transform found 
    // transform second point 
    let ipnt2 = trans.transform(iPoint(pnts[1]));
    let v2 = ipnt2.v;
    return [[v[0],v[1]],[v2[0],v2[1]]];
    
}

//
//  transform point into fundamental domain 
//
function pnt2fd(group, pnt){
    //if(true)console.log(`point in fd:`, res.pnt.v);    
    let ipnt = iPoint(pnt);
    let res = group.toFundDomain({pnt: ipnt});
    let v = res.pnt.v;
    return [v[0],v[1]];
}



export {
  DrawingToolRenderer
};
