import { VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC } from './shaders.js';
import { analyzeTilingImage, buildTileDataTexture, buildTileMetaTexture } from './tile_analyzer.js';

// ---------------------------------------------------------------------------
// Transition Mode Definitions (matches uMode in shaders.js)
// ---------------------------------------------------------------------------
const MODES = [
  // Category 0: Color & Blend
  { id: 0,  cat: 'Color & Blend', name: 'Cross-Fade',
    desc: 'Classic variable-transparency overlay. Switch Color Interpolation between sRGB and OKLab to compare vibrancy.' },
  { id: 1,  cat: 'Color & Blend', name: 'OKLCH Hue-Wheel',
    desc: 'Rotates colors around the perceptual hue wheel instead of passing through gray — ideal for color permutations.' },
  { id: 2,  cat: 'Color & Blend', name: 'A/B Double-Take',
    desc: 'Smooth oscillating pulse (A → B → peek A → B) that immediately reveals subtle orbit or offset changes.' },

  // Category 1: Dots & Procedural
  { id: 3,  cat: 'Dots & Procedural', name: 'Densifying Dots',
    desc: 'Blue-noise R2 stipple dots appear evenly across the canvas and increase in density until 100% coverage.' },
  { id: 4,  cat: 'Dots & Procedural', name: 'Hex Halftone',
    desc: 'Uniform hexagonal lattice of circular dots growing smoothly from radius 0 until they merge cleanly.' },
  { id: 5,  cat: 'Dots & Procedural', name: 'Swept Halftone',
    desc: 'Directional halftone wave: growing hexagonal dots lead an angled sweep across the pattern.' },
  { id: 6,  cat: 'Dots & Procedural', name: 'Ink-Soak Blobs',
    desc: 'Organic watercolor / FBM noise diffusion blobs spreading and merging across the plane.' },
  { id: 7,  cat: 'Dots & Procedural', name: 'Voronoi Crystals',
    desc: 'Expanding cellular Voronoi crystals with crisp glowing boundaries.' },
  { id: 13, cat: 'Dots & Procedural', name: 'Motif Contour',
    desc: 'Brightness- and edge-guided bleed so the new coloring creeps along the motif contours.' },

  // Category 2: Geometric & Symmetry
  { id: 8,  cat: 'Geometric & Symmetry', name: 'n-Fold Pinwheel',
    desc: 'n synchronized rotating blades matching the group’s rotational symmetry (click canvas to center).' },
  { id: 9,  cat: 'Geometric & Symmetry', name: 'n-Petal Iris',
    desc: 'Blooming radial iris or n-lobed symmetric flower expanding from the focus point.' },
  { id: 10, cat: 'Geometric & Symmetry', name: 'Curtain Split',
    desc: 'Clean angled talk-comparison curtain. Try Easing = "Midpoint Pause" to compare side-by-side.' },
  { id: 11, cat: 'Geometric & Symmetry', name: 'Hyperbolic Geodesic',
    desc: 'Exact Poincaré-disk orthogonal circular arc gliding across the hyperbolic plane.' },
  { id: 12, cat: 'Geometric & Symmetry', name: 'Magic Loupe',
    desc: 'Circular comparison lens gliding across the pattern to preview Image B before expanding to 100%.' },

  // Category 3: Tile-Aware (group_tiling.webp)
  { id: 14, cat: 'Tile-Aware (Fundamental Domains)', name: 'Tile BFS Wave',
    desc: 'Word-length cascade: ripples outward tile-by-tile through the exact fundamental-domain adjacency graph. Click any tile to re-seed!' },
  { id: 15, cat: 'Tile-Aware (Fundamental Domains)', name: 'Tile Mosaic',
    desc: 'Individual fundamental domains transition cleanly as whole tiles in shuffled mosaic order.' },
  { id: 16, cat: 'Tile-Aware (Fundamental Domains)', name: 'Tile 3D Flip',
    desc: 'Each changed fundamental domain flips 180° in 3D around its own centroid while unchanged tiles stay flat.' },
  { id: 17, cat: 'Tile-Aware (Fundamental Domains)', name: 'Per-Tile Bloom',
    desc: 'Simultaneous local reveal inside EVERY fundamental domain: blooms from every tile center to its mirror walls (or reverse!).' },
  { id: 18, cat: 'Tile-Aware (Fundamental Domains)', name: 'Coset Cascade',
    desc: 'Color-class-by-color-class transition: switches one destination color class at a time to clarify subgroup splitting & orbits.' },
];

const MODE_BY_ID = new Map(MODES.map(m => [m.id, m]));

const GRID_PAGES = [
  [0, 1, 3, 4, 5, 6, 7, 13, 10],        // Page 1: Color, Dots & Procedural
  [8, 9, 11, 12, 14, 15, 16, 17, 18],   // Page 2: Symmetry & Tile-Aware
];

