
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

let ginzburg_landau_samples_klmn = [
    smp('par-24-09-01-11-27-10-217'),
    smp('par-24-09-01-11-33-01-798'),
    smp('par-24-09-01-11-34-41-759'),
    smp('par-24-09-01-11-35-46-144'),
    smp('par-24-09-01-11-38-31-978'),
    smp('par-24-09-01-11-42-12-076'),
    smp('par-24-09-01-16-36-33-937'),
    smp('par-24-09-02-08-00-54-635'),
    smp('par-24-09-02-08-01-07-369'),
    smp('par-24-09-02-08-03-53-897'),
    smp('par-24-09-02-08-49-32-768'),
    
];


export {
    ginzburg_landau_samples_klmn,
}

