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

// Compute a stable display name for a child object: 'ClassName' or 'ClassName.id'.
function childFolderName(child) {
    const cls = child.getClassName ? child.getClassName() : null;
    const id  = child.getId ? child.getId() : '';
    if (cls && id) return `${cls}.${id}`;
    if (cls)       return cls;
    return id || '?';
}

// Prefix childFolderName with a 1-based index to guarantee unique dat.GUI folder names.
function indexedFolderName(index, child) {
    return `${index + 1}.${childFolderName(child)}`;
}

// Inject ↑↓+✕ edit buttons into a dat.GUI folder's title row.
// callbacks: { onMoveUp, onMoveDown, onAdd (optional), onRemove }
// All buttons share a single [data-gui-buttons] flex wrap so they don't overlap.
function injectListButtons(paramObj, { onMoveUp, onMoveDown, onAdd, onRemove }) {
    const folder = paramObj.getFolder();
    if (!folder) return {};
    const titleLi = folder.__ul && folder.__ul.children[0];
    if (!titleLi) return {};

    // Reuse an existing wrap or create one.
    let wrap = titleLi.querySelector('[data-gui-buttons]');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.setAttribute('data-gui-buttons', '');
        titleLi.style.position = 'relative';
        titleLi.appendChild(wrap);
    }

    // Build the nav buttons and prepend them (so ↑↓✕ always come before any existing + button).
    const fragment = document.createDocumentFragment();
    let btnUp, btnDown;
    [
        { lbl: '↑', tip: 'Move up',   act: onMoveUp,   ref: (b) => { btnUp   = b; } },
        { lbl: '↓', tip: 'Move down', act: onMoveDown, ref: (b) => { btnDown = b; } },
        onAdd && { lbl: '+', tip: 'Add after', act: onAdd, ref: () => {} },
        { lbl: '✕', tip: 'Remove',    act: onRemove,  ref: () => {} },
    ].filter(Boolean).forEach(({ lbl, tip, act, ref }) => {
        const btn = makeBtn(lbl, tip, act);
        ref(btn);
        fragment.appendChild(btn);
    });
    wrap.insertBefore(fragment, wrap.firstChild);
    return { btnUp, btnDown };
}

// Shared button factory — styling via .gui-list-btn in dat-gui-mod.css.
function makeBtn(lbl, tip, act) {
    const btn = document.createElement('span');
    btn.textContent = lbl;
    btn.title = tip;
    btn.className = 'gui-list-btn';
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('click',     e => { e.stopPropagation(); act(); });
    return btn;
}

