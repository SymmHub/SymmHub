import {
    Group_WP,
    Group_KLM,
    strToPermutations,
    sidePermutations,
    invertPerm,
    getGroupGeometry,
    getDomainBounds,
    findPlacementTargets,
    pickDefaultTarget,
    evaluateTrajectory,
    sampleTrajectoryPoints,
    evaluateSweepSplane,
} from '../../lib/grouplib/grouplib.js';
import { DataPacking, SPLANE_PLANE, SPLANE_SPHERE } from '../../lib/invlib/invlib.js';
import {
    CrownCalculator,
    packSidePerms,
    transToPackedPerms,
    MAX_COLORS_COUNT,
} from '../../lib/symhublib/modules.js';
import { VERTEX_SRC, FRAGMENT_SRC, MAX_CROWN_COUNT } from './proto_shader.js';

const SPLANE_IDENTITY = 0;

// ---------------------------------------------------------------------------
// Supported Symmetry Groups (from shipped lib/color_groups/)
// ---------------------------------------------------------------------------
const GROUPS = [
    { id: 'wp:*632', label: 'Wallpaper *632 (hexagonal)',   kind: 'wp',  type: '*632', subFile: '../../lib/color_groups/wallpaper/sub_s632.json', viewScale: 1.55 },
    { id: 'wp:632',  label: 'Wallpaper 632 (chiral hex)',   kind: 'wp',  type: '632',  subFile: '../../lib/color_groups/wallpaper/sub_632.json',  viewScale: 1.55 },
    { id: 'wp:*442', label: 'Wallpaper *442 (square)',      kind: 'wp',  type: '*442', subFile: '../../lib/color_groups/wallpaper/sub_s442.json', viewScale: 1.55 },
    { id: 'wp:442',  label: 'Wallpaper 442 (chiral sq)',    kind: 'wp',  type: '442',  subFile: '../../lib/color_groups/wallpaper/sub_442.json',  viewScale: 1.55 },
    { id: 'wp:*333', label: 'Wallpaper *333 (triangular)',  kind: 'wp',  type: '*333', subFile: '../../lib/color_groups/wallpaper/sub_s333.json', viewScale: 1.65 },
    { id: 'wp:*2222',label: 'Wallpaper *2222 (rect)',       kind: 'wp',  type: '*2222',subFile: '../../lib/color_groups/wallpaper/sub_s2222.json',viewScale: 1.55 },
    { id: 'hyp:*237',label: 'Hyperbolic *237 (Poincare)',   kind: 'klm', K: 2, L: 3, M: 7, s: 1, subFile: '../../lib/color_groups/sklm/sub_s237.json', viewScale: 1.08 },
    { id: 'hyp:*238',label: 'Hyperbolic *238 (Poincare)',   kind: 'klm', K: 2, L: 3, M: 8, s: 1, subFile: '../../lib/color_groups/sklm/sub_s238.json', viewScale: 1.08 },
    { id: 'hyp:*245',label: 'Hyperbolic *245 (Poincare)',   kind: 'klm', K: 2, L: 4, M: 5, s: 1, subFile: '../../lib/color_groups/sklm/sub_s245.json', viewScale: 1.08 },
    { id: 'sph:*235',label: 'Spherical *532 (icosahedral)', kind: 'klm', K: 2, L: 3, M: 5, s: 1, subFile: '../../lib/color_groups/sklm/sub_s235.json', viewScale: 1.45 },
    { id: 'sph:*234',label: 'Spherical *432 (octahedral)',  kind: 'klm', K: 2, L: 3, M: 4, s: 1, subFile: '../../lib/color_groups/sklm/sub_s234.json', viewScale: 1.45 },
];

// ---------------------------------------------------------------------------
// Transition Modes
// ---------------------------------------------------------------------------
const MODES = [
    { id: 0, title: 'World Curtain Split', sub: 'Vertical / angled / geodesic split between placements OR between 2 layers (e.g. cosets vs orbits).' },
    { id: 1, title: 'Solution 1 — Domain SPlane', sub: 'Animated line or circle inside the fundamental domain splits every tile into placement 1 & placement 2.' },
    { id: 2, title: 'Solution 1 — Shape SPlane', sub: 'Animated line or circle inside each motif splits every shape/sprite into placement 1 & placement 2.' },
    { id: 3, title: 'Solution 2 — Shape Trajectory', sub: 'Motif center glides continuously from A in D₀ to h(A) along an exact geodesic or orbital arc.' },
    { id: 4, title: 'Hybrid (S1 Tiles + S2 Shapes)', sub: 'Background tiles morph via Domain SPlane while colored shapes glide continuously via Trajectory.' },
];

// ---------------------------------------------------------------------------
// Curated 1-Click Live Prototype Experiments
// ---------------------------------------------------------------------------
const PRESETS = [
    {
        id: 'circles-s632',
        title: '*632 Moving Colored Circles',
        sub: 'Solution 2: circles orbit smoothly 0 → 1 → 2 → 0 (re-anchored)',
        tag: 'Sol 2',
        groupId: 'wp:*632', subgroup: '*632.3.2',
        mode: 3, motif: 0, motifSize: 0.92, motifColorMode: 0,
        showTiles: false, showGrid: true,
        p1: 0, p2: 1, playback: 'cycle', pathType: 'geodesic',
        palette: 'vibrant',
    },
    {
        id: 'splane-fd-s632',
        title: '*632 Domain SPlane Mix',
        sub: 'Solution 1: circle/line splits every fundamental domain (p0 ↔ p1)',
        tag: 'Sol 1',
        groupId: 'wp:*632', subgroup: '*632.3.2',
        mode: 1, motif: 3, motifSize: 0.72, motifColorMode: 1,
        showTiles: true, showGrid: true,
        p1: 0, p2: 1, splaneKind: 'circle', playback: 'pingpong',
        palette: 'earth',
    },
    {
        id: 'splane-shape-s632',
        title: '*632 Shape-Local SPlane Mix',
        sub: 'Solution 1: each colored star/disk splits into p0 inside & p1 outside',
        tag: 'Sol 1',
        groupId: 'wp:*632', subgroup: '*632.3.2',
        mode: 2, motif: 2, motifSize: 1.05, motifColorMode: 0,
        showTiles: false, showGrid: true,
        p1: 0, p2: 1, splaneKind: 'line', splaneAngle: 35, playback: 'pingpong',
        palette: 'vibrant',
    },
    {
        id: 'curtain-coset-orbit',
        title: '*632 Curtain: Cosets | Orbits',
        sub: '2-layer animated vertical curtain comparing Cosets (L) vs Orbits (R)',
        tag: 'Curtain',
        groupId: 'wp:*632', subgroup: '*632.3.2',
        mode: 0, dualLayer: true, orbitA: false, orbitB: true, subgroupB: '*632.3.2',
        motif: 3, motifSize: 0.72, motifColorMode: 1,
        showTiles: true, showGrid: true,
        p1: 0, p2: 1, pB: 0, splaneKind: 'line', splaneAngle: 0,
        easing: 'midpause', playback: 'pingpong',
        palette: 'earth',
    },
    {
        id: 'commas-direct-s632',
        title: '*632 Asymmetric Commas (Direct G⁺)',
        sub: 'Solution 2: orbital rotation arc matches rotation with no flip',
        tag: 'Sol 2',
        groupId: 'wp:*632', subgroup: '*632.3.2',
        mode: 3, motif: 4, motifSize: 0.90, motifColorMode: 0,
        showTiles: false, showGrid: true,
        p1: 0, p2: 1, playback: 'cycle', pathType: 'arc', matchRot: true,
        palette: 'vibrant',
    },
    {
        id: 'hyp-237-traj',
        title: '*237 Hyperbolic Circles',
        sub: 'Solution 2: exact hyperbolic geodesic + metric scaling in Poincare disk',
        tag: 'Hyp',
        groupId: 'hyp:*237', subgroup: '*237.8.1',
        mode: 3, motif: 0, motifSize: 0.95, motifColorMode: 0,
        showTiles: false, showGrid: true,
        p1: 0, p2: 3, playback: 'pingpong', pathType: 'geodesic',
        palette: 'jewel',
    },
    {
        id: 'hyp-237-curtain',
        title: '*237 Hyperbolic Geodesic Curtain',
        sub: 'Exact Poincare-disk orthogonal geodesic sweeping Cosets | Orbits',
        tag: 'Hyp',
        groupId: 'hyp:*237', subgroup: '*237.8.1',
        mode: 0, dualLayer: true, orbitA: false, orbitB: true, subgroupB: '*237.8.1',
        motif: 3, motifSize: 0.72, motifColorMode: 1,
        showTiles: true, showGrid: true,
        p1: 0, p2: 1, pB: 0, splaneKind: 'geodesic', splaneAngle: 0,
        easing: 'midpause', playback: 'pingpong',
        palette: 'jewel',
    },
    {
        id: 'sph-235-traj',
        title: '*532 Spherical Trajectory',
        sub: 'Solution 2: spherical geodesic motion on stereographic icosahedron',
        tag: 'Sphere',
        groupId: 'sph:*235', subgroup: '*235.5.1',
        mode: 3, motif: 0, motifSize: 0.95, motifColorMode: 0,
        showTiles: false, showGrid: true,
        p1: 0, p2: 2, playback: 'cycle', pathType: 'geodesic',
        palette: 'vibrant',
    },
];

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
const PALETTES = {
    vibrant: [
        '#f4c95d', '#e86f52', '#3da5d9', '#49be8a', '#b17be8', '#f28eb2',
        '#72d6c9', '#f79d42', '#6c8ef5', '#a6d96a', '#e05a7a', '#4fc3f7',
        '#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#c77dff', '#ff9f1c',
        '#8ac926', '#1982c4', '#ff595e', '#6a4c93', '#2ec4b6', '#e71d36',
    ],
    earth: [
        '#fce3a5', '#cd8238', '#622001', '#9e4e1c', '#e6b76c', '#3d1504',
        '#7d9471', '#46647d', '#c4634b', '#d9c29c', '#5e4534', '#8f7254',
        '#a8c090', '#607d8b', '#b85c38', '#e0c097', '#4a3728', '#8c5a3c',
        '#c2956e', '#3c4f65', '#7e6353', '#d4a373', '#2f3e46', '#9c6644',
    ],
    jewel: [
        '#f2d388', '#c95d63', '#496ddb', '#2a9d8f', '#9b5de5', '#f15bb5',
        '#00bbf9', '#e76f51', '#70c1b3', '#e9c46a', '#5e60ce', '#ff758f',
        '#4ea8de', '#80ed99', '#f4a261', '#7209b7', '#3a86ff', '#fb5607',
        '#ffbe0b', '#06d6a0', '#ef476f', '#8338ec', '#48bfe3', '#ff006e',
    ],
};

