// Settlement- and landmark-stamping toolkit. Every builder works on a
// shared Draft: the geography arrays plus the placement lists that become
// the RegionSpec, an occupancy set so props never stack, and the POI
// register that feeds signposts, the world atlas, and the accessibility
// test suite.

import type {
  BlockType,
  EnemyPlacement,
  NodePlacement,
  NpcPlacement,
  ObjectPlacement,
} from "../world";
import type { StructurePlacement } from "../../structures/types";
import type { Geography } from "./geo";
import { cellHash } from "./noise";
import { WORLD } from "./regions";

export interface Poi {
  id: string;
  name: string;
  kind: "settlement" | "dungeon" | "landmark" | "bridge" | "discovery" | "expansion";
  x: number;
  z: number;
  region: string;
  tier: number;
  services?: string[];
  notes?: string;
}

export interface Draft {
  geo: Geography;
  nodes: NodePlacement[];
  objects: ObjectPlacement[];
  npcs: NpcPlacement[];
  enemies: EnemyPlacement[];
  structures: StructurePlacement[];
  pois: Poi[];
  occupied: Set<number>;
  counters: Map<string, number>;
  /** Settlement/site rectangles — wilderness scatter keeps out of these. */
  pads: Array<{ x0: number; x1: number; z0: number; z1: number }>;
  /** Ring cottages placed last, once every hand-set structure exists. */
  pendingCottages: Array<{ prefix: string; x: number; z: number }>;
}

export function makeDraft(geo: Geography): Draft {
  return {
    geo,
    nodes: [],
    objects: [],
    npcs: [],
    enemies: [],
    structures: [],
    pois: [],
    occupied: new Set(),
    counters: new Map(),
    pads: [],
    pendingCottages: [],
  };
}

export const idx = (x: number, z: number) => z * WORLD + x;

export function seq(d: Draft, prefix: string): string {
  const n = (d.counters.get(prefix) ?? 0) + 1;
  d.counters.set(prefix, n);
  return `${prefix}.${String(n).padStart(3, "0")}`;
}

export function reserve(d: Draft, x: number, z: number, r = 0): void {
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) d.occupied.add(idx(x + dx, z + dz));
  }
}

export function isFree(d: Draft, x: number, z: number): boolean {
  if (x < 2 || z < 2 || x >= WORLD - 2 || z >= WORLD - 2) return false;
  if (d.geo.blocks[idx(x, z)] === "water") return false;
  return !d.occupied.has(idx(x, z));
}

/** Every cell in the rectangle is free (used before multi-cell placements). */
export function isAreaFree(d: Draft, x0: number, x1: number, z0: number, z1: number): boolean {
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) if (!isFree(d, x, z)) return false;
  }
  return true;
}

/** Inside (or within `margin` of) any registered settlement pad? */
export function onPad(d: Draft, x: number, z: number, margin = 0): boolean {
  for (const r of d.pads) {
    if (x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin) return true;
  }
  return false;
}

/** Flatten and pave a rectangle; locks it against later relaxation. */
export function pad(
  d: Draft,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  h: number,
  block: BlockType,
): void {
  const { heights, blocks, locked } = d.geo;
  d.pads.push({ x0, x1, z0, z1 });
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, z);
      heights[i] = h;
      blocks[i] = block;
      locked[i] = 1;
    }
  }
}

/** Feather a pad's edges into the countryside (call after pad). */
export function feather(d: Draft, x0: number, x1: number, z0: number, z1: number, h: number): void {
  const { heights, blocks, locked } = d.geo;
  for (let ring = 1; ring <= 4; ring++) {
    for (let z = z0 - ring; z <= z1 + ring; z++) {
      for (let x = x0 - ring; x <= x1 + ring; x++) {
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) continue;
        if (x < 1 || z < 1 || x >= WORLD - 1 || z >= WORLD - 1) continue;
        if (Math.max(x0 - x, x - x1, z0 - z, z - z1) !== ring) continue;
        const i = idx(x, z);
        if (locked[i] || blocks[i] === "water") continue;
        if (heights[i] > h + ring) heights[i] = h + ring;
        else if (heights[i] < h - ring) heights[i] = h - ring;
      }
    }
  }
}

