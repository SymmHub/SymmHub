/*
  tests of what the transformations window shows of the list of conformal
  transformations (lib/symhublib/TransformsWindow.js: transformsNodes, listIndex;
  the window itself is checked in the browser)

    node tests/symhublib/transforms_window.mjs

  1. the rows as the list window's nodes: it takes them bottom first, so the first
     row of the list (the one acting on the pattern first, shown at the top) is the
     last node; a node has the row's id as its name, its kind's label, its switch,
     and is the active one when selected
  2. the whole switched off dims every node; the rows' own switches stay
  3. a row past the room of the shader's loop says so in its kind
  4. the list window's indices run the other way: its move from i to j is the
     list's move between the mirrored places
*/

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { ProjectionTransform } = await import('../../lib/symhublib/ProjectionTransform.js');
const { transformsNodes, listIndex } = await import('../../lib/symhublib/TransformsWindow.js');
const { VIEW_CHAIN_MAX_STEPS } = await import('../../lib/symhublib/conformal/ConformalKinds.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (ok) return;
    failed++;
    process.stdout.write('FAILED: ' + what + '\n');
}
console.log = () => {};

const listOf = (rows) => ({ className: 'ObjArray', params: { id: 'maps', children: rows } });
const keys = new Map();
const keyOf = (row) => { if (!keys.has(row)) keys.set(row, 'k' + keys.size); return keys.get(row); };

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const pt = ProjectionTransform({});
    pt.setParamsMap({ enabled: true, maps: listOf([
        { className: 'FixedPointTransform', params: { id: 'fixedPoints', enabled: true, word: 'ab', orientation: '1,-1' } },
        { className: 'ConformalBand', params: { id: 'band', enabled: false, fraction: 1 } },
        { className: 'ConformalExp', params: { id: 'exponent', enabled: true } }]) }, true);
    const rows = pt.getMaps();
    const nodes = transformsNodes(pt, keyOf, keyOf(rows[1]));
    check(nodes.map(n => n.name).join() === 'exponent,band,fixedPoints', `the nodes bottom first: ${nodes.map(n => n.name)}`);
    check(nodes.map(n => n.kind).join() === 'exponent,band,fixed points', `their kinds' labels: ${nodes.map(n => n.kind)}`);
    check(nodes.map(n => n.visible).join() === 'true,false,true', 'their switches');
    check(nodes.map(n => n.active).join() === 'false,true,false', 'the selected row is the active one');
    check(nodes.map(n => n.id).join() === [rows[2], rows[1], rows[0]].map(keyOf).join(), 'their keys');
    check(nodes.every(n => !('dimmed' in n)), 'not dimmed while the whole is on');

    // 2
    pt.getParams().enabled.setValue(false);
    const off = transformsNodes(pt, keyOf, null);
    check(off.every(n => n.dimmed === true) && off.map(n => n.visible).join() === 'true,false,true', 'the whole off: every node dimmed, the switches as they are');
    check(off.every(n => !n.active), 'no row selected');
    pt.getParams().enabled.setValue(true);

    // 4: the list window moves its top row (its index 2) down one place (to 1): the list's row 0 goes to 1
    const n = rows.length;
    check(listIndex(n, 2) === 0 && listIndex(n, 1) === 1 && listIndex(n, 0) === 2, 'the indices mirrored');
    pt.getParams().maps.moveChildTo(listIndex(n, 2), listIndex(n, 1));
    check(pt.getMaps().map(r => r.getId()).join() === 'band,fixedPoints,exponent', 'a move of the list window is the list\'s move');
    check(transformsNodes(pt, keyOf, null).map(x => x.name).join() === 'exponent,fixedPoints,band', 'and the nodes follow');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const pt = ProjectionTransform({});
    const rows = [];
    for (let i = 0; i <= VIEW_CHAIN_MAX_STEPS; i++) rows.push({ className: 'ConformalExp', params: { id: 'e' + i, enabled: true } });
    pt.setParamsMap({ enabled: true, maps: listOf(rows) }, true);
    pt.getChain(0);
    const nodes = transformsNodes(pt, keyOf, null);
    // the last row of the list (the first node) is the one without room
    check(/no room/.test(nodes[0].kind) && nodes.slice(1).every(x => x.kind === 'exponent'), `the row past the room says so: ${nodes[0].kind}`);
}

process.stdout.write((failed ? `transforms_window: ${failed} of ${checks} FAILED` : `transforms_window: all ${checks} passed`) + '\n');
process.exit(failed ? 1 : 0);
