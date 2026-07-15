// The endless world: every cell is a pure function of (seed, x, z), realized
// in 64x64-cell chunks generated on demand and forgotten when far away —
// Minecraft's discipline. Phase 1: terrain, biomes, ridged-noise rivers and
// per-chunk features (trees, rocks, herbs, beasts). Settlements, roads,
// dungeons and per-chunk player diffs arrive in later phases; until diffs
// land, a chunk that unloads regenerates fresh (felled trees regrow).

import type { BlockType, EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";
import type { Cell } from "../types";
import type { StructurePlacement, StructureAsset } from "../../structures/types";
import { effectiveSink, blockedColumns, solidColumns } from "../../structures/types";
import { houseInteriorArrival, houseInteriorId } from "../world";
import { getStructure } from "../../content/structures/index";
import { cellHash, fbm, vnoise } from "./noise";
import { WILD_SCHEMATICS, schematicFits, stampSchematic } from "./schematics";
import { DUNGEON_SPAWN, dynDungeonId } from "./dungeons";

export const ECHUNK = 64;

// Asset transition: the imported visual asset set (houses, trees, rocks, props,
// mobs, structures and villages) is being replaced with a new one, so world
// feature placement is switched off — the generated world is bare terrain with
// only its roads, water and bridges (all from terrainAt) until the new assets
// are parsed in. Flip back to false to restore the old placement.
const CLEAR_ASSETS = true;
/** Virtual bounds: ~1M cells a side (≈300 hours of walking corner to corner). */
export const ENDLESS_SIZE = 1_048_576;
/**
 * Spawn sits at 2^15, not the world's midpoint: three.js positions are
 * float32, whose precision at 500k+ would visibly jitter meshes. At 32k the
 * error is ~4mm. A floating render origin (subtracting the camera anchor
 * before upload) lifts this ceiling entirely — scheduled with the title-
 * screen phase; until then the practical range is ~130k cells from spawn.
 */
export const ENDLESS_CENTER = 32_768;

// Compact block palette for chunk storage.
const BLOCK_LIST: BlockType[] = [
  "grass", "dirt", "stone", "sand", "water", "plank", "snow", "ice",
  "mud", "redsand", "mycelium", "drygrass", "stonebrick",
  // Richer ground: soils, riverbed, mesa bands and cliff rock.
  "gravel", "coarsedirt", "podzol", "clay", "moss", "andesite", "calcite",
  "terracotta", "redterracotta", "orangeterracotta", "whiteterracotta",
  // Cobblestone — the starter vale's castle wall.
  "cobble",
  // Plank bridge decks (rendered open-underneath on stone piers).
  "bridge",
  // Castle-gate thresholds (gravel floor with a cobble arch drawn over it).
  "gatearch",
];
const BLOCK_ID: Record<string, number> = Object.fromEntries(BLOCK_LIST.map((b, i) => [b, i]));

export interface EndlessChunk {
  cx: number;
  cz: number;
  heights: Int16Array; // ECHUNK * ECHUNK
  blocks: Uint8Array; // palette ids
  nodes: NodePlacement[];
  objects: ObjectPlacement[];
  enemies: EnemyPlacement[];
  structures: StructurePlacement[];
  npcs: NpcPlacement[];
}

/** Seed-salted noise helpers: every field gets its own derived salt. */
const salt = (seed: number, k: number) => ((seed * 2654435761 + k * 40503) >>> 0) % 100000;

interface CellSample {
  h: number;
  block: BlockType;
  /** 0 plains, 1 forest, 2 taiga, 3 desert, 4 swamp, 5 snowfield,
   *  6 savanna, 7 jungle, 8 birch grove, 9 dark forest, 10 flower meadow,
   *  11 mushroom isle, 12 moorland, 13 elder grove, 14 badlands, 15 fen,
   *  16 gravemoor (evil), 17 blightwood (evil), 18 volcanic wastes,
   *  19 glacier, 20 alpine pines */
  biome: number;
  water: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Height only — the shared skeleton of terrainAt, also used for neighbor
 * slope probes so materials stay a pure function of (seed, x, z).
 */
function heightFields(seed: number, x: number, z: number) {
  // Domain warp: the structural fields (landmass, ridges, rivers) are
  // sampled through a slow coordinate wobble, so coastlines grow bays and
  // headlands, ridgelines bend, and rivers meander — instead of the round
  // blobs raw value noise draws.
  const wx = x + (fbm(x, z, 1100, salt(seed, 37)) - 0.5) * 340;
  const wz = z + (fbm(x, z, 1100, salt(seed, 38)) - 0.5) * 340;
  const continental = fbm(wx, wz, 1700, salt(seed, 1)); // landmass swell
  const erosion = fbm(wx, wz, 900, salt(seed, 2)); // high = worn smooth
  const hills = fbm(x, z, 230, salt(seed, 3));
  const rough = fbm(x, z, 60, salt(seed, 4));
  const ridge = 1 - Math.abs(2 * fbm(wx, wz, 480, salt(seed, 5)) - 1);
  const temp = fbm(x, z, 1600, salt(seed, 7));
  const moist = fbm(x, z, 1200, salt(seed, 8));
  const flora = fbm(x, z, 700, salt(seed, 14)); // splits woods into groves

  // Continental spline: a wide, low coastal apron, then plains, uplands and
  // highlands. The apron is broad and barely above the water so shores step
  // down through the shallows into a beach instead of standing off a ledge.
  let h: number;
  if (continental < 0.34) h = lerp(-0.5, 2.2, continental / 0.34);
  else if (continental < 0.58) h = lerp(2.2, 12, (continental - 0.34) / 0.24);
  else if (continental < 0.75) h = lerp(12, 26, (continental - 0.58) / 0.17);
  else h = lerp(26, 38, (continental - 0.75) / 0.25);

  // Erosion decides how much the small stuff still shows. Near the water
  // line the small-scale relief is damped toward flat, so shores ramp down
  // into beaches instead of walling up into cliffs (some cliffs still form
  // where the land was already high — the damp only holds the low coast down).
  const jag = 1 - erosion;
  const coastalRelief = 0.25 + 0.75 * smooth(0.27, 0.42, continental);
  h += (hills - 0.5) * (8 + 20 * jag) * coastalRelief;
  h += (rough - 0.5) * 5 * jag * coastalRelief;

  // Mountains: ridged peaks where the land swells and hasn't worn down. Sharper
  // spines (higher exponent → deeper passes between ridgelines) and a cold-country
  // boost so the high, frozen ranges tower and snow-cap dramatically.
  const peakMask = smooth(0.58, 0.85, continental) * (1 - smooth(0.35, 0.7, erosion));
  const alpineBoost = 1 + smooth(0.34, 0.12, temp) * 0.45; // colder land climbs higher
  h += Math.pow(ridge, 2.5) * peakMask * 60 * alpineBoost;
  // Wet lowlands settle flatter and boggier; the dry-mesa and dune shaping
  // below already handles hot country, so this gently damps the rolling relief
  // where the ground is low and soaked (swamps, fens, river flats).
  if (h < 12 && moist > 0.66) h = lerp(h, Math.min(h, 6 + (hills - 0.5) * 2), 0.5);

  const desertish = temp > 0.68 && moist < 0.4;
  if (desertish && jag > 0.35 && h > 9) {
    // Badlands: hard 4-block mesa benches with a little crumble.
    h = Math.round(h / 4) * 4 + (rough - 0.5) * 1.2;
  } else if (jag > 0.55 && h > 9) {
    // Terraces: unweathered slopes snap toward 3-block cliff steps.
    const stepped = Math.round(h / 3) * 3;
    h = lerp(h, stepped, (jag - 0.55) / 0.45);
  } else if (desertish && h < 9) {
    // Dunes: soft ridged swells rolling across the open sand flats.
    h += (1 - Math.abs(2 * fbm(x, z, 70, salt(seed, 20)) - 1)) * 2.5;
  }

  // Rivers sink whole valleys, not just their channels.
  const riverField = 1 - Math.abs(2 * fbm(wx, wz, 620, salt(seed, 6)) - 1);
  const valley = smooth(0.8, 0.93, riverField);
  if (h > 4) h -= valley * (h - 4) * 0.55;
  const lowland = h < 15;
  const riverCore = lowland && riverField > 0.93 ? (riverField - 0.93) / 0.07 : 0;

  // Beyond the continental shelf: open ocean, scattered islands.
  let ocean = false;
  let island = false;
  if (continental < 0.19) {
    const islandField = fbm(wx, wz, 340, salt(seed, 9));
    if (islandField > 0.8) {
      island = true;
      h = 1 + (islandField - 0.8) * 35;
    } else {
      ocean = true;
      // Shallow at the beach (−1), dropping off toward the deep.
      h = -1 - Math.round(smooth(0.19, 0.05, continental) * 5);
    }
  }

  // Still water inland: basin lakes on the flats, warm swamp pools, and
  // rare desert oases wearing a ring of green.
  const lake = !ocean && !island && continental < 0.3 && h < 1.6;
  const oasisField = desertish ? vnoise(x, z, 220, salt(seed, 24)) : 0;
  const swampField = temp > 0.34 && moist > 0.7 ? vnoise(x, z, 48, salt(seed, 13)) : 0;
  const pool =
    !ocean && !island && !lake && riverCore === 0 && h > 0 && h < 9 &&
    (swampField > 0.8 || oasisField > 0.88);
  // Grade a shallow bowl around a pool so its banks slope down into the water
  // instead of walling off a sheer stone cliff. The rim starts sinking below
  // the pool threshold and eases to the basin floor at the core — computed from
  // the same fields, so it stays a pure function of (seed, x, z). Uses the
  // pre-sink h for the pool test above, then dips the land here.
  if (!ocean && !island && !lake && riverCore === 0 && h > 0 && h < 12) {
    const basin = Math.max(smooth(0.68, 0.8, swampField), smooth(0.8, 0.9, oasisField));
    if (basin > 0) h = lerp(h, -1, basin);
  }

  // Still-water surface height, graded so basins are a shallow bowl: −1 at
  // the rim, deepening toward the middle (the deeper the land dipped, the
  // deeper the water). Beaches then slope through shallows to open water.
  let waterH = 0;
  if (ocean) waterH = Math.round(h);
  else if (lake) waterH = -Math.max(1, Math.min(4, Math.round(2 - h)));
  else if (pool) waterH = -1;

  return { h, waterH, continental, erosion, riverField, riverCore, lake, pool, ocean, island, lowland, temp, moist, flora, oasisField };
}

type HeightCache = Map<number, number>;

// The widest river a road will bridge. Anything wider (broad rivers, lakes, the
// sea) is left unbridged — the track simply meets the bank — so the world never
// grows super-long bridges or bridge-to-bridge spans.
const MAX_BRIDGE_SPAN = 30;

/** Open, unfrozen water at this cell (river channel, lake or pool — not ocean-vs
 *  -inland distinction; used only to measure how wide a crossing is). */
function isOpenWater(seed: number, x: number, z: number): boolean {
  const f = heightFields(seed, x, z);
  return f.ocean || f.riverCore > 0 || f.lake || f.pool;
}

/** Count contiguous open-water cells through (x,z) along a unit direction. */
function waterRunAlong(seed: number, x: number, z: number, ux: number, uz: number, limit: number): number {
  let run = 1; // the cell itself
  for (const s of [1, -1]) {
    for (let k = 1; k <= limit + 1; k++) {
      if (isOpenWater(seed, Math.round(x + ux * s * k), Math.round(z + uz * s * k))) run++;
      else break;
    }
  }
  return run;
}

/** Fallback: some straight axis crosses open water in a run ≤ maxSpan. */
function narrowWaterCrossing(seed: number, x: number, z: number, maxSpan: number): boolean {
  const dirs = [[1, 0], [0, 1], [0.707, 0.707], [0.707, -0.707]] as const;
  for (const [dx, dz] of dirs) if (waterRunAlong(seed, x, z, dx, dz, maxSpan) <= maxSpan) return true;
  return false;
}

/**
 * Whether a bridge belongs at this water cell: the road must actually CROSS the
 * channel here, spanning ≤ maxSpan. We take the road's travel direction as the
 * perpendicular to the gradient of distance-to-road, then measure the open-water
 * run ALONG that direction. A road that merely runs alongside a river (travel
 * parallel to the water) sees a long run and gets no bridge — killing the long,
 * chained bridges. Village lanes (no road-distance field) fall back to the
 * any-axis narrow test.
 */
function bridgeCrossingOk(seed: number, x: number, z: number, maxSpan: number): boolean {
  const s = 2;
  const dpx = roadDist(seed, x + s, z), dmx = roadDist(seed, x - s, z);
  const dpz = roadDist(seed, x, z + s), dmz = roadDist(seed, x, z - s);
  if (![dpx, dmx, dpz, dmz].every(Number.isFinite)) return narrowWaterCrossing(seed, x, z, maxSpan);
  const gx = dpx - dmx, gz = dpz - dmz;
  const len = Math.hypot(gx, gz);
  if (len < 1e-6) return narrowWaterCrossing(seed, x, z, maxSpan);
  // Travel direction = perpendicular to the distance gradient.
  const ux = -gz / len, uz = gx / len;
  return waterRunAlong(seed, x, z, ux, uz, maxSpan) <= maxSpan;
}

// A short plank jetty length: where a road's line meets water too wide to bridge,
// the first few water cells from the bank become a dock instead of dead-ending.
const DOCK_LEN = 4;

/** True when this water cell is within DOCK_LEN of a shore ALONG the road's
 *  travel direction — a jetty jutting out from the bank the road arrives on. */
function dockCell(seed: number, x: number, z: number): boolean {
  const s = 2;
  const dpx = roadDist(seed, x + s, z), dmx = roadDist(seed, x - s, z);
  const dpz = roadDist(seed, x, z + s), dmz = roadDist(seed, x, z - s);
  if (![dpx, dmx, dpz, dmz].every(Number.isFinite)) return false;
  const gx = dpx - dmx, gz = dpz - dmz;
  const len = Math.hypot(gx, gz);
  if (len < 1e-6) return false;
  const ux = -gz / len, uz = gx / len; // road travel direction
  for (const sgn of [1, -1]) {
    for (let k = 1; k <= DOCK_LEN; k++) {
      if (!isOpenWater(seed, Math.round(x + ux * sgn * k), Math.round(z + uz * sgn * k))) {
        return true; // dry land within DOCK_LEN this way → we're on a jetty
      }
    }
  }
  return false;
}

function rawHeight(seed: number, x: number, z: number, cache?: HeightCache): number {
  const key = x * 2097152 + z;
  const hit = cache?.get(key);
  if (hit !== undefined) return hit;
  const f = heightFields(seed, x, z);
  const natural = f.ocean
    ? f.waterH
    : f.riverCore > 0
      ? -1 - Math.round(f.riverCore * 2)
      : f.lake
        ? f.waterH
        : f.pool
          ? f.waterH
          : Math.round(f.h);
  // The wall's top wins; then a gate trail's graded ramp height; then the vale
  // plains/feather height; then the natural land. (Must match terrainAt so the
  // sim walks the same surface it renders.)
  const wall = valeWall(seed, x, z);
  const pathGate = wall === null ? valePathGate(seed, x, z) : -1;
  const ground = valeGroundHeight(seed, x, z, Math.round(f.h));
  const onWater = f.ocean || f.riverCore > 0 || f.lake || f.pool;
  const h =
    wall !== null
      ? wall.h
      : pathGate >= 0 && (ground !== null || !onWater)
        ? valePathHeight(seed, pathGate, Math.hypot(x - townAnchor(seed).x, z - townAnchor(seed).z))
        : ground !== null
          ? ground
          : natural;
  cache?.set(key, h);
  return h;
}

/** The pure terrain function — identical no matter which chunk asks. */
export function terrainAt(seed: number, x: number, z: number, cache?: HeightCache): CellSample {
  const f = heightFields(seed, x, z);

  // Climate drives biomes; altitude cools. Flora noise splits the woods
  // into oak forest, birch groves and dark forest, and dots the plains
  // with flower meadows, so same-climate country still changes character.
  // Per-cell dither raggeds the biome borders so they read as gradual
  // transitions instead of drawn lines; water decisions (freezing) use
  // the undithered climate so lake lids stay coherent.
  const tempBase = f.temp - Math.max(0, f.h - 14) * 0.011;
  const temp = tempBase + (cellHash(x, z, salt(seed, 26)) - 0.5) * 0.05;
  const moist = f.moist + (cellHash(z, x, salt(seed, 27)) - 0.5) * 0.05;
  // Corruption: rare blighted country where the land itself turned. The
  // fights are harder and the ground is stingier, but the loot is richer.
  const corrupt = fbm(x, z, 1400, salt(seed, 39)) > 0.81;
  let biome = 0;
  // Rare special biomes carve pockets out of the ordinary climate bands, each
  // gated by its own low-frequency noise so it only turns up here and there.
  // Corruption always wins over these gentler places.
  const special = corrupt ? 0
    : temp > 0.44 && temp < 0.7 && moist > 0.5 && vnoise(x, z, 600, salt(seed, 71)) > 0.86 ? 21 // cherry orchard
    : temp > 0.2 && temp < 0.44 && moist > 0.58 && f.h > 10 && vnoise(x, z, 520, salt(seed, 72)) > 0.82 ? 22 // redwood
    : temp > 0.5 && temp < 0.74 && moist > 0.33 && moist < 0.6 && f.h < 18 && vnoise(x, z, 560, salt(seed, 73)) > 0.87 ? 23 // sunflower prairie
    : temp > 0.4 && temp < 0.62 && moist > 0.4 && moist < 0.62 && vnoise(x, z, 540, salt(seed, 74)) > 0.86 ? 24 // autumn woods
    : temp > 0.32 && temp < 0.58 && moist > 0.6 && vnoise(x, z, 720, salt(seed, 75)) > 0.9 ? 25 // glowshroom hollow
    : 0;
  if (f.island && vnoise(x, z, 500, salt(seed, 16)) > 0.78) biome = 11;
  else if (special) biome = special;
  else if (temp < 0.13) biome = 19; // glacier: the frozen heart of the cold
  else if (temp < 0.2) biome = 5;
  else if (temp < 0.34) biome = 2;
  else if (temp > 0.83 && moist < 0.13) biome = 18; // volcanic wastes: hottest, driest
  else if (temp > 0.72 && moist < 0.25) biome = 14; // badlands: the harshest desert
  else if (temp > 0.68 && moist < 0.4) biome = 3;
  else if (moist > 0.7 && f.h < 9) biome = temp > 0.55 ? 4 : 15; // warm swamp / cool fen
  else if (corrupt) biome = moist > 0.48 ? 17 : 16; // blightwood / gravemoor
  else if (temp > 0.6 && moist > 0.62) biome = 7;
  else if (temp > 0.6 && moist < 0.52) biome = 6;
  else if (f.h > 30 && temp < 0.58 && moist >= 0.4) biome = 20; // alpine pines: high, cool, green
  else if (f.h > 22 && moist < 0.55) biome = 12; // moorland uplands
  else if (moist > 0.48 && vnoise(x, z, 650, salt(seed, 29)) > 0.86) biome = 13; // elder grove
  else if (moist > 0.48) biome = f.flora > 0.68 ? 8 : f.flora < 0.3 ? 9 : 1;
  else if (f.flora > 0.74) biome = 10;

  // The starter vale: a flat grass plains (with a stone quarry to mine), kept
  // clear of trees and nodes (feature suppression on inStarterTown), ringed by a
  // level-topped cobblestone castle wall with arched gateways. The wall wins,
  // then the plains fills the interior and feathers out to the natural land.
  const wall = valeWall(seed, x, z);
  if (wall !== null) return { h: wall.h, block: wall.block, biome: 0, water: false };
  const a = townAnchor(seed);
  const ground = valeGroundHeight(seed, x, z, Math.round(f.h));
  // A gate's trail is a gravel road graded to a walkable switchback ramp — from
  // the spawn, out through the gateway, and winding far into the wild, climbing
  // whatever rises it meets one block at a time. It gives way only to real water.
  const pathGate = valePathGate(seed, x, z);
  if (pathGate >= 0 && (ground !== null || !(f.ocean || f.riverCore > 0 || f.lake || f.pool))) {
    const r = Math.sqrt((x - a.x) * (x - a.x) + (z - a.z) * (z - a.z));
    // Where the trail passes through the wall it's a gate arch (a gravel floor
    // with a cobble arch drawn over it); elsewhere it's plain gravel.
    const inBand = r >= WALL_INNER && r <= WALL_OUTER;
    return { h: valePathHeight(seed, pathGate, r), block: inBand ? "gatearch" : "gravel", biome: 0, water: false };
  }
  // Inside the wall the vale wears its own surfaces (grass, the quarry). The
  // outer skirt keeps the vale's feathered HEIGHT but wears the WILD's own
  // blocks, so the town blends seamlessly into the country instead of ending in
  // a hard grass/biome line — the seam then hides beneath the wall. `featherH`
  // lifts that wild block to the ramp height.
  let featherH: number | null = null;
  if (ground !== null) {
    const inside = (x - a.x) * (x - a.x) + (z - a.z) * (z - a.z) <= TOWN_RADIUS * TOWN_RADIUS;
    if (inside) {
      const block: BlockType = inValeQuarry(seed, x, z) ? "stone" : "grass";
      return { h: ground, block, biome: 0, water: false };
    }
    featherH = ground;
  }

  // Water: ocean beyond the shelf, river channels, lakes, swamp pools. The
  // town skirt fills over any water so its ramp stays walkable ground.
  if (featherH === null && (f.ocean || f.riverCore > 0 || f.lake || f.pool)) {
    // A road (or village lane) crossing a NARROW inland channel gets a plank
    // bridge deck at the shore height. Wide water (broad rivers, lakes, the sea)
    // is never bridged — the track just meets the bank — so we never grow long
    // or chained bridges.
    if (
      !f.ocean &&
      (roadSurface(seed, x, z) !== null || onVillageLane(seed, x, z)) &&
      bridgeCrossingOk(seed, x, z, MAX_BRIDGE_SPAN)
    ) {
      return { h: Math.max(1, Math.round(f.h)), block: "bridge", biome, water: false };
    }
    // Road meets water too wide to bridge → a short plank dock juts from the
    // bank (the road's own line runs near here) instead of dead-ending. Rendered
    // as the same open-underneath plank deck on piers.
    if (!f.ocean && roadDist(seed, x, z) < 3 && dockCell(seed, x, z)) {
      return { h: Math.max(1, Math.round(f.h)), block: "bridge", biome, water: false };
    }
    // Cold country freezes over: lakes, pools and rivers wear a walkable
    // ice lid; the open ocean only caps where it is truly arctic.
    if (tempBase < 0.2 && (!f.ocean || tempBase < 0.12)) {
      return { h: 0, block: "ice", biome, water: false };
    }
    const h = f.riverCore > 0 ? -1 - Math.round(f.riverCore * 2) : f.waterH;
    return { h, block: "water", biome, water: true };
  }

  const h = Math.round(f.h);
  let block: BlockType = "grass";

  // A fine per-cell jitter added to the ground-block noise thresholds below, so
  // the boundary between grass and the darker soils (drygrass, coarse dirt,
  // podzol, mud…) speckles into a gradient instead of snapping along a hard
  // line — the two blocks interleave across a few cells and blend.
  const bjit = (cellHash(x, z, salt(seed, 72)) - 0.5) * 0.16;

  // Shorelines: sand collars every water body; wet dirt above that. The
  // lake/pond collar is generous so basins get a real beach ring, not a
  // one-cell trim before the ground walls up.
  const nearRiver = !f.island && f.lowland && f.riverField > 0.9 && f.h <= 5;
  const nearLake = !f.island && f.continental < 0.34 && f.h <= 4;
  // Beach width breathes with its own noise so coastlines aren't a
  // constant-width sand ribbon.
  const beachW = 2 + Math.round(vnoise(x, z, 130, salt(seed, 15)) * 4);
  const coast = f.island ? h <= 2 : f.continental < 0.22 && h <= beachW;
  if (coast && biome !== 11) block = "sand";
  else if (biome === 11) block = h <= 1 ? "sand" : vnoise(x, z, 40, salt(seed, 48)) > 0.62 ? "moss" : "mycelium";
  else if (biome === 3 && f.oasisField > 0.78) block = "grass"; // oasis ring
  else if (nearRiver || nearLake) {
    // Beach, then a clay bank in the wet fringe, then dirt up to the grass.
    block = h <= 3 ? "sand" : h <= 4 && vnoise(x, z, 34, salt(seed, 50)) > 0.62 ? "clay" : h <= 5 ? "dirt" : "grass";
  }
  else if (biome === 3) block = vnoise(x, z, 90, salt(seed, 9)) > 0.72 ? "redsand" : "sand";
  else if (biome === 4) {
    // Swamp: muck, with clay flats surfacing in the low wet ground.
    const t = vnoise(x, z, 60, salt(seed, 10));
    block = t > 0.6 + bjit ? "mud" : t < 0.18 + bjit && h <= 4 ? "clay" : "grass";
  }
  else if (biome === 5) block = vnoise(x, z, 64, salt(seed, 28)) > 0.82 ? "ice" : "snow"; // slick frozen patches
  else if (biome === 2 && h > 26) block = "snow";
  else if (biome === 2) {
    // Taiga floor: needle-strewn podzol and coarse dirt under the spruce.
    const t = vnoise(x, z, 80, salt(seed, 11));
    block = t > 0.72 + bjit ? "podzol" : t > 0.58 + bjit ? "coarsedirt" : "grass";
  }
  else if (biome === 6) block = vnoise(x, z, 100, salt(seed, 17)) > 0.62 + bjit ? "grass" : "drygrass";
  else if (biome === 7) {
    // Jungle: mossy floor breaking to mud in the hollows.
    const t = vnoise(x, z, 55, salt(seed, 18));
    block = t > 0.85 + bjit ? "mud" : t > 0.6 + bjit ? "moss" : "grass";
  }
  else if (biome === 1) {
    // Forest: mostly turf, worn to coarse dirt and the odd gravel patch.
    const t = vnoise(x, z, 95, salt(seed, 46));
    block = t > 0.9 + bjit ? "gravel" : t > 0.8 + bjit ? "coarsedirt" : "grass";
  }
  else if (biome === 9) block = vnoise(x, z, 70, salt(seed, 19)) > 0.78 + bjit ? "dirt" : "grass";
  else if (biome === 13) {
    // Elder grove: deep moss and podzol beneath the ancient canopy.
    const t = vnoise(x, z, 70, salt(seed, 47));
    block = t > 0.74 + bjit ? "moss" : t > 0.52 + bjit ? "podzol" : "grass";
  }
  else if (biome === 12) {
    // Moorland: heathery drygrass over grass, worn andesite breaking through.
    const m = vnoise(x, z, 85, salt(seed, 30));
    block = m > 0.8 + bjit ? "andesite" : m > 0.45 + bjit ? "drygrass" : "grass";
  } else if (biome === 14) {
    // Painted mesa: terracotta strata banded by height, sand at the base.
    const jitter = Math.round(vnoise(x, z, 20, salt(seed, 34)) * 2);
    const band = (((h + jitter) % 9) + 9) % 9;
    block = h <= beachW + 1 ? "redsand"
      : band < 2 ? "redterracotta" : band < 3 ? "orangeterracotta"
      : band < 4 ? "whiteterracotta" : band < 5 ? "terracotta"
      : band < 7 ? "redsand" : "orangeterracotta";
  }
  else if (biome === 15) {
    const t = vnoise(x, z, 50, salt(seed, 35));
    block = t > 0.58 ? "mud" : t < 0.16 ? "clay" : "grass";
  }
  else if (biome === 16) {
    // Gravemoor: sickly turf torn wide open by grave dirt and old stone.
    const g = vnoise(x, z, 70, salt(seed, 40));
    block = g > 0.7 + bjit ? "andesite" : g > 0.42 + bjit ? "coarsedirt" : "drygrass";
  } else if (biome === 17) {
    // Blightwood: mycelium creep strangling the forest floor.
    block = vnoise(x, z, 60, salt(seed, 44)) > 0.52 + bjit ? "mycelium" : "grass";
  } else if (biome === 18) {
    // Volcanic wastes: scorched andesite and cracked red flats.
    const v = vnoise(x, z, 55, salt(seed, 68));
    block = v > 0.72 ? "andesite" : v > 0.4 ? "coarsedirt" : "redsand";
  } else if (biome === 19) {
    // Glacier: a sheet of blue ice broken by driven snow.
    block = vnoise(x, z, 50, salt(seed, 69)) > 0.5 ? "ice" : "snow";
  } else if (biome === 20) {
    // Alpine pines: podzol and grass over andesite bones.
    const v = vnoise(x, z, 60, salt(seed, 70));
    block = v > 0.72 ? "andesite" : v > 0.45 ? "podzol" : "grass";
  } else if (biome === 21) {
    // Cherry orchard: soft turf under the blossom, mossy in the shade.
    block = vnoise(x, z, 46, salt(seed, 76)) > 0.72 ? "moss" : "grass";
  } else if (biome === 22) {
    // Redwood: deep podzol and moss carpeting the old-growth floor.
    const v = vnoise(x, z, 50, salt(seed, 77));
    block = v > 0.66 ? "moss" : v > 0.3 ? "podzol" : "coarsedirt";
  } else if (biome === 23) {
    // Sunflower prairie: bright open grassland, sun-bleached at the edges.
    block = vnoise(x, z, 90, salt(seed, 78)) > 0.85 ? "drygrass" : "grass";
  } else if (biome === 24) {
    // Autumn woods: leaf-littered dirt and turning grass.
    const v = vnoise(x, z, 54, salt(seed, 79));
    block = v > 0.68 + bjit ? "coarsedirt" : v > 0.34 + bjit ? "podzol" : "grass";
  } else if (biome === 25) {
    // Glowshroom hollow: mycelium creep glowing over damp moss.
    block = vnoise(x, z, 44, salt(seed, 80)) > 0.5 + bjit ? "mycelium" : "moss";
  }
  // Dry plains: drygrass fades in as it dries out — the moisture edge itself is
  // dithered (bjit) so the drygrass/grass boundary blends rather than snapping.
  else if (biome === 0 && moist < 0.3 + bjit * 0.5) block = vnoise(x, z, 120, salt(seed, 12)) > 0.5 + bjit ? "drygrass" : "grass";

  // Slope-exposed rock: cliff faces shed their soil (pure neighbor probes).
  let slope = 0;
  slope = Math.max(slope, Math.abs(rawHeight(seed, x + 1, z, cache) - h));
  slope = Math.max(slope, Math.abs(rawHeight(seed, x - 1, z, cache) - h));
  slope = Math.max(slope, Math.abs(rawHeight(seed, x, z + 1, cache) - h));
  slope = Math.max(slope, Math.abs(rawHeight(seed, x, z - 1, cache) - h));
  // Cliffs bare their rock — stone veined with andesite and pale calcite —
  // but never at the water's edge (beaches slope in) nor on the mesa, whose
  // terracotta benches keep their colour on the cut face.
  const isMesa = block === "terracotta" || block === "redterracotta" ||
    block === "orangeterracotta" || block === "whiteterracotta";
  if (slope >= 3 && block !== "sand" && block !== "redsand" && !isMesa && !nearRiver && !nearLake) {
    block = cliffRock(seed, x, z);
  }
  // High country: bare rock above the treeline, then snowcaps. Lowered so the
  // taller ranges wear real rock shoulders and white peaks.
  if (h > 44 && !isMesa) block = cliffRock(seed, x, z);
  if (h > 54 || (h > 34 && temp < 0.34)) block = "snow";

  // Roads: a trodden track wins over ordinary ground on gentle, walkable
  // terrain (never across ocean beaches, cliff faces, snowcaps or deep desert
  // banding). It now paves right up to river and lake edges too, so the track
  // meets its bridge deck instead of dead-ending a few cells short of the bank.
  if (slope < 3 && h <= 40 && !coast && !isMesa && block !== "snow") {
    const road = roadSurface(seed, x, z);
    if (road) block = road;
    // Village lanes: trodden dirt paths from the green out to each cottage,
    // laid over the same gentle ground the plaza and homes stand on.
    else if (onVillageLane(seed, x, z)) block = "coarsedirt";
  }

  // The town skirt lifts the wild block onto the reachable ramp height.
  return { h: featherH ?? h, block, biome, water: false };
}

// ---------------------------------------------------------------------------
// Roads: a deterministic warped grid of trodden paths spanning the whole
// world, so wherever you wander a road is never far and always leads on to
// somewhere. Nodes sit on a jittered lattice; each connects to its east and
// south neighbour (most edges kept) forming one connected, meandering network.
// Membership is a pure function of a small lattice neighbourhood — no global
// search — so it composes with the chunked, pure-function world.
// ---------------------------------------------------------------------------

/** Lattice spacing between road junctions (cells). */
const PATH_L = 104;

/** The jittered junction position for lattice cell (gx,gz). */
function roadNode(seed: number, gx: number, gz: number): { x: number; z: number } {
  const jx = (cellHash(gx * 2 + 1, gz * 2 + 7, salt(seed, 90)) - 0.5) * PATH_L * 0.5;
  const jz = (cellHash(gx * 3 + 5, gz * 5 + 2, salt(seed, 91)) - 0.5) * PATH_L * 0.5;
  return { x: gx * PATH_L + PATH_L / 2 + jx, z: gz * PATH_L + PATH_L / 2 + jz };
}

/** Whether the edge leaving (gx,gz) — dir 0 = east, 1 = south — is a road. A
 *  few edges drop out so the grid meanders instead of reading as a lattice. */
function roadEdgeKept(seed: number, gx: number, gz: number, dir: 0 | 1): boolean {
  return cellHash(gx * 7 + dir * 131 + 3, gz * 13 + 5, salt(seed, 92)) < 0.82;
}

/** Perpendicular distance from (px,pz) to segment (ax,az)-(bx,bz). */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/** Distance (cells) from (x,z) to the nearest road centre-line. */
export function roadDist(seed: number, x: number, z: number): number {
  const gx = Math.floor(x / PATH_L), gz = Math.floor(z / PATH_L);
  let best = Infinity;
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const a = roadNode(seed, ix, iz);
      if (roadEdgeKept(seed, ix, iz, 0)) {
        const b = roadNode(seed, ix + 1, iz);
        best = Math.min(best, segDist(x, z, a.x, a.z, b.x, b.z));
      }
      if (roadEdgeKept(seed, ix, iz, 1)) {
        const b = roadNode(seed, ix, iz + 1);
        best = Math.min(best, segDist(x, z, a.x, a.z, b.x, b.z));
      }
    }
  }
  return best;
}

