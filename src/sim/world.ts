// World state: block grid (authoritative walkability/elevation) + placed
// objects. The overworld is the 2500x2500 starter province produced by
// sim/worldgen; dungeons and building interiors are their own regions.

import type { BlockType } from "../content/blocks";
import { isLiquid, isObstacle, isSolid, surfaceOffset } from "../content/blocks";
import { getStructure } from "../content/structures";
import type { StructurePlacement } from "../structures/types";
import type { InteriorPlan } from "../structures/interior-plan";
import { houseInteriorPlan } from "../structures/interior-plan";
import type { Cell } from "./types";
import { cellKey } from "./types";
import { buildOverworld } from "./worldgen/overworld";
import { WORLD } from "./worldgen/regions";
import { BUILD_SITES, DUNGEON_DOORS, MADE_DUNGEONS } from "./worldgen/settlements";
import { buildDynamicDungeon } from "./worldgen/dungeons";

export type { Cell };

/** The starter province is 2500x2500 blocks (X and Z both 0–2499). */
export const WORLD_SIZE = WORLD;

/**
 * Persistent world-state repairs (construction quest flags). Construction
 * only ever ADDS walkability — no flag can strand a player.
 */
export function applyWorldFlags(region: RegionSpec, flags: Iterable<string>): void {
  // Conquered endless dungeons: once the finale boss is down for good, its
  // floor reads as claimed on every return — no boss, no elite guard, the
  // prize looted and the war-banners struck. The cleared flag is keyed to the
  // dungeon's (style, seed); the id also carries this floor's depth/maxDepth,
  // so only the finale floor is stripped and the descent still has teeth.
  const dyn = region.id.match(/^dyn_([a-z]+)_(\d+)_(\d+)_(\d+)_/);
  if (dyn) {
    const [, style, seed, depthS, maxS] = dyn;
    const depth = Number(depthS);
    const maxDepth = Number(maxS);
    const flagSet = flags instanceof Set ? (flags as Set<string>) : new Set(flags);
    if (maxDepth > 0 && depth >= maxDepth && flagSet.has(`cleared.dungeon.${style}.${seed}`)) {
      if (region.enemies) {
        region.enemies = region.enemies.filter(
          (e) => !e.instanceId.endsWith(".boss") && !e.instanceId.endsWith(".elite"),
        );
      }
      region.objects = region.objects.filter(
        (o) => !o.instanceId.endsWith(".prize") && !o.instanceId.includes(".banner."),
      );
    }
    return;
  }
  if (region.id !== "region.vale_clearing") return;
  const at = (x: number, z: number) => z * region.width + x;
  const lay = (x0: number, x1: number, z0: number, z1: number, block: BlockType, h: number) => {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        region.heights[at(x, z)] = h;
        region.blocks[at(x, z)] = block;
      }
    }
  };
  for (const flag of flags) {
    if (flag === "worldstate.jetty_built") {
      // A plank jetty running out into the Silverlake.
      lay(BUILD_SITES.jetty.x, BUILD_SITES.jetty.x + 7, BUILD_SITES.jetty.z - 1, BUILD_SITES.jetty.z + 1, "plank", 0);
    } else if (flag === "worldstate.footbridge_built") {
      // The repaired footbridge over the Merewater.
      lay(BUILD_SITES.footbridge.x - 1, BUILD_SITES.footbridge.x + 1, BUILD_SITES.footbridge.z - 8, BUILD_SITES.footbridge.z + 8, "plank", 0);
    } else if (flag === "worldstate.ford_built") {
      // Stepping stones across the lower Silverrun.
      lay(BUILD_SITES.ford.x, BUILD_SITES.ford.x + 18, BUILD_SITES.ford.z - 1, BUILD_SITES.ford.z + 1, "stone", 0);
    } else if (flag === "worldstate.ramp_built") {
      // A stepped dirt ramp levelling the bank on the Ironroot road:
      // interpolate between the ground at both ends, one block per step.
      const { x, z } = BUILD_SITES.ramp;
      const bottom = region.heights[at(x, z + 1)];
      const top = region.heights[at(x, z - 3)];
      for (let step = 0; step < 3; step++) {
        const t = (step + 1) / 4;
        const h = Math.round(bottom + (top - bottom) * t);
        lay(x - 1, x + 1, z - step, z - step, "dirt", h);
      }
    }
  }
}

