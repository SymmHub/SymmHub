/*
  tests of the undo steps of the edits of the list of conformal transformations
  (lib/symhublib/TransformsUndo.js over ProjectionTransform.js), on an UndoStack
  as the page has it

    node tests/symhublib/transforms_undo.mjs

  1. the rows' edits are steps, undone and done again: a row added, its value
     (a drag of one gesture one step), its switch, moved, renamed, duplicated,
     removed; the row a step changed is told (the window selects it)
  2. the switch of the whole list is a step of its own, the rows stay
  3. no steps: a change outside the user's input; a document loaded, after which
     the steps made before do nothing
  4. the list's own changes are no steps and take no step with them: the points
     a fixed points row finds again when the group changed, with an edit of the
     user's before it and after it in the same task; the frames of an animated row
  5. the word of a fixed points row: one step, with the points found from it;
     a duplicate of the row is one step
*/

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { ProjectionTransform } = await import('../../lib/symhublib/ProjectionTransform.js');
const { createTransformsUndo } = await import('../../lib/symhublib/TransformsUndo.js');
const { UndoStack } = await import('../../lib/uilib/UndoStack.js');
const { Group, iSphere } = await import('../../lib/invlib/invlib.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (ok) return;
    failed++;
    process.stdout.write('FAILED: ' + what + '\n');
}
console.log = () => {};
console.trace = () => {};

const settle = () => new Promise(r => setTimeout(r, 0));
const listOf = (rows) => ({ className: 'ObjArray', params: { id: 'maps', children: rows } });
const near = (a, b) => Math.abs(a - b) < 1e-9;

// the user's input, as an InputWatch tells it
let user = true;
let gesture = 1;
const input = { inEvent: () => user, held: () => false, gesture: () => gesture };

