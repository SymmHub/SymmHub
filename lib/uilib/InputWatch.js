/*
  InputWatch.js — whether the page is handling the user's input now, and the
  press it belongs to.

  inEvent(): true while an event of the user's input (a press, a key, typing,
  a wheel, a drop, a drag's moves) is handled, and for the rest of that task
  (what its handlers left for microtasks); false in the tasks after it (a
  worker's answer, a timer, a promise of a file read). So a change seen with
  inEvent() true was made by the user's hand, not by the page on its own.

  gesture(): a number that changes with each press of a pointer, each click
  and each key pressed outside a text field: the changes of one drag, or of
  typing in one field, have the same number, two clicks have two.

  Usage:
    const input = createInputWatch();     // listens on window, capture phase
    if (input.inEvent()) ...
    input.dispose();
*/

// the events of the user's input; the moves only with a button down (a drag)
const EVENTS = [
    'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
    'keydown', 'keyup', 'input', 'change', 'wheel', 'focusout', 'drop', 'paste', 'cut',
    'pointermove', 'mousemove', 'touchstart', 'touchmove', 'touchend',
];
const MOVES = new Set(['pointermove', 'mousemove']);

/** a field that takes typing: its keys are not presses of their own */
function isTextField(el){
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'range', 'file'].includes(el.type);
}

/**
 * @param {EventTarget} [target]  where to listen (window); none (Node): never in an event
 */
export function createInputWatch(target = (typeof window !== 'undefined' ? window : null)) {

    let mIn = false;
    let mTimer = null;
    let mGesture = 0;

    function onEvent(e){
        if (MOVES.has(e.type) && !e.buttons) return;
        if (e.type === 'pointerdown' || e.type === 'click' ||
            (e.type === 'keydown' && !isTextField(e.target))) mGesture++;
        mIn = true;
        // the end of this task: a timer runs after it and its microtasks
        if (!mTimer) mTimer = setTimeout(() => { mTimer = null; mIn = false; }, 0);
    }

    if (target) for (const type of EVENTS) target.addEventListener(type, onEvent, true);

    return {
        inEvent: () => mIn,
        gesture: () => mGesture,
        dispose(){
            if (target) for (const type of EVENTS) target.removeEventListener(type, onEvent, true);
        },
    };
}
