// Derive walkable interior regions from an imported structure's actual
// floor plan. Each storey becomes a RegionSpec (heightmap walls + floor),
// stairs found in the build link storeys, door panels become the way out,
// and recognizable furnishings (chests, furnaces, enchanting tables) become
// real interactive objects — so the inside of an imported castle matches
// the build it came from.

import { getStructure } from "../content/structures";
import type { StructureAsset, StructureBlock } from "../structures/types";
import type { Cell } from "./types";
import type { BlockType, NpcPlacement, ObjectPlacement, RegionSpec } from "./world";

export interface InteriorPlan {
  /** Ordered ground-up region ids, e.g. castle_hall then castle_upper. */
  regionIds: string[];
  /** Exit of the ground storey (where the outside door drops the player). */
  exit: { targetRegionId: string; targetCell: Cell };
  /** Gameplay guarantees injected if the floor plan lacks them. */
  ensureEnchanter?: boolean;
  npcs?: NpcPlacement[];
  chestItems?: Array<{ itemId: string; qty: number }>;
}

const MIN_STOREY_CELLS = 24;

/** Blocks that support a walker standing on top of them. */
function isSupport(b: StructureBlock): boolean {
  return b.kind === "cube" || b.kind === "slab" || b.kind === "stairs" || b.kind === "thin";
}

/** Blocks that stop a walker occupying their cell. */
function isObstruction(b: StructureBlock): boolean {
  if (b.kind === "glow" || b.kind === "panel") return false; // lights, doors
  if (b.kind === "thin" && !b.top) return false; // carpets
  return true;
}

function floorBlockType(support: StructureBlock | undefined): BlockType {
  const material = support?.material ?? "";
  if (material.includes("plank") || material.startsWith("roof.")) return "plank";
  if (material.includes("stonebrick")) return "stonebrick";
  if (material.includes("stone") || material.includes("slate")) return "stone";
  return "plank";
}

/**
 * Derive one region per storey of a structure. Deterministic: same asset,
 * same plan. The ground storey gets the outside door; storeys are linked
 * by stairs found in the build (or the nearest overlapping floor cells).
 */
