// Stairs offer an up/down choice instead of travelling on the first click.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";

function makeStairRegion(both: boolean): RegionSpec {
  const width = 6;
  const depth = 3;
  const objects = [
    {
      instanceId: "s.up",
      defId: "object.stairs.up",
      cell: { x: 3, z: 1 },
      portal: { targetRegionId: "region.upper", targetCell: { x: 1, z: 1 } },
    },
  ];
  if (both) {
    objects.push({
      instanceId: "s.down",
      defId: "object.stairs.down",
      cell: { x: 3, z: 1 },
      portal: { targetRegionId: "region.lower", targetCell: { x: 2, z: 2 } },
    });
  }
  return {
    id: "region.stair_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(1),
    blocks: new Array<BlockType>(width * depth).fill("plank"),
    nodes: [],
    objects,
    npcs: [],
    spawn: { x: 1, z: 1 },
  };
}

function runUntil(sim: GameSimulation, pred: (e: ReturnType<GameSimulation["tick"]>[number]) => boolean, max = 300) {
  for (let i = 0; i < max; i++) {
    const events = sim.tick();
    const hit = events.find(pred);
    if (hit) return hit;
  }
  return null;
}

describe("staircase up/down choice", () => {
  it("clicking a one-way staircase offers that direction, not instant travel", () => {
    const sim = new GameSimulation(makeStairRegion(false), 1);
    sim.enqueue({ type: "interact", targetId: "s.up" });
    const choice = runUntil(sim, (e) => e.type === "stairsChoice");
    const traveled = sim.tick().some((e) => e.type === "portalEntered");
    expect(choice && choice.type === "stairsChoice").toBe(true);
    if (choice && choice.type === "stairsChoice") {
      expect(choice.options.map((o) => o.dir)).toEqual(["up"]);
      expect(choice.options[0].targetRegionId).toBe("region.upper");
    }
    expect(traveled).toBe(false); // no travel until the player picks
  });

  it("a landing serving both floors offers up and down", () => {
    const sim = new GameSimulation(makeStairRegion(true), 1);
    sim.enqueue({ type: "interact", targetId: "s.up" });
    const choice = runUntil(sim, (e) => e.type === "stairsChoice");
    expect(choice && choice.type === "stairsChoice").toBe(true);
    if (choice && choice.type === "stairsChoice") {
      expect(new Set(choice.options.map((o) => o.dir))).toEqual(new Set(["up", "down"]));
    }
  });
});
