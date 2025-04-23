import { complex}           from './complex.glsl.mjs';
import { fsMain }           from './fsMain.glsl.mjs';
//import { generalGroupMain_v2 }      from './generalGroupMain_v2.glsl.mjs';
import { inversive }        from './inversive.glsl.mjs';
import { patternTextures }  from './patternTextures.glsl.mjs';
import { vertexShader }     from './vertexShader.glsl.mjs';

// new stuff
//import { FDPatternRenderer} from './FDRenderer.glsl.mjs';
import { FDRenderer} from './FDRenderer.glsl.mjs';
import { patternFromFDRenderer} from './patternFromFDRenderer.glsl.mjs';

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
    patternFromFDRenderer,
  //  generalGroupMain_tester
};


export {OrbifoldFragments};