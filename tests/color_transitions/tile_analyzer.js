// Fast client-side analyzer for catalog `group_tiling.webp` + Image A/B pairs.
// Extracts fundamental-domain tile IDs, exact adjacency graph (for Cayley/word-length
// BFS cascades), per-tile local Chamfer distance (for simultaneous per-tile blooms),
// tile centroids (for 3D tile card flips), and per-tile color classes (for coset cascades).

const ANALYSIS_SIZE = 512;

function hashInt(n) {
  let x = (n + 1) * 0x27d4eb2d;
  x = (x ^ (x >>> 15)) * 0x85ebca6b;
  x = x ^ (x >>> 13);
  return ((x >>> 0) % 100000) / 100000;
}

function drawToBuffer(img, size, bgFill = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (bgFill) {
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

/**
 * Segment a catalog group_tiling.webp image into fundamental domains.
 * Returns a reusable TilingModel that can quickly recompute BFS waves from any
 * clicked origin and pair with any (imgA, imgB) to build WebGL data textures.
 */
export function analyzeTilingImage(tilingImg) {
  const S = ANALYSIS_SIZE;
  const N = S * S;
  const rgba = drawToBuffer(tilingImg, S);

  // 1. Identify dark tiling lines vs white tile interiors
  const isLine = new Uint8Array(N);
  let maxDarkR = 0;
  const half = S * 0.5;
  for (let y = 0; y < S; y++) {
    const dy = y + 0.5 - half;
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const lum = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
      if (lum < 235) {
        isLine[i] = 1;
        const dx = x + 0.5 - half;
        const r = Math.hypot(dx, dy);
        if (r > maxDarkR) maxDarkR = r;
      }
    }
  }

  // Detect circular Poincaré disk (hyperbolic) vs full-frame square (wallpaper/polyhedral/etc.)
  const cornersWhite =
    !isLine[0] && !isLine[S - 1] && !isLine[(S - 1) * S] && !isLine[N - 1];
  const isDisk = cornersWhite && maxDarkR > S * 0.30 && maxDarkR < S * 0.495;
  const diskRadius = isDisk ? maxDarkR / S : 0.47;

  // 2. Flood-fill white interior components -> exact tile IDs
  //    -1 = boundary line / unassigned, -2 = exterior background outside disk
  const tileId = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);

  // Mark exterior background on circular disks starting from corners
  if (isDisk) {
    let head = 0, tail = 0;
    const seeds = [0, S - 1, (S - 1) * S, N - 1];
    for (const s of seeds) {
      if (!isLine[s] && tileId[s] === -1) {
        tileId[s] = -2;
        queue[tail++] = s;
      }
    }
    while (head < tail) {
      const p = queue[head++];
      const x = p % S;
      const y = (p - x) / S;
      if (x > 0     && !isLine[p - 1] && tileId[p - 1] === -1) { tileId[p - 1] = -2; queue[tail++] = p - 1; }
      if (x < S - 1 && !isLine[p + 1] && tileId[p + 1] === -1) { tileId[p + 1] = -2; queue[tail++] = p + 1; }
      if (y > 0     && !isLine[p - S] && tileId[p - S] === -1) { tileId[p - S] = -2; queue[tail++] = p - S; }
      if (y < S - 1 && !isLine[p + S] && tileId[p + S] === -1) { tileId[p + S] = -2; queue[tail++] = p + S; }
    }
  }

  const sumX = [];
  const sumY = [];
  const area = [];
  const compPixels = [];
  let numTiles = 0;

  for (let i = 0; i < N; i++) {
    if (isLine[i] || tileId[i] !== -1) continue;
    let head = 0, tail = 0;
    const id = numTiles;
    tileId[i] = id;
    queue[tail++] = i;
    let sx = 0, sy = 0;

    while (head < tail) {
      const p = queue[head++];
      const x = p % S;
      const y = (p - x) / S;
      sx += x;
      sy += y;
      if (x > 0     && !isLine[p - 1] && tileId[p - 1] === -1) { tileId[p - 1] = id; queue[tail++] = p - 1; }
      if (x < S - 1 && !isLine[p + 1] && tileId[p + 1] === -1) { tileId[p + 1] = id; queue[tail++] = p + 1; }
      if (y > 0     && !isLine[p - S] && tileId[p - S] === -1) { tileId[p - S] = id; queue[tail++] = p - S; }
      if (y < S - 1 && !isLine[p + S] && tileId[p + S] === -1) { tileId[p + S] = id; queue[tail++] = p + S; }
    }

    // Discard 1-3px anti-alias specks inside fused hyperbolic rims
    if (tail < 4) {
      for (let k = 0; k < tail; k++) tileId[queue[k]] = -1;
    } else {
      sumX.push(sx);
      sumY.push(sy);
      area.push(tail);
      numTiles++;
    }
  }

  // 3. Exact 2-pass Chamfer distance transform from tile lines into tile interiors
  const dist = new Float32Array(N);
  const INF = 1e6;
  for (let i = 0; i < N; i++) {
    dist[i] = tileId[i] >= 0 ? INF : 0;
  }
  const D1 = 1.0, D2 = 1.41421356;
  // Forward pass
  for (let y = 0; y < S; y++) {
    const row = y * S;
    for (let x = 0; x < S; x++) {
      const i = row + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[i - 1] + D1);
      if (y > 0) {
        d = Math.min(d, dist[i - S] + D1);
        if (x > 0)     d = Math.min(d, dist[i - S - 1] + D2);
        if (x < S - 1) d = Math.min(d, dist[i - S + 1] + D2);
      }
      dist[i] = d;
    }
  }
  // Backward pass
  for (let y = S - 1; y >= 0; y--) {
    const row = y * S;
    for (let x = S - 1; x >= 0; x--) {
      const i = row + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x < S - 1) d = Math.min(d, dist[i + 1] + D1);
      if (y < S - 1) {
        d = Math.min(d, dist[i + S] + D1);
        if (x > 0)     d = Math.min(d, dist[i + S - 1] + D2);
        if (x < S - 1) d = Math.min(d, dist[i + S + 1] + D2);
      }
      dist[i] = d;
    }
  }

  const maxDistPerTile = new Float32Array(numTiles).fill(1.0);
  for (let i = 0; i < N; i++) {
    const id = tileId[i];
    if (id >= 0 && dist[i] > maxDistPerTile[id]) {
      maxDistPerTile[id] = dist[i];
    }
  }
  const localDist = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const id = tileId[i];
    localDist[i] = id >= 0 ? Math.min(1.0, dist[i] / maxDistPerTile[id]) : 0.0;
  }

  // 4. Multi-source BFS dilation across dark lines to assign border pixels to
  //    nearest tile AND discover exact shared-edge tile adjacencies!
  const dilatedId = new Int32Array(tileId);
  const dilStep = new Uint8Array(N);
  const adjSets = Array.from({ length: numTiles }, () => new Set());

  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    if (tileId[i] >= 0) {
      queue[tail++] = i;
    }
  }

  const MAX_DILATE = 5;
  while (head < tail) {
    const p = queue[head++];
    const myId = dilatedId[p];
    const step = dilStep[p];
    const x = p % S;
    const y = (p - x) / S;

    const nbrs = [];
    if (x > 0)     nbrs.push(p - 1);
    if (x < S - 1) nbrs.push(p + 1);
    if (y > 0)     nbrs.push(p - S);
    if (y < S - 1) nbrs.push(p + S);

    for (let k = 0; k < nbrs.length; k++) {
      const q = nbrs[k];
      const qId = dilatedId[q];
      if (qId === -1 && step < MAX_DILATE) {
        dilatedId[q] = myId;
        dilStep[q] = step + 1;
        queue[tail++] = q;
      } else if (qId >= 0 && qId !== myId) {
        // Two tiles meet across a thin boundary line -> adjacent in tiling graph!
        if (step <= 3 && dilStep[q] <= 3) {
          adjSets[myId].add(qId);
          adjSets[qId].add(myId);
        }
      }
    }
  }

  const adj = adjSets.map(s => Array.from(s));
  const centroidsX = new Float32Array(numTiles);
  const centroidsY = new Float32Array(numTiles);
  const tileRand = new Float32Array(numTiles);
  for (let id = 0; id < numTiles; id++) {
    centroidsX[id] = (sumX[id] / area[id] + 0.5) / S;
    centroidsY[id] = (sumY[id] / area[id] + 0.5) / S;
    tileRand[id] = hashInt(id * 37 + 13);
  }

  return {
    size: S,
    numTiles,
    isDisk,
    diskRadius,
    tileId,        // original strict interior IDs (for clean color sampling)
    dilatedId,     // boundary-covered IDs (for seamless shader lookup)
    localDist,     // normalized [0..1] distance from mirror boundary
    adj,
    centroidsX,
    centroidsY,
    tileRand,
  };
}

