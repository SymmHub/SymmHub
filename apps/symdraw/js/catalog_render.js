/*
  catalog_render.js - boot for the catalog batch renderer, symdraw flavour.

  The symdraw wallpaper page (a PatternDrawing on the 'drawing' layer) plus
  the colorsym catalog's driver, so a job can use a hand-drawn symdraw
  document as its motif.  The driver lives in the catalog repo
  (tools/render/catalog_driver.js) and is served by the catalog's dev server,
  which serves SymmHub at / and the catalog at /catalog/; ?script=<url> loads
  another one.  The driver exposes window.catalog and runs a job when the page
  URL carries ?job=<url>.
*/
import { startSymdraw } from './symdraw_app.js';
import { presets } from './presets_wp.js';

const DRIVER = new URLSearchParams(location.search).get('script')
               || '/catalog/tools/render/catalog_driver.js';

startSymdraw({
    groupType:     'Wallpaper',
    presetsFolder: 'presets/wp/',
    presets,
    scriptUrl:     DRIVER,
});
