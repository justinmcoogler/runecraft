// Voxel tree models converted from the user-licensed 1k tree pack (see
// scripts/convert-tree-schematics.mjs). Every tree node in the world picks a
// model deterministically from its species' pool, so a stand of oaks is a stand
// of individuals — and the same world seed always grows the same forest.

import * as THREE from "three";
import { TREES_JSON } from "../content/trees-data";
import { isModelEnabled } from "./model-prefs";

export interface TreeModel {
  id: string;
  species: string;
  /** Max |dx|,|dz| from the trunk. */
  r: number;
  h: number;
  /** Log-block count — a good size proxy. */
  logs: number;
  /** RLE voxels: 5 bytes per run (y, z+32, x0+32, len, kind 0=log 1=leaf). */
  runs: Uint8Array;
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const MODELS: TreeModel[] = (JSON.parse(TREES_JSON).trees as Array<Record<string, unknown>>).map((t) => ({
  id: t.id as string,
  species: t.species as string,
  r: t.r as number,
  h: t.h as number,
  logs: t.logs as number,
  runs: decodeBase64(t.vox as string),
}));

export const TREES_BY_SPECIES: Record<string, TreeModel[]> = {};
for (const m of MODELS) (TREES_BY_SPECIES[m.species] ??= []).push(m);
for (const list of Object.values(TREES_BY_SPECIES)) list.sort((a, b) => a.h - b.h || a.logs - b.logs);

/** Species not present in the imported pack borrow the nearest one's silhouette
 *  (the fantasy woods, plus acacia which this pack doesn't include). */
const SPECIES_ALIAS: Record<string, string> = {
  blossom: "birch",
  ember: "darkoak",
  glow: "jungle",
  dusk: "darkoak",
  acacia: "oak",
};

/**
 * Pick a model for a tree node: wild trees draw from the everyday pool
 * (height <= 14), grand trees from the big pool. `roll` in [0,1) keeps the
 * choice deterministic per instance.
 */
export function pickTreeModel(species: string, grand: boolean, roll: number): TreeModel | null {
  const all = TREES_BY_SPECIES[SPECIES_ALIAS[species] ?? species];
  if (!all || all.length === 0) return null;
  const list = all.filter((m) => isModelEnabled(m.id));
  if (list.length === 0) return null;
  const wild = list.filter((m) => m.h <= 14);
  const big = list.filter((m) => m.h > 14 && m.h <= 44);
  const pool = grand ? (big.length ? big : list) : wild.length ? wild : list;
  return pool[Math.floor(roll * pool.length) % pool.length];
}

/** Friendly display size for the click-to-identify toast. */
export function describeTreeModel(m: TreeModel): string {
  if (m.h >= 30) return "towering";
  if (m.h >= 15) return "grown";
  if (m.h <= 6) return "young";
  return "";
}

/** Small deterministic hash -> [0,1); shared by the renderer's variety
 *  picks and the HUD's click-to-identify label so both see the same tree. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * The click-to-identify label for a tree node: "Towering Grand Oak",
 * "Young Silver Birch", … resolved from the same deterministic pick the
 * renderer used to grow it.
 */
export function treeTapLabel(view: string, viewMaterial: string | undefined, defName: string, instanceId: string): string {
  const grand = view === "tree.grand";
  const species = grand ? (viewMaterial ?? "oak") : view === "tree" ? "oak" : view.slice("tree.".length);
  const model = pickTreeModel(species, grand, hash01(instanceId));
  const size = model ? describeTreeModel(model) : "";
  const label = size ? `${size[0].toUpperCase()}${size.slice(1)} ${defName}` : defName;
  return label;
}

const geoCache = new Map<string, { log: THREE.BufferGeometry; leaf: THREE.BufferGeometry; baseCells: number }>();

const enc = (x: number, y: number, z: number) => (x + 32) + (z + 32) * 64 + y * 4096 + 1;

/**
 * Merged geometry for one model, split into log and leaf halves so each can
 * carry its species material. Faces between touching voxels are culled.
 * Geometries are cached and shared across every instance of the model.
 */
export function treeGeometry(model: TreeModel): { log: THREE.BufferGeometry; leaf: THREE.BufferGeometry; baseCells: number } {
  const hit = geoCache.get(model.id);
  if (hit) return hit;

  const occ = new Set<number>();
  const voxels: Array<[number, number, number, number]> = [];
  let baseCells = 0;
  for (let i = 0; i < model.runs.length; i += 5) {
    const y = model.runs[i];
    const z = model.runs[i + 1] - 32;
    const x0 = model.runs[i + 2] - 32;
    const len = model.runs[i + 3];
    const kind = model.runs[i + 4];
    for (let k = 0; k < len; k++) {
      voxels.push([x0 + k, y, z, kind]);
      occ.add(enc(x0 + k, y, z));
      if (y === 0 && kind === 0) baseCells++;
    }
  }

  // One quad per exposed face. Positions are centered on the trunk cell.
  const pos: Record<number, number[]> = { 0: [], 1: [] };
  const norm: Record<number, number[]> = { 0: [], 1: [] };
  const uv: Record<number, number[]> = { 0: [], 1: [] };
  const idx: Record<number, number[]> = { 0: [], 1: [] };
  const FACES: Array<{ d: [number, number, number]; c: number[][] }> = [
    { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  for (const [x, y, z, kind] of voxels) {
    for (const f of FACES) {
      if (occ.has(enc(x + f.d[0], y + f.d[1], z + f.d[2]))) continue;
      const base = pos[kind].length / 3;
      for (const [cx, cy, cz] of f.c) {
        pos[kind].push(x - 0.5 + cx, y + cy, z - 0.5 + cz);
        norm[kind].push(f.d[0], f.d[1], f.d[2]);
      }
      uv[kind].push(0, 0, 1, 0, 1, 1, 0, 1);
      idx[kind].push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  const build = (kind: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos[kind], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(norm[kind], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv[kind], 2));
    g.setIndex(idx[kind]);
    // Cached and shared across every instance of this model — the renderer
    // must never dispose it when one tree streams out.
    g.userData.shared = true;
    return g;
  };
  const entry = { log: build(0), leaf: build(1), baseCells: Math.max(1, baseCells) };
  geoCache.set(model.id, entry);
  return entry;
}
