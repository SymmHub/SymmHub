 const LIBRARYPATH = '../library/';

 import {
     Textures,
     DefaultDomainBuilder as DomainBuilder,
     PatternTextures,
     GroupRenderer,
     WallPaperGroup_General,
     SymmetryUIController,
 }
 from './modules.js';


 // if "active", overlay yellow and thicken.
 const STYLES = {
     "activeColor": {
         color: "#FFFF00",
         width: 12
     },
     "handle": {
         color: "#0000FF",
         width: 4
     },
     "cap": {
         color: "#8C0072",
         width: 4
     },
     "conePt": {
         color: "#AA00E1",
         width: 2
     }, //should'nt come up yet
     "conePair": {
         color: "#0000E1",
         width: 4
     },
     "tube": {
         color: "#EBAD00",
         width: 4
     },
     "mirror": {
         color: "#DB00FF",
         width: 4
     },
     "mirrorRedundant": {
         color: "#DB0000",
         width: 4
     },
     "cornerPair": {
         color: "#DB0000",
         width: 4
     },
     "fold": {
         color: "#DB0000",
         width: 4
     },
     "band": {
         color: "#EBAD00",
         width: 4
     },
     "slice": {
         color: "#EBAD00",
         width: 4
     },
     "cuttingEdge": {
         color: "#92C4DD",
         width: 2
     },
     "edge": {
         color: "#92C4DD",
         width: 4
     },

     "domainInterior": {
         color: ""
     }, //alphaGray
 }

 //////////////////////////////////////////////
 //////////////////////////////////////////////
 //////////////////////////////////////////////

 // GLOBALS

 var preFolder = 'presets/';
 var JSONpresets = [{
         name: '32x',
         path: preFolder + '32x.json'
     }, {
         name: 'xx2',
         path: preFolder + 'xx2.json'
     }, {
         name: 'xo',
         path: preFolder + 'xo.json'
     }, {
         name: '325',
         path: preFolder + '325.json'
     }, {
         name: '326',
         path: preFolder + '326.json'
     }, {
         name: '327',
         path: preFolder + '327.json'
     },
 ];

 var grouphandler = new WallPaperGroup_General({
     symmetryUI:
     new SymmetryUIController({
         domainShowingQ: true,
         overlayCanvas: document.getElementById('overlay'),
         styles: STYLES
     })
 })

 const maxgenCount = 20;

 var render = new GroupRenderer({
     glCanvas: document.getElementById('glCanvas'),
     overlayCanvas: document.getElementById('overlay'),
     groupMaker: grouphandler,
     patternMaker: new PatternTextures({
         textures: [Textures.t2, Textures.t1]
     }),
     domainBuilder: new DomainBuilder({
         MAX_GEN_COUNT: maxgenCount,
         MAX_TOTAL_REF_COUNT: 30,
         USE_PACKING: true
     }),
     guiOrder: ["group", "domain"],
     fragShader: [
         LIBRARYPATH + "frag/fsMain.frag",
         LIBRARYPATH + "frag/inversive.frag",
         LIBRARYPATH + "frag/complex.frag",
         LIBRARYPATH + "frag/patternTextures.frag",
         LIBRARYPATH + "frag/generalGroupMain_v2.frag"
     ],
     //vertShader:[]
     JSONpresets: JSONpresets,
     JSONpreset: "32x",
     useParamGui: true,
 });

 render.init();

 //  symmetryUI.init();
