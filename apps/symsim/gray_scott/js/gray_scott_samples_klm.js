
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

let gray_scott_samples_klm = [
    smp('par-24-08-27-17-54-06-720'),
    smp('par-24-08-27-17-03-38-963'),
    
];


export {
    gray_scott_samples_klm,
}

