// Procedural dungeon interiors. Each dungeon is its own region: rooms laid
// on a loose grid, three-block-wide corridors (with looping side passages),
// themed enemies, loot, a boss chamber at the far end and an exit portal in
// the entrance room. Floors are flat and corridors are full-height, so the
// required route through every dungeon is compliant by construction — the
// same one-block step rule as the overworld, no climbing, no gaps.

import type {
  BlockType,
  EnemyPlacement,
  NodePlacement,
  ObjectPlacement,
  RegionSpec,
} from "../world";
import { cellHash } from "./noise";

export interface DungeonSpec {
  id: string;
  name: string;
  /** Region the exit portal returns to (default the province clearing). */
  exitRegionId?: string;
  /** Cell in the exit region the exit portal returns to. */
  exitCell: { x: number; z: number };
  rooms: number;
  floor: BlockType;
  wallH?: number;
  theme: { sky: string; sun: number; ambient: number };
  /** Weighted rank-and-file enemies. */
  enemies: Array<{ defId: string; weight: number }>;
  boss?: string;
  /** An elite guardian dropped in a middle room on deeper floors. */
  elite?: string;
  /** Mining dungeons scatter rock nodes through their rooms. */
  rocks?: Array<{ defId: string; weight: number }>;
  lootItems: Array<{ itemId: string; qty: number }>;
  seed: number;
  /** Which of the dungeon archetypes this floor belongs to (styling, foes,
   *  loot and naming all key off it). */
  style?: DungeonStyle;
  /** Floor number, 1 = top. Deeper floors are bigger, darker and richer. */
  depth?: number;
  /** Endless descent: the region id of the next-deeper floor. When set, the
   *  boss chamber gains a stairway down to it. */
  descendTo?: string;
}

/** Entrance room is fixed so every floor's spawn cell is the same constant —
 *  descent portals can target it without knowing the next floor's layout. */
export const DUNGEON_SPAWN = { x: 9, z: 10 };