/**
 * Compute BFS word-length distances from a seed UV origin and pack `tileData`
 * (RGBA8 texture, size S x S):
 *   R = BFS graph distance [0..255]
 *   G = per-tile deterministic random [0..255]
 *   B = local normalized distance from tile wall [0..255]
 *   A = tile radial angle around origin [0..255]
 */
export function buildTileDataTexture(model, originX = 0.5, originY = 0.5) {
  const { size: S, numTiles, dilatedId, localDist, adj, centroidsX, centroidsY, tileRand, isDisk, diskRadius } = model;
  const N = S * S;
  const out = new Uint8Array(N * 4);

  if (numTiles === 0) {
    return out;
  }

  // Pick seed tile under (originX, originY), or nearest tile centroid
  const sx = Math.max(0, Math.min(S - 1, Math.floor(originX * S)));
  const sy = Math.max(0, Math.min(S - 1, Math.floor(originY * S)));
  let seedTile = dilatedId[sy * S + sx];
  if (seedTile < 0) {
    let bestD = Infinity;
    for (let id = 0; id < numTiles; id++) {
      const d = Math.hypot(centroidsX[id] - originX, centroidsY[id] - originY);
      if (d < bestD) { bestD = d; seedTile = id; }
    }
  }

  // BFS on exact fundamental-domain adjacency graph
  const bfsDist = new Int32Array(numTiles).fill(-1);
  const q = new Int32Array(numTiles);
  let head = 0, tail = 0;
  bfsDist[seedTile] = 0;
  q[tail++] = seedTile;
  let maxStep = 1;

  while (head < tail) {
    const u = q[head++];
    const dNext = bfsDist[u] + 1;
    const nbrs = adj[u];
    for (let k = 0; k < nbrs.length; k++) {
      const v = nbrs[k];
      if (bfsDist[v] === -1) {
        bfsDist[v] = dNext;
        if (dNext > maxStep) maxStep = dNext;
        q[tail++] = v;
      }
    }
  }

  // Any disconnected tile (e.g., isolated corner piece) gets radial fallback
  const bfsNorm = new Float32Array(numTiles);
  const tileAngle = new Float32Array(numTiles);
  const maxRad = Math.max(
    Math.hypot(originX, originY),
    Math.hypot(1 - originX, originY),
    Math.hypot(originX, 1 - originY),
    Math.hypot(1 - originX, 1 - originY),
    0.001
  );

  for (let id = 0; id < numTiles; id++) {
    const rad = Math.hypot(centroidsX[id] - originX, centroidsY[id] - originY) / maxRad;
    if (bfsDist[id] >= 0) {
      // Reserve top 10% for unresolved outer Poincaré disk rim if isDisk
      const cap = isDisk ? 0.88 : 1.0;
      bfsNorm[id] = (bfsDist[id] / maxStep) * cap;
    } else {
      bfsNorm[id] = Math.min(1.0, rad);
    }
    const ang = Math.atan2(centroidsY[id] - originY, centroidsX[id] - originX);
    tileAngle[id] = (ang + Math.PI) / (2 * Math.PI);
  }

  // Pack pixels
  for (let y = 0; y < S; y++) {
    const fy = (y + 0.5) / S;
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const o = i * 4;
      const id = dilatedId[i];
      if (id >= 0) {
        out[o]     = Math.round(Math.min(1, Math.max(0, bfsNorm[id])) * 255);
        out[o + 1] = Math.round(tileRand[id] * 255);
        out[o + 2] = Math.round(localDist[i] * 255);
        out[o + 3] = Math.round(tileAngle[id] * 255);
      } else {
        // Unresolved hyperbolic outer rim or exterior background: smooth radial fallback
        const fx = (x + 0.5) / S;
        const rCenter = Math.hypot(fx - 0.5, fy - 0.5);
        const rOrig = Math.hypot(fx - originX, fy - originY) / maxRad;
        const rimVal = isDisk
          ? Math.min(1.0, 0.88 + 0.12 * Math.max(0, (rCenter / Math.max(diskRadius, 0.2) - 0.82) / 0.18))
          : Math.min(1.0, rOrig);
        out[o]     = Math.round(rimVal * 255);
        out[o + 1] = Math.round(hashInt((x >> 2) * 73856093 ^ (y >> 2) * 19349663) * 255);
        out[o + 2] = 0;
        out[o + 3] = Math.round(((Math.atan2(fy - originY, fx - originX) + Math.PI) / (2 * Math.PI)) * 255);
      }
    }
  }
  return out;
}

