
import {
  AnimatedPointer 
} from '../modules.js';

import {
    Chart, registerables, 
} from '../../extlib/chart.js.lib/chart.js';


//Chart.register(...registerables);

function test1(){

  let ap = AnimatedPointer({dragFrictionFactor: 2, springForce: 10, timeStep: 0.0005});
  
  ap.setMouse(10,20);
  ap.setDragState(true);
  let frameTime = 0.01;

  ap.setMouse(0,0);
  let endT = 10;
  let count = endT/frameTime;
  let tt = [];
  let x = [];
  let y = [];
  let data = [];
  
  for(let i = 0; i <= count; i++){
      let t = i*frameTime;
      ap.calculate(t);
     // console.log('t: ', t.toFixed(3), ' pos:', ap.getX().toFixed(3), ap.getY().toFixed(3));
      data.push({x: Number(t.toFixed(3)), y: Number(ap.getY().toFixed(3))});
      if(Math.abs(t - 0.5) < frameTime) {
        ap.setMouse(20,20);
      }

  }
  
    new Chart("myChart", {
      type: "scatter",
      data: {
        datasets: [{
          pointRadius: 2,
          pointBackgroundColor: "rgba(0,0,255,1)",
          data: data
        }]
      },
      options:{
         animation: false
      }
    });
  
  
}



function test2(){
    
const xyValues = [
  {x:50, y:7},
  {x:60, y:8},
  {x:70, y:8},
  {x:80, y:9},
  {x:90, y:9},
  {x:100, y:9},
  {x:110, y:10},
  {x:120, y:11},
  {x:130, y:14},
  {x:140, y:14},
  {x:150, y:15}
];

new Chart("myChart", {
  type: "line",
  data: {
    datasets: [{
      pointRadius: 4,
      pointBackgroundColor: "rgba(0,0,255,1)",
      data: xyValues
    }]
  },
  options:{
     animation: {
         duration: 0, 
     }         
  }
});

}


test1();
//test2();
