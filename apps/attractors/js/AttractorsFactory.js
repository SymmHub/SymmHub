import {
    CliffordAttractor,
    DeJongAttractor, 
    ConradiAttractor, 
    FieldIconsAttractor,
    MandelbrotAttractor,
    TinkerbellAttractor,
} from './attractors.js';

import {
    ObjectFactory
} from './modules.js';

const MYNAME = 'AttractorsFactory';

const attInfo = [
    {name: 'Clifford',  creator: CliffordAttractor},
    {name: 'DeJong',    creator: DeJongAttractor},
    {name: 'Conradi',   creator: ConradiAttractor},
    {name: 'Field Icons', creator: FieldIconsAttractor},
    {name: 'Mandelbrot', creator: MandelbrotAttractor},
    {name: 'Tinkerbell', creator: TinkerbellAttractor},
]
    
    
function AttractorsFactory(){    
    return ObjectFactory({infoArray: attInfo, defaultName: 'Clifford'});
}


export {
    AttractorsFactory
}