/** The road surface at (x,z), or null if no road here: a gravel track with
 *  trodden coarse-dirt shoulders. Callers gate on terrain (no water/cliffs). */
function roadSurface(seed: number, x: number, z: number): BlockType | null {
  const d = roadDist(seed, x, z);
  if (d < 1.5) return "gravel";
  if (d < 2.6) return "coarsedirt";
  return null;
}

/** Cliff and mountain rock: mostly stone, veined with andesite and the odd
 *  seam of pale calcite, so bare rock faces aren't one flat grey. */
function cliffRock(seed: number, x: number, z: number): BlockType {
  const r = vnoise(x, z, 34, salt(seed, 49));
  return r > 0.84 ? "calcite" : r > 0.6 ? "andesite" : "stone";
}

/** Steepness check for feature placement (pure neighbor probes). */
function slopeAt(seed: number, x: number, z: number, h: number, cache?: HeightCache): number {
  let m = 0;
  m = Math.max(m, Math.abs(rawHeight(seed, x + 1, z, cache) - h));
  m = Math.max(m, Math.abs(rawHeight(seed, x - 1, z, cache) - h));
  m = Math.max(m, Math.abs(rawHeight(seed, x, z + 1, cache) - h));
  m = Math.max(m, Math.abs(rawHeight(seed, x, z - 1, cache) - h));
  return m;
}

