
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
} from './presets_frieze.js';
 
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
      //groupMaker: new Group_Frieze({type: '*22∞',a: 0.4}), // maker of the groups
      groupMakerFactory: GroupMakerFactory({defaultName: 'Frieze'}), 
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/frieze/'),
});

app.run();

