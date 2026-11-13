//
//  UndoStack - undo and redo of edits: the drawing's, the visualization
//  layers', the symmetry's
//
//  An entry is {label, undo(), redo()}. push() records an edit that has been
//  done already. An entry pushed with the same mergeKey as the top entry,
//  within MERGE_MS of it, joins it (the drag of a slider or a color picker is
//  one step): the top entry keeps its undo and takes the new redo. Two more
//  fields of an entry change how it joins:
//    join: true     it joins the top entry of its mergeKey whatever the time:
//                   more of a gesture that goes on (a drag held still, a spin
//                   button held, the sides a search brought to the edit that
//                   asked for them)
//    merge(next)    on the top entry: it takes the next one in itself (steps
//                   that change other values each time, whose undo must have
//                   all of them); false: the two cancel out and the top entry
//                   goes (a drag put back by Escape); a text: the label of the
//                   two joined
//  push() returns true when the entry joined the top one.
//
//  In uilib since 2026-11-12 (it was drawlib's): SymRenderer keeps the
//  symmetry's steps on a stack of its own on pages without a drawing, and
//  symhublib cannot import drawlib.
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
        const joins = !!entry.mergeKey && !!top && top.mergeKey === entry.mergeKey &&
                      (!!entry.join || now - top.time < MERGE_MS);
        if (joins) {
            const merged = top.merge ? top.merge(entry) : undefined;
            if (!top.merge) {
                top.redo = entry.redo;
                top.time = now;
            } else if (merged === false) {
                mDone.pop();
            } else {
                if (typeof merged === 'string') top.label = merged;
                top.time = now;
            }
        } else {
            mDone.push({ ...entry, time: now });
            if (mDone.length > MAX_ENTRIES) mDone.shift();
        }
        mUndone = [];
        mOnChange();
        return joins;
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

export { UndoStack, MERGE_MS };
