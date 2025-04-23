
import {
  AnimatedPointer 
} from '../modules.js';

import {
    Chart, registerables, 
} from '../../extlib/chart.js.lib/chart.js';


//Chart.register(...registerables);

function test1(){

  let ap = AnimatedPointer({dragFrictionFactor: 2, springForce: 500, timeStep: 0.001});
  
  ap.setMouse(500,500);
  ap.setDragState(true);
  let frameTime = 1./60;

  ap.setMouse(550,300);
  ap.synchronize();
  let endT = 5;
  let count = endT/frameTime;
  let tt = [];
  let x = [];
  let y = [];
  let pointerData = [];
  let mouseData = [];
  
  for(let i = 0; i <= count; i++){
      let t = i*frameTime;
      ap.calculate(t);
     // console.log('t: ', t.toFixed(3), ' pos:', ap.getX().toFixed(3), ap.getY().toFixed(3));
      pointerData.push({x: Number(t.toFixed(3)), y: Number(ap.getY().toFixed(3))});      
      if((i % 5) == 0 && t < endT/2){
          let my = 200*(1-Math.cos(3.14*t));
          let mx = 400;
          ap.setMouse(mx,my);
          if(i == 0) ap.synchronize();
          
          mouseData.push({x: Number(t.toFixed(3)), y: Number(my.toFixed(3))}); 
      } 
      
      if( i > count/2) ap.setDragState(false);

  }
  
    new Chart("myChart", {
      type: "scatter",
      data: {
        datasets: [
        {
          pointRadius: 1,
          backgroundColor: "rgba(0,0,255,1)",
          label: 'Pointer',
          data: pointerData
        },
        
        {
          pointRadius: 4,
          backgroundColor: "rgba(255,200,1)",
          label: 'Mouse',
          data: mouseData
        } 
        ]
      },
      options:{
         animation: false
      }
    });
  
  
}


function test2(){

  //let ap = AnimatedPointer({dragFrictionFactor: 2, springForce: 10, timeStep: 0.0005});
  let ap = AnimatedPointer({dragFrictionFactor: 0.1, springForce: 10, timeStep: 0.001});
  
  ap.setMouse(0,0);
  ap.setDragState(true);
  let frameTime = 0.01;

  ap.setMouse(0,0);
  let endT = 20;
  let count = endT/frameTime;
  let tt = [];
  let x = [];
  let y = [];
  let pointerData = [];
  let mouseData = [];
  
  for(let i = 0; i <= count; i++){
      let t = i*frameTime;
      ap.calculate(t);
     // console.log('t: ', t.toFixed(3), ' pos:', ap.getX().toFixed(3), ap.getY().toFixed(3));
      pointerData.push({x: Number(ap.getX().toFixed(3)), y: Number(ap.getY().toFixed(3))});      
      if((i % 25) == 0){
          let my = 10*(Math.cos(0.9*Math.PI*t));
          let mx = 10*(Math.sin(1.1*Math.PI*t));
          ap.setMouse(mx,my);
          mouseData.push({x: Number(mx.toFixed(3)), y: Number(my.toFixed(3))}); 
      }

  }
  
    new Chart("myChart", {
      type: "scatter",
      data: {
        datasets: [
        {
          pointRadius: 1,
          backgroundColor: "rgba(0,0,255,1)",
          label: 'Pointer',
          data: pointerData
        },
        
        {
          pointRadius: 4,
          backgroundColor: "rgba(255,200,1)",
          label: 'Mouse',
          data: mouseData
        } 
        ]
      },
      options:{
         animation: false
      }
    });
  
  
}

import {
    mouseData,
    pointerData 
} from './testPointerData_2.js';


function test3(){
    

    new Chart("myChart", {
      type: "scatter",
      data: {
        datasets: [
        {
          pointRadius: 2,
          backgroundColor: "rgba(0,0,255,1)",
          label: 'Pointer',
          data: pointerData
        },
        
        {
          pointRadius: 4,
          backgroundColor: "rgba(255,200,1)",
          label: 'Mouse',
          data: mouseData
        } 
        ]
      },
      options:{
         animation: false
      }
    });
  
}


//test1();
//test2();
test3();

