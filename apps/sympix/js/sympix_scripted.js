
import { 
    GroupMakerFactory,
    InversiveNavigator,
    VisualizationManager,
    VisualizationOverlay,
    VisualizationColorSym,
    SympixColorLayerFactory,
    VisualizationColorTiles,
    VisualizationImage,
    SymRenderer,
    makeSamplesArray,
    PatternImageArrayCreator,
} from "./modules.js";

import {
    presets
} from './presets_scripted.js';

import { scripts } from './scripts.js';

/**
 * Convert the template-string scripts index (one filename per line)
 * into the [{name, url}] array expected by SymRenderer's scriptUrls option.
 * @param {string} str  — exported template string from scripts.js
 * @param {string} baseUrl — URL prefix for each script file
 */
function makeScriptsArray(str, baseUrl = './scripts/') {
    return str.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(filename => ({
            name: filename.replace(/\.m?js$/i, ''),
            url:  baseUrl + filename,
        }));
}


const visManager = VisualizationManager({
    layerFactory: SympixColorLayerFactory,
    upgradeMapping: [
        { key: 'imageColorSym', cls: 'VisualizationColorSym'   },
        { key: 'colorTiles',    cls: 'VisualizationColorTiles' },
        { key: 'image',         cls: 'VisualizationImage'      },
        { key: 'overlay',       cls: 'VisualizationOverlay'    },
    ],
    visLayers: [
        { name: 'colorTiles',    visLayer: VisualizationColorTiles({ config: { enabled: true  } }) },
        { name: 'imageColorSym', visLayer: VisualizationColorSym({ config: { enabled: true  } }) },
        { name: 'overlay',       visLayer: VisualizationOverlay( { config: { enabled: false } }) },
    ],
});

const app = SymRenderer({
    patternCreator:    PatternImageArrayCreator,
    visualization:    visManager, 
    groupMakerFactory: GroupMakerFactory({defaultName:'Wallpaper'}),
    navigator:        new InversiveNavigator(),
    samples:          makeSamplesArray(presets, 'presets/scripted/'),
    // List of available animation scripts for the 'scripting' UI folder:
    scriptUrls:       makeScriptsArray(scripts),
});

app.run();

// The scripting API is also available directly for console/devtools scripting:
window.__symRenderer = app;
window.__api = app.getScriptAPI();
console.log('SymRenderer scripting API available as window.__api');
