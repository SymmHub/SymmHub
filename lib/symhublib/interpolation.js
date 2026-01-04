

const INTERP_LINEAR = 'linear';
const INTERP_QUADRATIC = 'biquadratic';
const INTERP_BOX = 'box';

const InterpolationNames = [
    INTERP_LINEAR,
    INTERP_QUADRATIC,
    INTERP_BOX,
];


function getInterpolationId(name){
    return InterpolationNames.indexOf(name);
}

export {
    InterpolationNames,
    getInterpolationId
};
