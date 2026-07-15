// Voxel props baked from the user-licensed Rebirth/Detail packs: rocks,
// flowers, mushrooms, plants and town dressing. Each model is a palette of
// {color, shape} entries plus RLE voxel runs; here they become a single
// vertex-colored geometry per model (cached, shared across instances).
//
// Shapes: 0 full cube, 1 bottom slab, 2 thin post (fences/panes/walls),
// 3 trapdoor sheet, 4 top slab.

import * as THREE from "three";
import { PROPS_JSON } from "../content/props-data";
import { isModelEnabled } from "./model-prefs";

export interface PropModel {
  id: string;
  cat: string;
  r: number;
  h: number;
  n: number;
  pal: Array<{ c: string; s: number }>;
  runs: Uint8Array;
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const MODELS: PropModel[] = (JSON.parse(PROPS_JSON).models as Array<Record<string, unknown>>).map((m) => ({
  id: m.id as string,
  cat: m.cat as string,
  r: m.r as number,
  h: m.h as number,
  n: m.n as number,
  pal: m.pal as Array<{ c: string; s: number }>,
  runs: decodeBase64(m.vox as string),
}));

export const PROPS_BY_CAT: Record<string, PropModel[]> = {};
for (const m of MODELS) (PROPS_BY_CAT[m.cat] ??= []).push(m);
for (const list of Object.values(PROPS_BY_CAT)) list.sort((a, b) => a.n - b.n);

/** Deterministic pick from a category, optionally filtered by id prefix
 *  and a size ceiling (in solid blocks). */
export function pickProp(cat: string, roll: number, opts?: { prefix?: string; maxN?: number; minN?: number }): PropModel | null {
  let list = (PROPS_BY_CAT[cat] ?? []).filter((m) => isModelEnabled(m.id));
  if (opts?.prefix) list = list.filter((m) => m.id.startsWith(`${cat}.${opts.prefix}`));
  if (opts?.maxN) list = list.filter((m) => m.n <= (opts.maxN as number));
  if (opts?.minN) list = list.filter((m) => m.n >= (opts.minN as number));
  if (list.length === 0) return null;
  return list[Math.floor(roll * list.length) % list.length];
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const enc = (x: number, y: number, z: number) => (x + 32) + (z + 32) * 64 + y * 4096 + 1;

const FACES: Array<{ d: [number, number, number]; c: number[][] }> = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

/** Box extents per shape: [x0, y0, z0, x1, y1, z1] within the unit cell. */
function shapeBox(s: number): [number, number, number, number, number, number] {
  switch (s) {
    case 1: return [0, 0, 0, 1, 0.5, 1];
    case 2: return [0.3125, 0, 0.3125, 0.6875, 1, 0.6875];
    case 3: return [0, 0, 0, 1, 0.1875, 1];
    case 4: return [0, 0.5, 0, 1, 1, 1];
    default: return [0, 0, 0, 1, 1, 1];
  }
}

export function propGeometry(model: PropModel): THREE.BufferGeometry {
  const hit = geoCache.get(model.id);
  if (hit) return hit;
  const occ = new Set<number>();
  const voxels: Array<[number, number, number, number]> = [];
  for (let i = 0; i < model.runs.length; i += 5) {
    const y = model.runs[i];
    const z = model.runs[i + 1] - 32;
    const x0 = model.runs[i + 2] - 32;
    const len = model.runs[i + 3];
    const pi = model.runs[i + 4];
    for (let k = 0; k < len; k++) {
      voxels.push([x0 + k, y, z, pi]);
      if (model.pal[pi]?.s === 0) occ.add(enc(x0 + k, y, z));
    }
  }
  const pos: number[] = [];
  const norm: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const c3 = new THREE.Color();
  for (const [x, y, z, pi] of voxels) {
    const entry = model.pal[pi];
    if (!entry) continue;
    c3.set(entry.c);
    const [bx0, by0, bz0, bx1, by1, bz1] = shapeBox(entry.s);
    const full = entry.s === 0;
    for (const f of FACES) {
      // Full cubes cull faces against neighboring full cubes.
      if (full && occ.has(enc(x + f.d[0], y + f.d[1], z + f.d[2]))) continue;
      const base = pos.length / 3;
      for (const [cx, cy, cz] of f.c) {
        pos.push(
          x - 0.5 + bx0 + (bx1 - bx0) * cx,
          y + by0 + (by1 - by0) * cy,
          z - 0.5 + bz0 + (bz1 - bz0) * cz,
        );
        norm.push(f.d[0], f.d[1], f.d[2]);
        col.push(c3.r, c3.g, c3.b);
      }
      uv.push(0, 0, 1, 0, 1, 1, 0, 1); // one grain tile per face
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.shared = true;
  geoCache.set(model.id, g);
  return g;
}

/** A greyscale surface-grain tile multiplied over each voxel's vertex colour,
 *  so props (flowers, mushrooms, plants, rocks) read as a lightly-worked
 *  surface next to the textured world instead of flat swatches. A darker outer
 *  ring picks out individual voxels. Deterministic (no Math.random). */
function propGrainTexture(): THREE.CanvasTexture {
  const N = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let h = (i * 2654435761) >>> 0;
      h ^= h >>> 15;
      // Wider spread so the grain actually reads as a worked surface rather
      // than a flat swatch — while colour still comes through.
      let n = 188 + (h % 52); // 188..239
      if (h % 7 === 0) n = 255; // bright fleck
      else if (h % 11 === 0) n = 156; // dark pit
      else if (h % 23 === 0) n = 132; // deeper pit
      // A darker rim on two edges bevels each voxel so faces read separately.
      if (x === 0 || y === 0) n = Math.round(n * 0.7);
      else if (x === N - 1 || y === N - 1) n = Math.round(n * 0.82);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let propMaterial: THREE.MeshLambertMaterial | null = null;
/** Shared vertex-color material for all voxel props, grained so voxels read
 *  as surfaces rather than flat colour. */
export function propMat(): THREE.MeshLambertMaterial {
  if (!propMaterial) {
    propMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: propGrainTexture() });
  }
  return propMaterial;
}
