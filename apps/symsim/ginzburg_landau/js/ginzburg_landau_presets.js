export const GinzburgLandauPresets = {
  
  sets: [
        {
            params: {
                stepsCount : 4,
                alpha :  1.26,
                beta:    0.127,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.06,
                useHMetric: false,
            },
            name: "Preset 1"
        },
        {
            params: {
                stepsCount : 1,
                alpha :  0.3225,
                beta:    1.1,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.06,
                useHMetric: false,
            },
            name: "Preset 2"
        },
        {
            params: {
                stepsCount : 1,
                alpha :  0.3225,
                beta:    1.4,
                Da:      6.0,
                Db:      6.0,        
                timestep: 0.04,
                useHMetric: false,
            },
            name: "Preset 3 (chaos)"
        },
        {
            params: {
                stepsCount : 10,
                alpha :  1.3225,
                beta:    1.4,
                Da:      6.0,
                Db:      6.0,        
                timestep: 0.018,
                useHMetric: false,
            },
            name: "Preset 4 (chaos)"
        },
        {
            params: {
                stepsCount : 1,
                alpha :  0.84,
                beta:    0.84,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 5 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  1.15,
                beta:    0.1,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 6 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  1.35,
                beta:    0.15,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 8 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  1.53,
                beta:    0.2,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 7 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  0.913,
                beta:    0.05,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 8 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  1.702,
                beta:    0.25,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 9 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  2.21,
                beta:    0.4,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 10 (Critical)"
        },
        {
            params: {
                stepsCount : 700,
                alpha :  0.9092073886,
                beta:    0.0491485371,
                Da:      2.0,
                Db:      2.0,        
                timestep: 0.02,
                useHMetric: false,
            },
            name: "Preset 11 (Critical)"
        },
    
    
  ],
  
  getPlotData: getPresetsData,
  getBounds: getBounds,
   
};



function getPresetsData(){
    
    let presets = GinzburgLandauPresets;
    
    let data = [];
    let sets = presets.sets;
    for(let i = 0; i < sets.length; i++){
        let set = sets[i];
        let pp = set.params;
        data.push(pp.alpha);    
        data.push(pp.beta);
    }
    return data;
}

function getBounds(){
  return {xmin: 0.0, xmax: 1.5, ymin: 0.0, ymax: 1.5};
}

function initPresets(presets){
  
  let sets = presets.sets;
  let names = [];
  presets.names = names;
  for( let i = 0; i < sets.length; i++){
    let set = sets[i];
    presets[set.name] = set;
    names.push(set.name);
  }
}

// init the data 
initPresets(GinzburgLandauPresets);

