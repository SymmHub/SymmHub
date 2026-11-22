
import { 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    ImageLayerFactory,
    ImageLayerUpgradeMapping,
    SymRenderer,
    ClassicUI,
    makeSamplesArray,
    getHashParams,
    IteratedAttractorCreator,
    GroupMakerFactory,
} from "./modules.js";

import {
    presets
} from './presets_spherical.js';
 
const visManager = VisualizationManager({
    layerFactory:   ImageLayerFactory,
    upgradeMapping: ImageLayerUpgradeMapping,
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const samples = makeSamplesArray(presets, 'presets/spherical/');
const hash = getHashParams() || {};
const defaultPreset = (!hash.preset && !hash.params && samples.length) ? samples[0].data.jsonUrl : undefined;

const app = SymRenderer({
      ui:             ClassicUI,
      patternCreator: IteratedAttractorCreator,
      visualization: visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName: 'Spherical'}), 
      navigator:  new InversiveNavigator(),
      samples,
      ...(defaultPreset ? { preset: defaultPreset } : {}),
});

app.run();

