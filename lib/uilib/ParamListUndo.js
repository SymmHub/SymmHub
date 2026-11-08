/*
  ParamListUndo.js — undo steps of the edits of a ParamObjArray: a list of
  objects (layers) with params, which may hold lists of their own (an
  overlay's items).

  The owner tells it of every change of the list or of its objects
  (changed(system)). The changes made while the user's input is handled
  (InputWatch) become one step per task (compared at its end, after what
  its handlers left for microtasks), found by comparing the list's value
  before and after:
    - an object added, removed, moved or renamed (in the list or in a list
      an object holds): that edit, done again or undone through the list
      (the other objects stay as they are);
    - values of objects changed: those params set back by their keys, the
      object's other params as they are; the steps of one drag or of typing
      in one field are one (the stack's mergeKey: the gesture and the keys);
    - anything else: the whole list's value set back.
  Changes the owner makes itself (system: a document loaded, the group
  changed) and those the page makes later on its own (a table come from a
  worker) are no steps: the next step starts from them. A step made before a
  document was loaded (changed(true, true)) does nothing afterwards: the
  objects it knew are gone.

  An undo or a redo calls onApplied(obj) with the object it changed (the
  owner selects it). Two neighbours swapped are one of them moved: the one
  the owner works on (arg.prefer(): its id, the selected row) if it is one
  of them.

  Usage:
    const undo = createParamListUndo({
        param,              // the ParamObjArray, or () => it
        push,               // (entry) => the undo stack's push ({label, mergeKey, undo, redo})
        label,              // put before the steps' labels ('visualization')
        input,              // an InputWatch (default: a new one)
        onApplied,          // (obj) after an undo or a redo
        prefer,             // () => the id of the object worked on (optional)
    });
    owner: on every change  undo.changed(system, load)

  diffParamList(before, after, prefer) → the edits from one list value to
  another (exported for the tests).
*/

import {
    setParamValues,
    createInputWatch,
} from './modules.js';

// ── list values ─────────────────────────────────────────────────────────────

const idOf = (v) => (v && v.params ? v.params.id : v ? v.id : undefined);
const paramsOf = (v) => (v && v.params ? v.params : v || {});
const isList = (v) => !!(v && v.className === 'ObjArray' && v.params && Array.isArray(v.params.children));
const childrenOf = (v) => (isList(v) ? v.params.children : Array.isArray(v) ? v : []);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const without = (a, k) => a.filter((_, i) => i !== k);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** the one edit making ids b into ids a: an insert, a remove, a rename or a
 *  move (of the preferred id when two moves do it); null if none */
function structureEdit(b, a, bIds, aIds, list, prefer){
    if (aIds.length === bIds.length + 1) {
        for (let k = 0; k < aIds.length; k++) {
            if (sameIds(without(aIds, k), bIds)) return { type: 'insert', list, index: k, value: a[k] };
        }
    }
    if (bIds.length === aIds.length + 1) {
        for (let k = 0; k < bIds.length; k++) {
            if (sameIds(without(bIds, k), aIds)) return { type: 'remove', list, index: k, value: b[k] };
        }
    }
    if (bIds.length === aIds.length) {
        const at = bIds.map((id, i) => (id !== aIds[i] ? i : -1)).filter(i => i >= 0);
        if (at.length === 1 && !aIds.includes(bIds[at[0]]) && !bIds.includes(aIds[at[0]])) {
            return { type: 'rename', list, from: bIds[at[0]], to: aIds[at[0]] };
        }
        const moves = [];
        for (let from = 0; from < bIds.length; from++) {
            const id = bIds[from];
            const to = aIds.indexOf(id);
            if (to < 0 || to === from) continue;
            const moved = without(bIds, from);
            moved.splice(to, 0, id);
            if (sameIds(moved, aIds)) moves.push({ type: 'move', list, id, from, to });
        }
        if (moves.length) return moves.find(m => m.id === prefer) || moves[0];
    }
    return null;
}

