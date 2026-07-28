import { createColormapEditor } from '../../../lib/uilib/modules.js';
import { Colormaps } from '../../../lib/symhublib/modules.js';

window.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btnOpen');
    const output = document.getElementById('output');

    const sampleColormap = Colormaps.getColormap('band12') || {
        name: 'band12',
        tex: null,
        data: [
            [0, 0, 0, 0], [0.5, 0.5, 0.8, 0], [0, 0.9, 0.1, 1],
            [0.5, 0, 0, 0], [0, 0.9, 0.1, 1], [0.2, 0.0, 0.9, 1],
            [1.0, 0, 0, 0], [0, 0.0, 0.9, 1], [0.0, 0.0, 0.5, 0]
        ]
    };

    let editor = null;

    function openEditor() {
        if (!editor) {
            editor = createColormapEditor({
                colormap: sampleColormap,
                left: '80px',
                top: '60px',
                width: '560px',
                height: '520px',
                onChange: (cm) => {
                    output.textContent = `Colormap: ${cm.name}\nControl Points Count: ${cm.data.length / 3}\nData Entries:\n` +
                        JSON.stringify(cm.data, null, 2);
                }
            });
        }
        editor.setVisible(true);
    }

    btnOpen.onclick = () => openEditor();

    // Auto-open on load
    openEditor();
});
