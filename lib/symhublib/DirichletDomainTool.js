/*
  DirichletDomainTool.js — the Dirichlet domain of the renderer's group, as an operation
  on the group (after the group transform), with its parameters and the interactive
  choice of the sides on the canvas. Ported from the Orb repo's Dirichlet domain builders
  (2026-10-26); the computation is lib/grouplib/DirichletDomain.js.

  Parameters (saved in the document as symmetry.dirichlet):
    enabled          'use': the renderer uses the Dirichlet domain instead of the group's own
    autoSides        'auto': when the base or the group changes and the sides no longer
                     bound the Dirichlet domain, the sides are found again in the
                     background (see below). Off, the sides stay as they are until the
                     action of the status row
    baseX, baseY     the base point on the plane (the domain is the limit of the
                     Dirichlet domains in the upper half space of the points above it
                     as their height goes to 0; for a group of isometries of the
                     plane, the hyperbolic plane or the sphere it is the group's own
                     Dirichlet domain; the base height baseW of older documents is
                     not used)
    words            the words of the sides, space separated, in side names with powers
                     and repeated blocks (f11, (af)11; see lib/grouplib/DirichletDomain.js):
                     each names the group
                     element g whose image of the base lies across the side (a letter
                     is a side's generator; an inverse is the partner side's letter;
                     an old uppercase X, where X is no side name, reads as the inverse
                     of x)
    depth            the images of the base of the words of at most this many letters
                     are shown as candidate points and planes
    minScale, iterations  the images where the transform's scale factor at the
                     base is below minScale are left out (they lie near the limit set,
                     with tiny sides); the folds of points into the fundamental domain
                     take at most `iterations` steps
    showPoints, showPlanes   show the candidate images and their bisectors
    showSides, showLabels    show the chosen sides with their images, named by the
                     letters of the Dirichlet group's generators
    searchTime       the time limit of a search in seconds: the search then
                     answers with the sides found so far (a barely discrete group
                     can take long, a group that is not discrete has no domain)

  'edit sides' (not saved) lets clicks on the canvas change the sides.

  The panel: a row of the switches, the base, the status row, the list of the sides, a row
  of what is shown, and a closed folder with the words as text and the numbers of the
  search. The status row says how the domain stands (checkDirichletDomain, in every step
  of a drag: it takes less than a millisecond); its button starts the search, or stops
  it, and its hamburger has undo, redo and clear. Hovering a line of the list marks the
  side on the canvas.

  The search: selectDirichletSides in a worker (grouplib/DirichletSearch.js), starting
  from the current words. One runs at a time: the worker takes a while to load, and
  stopping one means loading it again, so the steps of a drag do not stop a short search,
  they wait for it. During a drag of the base, and while the parameters of the group keep
  changing (there is no end to see: GROUP_SETTLE_MS without a change is one), the searches
  are short (DRAG_SEARCH_SECONDS) and only sides that close up replace the words; at the
  end a search of the full time limit takes over if the domain is still open, and answers
  as the button does. An answer for a group that has moved on still gives the words: they
  are looked at again for the group as it is.

  A document that is loaded keeps its words, whatever the check says: nothing changes
  them before the base or the group is changed (presets can keep words on purpose that do
  not close the domain). So does a group handed to the renderer (setGroupOverride, for
  which keepSides is). A change of the group starts nothing while the domain is not used
  and has no sides: most documents have no Dirichlet domain at all.

  Undo takes back one gesture: a drag with the sides it brought, a click, a search. What
  a change of the group did to the sides is a step of its own: undo gives back the words,
  not the group, and they stay as they are then.

  The points, planes and sides show whatever the renderer's tool; the sides (and the
  base with them) only when the domain is used or has words, so a document without a
  Dirichlet domain has no marks. On the canvas, with the move tool (Pan and zoom), while
  points, planes or sides are shown:
    drag the base point (the yellow disc);
    the key D moves the base point to the pointer;
  and with 'edit sides' on:
    click a shown point or plane to add its word to the sides, click a side's point or
    arc to remove it;
    click anywhere else to add the side of the cell of the group's tiling under the
    pointer (found by folding, so its word can be long);
    Ctrl+Z and Ctrl+Y undo and redo.

  Tool contract (SymRenderer): handleEvent(e) sets e.isConsumed when the event is
  used; handleKey(e) likewise; getOverlayGeometry() gives the points, planes and sides
  in world coordinates for the GPU pass (EditingOverlay.js), which draws them on the
  picture under any projection of the view, and renderText(ctx) draws the labels and
  the hint on the overlay canvas; renderUI(ctx, canvasTransform) draws everything on
  the overlay canvas through the navigator where there is no pass; setActive(on) tells
  it whether it gets the events. The picks measure pixels at the pointer by the
  navigator's local scale (screenScale), so they find what the picture shows.
*/

import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamString,
    ParamUiFolder,
    ParamUiRow,
    ParamMenu,
    ParamList,
    iDrawSplane,
    iDrawCircle,
    iPoint,
    iDistanceU4,
    parseWords,
    wordsToString,
    compactWord,
    normalizeWord,
    dirichletBase,
    dirichletSide,
    makeDirichletGroup,
    dirichletImages,
    dirichletCellAt,
    checkDirichletDomain,
    sideArcPoint,
    sideArcContains,
    groupToData,
    DEFAULT_SEARCH_SECONDS,
    startDirichletSearch,
    prepareDirichletSearch,
    newGeometry,
    cssColor,
    discGeometry,
    splaneGeometry,
} from './modules.js';

const MYNAME = 'DirichletDomainTool';
const DEBUG = false;

const HIT_TOLERANCE = 8;       // canvas pixels
const CLICK_TOLERANCE = 3;     // a press that moved less is a click
const BASE_RADIUS = 7;
const POINT_RADIUS = 3;
const SIDE_POINT_RADIUS = 5;

// the time limit of a search during a drag: the next step of the drag waits for it
const DRAG_SEARCH_SECONDS = 1;
// the time without a change that ends a change of the group's parameters
const GROUP_SETTLE_MS = 400;
// the longest time the base editors of the panel take for one change (a number held by its arrow)
const EDIT_GESTURE_MS = 600;
const MAX_UNDO = 100;

