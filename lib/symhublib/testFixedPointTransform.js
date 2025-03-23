
import {
    iPackTransforms, 
    iGetFactorizationU4,  
    iLerpU4,  
    iDrawCircle,  
    eDistance, 
    ITransform,
    iSphere,
    iPlane,
    iPoint,
    GroupUtils,
    //Group,
    splaneToString,
    U4toH4,
    getReflectionMatrixH4,
    getMatrixH4,
    analyzeTransformH4,
    iDistanceU4,
    makeTransformClassificationU4,
    TRANSFORM_TYPES,
    
    ParamChoice,
    ParamInt, 
    ParamBool, 
    ParamFloat, 
    ParamFunc,
    ParamGroup, 
    ParamObj,
    ParamColor,
    ParamString,
    ParamCustom,
    createParamUI,
    getParamValues,
    setParamValues,

    TreeNode, 
    createTreeView,
    createInternalWindow,

    PI,atan2, abs, sqrt, sin, cos, exp, isDefined,TORADIANS,

    cross, dot, add,eDistanceSquared,
    eLength, 
    normalize,
    orthogonalize,
    combineV, 
        
}
from './modules.js';


const EPSILON = 1.e-10;

function toStr(v){
    let s = '[';
    for(let i = 0; i < v.length; i++){
        s += v[i].toFixed(10);
        s += ' ';
    }
    s += ']';
    
    return s;
}


function test1(){

    console.log('test1()');

    let a0 = PI/3;
    let a1 = -PI/2;

    let r0 = 1., r1 = 1.;

    //let v0 = [r0*cos(a0), r0*sin(a0)];
    //let v1 = [r1*cos(a1), r1*sin(a1)];
    let v0 = [0.934172359, 0.3568220898];
    let v1 = [-0.3568220898, -0.934172359];
    let v3 = [0,1, 0.1];

    let tr = ITransform.getTransform_1_1(v0, v1);
    
    let p0 = iPoint([v0[0], v0[1], 0., 0]); 
    let p1 = iPoint([v1[0], v1[1], 0., 0]); 
    let p3 = iPoint([v3[0], v3[1], 0., 0]); 
    
    let tp0 = tr.transform(p0);
    let tp1 = tr.transform(p1);
    let tp3 = tr.transform(p3);
    
    console.log('p0: ', p0.toStr(8));
    console.log('p1: ', p1.toStr(8));
    console.log('p3: ', p3.toStr(8));
    console.log('tr: ', tr.toStr(8));    
    console.log('tp0: ', tp0.toStr(8));
    console.log('tp1: ', tp1.toStr(8));
    console.log('tp3: ', tp3.toStr(8));
        
}


test1();