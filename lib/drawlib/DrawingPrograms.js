import {
    ShaderFragments as SF,
    DrawingShaders as DS,
    programBuilder,
} from './modules.js';

//
//  programs of PatternDrawing: the splat of a fold group and the pattern crown
//

const fragBaseVertex = {obj: SF, id: 'canvasVertexShader'};
const fragComplex    = {obj: SF, id: 'complex'};
const fragUtils      = {obj: SF, id: 'utils'};
const fragIsplane    = {obj: SF, id: 'isplane'};
const fragInversive  = {obj: SF, id: 'inversiveSampler'};
const fragSplat      = {obj: DS, id: 'drawingSplat'};
const fragCrown      = {obj: DS, id: 'drawingCrown'};

const splatProgram = {
    name: 'DrawingSplat',
    vs: {frags: [fragBaseVertex]},
    fs: {frags: [fragComplex, fragUtils, fragIsplane, fragInversive, fragSplat]},
};

const crownProgram = {
    name: 'DrawingCrown',
    vs: {frags: [fragBaseVertex]},
    fs: {frags: [fragComplex, fragUtils, fragIsplane, fragInversive, fragCrown]},
};

export const DrawingPrograms = programBuilder({
    'drawingSplat': splatProgram,
    'drawingCrown': crownProgram,
});