/** the value edits of one object (its id the new one), the lists it holds compared as lists */
function diffObject(b, a, list, ops, prefer){
    const id = idOf(a);
    const pb = paramsOf(b), pa = paramsOf(a);
    const keys = [...Object.keys(pa), ...Object.keys(pb).filter(k => !(k in pa))];
    for (const key of keys) {
        if (key === 'id') continue;
        const vb = pb[key], va = pa[key];
        if (same(vb, va)) continue;
        if (isList(vb) && isList(va)) diffList(vb, va, [...list, id, key], ops, prefer);
        else ops.push({ type: 'value', list, id, key, before: vb, after: va });
    }
}

function diffList(B, A, list, ops, prefer){
    if (same(B, A)) return;
    const b = childrenOf(B), a = childrenOf(A);
    const bIds = b.map(idOf), aIds = a.map(idOf);
    const replace = () => ops.push({ type: 'replace', list, before: B, after: A });
    const unique = (ids) => ids.every(id => id !== undefined && id !== '') && new Set(ids).size === ids.length;
    if (!unique(bIds) || !unique(aIds)) { replace(); return; }

    let edit = null;
    if (!sameIds(bIds, aIds)) {
        edit = structureEdit(b, a, bIds, aIds, list, prefer);
        if (!edit) { replace(); return; }
    }
    // the objects in both, by their id after the edit
    const newId = (id) => (edit && edit.type === 'rename' && id === edit.from ? edit.to : id);
    const before = new Map(b.map(v => [newId(idOf(v)), v]));
    const pairs = a.filter(v => before.has(idOf(v))).map(v => [before.get(idOf(v)), v]);
    if (pairs.some(([vb, va]) => (vb && vb.className) !== (va && va.className))) { replace(); return; }

    if (edit) ops.push(edit);
    for (const [vb, va] of pairs) diffObject(vb, va, list, ops, prefer);
}

/**
 * The edits from one value of a list to another (ObjArray values, or arrays
 * of children): [] when they are the same.
 *   {type: 'value', list, id, key, before, after}   a param of the object id
 *   {type: 'insert', list, index, value}            an object added at index
 *   {type: 'remove', list, index, value}            the object at index removed
 *   {type: 'move', list, id, from, to}
 *   {type: 'rename', list, from, to}
 *   {type: 'replace', list, before, after}          the whole list
 * list: the path from the top list to the list edited, pairs of an object's
 * id and the key of its list ([] the top list, ['overlay', 'overlays'] the
 * items of the object overlay). prefer: an id; when two neighbours swapped,
 * the move is of this one if it is one of them.
 */
export function diffParamList(before, after, prefer = null){
    const ops = [];
    diffList(before, after, [], ops, prefer);
    return ops;
}

// ── the live list ───────────────────────────────────────────────────────────

const objectsOf = (param) => (param && param.getItems ? param.getItems().map(it => it.obj) : []);
const objId = (obj) => (obj && obj.getId ? obj.getId() : undefined);

/** the ParamObjArray at a path of pairs (id, key) from the top one; null when gone */
function listAt(top, path){
    let param = top;
    for (let i = 0; i < path.length; i += 2) {
        const obj = objectsOf(param).find(o => objId(o) === path[i]);
        param = obj && obj.getParams ? obj.getParams()[path[i + 1]] : null;
        if (!param) return null;
    }
    return param;
}

/** one edit done (forward) or undone; the object it changed, if any */
function applyEdit(top, op, forward){
    const param = listAt(top, op.list);
    if (!param) return null;
    const at = (id) => objectsOf(param).findIndex(o => objId(o) === id);
    const objAt = (i) => (i >= 0 ? objectsOf(param)[i] : null);
    const insert = (value, index) => (param.insertChild ? param.insertChild(clone(value), index) : null);
    const remove = (id) => { const i = at(id); if (i >= 0) param.removeChildAt(i); return null; };
    switch (op.type) {
    case 'value': {
        const obj = objAt(at(op.id));
        const value = forward ? op.after : op.before;
        if (!obj || !obj.getParams || value === undefined) return null;
        setParamValues(obj.getParams(), { [op.key]: clone(value) });
        return obj;
    }
    case 'insert':
        return forward ? insert(op.value, op.index) : remove(idOf(op.value));
    case 'remove':
        return forward ? remove(idOf(op.value)) : insert(op.value, op.index);
    case 'move': {
        const i = at(op.id);
        if (i < 0) return null;
        param.moveChildTo(i, forward ? op.to : op.from);
        return objAt(at(op.id));
    }
    case 'rename': {
        const [from, to] = forward ? [op.from, op.to] : [op.to, op.from];
        const i = at(from);
        if (i < 0 || !param.setChildId) return null;
        param.setChildId(i, to);
        return objAt(i);
    }
    case 'replace':
        param.setValue(clone(forward ? op.after : op.before));
        return null;
    }
    return null;
}

