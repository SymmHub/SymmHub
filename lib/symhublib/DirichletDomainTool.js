/*
  DirichletDomainTool.js — the Dirichlet domain of the renderer's group, as an operation
  on the group (after the group transform), with its parameters and the interactive
  choice of the sides on the canvas. Ported from the Orb repo's Dirichlet domain builders
  (2026-10-26); the computation is lib/grouplib/DirichletDomain.js.

  Parameters (saved in the document as symmetry.dirichlet):
    enabled          the renderer uses the Dirichlet domain instead of the group's own
    baseX, baseY     the base point on the plane (the domain is the limit of the
                     Dirichlet domains in the upper half space of the points above it
                     as their height goes to 0; for a group of isometries of the
                     plane, the hyperbolic plane or the sphere it is the group's own
                     Dirichlet domain; the base height baseW of older documents is
                     not used)
    words            the words of the sides, space separated: each names the group
                     element g whose image of the base lies across the side (a lowercase
                     letter is a generator, an uppercase one its inverse)
    depth            the images of the base of the words of at most this many letters
                     are shown as candidate points and planes
    minScale, iterations  the images where the transform's scale factor at the
                     base is below minScale are left out (they lie near the limit set,
                     with tiny sides); the folds of points into the fundamental domain
                     take at most `iterations` steps
    showPoints, showPlanes   show the candidate images and their bisectors
    showSides, showLabels    show the chosen sides with their images, named by the
                     letters of the Dirichlet group's generators
    auto select      replaces the words by the sides of the Dirichlet domain found
                     automatically (selectDirichletSides, in a worker:
                     grouplib/DirichletSearch.js); while it runs the button reads
                     'stop search' and stops it. clear empties the words
    searchTime       the time limit of auto select in seconds: the search then
                     answers with the sides found so far (a barely discrete group
                     can take long, a group that is not discrete has no domain)

  On the canvas, with the move tool, while points, planes or sides are shown:
    drag the base point (the yellow disc);
    click a shown point or plane to add its word to the sides, click a side's point or
    circle to remove it;
    click anywhere else to add the side of the cell of the group's tiling under the
    pointer (found by folding, so its word can be long);
    the key D moves the base point to the pointer.

  Tool contract (SymRenderer): handleEvent(e) sets e.isConsumed when the event is
  used; handleKey(e) likewise; renderUI(ctx, canvasTransform) draws on the overlay
  canvas through the navigator.
*/

import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamString,
    ParamFunc,
    iDrawSplane,
    iDrawCircle,
    iPoint,
    iDistanceU4,
    parseWords,
    wordsToString,
    dirichletBase,
    dirichletSide,
    makeDirichletGroup,
    dirichletImages,
    dirichletCellAt,
    dirichletCell,
    DEFAULT_SEARCH_SECONDS,
    startDirichletSearch,
    prepareDirichletSearch,
} from './modules.js';

const MYNAME = 'DirichletDomainTool';
const DEBUG = false;

const HIT_TOLERANCE = 8;       // canvas pixels
const CLICK_TOLERANCE = 3;     // a press that moved less is a click
const BASE_RADIUS = 7;
const POINT_RADIUS = 3;
const SIDE_POINT_RADIUS = 5;

const BASE_STYLE = { radius: BASE_RADIUS, fill: '#FFFF22', stroke: '#000000', strokeWidth: 1.5 };
const POINT_STYLE = { radius: POINT_RADIUS, fill: '#0070C0' };
const PLANE_STYLE = { lineStyle: '#7000D080', lineWidth: 1 };
const HOVER_STYLE = { lineStyle: '#FFFF00', lineWidth: 8, shadowWidth: 0 };
const SIDE_COLORS = ['#D01010', '#10A010', '#1040E0', '#E08000', '#A000A0', '#009090', '#806000', '#404040'];

