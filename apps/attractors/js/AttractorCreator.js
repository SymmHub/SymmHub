import {
    CliffordAttractor,
    DeJongAttractor, 
    ConradiAttractor, 
    FieldIconsAttractor,
    MandelbrotAttractor,
    TinkerbellAttractor,
} from './attractors.js';

const DEBUG = true;
const MYNAME = 'AttractorCreator';


function AttractorCreator(){
    
    const names = ['Clifford', 'DeJong', 'Conradi', 'Field Icons', 'Mandelbrot', 'Tinkerbell'];
    const objects = {
        Clifford: CliffordAttractor, 
        DeJong: DeJongAttractor, 
        Conradi: ConradiAttractor, 
        'Field Icons': FieldIconsAttractor,
        Mandelbrot:    MandelbrotAttractor,
        Tinkerbell:    TinkerbellAttractor,
    }
    const defName = names[0];
    function getObject(name){
        console.log(`${MYNAME}.getObject()`, name);
        let obj = objects[name];
        if(!obj) {
            console.warn(`${MYNAME}.getObject(), ounknow name: ${name}, returning default: ${defName}`)
            obj = objects[defName];
        }
        let o = obj();
        console.log(`${MYNAME}.getObject() returning `, o);        
        return o;
    }
    
    return {
        getNames:       ()=>names,
        getObject:      getObject,
        getDefaultName: ()=>names[0],
    }
}


export {
    AttractorCreator
}
