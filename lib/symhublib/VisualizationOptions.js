
const dataSourceNames = ['u','v', 'mod(uv)', 'arg(uv)', 'abs(u)', 'abs(v)'];

const dataSourceValues = {
    'u': 0,
    'v': 1,
    'mod(uv)': 2,
    'arg(uv)': 3,
    'abs(u)': 4,
    'abs(v)': 5,    
};

const gridTypeNames = ['cartesian', 'polar'];

const gridTypeValues = {
    'cartesian': 0,
    'polar': 1,    
};
const VisualizationOptions = {
    gridTypeNames,
    gridTypeValues,
    dataSourceNames,
    dataSourceValues,
}


export {
    VisualizationOptions
}