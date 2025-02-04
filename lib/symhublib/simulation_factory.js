import {
  isDefined
} from './modules.js';


/**
  factory return new simulations on request 
  */
function SimulationFactory(simulations){

  let simNames = [];
  let simMap = {};
  let defaultSim = simulations[0];
  let defaultName = defaultSim().getName();
  
  for(let i = 0; i < simulations.length; i++) {
    
    let name = simulations[i]().getName();
    simNames[i] = name
    simMap[name] = simulations[i];
  }
  
  function getSimulation(name){
    console.log(`getSimulation(${name})`);
    let sim = simMap[name];
    if(!isDefined(sim)){
      sim = defaultSim;
    }
    return sim();
  }
  return {
    getDefaultName: ()=>{ return defaultName},
    getNames:      ()=>{return simNames},
    getSimulation: getSimulation,
  }
}

export {SimulationFactory};
