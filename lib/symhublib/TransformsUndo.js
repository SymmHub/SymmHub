/*
  TransformsUndo.js — the undo steps of the edits of the list of conformal
  transformations (ProjectionTransform.js). docs/conformal_transforms_plan.md
  5.4 and section 13, outside the repository.

  The list is a part of the document, as the symmetry and the visualization
  layers are, so its edits are steps of the page's undo stack, among theirs
  (symdraw: the drawing's):

    - a row added, removed, moved, renamed or duplicated;
    - a row's values, its switch among them: the steps of one drag, or of
      typing in one field, are one;
    - the switch of the whole list.

  The rows are compared by uilib ParamListUndo.js (the list's param `maps`),
  the whole's switch, which is no row, by uilib ParamValueUndo.js. A step sets
  back what it changed and nothing else: the other rows stay as they are.

  No steps: what the list changes itself. It says where such a change starts
  and ends (the list's addOwnListener), so what the user changed just before
  is a step without it, and the next step starts after it:
    - a document loaded (the steps made before it do nothing afterwards: the
      rows they knew are gone);
    - the points a fixed points row finds again when the group changed (the
      group's change is the symmetry's step, which brings them back);
    - the frames of an animated row.
  Nor is the navigation: the Moebius transform, the sphere view and the canvas
  are not in the list.

  An undo or a redo calls onApplied(row) with the row it changed (the window
  selects it), null for the whole's switch.

  Usage:
    createTransformsUndo({
        list,           // the ProjectionTransform
        push,           // (entry) => the undo stack's push ({label, mergeKey, undo, redo})
        input,          // an InputWatch (default: a new one)
        onApplied,      // (row | null) after an undo or a redo, optional
        prefer,         // () => the id of the row the user works on, optional:
                        //       of two neighbours swapped, that one is the one moved
    });
*/

import {
    createParamListUndo,
    createParamValueUndo,
    createInputWatch,
} from './modules.js';

const LABEL = 'transformations';

/**
 * @param {object}   arg
 * @param {object}   arg.list         the ProjectionTransform
 * @param {function} arg.push         the undo stack's push(entry)
 * @param {object}   [arg.input]      {inEvent(), held(), gesture()} (an InputWatch)
 * @param {function} [arg.onApplied]  (row | null)
 * @param {function} [arg.prefer]     () => an id
 */
export function createTransformsUndo(arg) {

    const list = arg.list;
    const input = arg.input || createInputWatch();
    const applied = (row) => { if (arg.onApplied) arg.onApplied(row); };
    const wholeParam = () => list.getParams().enabled;

    const mRows = createParamListUndo({
        param:     () => list.getParams().maps,
        push:      arg.push,
        label:     LABEL,
        input,
        onApplied: applied,
        prefer:    arg.prefer,
    });

    const mWhole = createParamValueUndo({
        getValue:  () => ({ enabled: !!wholeParam().getValue() }),
        setValue:  (part) => { if (part && 'enabled' in part) wholeParam().setValue(!!part.enabled); },
        push:      arg.push,
        label:     LABEL,
        describe:  (ops) => (ops.some(op => op.after === false) ? 'all off' : 'all on'),
        input,
        onApplied: () => applied(null),
    });

    const mBoth = [mRows, mWhole];

    // a change that is not the list's own: an edit of the user's when their input
    // is being handled, else something the page did later, which is no step
    list.addListener((info) => {
        if (info && info.system) return;
        for (const r of mBoth) r.changed(false);
    });

    // the list's own changes: the user's edits so far are their step, the next
    // one starts from the values the list left
    list.addOwnListener({
        before: () => { for (const r of mBoth) r.flush(); },
        after:  (info) => {
            for (const r of mBoth) {
                if (info && info.load) r.changed(true, true);
                else r.rebase();
            }
        },
    });

    return {
        /** a step still to be looked at, now (before an undo) */
        flush: () => { for (const r of mBoth) r.flush(); },
    };
}
