import { complex}           from './complex.glsl.mjs';
import { fsMain }           from './fsMain.glsl.mjs';
//import { generalGroupMain_v2 }      from './generalGroupMain_v2.glsl.mjs';
import { inversive }        from './inversive.glsl.mjs';
import { patternTextures }  from './patternTextures.glsl.mjs';
import { vertexShader }     from './vertexShader.glsl.mjs';

// new stuff
//import { FDPatternRenderer} from './FDRenderer.glsl.mjs';
import { FDRenderer}        from './FDRenderer.glsl.mjs';
import { FDRenderer_v1}     from './FDRenderer_v1.glsl.mjs';
import { patternFromFDRenderer} from './patternFromFDRenderer.glsl.mjs';
import { patternFromFDRenderer_v1} from './patternFromFDRenderer_v1.glsl.mjs';

// And then add the fragments to the list for export:
const MyName = 'OrbifoldFragments';

const OrbifoldFragments = {
    name: MyName,
    getName: ()=>{return MyName;},

    complex,
    fsMain,
 //   generalGroupMain_v2,
    inversive,
    patternTextures,
    vertexShader,
// new pieces -- only include working ones!
    FDRenderer,
    FDRenderer_v1,
    patternFromFDRenderer,
    patternFromFDRenderer_v1, 
  //  generalGroupMain_tester
};


export {OrbifoldFragments};