const BASE_STYLE = { radius: BASE_RADIUS, fill: '#FFFF22', stroke: '#000000', strokeWidth: 1.5 };
const POINT_STYLE = { radius: POINT_RADIUS, fill: '#0070C0' };
const PLANE_STYLE = { lineStyle: '#7000D080', lineWidth: 1 };
const HOVER_STYLE = { lineStyle: '#FFFF00', lineWidth: 8, shadowWidth: 0 };
const SIDE_COLORS = ['#D01010', '#10A010', '#1040E0', '#E08000', '#A000A0', '#009090', '#806000', '#404040'];

// the arcs of the sides as lines on the screen: split until they deviate less than this many pixels
const ARC_PIXELS = 0.5;
const ARC_MIN_DEPTH = 3;
const ARC_MAX_DEPTH = 11;

const HINT_X = 64;             // right of symdraw's tool palette
const HINT_Y = 84;             // below the toolbox
const HINT_LINES = [
    'click a point, an arc or a cell: add or remove its side',
    'drag the yellow disc: move the base   D: base to the pointer   Ctrl+Z: undo',
];
const HINT_OTHER_TOOL = ['edit sides works with the Pan and zoom tool'];

// a square: stops the search
const STOP_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="1.5"/>' +
    '</svg>';
const SEARCH_LOOK = { tooltip: 'auto select: find the sides of the Dirichlet domain of the base, in the background' };
const STOP_LOOK = { tooltip: 'stop the search', icon: STOP_ICON };