function hexToRgba01(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [1, 1, 1, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1];
}

function buildPaletteArray(name) {
    const src = PALETTES[name] || PALETTES.vibrant;
    const out = new Float32Array(MAX_COLORS_COUNT * 4);
    for (let i = 0; i < MAX_COLORS_COUNT; i++) {
        const c = hexToRgba01(src[i % src.length]);
        out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 1;
    }
    return out;
}

function applyEasing(t, kind) {
    t = Math.max(0, Math.min(1, t));
    if (kind === 'linear') return t;
    if (kind === 'smooth') return t * t * (3 - 2 * t);
    if (kind === 'cubic')  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (kind === 'midpause') {
        if (t < 0.34) { const u = t / 0.34; return 0.5 * u * u * (3 - 2 * u); }
        if (t < 0.66) return 0.5;
        const u = (t - 0.66) / 0.34;
        return 0.5 + 0.5 * u * u * (3 - 2 * u);
    }
    return t;
}

// ---------------------------------------------------------------------------
// DOM Refs
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const dom = {
    glCanvas:        $('glCanvas'),
    overlayCanvas:   $('overlayCanvas'),
    canvasFrame:     $('canvasFrame'),
    geomBadge:       $('geomBadge'),
    stageCaption:    $('stageCaption'),
    capText:         $('capText'),
    stageHint:       $('stageHint'),
    presetList:      $('presetList'),
    selGroup:        $('selGroup'),
    selSubgroupA:    $('selSubgroupA'),
    chkOrbitA:       $('chkOrbitA'),
    selPlace1:       $('selPlace1'),
    selPlace2:       $('selPlace2'),
    btnSwapPlace:    $('btnSwapPlace'),
    paletteStrip:    $('paletteStrip'),
    selPalette:      $('selPalette'),
    secLayerB:       $('secLayerB'),
    chkDualLayer:    $('chkDualLayer'),
    dualLayerFields: $('dualLayerFields'),
    selSubgroupB:    $('selSubgroupB'),
    selPlaceB:       $('selPlaceB'),
    chkOrbitB:       $('chkOrbitB'),
    selMotif:        $('selMotif'),
    rngMotifSize:    $('rngMotifSize'),
    valMotifSize:    $('valMotifSize'),
    selMotifColorMode:$('selMotifColorMode'),
    chkTiles:        $('chkTiles'),
    chkGrid:         $('chkGrid'),
    chkGuides:       $('chkGuides'),
    modeList:        $('modeList'),
    secSplane:       $('secSplane'),
    selSplaneKind:   $('selSplaneKind'),
    rngSplaneAngle:  $('rngSplaneAngle'),
    valSplaneAngle:  $('valSplaneAngle'),
    rngSplaneBlur:   $('rngSplaneBlur'),
    valSplaneBlur:   $('valSplaneBlur'),
    chkSplaneInvert: $('chkSplaneInvert'),
    chkCutLine:      $('chkCutLine'),
    secTraj:         $('secTraj'),
    selPathType:     $('selPathType'),
    chkPreferDirect: $('chkPreferDirect'),
    chkMatchRot:     $('chkMatchRot'),
    candCount:       $('candCount'),
    candInfo:        $('candInfo'),
    candList:        $('candList'),
    rngScrub:        $('rngScrub'),
    lblFrom:         $('lblFrom'),
    lblTo:           $('lblTo'),
    lblT:            $('lblT'),
    btnPlay:         $('btnPlay'),
    btnZero:         $('btnZero'),
    btnMid:          $('btnMid'),
    btnOne:          $('btnOne'),
    selPlayback:     $('selPlayback'),
    selEasing:       $('selEasing'),
    chkCaption:      $('chkCaption'),
    rngDur:          $('rngDur'),
    valDur:          $('valDur'),
    rngHold:         $('rngHold'),
    valHold:         $('valHold'),
    btnResetView:    $('btnResetView'),
    btnSnapshot:     $('btnSnapshot'),
    btnRecord:       $('btnRecord'),
    btnPresent:      $('btnPresent'),
    btnExitPresent:  $('btnExitPresent'),
    toast:           $('toast'),
};

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------
const state = {
    subgroupCache: new Map(), // subFile -> subgroups[]
    groupDef: GROUPS[0],
    group: null,
    geom: { kind: 'euclidean' },
    bounds: null,
    subgroups: [],

    // Layer A
    subA: null,
    genPermsA: [],
    sidePermsA: [],
    invSidePermsA: [],
    packedSidePermsA: packSidePerms([]),
    permSizeA: 1,
    useOrbitA: false,
    p1: 0,
    p2: 1,

    // Layer B (for 2-layer Curtain Split)
    dualLayer: false,
    subB: null,
    genPermsB: [],
    sidePermsB: [],
    invSidePermsB: [],
    packedSidePermsB: packSidePerms([]),
    permSizeB: 1,
    useOrbitB: true,
    pB: 0,

    // Camera
    viewCenter: [0, 0],
    viewScale: 1.55,

    // Motif & visual appearance
    palette: 'vibrant',
    paletteData: buildPaletteArray('vibrant'),
    motifType: 0,
    motifSizeFrac: 0.92,     // relative to domain inradius
    motifColorMode: 0,       // 0 = colored motif, 1 = black ink motif
    showTiles: false,
    showGrid: true,
    showGuides: true,
    showCaption: true,

    // Mode & SPlane
    mode: 3,                 // 0=Curtain, 1=FD SPlane, 2=Shape SPlane, 3=Trajectory, 4=Hybrid
    splaneKind: 'line',      // 'line' | 'circle' | 'geodesic'
    splaneAngleDeg: 0,
    splaneBlur: 0.0,
    splaneInvert: false,
    showCutLine: true,

    // Trajectory (Solution 2)
    startPoint: [0, 0],      // draggable anchor A inside D_0
    candidates: [],
    activeCandIdx: 0,
    pathType: 'geodesic',    // 'geodesic' | 'arc'
    preferDirect: true,
    matchRot: true,

    // Crown cache
    crownKey: '',
    crownCount: 0,
    crownPermDataA: new Uint32Array(MAX_CROWN_COUNT * 4),
    crownPermDataB: new Uint32Array(MAX_CROWN_COUNT * 4),

    // Animation
    playing: true,
    rawT: 0,
    dir: 1,
    duration: 2.4,
    hold: 0.8,
    holdTimer: 0.5,
    easing: 'cubic',
    playback: 'cycle',
    lastTime: 0,

    // Recording
    recording: false,
    recorder: null,
    recordChunks: [],
    recordCanvas: null,
    recordCtx: null,
    recordStartP1: 0,
};

