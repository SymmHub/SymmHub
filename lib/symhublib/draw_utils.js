
function v2s(vec, precision){
  let s = "[";
  for(let i = 0; i < vec.length; i++){
    s += vec[i].toFixed(precision);
    if( i == vec.length-1)
      s += "]";
    else 
      s += ",";
  }
  
  return s;
       
}

/**


*/
export function drawGrid(context, canvas, canvasTransform, gridStepX, gridStepY, lineWidth, lineColor){

  let ct = canvasTransform;
  let spt0 = [0,canvas.height];
  let spt1 = [canvas.width, 0];
  let wpt0 = [];
  let wpt1 = [];
        
  ct.invTransform(spt0, wpt0);
  ct.invTransform(spt1, wpt1);
  let stepX = gridStepX;
  let stepY = gridStepY;
  
  let i0 = Math.floor(wpt0[0]/stepX);
  let i1 = Math.ceil(wpt1[0]/stepX);
  let j0 = Math.floor(wpt0[1]/stepY);
  let j1 = Math.ceil(wpt1[1]/stepY);
  
  let ymin = wpt0[1];
  let ymax = wpt1[1];
  let xmin = wpt0[0];
  let xmax = wpt1[0];
  
  context.strokeStyle = lineColor;
  context.lineWidth = lineWidth;
  
  context.beginPath();           
  for(let i = i0; i <= i1; i++){
    let wpnt0 = [i*stepX, ymin];
    let wpnt1 = [i*stepX, ymax];
    let spnt0 = [0,0];
    let spnt1 = [0,0];        
    ct.transform(wpnt0, spnt0);
    ct.transform(wpnt1, spnt1);
    
    context.moveTo(Math.floor(spnt0[0]), Math.floor(spnt0[1]));
    context.lineTo(Math.floor(spnt1[0]), Math.floor(spnt1[1]));        
  }
  context.stroke();      

  context.beginPath();           
  for(let j = j0; j <= j1; j++){
    let wpnt0 = [xmin, j*stepY];
    let wpnt1 = [xmax, j*stepY];
    let spnt0 = [0,0];
    let spnt1 = [0,0];        
    ct.transform(wpnt0, spnt0);
    ct.transform(wpnt1, spnt1);        
    context.moveTo(Math.floor(spnt0[0]), Math.floor(spnt0[1]));
    context.lineTo(Math.floor(spnt1[0]), Math.floor(spnt1[1]));        
  }
  context.stroke();      
        
} // drawGrid 


//
//
//
//
export function drawAxes(context, canvas, canvasTransform, lineWidth, lineColor){

  let ct = canvasTransform;
  let spt0 = [0,canvas.height];
  let spt1 = [canvas.width, 0];
  let wpt0 = [];
  let wpt1 = [];
        
  wpt0 = ct.invTransform(spt0, wpt0);
  wpt1 = ct.invTransform(spt1, wpt1);

  //console.log("drawAxes()",spt0, " -> ", v2s(wpt0,3), spt1, " -> ", v2s(wpt1,3));
  let ymin = wpt0[1];
  let ymax = wpt1[1];
  let xmin = wpt0[0];
  let xmax = wpt1[0];
  
  context.strokeStyle = lineColor;
  context.lineWidth = lineWidth;
  
  context.beginPath();           
  let wpnt0 = [0, ymin];
  let wpnt1 = [0, ymax];
  let spnt0 = [0,0];
  let spnt1 = [0,0];        
  ct.transform(wpnt0, spnt0);
  ct.transform(wpnt1, spnt1);
  
  context.moveTo(Math.floor(spnt0[0]), Math.floor(spnt0[1]));
  context.lineTo(Math.floor(spnt1[0]), Math.floor(spnt1[1]));        

  context.stroke();      

  context.beginPath();           
  wpnt0 = [xmin, 0];
  wpnt1 = [xmax, 0];
  ct.transform(wpnt0, spnt0);
  ct.transform(wpnt1, spnt1);        
  context.moveTo(Math.floor(spnt0[0]), Math.floor(spnt0[1]));
  context.lineTo(Math.floor(spnt1[0]), Math.floor(spnt1[1]));        
  
  context.stroke();      
        
} // drawAxes