// ---------------------------------------------------------------------------
// Starter town: one small, hand-shaped settlement every seeded world shares.
// The wilderness is otherwise entirely random; this is the fenced yard with
// the animals and camp the player wakes up in. Its ground is flattened to a
// plateau (feathered into the natural terrain) so the yard is always level,
// and it sits at a dry, gentle cell near the world anchor.
// ---------------------------------------------------------------------------

/** The starter vale: a circle of natural ground kept clear of trees and nodes,
 *  ringed by a cobblestone castle wall. Everything within this radius is the
 *  player's clean building canvas; the wild begins at the wall. */
export const TOWN_RADIUS = 125;
const TOWN_FEATHER = 18;
/** Back-compat alias: the old square half-extent some callers still reference. */
export const TOWN_HALF = TOWN_RADIUS;

const townAnchorCache = new Map<number, { x: number; z: number; h: number }>();

/** The town's anchor cell (yard centre) for a seed: a dry, gentle spot near
 *  the world centre. Uses natural heightFields only, so it never recurses
 *  through the plateau override below. Memoized per seed. */
function townAnchor(seed: number): { x: number; z: number; h: number } {
  const hit = townAnchorCache.get(seed);
  if (hit) return hit;
  let found = { x: ENDLESS_CENTER, z: ENDLESS_CENTER, h: 4 };
  let fallback: { x: number; z: number; h: number } | null = null;
  let haveEgress = false;
  search: for (let ring = 0; ring < 800; ring += 6) {
    for (let a = 0; a < 24; a++) {
      const x = ENDLESS_CENTER + Math.round(Math.cos((a / 24) * Math.PI * 2) * ring);
      const z = ENDLESS_CENTER + Math.round(Math.sin((a / 24) * Math.PI * 2) * ring);
      const f = heightFields(seed, x, z);
      if (f.ocean || f.island || f.lake || f.pool || f.riverCore > 0) continue;
      const h = Math.round(f.h);
      if (h < 1 || h > 22) continue; // dry, below the treeline/snow
      // Gentle ground: the four natural neighbors stay within a block.
      let steep = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (Math.abs(Math.round(heightFields(seed, x + dx, z + dz).h) - h) > 1) { steep = true; break; }
      }
      if (steep) continue;
      const cand = { x, z, h: Math.max(2, h) };
      fallback ??= cand; // first dry, gentle spot — used if none has clear egress
      // Egress: enough dry land just beyond the meadow rim that the player is
      // never boxed onto a near-island with no walkable way out.
      let land = 0;
      const ringR = TOWN_RADIUS + TOWN_FEATHER + 6;
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const ef = heightFields(seed, x + Math.round(Math.cos(ang) * ringR), z + Math.round(Math.sin(ang) * ringR));
        if (!ef.ocean && !ef.lake && !ef.pool && ef.riverCore === 0) land++;
      }
      if (land >= 11) { found = cand; haveEgress = true; break search; }
    }
  }
  if (!haveEgress && fallback) found = fallback;
  townAnchorCache.set(seed, found);
  return found;
}

/** True inside the flat starter meadow (features and streamed spawns keep out). */
export function inStarterTown(seed: number, x: number, z: number): boolean {
  const a = townAnchor(seed);
  const dx = x - a.x, dz = z - a.z;
  return dx * dx + dz * dz <= TOWN_RADIUS * TOWN_RADIUS;
}

// ---------------------------------------------------------------------------
// The starter vale: a flat grass plains (with a stone quarry to mine) walled
// off from the wild by a level-topped cobblestone castle wall. Arched gateways
// cut through the wall where the ground outside is dry.
// ---------------------------------------------------------------------------
const WALL_INNER = TOWN_RADIUS - 4; // the ring is the outer 4 cells of the vale
const WALL_OUTER = TOWN_RADIUS;
const WALL_HEIGHT = 12;             // a tall curtain wall; merlons rise one higher
const GATE_HALF = 0.024;            // radians; margin used when checking gates are dry
const PATH_HALF = 1.9;             // perpendicular half-width of an interior path
// The mining quarry: a patch of stone in the plains, offset from the spawn.
// Kept well inside the (now smaller) wild interior so it doesn't touch the wall.
const STONE_CX = 37, STONE_CZ = -26, STONE_R = 16;

// The vale keeps its wild, rolling shape in the middle; only the outer band
// ramps to a level base so the wall sits clean. Radius where the wild interior
// gives way to the wall's flat footing.
export const WILD_R = WALL_INNER - 42;

/** The outer skirt length at an angle: about half the circle (per ~15° sector)
 *  gets a long, gentle ramp to the wild — a reachable riverbank — and the rest
 *  keeps a short, steeper skirt, so the banks are half-and-half reachable. */
function valeFeather(seed: number, ang: number): number {
  const bucket = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 24);
  return cellHash(bucket, 777, salt(seed, 84)) > 0.5 ? 55 : 16;
}

/** Vale ground height: the wild natural land in the middle, ramped to the wall's
 *  level footing in the outer band, then an angle-varied skirt out to the wild.
 *  Null well beyond the skirt (ordinary wilderness). */
function valeGroundHeight(seed: number, x: number, z: number, naturalH: number): number | null {
  const a = townAnchor(seed);
  const dx = x - a.x, dz = z - a.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const fl = valeFeather(seed, Math.atan2(dz, dx));
  if (d > TOWN_RADIUS + fl) return null;
  if (d <= WILD_R) return naturalH;                                   // wild interior keeps its shape
  if (d <= WALL_INNER) return Math.round(lerp(naturalH, a.h, (d - WILD_R) / (WALL_INNER - WILD_R)));
  if (d <= TOWN_RADIUS) return a.h;                                   // level footing under the wall
  return Math.round(lerp(a.h, naturalH, (d - TOWN_RADIUS) / fl));     // reachable skirt (long on ~half)
}

/** True inside the plains' stone quarry (a place to mine). */
function inValeQuarry(seed: number, x: number, z: number): boolean {
  const a = townAnchor(seed);
  const dx = x - a.x - STONE_CX, dz = z - a.z - STONE_CZ;
  return dx * dx + dz * dz <= STONE_R * STONE_R;
}

/** The gateway centre angles for a seed: up to four, each rotated to the driest
 *  candidate near a cardinal so no gate opens onto water. Memoized. */
const valeGateCache = new Map<number, number[]>();
function valeGates(seed: number): number[] {
  const hit = valeGateCache.get(seed);
  if (hit) return hit;
  const a = townAnchor(seed);
  const wet = (ang: number, rad: number): boolean => {
    const f = heightFields(seed, a.x + Math.round(Math.cos(ang) * rad), a.z + Math.round(Math.sin(ang) * rad));
    return f.ocean || f.lake || f.pool || f.riverCore > 0;
  };
  // A gate direction is "dry" only if a wide cone around it — wide enough to
  // contain wherever the winding trail actually crosses the wall and steps out —
  // sits on dry land, so no gateway opens onto water.
  const dryAt = (ang: number): boolean => {
    for (let d = -0.22; d <= 0.221; d += 0.055) {
      for (const rad of [TOWN_RADIUS + 6, TOWN_RADIUS + 22, TOWN_RADIUS + 42]) {
        if (wet(ang + d, rad)) return false;
      }
    }
    return true;
  };
  // Scan the whole circle for directions whose gateway mouth is dry, then take
  // up to four of them, spread at least ~50° apart, biased toward the cardinals.
  const TWO_PI = Math.PI * 2;
  const dry: number[] = [];
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * TWO_PI - Math.PI;
    if (dryAt(ang)) dry.push(ang);
  }
  const gates: number[] = [];
  // Pick the gates from the dry directions in a seed-shuffled order, so each
  // seed's exits point different (random) ways — not always the cardinals —
  // while staying spread out. A seed-varied 2–4 of them.
  const want = 2 + Math.floor(cellHash(3, 7, salt(seed, 85)) * 3); // 2..4
  const shuffled = dry
    .map((ang, i) => ({ ang, k: cellHash(i * 13 + 1, 5, salt(seed, 86)) }))
    .sort((p, q) => p.k - q.k);
  for (const { ang } of shuffled) {
    if (gates.length >= want) break;
    const clash = gates.some((g) => {
      let da = Math.abs(ang - g);
      if (da > Math.PI) da = TWO_PI - da;
      return da < 0.9; // ~50° minimum spacing
    });
    if (!clash) gates.push(ang);
  }
  valeGateCache.set(seed, gates);
  return gates;
}

/**
 * True where an interior path runs: a gravel trail from the spawn out to each
 * (dry) gateway and on through the wall. The paths carve the wall's openings and
 * lead you out onto the reachable skirt.
 */
/** How far a gate's trail winds out into the wild before it fades. */
const PATH_REACH = TOWN_RADIUS + 170;

/** The angular wobble of gate `gi`'s trail at radius `r`: one smooth, continuous
 *  wander from the spawn all the way out — so the path winds randomly inside the
 *  town, crosses the wall at that wandering angle (the gateway is cut there), and
 *  keeps winding into the wild with no kink where the two meet. */
function valePathWobble(seed: number, gi: number, r: number): number {
  const ph = salt(seed, 90 + gi);
  const amp = 0.12 * Math.min(1, r / 110); // grows gently from the spawn outward
  return (Math.sin(r * 0.02 + ph) * 0.6 + Math.sin(r * 0.0085 + ph * 1.9) * 0.9) * amp;
}

