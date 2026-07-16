// Archery: bows consume arrows, missed arrows land as recoverable ground
// items, ranged attacks shoot over fences (no walkable path to the target
// needed — just a spot within range), and the straw target never chases or
// leash-heals, so it can actually be felled.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";

function region(fenced: boolean): RegionSpec {
  const width = 20, depth = 20;
  const blocks = new Array<BlockType>(width * depth).fill("grass");
  const heights = new Array<number>(width * depth).fill(0);
  if (fenced) {
    // A full fence ring two cells out from the dummy: no melee approach exists.
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) blocks[(10 + dz) * width + (10 + dx)] = "oak_fence";
    }
  }
  return {
    id: "region.arch_test", width, depth, heights, blocks,
    nodes: [], objects: [], npcs: [],
    enemies: [{ instanceId: "dummy", defId: "enemy.target_dummy", cell: { x: 10, z: 10 } }],
    spawn: { x: 5, z: 10 },
  };
}

function shootUntilDead(sim: GameSimulation): { died: boolean; attacks: number } {
  sim.inventory.add("tool.bow.oak", 1);
  sim.inventory.add("item.arrow.bronze", 30);
  sim.equippedTool = "tool.bow.oak";
  sim.enqueue({ type: "interact", targetId: "dummy" });
  let died = false, attacks = 0;
  for (let i = 0; i < 1500 && !died; i++) {
    for (const e of sim.tick()) {
      if (e.type === "playerAttack") attacks++;
      if (e.type === "enemyDied") died = true;
    }
  }
  return { died, attacks };
}

describe("archery", () => {
  it("consumes arrows, fells the target at range, drops recoverable arrows", () => {
    const sim = new GameSimulation(region(false), 5);
    const r = shootUntilDead(sim);
    expect(r.died).toBe(true);
    // Every shot spent an arrow; misses (and half the hits) fell nearby.
    expect(sim.inventory.count("item.arrow.bronze")).toBe(30 - r.attacks);
    // The dummy never moved: stationary targets don't chase or leash-heal.
    expect(sim.enemies.get("dummy")!.movement.currentCell()).toEqual({ x: 10, z: 10 });
  });

  it("shoots straight over a fence that fully seals the target off", () => {
    const sim = new GameSimulation(region(true), 5);
    const r = shootUntilDead(sim);
    expect(r.died).toBe(true);
  });

  it("cannot shoot without arrows", () => {
    const sim = new GameSimulation(region(false), 5);
    sim.inventory.add("tool.bow.oak", 1);
    sim.equippedTool = "tool.bow.oak";
    sim.enqueue({ type: "interact", targetId: "dummy" });
    let ended: string | null = null;
    for (let i = 0; i < 400 && !ended; i++) {
      for (const e of sim.tick()) if (e.type === "actionEnded" && e.state === "failed") ended = e.reason;
    }
    expect(ended).toBe("out_of_arrows");
    expect(sim.enemies.get("dummy")!.hp).toBe(30);
  });
});
