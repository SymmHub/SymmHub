/**
 * AsyncTracker — a lightweight global counter for pending async operations.
 *
 * Any module that starts an asynchronous load (textures, audio, meshes, …)
 * calls begin() to obtain an opaque token, then end(token) when the
 * operation completes (success or failure).
 *
 * TestWriter (or any other orchestrator) calls waitForIdle() to get a
 * Promise that resolves once every in-flight operation has finished.
 *
 * Usage:
 *   import { asyncTracker } from './AsyncTracker.js';
 *
 *   const token = asyncTracker.begin('my-resource-label');
 *   try  { ... await doAsyncWork() ... }
 *   finally { asyncTracker.end(token); }
 */

const MYNAME = 'AsyncTracker';
const DEBUG  = false;

class AsyncTracker {

    constructor() {
        this._pending = 0;     // count of in-flight ops
        this._waiters = [];    // resolve callbacks queued by waitForIdle()
    }

    /**
     * Signal that an async operation has started.
     * @param {string} [label]  Human-readable description (for debugging).
     * @returns {object}  Opaque token — pass it back to end().
     */
    begin(label = '') {
        this._pending++;
        const token = { label };
        if (DEBUG) console.log(`${MYNAME}.begin('${label}') → pending=${this._pending}`);
        return token;
    }

    /**
     * Signal that an async operation has completed (success or failure).
     * @param {object} token  The token returned by begin().
     */
    end(token) {
        if (this._pending === 0) {
            console.warn(`${MYNAME}.end('${token?.label}') called with no pending ops`);
            return;
        }
        this._pending--;
        if (DEBUG) console.log(`${MYNAME}.end('${token?.label}') → pending=${this._pending}`);
        if (this._pending === 0) this._flush();
    }

    /** Current count of in-flight operations. */
    get pendingCount() { return this._pending; }

    /**
     * Returns a Promise that resolves when the pending count reaches 0.
     * Resolves immediately if already idle.
     *
     * If a chain reaction (A finishing triggers B to start) could occur,
     * callers may await waitForIdle() again or use quietFrames > 0.
     *
     * @param {number} [quietFrames=0]  Extra rAF ticks to wait after idle
     *                                   to catch any synchronous chain loads.
     */
    waitForIdle(quietFrames = 0) {
        const waitIdle = () => {
            if (this._pending === 0) return Promise.resolve();
            return new Promise(resolve => this._waiters.push(resolve));
        };

        if (quietFrames <= 0) return waitIdle();

        // After the counter hits 0, wait N more frames before resolving.
        return waitIdle().then(() => new Promise(resolve => {
            let count = 0;
            const tick = () => {
                // If something kicked off a new load while we waited, reset.
                if (this._pending > 0) {
                    waitIdle().then(() => {
                        count = 0;
                        requestAnimationFrame(tick);
                    });
                    return;
                }
                if (++count >= quietFrames) resolve();
                else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }));
    }

    _flush() {
        const waiters = this._waiters.splice(0);
        waiters.forEach(r => r());
    }
}

/** Singleton shared across the entire application. */
export const asyncTracker = new AsyncTracker();
