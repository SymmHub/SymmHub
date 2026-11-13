/*
  tests of the undo steps of the symmetry's edits (phase E of docs/symmetry_tool_plan.md):
  uilib UndoStack, InputWatch and ParamValueUndo, symhublib SymmetryUndo with the
  Dirichlet tool

    node tests/symhublib/symmetry_undo.mjs

  1. UndoStack: entries of one mergeKey join within MERGE_MS, or whatever the time with
     join; merge(next) takes the next in, false drops the top; push tells whether it joined
  2. InputWatch: held() from a press to its release; keys during a press, a key's
     repeats and modifier keys alone start no gesture
  3. ParamValueUndo: the ops of two values (an object with a className and an array as
     wholes), the part they set in the order of the value's keys; the steps of the user's
     changes, one per gesture with every value it changed, none for a gesture that puts
     the values back; join while a button is down; the owner's own changes no steps;
     amend() joins the last step while it is the top, step() is a step of its own; a
     load makes the steps before it nothing
  4. SymmetryUndo over a symmetry param as SymRenderer makes it (group type, a group
     maker, the transform, the Dirichlet tool's params), on a page's stack: a change of
     the group and the sides its search finds are one step, undone and done again with
     the sides kept; a gesture's moves of two values, a group type and back, the search
     button's sides, a script's values and a document are no steps where they should not
     be; the sides become a step of their own when something else lies on top; labels
  5. on a page without a stack: a stack of its own, Ctrl+Z and Ctrl+Y in the Symmetry
     tool only, cleared by a document
*/

import { UndoStack, MERGE_MS } from '../../lib/uilib/UndoStack.js';
import { createInputWatch } from '../../lib/uilib/InputWatch.js';
import { createParamValueUndo, diffParamValue, partOfValue } from '../../lib/uilib/ParamValueUndo.js';
import { createSymmetryUndo, symmetryUndoValue, describeSymmetryStep } from '../../lib/symhublib/SymmetryUndo.js';
import { DirichletDomainTool } from '../../lib/symhublib/DirichletDomainTool.js';
import { Group_Cyclic, Group_KLM } from '../../lib/grouplib/grouplib.js';
import { ParamGroup, ParamChoice, ParamFloat } from '../../lib/uilib/param.js';
import { ParamObj } from '../../lib/uilib/paramobj.js';

