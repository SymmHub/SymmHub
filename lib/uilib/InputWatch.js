/*
  InputWatch.js — whether the page is handling the user's input now, and the
  press it belongs to.

  inEvent(): true while an event of the user's input (a press, a key, typing,
  a wheel, a drop, a drag's moves) is handled, and for the rest of that task
  (what its handlers left for microtasks); false in the tasks after it (a
  worker's answer, a timer, a promise of a file read). So a change seen with
  inEvent() true was made by the user's hand, not by the page on its own.

  held(): true while a pointer's button is down (from its press to its
  release): a change then may come from a timer of the control being held
  (a spin button that repeats) and still be the user's.

  gesture(): a number that changes with each press of a pointer, each click
  and each key pressed outside a text field: the changes of one drag, or of
  typing in one field, have the same number, two clicks have two. A key
  pressed while a pointer's button is down belongs to that press (Shift for
  fine steps, Escape that puts a drag back), and neither a key held down
  (its repeats) nor a modifier key alone starts a gesture.

  Usage:
    const input = createInputWatch();     // listens on window, capture phase
    if (input.inEvent()) ...
    input.dispose();
*/

// the events of the user's input; the moves only with a button down (a drag)
const EVENTS = [
    'pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
    'keydown', 'keyup', 'input', 'change', 'wheel', 'focusout', 'drop', 'paste', 'cut',
    'pointermove', 'mousemove', 'touchstart', 'touchmove', 'touchend',
];
const MOVES = new Set(['pointermove', 'mousemove']);
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn', 'OS']);

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
    let mHeld = false;

    /** a key that starts a gesture of its own */
    function newKey(e){
        return !mHeld && !e.repeat && !MODIFIERS.has(e.key) && !isTextField(e.target);
    }

    function onEvent(e){
        if (e.type === 'pointerdown' || e.type === 'mousedown') mHeld = true;
        else if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'mouseup') mHeld = !!e.buttons;
        if (MOVES.has(e.type) && !e.buttons) {
            mHeld = false;      // a release missed (outside the window)
            return;
        }
        if (e.type === 'pointerdown' || e.type === 'click' || (e.type === 'keydown' && newKey(e))) mGesture++;
        mIn = true;
        // the end of this task: a timer runs after it and its microtasks
        if (!mTimer) mTimer = setTimeout(() => { mTimer = null; mIn = false; }, 0);
    }

    if (target) for (const type of EVENTS) target.addEventListener(type, onEvent, true);

    return {
        inEvent: () => mIn,
        held: () => mHeld,
        gesture: () => mGesture,
        dispose(){
            if (target) for (const type of EVENTS) target.removeEventListener(type, onEvent, true);
        },
    };
}
