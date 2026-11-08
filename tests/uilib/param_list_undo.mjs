/*
  tests of the undo steps of a list of objects with params (uilib
  ParamListUndo.js), as the visualization layers window makes them

    node tests/uilib/param_list_undo.mjs

  1. diffParamList: a value, an object added, removed, moved, renamed (and
     its values), an item of an object's list, the whole list otherwise
  2. createParamListUndo over a ParamObjArray of things, one holding a list
     of its own: the user's edits are steps, undone and done again on the
     drawing's UndoStack; a drag of one gesture is one step; changes not in
     the user's input and the owner's own are no steps and stay through an
     undo of another object's step; after a load the earlier steps do nothing
*/

import { diffParamList, createParamListUndo } from '../../lib/uilib/ParamListUndo.js';
import { ParamObjArray, ObjArray } from '../../lib/uilib/paramobj.js';
import { ParamFloat, ParamString } from '../../lib/uilib/param.js';
import { UndoStack } from '../../lib/drawlib/UndoStack.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const settle = () => new Promise(r => setTimeout(r, 0));

// 1 ───────────────────────────────────────────────────────────────────────────

const thing = (id, x = 0, cls = 'Thing') => ({ className: cls, params: { id, x, s: '' } });
const list = (...children) => ({ className: 'ObjArray', params: { id: 'layers', children } });
const box = (id, ...items) => ({ className: 'Box', params: { id, x: 0, items: list(...items) } });
const types = (ops) => ops.map(o => o.type).join(' ');

{
    const a = list(thing('a'), thing('b'));
    check(same(diffParamList(a, a), []), 'no change: no edits');
    const ops = diffParamList(a, list(thing('a'), thing('b', 5)));
    check(types(ops) === 'value' && ops[0].id === 'b' && ops[0].key === 'x' && ops[0].before === 0 && ops[0].after === 5, 'a value');
    const ins = diffParamList(a, list(thing('a'), thing('c', 2), thing('b')));
    check(types(ins) === 'insert' && ins[0].index === 1 && ins[0].value.params.id === 'c', 'an object added');
    const rem = diffParamList(a, list(thing('b')));
    check(types(rem) === 'remove' && rem[0].index === 0 && rem[0].value.params.id === 'a', 'an object removed');
    const mov = diffParamList(list(thing('a'), thing('b'), thing('c')), list(thing('b'), thing('c'), thing('a')));
    check(types(mov) === 'move' && mov[0].id === 'a' && mov[0].from === 0 && mov[0].to === 2, 'an object moved');
    const swap = [list(thing('a'), thing('b'), thing('c')), list(thing('a'), thing('c'), thing('b'))];
    const swapB = diffParamList(...swap, 'b'), swapC = diffParamList(...swap, 'c');
    check(swapB[0].id === 'b' && swapB[0].to === 2 && swapC[0].id === 'c' && swapC[0].to === 1, 'neighbours swapped: the preferred one moved');
    const ren = diffParamList(a, list(thing('a'), thing('z', 3)));
    check(types(ren) === 'rename value' && ren[0].from === 'b' && ren[0].to === 'z' && ren[1].id === 'z', 'renamed, with its value');
    const nested = diffParamList(list(box('o', thing('t'))), list(box('o', thing('g', 1), thing('t'))));
    check(types(nested) === 'insert' && same(nested[0].list, ['o', 'items']) && nested[0].index === 0, 'an item added in an object\'s list');
    const nestedValue = diffParamList(list(box('o', thing('t'))), list(box('o', thing('t', 4))));
    check(types(nestedValue) === 'value' && same(nestedValue[0].list, ['o', 'items']) && nestedValue[0].id === 't', 'an item\'s value');
    const two = diffParamList(a, list(thing('b'), thing('c')));
    check(types(two) === 'replace', 'two edits at once: the whole list');
    const cls = diffParamList(a, list(thing('a'), thing('b', 0, 'Other')));
    check(types(cls) === 'replace', 'another class under an id: the whole list');
}

// 2 ───────────────────────────────────────────────────────────────────────────

let notify = () => {};
let system = false;
let nextId = 1;

/** a thing of params id, x, s; a box has a list of things too */
function Thing(cls = 'Thing', id = cls.toLowerCase() + (nextId++)){
    const cfg = { id, x: 0, s: '' };
    let onId = null;
    const onChange = () => notify();
    const params = {
        id: ParamString({ obj: cfg, key: 'id', onChange: () => { if (onId) onId(); } }),
        x:  ParamFloat({ obj: cfg, key: 'x', onChange }),
        s:  ParamString({ obj: cfg, key: 's', onChange }),
    };
    if (cls === 'Box') {
        const holder = { items: ObjArray({ id: 'items', children: [] }) };
        params.items = ParamObjArray({ obj: holder, key: 'items', factory, onChange });
    }
    return { getId: () => cfg.id, getClassName: () => cls, getParams: () => params, setOnIdChange: (cb) => { onId = cb; } };
}
const factory = {
    getObject: (cls) => Thing(cls),
    getNames: () => ['Thing', 'Box'],
    getDefaultName: () => 'Thing',
};

const holder = { layers: ObjArray({ id: 'layers', children: [Thing('Thing', 'a'), Thing('Thing', 'b'), Thing('Box', 'o')] }) };
const layers = ParamObjArray({ obj: holder, key: 'layers', factory, onChange: () => notify() });