// The block palette and its per-type behavior live in the block registry
// (content/blocks.ts); re-exported here since so many modules import it from
// the world module.
export type { BlockType } from "../content/blocks";

export interface NodePlacement {
  instanceId: string;
  defId: string;
  cell: Cell;
  /**
   * Imported-structure visual (grand trees): the node's cell is the trunk
   * base; the structure is drawn offset by its anchor and its ground
   * footprint blocks navigation while the node stands.
   */
  structureId?: string;
}

export interface ObjectPlacement {
  instanceId: string;
  defId: string;
  cell: Cell;
  /** Items seeded into a fresh container (ignored when a save restores contents). */
  initialItems?: Array<{ itemId: string; qty: number }>;
  /** Interacting walks over and travels to another region. `instant` enters on
   *  the click without walking there — a building you step straight into. */
  portal?: { targetRegionId: string; targetCell: Cell; instant?: boolean };
  /** Extra cells this object occupies (multi-cell buildings). */
  footprint?: Cell[];
  /** Which way a door/oriented prop faces (its outward side). Default north. */
  facing?: "north" | "south" | "east" | "west";
}

export interface NpcPlacement {
  instanceId: string;
  name: string;
  cell: Cell;
  wanderRadius: number;
  /** Small talk shown when the player greets this NPC. */
  lines?: string[];
  /** A baked mob-model id (e.g. "mob.villager") to render instead of the
   *  default humanoid character skin — for villagers, traders, the iron golem. */
  model?: string;
}

export interface EnemyPlacement {
  instanceId: string;
  defId: string;
  cell: Cell;
}

export interface RegionSpec {
  id: string;
  width: number;
  depth: number;
  /** Top-surface elevation per cell; water cells use -1. */
  heights: number[]; // index = z * width + x
  blocks: BlockType[]; // index = z * width + x
  nodes: NodePlacement[];
  objects: ObjectPlacement[];
  npcs: NpcPlacement[];
  enemies?: EnemyPlacement[];
  /** Imported Minecraft structures anchored at their min corner. */
  structures?: StructurePlacement[];
  spawn: Cell;
  /** Rendering mood (sky color, light intensities). Defaults to daylight. */
  theme?: { sky: string; sun: number; ambient: number };
}

/** Terrain served by generator instead of arrays (the endless world). */
export interface TerrainSource {
  heightAt(x: number, z: number): number;
  blockAt(x: number, z: number): BlockType;
}

export class WorldState {
  readonly region: RegionSpec;
  private blockers = new Map<string, string>(); // cellKey -> instanceId
  /** Absolute walk-surface height for cells inside imported structures (their
   *  floors/steps), so a build's blocks are climbable like Minecraft blocks
   *  rather than one flat blob. Terrain rendering still uses heightAt. */
  private surfaces = new Map<string, number>();
  /** When present, terrain reads bypass the region arrays entirely. */
  private source?: TerrainSource;

  constructor(region: RegionSpec, source?: TerrainSource) {
    this.region = region;
    this.source = source;
  }

  inBounds(c: Cell): boolean {
    return c.x >= 0 && c.z >= 0 && c.x < this.region.width && c.z < this.region.depth;
  }

  heightAt(c: Cell): number {
    if (this.source) return this.source.heightAt(c.x, c.z);
    return this.region.heights[c.z * this.region.width + c.x];
  }

  blockAt(c: Cell): BlockType {
    if (this.source) return this.source.blockAt(c.x, c.z);
    return this.region.blocks[c.z * this.region.width + c.x];
  }

  /** The y a walker actually stands on: an imported structure's floor/step
   *  surface when present, else the cell floor plus the block's shape offset
   *  (a raised half-block for slabs/stairs). Equals heightAt for every full
   *  cube on open terrain, so the flat-cube world is unaffected. */
  surfaceY(c: Cell): number {
    const s = this.surfaces.get(cellKey(c));
    if (s !== undefined) return s;
    return this.heightAt(c) + surfaceOffset(this.blockAt(c));
  }

