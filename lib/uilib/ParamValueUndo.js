/*
  ParamValueUndo.js — undo steps of the edits of a value made of params (a
  group of params: SymRenderer's symmetry), found by comparing the value
  before and after; one step per gesture.

  The owner tells it of every change of the value (changed(system, load)).
  The changes made while the user's input is handled (InputWatch: in its
  event's task, or while a pointer's button is down) become steps: at the
  end of the task (after what its handlers left for microtasks) the value is
  compared with the value before, and the values that differ are the step,
  set back by undo and again by redo. The steps of one gesture are one: the
  stack joins them (the mergeKey is the gesture), the top one taking the
  next in (merge), so that its undo has every value the gesture changed (and
  its label names them); a gesture that puts the values back as they were
  leaves no step (a drag put back by Escape). While a pointer's button is down they join whatever the
  time (join: a drag held still, a spin button held).

  The value is a plain object. An object in it that has a className (an
  object's value as ParamObj gives it, {className, params}) is one value,
  compared and set as a whole: its setParamsMap may not take a part of it.
  Arrays are values too. setValue(part) gets the values to set in the order
  of the value's keys (a group type before its group).

  Changes the owner makes itself (system: a document loaded, a script's
  values) and those the page makes later on its own (a timer, a worker's
  answer) are no steps: the next step starts from them. A step made before a
  document was loaded (changed(true, true)) does nothing afterwards. Two
  kinds of later changes are the user's all the same, as the owner says
  while it makes them:
    amend()   what changes now follows from the last step (the sides a search
              found for the group the user changed): it joins that step while
              the step is the top of the stack, else it is a step of its own
    step()    what changes now answers a command of the user's that took a
              while (a search they started): a step of its own

  An undo or a redo calls beforeApply() first, then setValue(part), then
  onApplied(); no change made meanwhile is a step, and no amend() joins the
  step afterwards.

  Usage:
    const undo = createParamValueUndo({
        getValue,       // () => the value (a plain object)
        setValue,       // (part) => set these values (a part of the value)
        push,           // (entry) => the undo stack's push (UndoStack)
        label,          // put before the steps' labels ('symmetry')
        describe,       // (ops) => what a step changed ('group K'), optional
        input,          // an InputWatch (default: a new one)
        beforeApply,    // () => before an undo or a redo sets values, optional
        onApplied,      // () => after it, optional
    });
    owner: on every change   undo.changed(system, load)
           before an undo     undo.flush()   (a step still to be looked at)

  diffParamValue(before, after) → the ops [{path, before, after}];
  partOfValue(ops, side, order) → the part of a value they set (exported for
  the tests).
*/

import {
    createInputWatch,
} from './modules.js';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isWhole = (v) => isPlain(v) && 'className' in v;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const pathKey = (path) => JSON.stringify(path);

function diffInto(b, a, path, ops){
    if (same(b, a)) return;
    if (isPlain(b) && isPlain(a) && !isWhole(b) && !isWhole(a)) {
        const keys = [...Object.keys(a), ...Object.keys(b).filter(k => !(k in a))];
        for (const k of keys) diffInto(b[k], a[k], [...path, k], ops);
        return;
    }
    ops.push({ path, before: clone(b), after: clone(a) });
}

/**
 * the values that differ from one value to another: [{path, before, after}],
 * [] when they are the same. path: the keys down to the value (an object with
 * a className, an array or a number, text, ...); before or after undefined
 * where the key is missing
 */
export function diffParamValue(before, after){
    const ops = [];
    diffInto(before, after, [], ops);
    return ops;
}

/** where a path's keys stand in a value: their indices, level by level */
function rank(path, order){
    const r = [];
    let v = order;
    for (const k of path) {
        const keys = isPlain(v) ? Object.keys(v) : [];
        const i = keys.indexOf(k);
        r.push(i < 0 ? keys.length : i);
        v = isPlain(v) ? v[k] : undefined;
    }
    return r;
}