export function DirichletDomainTool(opt = {}) {

    const navigator = opt.navigator;
    const canvas = opt.canvas;
    const repaint = opt.repaint || (() => {});
    const onChanged = opt.onChanged || repaint;

    const cfg = {
        enabled: false,
        autoSides: true,
        editSides: false,
        baseX: 0.01,
        baseY: 0.02,
        words: '',
        depth: 2,
        minScale: 0.01,
        iterations: 200,
        searchTime: DEFAULT_SEARCH_SECONDS,
        showPoints: false,
        showPlanes: false,
        showSides: true,
        showLabels: true,
    };

    let mGroup = null;       // the group the domain is taken of (the renderer's transformed group)
    let mGroupKey = '';      // what the group is: the renderer makes a new object of it for every change
    let mResult = null;      // {base, sides, group, cell, check} of the current words, null before it is computed
    let mImages = null;      // the candidate images of the base, null before they are computed
    let mPointer = null;     // the last pointer position on the canvas
    let mDown = null;        // the position of the last press
    let mMoved = false;      // the pointer moved since the press
    let mDrag = null;        // {dx, dy, base}: the base is dragged, the offset of the grab, where it started
    let mHover = null;       // the object under the pointer: {kind, index}
    let mCursor = null;      // the canvas cursor while the pointer is on an object
    let mActive = true;      // the tool gets the events (the move tool is taken)
    let mSearch = null;      // the running search: {key, place, auto, quick, cancel, handle, stage}
    let mAutoPending = false;   // the base or the group has changed: the sides are to be looked at
    let mGaveUp = null;      // the place (placeKey) where a short search found nothing better
    let mKeepSides = false;  // the next group comes with a document or a script: no edit of the user's
    let mGroupEdited = false;   // what the sides come to next is a step of undo of its own
    let mGroupTimer = null;  // runs while the parameters of the group are changing
    let mNotice = '';        // what the last search left to say
    let mLoading = false;    // a document's values are being set
    let mSettingWords = false;  // the tool sets the words, they are no edit of the user's
    let mUpdateQueued = false;
    let mResultWarned = false;
    let mUndo = [];          // the states before each gesture
    let mRedo = [];
    let mCommitted = null;   // the state after the last gesture
    let mCommitTimer = null;

    const mParams = makeParams();
    mCommitted = snapshot();

    // ---- parameters ------------------------------------------------------------------

    function makeParams() {
        const odc = onDomainChanged;
        const ovc = onViewChanged;
        const inc = 1e-10;
        const switches = ParamUiRow();
        const base = ParamUiRow({ name: 'base' });
        const show = ParamUiRow();
        const options = ParamUiFolder({ name: 'options' });
        const params = ParamGroup({
            name: 'dirichlet domain',
            params: {
                switches,
                enabled:    switches.contain(ParamBool({ obj: cfg, key: 'enabled', name: 'use', onChange: onUseChanged }),
                                { tooltip: 'use the Dirichlet domain of the base instead of the fundamental domain of the group' }),
                autoSides:  switches.contain(ParamBool({ obj: cfg, key: 'autoSides', name: 'auto', onChange: onAutoChanged }),
                                { tooltip: 'when the base or the group changes and the sides no longer bound the domain, find them again in the background' }),
                editSides:  switches.contain(ParamBool({ obj: cfg, key: 'editSides', name: 'edit sides', serializable: false, onChange: onEditChanged }),
                                { tooltip: 'clicks on the canvas add and remove sides (with the Pan and zoom tool)' }),
                base,
                baseX:      base.contain(ParamFloat({ obj: cfg, key: 'baseX', name: 'base X', min: -10, max: 10, step: inc, onChange: onBaseEdited }), { tooltip: 'X of the base' }),
                baseY:      base.contain(ParamFloat({ obj: cfg, key: 'baseY', name: 'base Y', min: -10, max: 10, step: inc, onChange: onBaseEdited }), { tooltip: 'Y of the base' }),
                status:     ParamMenu({
                                name: 'no sides',
                                tooltip: 'commands of the sides',
                                action: { ...SEARCH_LOOK, func: onAutoSelect },
                                menu: statusMenu,
                            }),
                list:       ParamList({
                                maxRows: 7,
                                onHover: onListHover,
                                onRemove: onListRemove,
                                removeTooltip: 'remove the side',
                            }),
                show,
                showPoints: show.contain(ParamBool({ obj: cfg, key: 'showPoints', name: 'points', onChange: ovc }), { tooltip: 'show the images of the base' }),
                showPlanes: show.contain(ParamBool({ obj: cfg, key: 'showPlanes', name: 'planes', onChange: ovc }), { tooltip: 'show the bisectors of the base and its images' }),
                showSides:  show.contain(ParamBool({ obj: cfg, key: 'showSides', name: 'sides', onChange: ovc }), { tooltip: 'show the sides of the domain' }),
                showLabels: show.contain(ParamBool({ obj: cfg, key: 'showLabels', name: 'labels', onChange: ovc }), { tooltip: 'show the names of the sides' }),
                options,
                words:      options.contain(ParamString({ obj: cfg, key: 'words', name: 'sides', tooltip: true, onChange: onWordsEdited })),
                searchTime: options.contain(ParamInt({ obj: cfg, key: 'searchTime', name: 'search time', min: 1, max: 300, tooltip: 'a search stops after this many seconds and takes the sides found so far' })),
                depth:      options.contain(ParamInt({ obj: cfg, key: 'depth', name: 'depth', min: 1, max: 100, onChange: ovc })),
                minScale:   options.contain(ParamFloat({ obj: cfg, key: 'minScale', name: 'min scale', min: 0, max: 1, step: inc, onChange: ovc })),
                iterations: options.contain(ParamInt({ obj: cfg, key: 'iterations', name: 'fold iterations', min: 1, max: 5000, onChange: odc })),
            }
        });
        // a document's values are no changes of the user's: they stop what was going
        // on, and start nothing. Its group comes at the next frame. A document with no
        // values for the tool gets here by init
        const loading = set => (...args) => {
            dropAuto();
            keepSides();
            mLoading = true;
            set(...args);
            mLoading = false;
            mUndo = [];
            mRedo = [];
            mCommitted = snapshot();
        };
        params.setValue = loading(params.setValue);
        params.init = loading(params.init);
        return params;
    }

    function getParams() {
        return mParams;
    }

    function getConfig() {
        return cfg;
    }

    function onDomainChanged() {
        mResult = null;
        mImages = null;
        setHover(null);
        onChanged();
        scheduleUpdate();
    }

    function onViewChanged() {
        mImages = null;
        setHover(null);
        repaint();
        scheduleUpdate();
    }

    function onUseChanged() {
        // the domain taken up with no sides at all: there is nothing to keep
        if (!mLoading && cfg.enabled && cfg.autoSides && !cfg.words.trim()) mAutoPending = true;
        onDomainChanged();
    }

    function onAutoChanged() {
        if (mLoading) return;
        mAutoPending = cfg.autoSides;
        if (!cfg.autoSides && mSearch && mSearch.auto) stopSearch();
        scheduleUpdate();
    }

    function onEditChanged() {
        if (cfg.editSides && !cfg.showPoints && !cfg.showPlanes && !cfg.showSides) mParams.showSides.setValue(true);
        setHover(null);
        repaint();
    }

    function onWordsEdited() {
        onDomainChanged();
        if (!mLoading && !mSettingWords) commit();
    }

    // the caller says which gesture it belongs to (commit, amend)
    function setWords(words) {
        mSettingWords = true;
        mParams.words.setValue(wordsToString(words));
        mSettingWords = false;
    }

    function onClear() {
        dropAuto();
        setWords([]);
        commit();
    }

    function statusMenu() {
        return [
            { label: 'Undo', title: 'take back the last change of the base or the sides', disabled: !canUndo(), action: undo },
            { label: 'Redo', disabled: mRedo.length === 0, action: redo },
            { separator: true },
            { label: 'Clear the sides', disabled: !cfg.words.trim(), action: onClear },
        ];
    }

    // ---- undo ------------------------------------------------------------------------

    function snapshot() {
        return { baseX: cfg.baseX, baseY: cfg.baseY, words: cfg.words };
    }

    function sameState(a, b) {
        return a.baseX === b.baseX && a.baseY === b.baseY && a.words === b.words;
    }

    /** a gesture has ended: the state before it goes on the undo list */
    function commit() {
        clearTimeout(mCommitTimer);
        mCommitTimer = null;
        const now = snapshot();
        if (sameState(now, mCommitted)) return;
        mUndo.push(mCommitted);
        if (mUndo.length > MAX_UNDO) mUndo.shift();
        mRedo = [];
        mCommitted = now;
    }

    function commitSoon() {
        clearTimeout(mCommitTimer);
        mCommitTimer = setTimeout(commit, EDIT_GESTURE_MS);
    }

    /**
     * what a search brought after its gesture ended belongs to that gesture; after a change
     * of the group it is a gesture itself, undo cannot take the group back
     */
    function amend() {
        if (isMoving() || mCommitTimer) return;
        if (mGroupEdited) commit();
        else mCommitted = snapshot();
        mGroupEdited = false;
    }

    function canUndo() {
        return mUndo.length > 0 || !sameState(snapshot(), mCommitted);
    }

    function restore(state) {
        dropAuto();
        cfg.baseX = state.baseX;
        cfg.baseY = state.baseY;
        cfg.words = state.words;
        mParams.baseX.updateDisplay();
        mParams.baseY.updateDisplay();
        mParams.words.updateDisplay();
        mCommitted = state;
        onDomainChanged();
    }

    function undo() {
        commit();
        const state = mUndo.pop();
        if (!state) return;
        mRedo.push(mCommitted);
        restore(state);
    }

    function redo() {
        commit();
        const state = mRedo.pop();
        if (!state) return;
        mUndo.push(mCommitted);
        restore(state);
    }

    // ---- the search --------------------------------------------------------------------

    function baseKey() {
        return `${cfg.baseX},${cfg.baseY}`;
    }

    /** where the domain is taken: the base and the group */
    function placeKey() {
        return `${baseKey()} ${mGroupKey}`;
    }

    /** the base is being dragged, or the group's parameters are changing: more steps follow */
    function isMoving() {
        return !!mDrag || !!mGroupTimer;
    }

    /** stops the running search, if any */
    function stopSearch() {
        if (!mSearch) return;
        const s = mSearch;
        mSearch = null;
        s.cancel();
        scheduleUpdate();
    }

    /** what was going on ends: the search and what was left to look at */
    function dropAuto() {
        stopSearch();
        mAutoPending = false;
        mGroupEdited = false;
        clearTimeout(mGroupTimer);
        mGroupTimer = null;
        mNotice = '';
    }

    /** the next group is no edit of the user's: the sides stay */
    function keepSides() {
        mKeepSides = true;
    }

    /**
     * the search runs in a worker with the time limit; the words are set when it answers.
     * auto: asked for by a change of the base or the group
     */
    function startSearch(auto) {
        const quick = auto && isMoving();
        const search = startDirichletSearch(mGroup, {
            base: dirichletBase(cfg),
            depth: cfg.depth,
            minScale: cfg.minScale,
            maxIterations: cfg.iterations,
            // the search starts from the sides it has: those of the base before it moved
            seeds: parseWords(cfg.words),
            timeLimit: quick ? Math.min(cfg.searchTime, DRAG_SEARCH_SECONDS) : cfg.searchTime,
            onProgress: text => {
                const m = /^round (\d+)/.exec(text);
                if (m && mSearch && mSearch.handle === search) setSearchStage(`round ${m[1]}`);
            },
            onStage: stage => {
                if (!mSearch || mSearch.handle !== search) return;
                setSearchStage(stage === 'loading' ? 'loading' : stage === 'page' ? 'in the page' : '');
            },
        });
        // the handle tells which search answers
        mSearch = { key: mGroupKey, place: placeKey(), auto, quick, cancel: search.cancel, handle: search, stage: '' };
        mNotice = '';
        showStatus();
        search.promise.then(res => onSearchAnswer(search, res));
    }

    function setSearchStage(stage) {
        mSearch.stage = stage;
        showStatus();
    }

    /** the sides of the answer, or what is to be said instead */
    function onSearchAnswer(handle, res) {
        if (!mSearch || mSearch.handle !== handle) return;   // stopped or replaced
        const { key, place, auto, quick } = mSearch;
        mSearch = null;
        const closed = !res.stopped && !res.error && !res.timedOut && !res.unpaired && !res.ungenerated && !res.nearIdentity;
        const stayed = place === placeKey();
        if (res.stopped) {
            mNotice = 'the search did not answer in time';
            console.warn(`${MYNAME}: the search ${res.stopped === 'time' ? 'did not answer within its time limit' : 'stopped'} after ${res.ms} ms; the sides are unchanged`);
        } else if (res.error) {
            mNotice = 'the search failed';
            console.warn(`${MYNAME}: the search failed: ${res.error}`);
        } else if (key !== mGroupKey && !res.words.every(w => normalizeWord(mGroup, w) !== null)) {
            // the group has become another group, whose sides have other names
        } else if (quick && !closed) {
            // left to the search at the end of the drag
            mGaveUp = place;
        } else {
            const where = res.where === 'worker' ? ` in the worker${res.loadMs ? ` (loaded in ${res.loadMs} ms)` : ''}` : res.where === 'page' ? ' in the page' : '';
            if (DEBUG || !auto) console.log(`${MYNAME}: ${res.words.length} sides from ${res.candidates} candidates in ${res.ms} ms${where}${res.timedOut ? ' (time limit reached, best effort)' : ''}: ${res.words.join(' ')}`);
            if (!closed) mNotice = searchNotice(res);
            if (wordsToString(res.words) !== cfg.words) setWords(res.words);
            if (auto) amend(); else commit();
        }
        if (stayed && !(quick && !closed)) mAutoPending = false;
        scheduleUpdate();
    }

    function searchNotice(res) {
        if (res.nearIdentity) return 'images at the base: the group is not discrete, or the base is on an axis of a rotation';
        if (res.timedOut) return 'the time limit ended the search: the sides are a best effort';
        if (res.unpaired) return `${res.unpaired} sides without a partner: the sides are a best effort`;
        if (res.ungenerated) return 'the sides bound the domain of a subgroup';
        return '';
    }

    /** the button of the status row: a second click stops the search */
    function onAutoSelect() {
        if (mSearch) {
            stopSearch();
            mAutoPending = false;
            console.log(`${MYNAME}: auto select stopped`);
            return;
        }
        if (mGroup) startSearch(false);
    }

    /**
     * looks at the sides after the base or the group changed: a domain that closes up
     * stays, one that does not gets a search. A search that runs answers first
     */
    function runAuto() {
        if (!mAutoPending || mSearch) return;
        if (!cfg.autoSides || !mGroup || !isOn()) {
            mAutoPending = false;
            return;
        }
        if (isMoving() && mGaveUp === placeKey()) return;
        const res = getResult();
        if (res.check && res.check.ok) {
            // the sides left behind go at the end of the move; a next look tells
            if (res.check.unused.length && !isMoving()) {
                setWords(res.sides.filter((s, i) => !res.check.unused.includes(i)).map(s => compactWord(s.word)));
                amend();
                return;
            }
            mAutoPending = false;
            amend();
            return;
        }
        startSearch(true);
    }

    /** the group's parameters changed: the end of the change is the time without another */
    function followGroup() {
        mGroupEdited = true;
        mAutoPending = true;
        clearTimeout(mGroupTimer);
        mGroupTimer = setTimeout(() => {
            mGroupTimer = null;
            mAutoPending = true;
            scheduleUpdate();
        }, GROUP_SETTLE_MS);
    }

    // ---- the operation on the group --------------------------------------------------

    function isEnabled() {
        return cfg.enabled;
    }

    /** the domain is used, or shown */
    function isOn() {
        return cfg.enabled || isVisible();
    }

    /**
     * the group with the Dirichlet domain of the base as its fundamental domain, or
     * the group itself when the domain is off or has no side; the group is kept for
     * the display and the picking
     */
    function apply(group) {
        if (group !== mGroup) {
            // the renderer makes the group anew for a move of the base too: what it
            // is tells whether the group has changed
            const key = JSON.stringify(groupToData(group));
            if (key !== mGroupKey) {
                const follow = mGroupKey !== '' && !mKeepSides && cfg.autoSides && isOn() && (cfg.enabled || !!cfg.words.trim());
                // a short search starts the next one; a long one answers for a group that is gone
                if (mSearch && !(follow && mSearch.quick)) {
                    stopSearch();
                    console.log(`${MYNAME}: the search stopped, the group changed`);
                }
                if (follow) followGroup();
                mNotice = '';
                setHover(null);
            }
            mGroup = group;
            mGroupKey = key;
            mResult = null;
            mImages = null;
        }
        mKeepSides = false;
        if (isOn()) {
            // the search worker loads its modules in the background, ready for a search
            prepareDirichletSearch();
        }
        scheduleUpdate();
        if (!cfg.enabled) return group;
        const res = getResult();
        return (res && res.group) ? res.group : group;
    }

    function getResult() {
        if (!mGroup) return null;
        if (!mResult) {
            const base = dirichletBase(cfg);
            const words = parseWords(cfg.words);
            try {
                const found = words.map(w => dirichletSide(mGroup, base, w)).filter(Boolean);
                const group = found.length ? makeDirichletGroup(mGroup, { base, words: found.map(s => s.word) }) : null;
                if (cfg.enabled && words.length > 0 && !group) console.warn(`${MYNAME}: no side from the words '${cfg.words}'`);
                // the group leaves out the words it cannot use: the sides in its order
                const sides = group ? found.filter(s => group.dirichletWords.includes(s.word)) : [];
                const check = group ? checkDirichletDomain(mGroup, group, { maxIterations: cfg.iterations }) : null;
                mResult = { base, sides, group, cell: check ? check.cell : [], check };
                mResultWarned = false;
            } catch (e) {
                // the renderer draws the group itself rather than fail in every frame
                if (!mResultWarned) console.warn(`${MYNAME}: the Dirichlet domain of the words failed (${e.message}); the group's own domain is used`);
                mResultWarned = true;
                mResult = { base, sides: [], group: null, cell: [], check: null };
            }
            if (DEBUG) console.log(`${MYNAME}: ${mResult.sides.length} sides`, mResult);
            scheduleUpdate();
        }
        return mResult;
    }

    function getImages() {
        if (!mGroup) return [];
        if (!mImages) {
            mImages = dirichletImages(mGroup, {
                base: dirichletBase(cfg),
                depth: cfg.depth,
                minScale: cfg.minScale,
            });
        }
        return mImages;
    }

    // ---- the panel ---------------------------------------------------------------------

    // once after what changed in a frame, and out of the frame's way
    function scheduleUpdate() {
        if (mUpdateQueued) return;
        mUpdateQueued = true;
        Promise.resolve().then(update);
    }

    function update() {
        mUpdateQueued = false;
        showStatus();
        showList();
        runAuto();
    }

    function plural(n, word) {
        return `${n} ${word}${n === 1 ? '' : 's'}`;
    }

    /** {text, title, attention} of the domain as it stands */
    function statusOf() {
        if (mSearch) {
            const stage = mSearch.stage ? ` (${mSearch.stage})` : '';
            return { text: `searching${stage}`, title: 'the sides of the domain are being found in the background' };
        }
        if (!isOn() || !mGroup) return { text: 'off', title: 'the domain of the group is used' };
        const res = getResult();
        const n = res.sides.length;
        if (n === 0) {
            const given = parseWords(cfg.words).length > 0;
            return { text: given ? 'no side from the words' : 'no sides', title: mNotice, attention: given };
        }
        const c = res.check;
        const name = plural(n, 'side');
        if (!c) return { text: name, title: mNotice };
        if (c.ok) {
            const closes = c.partial ? 'the sides close up (the products of the farthest sides were not looked at)'
                : 'the sides close up: the domain of the base is complete';
            return { text: name, title: mNotice || closes, attention: !!mNotice };
        }
        const lines = [];
        if (c.unpaired) lines.push(`${plural(c.unpaired, 'side')} without a partner`);
        if (c.mismatched) lines.push(`${plural(c.mismatched, 'arc')} that the pairings do not map onto arcs`);
        if (c.stray) lines.push(`${plural(c.stray, 'generator')} that do not fold back to the base: the domain of a subgroup`);
        if (c.cutting) lines.push('images of the base that are no sides cut the domain');
        if (mNotice) lines.unshift(mNotice);
        return { text: `${name}, not closed`, title: lines.join('\n'), attention: true };
    }

    function showStatus() {
        const s = statusOf();
        const row = mParams.status;
        row.setName(s.text);
        row.setTitle(s.title ?? '');
        row.setAttention(!!s.attention);
        row.setAction(mSearch ? STOP_LOOK : SEARCH_LOOK);
    }

    function showList() {
        const res = (isOn() && mGroup) ? getResult() : null;
        if (!res || !res.group) {
            mParams.list.setItems([]);
            return;
        }
        const names = res.group.getGenNames();
        const c = res.check;
        const bounds = new Set(res.cell.map(e => e.index));
        mParams.list.setItems(res.sides.map((s, i) => {
            const word = compactWord(s.word);
            const partner = c ? c.partner[i] : -1;
            const open = c && bounds.has(i) && (partner < 0 || !bounds.has(partner));
            const unused = c && c.unused.includes(i);
            const pair = partner < 0 ? 'no partner side' : partner === i ? 'its own partner' : `partner side ${names[partner]}`;
            return {
                color: SIDE_COLORS[i % SIDE_COLORS.length],
                name: names[i] || String(i),
                text: word,
                note: partner >= 0 ? `↔ ${names[partner]}` : '',
                title: `${names[i]}: ${word}\n${pair}${bounds.has(i) ? '' : '\nbounds no arc of the domain'}`,
                attention: !!open,
                dim: !!unused,
            };
        }));
    }

    function onListHover(index) {
        setHover(index >= 0 ? { kind: 'side', index } : null);
        repaint();
    }

    function onListRemove(index) {
        const res = getResult();
        if (!res || !res.sides[index]) return;
        toggleWord(res.sides[index].word);
        commit();
    }

    /** the object under the pointer, marked in the list too */
    function setHover(hover) {
        mHover = hover;
        mParams.list.setHighlight(hover && hover.kind === 'side' ? hover.index : -1);
    }

    // ---- the canvas -------------------------------------------------------------------

    /**
     * the marks are on the canvas: the points or planes are shown, or the sides are
     * shown and there is a domain (it is used, or it has words); a document with no
     * Dirichlet domain shows nothing, not even the base
     */
    function isVisible() {
        if (!mGroup) return false;
        if (cfg.showPoints || cfg.showPlanes) return true;
        return cfg.showSides && (cfg.enabled || !!cfg.words.trim());
    }

    function screenOf(xy) {
        return navigator.transform2screen([xy[0], xy[1]]);
    }

    /**
     * the screen point of a label at the world point: through the sphere and the
     * Moebius transform; none under the projection maps, which have no single valued
     * inverse (the label is then left out)
     */
    function labelScreenOf(xy) {
        if (!navigator.worldToScreen) return screenOf(xy);
        if (navigator.hasProjectionMaps && navigator.hasProjectionMaps()) return null;
        return navigator.worldToScreen([xy[0], xy[1]]);
    }

    /** the world point the screen shows at the screen point, through the view's whole chain of maps where the navigator has it */
    function worldOf(spnt) {
        return navigator.screenToWorld ? navigator.screenToWorld(spnt).pnt : navigator.transform2world(spnt);
    }

    /** world units per pixel at the screen point (the view's local scale) */
    function scaleAt(spnt) {
        if (navigator.screenScale) return navigator.screenScale(spnt);
        const a = worldOf(spnt);
        const b = worldOf([spnt[0] + 1, spnt[1]]);
        const c = worldOf([spnt[0], spnt[1] + 1]);
        return Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    }

    /** the world distance of HIT_TOLERANCE pixels at the screen point */
    function toleranceAt(spnt) {
        return HIT_TOLERANCE * scaleAt(spnt);
    }

    function planeDistance(side, xy) {
        return Math.abs(iDistanceU4(side, iPoint([xy[0], xy[1], 0, 0])));
    }

    function pointDistance(point, xy) {
        return Math.hypot(point.v[0] - xy[0], point.v[1] - xy[1]);
    }

    function nearBase(spnt) {
        const w = worldOf(spnt);
        return Math.hypot(cfg.baseX - w[0], cfg.baseY - w[1]) <= (BASE_RADIUS + 3) * scaleAt(spnt);
    }

    /** the arcs of the side i in the boundary of the domain, null when it bounds no arc */
    function arcsOf(res, i) {
        const e = res.cell.find(c => c.index === i);
        return e ? e.arcs : null;
    }

    /**
     * the object under the screen point: a chosen side ({kind:'side', index}) by its image
     * or its arcs (a side that bounds no arc shows whole), a shown image
     * ({kind:'image', index}) by its point or plane, the nearest within the tolerance;
     * null when none
     */
    function pick(spnt) {
        const xy = worldOf(spnt);
        const tol = toleranceAt(spnt);
        let best = null;
        let bestDist = tol;
        const consider = (kind, index, d) => {
            if (d < bestDist) { bestDist = d; best = { kind, index }; }
        };
        const res = getResult();
        if (cfg.showSides && res) {
            res.sides.forEach((s, i) => consider('side', i, pointDistance(s.point, xy)));
            res.sides.forEach((s, i) => {
                const arcs = arcsOf(res, i);
                if (!arcs || sideArcContains(s.side, arcs, xy)) consider('side', i, planeDistance(s.side, xy));
            });
        }
        if (cfg.showPoints || cfg.showPlanes) {
            const imgs = getImages();
            if (cfg.showPoints) imgs.forEach((s, i) => consider('image', i, pointDistance(s.point, xy)));
            if (cfg.showPlanes) imgs.forEach((s, i) => consider('image', i, planeDistance(s.side, xy)));
        }
        return best;
    }

    // a word is added in the compact notation and found again by its plain word
    function toggleWord(word) {
        const words = parseWords(cfg.words);
        const plain = normalizeWord(mGroup, word);
        const i = words.findIndex(w => normalizeWord(mGroup, w) === plain);
        if (i >= 0) words.splice(i, 1);
        else words.push(compactWord(plain === null ? word : plain));
        setWords(words);
    }

    function onClick(spnt) {
        const obj = pick(spnt);
        if (obj) {
            const item = obj.kind === 'side' ? getResult().sides[obj.index] : getImages()[obj.index];
            toggleWord(item.word);
            return;
        }
        // the cell of the tiling under the pointer
        const cell = dirichletCellAt(mGroup, dirichletBase(cfg), worldOf(spnt), cfg.iterations);
        if (cell) {
            toggleWord(cell.word);
        } else if (DEBUG) {
            console.log(`${MYNAME}: no cell found under the pointer`);
        }
    }

    function onBaseMoved() {
        mNotice = '';
        mAutoPending = true;
        onDomainChanged();
    }

    function onBaseEdited() {
        if (mLoading) {
            onDomainChanged();
            return;
        }
        onBaseMoved();
        commitSoon();
    }

    function setBase(xy) {
        cfg.baseX = xy[0];
        cfg.baseY = xy[1];
        mParams.baseX.updateDisplay();
        mParams.baseY.updateDisplay();
        onBaseMoved();
    }

    function setCursor(cur) {
        if (!canvas) return;
        if (cur !== null && mCursor === null) mCursor = canvas.style.cursor;
        if (cur === null && mCursor !== null) {
            canvas.style.cursor = mCursor;
            mCursor = null;
        } else if (cur !== null) {
            canvas.style.cursor = cur;
        }
    }

    function endDrag() {
        const moved = mDrag.base !== baseKey();
        mDrag = null;
        commit();
        // the steps looked at the sides for the drag: what is left comes now
        if (moved) mAutoPending = true;
        scheduleUpdate();
    }

    function handleEvent(e) {
        if (!isVisible()) return;
        const spnt = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown':
            mDown = spnt;
            mMoved = false;
            if (nearBase(spnt)) {
                const w = worldOf(spnt);
                mDrag = { dx: cfg.baseX - w[0], dy: cfg.baseY - w[1], base: baseKey() };
                mGaveUp = null;
                // a long search answers for the base that is about to leave
                if (mSearch && !mSearch.quick) stopSearch();
                e.isConsumed = true;
                e.preventDefault();
            }
            break;
        case 'pointermove':
            mPointer = spnt;
            if (mDown && Math.hypot(spnt[0] - mDown[0], spnt[1] - mDown[1]) > CLICK_TOLERANCE) mMoved = true;
            if (mDrag) {
                const w = worldOf(spnt);
                setBase([w[0] + mDrag.dx, w[1] + mDrag.dy]);
                e.isConsumed = true;
            } else if (!e.buttons) {
                const hover = nearBase(spnt) ? { kind: 'base' } : cfg.editSides ? pick(spnt) : null;
                const same = (hover === mHover) || (hover && mHover && hover.kind === mHover.kind && hover.index === mHover.index);
                if (!same) {
                    setHover(hover);
                    setCursor(hover ? 'pointer' : null);
                    repaint();
                }
            }
            break;
        case 'pointerup':
        case 'pointerleave':
        case 'pointerout':
            if (mDrag) {
                endDrag();
                e.isConsumed = true;
            }
            if (e.type !== 'pointerup') mDown = null;
            break;
        case 'click':
            if (cfg.editSides && mDown && !mMoved && !mDrag) {
                onClick(spnt);
                commit();
            }
            mDown = null;
            break;
        }
    }

    // the move tool is taken up or left; left, the events go elsewhere: the hover
    // highlight, a press and a drag end
    function setActive(on) {
        mActive = on;
        repaint();
        if (on) return;
        setHover(null);
        setCursor(null);
        if (mDrag) endDrag();
        mDown = null;
    }

    function handleKey(e) {
        if (!isVisible() || e.type !== 'keydown') return;
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.code === 'KeyD' && mPointer && !ctrl) {
            setBase(worldOf(mPointer));
            commit();
            e.isConsumed = true;
        } else if (cfg.editSides && ctrl && (e.code === 'KeyZ' || e.code === 'KeyY')) {
            if (e.code === 'KeyY' || e.shiftKey) redo();
            else undo();
            e.isConsumed = true;
        }
    }

    function shortWord(word) {
        return word.length > 24 ? `${word.slice(0, 22)}…` : word;
    }

    function drawLabel(ctx, xy, text) {
        const s = labelScreenOf(xy);
        if (!s) return;
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFFC0';
        ctx.fillStyle = '#000000';
        ctx.strokeText(text, s[0] + 8, s[1] - 6);
        ctx.fillText(text, s[0] + 8, s[1] - 6);
    }

    /** how far along a line a side's ray has to go to leave the view */
    function viewReach() {
        const w = canvas ? canvas.width : 1024;
        const h = canvas ? canvas.height : 1024;
        const a = worldOf([0, 0]);
        const b = worldOf([w, h]);
        return 2 * (Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(a[0], a[1]));
    }

    /** the points of an arc on the screen: as many as it bends there, few where it is out of the view */
    function arcOnScreen(side, arc, reach) {
        const w = canvas ? canvas.width : Infinity;
        const h = canvas ? canvas.height : Infinity;
        const at = t => screenOf(sideArcPoint(side, arc, t, reach));
        const outOfView = (...pts) => pts.every(p => p[0] < 0) || pts.every(p => p[1] < 0)
            || pts.every(p => p[0] > w) || pts.every(p => p[1] > h);
        const first = at(0);
        const out = [first];
        const split = (t0, p0, t1, p1, depth) => {
            const tm = (t0 + t1) / 2;
            const pm = at(tm);
            const off = Math.hypot(pm[0] - (p0[0] + p1[0]) / 2, pm[1] - (p0[1] + p1[1]) / 2);
            const finer = depth < ARC_MIN_DEPTH || (depth < ARC_MAX_DEPTH && !(off <= ARC_PIXELS) && !outOfView(p0, pm, p1));
            if (finer) {
                split(t0, p0, tm, pm, depth + 1);
                split(tm, pm, t1, p1, depth + 1);
            } else {
                out.push(pm, p1);
            }
        };
        split(0, first, 1, at(1), 0);
        return out;
    }

    function strokeLine(ctx, points, style, width) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        let pen = false;
        for (const p of points) {
            if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
                pen = false;
                continue;
            }
            if (pen) ctx.lineTo(p[0], p[1]);
            else ctx.moveTo(p[0], p[1]);
            pen = true;
        }
        ctx.stroke();
    }

    /** the middle of the side's longest arc, the place of its label */
    function labelPlace(side, arcs, reach) {
        let best = arcs[0];
        for (const a of arcs) {
            if (Number.isFinite(a[1] - a[0]) && a[1] - a[0] > best[1] - best[0]) best = a;
        }
        return sideArcPoint(side, best, 0.5, reach);
    }

    function drawSides(ctx, res) {
        const names = res.group ? res.group.getGenNames() : [];
        const reach = viewReach();
        res.sides.forEach((s, i) => {
            const color = SIDE_COLORS[i % SIDE_COLORS.length];
            const hovered = !!mHover && mHover.kind === 'side' && mHover.index === i;
            const arcs = arcsOf(res, i);
            const lines = arcs ? arcs.map(a => arcOnScreen(s.side, a, reach)) : [];
            if (hovered) {
                // the whole bisector, and which part of it bounds the domain
                iDrawSplane(s.side, ctx, navigator, { lineStyle: color + '80', lineWidth: 1, shadowWidth: 0 });
                for (const l of lines) strokeLine(ctx, l, HOVER_STYLE.lineStyle, HOVER_STYLE.lineWidth);
            }
            for (const l of lines) strokeLine(ctx, l, color + '40', 10);
            for (const l of lines) strokeLine(ctx, l, color, 3);
            if (!arcs) {
                // no arc of the domain: it cuts off a piece of the cell elsewhere, or nothing
                ctx.setLineDash([5, 5]);
                iDrawSplane(s.side, ctx, navigator, { lineStyle: color, lineWidth: 1, shadowWidth: 0 });
                ctx.setLineDash([]);
            }
            iDrawCircle(s.point.v, ctx, navigator, { radius: SIDE_POINT_RADIUS, fill: color, stroke: '#000000' });
            if (cfg.showLabels || hovered) {
                const xy = arcs ? labelPlace(s.side, arcs, reach) : s.point.v;
                const name = names[i] || String(i);
                drawLabel(ctx, xy, hovered ? `${name}: ${shortWord(compactWord(s.word))}` : name);
            }
        });
    }

    function drawHint(ctx, lines) {
        ctx.save();
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';
        const width = Math.max(...lines.map(l => ctx.measureText(l).width));
        ctx.fillStyle = '#000000A0';
        ctx.fillRect(HINT_X, HINT_Y, width + 12, 16 * lines.length + 6);
        ctx.fillStyle = '#FFFFFF';
        lines.forEach((l, i) => ctx.fillText(l, HINT_X + 6, HINT_Y + 4 + 16 * i));
        ctx.restore();
    }

    // ---- the GPU pass: the marks as geometry in world coordinates (OverlayGeometry.js) ----

    const BLACK = cssColor('#000000');

    /** the arcs of the sides of the domain, the chosen sides' points, as the canvas draws them (drawSides) */
    function sidesGeometry(geo, res) {
        res.sides.forEach((s, i) => {
            const color = SIDE_COLORS[i % SIDE_COLORS.length];
            const hovered = !!mHover && mHover.kind === 'side' && mHover.index === i;
            const arcs = arcsOf(res, i);
            if (hovered) {
                // the whole bisector, and which part of it bounds the domain
                splaneGeometry(geo, s.side, { width: 1, color: cssColor(color, 0.5) });
                if (arcs) splaneGeometry(geo, s.side, { width: HOVER_STYLE.lineWidth, color: cssColor(HOVER_STYLE.lineStyle) }, arcs);
            }
            if (arcs) {
                splaneGeometry(geo, s.side, { width: 10, color: cssColor(color, 0.25) }, arcs);
                splaneGeometry(geo, s.side, { width: 3, color: cssColor(color) }, arcs);
            } else {
                // no arc of the domain: it cuts off a piece of the cell elsewhere, or nothing
                splaneGeometry(geo, s.side, { width: 1, color: cssColor(color), dash: 5, gap: 5 });
            }
            discGeometry(geo, s.point.v, { size: SIDE_POINT_RADIUS, fill: cssColor(color), color: BLACK, width: 1 });
        });
    }

    /**
     * the points, planes and sides and the base as geometry for the GPU pass; null
     * when nothing is shown. The labels and the hint are text: renderText.
     */
    function getOverlayGeometry() {
        if (!isVisible()) return null;
        const geo = newGeometry();
        const imgs = (cfg.showPoints || cfg.showPlanes) ? getImages() : [];
        const res = getResult();
        if (cfg.showPlanes) {
            const style = { width: PLANE_STYLE.lineWidth, color: cssColor(PLANE_STYLE.lineStyle) };
            for (const it of imgs) splaneGeometry(geo, it.side, style);
        }
        if (mHover && mHover.kind === 'image' && imgs[mHover.index]) {
            splaneGeometry(geo, imgs[mHover.index].side, { width: HOVER_STYLE.lineWidth, color: cssColor(HOVER_STYLE.lineStyle) });
        }
        if (cfg.showPoints) {
            const style = { size: POINT_RADIUS, fill: cssColor(POINT_STYLE.fill), width: 0 };
            for (const it of imgs) discGeometry(geo, it.point.v, style);
        }
        if (cfg.showSides && res) sidesGeometry(geo, res);
        const baseHovered = !!mHover && mHover.kind === 'base';
        discGeometry(geo, [cfg.baseX, cfg.baseY], {
            size: BASE_RADIUS, fill: cssColor(BASE_STYLE.fill),
            color: cssColor(baseHovered ? '#FF0000' : BASE_STYLE.stroke), width: baseHovered ? 2.5 : BASE_STYLE.strokeWidth,
        });
        return geo;
    }

    /** the text of the overlay, on the 2D canvas: the names of the sides and the hint */
    function renderText(ctx) {
        if (!isVisible()) return;
        const res = getResult();
        if (cfg.showSides && res) {
            const names = res.group ? res.group.getGenNames() : [];
            const reach = viewReach();
            res.sides.forEach((s, i) => {
                const hovered = !!mHover && mHover.kind === 'side' && mHover.index === i;
                if (!(cfg.showLabels || hovered)) return;
                const arcs = arcsOf(res, i);
                const xy = arcs ? labelPlace(s.side, arcs, reach) : s.point.v;
                const name = names[i] || String(i);
                drawLabel(ctx, xy, hovered ? `${name}: ${shortWord(compactWord(s.word))}` : name);
            });
        }
        if (cfg.editSides) drawHint(ctx, mActive ? HINT_LINES : HINT_OTHER_TOOL);
    }

    /** everything on the 2D canvas through the navigator, where there is no GPU pass */
    function renderUI(ctx) {
        if (!isVisible()) return;
        const imgs = (cfg.showPoints || cfg.showPlanes) ? getImages() : [];
        const res = getResult();
        if (cfg.showPlanes) {
            for (const it of imgs) iDrawSplane(it.side, ctx, navigator, PLANE_STYLE);
        }
        if (mHover && mHover.kind === 'image' && imgs[mHover.index]) {
            iDrawSplane(imgs[mHover.index].side, ctx, navigator, HOVER_STYLE);
        }
        if (cfg.showPoints) {
            for (const it of imgs) iDrawCircle(it.point.v, ctx, navigator, POINT_STYLE);
        }
        if (cfg.showSides && res) drawSides(ctx, res);
        const baseStyle = (mHover && mHover.kind === 'base') ? { ...BASE_STYLE, stroke: '#FF0000', strokeWidth: 2.5 } : BASE_STYLE;
        iDrawCircle([cfg.baseX, cfg.baseY], ctx, navigator, baseStyle);
        if (cfg.editSides) drawHint(ctx, mActive ? HINT_LINES : HINT_OTHER_TOOL);
    }

    return {
        getParams,
        getConfig,
        isEnabled,
        apply,
        keepSides,
        getResult,
        getImages,
        autoSelect: onAutoSelect,
        undo,
        redo,
        handleEvent,
        handleKey,
        setActive,
        renderUI,
        getOverlayGeometry,
        renderText,
    };
}
