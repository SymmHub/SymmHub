const MAX_INT=1000000;

const DEBUG = false;

function isDefined(v){
    return (v !== undefined);
}

//
// parameter integer
//
function ParamInt(arg) {
    
    //let min = 0, max = 32000;
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    
    function createUI(gui){
        if(isDefined(arg.min) && isDefined(arg.max))
            control = gui.add(obj, key, arg.min, arg.max, 1);
        else 
            control = gui.add(obj, key, 0, MAX_INT,1);
        
        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
    }
    
    function getValue(){
        return obj[key];
    }

    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
} // ParamInt(arg)


//
// parameter float
//
function ParamFloat(arg) {
    
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    
    function createUI(gui){
        if(!isDefined(obj[key])){
            console.warn(`undefined property for key key: ${key}: ${obj[key]}`, 'in obj: ', obj);
            //return;
        } 
        if(isDefined(arg.min) && isDefined(arg.max) && isDefined(arg.step))
            control = gui.add(obj, key, arg.min, arg.max, arg.step);
        else 
            control = gui.add(obj, key);
        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
        
    }
    
    function getValue(){
        return obj[key];
    }
    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {        
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
}

//
// parameter choice
//
function ParamChoice(arg) {
    
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    let choice = arg.choice || [];
    
    function createUI(gui){
        
        control = gui.add(obj, key, choice);

        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
        
    }
    
    function getValue(){
        return obj[key];
    }
    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {        
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
}


//
// parameter color
//
function ParamColor(arg) {
    
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    
    function createUI(gui){
        
        control = gui.addColor(obj, key);

        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
        
    }
    
    function getValue(){
        return obj[key];
    }
    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {        
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
} // ParamColor


//
// parameter boolean 
//
function ParamBool(arg) {
    
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    
    function createUI(gui){
       control = gui.add(arg.obj, arg.key);
        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
    }
    function getValue(){
        return obj[key];
    }
    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
}

//
// parameter string
//
function ParamString(arg) {
    
    let control = null;
    let obj = arg.obj;
    let key = arg.key;
    if(!obj) {
        key = 'str';
        obj = {str : arg.value};
    }
        
    function createUI(gui){
       control = gui.add(obj, key);
        if(!!arg.listen)
            control.listen();
        if(!!arg.name)
            control.name(arg.name);
        if(!!arg.onChange)
            control.onChange(arg.onChange);
    }
    function getValue(){
        return obj[key];
    }
    function setValue(value){
        obj[key] = value;
        control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{control.updateDisplay();})
    }
}

//
// ParameterGroup - group of other parameters 
//
function ParamGroup(arg){
    
    let folder = null;
    arg = arg || {};
    let params = arg.params || {};
    let folderName = isDefined(arg.name)? arg.name: 'folder';
    
    let myself = {
        //params: params,  // this is private 
        setValue: setValue,
        getValue: getValue,        
        createUI: createUI,
    };
    
    
    // make individual parameters accessible via properties
    Object.assign(myself, params);
    
    function createUI(gui){
       folder = gui.addFolder(folderName);
       createParamUI(folder, params);
    }    
    function getValue(){
        return getParamValues(params);
    }
    
    function setValue(value){
        setParamValues(params, value);
    }

    
    return myself;
    
}

//
// ParamerObj - wrapper for arbitrary object which has its own methods to createUI and get/set values 
//
function ParamObj(arg) {
    
    let obj = arg.obj;
    let folderName = isDefined(arg.name)? arg.name: arg.obj.toString();
    let folder = null;
    let className = (isDefined(obj.getClassName))?  obj.getClassName(): folderName;
    
    function createUI(gui){
        
       folder = gui.addFolder(folderName);
       
       if(isDefined(obj.getParams)){
           
           let params = obj.getParams();
           createParamUI(folder, params);
           
       } else if(isDefined(obj.createUI)){
           
            obj.createUI(folder);
            console.warn(`${folderName}.getParams() is not defined `, obj);
            
       } else {
            console.warn(`${folderName}.createUI() or .getParams() is not defined `, obj);
       }
       
    }    
    
    function getValue(){
        
        if(isDefined(obj.getParams)){
            
          let params = obj.getParams();
          let value = getParamValues(params);
          return {className: className, params: value};
          
        } else if(isDefined(obj.getValue)){
            
            return obj.getValue();
            
        } else {
            console.warn('can\'t get param value of obj: ', obj);
            return {};
        }
    }

    function setValue(value){
        
        if(isDefined(obj.getParams)){
            
            let params = obj.getParams();
            setParamValues(params, value.params);
            
        } else if(isDefined(obj.setValue)){
            obj.setValue(value);
        } else {
            console.warn('obj.getParams() and obj.setValue() undefined: ', obj);
        }
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
    }       
} // ParamObj 

//
// parameter function call 
//
function ParamFunc(arg){
    
    let control = null;
    
    let fname = isDefined(arg.name)? arg.name: arg.func.name;
    
    function createUI(gui){
       control = gui.add({func: arg.func}, 'func').name(fname);
    }    
    return {
        setName:     (newName)=>{control.name(newName);},
        createUI: createUI,
    }
    
}

//
// parameter with custom data getter and setter 
//
function ParamCustom(arg){
    
        
    function getValue(){
        if(!!arg.getValue)
            return arg.getValue();
        else 
            return {};
    }
    
    function setValue(value){
        if(!!arg.setValue)
            return arg.setValue(value);
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
    }
    
}



//
//  recursively creates UI for the given UI parameters 
//
function createParamUI(gui, params){
    
    if(isDefined(params.createUI)){
        
        // params can create UI 
        params.createUI(gui);
        
    } else {
        // a bunch of params 
        let keys = Object.keys(params);
        
        for(let i = 0; i < keys.length; i++){
            let uipar = params[keys[i]];
            if(DEBUG)console.log(`uipar[${keys[i]}] = `, uipar);
            if(!!uipar.createUI) 
                uipar.createUI(gui);
        }    
    }
}


//
//   return JSON suitable representation of params represented by given params 
//
function getParamValues(params){
    
    if(DEBUG)console.log('getParamValues():', params);
    
    if(isDefined(params.getValue)){
        
        return params.getValue();
        
    } else {
        
        let out = {};
        for(var key in params){
            
            let param = params[key];
            if(DEBUG)console.log(`key: '${key}' param: `, param);
            if(isDefined(param.getValue)){
                out[key] = param.getValue();
            }
        }
        return out;    
    }       
}


//
//   set the params object to values supplied by given values
//
function setParamValues(params, values){
    
    if(true)console.log('setParamValues() params:', params);
    if(true)console.log('                 values:', values);
    if(isDefined(params.setValue)){
        if(DEBUG)console.log('setting individual values');        
        params.setValue(values);
    } else {
        if(DEBUG)console.log('setting individual values');
        for(var key in params){
            let param = params[key];            
            if(param.init){
                param.init();
            }
        }
        for(var key in values){
            //console.log('key: ', key);
            let param = params[key];
            if(isDefined(param)){
                if(DEBUG)console.log(`key: '${key}' param: `, param);            
                if(isDefined(param.setValue)){
                    if(DEBUG)console.log(`setValue(param.${key})`);  
                    param.setValue(values[key]);
                }
            }
        }    
    }
} 

function updateParamsDisplay(params){
    
    if(isDefined(params.updateDisplay)){
        params.updateDisplay(values);
    } else {
        for(var key in params){            
            let param = params[key];
            if(isDefined(param)){
                if(DEBUG)console.log(`key: '${key}' param: `, param);            
                if(isDefined(param.updateDisplay)){
                    if(DEBUG)console.log(`updateDisplay(param.${key})`);  
                    param.updateDisplay();
                }
            }
        }    
    }
    
}



export {
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
    updateParamsDisplay,
}