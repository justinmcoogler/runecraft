// The random world: every seeded world is fully natural from the spawn — no
// walled starter vale, no origin town. The player just wakes on gentle, dry
// natural ground. (The vale geometry lives on behind STARTER_VALE for the
// upcoming tutorial region, but the endless world never applies it.)

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { inStarterTown, terrainAt } from "../worldgen/endless";

describe("the random world (no starter vale)", () => {
  it("wakes the player on walkable, dry natural ground", () => {
    for (const seed of [1, 42, 31337, 7]) {
      const sim = GameSimulation.createEndless(seed);
      const spawn = sim.world.region.spawn;
      expect(sim.world.walkable(spawn)).toBe(true);
      expect(terrainAt(seed, spawn.x, spawn.z).water).toBe(false);
    }
  });

  it("builds no starter vale — inStarterTown is always false, no castle wall", () => {
    for (const seed of [1, 42]) {
      const sim = GameSimulation.createEndless(seed);
      const s = sim.world.region.spawn;
      expect(inStarterTown(seed, s.x, s.z)).toBe(false);
      // No ring of stone-brick wall / gate arch around the spawn.
      let wallish = 0;
      for (let k = 0; k < 240; k++) {
        const ang = (k / 240) * Math.PI * 2;
        for (const r of [120, 123, 125, 128]) {
          const b = terrainAt(seed, s.x + Math.round(Math.cos(ang) * r), s.z + Math.round(Math.sin(ang) * r)).block;
          if (b === "stonebrick" || b === "gatearch") wallish++;
        }
      }
      expect(wallish).toBe(0); // the wall is gone
    }
  });

  it("is deterministic per seed, and varies across seeds", () => {
    const at = (seed: number, x: number, z: number) => terrainAt(seed, x, z);
    expect(at(5, 40, 40)).toEqual(at(5, 40, 40));
    // Two seeds differ somewhere in a small window.
    let differ = false;
    for (let d = 0; d < 40 && !differ; d++) {
      if (at(5, d, d).h !== at(6, d, d).h || at(5, d, d).block !== at(6, d, d).block) differ = true;
    }
    expect(differ).toBe(true);
  });
});