export function deriveInteriors(structureId: string, plan: InteriorPlan): RegionSpec[] {
  const asset = getStructure(structureId);
  if (!asset) throw new Error(`deriveInteriors: unknown structure ${structureId}`);
  const { sx, sy, sz } = asset;

  // Index the asset into flat masks (the scan below touches every voxel).
  const vol = sx * sy * sz;
  const idx3 = (x: number, y: number, z: number) => (y * sz + z) * sx + x;
  const supportMask = new Uint8Array(vol);
  const obstructionMask = new Uint8Array(vol);
  const supports = new Map<number, StructureBlock>(); // idx3 -> support block
  const doors: StructureBlock[] = [];
  const stairsBlocks: StructureBlock[] = [];
  const furnishings: StructureBlock[] = [];
  for (const b of asset.blocks) {
    const i = idx3(b.x, b.y, b.z);
    if (isSupport(b)) {
      supportMask[i] = 1;
      supports.set(i, b);
    }
    if (isObstruction(b)) obstructionMask[i] = 1;
    if (b.kind === "panel") doors.push(b);
    if (b.kind === "stairs") stairsBlocks.push(b);
    if (
      b.material === "object.chest.side" ||
      b.material === "object.furnace.side" ||
      b.color === "#a4243b" // the enchanting table's cloth
    ) {
      furnishings.push(b);
    }
  }
  // Topmost BUILT block per column, to tell roofed interior from open
  // ground. Vegetation doesn't count as a roof — an overgrown lawn under a
  // tree canopy is still outdoors.
  const topY = new Int16Array(sx * sz).fill(-1);
  for (const b of asset.blocks) {
    if (b.material === "resource.tree.leaves" || b.material === "resource.tree.log.side") continue;
    const col = b.z * sx + b.x;
    if (b.y > topY[col]) topY[col] = b.y;
  }
  const walkableAt = (x: number, y: number, z: number) =>
    x >= 0 && z >= 0 && x < sx && z < sz && y >= 1 && y + 1 < sy &&
    supportMask[idx3(x, y - 1, z)] === 1 &&
    obstructionMask[idx3(x, y, z)] === 0 &&
    obstructionMask[idx3(x, y + 1, z)] === 0;
  /** Interior cells have cover overhead — open lawns and rooftops don't count. */
  const roofedAt = (x: number, y: number, z: number) => topY[z * sx + x] > y + 1;
  const interiorAt = (x: number, y: number, z: number) =>
    walkableAt(x, y, z) && roofedAt(x, y, z);

  // Storey candidates: walking levels with substantial roofed floor.
  const levelCounts = new Map<number, number>();
  for (let y = 1; y < sy - 1; y++) {
    let count = 0;
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) if (interiorAt(x, y, z)) count++;
    }
    if (count >= MIN_STOREY_CELLS) levelCounts.set(y, count);
  }
  // Cluster adjacent levels (split-level floors): keep local maxima that are
  // at least 4 apart so each storey appears once.
  const levels: number[] = [];
  for (const [y, count] of [...levelCounts.entries()].sort((a, b) => b[1] - a[1])) {
    if (levels.every((chosen) => Math.abs(chosen - y) >= 4)) levels.push(y);
    void count;
  }
  levels.sort((a, b) => a - b);
  const storeys = levels.slice(0, plan.regionIds.length);
  if (storeys.length === 0) throw new Error(`deriveInteriors: ${structureId} has no walkable storeys`);

  // Largest connected walkable component per storey.
  const storeyCells: Array<Set<string>> = storeys.map((y) => {
    const seen = new Set<string>();
    let best = new Set<string>();
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const start = `${x},${z}`;
        if (seen.has(start) || !interiorAt(x, y, z)) continue;
        const component = new Set<string>();
        const queue: Cell[] = [{ x, z }];
        seen.add(start);
        component.add(start);
        while (queue.length > 0) {
          const c = queue.pop()!;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = c.x + dx, nz = c.z + dz;
            const nk = `${nx},${nz}`;
            if (seen.has(nk) || !interiorAt(nx, y, nz)) continue;
            seen.add(nk);
            component.add(nk);
            queue.push({ x: nx, z: nz });
          }
        }
        if (component.size > best.size) best = component;
      }
    }
    return best;
  });

  const regions: RegionSpec[] = [];
  const frames: Array<{ x0: number; z0: number }> = [];
  const pendingLandings: Array<{
    upperRegion: string;
    upperLanding: Cell;
    lowerRegion: string;
    lowerLanding: Cell;
  }> = [];
  for (let s = 0; s < storeys.length; s++) {
    const y = storeys[s];
    const cells = storeyCells[s];
    if (cells.size < MIN_STOREY_CELLS && s > 0) break;
    const parse = (key: string): Cell => {
      const [x, z] = key.split(",").map(Number);
      return { x, z };
    };
    // Region frame: bbox of the floor plus a wall ring.
    let x0 = sx, x1 = 0, z0 = sz, z1 = 0;
    for (const key of cells) {
      const c = parse(key);
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
      z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z);
    }
    x0 -= 1; z0 -= 1; x1 += 1; z1 += 1;
    const width = x1 - x0 + 1;
    const depth = z1 - z0 + 1;
    const local = (c: Cell): Cell => ({ x: c.x - x0, z: c.z - z0 });
    const heights = new Array<number>(width * depth).fill(2);
    const blocks = new Array<BlockType>(width * depth).fill("stone");
    for (const key of cells) {
      const c = parse(key);
      const l = local(c);
      heights[l.z * width + l.x] = 0;
      blocks[l.z * width + l.x] = floorBlockType(supports.get(idx3(c.x, y - 1, c.z)));
    }

    const objects: ObjectPlacement[] = [];
    const regionId = plan.regionIds[s];
    let spawn: Cell | null = null;

    // Ground storey: the way out is the build's own door panel bordering
    // the floor (nearest the structure's south face wins), or the
    // southernmost floor cell when the build has no door.
    if (s === 0) {
      const doorCells = doors
        .filter((d) => Math.abs(d.y - y) <= 1)
        .map((d) => ({ x: d.x, z: d.z }))
        .filter((c) => cells.has(`${c.x},${c.z}`) ||
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cells.has(`${c.x + dx},${c.z + dz}`)));
      let doorCell = doorCells.sort((a, b) => b.z - a.z)[0];
      if (!doorCell) {
        doorCell = [...cells].map(parse).sort((a, b) => b.z - a.z)[0];
      }
      const l = local(doorCell);
      heights[l.z * width + l.x] = 0;
      objects.push({
        instanceId: `${regionId}.door.out`,
        defId: "object.door.wood",
        cell: l,
        portal: plan.exit,
      });
      const inside = [[0, -1], [1, 0], [-1, 0], [0, 1]]
        .map(([dx, dz]) => ({ x: doorCell.x + dx, z: doorCell.z + dz }))
        .find((c) => cells.has(`${c.x},${c.z}`));
      spawn = local(inside ?? doorCell);
    }

    // Stairs between this storey and the one above: prefer real stair
    // blocks in the connecting column range, else the nearest floor overlap.
    if (s + 1 < storeys.length && plan.regionIds[s + 1]) {
      const upperY = storeys[s + 1];
      const upperCells = storeyCells[s + 1];
      const candidates = stairsBlocks
        .filter((b) => b.y > y && b.y < upperY + 1)
        .map((b) => ({ x: b.x, z: b.z }));
      const near = (set: Set<string>, c: Cell, r: number): Cell | null => {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (set.has(`${c.x + dx},${c.z + dz}`)) return { x: c.x + dx, z: c.z + dz };
          }
        }
        return null;
      };
      let lowerLanding: Cell | null = null;
      let upperLanding: Cell | null = null;
      for (const c of candidates) {
        const lower = near(cells, c, 2);
        const upper = near(upperCells, c, 2);
        if (lower && upper) {
          lowerLanding = lower;
          upperLanding = upper;
          break;
        }
      }
      if (!lowerLanding || !upperLanding) {
        // No stair blocks — link where the floors overlap in plan.
        for (const key of upperCells) {
          const c = parse(key);
          const lower = near(cells, c, 1);
          if (lower) {
            lowerLanding = lower;
            upperLanding = c;
            break;
          }
        }
      }
      if (lowerLanding && upperLanding) {
        objects.push({
          instanceId: `${regionId}.stairs.up`,
          defId: "object.stairs.up",
          cell: local(lowerLanding),
          portal: { targetRegionId: plan.regionIds[s + 1], targetCell: { x: -1, z: -1 } }, // fixed below
        });
        // Remember the world-frame landing for the upper storey to resolve.
        pendingLandings.push({ upperRegion: plan.regionIds[s + 1], upperLanding, lowerRegion: regionId, lowerLanding });
      }
    }

    // Furnishings from the build itself.
    let furnitureCount = 0;
    let chestSeeded = false;
    let enchanterFound = false;
    for (const f of furnishings) {
      if (f.y < y - 1 || f.y > y + 1) continue;
      const beside = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dz]) => ({ x: f.x + dx, z: f.z + dz }))
        .find((c) => cells.has(`${c.x},${c.z}`));
      if (!beside) continue;
      const l = local({ x: f.x, z: f.z });
      if (l.x < 0 || l.z < 0 || l.x >= width || l.z >= depth) continue;
      heights[l.z * width + l.x] = 0;
      blocks[l.z * width + l.x] = "plank";
      furnitureCount++;
      if (f.material === "object.chest.side") {
        objects.push({
          instanceId: `${regionId}.chest.${furnitureCount}`,
          defId: "object.storage_chest.basic",
          cell: l,
          initialItems: !chestSeeded ? plan.chestItems : undefined,
        });
        chestSeeded = true;
      } else if (f.material === "object.furnace.side") {
        objects.push({ instanceId: `${regionId}.furnace.${furnitureCount}`, defId: "object.furnace.basic", cell: l });
      } else {
        objects.push({ instanceId: `${regionId}.enchanter.${furnitureCount}`, defId: "object.enchanter.basic", cell: l });
        enchanterFound = true;
      }
    }

    // Gameplay guarantees the floor plan may not include. Injected objects
    // and NPCs must be REACHABLE from the door — the build's own furniture
    // can wall off floor pockets, so order candidate cells by a BFS from
    // the spawn over unoccupied floor.
    const taken = new Set(objects.filter((o) => !o.portal).map((o) => `${o.cell.x},${o.cell.z}`));
    const reachable: Cell[] = [];
    if (spawn) {
      const visited = new Set([`${spawn.x},${spawn.z}`]);
      const queue: Cell[] = [spawn];
      while (queue.length > 0) {
        const c = queue.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = { x: c.x + dx, z: c.z + dz };
          const nk = `${n.x},${n.z}`;
          if (visited.has(nk)) continue;
          if (n.x < 0 || n.z < 0 || n.x >= width || n.z >= depth) continue;
          if (heights[n.z * width + n.x] !== 0) continue;
          if (taken.has(nk)) continue;
          visited.add(nk);
          reachable.push(n);
          queue.push(n);
        }
      }
    }
    let nextFree = 2; // skip the cells right at the door
    const freeCell = (): Cell | null => {
      while (nextFree < reachable.length) {
        const c = reachable[nextFree++];
        if (!taken.has(`${c.x},${c.z}`)) {
          taken.add(`${c.x},${c.z}`);
          return c;
        }
      }
      return null;
    };
    if (s === 0 && plan.ensureEnchanter && !enchanterFound) {
      const cell = freeCell();
      if (cell) objects.push({ instanceId: `${regionId}.enchanter.extra`, defId: "object.enchanter.basic", cell });
    }
    if (s === 0 && !chestSeeded && plan.chestItems) {
      const cell = freeCell();
      if (cell) {
        objects.push({
          instanceId: `${regionId}.chest.extra`,
          defId: "object.storage_chest.basic",
          cell,
          initialItems: plan.chestItems,
        });
      }
    }

    frames.push({ x0, z0 });
    regions.push({
      id: regionId,
      width,
      depth,
      heights,
      blocks,
      nodes: [],
      objects,
      npcs: s === 0
        ? (plan.npcs ?? []).map((n) => ({ ...n, cell: freeCell() ?? spawn ?? { x: 1, z: 1 } }))
        : [],
      enemies: [],
      spawn: spawn ?? local(parse([...cells][0])),
      theme: { sky: "#241d14", sun: 0.7, ambient: 1.05 },
    });
  }

  // Resolve stair landings now that every storey's frame is known.
  for (const pending of pendingLandings) {
    const upperIdx = regions.findIndex((r) => r.id === pending.upperRegion);
    const lowerIdx = regions.findIndex((r) => r.id === pending.lowerRegion);
    if (upperIdx < 0 || lowerIdx < 0) continue;
    const upperRegion = regions[upperIdx];
    const lowerRegion = regions[lowerIdx];
    const upperLocal = {
      x: pending.upperLanding.x - frames[upperIdx].x0,
      z: pending.upperLanding.z - frames[upperIdx].z0,
    };
    const lowerLocal = {
      x: pending.lowerLanding.x - frames[lowerIdx].x0,
      z: pending.lowerLanding.z - frames[lowerIdx].z0,
    };
    const up = lowerRegion.objects.find((o) => o.instanceId === `${pending.lowerRegion}.stairs.up`);
    if (up?.portal) up.portal.targetCell = upperLocal;
    upperRegion.objects.push({
      instanceId: `${pending.upperRegion}.stairs.down`,
      defId: "object.stairs.down",
      cell: upperLocal,
      portal: { targetRegionId: pending.lowerRegion, targetCell: lowerLocal },
    });
    upperRegion.spawn = upperLocal;
  }

  return regions;
}