/** Which gate's trail (if any) passes through (x,z), else -1. */
function valePathGate(seed: number, x: number, z: number): number {
  const a = townAnchor(seed);
  const dx = x - a.x, dz = z - a.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  if (r < 0.5 || r > PATH_REACH) return -1;
  const ang = Math.atan2(dz, dx);
  const gates = valeGates(seed);
  for (let gi = 0; gi < gates.length; gi++) {
    let da = Math.abs(ang - (gates[gi] + valePathWobble(seed, gi, r)));
    if (da > Math.PI) da = Math.PI * 2 - da;
    const half = PATH_HALF + Math.min(1.4, Math.max(0, r - TOWN_RADIUS) / 120);
    if (da < Math.PI / 2 && r * Math.sin(da) < half) return gi;
  }
  return -1;
}

function valePathAt(seed: number, x: number, z: number): boolean {
  return valePathGate(seed, x, z) >= 0;
}

/**
 * The walkable height of gate `gi`'s trail at radius `r`: a switchback ramp.
 * Built once per (seed, gate) by walking the trail out and clamping each step to
 * ±1, so however steep the wild rise, the winding trail climbs it one block at a
 * time — always walkable. The trail's cells sit at this graded height, cutting a
 * ramp through the slope rather than following the cliff.
 */
const valePathHtCache = new Map<string, Int16Array>();
function valePathHeight(seed: number, gi: number, r: number): number {
  const a = townAnchor(seed);
  // Inside and under the wall the trail lies FLAT on the town floor (a.h) — so
  // it passes through the gateway at ground level and the wall is cut into a
  // clean hole/arch, never a ramp that climbs up and over the battlement. The
  // switchback grade only kicks in OUTSIDE the wall, where the trail winds into
  // the wild one block at a time.
  if (r <= TOWN_RADIUS) return a.h;
  const key = `${seed}:${gi}`;
  let prof = valePathHtCache.get(key);
  if (!prof) {
    const g = valeGates(seed)[gi] ?? 0;
    const n = PATH_REACH - TOWN_RADIUS + 1; // profile spans the wall out to the reach
    prof = new Int16Array(n);
    let h = a.h; // leaves the wall at the town's own floor height
    for (let i = 0; i < n; i++) {
      const rr = TOWN_RADIUS + i;
      const wob = valePathWobble(seed, gi, rr);
      const cx = Math.round(a.x + Math.cos(g + wob) * rr);
      const cz = Math.round(a.z + Math.sin(g + wob) * rr);
      const nat = Math.round(heightFields(seed, cx, cz).h);
      h += Math.sign(nat - h); // step toward the ground by at most one block
      prof[i] = h;
    }
    valePathHtCache.set(key, prof);
  }
  const i = Math.max(0, Math.min(prof.length - 1, Math.round(r) - TOWN_RADIUS));
  return prof[i];
}

/**
 * The castle wall cell at (x,z): a stone-brick curtain with a crenellated top.
 * The whole wall is stone brick; detail comes from its silhouette — ~3-cell
 * merlons raised a course alternate with the walkway, and a stouter buttress
 * pier rises higher every few merlons for relief, like a real castle rampart.
 * Null off the ring, and null where an interior path passes through (the gate).
 */
function valeWall(seed: number, x: number, z: number): { h: number; block: BlockType } | null {
  const a = townAnchor(seed);
  const dx = x - a.x, dz = z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 < WALL_INNER * WALL_INNER || d2 > WALL_OUTER * WALL_OUTER) return null;
  if (valePathAt(seed, x, z)) return null; // a gateway where the path goes through
  const ang = Math.atan2(dz, dx);
  const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 520);
  const merlon = seg % 2 === 0;           // crenellations: raised course, gapped
  const buttress = seg % 16 === 0;        // a taller pier every ~8 merlons
  const rise = buttress ? 3 : merlon ? 1 : 0;
  return { h: a.h + WALL_HEIGHT + rise, block: "stonebrick" };
}

// ---------------------------------------------------------------------------
// Villages: because the interiored homes are big (32×32+, one barely fits a
// chunk), a village can't ring a single chunk. Instead a coarse seed-lattice
// marks village anchors; the chunk holding an anchor lays a green plaza with
// folk, and the chunks around it have their homestead roll boosted — so a
// cluster of interiored homes grows around the commons. Each home still lands
// wholly inside its own chunk, so the pure-function seam holds.
// ---------------------------------------------------------------------------

const VILLAGE_L = 176; // spacing between village anchors
const VILLAGE_R = 96; // how far a village's homestead boost reaches
const villageAnchorCache = new Map<number, { x: number; z: number; ok: boolean }>();

function villageAnchor(seed: number, gx: number, gz: number): { x: number; z: number; ok: boolean } {
  const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
  const hit = villageAnchorCache.get(key * 31 + (seed & 0xff));
  if (hit) return hit;
  const jx = (cellHash(gx * 5 + 1, gz * 7 + 2, salt(seed, 104)) - 0.5) * VILLAGE_L * 0.5;
  const jz = (cellHash(gx * 11 + 3, gz * 13 + 4, salt(seed, 105)) - 0.5) * VILLAGE_L * 0.5;
  const x = Math.round(gx * VILLAGE_L + VILLAGE_L / 2 + jx);
  const z = Math.round(gz * VILLAGE_L + VILLAGE_L / 2 + jz);
  const exists = cellHash(gx * 3 + 5, gz * 17 + 9, salt(seed, 106)) < 0.5;
  let ok = false;
  if (exists) {
    const f = heightFields(seed, x, z);
    const h = Math.round(f.h);
    ok = !f.ocean && !f.island && !f.lake && !f.pool && f.riverCore === 0 &&
      h >= 2 && h <= 22 && !inStarterTown(seed, x, z);
  }
  const res = { x, z, ok };
  villageAnchorCache.set(key * 31 + (seed & 0xff), res);
  return res;
}

/** The nearest active village anchor within influence of (x,z), or null. */
function villageNear(seed: number, x: number, z: number): { x: number; z: number; d: number } | null {
  const gx = Math.floor(x / VILLAGE_L), gz = Math.floor(z / VILLAGE_L);
  let best: { x: number; z: number; d: number } | null = null;
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const a = villageAnchor(seed, ix, iz);
      if (!a.ok) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < VILLAGE_R && (!best || d < best.d)) best = { x: a.x, z: a.z, d };
    }
  }
  return best;
}

// Whether chunk (cx,cz) actually lands a village home, and where its centre is.
// Memoized and pure — it replays tryStampHouse's gate (same asset pick, same
// jittered slot, same flat/dry/off-town pad test) from the raw height field, so
// a lane never routes to a chunk whose home the pad test would reject. It only
// reads heightFields (never terrainAt), so calling it from inside the lane test
// can't recurse back through the road/lane overlay.
const villageHomeCache = new Map<number, { x: number; z: number } | null>();
function villageHomeStamps(seed: number, cx: number, cz: number): { x: number; z: number } | null {
  const ck = (((cx & 0xffff) << 16) | (cz & 0xffff)) * 131 + (seed & 0x7f);
  const cached = villageHomeCache.get(ck);
  if (cached !== undefined) return cached;
  let res: { x: number; z: number } | null = null;
  gate: {
    const pick = cellHash(cx * 6367, cz * 12007, salt(seed, 55));
    const asset = getStructure(WILD_HOUSES[Math.floor(pick * WILD_HOUSES.length)]);
    if (!asset) break gate;
    const w = asset.sx, d = asset.sz;
    if (w + 4 >= ECHUNK || d + 4 >= ECHUNK) break gate;
    const ox = 2 + Math.floor(cellHash(cx, cz, salt(seed, 56)) * (ECHUNK - 4 - w));
    const oz = 2 + Math.floor(cellHash(cz * 13, cx * 29, salt(seed, 57)) * (ECHUNK - 4 - d));
    const x0 = cx * ECHUNK, z0 = cz * ECHUNK;
    let lo = Infinity, hi = -Infinity;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const wx = x0 + ox + dx, wz = z0 + oz + dz;
        const f = heightFields(seed, wx, wz);
        if (f.ocean || f.lake || f.pool || f.riverCore > 0) break gate; // wet/ice (matches tryStampHouse)
        if (inStarterTown(seed, wx, wz)) break gate;
        const h = Math.round(f.h);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    if (hi - lo > 3) break gate; // too steep to level — tryStampHouse bails here
    res = { x: x0 + ox + (w >> 1), z: z0 + oz + (d >> 1) };
  }
  villageHomeCache.set(ck, res);
  return res;
}

/** True where a village lane runs: a spoke from the plaza green out to each
 *  surrounding chunk that actually lands a village home. Pure per-cell (like
 *  the roads), so the lanes stitch across the chunk seams — and gated on the
 *  same roll + pad test the home placement uses, so no lane leads to nowhere. */
function onVillageLane(seed: number, x: number, z: number): boolean {
  const v = villageNear(seed, x, z);
  if (!v) return false;
  const acx = Math.floor(v.x / ECHUNK), acz = Math.floor(v.z / ECHUNK);
  for (let dcx = -1; dcx <= 1; dcx++) {
    for (let dcz = -1; dcz <= 1; dcz++) {
      const ncx = acx + dcx, ncz = acz + dcz;
      if (dcx === 0 && dcz === 0) continue; // the plaza chunk itself
      // Mirror generateChunk's homestead gate: the boosted 0.6 roll only when
      // this neighbour is itself within a village's reach, else the wild 0.05.
      const boosted = villageNear(seed, ncx * ECHUNK + 32, ncz * ECHUNK + 32) !== null;
      if (cellHash(ncx * 40987, ncz * 90001, salt(seed, 58)) >= (boosted ? 0.6 : 0.05)) continue;
      const hc = villageHomeStamps(seed, ncx, ncz);
      if (!hc) continue; // roll passed but the pad test rejects the home — no lane
      if (segDist(x, z, v.x, v.z, hc.x, hc.z) < 2.1) return true;
    }
  }
  return false;
}

/** The interiored-house library scattered as wild homesteads across habitable
 *  country — every furnished design (and its recolors) turns up as a
 *  discovery. Ids follow the pack's folder naming (a1..af8, each with five
 *  _recolored variants); missing ids simply fail the getStructure lookup and
 *  are skipped. Big footprints are self-rarefying: they only land where a
 *  level, dry pad happens to be wide enough. */
const WILD_HOUSES: string[] = (() => {
  const prefixes: string[] = [];
  for (let c = 97; c <= 122; c++) prefixes.push(String.fromCharCode(c)); // a..z
  for (const c of ["a", "b", "c", "d", "e", "f"]) prefixes.push(`a${c}`); // aa..af
  const ids: string[] = [];
  for (const p of prefixes) {
    for (let n = 1; n <= 8; n++) {
      ids.push(`ihouse.${p}${n}`);
      for (let r = 1; r <= 5; r++) ids.push(`ihouse.${p}${n}_recolored_${r}`);
    }
  }
  return ids;
})();

/** A chunk-local rectangle, used to keep natural features out of a stamped
 *  building's footprint. */
interface Box { x0: number; z0: number; x1: number; z1: number }

type Facing = "north" | "south" | "east" | "west";

/** The home's doors as openable door objects: one per baked door panel the
 *  build ships (a floor-height panel — the imported Minecraft door), oriented
 *  the way that panel faces. Designs that ship no door get a single hung door
 *  at their front entrance, so every home has a real door you can open. */
/** Doors an asset actually ships as floor-level door panels — no synthetic
 *  fallback (a build with an open archway gets no invented door). */
function homeDoors(asset: StructureAsset): Array<{ x: number; z: number; facing: Facing }> {
  const feetY = effectiveSink(asset);
  const byCol = new Map<string, { x: number; z: number; y: number; facing: Facing }>();
  for (const b of asset.blocks) {
    if (b.kind !== "panel" || b.y - feetY > 1) continue;
    const k = `${b.x},${b.z}`;
    const cur = byCol.get(k);
    if (!cur || b.y < cur.y) {
      byCol.set(k, { x: b.x, z: b.z, y: b.y, facing: (b.facing as Facing) ?? "south" });
    }
  }
  if (byCol.size > 0) {
    return [...byCol.values()].map((v) => ({ x: v.x, z: v.z, facing: v.facing }));
  }
  const dc = frontDoorCell(asset);
  return [{ x: dc.x, z: dc.z, facing: "south" }];
}

/** The single best doorway in a home's front wall — the gap nearest centre in
 *  the frontmost (largest-z) wall row, so a hung door lands in the real opening.
 *  Falls back to the wall centre when the design has no ground-level gap. */
function frontDoorCell(asset: StructureAsset): { x: number; z: number } {
  const solid = new Set(blockedColumns(asset).map((c) => `${c.x},${c.z}`));
  const W = asset.sx, D = asset.sz;
  let frontZ = -1;
  for (const key of solid) {
    const z = Number(key.slice(key.indexOf(",") + 1));
    if (z > frontZ) frontZ = z;
  }
  if (frontZ < 0) return { x: W >> 1, z: D - 1 };
  const cx = (W - 1) / 2;
  // Prefer a real gap: an open column flanked by wall, searching the front wall
  // and a row or two behind it (porches recess the door).
  for (let z = frontZ; z >= Math.max(0, frontZ - 2); z--) {
    let best = -1, bestD = Infinity;
    for (let x = 1; x < W - 1; x++) {
      if (solid.has(`${x},${z}`)) continue;
      if (!solid.has(`${x - 1},${z}`) || !solid.has(`${x + 1},${z}`)) continue;
      const d = Math.abs(x - cx);
      if (d < bestD) { bestD = d; best = x; }
    }
    if (best >= 0) return { x: best, z };
  }
  return { x: Math.round(cx), z: frontZ };
}

// ---------------------------------------------------------------------------
// The spawn village: a dozen distinct medieval houses arranged organically
// around the central green (the camp), each reached by a cobbled path. The
// layout is a pure function of the seed so terrain paths and house placement
// always agree, and it is memoised so the hot terrain sampler stays cheap.
// ---------------------------------------------------------------------------

/** The starter-town buildings, in clockwise ring order from the north. A curated
 *  set of the cohesive farmhouse schematics — the inn, blacksmith and market
 *  shops sit near the front so the player sees them on waking; the watch tower
 *  marks the edge. The huge builds (city gate, church, hunter/lumberjack lodges)
 *  are left out of the intimate starter town so it reads as a village, not a
 *  city. Positions are computed from each build's real footprint so nothing
 *  overlaps. */
const TOWN_ORDER = [
  "inn", "blacksmith", "butcher", "bakery",
  "library", "leader_house", "little_house", "watch_tower",
];

interface VillageHouse {
  id: string; min: { x: number; z: number };
  doorLocal: { x: number; z: number; facing: Facing };
  exit: { x: number; z: number };
}
interface VillageLayout { houses: VillageHouse[]; pathCells: Set<string>; green: { x: number; z: number } }

const VILLAGE_CACHE = new Map<number, VillageLayout>();