  /** The nearest walkable cell to `near` within `maxR` (spiral out), or null.
   *  Used to snap a click that lands on a wall/roof to a reachable floor cell. */
  nearestWalkable(near: Cell, maxR = 8): Cell | null {
    if (this.walkable(near)) return near;
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const c = { x: near.x + dx, z: near.z + dz };
          if (this.walkable(c)) return c;
        }
      }
    }
    return null;
  }

  /** Record a walkable structure surface (absolute height) at a cell. */
  setSurface(cell: Cell, y: number): void {
    this.surfaces.set(cellKey(cell), y);
  }
  clearSurface(cell: Cell): void {
    this.surfaces.delete(cellKey(cell));
  }

  registerBlocker(instanceId: string, cell: Cell): void {
    this.blockers.set(cellKey(cell), instanceId);
  }

  unregisterBlocker(cell: Cell): void {
    this.blockers.delete(cellKey(cell));
  }

  blockerAt(c: Cell): string | undefined {
    return this.blockers.get(cellKey(c));
  }

  /** Debug: when on, movement ignores collision and elevation — walk anywhere,
   *  climb anything (set from the debug menu). */
  noclip = false;

  /** A cell a character may stand on (terrain rules + object blockers).
   *  `boat` lets the player float over open water. */
  walkable(c: Cell, boat = false): boolean {
    if (!this.inBounds(c)) return false;
    if (this.noclip) return true;
    const block = this.blockAt(c);
    // Non-solid blocks (liquids) can't be stood on without a boat; fences and
    // walls are obstacles you can neither stand on nor pass through.
    if (!isSolid(block) && !boat) return false;
    if (isObstacle(block)) return false;
    return !this.blockers.has(cellKey(c));
  }

  /** Movement allowed between adjacent cells only if the elevation step is <=
   *  1. In a boat, transitions to/from water ignore the bed-depth drop — the
   *  surface is flat, so you glide from the shore onto the water. */
  stepOk(from: Cell, to: Cell, boat = false): boolean {
    if (this.noclip) return true;
    if (boat && (isLiquid(this.blockAt(from)) || isLiquid(this.blockAt(to)))) return true;
    // Compare walk surfaces so a raised slab/stair is a half-step, not a wall.
    return Math.abs(this.surfaceY(from) - this.surfaceY(to)) <= 1;
  }
}

// ---------------------------------------------------------------------------
// The Old Starter Mine (Copper Hollow) — the province's first mine.
// ---------------------------------------------------------------------------

const HOLLOW_MAP = [
  "########################################",
  "########################################",
  "###.......##############################",
  "###.c...i.##############################",
  "###.......##############.............H##",
  "###.......##############...........t..##",
  "###...G.....................t.........##",
  "###..............s..................s.##",
  "###...........................s...~p~.##",
  "###.......##############..........~~~.##",
  "###..g....##############..............##",
  "###.......####################....######",
  "###.H.....####################....######",
  "####.....#####################....######",
  "####.....#####################....######",
  "####.....#####################....######",
  "##############################....######",
  "##############################....######",
  "####..........################....######",
  "####..........################....######",
  "####..c.......############............##",
  "####..........############..c.........##",
  "####....g.....############............##",
  "####..................................##",
  "####......c.........g...........E.S...##",
  "####.H................................##",
  "####..........############............##",
  "########################################",
];

// Treasure worth delving for: each chest is a one-time find (saves keep
// whatever the player leaves behind).
const HOLLOW_CHEST_LOOT: Array<Array<{ itemId: string; qty: number }>> = [
  [{ itemId: "item.coin", qty: 30 }, { itemId: "item.berry.basic", qty: 3 }],
  [{ itemId: "item.bar.bronze", qty: 2 }, { itemId: "item.coin", qty: 25 }],
  [{ itemId: "armor.cap.bronze", qty: 1 }, { itemId: "item.coin", qty: 60 }],
];

