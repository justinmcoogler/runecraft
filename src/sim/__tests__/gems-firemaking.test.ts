// Mining strikes gems at a rarity-weighted chance (feeding gem jewellery in
// Crafting), and Firemaking is trained by lighting logs from the pack.

import { describe, expect, it } from "vitest";
import { ITEMS, MINING_GEMS, MINING_GEM_CHANCE, SKILLS } from "../../content/content";
import type { BlockType, RegionSpec } from "../world";
import { GameSimulation } from "../simulation";

describe("mining gem table", () => {
  it("references real gem items with strictly increasing rarity", () => {
    for (const g of MINING_GEMS) expect(ITEMS[g.itemId], `${g.itemId} missing`).toBeTruthy();
    for (let i = 1; i < MINING_GEMS.length; i++) {
      // Finer gems (later in the list) are rarer: weights strictly decrease.
      expect(MINING_GEMS[i].weight).toBeLessThan(MINING_GEMS[i - 1].weight);
    }
    expect(MINING_GEM_CHANCE).toBeGreaterThan(0);
    expect(MINING_GEM_CHANCE).toBeLessThan(0.1);
  });
});

// A little quarry: a row of copper rocks the player can work through.
function makeQuarry(): RegionSpec {
  const width = 30;
  const depth = 6;
  const heights = new Array(width * depth).fill(0);
  const blocks: BlockType[] = new Array(width * depth).fill("stone");
  const nodes = [];
  for (let i = 0; i < 24; i++) {
    nodes.push({ instanceId: `rock.${i}`, defId: "resource.rock.copper", cell: { x: 3 + i, z: 3 } });
    nodes.push({ instanceId: `rockb.${i}`, defId: "resource.rock.copper", cell: { x: 3 + i, z: 4 } });
  }
  return {
    id: "region.quarry_test",
    width,
    depth,
    heights,
    blocks,
    nodes,
    objects: [],
    npcs: [],
    spawn: { x: 3, z: 2 },
  };
}

describe("striking gems while mining", () => {
  it("eventually turns up a gem across a worked-out quarry", () => {
    const sim = new GameSimulation(makeQuarry(), 7);
    sim.inventory.add("tool.pickaxe.basic", 1);
    sim.enqueue({ type: "equipSlot", slot: sim.inventory.slots.findIndex((s) => s?.itemId === "tool.pickaxe.basic") });
    sim.tick();

    let sawGem = false;
    // Work every rock in the quarry to exhaustion; across hundreds of mining
    // cycles the ~1.4% gem roll fires. Deterministic for this seed.
    for (let i = 0; i < 24; i++) {
      for (const id of [`rock.${i}`, `rockb.${i}`]) {
        sim.actions.moveTo({ x: 3 + i, z: 2 });
        for (let t = 0; t < 20; t++) sim.tick();
        // Re-interact until the rock is fully mined out (several cycles each).
        for (let rep = 0; rep < 8; rep++) {
          sim.enqueue({ type: "interact", targetId: id });
          for (let t = 0; t < 80; t++) {
            const events = sim.tick();
            if (events.some((e) => e.type === "gemFound")) sawGem = true;
          }
        }
      }
    }
    expect(sawGem).toBe(true);
    // And a gem actually landed in the pack.
    const gemCount = MINING_GEMS.reduce((n, g) => n + sim.inventory.count(g.itemId), 0);
    expect(gemCount).toBeGreaterThan(0);
  });
});

describe("firemaking", () => {
  it("lights a log for XP and consumes it", () => {
    const sim = new GameSimulation(makeQuarry(), 1);
    sim.inventory.add("item.log.basic", 3);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.log.basic");
    sim.enqueue({ type: "burnSlot", slot });
    sim.tick();
    expect(sim.skills.xp["skill.firemaking"]).toBeGreaterThan(0);
    expect(sim.inventory.count("item.log.basic")).toBe(2);
  });

  it("won't light a log the player's Firemaking level can't reach", () => {
    const sim = new GameSimulation(makeQuarry(), 1);
    sim.inventory.add("item.log.dusk", 1); // requires Firemaking 96
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.log.dusk");
    sim.enqueue({ type: "burnSlot", slot });
    sim.tick();
    expect(sim.skills.xp["skill.firemaking"] ?? 0).toBe(0);
    expect(sim.inventory.count("item.log.dusk")).toBe(1);
  });

  it("renamed Boating to Mariner, keeping the skill id stable", () => {
    expect(SKILLS["skill.boating"].name).toBe("Mariner");
  });
});
