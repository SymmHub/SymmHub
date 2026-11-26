/*
  tests of the Tile tool (lib/drawlib/TileTool.js, docs/tile_tool_ui_plan.md
  3.1-3.3, phase 2)

    node tests/drawlib/tile_tool.mjs

  Checked here, in the 632 group:
  - taken up by a load (setActive without taken) the tool adds nothing;
  - taken up by the user on a layer without a tile: a new tile (curved, by
    default), selected, one undo step;
  - taken up again with nothing selected: the layer's topmost tile selected,
    no new one; a tile selected stays, the rest of the selection dropped; a
    tile on another layer does not count; a hidden or locked active layer
    gets none;
  - New tile and Shift+T: a tile on top, selected, the old one as it was;
  - a click on a motif drawn over the tile selects the tile (the node tool
    picks the motif); Ctrl+A with nothing selected selects the tiles alone;
  - a side drag in the tool bends the tile, its pair following;
  - Delete removes the picked node, and with none picked the tile;
  - the bar has New tile, Curved sides and Release tile, and no break, join
    or close; the right click menu neither.
  And in a bent group (KLMN bent by 20 degrees, whose domain's sides bound a
  polygon in each of the two components):
  - a new tile made by a key (T taking up the tool on a layer without one,
    Shift+T) with the pointer over the canvas is the tile of the component
    under the pointer; with the pointer off the canvas, and by the New tile
    button, the tile of the maker's domain;
  - T on a layer that has a tile selects it wherever the pointer is;
  - on a Dirichlet domain of that group whose base lies in the other
    component, the tile made without the pointer (the button, a key with the
    pointer off the canvas) is the one that holds the base, and the pointer
    over the maker's component still gets that component's tile;
  - in the 632 group, of one polygon, the pointer changes nothing.
*/

