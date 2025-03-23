

import {
    makeTransformClassificationU4
} from './modules.js';

import {
    Group_KLMN
} from './modules.js';

const MYNAME = 'testTransformUtils';


const params = {
    "K": 3,
    "L": 2,
    "M": 2,
    "N": 2,
    "twist": 0,
    "aspect": 0.8000000000000003,
    "bend": 0,
    "uhp": false
};


function test1(){
    
    console.log(`${MYNAME}.test1()`);
    
    let groupMaker = new Group_KLMN();
    groupMaker.setParamsMap(params);
    
    let group = groupMaker.getGroup();
    
    console.log('group: ', group);
    
    let gens = group.getTransforms();
    
    console.log('gens: ', gens);
    
    let transClass = makeTransformClassificationU4(gens, {maxPeriod:10, maxCount:10});
    console.log('transClass: ', transClass);        
    
}


test1();