// Show a popup using .gui-popup CSS classes (dat-gui-mod.css).
// Calls onSelect(className) when the user picks a class name.
function showClassMenu(factory, anchorEl, onSelect) {
    const names = factory.getNames();
    // If only one option, skip the menu.
    if (names.length === 1) { onSelect(names[0]); return; }

    // Remove any stale menu.
    const existing = document.getElementById('_gui-class-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id    = '_gui-class-menu';
    menu.className = 'gui-popup';

    // Title bar
    const titleEl = document.createElement('div');
    titleEl.textContent = 'Add child';
    titleEl.className   = 'gui-popup__title';
    menu.appendChild(titleEl);

    // Class name rows
    names.forEach(name => {
        const item = document.createElement('div');
        item.textContent = name;
        item.className   = 'gui-popup__item';
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
            onSelect(name);
        });
        menu.appendChild(item);
    });

    // Position below the anchor button.
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + 2}px`;
    menu.style.left = `${rect.left}px`;
    document.body.appendChild(menu);

    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
        }
    }
    setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
}

// Inject a standalone "+" button that opens a class-picker popup.
// factory  : ObjectFactory — provides getNames()
// onSelect : function(className) — called when user picks a class
function injectAddButton(folder, factory, onSelect) {
    if (!folder || !factory) return;
    const titleLi = folder.__ul && folder.__ul.children[0];
    if (!titleLi) return;
    let wrap = titleLi.querySelector('[data-gui-buttons]');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.setAttribute('data-gui-buttons', '');
        titleLi.style.position = 'relative';
        titleLi.appendChild(wrap);
    }
    const btn = makeBtn('+', 'Add child', () => showClassMenu(factory, btn, onSelect));
    wrap.appendChild(btn);
}

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
        if (!folder) return;
        // dat.GUI's name setter does `titleRow.innerHTML = newName`, which wipes all
        // injected button nodes. Detach the button wrap first, then re-append it.
        const titleLi = folder.__ul && folder.__ul.children[0];
        const btnWrap = titleLi && titleLi.querySelector('[data-gui-buttons]');
        if (btnWrap) btnWrap.remove();
        folder.name = newName;          // triggers dat.GUI innerHTML overwrite
        if (btnWrap && titleLi) titleLi.appendChild(btnWrap);  // restore buttons
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
    const mItems    = mObjArray.getChildren().map((child) => ({
        name: childFolderName(child),
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
    const mParamObjs = mItems.map(({ obj }, i) => {
        const name = indexedFolderName(i, obj);
        const paramObj = ParamObj({ name, obj });
        // Rename folder live when user edits the id field (index stays the same).
        if (obj.setOnIdChange) {
            const capturedI = i;
            obj.setOnIdChange(() => paramObj.setName(indexedFolderName(capturedI, obj)));
        }
        // If child is an ObjArray and we have a factory, propagate it.
        if (obj.setFactory) obj.setFactory(mFactory);
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

        // Add a "+" button to the folder title row (appends a new child at the end).
        if (mFactory) injectAddButton(mFolder, mFactory, addChildAtEnd);

        mParamObjs.forEach((entry) => {
            entry.paramObj.createUI(mFolder);
            const getIdx = () => mParamObjs.indexOf(entry);
            const btns = injectListButtons(entry.paramObj, {
                onMoveUp:   () => moveChildAt(getIdx(), -1),
                onMoveDown: () => moveChildAt(getIdx(),  1),
                onRemove:   () => removeChildAt(getIdx()),
            });
            entry.btnUp   = btns.btnUp;
            entry.btnDown = btns.btnDown;
        });
        updateEdgeButtons();
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
                            newObj.setOnIdChange(() => item.paramObj.setName(childFolderName(newObj)));
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

            // Rename the folder using indexed className.id after values are restored.
            const updatedName = indexedFolderName(i, mItems[i].obj);
            item.paramObj.setName(updatedName);
            mItems[i].name = updatedName;
        });

        if (mOnChange) mOnChange();
    }

    // ── list mutation ─────────────────────────────────────────────────────────

    // Helper: renumber all child folders after any add/remove/move.
    function renameAll() {
        mParamObjs.forEach((entry, i) => {
            const name = indexedFolderName(i, mItems[i].obj);
            entry.paramObj.setName(name);
            entry.name = name;
            mItems[i].name = name;
        });
    }

    // Helper: disable ↑ on the first entry and ↓ on the last entry.
    function updateEdgeButtons() {
        const last = mParamObjs.length - 1;
        mParamObjs.forEach((entry, i) => {
            if (entry.btnUp)   entry.btnUp.disabled   = (i === 0);
            if (entry.btnDown) entry.btnDown.disabled = (i === last);
        });
    }

    // Helper: create a ParamObj entry and wire id-change callback.
    function makeEntry(obj, insertIdx) {
        const name = indexedFolderName(insertIdx, obj);
        const paramObj = ParamObj({ name, obj });
        if (obj.setOnIdChange) obj.setOnIdChange(() => {
            const i = mParamObjs.findIndex(e => e.paramObj === paramObj);
            if (i >= 0) paramObj.setName(indexedFolderName(i, obj));
        });
        return { name, paramObj, btnUp: null, btnDown: null };
    }

    // Add a new child at the end of the list using the given class name.
    function addChildAtEnd(className) {
        if (!mFactory) { console.warn('ParamObjArray: no factory — cannot add'); return; }
        const newObj = mFactory.getObject(className);
        const insertIdx = mParamObjs.length;   // append at end

        // Propagate factory to nested ObjArrays so they also get a + button.
        if (newObj.setFactory) newObj.setFactory(mFactory);

        mObjArray.addChild(newObj, insertIdx);
        mItems.splice(insertIdx, 0, { name: indexedFolderName(insertIdx, newObj), obj: newObj });

        const entry = makeEntry(newObj, insertIdx);
        mParamObjs.splice(insertIdx, 0, entry);

        // Render at end of mFolder (which is correct — we're appending).
        entry.paramObj.createUI(mFolder);
        const getIdx = () => mParamObjs.indexOf(entry);
        const btns = injectListButtons(entry.paramObj, {
            onMoveUp:   () => moveChildAt(getIdx(), -1),
            onMoveDown: () => moveChildAt(getIdx(),  1),
            onRemove:   () => removeChildAt(getIdx()),
        });
        entry.btnUp   = btns.btnUp;
        entry.btnDown = btns.btnDown;
        updateEdgeButtons();
        if (mOnChange) mOnChange();
    }

    // Remove child at index i.
    function removeChildAt(i) {
        const entry = mParamObjs[i];
        if (mFolder && entry.paramObj.getFolder()) mFolder.removeFolder(entry.paramObj.getFolder());
        mParamObjs.splice(i, 1);
        mItems.splice(i, 1);
        mObjArray.removeChild(i);
        renameAll();
        updateEdgeButtons();
        if (mOnChange) mOnChange();
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
        renameAll();
        updateEdgeButtons();
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
    let   mParamObjs = null;                // set by createUI()
    let   mFactory   = arg.factory || null; // optional, for the + button

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
                                newObj.setOnIdChange(() => item.paramObj.setName(indexedFolderName(i, newObj)));
                        }
                    }
                }

                item.paramObj.setValue(childValue, initialize);

                // Rename folder using indexed className.id after values are restored.
                item.paramObj.setName(indexedFolderName(i, item.child));
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
        // Local mutation helpers (GUI-aware, mirror mChildren + mParamObjs).

        // Renumber all child folders after any mutation.
        function renameAll() {
            mParamObjs.forEach((entry, i) => {
                entry.paramObj.setName(indexedFolderName(i, entry.child));
            });
        }

        function addAt(i) {
            if (!mFactory) { console.warn('ObjArray: no factory — cannot add'); return; }
            const currentClass = mChildren[i]?.getClassName?.() ?? null;
            const newObj = currentClass ? mFactory.getObject(currentClass) : mFactory.getDefaultObject();
            if (newObj.setFactory) newObj.setFactory(mFactory);
            const insertIdx = i + 1;
            mChildren.splice(insertIdx, 0, newObj);
            const name = indexedFolderName(insertIdx, newObj);
            const paramObj = ParamObj({ name, obj: newObj });
            paramObj.createUI(gui);
            if (newObj.setOnIdChange) newObj.setOnIdChange(() => {
                const idx = mParamObjs.findIndex(e => e.child === newObj);
                if (idx >= 0) paramObj.setName(indexedFolderName(idx, newObj));
            });
            const entry = { child: newObj, paramObj };
            mParamObjs.splice(insertIdx, 0, entry);
            const getIdx = () => mParamObjs.indexOf(entry);
            injectListButtons(paramObj, {
                onMoveUp:   () => moveAt(getIdx(), -1),
                onMoveDown: () => moveAt(getIdx(),  1),
                onRemove:   () => removeAt(getIdx()),
            });
            if (insertIdx < mParamObjs.length - 1) {
                const refLi = mParamObjs[insertIdx + 1].paramObj.getFolder().domElement.parentElement;
                gui.__ul.insertBefore(paramObj.getFolder().domElement.parentElement, refLi);
            }
            renameAll();
        }
        function addAtEnd(className) {
            if (!mFactory) { console.warn('ObjArray: no factory — cannot add'); return; }
            const newObj = mFactory.getObject(className);
            // Propagate factory to nested ObjArrays so they also get a + button.
            if (newObj.setFactory) newObj.setFactory(mFactory);
            const insertIdx = mParamObjs.length;
            mChildren.splice(insertIdx, 0, newObj);
            const name = indexedFolderName(insertIdx, newObj);
            const paramObj = ParamObj({ name, obj: newObj });
            paramObj.createUI(gui);
            if (newObj.setOnIdChange) newObj.setOnIdChange(() => {
                const idx = mParamObjs.findIndex(e => e.child === newObj);
                if (idx >= 0) paramObj.setName(indexedFolderName(idx, newObj));
            });
            const entry = { child: newObj, paramObj };
            mParamObjs.splice(insertIdx, 0, entry);
            const getIdx = () => mParamObjs.indexOf(entry);
            injectListButtons(paramObj, {
                onMoveUp:   () => moveAt(getIdx(), -1),
                onMoveDown: () => moveAt(getIdx(),  1),
                onRemove:   () => removeAt(getIdx()),
            });
        }
        function removeAt(i) {
            const entry = mParamObjs[i];
            if (entry.paramObj.getFolder()) gui.removeFolder(entry.paramObj.getFolder());
            mParamObjs.splice(i, 1);
            mChildren.splice(i, 1);
            renameAll();  // reindex remaining
        }
        function moveAt(i, delta) {
            const j = i + delta;
            if (j < 0 || j >= mParamObjs.length) return;
            const li_i = mParamObjs[i].paramObj.getFolder().domElement.parentElement;
            const li_j = mParamObjs[j].paramObj.getFolder().domElement.parentElement;
            [mParamObjs[i], mParamObjs[j]] = [mParamObjs[j], mParamObjs[i]];
            [mChildren[i],  mChildren[j] ] = [mChildren[j],  mChildren[i] ];
            if (delta < 0) { gui.__ul.insertBefore(li_i, li_j); }
            else           { gui.__ul.insertBefore(li_j, li_i); }
            renameAll();  // reindex all
        }

        mParamObjs = mChildren.map((child, i) => {
            const name = indexedFolderName(i, child);
            const paramObj = ParamObj({ name, obj: child });
            paramObj.createUI(gui);
            if (child.setOnIdChange) child.setOnIdChange(() => {
                const idx = mParamObjs.findIndex(e => e.child === child);
                if (idx >= 0) paramObj.setName(indexedFolderName(idx, child));
            });
            return { child, paramObj };
        });

        // Inject ↑↓✕ buttons on each child.
        mParamObjs.forEach((entry) => {
            const getIdx = () => mParamObjs.indexOf(entry);
            injectListButtons(entry.paramObj, {
                onMoveUp:   () => moveAt(getIdx(), -1),
                onMoveDown: () => moveAt(getIdx(),  1),
                onRemove:   () => removeAt(getIdx()),
            });
        });

        // Inject a "+" button into this ObjArray folder's own title row (shared wrap).
        if (mFactory) injectAddButton(gui, mFactory, addAtEnd);
    }

    return {
        getId,
        getClassName: () => 'ObjArray',
        getChildWithId,
        getChildren,
        getValue,
        setValue,
        createUI,
        setFactory:  (f) => { mFactory = f; },
        addChild:    (newObj, atIdx = mChildren.length) => mChildren.splice(atIdx, 0, newObj),
        removeChild: (atIdx)           => mChildren.splice(atIdx, 1),
        moveChild:   (fromIdx, toIdx)  => { const [c] = mChildren.splice(fromIdx, 1); mChildren.splice(toIdx, 0, c); },
    };

} // ObjArray()

export { ParamObj, ParamObjArray, Obj, ObjArray };
