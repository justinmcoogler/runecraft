// The province's physical geography: one 2500x2500 heightfield with
// noise-warped biome masks (so no border runs straight), the Silverrun
// river with its lake, tributaries and delta, the south-eastern sea, and a
// final walkability relaxation that keeps every natural slope at steps of
// one block or less. Deliberate cliffs (the Frostspine wall, the Sunscar
// canyon, the sea cliffs) are cut back in afterwards, and roads later carve
// their own compliant ramps through them.
//
// Heights are sim units (one unit = one block face in the renderer);
// approximate survey elevation is Y = 63 + 3h with the sea at Y 62.

import type { BlockType } from "../world";
import { cellHash, distToPolyline, fbm, splinePath, vnoise } from "./noise";
import { WORLD } from "./regions";

export const BIOME = {
  plains: 0,
  forest: 1,
  taiga: 2,
  mountain: 3,
  highland: 4,
  desert: 5,
  swamp: 6,
  coast: 7,
  sea: 8,
  river: 9,
} as const;
export type BiomeId = (typeof BIOME)[keyof typeof BIOME];

export interface Geography {
  heights: number[];
  blocks: BlockType[];
  biome: Uint8Array;
  /** Cells that relaxation must not soften (water, cliff faces, town pads). */
  locked: Uint8Array;
  at(x: number, z: number): number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Waterways (control points hand-surveyed to the province charter).
// ---------------------------------------------------------------------------

/** The Silverrun: born under the Frostspine, dead in the delta. */
export const SILVERRUN: Array<[number, number]> = [
  [1352, 0], [1370, 120], [1330, 260], [1395, 420], [1440, 560],
  [1420, 700], [1487, 840], [1520, 990], [1470, 1140], [1495, 1290],
  [1520, 1430], [1480, 1560], [1430, 1700], [1440, 1840], [1390, 1980],
  [1430, 2120], [1520, 2230], [1640, 2320], [1760, 2390],
];

/** Central lake the river feeds east of Greenvale. */
export const SILVER_LAKE = { x: 1505, z: 1505, r: 95 };

export const TRIBUTARIES: Array<{ name: string; pts: Array<[number, number]>; width: number }> = [
  // Whisperwood water: out of the forest mere, joining below Greenvale.
  { name: "Merewater", pts: [[700, 1450], [850, 1500], [1010, 1560], [1170, 1600], [1310, 1640], [1436, 1690]], width: 4 },
  // Highforge foothill stream, down to the upper Silverrun.
  { name: "Forgebeck", pts: [[760, 560], [900, 620], [1040, 700], [1180, 740], [1310, 720], [1421, 700]], width: 4 },
  // Stonegate farm water out of the eastern hills.
  { name: "Tollwater", pts: [[2010, 620], [1930, 730], [1840, 840], [1720, 920], [1600, 970], [1521, 990]], width: 4 },
  // Fen drain: the swamp bleeding into the lower river.
  { name: "Blackdrain", pts: [[1050, 2140], [1160, 2180], [1280, 2160], [1360, 2100], [1416, 2076]], width: 5 },
];

/** Dry riverbed in the Sunscar (cosmetic wadi, no water). */
export const WADI: Array<[number, number]> = [
  [2440, 1050], [2340, 1170], [2250, 1290], [2190, 1420], [2230, 1550], [2300, 1650],
];

// ---------------------------------------------------------------------------

export function buildGeography(): Geography {
  const W = WORLD;
  const N = W * W;
  const heights = new Array<number>(N).fill(0);
  const blocks = new Array<BlockType>(N).fill("grass");
  const biome = new Uint8Array(N);
  const locked = new Uint8Array(N);
  const at = (x: number, z: number) => z * W + x;

  // ---- Coarse fields, sampled every 4 blocks and bilerped -----------------
  // (elevation, moisture and domain warp are smooth; per-cell hash supplies
  // the fine grain, so the coarse grid costs nothing visible.)
  const G = W / 4 + 1;
  const fWarpX = new Float32Array(G * G);
  const fWarpZ = new Float32Array(G * G);
  const fRoll = new Float32Array(G * G);
  const fMoist = new Float32Array(G * G);
  for (let gz = 0; gz < G; gz++) {
    for (let gx = 0; gx < G; gx++) {
      const x = gx * 4;
      const z = gz * 4;
      const i = gz * G + gx;
      fWarpX[i] = (fbm(x, z, 260, 811) - 0.5) * 170;
      fWarpZ[i] = (fbm(x, z, 260, 907) - 0.5) * 170;
      fRoll[i] = fbm(x, z, 330, 1) * 4 + fbm(x, z, 95, 2) * 2.6;
      fMoist[i] = fbm(x, z, 520, 55);
    }
  }
  const bilerp = (f: Float32Array, x: number, z: number): number => {
    const gx = Math.min(G - 1.001, x / 4);
    const gz = Math.min(G - 1.001, z / 4);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const tx = gx - x0;
    const tz = gz - z0;
    const i = z0 * G + x0;
    const a = f[i];
    const b = f[i + 1];
    const c = f[i + G];
    const d = f[i + G + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };

  // ---- Elevation + biome assignment ---------------------------------------
  for (let z = 0; z < W; z++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, z);
      const wx = x + bilerp(fWarpX, x, z);
      const wz = z + bilerp(fWarpZ, x, z);

      // Rolling base terrain (0..6.6): meadows, dells and low hills.
      let h = bilerp(fRoll, x, z);

      // The Frostspine: a ridge across the north, tallest over the
      // fortress, dying out toward both map edges.
      const frostCore = smoothstep(680, 240, wz) * smoothstep(880, 1120, wx) * smoothstep(1850, 1620, wx);
      // Highforge highlands: the north-west shoulder of the province.
      const highCore = smoothstep(830, 300, wz) * smoothstep(1120, 820, wx) * smoothstep(-140, 180, wx);
      const mtn = Math.max(frostCore, highCore * 0.62);
      h += Math.pow(mtn, 1.6) * 30;

      // South-eastern sea: everything beyond the warped coast line drowns.
      // The line runs from the south edge (~x 1620) to the east edge
      // (~z 1690), cutting the corner as a broad bay.
      const coastD = wx + wz - 4230; // >0 means seaward
      const seaMask = smoothstep(-40, 60, coastD);
      h = h * (1 - seaMask) - seaMask * 3;

      // The Murkfen basin: pull the south-centre down to wet ground.
      const fenD = Math.hypot(wx - 1190, (wz - 2130) * 0.82);
      const fen = smoothstep(560, 240, fenD);
      h = h * (1 - fen * 0.85) + fen * 0.6;

      // Sunscar drylands: terraced mesas out east (steps are re-relaxed
      // for walkability later; the canyon proper is cut afterwards).
      const dryD = Math.hypot((wx - 2160) * 0.9, wz - 1360);
      const dry = smoothstep(620, 300, dryD) * smoothstep(1560, 1760, wx + (wz - 1360) * 0.2);
      if (dry > 0.28) {
        const mesa = Math.round(vnoise(x, z, 130, 77) * 3.4) * 2;
        h = h * 0.55 + mesa * dry;
      }

      // Moisture drives the vegetated biomes.
      const moist = bilerp(fMoist, x, z) + fen * 0.4 - dry * 0.45;
      const forestD = Math.hypot((wx - 520) * 0.9, wz - 1330);
      const forest = smoothstep(560, 300, forestD) + smoothstep(0.62, 0.75, moist) * smoothstep(1100, 700, wx);

      // Pocket noise pushes fingers and islands across every border band,
      // so no biome ends on a clean mathematical contour.
      const pocket = vnoise(x, z, 85, 3111);
      let b: BiomeId = BIOME.plains;
      if (seaMask > 0.55) b = BIOME.sea;
      else if (coastD > -170 && wz + wx > 3800) b = BIOME.coast;
      else if (h > 17) {
        b = mtn === frostCore && frostCore >= highCore ? BIOME.mountain : BIOME.highland;
        // Alpine dells: pocket noise carves wooded hollows out of the lower
        // slopes so the range reads as ridges and valleys, not one slab.
        if (b === BIOME.mountain && h < 26 && pocket > 0.56) b = BIOME.taiga;
      }
      else if (fen > 0.5 || (fen > 0.3 && pocket > 0.72)) b = BIOME.swamp;
      else if (dry > 0.55 && pocket < 0.14) b = BIOME.plains; // scrub islands in the sand
      else if (dry > 0.5 || (dry > 0.28 && pocket > 0.7)) b = BIOME.desert;
      else if (forest > 0.5 || (forest > 0.3 && pocket > 0.72 && wz > 850)) {
        if (wz > 850) b = BIOME.forest;
      } else if (wz < 720 || (h > 11 && wz < 1050)) b = BIOME.taiga;
      if (b === BIOME.plains && wz < 720) b = BIOME.taiga;
      biome[i] = b;

      heights[i] = Math.round(h);
    }
  }

