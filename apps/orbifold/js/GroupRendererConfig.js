import {
    getParam,
    premultColor, 
    hexToRGBA, 
    isDefined
} from './modules.js';


const DEFAULT_DOMAIN_COLOR = '#FF000077';
const DEFAULT_LINE_COLOR = '#000000FF';
const DEFAULT_ERROR_COLOR = '#FF00AAFF';
const DEFAULT_GLBACKGROUND_COLOR = '#00000000';
const DEFAULT_BACKGROUND_COLOR = '#FFFFFF';
const DEFAULT_TILE_COLOR0 = '#FFAA00FF';
const DEFAULT_TILE_COLOR1 = '#00AAFFFF';

const colors = [
    '#800000FF', // maroon 
    '#FF0000FF',  // red 
    '#808000FF',  // olive 
    '#FFFF00FF',  // yellow
    '#008000FF',  // green 
    '#00FF00FF',  // lime
    '#008080FF',  // teal 
    '#00FFFFFF',  // aqua
    '#000080FF',  // navy 
    '#0000FFFF',  // blue
    '#800080FF',  // purple
    '#FF00FFFF',  // magenta
    '#FFA500FF',  // orange
    '#000000FF',  // black 
    '#808080FF',  // gray
    '#C0C0C0FF',  // silver
    '#FFFFFFFF',  // white 
    '#FFC0CBFF',  // pink 
];

function makeDefaultColors(count){
  
  var tc = [];
  for(let i = 0; i < count; i++){
    tc[i] = colors[i % colors.length];
  }
  return tc;
}

function packColors(hexColors){
  
  var ca = [];
  
  for(let i = 0; i < hexColors.length; i++){
    ca = ca.concat(premultColor(hexToRGBA(hexColors[i])));
  }
  return ca;
  
}

//const sampleparamdefault = 1;
// SAMPLEPARAM is a template for adding a controller. This could be 
// turned into its own class 



export class GroupRendererConfig {

    constructor(options){
      
      if(!isDefined(options))
        options = {};
      
      this.tileColorCount = getParam(options.tileColorCount, 2);
      
      this.params = {
        background:DEFAULT_BACKGROUND_COLOR,
        glBackground:DEFAULT_GLBACKGROUND_COLOR,

        //SAMPLEPARAM:getParam(options.SAMPLEPARAM,sampleparamdefault),

        whichTool:getParam(options.whichTool,'drag'),


        lines: true,
        debug:getParam(options.debug,false),
        iterations: 50,
        antialias: 1,
        //tileColors: makeDefaultColors(this.tileColorCount),
        lineColor:  DEFAULT_LINE_COLOR,
        errorColor:  DEFAULT_ERROR_COLOR,
        domainColor: DEFAULT_DOMAIN_COLOR,
        lineWidth: .3,
        maxlineWidth: 2,  
      };
  }

  /**
  
  */
  getParamsMap(){
    
    var p = this.params;
    
    return {
      background: p.background,
      glBackground: p.glBackground,
      lineColor: p.lineColor,
      errorColor: p.errorColor,
      domainColor: p.domainColor,
      lineWidth: p.lineWidth,
      maxlineWidth: p.maxlineWidth,
    //  tileColors: p.tileColors,
      lines:p.lines,
      iterations:p.iterations,

  //    SAMPLEPARAM:p.SAMPLEPARAM,

      whichTool:p.whichTool,
      
    };
  }

