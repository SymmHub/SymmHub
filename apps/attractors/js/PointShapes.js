
const ShapeNames = [
    'square', 
    'circle',
    'cap', 
    'gradient x',
    'gradient_y',
    'pyramid',
    'aa square',
];


export const PointShapes = {
    getDefault: ()=>'aa square',
    getIndex:   (e)=>ShapeNames.indexOf(e),
    getNames:   ()=> ShapeNames, 
}