/**
 * Town wall: a raised stone rampart (terrain, so it blocks movement by
 * elevation) with level gate gaps. Gates are where the roads arrive.
 */
export function wallRect(
  d: Draft,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  padH: number,
  gates: Array<{ x: number; z: number; w?: number }>,
): void {
  const { heights, blocks, locked } = d.geo;
  const isGate = (x: number, z: number) =>
    gates.some((g) => Math.abs(x - g.x) <= (g.w ?? 3) && Math.abs(z - g.z) <= (g.w ?? 3));
  for (let x = x0; x <= x1; x++) {
    for (const z of [z0, z1]) {
      if (isGate(x, z)) continue;
      const i = idx(x, z);
      heights[i] = padH + 3;
      blocks[i] = "stonebrick";
      locked[i] = 1;
    }
  }
  for (let z = z0; z <= z1; z++) {
    for (const x of [x0, x1]) {
      if (isGate(x, z)) continue;
      const i = idx(x, z);
      heights[i] = padH + 3;
      blocks[i] = "stonebrick";
      locked[i] = 1;
    }
  }
}

export function obj(
  d: Draft,
  prefix: string,
  defId: string,
  x: number,
  z: number,
  extra?: Partial<ObjectPlacement>,
): ObjectPlacement {
  const placement: ObjectPlacement = { instanceId: seq(d, prefix), defId, cell: { x, z }, ...extra };
  d.objects.push(placement);
  reserve(d, x, z);
  for (const c of placement.footprint ?? []) reserve(d, c.x, c.z);
  return placement;
}

export function node(d: Draft, prefix: string, defId: string, x: number, z: number): void {
  d.nodes.push({ instanceId: seq(d, prefix), defId, cell: { x, z } });
  reserve(d, x, z);
}

export function foe(d: Draft, prefix: string, defId: string, x: number, z: number): void {
  d.enemies.push({ instanceId: seq(d, prefix), defId, cell: { x, z } });
}

export function npc(
  d: Draft,
  instanceId: string,
  name: string,
  x: number,
  z: number,
  wanderRadius: number,
  lines?: string[],
): void {
  d.npcs.push({ instanceId, name, cell: { x, z }, wanderRadius, lines });
}

export function poi(d: Draft, p: Omit<Poi, "id">): void {
  d.pois.push({ id: seq(d, `poi.${p.kind}`), ...p });
}

/** Timber-frame building object (the renderer builds walls from the footprint). */
export function house(
  d: Draft,
  prefix: string,
  defId: string,
  x: number,
  z: number,
  w: number,
  dep: number,
): ObjectPlacement {
  const footprint: Array<{ x: number; z: number }> = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < dep; dz++) {
      if (dx === 0 && dz === 0) continue;
      footprint.push({ x: x + dx, z: z + dz });
    }
  }
  const placement = obj(d, prefix, defId, x, z, { footprint });
  // Roof eaves overhang the footprint by a block on every side: reserve
  // the ring so nothing else builds into the overhang.
  for (let dx = -1; dx <= w; dx++) {
    reserve(d, x + dx, z - 1);
    reserve(d, x + dx, z + dep);
  }
  for (let dz = 0; dz < dep; dz++) {
    reserve(d, x - 1, z + dz);
    reserve(d, x + w, z + dz);
  }
  return placement;
}

/** Room (plus eave ring) for a w x dep building anchored at (x, z)? */
export function houseFits(d: Draft, x: number, z: number, w: number, dep: number): boolean {
  return isAreaFree(d, x - 1, x + w, z - 1, z + dep);
}

export function fenceRun(
  d: Draft,
  prefix: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  gap?: { x: number; z: number },
): void {
  const put = (x: number, z: number) => {
    if (gap && Math.abs(x - gap.x) <= 1 && Math.abs(z - gap.z) <= 1) return;
    if (!isFree(d, x, z)) return;
    obj(d, prefix, "object.fence.wood", x, z);
  };
  for (let x = x0; x <= x1; x++) {
    put(x, z0);
    put(x, z1);
  }
  for (let z = z0 + 1; z < z1; z++) {
    put(x0, z);
    put(x1, z);
  }
}