import { Group_WP, Group_Frieze, Group_Spherical, Group_KLMN, dirichletBase, selectDirichletSides, makeDirichletGroup } from '../../lib/grouplib/grouplib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { NodeTool } from '../../lib/drawlib/NodeTool.js';
import { TileTool } from '../../lib/drawlib/TileTool.js';
import { groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';
import { tileEdgeStarts, tileFromDomain } from '../../lib/drawlib/Tiles.js';
import { patternToWorldMap } from '../../lib/drawlib/Folder.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PX = 1000;
const PTC = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
const group = new Group_WP({ type: '632' }).getGroup();

function setup(of = group){
    const doc = DrawingDocument();
    doc.fromJSON({ layers: [{ id: 'layer1', items: [] }, { id: 'layer2', items: [] }] });
    doc.setOutliner(groupOutliner(of, PTC));
    const editor = DrawingEditor({
        document: doc,
        getContext: () => ({ group: of, ptc: PTC, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
    });
    editor.setStyleValue('snap', false);
    doc.setActiveLayer('layer1');
    return { doc, editor, tool: TileTool({ editor }) };
}
const pointer = (type, w, extra = {}) => ({ type, wpnt: w, canvasX: PX*w[0], canvasY: PX*w[1], offsetX: PX*w[0], offsetY: PX*w[1],
                                            button: 0, buttons: type === 'pointerup' ? 0 : 1, preventDefault(){}, ...extra });
const click = (tool, w) => { tool.handleEvent(pointer('pointerdown', w)); tool.handleEvent(pointer('pointerup', w)); };
function drag(tool, from, to){
    tool.handleEvent(pointer('pointerdown', from));
    for (let k = 1; k <= 4; k++) tool.handleEvent(pointer('pointermove', [from[0] + (to[0] - from[0])*k/4, from[1] + (to[1] - from[1])*k/4]));
    tool.handleEvent(pointer('pointerup', to));
}
function key(tool, k, extra = {}){
    const e = { type: 'keydown', key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, preventDefault(){}, stopPropagation(){}, ...extra };
    tool.handleKey(e);
    return e;
}
const tilesOf = (doc, layer) => doc.getLayer(layer).getItems().filter(it => it.tile);
const selectedIds = (editor) => editor.getSelection().map(s => s.id).join(',');
const pointOf = (item, v) => (item.nodes ? item.nodes[v % item.nodes.length].p : [item.points[2*v], item.points[2*v + 1]]);

/** the centroid of a tile's corners: a point inside it */
function inside(item){
    const starts = tileEdgeStarts(item.tile).slice(0, -1);
    const c = starts.map(v => pointOf(item, v));
    return [c.reduce((a, q) => a + q[0], 0)/c.length, c.reduce((a, q) => a + q[1], 0)/c.length];
}

// ── taking up the tool ──────────────────────────────────────────────────────
{
    const { doc, editor, tool } = setup();
    tool.setActive(true);
    check(tilesOf(doc, 'layer1').length === 0, 'taken up by a load: no tile added');
    tool.setActive(false);
    tool.setActive(true, true);
    const first = tilesOf(doc, 'layer1');
    check(first.length === 1 && first[0].type === 'path' && selectedIds(editor) === first[0].id,
          'taken up by the user on a layer without a tile: a new curved tile, selected');
    editor.undo();
    check(tilesOf(doc, 'layer1').length === 0, 'one undo takes it away');
    editor.redo();
    const tile = tilesOf(doc, 'layer1')[0];
    editor.clearSelection();
    tool.setActive(false);
    tool.setActive(true, true);
    check(tilesOf(doc, 'layer1').length === 1 && selectedIds(editor) === tile.id, 'taken up again with nothing selected: the layer\'s tile selected, no new one');
    // a tile and a motif selected: the tile stays, the motif dropped
    const motif = doc.insertItem({ type: 'polyline', closed: true, style: { fill: { rgba: [1, 0, 0, 1] }, stroke: null, strokeWidth: 0.01 },
                                   points: (() => { const c = inside(tile); return [c[0] - 0.01, c[1] - 0.01, c[0] + 0.01, c[1] - 0.01, c[0], c[1] + 0.01]; })() }, 'layer1');
    editor.setSelection([{ id: motif.id, frame: null, frameInv: null }, { id: tile.id, frame: null, frameInv: null }]);
    tool.setActive(false);
    tool.setActive(true, true);
    check(selectedIds(editor) === tile.id, 'a tile selected stays, the rest of the selection dropped');
    // another layer: its own tile
    editor.clearSelection();
    doc.setActiveLayer('layer2');
    tool.setActive(false);
    tool.setActive(true, true);
    check(tilesOf(doc, 'layer2').length === 1 && selectedIds(editor) === tilesOf(doc, 'layer2')[0].id && tilesOf(doc, 'layer1').length === 1,
          'a layer whose only tile is on another layer gets its own');
    editor.undo();
    // a hidden or a locked active layer gets none
    for (const [what, set, reset] of [['hidden', l => l.setVisible(false), l => l.setVisible(true)], ['locked', l => l.setLocked(true), l => l.setLocked(false)]]) {
        editor.clearSelection();
        set(doc.getLayer('layer2'));
        tool.setActive(false);
        tool.setActive(true, true);
        check(tilesOf(doc, 'layer2').length === 0 && editor.getSelection().length === 0, `a ${what} active layer: no tile added, none selected`);
        reset(doc.getLayer('layer2'));
    }
    doc.setActiveLayer('layer1');

    // New tile and Shift+T
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    const before = JSON.parse(JSON.stringify(doc.getItem(tile.id)));
    const props = tool.getProperties();
    const newButton = props[0].controls[0];
    newButton.action();
    let tiles = tilesOf(doc, 'layer1');
    check(tiles.length === 2 && selectedIds(editor) === tiles[1].id && same(doc.getItem(tile.id), before), 'New tile: a tile on top, selected, the old one as it was');
    const e = key(tool, 'T', { shiftKey: true });
    tiles = tilesOf(doc, 'layer1');
    check(e.isConsumed && tiles.length === 3 && selectedIds(editor) === tiles[2].id, 'Shift+T: another tile on top, selected');
    key(tool, 'T', { shiftKey: true, repeat: true });
    check(tilesOf(doc, 'layer1').length === 3, 'a held Shift+T adds no more');
    editor.undo();
    editor.undo();
    check(tilesOf(doc, 'layer1').length === 1, 'undo takes them away');

    // the bar and the menu
    const titles = props.flatMap(p => (p.controls || [p])).map(c => c.title || c.label || '').join(' | ');
    check(/New tile/.test(titles) && /Curved sides/.test(titles) && /Release tile/.test(titles), 'the bar has New tile, Curved sides and Release tile');
    check(!/Break|Join|Closed/.test(titles), 'the bar has no break, join or close');
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    const menu = tool.getContextMenu({ wpnt: null }).map(m => m.label || '').join(' | ');
    check(menu.length > 0 && !/Break|Join|Close|Open/.test(menu) && /Release tile/i.test(menu), 'the right click menu has no break, join or close, and has Release tile');
}

// ── picks: tiles alone ──────────────────────────────────────────────────────
{
    const { doc, editor, tool } = setup();
    tool.setActive(true, true);
    const tile = tilesOf(doc, 'layer1')[0];
    const c = inside(tile);
    const motif = doc.insertItem({ type: 'polyline', closed: true, style: { fill: { rgba: [1, 0, 0, 1] }, stroke: null, strokeWidth: 0.01 },
                                   points: [c[0] - 0.03, c[1] - 0.03, c[0] + 0.03, c[1] - 0.03, c[0], c[1] + 0.03] }, 'layer1');
    editor.clearSelection();
    click(tool, c);
    check(selectedIds(editor) === tile.id, 'a click on a motif over the tile selects the tile');
    editor.clearSelection();
    const nodeTool = NodeTool({ editor });
    click(nodeTool, c);
    check(selectedIds(editor) === motif.id, 'the node tool picks the motif there');
    editor.clearSelection();
    key(tool, 'a', { ctrlKey: true });
    check(selectedIds(editor) === tile.id, 'Ctrl+A with nothing selected: the tiles alone');

    // a side drag bends the tile in the tool, its pair following
    const starts = tileEdgeStarts(tile.tile);
    const k = 1, a = pointOf(tile, starts[k]), b = pointOf(tile, starts[k + 1]);
    const d = [b[0] - a[0], b[1] - a[1]];
    const from = [a[0] + 0.5*d[0], a[1] + 0.5*d[1]], to = [from[0] - 0.15*d[1], from[1] + 0.15*d[0]];
    drag(tool, from, to);
    const bent = doc.getItem(tile.id);
    const pair = bent.tile.edges[k].pair;
    const handles = v => !!(bent.nodes[v].h1 || bent.nodes[v].h2);
    check(handles(starts[k]) && handles(starts[pair]) && dist(pointOf(bent, starts[k]), a) < 1e-15, 'a side drag in the tool bends the side and its pair, the corners staying');

    // Delete: a picked node, then with none picked the tile
    const s2 = tileEdgeStarts(bent.tile);
    key(tool, 'Insert');
    editor.setSelectedVertex({ id: tile.id, vertex: s2[k] });
    key(tool, 'Insert');
    const withNode = doc.getItem(tile.id);
    const added = editor.getSelectedVertex();
    check(withNode.nodes.length === bent.nodes.length + 2 && !!added, 'Insert adds a node to the side and one to its pair');
    key(tool, 'Delete');
    check(doc.getItem(tile.id) && doc.getItem(tile.id).nodes.length === bent.nodes.length, 'Delete removes the picked node (and its follower), the tile stays');
    editor.setSelectedVertex(null);
    key(tool, 'Delete');
    check(!doc.getItem(tile.id), 'Delete with no node picked removes the tile');
}

// ── the pointer: a new tile made by a key is the one under it ──────────────
{
    const quiet = (make) => { const log = console.log; console.log = () => {}; try { return make(); } finally { console.log = log; } };
    const bent = quiet(() => {
        const maker = new Group_KLMN({});
        Object.assign(maker.params, { bend: 20, uhp: true });
        if (maker.state) maker.state.paramChanged = true;
        return maker.getGroup();
    });
    const ID = { map: (x, y) => [x, y] };
    const toWorld = patternToWorldMap(PTC);
    const cornersOf = (item) => tileEdgeStarts(item.tile).slice(0, -1).map(v => pointOf(item, v));
    const meanOf = (item) => { const n = item.points.length/2; let x = 0, y = 0; for (let i = 0; i < n; i++) { x += item.points[2*i]; y += item.points[2*i + 1]; } return [x/n, y/n]; };
    const off = (a, b) => (a.length === b.length) ? Math.max(...a.map(p => Math.min(...b.map(q => dist(p, q))))) : Infinity;
    // the two tiles in pattern coordinates: the maker's, above the absolute, and the other component's, asked for at the mirror image of a point of the first
    const upper = tileFromDomain(bent, ID, {});
    const above = meanOf(upper), below = [above[0], -above[1]];
    const lower = tileFromDomain(bent, ID, {}, below);
    const world = (p) => toWorld.map(p[0], p[1]);
    const upperCorners = cornersOf(upper).map(world), lowerCorners = cornersOf(lower).map(world);
    const isUpper = (item) => !!item && off(cornersOf(item), upperCorners) < 1e-12;
    const isLower = (item) => !!item && off(cornersOf(item), lowerCorners) < 1e-12;
    check(off(upperCorners, lowerCorners) > 0.1, 'KLMN bent by 20: the two components have different tiles');

    const { doc, editor, tool } = setup(bent);
    const last = () => { const t = tilesOf(doc, 'layer1'); return t[t.length - 1]; };
    const retake = () => { editor.clearSelection(); tool.setActive(false); tool.setActive(true, true); };
    check(editor.pointer() === null, 'the pointer is unknown until it is over the canvas');

    // T on a layer without a tile
    tool.setActive(true, true);
    check(tilesOf(doc, 'layer1').length === 1 && isUpper(last()), 'T with the pointer off the canvas: the tile of the maker\'s domain');
    editor.undo();
    editor.notePointer(world(below));
    check(dist(editor.pointer(), world(below)) === 0, 'the pointer over the canvas is known');
    retake();
    check(tilesOf(doc, 'layer1').length === 1 && isLower(last()) && selectedIds(editor) === last().id, 'T with the pointer over the other component: that component\'s tile, selected');
    editor.undo();
    check(tilesOf(doc, 'layer1').length === 0, 'one undo takes it away');
    editor.notePointer(world(above));
    retake();
    check(tilesOf(doc, 'layer1').length === 1 && isUpper(last()), 'T with the pointer over the domain\'s component: the maker\'s tile');

    // T on a layer that has a tile: it is selected, wherever the pointer is
    editor.notePointer(world(below));
    retake();
    check(tilesOf(doc, 'layer1').length === 1 && isUpper(last()) && selectedIds(editor) === last().id, 'T on a layer with a tile selects it, the pointer over the other component or not');

    // Shift+T: the tile under the pointer; the button: the maker's
    key(tool, 'T', { shiftKey: true });
    check(tilesOf(doc, 'layer1').length === 2 && isLower(last()) && selectedIds(editor) === last().id, 'Shift+T with the pointer over the other component: its tile on top, selected');
    editor.notePointer(world(above));
    key(tool, 'T', { shiftKey: true });
    check(tilesOf(doc, 'layer1').length === 3 && isUpper(last()), 'Shift+T with the pointer over the domain\'s component: the maker\'s tile');
    editor.notePointer(world(below));
    tool.getProperties()[0].controls[0].action();
    check(tilesOf(doc, 'layer1').length === 4 && isUpper(last()), 'the New tile button: the maker\'s tile, wherever the pointer was');
    editor.notePointer(null);
    key(tool, 'T', { shiftKey: true });
    check(editor.pointer() === null && tilesOf(doc, 'layer1').length === 5 && isUpper(last()), 'Shift+T with the pointer off the canvas: the maker\'s tile');
    for (let i = 0; i < 4; i++) editor.undo();
    check(tilesOf(doc, 'layer1').length === 1, 'an undo each');

    // a Dirichlet domain of the bent group, its base in the other component: the domain is the polygon
    // that holds the base, and without the pointer the tile is that one. The group comes as the
    // renderer hands it on, a clone
    {
        const far = meanOf(lower);
        const dg = quiet(() => {
            const warn = console.warn;
            console.warn = () => {};
            try {
                const base = dirichletBase({ baseX: far[0], baseY: far[1] });
                const res = selectDirichletSides(bent, { base, depth: 2, maxIterations: 1000 });
                return makeDirichletGroup(bent, { base, words: res.words }).clone();
            } finally { console.warn = warn; }
        });
        const atBase = tileFromDomain(dg, ID, {}), across = tileFromDomain(dg, ID, {}, above);
        const baseCorners = cornersOf(atBase).map(world), acrossCorners = cornersOf(across).map(world);
        const isBase = (item) => !!item && off(cornersOf(item), baseCorners) < 1e-12;
        const isAcross = (item) => !!item && off(cornersOf(item), acrossCorners) < 1e-12;
        const ys = (item) => cornersOf(item).map(p => p[1]);
        check(Math.max(...ys(atBase)) < 0 && Math.min(...ys(across)) > 0 && off(baseCorners, acrossCorners) > 0.1,
              'a Dirichlet domain of the bent group, its base below the absolute: its tile lies below, the tile for a point above lies above');
        const d = setup(dg);
        const lastD = () => { const t = tilesOf(d.doc, 'layer1'); return t[t.length - 1]; };
        d.tool.setActive(true, true);
        check(tilesOf(d.doc, 'layer1').length === 1 && isBase(lastD()), 'T with the pointer off the canvas: the tile that holds the base');
        d.editor.notePointer(world(above));
        key(d.tool, 'T', { shiftKey: true });
        check(tilesOf(d.doc, 'layer1').length === 2 && isAcross(lastD()), 'Shift+T with the pointer over the maker\'s component: that component\'s tile, the pointer first');
        d.tool.getProperties()[0].controls[0].action();
        check(tilesOf(d.doc, 'layer1').length === 3 && isBase(lastD()), 'the New tile button: the base\'s tile, wherever the pointer was');
        d.editor.notePointer(world(far));
        key(d.tool, 'T', { shiftKey: true });
        check(tilesOf(d.doc, 'layer1').length === 4 && isBase(lastD()), 'Shift+T with the pointer over the base\'s component: the base\'s tile');
        for (let i = 0; i < 4; i++) d.editor.undo();
        check(tilesOf(d.doc, 'layer1').length === 0, 'an undo each');
    }

    // a group of one polygon: the pointer changes nothing
    const plain = setup();
    plain.tool.setActive(true, true);
    const first = tilesOf(plain.doc, 'layer1')[0];
    for (const w of [[0.37, -0.21], [-2.4, 1.9], [0.1, -0.05]]) {
        plain.editor.notePointer(w);
        key(plain.tool, 'T', { shiftKey: true });
        const t = tilesOf(plain.doc, 'layer1');
        check(same(t[t.length - 1].nodes.map(n => n.p), first.nodes.map(n => n.p)), `632: Shift+T with the pointer at (${w}) adds the same tile`);
    }
}

// ── unbounded frieze domains: interactive cutoff corner editing ─────────────
{
    // *22∞: 2 fixed corners (disc), 2 mirror-sliding cutoff corners (square)
    const gM = new Group_Frieze({ type: '*22∞', a: 0.5 }).getGroup();
    const { doc, editor, tool } = setup(gM);
    tool.setActive(true, true);
    const tile = tilesOf(doc, 'layer1')[0];
    check(!!tile && tile.nodes.length === 4, 'frieze *22∞: Tile tool creates a 4-node curved tile');

    // overlay marks: fixed corners as disc, movable cutoff corners as square
    const geo = tool.getOverlayGeometry();
    const marks = geo.points.map(p => p.kind);
    check(marks.filter(m => m === 'disc').length === 2 && marks.filter(m => m === 'square').length === 2,
          `frieze *22∞: 2 fixed discs and 2 draggable squares (${marks.join(', ')})`);

    // dragging fixed corner 1 changes nothing
    const c1 = pointOf(tile, 1), c2 = pointOf(tile, 2), c3 = pointOf(tile, 3);
    drag(tool, c1, [c1[0] + 0.15, c1[1] + 0.2]);
    check(dist(pointOf(doc.getItem(tile.id), 1), c1) < 1e-15, 'frieze *22∞: fixed corner stays put on drag');

    // dragging mirror cutoff corner 2 off the mirror slides it strictly along its mirror line
    const R1 = editor.pairingMap(tile.tile.edges[1].word);
    drag(tool, c2, [c2[0] + 0.25, c2[1] + 0.3]);
    const moved = doc.getItem(tile.id);
    const m2 = pointOf(moved, 2);
    check(dist(m2, c2) > 0.1 && dist(R1(m2), m2) < 1e-12 && dist(pointOf(moved, 3), c3) < 1e-15,
          'frieze *22∞: dragging mirror cutoff corner slides it along its mirror line, leaving the other corner untouched');
    editor.undo();
    check(dist(pointOf(doc.getItem(tile.id), 2), c2) < 1e-15, 'frieze *22∞: one undo restores the mirror corner');

    // dragging mirror cutoff corner 2 right onto fixed corner 1, then grabbing at that spot recovers corner 2
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    drag(tool, c2, c1);
    check(dist(pointOf(doc.getItem(tile.id), 2), c1) < 1e-12, 'frieze *22∞: mirror corner can slide onto the fixed corner');
    drag(tool, c1, [c2[0] + 0.1, c2[1] + 0.25]);
    const recovered = doc.getItem(tile.id);
    check(dist(pointOf(recovered, 1), c1) < 1e-15 && dist(pointOf(recovered, 2), c1) > 0.2 && dist(R1(pointOf(recovered, 2)), pointOf(recovered, 2)) < 1e-12,
          'frieze *22∞: overlapping movable corner beats fixed corner on pick and slides back out along the mirror');
    editor.undo();
    editor.undo();

    // clicking the top cap edge picks both mirror corners; dragging moves both along their mirrors
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    const capMid = [0.5*(c2[0] + c3[0]), 0.5*(c2[1] + c3[1])];
    click(tool, capMid);
    check(editor.getSelectedVertices().length === 2, 'frieze *22∞: clicking the open cap edge picks both cutoff corners');
    drag(tool, c2, [c2[0] + 0.12, c2[1] + 0.35]);
    const both = doc.getItem(tile.id);
    const R3 = editor.pairingMap(tile.tile.edges[3].word);
    check(dist(pointOf(both, 2), c2) > 0.2 && dist(R1(pointOf(both, 2)), pointOf(both, 2)) < 1e-12
          && dist(pointOf(both, 3), c3) > 0.2 && dist(R3(pointOf(both, 3)), pointOf(both, 3)) < 1e-12,
          'frieze *22∞: dragging both picked cutoff corners slides each along its own mirror');
    editor.undo();

    // Delete and Shift+S (smooth) are refused on a picked cutoff corner, leaving the tile intact
    editor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
    click(tool, c2);
    key(tool, 'Delete');
    check(!!doc.getItem(tile.id) && doc.getItem(tile.id).nodes.length === 4, 'frieze *22∞: Delete on a picked cutoff corner removes neither corner nor tile');
    key(tool, 'S', { shiftKey: true });
    check(!doc.getItem(tile.id).nodes[2].smooth, 'frieze *22∞: Shift+S on a cutoff corner keeps it a corner');

    // double-click on the open cap edge adds a free inner node that can move in 2D and be deleted
    tool.handleEvent(pointer('dblclick', capMid));
    const withInner = doc.getItem(tile.id);
    check(withInner.nodes.length === 5, 'frieze *22∞: double-clicking the open cap edge adds a free node');
    const innerPt = pointOf(withInner, 3);
    drag(tool, innerPt, [innerPt[0] + 0.05, innerPt[1] + 0.1]);
    check(dist(pointOf(doc.getItem(tile.id), 3), [innerPt[0] + 0.05, innerPt[1] + 0.1]) < 1e-12, 'frieze *22∞: cap edge inner node drags freely in 2D');
    key(tool, 'Delete');
    check(doc.getItem(tile.id).nodes.length === 4, 'frieze *22∞: Delete removes the cap edge inner node');

    // dragging on a symmetry copy (reflected across x = a) slides cleanly along the copy's mirror
    const copyCorner = R1(c3);
    const copyCenter = R1(inside(doc.getItem(tile.id)));
    editor.clearSelection();
    click(tool, copyCenter);
    const c3Before = pointOf(doc.getItem(tile.id), 3);
    drag(tool, copyCorner, [copyCorner[0] + 0.15, copyCorner[1] + 0.2]);
    const afterCopy = doc.getItem(tile.id);
    check(dist(pointOf(afterCopy, 3), c3Before) > 0.1 && dist(R3(pointOf(afterCopy, 3)), pointOf(afterCopy, 3)) < 1e-12,
          'frieze *22∞: dragging a cutoff corner on a reflected copy slides cleanly along its mirror');

    // 2*∞: dragging the top cap edge's two picked corners slides the mirror corner AND moves the half-turn pair
    const g2s = new Group_Frieze({ type: '2*∞', a: 0.5 }).getGroup();
    const s2s = setup(g2s);
    s2s.tool.setActive(true, true);
    const t2s = tilesOf(s2s.doc, 'layer1')[0];
    const pMirror = pointOf(t2s, 1), pTurn = pointOf(t2s, 2), pCenter = pointOf(t2s, 3), pPartner = pointOf(t2s, 4);
    click(s2s.tool, [0.5*(pMirror[0] + pTurn[0]), 0.5*(pMirror[1] + pTurn[1])]);
    drag(s2s.tool, pTurn, [pTurn[0] + 0.1, pTurn[1] + 0.25]);
    const m2s = s2s.doc.getItem(t2s.id);
    const Rm = s2s.editor.pairingMap(t2s.tile.edges[0].word);
    const Ht = s2s.editor.pairingMap(t2s.tile.edges[2].word);
    check(dist(Rm(pointOf(m2s, 1)), pointOf(m2s, 1)) < 1e-12 && dist(pointOf(m2s, 1), pMirror) > 0.1
          && dist(pointOf(m2s, 2), [pTurn[0] + 0.1, pTurn[1] + 0.25]) < 1e-12
          && dist(pointOf(m2s, 4), Ht(pointOf(m2s, 2))) < 1e-12
          && dist(pointOf(m2s, 3), pCenter) < 1e-15 && dist(pointOf(m2s, 4), pPartner) > 0.1,
          'frieze 2*∞: multi-drag of top cap corners slides mirror corner and moves half-turn pair while center stays fixed');
    // bending the paired half-turn edge AFTER moving the cutoff corner still keeps its partner synced
    const a2 = pointOf(m2s, 2), b2 = pointOf(m2s, 3);
    const mid2 = [0.5*(a2[0] + b2[0]), 0.5*(a2[1] + b2[1])];
    drag(s2s.tool, mid2, [mid2[0] + 0.08, mid2[1] - 0.04]);
    const bent2s = s2s.doc.getItem(t2s.id);
    check(!!bent2s.nodes[2].h2 && !!bent2s.nodes[4].h1 && dist(Ht(bent2s.nodes[2].h2), bent2s.nodes[4].h1) < 1e-12,
          'frieze 2*∞: bending a paired edge after moving its cutoff corner keeps its pair exact');

    // vertical mirror nudge perpendicular to mirror pushes no spurious undo step (unrotated PTC)
    const docPlain = DrawingDocument();
    docPlain.fromJSON({ layers: [{ id: 'layer1', items: [] }] });
    const ptcId = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
    docPlain.setOutliner(groupOutliner(gM, ptcId));
    const edPlain = DrawingEditor({
        document: docPlain,
        getContext: () => ({ group: gM, ptc: ptcId, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
    });
    edPlain.setStyleValue('snap', false);
    docPlain.setActiveLayer('layer1');
    const toolPlain = TileTool({ editor: edPlain });
    toolPlain.setActive(true, true);
    const tPlain = tilesOf(docPlain, 'layer1')[0];
    const topR = pointOf(tPlain, 2);
    click(toolPlain, topR);
    key(toolPlain, 'ArrowRight');
    check(dist(pointOf(docPlain.getItem(tPlain.id), 2), topR) < 1e-15, 'frieze *22∞: horizontal nudge on vertical mirror leaves corner in place');
    key(toolPlain, 'ArrowUp');
    const nudged = pointOf(docPlain.getItem(tPlain.id), 2);
    check(Math.abs(nudged[0] - topR[0]) < 1e-15 && Math.abs(nudged[1] - topR[1]) > 1e-4, 'frieze *22∞: vertical nudge slides corner along vertical mirror');
    edPlain.undo();
    check(dist(pointOf(docPlain.getItem(tPlain.id), 2), topR) < 1e-15, 'frieze *22∞: single undo reverts only the vertical nudge (horizontal nudge pushed no no-op undo)');
}

// ── spherical 2*2: interactive paired mirror-sliding corners (ax-2s2) ───────
{
    const g2s2 = new Group_Spherical({ type: '2*n', n: 2, subtype: 0, centered: true }).getGroup();
    const docS = DrawingDocument();
    docS.fromJSON({ layers: [{ id: 'layer1', items: [] }] });
    const ptcId = { centerX: 0, centerY: 0, scale: 1, angle: 0 };
    docS.setOutliner(groupOutliner(g2s2, ptcId));
    const edS = DrawingEditor({
        document: docS,
        getContext: () => ({ group: g2s2, ptc: ptcId, sprites: false, visLayers: [] }),
        view: { toCanvas: w => [PX*w[0], PX*w[1]], toWorld: c => ({ pnt: [c[0]/PX, c[1]/PX] }), isLinear: () => true, pixelSize: () => 1/PX },
    });
    edS.setStyleValue('snap', false);
    docS.setActiveLayer('layer1');
    const raw = tileFromDomain(g2s2, patternToWorldMap(ptcId), {}, null, true);
    docS.insertItem({ ...raw, id: 'tile2s2' });
    const toolS = NodeTool({ editor: edS });
    toolS.setActive(true);
    edS.setSelection([{ id: 'tile2s2', frame: null, frameInv: null }]);

    const marks = toolS.getOverlayGeometry().points.map(p => p.kind);
    check(marks.filter(m => m === 'disc').length === 2 && marks.filter(m => m === 'square').length === 2,
          `spherical 2*2: overlay shows 2 fixed discs and 2 movable squares (${marks.join(', ')})`);

    // dragging x-axis corner (1, 0) off-axis slides it along x-axis while y-axis corner follows at 1/r
    drag(toolS, [1, 0], [1.4, 0.35]);
    const t1 = docS.getItem('tile2s2');
    check(dist(pointOf(t1, 1), [1.4, 0]) < 1e-12 && dist(pointOf(t1, 3), [0, 1/1.4]) < 1e-12
          && dist(pointOf(t1, 0), [0, 0]) < 1e-15,
          'spherical 2*2: dragging x-axis corner slides along x-axis with y-axis corner following at 1/r');

    // dragging y-axis corner slides it along y-axis with x-axis corner following at 1/y
    drag(toolS, pointOf(t1, 3), [0.3, 1.6]);
    const t2 = docS.getItem('tile2s2');
    check(dist(pointOf(t2, 3), [0, 1.6]) < 1e-12 && dist(pointOf(t2, 1), [1/1.6, 0]) < 1e-12,
          'spherical 2*2: dragging y-axis corner slides along y-axis with x-axis corner following at 1/y');

    edS.undo();
    edS.undo();
    const tUndo = docS.getItem('tile2s2');
    check(dist(pointOf(tUndo, 1), [1, 0]) < 1e-12 && dist(pointOf(tUndo, 3), [0, 1]) < 1e-12,
          'spherical 2*2: undo restores both axis corners');

    // perpendicular ArrowUp nudge on x-axis corner pushes no no-op undo; ArrowRight slides along x-axis
    edS.setSelection([{ id: 'tile2s2', frame: null, frameInv: null }]);
    click(toolS, [1, 0]);
    key(toolS, 'ArrowUp');
    check(dist(pointOf(docS.getItem('tile2s2'), 1), [1, 0]) < 1e-15, 'spherical 2*2: vertical nudge on x-axis corner leaves it in place');
    key(toolS, 'ArrowRight');
    const nudged = docS.getItem('tile2s2');
    const nx = pointOf(nudged, 1)[0];
    check(nx > 1 + 1e-4 && Math.abs(pointOf(nudged, 1)[1]) < 1e-15 && dist(pointOf(nudged, 3), [0, 1/nx]) < 1e-12,
          'spherical 2*2: horizontal nudge slides x-axis corner and updates y-axis corner to 1/x');
    edS.undo();
    check(dist(pointOf(docS.getItem('tile2s2'), 1), [1, 0]) < 1e-15,
          'spherical 2*2: single undo reverts only horizontal nudge (vertical nudge pushed no no-op undo)');
}

console.log(failed ? `${failed} check(s) FAILED` : 'tile tool: all checks passed');
if (failed) process.exitCode = 1;