/** Choose an entrance on the side of the build that faces the town green, and
 *  the yard cell just outside it. We don't trust a stray interior door panel
 *  (big schematics hide upper-floor and courtyard doors); instead we hang the
 *  visible door on the perimeter cell of the plaza-facing wall, so the cell one
 *  step out is always an open outdoor yard on the path. Clicking anywhere on the
 *  solid mass still enters — this only fixes where the door + path meet. */
function townDoor(
  asset: StructureAsset,
  min: { x: number; z: number },
  green: { x: number; z: number },
): { doorLocal: { x: number; z: number; facing: Facing }; exit: { x: number; z: number } } {
  const solid = new Set(solidColumns(asset).map((c) => `${c.x},${c.z}`));
  const W = asset.sx, D = asset.sz;
  const cxW = min.x + W / 2, czW = min.z + D / 2;
  const tgx = green.x - cxW, tgz = green.z - czW;
  const facing: Facing = Math.abs(tgx) > Math.abs(tgz)
    ? (tgx > 0 ? "east" : "west")
    : (tgz > 0 ? "south" : "north");
  const [ox, oz] = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[facing] as [number, number];
  // Perpendicular scan axis: for an east/west door the lanes run along z; for a
  // north/south door they run along x. Walk lanes from the footprint centre out
  // and take the first that carries solid mass, so the door lands mid-wall.
  const alongX = facing === "north" || facing === "south";
  const nLanes = alongX ? W : D;
  const nDepth = alongX ? D : W;
  const centre = Math.round((nLanes - 1) / 2);
  const laneOrder: number[] = [];
  for (let off = 0; off < nLanes; off++) {
    laneOrder.push(centre + off);
    if (off > 0) laneOrder.push(centre - off);
  }
  const cellOf = (lane: number, depth: number) => (alongX ? { x: lane, z: depth } : { x: depth, z: lane });
  let doorLocal: { x: number; z: number; facing: Facing } | null = null;
  for (const lane of laneOrder) {
    if (lane < 0 || lane >= nLanes) continue;
    // Outermost solid cell along the facing direction in this lane.
    let edge = -1;
    for (let depth = 0; depth < nDepth; depth++) {
      const c = cellOf(lane, depth);
      if (!solid.has(`${c.x},${c.z}`)) continue;
      const val = facing === "south" ? c.z : facing === "north" ? nDepth - 1 - c.z
        : facing === "east" ? c.x : nDepth - 1 - c.x;
      if (val > edge) { edge = val; doorLocal = { x: c.x, z: c.z, facing }; }
    }
    if (doorLocal) break;
  }
  if (!doorLocal) doorLocal = { x: centre, z: alongX ? D - 1 : centre, facing };
  const exit = { x: min.x + doorLocal.x + ox, z: min.z + doorLocal.z + oz };
  return { doorLocal, exit };
}

function villageLayout(seed: number): VillageLayout {
  const cached = VILLAGE_CACHE.get(seed);
  if (cached) return cached;
  const a = townAnchor(seed);
  const green = { x: a.x, z: a.z };
  const houses: VillageHouse[] = [];
  // Size-aware ring: each build takes an arc proportional to its footprint, so
  // a 44-wide schematic never crowds the little cottage next to it. The radius
  // scales with the total so nothing overlaps the plaza or a neighbour.
  const builds = TOWN_ORDER.map((id) => getStructure(id)).filter((x): x is StructureAsset => !!x);
  const span = (s: StructureAsset) => Math.max(s.sx, s.sz) + 6; // footprint + gap
  const total = builds.reduce((n, s) => n + span(s), 0);
  const radius = Math.max(40, Math.round(total / (2 * Math.PI)) + 4);
  let ang = 0;
  for (const asset of builds) {
    const slice = (span(asset) / total) * Math.PI * 2;
    const mid = ang + slice / 2;
    ang += slice;
    const cx = Math.sin(mid) * radius, cz = -Math.cos(mid) * radius;
    const min = { x: Math.round(a.x + cx - asset.sx / 2), z: Math.round(a.z + cz - asset.sz / 2) };
    const { doorLocal, exit } = townDoor(asset, min, green);
    houses.push({ id: asset.name, min, doorLocal, exit });
  }
  // Cobbled paths: an L-shaped lane from the green to each door's yard cell,
  // three cells wide, plus a ring around the green.
  const pathCells = new Set<string>();
  const paint = (x: number, z: number) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) pathCells.add(`${x + dx},${z + dz}`); };
  const lane = (from: { x: number; z: number }, to: { x: number; z: number }) => {
    const midX = to.x; // go along x first, then z
    for (let x = Math.min(from.x, midX); x <= Math.max(from.x, midX); x++) paint(x, from.z);
    for (let z = Math.min(from.z, to.z); z <= Math.max(from.z, to.z); z++) paint(midX, z);
  };
  for (const h of houses) lane(green, h.exit);
  // A square ring around the green so it reads as a plaza edge.
  for (let t = 0; t < 360; t += 6) {
    const rx = Math.round(green.x + Math.cos(t * Math.PI / 180) * 15);
    const rz = Math.round(green.z + Math.sin(t * Math.PI / 180) * 15);
    pathCells.add(`${rx},${rz}`);
  }
  const layout: VillageLayout = { houses, pathCells, green };
  VILLAGE_CACHE.set(seed, layout);
  return layout;
}

/** The terrain block for a village path cell, or null when it isn't one. */
function villagePathAt(seed: number, x: number, z: number): BlockType | null {
  return villageLayout(seed).pathCells.has(`${x},${z}`) ? "stonebrick" : null;
}

/**
 * Try to drop a wild homestead into this chunk: pick a house, find a level,
 * dry, habitable pad clear of the starter town, flatten it, and record the
 * placement. Flattening stays inside the chunk (never the border cells) so
 * the pure-function seam guarantee holds. Returns true when one landed.
 */
function tryStampHouse(
  seed: number,
  cx: number,
  cz: number,
  heights: Int16Array,
  blocks: Uint8Array,
  biomes: Uint8Array,
  x0: number,
  z0: number,
  structures: StructurePlacement[],
  objects: ObjectPlacement[],
  houseBoxes: Box[],
): boolean {
  const pick = cellHash(cx * 6367, cz * 12007, salt(seed, 55));
  const asset = getStructure(WILD_HOUSES[Math.floor(pick * WILD_HOUSES.length)]);
  if (!asset) return false;
  const w = asset.sx;
  const d = asset.sz;
  if (w + 4 >= ECHUNK || d + 4 >= ECHUNK) return false;
  const ox = 2 + Math.floor(cellHash(cx, cz, salt(seed, 56)) * (ECHUNK - 4 - w));
  const oz = 2 + Math.floor(cellHash(cz * 13, cx * 29, salt(seed, 57)) * (ECHUNK - 4 - d));
  // The pad must be dry, gentle, and in kindly country — corruption keeps its
  // ruins, not homes.
  let lo = Infinity;
  let hi = -Infinity;
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const i = (oz + dz) * ECHUNK + (ox + dx);
      const b = BLOCK_LIST[blocks[i]];
      if (b === "water" || b === "ice") return false;
      const bi = biomes[i];
      if (bi === 16 || bi === 17) return false;
      if (inStarterTown(seed, x0 + ox + dx, z0 + oz + dz)) return false;
      lo = Math.min(lo, heights[i]);
      hi = Math.max(hi, heights[i]);
    }
  }
  if (hi - lo > 3) return false;
  // Flatten the footprint to the center height so the floor sits level.
  const anchor = heights[(oz + (d >> 1)) * ECHUNK + (ox + (w >> 1))];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) heights[(oz + dz) * ECHUNK + (ox + dx)] = anchor;
  }
  // A solid landmark you enter by clicking it (walk to the yard, step inside) —
  // no door object hung on the wall.
  structures.push({
    instanceId: `end.${cx}.${cz}.h`,
    structureId: WILD_HOUSES[Math.floor(pick * WILD_HOUSES.length)],
    cell: { x: x0 + ox, z: z0 + oz },
    solid: true,
  });
  houseBoxes.push({ x0: ox, z0: oz, x1: ox + w - 1, z1: oz + d - 1 });
  return true;
}

/** Villager names and idle chatter, picked deterministically per hamlet. */
const VILLAGER_NAMES = ["Wren", "Odo", "Mabel", "Cuthbert", "Nessa", "Tam", "Petra", "Garrick", "Isolde", "Bram"];
const VILLAGER_LINES: string[][] = [
  ["Fair day for the road, traveler.", "The well's water is cold and clean — help yourself."],
  ["We don't see many strangers out this way.", "Mind the wilds past the fields come nightfall."],
  ["Trade at the stall if you've coin to spend.", "The old roads still run true, if you follow them."],
  ["Rest your feet a while — no hurry in a hamlet.", "Rumor is there's a barrow-crypt out east. Stay clear."],
];

/**
 * Lay a village commons at a lattice anchor sitting in this chunk (local px,pz):
 * a flattened green with a well, market stall, benches, crate/barrel and a lamp
 * ring, plus a few villagers who wander it. The homes themselves are the
 * interiored homesteads whose roll is boosted around the anchor, so a cluster
 * of big furnished houses grows around this plaza. Bails (returns false) if the
 * ground here isn't flat/dry enough for a commons.
 */
function stampVillagePlaza(
  seed: number,
  cx: number,
  cz: number,
  heights: Int16Array,
  blocks: Uint8Array,
  biomes: Uint8Array,
  x0: number,
  z0: number,
  px: number,
  pz: number,
  objects: ObjectPlacement[],
  npcs: NpcPlacement[],
  houseBoxes: Box[],
  id: () => string,
): boolean {
  const V = 12; // plaza half-extent
  let lo = Infinity, hi = -Infinity;
  for (let dz = -V; dz <= V; dz += 2) {
    for (let dx = -V; dx <= V; dx += 2) {
      const i = (pz + dz) * ECHUNK + (px + dx);
      const b = BLOCK_LIST[blocks[i]];
      if (b === "water" || b === "ice") return false;
      const bi = biomes[i];
      if (bi === 16 || bi === 17 || bi === 18 || bi === 19) return false; // no corrupt/volcanic/glacier towns
      if (inStarterTown(seed, x0 + px + dx, z0 + pz + dz)) return false;
      lo = Math.min(lo, heights[i]); hi = Math.max(hi, heights[i]);
    }
  }
  if (hi - lo > 3) return false;

  const anchor = heights[pz * ECHUNK + px];
  for (let dz = -V; dz <= V; dz++) {
    for (let dx = -V; dx <= V; dx++) heights[(pz + dz) * ECHUNK + (px + dx)] = anchor;
  }
  const wx = x0 + px, wz = z0 + pz;
  objects.push({ instanceId: id(), defId: "object.well.basic", cell: { x: wx, z: wz } });
  objects.push({ instanceId: id(), defId: "object.stall.market", cell: { x: wx + 4, z: wz + 3 } });
  objects.push({ instanceId: id(), defId: "object.bench.wood", cell: { x: wx - 4, z: wz + 2 } });
  objects.push({ instanceId: id(), defId: "object.bench.wood", cell: { x: wx + 3, z: wz - 4 } });
  objects.push({ instanceId: id(), defId: "object.crate.wood", cell: { x: wx + 5, z: wz + 4 } });
  objects.push({ instanceId: id(), defId: "object.barrel.wood", cell: { x: wx - 5, z: wz - 3 } });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    objects.push({ instanceId: id(), defId: "object.lamp.post", cell: { x: wx + Math.round(Math.cos(a) * 9), z: wz + Math.round(Math.sin(a) * 9) } });
  }
  houseBoxes.push({ x0: px - 10, z0: pz - 10, x1: px + 10, z1: pz + 10 }); // keep the green clear

  const folk = 2 + Math.floor(cellHash(cx * 13, cz * 29, salt(seed, 89)) * 3); // 2-4
  for (let k = 0; k < folk; k++) {
    const nameI = Math.floor(cellHash(cx * 7 + k * 11, cz * 5 + k * 3, salt(seed, 93)) * VILLAGER_NAMES.length);
    const linesI = Math.floor(cellHash(cx * 3 + k * 5, cz * 9 + k * 7, salt(seed, 94)) * VILLAGER_LINES.length);
    const ox2 = Math.round(Math.cos((k / folk) * Math.PI * 2) * 6);
    const oz2 = Math.round(Math.sin((k / folk) * Math.PI * 2) * 6);
    npcs.push({
      instanceId: id(),
      name: VILLAGER_NAMES[nameI],
      cell: { x: wx + ox2, z: wz + oz2 + 5 },
      wanderRadius: 5,
      lines: VILLAGER_LINES[linesI],
    });
  }
  return true;
}

/**
 * Try to drop a landmark — a standing-stone circle or a ruined watchtower —
 * onto a dry, gentle pad wholly inside the chunk. Landmarks are raised straight
 * out of the terrain (monoliths and walls are tall stone columns), so they read
 * from afar and anchor navigation. Returns true when one landed.
 */
