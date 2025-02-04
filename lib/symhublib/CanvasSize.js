const fitToWindow = {name:'Fit To Window'};
const customSize = {name:'Custom'};
const half_HD =   {name:'HD/2', width:960, height:540};
const full_HD =   {name:'HD', width:1920, height:1080};
const size_2800 = {name:'Galaxy S9+', width:2800, height:1752};
const size_4K =   {name:'4K', width:3840, height:2160};
const size_8K =   {name:'8K', width:7680, height:4320};
const size_256 =  {name:'[256 x 256]', width:256, height:256};
const size_512 =  {name:'[512 x 512]', width:512, height:512};
const size_1024 = {name:'[1024 x 1024]', width:1024, height:1024};
const size_2048 = {name:'[2048 x 2048]', width:2048, height:2048};
const size_4096 = {name:'[4096 x 4096]', width:4096, height:4096};
const size_8192 = {name:'[8192 x 8192]', width:8192, height:8192};


const canvases = [

  fitToWindow,
  customSize,
  half_HD,
  full_HD,
  size_2800,
  size_4K,
  size_8K,
  size_256,
  size_512,
  size_1024,
  size_2048,

  size_4096,  
];

let map = {};
let names = [];


init();


function init(){
  for(let k = 0; k < canvases.length; k++){
    let c = canvases[k];
    names.push(c.name);
    map[c.name] = c;
  }
}

function getCanvas(name){
    
    return map[name];
}

let CanvasSize = {
  getNames: ()=> {return names;},
  getCanvas: getCanvas,
  FIT_TO_WINDOW: fitToWindow,
  CUSTOM: customSize,
}

export {
  CanvasSize
}