export function makeDungeon(spec: DungeonSpec): () => RegionSpec {
  return () => {
    const floorN = Math.max(1, spec.depth ?? 1);
    const sd = STYLE_DEFS[spec.style ?? "crypt"] ?? STYLE_DEFS.crypt;
    // Bigger than the old crawls, and each floor down adds rooms — so a deep
    // descent sprawls. Wide styles (mineshafts, warrens, vaults) run larger.
    const roomCount = Math.min(20, spec.rooms + (floorN - 1) * 2 + (sd.wide ? 3 : 0));
    const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(roomCount))));
    const rows = Math.ceil(roomCount / cols);
    const cellW = sd.wide ? 30 : 27;
    const width = cols * cellW + 8;
    const depth = rows * cellW + 8;
    const heights = new Array<number>(width * depth).fill(3);
    const blocks = new Array<BlockType>(width * depth).fill(sd.wall);
    const nodes: NodePlacement[] = [];
    const objects: ObjectPlacement[] = [];
    const enemies: EnemyPlacement[] = [];
    const at = (x: number, z: number) => z * width + x;
    const rand = (a: number, b: number, salt: number) =>
      a + Math.floor(cellHash(spec.seed + floorN * 9973, salt, 7) * (b - a + 1));

    interface Room {
      x0: number;
      x1: number;
      z0: number;
      z1: number;
      cx: number;
      cz: number;
    }
    const rooms: Room[] = [];
    for (let r = 0; r < roomCount; r++) {
      const gx = r % cols;
      const gz = Math.floor(r / cols);
      if (r === 0) {
        // Fixed entrance room, so the spawn cell is a constant (DUNGEON_SPAWN)
        // that descent portals can target on any floor.
        rooms.push({ x0: 4, x1: 14, z0: 4, z1: 14, cx: 9, cz: 9 });
        continue;
      }
      const w = rand(11, cellW - 6, r * 3 + 1);
      const h = rand(11, cellW - 6, r * 3 + 2);
      const x0 = 4 + gx * cellW + rand(0, cellW - w - 2, r * 3 + 3);
      const z0 = 4 + gz * cellW + rand(0, cellW - h - 2, r * 3 + 4);
      rooms.push({ x0, x1: x0 + w, z0, z1: z0 + h, cx: x0 + (w >> 1), cz: z0 + (h >> 1) });
    }

    const carveRect = (x0: number, x1: number, z0: number, z1: number) => {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          heights[at(x, z)] = 0;
          blocks[at(x, z)] = spec.floor;
        }
      }
    };
    for (const r of rooms) carveRect(r.x0, r.x1, r.z0, r.z1);

    // L-shaped corridors, three blocks wide, between consecutive rooms —
    // plus a couple of loop links so the crawl never funnels one way.
    const corridor = (a: Room, b: Room) => {
      const midX0 = Math.min(a.cx, b.cx);
      const midX1 = Math.max(a.cx, b.cx);
      carveRect(midX0 - 1, midX1 + 1, a.cz - 1, a.cz + 1);
      const midZ0 = Math.min(a.cz, b.cz);
      const midZ1 = Math.max(a.cz, b.cz);
      carveRect(b.cx - 1, b.cx + 1, midZ0 - 1, midZ1 + 1);
    };
    for (let r = 1; r < rooms.length; r++) corridor(rooms[r - 1], rooms[r]);
    if (rooms.length > 3) corridor(rooms[0], rooms[Math.min(cols, rooms.length - 1)]);
    if (rooms.length > 5) corridor(rooms[2], rooms[rooms.length - 2]);

    // Entrance room: spawn + the way out (back to wherever we came from).
    const entry = rooms[0];
    const spawn = { x: entry.cx, z: entry.cz + 1 };
    objects.push({
      instanceId: `${spec.id}.exit`,
      defId: "object.portal.exit",
      cell: { x: entry.cx, z: entry.cz - 1 },
      portal: {
        targetRegionId: spec.exitRegionId ?? "region.vale_clearing",
        targetCell: spec.exitCell,
      },
    });

    // Rank-and-file enemies, loot and (optionally) ore through the middle.
    const pickWeighted = (list: Array<{ defId: string; weight: number }>, salt: number) => {
      const total = list.reduce((n, e) => n + e.weight, 0);
      let roll = cellHash(spec.seed, salt, 11) * total;
      for (const e of list) {
        roll -= e.weight;
        if (roll <= 0) return e.defId;
      }
      return list[list.length - 1].defId;
    };
    let chestNo = 0;
    for (let r = 1; r < rooms.length; r++) {
      const room = rooms[r];
      const count = 1 + (r % 2);
      for (let k = 0; k < count; k++) {
        enemies.push({
          instanceId: `${spec.id}.foe.${r}.${k}`,
          defId: pickWeighted(spec.enemies, r * 17 + k),
          cell: {
            x: room.x0 + 2 + Math.floor(cellHash(spec.seed, r * 31 + k, 13) * (room.x1 - room.x0 - 3)),
            z: room.z0 + 2 + Math.floor(cellHash(spec.seed, r * 37 + k, 15) * (room.z1 - room.z0 - 3)),
          },
        });
      }
      if (spec.rocks && r % 2 === 0) {
        for (let k = 0; k < 3; k++) {
          nodes.push({
            instanceId: `${spec.id}.rock.${r}.${k}`,
            defId: pickWeighted(spec.rocks, r * 41 + k),
            cell: { x: room.x0 + 1 + k * 2, z: room.z1 - 1 },
          });
        }
      }
      if (cellHash(spec.seed, r, 21) < 0.45) {
        chestNo++;
        objects.push({
          instanceId: `${spec.id}.chest.${chestNo}`,
          defId: "object.storage_chest.basic",
          cell: { x: room.x1 - 1, z: room.z0 + 1 },
          initialItems: spec.lootItems,
        });
      }
    }

    // An elite guardian holds a middle room on the deeper floors — a spike of
    // danger between the rank and file and the boss.
    if (spec.elite && rooms.length > 3) {
      const eliteRoom = rooms[Math.floor(rooms.length / 2)];
      enemies.push({
        instanceId: `${spec.id}.elite`,
        defId: spec.elite,
        cell: { x: eliteRoom.cx, z: eliteRoom.cz },
      });
    }

    // Boss chamber: the far room, with the prize behind the fight.
    const bossRoom = rooms[rooms.length - 1];
    if (spec.boss) {
      enemies.push({
        instanceId: `${spec.id}.boss`,
        defId: spec.boss,
        cell: { x: bossRoom.cx, z: bossRoom.cz },
      });
      objects.push({
        instanceId: `${spec.id}.prize`,
        defId: "object.storage_chest.basic",
        cell: { x: bossRoom.cx, z: bossRoom.z0 + 1 },
        initialItems: [...spec.lootItems, { itemId: "item.coin", qty: 40 + floorN * 20 }],
      });
    }
    // Endless descent: a stairway down in the boss chamber to the next, deeper
    // floor. It targets the fixed entrance spawn, so no floor needs to know the
    // next one's layout.
    if (spec.descendTo) {
      objects.push({
        instanceId: `${spec.id}.descend`,
        defId: "object.portal.cave",
        cell: { x: bossRoom.cx, z: bossRoom.z1 - 1 },
        portal: { targetRegionId: spec.descendTo, targetCell: DUNGEON_SPAWN },
      });
    }

    // Torch the route so the dark reads as depth, not as void.
    const taken = new Set<string>();
    for (const o of objects) taken.add(`${o.cell.x},${o.cell.z}`);
    for (const n of nodes) taken.add(`${n.cell.x},${n.cell.z}`);
    for (let r = 0; r < rooms.length; r += 2) {
      const cell = { x: rooms[r].x0 + 1, z: rooms[r].z0 + 1 };
      if (taken.has(`${cell.x},${cell.z}`)) continue;
      taken.add(`${cell.x},${cell.z}`);
      objects.push({ instanceId: `${spec.id}.lamp.${r}`, defId: "object.lamp.post", cell });
    }

    // Room dressing: abandoned kit in the corners — crates, casks and the
    // cold campfires of whoever came down before. Corners never carry the
    // corridor lines, so the required route stays clear.
    for (let r = 1; r < rooms.length; r++) {
      const room = rooms[r];
      const corners = [
        [room.x0 + 1, room.z0 + 1], [room.x1 - 1, room.z0 + 1],
        [room.x0 + 1, room.z1 - 1], [room.x1 - 1, room.z1 - 1],
      ] as const;
      for (let c = 0; c < corners.length; c++) {
        const key = `${corners[c][0]},${corners[c][1]}`;
        if (taken.has(key)) continue;
        const roll = cellHash(spec.seed, r * 53 + c, 23);
        if (roll < 0.4) continue; // bare corner
        taken.add(key);
        const defId =
          roll < 0.62 ? "object.crate.wood"
          : roll < 0.82 ? "object.barrel.wood"
          : "object.campfire.basic";
        objects.push({
          instanceId: `${spec.id}.deco.${r}.${c}`,
          defId,
          cell: { x: corners[c][0], z: corners[c][1] },
        });
      }
    }
    // Banners flank the boss prize.
    if (spec.boss) {
      for (const [k, bx] of [[0, bossRoom.cx - 2], [1, bossRoom.cx + 2]] as const) {
        const key = `${bx},${bossRoom.z0 + 1}`;
        if (taken.has(key)) continue;
        taken.add(key);
        objects.push({
          instanceId: `${spec.id}.banner.${k}`,
          defId: "object.banner.red",
          cell: { x: bx, z: bossRoom.z0 + 1 },
        });
      }
    }

    return {
      id: spec.id,
      width,
      depth,
      heights,
      blocks,
      nodes,
      objects,
      npcs: [],
      enemies,
      spawn,
      theme: spec.theme,
    };
  };
}

