// The endless world: deterministic chunks, seam-free terrain, streaming
// entities that follow the player, and a sane spawn — all per seed.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import {
  ECHUNK,
  ENDLESS_CENTER,
  EndlessTerrain,
  generateChunk,
  terrainAt,
} from "../worldgen/endless";

describe("the endless generator", () => {
  it("generates identical chunks for identical (seed, cx, cz)", () => {
    const a = generateChunk(1234, 512, 511);
    const b = generateChunk(1234, 512, 511);
    expect([...a.heights]).toEqual([...b.heights]);
    expect([...a.blocks]).toEqual([...b.blocks]);
    expect(a.nodes.map((n) => `${n.instanceId}:${n.defId}@${n.cell.x},${n.cell.z}`)).toEqual(
      b.nodes.map((n) => `${n.instanceId}:${n.defId}@${n.cell.x},${n.cell.z}`),
    );
  });

  it("differs between seeds", () => {
    // Sample wilderness well outside the flat starter commons (chunk 512 is the
    // town centre, a deterministic grass plateau that can match across seeds).
    const a = generateChunk(1, 600, 600);
    const b = generateChunk(2, 600, 600);
    expect([...a.heights]).not.toEqual([...b.heights]);
  });

  it("has no seams: chunk reads equal the pure function across borders", () => {
    const terrain = new EndlessTerrain(777);
    const bx = 513 * ECHUNK; // a chunk border
    for (let z = 500 * ECHUNK; z < 500 * ECHUNK + 8; z++) {
      for (const x of [bx - 2, bx - 1, bx, bx + 1]) {
        expect(terrain.heightAt(x, z)).toBe(terrainAt(777, x, z).h);
        expect(terrain.blockAt(x, z)).toBe(terrainAt(777, x, z).block);
      }
    }
  });

  it("realises every biome, including the new special ones, somewhere", () => {
    // Sweep a wide area across a few seeds and collect the biome ids that
    // actually appear. The special biomes (21-25) are rare, so scan broadly.
    const seen = new Set<number>();
    for (const seed of [7, 4242, 99]) {
      for (let x = ENDLESS_CENTER - 1400; x < ENDLESS_CENTER + 1400; x += 5) {
        for (let z = ENDLESS_CENTER - 1400; z < ENDLESS_CENTER + 1400; z += 5) {
          seen.add(terrainAt(seed, x, z).biome);
        }
      }
    }
    // The five new biomes must each turn up at least once across the sweep.
    for (const b of [21, 22, 23, 24, 25]) {
      expect(seen.has(b), `biome ${b} never generated`).toBe(true);
    }
  });

  it("finds a dry, gentle spawn near the world anchor", () => {
    const terrain = new EndlessTerrain(31337);
    const spawn = terrain.findSpawn();
    expect(Math.hypot(spawn.x - ENDLESS_CENTER, spawn.z - ENDLESS_CENTER)).toBeLessThan(700);
    const s = terrainAt(31337, spawn.x, spawn.z);
    expect(s.water).toBe(false);
    // The anchor sits in the vale, so the spawn cell may be meadow or a path.
    expect(["grass", "dirt", "sand", "drygrass", "mud", "stonebrick", "gravel"]).toContain(s.block);
  });
});

describe("an endless simulation", () => {
  it("streams terrain with the player and serves it lazily", () => {
    const sim = GameSimulation.createEndless(42);
    const spawn = sim.world.region.spawn;
    // Terrain answers anywhere, straight from the generator.
    expect(Number.isFinite(sim.world.heightAt(spawn))).toBe(true);
    expect(sim.world.walkable(spawn)).toBe(true);

    // March 6 chunks east: terrain still answers as the active window follows.
    // (During the asset transition the world carries no scattered entities —
    // see CLEAR_ASSETS — but terrain streaming and node bookkeeping still hold.)
    const far = { x: spawn.x + 6 * ECHUNK, z: spawn.z };
    sim.movement.setCellPosition(far);
    sim.tick();
    expect(Number.isFinite(sim.world.heightAt(far))).toBe(true);
    // No node ever leaves the active window, and the node system mirrors the
    // placement list exactly (no leaks either way).
    // (The lobby hub seeds permanent town.tree.* nodes near spawn; those aren't
    // streamed chunk nodes, so they're exempt from the trailing-window check.)
    const stillOld = sim.world.region.nodes.some(
      (n) => !n.instanceId.startsWith("town.") && n.cell.x < spawn.x - 3 * ECHUNK,
    );
    expect(stillOld).toBe(false);
    expect(sim.nodes.instances.size).toBe(sim.world.region.nodes.length);
  });

  it("never walks through a blocker that streams onto an already-set path", () => {
    // Regression: a path A*'d toward a distant goal crosses cells that were
    // still off-stream (unblocked) when clicked. As chunks stream in, trees pop
    // onto the queued path — the mover must reroute, never clip straight
    // through. Simulate that by registering a blocker mid-path after the path
    // is set, exactly as chunk streaming would.
    const sim = GameSimulation.createEndless(1234);
    const spawn = sim.world.region.spawn;
    // Walk due east along flat ground; find a reachable goal ~20 cells out.
    let goal = { x: spawn.x + 20, z: spawn.z };
    if (!sim.world.walkable(goal)) goal = { x: spawn.x + 12, z: spawn.z };
    sim.enqueue({ type: "moveTo", cell: goal });
    sim.tick(); // routes the path
    const path = [...sim.movement.remainingPath()];
    expect(path.length).toBeGreaterThan(2);
    // Drop a blocker three cells ahead, the way a streamed tree would land.
    const blocked = path[Math.min(3, path.length - 2)];
    sim.world.registerBlocker("test.tree", blocked);
    expect(sim.world.walkable(blocked)).toBe(false);
    // Walk it out; the player must never occupy the blocked cell.
    const visited: string[] = [];
    for (let i = 0; i < 60 && sim.movement.isMoving(); i++) {
      sim.tick();
      const c = sim.movement.currentCell();
      visited.push(`${c.x},${c.z}`);
    }
    expect(visited).not.toContain(`${blocked.x},${blocked.z}`);
  });

  it("keeps world size boundless in practice", () => {
    const sim = GameSimulation.createEndless(7);
    // 40 chunks away in one call — terrain still answers instantly.
    const there = { x: sim.world.region.spawn.x + 40 * ECHUNK, z: sim.world.region.spawn.z + 40 * ECHUNK };
    sim.movement.setCellPosition(there);
    sim.tick();
    expect(Number.isFinite(sim.world.heightAt(there))).toBe(true);
    // Streamed wild nodes track the player; permanent town.tree.* hub nodes stay
    // at spawn and are exempt.
    expect(sim.world.region.nodes.every((n) => n.instanceId.startsWith("town.") || Math.abs(n.cell.x - there.x) < 300)).toBe(true);
  });
});

