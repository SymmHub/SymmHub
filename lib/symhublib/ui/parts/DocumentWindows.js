//
//  DocumentWindows.js: the documents' windows of the UI builders
//  (docs/symrenderer_refactor_plan.md, after phase 6): the samples of the page and
//  the Files window.
//  - The samples window is made here: the page's samples (docs.getSamples()), a
//    thumbnail picked loads its sample (docs.onDocumentSelected).
//  - The Files window is the renderer's documents' own: it keeps their folders (the
//    write folder, the root of the permitted folders) for Save, Save As and the
//    export, shown or not. This part decides when it is shown.
//  At the host's 'ready' the samples window is made (shown or hidden as it was left)
//  and the Files window comes back if it was left open. The renderer's 'Samples...'
//  param asks for the samples window (the host's 'samplesRequested').
//
//  opt.samples   false: the samples window is made only when asked for (SimpleUI)
//
//  returns { showSamples(), showFiles(), samplesWindow(), filesWindow() }: the two
//  windows as the windows menu shows and hides them, made when first shown
//  (samplesWindow() is null for a page without samples)
//
import {
    createImageSelector,
} from '../../modules.js';

export function createDocumentWindows(host, opt = {}) {

    const docs = () => host.getDocManager();
    const samples = () => docs().getSamples() || [];
    let selector = null;

    // the samples window; an empty one takes documents dropped on it
    function samplesSelector() {
        if (!selector) {
            selector = createImageSelector({
                width:     '600px',
                height:    '184px',
                left:      '1px',
                top:       '500px',
                title:     'samples',
                onSelect:  (item) => docs().onDocumentSelected(item),
                storageId: 'samples',
            });
            if (samples().length) selector.addItems(samples());
        }
        return selector;
    }

    function showSamples() {
        samplesSelector().setVisible(true);
    }

    function showFiles() {
        docs().onShowDocuments();
    }

    const samplesWindow = {
        get wnd() { return selector ? selector.getWindow().wnd : null; },
        isVisible:  () => !!selector && selector.isVisible(),
        setVisible: (v) => { if (v) showSamples(); else if (selector) selector.setVisible(false); },
    };

    host.addEventListener('samplesRequested', showSamples);
    host.addEventListener('ready', () => {
        if (opt.samples !== false && samples().length) samplesSelector();
        if (docs().filesWindow.wasLeftOpen()) showFiles();
    });

    return {
        showSamples,
        showFiles,
        ensureSamplesWindow: () => (samples().length ? samplesSelector().getWindow() : null),
        samplesWindow: () => ((selector || samples().length) ? samplesWindow : null),
        filesWindow:   () => docs().filesWindow,
    };
}
