
const FOLDER = 'presets/klmn/';

function smp(name){
    
    return {
        name: name,
        url:  FOLDER + name + '.json.png',
        data: {
            jsonUrl:  FOLDER + name + '.json', isSample: true,
        }
    }
}

let gray_scott_samples_klmn = [
    smp('par-24-08-29-16-45-44-031'),
    smp('par-24-08-31-08-21-17-048'),
    
];


export {
    gray_scott_samples_klmn,
}