// ---------------------------------------------------------------------------
// Endless-world dungeons: generated on demand from a region id so every floor
// (and every descent) is a pure function of (style, seed, depth). Region-id
// scheme: dyn_<style>_<seed>_<depth>_<exitX>_<exitZ>.
// ---------------------------------------------------------------------------

type Weighted = Array<{ defId: string; weight: number }>;

const CRYPT_FOES: Weighted = [
  { defId: "enemy.skeleton", weight: 4 },
  { defId: "enemy.zombie", weight: 4 },
  { defId: "enemy.grave_shambler", weight: 3 },
  { defId: "enemy.hollow_wight", weight: 2 },
  { defId: "enemy.glacial_wight", weight: 2 },
  { defId: "enemy.stone_sentinel", weight: 2 },
  { defId: "enemy.creeper", weight: 2 },
];
const MINE_FOES: Weighted = [
  { defId: "enemy.cave_spider", weight: 5 },
  { defId: "enemy.gloom_spinner", weight: 3 },
  { defId: "enemy.thornback", weight: 3 },
  { defId: "enemy.ember_crawler", weight: 2 },
  { defId: "enemy.blight_slime", weight: 2 },
  { defId: "enemy.marsh_lurker", weight: 2 },
  { defId: "enemy.creeper", weight: 2 },
];
// Pillager stronghold — an outpost gone underground: bandits, war-beasts.
const WARREN_FOES: Weighted = [
  { defId: "enemy.pillager", weight: 4 },
  { defId: "enemy.vindicator", weight: 3 },
  { defId: "enemy.timber_wolf", weight: 3 },
  { defId: "enemy.boar", weight: 2 },
  { defId: "enemy.evoker", weight: 1 },
  { defId: "enemy.illusioner", weight: 1 },
];
// A living spider hive — skittering, web-choked, thick with brood.
const HIVE_FOES: Weighted = [
  { defId: "enemy.cave_spider", weight: 5 },
  { defId: "enemy.spider", weight: 4 },
  { defId: "enemy.gloom_spinner", weight: 3 },
  { defId: "enemy.thornback", weight: 2 },
  { defId: "enemy.bat", weight: 2 },
];
// A dwarven treasure vault, its wards still walking: stone and rust constructs.
const VAULT_FOES: Weighted = [
  { defId: "enemy.stone_sentinel", weight: 4 },
  { defId: "enemy.rust_construct", weight: 4 },
  { defId: "enemy.skeleton", weight: 2 },
  { defId: "enemy.canyon_construct", weight: 1 },
];
// A blighted sanctum — corruption made flesh, presided over by dark casters.
const SANCTUM_FOES: Weighted = [
  { defId: "enemy.blight_slime", weight: 4 },
  { defId: "enemy.spore_shambler", weight: 3 },
  { defId: "enemy.hollow_wight", weight: 3 },
  { defId: "enemy.witch", weight: 2 },
  { defId: "enemy.evoker", weight: 1 },
];
const MINE_ROCKS: Weighted = [
  { defId: "resource.rock.coal", weight: 4 },
  { defId: "resource.rock.iron", weight: 4 },
  { defId: "resource.rock.copper", weight: 3 },
  { defId: "resource.rock.tin", weight: 3 },
  { defId: "resource.rock.redstone", weight: 3 },
  { defId: "resource.rock.gold", weight: 2 },
  { defId: "resource.rock.lapis", weight: 2 },
  { defId: "resource.rock.diamond", weight: 1 },
  { defId: "resource.rock.emerald", weight: 1 },
  { defId: "resource.rock.quartz", weight: 1 },
  { defId: "resource.rock.netherite", weight: 1 },
];
// A vault glitters with precious veins, no base metal.
const VAULT_ROCKS: Weighted = [
  { defId: "resource.rock.gold", weight: 4 },
  { defId: "resource.rock.emerald", weight: 3 },
  { defId: "resource.rock.lapis", weight: 3 },
  { defId: "resource.rock.diamond", weight: 2 },
  { defId: "resource.rock.quartz", weight: 2 },
];
const DEEP_BOSSES = [
  "enemy.old_gnasher", "enemy.silt_king", "enemy.rootbound_warden",
  "enemy.moss_golem", "enemy.liftworks_overseer",
  "enemy.dragon.hydra", "enemy.dragon.fire", "enemy.dragon.twoheaded",
];

