/*
  SymmetryUndo.js — the undo steps of the edits of the symmetry: the group
  type, the group's parameters, the group transform and the Dirichlet
  domain's use, base and sides, however they are edited (the Symmetry tool's
  handles on the canvas and its bar, the symmetry window or the settings
  panel, the Dirichlet tool's clicks and searches). docs/symmetry_tool_plan.md,
  section 7 and phase E.

  A step is the values of the symmetry param that changed (uilib
  ParamValueUndo): one step per gesture. The sides a search finds after an
  edit join that edit's step (the Dirichlet tool says so: history.amend());
  the answer to its search button is a step of its own (history.step()). The
  steps go on the page's undo stack where it has one (symdraw: the
  drawing's, with the drawing's edits and the visualization layers'), else
  on a stack of their own. Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) undo and redo:
  on a page with a stack in every tool of the renderer that leaves these keys
  alone (the drawing's tools take them for the same stack), else in the
  Symmetry tool.

  The values recorded: groupType, group (the maker's value, set back as a
  whole), transform, and the Dirichlet domain's enabled, baseX, baseY and
  words. The other settings of the folder (the Dirichlet domain's options
  and what it shows, the symmetry options) are no steps.

  A document loaded and the values a script sets (the symmetry param's
  setValue and init) are no steps; a document loaded makes the steps before
  it do nothing and clears the stack of its own (the page clears its stack
  itself). An undo or a redo calls beforeApply() (the renderer: the
  Dirichlet tool keeps the sides set with the values, no search follows the
  group they bring back), then onApplied().

  Usage (SymRenderer):
    const undo = createSymmetryUndo({
        page,           // () => the page's undo {pushUndo, undo, redo, canUndo, canRedo}, or null
        beforeApply,    // () => before an undo or a redo sets values
        onApplied,      // () => after it
    });
    undo.watch(param)            once the params are made (the symmetry ParamGroup)
    undo.changed()               on every change of the symmetry
    undo.handleKey(e, inTool)    Ctrl+Z, Ctrl+Y: true when it used the key
    undo.history                 for the Dirichlet tool (amend, step, undo, redo, canUndo, canRedo)
*/

import {
    createParamValueUndo,
    createInputWatch,
    UndoStack,
} from './modules.js';

const DIRICHLET_KEYS = ['enabled', 'baseX', 'baseY', 'words'];
const DIRICHLET_NAMES = { enabled: 'use', baseX: 'base', baseY: 'base', words: 'sides' };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** the values of the symmetry param a step records */
export function symmetryUndoValue(v) {
    const out = {};
    for (const key of ['groupType', 'group', 'transform']) {
        if (v && key in v) out[key] = v[key];
    }
    if (v && v.dirichlet) {
        out.dirichlet = {};
        for (const key of DIRICHLET_KEYS) {
            if (key in v.dirichlet) out.dirichlet[key] = v.dirichlet[key];
        }
    }
    return out;
}

/** what a step changed, for its label: 'group K L', 'transform', 'Dirichlet sides' */
export function describeSymmetryStep(ops) {
    const parts = [];
    const add = (text) => { if (!parts.includes(text)) parts.push(text); };
    const typeChanged = ops.some(op => op.path[0] === 'groupType');
    for (const op of ops) {
        const [top, key] = op.path;
        if (top === 'groupType') add('group type');
        else if (top === 'group') { if (!typeChanged) add(groupText(op)); }
        else if (top === 'transform') add('transform');
        else if (top === 'dirichlet') add(`Dirichlet ${DIRICHLET_NAMES[key] || key}`);
        else add(op.path.join('.'));
    }
    return parts.join(', ');
}

// the group's parameters that changed, by their keys (a few), else 'group'
function groupText(op) {
    const b = op.before, a = op.after;
    if (!b || !a || b.className !== a.className || !b.params || !a.params) return 'group';
    const keys = Object.keys(a.params).filter(k => !same(a.params[k], b.params[k]));
    return keys.length && keys.length <= 3 ? `group ${keys.join(' ')}` : 'group';
}

export function createSymmetryUndo(opt = {}) {

    const mInput = opt.input || createInputWatch();
    let mRecorder = null;       // ParamValueUndo of the symmetry param, from watch()
    let mOwn = null;            // the stack of its own, on a page without one

    /** the page's stack, or null */
    function pageStack() {
        const page = opt.page ? opt.page() : null;
        return page && page.pushUndo && page.undo ? page : null;
    }

    function ownStack() {
        if (!mOwn) mOwn = UndoStack({ onChange: () => { if (opt.onChange) opt.onChange(); } });
        return mOwn;
    }

    function push(entry) {
        const page = pageStack();
        return page ? page.pushUndo(entry) : ownStack().push(entry);
    }

    function undo() {
        if (mRecorder) mRecorder.flush();
        const page = pageStack();
        if (page) page.undo(); else ownStack().undo();
    }

    function redo() {
        if (mRecorder) mRecorder.flush();
        const page = pageStack();
        if (page) page.redo(); else ownStack().redo();
    }

    function canUndo() {
        const page = pageStack();
        return page ? !!(page.canUndo && page.canUndo()) : ownStack().canUndo();
    }

    function canRedo() {
        const page = pageStack();
        return page ? !!(page.canRedo && page.canRedo()) : ownStack().canRedo();
    }

    // a document's values, or a script's: no step; a document's make the steps before it nothing
    function loaded(load) {
        if (mRecorder) mRecorder.changed(true, load);
        if (load && mOwn) mOwn.clear();
    }

    /** the symmetry param: its values are recorded from now on */
    function watch(param) {
        const set = param.setValue;
        const init = param.init;
        param.setValue = (value, initialize = false) => {
            loaded(!!initialize);
            return set(value, initialize);
        };
        if (init) {
            param.init = (...args) => {
                loaded(true);
                return init(...args);
            };
        }
        mRecorder = createParamValueUndo({
            getValue:    () => symmetryUndoValue(param.getValue()),
            setValue:    (part) => set(part),
            push,
            label:       'symmetry',
            describe:    describeSymmetryStep,
            input:       mInput,
            beforeApply: () => { if (opt.beforeApply) opt.beforeApply(); },
            onApplied:   () => { if (opt.onApplied) opt.onApplied(); },
        });
    }

    /** Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z; inTool: the Symmetry tool is the renderer's tool */
    function handleKey(e, inTool = false) {
        if (e.type !== 'keydown' || !(e.ctrlKey || e.metaKey) || e.altKey) return false;
        if (!inTool && !pageStack()) return false;
        const k = (e.key || '').toLowerCase();
        if (k === 'z' && !e.shiftKey) { undo(); return true; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { redo(); return true; }
        return false;
    }

    return {
        watch,
        changed: () => { if (mRecorder) mRecorder.changed(); },
        handleKey,
        undo,
        redo,
        canUndo,
        canRedo,
        hasPageStack: () => !!pageStack(),
        // the Dirichlet tool's: its searches' sides join the step that asked for them, or are one
        history: {
            amend: () => { if (mRecorder) mRecorder.amend(); },
            step:  () => { if (mRecorder) mRecorder.step(); },
            undo,
            redo,
            canUndo,
            canRedo,
        },
    };
}
