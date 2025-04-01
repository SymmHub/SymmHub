import { complex}           from './complex.glsl.mjs';
import { fsMain }           from './fsMain.glsl.mjs';
import { generalGroupMain_v2 }      from './generalGroupMain_v2.glsl.mjs';
import { inversive }        from './inversive.glsl.mjs';
import { patternTextures }  from './patternTextures.glsl.mjs';
import { vertexShader }     from './vertexShader.glsl.mjs';

// new stuff
import { generalGroupMain_test} from './generalGroupMain_test.glsl.mjs';



const MyName = 'OrbifoldFragments';

const OrbifoldFragments = {
    name: MyName,
    getName: ()=>{return MyName;},

    complex,
    fsMain,
    generalGroupMain_v2,
    inversive,
    patternTextures,
    vertexShader,
// new pieces
    generalGroupMain_test
};


export {OrbifoldFragments};