let toastTimer = null;
function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ---------------------------------------------------------------------------
// WebGL2 Setup
// ---------------------------------------------------------------------------
const gl = dom.glCanvas.getContext('webgl2', {
    antialias: true,
    preserveDrawingBuffer: true,
});
if (!gl) throw new Error('WebGL2 required');

function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        console.error(log);
        throw new Error(log);
    }
    return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, VERTEX_SRC));
gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SRC));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog));
}
const vao = gl.createVertexArray();

const U = {};
for (const name of [
    'uViewCenter', 'uViewScale', 'uResolution', 'uIterations',
    'uIsHyperbolic', 'uDiskCenter', 'uDiskRadius',
    'uGroupData', 'uPermDataA', 'uPermSizeA', 'uUseOrbitA', 'uPlacement1', 'uPlacement2',
    'uDualLayer', 'uPermDataB', 'uPermSizeB', 'uUseOrbitB', 'uPlacementB',
    'uCrownData', 'uCrownPermDataA', 'uCrownPermDataB', 'uCrownCount',
    'uPalette', 'uBgColor', 'uShowTiles', 'uTileOpacity', 'uShowGrid', 'uGridOpacity',
    'uShowMotif', 'uMotifType', 'uMotifCenter', 'uMotifRadius', 'uMotifAngle', 'uMotifColorMode',
    'uMode', 'uMixSplaneType', 'uMixSplaneData', 'uMixBlur', 'uMixInvert', 'uShowCutLine', 'uCutLineColor',
    'uAnchorEnabled',
]) {
    U[name] = gl.getUniformLocation(prog, name);
}

const groupDataTex = DataPacking.createGroupDataSampler(gl);
const crownDataTex = DataPacking.createGroupDataSampler(gl);

// ---------------------------------------------------------------------------
// Coordinate Conversions (World <-> Overlay Canvas Pixels)
// ---------------------------------------------------------------------------
function worldToCanvas(wx, wy) {
    const w = dom.overlayCanvas.width;
    const h = dom.overlayCanvas.height;
    const aspect = w / h;
    const nx = (wx - state.viewCenter[0]) / (state.viewScale * aspect);
    const ny = (wy - state.viewCenter[1]) / state.viewScale;
    return [(nx * 0.5 + 0.5) * w, (0.5 - ny * 0.5) * h];
}

