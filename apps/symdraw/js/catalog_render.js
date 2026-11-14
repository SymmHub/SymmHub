/*
  catalog_render.js - boot for the catalog batch renderer, symdraw flavour.

  The symdraw wallpaper page (a PatternDrawing on the 'drawing' layer) plus
  the same catalog driver sympix's catalog_render.html loads, so a job can use
  a hand-drawn symdraw document as its motif.  The driver exposes
  window.catalog and runs a job when the page URL carries ?job=<url>.
*/
import { startSymdraw } from './symdraw_app.js';
import { presets } from './presets_wp.js';

startSymdraw({
    groupType:     'Wallpaper',
    presetsFolder: 'presets/wp/',
    presets,
    scriptUrl:     '/apps/sympix/scripts/catalog_driver.js',
});