function tryStampLandmark(
  seed: number,
  cx: number,
  cz: number,
  heights: Int16Array,
  blocks: Uint8Array,
  x0: number,
  z0: number,
  objects: ObjectPlacement[],
  nodes: NodePlacement[],
  enemies: EnemyPlacement[],
  structures: StructurePlacement[],
  houseBoxes: Box[],
  id: () => string,
): boolean {
  const R = 9;
  const px = 12 + Math.floor(cellHash(cx * 19 + 5, cz * 27 + 1, salt(seed, 96)) * (ECHUNK - 24));
  const pz = 12 + Math.floor(cellHash(cz * 37 + 3, cx * 13 + 7, salt(seed, 97)) * (ECHUNK - 24));
  let lo = Infinity, hi = -Infinity;
  for (let dz = -R; dz <= R; dz += 2) {
    for (let dx = -R; dx <= R; dx += 2) {
      const i = (pz + dz) * ECHUNK + (px + dx);
      const b = BLOCK_LIST[blocks[i]];
      if (b === "water" || b === "ice") return false;
      if (inStarterTown(seed, x0 + px + dx, z0 + pz + dz)) return false;
      lo = Math.min(lo, heights[i]); hi = Math.max(hi, heights[i]);
    }
  }
  if (hi - lo > 4) return false;
  const anchor = heights[pz * ECHUNK + px];
  const wx = x0 + px, wz = z0 + pz;
  const rock = (n: number): BlockType => {
    const r = cellHash(px * 7 + n * 3, pz * 11 + n * 5, salt(seed, 99));
    return r < 0.5 ? "andesite" : r < 0.8 ? "stone" : "calcite";
  };
  const raise = (dx: number, dz: number, h: number, pal: BlockType) => {
    const i = (pz + dz) * ECHUNK + (px + dx);
    heights[i] = h; blocks[i] = BLOCK_ID[pal];
  };
  const flatten = (rad: number) => {
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
      heights[(pz + dz) * ECHUNK + (px + dx)] = anchor;
    }
  };

  const kind = cellHash(cx * 3 + 1, cz * 5 + 2, salt(seed, 98));
  const shrine = getStructure("wayshrine");
  if (kind >= 0.72 && shrine) {
    // A roadside wayshrine: a small shrine flanked by benches and a lamp, a
    // quiet waypoint for travelers.
    flatten(5);
    const hx = px - (shrine.sx >> 1), hz = pz - (shrine.sz >> 1);
    if (hx >= 2 && hz >= 2 && hx + shrine.sx < ECHUNK - 2 && hz + shrine.sz < ECHUNK - 2) {
      structures.push({ instanceId: id(), structureId: "wayshrine", cell: { x: x0 + hx, z: z0 + hz } });
      objects.push({ instanceId: id(), defId: "object.bench.wood", cell: { x: wx - 3, z: wz + 3 } });
      objects.push({ instanceId: id(), defId: "object.bench.wood", cell: { x: wx + 3, z: wz + 3 } });
      objects.push({ instanceId: id(), defId: "object.lamp.post", cell: { x: wx, z: wz + 5 } });
      houseBoxes.push({ x0: px - 5, z0: pz - 5, x1: px + 5, z1: pz + 5 });
      return true;
    }
    // No room for the shrine — fall through to a stone circle instead.
  }

  if (kind < 0.45) {
    // Standing stones: a ring of monoliths around an ancient rune altar.
    flatten(7);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const tall = anchor + 3 + (cellHash(px + k, pz - k, salt(seed, 101)) > 0.5 ? 1 : 0);
      raise(Math.round(Math.cos(a) * 5), Math.round(Math.sin(a) * 5), tall, rock(k));
    }
    objects.push({ instanceId: id(), defId: "object.altar.rune", cell: { x: wx, z: wz } });
    houseBoxes.push({ x0: px - 8, z0: pz - 8, x1: px + 8, z1: pz + 8 });
    return true;
  }

  // Ruined watchtower: a hollow square of tall stone, part-crumbled, with a
  // south doorway; inside, a strongbox to crack and a skeleton to keep it.
  const T = 3;
  flatten(7);
  for (let dz = -T; dz <= T; dz++) {
    for (let dx = -T; dx <= T; dx++) {
      if (Math.abs(dx) !== T && Math.abs(dz) !== T) continue; // perimeter only
      if (dx === 0 && dz === T) continue; // south doorway gap
      const crumble = cellHash(px + dx * 3, pz + dz * 3, salt(seed, 100)) < 0.25;
      raise(dx, dz, anchor + (crumble ? 2 : 5), rock(dx * 7 + dz));
    }
  }
  nodes.push({ instanceId: id(), defId: "resource.strongbox.old", cell: { x: wx, z: wz } });
  enemies.push({ instanceId: id(), defId: "enemy.skeleton", cell: { x: wx + 1, z: wz - 1 } });
  houseBoxes.push({ x0: px - 7, z0: pz - 7, x1: px + 7, z1: pz + 7 }); // clear the whole clearing
  return true;
}

