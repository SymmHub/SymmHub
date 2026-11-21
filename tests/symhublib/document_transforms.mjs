/*
  tests of what a document holds of the navigator (lib/symhublib/InversiveNavigator.js;
  docs/conformal_transforms_plan.md section 10, outside the repository): the chain of
  transforms is the document's content and is saved as it is; only the canvas's pan and
  zoom is a view apart from the document's.

    node tests/symhublib/document_transforms.mjs

  A navigator with a canvas of 800 x 500, a document loaded into it (a frame of the
  canvas's shape, no transforms), then the canvas panned and zoomed, the Moebius
  transform set, the sphere view and the band map switched on.

  1. the values a document write gets (the navigator's params read while a document is
     current): the canvas part is the document view's, the frame with its aspect; the
     Moebius transform, the sphere view and the maps are those on the canvas. Read
     outside a write, the canvas part is the one on the canvas
  2. home goes to the frame and leaves the transforms; back returns to the place
  3. a reset of the Moebius transform is a jump: back returns the transform, the maps
     and the sphere view stay
  4. Set document view takes the canvas part alone; the next write has it, with the
     canvas's aspect
  5. a view with transforms in it (one kept in the browser before 2026-11-19) moves the
     canvas alone
  6. a document loaded again: its transforms are the params', its canvas part the
     document view; the place before is forgotten
  7. the anchored view of a document just loaded (still waiting for its frame) is in the
     values a write gets
*/

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { InversiveNavigator } = await import('../../lib/symhublib/InversiveNavigator.js');
const { getDocumentHandler, getParamValues } = await import('../../lib/uilib/uilib.js');
const { iSphere, iPlane } = await import('../../lib/invlib/invlib.js');
const { sameViewValue } = await import('../../lib/symhublib/DocumentView.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
// (document.js logs and traces when a document is made)
function quiet(f){
    const log = console.log, trace = console.trace;
    console.log = console.trace = () => {};
    try { return f(); } finally { console.log = log; console.trace = trace; }
}
const near = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps;
const plain = (v) => JSON.parse(JSON.stringify(v));
// the band's row in the navigator's values (the list of conformal transformations), null without one
const bandOf = (values) => {
    const row = values.projection.params.maps.params.children.find(r => r.className === 'ConformalBand');
    return row ? row.params : null;
};
// a list with one band row, as a document holds it
const bandList = (fraction, enabled = true) => ({ className: 'ProjectionTransform', params: { enabled: true,
    maps: { className: 'ObjArray', params: { id: 'maps', children: [{ className: 'ConformalBand', params: { id: 'band', enabled, fraction } }] } } } });

const canvas = { width: 800, height: 500, clientWidth: 800, clientHeight: 500 };
const nav = new InversiveNavigator({});
nav.init({ canvas, onChanged(){} });
const params = nav.getParams();

// the values a document write gets: the params read while a document is the current one
const doc = quiet(() => getDocumentHandler({}).createDocument({ params }));
function fileValues(){
    doc.beginLoad(null);
    try { return plain(getParamValues(params)); } finally { doc.endLoad(); }
}
const liveValues = () => plain(getParamValues(params));

// a document: a frame of the canvas's shape about (0.1, 0.2), 1 wide; no transforms
const FRAME = { centerX: 0.1, centerY: 0.2, zoom: 2, angle: 0, aspect: 500/800 };
function loadDocument(more = {}){
    nav.setParamsMap({
        mode: 'hyperbolic',
        euclidean: { ...FRAME },
        inversive: { enabled: true, itrans: [], poleSet: false, poleX: 0, poleY: 0, anchored: null },
        spherical: { enabled: false },
        ...more,
    }, true);
    nav.documentLoaded();
}
loadDocument();

{
    const e = liveValues().euclidean;
    check(near(e.centerX, 0.1) && near(e.centerY, 0.2) && near(e.zoom, 2), 'the document opens at its frame, the canvas having its shape');
    check(sameViewValue(Object.keys(nav.getDocumentView().view), ['euclidean']), 'the document view is the canvas part alone');
    check(sameViewValue(Object.keys(nav.getWorkingView()), ['euclidean']), 'the working view is the canvas part alone');
}

// the work: the canvas panned and zoomed, a Moebius transform, the sphere view, the band map
const moebius = plain([iSphere([0.4, 0.1, 0, 1.3]), iPlane([0.6, 0.8, 0, 0.05])]);
nav.setCenter(0.7, -0.3);
nav.setZoom(5);
params.inversive.itrans.setValue(plain(moebius));
nav.setSphereView(true);
params.projection.setValue({ className: 'ProjectionTransform', params: { bandMap: { enabled: true, fraction: 0.5 } } });

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const file = fileValues();
    check(near(file.euclidean.centerX, 0.1) && near(file.euclidean.centerY, 0.2) && near(file.euclidean.zoom, 2) && near(file.euclidean.aspect, 0.625),
          `a write has the frame, not the pan and zoom: ${JSON.stringify(file.euclidean)}`);
    check(sameViewValue(file.inversive.itrans, moebius), 'a write has the Moebius transform on the canvas');
    check(file.spherical.enabled === true, 'a write has the sphere view on the canvas');
    const band = bandOf(file);
    check(band && band.enabled === true && band.fraction === 0.5, `a write has the band map on the canvas: ${JSON.stringify(band)}`);
    const live = liveValues();
    check(near(live.euclidean.centerX, 0.7) && near(live.euclidean.zoom, 5) && !('aspect' in live.euclidean), 'outside a write the canvas part is the one on the canvas');
    check(sameViewValue(live.inversive, file.inversive) && sameViewValue(live.projection, file.projection) && sameViewValue(live.spherical, file.spherical),
          'the transforms read the same in a write and outside one');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    nav.goHome();
    const live = liveValues();
    check(near(live.euclidean.centerX, 0.1) && near(live.euclidean.centerY, 0.2) && near(live.euclidean.zoom, 2), 'home goes to the frame');
    check(sameViewValue(live.inversive.itrans, moebius) && live.spherical.enabled === true && bandOf(live).enabled === true,
          'home leaves the Moebius transform, the sphere view and the maps');
    check(nav.hasPreviousView(), 'home keeps the place before it');
    nav.goToPreviousView();
    const back = liveValues();
    check(near(back.euclidean.centerX, 0.7) && near(back.euclidean.centerY, -0.3) && near(back.euclidean.zoom, 5), 'back returns to the pan and zoom');
    check(sameViewValue(back.inversive.itrans, moebius), 'back leaves the transform that no jump changed');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    nav.onResetInversiveTrans();
    check(liveValues().inversive.itrans.length === 0, 'the Moebius transform reset');
    check(nav.hasPreviousView(), 'the reset is a jump');
    // a map changed after the jump stays through back
    params.projection.setValue(bandList(0.25));
    nav.goToPreviousView();
    const back = liveValues();
    check(sameViewValue(back.inversive.itrans, moebius), 'back returns the Moebius transform');
    check(bandOf(back).fraction === 0.25 && back.spherical.enabled === true, 'back leaves the maps and the sphere view as they are');
    check(near(back.euclidean.centerX, 0.7) && near(back.euclidean.zoom, 5), 'and the canvas where it was');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    let step = null;
    nav.onDocumentViewSet = (before, after) => { step = { before, after }; };
    nav.setDocumentViewFromCurrent();
    check(step && sameViewValue(Object.keys(step.after.view), ['euclidean']) && sameViewValue(Object.keys(step.before.view), ['euclidean']),
          'the undo step of Set document view holds the canvas part alone');
    const file = fileValues();
    check(near(file.euclidean.centerX, 0.7) && near(file.euclidean.centerY, -0.3) && near(file.euclidean.zoom, 5) && near(file.euclidean.aspect, 0.625),
          `after Set document view a write has the canvas's view: ${JSON.stringify(file.euclidean)}`);
    // the step undone: the frame of before, the transforms untouched
    nav.setDocumentView(step.before);
    const undone = fileValues();
    check(near(undone.euclidean.centerX, 0.1) && near(undone.euclidean.zoom, 2), 'the step undone gives the frame back');
    check(sameViewValue(undone.inversive.itrans, moebius) && bandOf(undone).fraction === 0.25, 'and leaves the transforms');
    nav.onDocumentViewSet = null;
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const old = {
        euclidean:  { centerX: -1, centerY: 1, zoom: 3, angle: 0 },
        inversive:  { enabled: false, itrans: [], anchored: null },
        spherical:  { enabled: false },
        projection: { className: 'ProjectionTransform', params: { enabled: true, bandMap: { enabled: false, fraction: 1 } } },
    };
    nav.applyView(old, null, 'exact', nav.canvasSize());
    const live = liveValues();
    check(near(live.euclidean.centerX, -1) && near(live.euclidean.centerY, 1) && near(live.euclidean.zoom, 3), 'a view with transforms in it moves the canvas');
    check(live.inversive.enabled === true && sameViewValue(live.inversive.itrans, moebius) && live.spherical.enabled === true
          && bandOf(live).enabled === true && bandOf(live).fraction === 0.25, 'and nothing else');
    // such a value given as the document view keeps its canvas part alone
    nav.setDocumentView({ view: old, aspect: 1 });
    check(sameViewValue(Object.keys(nav.getDocumentView().view), ['euclidean']), 'a document view set from such a value is the canvas part alone');
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
    loadDocument({ projection: { className: 'ProjectionTransform', params: { enabled: true, bandMap: { enabled: false, fraction: 1 } } } });
    const live = liveValues();
    check(live.inversive.itrans.length === 0 && live.spherical.enabled === false && bandOf(live) === null,
          'a document loaded: its transforms are the params\'');
    check(near(live.euclidean.centerX, 0.1) && near(live.euclidean.zoom, 2), 'and it opens at its frame');
    check(!nav.hasPreviousView(), 'the place before another document is forgotten');
    const file = fileValues();
    check(sameViewValue(file.inversive.itrans, []) && near(file.euclidean.aspect, 0.625), 'written again as it was loaded');
}

// 7 ───────────────────────────────────────────────────────────────────────────
{
    const anchored = { trans: plain(moebius), word: [1, 2, 1] };
    loadDocument({ inversive: { enabled: true, itrans: plain(moebius), poleSet: false, poleX: 0, poleY: 0, anchored } });
    const file = fileValues();
    check(sameViewValue(file.inversive.anchored, anchored), `the anchored view waiting for its frame is written: ${JSON.stringify(file.inversive.anchored)}`);
    loadDocument();
    check(fileValues().inversive.anchored === null, 'a document without one writes none');
}

console.log(failed ? `document_transforms: ${failed} of ${checks} FAILED` : `document_transforms: all ${checks} passed`);
process.exit(failed ? 1 : 0);
