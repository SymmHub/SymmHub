const MAX_INT = Number.MAX_SAFE_INTEGER;

const DEBUG = false;
const MYNAME='PARAMS';

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
    let className = (obj.getClassName)?  obj.getClassName(): null;
    
    function createUI(gui){
        
       if(!folder) {           
           // create folder if null 
           folder = gui.addFolder(folderName);  
       }
       createObjUI(folder, obj);
    }   
    
    function createObjUI(folder, obj){
            
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
            // call first for objects with custom interface
            if(value.params)
                obj.setParamsMap(value.params, initialize);
            else 
                obj.setParamsMap(value, initialize);
            
        } else if(isDefined(obj.getParams)){
            
            let params = obj.getParams();
            // if(value.className && value.params) { // why we need className ? 
            if(value.params) {
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
    
    function removeControllers(){
        
        let cont = folder.__controllers;
        console.log('       controllers: ', cont);
        for(let i = cont.length-1; i >=0; i--)
            cont[i].remove();
    }
    
    function replaceObj(newObj){
        if(DEBUG)console.log(`${MYNAME} ParamObj replacing `, obj, ' to ',  newObj);
        removeControllers();
        obj = newObj;
        className = (obj.getClassName)?  obj.getClassName(): null;
        createObjUI(folder, obj);
        
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     init,
        replaceObj:  replaceObj,
        
    }       
} // ParamObj 

//
// ParamObjArray - param wrapper for an ObjArray stored at obj[key].
//
// arg (mandatory):
//   obj      : object that holds an ObjArray at obj[key].
//   key      : property name on obj whose value is an ObjArray instance.
//
// arg (optional):
//   name     : folder display name. Defaults to key.
//   onChange : callback invoked after setValue().
//   factory  : ObjectFactory — used to recreate child objects by className.
//   createUI : function(gui, items) — overrides the default folder-per-item UI.
//   getValue : override for the entire getValue().
//   setValue : override for the entire setValue(value).
//
// Default getValue(): [{name, value}, ...] serialized from each child Obj.
// Default setValue(): matches entries by name and restores each child.
//
function ParamObjArray(arg) {

    const mObjArray = arg.obj[arg.key];      // mandatory: must be an ObjArray
    const mItems    = mObjArray.getChildren().map((child, i) => ({
        name: child.getId ? child.getId() : i,
        obj:  child,
    }));
    const mName     = isDefined(arg.name) ? arg.name : arg.key;
    const mOnChange = arg.onChange || null;
    const mFactory  = arg.factory  || null;


    const mCreateUICallback = arg.createUI  || null;
    const mGetValueOverride = arg.getValue  || null;
    const mSetValueOverride = arg.setValue  || null;


    // ── wrap each child in a ParamObj for UI management ──────────────────────

    // Each entry: { name, paramObj }
    const mParamObjs = mItems.map(({ name, obj }) => ({
        name,
        paramObj: ParamObj({ name, obj }),
    }));

    // ── UI ────────────────────────────────────────────────────────────────────

    function createUI(gui) {
        if (mCreateUICallback) {
            mCreateUICallback(gui, mItems);
            return;
        }
        const folder = gui.addFolder(mName);
        mParamObjs.forEach(({ paramObj }) => {
            paramObj.createUI(folder);   // ParamObj creates its own named subfolder
        });
    }

    // ── serialization — delegate to ObjArray, with factory-aware child swap ───

    function getValue() {
        if (mGetValueOverride) return mGetValueOverride();
        return mObjArray.getValue();
    }

    function setValue(value, initialize = false) {
        if (mSetValueOverride) { mSetValueOverride(value, initialize); return; }

        // Unwrap the ObjArray serialized format to get the children array.
        let childArray = value;
        if (value && value.className === 'ObjArray' && value.params) {
            childArray = value.params.children;
        }
        if (!Array.isArray(childArray)) {
            console.warn('ParamObjArray.setValue(): unexpected value format:', value);
            mObjArray.setValue(value, initialize);
            if (mOnChange) mOnChange();
            return;
        }

        // Apply each child value positionally.
        mParamObjs.forEach((item, i) => {
            if (i >= childArray.length) return;
            const childValue = childArray[i];

            // If a factory is available and className has changed, replace the obj.
            if (mFactory && childValue && childValue.className) {
                const currentObj   = mItems[i].obj;
                const currentClass = currentObj.getClassName ? currentObj.getClassName() : null;
                if (currentClass !== childValue.className) {
                    const newObj = mFactory.getObject(childValue.className);
                    if (newObj) {
                        item.paramObj.replaceObj(newObj);
                        mItems[i].obj = newObj;
                    }
                }
            }

            // Restore the values into the (possibly replaced) obj.
            item.paramObj.setValue(childValue, initialize);
        });

        if (mOnChange) mOnChange();
    }

    // ── init / inspection ─────────────────────────────────────────────────────

    function init() {
        mParamObjs.forEach(({ paramObj }) => paramObj.init());
    }

    function getItems() { return mItems.slice(); }

    return { createUI, getValue, setValue, init, getItems };

} // ParamObjArray()


//
// Obj  — a named wrapper that gives any object a stable getId().
//
// arg:
//   id  : string — the identifier for this object.
//   obj : the underlying object. Should expose at least one of:
//         getParams() | getValue()/setValue() | createUI() | initGUI()
//
function Obj(arg) {

    const mId  = arg.id;
    const mObj = arg.obj;

    const result = {
        getId: () => mId,
    };

    // Delegate the full param-object interface to mObj.
    if (isDefined(mObj.getParams))  result.getParams  = ()    => mObj.getParams();
    if (isDefined(mObj.getValue))   result.getValue   = ()    => mObj.getValue();
    if (isDefined(mObj.setValue))   result.setValue   = (v,i) => mObj.setValue(v, i);
    if (isDefined(mObj.createUI))   result.createUI   = (gui) => mObj.createUI(gui);
    if (isDefined(mObj.initGUI))    result.initGUI    = (opts)=> mObj.initGUI(opts);
    if (isDefined(mObj.getClassName)) result.getClassName = () => mObj.getClassName();

    return result;

} // Obj()

//
// ObjArray — an ordered, named collection of Obj children.
//
// arg:
//   id       : string — id of this ObjArray itself.
//   children : Obj[]  — ordered list of child Obj instances.
//
function ObjArray(arg={}) {
    const mId       = arg.id || '';
    const mChildren = arg.children || [];   // Obj[]

    // ── serialization helpers ────────────────────────────────────────────────

    function getChildValue(obj) {
        const className = obj.getClassName ? obj.getClassName() : null;
        if (isDefined(obj.getParams)) {
            const params = obj.getParams();
            const value  = getParamValues(params);
            return className ? { className, params: value } : value;
        } else if (isDefined(obj.getValue)) {
            return obj.getValue();
        } else if (isDefined(obj.getParamsMap)) {
            return { className, params: obj.getParamsMap() };
        } else {
            console.warn('ObjArray: cannot get value from child:', obj);
            return {};
        }
    }

    function setChildValue(obj, value, initialize = false) {
        if (obj.setParamsMap) {
            obj.setParamsMap(value.params ?? value, initialize);
        } else if (isDefined(obj.getParams)) {
            const params = obj.getParams();
            setParamValues(params, value.params ?? value, initialize);
        } else if (isDefined(obj.setValue)) {
            obj.setValue(value, initialize);
        } else {
            console.warn('ObjArray: cannot set value on child:', obj);
        }
    }

    // ── public methods ───────────────────────────────────────────────────────

    /** @returns {string} */
    function getId() { return mId; }

    /**
     * Find a child by id or by numeric index.
     * If the child has no getId() method, the index is used as its id.
     * @param {string|number} id
     * @returns {Obj|null}
     */
    function getChildWithId(id) {
        // 1. try getId() match
        const byId = mChildren.find(c => c.getId && c.getId() === id);
        if (byId) return byId;
        // 2. fall back to numeric index
        const idx = typeof id === 'number' ? id : parseInt(id, 10);
        if (!isNaN(idx)) return mChildren[idx] ?? null;
        return null;
    }

    /** @returns {Obj[]} snapshot */
    function getChildren() { return mChildren.slice(); }

    /**
     * Serialize all children.
     * @returns {{ className: 'ObjArray', params: { id: string, children: Array } }}
     */
    function getValue() {
        return {
            className: 'ObjArray',
            params: {
                id:       mId,
                children: mChildren.map(child => child.getValue()),
            },
        };
    }

    /**
     * Restore all children from a previously serialized value.
     * Accepts the object produced by getValue().
     * @param {object} value
     * @param {boolean} [initialize=false]
     */
    function setValue(value, initialize = false) {
        // Unwrap structured format: { className:'ObjArray', params:{ id, children:[...] } }
        if (!value || value.className !== 'ObjArray' || !value.params) {
            console.warn('ObjArray.setValue(): expected ObjArray value object, got:', value);
            return;
        }
        const childArray = value.params.children;
        mChildren.forEach((child, i) => {
            if (i < childArray.length) {
                child.setValue(childArray[i], initialize);
            }
        });
    }

    /**
     * Build dat.GUI UI for this ObjArray's children into the given folder.
     * The caller is responsible for creating the named parent folder;
     * this method only adds one sub-folder per child.
     * @param {object} gui  - dat.GUI folder to render children into
     */
    function createUI(gui) {
        mChildren.forEach((child, i) => {
            const name = child.getId ? child.getId() : i;
            const itemFolder = gui.addFolder(name);
            if (isDefined(child.getParams)) {
                createParamUI(itemFolder, child.getParams());
            } else if (isDefined(child.createUI)) {
                child.createUI(itemFolder);
            } else if (isDefined(child.initGUI)) {
                child.initGUI({ folder: itemFolder });
            } else {
                console.warn('ObjArray.createUI(): child has no UI method', child);
            }
        });
    }

    return {
        getId,
        getChildWithId,
        getChildren,
        getValue,
        setValue,
        createUI,
    };

} // ObjArray()

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
    if(DEBUG)console.log(`${MYNAME}.createParamUI()`, params); 
    if(isDefined(params.createUI)){
        
        if(DEBUG)console.log(`${MYNAME}}.createParamUI() calling createUI() for `, params);        
        // params can create UI 
        params.createUI(gui);
        
    } else {
        if(DEBUG)console.log(`${MYNAME}.createParamUI() processing params array`, params);        
        // a bunch of params 
        let keys = Object.keys(params);
        
        for(let i = 0; i < keys.length; i++){
            let uipar = params[keys[i]];
            if(DEBUG)console.log(`${MYNAME}.createParamUI() uipar[${keys[i]}] = `, uipar);
            if(!!uipar.createUI){ 
                if(DEBUG)console.log(`${MYNAME}.createParamUI() calling createUI() for `, uipar);
                uipar.createUI(gui);
            }
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
    ParamObjArray,
    ParamColor,
    ParamString,
    ParamCustom,
    createParamUI,
    getParamValues,
    setParamValues,
    initParamValues,
    updateParamDisplay,
    Obj,
    ObjArray,
}