// ---------------------------------------------------------------------------
// Curated 1-Click Talk Experiments (verified catalog entries)
// ---------------------------------------------------------------------------
const PRESETS = [
  {
    id: 's632-coset-orbit',
    title: '*632/2*22[3] Cosets → Orbits',
    sub: 'Same subgroup (.1 → .o) — watch invariant diamonds hold still',
    tag: 'Wallpaper',
    version: 'wpe2',
    stem: 's632',
    mode: 18,
    diffOnly: true,
    items: [
      { label: '*632/2*22[3].1', rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.1.webp' },
      { label: '*632/2*22[3].o', rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.o.webp' },
    ],
  },
  {
    id: 's632-perms',
    title: '*632/2*22[3] Coset Permutations',
    sub: 'Cycle through .1 → .2 → .3 colorings of 2*22 in *632',
    tag: 'Sequence',
    version: 'wpe2',
    stem: 's632',
    mode: 1,
    diffOnly: true,
    playback: 'sequence',
    items: [
      { label: '*632/2*22[3].1', rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.1.webp' },
      { label: '*632/2*22[3].2', rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.2.webp' },
      { label: '*632/2*22[3].3', rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.3.webp' },
    ],
  },
  {
    id: 's632-tour',
    title: '*632 Color Groups Tour',
    sub: 'G → 2-color → 3-color → 4-color → 6-color of same pattern',
    tag: 'Sequence',
    version: 'wpe2',
    stem: 's632',
    mode: 14,
    diffOnly: false,
    playback: 'sequence',
    items: [
      { label: 'G = *632',        rel: 's632/gen/group_pattern.webp' },
      { label: '*632/632[2].1',   rel: 's632/2/s632-632-2/gen/s632-632-2.1.webp' },
      { label: '*632/*632[3].1',  rel: 's632/3/s632-s632-3/gen/s632-s632-3.1.webp' },
      { label: '*632/2*22[3].1',  rel: 's632/3/s632-2s22-3/gen/s632-2s22-3.1.webp' },
      { label: '*632/*632[4].1',  rel: 's632/4/s632-s632-4/gen/s632-s632-4.1.webp' },
      { label: '*632/*2222[6].1', rel: 's632/6/s632-s2222-6/gen/s632-s2222-6.1.webp' },
    ],
  },
  {
    id: 's442-split',
    title: '*442 Subgroup Splitting & Orbits',
    sub: 'G → index 2 → index 4 cosets → index 4 orbits',
    tag: 'Wallpaper',
    version: 'wpe2',
    stem: 's442',
    mode: 17,
    diffOnly: true,
    playback: 'sequence',
    items: [
      { label: 'G = *442',          rel: 's442/gen/group_pattern.webp' },
      { label: '*442/*442[2]#1.1',  rel: 's442/2/s442-s442-2-1/gen/s442-s442-2-1.1.webp' },
      { label: '*442/*442[4]#2.1',  rel: 's442/4/s442-s442-4-2/gen/s442-s442-4-2.1.webp' },
      { label: '*442/*442[4]#2.o',  rel: 's442/4/s442-s442-4-2/gen/s442-s442-4-2.o.webp' },
    ],
  },
  {
    id: 's237-hyp-orbit',
    title: '*237/2223[14] Hyperbolic Orbits',
    sub: 'Poincaré disk 14-coloring: cosets (.1) → orbits (.o)',
    tag: 'Hyperbolic',
    version: 'hyp',
    stem: 's237',
    mode: 11,
    diffOnly: false,
    items: [
      { label: '*237/2223[14].1', rel: 's237/14/s237-2223-14/gen/s237-2223-14.1.webp' },
      { label: '*237/2223[14].o', rel: 's237/14/s237-2223-14/gen/s237-2223-14.o.webp' },
    ],
  },
  {
    id: 's237-hyp-tour',
    title: '*237 Hyperbolic Color Tour',
    sub: 'G → 2 → 8 → 9 → 14 colors on Poincaré disk',
    tag: 'Hyperbolic',
    version: 'hyp',
    stem: 's237',
    mode: 14,
    diffOnly: false,
    playback: 'sequence',
    items: [
      { label: 'G = *237',        rel: 's237/gen/group_pattern.webp' },
      { label: '*237/237[2].1',   rel: 's237/2/s237-237-2/gen/s237-237-2.1.webp' },
      { label: '*237/3*7[8].1',   rel: 's237/8/s237-3s7-8/gen/s237-3s7-8.1.webp' },
      { label: '*237/7*2[9].1',   rel: 's237/9/s237-7s2-9/gen/s237-7s2-9.1.webp' },
      { label: '*237/2223[14].1', rel: 's237/14/s237-2223-14/gen/s237-2223-14.1.webp' },
    ],
  },
  {
    id: 's532-poly',
    title: '*532 Polyhedral Tour',
    sub: 'Icosahedral symmetry: G → 2 → 5 → 6 → 10 colors',
    tag: 'Polyhedral',
    version: 'ph',
    stem: 's532',
    mode: 16,
    diffOnly: false,
    playback: 'sequence',
    items: [
      { label: 'G = *532',       rel: 's532/gen/group_pattern.webp' },
      { label: '*532/532[2].1',  rel: 's532/2/s532-532-2/gen/s532-532-2.1.webp' },
      { label: '*532/3*2[5].1',  rel: 's532/5/s532-3s2-5/gen/s532-3s2-5.1.webp' },
      { label: '*532/2*5[6].1',  rel: 's532/6/s532-2s5-6/gen/s532-2s5-6.1.webp' },
      { label: '*532/2*3[10].1', rel: 's532/10/s532-2s3-10/gen/s532-2s3-10.1.webp' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Easing Curves
// ---------------------------------------------------------------------------
function applyEasing(t, kind) {
  t = Math.max(0, Math.min(1, t));
  switch (kind) {
    case 'linear': return t;
    case 'smooth': return t * t * (3 - 2 * t);
    case 'cubic':  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'quint':  return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case 'midpause': {
      // Smoothly sweeps to 0.5, holds around 0.5 for ~30% of duration, then completes to 1.0
      if (t < 0.35) {
        const u = t / 0.35;
        return 0.5 * (u * u * (3 - 2 * u));
      }
      if (t < 0.65) {
        return 0.5;
      }
      const u = (t - 0.65) / 0.35;
      return 0.5 + 0.5 * (u * u * (3 - 2 * u));
    }
    default: return t;
  }
}

function hexToRgb01(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 0.85, 0.48];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function guessSymmetryFold(groupName) {
  if (!groupName) return 6;
  const nums = groupName.match(/\d+/g);
  if (!nums) return 4;
  const maxN = Math.max(...nums.map(s => Math.max(...s.split('').map(Number))));
  return Math.max(2, Math.min(12, maxN || 4));
}

function naturalFileSort(a, b) {
  const pa = a.split('.');
  const pb = b.split('.');
  const sa = pa[pa.length - 2] || '';
  const sb = pb[pb.length - 2] || '';
  const oa = sa.startsWith('o');
  const ob = sb.startsWith('o');
  if (oa !== ob) return oa ? 1 : -1;
  const na = parseInt(sa.replace(/\D/g, ''), 10) || 0;
  const nb = parseInt(sb.replace(/\D/g, ''), 10) || 0;
  if (na !== nb) return na - nb;
  return sa.localeCompare(sb);
}

// ---------------------------------------------------------------------------
// DOM Refs
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const dom = {
  canvas:          $('glCanvas'),
  canvasFrame:     $('canvasFrame'),
  originMarker:    $('originMarker'),
  stageCaption:    $('stageCaption'),
  capA:            $('capA'),
  capB:            $('capB'),
  capMode:         $('capMode'),
  gridOverlay:     $('gridOverlay'),
  gridPager:       $('gridPager'),
  btnGridP1:       $('btnGridP1'),
  btnGridP2:       $('btnGridP2'),
  btnViewSingle:   $('btnViewSingle'),
  btnViewGrid:     $('btnViewGrid'),
  btnSnapshot:     $('btnSnapshot'),
  btnContactSheet: $('btnContactSheet'),
  btnRecord:       $('btnRecord'),
  btnPresent:      $('btnPresent'),
  btnExitPresent:  $('btnExitPresent'),
  statusPill:      $('statusPill'),
  presetList:      $('presetList'),
  selVersion:      $('selVersion'),
  selGroup:        $('selGroup'),
  selImgA:         $('selImgA'),
  selImgB:         $('selImgB'),
  thumbA:          $('thumbA'),
  thumbB:          $('thumbB'),
  thumbALbl:       $('thumbALbl'),
  thumbBLbl:       $('thumbBLbl'),
  btnSwap:         $('btnSwap'),
  btnReloadCatalog:$('btnReloadCatalog'),
  inpCatalogUrl:   $('inpCatalogUrl'),
  seqItems:        $('seqItems'),
  btnAddSeq:       $('btnAddSeq'),
  btnClearSeq:     $('btnClearSeq'),
  dropZone:        $('dropZone'),
  fileA:           $('fileA'),
  fileB:           $('fileB'),
  fileTiling:      $('fileTiling'),
  rngScrub:        $('rngScrub'),
  lblA:            $('lblA'),
  lblB:            $('lblB'),
  lblProgress:     $('lblProgress'),
  btnPlay:         $('btnPlay'),
  btnReset:        $('btnReset'),
  btnMid:          $('btnMid'),
  selPlayback:     $('selPlayback'),
  selEasing:       $('selEasing'),
  chkCaption:      $('chkCaption'),
  modeContainer:   $('modeContainer'),
  modeDesc:        $('modeDesc'),
  tileBadge:       $('tileBadge'),
  selColorSpace:   $('selColorSpace'),
  chkDiffOnly:     $('chkDiffOnly'),
  chkReverse:      $('chkReverse'),
  rngSoftness:     $('rngSoftness'),
  valSoftness:     $('valSoftness'),
  rngScale:        $('rngScale'),
  valScale:        $('valScale'),
  rngSym:          $('rngSym'),
  valSym:          $('valSym'),
  rngAngle:        $('rngAngle'),
  valAngle:        $('valAngle'),
  rngGlow:         $('rngGlow'),
  valGlow:         $('valGlow'),
  inpEdgeColor:    $('inpEdgeColor'),
  rngDur:          $('rngDur'),
  valDur:          $('valDur'),
  rngHold:         $('rngHold'),
  valHold:         $('valHold'),
  toast:           $('toast'),
};

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------
const state = {
  catalogBase: '/catalog',
  versionsIndex: null,
  entriesCache: new Map(),      // version -> entries.json
  imageCache: new Map(),        // url -> Promise<HTMLImageElement>
  tilingCache: new Map(),       // url -> Promise<TilingModel>

  currentVersion: 'wpe2',
  currentTree: 'wp',
  currentGroup: null,
  groupImageList: [],           // [{ label, url, rel }]

  itemA: null,                  // { label, url, img }
  itemB: null,                  // { label, url, img }
  tilingModel: null,
  tileStats: null,

  sequence: [],                 // [{ label, url }]
  seqIndex: 0,                  // active leg: sequence[seqIndex] -> sequence[seqIndex+1]

  view: 'single',               // 'single' | 'grid'
  gridPage: 0,                  // 0 | 1
  mode: 18,
  colorSpace: 1,
  diffOnly: true,
  reverse: false,
  softness: 0.08,
  scale: 36,
  symmetry: 6,
  angleDeg: 0,
  origin: [0.5, 0.5],
  edgeGlow: 0.20,
  edgeColor: '#ffd87a',
  duration: 2.4,
  hold: 1.0,
  easing: 'cubic',
  playback: 'pingpong',         // 'pingpong' | 'loop' | 'once' | 'sequence'
  showCaption: true,

  playing: true,
  rawT: 0,                      // [0..1]
  dir: 1,                       // +1 forward, -1 backward (pingpong)
  holdTimer: 0.6,               // seconds remaining in current endpoint hold
  lastFrameTime: 0,

  recording: false,
  recorder: null,
  recordChunks: [],
  recordCanvas: null,
  recordCtx: null,
};

let toastTimer = null;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------------
// WebGL2 Setup
// ---------------------------------------------------------------------------
const gl = dom.canvas.getContext('webgl2', {
  antialias: true,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
});
if (!gl) {
  alert('WebGL2 is required for Color Transitions Lab.');
  throw new Error('WebGL2 unavailable');
}

function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error('Shader compile error:', log);
    throw new Error(log);
  }
  return sh;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program));
}

const vao = gl.createVertexArray();

const U = {};
for (const name of [
  'uTexA', 'uTexB', 'uTileData', 'uTileMeta',
  'uMode', 'uT', 'uRawT', 'uSoftness', 'uScale', 'uSymmetry', 'uAngle',
  'uOrigin', 'uColorSpace', 'uDiffOnly', 'uEdgeGlow', 'uEdgeColor',
  'uReverse', 'uHasTiling', 'uDiskRadius', 'uResolution',
]) {
  U[name] = gl.getUniformLocation(program, name);
}

function makeTexture(filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([30, 34, 45, 255]));
  return tex;
}

const texA        = makeTexture(gl.LINEAR);
const texB        = makeTexture(gl.LINEAR);
const texTileData = makeTexture(gl.NEAREST);
const texTileMeta = makeTexture(gl.NEAREST);

function uploadImageTexture(tex, img) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
}

function uploadDataTexture(tex, bytes, size) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
}

// ---------------------------------------------------------------------------
// Image & Tiling Loaders
// ---------------------------------------------------------------------------
function loadImage(url) {
  if (state.imageCache.has(url)) return state.imageCache.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + url));
    img.src = url;
  });
  state.imageCache.set(url, p);
  return p;
}