// ── Dungeon archetypes ─────────────────────────────────────────────────────
// Each style is a distinct kind of crawl: its own rock/floor palette, foe and
// elite roster, lighting, and naming. Affixes layer on top of a style, so a
// crawl reads as e.g. "Flooded Spider Hive". Keys appear verbatim in region
// ids (dyn_<style>_…), so they must stay lowercase and stable.
export type DungeonStyle = "crypt" | "mine" | "warren" | "hive" | "vault" | "sanctum";
interface StyleDef {
  /** Wide styles get larger rooms and a few extra chambers. */
  wide: boolean;
  /** Block filling the solid rock between rooms. */
  wall: BlockType;
  /** Default room floor (an affix may override it). */
  floor: BlockType;
  foes: Weighted;
  elites: string[];
  rocks?: Weighted;
  /** Overrides the shared boss pool when set. */
  bosses?: string[];
  theme: { sky: string; ambient: number };
  /** Name of a finite crawl of this style. */
  surface: string;
  /** Name of an endless descent of this style. */
  endless: string;
}
const STYLE_DEFS: Record<DungeonStyle, StyleDef> = {
  crypt: {
    wide: false, wall: "stone", floor: "stone",
    foes: CRYPT_FOES, elites: ["enemy.hollow_wight", "enemy.grave_shambler", "enemy.glacial_wight", "enemy.barrow_lord"],
    theme: { sky: "#141018", ambient: 0.3 }, surface: "Sunken Crypt", endless: "The Endless Descent",
  },
  mine: {
    wide: true, wall: "coarsedirt", floor: "gravel",
    foes: MINE_FOES, elites: ["enemy.ember_crawler", "enemy.canyon_construct", "enemy.dire_wolf"], rocks: MINE_ROCKS,
    theme: { sky: "#181410", ambient: 0.34 }, surface: "Abandoned Mineshaft", endless: "Deepdelve Mine",
  },
  warren: {
    wide: true, wall: "dirt", floor: "coarsedirt",
    foes: WARREN_FOES, elites: ["enemy.dire_wolf", "enemy.ravager", "enemy.evoker"],
    bosses: ["enemy.ravager", "enemy.old_gnasher", "enemy.liftworks_overseer", "enemy.dragon.twoheaded"],
    theme: { sky: "#1a1408", ambient: 0.32 }, surface: "Pillager Warren", endless: "The Warren Deeps",
  },
  hive: {
    wide: false, wall: "stone", floor: "moss",
    foes: HIVE_FOES, elites: ["enemy.thornback", "enemy.gloom_spinner", "enemy.old_gnasher"],
    theme: { sky: "#0e1410", ambient: 0.26 }, surface: "Spider Hive", endless: "The Endless Hive",
  },
  vault: {
    wide: true, wall: "stonebrick", floor: "stonebrick",
    foes: VAULT_FOES, elites: ["enemy.canyon_construct", "enemy.stone_sentinel"], rocks: VAULT_ROCKS,
    bosses: ["enemy.liftworks_overseer", "enemy.canyon_construct", "enemy.dragon.hydra", "enemy.rootbound_warden"],
    theme: { sky: "#141008", ambient: 0.4 }, surface: "Ironward Vault", endless: "The Bottomless Vault",
  },
  sanctum: {
    wide: false, wall: "stone", floor: "mycelium",
    foes: SANCTUM_FOES, elites: ["enemy.barrow_lord", "enemy.glacial_wight", "enemy.witch"],
    rocks: [{ defId: "resource.rock.essence", weight: 4 }, { defId: "resource.rock.redstone", weight: 2 }],
    bosses: ["enemy.rootbound_warden", "enemy.moss_golem", "enemy.silt_king", "enemy.dragon.fire"],
    theme: { sky: "#0c0a16", ambient: 0.22 }, surface: "Blighted Sanctum", endless: "The Sunless Sanctum",
  },
};

