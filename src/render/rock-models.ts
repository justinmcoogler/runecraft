// Voxel rock models sliced from the user-licensed asset schematics.
// Boulders in the wild pick a small model deterministically; the big
// outcrops are reserved for future set-dressing.

import * as THREE from "three";
import { ROCKS_JSON } from "../content/rocks-data";
import { isModelEnabled } from "./model-prefs";

export interface RockModel {
  id: string;
  r: number;
  h: number;
  /** Solid block count. */
  n: number;
  /** RLE voxels: 5 bytes per run (y, z+32, x0+32, len, material). */
  runs: Uint8Array;
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const MODELS: RockModel[] = (JSON.parse(ROCKS_JSON).rocks as Array<Record<string, unknown>>).map((t) => ({
  id: t.id as string,
  r: t.r as number,
  h: t.h as number,
  n: t.n as number,
  runs: decodeBase64(t.vox as string),
}));
MODELS.sort((a, b) => a.n - b.n);

/** Every sliced rock model (settings gallery). */
export const ROCK_MODELS_ALL: readonly RockModel[] = MODELS;

/** Boulder-sized rocks: small enough to sit on one nav cell politely. */
const BOULDERS = MODELS.filter((m) => m.n <= 40 && m.r <= 2 && m.h <= 4);

export function pickBoulderModel(roll: number): RockModel | null {
  const pool = BOULDERS.filter((m) => isModelEnabled(m.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(roll * pool.length) % pool.length];
}

/** Mineable-ore rocks: a touch bigger than a boulder so an ore node reads as a
 *  real outcrop, but still confined to roughly one cell. */
const MINING_ROCKS = MODELS.filter((m) => m.r <= 3 && m.h <= 5 && m.n >= 6);

export function pickMiningRock(roll: number): RockModel | null {
  const pool = (MINING_ROCKS.length ? MINING_ROCKS : BOULDERS).filter((m) => isModelEnabled(m.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(roll * pool.length) % pool.length];
}

/** Materials by slice id: 0 stone, 1 cobble, 2 gravel, 3 mossy. */
export const ROCK_MATERIAL_TILES = ["terrain.stone", "terrain.stone", "terrain.dirt", "terrain.stone"];
export const ROCK_MATERIAL_TINTS: Array<string | null> = [null, "#9a9a9a", "#8d8272", "#7fa06b"];

const geoCache = new Map<string, THREE.BufferGeometry[]>();
const enc = (x: number, y: number, z: number) => (x + 32) + (z + 32) * 64 + y * 4096 + 1;

/** One face-culled geometry per material present in the model (cached, shared). */
export function rockGeometry(model: RockModel): THREE.BufferGeometry[] {
  const hit = geoCache.get(model.id);
  if (hit) return hit;
  const occ = new Set<number>();
  const voxels: Array<[number, number, number, number]> = [];
  for (let i = 0; i < model.runs.length; i += 5) {
    const y = model.runs[i];
    const z = model.runs[i + 1] - 32;
    const x0 = model.runs[i + 2] - 32;
    const len = model.runs[i + 3];
    const m = model.runs[i + 4];
    for (let k = 0; k < len; k++) {
      voxels.push([x0 + k, y, z, m]);
      occ.add(enc(x0 + k, y, z));
    }
  }
  const FACES: Array<{ d: [number, number, number]; c: number[][] }> = [
    { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  const pos: number[][] = [[], [], [], []];
  const norm: number[][] = [[], [], [], []];
  const uv: number[][] = [[], [], [], []];
  const idx: number[][] = [[], [], [], []];
  for (const [x, y, z, m] of voxels) {
    for (const f of FACES) {
      if (occ.has(enc(x + f.d[0], y + f.d[1], z + f.d[2]))) continue;
      const base = pos[m].length / 3;
      for (const [cx, cy, cz] of f.c) {
        pos[m].push(x - 0.5 + cx, y + cy, z - 0.5 + cz);
        norm[m].push(f.d[0], f.d[1], f.d[2]);
      }
      uv[m].push(0, 0, 1, 0, 1, 1, 0, 1);
      idx[m].push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const out: THREE.BufferGeometry[] = [];
  for (let m = 0; m < 4; m++) {
    if (pos[m].length === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos[m], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(norm[m], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv[m], 2));
    g.setIndex(idx[m]);
    g.userData.shared = true;
    g.userData.material = m;
    out.push(g);
  }
  geoCache.set(model.id, out);
  return out;
}