/**
 * Analyze Image A & Image B over the tiling model to extract:
 *   - per-tile dominant color in A and B (ignoring pure-black commas/lines)
 *   - changed vs unchanged tile flag (for Diff-Only & Card Flip)
 *   - color-class ordering in B (for Coset / Color-Class-by-Color-Class Reveal)
 *
 * Packs `tileMeta` (RGBA8 texture, size S x S):
 *   R = centroidX [0..255]
 *   G = centroidY [0..255]
 *   B = colorClassOrder [0..255]
 *   A = changedFlag (255 = tile changed color, 0 = unchanged, 128 = rim/fallback)
 */
export function buildTileMetaTexture(model, imgA, imgB) {
  const { size: S, numTiles, tileId, dilatedId, centroidsX, centroidsY } = model;
  const N = S * S;
  const out = new Uint8Array(N * 4);

  if (numTiles === 0 || !imgA || !imgB) {
    for (let i = 0; i < N; i++) {
      out[i * 4 + 3] = 255;
    }
    return { data: out, stats: { numTiles: 0, changedTiles: 0, colorClasses: 0 } };
  }

  const pixA = drawToBuffer(imgA, S);
  const pixB = drawToBuffer(imgB, S);

  // Accumulate per-tile dominant color (exclude pure-black comma ink: r+g+b < 42)
  const sumRA = new Float64Array(numTiles), sumGA = new Float64Array(numTiles), sumBA = new Float64Array(numTiles);
  const sumRB = new Float64Array(numTiles), sumGB = new Float64Array(numTiles), sumBB = new Float64Array(numTiles);
  const cntA = new Int32Array(numTiles), cntB = new Int32Array(numTiles);

  const fallRA = new Float64Array(numTiles), fallGA = new Float64Array(numTiles), fallBA = new Float64Array(numTiles);
  const fallRB = new Float64Array(numTiles), fallGB = new Float64Array(numTiles), fallBB = new Float64Array(numTiles);
  const fallCnt = new Int32Array(numTiles);

  for (let i = 0; i < N; i++) {
    const id = tileId[i];
    if (id < 0) continue;
    const o = i * 4;
    const rA = pixA[o], gA = pixA[o + 1], bA = pixA[o + 2];
    const rB = pixB[o], gB = pixB[o + 1], bB = pixB[o + 2];

    fallRA[id] += rA; fallGA[id] += gA; fallBA[id] += bA;
    fallRB[id] += rB; fallGB[id] += gB; fallBB[id] += bB;
    fallCnt[id]++;

    if (rA + gA + bA >= 42) {
      sumRA[id] += rA; sumGA[id] += gA; sumBA[id] += bA; cntA[id]++;
    }
    if (rB + gB + bB >= 42) {
      sumRB[id] += rB; sumGB[id] += gB; sumBB[id] += bB; cntB[id]++;
    }
  }

  const colA = new Float32Array(numTiles * 3);
  const colB = new Float32Array(numTiles * 3);
  const changed = new Uint8Array(numTiles);
  let changedTiles = 0;

  for (let id = 0; id < numTiles; id++) {
    const cA = cntA[id] > 0 ? cntA[id] : Math.max(1, fallCnt[id]);
    const cB = cntB[id] > 0 ? cntB[id] : Math.max(1, fallCnt[id]);
    const rA = (cntA[id] > 0 ? sumRA[id] : fallRA[id]) / (cA * 255);
    const gA = (cntA[id] > 0 ? sumGA[id] : fallGA[id]) / (cA * 255);
    const bA = (cntA[id] > 0 ? sumBA[id] : fallBA[id]) / (cA * 255);

    const rB = (cntB[id] > 0 ? sumRB[id] : fallRB[id]) / (cB * 255);
    const gB = (cntB[id] > 0 ? sumGB[id] : fallGB[id]) / (cB * 255);
    const bB = (cntB[id] > 0 ? sumBB[id] : fallBB[id]) / (cB * 255);

    colA[id * 3] = rA; colA[id * 3 + 1] = gA; colA[id * 3 + 2] = bA;
    colB[id * 3] = rB; colB[id * 3 + 1] = gB; colB[id * 3 + 2] = bB;

    const d = Math.hypot(rA - rB, gA - gB, bA - bB);
    if (d > 0.055) {
      changed[id] = 1;
      changedTiles++;
    }
  }

  // Cluster changed tiles by destination color in B (for Coset / Color-Class Reveal)
  const clusters = []; // { r, g, b, count }
  const tileCluster = new Int32Array(numTiles).fill(-1);
  const TOL = 0.11;

  for (let id = 0; id < numTiles; id++) {
    if (!changed[id]) continue;
    const r = colB[id * 3], g = colB[id * 3 + 1], b = colB[id * 3 + 2];
    let best = -1, bestD = TOL;
    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      const d = Math.hypot(r - cl.r, g - cl.g, b - cl.b);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best === -1) {
      best = clusters.length;
      clusters.push({ r, g, b, count: 1 });
    } else {
      const cl = clusters[best];
      const n = cl.count + 1;
      cl.r = (cl.r * cl.count + r) / n;
      cl.g = (cl.g * cl.count + g) / n;
      cl.b = (cl.b * cl.count + b) / n;
      cl.count = n;
    }
    tileCluster[id] = best;
  }

  // Sort color classes cleanly by luminance (dark -> light) for visually readable progression
  const orderIdx = clusters.map((cl, idx) => ({
    idx,
    lum: 0.299 * cl.r + 0.587 * cl.g + 0.114 * cl.b,
  })).sort((a, b) => a.lum - b.lum);

  const rankOfCluster = new Int32Array(clusters.length);
  orderIdx.forEach((item, rank) => { rankOfCluster[item.idx] = rank; });

  const K = Math.max(1, clusters.length);
  const classOrder = new Float32Array(numTiles);
  for (let id = 0; id < numTiles; id++) {
    if (changed[id] && tileCluster[id] >= 0) {
      const rank = rankOfCluster[tileCluster[id]];
      // Spread classes nicely across [0.05 .. 0.95]
      classOrder[id] = K === 1 ? 0.5 : (rank / (K - 1)) * 0.86 + 0.07;
    } else {
      classOrder[id] = 0.0;
    }
  }

  // Pack pixels
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const id = dilatedId[i];
    if (id >= 0) {
      out[o]     = Math.round(centroidsX[id] * 255);
      out[o + 1] = Math.round(centroidsY[id] * 255);
      out[o + 2] = Math.round(classOrder[id] * 255);
      out[o + 3] = changed[id] ? 255 : 0;
    } else {
      // Unresolved rim: determine changed flag from pixel diff directly
      const d = Math.hypot(pixA[o] - pixB[o], pixA[o + 1] - pixB[o + 1], pixA[o + 2] - pixB[o + 2]) / 255;
      const lumB = (0.299 * pixB[o] + 0.587 * pixB[o + 1] + 0.114 * pixB[o + 2]) / 255;
      const x = i % S;
      const y = (i - x) / S;
      out[o]     = Math.round(((x + 0.5) / S) * 255);
      out[o + 1] = Math.round(((y + 0.5) / S) * 255);
      out[o + 2] = Math.round(lumB * 255);
      out[o + 3] = d > 0.06 ? 255 : 0;
    }
  }

  return {
    data: out,
    stats: {
      numTiles,
      changedTiles,
      colorClasses: clusters.length,
    },
  };
}
