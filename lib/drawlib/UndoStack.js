//
//  UndoStack - undo and redo of the drawing edits
//
//  An entry is {label, undo(), redo()}. push() records an edit that has been
//  done already. An entry pushed with the same mergeKey as the top entry,
//  within MERGE_MS of it, joins it (the drag of a slider or a color picker is
//  one step): the top entry keeps its undo and takes the new redo.
//

const MAX_ENTRIES = 200;
const MERGE_MS = 1500;

function UndoStack(options = {}) {

    let mDone = [];
    let mUndone = [];
    const mOnChange = options.onChange || (() => {});

    function push(entry){
        const top = mDone[mDone.length - 1];
        const now = Date.now();
        if (entry.mergeKey && top && top.mergeKey === entry.mergeKey && now - top.time < MERGE_MS) {
            top.redo = entry.redo;
            top.time = now;
        } else {
            mDone.push({ ...entry, time: now });
            if (mDone.length > MAX_ENTRIES) mDone.shift();
        }
        mUndone = [];
        mOnChange();
    }

    function undo(){
        const e = mDone.pop();
        if (!e) return false;
        e.undo();
        mUndone.push(e);
        mOnChange();
        return true;
    }

    function redo(){
        const e = mUndone.pop();
        if (!e) return false;
        e.redo();
        mDone.push({ ...e, time: 0 });
        mOnChange();
        return true;
    }

    function clear(){
        mDone = [];
        mUndone = [];
        mOnChange();
    }

    return {
        push,
        undo,
        redo,
        clear,
        canUndo:   () => mDone.length > 0,
        canRedo:   () => mUndone.length > 0,
        undoLabel: () => mDone.length ? mDone[mDone.length - 1].label : '',
        redoLabel: () => mUndone.length ? mUndone[mUndone.length - 1].label : '',
    };

} // function UndoStack()

export { UndoStack };
