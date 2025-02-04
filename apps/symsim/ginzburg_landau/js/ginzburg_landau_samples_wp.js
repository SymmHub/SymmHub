
const FOLDER = 'presets/wp/';

function smp(name){
    
    return {
        name: name,
        url:  FOLDER + name + '.json.png',
        data: {
            jsonUrl:  FOLDER + name + '.json', isSample: true,
        }
    }
}

let ginzburg_landau_samples_wp = [
    smp('par-24-07-16-14-42-11-186'),
    smp('par-24-07-16-14-42-54-991'),
    smp('par-24-07-16-14-44-36-539'),
];


export {
    ginzburg_landau_samples_wp,
}