  // ---- Waterways -----------------------------------------------------------
  const stampWater = (cx: number, cz: number, r: number) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(W - 1, Math.ceil(cx + r));
    const z0 = Math.max(0, Math.floor(cz - r));
    const z1 = Math.min(W - 1, Math.ceil(cz + r));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r) continue;
        const i = at(x, z);
        if (d <= r - 2) {
          heights[i] = -1;
          blocks[i] = "water";
          biome[i] = BIOME.river;
          locked[i] = 1;
        } else if (blocks[i] !== "water") {
          // Bank: low, soft ground the relaxation can blend outward.
          heights[i] = Math.min(heights[i], 1);
          if (blocks[i] !== "plank") blocks[i] = biome[i] === BIOME.swamp ? "mud" : "sand";
        }
      }
    }
  };

  const carveRiver = (pts: Array<[number, number]>, w0: number, w1: number) => {
    const path = splinePath(pts, 3);
    path.forEach(([px, pz], k) => {
      const t = k / path.length;
      const wobble = (vnoise(px, pz, 60, 31) - 0.5) * 6;
      const r = w0 + (w1 - w0) * t + wobble * 0.4;
      stampWater(px, pz, Math.max(3, r));
    });
  };

  carveRiver(SILVERRUN, 5, 11);
  for (const trib of TRIBUTARIES) carveRiver(trib.pts, 3, trib.width + 1);

  // The lake: a warped blob, deep enough to fish, ringed with reedy bank.
  for (let z = SILVER_LAKE.z - 130; z <= SILVER_LAKE.z + 130; z++) {
    for (let x = SILVER_LAKE.x - 130; x <= SILVER_LAKE.x + 130; x++) {
      const d = Math.hypot(x - SILVER_LAKE.x, z - SILVER_LAKE.z) + (fbm(x, z, 70, 41) - 0.5) * 46;
      if (d < SILVER_LAKE.r) {
        const i = at(x, z);
        heights[i] = -1;
        blocks[i] = "water";
        biome[i] = BIOME.river;
        locked[i] = 1;
      } else if (d < SILVER_LAKE.r + 3) {
        const i = at(x, z);
        if (blocks[i] !== "water") {
          heights[i] = Math.min(heights[i], 1);
          blocks[i] = "sand";
        }
      }
    }
  }

  // Delta islands: the river mouth breaks into channels around mud bars.
  for (let z = 2260; z < 2460; z++) {
    for (let x = 1560; x < 1900; x++) {
      const i = at(x, z);
      if (blocks[i] === "water" && biome[i] === BIOME.river && cellHash(x >> 3, z >> 3, 613) < 0.22) {
        if (vnoise(x, z, 14, 617) > 0.62) {
          heights[i] = 0;
          blocks[i] = "mud";
          locked[i] = 0;
        }
      }
    }
  }

  // The wadi: a dry sandy bed through the drylands (walkable, no water).
  {
    const path = splinePath(WADI, 3);
    for (const [px, pz] of path) {
      const r = 5 + (vnoise(px, pz, 50, 89) - 0.5) * 3;
      for (let z = Math.max(0, Math.floor(pz - r)); z <= Math.min(W - 1, pz + r); z++) {
        for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, px + r); x++) {
          if (Math.hypot(x - px, z - pz) > r) continue;
          const i = at(x, z);
          if (blocks[i] === "water") continue;
          heights[i] = Math.max(0, heights[i] - 2);
          blocks[i] = "sand";
        }
      }
    }
  }

  // ---- Sea floor & beaches --------------------------------------------------
  for (let z = 0; z < W; z++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, z);
      if (biome[i] === BIOME.sea) {
        if (heights[i] <= 0) {
          heights[i] = -1;
          blocks[i] = "water";
          locked[i] = 1;
        } else {
          // Offshore rocks and skerries survive above the swell.
          blocks[i] = "stone";
        }
      } else if (biome[i] === BIOME.coast && blocks[i] === "grass") {
        // Dunes and drygrass belt before the sand proper.
        const saltiness = smoothstep(120, 20, Math.abs(x + z - 4230));
        const r = cellHash(x, z, 99);
        if (r < saltiness * 0.85) blocks[i] = r < saltiness * 0.45 ? "sand" : "drygrass";
        if (heights[i] > 6) heights[i] = 6;
      }
    }
  }

  // ---- Surface dressing by biome -------------------------------------------
  for (let z = 0; z < W; z++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, z);
      if (blocks[i] !== "grass") continue; // water, sand, mud already placed
      const b = biome[i];
      const h = heights[i];
      const r = cellHash(x, z, 7);
      switch (b) {
        case BIOME.mountain:
          blocks[i] = h > 26 ? "snow" : h > 19 ? "stone" : r < 0.5 ? "stone" : "drygrass";
          break;
        case BIOME.highland:
          blocks[i] = h > 24 ? "snow" : h > 18 ? "stone" : r < 0.25 ? "stone" : "grass";
          break;
        case BIOME.taiga:
          blocks[i] = h > 14 && r < 0.6 ? "snow" : r < 0.12 ? "dirt" : "grass";
          break;
        case BIOME.desert:
          blocks[i] = r < 0.55 ? "sand" : r < 0.8 ? "redsand" : "drygrass";
          break;
        case BIOME.swamp:
          blocks[i] = r < 0.45 ? "mud" : r < 0.7 ? "drygrass" : "grass";
          break;
        case BIOME.forest:
          blocks[i] = r < 0.08 ? "dirt" : "grass";
          break;
        default:
          break;
      }
    }
  }

  // Swamp pools: still, shallow water in the deepest fen.
  for (let z = 1800; z < 2440; z++) {
    for (let x = 780; x < 1620; x++) {
      const i = at(x, z);
      if (biome[i] !== BIOME.swamp || blocks[i] === "water") continue;
      if (heights[i] <= 1 && fbm(x, z, 46, 143) > 0.66) {
        heights[i] = -1;
        blocks[i] = "water";
        locked[i] = 1;
      }
    }
  }

  relaxWalkability(heights, blocks, locked, W);

  return { heights, blocks, biome, locked, at };
}

