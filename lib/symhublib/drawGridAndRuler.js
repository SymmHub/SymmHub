import {
  getParam, 
  isDefined, 
  BoxTransform 
} from './modules.js';

const rulerMarksInterval = 8;
const RULER_FILL  = '#CCCCCC55';
const RULER_FONT_STYLE = '12px Helvetica';

const DEFAULT_RULER_WIDTH = 30;

function hp(x){
  return Math.floor(x) + 0.5;
}

const defaultCanvasTransform = BoxTransform(
                                     {
                                       wBox:{xmin:-1, xmax: 1, ymin: -1, ymax:1}, 
                                       sBox:{xmin:0, xmax: 1000, ymin: 1000, ymax:0}
                                     });
/**

  params {
    canvasTransform,
    hasGrid: true,
    hasRler: true,
  }
*/	    

export function drawGridAndRuler(context, canvas, params){

  const gridStroke = '#606060ff';
  const textFill = '#000000ff';
  const textStroke = '#000000ff';
  
  if(!isDefined(params)) params = {};
  let canvasTransform = params.canvasTransform;
  if(!isDefined(canvasTransform))
    canvasTransform = BoxTransform({wBox:{xmin:-1, xmax: 1, ymin: -1, ymax:1},sBox:{xmin:0, xmax:canvas.width,ymin:canvas.height,ymax:0}});

  let hasGrid = getParam(params.hasGrid, true);      
  let hasRuler = getParam(params.hasRuler, true);      

  let overlayWidth = canvas.width;
  let overlayHeight = canvas.height;
  let pixelRatio = (window.devicePixelRatio || 1);
  let rulerWidth = (hasRuler)? DEFAULT_RULER_WIDTH*pixelRatio: 0;
  let rulerMarkWidth = 2;

  let xRulerLength = overlayWidth-rulerWidth;
  let yRulerLength = overlayHeight-rulerWidth;
  let unitName = "";
  let rulerUnit = 1;//

  // calculate world coordinates of canvas 

  let canTrans = canvasTransform;
  let spt0 = [rulerWidth,canvas.height-rulerWidth];
  let spt1 = [canvas.width, 0];
  let wpt0 = [];
  let wpt1 = [];
        
  canTrans.invTransform(spt0, wpt0);
  canTrans.invTransform(spt1, wpt1);

  let rulerXmin = wpt0[0];
  let rulerYmin = wpt0[1];
  let rulerXmax = wpt1[0];
  let rulerYmax = wpt1[1];

  let markStepX = getMarkStep((rulerXmax - rulerXmin)/overlayWidth);
  let markStepY = getMarkStep((rulerYmax - rulerYmin)/overlayHeight);

  //console.log('markStep: ', markStep);
  let decimalDigitsX = getDecimalDigits(markStepX);
  let decimalDigitsY = getDecimalDigits(markStepY);


  let backgroundFill = RULER_FILL;
  let fontStyle = RULER_FONT_STYLE;

  // horizontal scale
  if(hasRuler){
    context.fillStyle = backgroundFill;
    context.fillRect(rulerWidth, overlayHeight-rulerWidth,xRulerLength,rulerWidth);
  }
  let tickSize1 = rulerWidth-2;

  let markLen0 = 1;
  let markLen1 = 0.5;
  let markLen2 = 0.25;

  if(hasRuler){ // draw unit name
    context.fillStyle = textFill;
    context.font = fontStyle;
    context.textAlign = 'center';
    context.fillText(unitName, rulerWidth/2, overlayHeight - 15);
  }

  let ct = new BoxTransform(
                    {
                      wBox: {xmin: rulerXmin, xmax:rulerXmax, ymin: 0, ymax: 1},  // worldBox
                      sBox: {xmin: rulerWidth, xmax:overlayWidth, ymin:overlayHeight, ymax:(overlayHeight-rulerWidth)} // screenBox
                    }
                  );
  let ctGrid = new BoxTransform(
                    {
                      wBox: {xmin: rulerXmin, xmax:rulerXmax, ymin: rulerYmin, ymax: rulerYmax},  // worldBox
                      sBox: {xmin: rulerWidth, xmax:overlayWidth, ymin:(overlayHeight-rulerWidth), ymax:0} // screenBox
                    }
                  );

  context.strokeStyle = gridStroke;
  context.fillStyle = textFill;

  context.lineWidth =
  context.lineCap = 'square';
  context.font = fontStyle;

  //
  // horizontal ruler 
  //      
  context.textAlign = 'left';

  let i0 = Math.ceil(rulerXmin/markStepX);
  let i1 = Math.floor(rulerXmax/markStepX);
  //console.log('i: ', i0, i1, markStepX);
  context.fillStyle = textFill;
  if(i0 > i1) {
    let ii = i0; 
    i0 = i1;
    i1 = ii;
  }
  for(let i = i0; i <= i1; i++){

    let drawNumber = false;
    let x = i*markStepX;
    let markWidth = rulerMarkWidth;

    let markLen = markLen2;
    if(((i|0) % 10) == 0) {
      markLen = markLen0;
      drawNumber = true;
    } else if(((i|0) % 5) == 0) {
      markWidth *= 0.5;
      markLen = markLen1;
    } else { //
      markWidth *= 0.25;
    }
    if(hasRuler){
      context.strokeStyle = gridStroke;
      context.fillStyle = gridStroke;
      // draw ruler marks
      let sp0 = ct.world2screen([x, 0]);
      let sp1 = ct.world2screen([x, markLen]);
      context.lineWidth = markWidth;
      context.beginPath();
      context.moveTo(hp(sp0[0]), hp(sp0[1]));
      context.lineTo(hp(sp1[0]), hp(sp1[1]));
      context.stroke();

      if(drawNumber){
        context.strokeStyle = textStroke;
        context.fillStyle = textFill;            
        context.fillText(x.toFixed(decimalDigitsX), sp1[0] + pixelRatio*5, sp1[1]+pixelRatio*15);
      }
    }
    // draw grid
    if(hasGrid){
      context.strokeStyle = gridStroke;
      context.fillStyle = gridStroke;
      context.lineWidth = markWidth/4;
      let sp0 = ctGrid.world2screen([x, rulerYmin]);
      let sp1 = ctGrid.world2screen([x, rulerYmax]);
      context.beginPath();
      context.moveTo(hp(sp0[0]), hp(sp0[1]));
      context.lineTo(hp(sp1[0]), hp(sp1[1]));
      context.stroke();
    }


  }

  //
  // vertical ruler
  //
  if(hasRuler) {
    context.fillStyle = backgroundFill;
    context.fillRect(0, 0, rulerWidth, overlayHeight-rulerWidth);
  }
  ct = new BoxTransform(
                    {
                      wBox: {ymin: rulerYmin, ymax:rulerYmax, xmin: 0, xmax: 1},  // worldBox
                      sBox: {xmin: 0, xmax:rulerWidth, ymin:(overlayHeight-rulerWidth), ymax:0} // screenBox
                    }
                  );

  let j0 = Math.ceil(rulerYmin/markStepY);
  let j1 = Math.floor(rulerYmax/markStepY);
  //console.log('j0:', j0, 'j1:', j1);

  context.fillStyle = textFill;
  if(j0 > j1) {
    let jj = j0; 
    j0 = j1;
    j1 = jj;
  }

  for(let j = j0; j <= j1; j++){

    let y  = (j)*markStepY;
    let drawNumber = false;

    let markWidth = rulerMarkWidth;
    let markLen = markLen2;
    if(((j|0) % 10) == 0) {
      // mark with numbers
      markLen = markLen0;
      drawNumber = true;
    } else if(((j|0) % 5) == 0) {
      markLen = markLen1;
      markWidth *= 0.5;
    } else {
      markWidth *= 0.25;
    }

    if(hasRuler){
      context.strokeStyle = gridStroke;
      context.fillStyle = gridStroke;

      let sp0 = ct.world2screen([0,y]);
      let sp1 = ct.world2screen([markLen,y]);

      context.lineWidth = markWidth;
      context.beginPath();
      context.moveTo(hp(sp0[0]), hp(sp0[1]));
      context.lineTo(hp(sp1[0]), hp(sp1[1]));
      context.stroke();

      if(drawNumber){
        context.strokeStyle = textStroke;
        context.fillStyle = textFill;

        context.save();
        let textX = sp0[0] + pixelRatio*25;
        let textY = sp0[1] - pixelRatio*5;
        context.translate(textX, textY);
        context.rotate(-Math.PI/2);
        context.fillText(y.toFixed(decimalDigitsY), 0,0);
        context.restore();
      }
    }

    if(hasGrid){
      context.strokeStyle = gridStroke;
      context.fillStyle = gridStroke;
      // draw grid
      context.lineWidth = markWidth/3;
      let sp0 = ctGrid.world2screen([rulerXmin, y]);
      let sp1 = ctGrid.world2screen([rulerXmax, y]);
      context.beginPath();
      context.moveTo(hp(sp0[0]), hp(sp0[1]));
      context.lineTo(hp(sp1[0]), hp(sp1[1]));
      context.stroke();
    }


  }
    
} // function drawGridAndRuler



function getDecimalDigits(markStep){
  
  let decimalDigits = 0;
  let majorMarkStep = 10*markStep;
  let majorPower = Math.floor(Math.log10(majorMarkStep));
  if(majorPower < 0)
    decimalDigits = -majorPower;
  
  return decimalDigits;
}


function getMarkStep(pixelSize){
  
  //console.log('xruler: ', rulerXmin, rulerXmax);
  //console.log('yruler: ', rulerYmin, rulerYmax);
  let minMarkStep = Math.abs(rulerMarksInterval*pixelSize);
  if(Math.abs(minMarkStep) <= 1.e-10)
    return 1;
  //console.log('minMarkStep: ', minMarkStep);

  let logscale = Math.floor(Math.log10(minMarkStep));
  //console.log('logscale: ', logscale);
  let scale = Math.pow(10, (logscale+1));
  //console.log('scale: ', scale);
  let fract = minMarkStep / scale;
  //console.log('fract: ', fract);
  let markStep = scale;
  //console.log('markStep: ', markStep);

  if(fract > 0.5){
    //do nothing
  } else if(fract >= 0.2) {
    markStep /= 2;
  } else {
    markStep /= 5;
  }
  
  return (markStep);
  
}