function loadTilingModel(url) {
  if (state.tilingCache.has(url)) return state.tilingCache.get(url);
  const p = loadImage(url).then(img => analyzeTilingImage(img));
  state.tilingCache.set(url, p);
  return p;
}

function refreshTileDataForOrigin() {
  if (!state.tilingModel) return;
  const bytes = buildTileDataTexture(state.tilingModel, state.origin[0], state.origin[1]);
  uploadDataTexture(texTileData, bytes, state.tilingModel.size);
}

function refreshTileMetaForPair() {
  if (!state.tilingModel || !state.itemA?.img || !state.itemB?.img) {
    state.tileStats = null;
    updateTileBadge();
    return;
  }
  const { data, stats } = buildTileMetaTexture(state.tilingModel, state.itemA.img, state.itemB.img);
  uploadDataTexture(texTileMeta, data, state.tilingModel.size);
  state.tileStats = stats;
  updateTileBadge();
}

function updateTileBadge() {
  if (state.tilingModel && state.tileStats && state.tileStats.numTiles > 0) {
    const { numTiles, changedTiles, colorClasses } = state.tileStats;
    dom.tileBadge.textContent = `${numTiles} tiles · ${changedTiles} chg · ${colorClasses} cls`;
    dom.tileBadge.classList.remove('off');
  } else if (state.tilingModel) {
    dom.tileBadge.textContent = `${state.tilingModel.numTiles} tiles`;
    dom.tileBadge.classList.remove('off');
  } else {
    dom.tileBadge.textContent = 'No tiling map';
    dom.tileBadge.classList.add('off');
  }
}

