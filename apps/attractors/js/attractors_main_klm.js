
import { 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    ImageLayerFactory,
    ImageLayerUpgradeMapping,
    SymRenderer,
    makeSamplesArray,
    IteratedAttractorCreator,
    GroupMakerFactory,
} from "./modules.js";

import {
    presets
} from './presets_klm.js';
 
const visManager = VisualizationManager({
    layerFactory:   ImageLayerFactory,
    upgradeMapping: ImageLayerUpgradeMapping,
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
      patternCreator: IteratedAttractorCreator,
      visualization: visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName: 'KLM'}),       
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/klm/'),
});

app.run();