/** The dungeon styles, for worldgen to pick among and tests to sweep. */
export const DUNGEON_STYLES = Object.keys(STYLE_DEFS) as DungeonStyle[];

export function dynDungeonId(
  style: DungeonStyle,
  seed: number,
  depth: number,
  maxDepth: number,
  exit: { x: number; z: number },
): string {
  return `dyn_${style}_${seed}_${depth}_${maxDepth}_${exit.x}_${exit.z}`;
}

/**
 * The scaled spec for one dungeon floor. `maxDepth` 0 means an endless
 * descent (rare); a positive N means a finite dungeon of N floors whose last
 * floor is the finale — a guaranteed boss and the prize, with no stair down.
 */
// ── Dungeon affixes ────────────────────────────────────────────────────────
// A dungeon carries at most one affix, rolled from its seed (so it's the same
// on every floor and reconstructs deterministically from the region id). Each
// recolours the floor, mixes themed foes into the rank-and-file, and tweaks the
// loot/hazards, giving crawls real variety and a telling name.
type Affix =
  | "flooded" | "burning" | "haunted" | "overgrown"
  | "ore_rich" | "corrupted" | "treasure" | "rune_charged";
const AFFIXES: Affix[] = ["flooded", "burning", "haunted", "overgrown", "ore_rich", "corrupted", "treasure", "rune_charged"];
const AFFIX_LABEL: Record<Affix, string> = {
  flooded: "Flooded", burning: "Burning", haunted: "Haunted", overgrown: "Overgrown",
  ore_rich: "Ore-rich", corrupted: "Corrupted", treasure: "Gilded", rune_charged: "Rune-charged",
};