async function setPair(itemA, itemB) {
  try {
    const [imgA, imgB] = await Promise.all([
      itemA.img ? Promise.resolve(itemA.img) : loadImage(itemA.url),
      itemB.img ? Promise.resolve(itemB.img) : loadImage(itemB.url),
    ]);
    state.itemA = { ...itemA, img: imgA };
    state.itemB = { ...itemB, img: imgB };

    // Resize canvas cleanly to match native image resolution (clamped to 1024)
    const targetRes = Math.min(1024, Math.max(512, imgA.naturalWidth || 800));
    if (dom.canvas.width !== targetRes || dom.canvas.height !== targetRes) {
      dom.canvas.width = targetRes;
      dom.canvas.height = targetRes;
    }

    uploadImageTexture(texA, imgA);
    uploadImageTexture(texB, imgB);

    dom.thumbA.src = itemA.url || imgA.src;
    dom.thumbB.src = itemB.url || imgB.src;
    dom.thumbALbl.textContent = itemA.label;
    dom.thumbBLbl.textContent = itemB.label;
    dom.lblA.textContent = itemA.label;
    dom.lblB.textContent = itemB.label;
    dom.capA.textContent = itemA.label;
    dom.capB.textContent = itemB.label;

    refreshTileMetaForPair();
    renderFrame();
  } catch (err) {
    console.error(err);
    showToast('Error loading image: ' + err.message);
  }
}

async function loadGroupTiling(tilingUrl) {
  try {
    state.tilingModel = await loadTilingModel(tilingUrl);
    refreshTileDataForOrigin();
    refreshTileMetaForPair();
    renderFrame();
  } catch {
    state.tilingModel = null;
    state.tileStats = null;
    updateTileBadge();
  }
}

// ---------------------------------------------------------------------------
// Catalog API & Browser
// ---------------------------------------------------------------------------
async function detectAndLoadCatalog(preferredUrl) {
  const candidates = [];
  if (preferredUrl) candidates.push(preferredUrl);
  const qCat = new URLSearchParams(location.search).get('catalog');
  if (qCat && !candidates.includes(qCat)) candidates.push(qCat);
  for (const c of ['/catalog', 'http://localhost:8124']) {
    if (!candidates.includes(c)) candidates.push(c);
  }

  for (const base of candidates) {
    const clean = base.replace(/\/+$/, '');
    try {
      const resp = await fetch(`${clean}/versions/index.json`);
      if (!resp.ok) continue;
      const idx = await resp.json();
      state.catalogBase = clean;
      state.versionsIndex = idx;
      dom.inpCatalogUrl.value = clean;
      dom.statusPill.textContent = `Catalog connected (${clean})`;
      dom.statusPill.className = 'status-pill ok';
      populateVersions();
      await applyPreset(PRESETS[0]);
      return true;
    } catch {
      // try next candidate
    }
  }

  dom.statusPill.textContent = 'Catalog offline — drag/drop local images or start serve_symmhub.mjs';
  dom.statusPill.className = 'status-pill warn';
  loadFallbackDemoPair();
  return false;
}

