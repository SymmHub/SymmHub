
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationImage,
    VisualizationOverlay,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_orbifold.js';
import { SympixLayerFactory } from './SympixLayerFactory.js';
import { buildOrbifoldMenu } from './OrbifoldMenu.js';


const visManager = VisualizationManager({
    layerFactory: SympixLayerFactory,
    upgradeMapping: [
        { key: 'image',   cls: 'VisualizationImage'   },
        { key: 'overlay', cls: 'VisualizationOverlay'  },
    ],
    visLayers: [
        { name: 'image',   visLayer: VisualizationImage(  { config: { enabled: true  } }) },
        { name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
      patternCreator:    PatternImageArrayCreator,
      visualization:     visManager, 
      groupMakerFactory: GroupMakerFactory({defaultName:'Orbifold'}),
      navigator:         new InversiveNavigator(),
      samples:           makeSamplesArray(presets, 'presets/orbifold/'),
      // preset the app opens with, so it starts on a real pattern rather
      // than the bare PatternImageArray defaults
      preset:            'presets/orbifold/basic_default.json',
      // forked settings-panel layout, orbifold-only — see OrbifoldMenu.js
      menuBuilder:       buildOrbifoldMenu,
      // Place each image by a motion of the plane the group lives in, rather
      // than by a Euclidean similarity: an image is the image of a rectangle
      // under that motion, it drags natively in the geometry, and releasing it
      // snaps it into the fundamental domain. See ImagePlacement.js.
      geometricImages:   true,
});

app.run();

// debugging convenience
if (typeof window !== 'undefined') window.app = app;