/** ~55% of dungeons carry an affix; deterministic per dungeon seed. */
function affixFor(seed: number): Affix | null {
  const r = (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) / 4294967296;
  if (r > 0.55) return null;
  return AFFIXES[Math.floor((r / 0.55) * AFFIXES.length) % AFFIXES.length];
}

function applyAffix(spec: DungeonSpec, affix: Affix | null): DungeonSpec {
  if (!affix) return spec;
  spec.name = `${AFFIX_LABEL[affix]} ${spec.name}`;
  const foes = (list: Array<{ defId: string; weight: number }>) => { spec.enemies = [...spec.enemies, ...list]; };
  switch (affix) {
    case "flooded":
      spec.floor = "mud";
      foes([{ defId: "enemy.drowned", weight: 2 }, { defId: "enemy.bog_slime", weight: 2 }, { defId: "enemy.marsh_lurker", weight: 1 }]);
      break;
    case "burning":
      spec.floor = "redsand";
      spec.theme = { ...spec.theme, sky: "#2a0f08" };
      foes([{ defId: "enemy.ember_crawler", weight: 2 }, { defId: "enemy.ash_hound", weight: 2 }]);
      break;
    case "haunted":
      spec.floor = "podzol";
      foes([{ defId: "enemy.grave_shambler", weight: 2 }, { defId: "enemy.hollow_wight", weight: 2 }]);
      break;
    case "overgrown":
      spec.floor = "moss";
      foes([{ defId: "enemy.vine_stalker", weight: 2 }, { defId: "enemy.spore_shambler", weight: 2 }, { defId: "enemy.bramble_slime", weight: 1 }]);
      break;
    case "ore_rich":
      spec.floor = "gravel";
      spec.rocks = [
        { defId: "resource.rock.iron", weight: 3 }, { defId: "resource.rock.gold", weight: 2 },
        { defId: "resource.rock.coal", weight: 3 }, { defId: "resource.rock.emerald", weight: 1 },
      ];
      break;
    case "corrupted":
      spec.floor = "mycelium";
      spec.theme = { ...spec.theme, ambient: Math.max(0.1, spec.theme.ambient - 0.05) };
      foes([{ defId: "enemy.blight_slime", weight: 2 }, { defId: "enemy.gloom_spinner", weight: 2 }]);
      spec.lootItems = [...spec.lootItems, { itemId: "item.gem.diamond", qty: 1 }];
      break;
    case "treasure":
      spec.lootItems = [...spec.lootItems, { itemId: "item.coin", qty: 120 }, { itemId: "item.gem.diamond", qty: 2 }];
      break;
    case "rune_charged":
      spec.theme = { ...spec.theme, sky: "#101830" };
      spec.rocks = [...(spec.rocks ?? []), { defId: "resource.rock.essence", weight: 4 }];
      spec.lootItems = [...spec.lootItems, { itemId: "item.essence.rune", qty: 8 }];
      break;
  }
  return spec;
}