function populateVersions() {
  const versions = state.versionsIndex?.versions || {};
  const order = ['wpe2', 'hyp', 'ph', 'fe', 'ax', 'wpe1', 'wpe'];
  const keys = [
    ...order.filter(k => versions[k]),
    ...Object.keys(versions).filter(k => !order.includes(k)),
  ];
  dom.selVersion.innerHTML = '';
  for (const k of keys) {
    const v = versions[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${k} — ${v.label || v.family || k}`;
    dom.selVersion.appendChild(opt);
  }
}

async function loadVersionEntries(ver) {
  if (state.entriesCache.has(ver)) return state.entriesCache.get(ver);
  const resp = await fetch(`${state.catalogBase}/versions/${ver}/entries.json`);
  if (!resp.ok) throw new Error(`entries.json not found for ${ver}`);
  const json = await resp.json();
  state.entriesCache.set(ver, json);
  return json;
}

async function selectVersion(ver, preferredStem) {
  state.currentVersion = ver;
  dom.selVersion.value = ver;
  const entries = await loadVersionEntries(ver);
  state.currentTree = entries.tree;

  dom.selGroup.innerHTML = '';
  for (const g of entries.groups) {
    const opt = document.createElement('option');
    opt.value = g.stem;
    opt.textContent = `${g.name}  (${g.entries.length} color groups)`;
    dom.selGroup.appendChild(opt);
  }

  const targetStem = preferredStem && entries.groups.some(g => g.stem === preferredStem)
    ? preferredStem
    : (entries.groups.find(g => g.stem === 's632')?.stem || entries.groups[0]?.stem);
  await selectGroup(targetStem, false);
}

async function selectGroup(stem, autoPickPair = true) {
  const entries = await loadVersionEntries(state.currentVersion);
  const g = entries.groups.find(x => x.stem === stem) || entries.groups[0];
  if (!g) return;
  state.currentGroup = g;
  dom.selGroup.value = g.stem;

  // Auto-tune symmetry fold slider to group order
  const fold = guessSymmetryFold(g.name);
  state.symmetry = fold;
  dom.rngSym.value = fold;
  dom.valSym.textContent = String(fold);

  const treeUrl = `${state.catalogBase}/${state.currentTree}`;
  const list = [];
  list.push({
    label: `G = ${g.name} (1 color)`,
    rel: `${g.stem}/gen/group_pattern.webp`,
    url: `${treeUrl}/${g.stem}/gen/group_pattern.webp`,
  });

  for (const e of g.entries) {
    const patternFiles = e.files
      .filter(f => f.startsWith(e.slug + '.') && f.endsWith('.webp'))
      .sort(naturalFileSort);
    for (const f of patternFiles) {
      const suffix = f.slice(e.slug.length, -'.webp'.length); // .1, .2, .o, .o1
      const kindTag = suffix.startsWith('.o') ? ' [orbit]' : '';
      list.push({
        label: `${e.name}${suffix}${kindTag}`,
        rel: `${e.dir}/gen/${f}`,
        url: `${treeUrl}/${e.dir}/gen/${f}`,
      });
    }
  }

  state.groupImageList = list;
  const fillSelect = sel => {
    sel.innerHTML = '';
    list.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  };
  fillSelect(dom.selImgA);
  fillSelect(dom.selImgB);

  // Load group_tiling.webp in parallel
  const tilingUrl = `${treeUrl}/${g.stem}/gen/group_tiling.webp`;
  loadGroupTiling(tilingUrl);

  if (autoPickPair && list.length >= 2) {
    // Prefer an interesting pair: e.g., first entry's .1 and .o, or G -> first coloring
    const orbitIdx = list.findIndex(x => x.label.includes('[orbit]'));
    let idxA = 0, idxB = 1;
    if (orbitIdx > 1) {
      // Pick the matching .1 right before this orbit
      const prefix = list[orbitIdx].label.split('.o')[0];
      const cosetIdx = list.findIndex(x => x.label.startsWith(prefix + '.1'));
      if (cosetIdx >= 0) { idxA = cosetIdx; idxB = orbitIdx; }
    }
    dom.selImgA.value = String(idxA);
    dom.selImgB.value = String(idxB);
    await setPair(list[idxA], list[idxB]);
  }
}

async function applyPreset(preset) {
  document.querySelectorAll('.preset-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.presetId === preset.id);
  });

  await selectVersion(preset.version, preset.stem);
  const treeUrl = `${state.catalogBase}/${state.currentTree}`;
  const resolved = preset.items.map(it => ({
    label: it.label,
    rel: it.rel,
    url: `${treeUrl}/${it.rel}`,
  }));

  // Sync dropdowns to first two items
  const findIdx = rel => state.groupImageList.findIndex(x => x.rel === rel);
  const iA = findIdx(resolved[0].rel);
  const iB = findIdx(resolved[1].rel);
  if (iA >= 0) dom.selImgA.value = String(iA);
  if (iB >= 0) dom.selImgB.value = String(iB);

  // Update sequence & playback mode
  state.sequence = resolved;
  state.seqIndex = 0;
  renderSequenceChips();

  state.playback = preset.playback || (resolved.length > 2 ? 'sequence' : 'pingpong');
  dom.selPlayback.value = state.playback;

  if (typeof preset.mode === 'number') setMode(preset.mode);
  if (typeof preset.diffOnly === 'boolean') {
    state.diffOnly = preset.diffOnly;
    dom.chkDiffOnly.checked = preset.diffOnly;
  }

  state.rawT = 0;
  state.dir = 1;
  state.holdTimer = Math.min(0.6, state.hold);
  await setPair(resolved[0], resolved[1]);

  // Preload remaining sequence images in background
  for (let i = 2; i < resolved.length; i++) {
    loadImage(resolved[i].url).catch(() => {});
  }
}

function loadFallbackDemoPair() {
  // Synthetic tiled demo pattern if catalog server isn't reachable
  const makePattern = (palette) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const step = 64;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = palette[(x + y) % palette.length];
        ctx.fillRect(x * step, y * step, step, step);
        ctx.strokeStyle = '#111';
        ctx.strokeRect(x * step, y * step, step, step);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x * step + 22, y * step + 22, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return c.toDataURL();
  };
  const a = { label: 'Demo A', url: makePattern(['#fce3a5', '#cd8238', '#622001']) };
  const b = { label: 'Demo B', url: makePattern(['#622001', '#fce3a5', '#cd8238']) };
  setPair(a, b);
}

// ---------------------------------------------------------------------------
// Storyboard Sequence UI
// ---------------------------------------------------------------------------
function renderSequenceChips() {
  dom.seqItems.innerHTML = '';
  if (state.sequence.length === 0) {
    dom.seqItems.innerHTML = '<span style="font-size:11px;color:var(--muted);">Empty — click + Add B to build a sequence.</span>';
    return;
  }
  state.sequence.forEach((item, idx) => {
    const chip = document.createElement('span');
    chip.className = 'seq-chip' + (state.playback === 'sequence' && idx === state.seqIndex ? ' current' : '');
    chip.innerHTML = `<span>${idx + 1}. ${item.label}</span><span class="x" title="Remove">&times;</span>`;
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) {
        state.sequence.splice(idx, 1);
        state.seqIndex = Math.min(state.seqIndex, Math.max(0, state.sequence.length - 2));
        renderSequenceChips();
        return;
      }
      if (state.sequence.length >= 2) {
        state.seqIndex = idx % state.sequence.length;
        const nextIdx = (state.seqIndex + 1) % state.sequence.length;
        state.rawT = 0;
        state.holdTimer = 0.2;
        setPair(state.sequence[state.seqIndex], state.sequence[nextIdx]);
        renderSequenceChips();
      }
    });
    dom.seqItems.appendChild(chip);
  });
}

// ---------------------------------------------------------------------------
// Rendering (Single Stage & 3x3 Live Compare Grid)
// ---------------------------------------------------------------------------
function bindCommonUniforms(easedT, rawT, width, height) {
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);        gl.uniform1i(U.uTexA, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);        gl.uniform1i(U.uTexB, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texTileData); gl.uniform1i(U.uTileData, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texTileMeta); gl.uniform1i(U.uTileMeta, 3);

  gl.uniform1f(U.uT, easedT);
  gl.uniform1f(U.uRawT, rawT);
  gl.uniform1f(U.uSoftness, state.softness);
  gl.uniform1f(U.uScale, state.scale);
  gl.uniform1f(U.uSymmetry, state.symmetry);
  gl.uniform1f(U.uAngle, (state.angleDeg * Math.PI) / 180);
  gl.uniform2f(U.uOrigin, state.origin[0], state.origin[1]);
  gl.uniform1i(U.uColorSpace, state.colorSpace);
  gl.uniform1i(U.uDiffOnly, state.diffOnly ? 1 : 0);
  gl.uniform1f(U.uEdgeGlow, state.edgeGlow);
  const ec = hexToRgb01(state.edgeColor);
  gl.uniform3f(U.uEdgeColor, ec[0], ec[1], ec[2]);
  gl.uniform1i(U.uReverse, state.reverse ? 1 : 0);
  gl.uniform1f(U.uHasTiling, state.tilingModel ? 1.0 : 0.0);
  gl.uniform1f(U.uDiskRadius, state.tilingModel ? state.tilingModel.diskRadius : 0.47);
  gl.uniform2f(U.uResolution, width, height);
}

function renderFrame(overrideRawT) {
  const rawT = typeof overrideRawT === 'number' ? overrideRawT : state.rawT;
  const easedT = applyEasing(rawT, state.easing);
  const W = dom.canvas.width;
  const H = dom.canvas.height;

  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0.04, 0.05, 0.07, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (state.view === 'single') {
    gl.viewport(0, 0, W, H);
    bindCommonUniforms(easedT, rawT, W, H);
    gl.uniform1i(U.uMode, state.mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  } else {
    // 3x3 scissored live comparison grid in a single WebGL2 context!
    const modes9 = GRID_PAGES[state.gridPage];
    const cellW = Math.floor(W / 3);
    const cellH = Math.floor(H / 3);
    gl.enable(gl.SCISSOR_TEST);
    bindCommonUniforms(easedT, rawT, cellW, cellH);

    for (let idx = 0; idx < 9; idx++) {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const vx = col * cellW;
      const vy = H - (row + 1) * cellH; // WebGL Y is bottom-up
      gl.viewport(vx, vy, cellW, cellH);
      gl.scissor(vx, vy, cellW, cellH);
      gl.uniform1i(U.uMode, modes9[idx]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  dom.rngScrub.value = rawT.toFixed(3);
  dom.lblProgress.textContent = `t=${rawT.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Animation Loop & Sequence Advancement
// ---------------------------------------------------------------------------
let advancingSeq = false;

async function advanceSequenceLeg() {
  if (advancingSeq || state.sequence.length < 2) return;
  advancingSeq = true;
  state.seqIndex = (state.seqIndex + 1) % state.sequence.length;
  const nextIdx = (state.seqIndex + 1) % state.sequence.length;
  await setPair(state.sequence[state.seqIndex], state.sequence[nextIdx]);
  state.rawT = 0;
  state.holdTimer = state.hold;
  renderSequenceChips();
  advancingSeq = false;

  if (state.recording && state.seqIndex === 0) {
    stopRecording();
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!state.lastFrameTime) { state.lastFrameTime = now; return; }
  const dt = Math.min(0.05, (now - state.lastFrameTime) / 1000);
  state.lastFrameTime = now;

  if (state.playing && !advancingSeq) {
    if (state.holdTimer > 0) {
      state.holdTimer = Math.max(0, state.holdTimer - dt);
    } else {
      const step = dt / Math.max(0.2, state.duration);
      if (state.playback === 'pingpong') {
        state.rawT += step * state.dir;
        if (state.rawT >= 1) {
          state.rawT = 1;
          state.dir = -1;
          state.holdTimer = state.hold;
          if (state.recording && state.recordMode === 'single') {
            // Wait out final hold then stop
            setTimeout(() => { if (state.recording) stopRecording(); }, Math.max(120, state.hold * 1000));
          }
        } else if (state.rawT <= 0) {
          state.rawT = 0;
          state.dir = 1;
          state.holdTimer = state.hold;
        }
      } else if (state.playback === 'loop') {
        state.rawT += step;
        if (state.rawT >= 1) {
          state.rawT = 1;
          renderFrame();
          if (state.recording) {
            setTimeout(() => { if (state.recording) stopRecording(); }, Math.max(120, state.hold * 1000));
          }
          state.rawT = 0;
          state.holdTimer = state.hold;
        }
      } else if (state.playback === 'once') {
        state.rawT = Math.min(1, state.rawT + step);
        if (state.rawT >= 1) {
          state.playing = false;
          updatePlayButton();
          if (state.recording) {
            setTimeout(() => { if (state.recording) stopRecording(); }, Math.max(150, state.hold * 1000));
          }
        }
      } else if (state.playback === 'sequence') {
        state.rawT += step;
        if (state.rawT >= 1) {
          state.rawT = 1;
          renderFrame();
          if (state.sequence.length >= 2) {
            advanceSequenceLeg();
          } else {
            state.rawT = 0;
            state.holdTimer = state.hold;
          }
        }
      }
    }
    renderFrame();
  }

  // Feed composite frame into active WebM recorder if running
  if (state.recording && state.recordCtx) {
    drawCompositeFrame(state.recordCtx, state.recordCanvas.width, state.recordCanvas.height);
  }
}

// ---------------------------------------------------------------------------
// Exports: Snapshot PNG, Contact Sheet PNG, and WebM Video Recorder
// ---------------------------------------------------------------------------
function drawCompositeFrame(ctx, w, h) {
  ctx.drawImage(dom.canvas, 0, 0, w, h);
  if (state.showCaption && state.view === 'single') {
    const modeName = MODE_BY_ID.get(state.mode)?.name || '';
    const txt = `${state.itemA?.label || 'A'}  →  ${state.itemB?.label || 'B'}   |   ${modeName}`;
    ctx.save();
    ctx.font = `600 ${Math.round(w * 0.019)}px ui-monospace, Consolas, monospace`;
    const m = ctx.measureText(txt);
    const padX = 16, padY = 8;
    const bw = m.width + padX * 2;
    const bh = Math.round(w * 0.019) + padY * 2;
    const bx = (w - bw) / 2;
    const by = h - bh - 16;
    ctx.fillStyle = 'rgba(11, 14, 20, 0.80)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f3f6fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, w / 2, by + bh / 2 + 1);
    ctx.restore();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sanitizeFilename(s) {
  return (s || 'transition').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 64);
}

function exportSnapshotPng() {
  renderFrame();
  const c = document.createElement('canvas');
  c.width = dom.canvas.width;
  c.height = dom.canvas.height;
  drawCompositeFrame(c.getContext('2d'), c.width, c.height);
  c.toBlob(blob => {
    const m = MODE_BY_ID.get(state.mode)?.name || 'frame';
    downloadBlob(blob, sanitizeFilename(`${state.itemA?.label || 'A'}_to_${state.itemB?.label || 'B'}_${m}`) + '.png');
    showToast('Saved PNG snapshot');
  }, 'image/png');
}

function exportContactSheetPng() {
  const wasView = state.view;
  const savedT = state.rawT;
  state.view = 'single';

  const steps = [0.0, 0.17, 0.33, 0.50, 0.67, 0.83, 1.0];
  const tile = 320;
  const gap = 10;
  const headerH = 44;
  const footerH = 26;
  const out = document.createElement('canvas');
  out.width = steps.length * tile + (steps.length + 1) * gap;
  out.height = headerH + tile + footerH + gap;
  const ctx = out.getContext('2d');

  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, out.width, out.height);

  const modeName = MODE_BY_ID.get(state.mode)?.name || '';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${state.itemA?.label || 'A'}  →  ${state.itemB?.label || 'B'}   —   ${modeName}  (DiffOnly: ${state.diffOnly ? 'On' : 'Off'})`,
    gap, headerH / 2
  );

  steps.forEach((tVal, i) => {
    renderFrame(tVal);
    const x = gap + i * (tile + gap);
    const y = headerH;
    ctx.drawImage(dom.canvas, x, y, tile, tile);
    ctx.strokeStyle = '#2a3242';
    ctx.strokeRect(x, y, tile, tile);

    ctx.fillStyle = '#93a0b8';
    ctx.font = '600 13px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`t = ${Math.round(tVal * 100)}%`, x + tile / 2, y + tile + footerH / 2 + 2);
  });

  state.view = wasView;
  renderFrame(savedT);

  out.toBlob(blob => {
    downloadBlob(blob, sanitizeFilename(`sheet_${modeName}_${state.itemA?.label || 'A'}`) + '.png');
    showToast('Saved 7-frame Contact Sheet PNG');
  }, 'image/png');
}

function toggleRecording() {
  if (state.recording) {
    stopRecording();
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('MediaRecorder is not supported in this browser');
    return;
  }

  const c = document.createElement('canvas');
  c.width = dom.canvas.width;
  c.height = dom.canvas.height;
  state.recordCanvas = c;
  state.recordCtx = c.getContext('2d');

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(m => MediaRecorder.isTypeSupported(m)) || '';

  const stream = c.captureStream(60);
  const rec = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    videoBitsPerSecond: 12_000_000,
  });

  state.recordChunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size > 0) state.recordChunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(state.recordChunks, { type: mime || 'video/webm' });
    const modeName = MODE_BY_ID.get(state.mode)?.name || 'transition';
    downloadBlob(blob, sanitizeFilename(`transition_${modeName}_${state.itemA?.label || 'A'}`) + '.webm');
    showToast(`Saved WebM video (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
  };

  state.recorder = rec;
  state.recording = true;
  state.recordMode = state.playback === 'sequence' ? 'sequence' : 'single';
  dom.btnRecord.textContent = '■ Stop Rec';
  dom.btnRecord.classList.add('recording');

  // Start cleanly at t = 0 with initial hold
  if (state.playback === 'sequence' && state.sequence.length >= 2) {
    state.seqIndex = 0;
    setPair(state.sequence[0], state.sequence[1]);
    renderSequenceChips();
  }
  state.rawT = 0;
  state.dir = 1;
  state.holdTimer = Math.min(0.8, state.hold);
  state.playing = true;
  updatePlayButton();
  renderFrame();
  drawCompositeFrame(state.recordCtx, c.width, c.height);

  rec.start(100);
  showToast('Recording WebM… will auto-stop at cycle end');
}

function stopRecording() {
  if (!state.recording) return;
  state.recording = false;
  dom.btnRecord.textContent = '● Record WebM';
  dom.btnRecord.classList.remove('recording');
  try { state.recorder?.stop(); } catch {}
  state.recorder = null;
}

// ---------------------------------------------------------------------------
// UI Wiring
// ---------------------------------------------------------------------------
function setMode(modeId) {
  state.mode = modeId;
  const info = MODE_BY_ID.get(modeId);
  document.querySelectorAll('.mode-pill').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.modeId) === modeId);
  });
  dom.modeDesc.textContent = info ? info.desc : '';
  dom.capMode.textContent = info ? info.name : '';
  updateGridOverlaySelection();
  renderFrame();
}

