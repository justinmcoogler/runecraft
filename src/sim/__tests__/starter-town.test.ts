// The starter vale: every seeded world wakes the player on a flat grass plains
// (with a stone quarry to mine), walled off from the wild by a level-topped
// cobblestone castle wall with arched gateways. No pre-placed props or folk.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { TOWN_RADIUS, WILD_R, inStarterTown, terrainAt } from "../worldgen/endless";

// The vale centre is the spawn's anchor (findSpawn drops the player a few cells
// south of it), so recover it for ring sampling.
function valeCenter(sim: GameSimulation) {
  const s = sim.world.region.spawn;
  return { x: s.x, z: s.z - 6 };
}

describe("the starter vale", () => {
  it("wakes the player on walkable ground", () => {
    for (const seed of [1, 42, 31337, 7]) {
      const sim = GameSimulation.createEndless(seed);
      const spawn = sim.world.region.spawn;
      expect(inStarterTown(seed, spawn.x, spawn.z)).toBe(true);
      expect(sim.world.walkable(spawn)).toBe(true);
      const s = terrainAt(seed, spawn.x, spawn.z);
      expect(s.water).toBe(false);
      expect(["grass", "gravel"]).toContain(s.block); // meadow or the spawn path
    }
  });

  it("keeps the interior wild — never flat, never water — with grass, a quarry and paths", () => {
    const seed = 42;
    const c = valeCenter(GameSimulation.createEndless(seed));
    const heights = new Set<number>();
    let stone = 0, gravel = 0;
    for (let dz = -170; dz <= 170; dz += 12) {
      for (let dx = -170; dx <= 170; dx += 12) {
        if (dx * dx + dz * dz > (WILD_R - 10) * (WILD_R - 10)) continue;
        const s = terrainAt(seed, c.x + dx, c.z + dz);
        expect(s.water).toBe(false);                 // no interior rivers to fall in
        if (s.block === "stone") stone++;
        else if (s.block === "gravel") gravel++;
        else expect(s.block).toBe("grass");
        heights.add(s.h);
      }
    }
    expect(stone).toBeGreaterThan(0);                 // a quarry to mine
    expect(heights.size).toBeGreaterThan(1);          // wild, not a dead-flat lawn
  });

  it("runs gravel paths from the spawn out through the wall", () => {
    const seed = 42;
    const c = valeCenter(GameSimulation.createEndless(seed));
    // A gravel path reaches the wall radius somewhere (the gateway), walkable.
    const sim = GameSimulation.createEndless(seed);
    let gatePath = 0;
    const r = TOWN_RADIUS - 2;
    for (let k = 0; k < 720; k++) {
      const ang = (k / 720) * Math.PI * 2;
      const x = c.x + Math.round(Math.cos(ang) * r), z = c.z + Math.round(Math.sin(ang) * r);
      if (terrainAt(seed, x, z).block === "gatearch" && sim.world.walkable({ x, z })) gatePath++;
    }
    expect(gatePath).toBeGreaterThan(0);
  });

  it("carries no pre-placed folk, animals, buildings or nodes (only wall torches)", () => {
    const region = GameSimulation.createEndless(42).world.region;
    // The only pre-placed objects are the torches mounted along the castle wall.
    expect(region.objects.every((o) => o.defId === "object.torch.wall")).toBe(true);
    expect(region.objects.length).toBeGreaterThan(0); // the wall is lit
    expect(region.npcs).toHaveLength(0);
    expect(region.enemies ?? []).toHaveLength(0);
    expect(region.structures ?? []).toHaveLength(0);
    expect(region.nodes).toHaveLength(0);
  });

  it("keeps the vale free of trees and resource nodes", () => {
    const sim = GameSimulation.createEndless(42);
    sim.tick();
    const intruders = sim.world.region.nodes.filter((n) => inStarterTown(42, n.cell.x, n.cell.z));
    expect(intruders).toHaveLength(0);
  });

  it("rings the vale with a tall crenellated stone-brick castle wall", () => {
    for (const seed of [7, 42]) {
      const c = valeCenter(GameSimulation.createEndless(seed));
      const r = TOWN_RADIUS - 2;
      const heights = new Set<number>();
      let wall = 0;
      for (let k = 0; k < 400; k++) {
        const ang = (k / 400) * Math.PI * 2;
        const x = c.x + Math.round(Math.cos(ang) * r);
        const z = c.z + Math.round(Math.sin(ang) * r);
        const s = terrainAt(seed, x, z);
        if (s.block === "stonebrick") { wall++; heights.add(s.h); }
      }
      expect(wall).toBeGreaterThan(230);               // a solid stone-brick ring
      expect(heights.size).toBeGreaterThan(1);         // crenellated + buttressed, not flat
    }
  });

  it("stands the wall many blocks above its footing", () => {
    const seed = 7;
    const c = valeCenter(GameSimulation.createEndless(seed));
    const r = TOWN_RADIUS - 2;
    // Find any stone-brick wall cell and compare to the footing.
    for (let k = 0; k < 400; k++) {
      const ang = (k / 400) * Math.PI * 2;
      const wx = c.x + Math.round(Math.cos(ang) * r), wz = c.z + Math.round(Math.sin(ang) * r);
      const wall = terrainAt(seed, wx, wz);
      if (wall.block !== "stonebrick") continue;
      const foot = terrainAt(seed, c.x + Math.round(Math.cos(ang) * (r - 6)), c.z + Math.round(Math.sin(ang) * (r - 6)));
      expect(wall.h - foot.h).toBeGreaterThanOrEqual(10);
      return;
    }
    throw new Error("no wall cell found");
  });

  it("opens gateways (gravel paths) onto dry ground, never water", () => {
    for (const seed of [1, 7, 42, 31337]) {
      const c = valeCenter(GameSimulation.createEndless(seed));
      const r = TOWN_RADIUS - 2;
      for (let k = 0; k < 720; k++) {
        const ang = (k / 720) * Math.PI * 2;
        const x = c.x + Math.round(Math.cos(ang) * r);
        const z = c.z + Math.round(Math.sin(ang) * r);
        if (terrainAt(seed, x, z).block === "gatearch") {
          // Just outside this gateway must be dry land.
          const ox = c.x + Math.round(Math.cos(ang) * (TOWN_RADIUS + 22));
          const oz = c.z + Math.round(Math.sin(ang) * (TOWN_RADIUS + 22));
          expect(terrainAt(seed, ox, oz).water, `gate at ${k} opens onto water (seed ${seed})`).toBe(false);
        }
      }
    }
  });

  it("is identical for the same seed, and varies across seeds", () => {
    const a = GameSimulation.createEndless(9).world;
    const b = GameSimulation.createEndless(9).world;
    const c = GameSimulation.createEndless(10).world;
    const sig = (w: typeof a) => {
      const o = w.region.spawn;
      let s = `${o.x},${o.z}|`;
      for (let d = 80; d <= 400; d += 40) s += `${w.heightAt({ x: o.x + d, z: o.z + d })},`;
      return s;
    };
    expect(sig(a)).toBe(sig(b));
    expect(sig(a)).not.toBe(sig(c));
  });
});