/** Livestock pen: fence rectangle with a gate gap plus grazing animals. */
export function pen(
  d: Draft,
  prefix: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  animal: string,
  count: number,
): void {
  fenceRun(d, prefix, x0, x1, z0, z1, { x: Math.round((x0 + x1) / 2), z: z1 });
  for (let k = 0; k < count; k++) {
    const x = x0 + 2 + Math.floor(cellHash(x0 + k, z0, 17) * (x1 - x0 - 3));
    const z = z0 + 2 + Math.floor(cellHash(x0, z0 + k, 19) * (z1 - z0 - 3));
    foe(d, prefix, animal, x, z);
  }
}

// ---------------------------------------------------------------------------
// Roadside and wilderness discovery templates.
// ---------------------------------------------------------------------------

export type DiscoveryKind =
  | "campsite"
  | "shrine"
  | "well"
  | "cart"
  | "ruin"
  | "stones"
  | "watchpost"
  | "fishing"
  | "memorial"
  | "bandit";

export function stampDiscovery(
  d: Draft,
  kind: DiscoveryKind,
  x: number,
  z: number,
  prefix: string,
  banditFoe = "enemy.spider",
): void {
  const { heights, blocks } = d.geo;
  const h = heights[idx(x, z)];
  switch (kind) {
    case "campsite":
      obj(d, prefix, "object.campfire.basic", x, z);
      obj(d, prefix, "object.crate.wood", x + 2, z);
      break;
    case "shrine":
      pad(d, x - 1, x + 1, z - 1, z + 1, h, "stonebrick");
      obj(d, prefix, "object.banner.red", x, z - 1);
      obj(d, prefix, "object.campfire.basic", x, z + 1);
      break;
    case "well":
      obj(d, prefix, "object.well.basic", x, z);
      break;
    case "cart":
      obj(d, prefix, "object.crate.wood", x, z);
      obj(d, prefix, "object.barrel.wood", x + 1, z);
      obj(d, prefix, "object.crate.wood", x + 1, z + 1);
      break;
    case "ruin": {
      // Broken stonework: three wall stubs and a floor of old brick.
      pad(d, x - 2, x + 2, z - 2, z + 2, h, "stonebrick");
      for (const [wx, wz] of [[x - 2, z - 2], [x + 2, z - 2], [x - 2, z + 1]] as const) {
        const i = idx(wx, wz);
        heights[i] = h + 2;
        blocks[i] = "stonebrick";
        d.geo.locked[i] = 1;
      }
      obj(d, prefix, "object.crate.wood", x + 1, z + 1);
      break;
    }
    case "stones": {
      for (const [sx, sz] of [[x - 2, z], [x + 2, z], [x, z - 2], [x, z + 2]] as const) {
        const i = idx(sx, sz);
        heights[i] = h + 2;
        blocks[i] = "stone";
        d.geo.locked[i] = 1;
      }
      node(d, prefix, "resource.herb.sage", x, z);
      break;
    }
    case "watchpost":
      obj(d, prefix, "object.spire.small", x, z);
      obj(d, prefix, "object.lamp.post", x + 2, z + 2);
      break;
    case "fishing":
      obj(d, prefix, "object.campfire.basic", x + 2, z);
      node(d, prefix, "resource.fishing.pond", x, z);
      break;
    case "memorial":
      obj(d, prefix, "object.banner.red", x, z);
      break;
    case "bandit":
      obj(d, prefix, "object.campfire.basic", x, z);
      obj(d, prefix, "object.storage_chest.basic", x + 2, z + 1, {
        initialItems: [{ itemId: "item.coin", qty: 12 }],
      });
      foe(d, prefix, banditFoe, x - 2, z);
      foe(d, prefix, banditFoe, x + 2, z - 2);
      break;
  }
}
