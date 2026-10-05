/**
 * DragReorder.js
 *
 * Reordering the rows of a list by dragging them with the mouse or a pen.
 *
 *   const drag = makeDragReorder({
 *       getRows: () => [{ handle, block }, ...],   // the rows in list order
 *       onMove:  (from, to) => { ... },            // to: the row's index after the move
 *   });
 *   drag.attach(handle);    // a press on it can start a drag (once per row)
 *
 *   handle: the element that is pressed (a title row)
 *   block:  the whole row (the handle and everything under it, e.g. an open folder)
 *
 * A press that moves more than a few pixels starts a drag; one that does not stays
 * a click. While dragging, a line shows where the row would go and the list scrolls
 * when the pointer is near the top or bottom edge of its scrolling container. The
 * release moves the row there; the click that ends a drag is swallowed. Escape
 * cancels. Touch is left to scrolling.
 */

const STYLE_ID = 'drag-reorder-style';

const CSS = `
.drag-reorder-line {
    position: fixed; height: 2px; z-index: 99998; pointer-events: none;
    background: var(--slider-fill-color, #2fa1d6);
}
.drag-reorder-source { opacity: 0.5; }
body.drag-reorder-dragging, body.drag-reorder-dragging * { cursor: grabbing !important; }
`;

const THRESHOLD   = 4;    // pixels the pointer moves before a press becomes a drag
const SCROLL_EDGE = 24;   // pixels from the container's edge where it scrolls
const SCROLL_STEP = 8;    // pixels per scroll tick
const SCROLL_TICK = 30;   // ms

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// The nearest ancestor that scrolls vertically, or null.
function scrollParent(el) {
    for (let p = el && el.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
}

// Swallows the click that the release of a drag produces.
function swallowNextClick() {
    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

export function makeDragReorder({ getRows, onMove }) {

    function attach(handle) {
        handle.addEventListener('pointerdown', (e) => onPointerDown(e, handle));
    }

    function onPointerDown(e, handle) {
        if (e.button !== 0 || e.pointerType === 'touch') return;
        const rows = getRows();
        const from = rows.findIndex(r => r.handle === handle);
        if (from < 0 || rows.length < 2) return;

        const startX = e.clientX;
        const startY = e.clientY;
        let lastY     = startY;
        let dragging  = false;
        let cancelled = false;
        let line      = null;
        let scroller  = null;
        let scrollDir = 0;
        let scrollTimer = null;

        // where the row would go: the index of the row it would come before (rows.length: the end)
        function insertionIndex() {
            for (let k = 0; k < rows.length; k++) {
                const r = rows[k].handle.getBoundingClientRect();
                if (lastY < r.top + r.height / 2) return k;
            }
            return rows.length;
        }

        function showLine() {
            const ins = insertionIndex();
            if (ins === from || ins === from + 1) {   // the row stays where it is
                line.style.display = 'none';
                return;
            }
            const h = rows[0].handle.getBoundingClientRect();
            const y = ins < rows.length
                ? rows[ins].block.getBoundingClientRect().top
                : rows[rows.length - 1].block.getBoundingClientRect().bottom;
            line.style.display = '';
            line.style.left  = `${h.left}px`;
            line.style.width = `${h.width}px`;
            line.style.top   = `${Math.round(y) - 1}px`;
        }

        function autoScroll() {
            if (!scroller) return;
            const r = scroller.getBoundingClientRect();
            const dir = lastY < r.top + SCROLL_EDGE ? -1 : lastY > r.bottom - SCROLL_EDGE ? 1 : 0;
            if (dir === scrollDir) return;
            scrollDir = dir;
            clearInterval(scrollTimer);
            scrollTimer = null;
            if (dir === 0) return;
            scrollTimer = setInterval(() => {
                scroller.scrollTop += scrollDir * SCROLL_STEP;
                if (!cancelled) showLine();
            }, SCROLL_TICK);
        }

        function startDrag(e) {
            dragging = true;
            ensureStyle();
            try { handle.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone */ }
            rows[from].block.classList.add('drag-reorder-source');
            document.body.classList.add('drag-reorder-dragging');
            line = document.createElement('div');
            line.className = 'drag-reorder-line';
            document.body.appendChild(line);
            scroller = scrollParent(rows[from].block);
        }

        function onPointerMove(e) {
            lastY = e.clientY;
            if (!dragging) {
                if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(lastY - startY) < THRESHOLD) return;
                startDrag(e);
            }
            if (cancelled) return;
            e.preventDefault();
            showLine();
            autoScroll();
        }

        function stopVisuals() {
            clearInterval(scrollTimer);
            scrollTimer = null;
            scrollDir = 0;
            line?.remove();
            line = null;
            rows[from].block.classList.remove('drag-reorder-source');
            document.body.classList.remove('drag-reorder-dragging');
        }

        function finish(e, commit) {
            window.removeEventListener('pointermove',   onPointerMove, true);
            window.removeEventListener('pointerup',     onPointerUp,   true);
            window.removeEventListener('pointercancel', onCancel,      true);
            window.removeEventListener('keydown',       onKeyDown,     true);
            if (!dragging) return;
            stopVisuals();
            swallowNextClick();
            if (!commit || cancelled) return;
            lastY = e.clientY;
            const ins = insertionIndex();
            const to  = ins > from ? ins - 1 : ins;
            if (to !== from) onMove(from, to);
        }

        function onPointerUp(e) { finish(e, true); }
        function onCancel(e)    { finish(e, false); }

        function onKeyDown(e) {
            if (e.key !== 'Escape' || !dragging || cancelled) return;
            e.preventDefault();
            e.stopPropagation();
            cancelled = true;   // the release still ends the drag, without a move
            stopVisuals();
        }

        window.addEventListener('pointermove',   onPointerMove, true);
        window.addEventListener('pointerup',     onPointerUp,   true);
        window.addEventListener('pointercancel', onCancel,      true);
        window.addEventListener('keydown',       onKeyDown,     true);
    }

    return { attach };
}
