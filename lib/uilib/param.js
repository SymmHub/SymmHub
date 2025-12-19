const MAX_INT = Number.MAX_SAFE_INTEGER;

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
        if(control)control.updateDisplay();
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{if(control)control.updateDisplay();})
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
        if(control)control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {        
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{if(control)control.updateDisplay();})
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
    let serializable = (isDefined(arg.serializable))? arg.serializable : true;
    
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
        if(serializable){
            obj[key] = value;
            control.updateDisplay();
            if(!!arg.onChange)arg.onChange();
        }
    }
    return {        
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{if(control)control.updateDisplay();})
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
        updateDisplay:  (()=>{if(control)control.updateDisplay();})
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
        if(control)control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{ if(control){obj[key] = control.initialValue; control.updateDisplay();}},
        updateDisplay:  (()=>{if(control)control.updateDisplay();})
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
        if(control) control.updateDisplay();
        if(!!arg.onChange)arg.onChange();
    }
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     ()=>{obj[key] = control.initialValue; control.updateDisplay();},
        updateDisplay:  (()=>{if(control) control.updateDisplay();})
    }
}

//
// ParamGroup - group of other parameters 
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
        init:     init,
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
    
    function setValue(value, initialize=false){
        setParamValues(params, value,initialize);
    }

    function init(value){
        initParamValues(params);
        updateParamDisplay(params);            
    }


    
    return myself;
    
} // ParamGroup

//
// ParamerObj - wrapper for arbitrary object which has its own methods to createUI and get/set values 
//
function ParamObj(arg) {
    
    let obj = arg.obj;
    let folderName = isDefined(arg.name)? arg.name: arg.obj.toString();
    let folder = null;
    let className = (isDefined(obj.getClassName))?  obj.getClassName(): null;
    
    function createUI(gui){
        
       folder = gui.addFolder(folderName);
       
       if(isDefined(obj.getParams)){
           
           let params = obj.getParams();
           createParamUI(folder, params);
           
       } else if(isDefined(obj.createUI)){
           
           // custom method            
            obj.createUI(folder);
            
       } else if(isDefined(obj.initGUI)){
           // legacy method 
            obj.initGUI({folder:folder});
            
       } else {
            console.warn(`${folderName}.createUI() or .getParams() is not defined `, obj);
       }
       
    }    
    
    function getValue(){
        
        if(isDefined(obj.getParams)){
            
            let params = obj.getParams();
            let value = getParamValues(params);
            if(className) {
                return {className: className, params: value};
            } else {
                // object without className 
              return value;
            }
          
            } else if(isDefined(obj.getValue)){
            
                return obj.getValue();
            } else if(isDefined(obj.getParamsMap)) {
                return {
                    className: className,
                    params: obj.getParamsMap()
                }
            } else {
                console.warn('can\'t get param value of obj: ', obj);
                return {};
            }
    }

    function setValue(value, initialize=false){
        
        if(obj.setParamsMap){       
            // legacy call first for objects with custom (or old) interface
            if(value.params)
                obj.setParamsMap(value.params, initialize);
            else 
                obj.setParamsMap(value, initialize);
            
        } else if(isDefined(obj.getParams)){
            
            let params = obj.getParams();
            if(value.className && value.params) {
                // object with className and params 
                setParamValues(params, value.params,initialize);
            } else {
                setParamValues(params, value, initialize);
            }            
        } else if(isDefined(obj.setValue)){
            
            obj.setValue(value,initialize);
            
        } else {
            console.warn('obj.getParams() and obj.setValue() undefined: ', obj);
        }
    }
    
    function init(){
        
        if(isDefined(obj.getParams)){            
            let params = obj.getParams();
            initParamValues(params);
            updateParamDisplay(params);            
        } 
        
    }
    
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     init,
        
    }       
} // ParamObj 

//
// ParamFunc - parameter function call 
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

// ParamCustom
//
// parameter with custom bahavior
// arg.getValue
// arg.setValue
// arg.createUI  
// arg.updateDisplay
// arg.init 
//
function ParamCustom(arg){
    
    let _getValue = arg.getValue;
    let _setValue = arg.setValue;
    let _createUI = arg.createUI;
    let _updateDisplay = arg.updateDisplay;
    let _init = arg.init;
        
    function getValue(){
        if(!!_getValue)
            return _getValue();
        else 
            return {};
    }
    
    function setValue(value){
        if(!!_setValue)
            return _setValue(value);
    }

    function createUI(gui){
        if(!!_createUI)
            return _createUI(gui);
    }
    
    function updateDisplay(){
        
        if(!!_updateDisplay)
            _updateDisplay();
    }

    function init(){
        
        if(!!_init)
            _init();
    }
    
    
    return {
        
        setValue: setValue,
        getValue: getValue,
        createUI: (_createUI)? undefined: createUI,
        init:     (_init)? undefined: init,
        updateDisplay: updateDisplay,
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
//   initialize all values if necessary
//
function setParamValues(params, values, initialize=false){
    
    if(DEBUG)console.log('setParamValues() params:', params);
    if(DEBUG)console.log('                 values:', values);
    
    if(isDefined(params.setValue)){
        
        if(DEBUG)console.log('calling params.setValue()');        
        params.setValue(values, initialize);
    } else {
        if(DEBUG)console.log('setting individual values');
        if(initialize){
            // iterate over parameters 
            if(DEBUG)console.log('initializing params');
            for(var key in params){
                let param = params[key];            
                if(param.init){
                    param.init();
                }
            }
        }
        
        // iterate over values 
        
        if(DEBUG)console.log('  setting individual param values');
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

//
//  call init() for each param in params object
//
function initParamValues(params){
    
    if(isDefined(params.init)){
        params.init();
    } else {
        for(var key in params){            
            let param = params[key];
            if(isDefined(param)){
                if(DEBUG)console.log(`key: '${key}' param: `, param);            
                if(isDefined(param.init)){
                    if(DEBUG)console.log(`param.${key}.init()`);  
                    param.init();
                }
            }
        }    
    }
    
}


function updateParamDisplay(params){
    
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
    initParamValues,
    updateParamDisplay,
}