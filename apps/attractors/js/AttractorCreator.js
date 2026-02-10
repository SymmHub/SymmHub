import {
    CliffordAttractor,
    DeJongAttractor, 
    ConradiAttractor, 
    FieldIconsAttractor,
    MandelbrotAttractor,
    TinkerbellAttractor,
} from './attractors.js';

import {
    ObjectsCreator
} from './modules.js';

const DEBUG = true;
const MYNAME = 'AttractorCreator';

const attInfo = [
    {name: 'Clifford', creator: CliffordAttractor},
    {name: 'DeJong', creator: DeJongAttractor},
    {name: 'Conradi', creator: ConradiAttractor},
    {name: 'Field Icons', creator: FieldIconsAttractor},
    {name: 'Mandelbrot', creator: MandelbrotAttractor},
    {name: 'Tinkerbell', creator: TinkerbellAttractor},
]
    
    
function AttractorCreator(){    
    return ObjectsCreator(attInfo);
}


export {
    AttractorCreator
}
