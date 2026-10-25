import {
    SymRenderer,
    VisualizationManager,
    VisualizationColorSym,
    VisualizationImage,
    VisualizationOverlay,
    InversiveNavigator,
    makeSamplesArray,
    getHashParams,
    GroupMakerFactory,
    PatternDrawingCreator,
    SymdrawLayerFactory,
} from './modules.js';

//
//  start of a symdraw page: a PatternDrawing shown by Color Images (its
//  crown, no permutations) on a group family
//
//  opt.groupType      default group maker, e.g. 'Wallpaper', 'KLM'
//  opt.presetsFolder  folder of the page's presets
//

// a page opened without a document in its hash starts with the symmetry on
const START_PARAMS = {
    symmetry: { options: { useSymm: true } },
};

function startSymdraw(opt = {}) {

    const visManager = VisualizationManager({
        layerFactory: SymdrawLayerFactory,
        upgradeMapping: [
            { key: 'drawing', cls: 'VisualizationColorSym' },
            { key: 'image',   cls: 'VisualizationImage'    },
            { key: 'overlay', cls: 'VisualizationOverlay'  },
        ],
        visLayers: [
            { name: 'drawing', visLayer: VisualizationColorSym({ config: { enabled: true,  useCrown: true } }) },
            { name: 'image',   visLayer: VisualizationImage(   { config: { enabled: false } }) },
            { name: 'overlay', visLayer: VisualizationOverlay( { config: { enabled: false } }) },
        ],
    });

    const hash = getHashParams() || {};
    const app = SymRenderer({
        patternCreator:    PatternDrawingCreator,
        visualization:     visManager,
        groupMakerFactory: GroupMakerFactory({ defaultName: opt.groupType || 'Wallpaper' }),
        navigator:         new InversiveNavigator(),
        samples:           makeSamplesArray('', opt.presetsFolder || ''),
        docFolderId:       'symdraw_doc_folder',
        params:            (hash.preset || hash.params) ? undefined : START_PARAMS,
    });

    app.run();
    return app;
}

export { startSymdraw };
