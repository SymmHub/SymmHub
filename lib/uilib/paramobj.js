// paramobj.js — ParamObj, ParamObjArray, Obj, ObjArray
//
// These classes build on the core param system for managing arrays of typed
// objects with factory-based creation and full UI support.

import {
    isDefined,
    createParamUI,
    getParamValues,
    setParamValues,
    initParamValues,
    updateParamDisplay,
} from './modules.js';

const DEBUG = false;
const MYNAME = 'PARAMOBJ';

//
// ParamObj - wrapper for arbitrary object which has its own methods to createUI and get/set values
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
    
    function setName(newName) {
        if (folder) folder.name = newName;
    }

    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI,
        init:     init,
        replaceObj:  replaceObj,
        setName:     setName,
        getFolder:   () => folder,
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
    const mParamObjs = mItems.map(({ name, obj }) => {
        const paramObj = ParamObj({ name, obj });
        // Rename folder live when user edits the id field.
        if (obj.setOnIdChange) obj.setOnIdChange(newId => paramObj.setName(newId));
        return { name, paramObj };
    });

    let mFolder = null;

    // ── UI ────────────────────────────────────────────────────────────────────

    function createUI(gui) {
        if (mCreateUICallback) {
            mCreateUICallback(gui, mItems);
            return;
        }
        mFolder = gui.addFolder(mName);
        mParamObjs.forEach((entry) => {
            entry.paramObj.createUI(mFolder);
            injectListButtons(entry.paramObj, entry);
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
                        // Re-wire id→folder-name link on the fresh object.
                        if (newObj.setOnIdChange)
                            newObj.setOnIdChange(newId => item.paramObj.setName(newId));
                    }
                }
            }

            // Restore the values into the (possibly replaced) obj.
            // setValue must run BEFORE setName so getId() returns the restored id.
            // If child is an ObjArray, pass factory so it can swap its own nested children.
            const childObj = mItems[i].obj;
            if (childObj.getClassName && childObj.getClassName() === 'ObjArray') {
                childObj.setValue(childValue, initialize, mFactory);
            } else {
                item.paramObj.setValue(childValue, initialize);
            }

            // Rename the folder to match the child's id after values are restored.
            const updatedId = mItems[i].obj.getId ? mItems[i].obj.getId() : null;
            if (updatedId !== null) {
                item.paramObj.setName(updatedId);
                mItems[i].name = updatedId;
            }
        });

        if (mOnChange) mOnChange();
    }

    // ── list mutation ─────────────────────────────────────────────────────────

    // Helper: create a ParamObj entry and wire id-change callback.
    function makeEntry(obj, i) {
        const name = obj.getId ? obj.getId() : i;
        const paramObj = ParamObj({ name, obj });
        if (obj.setOnIdChange) obj.setOnIdChange(newId => paramObj.setName(newId));
        return { name, paramObj };
    }

    // Inject ↑↓+✕ buttons into a dat.GUI folder's title row.
    function injectListButtons(paramObj, entry) {
        const folder = paramObj.getFolder();
        if (!folder) return;
        const titleLi = folder.__ul && folder.__ul.children[0];
        if (!titleLi) return;

        const getIdx = () => mParamObjs.indexOf(entry);

        const wrap = document.createElement('span');
        wrap.style.cssText = [
            'position:absolute', 'right:4px', 'top:0', 'height:100%',
            'display:flex', 'align-items:center', 'gap:2px', 'z-index:10',
        ].join(';');

        [
            { lbl: '↑', tip: 'Move up',   act: () => moveChildAt(getIdx(), -1) },
            { lbl: '↓', tip: 'Move down', act: () => moveChildAt(getIdx(),  1) },
            { lbl: '+', tip: 'Add after', act: () => addChildAt(getIdx())      },
            { lbl: '✕', tip: 'Remove',    act: () => removeChildAt(getIdx())   },
        ].forEach(({ lbl, tip, act }) => {
            const btn = document.createElement('span');
            btn.textContent = lbl;
            btn.title = tip;
            btn.style.cssText = [
                'cursor:pointer', 'font-size:10px', 'padding:1px 3px',
                'border-radius:2px', 'background:rgba(0,0,0,0.12)',
                'user-select:none', 'opacity:0.7', 'line-height:1.4',
            ].join(';');
            btn.addEventListener('mouseenter', () => { btn.style.opacity='1'; btn.style.background='rgba(0,0,0,0.25)'; });
            btn.addEventListener('mouseleave', () => { btn.style.opacity='0.7'; btn.style.background='rgba(0,0,0,0.12)'; });
            btn.addEventListener('mousedown', e => e.stopPropagation());
            btn.addEventListener('click',     e => { e.stopPropagation(); act(); });
            wrap.appendChild(btn);
        });

        titleLi.style.position = 'relative';
        titleLi.appendChild(wrap);
    }

    // Add a new child of the same type as child at index i, inserted after it.
    function addChildAt(i) {
        if (!mFactory) { console.warn('ParamObjArray: no factory — cannot add'); return; }
        const currentClass = mItems[i]?.obj.getClassName?.() ?? null;
        const newObj = currentClass ? mFactory.getObject(currentClass) : mFactory.getObject();
        const insertIdx = i + 1;

        mObjArray.addChild(newObj, insertIdx);
        mItems.splice(insertIdx, 0, { name: newObj.getId?.() ?? insertIdx, obj: newObj });

        const entry = makeEntry(newObj, insertIdx);
        mParamObjs.splice(insertIdx, 0, entry);

        // Render at end of mFolder, then move to correct DOM position.
        entry.paramObj.createUI(mFolder);
        injectListButtons(entry.paramObj, entry);

        if (insertIdx < mParamObjs.length - 1) {
            const refLi = mParamObjs[insertIdx + 1].paramObj.getFolder().domElement.parentElement;
            mFolder.__ul.insertBefore(
                entry.paramObj.getFolder().domElement.parentElement, refLi
            );
        }
    }

    // Remove child at index i.
    function removeChildAt(i) {
        const entry = mParamObjs[i];
        if (mFolder && entry.paramObj.getFolder()) mFolder.removeFolder(entry.paramObj.getFolder());
        mParamObjs.splice(i, 1);
        mItems.splice(i, 1);
        mObjArray.removeChild(i);
    }

    // Move child at index i by delta (-1 = up, +1 = down).
    function moveChildAt(i, delta) {
        const j = i + delta;
        if (j < 0 || j >= mParamObjs.length) return;
        // Capture DOM li's before the array swap.
        const li_i = mParamObjs[i].paramObj.getFolder().domElement.parentElement;
        const li_j = mParamObjs[j].paramObj.getFolder().domElement.parentElement;
        // Swap parallel arrays.
        [mParamObjs[i], mParamObjs[j]] = [mParamObjs[j], mParamObjs[i]];
        [mItems[i],     mItems[j]    ] = [mItems[j],     mItems[i]    ];
        mObjArray.moveChild(i, j);
        // Swap DOM positions.
        if (delta < 0) { mFolder.__ul.insertBefore(li_i, li_j); }
        else           { mFolder.__ul.insertBefore(li_j, li_i); }
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
    let   mParamObjs = null;                // set by createUI()

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
     * @param {object}  [factory=null]  - optional ObjectFactory for type-aware child swap
     */
    function setValue(value, initialize = false, factory = null) {
        // Unwrap structured format: { className:'ObjArray', params:{ id, children:[...] } }
        if (!value || value.className !== 'ObjArray' || !value.params) {
            console.warn('ObjArray.setValue(): expected ObjArray value object, got:', value);
            return;
        }
        const childArray = value.params.children;

        if (mParamObjs) {
            // UI-aware path: use stored ParamObj wrappers for factory-based type swapping.
            mParamObjs.forEach((item, i) => {
                if (i >= childArray.length) return;
                const childValue = childArray[i];

                if (factory && childValue && childValue.className) {
                    const currentClass = item.child.getClassName ? item.child.getClassName() : null;
                    if (currentClass !== childValue.className) {
                        const newObj = factory.getObject(childValue.className);
                        if (newObj) {
                            item.paramObj.replaceObj(newObj);
                            item.child = newObj;
                            mChildren[i] = newObj;
                            // Re-wire id→folder-name link on the fresh object.
                            if (newObj.setOnIdChange)
                                newObj.setOnIdChange(newId => item.paramObj.setName(newId));
                        }
                    }
                }

                item.paramObj.setValue(childValue, initialize);

                // Rename folder to the restored id.
                const updatedId = item.child.getId ? item.child.getId() : null;
                if (updatedId !== null) {
                    item.paramObj.setName(updatedId);
                }
            });
        } else {
            // No UI: plain positional setValue.
            mChildren.forEach((child, i) => {
                if (i < childArray.length) {
                    child.setValue(childArray[i], initialize);
                }
            });
        }
    }

    /**
     * Build dat.GUI UI for this ObjArray's children into the given folder.
     * Stores ParamObj wrappers so that setValue() can do factory-aware replacement.
     * @param {object} gui  - dat.GUI folder to render children into
     */
    function createUI(gui) {
        mParamObjs = mChildren.map((child, i) => {
            const name = child.getId ? child.getId() : i;
            const paramObj = ParamObj({ name, obj: child });
            paramObj.createUI(gui);
            // Rename folder live when user edits the id field.
            if (child.setOnIdChange) child.setOnIdChange(newId => paramObj.setName(newId));
            return { child, paramObj };
        });
    }

    return {
        getId,
        getClassName: () => 'ObjArray',
        getChildWithId,
        getChildren,
        getValue,
        setValue,
        createUI,
        addChild:    (newObj, atIdx = mChildren.length) => mChildren.splice(atIdx, 0, newObj),
        removeChild: (atIdx)           => mChildren.splice(atIdx, 1),
        moveChild:   (fromIdx, toIdx)  => { const [c] = mChildren.splice(fromIdx, 1); mChildren.splice(toIdx, 0, c); },
    };

} // ObjArray()

export { ParamObj, ParamObjArray, Obj, ObjArray };
