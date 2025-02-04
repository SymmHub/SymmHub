
const FOLDER = 'presets/klm/';

function smp(name){
    
    return {
        name: name,
        url:  FOLDER + name + '.json.png',
        data: {
            jsonUrl:  FOLDER + name + '.json', isSample: true,
        }
    }
}

let ginzburg_landau_samples_klm = [
    smp('par-24-08-27-13-26-24-551'),
    smp('par-24-08-27-16-34-08-987'),
];


export {
    ginzburg_landau_samples_klm,
}