function stepLabel(ops){
    const op = ops[0];
    const what = { insert: 'add', remove: 'remove', move: 'move', rename: 'rename', replace: 'change' };
    if (ops.every(o => o.type === 'value')) {
        const ids = [...new Set(ops.map(o => o.id))];
        const keys = [...new Set(ops.map(o => o.key))];
        return ids.join(' ') + ' ' + (keys.length === 1 ? keys[0] : 'values');
    }
    const name = op.type === 'insert' || op.type === 'remove' ? idOf(op.value)
               : op.type === 'rename' ? op.from : op.type === 'move' ? op.id : '';
    return [what[op.type] || op.type, name].filter(Boolean).join(' ');
}

/**
 * @param {object}   arg
 * @param {object|function} arg.param  the ParamObjArray, or a function giving it
 * @param {function} arg.push          the undo stack's push(entry)
 * @param {string}   [arg.label]
 * @param {object}   [arg.input]       {inEvent(), gesture()} (an InputWatch)
 * @param {function} [arg.onApplied]   (obj) after an undo or a redo changed obj
 * @param {function} [arg.prefer]      () => the id of the object the user works on
 */
export function createParamListUndo(arg){

    const param = () => (typeof arg.param === 'function' ? arg.param() : arg.param);
    const input = arg.input || createInputWatch();
    const prefix = arg.label ? arg.label + ': ' : '';

    const snapshot = () => clone(param().getValue());

    let mBase = snapshot();     // the list's value the next step starts from
    let mUser = false;          // a change made in the user's input since the last look
    let mGesture = 0;           // the press of the first of them
    let mSystem = false;        // a change of the owner's own since the last look
    let mPending = false;
    let mApplying = false;      // an undo or a redo being done
    let mEpoch = 0;             // the documents loaded: a step of an earlier one does nothing

    function apply(ops, forward, epoch){
        if (epoch !== mEpoch) return;
        let first = null;
        mApplying = true;
        try {
            const list = forward ? ops : ops.slice().reverse();
            for (const op of list) {
                const obj = applyEdit(param(), op, forward);
                if (obj && !first) first = obj;
            }
        } finally {
            mApplying = false;
        }
        mBase = snapshot();
        mUser = mSystem = false;
        if (first && arg.onApplied) arg.onApplied(first);
    }

    function look(){
        mPending = false;
        const now = snapshot();
        if (mUser && !mSystem) {
            const ops = diffParamList(mBase, now, arg.prefer ? arg.prefer() : null);
            if (ops.length) {
                const values = ops.every(o => o.type === 'value');
                const epoch = mEpoch;
                arg.push({
                    label:    prefix + stepLabel(ops),
                    mergeKey: values ? `${prefix}${mGesture}:` + ops.map(o => [...o.list, o.id, o.key].join('/')).join(',') : null,
                    undo:     () => apply(ops, false, epoch),
                    redo:     () => apply(ops, true, epoch),
                });
            }
        }
        mBase = now;
        mUser = mSystem = false;
    }

    /**
     * the list or one of its objects changed
     * @param {boolean} [system]  the owner's own change (not the user's)
     * @param {boolean} [load]    a document loaded: the steps made before do nothing
     */
    function changed(system = false, load = false){
        if (mApplying) return;
        if (load) mEpoch++;
        if (system) mSystem = true;
        else if (input.inEvent() && !mUser) { mUser = true; mGesture = input.gesture(); }
        if (mPending) return;
        mPending = true;
        // at the end of the task: what its microtasks change (a promise of
        // the subgroup chooser) is in the same step
        setTimeout(look, 0);
    }

    return {
        changed,
        // the values now are where the next step starts (nothing recorded)
        rebase(){ mBase = snapshot(); mUser = mSystem = false; },
    };
}