export function generateChunk(seed: number, cx: number, cz: number): EndlessChunk {
  const heights = new Int16Array(ECHUNK * ECHUNK);
  const blocks = new Uint8Array(ECHUNK * ECHUNK);
  const biomes = new Uint8Array(ECHUNK * ECHUNK);
  const x0 = cx * ECHUNK;
  const z0 = cz * ECHUNK;
  const cache: HeightCache = new Map();
  for (let dz = 0; dz < ECHUNK; dz++) {
    for (let dx = 0; dx < ECHUNK; dx++) {
      const s = terrainAt(seed, x0 + dx, z0 + dz, cache);
      const i = dz * ECHUNK + dx;
      heights[i] = s.h;
      blocks[i] = BLOCK_ID[s.block];
      biomes[i] = s.biome;
    }
  }

  // Features on a jittered grid, biome-flavored, never on water or cliffs.
  const nodes: NodePlacement[] = [];
  const objects: ObjectPlacement[] = [];
  const enemies: EnemyPlacement[] = [];
  const structures: StructurePlacement[] = [];
  const npcs: NpcPlacement[] = [];
  const houseBoxes: Box[] = [];
  let n = 0;
  const id = () => `end.${cx}.${cz}.${n++}`;

  // Torches spaced around the top of the castle wall — wall furniture, so they
  // stand regardless of the CLEAR_ASSETS content gate. Evenly spaced by angle;
  // any that would fall in a gateway (where the path cuts the wall) are skipped.
  {
    const a = townAnchor(seed);
    const R = WALL_INNER + 1.5; // sit on the walkway ring
    const TORCHES = 72;
    for (let k = 0; k < TORCHES; k++) {
      const ang = (k / TORCHES) * Math.PI * 2;
      const tx = a.x + Math.round(Math.cos(ang) * R);
      const tz = a.z + Math.round(Math.sin(ang) * R);
      if (tx < x0 || tx >= x0 + ECHUNK || tz < z0 || tz >= z0 + ECHUNK) continue;
      if (!valeWall(seed, tx, tz)) continue; // must land on standing wall, not a gate gap
      objects.push({ instanceId: id(), defId: "object.torch.wall", cell: { x: tx, z: tz } });
    }
  }

  // All feature/structure/mob placement is gated off during the asset
  // transition (see CLEAR_ASSETS) — the world stays bare terrain + roads.
  if (!CLEAR_ASSETS) {

  // Wild structures: a rare per-chunk roll drops a schematic (ruins today;
  // player-authored houses and set pieces later) onto a level, dry site.
  // Stamped before features so nothing sprouts through a floor.
  let stamped = false;
  const sroll = cellHash(cx * 7919, cz * 104729, salt(seed, 51));
  const ox = 6 + Math.floor(cellHash(cx, cz, salt(seed, 53)) * (ECHUNK - 24));
  const oz = 6 + Math.floor(cellHash(cz * 31, cx * 17, salt(seed, 54)) * (ECHUNK - 24));
  // Corrupted country is littered with what came before it.
  const evilSite = biomes[oz * ECHUNK + ox] === 16 || biomes[oz * ECHUNK + ox] === 17;
  if (sroll < (evilSite ? 0.13 : 0.03) && !inStarterTown(seed, x0 + ox, z0 + oz)) {
    const sch = WILD_SCHEMATICS[Math.floor(cellHash(cz, cx, salt(seed, 52)) * WILD_SCHEMATICS.length)];
    const target = {
      heights,
      blocks,
      size: ECHUNK,
      blockId: BLOCK_ID,
      blockList: BLOCK_LIST,
      addObject: (defId: string, cell: Cell) => objects.push({ instanceId: id(), defId, cell }),
      addNode: (defId: string, cell: Cell) => nodes.push({ instanceId: id(), defId, cell }),
      addEnemy: (defId: string, cell: Cell) => enemies.push({ instanceId: id(), defId, cell }),
    };
    // The corner test above is not enough: a multi-cell ruin whose anchor sits
    // just outside the yard can still reach into it. Reject if any footprint
    // cell falls in the starter town, so ruins never land on the hand-placed camp.
    const rw = sch?.ground[0]?.length ?? 0;
    const rd = sch?.ground.length ?? 0;
    let ruinInTown = false;
    for (let dz = 0; dz < rd && !ruinInTown; dz++) {
      for (let dx = 0; dx < rw; dx++) {
        if (inStarterTown(seed, x0 + ox + dx, z0 + oz + dz)) { ruinInTown = true; break; }
      }
    }
    if (sch && !ruinInTown && schematicFits(sch, target, ox, oz)) {
      stampSchematic(sch, target, ox, oz, x0, z0);
      stamped = true;
    }
  }
  // Villages: if a lattice village anchor sits in this chunk, lay its commons.
  // The homes are the interiored homesteads whose roll is boosted nearby, so a
  // cluster of furnished houses grows around the plaza.
  const village = villageNear(seed, x0 + 32, z0 + 32);
  if (!stamped && village) {
    const alx = village.x - x0, alz = village.z - z0;
    if (alx >= 24 && alx < ECHUNK - 24 && alz >= 24 && alz < ECHUNK - 24) {
      stamped = stampVillagePlaza(seed, cx, cz, heights, blocks, biomes, x0, z0, alx, alz, objects, npcs, houseBoxes, id);
    }
  }
  // Landmarks: standing-stone circles and ruined watchtowers, raised straight
  // from the terrain — discoverable and good for finding your bearings.
  if (!stamped && cellHash(cx * 44851 + 9, cz * 71341 + 5, salt(seed, 102)) < 0.022) {
    stamped = tryStampLandmark(seed, cx, cz, heights, blocks, x0, z0, objects, nodes, enemies, structures, houseBoxes, id);
  }
  // Wild homesteads: the interiored homes, found out in the world. The roll is
  // boosted around a village anchor so several cluster into a settlement.
  if (!stamped && cellHash(cx * 40987, cz * 90001, salt(seed, 58)) < (village ? 0.6 : 0.05)) {
    stamped = tryStampHouse(seed, cx, cz, heights, blocks, biomes, x0, z0, structures, objects, houseBoxes);
  }

  // Dungeon gates: a rare crimson portal-arch on a flattened pad that drops
  // into an endlessly-descending dungeon. The clickable mouth sits one row in
  // front (south) of the arch, so the approach is always walkable.
  if (!stamped && cellHash(cx * 70001, cz * 30011, salt(seed, 63)) < 0.03) {
    const gate = getStructure("portal_crimson");
    const w = gate?.sx ?? 25;
    const d = gate?.sz ?? 25;
    if (w + 8 < ECHUNK && d + 10 < ECHUNK) {
      const ex = 4 + Math.floor(cellHash(cx * 3 + 1, cz * 5 + 2, salt(seed, 64)) * (ECHUNK - w - 8));
      const ez = 4 + Math.floor(cellHash(cz * 7 + 3, cx * 11 + 4, salt(seed, 65)) * (ECHUNK - d - 10));
      // The pad spans the arch footprint plus the doorway row in front.
      let lo = Infinity, hi = -Infinity, ok = true;
      for (let dz = 0; dz <= d && ok; dz++) {
        for (let dx = 0; dx < w; dx++) {
          const i = (ez + dz) * ECHUNK + (ex + dx);
          const b = BLOCK_LIST[blocks[i]];
          if (b === "water" || b === "ice" || inStarterTown(seed, x0 + ex + dx, z0 + ez + dz)) { ok = false; break; }
          lo = Math.min(lo, heights[i]); hi = Math.max(hi, heights[i]);
        }
      }
      if (ok && hi - lo <= 3) {
        const mid = (ez + (d >> 1)) * ECHUNK + (ex + (w >> 1));
        const anchor = heights[mid];
        for (let dz = 0; dz <= d; dz++) {
          for (let dx = 0; dx < w; dx++) heights[(ez + dz) * ECHUNK + (ex + dx)] = anchor;
        }
        const bi = biomes[mid];
        // Mines burrow into rocky, cold or corrupt country; crypts elsewhere.
        const mine = bi === 2 || bi === 5 || bi === 12 || bi === 16 ||
          cellHash(x0 + ex, z0 + ez, salt(seed, 66)) < 0.4;
        const dseed = Math.floor(cellHash(cx * 13 + 5, cz * 17 + 6, salt(seed, 67)) * 1e9);
        // Most gates open a finite crawl of 2-5 floors with a real finale;
        // a rare few (about one in seven) plunge into an endless descent.
        const maxDepth = cellHash(x0 + ex + 7, z0 + ez + 9, salt(seed, 68)) < 0.14
          ? 0
          : 2 + Math.floor(cellHash(x0 + ex + 3, z0 + ez + 1, salt(seed, 69)) * 4);
        const doorX = x0 + ex + (w >> 1);
        const doorZ = z0 + ez + d;
        structures.push({ instanceId: `end.${cx}.${cz}.gate`, structureId: "portal_crimson", cell: { x: x0 + ex, z: z0 + ez } });
        objects.push({
          instanceId: id(),
          defId: "object.portal.cave",
          cell: { x: doorX, z: doorZ },
          portal: {
            targetRegionId: dynDungeonId(mine ? "mine" : "crypt", dseed, 1, maxDepth, { x: doorX, z: doorZ }),
            targetCell: DUNGEON_SPAWN,
          },
        });
        houseBoxes.push({ x0: ex, z0: ez, x1: ex + w - 1, z1: ez + d });
        stamped = true;
      }
    }
  }
  const inHouse = (lx: number, lz: number) =>
    houseBoxes.some((b) => lx >= b.x0 && lx <= b.x1 && lz >= b.z0 && lz <= b.z1);

  const step = 7;
  for (let gz = 2; gz < ECHUNK - 2; gz += step) {
    for (let gx = 2; gx < ECHUNK - 2; gx += step) {
      const jx = gx + Math.floor(cellHash(x0 + gx, z0 + gz, salt(seed, 21)) * (step - 2));
      const jz = gz + Math.floor(cellHash(z0 + gz, x0 + gx, salt(seed, 22)) * (step - 2));
      if (jx >= ECHUNK - 2 || jz >= ECHUNK - 2) continue;
      const i = jz * ECHUNK + jx;
      const surface = BLOCK_LIST[blocks[i]];
      if (surface === "water") continue;
      // Stamped structure ground stays clear of natural features.
      if (surface === "stonebrick" || surface === "plank") continue;
      const wx = x0 + jx;
      const wz = z0 + jz;
      if (inStarterTown(seed, wx, wz)) continue; // the yard is hand-placed
      if (inHouse(jx, jz)) continue; // a homestead's grounds stay clear
      if (roadDist(seed, wx, wz) < 3) continue; // keep the road clear to walk
      const h = heights[i];
      if (slopeAt(seed, wx, wz, h, cache) > 2) continue; // cliffs stay bare
      const r = cellHash(wx, wz, salt(seed, 23));
      const cell = { x: wx, z: wz };
      // Alpine treeline: above it only the rock features further down
      // (scree and ore) survive.
      if (h <= 44) switch (biomes[i]) {
        case 1: // forest
          if (r < 0.34) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.44) nodes.push({ instanceId: id(), defId: "resource.tree.birch", cell });
          else if (r < 0.47) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.5) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.505) enemies.push({ instanceId: id(), defId: "enemy.timber_wolf", cell });
          else if (r < 0.515) enemies.push({ instanceId: id(), defId: "enemy.pig", cell });
          else if (r < 0.53) nodes.push({ instanceId: id(), defId: "resource.herb.mint", cell });
          else if (r < 0.545) objects.push({ instanceId: id(), defId: "object.log.fallen", cell });
          else if (r < 0.56) objects.push({ instanceId: id(), defId: "object.flora.wild", cell });
          break;
        case 2: // taiga
          if (r < 0.26) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.29) nodes.push({ instanceId: id(), defId: "resource.rock.coal", cell });
          else if (r < 0.31) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.325) objects.push({ instanceId: id(), defId: "object.log.fallen", cell });
          else if (r < 0.33) enemies.push({ instanceId: id(), defId: "enemy.frost_wolf", cell });
          else if (r < 0.337) enemies.push({ instanceId: id(), defId: "enemy.skeleton", cell });
          break;
        case 3: // desert
          if (BLOCK_LIST[blocks[i]] === "grass") {
            // Oasis ring: shade trees and berries crowd the water.
            if (r < 0.3) nodes.push({ instanceId: id(), defId: "resource.tree.acacia", cell });
            else if (r < 0.38) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          } else if (r < 0.04) nodes.push({ instanceId: id(), defId: "resource.tree.acacia", cell });
          else if (r < 0.055) nodes.push({ instanceId: id(), defId: "resource.rock.copper", cell });
          else if (r < 0.062) nodes.push({ instanceId: id(), defId: "resource.digsite.basic", cell });
          else if (r < 0.067) enemies.push({ instanceId: id(), defId: "enemy.cave_spider", cell });
          else if (r < 0.075) objects.push({ instanceId: id(), defId: "object.rock.mesa", cell });
          break;
        case 4: // swamp
          if (r < 0.1) nodes.push({ instanceId: id(), defId: "resource.tree.jungle", cell });
          else if (r < 0.115) nodes.push({ instanceId: id(), defId: "resource.herb.ember", cell });
          else if (r < 0.122) enemies.push({ instanceId: id(), defId: "enemy.bog_slime", cell });
          else if (r < 0.135) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.15) nodes.push({ instanceId: id(), defId: "resource.herb.mint", cell });
          else if (r < 0.1512) enemies.push({ instanceId: id(), defId: "enemy.dragon.hydra", cell });
          else if (r < 0.16) objects.push({ instanceId: id(), defId: "object.plant.tropic", cell });
          else if (r < 0.168) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          break;
        case 5: // snowfield
          if (r < 0.05) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.07) nodes.push({ instanceId: id(), defId: "resource.herb.frostbloom", cell });
          else if (r < 0.075) enemies.push({ instanceId: id(), defId: "enemy.frost_wolf", cell });
          else if (r < 0.0765) enemies.push({ instanceId: id(), defId: "enemy.dragon.ice", cell });
          break;
        case 6: // savanna
          if (r < 0.07) nodes.push({ instanceId: id(), defId: "resource.tree.acacia", cell });
          else if (r < 0.085) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.1) nodes.push({ instanceId: id(), defId: "resource.herb.sage", cell });
          else if (r < 0.11) enemies.push({ instanceId: id(), defId: "enemy.cow", cell });
          else if (r < 0.125) nodes.push({ instanceId: id(), defId: "resource.trail.rabbit", cell });
          break;
        case 7: // jungle
          if (r < 0.4) nodes.push({ instanceId: id(), defId: "resource.tree.jungle", cell });
          else if (r < 0.46) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.49) nodes.push({ instanceId: id(), defId: "resource.herb.ember", cell });
          else if (r < 0.51) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.517) enemies.push({ instanceId: id(), defId: "enemy.spider", cell });
          else if (r < 0.54) objects.push({ instanceId: id(), defId: "object.plant.tropic", cell });
          else if (r < 0.56) objects.push({ instanceId: id(), defId: "object.flora.wild", cell });
          break;
        case 8: // birch grove
          if (r < 0.36) nodes.push({ instanceId: id(), defId: "resource.tree.birch", cell });
          else if (r < 0.42) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.47) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.478) enemies.push({ instanceId: id(), defId: "enemy.chicken", cell });
          else if (r < 0.49) nodes.push({ instanceId: id(), defId: "resource.herb.mint", cell });
          break;
        case 9: // dark forest
          if (r < 0.42) nodes.push({ instanceId: id(), defId: "resource.tree.darkoak", cell });
          else if (r < 0.48) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.51) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.515) enemies.push({ instanceId: id(), defId: "enemy.timber_wolf", cell });
          else if (r < 0.523) nodes.push({ instanceId: id(), defId: "resource.tree.grand.oak", cell });
          else if (r < 0.531) enemies.push({ instanceId: id(), defId: "enemy.zombie", cell });
          else if (r < 0.537) enemies.push({ instanceId: id(), defId: "enemy.creeper", cell });
          break;
        case 10: // flower meadow
          if (r < 0.3) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.34) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.37) nodes.push({ instanceId: id(), defId: "resource.tree.birch", cell });
          else if (r < 0.385) enemies.push({ instanceId: id(), defId: "enemy.sheep", cell });
          else if (r < 0.4) nodes.push({ instanceId: id(), defId: "resource.herb.sage", cell });
          else if (r < 0.408) enemies.push({ instanceId: id(), defId: "enemy.chicken", cell });
          else if (r < 0.44) objects.push({ instanceId: id(), defId: "object.flowers.showy", cell });
          break;
        case 11: // mushroom isle
          if (r < 0.3) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.33) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.4) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          break;
        case 12: // moorland
          if (r < 0.008) objects.push({ instanceId: id(), defId: "object.rock.outcrop", cell });
          else if (r < 0.02) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.09) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.105) nodes.push({ instanceId: id(), defId: "resource.rock.coal", cell });
          else if (r < 0.12) nodes.push({ instanceId: id(), defId: "resource.trail.moor", cell });
          else if (r < 0.13) nodes.push({ instanceId: id(), defId: "resource.trail.rabbit", cell });
          else if (r < 0.15) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.16) nodes.push({ instanceId: id(), defId: "resource.herb.frostbloom", cell });
          break;
        case 13: // elder grove
          if (r < 0.09) nodes.push({ instanceId: id(), defId: "resource.tree.grand.oak", cell });
          else if (r < 0.16) nodes.push({ instanceId: id(), defId: "resource.tree.grand.birch", cell });
          else if (r < 0.26) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.38) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.43) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.44) enemies.push({ instanceId: id(), defId: "enemy.pig", cell });
          break;
        case 14: // badlands
          if (r < 0.015) nodes.push({ instanceId: id(), defId: "resource.tree.acacia", cell });
          else if (r < 0.04) nodes.push({ instanceId: id(), defId: "resource.rock.copper", cell });
          else if (r < 0.06) nodes.push({ instanceId: id(), defId: "resource.rock.tin", cell });
          else if (r < 0.08) nodes.push({ instanceId: id(), defId: "resource.digsite.old", cell });
          else if (r < 0.09) enemies.push({ instanceId: id(), defId: "enemy.cave_spider", cell });
          else if (r < 0.095) nodes.push({ instanceId: id(), defId: "resource.strongbox.old", cell });
          else if (r < 0.11) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.113) enemies.push({ instanceId: id(), defId: "enemy.dragon.fire", cell });
          else if (r < 0.121) objects.push({ instanceId: id(), defId: "object.rock.mesa", cell });
          break;
        case 15: // fen
          if (r < 0.06) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.08) nodes.push({ instanceId: id(), defId: "resource.herb.mint", cell });
          else if (r < 0.1) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.115) enemies.push({ instanceId: id(), defId: "enemy.bog_slime", cell });
          else if (r < 0.13) nodes.push({ instanceId: id(), defId: "resource.trail.moor", cell });
          else if (r < 0.15) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.158) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          break;
        case 16: // gravemoor — dangerous, and paid accordingly
          if (r < 0.025) enemies.push({ instanceId: id(), defId: "enemy.grave_shambler", cell });
          else if (r < 0.035) enemies.push({ instanceId: id(), defId: "enemy.dire_wolf", cell });
          else if (r < 0.04) enemies.push({ instanceId: id(), defId: "enemy.hollow_wight", cell });
          else if (r < 0.06) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.08) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.088) nodes.push({ instanceId: id(), defId: "resource.strongbox.old", cell });
          else if (r < 0.096) nodes.push({ instanceId: id(), defId: "resource.digsite.old", cell });
          else if (r < 0.106) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.108) enemies.push({ instanceId: id(), defId: "enemy.dragon.twoheaded", cell });
          else if (r < 0.122) enemies.push({ instanceId: id(), defId: "enemy.skeleton", cell });
          else if (r < 0.134) enemies.push({ instanceId: id(), defId: "enemy.zombie", cell });
          else if (r < 0.137) enemies.push({ instanceId: id(), defId: "enemy.ghast", cell });
          break;
        case 17: // blightwood — dangerous, and paid accordingly
          if (r < 0.28) nodes.push({ instanceId: id(), defId: "resource.tree.darkoak", cell });
          else if (r < 0.34) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.36) enemies.push({ instanceId: id(), defId: "enemy.gloom_spinner", cell });
          else if (r < 0.375) enemies.push({ instanceId: id(), defId: "enemy.blight_slime", cell });
          else if (r < 0.385) enemies.push({ instanceId: id(), defId: "enemy.spore_shambler", cell });
          else if (r < 0.42) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.44) nodes.push({ instanceId: id(), defId: "resource.herb.ember", cell });
          else if (r < 0.448) nodes.push({ instanceId: id(), defId: "resource.strongbox.old", cell });
          else if (r < 0.456) nodes.push({ instanceId: id(), defId: "resource.tree.grand.oak", cell });
          else if (r < 0.472) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          else if (r < 0.484) enemies.push({ instanceId: id(), defId: "enemy.creeper", cell });
          break;
        case 18: // volcanic wastes — charred, mineral-rich, deadly
          if (r < 0.03) nodes.push({ instanceId: id(), defId: "resource.tree.darkoak", cell }); // charred snag
          else if (r < 0.055) nodes.push({ instanceId: id(), defId: "resource.rock.gold", cell });
          else if (r < 0.085) nodes.push({ instanceId: id(), defId: "resource.rock.iron", cell });
          else if (r < 0.095) enemies.push({ instanceId: id(), defId: "enemy.creeper", cell });
          else if (r < 0.1) enemies.push({ instanceId: id(), defId: "enemy.ghast", cell });
          else if (r < 0.102) enemies.push({ instanceId: id(), defId: "enemy.dragon.fire", cell });
          else if (r < 0.115) nodes.push({ instanceId: id(), defId: "resource.herb.ember", cell });
          else if (r < 0.14) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          break;
        case 19: // glacier — frozen and sparse, with icy prizes
          if (r < 0.03) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.05) nodes.push({ instanceId: id(), defId: "resource.herb.frostbloom", cell });
          else if (r < 0.056) enemies.push({ instanceId: id(), defId: "enemy.frost_wolf", cell });
          else if (r < 0.058) enemies.push({ instanceId: id(), defId: "enemy.dragon.ice", cell });
          else if (r < 0.062) nodes.push({ instanceId: id(), defId: "resource.rock.diamond", cell });
          else if (r < 0.1) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell }); // ice block
          break;
        case 20: // alpine pines — cold conifer highland
          if (r < 0.32) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.36) nodes.push({ instanceId: id(), defId: "resource.rock.coal", cell });
          else if (r < 0.375) enemies.push({ instanceId: id(), defId: "enemy.frost_wolf", cell });
          else if (r < 0.382) enemies.push({ instanceId: id(), defId: "enemy.stone_sentinel", cell });
          else if (r < 0.4) nodes.push({ instanceId: id(), defId: "resource.herb.sage", cell });
          else if (r < 0.42) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          break;
        case 21: // cherry orchard — soft, pretty, gentle
          if (r < 0.28) nodes.push({ instanceId: id(), defId: "resource.tree.grand.blossom", cell });
          else if (r < 0.36) nodes.push({ instanceId: id(), defId: "resource.tree.birch", cell });
          else if (r < 0.42) objects.push({ instanceId: id(), defId: "object.flowers.showy", cell });
          else if (r < 0.46) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.49) nodes.push({ instanceId: id(), defId: "resource.herb.mint", cell });
          else if (r < 0.5) enemies.push({ instanceId: id(), defId: "enemy.sheep", cell });
          else if (r < 0.508) enemies.push({ instanceId: id(), defId: "enemy.bramble_slime", cell });
          else if (r < 0.52) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          break;
        case 22: // redwood — towering old-growth conifers
          if (r < 0.3) nodes.push({ instanceId: id(), defId: "resource.tree.grand.spruce", cell });
          else if (r < 0.42) nodes.push({ instanceId: id(), defId: "resource.tree.spruce", cell });
          else if (r < 0.48) nodes.push({ instanceId: id(), defId: "resource.tree.grand.oak", cell });
          else if (r < 0.5) objects.push({ instanceId: id(), defId: "object.log.fallen", cell });
          else if (r < 0.51) enemies.push({ instanceId: id(), defId: "enemy.dire_wolf", cell });
          else if (r < 0.518) enemies.push({ instanceId: id(), defId: "enemy.thornback", cell });
          else if (r < 0.526) enemies.push({ instanceId: id(), defId: "enemy.moss_golem", cell });
          else if (r < 0.54) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.55) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          break;
        case 23: // sunflower prairie — bright open grassland
          if (r < 0.24) objects.push({ instanceId: id(), defId: "object.flowers.showy", cell });
          else if (r < 0.32) nodes.push({ instanceId: id(), defId: "resource.crop.wheat", cell });
          else if (r < 0.36) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.4) enemies.push({ instanceId: id(), defId: "enemy.cow", cell });
          else if (r < 0.412) enemies.push({ instanceId: id(), defId: "enemy.prairie_bull", cell });
          else if (r < 0.42) enemies.push({ instanceId: id(), defId: "enemy.sheep", cell });
          else if (r < 0.43) nodes.push({ instanceId: id(), defId: "resource.trail.rabbit", cell });
          else if (r < 0.46) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          break;
        case 24: // autumn woods — turning leaves and leaf litter
          if (r < 0.3) nodes.push({ instanceId: id(), defId: "resource.tree.grand.dusk", cell });
          else if (r < 0.4) nodes.push({ instanceId: id(), defId: "resource.tree.darkoak", cell });
          else if (r < 0.46) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.49) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.5) enemies.push({ instanceId: id(), defId: "enemy.boar", cell });
          else if (r < 0.508) enemies.push({ instanceId: id(), defId: "enemy.thornback", cell });
          else if (r < 0.516) enemies.push({ instanceId: id(), defId: "enemy.timber_wolf", cell });
          else if (r < 0.53) objects.push({ instanceId: id(), defId: "object.log.fallen", cell });
          else if (r < 0.54) nodes.push({ instanceId: id(), defId: "resource.herb.sage", cell });
          break;
        case 25: // glowshroom hollow — rare, glowing, dangerous
          if (r < 0.26) nodes.push({ instanceId: id(), defId: "resource.tree.grand.glow", cell });
          else if (r < 0.4) objects.push({ instanceId: id(), defId: "object.mushroom.giant", cell });
          else if (r < 0.48) nodes.push({ instanceId: id(), defId: "resource.herb.duskcap", cell });
          else if (r < 0.49) enemies.push({ instanceId: id(), defId: "enemy.gloom_spinner", cell });
          else if (r < 0.5) enemies.push({ instanceId: id(), defId: "enemy.marsh_lurker", cell });
          else if (r < 0.508) enemies.push({ instanceId: id(), defId: "enemy.moss_golem", cell });
          else if (r < 0.52) nodes.push({ instanceId: id(), defId: "resource.strongbox.old", cell });
          break;
        default: // plains
          if (r < 0.05) nodes.push({ instanceId: id(), defId: "resource.tree.basic", cell });
          else if (r < 0.08) nodes.push({ instanceId: id(), defId: "resource.tree.birch", cell });
          else if (r < 0.1) nodes.push({ instanceId: id(), defId: "resource.bush.berry", cell });
          else if (r < 0.15) objects.push({ instanceId: id(), defId: "object.flowers.wild", cell });
          else if (r < 0.157) objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
          else if (r < 0.164) enemies.push({ instanceId: id(), defId: "enemy.cow", cell });
          else if (r < 0.171) enemies.push({ instanceId: id(), defId: "enemy.sheep", cell });
          else if (r < 0.176) enemies.push({ instanceId: id(), defId: "enemy.chicken", cell });
          else if (r < 0.184) nodes.push({ instanceId: id(), defId: "resource.trail.rabbit", cell });
          else if (r < 0.188) nodes.push({ instanceId: id(), defId: "resource.crop.pumpkin", cell });
          else if (r < 0.193) objects.push({ instanceId: id(), defId: "object.flowers.showy", cell });
          // Fallow farm plots dot the open country — plantable and seed-dropping,
          // so Farming is trainable out in the world, not just in a town.
          else if (r < 0.2) nodes.push({ instanceId: id(), defId: "resource.plot.wheat", cell });
          else if (r < 0.205) nodes.push({ instanceId: id(), defId: "resource.plot.carrot", cell });
          break;
      }
      // Palms shade the warm-country beaches.
      if (BLOCK_LIST[blocks[i]] === "sand" && (biomes[i] === 6 || biomes[i] === 7) && r > 0.94) {
        nodes.push({ instanceId: id(), defId: "resource.tree.acacia", cell });
      }
      // Tidal rocks stud the coasts.
      if (BLOCK_LIST[blocks[i]] === "sand" && r >= 0.9 && r < 0.925) {
        objects.push({ instanceId: id(), defId: "object.rock.tidal", cell });
      }
      // Scree: loose boulders rest on the bare rock flats.
      if (BLOCK_LIST[blocks[i]] === "stone" && r >= 0.62 && r < 0.68) {
        objects.push({ instanceId: id(), defId: "object.boulder.stone", cell });
      }
      if (BLOCK_LIST[blocks[i]] === "stone" && r >= 0.68 && r < 0.695) {
        objects.push({ instanceId: id(), defId: "object.rock.outcrop", cell });
      }
      // Ore breaks through wherever rock shows; the high country hides
      // diamonds for climbers, and corrupted ground runs rich for anyone
      // brave enough to mine it.
      const evilGround = biomes[i] === 16 || biomes[i] === 17;
      if (BLOCK_LIST[blocks[i]] === "stone") {
        let defId: string | null = evilGround
          ? r > 0.96 ? "resource.rock.diamond"
            : r > 0.88 ? "resource.rock.gold"
              : r > 0.78 ? "resource.rock.iron"
                : r > 0.7 ? "resource.rock.tin" : null
          : h > 40 && r > 0.97 ? "resource.rock.diamond"
            : r > 0.95 ? "resource.rock.gold"
              : r > 0.88 ? "resource.rock.iron"
                : r > 0.8 ? "resource.rock.tin" : null;
        // Where no common ore surfaced, the rarer Minecraft ores hide deeper
        // and higher — redstone and lapis up in the hills, emerald in the
        // peaks, and ancient debris only for the boldest deep-miners.
        // Rune essence surfaces here and there on bare rock — the raw stone
        // Runecrafting binds into runes at an altar.
        if (!defId && cellHash(wx, wz, salt(seed, 83)) > 0.9) defId = "resource.rock.essence";
        if (!defId) {
          const rr = cellHash(wx, wz, salt(seed, 81));
          if (h > 44) {
            defId = rr > 0.995 ? "resource.rock.netherite"
              : rr > 0.985 ? "resource.rock.emerald"
                : rr > 0.965 ? "resource.rock.lapis"
                  : rr > 0.94 ? "resource.rock.redstone" : null;
          } else if (h > 30 || evilGround) {
            defId = rr > 0.986 ? "resource.rock.emerald"
              : rr > 0.965 ? "resource.rock.lapis"
                : rr > 0.93 ? "resource.rock.redstone" : null;
          }
        }
        if (defId) nodes.push({ instanceId: id(), defId, cell });
      }
      // The volcanic wastes run with the nether ores — quartz and the
      // ancient debris that netherite is won from.
      if (biomes[i] === 18) {
        const rv = cellHash(wx, wz, salt(seed, 82));
        const defId = rv > 0.99 ? "resource.rock.netherite"
          : rv > 0.96 ? "resource.rock.quartz"
            : rv > 0.93 ? "resource.rock.redstone" : null;
        if (defId) nodes.push({ instanceId: id(), defId, cell });
      }
    }
  }
  // Keep overworld dragons well away from the starter meadow — a fresh
  // level-1 player (20 HP, basic axe) shouldn't be two-shot on their doorstep
  // by a boss that aggros at six cells. They still roam the far country.
  {
    const ta = townAnchor(seed);
    const MIN_DRAGON_DIST = 240;
    for (let k = enemies.length - 1; k >= 0; k--) {
      if (!enemies[k].defId.startsWith("enemy.dragon.")) continue;
      const c = enemies[k].cell;
      if (Math.hypot(c.x - ta.x, c.z - ta.z) < MIN_DRAGON_DIST) enemies.splice(k, 1);
    }
  }

  // Ground cover: a finer grid of grass tufts over the green biomes.
  for (let gz = 1; gz < ECHUNK - 1; gz += 4) {
    for (let gx = 1; gx < ECHUNK - 1; gx += 4) {
      const jx = gx + Math.floor(cellHash(x0 + gx, z0 + gz, salt(seed, 31)) * 3);
      const jz = gz + Math.floor(cellHash(z0 + gz, x0 + gx, salt(seed, 32)) * 3);
      if (jx >= ECHUNK - 1 || jz >= ECHUNK - 1) continue;
      const i = jz * ECHUNK + jx;
      const b = biomes[i];
      const TUFT_CHANCE: Record<number, number> = {
        0: 0.35, 1: 0.5, 4: 0.35, 6: 0.45, 7: 0.6, 8: 0.5, 9: 0.4, 10: 0.5,
        12: 0.2, 13: 0.5, 15: 0.45, 16: 0.15, 17: 0.35, 20: 0.4,
        // Volcanic (18) and glacier (19) stay barren — no ground cover.
      };
      const chance = TUFT_CHANCE[b];
      if (chance === undefined) continue;
      if (inStarterTown(seed, x0 + jx, z0 + jz)) continue; // keep the yard tidy
      if (inHouse(jx, jz)) continue; // no tufts poking through a floor
      const ground = BLOCK_LIST[blocks[i]];
      if (ground !== "grass" && !((b === 6 || b === 12 || b === 16) && ground === "drygrass")) continue;
      const roll = cellHash(x0 + jx, z0 + jz, salt(seed, 33));
      if (roll > chance) continue;
      // Flower meadows bloom on the fine grid too, not just the sparse one.
      const defId = b === 10 && roll < chance * 0.55 ? "object.flowers.wild" : "object.grass.tuft";
      objects.push({ instanceId: id(), defId, cell: { x: x0 + jx, z: z0 + jz } });
    }
  }
  // Waterlines: fishing spots and reeds wherever land meets water. The
  // fishing flavor follows the water body — sea on the shelf, river in the
  // channels, marsh in swamp country, ponds elsewhere — and frozen lakes
  // get ice holes drilled right out on the lid.
  for (let jz = 1; jz < ECHUNK - 1; jz++) {
    for (let jx = 1; jx < ECHUNK - 1; jx++) {
      const i = jz * ECHUNK + jx;
      const block = BLOCK_LIST[blocks[i]];
      const wx = x0 + jx;
      const wz = z0 + jz;
      const cell = { x: wx, z: wz };
      if (block === "ice") {
        if (cellHash(wx, wz, salt(seed, 43)) < 0.012) {
          nodes.push({ instanceId: id(), defId: "resource.fishing.ice", cell });
        }
        continue;
      }
      if (block !== "water") continue;
      const nearLand =
        BLOCK_LIST[blocks[i - 1]] !== "water" || BLOCK_LIST[blocks[i + 1]] !== "water" ||
        BLOCK_LIST[blocks[i - ECHUNK]] !== "water" || BLOCK_LIST[blocks[i + ECHUNK]] !== "water";
      // Squid drift out in the open water, clear of the shore.
      if (!nearLand && cellHash(wx, wz, salt(seed, 45)) < 0.006) {
        enemies.push({ instanceId: id(), defId: "enemy.squid", cell });
      }
      if (!nearLand) continue;
      const r = cellHash(wx, wz, salt(seed, 43));
      if (r < 0.05) {
        const f = heightFields(seed, wx, wz);
        const defId = f.ocean
          ? "resource.fishing.sea"
          : f.riverCore > 0
            ? "resource.fishing.river"
            : biomes[i] === 4
              ? "resource.fishing.marsh"
              : "resource.fishing.pond";
        nodes.push({ instanceId: id(), defId, cell });
      } else if (r < 0.17) {
        objects.push({ instanceId: id(), defId: "object.reeds.water", cell });
      }
      // River crossings, fired once per channel from its western land edge: a
      // fallen-log Agility hop over a narrow channel, so Agility trains out in
      // the world. Stays wholly inside the chunk interior (seam-safe). The hop
      // teleports to the far bank and the action re-checks walkability, so an
      // unreachable target is simply a no-op.
      if (jx >= 2 && BLOCK_LIST[blocks[i - 1]] !== "water" && !inStarterTown(seed, wx - 1, wz)) {
        let span = 0;
        while (span < 3 && jx + span < ECHUNK - 1 && BLOCK_LIST[blocks[i + span]] === "water") span++;
        const nearI = i - 1, farI = i + span;
        const farBlock = jx + span < ECHUNK - 1 ? BLOCK_LIST[blocks[farI]] : "water";
        const flat = Math.abs(heights[nearI] - heights[farI]) <= 1;
        if (span >= 1 && span <= 2 && farBlock !== "water" && farBlock !== "ice" && flat &&
          cellHash(wx, wz, salt(seed, 84)) < 0.4) {
          objects.push({
            instanceId: id(), defId: "object.shortcut.log", cell: { x: wx - 1, z: wz },
            portal: { targetRegionId: "region.endless", targetCell: { x: wx + span, z: wz } },
          });
        }
      }
    }
  }

  // Signposts stand beside the road junctions, so the network reads as a
  // travelled way with somewhere to go. Each junction is owned by the one
  // chunk its node falls in (no double-placement across the seam); a post is
  // set just off the road on dry, gentle, unclaimed ground.
  {
    const g0x = Math.floor(x0 / PATH_L) - 1, g1x = Math.floor((x0 + ECHUNK) / PATH_L) + 1;
    const g0z = Math.floor(z0 / PATH_L) - 1, g1z = Math.floor((z0 + ECHUNK) / PATH_L) + 1;
    for (let gx = g0x; gx <= g1x; gx++) {
      for (let gz = g0z; gz <= g1z; gz++) {
        if (cellHash(gx * 17 + 3, gz * 19 + 7, salt(seed, 85)) > 0.45) continue;
        const node = roadNode(seed, gx, gz);
        const njx = Math.round(node.x) - x0, njz = Math.round(node.z) - z0;
        if (njx < 0 || njx >= ECHUNK || njz < 0 || njz >= ECHUNK) continue; // owned elsewhere
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          const sx = njx + Math.round(Math.cos(ang) * 3), sz = njz + Math.round(Math.sin(ang) * 3);
          if (sx < 1 || sx >= ECHUNK - 1 || sz < 1 || sz >= ECHUNK - 1) continue;
          const sb = BLOCK_LIST[blocks[sz * ECHUNK + sx]];
          if (sb === "water" || sb === "ice" || sb === "stonebrick" || sb === "plank" || sb === "gravel") continue;
          const swx = x0 + sx, swz = z0 + sz;
          if (inStarterTown(seed, swx, swz) || inHouse(sx, sz)) continue;
          const rd = roadDist(seed, swx, swz);
          if (rd < 2.5 || rd > 4.5) continue; // just off the shoulder
          objects.push({ instanceId: id(), defId: "object.signpost", cell: { x: swx, z: swz } });
          break;
        }
      }
    }
  }
  } // end if (!CLEAR_ASSETS)

  return { cx, cz, heights, blocks, nodes, objects, enemies, structures, npcs };
}

