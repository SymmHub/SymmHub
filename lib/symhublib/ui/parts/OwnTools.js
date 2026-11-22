//
//  OwnTools.js: the renderer's own tools (lib/symhublib/tools/) given to it, in the
//  order they get the events: Orientation, Draw, Pick, Pattern box, Symmetry. A part
//  of the UI builders (docs/symrenderer_refactor_plan.md phase 4)
//
//  opt.skin                the tools' icons and cursors
//  opt.canShowTransforms   () => bool: the Orientation bar's button for the
//  opt.showTransforms      () => void  transformations' window
//  opt.openSymmetryWindow  () => void: the Symmetry tool was taken up
//
import {
    OrientationTool,
    SymmetryTool,
    PatternBoxTool,
    DrawTool,
    PickTool,
} from '../../modules.js';

export function addOwnTools(host, opt = {}) {
    const skin = opt.skin;
    host.addTool(OrientationTool(host, { skin,
        canShowTransforms: opt.canShowTransforms || (() => false),
        showTransforms:    opt.showTransforms || (() => {}) }));
    host.addTool(DrawTool(host, { skin }));
    host.addTool(PickTool(host, { skin }));
    host.addTool(PatternBoxTool(host, { skin }));
    host.addTool(SymmetryTool(host, { skin,
        openWindow: opt.openSymmetryWindow || (() => {}) }));
}
