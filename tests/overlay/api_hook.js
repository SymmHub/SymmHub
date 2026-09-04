/*
  api_hook.js — exposes the ScriptAPI of a SymRenderer page for browser tests.

  Open any app page with the script in the URL hash, e.g.

    sympix_wp.html#{"preset":"presets/wp/par-....json","scriptUrl":"/tests/overlay/api_hook.js"}

  (the path of scriptUrl is relative to the server root; SymRenderer merges the
  hash into its options and loads the script through SymRendererScripting).
  The page then has

    window.symhubApi              the ScriptAPI
    window.symhubRenderSummary(size, blocks)
                                  renders the frame at size x size and returns
                                  the mean colour of blocks x blocks tiles, a
                                  small array by which two versions of the app
                                  can be compared

  Parity check of two versions served from the same origin (e.g. a copy of the
  previous commit next to the working tree): open the preset in the old
  version and keep its summary,

    localStorage.setItem('before', JSON.stringify(symhubRenderSummary(512, 16)))

  then open the same preset in the new version and compare,

    const a = symhubRenderSummary(512, 16), b = JSON.parse(localStorage.getItem('before'));
    Math.max(...a.map((p, i) => Math.max(...p.map((v, k) => Math.abs(v - b[i][k])))))

  which is 0 for identical frames and stays below about 1.5 for the rounding
  of frames composed of several blended passes.
*/

export default function apiHook(api) {

    window.symhubApi = api;

    window.symhubRenderSummary = function (size = 512, blocks = 16) {
        const cnv = api.renderToCanvas(size, size);
        const data = cnv.getContext('2d').getImageData(0, 0, size, size).data;
        const bs = size / blocks;
        const out = [];
        for (let by = 0; by < blocks; by++) {
            for (let bx = 0; bx < blocks; bx++) {
                let r = 0, g = 0, b = 0, n = 0;
                for (let y = by * bs; y < (by + 1) * bs; y++) {
                    for (let x = bx * bs; x < (bx + 1) * bs; x++) {
                        const i = 4 * (y * size + x);
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
                    }
                }
                out.push([r / n, g / n, b / n].map(v => Math.round(v * 10) / 10));
            }
        }
        return out;
    };

    console.log('api_hook: window.symhubApi and window.symhubRenderSummary are ready');
}