function canvasToWorld(px, py) {
    const rect = dom.overlayCanvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const nx = ((px - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((py - rect.top) / rect.height) * 2;
    return [
        state.viewCenter[0] + nx * state.viewScale * aspect,
        state.viewCenter[1] + ny * state.viewScale,
    ];
}

// ---------------------------------------------------------------------------
// Group, Subgroup, and Trajectory Management
// ---------------------------------------------------------------------------
async function fetchSubgroups(subFile) {
    if (state.subgroupCache.has(subFile)) return state.subgroupCache.get(subFile);
    const resp = await fetch(subFile);
    if (!resp.ok) throw new Error('Could not load ' + subFile);
    const json = await resp.json();
    const list = (json.subgroups || []).filter(s => s.index >= 2 && s.index <= MAX_COLORS_COUNT);
    state.subgroupCache.set(subFile, list);
    return list;
}

function makeGroupInstance(def) {
    if (def.kind === 'wp') {
        return new Group_WP({ type: def.type }).getGroup();
    }
    return new Group_KLM({ K: def.K, L: def.L, M: def.M, s: def.s }).getGroup();
}

async function selectGroup(groupId, preferredSubgroup) {
    const def = GROUPS.find(g => g.id === groupId) || GROUPS[0];
    state.groupDef = def;
    dom.selGroup.value = def.id;

    state.group = makeGroupInstance(def);
    state.geom = getGroupGeometry(state.group);
    state.bounds = getDomainBounds(state.group);
    state.startPoint = state.bounds.incenter.slice();

    // Center view cleanly on the domain / disk
    if (state.geom.kind === 'hyperbolic') {
        state.viewCenter = state.geom.c.slice();
        state.viewScale = state.geom.r * 1.07;
    } else if (state.geom.kind === 'spherical') {
        state.viewCenter = state.geom.c.slice();
        state.viewScale = state.geom.R * 1.45;
    } else {
        state.viewCenter = state.bounds.center.slice();
        state.viewScale = def.viewScale || 1.55;
    }

    dom.geomBadge.textContent = `${state.geom.kind} · D₀ r=${state.bounds.inradius.toFixed(2)}`;
    dom.geomBadge.className = 'badge ok';

    DataPacking.packGroupToSampler(gl, groupDataTex, state.group);
    state.crownKey = '';

    const subs = await fetchSubgroups(def.subFile);
    state.subgroups = subs;

    const fillSubSelect = (sel) => {
        sel.innerHTML = '';
        for (const s of subs) {
            const opt = document.createElement('option');
            opt.value = s.subgroup;
            opt.textContent = `${s.subgroup}  (${s.index} colors)`;
            sel.appendChild(opt);
        }
    };
    fillSubSelect(dom.selSubgroupA);
    fillSubSelect(dom.selSubgroupB);

    const pickA = (preferredSubgroup && subs.some(s => s.subgroup === preferredSubgroup))
        ? preferredSubgroup
        : (subs.find(s => s.index === 3 || s.index === 4 || s.index === 5)?.subgroup || subs[0]?.subgroup);
    selectSubgroupA(pickA);
    selectSubgroupB(pickA);
}

function selectSubgroupA(subId) {
    const entry = state.subgroups.find(s => s.subgroup === subId) || state.subgroups[0];
    if (!entry) return;
    state.subA = entry;
    dom.selSubgroupA.value = entry.subgroup;
    state.genPermsA = strToPermutations(entry.invcos);
    state.permSizeA = state.genPermsA[0]?.length || 1;
    rebuildSidePermsA();

    // Populate Placement 1 & 2 selectors
    const fillPlace = (sel, val) => {
        sel.innerHTML = '';
        for (let i = 0; i < state.permSizeA; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Placement ${i}`;
            sel.appendChild(opt);
        }
        sel.value = String(val % state.permSizeA);
    };
    state.p1 = state.p1 % state.permSizeA;
    state.p2 = (state.p2 % state.permSizeA);
    if (state.p1 === state.p2 && state.permSizeA > 1) state.p2 = (state.p1 + 1) % state.permSizeA;
    fillPlace(dom.selPlace1, state.p1);
    fillPlace(dom.selPlace2, state.p2);

    renderPaletteStrip();
    recomputeTrajectories();
}

function rebuildSidePermsA() {
    state.sidePermsA = sidePermutations(state.group, state.genPermsA, state.useOrbitA);
    state.invSidePermsA = state.sidePermsA.map(invertPerm);
    state.packedSidePermsA = packSidePerms(state.sidePermsA);
    state.crownKey = '';
}

function selectSubgroupB(subId) {
    const entry = state.subgroups.find(s => s.subgroup === subId) || state.subgroups[0];
    if (!entry) return;
    state.subB = entry;
    dom.selSubgroupB.value = entry.subgroup;
    state.genPermsB = strToPermutations(entry.invcos);
    state.permSizeB = state.genPermsB[0]?.length || 1;
    rebuildSidePermsB();

    dom.selPlaceB.innerHTML = '';
    for (let i = 0; i < state.permSizeB; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Placement ${i}`;
        dom.selPlaceB.appendChild(opt);
    }
    state.pB = state.pB % state.permSizeB;
    dom.selPlaceB.value = String(state.pB);
}

function rebuildSidePermsB() {
    state.sidePermsB = sidePermutations(state.group, state.genPermsB, state.useOrbitB);
    state.invSidePermsB = state.sidePermsB.map(invertPerm);
    state.packedSidePermsB = packSidePerms(state.sidePermsB);
    state.crownKey = '';
}

function renderPaletteStrip() {
    const colors = PALETTES[state.palette] || PALETTES.vibrant;
    dom.paletteStrip.innerHTML = '';
    for (let i = 0; i < state.permSizeA; i++) {
        const d = document.createElement('div');
        d.className = 'palette-chip'
            + (i === state.p1 ? ' p1' : '')
            + (i === state.p2 ? ' p2' : '');
        d.style.background = colors[i % colors.length];
        d.title = `Slot ${i}`;
        dom.paletteStrip.appendChild(d);
    }
}

function recomputeTrajectories(keepWord = null) {
    if (!state.group || !state.genPermsA.length) return;
    const cands = findPlacementTargets({
        group: state.group,
        generatorPerms: state.genPermsA,
        useOrbit: state.useOrbitA,
        fromPlacement: state.p1,
        toPlacement: state.p2,
        startPoint: state.startPoint,
        geometry: state.geom,
        maxTiles: 420,
        maxCandidates: 12,
    });
    state.candidates = cands;

    let idx = 0;
    if (keepWord) {
        const found = cands.findIndex(c => c.word === keepWord);
        if (found >= 0) idx = found;
        else {
            const def = pickDefaultTarget(cands, state.preferDirect);
            idx = Math.max(0, cands.indexOf(def));
        }
    } else {
        const def = pickDefaultTarget(cands, state.preferDirect);
        idx = Math.max(0, cands.indexOf(def));
    }
    state.activeCandIdx = idx;
    renderCandidateList();
    updateLabels();
}

function getActiveCandidate() {
    return state.candidates[state.activeCandIdx] || null;
}

function renderCandidateList() {
    const cands = state.candidates;
    dom.candCount.textContent = String(cands.length);
    dom.candList.innerHTML = '';

    const active = getActiveCandidate();
    if (active) {
        const degVal = active.endAngle * 180 / Math.PI;
        const degStr = `${degVal >= 0 ? '+' : ''}${degVal.toFixed(1)}°`;
        const arcTxt = active.rotationCenter ? ` · rotArc ${(active.rotationAngle * 180 / Math.PI).toFixed(0)}°` : '';
        dom.candInfo.textContent =
            `Active h="${active.word || 'id'}" · d=${active.distance.toFixed(3)} · ` +
            `${active.orientationPreserving ? `direct (${degStr})` : 'reflection (no flip)'}${arcTxt}`;
    } else {
        dom.candInfo.textContent = 'No target found for this placement pair.';
    }

    cands.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cand-item' + (i === state.activeCandIdx ? ' active' : '');
        const tagCls = c.orientationPreserving ? 'direct' : 'reflect';
        const tagLbl = c.orientationPreserving ? (c.rotationCenter ? 'G⁺ arc' : 'G⁺') : 'G⁻ ref';
        btn.innerHTML = `<span>#${i + 1} <b>${c.word || 'id'}</b> (d=${c.distance.toFixed(2)})</span><span class="cand-tag ${tagCls}">${tagLbl}</span>`;
        btn.addEventListener('click', () => {
            state.activeCandIdx = i;
            renderCandidateList();
            renderFrame();
        });
        dom.candList.appendChild(btn);
    });
}

function updateLabels() {
    const subName = state.subA ? state.subA.subgroup : '';
    const modeInfo = MODES.find(m => m.id === state.mode);
    if (state.mode === 0 && state.dualLayer) {
        const aLbl = `${subName} p${state.p1}${state.useOrbitA ? ' (orbits)' : ' (cosets)'}`;
        const bLbl = `${state.subB?.subgroup || subName} p${state.pB}${state.useOrbitB ? ' (orbits)' : ' (cosets)'}`;
        dom.lblFrom.textContent = aLbl;
        dom.lblTo.textContent = bLbl;
        dom.capText.textContent = `${aLbl}  |  ${bLbl}   —   Curtain Split`;
    } else {
        dom.lblFrom.textContent = `Placement ${state.p1}`;
        dom.lblTo.textContent = `Placement ${state.p2}`;
        dom.capText.textContent = `${subName} · Placement ${state.p1} → ${state.p2}   |   ${modeInfo?.title || ''}`;
    }
}

// ---------------------------------------------------------------------------
// Crown Packing for Current Motif Pose
// ---------------------------------------------------------------------------
function ensureCrownForPose(cx, cy, radius) {
    const qx = Math.round(cx * 80);
    const qy = Math.round(cy * 80);
    const qr = Math.round(radius * 80);
    const key = `${qx},${qy},${qr},${state.useOrbitA ? 1 : 0},${state.useOrbitB ? 1 : 0},${state.dualLayer ? 1 : 0}`;
    if (key === state.crownKey) return;
    state.crownKey = key;

    const revTrans = CrownCalculator.calculate(
        state.group,
        { centerX: cx, centerY: cy, scale: Math.max(0.02, radius * 1.15), angle: 0 },
        { gridRadius: 5, maxCount: MAX_CROWN_COUNT }
    );
    const count = Math.min(revTrans.length, MAX_CROWN_COUNT);
    const dirTrans = revTrans.slice(0, count).reverse().map(tr => tr.getInverse());

    DataPacking.packGroupToSampler(gl, crownDataTex, {
        s: state.group.getFundDomain(),
        t: dirTrans,
    });

    const sideNames = state.group.getGenNames ? state.group.getGenNames() : state.group.genNames;
    const packedA = transToPackedPerms(dirTrans, state.sidePermsA, state.invSidePermsA, state.useOrbitA, sideNames);
    state.crownPermDataA.fill(0);
    state.crownPermDataA.set(packedA.subarray(0, Math.min(packedA.length, state.crownPermDataA.length)));

    if (state.dualLayer) {
        const packedB = transToPackedPerms(dirTrans, state.sidePermsB, state.invSidePermsB, state.useOrbitB, sideNames);
        state.crownPermDataB.fill(0);
        state.crownPermDataB.set(packedB.subarray(0, Math.min(packedB.length, state.crownPermDataB.length)));
    }
    state.crownCount = count;
}

// ---------------------------------------------------------------------------
// SPlane Computation for Curtain Split & Solution 1
// ---------------------------------------------------------------------------
function computeActiveSplane(easedT) {
    const angleRad = (state.splaneAngleDeg * Math.PI) / 180;

    // Mode 0: World Curtain Split (line, circle, or exact hyperbolic geodesic!)
    if (state.mode === 0) {
        if (state.splaneKind === 'geodesic' && state.geom.kind === 'hyperbolic') {
            const c = state.geom.c;
            const R = state.geom.r;
            // Parameter a in (-0.995, +0.995) sweeps geodesic across the Poincare disk
            if (easedT <= 0.0005) return { type: SPLANE_IDENTITY, data: [0, 0, 0, 0], kind: 'geodesic' };
            if (easedT >= 0.9995) return { type: SPLANE_PLANE, data: [1, 0, 0, 1e4], kind: 'geodesic' };
            const a = (easedT * 2 - 1) * 0.992;
            const nx = Math.cos(angleRad);
            const ny = Math.sin(angleRad);
            if (Math.abs(a) < 1e-3) {
                return { type: SPLANE_PLANE, data: [nx, ny, 0, nx * c[0] + ny * c[1]], kind: 'geodesic' };
            }
            // Orthogonal circle to |z - c| = R passing through c + a R (nx, ny):
            // center = c + ((1 + a^2)/(2a)) R (nx, ny), radius = ((1 - a^2)/(2|a|)) R
            // Signed radius: positive when a < 0 (left side is inside), negative when a > 0 (left side is outside!)
            const sc = ((1 + a * a) / (2 * a)) * R;
            const sr = ((1 - a * a) / (2 * Math.abs(a))) * R * (a < 0 ? 1 : -1);
            return {
                type: SPLANE_SPHERE,
                data: [c[0] + sc * nx, c[1] + sc * ny, 0, sr],
                kind: 'geodesic',
            };
        }
        const half = state.geom.kind === 'hyperbolic' ? state.geom.r * 1.02 : state.viewScale * 1.02;
        const cx = state.viewCenter[0], cy = state.viewCenter[1];
        return evaluateSweepSplane(easedT, {
            splaneKind: state.splaneKind === 'circle' ? 'circle' : 'line',
            angleRad,
            bounds: { box: [cx - half, cy - half, cx + half, cy + half], incenter: [cx, cy], radius: half * 1.42 },
            margin: half * 0.04,
        });
    }

    // Mode 2: Shape-Local SPlane Mix in normalized motif coordinates [-1, 1]^2
    if (state.mode === 2) {
        return evaluateSweepSplane(easedT, {
            splaneKind: state.splaneKind === 'circle' ? 'circle' : 'line',
            angleRad,
            bounds: { box: [-0.95, -0.95, 0.95, 0.95], incenter: [0, 0], radius: 1.05 },
            margin: 0.05,
        });
    }

    // Mode 1 & Mode 4: Domain SPlane Mix across fundamental domain D_0
    return evaluateSweepSplane(easedT, {
        splaneKind: state.splaneKind === 'circle' ? 'circle' : 'line',
        angleRad,
        bounds: state.bounds,
        centerOverride: state.startPoint,
        margin: Math.max(0.01, state.bounds.inradius * 0.12),
    });
}

// ---------------------------------------------------------------------------
// Main Render Frame (WebGL2 + Interactive 2D Guides Overlay)
// ---------------------------------------------------------------------------
function renderFrame(overrideRawT) {
    if (!state.group || !state.bounds) return;
    const rawT = typeof overrideRawT === 'number' ? overrideRawT : state.rawT;
    const easedT = applyEasing(rawT, state.easing);

    // Base motif pose inside D_0
    const baseRadius = Math.max(0.02, state.bounds.inradius * state.motifSizeFrac);
    let motifCenter = state.startPoint;
    let motifRadius = baseRadius;
    let motifAngle = 0;

    const activeCand = getActiveCandidate();
    if ((state.mode === 3 || state.mode === 4) && activeCand) {
        const pose = evaluateTrajectory(state.geom, activeCand, easedT, {
            pathType: state.pathType,
            matchRotation: state.matchRot,
        });
        motifCenter = pose.point;
        motifRadius = baseRadius * pose.scale;
        motifAngle = pose.angle;
    }

    // Update crown tiles around active motif pose
    ensureCrownForPose(motifCenter[0], motifCenter[1], motifRadius);

    // Compute SPlane (for Curtain Split, Solution 1, and Hybrid)
    const sp = computeActiveSplane(easedT);

    const W = dom.glCanvas.width;
    const H = dom.glCanvas.height;
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, groupDataTex); gl.uniform1i(U.uGroupData, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, crownDataTex); gl.uniform1i(U.uCrownData, 1);

    gl.uniform2f(U.uViewCenter, state.viewCenter[0], state.viewCenter[1]);
    gl.uniform1f(U.uViewScale, state.viewScale);
    gl.uniform2f(U.uResolution, W, H);
    gl.uniform1i(U.uIterations, state.geom.kind === 'hyperbolic' ? 48 : 30);
    gl.uniform1i(U.uAnchorEnabled, 0);

    const isHyp = state.geom.kind === 'hyperbolic';
    gl.uniform1i(U.uIsHyperbolic, isHyp ? 1 : 0);
    gl.uniform2f(U.uDiskCenter, isHyp ? state.geom.c[0] : 0, isHyp ? state.geom.c[1] : 0);
    gl.uniform1f(U.uDiskRadius, isHyp ? state.geom.r : 1);

    gl.uniform4uiv(U.uPermDataA, state.packedSidePermsA);
    gl.uniform1ui(U.uPermSizeA, state.permSizeA);
    gl.uniform1i(U.uUseOrbitA, state.useOrbitA ? 1 : 0);
    gl.uniform1ui(U.uPlacement1, state.p1);
    gl.uniform1ui(U.uPlacement2, state.p2);

    gl.uniform1i(U.uDualLayer, state.dualLayer ? 1 : 0);
    gl.uniform4uiv(U.uPermDataB, state.packedSidePermsB);
    gl.uniform1ui(U.uPermSizeB, state.permSizeB);
    gl.uniform1i(U.uUseOrbitB, state.useOrbitB ? 1 : 0);
    gl.uniform1ui(U.uPlacementB, state.pB);

    gl.uniform4uiv(U.uCrownPermDataA, state.crownPermDataA);
    gl.uniform4uiv(U.uCrownPermDataB, state.crownPermDataB);
    gl.uniform1i(U.uCrownCount, state.crownCount);

    gl.uniform4fv(U.uPalette, state.paletteData);
    gl.uniform3f(U.uBgColor, 0.055, 0.065, 0.085);
    gl.uniform1i(U.uShowTiles, state.showTiles ? 1 : 0);
    gl.uniform1f(U.uTileOpacity, 1.0);
    gl.uniform1i(U.uShowGrid, state.showGrid ? 1 : 0);
    gl.uniform1f(U.uGridOpacity, state.showTiles ? 0.55 : 0.42);

    gl.uniform1i(U.uShowMotif, 1);
    gl.uniform1i(U.uMotifType, state.motifType);
    gl.uniform2f(U.uMotifCenter, motifCenter[0], motifCenter[1]);
    gl.uniform1f(U.uMotifRadius, motifRadius);
    gl.uniform1f(U.uMotifAngle, motifAngle);
    gl.uniform1i(U.uMotifColorMode, state.motifColorMode);

    gl.uniform1i(U.uMode, state.mode);
    gl.uniform1i(U.uMixSplaneType, sp.type);
    gl.uniform4fv(U.uMixSplaneData, sp.data);
    gl.uniform1f(U.uMixBlur, state.splaneBlur);
    gl.uniform1i(U.uMixInvert, state.splaneInvert ? 1 : 0);
    gl.uniform1i(U.uShowCutLine, state.showCutLine ? 1 : 0);
    gl.uniform3f(U.uCutLineColor, 1.0, 0.85, 0.48);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    renderOverlay(motifCenter, activeCand, sp);

    dom.rngScrub.value = rawT.toFixed(3);
    dom.lblT.textContent = `t=${rawT.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// 2D Interactive Guides Overlay (Trajectory Paths, Candidate Dots, SPlane)
// ---------------------------------------------------------------------------
function renderOverlay(currentMotifCenter, activeCand, sp) {
    const ctx = dom.overlayCanvas.getContext('2d');
    const W = dom.overlayCanvas.width;
    const H = dom.overlayCanvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!state.showGuides) return;

    // 1. Solution 2 & Hybrid: draw candidate targets, trajectory curve, cone center, and live dot
    if (state.mode === 3 || state.mode === 4) {
        // Draw active trajectory path
        if (activeCand) {
            const pts = sampleTrajectoryPoints(state.geom, activeCand, 44, {
                pathType: state.pathType,
                matchRotation: state.matchRot,
            });
            ctx.save();
            ctx.beginPath();
            pts.forEach((pt, idx) => {
                const [cx, cy] = worldToCanvas(pt[0], pt[1]);
                if (idx === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            });
            ctx.strokeStyle = 'rgba(255, 224, 130, 0.92)';
            ctx.lineWidth = 2.6;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // If orbital arc, draw rotation cone point O + faint radii
            if (state.pathType === 'arc' && activeCand.rotationCenter) {
                const [ox, oy] = worldToCanvas(activeCand.rotationCenter[0], activeCand.rotationCenter[1]);
                const [ax, ay] = worldToCanvas(activeCand.startPoint[0], activeCand.startPoint[1]);
                const [bx, by] = worldToCanvas(activeCand.targetPoint[0], activeCand.targetPoint[1]);
                ctx.strokeStyle = 'rgba(95, 179, 255, 0.45)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(ox, oy); ctx.lineTo(ax, ay);
                ctx.moveTo(ox, oy); ctx.lineTo(bx, by);
                ctx.stroke();

                ctx.fillStyle = '#5fb3ff';
                ctx.beginPath();
                ctx.arc(ox, oy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#090b10';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw all candidate target points B_k = h_k(A)
        state.candidates.forEach((c, idx) => {
            const [bx, by] = worldToCanvas(c.targetPoint[0], c.targetPoint[1]);
            const isSel = idx === state.activeCandIdx;
            const r = isSel ? 8.5 : 5.5;
            ctx.save();
            ctx.fillStyle = c.orientationPreserving ? '#46c98b' : '#f08c54';
            ctx.strokeStyle = isSel ? '#ffffff' : 'rgba(9, 11, 16, 0.9)';
            ctx.lineWidth = isSel ? 2.5 : 1.5;

            ctx.beginPath();
            if (c.orientationPreserving) {
                ctx.arc(bx, by, r, 0, Math.PI * 2);
            } else {
                // Diamond for orientation-reversing reflection target
                ctx.moveTo(bx, by - r * 1.15);
                ctx.lineTo(bx + r * 1.15, by);
                ctx.lineTo(bx, by + r * 1.15);
                ctx.lineTo(bx - r * 1.15, by);
                ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();

            if (isSel || idx < 6) {
                ctx.font = `${isSel ? '700 ' : ''}11px ui-monospace, Consolas, monospace`;
                ctx.fillStyle = isSel ? '#fff6d6' : 'rgba(232,236,244,0.82)';
                ctx.fillText(c.word || 'id', bx + r + 4, by + 4);
            }
            ctx.restore();
        });

        // Starting anchor A (draggable white circle)
        const [ax, ay] = worldToCanvas(state.startPoint[0], state.startPoint[1]);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#090b10';
        ctx.stroke();
        ctx.font = '700 11px ui-monospace, Consolas, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('A', ax - 16, ay - 9);

        // Live moving dot at gamma(t)
        const [mx, my] = worldToCanvas(currentMotifCenter[0], currentMotifCenter[1]);
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd87a';
        ctx.fill();
        ctx.strokeStyle = '#090b10';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
    }

    // 2. Solution 1 Domain SPlane: highlight the splane guide inside D_0
    if (state.mode === 1 && sp.type !== SPLANE_IDENTITY) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 216, 122, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        if (sp.type === SPLANE_SPHERE) {
            const [cx, cy] = worldToCanvas(sp.data[0], sp.data[1]);
            const pxR = (Math.abs(sp.data[3]) / state.viewScale) * (H * 0.5);
            ctx.beginPath();
            ctx.arc(cx, cy, pxR, 0, Math.PI * 2);
            ctx.stroke();
        } else if (sp.type === SPLANE_PLANE) {
            const nx = sp.data[0], ny = sp.data[1], d = sp.data[3];
            const px = nx * d, py = ny * d;
            const tx = -ny, ty = nx;
            const span = state.viewScale * 2.5;
            const [x1, y1] = worldToCanvas(px - tx * span, py - ty * span);
            const [x2, y2] = worldToCanvas(px + tx * span, py + ty * span);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Animation Loop (with Seamless Re-Anchoring for Solution 2 Cycles!)
// ---------------------------------------------------------------------------
function advancePlacementCycle() {
    const nextP1 = state.p2;
    const nextP2 = (nextP1 + 1) % state.permSizeA;
    state.p1 = nextP1;
    state.p2 = nextP2;
    dom.selPlace1.value = String(state.p1);
    dom.selPlace2.value = String(state.p2);
    renderPaletteStrip();
    recomputeTrajectories();
    state.rawT = 0;
    state.holdTimer = state.hold;

    if (state.recording && state.p1 === state.recordStartP1) {
        stopRecording();
    }
}

function tick(now) {
    requestAnimationFrame(tick);
    if (!state.lastTime) { state.lastTime = now; return; }
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;

    if (state.playing) {
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
                    if (state.recording) {
                        setTimeout(() => { if (state.recording) stopRecording(); }, Math.max(120, state.hold * 1000));
                    }
                } else if (state.rawT <= 0) {
                    state.rawT = 0;
                    state.dir = 1;
                    state.holdTimer = state.hold;
                }
            } else if (state.playback === 'cycle') {
                state.rawT += step;
                if (state.rawT >= 1) {
                    state.rawT = 1;
                    renderFrame();
                    // Seamless re-anchor: (pose = h(A), p1) === (pose = A, p2)!
                    advancePlacementCycle();
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
                    updatePlayBtn();
                    if (state.recording) {
                        setTimeout(() => { if (state.recording) stopRecording(); }, Math.max(120, state.hold * 1000));
                    }
                }
            }
        }
        renderFrame();
    }

    if (state.recording && state.recordCtx) {
        drawCompositeExport(state.recordCtx, state.recordCanvas.width, state.recordCanvas.height);
    }
}

// ---------------------------------------------------------------------------
// Export: PNG Snapshot & WebM Recorder
// ---------------------------------------------------------------------------
function drawCompositeExport(ctx, w, h) {
    ctx.drawImage(dom.glCanvas, 0, 0, w, h);
    if (state.showGuides) ctx.drawImage(dom.overlayCanvas, 0, 0, w, h);
    if (state.showCaption) {
        const txt = dom.capText.textContent || '';
        ctx.save();
        ctx.font = `600 ${Math.round(w * 0.018)}px ui-monospace, Consolas, monospace`;
        const m = ctx.measureText(txt);
        const bw = m.width + 28, bh = Math.round(w * 0.018) + 14;
        const bx = (w - bw) / 2, by = h - bh - 14;
        ctx.fillStyle = 'rgba(11, 14, 20, 0.82)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
        ctx.fillStyle = '#f3f6fc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, w / 2, by + bh / 2 + 1);
        ctx.restore();
    }
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportPng() {
    renderFrame();
    const c = document.createElement('canvas');
    c.width = dom.glCanvas.width;
    c.height = dom.glCanvas.height;
    drawCompositeExport(c.getContext('2d'), c.width, c.height);
    c.toBlob(b => {
        downloadBlob(b, `placement_mode${state.mode}_${state.subA?.subgroup || 'sym'}.png`);
        showToast('Saved PNG frame');
    }, 'image/png');
}

function toggleRecording() {
    if (state.recording) { stopRecording(); return; }
    if (typeof MediaRecorder === 'undefined') { showToast('MediaRecorder unavailable'); return; }

    const c = document.createElement('canvas');
    c.width = dom.glCanvas.width;
    c.height = dom.glCanvas.height;
    state.recordCanvas = c;
    state.recordCtx = c.getContext('2d');

    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(c.captureStream(60), {
        mimeType: mime || undefined,
        videoBitsPerSecond: 12_000_000,
    });
    state.recordChunks = [];
    rec.ondataavailable = e => { if (e.data?.size) state.recordChunks.push(e.data); };
    rec.onstop = () => {
        const blob = new Blob(state.recordChunks, { type: mime || 'video/webm' });
        downloadBlob(blob, `placement_mode${state.mode}_${state.subA?.subgroup || 'sym'}.webm`);
        showToast(`Saved WebM (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    };

    state.recorder = rec;
    state.recording = true;
    state.recordStartP1 = state.p1;
    dom.btnRecord.textContent = '■ Stop Rec';
    dom.btnRecord.classList.add('recording');

    state.rawT = 0;
    state.dir = 1;
    state.holdTimer = Math.min(0.6, state.hold);
    state.playing = true;
    updatePlayBtn();
    renderFrame();
    drawCompositeExport(state.recordCtx, c.width, c.height);
    rec.start(100);
    showToast('Recording WebM… auto-stops after cycle');
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
// UI Wiring & Presets
// ---------------------------------------------------------------------------
function setMode(modeId) {
    state.mode = modeId;
    document.querySelectorAll('[data-quick-mode]').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.quickMode) === modeId);
    });
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.modeId) === modeId);
    });

    dom.secLayerB.classList.toggle('hidden', modeId !== 0);
    dom.secSplane.classList.toggle('hidden', modeId === 3);
    dom.secTraj.classList.toggle('hidden', modeId < 3);

    dom.stageHint.textContent = (modeId >= 3)
        ? 'Drag white dot A to move motif · Click green (G⁺) or amber (G⁻) target dot · Scroll zoom · Shift+drag pan'
        : 'Scroll zoom · Drag to pan · Double-click to reset view';

    updateLabels();
    renderFrame();
}

