// Validation for the rich endless world: safe beginner spawn, danger + reward
// that climb with distance, seam-free terrain/roads, and meaningful world
// content for the whole skill spread — across several seeds.

import { beforeEach, describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import {
  EndlessTerrain, ENDLESS_CENTER, ECHUNK, generateChunk, terrainAt, roadDist,
  remoteness01, dangerTier, setValeActive,
} from "../worldgen/endless";

const SEEDS = [7, 4242, 99, 31337];
const cc = Math.floor(ENDLESS_CENTER / ECHUNK);

// Bosses/elites that must never lurk right next to a fresh spawn.
const DEADLY = /warden|dragon|ravager|barrow_lord|silt_king|glacial_wight|canyon_construct/;

/** Collect every placed def id across a square of chunks around the anchor. */
function sweep(seed: number, chunkRadius: number, ringFrom = 0) {
  setValeActive(false);
  const nodes = new Set<string>(), objects = new Set<string>(), enemies = new Set<string>();
  let structures = 0;
  for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) < ringFrom) continue;
      const ch = generateChunk(seed, cc + dx, cc + dz);
      for (const n of ch.nodes) nodes.add(n.defId);
      for (const o of ch.objects) objects.add(o.defId);
      for (const e of ch.enemies) enemies.add(e.defId);
      structures += ch.structures.length;
    }
  }
  return { nodes, objects, enemies, structures };
}

describe("the endless world", () => {
  // The wild world is generated with the starter vale OFF; keep the shared
  // module flag pinned so a neighbouring suite can't gate the near-origin scatter.
  beforeEach(() => setValeActive(false));

  it("gives every seed a safe, dry, low-danger beginner spawn", () => {
    for (const seed of SEEDS) {
      const terrain = new EndlessTerrain(seed);
      const spawn = terrain.findSpawn();
      const s = terrainAt(seed, spawn.x, spawn.z);
      expect(s.water, `${seed}: spawn in water`).toBe(false);
      expect(remoteness01(spawn.x, spawn.z), `${seed}: spawn far from home`).toBeLessThan(0.2);
      // No boss/elite in the spawn chunk or its neighbours.
      setValeActive(false);
      const scx = Math.floor(spawn.x / ECHUNK), scz = Math.floor(spawn.z / ECHUNK);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const e of generateChunk(seed, scx + dx, scz + dz).enemies) {
            expect(DEADLY.test(e.defId), `${seed}: ${e.defId} spawned next to home`).toBe(false);
          }
        }
      }
    }
  });

  it("escalates danger the farther you roam", () => {
    expect(dangerTier(ENDLESS_CENTER, ENDLESS_CENTER)).toBe(0);
    expect(dangerTier(ENDLESS_CENTER + 8000, ENDLESS_CENTER)).toBe(5);
    for (const seed of SEEDS) {
      setValeActive(false);
      const near = sweep(seed, 3).enemies;
      const far = new Set<string>();
      const far0 = Math.floor((ENDLESS_CENTER + 8000) / ECHUNK);
      for (let i = 0; i < 24; i++) for (const e of generateChunk(seed, far0 + i, cc + i).enemies) far.add(e.defId);
      // Deadly foes only appear in the deep wilds, never in the near sweep.
      expect([...near].some((d) => DEADLY.test(d)), `${seed}: boss near home`).toBe(false);
      expect([...far].some((d) => DEADLY.test(d)), `${seed}: no boss in the deep`).toBe(true);
    }
  });

  it("logs discoveries, pays a bounty, and persists them as world flags", () => {
    const sim = GameSimulation.createEndless(42);
    const p = sim.movement.currentCell();
    sim.world.region.structures = [{ instanceId: "test.ruin", structureId: "ruin_broch", cell: { x: p.x + 2, z: p.z + 2 } }];
    const before = sim.inventory.count("item.coin");
    const evs = sim.tick();
    expect(evs.some((e) => e.type === "poiDiscovered")).toBe(true);
    expect(sim.worldFlags.has("found.test.ruin")).toBe(true); // persisted via worldFlags
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(before);
    expect(sim.discoveryCount()).toBe(1);
    // Idempotent: re-scanning the same landmark never pays twice.
    const held = sim.inventory.count("item.coin");
    sim.tick();
    expect(sim.inventory.count("item.coin")).toBe(held);
  });

  it("has seam-free terrain and continuous roads across chunk borders", () => {
    const seed = 4242;
    const terrain = new EndlessTerrain(seed);
    const bx = (cc + 5) * ECHUNK; // a chunk border
    for (let z = (cc + 4) * ECHUNK; z < (cc + 4) * ECHUNK + 12; z++) {
      for (const x of [bx - 1, bx, bx + 1]) {
        expect(terrain.heightAt(x, z)).toBe(terrainAt(seed, x, z).h);
        // roadDist is a smooth world-space field — neighbours never jump wildly.
        expect(Math.abs(roadDist(seed, x, z) - roadDist(seed, x + 1, z))).toBeLessThan(2.0);
      }
    }
  });

  it("fills the world with content for the whole skill spread", () => {
    // A broad multi-seed sweep — heavy, and slower still under parallel load,
    // so it gets a generous timeout (see the trailing argument below).
    // One broad multi-seed sweep so rare features (villages, dungeons) show up.
    const nodes = new Set<string>(), objects = new Set<string>(), enemies = new Set<string>();
    let structures = 0;
    for (const seed of SEEDS) {
      const s = sweep(seed, 6);
      s.nodes.forEach((d) => nodes.add(d));
      s.objects.forEach((d) => objects.add(d));
      s.enemies.forEach((d) => enemies.add(d));
      structures += s.structures;
      // Walk the whole distance gradient so every danger tier's ore + beasts
      // surface (copper near → diamond/netherite in the deep).
      for (let i = 1; i <= 20; i++) {
        const ch = generateChunk(seed, cc + i * 7, cc + i * 2);
        ch.nodes.forEach((n) => nodes.add(n.defId));
        ch.enemies.forEach((e) => enemies.add(e.defId));
      }
    }
    const hasNode = (p: string) => [...nodes].some((d) => d.startsWith(p));
    // Gathering skills — resource nodes in the wild.
    expect(hasNode("resource.tree."), "woodcutting").toBe(true);
    expect(hasNode("resource.rock."), "mining").toBe(true);
    expect(hasNode("resource.fishing."), "fishing").toBe(true);
    expect(hasNode("resource.bush."), "foraging").toBe(true);
    expect(hasNode("resource.herb."), "herblore").toBe(true);
    expect(hasNode("resource.trail."), "hunting").toBe(true);
    expect(hasNode("resource.digsite."), "archaeology").toBe(true);
    // Combat family — a varied bestiary, from placid beasts to elites.
    expect(enemies.size, "bestiary variety").toBeGreaterThan(12);
    // Multiple tree species and ore kinds appear (biome + danger scaling).
    const species = [...nodes].filter((d) => d.startsWith("resource.tree.")).length;
    const ores = [...nodes].filter((d) => d.startsWith("resource.rock.")).length;
    expect(species, "tree variety").toBeGreaterThan(5);
    // Surface ore is the common metals only (rares are underground); a few show.
    expect(ores, "surface ore variety").toBeGreaterThanOrEqual(3);
    // Civilisation + adventure: dungeons and built structures generate.
    expect([...objects].some((d) => d.includes("portal.cave")), "dungeon gates").toBe(true);
    expect(structures, "wild structures/homesteads").toBeGreaterThan(0);
  }, 90000);
});
