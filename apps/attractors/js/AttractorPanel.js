//
//  AttractorPanel.js: dedicated Attractor inspector tab for SymChaos in StudioUI.
//  Provides a prominent Randomize button, Restart button, live convergence
//  progress bar (batchCount / maxBatchCount), and open attractor/coloring params.
//

import {
    DatGUI,
    createInternalWindow,
    createParamUI,
} from './modules.js';

function openFoldersByNames(root, names) {
    if (!root || !root.__folders) return;
    for (const [key, folder] of Object.entries(root.__folders)) {
        const lower = key.toLowerCase();
        if (names.some(n => lower.includes(n))) folder.open();
        openFoldersByNames(folder, names);
    }
}

export function createAttractorPanel(host) {
    let gui = null;
    const win = createInternalWindow({
        title:     'attractor',
        width:     '320px',
        height:    '540px',
        left:      'calc(100% - 340px)',
        top:       '80px',
        canClose:  true,
        canResize: true,
        storageId: host.storageKey('attractor_window'),
        onResize:  () => {
            if (gui && win.interior) gui.width = Math.max(160, win.interior.clientWidth || 300);
        },
    });

    const interior = win.interior;
    interior.classList.add('gui-window-interior');

    const pattern = host.getPattern();

    // ── Hero action bar + live convergence progress ──────────────────────────
    const bar = document.createElement('div');
    bar.className = 'studio-panel-bar';

    const rndBtn = document.createElement('button');
    rndBtn.type = 'button';
    rndBtn.className = 'studio-panel-btn studio-panel-btn--primary';
    rndBtn.textContent = 'Randomize';
    rndBtn.title = 'Generate random parameters for the active chaotic attractor';
    rndBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    rndBtn.addEventListener('click', () => {
        if (pattern && pattern.randomize) pattern.randomize();
        host.scheduleRepaint();
    });

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'studio-panel-btn';
    restartBtn.textContent = 'Restart';
    restartBtn.title = 'Clear histogram and re-accumulate points from scratch';
    restartBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    restartBtn.addEventListener('click', () => {
        if (pattern && pattern.restart) pattern.restart();
        host.scheduleRepaint();
    });

    const progress = document.createElement('div');
    progress.className = 'studio-progress';
    const progressRow = document.createElement('div');
    progressRow.className = 'studio-progress__row';
    const progressLabel = document.createElement('span');
    progressLabel.textContent = 'Convergence';
    const progressVal = document.createElement('span');
    progressVal.textContent = '0 / 100';
    progressRow.append(progressLabel, progressVal);
    const track = document.createElement('div');
    track.className = 'studio-progress__track';
    const fill = document.createElement('div');
    fill.className = 'studio-progress__fill';
    track.appendChild(fill);
    progress.append(progressRow, track);

    bar.append(rndBtn, restartBtn, progress);
    interior.appendChild(bar);

    function updateProgress() {
        if (!pattern || !pattern.getProgress) return;
        const { batchCount, maxBatchCount } = pattern.getProgress();
        const max = Math.max(1, maxBatchCount || 1);
        const cur = Math.min(batchCount || 0, max);
        const pct = Math.round((cur / max) * 100);
        progressVal.textContent = `${cur} / ${max} (${pct}%)`;
        fill.style.width = pct + '%';
    }

    host.addEventListener('frameRendered', updateProgress);

    // ── Embedded DatGUI hosting host.getParams().pattern ─────────────────────
    gui = new DatGUI({ autoPlace: false, width: 300 });
    gui.domElement.classList.add('gui-window-panel');
    interior.appendChild(gui.domElement);

    const patParam = host.getParams().pattern;
    if (patParam && patParam.patternParams) {
        const top = { patternParams: patParam.patternParams };
        if (patParam.patternTransform) top.patternTransform = patParam.patternTransform;
        createParamUI(gui, top);
    } else if (patParam && patParam.createUI) {
        patParam.createUI(gui);
    }

    openFoldersByNames(gui, ['pattern params', 'attractor params', 'coloring']);
    gui.width = Math.max(160, interior.clientWidth || 300);
    updateProgress();

    return {
        id:     'attractor',
        label:  'Attractor',
        title:  'Chaotic attractor parameters, randomization, convergence, and tone mapping',
        window: win,
    };
}