function updatePlayBtn() {
    dom.btnPlay.textContent = state.playing ? '❚❚ Pause' : '▶ Play';
}

async function applyPreset(p) {
    document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.presetId === p.id);
    });

    await selectGroup(p.groupId, p.subgroup);

    state.useOrbitA = !!p.orbitA;
    dom.chkOrbitA.checked = state.useOrbitA;
    rebuildSidePermsA();

    state.dualLayer = !!p.dualLayer;
    dom.chkDualLayer.checked = state.dualLayer;
    dom.dualLayerFields.classList.toggle('hidden', !state.dualLayer);
    if (p.subgroupB) selectSubgroupB(p.subgroupB);
    state.useOrbitB = p.orbitB !== undefined ? !!p.orbitB : true;
    dom.chkOrbitB.checked = state.useOrbitB;
    state.pB = p.pB ?? 0;
    dom.selPlaceB.value = String(state.pB % state.permSizeB);
    rebuildSidePermsB();

    state.p1 = (p.p1 ?? 0) % state.permSizeA;
    state.p2 = (p.p2 ?? 1) % state.permSizeA;
    dom.selPlace1.value = String(state.p1);
    dom.selPlace2.value = String(state.p2);

    state.palette = p.palette || 'vibrant';
    dom.selPalette.value = state.palette;
    state.paletteData = buildPaletteArray(state.palette);
    renderPaletteStrip();

    state.motifType = p.motif ?? 0;
    dom.selMotif.value = String(state.motifType);
    state.motifSizeFrac = p.motifSize ?? 0.9;
    dom.rngMotifSize.value = String(state.motifSizeFrac);
    dom.valMotifSize.textContent = state.motifSizeFrac.toFixed(2);
    state.motifColorMode = p.motifColorMode ?? 0;
    dom.selMotifColorMode.value = String(state.motifColorMode);

    state.showTiles = !!p.showTiles;
    dom.chkTiles.checked = state.showTiles;
    state.showGrid = p.showGrid !== false;
    dom.chkGrid.checked = state.showGrid;

    if (p.splaneKind) { state.splaneKind = p.splaneKind; dom.selSplaneKind.value = p.splaneKind; }
    if (p.splaneAngle !== undefined) {
        state.splaneAngleDeg = p.splaneAngle;
        dom.rngSplaneAngle.value = String(p.splaneAngle);
        dom.valSplaneAngle.textContent = `${p.splaneAngle}°`;
    }
    state.pathType = p.pathType || 'geodesic';
    dom.selPathType.value = state.pathType;
    if (p.matchRot !== undefined) { state.matchRot = p.matchRot; dom.chkMatchRot.checked = p.matchRot; }

    state.easing = p.easing || 'cubic';
    dom.selEasing.value = state.easing;
    state.playback = p.playback || 'pingpong';
    dom.selPlayback.value = state.playback;

    recomputeTrajectories();
    setMode(p.mode);

    state.rawT = 0;
    state.dir = 1;
    state.holdTimer = Math.min(0.5, state.hold);
    state.crownKey = '';
    renderFrame();
}

