//
//  ToolWindows.js: the panels a page may ask to have in windows of their own, out of
//  the settings panel: the visualization layers (a visualization that tells its
//  changes), the symmetry (the Symmetry tool's panel; it opens when the tool is taken
//  up, unless the user closed it) and the navigator's conformal transformations
//  (closed until asked for: the windows menu, the Orientation tool's bar). A part of
//  the UI builders (docs/symrenderer_refactor_plan.md phase 4)
//
//  opt.visualization, opt.symmetry, opt.transforms   which windows to make
//
//  Their edits are steps of the pattern's undo when it has one (symdraw's drawing).
//  The selected transformation's handles on the canvas are the renderer's: it is told
//  which row they are of (host.setTransformHandlesRow)
//
import {
    createVisualizationLayersWindow,
    createSymmetryWindow,
    createTransformsWindow,
} from '../../modules.js';

export function createToolWindows(host, opt = {}) {

    const pattern = host.getPattern();
    const pushUndo = pattern && pattern.pushUndo ? (entry) => pattern.pushUndo(entry) : null;
    let vis = null;
    let sym = null;
    let transforms = null;

    // left of symdraw's layers and style windows
    if (opt.visualization && host.getVisualization().addListener) {
        vis = createVisualizationLayersWindow({
            manager:   host.getVisualization(),
            storageId: 'vis_layers',
            left:      'calc(100% - 600px)',
            top:       '120px',
            pushUndo,
        });
    }
    // left of the canvas, by the palette
    if (opt.symmetry) {
        sym = createSymmetryWindow({
            params:      host.getSymmetryParams(),
            storageId:   'symmetry_window',
            left:        '52px',
            top:         '120px',
            openFolders: ['group params'],
        });
    }
    // left of the visualization window, for a navigator that has the list
    const nav = host.getNavigator();
    if (opt.transforms && nav.getProjection && nav.getProjection() && nav.getProjection().getMaps) {
        transforms = createTransformsWindow({
            list:      nav.getProjection(),
            storageId: 'transforms_window',
            left:      'calc(100% - 900px)',
            top:       '120px',
            pushUndo,
            // the row whose handles are on the canvas changed, or the window was opened or closed
            onChange:  () => host.scheduleRepaint(),
        });
        host.setTransformHandlesRow(() => transforms.getHandlesRow());
    }

    return {
        // the windows menu's entries
        entries: () => [
            { label: 'Visualization', title: 'the visualization layers and their settings', window: vis?.window },
            { label: 'Symmetry', title: 'the symmetry: the group, its transform, the Dirichlet domain', window: sym?.window },
            { label: 'Transformations', title: 'the conformal transformations the picture is seen through: the list and their settings',
              window: transforms?.window },
        ],
        hasTransforms: () => !!transforms,
        showTransforms: () => {
            if (!transforms) return;
            const win = transforms.window;
            if (win.isVisible()) win.raise();
            else win.setVisible(true);
        },
        // the Symmetry tool was taken up
        openSymmetry: () => { if (sym) sym.openForTool(); },
    };
}