describe("schematics", () => {
  it("stamps a schematic flat with its blocks, lifts and marks", async () => {
    const { RUIN_STONE_CIRCLE, schematicFits, stampSchematic } = await import("../worldgen/schematics");
    const size = 16;
    const heights = new Int16Array(size * size).fill(5);
    // A little relief inside tolerance.
    heights[3 * size + 4] = 6;
    const blocks = new Uint8Array(size * size); // all palette id 0 (grass)
    const placed: string[] = [];
    const target = {
      heights,
      blocks,
      size,
      blockId: { stonebrick: 12 } as Record<string, number>,
      blockList: ["grass", "dirt", "stone", "sand", "water", "plank", "snow", "ice", "mud", "redsand", "mycelium", "drygrass", "stonebrick"] as const,
      addObject: (defId: string) => placed.push(`object:${defId}`),
      addNode: (defId: string) => placed.push(`node:${defId}`),
      addEnemy: (defId: string) => placed.push(`enemy:${defId}`),
    };
    expect(schematicFits(RUIN_STONE_CIRCLE, target as never, 3, 3)).toBe(true);
    stampSchematic(RUIN_STONE_CIRCLE, target as never, 3, 3, 0, 0);
    // Floor ring is stonebrick at the flattened anchor height
    // (schematic cell (3,0) → chunk cell (6,3), no lift there).
    expect(blocks[3 * size + 6]).toBe(12);
    expect(heights[3 * size + 6]).toBe(5);
    // Interior keeps natural ground.
    expect(blocks[6 * size + 6]).toBe(0);
    // Pillars lift 2 above the anchor (schematic (1,1) → chunk (4,4)).
    expect(blocks[4 * size + 4]).toBe(12);
    expect(heights[4 * size + 4]).toBe(7);
    // Marks landed: two boulders and a strongbox.
    expect(placed.filter((p) => p === "object:object.boulder.stone")).toHaveLength(2);
    expect(placed).toContain("node:resource.strongbox.old");
  });

  it("rejects sites on water or steep relief", async () => {
    const { RUIN_STONE_CIRCLE, schematicFits } = await import("../worldgen/schematics");
    const size = 16;
    const mk = () => ({
      heights: new Int16Array(size * size).fill(5),
      blocks: new Uint8Array(size * size),
      size,
      blockId: { stonebrick: 12 } as Record<string, number>,
      blockList: ["grass", "dirt", "stone", "sand", "water", "plank", "snow", "ice", "mud", "redsand", "mycelium", "drygrass", "stonebrick"] as const,
      addObject: () => {},
      addNode: () => {},
      addEnemy: () => {},
    });
    const wet = mk();
    wet.blocks[5 * size + 5] = 4; // water inside the footprint
    expect(schematicFits(RUIN_STONE_CIRCLE, wet as never, 3, 3)).toBe(false);
    const steep = mk();
    steep.heights[5 * size + 5] = 9; // 4-block cliff inside the footprint
    expect(schematicFits(RUIN_STONE_CIRCLE, steep as never, 3, 3)).toBe(false);
    // And the chunk edge is off limits.
    expect(schematicFits(RUIN_STONE_CIRCLE, mk() as never, 0, 3)).toBe(false);
  });
});

describe("the world clock", () => {
  it("advances with ticks, lights the day and darkens the night", () => {
    const sim = GameSimulation.createEndless(9);
    const t0 = sim.timeS;
    sim.tick();
    expect(sim.timeS).toBeGreaterThan(t0);
    // Mid-morning start: daylight is up.
    expect(sim.daylight()).toBeGreaterThan(0.3);
    // Warp to midnight: dark.
    sim.timeS = 0;
    expect(sim.daylight()).toBe(0);
    expect(sim.dayCount()).toBe(1);
    // Noon of day 3.
    sim.timeS = 2 * 1200 + 600;
    expect(sim.daylight()).toBeGreaterThan(0.9);
    expect(sim.dayCount()).toBe(3);
  });

  it("rolls deterministic weather spells per seed", () => {
    const a = GameSimulation.createEndless(9);
    const b = GameSimulation.createEndless(9);
    const kinds = new Set<string>();
    for (let spell = 0; spell < 40; spell++) {
      a.timeS = b.timeS = spell * 240 + 1;
      expect(a.weather()).toBe(b.weather());
      kinds.add(a.weather());
    }
    // Over 40 spells the sky should have shown some variety.
    expect(kinds.size).toBeGreaterThan(1);
    expect(kinds.has("clear")).toBe(true);
  });
});