function buildStaticLists() {
    dom.selGroup.innerHTML = '';
    for (const g of GROUPS) {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.label;
        dom.selGroup.appendChild(opt);
    }

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

    dom.modeList.innerHTML = '';
    for (const m of MODES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mode-btn';
        btn.dataset.modeId = String(m.id);
        btn.innerHTML = `<div class="mt"><span>${m.title}</span></div><div class="ms">${m.sub}</div>`;
        btn.addEventListener('click', () => setMode(m.id));
        dom.modeList.appendChild(btn);
    }
}

function wireEvents() {
    document.querySelectorAll('[data-quick-mode]').forEach(b => {
        b.addEventListener('click', () => setMode(Number(b.dataset.quickMode)));
    });

    dom.selGroup.addEventListener('change', () => selectGroup(dom.selGroup.value));
    dom.selSubgroupA.addEventListener('change', () => { selectSubgroupA(dom.selSubgroupA.value); renderFrame(); });
    dom.chkOrbitA.addEventListener('change', () => {
        state.useOrbitA = dom.chkOrbitA.checked;
        rebuildSidePermsA();
        recomputeTrajectories();
        renderFrame();
    });
    dom.selPlace1.addEventListener('change', () => {
        state.p1 = Number(dom.selPlace1.value);
        renderPaletteStrip();
        recomputeTrajectories();
        renderFrame();
    });
    dom.selPlace2.addEventListener('change', () => {
        state.p2 = Number(dom.selPlace2.value);
        renderPaletteStrip();
        recomputeTrajectories();
        renderFrame();
    });
    dom.btnSwapPlace.addEventListener('click', () => {
        const tmp = state.p1;
        state.p1 = state.p2;
        state.p2 = tmp;
        dom.selPlace1.value = String(state.p1);
        dom.selPlace2.value = String(state.p2);
        renderPaletteStrip();
        recomputeTrajectories();
        renderFrame();
    });
    dom.selPalette.addEventListener('change', () => {
        state.palette = dom.selPalette.value;
        state.paletteData = buildPaletteArray(state.palette);
        renderPaletteStrip();
        renderFrame();
    });

    // Dual-layer Curtain Split
    dom.chkDualLayer.addEventListener('change', () => {
        state.dualLayer = dom.chkDualLayer.checked;
        dom.dualLayerFields.classList.toggle('hidden', !state.dualLayer);
        state.crownKey = '';
        updateLabels();
        renderFrame();
    });
    dom.selSubgroupB.addEventListener('change', () => { selectSubgroupB(dom.selSubgroupB.value); updateLabels(); renderFrame(); });
    dom.selPlaceB.addEventListener('change', () => { state.pB = Number(dom.selPlaceB.value); updateLabels(); renderFrame(); });
    dom.chkOrbitB.addEventListener('change', () => {
        state.useOrbitB = dom.chkOrbitB.checked;
        rebuildSidePermsB();
        updateLabels();
        renderFrame();
    });

    // Motif & display
    dom.selMotif.addEventListener('change', () => { state.motifType = Number(dom.selMotif.value); renderFrame(); });
    dom.rngMotifSize.addEventListener('input', () => {
        state.motifSizeFrac = Number(dom.rngMotifSize.value);
        dom.valMotifSize.textContent = state.motifSizeFrac.toFixed(2);
        renderFrame();
    });
    dom.selMotifColorMode.addEventListener('change', () => { state.motifColorMode = Number(dom.selMotifColorMode.value); renderFrame(); });
    dom.chkTiles.addEventListener('change', () => { state.showTiles = dom.chkTiles.checked; renderFrame(); });
    dom.chkGrid.addEventListener('change', () => { state.showGrid = dom.chkGrid.checked; renderFrame(); });
    dom.chkGuides.addEventListener('change', () => { state.showGuides = dom.chkGuides.checked; renderFrame(); });

    // SPlane controls
    dom.selSplaneKind.addEventListener('change', () => { state.splaneKind = dom.selSplaneKind.value; renderFrame(); });
    dom.rngSplaneAngle.addEventListener('input', () => {
        state.splaneAngleDeg = Number(dom.rngSplaneAngle.value);
        dom.valSplaneAngle.textContent = `${state.splaneAngleDeg}°`;
        renderFrame();
    });
    dom.rngSplaneBlur.addEventListener('input', () => {
        state.splaneBlur = Number(dom.rngSplaneBlur.value);
        dom.valSplaneBlur.textContent = state.splaneBlur.toFixed(3);
        renderFrame();
    });
    dom.chkSplaneInvert.addEventListener('change', () => { state.splaneInvert = dom.chkSplaneInvert.checked; renderFrame(); });
    dom.chkCutLine.addEventListener('change', () => { state.showCutLine = dom.chkCutLine.checked; renderFrame(); });

    // Trajectory controls
    dom.selPathType.addEventListener('change', () => { state.pathType = dom.selPathType.value; renderFrame(); });
    dom.chkPreferDirect.addEventListener('change', () => {
        state.preferDirect = dom.chkPreferDirect.checked;
        const def = pickDefaultTarget(state.candidates, state.preferDirect);
        if (def) state.activeCandIdx = state.candidates.indexOf(def);
        renderCandidateList();
        renderFrame();
    });
    dom.chkMatchRot.addEventListener('change', () => { state.matchRot = dom.chkMatchRot.checked; renderFrame(); });

    // Transport & timing
    dom.rngScrub.addEventListener('input', () => {
        state.playing = false;
        updatePlayBtn();
        state.rawT = Number(dom.rngScrub.value);
        renderFrame();
    });
    dom.btnPlay.addEventListener('click', () => {
        state.playing = !state.playing;
        if (state.playing && state.playback === 'once' && state.rawT >= 0.999) state.rawT = 0;
        state.holdTimer = 0;
        updatePlayBtn();
    });
    dom.btnZero.addEventListener('click', () => { state.playing = false; updatePlayBtn(); state.rawT = 0; renderFrame(); });
    dom.btnMid.addEventListener('click',  () => { state.playing = false; updatePlayBtn(); state.rawT = 0.5; renderFrame(); });
    dom.btnOne.addEventListener('click',  () => { state.playing = false; updatePlayBtn(); state.rawT = 1; renderFrame(); });
    dom.selPlayback.addEventListener('change', () => { state.playback = dom.selPlayback.value; });
    dom.selEasing.addEventListener('change', () => { state.easing = dom.selEasing.value; renderFrame(); });
    dom.chkCaption.addEventListener('change', () => {
        state.showCaption = dom.chkCaption.checked;
        dom.stageCaption.classList.toggle('hidden', !state.showCaption);
    });
    dom.rngDur.addEventListener('input', () => {
        state.duration = Number(dom.rngDur.value);
        dom.valDur.textContent = `${state.duration.toFixed(1)}s`;
    });
    dom.rngHold.addEventListener('input', () => {
        state.hold = Number(dom.rngHold.value);
        dom.valHold.textContent = `${state.hold.toFixed(1)}s`;
    });

    // Camera reset & exports & presentation
    const resetView = () => {
        if (state.geom.kind === 'hyperbolic') {
            state.viewCenter = state.geom.c.slice();
            state.viewScale = state.geom.r * 1.07;
        } else if (state.geom.kind === 'spherical') {
            state.viewCenter = state.geom.c.slice();
            state.viewScale = state.geom.R * 1.45;
        } else {
            state.viewCenter = state.bounds.center.slice();
            state.viewScale = state.groupDef.viewScale || 1.55;
        }
        renderFrame();
    };
    dom.btnResetView.addEventListener('click', resetView);
    dom.btnSnapshot.addEventListener('click', exportPng);
    dom.btnRecord.addEventListener('click', toggleRecording);

    const togglePresent = (force) => {
        const next = typeof force === 'boolean' ? force : !document.body.classList.contains('present');
        document.body.classList.toggle('present', next);
    };
    dom.btnPresent.addEventListener('click', () => togglePresent(true));
    dom.btnExitPresent.addEventListener('click', () => togglePresent(false));

    // Interactive Canvas Pointer: drag A, click candidate dot, pan, wheel zoom
    let dragMode = null; // 'anchor' | 'pan'
    let panStart = null;
    let panViewStart = null;

    dom.overlayCanvas.addEventListener('pointerdown', (e) => {
        const rect = dom.overlayCanvas.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / rect.width) * dom.overlayCanvas.width;
        const sy = ((e.clientY - rect.top) / rect.height) * dom.overlayCanvas.height;

        // Shift+drag or middle/right click pans camera
        if (e.shiftKey || e.button === 1 || e.button === 2) {
            dragMode = 'pan';
            panStart = [e.clientX, e.clientY];
            panViewStart = state.viewCenter.slice();
            dom.overlayCanvas.setPointerCapture(e.pointerId);
            return;
        }

        if ((state.mode === 3 || state.mode === 4) && state.showGuides) {
            // 1. Check click on starting anchor A -> drag A
            const [ax, ay] = worldToCanvas(state.startPoint[0], state.startPoint[1]);
            if (Math.hypot(sx - ax, sy - ay) < 18) {
                dragMode = 'anchor';
                dom.overlayCanvas.setPointerCapture(e.pointerId);
                return;
            }
            // 2. Check click on any candidate target dot -> pick that trajectory
            for (let i = 0; i < state.candidates.length; i++) {
                const c = state.candidates[i];
                const [bx, by] = worldToCanvas(c.targetPoint[0], c.targetPoint[1]);
                if (Math.hypot(sx - bx, sy - by) < 16) {
                    state.activeCandIdx = i;
                    renderCandidateList();
                    renderFrame();
                    showToast(`Selected trajectory h="${c.word}" (${c.orientationPreserving ? 'G⁺ direct' : 'G⁻ reflection'})`);
                    return;
                }
            }
        }

        // Default left-drag pans camera
        dragMode = 'pan';
        panStart = [e.clientX, e.clientY];
        panViewStart = state.viewCenter.slice();
        dom.overlayCanvas.setPointerCapture(e.pointerId);
    });

    dom.overlayCanvas.addEventListener('pointermove', (e) => {
        if (dragMode === 'anchor') {
            const w = canvasToWorld(e.clientX, e.clientY);
            if (state.geom.kind === 'hyperbolic') {
                const r = Math.hypot(w[0] - state.geom.c[0], w[1] - state.geom.c[1]);
                if (r >= state.geom.r * 0.94) return;
            }
            const curWord = getActiveCandidate()?.word || null;
            state.startPoint = w;
            recomputeTrajectories(curWord);
            renderFrame();
        } else if (dragMode === 'pan' && panStart) {
            const rect = dom.overlayCanvas.getBoundingClientRect();
            const dx = (e.clientX - panStart[0]) / rect.height * (2 * state.viewScale);
            const dy = (e.clientY - panStart[1]) / rect.height * (2 * state.viewScale);
            state.viewCenter = [panViewStart[0] - dx, panViewStart[1] + dy];
            renderFrame();
        }
    });

    const endDrag = () => { dragMode = null; panStart = null; };
    dom.overlayCanvas.addEventListener('pointerup', endDrag);
    dom.overlayCanvas.addEventListener('pointercancel', endDrag);
    dom.overlayCanvas.addEventListener('dblclick', resetView);
    dom.overlayCanvas.addEventListener('contextmenu', e => e.preventDefault());

    dom.overlayCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.0012);
        state.viewScale = Math.max(0.15, Math.min(8.0, state.viewScale * factor));
        renderFrame();
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') { e.preventDefault(); dom.btnPlay.click(); }
        else if (e.key === 'f' || e.key === 'F') togglePresent();
        else if (e.key === 'Escape') togglePresent(false);
        else if (e.key === 'ArrowRight') { state.playing = false; updatePlayBtn(); state.rawT = Math.min(1, state.rawT + 0.05); renderFrame(); }
        else if (e.key === 'ArrowLeft')  { state.playing = false; updatePlayBtn(); state.rawT = Math.max(0, state.rawT - 0.05); renderFrame(); }
    });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildStaticLists();
wireEvents();
applyPreset(PRESETS[0]).then(() => {
    requestAnimationFrame(tick);
});
