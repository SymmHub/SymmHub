const FRAG_FOLDER = 'js/frag/';

import {
    Textures,
    DefaultDomainBuilder as DomainBuilder,
    PatternTextures,
    GroupRenderer,
    WallPaperGroup_General,
    SymmetryUIController,
}
from './modules.js';

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

var grouphandler = new WallPaperGroup_General({
    symmetryUI:
    new SymmetryUIController({
        domainShowingQ: true,
        overlayCanvas: document.getElementById('overlay'),
        styles: STYLES
    })
})

const MyTextures = Textures.t1.concat(Textures.t2);


const fragComplex           = { obj: OF, id:'complex'};
const fragFSMain            = { obj: OF, id:'fsMain'};
const fragGeneralGroupMain  = { obj: OF, id:'generalGroupMain_v2'};
const fragInversive         = { obj: OF, id:'inversive'};
const fragPatternTextures   = { obj: OF, id:'patternTextures'};
const fragVertexShader      = { obj: OF, id:'vertexShader'};

const vertexShader = {
    frags: [fragVertexShader],
};


const progSymRenderer = {
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

const orbPrograms = [
    progSymRenderer,
];

const myDomainBuilder = new DomainBuilder({
        MAX_GEN_COUNT:       20,
        MAX_TOTAL_REF_COUNT: 30,
        USE_PACKING:        true
    });
    
    
const myPatternMaker = new PatternTextures({textures: [MyTextures, MyTextures, MyTextures]})


let render = new GroupRenderer({
    // optional. use these to get custom canvas elements 
    //glCanvas:       document.getElementById('glCanvas'),
    //overlayCanvas:  document.getElementById('overlay'),
    //container:      document.getElementById('canvasContainer'),    
    groupMaker:         grouphandler,
    patternMaker:       myPatternMaker,
    domainBuilder:      myDomainBuilder, 
    guiOrder:           ["group", "domain"],    
    programs:           orbPrograms,
    JSONpresets:        JSONpresets,
    JSONpreset:         JSONpresets[0].name,
    useParamGui:        false,
    useInternalWindows: true,
});

render.init();

//  symmetryUI.init();
