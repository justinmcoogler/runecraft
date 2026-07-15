// Milestone-7 proof: rocks, bushes, and fishing spots run through the SAME
// action pipeline as trees — added as data + placements, no new gather code.

import { describe, expect, it } from "vitest";
import { NODES } from "../../content/content";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

/** Flat region with one node of each type; pond sits in a water pocket. */
function makeResourceRegion(): RegionSpec {
  const width = 12;
  const depth = 12;
  const heights = new Array<number>(width * depth).fill(0);
  const blocks = new Array<BlockType>(width * depth).fill("grass");
  // 2x2 water pocket at (8..9, 8..9); pond node in it, shore all around.
  for (const [x, z] of [[8, 8], [9, 8], [8, 9], [9, 9]]) {
    heights[z * width + x] = -1;
    blocks[z * width + x] = "water";
  }
  return {
    id: "region.resource_test",
    width,
    depth,
    heights,
    blocks,
    nodes: [
      { instanceId: "t.rock", defId: "resource.rock.copper", cell: { x: 6, z: 2 } },
      { instanceId: "t.bush", defId: "resource.bush.berry", cell: { x: 2, z: 6 } },
      { instanceId: "t.pond", defId: "resource.fishing.pond", cell: { x: 8, z: 8 } },
    ],
    objects: [],
    npcs: [],
    spawn: { x: 1, z: 1 },
  };
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 3000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("mining (copper rock)", () => {
  it("requires a pickaxe", () => {
    const sim = new GameSimulation(makeResourceRegion(), 11);
    sim.enqueue({ type: "interact", targetId: "t.rock" });
    const events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "missing_tool")).toBe(true);
  });

  it("mines to depletion with a pickaxe in the pack (not equipped), correct XP, weighted drops", () => {
    const sim = new GameSimulation(makeResourceRegion(), 11);
    sim.inventory.add("tool.pickaxe.basic", 1); // inventory-presence policy
    const initial = sim.nodes.get("t.rock")!.remaining;
    sim.enqueue({ type: "interact", targetId: "t.rock" });
    runUntil(sim, (e) => e.type === "nodeDepleted");
    expect(sim.skills.xp["skill.mining"]).toBe(initial * NODES["resource.rock.copper"].xpPerCycle);
    const gained = sim.inventory.count("item.ore.copper") + sim.inventory.count("item.stone.rough");
    expect(gained).toBeGreaterThanOrEqual(initial); // stone drops 1-2 per success
    // Rock respawns like trees do.
    runUntil(sim, (e) => e.type === "nodeRespawned", 400);
    expect(sim.nodes.get("t.rock")!.phase).toBe("active");
  });
});

describe("foraging (berry bush)", () => {
  it("needs no tool at all", () => {
    const sim = new GameSimulation(makeResourceRegion(), 11);
    sim.equippedTool = null; // bare hands
    const initial = sim.nodes.get("t.bush")!.remaining;
    sim.enqueue({ type: "interact", targetId: "t.bush" });
    runUntil(sim, (e) => e.type === "nodeDepleted");
    expect(sim.inventory.count("item.berry.basic")).toBeGreaterThanOrEqual(initial);
    expect(sim.skills.xp["skill.foraging"]).toBe(initial * NODES["resource.bush.berry"].xpPerCycle);
  });
});

describe("fishing (rippling shallows)", () => {
  it("requires a fishing rod and never depletes; stops on cancel", () => {
    const sim = new GameSimulation(makeResourceRegion(), 11);
    sim.enqueue({ type: "interact", targetId: "t.pond" });
    const rejected = [sim.tick(), sim.tick()].flat();
    expect(rejected.some((e) => e.type === "actionRejected" && e.reason === "missing_tool")).toBe(true);

    sim.inventory.add("tool.fishingrod.basic", 1);
    sim.enqueue({ type: "interact", targetId: "t.pond" });
    // Fish until we land 4 catches — far more cycles than any depleting node allows.
    let catches = 0;
    for (let i = 0; i < 2500 && catches < 4; i++) {
      for (const e of sim.tick()) {
        if (e.type === "itemGained" && e.itemId === "item.fish.raw") catches++;
        expect(e.type).not.toBe("nodeDepleted");
      }
    }
    expect(catches).toBe(4);
    expect(sim.nodes.get("t.pond")!.phase).toBe("active");
    expect(sim.skills.xp["skill.fishing"]).toBeGreaterThanOrEqual(4 * NODES["resource.fishing.pond"].xpPerCycle);

    // Player fishes from the shore, not from the water.
    const playerCell = sim.movement.currentCell();
    expect(sim.world.walkable(playerCell)).toBe(true);

    sim.enqueue({ type: "cancel" });
    const events = sim.tick();
    expect(events.some((e) => e.type === "actionEnded" && e.state === "cancelled")).toBe(true);
  });
});
