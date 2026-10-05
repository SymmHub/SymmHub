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
    createPromptDialog,
} from './modules.js';
import { showPopupMenu } from './PopupMenu.js';
import { makeDragReorder } from './DragReorder.js';

const DEBUG = false;
const MYNAME = 'ParamObj';

// Compute a stable display name for a child object: 'ClassName' or 'ClassName.id'.
function childFolderName(child) {
    const cls = child.getClassName ? child.getClassName() : null;
    const id  = child.getId ? child.getId() : '';
    if (cls && id) return `${cls}.${id}`;
    if (cls)       return cls;
    return id || '?';
}

// Folder name for a child: prefer just the id (unique by convention),
// fall back to "N.ClassName" if no id is available.
function indexedFolderName(index, child) {
    const id = child.getId ? child.getId() : null;
    if (id) return id;
    const cls = child.getClassName ? child.getClassName() : null;
    return cls ? `${index + 1}.${cls}` : `item${index + 1}`;
}

// three lines: a hamburger
const MENU_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/>' +
    '</svg>';

// The span at the right end of a folder's title row that holds its buttons
// (styled by [data-gui-buttons] in dat-gui-mod.css), made on first use.
function titleButtonWrap(folder) {
    const titleLi = folder && folder.__ul && folder.__ul.children[0];
    if (!titleLi) return null;
    let wrap = titleLi.querySelector('[data-gui-buttons]');
    if (!wrap) {
        wrap = document.createElement('span');
        wrap.setAttribute('data-gui-buttons', '');
        titleLi.style.position = 'relative';
        titleLi.appendChild(wrap);
    }
    return wrap;
}

// A press on a control in a title row neither toggles the folder nor starts a drag.
function keepPressesInside(el) {
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('mousedown',   e => e.stopPropagation());
    el.addEventListener('click',       e => e.stopPropagation());
}

// Shared text button factory — styling via .gui-list-btn in dat-gui-mod.css.
function makeBtn(lbl, tip, act) {
    const btn = document.createElement('span');
    btn.textContent = lbl;
    btn.title = tip;
    btn.className = 'gui-list-btn';
    keepPressesInside(btn);
    btn.addEventListener('click', () => act());
    return btn;
}

// A hamburger button in a folder's title row; a click opens a popup menu of
// getItems() (asked each time, see PopupMenu.js).
function injectMenuButton(folder, getItems, tip) {
    const wrap = titleButtonWrap(folder);
    if (!wrap) return null;
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'gui-list-menu-btn';
    btn.title     = tip;
    btn.setAttribute('aria-label', tip);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = MENU_ICON;
    keepPressesInside(btn);
    btn.addEventListener('click', () => showPopupMenu({ anchor: btn, items: getItems() }));
    wrap.appendChild(btn);
    return btn;
}

// Moves the checkbox of the folder's boolean param `key` (e.g. 'enabled') into the
// title row, so that the item can be switched on and off while its folder is
// closed; its own row is hidden. dat.gui keeps updating that same input, so it
// follows every change of the value. A checkbox moved there for an object that
// was replaced since is removed first. Returns whether there was such a param.
function moveCheckboxToTitle(folder, key) {
    const wrap = titleButtonWrap(folder);
    if (!wrap) return false;
    wrap.querySelector('input[data-gui-title-checkbox]')?.remove();
    const ctrl = (folder.__controllers || []).find(c => c.property === key && c.__checkbox);
    if (!ctrl) return false;
    const cb = ctrl.__checkbox;
    cb.setAttribute('data-gui-title-checkbox', '');
    cb.title = key;
    cb.setAttribute('aria-label', key);
    keepPressesInside(cb);
    wrap.insertBefore(cb, wrap.firstChild);
    ctrl.__li.classList.add('gui-row-in-title');
    return true;
}

// Hides the row of the folder's param `key` (e.g. 'id', edited by Rename… instead).
function hideTitleRow(folder, key) {
    const ctrl = (folder.__controllers || []).find(c => c.property === key);
    if (ctrl) ctrl.__li.classList.add('gui-row-in-title');
}

// Asks for the class of a new child with a popup menu of the factory's classes
// under anchor, then calls onSelect(className); a factory of one class asks nothing.
function pickClass(factory, anchor, title, onSelect) {
    const names = factory.getNames();
    if (names.length === 1) { onSelect(names[0]); return; }
    showPopupMenu({
        anchor,
        title,
        items: names.map(name => ({
            label:  factory.getLabel ? factory.getLabel(name) : name,
            action: () => onSelect(name),
        })),
    });
}