export function makeCopperHollow(): RegionSpec {
  const depth = HOLLOW_MAP.length;
  const width = HOLLOW_MAP[0].length;
  const heights = new Array<number>(width * depth).fill(0);
  // Dirt floor against stone walls keeps the cave readable in the dim light.
  const blocks = new Array<BlockType>(width * depth).fill("dirt");
  const nodes: NodePlacement[] = [];
  const objects: ObjectPlacement[] = [];
  const enemies: EnemyPlacement[] = [];
  let spawn: Cell = { x: 34, z: 24 };
  let rockCount = 0;
  let spiderCount = 0;
  let chestCount = 0;

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const ch = HOLLOW_MAP[z][x];
      const cell = { x, z };
      if (ch === "#") {
        heights[z * width + x] = 2; // cave wall: too tall to step onto
        blocks[z * width + x] = "stone";
        continue;
      }
      if (ch === "c" || ch === "t" || ch === "i") {
        rockCount++;
        nodes.push({
          instanceId: `hollow.rock.${String(rockCount).padStart(3, "0")}`,
          defId: ch === "c" ? "resource.rock.copper" : ch === "t" ? "resource.rock.tin" : "resource.rock.iron",
          cell,
        });
      } else if (ch === "~" || ch === "p") {
        heights[z * width + x] = -1;
        blocks[z * width + x] = "water";
        if (ch === "p") {
          nodes.push({ instanceId: "hollow.pool.001", defId: "resource.fishing.pond", cell });
        }
      } else if (ch === "H") {
        chestCount++;
        objects.push({
          instanceId: `hollow.chest.${String(chestCount).padStart(3, "0")}`,
          defId: "object.storage_chest.basic",
          cell,
          initialItems: HOLLOW_CHEST_LOOT[chestCount - 1] ?? [],
        });
      } else if (ch === "g" || ch === "s") {
        spiderCount++;
        enemies.push({
          instanceId: `hollow.spider.${String(spiderCount).padStart(3, "0")}`,
          defId: ch === "g" ? "enemy.spider" : "enemy.cave_spider",
          cell,
        });
      } else if (ch === "G") {
        enemies.push({ instanceId: "hollow.gnasher.001", defId: "enemy.old_gnasher", cell });
      } else if (ch === "E") {
        objects.push({
          instanceId: "hollow.exit.001",
          defId: "object.portal.exit",
          cell,
          portal: {
            targetRegionId: "region.vale_clearing",
            targetCell: { x: DUNGEON_DOORS["region.copper_hollow"].x, z: DUNGEON_DOORS["region.copper_hollow"].z + 2 },
          },
        });
      } else if (ch === "S") {
        spawn = cell;
      }
    }
  }

  return {
    id: "region.copper_hollow",
    width,
    depth,
    heights,
    blocks,
    nodes,
    objects,
    npcs: [],
    enemies,
    spawn,
    theme: { sky: "#171a21", sun: 0.95, ambient: 0.78 },
  };
}

// ---------------------------------------------------------------------------
// Interior rooms (keep floors, town buildings) authored as string maps:
// '#' stone wall, '.' plank floor, 'D' exit door, 'U'/'V' stairs up/down,
// 'C' shop counter, 'H' chest, 'B' bed, 'T' table, 'F' hearth.
// ---------------------------------------------------------------------------

interface RoomSpec {
  id: string;
  map: string[];
  exit: { targetRegionId: string; targetCell: Cell };
  up?: { targetRegionId: string; targetCell: Cell };
  down?: { targetRegionId: string; targetCell: Cell };
  npcs?: NpcPlacement[];
  chestItems?: Array<{ itemId: string; qty: number }>;
}

