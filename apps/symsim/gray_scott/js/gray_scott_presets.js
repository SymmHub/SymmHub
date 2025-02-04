export const GrayScottPresets = {
  
  sets: [
    { feed: 0.062,    kill: 0.0609,   name: 'The U-Skate'}, // ClearUni brush (1,0)
    { feed: 0.0647,   kill: 0.0609,   name: 'The U-Skate (variable lengh)'}, // ClearUni brush (1,0)
    
    { feed: 0.18804,  kill: 0.02384,  name: 'Equilibrium 1'}, 
    { feed: 0.1337,   kill:  0.0454,  name: 'Equilibrium 2'},     
    { feed: 0.1,      kill: 0.05551,  name: 'Equilibrium 3'}, 
    { feed: 0.10041,  kill: 0.0559,   name: 'stable straight branches'}, 
    { feed: 0.09861,  kill: 0.0559,   name: 'Stable regions'},  // 2 stable line thicknesses, lines with bubble end 
    { feed: 0.09836,  kill: 0.0559,   name: 'Moving U-bands'},  // lines pushing bubbles 
    { feed: 0.098,    kill: 0.057,    name: 'Positive bubbles (rho)'}, 
    { feed: 0.098,    kill: 0.0559,   name: 'Stable Loops'}, // makes dirichlet domain 
    { feed: 0.098,    kill: 0.0555,   name: 'Negative bubbles (sigma)'}, 
    { feed: 0.098,    kill: 0.05606,  name: 'Stable loops and large areas'}, 
    { feed: 0.09,     kill: 0.058,    name: 'Equilibrioum 4'}, 

    { feed: 0.0841,   kill: 0.061,    name: 'Straight lines'},    

    { feed: 0.082,    kill: 0.0616,   name: 'Stable straight lines'}, 
    { feed: 0.082,    kill: 0.0615,   name: 'Straight lines and branches'},    
    { feed: 0.082,    kill: 0.061,    name: 'Circles'},    // clearUV 
    { feed: 0.082,    kill: 0.0606,   name: 'Stable loops'},    // clear 10 
    { feed: 0.082,    kill: 0.060,    name: 'Worms and loops (kappa)'},    
    { feed: 0.082,    kill: 0.0595,   name: 'Slow growing regions'}, // clear 10
    { feed: 0.082,    kill: 0.05917,  name: 'Unstable Voronoi Regions'}, // nice loops 
    { feed: 0.082,    kill: 0.059,    name: 'Precritical bubbles (loops)'}, // nice loops 
    { feed: 0.082,    kill: 0.05883,  name: 'Voronoi Regions'}, // clear 10

    
    { feed: 0.081,    kill: 0.061,    name: 'Moving loops with pushing lines'},
    { feed: 0.081,    kill: 0.06071,  name: 'Moving loops with pushing lines 2'},
    { feed: 0.081,    kill: 0.0608,   name: 'stable loops'},
    
    { feed: 0.080,    kill: 0.061,    name: 'Straight worms'},    // clearR - worms, clearUV - cells use step 1000 to see motion 

    { feed: 0.0798,   kill: 0.061,    name: 'Lines pushing loops'},   
    { feed: 0.078,    kill: 0.0609,   name: 'long bend loops'},    
    { feed: 0.078,    kill: 0.061,    name: 'Worms (unstable)'},    
    { feed: 0.077,    kill: 0.061,    name: 'Worms (unstable) 2'},        
    { feed: 0.075,    kill: 0.06,     name: 'straight worms and spots'},            
    { feed: 0.074,    kill: 0.064,    name: 'Stable solitons (nu)'}, 
    { feed: 0.069,    kill: 0.0607,   name: 'The U-Skate World 1'}, // ClearUni brush (1,0)
    { feed: 0.062,    kill: 0.0609,   name: 'The U-Skate World 2'}, // ClearUni brush (1,0)
    { feed: 0.061,    kill: 0.0624,   name: 'Lines making lines'}, // ClearUni brush (1,0)
    { feed: 0.061,    kill: 0.0614,   name: 'Lines making dots'}, // ClearUni brush (1,0)
    { feed: 0.058,    kill: 0.065,    name: 'Worms (mu)'}, 
    { feed: 0.054,    kill: 0.061,     name: 'straight worms and spots'},            

    { feed: 0.046,    kill: 0.0594,   name: 'Negatons (iota)'}, 
    
    { feed: 0.046,    kill: 0.063,    name: 'Worms join into maze (kappa)'},      
    { feed: 0.042,    kill: 0.059,    name: 'Turing patterns (delta)'}, 
    { feed: 0.039,    kill: 0.058,    name: 'Chaos to Turing negatons (beta)'},
    { feed: 0.037,    kill: 0.06,     name: 'Fingerprints (theta/kappa)'},
    { feed: 0.0353,   kill: 0.0566,   name: 'Chaos with negatons (beta/delta)'}, 
    { feed: 0.034,    kill: 0.057,    name: 'Holes and negative worms'},    
    { feed: 0.034,    kill: 0.061,    name: 'Long moving worms and few spots'},    
    { feed: 0.034,    kill: 0.06,     name: 'Long moving worms'},    // use step 1000 to see motion 
    { feed: 0.034,    kill: 0.0618,   name: 'Spots and worms (eta)'}, 
    { feed: 0.034,    kill: 0.056,    name: 'Chaos and holes'},    
    { feed: 0.030,    kill: 0.063,    name: 'Self-replicating spots (lambda)'},
    { feed: 0.030,    kill: 0.0565,   name: 'super resonant mases (theta)'  },
    { feed: 0.030,    kill: 0.062,    name: 'Solitons'},
    { feed: 0.029,    kill: 0.057,    name: 'Mazes'},    
    { feed: 0.026,    kill: 0.055,    name: 'Mazes with some chaos (gamma)'}, 
    { feed: 0.023662, kill: 0.055478, name: 'Mazes with more chaos'},     
    { feed: 0.026,    kill: 0.051,    name: 'Chaos'},    
    { feed: 0.0257,   kill: 0.0517,    name: 'Chaos 2 (with holes)'},    
    { feed: 0.0270,   kill: 0.051535,  name: 'Chaos 3'},    
    
    { feed: 0.0256,   kill: 0.0576,   name: 'pulsating spots and worms'},
    { feed: 0.025,    kill: 0.06,     name: 'Pulsating solitons *zeta)'},
    { feed: 0.0246,   kill: 0.0565,   name: 'Pulsating worms and spots'},
    { feed: 0.0246,   kill: 0.0559,   name: 'Pulsating worms'},
    { feed: 0.0246,   kill: 0.0544,   name: 'Pulsating maze'},
    { feed: 0.0246,   kill: 0.0552,   name: 'Pulsating maze to chaos'},
    { feed: 0.0246,   kill: 0.0564,   name: 'Pulsating maze to chaos 2'},
    { feed: 0.0246,   kill: 0.0579,   name: 'Pulsating spots to chaos 3'},
    { feed: 0.0246,   kill: 0.0626,   name: 'Stable spots on hex grid'},
    { feed: 0.023,    kill: 0.051,    name: 'Chaos on hex grid'},    
    { feed: 0.022,    kill: 0.059,    name: 'Warring microbes (epsilon)'}, 
    { feed: 0.022,    kill: 0.0499,   name: 'Regular holes and chaos'}, 
    { feed: 0.022,    kill: 0.0539,   name: 'Pulsating worms and spots 2'}, 
    { feed: 0.018,    kill: 0.051,    name: 'Spots and loops'},
    { feed: 0.018,    kill: 0.049,    name: 'Spots and loops 2'}, // clear uni
    { feed: 0.014,    kill: 0.054,    name: 'Moving spots (alpha)'},
    { feed: 0.014,    kill: 0.045,    name: 'Waves (xi)'},
    { feed: 0.016477, kill: 0.045654, name: 'Waves 1'},   // chaotic and permanent, start with init uniform
    { feed: 0.010047, kill: 0.034862, name: 'Waves 2'},    
    { feed: 0.003571, kill: 0.020782, name: 'Waves 2'},    
    { feed: 0.007025, kill: 0.019678, name: 'Wave 3'},    
    { feed: 0.007457, kill: 0.033896, name: 'Waves 4'},     // collapsing waves (start with Clear_uni,  draw line. Random drawing can make spiral waves 
    
  ],
  
  getPlotData: getPresetsData,
  getBounds: getBounds,
   
};



function getPresetsData(){
  
  let data = [];
  let sets = GrayScottPresets.sets;
  for(let i = 0; i < sets.length; i++){
    data.push(sets[i].kill);    
    data.push(sets[i].feed);
  }
  return data;
}

function getBounds(){
  return {xmin: -0.0, xmax: 0.08, ymin: -0.0, ymax: 0.16};
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
initPresets(GrayScottPresets);