function buildModeButtons() {
  const byCat = new Map();
  for (const m of MODES) {
    if (!byCat.has(m.cat)) byCat.set(m.cat, []);
    byCat.get(m.cat).push(m);
  }
  dom.modeContainer.innerHTML = '';
  for (const [cat, items] of byCat) {
    const grp = document.createElement('div');
    grp.className = 'cat-group';
    const lbl = document.createElement('div');
    lbl.className = 'cat-label';
    lbl.textContent = cat;
    const grid = document.createElement('div');
    grid.className = 'mode-grid';
    for (const m of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-pill';
      btn.dataset.modeId = String(m.id);
      btn.textContent = m.name;
      btn.title = m.desc;
      btn.addEventListener('click', () => setMode(m.id));
      grid.appendChild(btn);
    }
    grp.append(lbl, grid);
    dom.modeContainer.appendChild(grp);
  }
}

function buildPresetButtons() {
  dom.presetList.innerHTML = '';
  for (const p of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.dataset.presetId = p.id;
    btn.innerHTML = `<div class="pt"><span>${p.title}</span><span class="tag">${p.tag}</span></div><div class="ps">${p.sub}</div>`;
    btn.addEventListener('click', () => applyPreset(p));
    dom.presetList.appendChild(btn);
  }
}

