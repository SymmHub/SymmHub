import {
    SymRenderer,
    WorkspaceUI,
    StudioUI,
    SimpleUI,
    pickUI,
    VisualizationManager,
    VisualizationColorSym,
    VisualizationColorTiles,
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
//  opt.presets        their file names, one per line (a presets_*.js list)
//  opt.colorTiles     a Color Tiles layer under the drawing, as in sympix_color
//  opt.scriptUrl      a script to load at startup (SymRenderer options.scriptUrl)
//

// a page opened without a document in its hash folds with enough steps to fill
// a hyperbolic disk to its rim (the layers are symmetric by default)
const START_PARAMS = {
    symmetry: { options: { iterations: 40 } },
};

function startSymdraw(opt = {}) {

    const visManager = VisualizationManager({
        layerFactory: SymdrawLayerFactory,
        upgradeMapping: [
            { key: 'colorTiles', cls: 'VisualizationColorTiles' },
            { key: 'drawing',    cls: 'VisualizationColorSym'   },
            { key: 'image',      cls: 'VisualizationImage'      },
            { key: 'overlay',    cls: 'VisualizationOverlay'    },
        ],
        visLayers: [
            ...(opt.colorTiles
                ? [{ name: 'colorTiles', visLayer: VisualizationColorTiles({ config: { enabled: true } }) }]
                : []),
            { name: 'drawing', visLayer: VisualizationColorSym({ config: { enabled: true,  useCrown: true } }) },
            { name: 'image',   visLayer: VisualizationImage(   { config: { enabled: false } }) },
            { name: 'overlay', visLayer: VisualizationOverlay( { config: { enabled: false } }) },
        ],
    });

    const BareUI = {
        create: (host, uiOptions = {}) => SimpleUI.create(host, { ...uiOptions, toolbar: false }),
    };

    const hash = getHashParams() || {};
    const boot = () => {
        const app = SymRenderer({
            patternCreator:    PatternDrawingCreator,
            visualization:     visManager,
            groupMakerFactory: GroupMakerFactory({ defaultName: opt.groupType || 'Wallpaper' }),
            navigator:         new InversiveNavigator(),
            samples:           makeSamplesArray(opt.presets || '', opt.presetsFolder || ''),
            docFolderId:       'symdraw_doc_folder',
            params:            (hash.preset || hash.params) ? undefined : START_PARAMS,
            // docked studio workspace by default; ?ui=classic, ?ui=simple, and ?ui=bare remain available
            ui:                pickUI({ studio: StudioUI, classic: WorkspaceUI, simple: SimpleUI, bare: BareUI }, 'studio'),
            uiOptions: {
                // of the renderer's own tools the orientation, the pattern box and the symmetry
                tools:               ['move', 'patternTransform', 'symmetry'],
                // start in Move (Orientation) mode on both desktop and mobile
                startTool:           'move',
                // the visualization layers in a window of their own, not in the settings
                visualizationWindow: true,
                // the symmetry too, the Symmetry tool's panel
                symmetryWindow:      true,
                // and the conformal transformations: a list with the selected one's settings
                transformsWindow:    true,
                // StudioUI right-dock defaults: Layers on top, Style in the lower split pane
                defaultTab:          'layers',
                defaultSplitTab:     'style',
                // SymDraw has no animation; omit the red video-recording button from toolbars
                recording:           false,
                // ?ui=simple (catalog Live preview & Explore): bare-minimum viewer toolbar
                simpleMinimal:       true,
            },
            // a script loaded at startup, e.g. the catalog batch driver
            ...(opt.scriptUrl ? { scriptUrl: opt.scriptUrl } : {}),
        });
        app.run();
        return app;
    };

    // Let the browser commit #sym-boot-loader to the compositor before synchronous WebGL
    // initialization & shader compilation so slow laptops see the 1s-delayed loader smoothly.
    if (typeof requestAnimationFrame === 'function'
        && typeof document !== 'undefined'
        && document.getElementById('sym-boot-loader')) {
        let started = false;
        const go = () => { if (!started) { started = true; boot(); } };
        requestAnimationFrame(() => setTimeout(go, 0));
        setTimeout(go, 80);
        return null;
    }
    return boot();
}

export { startSymdraw };
