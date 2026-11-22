
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
} from './presets_frieze.js';
 
const visManager = VisualizationManager({
    layerFactory:   ImageLayerFactory,
    upgradeMapping: ImageLayerUpgradeMapping,
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const samples = makeSamplesArray(presets, 'presets/frieze/');
const hash = getHashParams() || {};
const defaultPreset = (!hash.preset && !hash.params && samples.length) ? samples[0].data.jsonUrl : undefined;

const app = SymRenderer({
      ui:             ClassicUI,
      patternCreator: IteratedAttractorCreator,
      visualization: visManager, 
      //groupMaker: new Group_Frieze({type: '*22∞',a: 0.4}), // maker of the groups
      groupMakerFactory: GroupMakerFactory({defaultName: 'Frieze'}), 
      navigator:  new InversiveNavigator(),
      samples,
      ...(defaultPreset ? { preset: defaultPreset } : {}),
});

app.run();

