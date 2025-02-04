import {
    isFunction,
    isDefined,
} from './modules.js';


const DEBUG = true;

//
//  return param map for generic object
// obj with obj.getStateParams defined are replaced with obj.getStateParams()
// generic object are deeply cloned 
//
export function getObjParamMap(obj){
    
    if(DEBUG)console.log('getObjParamMap:', obj, 'constructor: ', obj.constructor);
    if(obj instanceof Array){
        //TODO shall we clone array ? 
        return obj;
    }
    let out = {};
    for(var key in obj){
        let value = obj[key];
        if(value instanceof Object){
            if(DEBUG)console.log('key: ', key, 'OBJECT value: ', value, ); 
            // check if value is class object which has getClassParams 
            if(isFunction(value.getStateParams)){
                let cvalue = value.getStateParams();
                out[key] = cvalue;                
            } else {
                out[key] = getObjParamMap(value);
            }                
        } else {
            out[key] = value;
        }
    }
    return out;
    
}


//
//   return param map and class name of the object in the single obj
//   data.className - name of class 
//   data.map    - object of values of that class 
//
export function getClassParamMap(data){
    
    let className = data.className;
    let params = data.map;
    if(DEBUG)console.log('getClassParamMap:',className);
    let res = {};
    let outParams = {};
    
    res.className = className;
    res.params = getObjParamMap(params);
        
    return res;   
    
}

/**
    return params represented by given editors 
*/
function getObjParamsValues(editors){
    
    if(DEBUG)console.log('getObjParamsValues', editors);
    let out = {};
    for(var key in editors){
        
        let editor = editors[key];
        if(DEBUG)console.log(`key: '${key}' editor: `, editor);
            
        if(editor instanceof EditorGroup) {
            
           if(DEBUG)console.log('EditorGroup:', key);
           out[key] = getObjParamsValues(editor);
            
        } else if(editor instanceof ClassParameter) {
            
            if(DEBUG)console.log('ClassParameter:', key);
            out[key] = editor.object.getClassParamValue();
            
        } else if (isDefined(editor.object)){ // dat.gui controller 
            if(DEBUG)console.log('Controller editor', editor);
            // UI editor 
            let obj = editor.object;
            let prop = editor.property;
            out[key] = obj[prop];
            
        } else {
            
            console.warn('generic object: ', key, ' editors: ', editor);
            out[key] = getObjParamsValues(editor);
        }
    }
    return out;    
}

//
//   return single object representing values of all editors 
//   name - name to give obj.name
//   editors - UI editors 
//   values - object which represent JSON file of saved value 
//
export function getClassParamValues(className, editors){
    let obj = {};
    obj.className = className;
    obj.params = getObjParamsValues(editors);
    return obj;
}

export function setGroupParamValues(editors, values){
    
    if(DEBUG)console.log('setGroupParamValues()');
    
    for(let key in values){
        
        let value = values[key];
        let editor = editors[key];
        if(!isDefined(editor)) {
            console.warn('undefined editor for key: ', key);
        }
        if(DEBUG)console.log('key:', key, 'value:', value, 'editor:', editor);
        
        if(editor instanceof EditorGroup){
            
            if(DEBUG)console.log(`${key} -> EditorGroup: `);
            editor.setParamValue(value);
            //setGroupParamValues(editor, value);
            
        } else if(editor instanceof ClassParameter){            
        
            if(DEBUG)console.log(`${key} -> ClassParameter: `, editor);
            
            editor.setParamValue(value);
            
        } else if(isDefined(editor.object)){
            
            if(DEBUG)console.log(`${key} -> Control`);            
            let obj = editor.object;
            let prop = editor.property;
            obj[prop] = value;
            if(DEBUG)console.log(`${prop} => ${value}`);
            editor.updateDisplay();            
            if(isFunction(editor.__onChange))editor.__onChange();
            
        }
        
    }        
    
}

//
//  set parameters values for the class in the form 
//
// {className: name, params: {class parameters}}
//
export function setClassParamValues(editors, value){
    try {
        if(DEBUG){
            console.log('setClassParamValues()');
            console.log('  editors:', editors);
            console.log('  value:', value);
            console.log('  className: ', value.className);
        }
        
        let paramValue = value.params;
        
        if(DEBUG)console.log('  paramValues: ', paramValue);
        setGroupParamValues(editors, paramValue);
        
    } catch(ex){
        console.error('exception: ', ex);
    }
}


export class ClassParameter{
    
    constructor(obj){
        
        // class members     
        this.object = obj;
    }  
    
    setParamValue(value){
        this.object.setClassParamValue(value);
    }
}


//
//  represent group of parameters 
//
export class EditorGroup{
    
    setParamValue(value){
        setGroupParamValues(this, value);
    }
    
}