function rebuildGridOverlay() {
  const modes9 = GRID_PAGES[state.gridPage];
  dom.gridOverlay.innerHTML = '';
  modes9.forEach(mId => {
    const info = MODE_BY_ID.get(mId);
    const cell = document.createElement('div');
    cell.className = 'grid-cell' + (mId === state.mode ? ' selected' : '');
    cell.dataset.modeId = String(mId);
    cell.title = `${info?.name}: ${info?.desc} (Click to open in Single Stage)`;
    cell.innerHTML = `<span class="grid-cell-lbl">${info?.name || mId}</span>`;
    cell.addEventListener('click', () => {
      setMode(mId);
      setView('single');
    });
    dom.gridOverlay.appendChild(cell);
  });
}

function updateGridOverlaySelection() {
  dom.gridOverlay.querySelectorAll('.grid-cell').forEach(c => {
    c.classList.toggle('selected', Number(c.dataset.modeId) === state.mode);
  });
}

function setView(view) {
  state.view = view;
  const isGrid = view === 'grid';
  dom.btnViewSingle.classList.toggle('active', !isGrid);
  dom.btnViewGrid.classList.toggle('active', isGrid);
  dom.gridOverlay.classList.toggle('hidden', !isGrid);
  dom.gridPager.classList.toggle('hidden', !isGrid);
  dom.stageCaption.classList.toggle('hidden', isGrid || !state.showCaption);
  if (isGrid) rebuildGridOverlay();
  renderFrame();
}

function updatePlayButton() {
  dom.btnPlay.textContent = state.playing ? '❚❚ Pause' : '▶ Play';
}

let markerTimer = null;
function setOriginFromPointer(e) {
  if (state.view !== 'single') return;
  const rect = dom.canvasFrame.getBoundingClientRect();
  const ox = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const oy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  state.origin = [ox, oy];
  dom.originMarker.style.left = `${ox * 100}%`;
  dom.originMarker.style.top  = `${oy * 100}%`;
  dom.originMarker.classList.add('visible');
  clearTimeout(markerTimer);
  markerTimer = setTimeout(() => dom.originMarker.classList.remove('visible'), 1200);
  refreshTileDataForOrigin();
  renderFrame();
}

