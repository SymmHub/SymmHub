//
//  sympix_app.js: shared StudioUI configuration for all SymPix pages.
//  Defaults to StudioUI while keeping ?ui=classic and ?ui=simple available.
//

import {
    StudioUI,
    ClassicUI,
    SimpleUI,
    pickUI,
    createSymPixPatternPanel,
} from './modules.js';

export function sympixUI() {
    return pickUI({ studio: StudioUI, classic: ClassicUI, simple: SimpleUI }, 'studio');
}

export function sympixUIOptions(extra = {}) {
    return {
        tools:               ['move', 'patternTransform', 'symmetry', 'draw', 'pick'],
        startTool:           'move',
        visualizationWindow: true,
        symmetryWindow:      true,
        transformsWindow:    true,
        patternPanel:        createSymPixPatternPanel,
        leaveOut:            ['pattern'],
        defaultTab:          'pattern',
        ...extra,
    };
}