/** a list with its undo on a stack */
function setup(groupMaker = null){
    const list = ProjectionTransform(groupMaker ? { groupMaker } : {});
    const stack = UndoStack();
    const told = [];
    createTransformsUndo({ list, push: stack.push, input, onApplied: (row) => told.push(row) });
    const maps = () => list.getParams().maps;
    const rows = () => list.getMaps();
    return {
        list, stack, told, maps, rows,
        ids:   () => rows().map(r => r.getId()).join(' '),
        row:   (id) => rows().find(r => r.getId() === id),
        value: (id, key) => rows().find(r => r.getId() === id).getParams()[key].getValue(),
        set:   (id, key, v) => rows().find(r => r.getId() === id).getParams()[key].setValue(v),
        whole: () => list.getParams().enabled,
    };
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const t = setup();
    const { stack } = t;

    // a row added
    const band = t.maps().addChild('ConformalBand');
    await settle();
    check(t.ids() === 'band' && stack.undoLabel() === 'transformations: add band', `add: one step (${stack.undoLabel()})`);
    stack.undo();
    check(t.ids() === '' && !stack.canUndo(), 'add undone: the list is empty');
    stack.redo();
    check(t.ids() === 'band' && t.told[t.told.length - 1] === t.row('band'), 'add done again, the row told');
    check(band !== t.row('band'), 'the row done again is a new one of the same id');

    // a value: the moves of one gesture are one step, the next gesture another
    gesture++;
    for (const v of [0.9, 0.8, 0.7]) { t.set('band', 'fraction', v); await settle(); }
    check(stack.undoLabel() === 'transformations: band fraction', `a value: its step (${stack.undoLabel()})`);
    gesture++;
    t.set('band', 'fraction', 0.2);
    await settle();
    stack.undo();
    check(near(t.value('band', 'fraction'), 0.7), 'the second gesture undone alone');
    stack.undo();
    check(near(t.value('band', 'fraction'), 1), 'the drag undone in one step');
    check(stack.undoLabel() === 'transformations: add band', 'and the add is the next');
    stack.redo(); stack.redo();
    check(near(t.value('band', 'fraction'), 0.2), 'both done again');

    // the row's switch
    gesture++;
    t.set('band', 'enabled', false);
    await settle();
    check(stack.undoLabel() === 'transformations: band enabled' && t.list.getChain(0).length === 0, 'the row switched off: a step, no chain');
    stack.undo();
    check(t.value('band', 'enabled') === true && t.list.getChain(0).length === 1, 'undone: on again, its step in the chain');

    // more rows; a move
    t.maps().addChild('ConformalExp');
    await settle();
    t.maps().addChild('ConformalRational');
    await settle();
    check(t.ids() === 'band exponent rational', 'three rows');
    t.maps().moveChildTo(0, 2);
    await settle();
    check(t.ids() === 'exponent rational band' && stack.undoLabel() === 'transformations: move band', `moved: a step (${stack.undoLabel()})`);
    check(t.list.getChain(0).map(s => s.kind).join(' ') === 'band rational exp', 'the chain follows, the last row first');
    stack.undo();
    check(t.ids() === 'band exponent rational' && t.list.getChain(0).map(s => s.kind).join(' ') === 'rational exp band', 'move undone, the chain too');
    stack.redo();
    check(t.ids() === 'exponent rational band', 'move done again');
    stack.undo();

    // a rename keeps the values
    t.maps().setChildId(0, 'strip');
    await settle();
    check(t.ids() === 'strip exponent rational' && stack.undoLabel() === 'transformations: rename band', 'renamed: a step');
    stack.undo();
    check(t.ids() === 'band exponent rational' && near(t.value('band', 'fraction'), 0.2), 'rename undone, the value kept');
    stack.redo();
    check(t.ids() === 'strip exponent rational', 'rename done again');
    stack.undo();

    // a duplicate
    const copy = t.maps().duplicateChild(0);
    await settle();
    check(t.ids() === 'band band2 exponent rational' && near(copy.getParams().fraction.getValue(), 0.2), 'duplicated');
    check(stack.undoLabel() === 'transformations: add band2', `one step (${stack.undoLabel()})`);
    stack.undo();
    check(t.ids() === 'band exponent rational', 'duplicate undone');
    stack.redo();
    check(t.ids() === 'band band2 exponent rational' && near(t.value('band2', 'fraction'), 0.2), 'duplicate done again, with its value');

    // a removal comes back in its place with its values
    gesture++;
    t.set('rational', 'x1', 0.25);
    await settle();
    t.maps().removeChildAt(3);
    await settle();
    check(t.ids() === 'band band2 exponent' && stack.undoLabel() === 'transformations: remove rational', 'removed: a step');
    stack.undo();
    check(t.ids() === 'band band2 exponent rational' && near(t.value('rational', 'x1'), 0.25), 'removal undone: in its place, its value');
    check(t.told[t.told.length - 1] === t.row('rational'), 'the row put back is told');
    stack.redo();
    check(t.ids() === 'band band2 exponent', 'removal done again');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const t = setup();
    const { stack } = t;
    t.maps().addChild('ConformalBand');
    await settle();
    gesture++;
    t.whole().setValue(false);
    await settle();
    check(stack.undoLabel() === 'transformations: all off' && t.list.getChain(0).length === 0, `the whole switched off: a step (${stack.undoLabel()})`);
    check(t.value('band', 'enabled') === true, 'the row\'s own switch stays');
    stack.undo();
    check(t.whole().getValue() === true && t.list.getChain(0).length === 1, 'undone: the list acts again');
    check(t.told[t.told.length - 1] === null, 'no row told');
    check(stack.undoLabel() === 'transformations: add band', 'the add is the next step');
    stack.redo();
    check(t.whole().getValue() === false && stack.undoLabel() === 'transformations: all off', 'done again');
    gesture++;
    t.whole().setValue(true);
    await settle();
    check(stack.undoLabel() === 'transformations: all on', 'switched on: a step of its own');
    // a row's edit and the whole's are two steps, undone one by one
    gesture++;
    t.set('band', 'fraction', 0.5);
    await settle();
    stack.undo();
    check(near(t.value('band', 'fraction'), 1) && t.whole().getValue() === true, 'the row\'s step undone, the whole as it is');
    stack.undo();
    check(t.whole().getValue() === false, 'then the whole\'s');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const t = setup();
    const { stack } = t;
    t.maps().addChild('ConformalBand');
    await settle();
    const label = stack.undoLabel();

    // not in the user's input: a script, a timer
    user = false;
    t.set('band', 'fraction', 0.3);
    t.maps().addChild('ConformalExp');
    t.whole().setValue(false);
    await settle();
    user = true;
    check(stack.undoLabel() === label, 'changes outside the user\'s input are no steps');
    // and they stay through an undo of a later step
    gesture++;
    t.set('exponent', 'enabled', false);
    await settle();
    stack.undo();
    check(near(t.value('band', 'fraction'), 0.3) && t.ids() === 'band exponent' && t.whole().getValue() === false, 'an undo sets back its own values only');
    stack.redo();

    // a document loaded: no step, and the steps before it do nothing
    const before = stack.undoLabel();
    t.list.setParamsMap({ enabled: true, maps: listOf([
        { className: 'ConformalScale', params: { id: 'scale', enabled: true, n1: 3 } },
        { className: 'ConformalBand', params: { id: 'band', enabled: true, fraction: 0.6 } }]) }, true);
    await settle();
    check(stack.undoLabel() === before && t.ids() === 'scale band', 'a document loaded is no step');
    while (stack.canUndo()) stack.undo();
    check(t.ids() === 'scale band' && near(t.value('band', 'fraction'), 0.6) && t.whole().getValue() === true, 'the steps made before it do nothing');
    while (stack.canRedo()) stack.redo();
    check(t.ids() === 'scale band' && near(t.value('band', 'fraction'), 0.6), 'done again neither');
    // the edits after it are steps
    gesture++;
    t.set('band', 'fraction', 0.1);
    await settle();
    stack.undo();
    check(near(t.value('band', 'fraction'), 0.6), 'an edit of the loaded document is a step');

    // the old shape of a document (the fixed maps) is a load as well
    t.list.setParamsMap({ enabled: true, bandMap: { enabled: true, fraction: 0.4 }, expMap: { enabled: true } }, true);
    await settle();
    check(t.ids() === 'band exponent' && near(t.value('band', 'fraction'), 0.4), 'a document of the fixed maps loaded');
    stack.redo();
    check(near(t.value('band', 'fraction'), 0.4), 'and the step before it does nothing');
}

