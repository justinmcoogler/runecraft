// Wild homesteads: the house pack scattered across habitable country as
// discoveries. Each stays inside its chunk (so the seam guarantee holds),
// streams into the live region with nav blockers, and retires when the
// player walks away.

import { describe, expect, it } from "vitest";
import { getStructure } from "../../content/structures/index";
import { blockedColumns } from "../../structures/types";
import { GameSimulation } from "../simulation";
import { ECHUNK, generateChunk } from "../worldgen/endless";

/** Find a chunk near the given seed that stamped a wild house. */
function findHouseChunk(seed: number): { cx: number; cz: number; chunk: ReturnType<typeof generateChunk> } | null {
  for (let cx = 500; cx < 560; cx++) {
    for (let cz = 500; cz < 560; cz++) {
      const chunk = generateChunk(seed, cx, cz);
      if (chunk.structures.length) return { cx, cz, chunk };
    }
  }
  return null;
}

// Wild homestead placement is switched off during the asset transition (the
// imported house pack is being replaced — see CLEAR_ASSETS in endless.ts), so
// these placement tests are skipped until the new asset set lands.
describe.skip("wild homesteads", () => {
  it("scatters houses from the pack across habitable country", () => {
    let houses = 0;
    const ids = new Set<string>();
    // Bounded scan: stop as soon as we've seen a couple of designs.
    outer: for (let cx = 500; cx < 524; cx++) {
      for (let cz = 500; cz < 524; cz++) {
        for (const s of generateChunk(7, cx, cz).structures) {
          houses++;
          ids.add(s.structureId);
          expect(getStructure(s.structureId), `${s.structureId} is a real asset`).toBeTruthy();
        }
        if (ids.size > 1) break outer;
      }
    }
    // A discovery every so often, drawing on more than one house design.
    expect(houses).toBeGreaterThan(0);
    expect(ids.size).toBeGreaterThan(1);
  });

  it("keeps each house footprint wholly inside its chunk (seam-safe)", () => {
    const found = findHouseChunk(12345);
    expect(found, "a house lands somewhere in the scan window").toBeTruthy();
    const { cx, cz, chunk } = found!;
    for (const s of chunk.structures) {
      const asset = getStructure(s.structureId)!;
      const lx = s.cell.x - cx * ECHUNK;
      const lz = s.cell.z - cz * ECHUNK;
      // Min corner and far corner never touch the border cells (0, ECHUNK-1).
      expect(lx).toBeGreaterThanOrEqual(1);
      expect(lz).toBeGreaterThanOrEqual(1);
      expect(lx + asset.sx - 1).toBeLessThan(ECHUNK - 1);
      expect(lz + asset.sz - 1).toBeLessThan(ECHUNK - 1);
    }
  });

  it("streams a homestead into the region with blockers, then retires it", () => {
    const found = findHouseChunk(2024);
    expect(found, "a house lands somewhere in the scan window").toBeTruthy();
    const { cx, cz, chunk } = found!;
    const placement = chunk.structures[0];
    const asset = getStructure(placement.structureId)!;
    const wall = blockedColumns(asset)[0];
    const wallCell = { x: placement.cell.x + wall.x, z: placement.cell.z + wall.z };

    const sim = GameSimulation.createEndless(2024);
    // Walk into the house's chunk: the manager activates it.
    sim.movement.setCellPosition({ x: cx * ECHUNK + ECHUNK / 2, z: cz * ECHUNK + ECHUNK / 2 });
    sim.tick();
    expect(sim.world.region.structures?.some((s) => s.instanceId === placement.instanceId)).toBe(true);
    expect(sim.world.blockerAt(wallCell)).toBe(placement.instanceId);

    // March far away: the chunk retires and its structure and blocker go.
    sim.movement.setCellPosition({ x: cx * ECHUNK + 12 * ECHUNK, z: cz * ECHUNK });
    sim.tick();
    expect(sim.world.region.structures?.some((s) => s.instanceId === placement.instanceId)).toBe(false);
    expect(sim.world.blockerAt(wallCell)).toBeUndefined();
  });
});
