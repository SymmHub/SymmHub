//
//  Panels.js: the panels of a UI builder (docs/symrenderer_refactor_plan.md phase 5):
//  the timing window of every builder, then those the page asks for
//  (uiOptions.panels, e.g. [DataPlotPanel] for a simulation). A panel is
//  { create(host) }, called in the builder's create (it may add params, host.addParams)
//
import {
    TimingPanel,
} from '../../modules.js';

export function addPanels(host, uiOptions = {}) {
    [TimingPanel, ...(uiOptions.panels || [])].forEach(panel => panel.create(host));
}