/** Terrain source + chunk cache. WorldState reads cells; the ChunkManager
 *  activates/retires feature placements as the player moves. */
export class EndlessTerrain {
  private cache = new Map<string, EndlessChunk>();
  constructor(readonly seed: number) {}

  chunk(cx: number, cz: number): EndlessChunk {
    const key = `${cx},${cz}`;
    let c = this.cache.get(key);
    if (!c) {
      c = generateChunk(this.seed, cx, cz);
      this.cache.set(key, c);
      // Bounded memory: regeneration is deterministic, so eviction is safe.
      if (this.cache.size > 900) {
        const oldest = this.cache.keys().next().value!;
        this.cache.delete(oldest);
      }
    } else {
      // Refresh LRU position.
      this.cache.delete(key);
      this.cache.set(key, c);
    }
    return c;
  }

  heightAt(x: number, z: number): number {
    const c = this.chunk(Math.floor(x / ECHUNK), Math.floor(z / ECHUNK));
    return c.heights[(z - c.cz * ECHUNK) * ECHUNK + (x - c.cx * ECHUNK)];
  }

  blockAt(x: number, z: number): BlockType {
    const c = this.chunk(Math.floor(x / ECHUNK), Math.floor(z / ECHUNK));
    return BLOCK_LIST[c.blocks[(z - c.cz * ECHUNK) * ECHUNK + (x - c.cx * ECHUNK)]];
  }

  /** Wake up in the starter meadow: a clear cell just south of the camp. */
  findSpawn(): Cell {
    const a = townAnchor(this.seed);
    return { x: a.x, z: a.z + 6 };
  }
}

/**
 * The starter vale carries no pre-placed content — it is a clean, natural
 * building canvas walled off by the cobblestone castle wall (see `valeWall`).
 * The player raises their own town inside it with the world editor, and quests
 * are wired in separately. Kept as a function (returning empty lists) so the
 * region assembly and its tests keep a stable shape.
 */
export function buildStarterTown(_seed: number): {
  objects: ObjectPlacement[];
  enemies: EnemyPlacement[];
  npcs: NpcPlacement[];
  structures: StructurePlacement[];
  nodes: NodePlacement[];
} {
  return { objects: [], enemies: [], npcs: [], structures: [], nodes: [] };
}

export function emptyEndlessRegion(spawn: Cell): RegionSpec {
  return {
    id: "region.endless",
    width: ENDLESS_SIZE,
    depth: ENDLESS_SIZE,
    heights: [],
    blocks: [],
    nodes: [],
    objects: [],
    npcs: [],
    enemies: [],
    spawn,
    // Warm sun against a lower cool-ambient fill gives blocks real relief
    // (the renderer tints these lights warm/cool for outdoor regions).
    theme: { sky: "#8fc4e8", sun: 1.6, ambient: 0.74 },
  };
}

/** The endless region seeded with its starter town (region-level, permanent). */
export function starterTownRegion(seed: number, spawn: Cell): RegionSpec {
  const region = emptyEndlessRegion(spawn);
  const town = buildStarterTown(seed);
  region.objects = town.objects;
  region.enemies = town.enemies;
  region.npcs = town.npcs;
  region.structures = town.structures;
  region.nodes = town.nodes;
  return region;
}