/**
 * Global walkability relaxation: repeated sweeps pull every unlocked cell
 * down to within one block of its lowest unlocked cardinal neighbour, so
 * natural slopes are stairs a walker can take anywhere. Deliberate cliffs
 * get re-cut after this by the features pass (and only off the roads).
 */
export function relaxWalkability(
  heights: number[],
  blocks: BlockType[],
  locked: Uint8Array,
  W: number,
  passes = 8,
): void {
  const at = (x: number, z: number) => z * W + x;
  for (let pass = 0; pass < passes; pass++) {
    let changed = 0;
    const sweep = (x: number, z: number) => {
      const i = at(x, z);
      if (locked[i] || blocks[i] === "water") return;
      let minN = Infinity;
      if (x > 0 && blocks[i - 1] !== "water") minN = Math.min(minN, heights[i - 1]);
      if (x < W - 1 && blocks[i + 1] !== "water") minN = Math.min(minN, heights[i + 1]);
      if (z > 0 && blocks[i - W] !== "water") minN = Math.min(minN, heights[i - W]);
      if (z < W - 1 && blocks[i + W] !== "water") minN = Math.min(minN, heights[i + W]);
      if (minN !== Infinity && heights[i] > minN + 1) {
        heights[i] = minN + 1;
        changed++;
      }
    };
    if (pass % 2 === 0) {
      for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) sweep(x, z);
    } else {
      for (let z = W - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) sweep(x, z);
    }
    if (changed === 0) break;
  }
}
