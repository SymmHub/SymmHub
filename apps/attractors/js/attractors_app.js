//
//  attractors_app.js: shared StudioUI startup helper for all SymChaos variants.
//

import {
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    ImageLayerFactory,
    ImageLayerUpgradeMapping,
    SymRenderer,
    StudioUI,
    ClassicUI,
    SimpleUI,
    pickUI,
    makeSamplesArray,
    getHashParams,
    IteratedAttractorCreator,
    GroupMakerFactory,
    createAttractorPanel,
} from './modules.js';

export function runAttractorApp({ presets, presetsFolder, groupName = null }) {
    const visManager = VisualizationManager({
        layerFactory:   ImageLayerFactory,
        upgradeMapping: ImageLayerUpgradeMapping,
        visLayers: [
            { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
            { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
        ],
    });

    const samples = makeSamplesArray(presets, presetsFolder);
    const hash = getHashParams() || {};
    const defaultPreset = (!hash.preset && !hash.params && samples.length) ? samples[0].data.jsonUrl : undefined;

    const app = SymRenderer({
        ui: pickUI({ studio: StudioUI, classic: ClassicUI, simple: SimpleUI }, 'studio'),
        uiOptions: {
            tools:               ['move', 'patternTransform', 'symmetry'],
            startTool:           'move',
            visualizationWindow: true,
            symmetryWindow:      true,
            transformsWindow:    true,
            patternPanel:        createAttractorPanel,
            leaveOut:            ['pattern'],
            defaultTab:          'attractor',
        },
        patternCreator:    IteratedAttractorCreator,
        visualization:     visManager,
        groupMakerFactory: groupName ? GroupMakerFactory({ defaultName: groupName }) : GroupMakerFactory(),
        navigator:         new InversiveNavigator(),
        samples,
        ...(defaultPreset ? { preset: defaultPreset } : {}),
    });

    app.run();
    return app;
}
