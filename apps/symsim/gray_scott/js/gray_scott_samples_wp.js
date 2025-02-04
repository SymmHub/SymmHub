
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

let gray_scott_samples_wp = [
    smp('par-24-04-09-09-23-53-423'),
    smp('par-24-04-09-09-24-57-787'),
    smp('par-24-04-07-09-33-30-969'),
    smp('par-24-04-07-09-48-05-372'),
];


export {
    gray_scott_samples_wp,
}

