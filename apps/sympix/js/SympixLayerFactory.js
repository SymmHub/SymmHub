import {
    VisualizationImage,
    VisualizationColorSym,
    VisualizationColorTiles,
    VisualizationOverlay,
    OverlayIsolines,
    OverlayWorldGrid,
    OverlayScreenGrid,
    ObjectFactory,
} from './modules.js';

//
// SympixLayerFactory
//
// The layer factory of the sympix apps: every page can add the plain Image
// layer, the colour symmetry layers Color Images and Color Tiles (2026-11-04,
// before only the colour pages had them), the Overlay and the overlay items
// as layers of their own.
// Signature: (getGLCtx, getOnChange, getChildren, getInitPar) => ObjectFactory
//
// Pass as options.layerFactory to VisualizationManager. SympixColorLayerFactory
// is the same factory with Color Images as the default kind, for the colour
// pages (sympix_color, sympix_scripted, catalog_render).
// The companion upgradeMapping for VisualizationManager.options.upgradeMapping is:
//   [
//       { key: 'imageColorSym', cls: 'VisualizationColorSym'   },
//       { key: 'colorTiles',    cls: 'VisualizationColorTiles' },
//       { key: 'image',         cls: 'VisualizationImage'      },
//       { key: 'overlay',       cls: 'VisualizationOverlay'    },
//   ]
//
function makeSympixLayerFactory(defaultName) {
    return function SympixLayerFactory(getGLCtx, getOnChange, getChildren, getInitPar) {
        function makeUniqueName(baseName) {
            const existing = getChildren().map(l => l.getId()).filter(Boolean);
            if (!existing.includes(baseName)) return baseName;
            let n = 2;
            while (existing.includes(baseName + n)) n++;
            return baseName + n;
        }
        function make(ctor, baseName, enabled = false) {
            return () => {
                const id    = makeUniqueName(baseName);
                const layer = ctor({ config: { enabled }, id });
                const ctx   = getGLCtx();
                if (ctx) layer.init({ ...(getInitPar ? getInitPar() : {}), glCtx: ctx, onChange: getOnChange() });
                return layer;
            };
        }
        return ObjectFactory({
            defaultName,
            infoArray: [
                { name: 'VisualizationImage',      label: 'Image',        creator: make(VisualizationImage,      'image'       ) },
                { name: 'VisualizationColorSym',   label: 'Color Images', creator: make(VisualizationColorSym,   'Color Images') },
                { name: 'VisualizationColorTiles', label: 'Color Tiles',  creator: make(VisualizationColorTiles, 'Color Tiles' ) },
                { name: 'VisualizationOverlay',    label: 'Overlay',      creator: make(VisualizationOverlay,    'overlay'     ) },
                // general overlay items, usable as layers of their own (e.g. isolines between the image and the colour tiles)
                { name: 'OverlayIsolines',   label: 'isolines',    creator: make(OverlayIsolines,   'isolines',   true) },
                { name: 'OverlayWorldGrid',  label: 'world grid',  creator: make(OverlayWorldGrid,  'worldGrid',  true) },
                { name: 'OverlayScreenGrid', label: 'screen grid', creator: make(OverlayScreenGrid, 'screenGrid', true) },
            ],
        });
    };
}

const SympixLayerFactory      = makeSympixLayerFactory('VisualizationImage');
const SympixColorLayerFactory = makeSympixLayerFactory('VisualizationColorSym');

export { SympixLayerFactory, SympixColorLayerFactory };
