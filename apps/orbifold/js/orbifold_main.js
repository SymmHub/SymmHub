const FRAG_FOLDER = 'js/frag/';

import {
    Textures,
    DefaultDomainBuilder as DomainBuilder,
    PatternTextures,
    GroupRenderer,
    WallPaperGroup_General,
    SymmetryUIController,
    InversiveNavigator,
}
from './modules.js';


//import {
    //InversiveNavigator
//} from './InversiveNavigator_v1.js';
//} from './InversiveNavigator_v0.js';

import {
    OrbifoldFragments as OF, 
} from './shaders/modules.js';


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

const PRE_FOLDER = 'presets/';
const JSONpresets = [
    {
        name: '2223',
        path: PRE_FOLDER + '2223.json'
    },
    {
        name: '23x',
        path: PRE_FOLDER + '23x.json'
    },
    {
        name: '23xb',
        path: PRE_FOLDER + '23xb.json'
    },
    {
        name: '3333_b',
        path: PRE_FOLDER + '3333_b.json'
    }, {
        name: '3333_test',
        path: PRE_FOLDER + '3333_test.json'
    }, {
        name: '3333',
        path: PRE_FOLDER + '3333.json'
    }, {
        name: '32x',
        path: PRE_FOLDER + '32x.json'
    }, {
        name: 'xx2',
        path: PRE_FOLDER + 'xx2.json'
    }, {
        name: 'xo',
        path: PRE_FOLDER + 'xo.json'
    }, {
        name: '325',
        path: PRE_FOLDER + '325.json'
    }, {
        name: '326',
        path: PRE_FOLDER + '326.json'
    }, {
        name: '327',
        path: PRE_FOLDER + '327.json'
    }, {
        name: '327 a',
        path: PRE_FOLDER + '327_a.json'
    },
];

const MyTextures = Textures.t1.concat(Textures.t2);

const myPatternMaker = new PatternTextures({textures: [MyTextures, MyTextures, MyTextures]})


var myGroupHandler = new WallPaperGroup_General({
    symmetryUI:
    new SymmetryUIController({
        domainShowingQ: false,
        overlayCanvas: document.getElementById('overlay'),
        styles: STYLES,

    }),
    patternMaker:       myPatternMaker
})

//pattern maker needs to know about myGroupHandler too:

myPatternMaker['groupHandler']=myGroupHandler;

//////////////////////////
//
// ************* SOON

// const MyOverlays = OverlayTextures.t1.concat(OverlayTextures.t2);


// fragments to be used; OF is listed out in ./shaders/modules.js

// the bulk of uniforms are all delivered to GroupRenderer.js; 
// extra, unused uniforms just aren't passed into the shader.
// It's helpful to see what's not used in a given shader:
// Object.keys(program.uniforms)
// 

const fragComplex           = { obj: OF, id:'complex'};//unis:[]};
const fragFSMain            = { obj: OF, id:'fsMain'}; // unis: ["u_cScale", "u_pixelSize"]};//set programatically in 
//const fragGeneralGroupMain  = { obj: OF, id:'generalGroupMain_v2'}; //lots!
const fragInversive         = { obj: OF, id:'inversive'}; // unis:[]};
const fragPatternTextures   = { obj: OF, id:'patternTextures'};/*the buffers*/// unis: ["u_textures","u_texCount","u_texScales","u_texCenters","u_texAlphas"]}; // set in 
const fragVertexShader      = { obj: OF, id:'vertexShader'};//unis:["u_aspect","u_scale","u_center"]};//

const fragProjection        = { obj: OF, id:'projection'};//unis:["u_aspect","u_scale","u_center"]};//

const fragFDRenderer =    { obj: OF, id:'FDRenderer_v1'};
const fragPatternFromFDRenderer ={ obj: OF, id:'patternFromFDRenderer_v1'};




const vertexShader = {
    frags: [fragVertexShader],
};



/*const progSymRenderer = {
    name:   'SymRenderer', 
    vs:     vertexShader,
    fs: { 
        frags: [ 
            fragFSMain,
            fragInversive,
            fragComplex,
            fragPatternTextures,
            fragGeneralGroupMain,
            ]},
};
*/



const progFDRenderer = {
    name:   'FDRenderer', 
    vs:     vertexShader,
    fs: { 
        frags: [ 
            fragFSMain,
            fragInversive,
            fragComplex,
            fragPatternTextures,
            fragFDRenderer,
            ]},  
};

const progPatternFromFDRenderer = {
    name:   'patternFromFDRenderer', 
    vs:     vertexShader,
    fs: { 
        frags: [ 
            fragFSMain,
            fragInversive,
            fragComplex,
            fragPatternTextures,
            fragProjection, 
            fragPatternFromFDRenderer,
            ]},  
};


const orbPrograms = {
   // symRenderer: progSymRenderer,
    FDRenderer:             progFDRenderer,
    patternFromFDRenderer:  progPatternFromFDRenderer,
};

const myDomainBuilder = new DomainBuilder({

       // REF_DATA_SIZE is imported from DataPacking.js, should we need it.
        
        MAX_GEN_COUNT:       20, //
        MAX_TOTAL_REF_COUNT: 100, // the max size of the array passed into frag
        
        MAX_CROWN_COUNT:     20,
        MAX_TOTAL_CROWN_COUNT:100,
        USE_PACKING:        true,
      });
    


const myNavigator = new InversiveNavigator({useAnimatedPointer: true});

let myGroupRenderer = new GroupRenderer({
    // optional. use these to get custom canvas elements 
    //glCanvas:       document.getElementById('glCanvas'),
    //overlayCanvas:  document.getElementById('overlay'),
    //container:      document.getElementById('canvasContainer'),    
    groupMaker:         myGroupHandler,
    patternMaker:       myPatternMaker,
    domainBuilder:      myDomainBuilder, 
    navigator:          myNavigator,
    guiOrder:           ["group", "domain"],    
    programs:           orbPrograms,
    JSONpresets:        JSONpresets,
    JSONpreset:         JSONpresets[0].name,
    useParamGui:        false,
    useInternalWindows: true,
});


myGroupRenderer.init();

//  symmetryUI.init();
