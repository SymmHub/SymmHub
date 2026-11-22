//
//  SimControlPanel.js: dedicated Simulation inspector tab for Ginzburg-Landau in StudioUI.
//  Provides one-click access to the α-β Phase Diagram, Colormap Editor, Initialize,
//  and Single Step above the simulation pipeline parameters.
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

function findPresetsPlot(pattern) {
    if (!pattern || !pattern.getWorkers) return null;
    for (const w of pattern.getWorkers()) {
        if (w && w.getPresetsPlot) return w.getPresetsPlot();
    }
    return null;
}

function findColormapLayer(host) {
    const vis = host.getVisualization ? host.getVisualization() : null;
    const layers = vis && vis.getLayers ? vis.getLayers() : [];
    return layers.find(l => l && l.openColormapEditor) || null;
}

export function createSimControlPanel(host) {
    let gui = null;
    const win = createInternalWindow({
        title:     'simulation',
        width:     '320px',
        height:    '520px',
        left:      'calc(100% - 340px)',
        top:       '80px',
        canClose:  true,
        canResize: true,
        storageId: host.storageKey('simulation_window'),
        onResize:  () => {
            if (gui && win.interior) gui.width = Math.max(160, win.interior.clientWidth || 300);
        },
    });

    const interior = win.interior;
    interior.classList.add('gui-window-interior');

    const pattern = host.getPattern();

    // ── Quick action buttons ─────────────────────────────────────────────────
    const bar = document.createElement('div');
    bar.className = 'studio-panel-bar';

    const makeBtn = (label, title, primary, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'studio-panel-btn' + (primary ? ' studio-panel-btn--primary' : '');
        btn.textContent = label;
        btn.title = title;
        btn.addEventListener('pointerdown', (e) => e.preventDefault());
        btn.addEventListener('click', onClick);
        return btn;
    };

    bar.appendChild(makeBtn(
        '\u03B1\u2013\u03B2 Diagram',
        'Open or hide the Ginzburg-Landau interactive alpha/beta phase-space map (Ctrl+click to pick)',
        true,
        () => {
            const plot = findPresetsPlot(pattern);
            if (plot) plot.setVisible(!plot.isVisible());
        }
    ));

    bar.appendChild(makeBtn(
        'Colormap\u2026',
        'Open the visual Colormap Editor for the active simulation layer',
        false,
        () => {
            const cm = findColormapLayer(host);
            if (cm) cm.openColormapEditor();
        }
    ));

    bar.appendChild(makeBtn(
        'Init',
        'Reset and initialize the simulation buffer',
        false,
        () => host.initSimulation()
    ));

    if (pattern && pattern.singleStep) {
        bar.appendChild(makeBtn(
            'Step',
            'Advance the PDE simulation by one single pass',
            false,
            () => { pattern.singleStep(); host.scheduleRepaint(); }
        ));
    }

    interior.appendChild(bar);

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

    openFoldersByNames(gui, ['pattern params', 'pipeline', 'workers', 'gl simulation']);
    gui.width = Math.max(160, interior.clientWidth || 300);

    return {
        id:     'simulation',
        label:  'Simulation',
        title:  'Ginzburg-Landau PDE parameters, phase diagram, and colormap tools',
        window: win,
    };
}
