/*
  tests of when DirichletDomainTool changes the sides by itself (lib/symhublib/DirichletDomainTool.js)

    node tests/groups/dirichlet_tool.mjs

  The tool is driven as the renderer drives it: the group comes by apply, for every frame
  in which it changed. There is no worker here, the searches run in the page.

  1. a document keeps its words, whatever the check says, and its group is no edit
  2. a change of the group with auto: the search finds the sides and tells the undo they
     follow from the edit (history.amend); an undo or a redo (holdSides, the words and the
     group as they were, set as a document sets them) keeps the words and starts nothing
  3. auto off: the words stay
  4. a group handed over (keepSides) is no edit
  5. the domain not used and no sides: nothing starts; used and no sides: the sides are found
  6. the search button: its sides are a step of their own (history.step); no undo of the
     tool's own
  (the steps of the symmetry with the sides joined: tests/symhublib/symmetry_undo.mjs)
*/

import { DirichletDomainTool } from '../../lib/symhublib/DirichletDomainTool.js';
import { Group_Cyclic, parseWords } from '../../lib/grouplib/grouplib.js';

let failures = 0;
function check(cond, what) {
  console.log(`   ${cond ? 'ok' : 'FAILED'}: ${what}`);
  if (!cond) failures++;
}

// the search in the page says so; the words of the other group are the point of some tests
console.warn = () => {};

const BASE = { baseX: 0.0307934744, baseY: -0.0015787202 };
const WORDS = 'a b a8 a9 b8 b9';             // the sides of the group at ArgLambda 21
const SETTLED_MS = 700;                      // more than the end of a change and a search here

function groupAt(ArgLambda) {
  const maker = new Group_Cyclic();
  maker.setParamsMap({ AbsLambda: 1.04, ArgLambda, finiteFP: true });
  return maker.getGroup();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function load(tool, ArgLambda, values = {}) {
  tool.getParams().setValue({ enabled: true, ...BASE, words: WORDS, ...values }, true);
  tool.apply(groupAt(ArgLambda));
}

const closed = tool => !!tool.getResult().check?.ok;

console.log('1. a document keeps its words');
{
  const tool = DirichletDomainTool();
  load(tool, 21);
  await sleep(SETTLED_MS);
  check(closed(tool) && tool.getConfig().words === WORDS, 'the words of a group they close');
  load(tool, 100);
  await sleep(SETTLED_MS);
  check(!closed(tool) && tool.getConfig().words === WORDS, 'the words of a group they do not close');
  check(tool.getConfig().autoSides, 'with auto on');
}

// the renderer's undo of the symmetry, as the tool sees it: what it is told
function fakeHistory() {
  const calls = [];
  return {
    calls,
    amend: () => calls.push('amend'),
    step: () => calls.push('step'),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    canUndo: () => true,
    canRedo: () => false,
  };
}

console.log('2. a change of the group with auto');
{
  const history = fakeHistory();
  const tool = DirichletDomainTool({ history });
  load(tool, 21);
  await sleep(SETTLED_MS);
  check(history.calls.length === 0, 'a document: nothing told');
  for (let a = 30; a <= 100; a += 10) {
    tool.apply(groupAt(a));
    await sleep(40);
  }
  await sleep(SETTLED_MS);
  const found = tool.getConfig().words;
  check(found !== WORDS && closed(tool), `the sides of the group as it ended: ${found}`);
  check(history.calls.length > 0 && history.calls.every(c => c === 'amend'),
        `the sides follow from the edit of the group (history.amend): ${history.calls.join(' ')}`);
  // an undo: the group and the words as they were before the change
  history.calls.length = 0;
  tool.holdSides();
  tool.getParams().setValue({ words: WORDS });
  tool.apply(groupAt(21));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === WORDS && closed(tool), 'an undo: the words as they were, with their group');
  // a redo: the words found, with the group they were found for
  tool.holdSides();
  tool.getParams().setValue({ words: found });
  tool.apply(groupAt(100));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === found && closed(tool), 'a redo: the words found');
  check(history.calls.length === 0, 'the undo and the redo start nothing');
  // values set back with a group the words do not close: they stay all the same
  tool.holdSides();
  tool.getParams().setValue({ words: WORDS });
  tool.apply(groupAt(90));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === WORDS && !closed(tool) && history.calls.length === 0,
        'values set back keep their words, whatever the check says');
}

console.log('3. auto off');
{
  const tool = DirichletDomainTool();
  load(tool, 21, { autoSides: false });
  await sleep(SETTLED_MS);
  tool.apply(groupAt(100));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === WORDS && !closed(tool), 'the words stay, the domain shows open');
}

console.log('4. a group handed over');
{
  const tool = DirichletDomainTool();
  load(tool, 21);
  await sleep(SETTLED_MS);
  tool.keepSides();
  tool.apply(groupAt(100));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === WORDS, 'the words stay');
  tool.apply(groupAt(101));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words !== WORDS && closed(tool), 'for that group only: the next change is an edit');
}

console.log('5. no sides');
{
  const tool = DirichletDomainTool();
  load(tool, 21, { enabled: false, words: '' });
  await sleep(SETTLED_MS);
  tool.apply(groupAt(100));
  await sleep(SETTLED_MS);
  check(tool.getConfig().words === '', 'the domain not used: nothing starts');
  tool.getParams().enabled.setValue(true);
  await sleep(SETTLED_MS);
  check(parseWords(tool.getConfig().words).length > 0 && closed(tool), `used: the sides are found: ${tool.getConfig().words}`);
}

console.log('6. the search button');
{
  const history = fakeHistory();
  const tool = DirichletDomainTool({ history });
  load(tool, 100, { autoSides: false });
  await sleep(SETTLED_MS);
  check(!closed(tool), 'the words do not close the domain of this group');
  tool.autoSelect();
  await sleep(SETTLED_MS);
  check(closed(tool) && history.calls.join(' ') === 'step', `its sides are a step of their own (history.step): ${history.calls.join(' ')}`);
  check(typeof tool.undo === 'undefined' && typeof tool.redo === 'undefined', 'no undo of its own');
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
