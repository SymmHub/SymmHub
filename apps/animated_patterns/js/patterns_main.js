
import { 
    Group_WP, 
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    ImageLayerFactory,
    ImageLayerUpgradeMapping,
    SymRenderer,
    ClassicUI,
    StudioUI,
    SimpleUI,
    pickUI,
    makeSamplesArray,
    PatternsCreator,
} from "./modules.js";

import {
    presets
} from './presets.js';
 
const visManager = VisualizationManager({
    layerFactory:   ImageLayerFactory,
    upgradeMapping: ImageLayerUpgradeMapping,
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
      ui:             pickUI({ studio: StudioUI, classic: ClassicUI, simple: SimpleUI }, 'studio'),
      uiOptions: {
          tools:               ['move', 'patternTransform', 'symmetry'],
          startTool:           'move',
          visualizationWindow: true,
          symmetryWindow:      true,
          transformsWindow:    true,
      },
      patternCreator: PatternsCreator,
      visualization: visManager, 
      groupMaker: new Group_WP({type: '2222',a: 0.4}), // maker of the groups
      navigator:  new InversiveNavigator(),
      samples:    makeSamplesArray(presets, 'presets/'),
});

app.run();

