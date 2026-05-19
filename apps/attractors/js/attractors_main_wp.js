
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
} from './presets_wp.js';
 
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
      groupMakerFactory: GroupMakerFactory({defaultName: 'Wallpaper'}), 
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/wp/'),
});

app.run();