function makeRoom(spec: RoomSpec): () => RegionSpec {
  return () => {
    const depth = spec.map.length;
    const width = spec.map[0].length;
    const heights = new Array<number>(width * depth).fill(0);
    const blocks = new Array<BlockType>(width * depth).fill("plank");
    const objects: ObjectPlacement[] = [];
    let spawn: Cell = { x: 1, z: 1 };
    let furniture = 0;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const ch = spec.map[z][x];
        const cell = { x, z };
        if (ch === "#") {
          heights[z * width + x] = 2;
          blocks[z * width + x] = "stone";
          continue;
        }
        if (ch === "D") {
          objects.push({
            instanceId: `${spec.id}.door.out`,
            defId: "object.door.wood",
            cell,
            portal: spec.exit,
          });
          spawn = { x, z: z - 1 }; // arrive just inside the door
        } else if (ch === "U" && spec.up) {
          objects.push({
            instanceId: `${spec.id}.stairs.up`,
            defId: "object.stairs.up",
            cell,
            portal: spec.up,
          });
        } else if (ch === "V" && spec.down) {
          objects.push({
            instanceId: `${spec.id}.stairs.down`,
            defId: "object.stairs.down",
            cell,
            portal: spec.down,
          });
        } else if (ch === "C") {
          objects.push({ instanceId: `${spec.id}.counter`, defId: "object.counter.shop", cell });
        } else if (ch === "H") {
          objects.push({
            instanceId: `${spec.id}.chest`,
            defId: "object.storage_chest.basic",
            cell,
            initialItems: spec.chestItems,
          });
        } else if (ch === "B") {
          // Bed head; the foot 'b' is the next cell right or below (1x2, MC).
          furniture++;
          const foot =
            spec.map[z][x + 1] === "b" ? { x: x + 1, z }
            : spec.map[z + 1]?.[x] === "b" ? { x, z: z + 1 }
            : undefined;
          objects.push({
            instanceId: `${spec.id}.furniture.${furniture}`,
            defId: "object.bed.basic",
            cell,
            footprint: foot ? [foot] : undefined,
          });
        } else if (ch === "A") {
          objects.push({
            instanceId: `${spec.id}.enchanter${objects.length}`,
            defId: "object.enchanter.basic",
            cell,
          });
        } else if ("TFNOXEQWL".includes(ch)) {
          furniture++;
          const defId =
            ch === "T" ? "object.table.basic"
            : ch === "N" ? "object.banner.red"
            : ch === "O" ? "object.barrel.wood"
            : ch === "X" ? "object.crate.wood"
            : ch === "E" ? "object.bench.wood"
            : ch === "Q" ? "object.cauldron.basic"
            : ch === "W" ? "object.workbench.basic"
            : ch === "L" ? "object.lamp.post"
            : "object.campfire.basic";
          objects.push({
            instanceId: `${spec.id}.furniture.${furniture}`,
            defId,
            cell,
          });
        }
      }
    }

    return {
      id: spec.id,
      width,
      depth,
      heights,
      blocks,
      nodes: [],
      objects,
      npcs: spec.npcs ?? [],
      enemies: [],
      spawn,
      theme: { sky: "#241d14", sun: 0.7, ambient: 1.05 }, // warm indoors
    };
  };
}

// ---------------------------------------------------------------------------
// House interiors: a clean, purpose-built room you enter through a building's
// door-portal. Large imported builds are solid landmarks outside; inside is
// this cozy single-storey room, so "walk into the house" always works instead
// of clambering over a flattened multi-storey shell. The region id encodes the
// asset and the yard cell to return to, so buildRegion can regenerate it.
// ---------------------------------------------------------------------------

/** Arrival cell for a plain fallback room (see houseInteriorRoomSpec). */
const FALLBACK_ARRIVAL: Cell = { x: 6, z: 5 };

export function houseInteriorId(assetId: string, exit: Cell): string {
  return `houseint_${assetId}_${exit.x}_${exit.z}`;
}

/** Where you arrive inside a building — the floor cell just inside its door.
 *  Matches the reconstructed floor plan, or the fallback room when the build
 *  has no recoverable interior. Both the world door-portal and the interior
 *  builder read this, so they always agree. */
export function houseInteriorArrival(assetId: string): Cell {
  const asset = getStructure(assetId);
  const plan = asset ? houseInteriorPlan(asset) : null;
  return plan ? { ...plan.arrival } : { ...FALLBACK_ARRIVAL };
}