const log = console.log;
let failures = 0;
let checks = 0;
function check(cond, what) {
  checks++;
  if (!cond) { failures++; log(`   FAILED: ${what}`); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const settle = () => new Promise(r => setTimeout(r, 0));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the makers and the search in the page say a lot
console.warn = () => {};
const quiet = (on) => { console.log = on ? () => {} : log; };

// the time of the stacks: moved on by hand
const realNow = Date.now;
let timeShift = 0;
Date.now = () => realNow() + timeShift;

// 1 ───────────────────────────────────────────────────────────────────────────

log('1. UndoStack');
{
  const stack = UndoStack();
  const done = [];
  const entry = (name, key, more = {}) => ({ label: name, mergeKey: key, undo: () => done.push(`undo ${name}`), redo: () => done.push(`redo ${name}`), ...more });
  check(stack.push(entry('a', 'k')) === false, 'the first entry stands alone');
  check(stack.push(entry('b', 'k')) === true, 'the next of its mergeKey joins it');
  stack.undo(); stack.redo();
  check(same(done, ['undo a', 'redo b']), `joined: the first one's undo, the last one's redo: ${done.join(', ')}`);
  timeShift += MERGE_MS + 100;
  check(stack.push(entry('c', 'k')) === false, 'after MERGE_MS it stands alone');
  timeShift += MERGE_MS + 100;
  check(stack.push(entry('d', 'k', { join: true })) === true, 'join: whatever the time');
  check(stack.push(entry('e', 'other')) === false && stack.undoLabel() === 'e', 'another mergeKey stands alone');

  const merged = [];
  let keep = true;
  const top = entry('m', 'm', { merge: (next) => { merged.push(next.label); return keep; } });
  stack.push(top);
  stack.push(entry('n', 'm'));
  check(same(merged, ['n']) && stack.undoLabel() === 'm', 'merge(next): the top takes the next in');
  keep = false;
  stack.push(entry('o', 'm'));
  check(same(merged, ['n', 'o']) && stack.undoLabel() === 'e', 'merge(next) false: the top goes');
  stack.undo();
  check(stack.canRedo(), 'undone');
  stack.push(entry('p', 'q'));
  check(!stack.canRedo(), 'a push ends the redos');
}

// 2 ───────────────────────────────────────────────────────────────────────────

log('2. InputWatch');
{
  const target = new EventTarget();
  const watch = createInputWatch(target);
  const fire = (type, props = {}) => {
    const e = new Event(type);
    for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
    target.dispatchEvent(e);
  };
  check(!watch.held() && watch.gesture() === 0 && !watch.inEvent(), 'nothing yet');
  fire('pointerdown', { buttons: 1 });
  const g = watch.gesture();
  check(watch.held() && g === 1 && watch.inEvent(), 'a press: held, a gesture');
  fire('pointermove', { buttons: 1 });
  fire('keydown', { key: 'Shift' });
  fire('keydown', { key: 'Escape' });
  check(watch.gesture() === g && watch.held(), 'Shift and Escape during the press: the same gesture');
  fire('pointerup', { buttons: 0 });
  check(!watch.held(), 'released');
  fire('keydown', { key: 'a' });
  check(watch.gesture() === g + 1, 'a key: a gesture');
  fire('keydown', { key: 'a', repeat: true });
  fire('keydown', { key: 'Control' });
  check(watch.gesture() === g + 1, 'its repeats and a modifier alone: the same');
  fire('click', { buttons: 0 });
  check(watch.gesture() === g + 2, 'a click: a gesture');
  fire('pointerdown', { buttons: 1 });
  fire('pointermove', { buttons: 0 });
  check(!watch.held(), 'a move without a button: the release was missed');
  await settle();
  check(!watch.inEvent(), 'the task after: not in an event');
  watch.dispose();
}

// 3 ───────────────────────────────────────────────────────────────────────────

log('3. ParamValueUndo');
{
  const before = { a: 1, b: { c: 2, d: [1, 2] }, g: { className: 'X', params: { k: 1, j: 2 } }, t: 'x' };
  const after = { a: 1, b: { c: 3, d: [1, 2, 3] }, g: { className: 'X', params: { k: 1, j: 5 } }, t: 'x', n: 4 };
  const ops = diffParamValue(before, after);
  check(same(ops.map(o => o.path.join('.')), ['b.c', 'b.d', 'g', 'n']), `the ops: ${ops.map(o => o.path.join('.')).join(' ')}`);
  check(same(ops[2].before, before.g) && same(ops[2].after, after.g), 'an object with a className: a whole');
  check(ops[3].before === undefined && ops[3].after === 4, 'a key new after');
  check(same(diffParamValue(before, JSON.parse(JSON.stringify(before))), []), 'the same values: no ops');
  const part = partOfValue(ops.slice().reverse(), 'before', after);
  check(same(Object.keys(part), ['b', 'g']) && same(part.b, { c: 2, d: [1, 2] }) && !('n' in part),
        `the part, in the value's order, a missing value left out: ${JSON.stringify(part)}`);
  check(same(Object.keys(partOfValue(ops, 'after', { n: 0, g: 0, b: 0 })), ['n', 'g', 'b']), 'the order of the value given');

  // the recorder over a plain value
  const value = { x: 0, y: 0, s: '' };
  const stack = UndoStack();
  let user = true, isHeld = false, gesture = 1;
  const input = { inEvent: () => user, held: () => isHeld, gesture: () => gesture };
  let applied = 0, before2 = 0;
  const undo = createParamValueUndo({
    getValue: () => ({ ...value }),
    setValue: (p) => { Object.assign(value, p); undo.changed(); },
    push: stack.push,
    label: 'v',
    input,
    beforeApply: () => before2++,
    onApplied: () => applied++,
  });
  const set = (k, v) => { value[k] = v; undo.changed(); };

  set('x', 1); await settle();
  check(stack.undoLabel() === 'v: x', `a change: a step: ${stack.undoLabel()}`);
  stack.undo();
  check(value.x === 0 && applied === 1 && before2 === 1, 'undone, beforeApply and onApplied');
  stack.redo();
  check(value.x === 1, 'done again');
  await settle();
  check(!stack.canRedo(), 'its own setValue: no step');

  gesture++;
  set('x', 2); await settle();
  set('y', 5); await settle();
  set('x', 3); await settle();
  stack.undo();
  check(value.x === 1 && value.y === 0, 'one gesture of two values: one step with both');
  stack.redo();
  check(value.x === 3 && value.y === 5, 'and both again');

  gesture++;
  set('s', 'gone'); await settle();
  set('s', ''); await settle();
  check(stack.undoLabel() === 'v: x, y', 'a gesture that puts the values back: no step');

  gesture++;
  isHeld = true;
  set('x', 4); await settle();
  timeShift += MERGE_MS * 2;
  user = false;                 // a timer of the control held
  set('x', 5); await settle();
  isHeld = false; user = true;
  stack.undo();
  check(value.x === 3, 'held: the steps of the press join whatever the time');
  stack.redo();

  const label = stack.undoLabel();
  user = false;
  set('y', 7); await settle();
  check(stack.undoLabel() === label && !stack.canRedo(), 'a change outside the user\'s input: no step');
  user = true;
  undo.changed(true);
  value.s = 'script';
  await settle();
  check(stack.undoLabel() === label, 'the owner\'s own change: no step');
  stack.undo();
  check(value.x === 3 && value.y === 7 && value.s === 'script', 'an undo leaves the values changed since alone');
  stack.redo();

  // amend and step
  gesture++;
  set('x', 6); await settle();
  user = false;
  undo.amend();
  set('s', 'sides'); await settle();
  stack.undo();
  check(value.x === 5 && value.s === 'script', 'amend(): joins the last step');
  stack.redo();
  stack.push({ label: 'other', undo() {}, redo() {} });
  undo.amend();
  set('s', 'more'); await settle();
  check(stack.undoLabel() === 'v: s', 'amend() with another step on top: a step of its own');
  undo.step();
  set('y', 8); await settle();
  check(stack.undoLabel() === 'v: y', 'step(): a step of its own');
  stack.undo();
  check(value.y === 7, 'undone');
  undo.amend();
  set('s', 'after undo'); await settle();
  check(stack.undoLabel() === 'v: s' && !stack.canRedo(), 'after an undo, amend() joins nothing');
  user = true;

  // a load
  gesture++;
  set('x', 9); await settle();
  undo.changed(true, true);
  value.x = 100;
  await settle();
  stack.undo();
  check(value.x === 100, 'a step before a load does nothing');

  // flush
  gesture++;
  set('y', 11);
  undo.flush();
  check(stack.undoLabel() === 'v: y', 'flush(): the step now');
  await settle();
}

// 4 ───────────────────────────────────────────────────────────────────────────

const BASE = { baseX: 0.0307934744, baseY: -0.0015787202 };
const WORDS = 'a b a8 a9 b8 b9';             // the sides of the cyclic group at ArgLambda 21
const SETTLED_MS = 700;                      // more than the end of a change and a search here

/** SymRenderer's symmetry, as far as the undo sees it; page: the page's stack or null */
function makeRenderer(page) {
  const cfg = { groupType: 'Group_Cyclic', transform: { translationX: 0, translationY: 0, rotation: 0, scale: 1 } };
  const makers = { Group_Cyclic: () => new Group_Cyclic(), Group_KLM: () => new Group_KLM() };
  const input = { user: false, held: false, gesture: 1 };
  const watch = { inEvent: () => input.user, held: () => input.held, gesture: () => input.gesture };
  let maker = makers.Group_Cyclic();
  let frameQueued = false;
  let applied = 0;

  const undo = createSymmetryUndo({
    page: () => page,
    beforeApply: () => dirichlet.holdSides(),
    onApplied: () => applied++,
    input: watch,
  });
  const dirichlet = DirichletDomainTool({ onChanged: onGroupChanged, history: undo.history });

  function onGroupChanged() {
    undo.changed();
    if (!frameQueued) {
      frameQueued = true;
      setTimeout(frame, 0);
    }
  }
  // the next frame: the Dirichlet tool takes the group
  function frame() {
    frameQueued = false;
    dirichlet.apply(maker.getGroup());
  }
  maker.setOptions({ onChanged: onGroupChanged });
  const groupParam = ParamObj({ name: 'group params', obj: maker });
  function onGroupTypeChanged() {
    maker = makers[cfg.groupType]();
    groupParam.replaceObj(maker);
    maker.setOptions({ onChanged: onGroupChanged });
    onGroupChanged();
  }
  const t = cfg.transform;
  const symmetry = ParamGroup({ name: 'symmetry', params: {
    groupType: ParamChoice({ obj: cfg, key: 'groupType', choice: Object.keys(makers), onChange: onGroupTypeChanged }),
    group: groupParam,
    transform: ParamGroup({ name: 'group transform', params: {
      translationX: ParamFloat({ obj: t, key: 'translationX', onChange: onGroupChanged }),
      translationY: ParamFloat({ obj: t, key: 'translationY', onChange: onGroupChanged }),
      rotation: ParamFloat({ obj: t, key: 'rotation', onChange: onGroupChanged }),
      scale: ParamFloat({ obj: t, key: 'scale', onChange: onGroupChanged }),
    } }),
    dirichlet: dirichlet.getParams(),
  } });
  undo.watch(symmetry);

  return {
    undo, dirichlet, symmetry, input,
    maker: () => maker,
    applied: () => applied,
    words: () => dirichlet.getConfig().words,
    closed: () => !!dirichlet.getResult()?.check?.ok,
    /** an edit of the user's hand: in an event of a gesture of its own (or the same) */
    user(fn, { newGesture = true, held = false } = {}) {
      if (newGesture) input.gesture++;
      input.user = true;
      input.held = held;
      fn();
      input.user = false;
      input.held = false;
    },
    load(values) {
      symmetry.init();
      symmetry.setValue(values, true);
    },
    frame,
  };
}

/** the page's stack as SymRenderer finds it on the pattern */
function pageOf(stack) {
  return { pushUndo: stack.push, undo: stack.undo, redo: stack.redo, canUndo: stack.canUndo, canRedo: stack.canRedo };
}

const cyclicDoc = (ArgLambda, dirichlet = {}) => ({
  groupType: 'Group_Cyclic',
  group: { className: 'Group_Cyclic', params: { AbsLambda: 1.04, ArgLambda, finiteFP: true } },
  dirichlet: { enabled: true, autoSides: true, ...BASE, words: WORDS, ...dirichlet },
});

log('4. SymmetryUndo on the page\'s stack');
quiet(true);
{
  const stack = UndoStack();
  const r = makeRenderer(pageOf(stack));
  const arg = () => r.maker().getParams().ArgLambda.getValue();

  r.load(cyclicDoc(21));
  await sleep(SETTLED_MS);
  check(!stack.canUndo() && r.words() === WORDS && r.closed(), 'a document: no step, its words kept');
  check(same(Object.keys(symmetryUndoValue(r.symmetry.getValue())), ['groupType', 'group', 'transform', 'dirichlet']) &&
        same(Object.keys(symmetryUndoValue(r.symmetry.getValue()).dirichlet), ['enabled', 'baseX', 'baseY', 'words']),
        'the values recorded');

  // the group changed by the user: the search finds the sides, they join the step
  r.user(() => r.maker().getParams().ArgLambda.setValue(100));
  await sleep(SETTLED_MS);
  const found = r.words();
  check(found !== WORDS && r.closed(), `the sides of the group found: ${found}`);
  check(stack.undoLabel() === 'symmetry: group ArgLambda, Dirichlet sides', `one step, named for both: ${stack.undoLabel()}`);
  stack.undo();
  await sleep(SETTLED_MS);
  check(arg() === 21 && r.words() === WORDS && r.closed(), `undo: the group and its words back, and they stay (${arg()}, ${r.words()})`);
  check(!stack.canUndo() && stack.canRedo(), 'the change and its sides were one step');
  stack.redo();
  await sleep(SETTLED_MS);
  check(arg() === 100 && r.words() === found && r.closed(), 'redo: the group and the sides found');
  check(stack.canUndo() && !stack.canRedo(), 'nothing new after the redo');
  check(r.applied() === 2, 'onApplied after each');

  // two values in one gesture (the frame's centre), the sides with them
  r.user(() => r.symmetry.transform.translationX.setValue(0.1));
  await settle();
  r.user(() => r.symmetry.transform.translationY.setValue(0.2), { newGesture: false });
  await settle();
  r.user(() => r.symmetry.transform.translationX.setValue(0.15), { newGesture: false });
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === 'symmetry: transform', `the moves of a gesture: one step: ${stack.undoLabel()}`);
  stack.undo();
  await settle();
  const tr = r.symmetry.transform.getValue();
  check(tr.translationX === 0 && tr.translationY === 0, 'undone: both values');
  check(stack.undoLabel() === 'symmetry: group ArgLambda, Dirichlet sides', 'the step before is next');
  stack.redo();
  await settle();

  // a gesture that puts its value back (a drag and Escape): no step
  const top = stack.undoLabel();
  r.user(() => r.symmetry.transform.rotation.setValue(30), { held: true });
  await settle();
  r.user(() => r.symmetry.transform.rotation.setValue(0), { newGesture: false, held: true });
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === top, `a drag put back: no step (${stack.undoLabel()})`);

  // something else on top before the sides come: they are a step of their own
  r.user(() => r.maker().getParams().ArgLambda.setValue(60));
  await settle();
  stack.push({ label: 'drawing', undo() {}, redo() {} });
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === 'symmetry: Dirichlet sides', `the sides after another step: a step of their own (${stack.undoLabel()})`);
  const at60 = r.words();
  stack.undo();
  await sleep(SETTLED_MS);
  check(arg() === 60 && r.words() === found && stack.undoLabel() === 'drawing', 'undone: the sides alone, the group stays');
  stack.redo();
  await sleep(SETTLED_MS);
  check(r.words() === at60 && r.closed(), 'redo: the sides found');

  // the search button: a step of its own
  r.user(() => r.dirichlet.getParams().words.setValue('a b'));
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === 'symmetry: Dirichlet sides' && !r.closed(), 'sides typed: a step');
  r.user(() => r.dirichlet.getParams().autoSides.setValue(false));
  await settle();
  check(stack.undoLabel() === 'symmetry: Dirichlet sides', 'auto: no step (a setting)');
  r.user(() => r.dirichlet.autoSelect());
  await sleep(SETTLED_MS);
  check(r.closed() && r.words() !== 'a b', `the button's sides: ${r.words()}`);
  stack.undo();
  await sleep(SETTLED_MS);
  check(r.words() === 'a b', 'undo: the sides before the search');
  stack.undo();
  await sleep(SETTLED_MS);
  check(r.words() === at60, 'undo: the sides before they were typed');
  stack.redo();
  stack.redo();
  await sleep(SETTLED_MS);
  check(r.closed() && r.words() !== 'a b', 'redo, redo: the button\'s sides');

  // the group type and back (auto off: no search for the other group)
  r.user(() => r.symmetry.groupType.setValue('Group_KLM'));
  await sleep(SETTLED_MS);
  check(r.maker().getClassName() === 'Group_KLM' && stack.undoLabel() === 'symmetry: group type', `the group type: ${stack.undoLabel()}`);
  const sides = r.words();
  stack.undo();
  await sleep(SETTLED_MS);
  check(r.maker().getClassName() === 'Group_Cyclic' && arg() === 60 && r.words() === sides && r.closed(),
        'undo: the type back, its maker with the values it had, the sides kept');
  stack.redo();
  await sleep(SETTLED_MS);
  check(r.maker().getClassName() === 'Group_KLM', 'redo: the other type');
  stack.undo();
  await sleep(SETTLED_MS);
  check(r.maker().getClassName() === 'Group_Cyclic' && arg() === 60, 'and back');

  // a script's values and a document: no steps; the steps before a document do nothing
  const label = stack.undoLabel();
  r.symmetry.setValue({ transform: { translationX: 0.5 } });
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === label && r.symmetry.transform.translationX.getValue() === 0.5, 'a script\'s values: no step');
  r.load(cyclicDoc(21));
  await sleep(SETTLED_MS);
  check(stack.undoLabel() === label, 'a document: no step');
  stack.undo();
  await sleep(SETTLED_MS);
  check(arg() === 21 && r.words() === WORDS, 'a step from before the document does nothing');

  // the labels
  const op = (path, before, after) => ({ path, before, after });
  check(describeSymmetryStep([op(['group'], { className: 'K', params: { K: 3, L: 2 } }, { className: 'K', params: { K: 4, L: 2 } })]) === 'group K', 'label: a parameter of the group');
  check(describeSymmetryStep([op(['groupType'], 'A', 'B'), op(['group'], { className: 'A' }, { className: 'B' })]) === 'group type', 'label: the type');
  check(describeSymmetryStep([op(['dirichlet', 'baseX'], 0, 1), op(['dirichlet', 'baseY'], 0, 1), op(['dirichlet', 'words'], '', 'a')]) === 'Dirichlet base, Dirichlet sides', 'label: the base and the sides');
}
quiet(false);