  /**
    set params from the map
  */
  setParamsMap(pm){
    
    var ctrl = this.controllers;
    ctrl.background.setValue(getParam(pm.background,DEFAULT_BACKGROUND_COLOR));
    ctrl.glBackground.setValue(getParam(pm.glBackground,DEFAULT_GLBACKGROUND_COLOR));
   /* if(isDefined(pm.tileColors)){
      //console.log('setting tile colors');
      for(let i = 0; i < pm.tileColors.length; i++){
        var tcc = ctrl.tileColors[i]; 
        var tc = pm.tileColors[i];
        //console.log('tc:',tc);
        if(isDefined(tc) && isDefined(ctrl.tileColors[i])){
          //console.log('setting tile colors');
          ctrl.tileColors[i].setValue(tc);
        }
      }
    }*/
    ctrl.lineColor.setValue(getParam(pm.lineColor,DEFAULT_LINE_COLOR));
    ctrl.errorColor.setValue(getParam(pm.errorColor,DEFAULT_ERROR_COLOR));
    ctrl.domainColor.setValue(getParam(pm.domainColor,DEFAULT_DOMAIN_COLOR));
    
    ctrl.lineWidth.setValue(getParam(pm.lineWidth,.3));
    ctrl.maxlineWidth.setValue(getParam(pm.maxlineWidth,2.));
    ctrl.lines.setValue(getParam(pm.lines, true));
    ctrl.iterations.setValue(getParam(pm.iterations, 50));

    //ctrl.SAMPLEPARAM.setValue(getParam(pm.SAMPLEPARAM, sampleparamdefault));
    
    ctrl.whichTool.setValue(getParam(pm.whichTool, 'draw'));
    

    
  }
  
  
  initGUI(options){
    
    //console.log("GroupRendererConfig.initGUI()");
    
    this.onChanged = options.onChanged;

    var gui = options.gui;
    var folder = options.folder;
    this.folder = folder;
    var onc = options.onChanged;
    var obc = this.onBackgroundChanged.bind(this);

    var minIncrement = 1.e-10;

    var par = this.params;
    
    //console.log("symmetry:%s", par.symmetry);
    this.controllers = {};
    
    var ctrl = this.controllers;
    
    //ctrl.SAMPLEPARAM = folder.add(par,'SAMPLEPARAM').name('SAMPLE').onChange(onc);
    
    ctrl.whichTool = folder.add(par,'whichTool',['draw','drag','flex']).name('tool').onChange(onc);
    

    ctrl.lines = folder.add(par, 'lines').name('Lines').onChange(onc);
    ctrl.lineWidth = folder.add(par, 'lineWidth', 0,100,minIncrement).name('Line Width').onChange(onc);
    ctrl.maxlineWidth = folder.add(par, 'maxlineWidth', 0,100,minIncrement).name('Max Line Width').onChange(onc);

    ctrl.iterations = folder.add(par, 'iterations', 0,1000,1).name('Iterations').onChange(onc);
    ctrl.debug      =  folder.add(par, 'debug').onChange(onc);
    

    // colors folder 
    let cfolder = folder.addFolder('Colors');    
    ctrl.background = cfolder.addColor(par, 'background').name('Page Bgrnd').onChange(obc);
    ctrl.glBackground = cfolder.addColor(par, 'glBackground').name('Tiling Bgrnd').onChange(onc);

    ctrl.lineColor = cfolder.addColor(par, 'lineColor').name('Line Color').onChange(onc);
    ctrl.errorColor = cfolder.addColor(par, 'errorColor').name('Error Color').onChange(onc);
    ctrl.domainColor = cfolder.addColor(par, 'domainColor').name('Domain Color').onChange(onc);

    // variable array of tile colors 
    // Commented out for now, but useful later.
   /* ctrl.tileColors = [];
    let tcs = par.tileColors;
    let tcf = cfolder.addFolder('Tile Colors');
    for(let i = 0; i < tcs.length; i++){
      ctrl.tileColors[i] = tcf.addColor(tcs, i).name('Color ' + i).onChange(onc);
    }
*/
    
    gui.remember(par);
    
  }
  
  onBackgroundChanged(){
    //console.log('background:%x',this.params.background);
    //var body = navigator.getDocument().querytSelector('body');
    document.body.style.backgroundColor = this.params.background;
  }
 
 
  getDefines(){
    
      return `#define TILE_COLOR_COUNT ${this.tileColorCount}\n`;
      
  }
  
  getUniforms(un){
    // uniforms to go to Config 
    var p = this.params;
    
    un.u_drawLines  = p.lines;
    un.u_iterations = p.iterations;
    un.u_lineWidth = p.lineWidth; 
    un.u_maxlineWidth = p.maxlineWidth;
    un.u_backgroundColor = premultColor(hexToRGBA(p.glBackground));
    //  un.u_tileColors = packColors(p.tileColors);
    un.u_lineColor = premultColor(hexToRGBA(p.lineColor));
    un.u_errorColor = premultColor(hexToRGBA(p.errorColor));
    un.u_domainColor = premultColor(hexToRGBA(p.domainColor));
    return un;
  }
}