/** A furnished plain room, used when a build has no recoverable floor plan. */
function houseInteriorRoomSpec(assetId: string, exit: Cell, regionId: string): RoomSpec {
  let h = 0;
  for (let i = 0; i < assetId.length; i++) h = (h * 31 + assetId.charCodeAt(i)) & 0xffff;
  const variants = [
    ["#############", "#Bb...H....L#", "#.....E.....#", "#..T.....O..#", "#..W.....X..#", "#...........#", "######D######"],
    ["#############", "#L....H...Bb#", "#..O.....T..#", "#........E..#", "#..X.....W..#", "#...........#", "######D######"],
    ["#############", "#Bb..T.E..H.#", "#.....E....L#", "#..O.....X..#", "#..W........#", "#...........#", "######D######"],
  ];
  return { id: regionId, map: variants[h % variants.length], exit: { targetRegionId: "region.endless", targetCell: exit } };
}

/** Build the interior region from a reconstructed floor plan: the room takes
 *  the house's real outline and floor tiles, walled by its own materials, with
 *  a lamp for light, a few furnishings and the exit door back to the yard. */
/** Interior furnishings matched to a building's purpose, keyed by its asset id. */
function furnitureFor(regionId: string): string[] {
  const id = regionId.replace(/^houseint_/, "").replace(/_-?\d+_-?\d+$/, "");
  const SETS: Record<string, string[]> = {
    inn: ["object.bed.basic", "object.bed.basic", "object.table.basic", "object.bench.wood", "object.storage_chest.basic", "object.lamp.post"],
    blacksmith: ["object.furnace.basic", "object.anvil.basic", "object.workbench.basic", "object.storage_chest.basic", "object.barrel.wood", "object.lamp.post"],
    butcher: ["object.counter.shop", "object.barrel.wood", "object.crate.wood", "object.storage_chest.basic", "object.table.basic", "object.lamp.post"],
    bakery: ["object.counter.shop", "object.furnace.basic", "object.crate.wood", "object.storage_chest.basic", "object.table.basic", "object.lamp.post"],
    library: ["object.enchanter.basic", "object.table.basic", "object.bench.wood", "object.storage_chest.basic", "object.lamp.post"],
    leader_house: ["object.table.basic", "object.bench.wood", "object.storage_chest.basic", "object.bed.basic", "object.enchanter.basic", "object.lamp.post"],
    little_house: ["object.bed.basic", "object.table.basic", "object.bench.wood", "object.storage_chest.basic", "object.lamp.post"],
    watch_tower: ["object.bed.basic", "object.storage_chest.basic", "object.table.basic", "object.lamp.post"],
  };
  return SETS[id] ?? ["object.bed.basic", "object.table.basic", "object.storage_chest.basic", "object.barrel.wood", "object.lamp.post"];
}

