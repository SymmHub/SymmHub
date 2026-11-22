//
//  Menus.js: the menus of the UI builders (docs/symrenderer_refactor_plan.md phase 4):
//  the files, the windows and the export menus of the toolbox, and the active tool's
//  menu at a right click on the canvas (the host's 'contextMenu'). A command of a menu
//  shows its result in the tools' UI and on the canvas
//
import {
    showPopupMenu,
    windowMenuItems,
} from '../../modules.js';

// the items' commands followed by the tools' UI and a repaint
function withRefresh(host, items) {
    return items.map(it => (it.action
        ? { ...it, action: () => { it.action(); host.refreshToolUI(); host.scheduleRepaint(); } } : it));
}

// a menu at a button (where.anchor) or at a point of the page (where.x, where.y),
// above the always-on-top windows
export function showCommandMenu(host, where, items) {
    showPopupMenu({ ...where, items: withRefresh(host, items) });
}

// the documents' commands in one menu; documentWindows: DocumentWindows.js
export function fileMenuItems(host, documentWindows) {
    const docs = () => host.getDocManager();
    return [
        { label: 'Samples…', title: 'the samples of the page', action: () => documentWindows.showSamples() },
        { label: 'Files…', title: 'the documents saved in a folder', action: () => documentWindows.showFiles() },
        { separator: true },
        { label: 'Save', title: 'the document, where it was saved', action: () => docs().onSaveDocument() },
        { label: 'Save New…', title: 'a new document, the next free name', action: () => docs().onSaveNewDocument() },
        { label: 'Save As…', title: 'the document under a name you choose', action: () => docs().onSaveDocumentAs() },
    ];
}

// the image export first, then the pattern's exports
export function exportMenuItems(host) {
    return [
        { label: 'Image (PNG)…', title: "the document's frame or the view on screen, at a chosen size: PNG, or JPG, WEBP, TIFF",
          action: () => host.exportImage() },
        { separator: true },
        ...host.getPattern().getExportItems(),
    ];
}

//
//  the windows shown, hidden and brought to the top: the tool windows (entries), then
//  the samples and the files (opt.documents: DocumentWindows.js) unless the files menu
//  opens them (opt.filesMenu), then any other window of the page; opt.omit: windows
//  another button opens (the settings)
//
export function windowsMenuItems(host, entries, opt = {}) {
    const samples = opt.documents.samplesWindow();
    const files = opt.documents.filesWindow();
    return windowMenuItems([
        ...entries,
        { separator: true },
        ...(opt.filesMenu ? [] : [
            { label: 'Samples', title: 'the samples of the page', window: samples },
            { label: 'Files', title: 'the documents saved in a folder', window: files },
        ]),
    ], { omit: [...(opt.omit || []), ...(opt.filesMenu ? [samples, files] : [])] });
}

// the active tool's menu at a right click on the canvas
export function listenContextMenu(host) {
    host.addEventListener('contextMenu', (e) => showCommandMenu(host, { x: e.x, y: e.y }, e.items));
}