// 4 ───────────────────────────────────────────────────────────────────────────

// two groups of one hyperbolic translation: along the y axis (its fixed points
// (0, 1) and (0, -1)) and along the x axis ((1, 0) and (-1, 0))
const R3 = Math.sqrt(3);
const groupY = new Group({ s: [iSphere([0, 2, 0, R3]), iSphere([0, -2, 0, R3])] });
const groupX = new Group({ s: [iSphere([2, 0, 0, R3]), iSphere([-2, 0, 0, R3])] });
const points = (t, id = 'fixedPoints') => ['fp0x', 'fp0y', 'fp1x', 'fp1y'].map(k => t.value(id, k));
const alongY = (p) => near(p[0], 0) && near(Math.abs(p[1]), 1) && near(p[2], 0) && near(p[1] + p[3], 0);
const alongX = (p) => near(p[1], 0) && near(Math.abs(p[0]), 1) && near(p[3], 0) && near(p[0] + p[2], 0);

{
    let group = groupY;
    const t = setup({ getGroup: () => group });
    const { stack } = t;
    const FP = { className: 'FixedPointTransform', params: { id: 'fixedPoints', enabled: true, word: 'ab', orientation: '1,-1' } };
    t.list.setParamsMap({ enabled: true, maps: listOf([FP, { className: 'ConformalBand', params: { id: 'band', enabled: true, fraction: 1 } }]) }, true);
    t.list.getChain(0);
    await settle();
    check(alongY(points(t)), `the row has the points of its word in the group: ${points(t)}`);
    check(!stack.canUndo(), 'found at the load: no step');

    // the group changed (the symmetry's step, not the list's): found again at the next frame, no step
    group = groupX;
    t.list.onGroupChanged(group);
    t.list.getChain(0);
    await settle();
    check(alongX(points(t)) && !stack.canUndo(), `the group changed: the points found again, no step (${points(t)})`);

    // the same in the task of an edit of the user's, after it (a frame comes before
    // the task's end): the edit is a step, and the points are not in it
    group = groupY;
    t.list.onGroupChanged(group);
    gesture++;
    t.set('band', 'fraction', 0.5);
    t.list.getChain(0);
    await settle();
    check(alongY(points(t)), 'the points found again');
    check(stack.undoLabel() === 'transformations: band fraction', `the edit before it is a step (${stack.undoLabel() || 'none'})`);
    stack.undo();
    check(near(t.value('band', 'fraction'), 1) && alongY(points(t)), 'undone: the value back, the points as the group has them');
    check(!stack.canUndo(), 'one step');
    stack.redo();

    // an edit after it in the same task is a step too
    group = groupX;
    t.list.onGroupChanged(group);
    t.list.getChain(0);
    gesture++;
    t.set('band', 'fraction', 0.25);
    await settle();
    check(alongX(points(t)) && stack.undoLabel() === 'transformations: band fraction', 'the edit after it is a step');
    stack.undo();
    check(near(t.value('band', 'fraction'), 0.5) && alongX(points(t)), 'undone: the value back, the points stay');
    stack.redo();

    // a row that was off while the group changed, switched on: the switch is the step,
    // the points it finds at the next frame are not in it
    gesture++;
    t.set('fixedPoints', 'enabled', false);
    await settle();
    group = groupY;
    t.list.onGroupChanged(group);
    t.list.getChain(0);
    await settle();
    check(alongX(points(t)), 'a row that is off keeps its points');
    gesture++;
    t.set('fixedPoints', 'enabled', true);
    t.list.getChain(0);
    await settle();
    check(alongY(points(t)) && stack.undoLabel() === 'transformations: fixedPoints enabled', `switched on: the points found, the step is the switch (${stack.undoLabel()})`);
    stack.undo();
    check(t.value('fixedPoints', 'enabled') === false && alongY(points(t)), 'undone: off, the points as the group has them');
    stack.redo();
    check(t.value('fixedPoints', 'enabled') === true && alongY(points(t)), 'done again');

    // an animated row: its frames are no steps, an edit in a frame's task is one, without the frame's value
    gesture++;
    t.set('fixedPoints', 'animate', true);
    await settle();
    const label = stack.undoLabel();
    check(label === 'transformations: fixedPoints animate', 'animate: a step');
    const un = {};
    t.list.getUniforms(un, 1000);
    const f1 = t.value('fixedPoints', 'fraction');
    await settle();
    t.list.getUniforms(un, 2300);
    const f2 = t.value('fixedPoints', 'fraction');
    await settle();
    check(f1 !== f2 && stack.undoLabel() === label, `the frames move the fraction (${f1.toFixed(2)}, ${f2.toFixed(2)}) and are no steps`);
    gesture++;
    t.set('band', 'fraction', 0.75);
    t.list.getUniforms(un, 3100);
    const f3 = t.value('fixedPoints', 'fraction');
    await settle();
    check(stack.undoLabel() === 'transformations: band fraction', `an edit in a frame's task is a step (${stack.undoLabel()})`);
    stack.undo();
    check(near(t.value('band', 'fraction'), 0.25) && t.value('fixedPoints', 'fraction') === f3, 'undone: the value back, the frame\'s fraction left alone');
    check(stack.undoLabel() === label, 'the animate step is the next');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    // a group of two translations: 'ab' along the y axis, 'cd' along the x axis
    const group = new Group({ s: [iSphere([0, 2, 0, R3]), iSphere([0, -2, 0, R3]), iSphere([2, 0, 0, R3]), iSphere([-2, 0, 0, R3])] });
    const t = setup({ getGroup: () => group });
    const { stack } = t;
    t.list.setParamsMap({ enabled: true, maps: listOf([
        { className: 'FixedPointTransform', params: { id: 'fixedPoints', enabled: true, word: 'ab', orientation: '1,-1' } }]) }, true);
    t.list.getChain(0);
    await settle();
    check(alongY(points(t)) && !stack.canUndo(), `the points of the word ab: ${points(t)}`);

    gesture++;
    t.set('fixedPoints', 'word', 'cd');
    t.list.getChain(0);
    await settle();
    check(alongX(points(t)), `the word typed: its points (${points(t)})`);
    check(stack.canUndo() && /^transformations: fixedPoints /.test(stack.undoLabel()), `one step (${stack.undoLabel()})`);
    stack.undo();
    check(t.value('fixedPoints', 'word') === 'ab' && alongY(points(t)) && !stack.canUndo(), 'undone: the word and its points back');
    t.list.getChain(0);
    await settle();
    check(alongY(points(t)) && !stack.canUndo(), 'and the next frame makes no step');
    stack.redo();
    check(t.value('fixedPoints', 'word') === 'cd' && alongX(points(t)), 'done again');

    // a duplicate of the row: one step
    const copy = t.maps().duplicateChild(0);
    t.list.getChain(0);
    await settle();
    check(t.ids() === 'fixedPoints fixedPoints2' && copy.getParams().word.getValue() === 'cd' && alongX(points(t, 'fixedPoints2')), 'duplicated with its word and points');
    check(stack.undoLabel() === 'transformations: add fixedPoints2', `one step (${stack.undoLabel()})`);
    stack.undo();
    check(t.ids() === 'fixedPoints' && /^transformations: fixedPoints /.test(stack.undoLabel()), 'undone in one step');
    stack.redo();
    check(t.ids() === 'fixedPoints fixedPoints2' && t.value('fixedPoints2', 'word') === 'cd' && alongX(points(t, 'fixedPoints2')), 'done again: the word and the points');
}

process.stdout.write((failed ? `transforms_undo: ${failed} of ${checks} FAILED` : `transforms_undo: all ${checks} passed`) + '\n');
process.exit(failed ? 1 : 0);