function makeHouseRegion(regionId: string, plan: InteriorPlan, exit: Cell): () => RegionSpec {
  return () => {
    const { w, d } = plan;
    const idx = (x: number, z: number) => z * w + x;
    // Everything starts as flat, DARK ground — cells beyond the room's wall ring
    // stay low and shadowed (not a raised block mass, and not more floor), so the
    // room reads as an enclosed space, not one big platform.
    const heights = new Array<number>(w * d).fill(0);
    const blocks = new Array<BlockType>(w * d).fill("deepslate");
    for (const [k, b] of plan.floor) {
      const [x, z] = k.split(",").map(Number);
      blocks[idx(x, z)] = b; // the house's own floor tile at walk height 0
    }
    // Wall ring: every non-floor cell touching the room, raised to enclose it,
    // in the house's own wall material (the dominant block over its height).
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        const k = `${x},${z}`;
        if (plan.floor.has(k)) continue;
        const touchesFloor = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
          .some(([dx, dz]) => plan.floor.has(`${x + dx},${z + dz}`));
        if (!touchesFloor) continue;
        heights[idx(x, z)] = 3;
        blocks[idx(x, z)] = plan.walls.get(k) ?? plan.wallFill;
      }
    }
    const objects: ObjectPlacement[] = [];
    objects.push({
      instanceId: `${regionId}.door.out`,
      defId: "object.door.wood",
      cell: { ...plan.door },
      facing: plan.doorFacing ?? "south",
      portal: { targetRegionId: "region.endless", targetCell: { ...exit } },
    });
    // Furnish to match the building's purpose, on the roomiest floor cells away
    // from the door so nothing walls you in.
    const floorCells = [...plan.floor.keys()]
      .map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; })
      .filter((c) => !(c.x === plan.door.x && c.z === plan.door.z) &&
        !(c.x === plan.arrival.x && c.z === plan.arrival.z))
      .sort((a, b) => (Math.abs(b.z - plan.door.z) - Math.abs(a.z - plan.door.z)));
    const furn = furnitureFor(regionId);
    for (let i = 0; i < furn.length && i < floorCells.length; i++) {
      // Space them out by striding through the sorted floor list.
      const cell = floorCells[Math.min(floorCells.length - 1, i * Math.max(1, Math.floor(floorCells.length / (furn.length + 1))))];
      objects.push({ instanceId: `${regionId}.furn.${i}`, defId: furn[i], cell: { ...cell } });
    }
    return {
      id: regionId,
      width: w,
      depth: d,
      heights,
      blocks,
      nodes: [],
      objects,
      npcs: [],
      enemies: [],
      spawn: { ...plan.arrival },
      theme: { sky: "#241d14", sun: 0.7, ambient: 1.05 },
    };
  };
}

/** Resolve a houseint_* region id into a builder, or null if it isn't one. */
export function buildHouseInterior(regionId: string): (() => RegionSpec) | null {
  // The asset id may contain underscores (home_two_story); the last two numeric
  // groups are the return cell, so capture the id greedily and the coords from
  // the right.
  const m = regionId.match(/^houseint_(.+)_(-?\d+)_(-?\d+)$/);
  if (!m) return null;
  const assetId = m[1];
  const exit: Cell = { x: Number(m[2]), z: Number(m[3]) };
  const asset = getStructure(assetId);
  const plan = asset ? houseInteriorPlan(asset) : null;
  return plan
    ? makeHouseRegion(regionId, plan, exit)
    : makeRoom(houseInteriorRoomSpec(assetId, exit, regionId));
}

// Greenvale's interiors: the keep halls and the plaza-side store and inn.
// Exit cells are just outside their doors on the town pad.

const makeCastleBarracks = makeRoom({
  id: "region.castle_barracks",
  map: [
    "###########",
    "#Bb.N.Bb.H#",
    "#........X#",
    "#Bb.TE.Bb.#",
    "#...E....O#",
    "#....D....#",
    "###########",
  ],
  exit: { targetRegionId: "region.vale_clearing", targetCell: { x: 1240, z: 1341 } },
});

const makeCastleStorehouse = makeRoom({
  id: "region.castle_storehouse",
  map: [
    "#########",
    "#HXX.OOH#",
    "#X.....O#",
    "#...D...#",
    "#########",
  ],
  exit: { targetRegionId: "region.vale_clearing", targetCell: { x: 1260, z: 1341 } },
  chestItems: [{ itemId: "item.brick.stone", qty: 8 }],
});

const makeTownStore = makeRoom({
  id: "region.town_store",
  map: [
    "###########",
    "#H...C..XX#",
    "#.......XO#",
    "#..TE.....#",
    "#L........#",
    "#....D....#",
    "###########",
  ],
  exit: { targetRegionId: "region.vale_clearing", targetCell: { x: 1263, z: 1380 } },
  npcs: [
    {
      instanceId: "town.npc.mara",
      name: "Mara",
      cell: { x: 7, z: 2 },
      wanderRadius: 2,
      lines: [
        "Welcome in! The counter's right there — I buy most anything honest.",
        "Logs, ore, bars, a good cooked meal — fair coin for the lot.",
        "Need a spare axe or rod? Everything's on the counter.",
        "Iron bars fetch the best price this side of Highforge.",
      ],
    },
  ],
});

