//
//  SymPixPatternPanel.js: dedicated Pattern inspector tab for SymPix in StudioUI.
//  Surfaces the pattern's Texture picker, Browse button, color adjustments (OKLCH,
//  Negative, Hue/Sat/Lightness/Contrast), and attaches an OS drag-and-drop image
//  overlay directly over the canvas stage ("Drop an image to tile it").
//

import {
    DatGUI,
    createInternalWindow,
    createParamUI,
} from './modules.js';

function hasFiles(dt) {
    if (!dt || !dt.types) return false;
    return Array.from(dt.types).includes('Files');
}

function openFoldersByNames(root, names) {
    if (!root || !root.__folders) return;
    for (const [key, folder] of Object.entries(root.__folders)) {
        if (names.includes(key.toLowerCase()) || names.includes(key)) {
            folder.open();
        }
        openFoldersByNames(folder, names);
    }
}

export function createSymPixPatternPanel(host) {
    let gui = null;
    const win = createInternalWindow({
        title:     'pattern',
        width:     '320px',
        height:    '520px',
        left:      'calc(100% - 340px)',
        top:       '80px',
        canClose:  true,
        canResize: true,
        storageId: host.storageKey('pattern_window'),
        onResize:  () => {
            if (gui && win.interior) gui.width = Math.max(160, win.interior.clientWidth || 300);
        },
    });

    const interior = win.interior;
    interior.classList.add('gui-window-interior');

    const pattern = host.getPattern();

    // ── Quick action bar (Browse textures + drop hint) ───────────────────────
    const bar = document.createElement('div');
    bar.className = 'studio-panel-bar';

    if (pattern && pattern.browseTexture) {
        const browseBtn = document.createElement('button');
        browseBtn.type = 'button';
        browseBtn.className = 'studio-panel-btn studio-panel-btn--primary';
        browseBtn.textContent = 'Browse Textures\u2026';
        browseBtn.title = 'Open the built-in texture library browser';
        browseBtn.addEventListener('pointerdown', (e) => e.preventDefault());
        browseBtn.addEventListener('click', () => pattern.browseTexture());
        bar.appendChild(browseBtn);
    }

    const hint = document.createElement('div');
    hint.className = 'studio-panel-hint';
    hint.textContent = 'Tip: Drop any image file onto the canvas to tile it immediately.';
    bar.appendChild(hint);
    interior.appendChild(bar);

    // ── Embedded DatGUI hosting host.getParams().pattern (single-control owner) ─
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
    openFoldersByNames(gui, ['pattern params', 'texture', 'adjust', 'images']);
    gui.width = Math.max(160, interior.clientWidth || 300);

    // ── Canvas OS Drag-and-Drop Image Overlay ────────────────────────────────
    const stage = host.canvas?.container?.parentElement || host.canvas?.container;
    if (stage && pattern && pattern.loadImageBytes) {
        const dropOverlay = document.createElement('div');
        dropOverlay.className = 'studio-drop-overlay';
        dropOverlay.textContent = 'Drop an image to tile it';
        stage.appendChild(dropOverlay);

        let dragDepth = 0;
        const hideOverlay = () => {
            dragDepth = 0;
            dropOverlay.classList.remove('studio-drop-overlay--active');
        };

        stage.addEventListener('dragenter', (e) => {
            if (!hasFiles(e.dataTransfer)) return;
            dragDepth++;
            dropOverlay.classList.add('studio-drop-overlay--active');
            e.preventDefault();
        });
        stage.addEventListener('dragover', (e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        stage.addEventListener('dragleave', (e) => {
            if (!hasFiles(e.dataTransfer)) return;
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) hideOverlay();
        });
        stage.addEventListener('drop', async (e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.stopPropagation();
            hideOverlay();
            const files = Array.from(e.dataTransfer.files || []);
            const imgFile = files.find(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name));
            if (!imgFile) return;
            try {
                const buf = await imgFile.arrayBuffer();
                pattern.loadImageBytes(new Uint8Array(buf), imgFile.name);
                host.scheduleRepaint();
            } catch (err) {
                console.error('SymPix drop image failed:', err);
            }
        });
    }

    return {
        id:     'pattern',
        label:  'Pattern',
        title:  'Pattern texture, transform, and color adjustments',
        window: win,
    };
}