function wireEvents() {
  // View toggles
  dom.btnViewSingle.addEventListener('click', () => setView('single'));
  dom.btnViewGrid.addEventListener('click', () => setView('grid'));
  dom.btnGridP1.addEventListener('click', () => {
    state.gridPage = 0;
    dom.btnGridP1.classList.add('active');
    dom.btnGridP2.classList.remove('active');
    rebuildGridOverlay();
    renderFrame();
  });
  dom.btnGridP2.addEventListener('click', () => {
    state.gridPage = 1;
    dom.btnGridP2.classList.add('active');
    dom.btnGridP1.classList.remove('active');
    rebuildGridOverlay();
    renderFrame();
  });

  // Presentation mode
  const togglePresent = (force) => {
    const next = typeof force === 'boolean' ? force : !document.body.classList.contains('present');
    document.body.classList.toggle('present', next);
  };
  dom.btnPresent.addEventListener('click', () => togglePresent(true));
  dom.btnExitPresent.addEventListener('click', () => togglePresent(false));

  // Exports
  dom.btnSnapshot.addEventListener('click', exportSnapshotPng);
  dom.btnContactSheet.addEventListener('click', exportContactSheetPng);
  dom.btnRecord.addEventListener('click', toggleRecording);

  // Catalog selects
  dom.selVersion.addEventListener('change', () => selectVersion(dom.selVersion.value));
  dom.selGroup.addEventListener('change', () => selectGroup(dom.selGroup.value, true));
  dom.selImgA.addEventListener('change', () => {
    const a = state.groupImageList[Number(dom.selImgA.value)];
    if (a && state.itemB) setPair(a, state.itemB);
  });
  dom.selImgB.addEventListener('change', () => {
    const b = state.groupImageList[Number(dom.selImgB.value)];
    if (b && state.itemA) setPair(state.itemA, b);
  });
  dom.btnSwap.addEventListener('click', () => {
    if (!state.itemA || !state.itemB) return;
    const tmpVal = dom.selImgA.value;
    dom.selImgA.value = dom.selImgB.value;
    dom.selImgB.value = tmpVal;
    setPair(state.itemB, state.itemA);
  });
  dom.btnReloadCatalog.addEventListener('click', () => detectAndLoadCatalog(dom.inpCatalogUrl.value.trim()));
  dom.inpCatalogUrl.addEventListener('keydown', e => {
    if (e.key === 'Enter') detectAndLoadCatalog(dom.inpCatalogUrl.value.trim());
  });

  // Sequence controls
  dom.btnAddSeq.addEventListener('click', () => {
    if (state.sequence.length === 0 && state.itemA) {
      state.sequence.push({ label: state.itemA.label, url: state.itemA.url });
    }
    if (state.itemB) {
      state.sequence.push({ label: state.itemB.label, url: state.itemB.url });
    }
    renderSequenceChips();
    showToast(`Sequence now has ${state.sequence.length} frames`);
  });
  dom.btnClearSeq.addEventListener('click', () => {
    state.sequence = [];
    state.seqIndex = 0;
    renderSequenceChips();
  });

  // Local custom image upload & drag-drop
  const handleLocalFile = (file, slot) => {
    const url = URL.createObjectURL(file);
    const label = file.name.replace(/\.[^.]+$/, '');
    if (slot === 'A') setPair({ label, url }, state.itemB || { label, url });
    else if (slot === 'B') setPair(state.itemA || { label, url }, { label, url });
    else if (slot === 'T') loadGroupTiling(url);
  };
  dom.fileA.addEventListener('change', e => { if (e.target.files[0]) handleLocalFile(e.target.files[0], 'A'); });
  dom.fileB.addEventListener('change', e => { if (e.target.files[0]) handleLocalFile(e.target.files[0], 'B'); });
  dom.fileTiling.addEventListener('change', e => { if (e.target.files[0]) handleLocalFile(e.target.files[0], 'T'); });

  dom.dropZone.addEventListener('dragover', e => { e.preventDefault(); dom.dropZone.classList.add('dragover'); });
  dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
  dom.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length >= 2) {
      const a = { label: files[0].name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(files[0]) };
      const b = { label: files[1].name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(files[1]) };
      setPair(a, b);
    } else if (files.length === 1) {
      handleLocalFile(files[0], 'B');
    }
  });

  // Interactive canvas origin picker
  let draggingOrigin = false;
  dom.canvasFrame.addEventListener('pointerdown', e => {
    if (state.view !== 'single') return;
    draggingOrigin = true;
    setOriginFromPointer(e);
  });
  window.addEventListener('pointermove', e => {
    if (draggingOrigin) setOriginFromPointer(e);
  });
  window.addEventListener('pointerup', () => { draggingOrigin = false; });

  // Timeline transport
  dom.rngScrub.addEventListener('input', () => {
    state.playing = false;
    updatePlayButton();
    state.rawT = Number(dom.rngScrub.value);
    renderFrame();
  });
  dom.btnPlay.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing && state.playback === 'once' && state.rawT >= 0.999) {
      state.rawT = 0;
    }
    state.holdTimer = 0;
    updatePlayButton();
  });
  dom.btnReset.addEventListener('click', () => {
    state.rawT = 0;
    state.dir = 1;
    state.holdTimer = 0;
    renderFrame();
  });
  dom.btnMid.addEventListener('click', () => {
    state.playing = false;
    updatePlayButton();
    state.rawT = 0.5;
    renderFrame();
  });
  dom.selPlayback.addEventListener('change', () => {
    state.playback = dom.selPlayback.value;
    if (state.playback === 'sequence' && state.sequence.length >= 2) {
      state.seqIndex = 0;
      setPair(state.sequence[0], state.sequence[1]);
    }
    renderSequenceChips();
  });
  dom.selEasing.addEventListener('change', () => {
    state.easing = dom.selEasing.value;
    renderFrame();
  });
  dom.chkCaption.addEventListener('change', () => {
    state.showCaption = dom.chkCaption.checked;
    dom.stageCaption.classList.toggle('hidden', state.view === 'grid' || !state.showCaption);
  });

  // Parameters
  dom.selColorSpace.addEventListener('change', () => { state.colorSpace = Number(dom.selColorSpace.value); renderFrame(); });
  dom.chkDiffOnly.addEventListener('change', () => { state.diffOnly = dom.chkDiffOnly.checked; renderFrame(); });
  dom.chkReverse.addEventListener('change', () => { state.reverse = dom.chkReverse.checked; renderFrame(); });

  const bindRange = (el, valEl, key, fmt) => {
    el.addEventListener('input', () => {
      state[key] = Number(el.value);
      valEl.textContent = fmt(state[key]);
      renderFrame();
    });
  };
  bindRange(dom.rngSoftness, dom.valSoftness, 'softness', v => v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
  bindRange(dom.rngScale,    dom.valScale,    'scale',    v => String(v));
  bindRange(dom.rngSym,      dom.valSym,      'symmetry', v => String(v));
  bindRange(dom.rngAngle,    dom.valAngle,    'angleDeg', v => `${v}°`);
  bindRange(dom.rngGlow,     dom.valGlow,     'edgeGlow', v => v.toFixed(2));
  bindRange(dom.rngDur,      dom.valDur,      'duration', v => `${v.toFixed(1)}s`);
  bindRange(dom.rngHold,     dom.valHold,     'hold',     v => `${v.toFixed(1)}s`);

  dom.inpEdgeColor.addEventListener('input', () => { state.edgeColor = dom.inpEdgeColor.value; renderFrame(); });
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      state.edgeColor = sw.dataset.color;
      dom.inpEdgeColor.value = state.edgeColor;
      if (state.edgeGlow < 0.15) {
        state.edgeGlow = 0.35;
        dom.rngGlow.value = '0.35';
        dom.valGlow.textContent = '0.35';
      }
      renderFrame();
    });
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      dom.btnPlay.click();
    } else if (e.key === 'f' || e.key === 'F') {
      togglePresent();
    } else if (e.key === 'Escape') {
      togglePresent(false);
    } else if (e.key === 'g' || e.key === 'G') {
      setView(state.view === 'single' ? 'grid' : 'single');
    } else if (e.key === 'r' || e.key === 'R') {
      state.reverse = !state.reverse;
      dom.chkReverse.checked = state.reverse;
      renderFrame();
    } else if (e.key === 'ArrowRight') {
      state.playing = false; updatePlayButton();
      state.rawT = Math.min(1, state.rawT + 0.05); renderFrame();
    } else if (e.key === 'ArrowLeft') {
      state.playing = false; updatePlayButton();
      state.rawT = Math.max(0, state.rawT - 0.05); renderFrame();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildPresetButtons();
buildModeButtons();
setMode(state.mode);
wireEvents();
detectAndLoadCatalog();
requestAnimationFrame(tick);