export function dungeonSpecFor(
  style: DungeonStyle,
  seed: number,
  depth: number,
  maxDepth: number,
  exit: { x: number; z: number },
): DungeonSpec {
  const sd = STYLE_DEFS[style] ?? STYLE_DEFS.crypt;
  const bossPool = sd.bosses ?? DEEP_BOSSES;
  const endless = maxDepth === 0;
  const isFinale = !endless && depth >= maxDepth;
  // A boss guards every third floor, and always the finale of a finite crawl.
  const boss = isFinale || depth % 3 === 0
    ? bossPool[(depth + style.length) % bossPool.length]
    : undefined;
  const lootItems = [
    { itemId: "item.coin", qty: 20 + depth * 15 + (isFinale ? 60 : 0) },
    // Ore styles pay in bars; the rest in gems, and a vault in richer gems.
    sd.rocks
      ? { itemId: "item.bar.iron", qty: 1 + Math.floor(depth / 2) }
      : { itemId: "item.gem.diamond", qty: Math.max(1, Math.floor(depth / 3)) },
  ];
  // A vault is a hoard: it always adds a coin purse and a gem on top.
  if (style === "vault") {
    lootItems.push({ itemId: "item.coin", qty: 40 + depth * 25 });
    lootItems.push({ itemId: "item.gem.emerald", qty: 1 + Math.floor(depth / 2) });
  }
  const label = endless
    ? `${sd.endless} — Floor ${depth}`
    : `${sd.surface} — Floor ${depth}/${maxDepth}`;
  // Ascending goes up exactly one floor: the surface only from floor 1, else
  // the floor directly above (landing at its fixed entrance spawn). Previously
  // every floor's exit jumped straight to the surface.
  const ascendToSurface = depth <= 1;
  const spec: DungeonSpec = {
    id: dynDungeonId(style, seed, depth, maxDepth, exit),
    name: label,
    exitRegionId: ascendToSurface ? "region.endless" : dynDungeonId(style, seed, depth - 1, maxDepth, exit),
    exitCell: ascendToSurface ? exit : DUNGEON_SPAWN,
    rooms: sd.wide ? 7 : 6,
    floor: sd.floor,
    // Every floor down is a shade darker, to a floor.
    theme: {
      sky: sd.theme.sky,
      sun: 0.22,
      ambient: Math.max(0.14, sd.theme.ambient - depth * 0.02),
    },
    enemies: sd.foes,
    boss,
    // Deeper floors post an elite guardian in a middle room.
    elite: depth >= 2 ? sd.elites[depth % sd.elites.length] : undefined,
    rocks: sd.rocks,
    lootItems,
    seed: seed + depth * 101,
    style,
    depth,
    // No stair down on the finale of a finite crawl — that's the end.
    descendTo: isFinale ? undefined : dynDungeonId(style, seed, depth + 1, maxDepth, exit),
  };
  // One affix per dungeon (same on every floor, from the shared seed).
  return applyAffix(spec, affixFor(seed));
}

/** The affix a dungeon seed carries (for tests / labels), or null. */
export function dungeonAffix(seed: number): string | null {
  return affixFor(seed);
}

/** Region-id form for any endless dungeon floor: dyn_<style>_<seed>_<depth>_<maxDepth>_<x>_<z>. */
export const DUNGEON_ID_RE = /^dyn_([a-z]+)_(\d+)_(\d+)_(\d+)_(-?\d+)_(-?\d+)$/;

/** Resolve a dyn_* region id into a region builder, or null if it isn't one. */
export function buildDynamicDungeon(regionId: string): (() => RegionSpec) | null {
  const m = regionId.match(DUNGEON_ID_RE);
  if (!m || !(m[1] in STYLE_DEFS)) return null;
  return makeDungeon(dungeonSpecFor(
    m[1] as DungeonStyle,
    Number(m[2]), Number(m[3]), Number(m[4]),
    { x: Number(m[5]), z: Number(m[6]) },
  ));
}