function compareRanks(a, b){
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

/**
 * the part of a value that sets the ops' values of one side ('before' or
 * 'after'), its keys in the order of the value order (when given); a value
 * missing on that side is left out
 */
export function partOfValue(ops, side, order = null){
    const list = order ? ops.slice().sort((x, y) => compareRanks(rank(x.path, order), rank(y.path, order))) : ops;
    let part = {};
    for (const op of list) {
        const v = op[side];
        if (v === undefined) continue;
        if (!op.path.length) return clone(v);
        let at = part;
        for (const k of op.path.slice(0, -1)) {
            if (!isPlain(at[k])) at[k] = {};
            at = at[k];
        }
        at[op.path[op.path.length - 1]] = clone(v);
    }
    return part;
}

/**
 * @param {object}   arg
 * @param {function} arg.getValue
 * @param {function} arg.setValue       (part)
 * @param {function} arg.push           the undo stack's push(entry)
 * @param {string}   [arg.label]
 * @param {function} [arg.describe]     (ops) => text
 * @param {object}   [arg.input]        {inEvent(), held(), gesture()} (an InputWatch)
 * @param {function} [arg.beforeApply]
 * @param {function} [arg.onApplied]
 */
export function createParamValueUndo(arg){

    const input = arg.input || createInputWatch();
    const prefix = arg.label ? arg.label + ': ' : '';
    const held = () => !!(input.held && input.held());
    const snapshot = () => clone(arg.getValue());

    let mBase = snapshot();     // the value the next step starts from
    let mEvent = false;         // a change in the user's input event since the last look
    let mHeld = false;          // a change while a pointer's button was down (a timer of the control held)
    let mGesture = 0;           // the gesture of the first of them
    let mSystem = false;        // a change of the owner's own
    let mAmend = false;         // what changes follows from the last step
    let mLater = false;         // what changes answers a command of the user's
    let mTimer = null;          // the look at the end of the task
    let mApplying = false;      // an undo or a redo being done
    let mEpoch = 0;             // the documents loaded: a step of an earlier one does nothing
    let mLastKey = null;        // the mergeKey of the last step, which amend() joins
    let mLaterCount = 0;

    function describe(ops){
        const text = arg.describe ? arg.describe(ops) : '';
        if (text) return text;
        const keys = [...new Set(ops.map(o => o.path.join('.')))];
        return keys.length > 2 ? `${keys.slice(0, 2).join(', ')} …` : keys.join(', ');
    }

    function apply(st, side){
        if (st.epoch !== mEpoch) return;
        mApplying = true;
        try {
            if (arg.beforeApply) arg.beforeApply();
            arg.setValue(partOfValue([...st.ops.values()], side, mBase));
        } finally {
            mApplying = false;
        }
        mBase = snapshot();
        mEvent = mHeld = mSystem = mAmend = mLater = false;
        mLastKey = null;
        if (arg.onApplied) arg.onApplied();
    }

    /** the stack's entry of a step; the top entry takes the next of its gesture in */
    function entry(ops, mergeKey, join){
        const st = { ops: new Map(ops.map(o => [pathKey(o.path), o])), epoch: mEpoch };
        return {
            label:    prefix + describe(ops),
            mergeKey,
            join,
            step:     st,
            undo:     () => apply(st, 'before'),
            redo:     () => apply(st, 'after'),
            merge:    (next) => {
                if (!next.step) return true;
                for (const [key, op] of next.step.ops) {
                    const mine = st.ops.get(key);
                    if (mine) mine.after = op.after;
                    else st.ops.set(key, { ...op });
                }
                for (const [key, op] of st.ops) {
                    if (same(op.before, op.after)) st.ops.delete(key);
                }
                return st.ops.size > 0 ? prefix + describe([...st.ops.values()]) : false;
            },
        };
    }

    function look(){
        clearTimeout(mTimer);
        mTimer = null;
        const now = snapshot();
        const ops = diffParamValue(mBase, now);
        if (ops.length && !mSystem) {
            if (mEvent) {
                const key = `${prefix}${mEpoch}:${mGesture}`;
                arg.push(entry(ops, key, mHeld));
                mLastKey = key;
            } else if (mAmend && mLastKey) {
                arg.push(entry(ops, mLastKey, true));
            } else if (mAmend || mLater) {
                const key = `${prefix}${mEpoch}:later${++mLaterCount}`;
                arg.push(entry(ops, key, false));
                mLastKey = key;
            } else if (mHeld) {
                const key = `${prefix}${mEpoch}:${mGesture}`;
                arg.push(entry(ops, key, true));
                mLastKey = key;
            }
        }
        mBase = now;
        mEvent = mHeld = mSystem = mAmend = mLater = false;
    }

    function schedule(){
        // at the end of the task: what its microtasks change is in the same step
        if (!mTimer) mTimer = setTimeout(look, 0);
    }

    /**
     * the value changed
     * @param {boolean} [system]  the owner's own change (not the user's)
     * @param {boolean} [load]    a document loaded: the steps made before do nothing
     */
    function changed(system = false, load = false){
        if (mApplying) return;
        if (load) {
            mEpoch++;
            mLastKey = null;
        }
        if (system) {
            mSystem = true;
        } else {
            const inEvent = input.inEvent();
            const isHeld = held();
            if ((inEvent || isHeld) && !mEvent && !mHeld) mGesture = input.gesture();
            if (inEvent) mEvent = true;
            if (isHeld) mHeld = true;
        }
        schedule();
    }

    return {
        changed,
        /** what changes now follows from the last step: it joins it (while it is the top) */
        amend(){ if (!mApplying) { mAmend = true; schedule(); } },
        /** what changes now answers a command of the user's: a step of its own */
        step(){ if (!mApplying) { mLater = true; schedule(); } },
        /** a look still to come, now: before an undo or a redo */
        flush(){ if (mTimer) look(); },
        /** the values now are where the next step starts (nothing recorded) */
        rebase(){
            clearTimeout(mTimer);
            mTimer = null;
            mBase = snapshot();
            mEvent = mHeld = mSystem = mAmend = mLater = false;
        },
    };
}