const stack = UndoStack();
let user = true;
let gesture = 1;
const input = { inEvent: () => user, gesture: () => gesture };
let applied = null;
const undo = createParamListUndo({ param: layers, push: stack.push, label: 'vis', input, onApplied: (obj) => { applied = obj; } });
notify = () => undo.changed(system);

const objs = () => layers.getItems().map(it => it.obj);
const ids = () => objs().map(o => o.getId()).join(' ');
const obj = (id) => objs().find(o => o.getId() === id);
const x = (id) => obj(id).getParams().x.getValue();
const items = () => obj('o').getParams().items;
const itemIds = () => items().getItems().map(it => it.obj.getId()).join(' ');

// a value
obj('a').getParams().x.setValue(3);
await settle();
check(stack.canUndo() && stack.undoLabel() === 'vis: a x', 'a value: one step, labelled');
stack.undo();
check(x('a') === 0 && applied === obj('a'), 'undone, the object told');
stack.redo();
check(x('a') === 3, 'done again');

// a drag of one gesture is one step, a new gesture another
gesture++;
for (const v of [1, 2, 3, 4]) { obj('b').getParams().x.setValue(v); await settle(); }
gesture++;
obj('b').getParams().x.setValue(9);
await settle();
stack.undo();
check(x('b') === 4, 'the second gesture undone alone');
stack.undo();
check(x('b') === 0, 'the drag undone in one step');
stack.redo(); stack.redo();
check(x('b') === 9, 'both done again');

// changes not in the user's input, and the owner's own: no steps
const labelBefore = stack.undoLabel();
user = false;
obj('a').getParams().s.setValue('later');
await settle();
user = true;
system = true;
obj('b').getParams().s.setValue('system');
await settle();
system = false;
check(stack.undoLabel() === labelBefore, 'no steps of changes outside the user\'s input or the owner\'s');

// they stay through an undo of another object's step
gesture++;
obj('a').getParams().x.setValue(7);
await settle();
user = false;
obj('b').getParams().s.setValue('async');
await settle();
user = true;
stack.undo();
check(x('a') === 3 && obj('b').getParams().s.getValue() === 'async', 'an undo sets back its own params only');

// add, undo, redo with the same id and values
const added = layers.addChild('Thing', 1);
added.getParams().x.setValue(5);   // in the same task: one step
await settle();
const addedId = added.getId();
check(stack.undoLabel() === 'vis: add ' + addedId && ids() === `a ${addedId} b o`, 'add: one step');
stack.undo();
check(ids() === 'a b o', 'add undone');
stack.redo();
check(ids() === `a ${addedId} b o` && x(addedId) === 5 && applied === obj(addedId), 'add done again: the same id and value, the object told');

// remove, undo puts it back in its place with its values
layers.removeChildAt(1);
await settle();
check(ids() === 'a b o' && stack.undoLabel() === 'vis: remove ' + addedId, 'remove: one step');
stack.undo();
check(ids() === `a ${addedId} b o` && x(addedId) === 5, 'remove undone: in its place, its values');
stack.redo();
check(ids() === 'a b o', 'remove done again');

// move
layers.moveChildTo(0, 2);
await settle();
check(ids() === 'b o a', 'moved');
stack.undo();
check(ids() === 'a b o', 'move undone');
stack.redo();
check(ids() === 'b o a', 'move done again');
stack.undo();

// rename
layers.setChildId(1, 'bee');
await settle();
check(ids() === 'a bee o' && stack.undoLabel() === 'vis: rename b', 'rename: one step');
stack.undo();
check(ids() === 'a b o' && x('b') === 9, 'rename undone, its values kept');
stack.redo();
check(ids() === 'a bee o', 'rename done again');
stack.undo();

// duplicate
const copy = layers.duplicateChild(0);
await settle();
const copyId = copy.getId();
check(ids() === `a ${copyId} b o` && x(copyId) === 3, 'duplicate');
stack.undo();
check(ids() === 'a b o', 'duplicate undone');
stack.redo();
check(ids() === `a ${copyId} b o` && x(copyId) === 3, 'duplicate done again');
stack.undo();

// an item in a box's list: added, its value, moved
const item = items().addChild('Thing', 0);
await settle();
const itemId = item.getId();
check(itemIds() === itemId, 'an item added');
item.getParams().x.setValue(2);
await settle();
const item2 = items().addChild('Thing', 1);
await settle();
items().moveChildTo(1, 0);
await settle();
check(itemIds() === `${item2.getId()} ${itemId}`, 'items added and moved');
stack.undo();
check(itemIds() === `${itemId} ${item2.getId()}`, 'the item\'s move undone');
stack.undo(); stack.undo();
const back = items().getItems()[0].obj;
check(itemIds() === itemId && back.getParams().x.getValue() === 0, 'the second item and the value undone');
stack.undo();
check(itemIds() === '', 'the first item undone');
stack.redo(); stack.redo();
check(itemIds() === itemId && items().getItems()[0].obj.getParams().x.getValue() === 2, 'the item and its value done again');

// a load: the earlier steps do nothing
gesture++;
obj('a').getParams().x.setValue(11);
await settle();
system = true;
undo.changed(true, true);
obj('a').getParams().x.setValue(20);   // the loaded document's value
await settle();
system = false;
stack.undo();
check(x('a') === 20, 'a step from before a load does nothing');

console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exitCode = 1;