// Inject a standalone "+" button that opens a class-picker popup.
// factory  : ObjectFactory — provides getNames()
// onSelect : function(className) — called when user picks a class
function injectAddButton(folder, factory, onSelect) {
    const wrap = titleButtonWrap(folder);
    if (!wrap || !factory) return;
    const btn = makeBtn('+', 'Add', () => pickClass(factory, btn, 'Add', onSelect));
    wrap.appendChild(btn);
}

// A deep copy of a serialized value, so that a duplicate shares no arrays with its source.
function cloneValue(value) {
    try { return structuredClone(value); } catch (e) { /* a function or a DOM node inside */ }
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
}

// The id of an object can be set through its 'id' param, or its setId().
function getIdSetter(obj) {
    const idParam = obj.getParams ? obj.getParams()?.id : null;
    if (idParam && idParam.setValue) return (id) => idParam.setValue(id);
    if (obj.setId) return (id) => obj.setId(id);
    return null;
}

let sPrompt = null;   // PromptDialog of Rename…, shared by all lists

//
// ParamObj - wrapper for arbitrary object which has its own methods to createUI and get/set values
//
function ParamObj(arg) {
    
    let obj = arg.obj;
    let folderName = isDefined(arg.name)? arg.name: arg.obj.toString();
    let folder = null;
    let className = (obj.getClassName)?  obj.getClassName(): null;
    
    if(DEBUG) console.log(`${MYNAME}: creating ${folderName}, className: ${className}`);
    
    function createUI(gui){
        
       if(!folder) {
           // Guard: clear any stale __folders entry that may remain after a rename,
           // preventing dat.GUI's "already have a folder" throw on re-creation.
           if (gui.__folders?.[folderName]) delete gui.__folders[folderName];
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
        // Backward compatibility: map parameter 'name' to 'id' if 'id' is missing
        if (value) {
            if (value.params) {
                if ('name' in value.params && !('id' in value.params)) {
                    value.params.id = value.params.name;
                }
            } else {
                if ('name' in value && !('id' in value)) {
                    value.id = value.name;
                }
            }
        }
        
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
        // Remove all leaf controllers.
        let cont = folder.__controllers;
        for(let i = cont.length-1; i >= 0; i--)
            cont[i].remove();
        // Remove all sub-folders (e.g. texture/transform left over from a replaced texmap layer).
        // __folders is a keyed object, not an array, so we must use Object.values().
        const subFolders = Object.values(folder.__folders || {});
        for (const sf of subFolders)
            folder.removeFolder(sf);
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

        const siblings = folder.parent?.__folders;
        const oldName  = folder.name;
        // Remove the current folder's old __folders entry so that a swap
        // (A→B while B still exists for another folder) isn't blocked.
        if (siblings && oldName && siblings[oldName] === folder)
            delete siblings[oldName];

        // If newName is already owned by a *different* folder, bail.
        if (siblings?.[newName] && siblings[newName] !== folder) {
            if (siblings && oldName) siblings[oldName] = folder; // restore
            if (btnWrap && titleLi) titleLi.appendChild(btnWrap);
            return;
        }
        folder.name = newName;
        if (siblings) siblings[newName] = folder; // keep __folders in sync
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
        getObj:      () => obj,
        serializable: (arg.serializable !== false), // default true; false = transient
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
// Default UI: a folder per child under the list's folder, whose "+" adds a child
// at the end. The title row of a child's folder holds the checkbox of its
// 'enabled' param (its own row is hidden) and a hamburger menu: Move up / down /
// to top / to bottom, Add above / below (a menu of the factory's classes),
// Duplicate, Rename… (sets the 'id' param, whose row is hidden then), Delete.
// Dragging a title row moves the child (DragReorder.js).
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
    let mDrag   = null;   // reorders the children by dragging their title rows

    // ── UI ────────────────────────────────────────────────────────────────────

    function createUI(gui) {
        if (mCreateUICallback) {
            mCreateUICallback(gui, mItems);
            return;
        }
        mFolder = gui.addFolder(mName);

        // Add a "+" button to the folder title row (appends a new child at the end).
        if (mFactory) injectAddButton(mFolder, mFactory, addChildAtEnd);

        mDrag = makeDragReorder({ getRows: itemRows, onMove: moveChildTo });
        mParamObjs.forEach((entry) => {
            entry.paramObj.createUI(mFolder);
            attachItemControls(entry);
        });
    }

    // The title row and the whole folder of each child, in list order (for dragging).
    function itemRows() {
        return mParamObjs.map((entry) => {
            const folder = entry.paramObj.getFolder();
            return { handle: folder.__ul.children[0], block: folder.domElement.parentElement };
        });
    }

    // The title row of a child's folder gets its enabled checkbox, a hamburger
    // menu of the list commands, and starts drags.
    function attachItemControls(entry) {
        const folder = entry.paramObj.getFolder();
        if (!folder) return;
        bindTitleRow(entry);
        entry.menuBtn = injectMenuButton(folder, () => itemMenu(entry),
            'move, add, duplicate, rename, delete');
        mDrag.attach(folder.__ul.children[0]);
    }

    // The rows shown in the title row instead (again after the object was replaced).
    function bindTitleRow(entry) {
        const folder = entry.paramObj.getFolder();
        if (!folder) return;
        moveCheckboxToTitle(folder, 'enabled');
        if (getIdSetter(entry.paramObj.getObj())) hideTitleRow(folder, 'id');
    }

    function itemMenu(entry) {
        const i    = mParamObjs.indexOf(entry);
        const last = mParamObjs.length - 1;
        const obj  = entry.paramObj.getObj();
        const cls  = obj.getClassName ? obj.getClassName() : null;
        const kinds = mFactory ? mFactory.getNames().length : 0;
        const add   = kinds > 1 ? '…' : '';
        const addAt = (title, offset) => () => pickClass(mFactory, entry.menuBtn, title,
            (className) => addChild(className, mParamObjs.indexOf(entry) + offset));
        return [
            { label: 'Move up',        disabled: i === 0,    action: () => moveChildTo(i, i - 1) },
            { label: 'Move down',      disabled: i === last, action: () => moveChildTo(i, i + 1) },
            { label: 'Move to top',    disabled: i === 0,    action: () => moveChildTo(i, 0) },
            { label: 'Move to bottom', disabled: i === last, action: () => moveChildTo(i, last) },
            { separator: true },
            { label: 'Add above' + add, disabled: !kinds, action: addAt('Add above', 0) },
            { label: 'Add below' + add, disabled: !kinds, action: addAt('Add below', 1) },
            { label: 'Duplicate', disabled: !(kinds && mFactory.getNames().includes(cls)),
              action: () => duplicateChild(entry) },
            { label: 'Rename…', disabled: !getIdSetter(obj), action: () => renameChild(entry) },
            { separator: true },
            { label: 'Delete', action: () => removeChildAt(mParamObjs.indexOf(entry)) },
        ];
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
        // A plain object keyed by child id is a partial patch: the listed
        // children get the values, the list itself is left alone.
        if (childArray && typeof childArray === 'object' && !Array.isArray(childArray)
            && childArray.className === undefined && childArray.params === undefined) {
            setValueById(childArray, initialize);
            return;
        }
        if (!Array.isArray(childArray)) {
            console.warn('ParamObjArray.setValue(): unexpected value format:', value);
            mObjArray.setValue(value, initialize);
            if (mOnChange) mOnChange();
            return;
        }

        // 1. Build id-keyed pool of current live layers
        const poolById = new Map();
        const poolNoId = [];
        for (let i = 0; i < mParamObjs.length; i++) {
            const liveId = mItems[i]?.obj?.getId?.() ?? null;
            const bucket = { item: mItems[i], entry: mParamObjs[i] };
            if (liveId) {
                if (!poolById.has(liveId)) poolById.set(liveId, []);
                poolById.get(liveId).push(bucket);
            } else {
                poolNoId.push(bucket);
            }
        }

        const newItems = [];
        const newParamObjs = [];

        // 2. Iterate JSON children, claim from pool or grow
        for (let i = 0; i < childArray.length; i++) {
            const childValue  = childArray[i];
            const wantedId    = childValue.params && (childValue.params.id || childValue.params.name);
            const className   = (childValue && childValue.className) || (mFactory && mFactory.getDefaultName());

            // Try to claim a matching live entry from the pool
            let claimed = null;
            if (wantedId && poolById.has(wantedId)) {
                // Exact id match
                claimed = poolById.get(wantedId).shift();
                if (poolById.get(wantedId).length === 0) poolById.delete(wantedId);
            } else {
                // No id match: try className match across all pool buckets first
                if (className) {
                    outer: for (const [key, buckets] of poolById) {
                        for (let bi = 0; bi < buckets.length; bi++) {
                            const cn = buckets[bi].item.obj.getClassName?.();
                            if (cn === className) {
                                [claimed] = buckets.splice(bi, 1);
                                if (buckets.length === 0) poolById.delete(key);
                                break outer;
                            }
                        }
                    }
                }
                // Fall back to any no-id entry
                if (!claimed && poolNoId.length > 0) {
                    claimed = poolNoId.shift();
                }
            }

            if (claimed) {
                // If the layer's class type changed, replace the object in-place before keeping it
                const currentClass = claimed.item.obj.getClassName ? claimed.item.obj.getClassName() : null;
                if (mFactory && className && currentClass !== className) {
                    const newObj = mFactory.getObject(className);
                    if (newObj) {
                        claimed.entry.paramObj.replaceObj(newObj);
                        claimed.item.obj = newObj;
                        bindTitleRow(claimed.entry);
                        if (newObj.setOnIdChange) {
                            newObj.setOnIdChange(() => claimed.entry.paramObj.setName(childFolderName(newObj)));
                        }
                    }
                }
                newItems.push(claimed.item);
                newParamObjs.push(claimed.entry);
            } else {
                // Grow new layer — className IS the factory key (ObjectFactory uses className as name)
                if (!className || !mFactory) break;
                const newObj = mFactory.getObject(className);
                if (!newObj) break;
                if (newObj.setFactory) newObj.setFactory(mFactory);
                mObjArray.addChild(newObj); // Add immediately so factory sees it for uniqueness

                // Use a temp name to avoid dat.GUI collision with existing same-named folders
                const growTempName = '\x00__grow__' + newParamObjs.length;
                const newItemEntry = { name: indexedFolderName(i, newObj), obj: newObj };
                const newParamEntry = makeEntry(newObj, i, growTempName);
                newItems.push(newItemEntry);
                newParamObjs.push(newParamEntry);

                if (mFolder) {
                    newParamEntry.paramObj.createUI(mFolder);
                    attachItemControls(newParamEntry);
                }
            }
        }

        // 3. Discard unclaimed live layers
        const allUnclaimed = [...poolNoId, ...[...poolById.values()].flat()];
        for (const bucket of allUnclaimed) {
            if (mFolder && bucket.entry.paramObj.getFolder()) {
                mFolder.removeFolder(bucket.entry.paramObj.getFolder());
            }
        }

        // 4. Update backing arrays in-place
        for (let i = mObjArray.getChildren().length - 1; i >= 0; i--) {
            mObjArray.removeChild(i);
        }
        newItems.forEach((it, idx) => mObjArray.addChild(it.obj, idx));

        mItems.length = 0;
        mParamObjs.length = 0;
        newItems.forEach(it => mItems.push(it));
        newParamObjs.forEach(e => mParamObjs.push(e));

        // 5. Re-sort DOM elements to match the new array order
        placeItemFolders();

        // 6. Pre-rename folders to temp names to avoid dat.GUI collisions during setValue
        const TMP_PRE = '\x00__pre__';
        mParamObjs.forEach((entry, i) => entry.paramObj.setName(TMP_PRE + i));

        // 7. Apply JSON values positionally
        mParamObjs.forEach((item, i) => {
            if (i >= childArray.length) return;
            const childValue = childArray[i];
            const childObj = mItems[i].obj;

            if (childObj.getClassName && childObj.getClassName() === 'ObjArray') {
                childObj.setValue(childValue, initialize, mFactory);
            } else {
                item.paramObj.setValue(childValue, initialize);
            }
        });

        // 8. Finalize folder names
        renameAll();
        if (mOnChange) mOnChange();
    }

    // Apply { id: value, ... } to the children with those ids.
    function setValueById(patch, initialize = false) {
        for (const [id, childValue] of Object.entries(patch)) {
            const i = mItems.findIndex(it => it.obj.getId && it.obj.getId() === id);
            if (i < 0) {
                console.warn(`ParamObjArray.setValue(): no child with id "${id}" in "${mName}"`);
                continue;
            }
            mParamObjs[i].paramObj.setValue(childValue, initialize);
        }
        if (mOnChange) mOnChange();
    }

    // ── list mutation ─────────────────────────────────────────────────────────

    // Helper: rename all child folders to match their current ids.
    // Uses a two-phase approach (temp names → final names) so that sibling
    // swaps (e.g. colormap ↔ colormap2) don't block each other.
    function renameAll() {
        const TMP = '\x00__tmp__';
        // Phase 1: move every folder to a guaranteed-unique temp name.
        mParamObjs.forEach((entry, i) => entry.paramObj.setName(TMP + i));

        // Zombie Cleanup: Since all live layers are now named TMP+i, any other
        // folder left in __folders is a ghost from a previous state that failed
        // to cleanly destroy. Destroy them now so they don't block Phase 2.
        if (mFolder && mFolder.__folders) {
            for (const key in mFolder.__folders) {
                if (!key.startsWith(TMP)) {
                    console.warn(`[ParamObjArray] renameAll: removing zombie folder "${key}"`);
                    mFolder.removeFolder(mFolder.__folders[key]);
                }
            }
        }

        // Phase 2: compute deduplicated target names, then apply them.
        // When multiple children share the same base name (e.g. three identical
        // "GL simulation" workers), append " (2)", " (3)", … to keep names unique
        // so that setName() does not bail out due to dat.GUI collision.
        const takenNames = new Set();
        const finalNames = mParamObjs.map((entry, i) => {
            let name = indexedFolderName(i, mItems[i].obj);
            if (takenNames.has(name)) {
                let n = 2;
                while (takenNames.has(`${name} (${n})`)) n++;
                name = `${name} (${n})`;
            }
            takenNames.add(name);
            return name;
        });
        mParamObjs.forEach((entry, i) => {
            entry.paramObj.setName(finalNames[i]);
            entry.name = finalNames[i];
            mItems[i].name = finalNames[i];
        });
    }

    // Helper: put the child folders into the list folder in list order
    // (appended one by one, they line up after the title row).
    function placeItemFolders() {
        if (!mFolder || !mFolder.__ul) return;
        mParamObjs.forEach(entry => {
            const li = entry.paramObj.getFolder()?.domElement?.parentElement;
            if (li) mFolder.__ul.appendChild(li);
        });
    }

    // Helper: create a ParamObj entry and wire id-change callback.
    // initialName: optional override for the folder's creation-time name (use for collision-safe temp names).
    function makeEntry(obj, insertIdx, initialName) {
        const name = indexedFolderName(insertIdx, obj);
        const paramObj = ParamObj({ name: initialName ?? name, obj });
        if (obj.setOnIdChange) obj.setOnIdChange(() => {
            const i = mParamObjs.findIndex(e => e.paramObj === paramObj);
            if (i >= 0) paramObj.setName(indexedFolderName(i, obj));
        });
        return { name, paramObj, menuBtn: null };
    }

    // Add a new child at the end of the list using the given class name.
    function addChildAtEnd(className) {
        return addChild(className);
    }

    // Add a new child of the given class name at insertIdx (default: the end).
    // Returns the new child object, or null when there is no factory.
    function addChild(className, insertIdx = mParamObjs.length) {
        if (!mFactory) { console.warn('ParamObjArray: no factory — cannot add'); return null; }
        const newObj = mFactory.getObject(className);
        if (!newObj) return null;
        insertIdx = Math.max(0, Math.min(insertIdx, mParamObjs.length));

        // Propagate factory to nested ObjArrays so they also get a + button.
        if (newObj.setFactory) newObj.setFactory(mFactory);

        mObjArray.addChild(newObj, insertIdx);
        mItems.splice(insertIdx, 0, { name: '', obj: newObj });

        // Use a temp name for creation so dat.GUI addFolder never collides with
        // an existing folder of the same base name. renameAll() below will
        // assign the correct deduplicated display name (e.g. "GL simulation (4)").
        const tmpName = '\x00__add__' + insertIdx;
        const entry = makeEntry(newObj, insertIdx, tmpName);
        mParamObjs.splice(insertIdx, 0, entry);

        if (mFolder) {
            // The folder is created at the end of mFolder; move it into place
            // when the child was not appended.
            entry.paramObj.createUI(mFolder);
            attachItemControls(entry);
            placeItemFolders();
        }
        renameAll();
        if (mOnChange) mOnChange();
        return newObj;
    }

    // Add a copy of the child of the given entry below it: a new child of its class
    // gets its values, except the id, which becomes the next free one of its kind
    // ("colorTiles" -> "colorTiles2", "img2" -> "img3").
    function duplicateChild(entry) {
        const i     = mParamObjs.indexOf(entry);
        const obj   = entry.paramObj.getObj();
        const id    = obj.getId ? obj.getId() : '';
        const newId = id ? uniqueChildId(id) : '';
        const value = cloneValue(entry.paramObj.getValue());
        const copy  = addChild(obj.getClassName(), i + 1);
        if (!copy) return null;
        if (newId) {
            if (value && value.params && 'id' in value.params) value.params.id = newId;
            else if (value && 'id' in value) value.id = newId;
        }
        const copyEntry = mParamObjs[i + 1];
        copyEntry.paramObj.setValue(value);
        if (newId && copy.getId && copy.getId() !== newId) getIdSetter(copy)?.(newId);
        renameAll();
        if (mOnChange) mOnChange();
        return copy;
    }

    // base itself when no child has that id, else base with the next free number.
    function uniqueChildId(base) {
        const taken = new Set(mItems.map(it => (it.obj.getId ? it.obj.getId() : '')));
        const m     = /^(.*?)(\d+)$/.exec(base);
        const stem  = m ? m[1] : base;
        let n = m ? Number(m[2]) + 1 : 2;
        while (taken.has(stem + n)) n++;
        return stem + n;
    }

    // Ask for a new id of the child of the given entry; one taken by another child is refused.
    async function renameChild(entry) {
        const obj   = entry.paramObj.getObj();
        const setId = getIdSetter(obj);
        if (!setId) return;
        const oldId  = obj.getId ? obj.getId() : '';
        const others = mItems.filter(it => it.obj !== obj)
                             .map(it => (it.obj.getId ? it.obj.getId() : ''));
        if (!sPrompt) sPrompt = createPromptDialog();
        const id = await sPrompt.prompt({
            title:    'Rename',
            label:    'Name:',
            value:    oldId,
            okLabel:  'Rename',
            validate: async (v) => !v ? 'The name is empty.'
                                 : others.includes(v) ? `"${v}" is taken.` : null,
        });
        if (id === null || id === oldId || !mParamObjs.includes(entry)) return;
        setId(id);
        renameAll();
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
        if (mOnChange) mOnChange();
    }

    // Move child at index i by delta (-1 = up, +1 = down).
    function moveChildAt(i, delta) {
        moveChildTo(i, i + delta);
    }

    // Move child at index i to index j (its index after the move).
    function moveChildTo(i, j) {
        const n = mParamObjs.length;
        if (i < 0 || i >= n) return;
        j = Math.max(0, Math.min(j, n - 1));
        if (i === j) return;
        mParamObjs.splice(j, 0, ...mParamObjs.splice(i, 1));
        mItems.splice(j, 0, ...mItems.splice(i, 1));
        mObjArray.moveChild(i, j);
        placeItemFolders();
        renameAll();
        if (mOnChange) mOnChange();
    }

    // ── init / inspection ─────────────────────────────────────────────────────

    function init() {
        mParamObjs.forEach(({ paramObj }) => paramObj.init());
    }

    function getItems() { return mItems.slice(); }

    return { createUI, getValue, setValue, init, getItems, addChild, removeChildAt, moveChildAt, moveChildTo,
             duplicateChild: (i) => duplicateChild(mParamObjs[i]), renameAll };

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
                children: mChildren.map(child => getChildValue(child)),
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

        mChildren.forEach((child, i) => {
            if (i < childArray.length) {
                setChildValue(child, childArray[i], initialize);
            }
        });
    }

    return {
        getId,
        getClassName: () => 'ObjArray',
        getChildWithId,
        getChildren,
        getValue,
        setValue,
        setFactory:  (f) => { mFactory = f; },
        addChild:     (newObj, atIdx = mChildren.length) => mChildren.splice(atIdx, 0, newObj),
        removeChild:  (atIdx)           => mChildren.splice(atIdx, 1),
        replaceChild: (atIdx, newObj)   => mChildren.splice(atIdx, 1, newObj),
        moveChild:    (fromIdx, toIdx)  => { const [c] = mChildren.splice(fromIdx, 1); mChildren.splice(toIdx, 0, c); },
    };

} // ObjArray()

export { ParamObj, ParamObjArray, Obj, ObjArray };