export function DirichletDomainTool(opt = {}) {

    const navigator = opt.navigator;
    const canvas = opt.canvas;
    const repaint = opt.repaint || (() => {});
    const onChanged = opt.onChanged || repaint;

    const cfg = {
        enabled: false,
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
    let mResult = null;      // {group, sides} of the current words, null before it is computed
    let mImages = null;      // the candidate images of the base, null before they are computed
    let mPointer = null;     // the last pointer position on the canvas
    let mDown = null;        // the position of the last press
    let mMoved = false;      // the pointer moved since the press
    let mDrag = null;        // {dx, dy}: the base is dragged, the offset of the grab from the base
    let mHover = null;       // the object under the pointer: {kind, index}
    let mSearch = null;      // the running auto select: {group, cancel}
    let mResultWarned = false;

    const AUTO_SELECT = 'auto select';
    const mParams = makeParams();

    // ---- parameters ------------------------------------------------------------------

    function makeParams() {
        const odc = onDomainChanged;
        const ovc = onViewChanged;
        const inc = 1e-10;
        return ParamGroup({
            name: 'dirichlet domain',
            params: {
                enabled:    ParamBool({ obj: cfg, key: 'enabled', name: 'use', onChange: odc }),
                baseX:      ParamFloat({ obj: cfg, key: 'baseX', name: 'base X', min: -10, max: 10, step: inc, onChange: odc }),
                baseY:      ParamFloat({ obj: cfg, key: 'baseY', name: 'base Y', min: -10, max: 10, step: inc, onChange: odc }),
                words:      ParamString({ obj: cfg, key: 'words', name: 'sides', tooltip: true, onChange: odc }),
                autoSelect: ParamFunc({ name: AUTO_SELECT, func: onAutoSelect, tooltip: 'the sides of the Dirichlet domain of the base point, found automatically in the background; click again to stop' }),
                clear:      ParamFunc({ name: 'clear', func: onClear }),
                searchTime: ParamInt({ obj: cfg, key: 'searchTime', name: 'search time', min: 1, max: 300, tooltip: 'auto select stops after this many seconds and takes the sides found so far' }),
                depth:      ParamInt({ obj: cfg, key: 'depth', name: 'depth', min: 1, max: 100, onChange: ovc }),
                minScale:   ParamFloat({ obj: cfg, key: 'minScale', name: 'min scale', min: 0, max: 1, step: inc, onChange: ovc }),
                iterations: ParamInt({ obj: cfg, key: 'iterations', name: 'fold iterations', min: 1, max: 5000, onChange: ovc }),
                showPoints: ParamBool({ obj: cfg, key: 'showPoints', name: 'show points', onChange: ovc }),
                showPlanes: ParamBool({ obj: cfg, key: 'showPlanes', name: 'show planes', onChange: ovc }),
                showSides:  ParamBool({ obj: cfg, key: 'showSides', name: 'show sides', onChange: ovc }),
                showLabels: ParamBool({ obj: cfg, key: 'showLabels', name: 'show labels', onChange: ovc }),
            }
        });
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
        mHover = null;
        onChanged();
    }

    function onViewChanged() {
        mImages = null;
        mHover = null;
        repaint();
    }

    function setWords(words) {
        mParams.words.setValue(wordsToString(words));
    }

    function onClear() {
        setWords([]);
    }

    function setSearchLabel(text) {
        if (mParams.autoSelect.setName) mParams.autoSelect.setName(text);
    }

    /** stops the running auto select, if any */
    function stopSearch() {
        if (!mSearch) return;
        const s = mSearch;
        mSearch = null;
        s.cancel();
        setSearchLabel(AUTO_SELECT);
    }

    /**
     * auto select: the search runs in a worker with the time limit; a second click
     * stops it. The words are set when it answers for the group it started with.
     */
    function onAutoSelect() {
        if (mSearch) {
            stopSearch();
            console.log(`${MYNAME}: auto select stopped`);
            return;
        }
        if (!mGroup) return;
        const group = mGroup;
        const search = startDirichletSearch(group, {
            base: dirichletBase(cfg),
            depth: cfg.depth,
            minScale: cfg.minScale,
            maxIterations: cfg.iterations,
            timeLimit: cfg.searchTime,
            onProgress: text => {
                const m = /^round (\d+)/.exec(text);
                if (mSearch && mSearch.handle === search && m) setSearchLabel(`stop search (round ${m[1]})`);
            },
            onStage: stage => {
                if (!mSearch || mSearch.handle !== search) return;
                setSearchLabel(stage === 'loading' ? 'stop search (loading)' : stage === 'page' ? 'stop search (in the page)' : 'stop search');
            },
        });
        // the handle tells which search answers
        mSearch = { group, cancel: search.cancel, handle: search };
        setSearchLabel('stop search');
        search.promise.then(res => {
            if (!mSearch || mSearch.handle !== search) return;   // stopped or replaced
            mSearch = null;
            setSearchLabel(AUTO_SELECT);
            if (res.stopped) {
                console.warn(`${MYNAME}: auto select ${res.stopped === 'time' ? 'did not answer within its time limit' : 'stopped'} after ${res.ms} ms; the sides are unchanged`);
                return;
            }
            if (res.error) {
                console.warn(`${MYNAME}: auto select failed: ${res.error}`);
                return;
            }
            if (group !== mGroup) {
                console.warn(`${MYNAME}: auto select answered for a group that has changed meanwhile; the sides are unchanged`);
                return;
            }
            const where = res.where === 'worker' ? ` in the worker${res.loadMs ? ` (loaded in ${res.loadMs} ms)` : ''}` : res.where === 'page' ? ' in the page' : '';
            console.log(`${MYNAME}: ${res.words.length} sides from ${res.candidates} candidates in ${res.ms} ms${where}${res.timedOut ? ' (time limit reached, best effort)' : ''}: ${res.words.join(' ')}`);
            setWords(res.words);
        });
    }

    // ---- the operation on the group --------------------------------------------------

    function isEnabled() {
        return cfg.enabled;
    }

    /** true when the renderer draws a Dirichlet domain: enabled, with sides */
    function isActive() {
        return cfg.enabled && !!(getResult() && getResult().group);
    }

    /**
     * the group with the Dirichlet domain of the base as its fundamental domain, or
     * the group itself when the domain is off or has no side; the group is kept for
     * the display and the picking
     */
    function apply(group) {
        if (group !== mGroup) {
            // a search for the previous group would answer for a group that is gone
            if (mSearch && mSearch.group !== group) {
                stopSearch();
                console.log(`${MYNAME}: auto select stopped, the group changed`);
            }
            mGroup = group;
            mResult = null;
            mImages = null;
            mHover = null;
        }
        if (!cfg.enabled) return group;
        // the search worker loads its modules in the background, ready for auto select
        prepareDirichletSearch();
        const res = getResult();
        return (res && res.group) ? res.group : group;
    }

    function getResult() {
        if (!mGroup) return null;
        if (!mResult) {
            const base = dirichletBase(cfg);
            const words = parseWords(cfg.words);
            try {
                const sides = words.map(w => dirichletSide(mGroup, base, w)).filter(Boolean);
                const group = sides.length ? makeDirichletGroup(mGroup, { base, words: sides.map(s => s.word) }) : null;
                if (cfg.enabled && words.length > 0 && !group) console.warn(`${MYNAME}: no side from the words '${cfg.words}'`);
                mResult = { base, sides, group, cell: group ? dirichletCell(group.getFundDomain()) : [] };
                mResultWarned = false;
            } catch (e) {
                // the renderer draws the group itself rather than fail in every frame
                if (!mResultWarned) console.warn(`${MYNAME}: the Dirichlet domain of the words failed (${e.message}); the group's own domain is used`);
                mResultWarned = true;
                mResult = { base, sides: [], group: null, cell: [] };
            }
            if (DEBUG) console.log(`${MYNAME}: ${mResult.sides.length} sides`, mResult);
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

    // ---- the canvas -------------------------------------------------------------------

    function isVisible() {
        return !!mGroup && (cfg.showPoints || cfg.showPlanes || cfg.showSides);
    }

    function screenOf(xy) {
        return navigator.transform2screen([xy[0], xy[1]]);
    }

    function worldOf(spnt) {
        return navigator.transform2world(spnt);
    }

    /** the world distance of HIT_TOLERANCE pixels at the screen point */
    function toleranceAt(spnt) {
        const a = worldOf(spnt);
        const b = worldOf([spnt[0] + HIT_TOLERANCE, spnt[1]]);
        const c = worldOf([spnt[0], spnt[1] + HIT_TOLERANCE]);
        return Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    }

    function planeDistance(side, xy) {
        return Math.abs(iDistanceU4(side, iPoint([xy[0], xy[1], 0, 0])));
    }

    function pointDistance(point, xy) {
        return Math.hypot(point.v[0] - xy[0], point.v[1] - xy[1]);
    }

    function nearBase(spnt) {
        const b = screenOf([cfg.baseX, cfg.baseY]);
        return Math.hypot(b[0] - spnt[0], b[1] - spnt[1]) <= BASE_RADIUS + 3;
    }

    /**
     * the object under the screen point: a chosen side ({kind:'side', index}), a shown
     * image ({kind:'image', index}) by its point or plane, the nearest within the
     * tolerance; null when none
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
            res.sides.forEach((s, i) => consider('side', i, planeDistance(s.side, xy)));
        }
        if (cfg.showPoints || cfg.showPlanes) {
            const imgs = getImages();
            if (cfg.showPoints) imgs.forEach((s, i) => consider('image', i, pointDistance(s.point, xy)));
            if (cfg.showPlanes) imgs.forEach((s, i) => consider('image', i, planeDistance(s.side, xy)));
        }
        return best;
    }

    function toggleWord(word) {
        const words = parseWords(cfg.words);
        const i = words.indexOf(word);
        if (i >= 0) words.splice(i, 1);
        else words.push(word);
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

    function setBase(xy) {
        mParams.baseX.setValue(xy[0]);
        mParams.baseY.setValue(xy[1]);
    }

    function setCursor(cur) {
        if (canvas) canvas.style.cursor = cur;
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
                mDrag = { dx: cfg.baseX - w[0], dy: cfg.baseY - w[1] };
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
                const hover = nearBase(spnt) ? { kind: 'base' } : pick(spnt);
                const same = (hover === mHover) || (hover && mHover && hover.kind === mHover.kind && hover.index === mHover.index);
                if (!same) {
                    mHover = hover;
                    setCursor(hover ? 'pointer' : '');
                    repaint();
                }
            }
            break;
        case 'pointerup':
        case 'pointerleave':
        case 'pointerout':
            if (mDrag) {
                mDrag = null;
                e.isConsumed = true;
            }
            if (e.type !== 'pointerup') mDown = null;
            break;
        case 'click':
            if (mDown && !mMoved && !mDrag) onClick(spnt);
            mDown = null;
            break;
        }
    }

    function handleKey(e) {
        if (!isVisible() || e.type !== 'keydown') return;
        if (e.code === 'KeyD' && mPointer && !e.ctrlKey && !e.metaKey) {
            setBase(worldOf(mPointer));
            e.isConsumed = true;
        }
    }

    function shortWord(word) {
        return word.length > 12 ? `${word.slice(0, 10)}… (${word.length})` : word;
    }

    function drawLabel(ctx, xy, text) {
        const s = screenOf(xy);
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFFC0';
        ctx.fillStyle = '#000000';
        ctx.strokeText(text, s[0] + 8, s[1] - 6);
        ctx.fillText(text, s[0] + 8, s[1] - 6);
    }

    function renderUI(ctx) {
        if (!isVisible()) return;
        const imgs = (cfg.showPoints || cfg.showPlanes) ? getImages() : [];
        const res = getResult();
        if (cfg.showPlanes) {
            for (const it of imgs) iDrawSplane(it.side, ctx, navigator, PLANE_STYLE);
        }
        if (mHover && mHover.kind === 'image') {
            iDrawSplane(imgs[mHover.index].side, ctx, navigator, HOVER_STYLE);
        }
        if (cfg.showPoints) {
            for (const it of imgs) iDrawCircle(it.point.v, ctx, navigator, POINT_STYLE);
        }
        if (cfg.showSides && res) {
            const names = res.group ? res.group.getGenNames() : [];
            res.sides.forEach((s, i) => {
                const color = SIDE_COLORS[i % SIDE_COLORS.length];
                if (mHover && mHover.kind === 'side' && mHover.index === i) iDrawSplane(s.side, ctx, navigator, HOVER_STYLE);
                iDrawSplane(s.side, ctx, navigator, { lineStyle: color, lineWidth: 3, shadowStyle: color + '40', shadowWidth: 10 });
                iDrawCircle(s.point.v, ctx, navigator, { radius: SIDE_POINT_RADIUS, fill: color, stroke: '#000000' });
                if (cfg.showLabels) drawLabel(ctx, s.point.v, `${names[i] || i}: ${shortWord(s.word)}`);
            });
        }
        const baseStyle = (mHover && mHover.kind === 'base') ? { ...BASE_STYLE, stroke: '#FF0000', strokeWidth: 2.5 } : BASE_STYLE;
        iDrawCircle([cfg.baseX, cfg.baseY], ctx, navigator, baseStyle);
    }

    return {
        getParams,
        getConfig,
        isEnabled,
        isActive,
        apply,
        getResult,
        getImages,
        autoSelect: onAutoSelect,
        handleEvent,
        handleKey,
        renderUI,
    };
}
