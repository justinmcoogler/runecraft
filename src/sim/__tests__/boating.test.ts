// Boating: craft a boat and the player can cross water at the hull's speed,
// training the Boating skill; without a boat, water is a wall.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { applySave, serialize } from "../../save/save";
import type { RegionSpec, BlockType } from "../world";

// A pond spanning the full depth splits the region: land, water channel, land.
function makePondRegion(): RegionSpec {
  const width = 14;
  const depth = 5;
  const heights: number[] = [];
  const blocks: BlockType[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const water = x >= 6 && x <= 8;
      heights.push(water ? -1 : 1);
      blocks.push(water ? "water" : "grass");
    }
  }
  return {
    id: "region.pond_test",
    width,
    depth,
    heights,
    blocks,
    nodes: [],
    objects: [],
    npcs: [],
    spawn: { x: 2, z: 2 },
  };
}

function runFor(sim: GameSimulation, ticks: number) {
  for (let i = 0; i < ticks; i++) sim.tick();
}

describe("boating", () => {
  it("without a boat, water is impassable", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.actions.moveTo({ x: 12, z: 2 });
    runFor(sim, 400);
    // Stuck on the near shore — never crossed the channel.
    expect(sim.movement.currentCell().x).toBeLessThan(6);
  });

  it("with a raft, the player crosses the water and trains Boating", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.inventory.add("tool.boat.raft", 1);
    expect(sim.bestBoat()?.itemId).toBe("tool.boat.raft");

    sim.actions.moveTo({ x: 12, z: 2 });
    runFor(sim, 600);

    expect(sim.movement.currentCell().x).toBeGreaterThanOrEqual(11);
    // Rowing across the channel earned Boating XP.
    expect(sim.skills.xp["skill.boating"]).toBeGreaterThan(0);
  });

  it("a faster hull needs the level to handle it", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.inventory.add("tool.boat.skiff", 1); // needs Boating 20
    expect(sim.bestBoat()).toBeNull(); // can't handle it yet
    // Level up Boating and it becomes usable.
    sim.skills.grantXp("skill.boating", 100000);
    expect(sim.bestBoat()?.itemId).toBe("tool.boat.skiff");
  });

  it("a save made mid-water with a boat restores onto the water, not spawn", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.inventory.add("tool.boat.raft", 1);
    sim.movement.setCellPosition({ x: 7, z: 2 }); // out on the water channel
    expect(sim.world.blockAt(sim.movement.currentCell())).toBe("water");
    const data = serialize(sim);

    // Reload into a fresh sim of the same region.
    const reloaded = new GameSimulation(makePondRegion(), 1);
    applySave(reloaded, data);
    // The raft came back with the kit, so the water cell is valid — no dump to spawn.
    expect(reloaded.movement.currentCell()).toEqual({ x: 7, z: 2 });
  });

  it("without the boat, a stale water position still falls back to spawn", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.inventory.add("tool.boat.raft", 1);
    sim.movement.setCellPosition({ x: 7, z: 2 });
    const data = serialize(sim);
    data.inventory = data.inventory.map(() => null); // lost the boat
    const reloaded = new GameSimulation(makePondRegion(), 1);
    applySave(reloaded, data);
    expect(reloaded.movement.currentCell()).toEqual(reloaded.world.region.spawn);
  });

  it("picks the fastest hull the player can handle", () => {
    const sim = new GameSimulation(makePondRegion(), 1);
    sim.inventory.add("tool.boat.raft", 1);
    sim.inventory.add("tool.boat.rowboat", 1); // needs Boating 8
    expect(sim.bestBoat()?.itemId).toBe("tool.boat.raft");
    sim.skills.grantXp("skill.boating", 100000);
    expect(sim.bestBoat()?.itemId).toBe("tool.boat.rowboat");
  });
});