const makeTownInn = makeRoom({
  id: "region.town_inn",
  map: [
    "#############",
    "#Bb.Bb..F..Q#",
    "#...........#",
    "#..TE...TE..#",
    "#...........#",
    "#..TE...TE..#",
    "#.....L.....#",
    "#....D......#",
    "#############",
  ],
  exit: { targetRegionId: "region.vale_clearing", targetCell: { x: 1263, z: 1388 } },
  npcs: [
    {
      instanceId: "town.npc.rolf",
      name: "Rolf the Innkeep",
      cell: { x: 9, z: 2 },
      wanderRadius: 3,
      lines: [
        "Sit anywhere. Fire's hot if you've a catch to cook.",
        "Beds are for paying guests, but I won't begrudge a look.",
        "Mara next door pays coin for goods; I just pour and gossip.",
        "They say the crypt under the graveyard has started whispering again.",
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Region registry + builder.
// ---------------------------------------------------------------------------

export const REGION_BUILDERS: Record<string, () => RegionSpec> = {
  "region.vale_clearing": () => buildOverworld().region,
  "region.copper_hollow": makeCopperHollow,
  "region.castle_barracks": makeCastleBarracks,
  "region.castle_storehouse": makeCastleStorehouse,
  "region.town_store": makeTownStore,
  "region.town_inn": makeTownInn,
  ...MADE_DUNGEONS,
};

/** Raw (shared, uncloned) builds — used to resolve portal spawn targets. */
const rawCache = new Map<string, RegionSpec>();
function rawRegion(regionId: string): RegionSpec {
  // Endless-world dungeon floors are generated on demand and never cached —
  // the descent is infinite, so caching every floor would grow without bound.
  // Their portals carry only real cells (spawn constant / overworld exit), so
  // they skip the sentinel resolution below.
  const dyn = buildDynamicDungeon(regionId);
  if (dyn) return dyn();
  // House interiors are also generated on demand from their id (asset + the
  // yard cell to return to); never cached — there can be one per placed house.
  const house = buildHouseInterior(regionId);
  if (house) return house();
  let region = rawCache.get(regionId);
  if (!region) {
    const builder = REGION_BUILDERS[regionId] ?? REGION_BUILDERS["region.vale_clearing"];
    region = builder();
    // Portals authored with the {-1,-1} sentinel land on the target
    // region's own spawn cell (single source of truth for arrivals).
    for (const object of region.objects) {
      if (object.portal && object.portal.targetCell.x < 0) {
        object.portal = {
          targetRegionId: object.portal.targetRegionId,
          targetCell: { ...rawRegion(object.portal.targetRegionId).spawn },
        };
      }
    }
    rawCache.set(regionId, region);
  }
  return region;
}

/**
 * Build a region (fresh, mutation-safe copy), then apply persistent
 * world-state repairs (bridges etc.). The overworld's geography is
 * generated once and cloned per call.
 */
export function buildRegion(regionId: string, worldFlags?: Iterable<string>): RegionSpec {
  const raw = rawRegion(regionId);
  const region: RegionSpec = {
    ...raw,
    heights: raw.heights.slice(),
    blocks: raw.blocks.slice(),
    nodes: raw.nodes.map((n) => ({ ...n, cell: { ...n.cell } })),
    objects: raw.objects.map((o) => ({
      ...o,
      cell: { ...o.cell },
      footprint: o.footprint?.map((c) => ({ ...c })),
      portal: o.portal ? { ...o.portal, targetCell: { ...o.portal.targetCell } } : undefined,
      initialItems: o.initialItems?.map((it) => ({ ...it })),
    })),
    npcs: raw.npcs.map((n) => ({ ...n, cell: { ...n.cell } })),
    enemies: raw.enemies?.map((e) => ({ ...e, cell: { ...e.cell } })),
    structures: raw.structures?.map((s) => ({ ...s, cell: { ...s.cell } })),
    spawn: { ...raw.spawn },
  };
  if (worldFlags) applyWorldFlags(region, worldFlags);
  return region;
}