// 5 ───────────────────────────────────────────────────────────────────────────

log('5. a page without a stack');
quiet(true);
{
  const r = makeRenderer(null);
  r.load(cyclicDoc(21, { enabled: false, words: '' }));
  await settle();
  const key = (k, more = {}) => ({ type: 'keydown', key: k, ctrlKey: true, shiftKey: false, altKey: false, ...more });
  check(!r.undo.hasPageStack() && !r.undo.canUndo(), 'no page stack, nothing to undo');
  r.user(() => r.symmetry.transform.scale.setValue(2));
  await settle();
  check(r.undo.canUndo(), 'the step on the stack of its own');
  check(r.undo.handleKey(key('z'), false) === false && r.symmetry.transform.scale.getValue() === 2, 'Ctrl+Z outside the Symmetry tool: not its key');
  check(r.undo.handleKey(key('z'), true) === true && r.symmetry.transform.scale.getValue() === 1, 'Ctrl+Z in the Symmetry tool: undone');
  check(r.undo.handleKey(key('y'), true) === true && r.symmetry.transform.scale.getValue() === 2, 'Ctrl+Y: done again');
  r.undo.handleKey(key('z'), true);
  check(r.undo.handleKey(key('Z', { shiftKey: true }), true) === true && r.symmetry.transform.scale.getValue() === 2, 'Ctrl+Shift+Z: done again');
  check(r.undo.handleKey(key('z', { ctrlKey: false }), true) === false, 'z alone: not its key');
  r.load(cyclicDoc(21, { enabled: false, words: '' }));
  await settle();
  check(!r.undo.canUndo() && !r.undo.canRedo(), 'a document clears the stack of its own');
}
quiet(false);

Date.now = realNow;
log(failures ? `\n${failures} of ${checks} checks FAILED` : `\nall ${checks} checks passed`);
process.exit(failures ? 1 : 0);
