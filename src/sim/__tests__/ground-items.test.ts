// Ground items: dropped loot / laid eggs that lie in the world, auto-pick-up
// when the player steps near, and despawn after a while.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { GroundItemSystem } from "../ground-items";
import type { Cell } from "../types";
import type { RegionSpec, BlockType } from "../world";

function makeRegion(enemies: RegionSpec["enemies"] = []): RegionSpec {
  const width = 16, depth = 16;
  return {
    id: "region.ground_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [],
    enemies,
    spawn: { x: 2, z: 2 },
  };
}

describe("GroundItemSystem", () => {
  it("auto-picks-up a stack when the player steps near, if it fits", () => {
    let picked: Array<[string, number]> = [];
    const player: Cell = { x: 5, z: 5 };
    const sys = new GroundItemSystem({
      getPlayerCell: () => player,
      isPlayerAlive: () => true,
      tryPickup: (itemId, qty) => { picked.push([itemId, qty]); return true; },
    });
    sys.spawn("item.egg", 1, { x: 9, z: 9 }); // far away — not grabbed
    sys.tick(0.1);
    expect(picked.length).toBe(0);
    expect(sys.instances.size).toBe(1);
    // Step onto it: within one cell, it's collected and removed.
    player.x = 9; player.z = 8;
    sys.tick(0.1);
    expect(picked).toEqual([["item.egg", 1]]);
    expect(sys.instances.size).toBe(0);
  });

  it("leaves the stack on the ground when the pack is full", () => {
    const player: Cell = { x: 9, z: 9 };
    const sys = new GroundItemSystem({
      getPlayerCell: () => player,
      isPlayerAlive: () => true,
      tryPickup: () => false, // pack full
    });
    sys.spawn("item.egg", 1, { x: 9, z: 9 });
    sys.tick(0.1);
    expect(sys.instances.size).toBe(1);
  });

  it("despawns a stack after its timer runs out", () => {
    const sys = new GroundItemSystem({
      getPlayerCell: () => ({ x: 0, z: 0 }),
      isPlayerAlive: () => true,
      tryPickup: () => false,
    });
    sys.spawn("item.egg", 1, { x: 9, z: 9 });
    sys.tick(119);
    expect(sys.instances.size).toBe(1);
    sys.tick(2);
    expect(sys.instances.size).toBe(0);
  });

  it("evicts the oldest stack past the cap", () => {
    const sys = new GroundItemSystem({
      getPlayerCell: () => ({ x: -99, z: -99 }),
      isPlayerAlive: () => true,
      tryPickup: () => false,
    });
    for (let i = 0; i < 80; i++) sys.spawn("item.egg", 1, { x: i % 16, z: 0 });
    expect(sys.instances.size).toBeLessThanOrEqual(64);
  });
});

describe("ground items in the simulation", () => {
  it("drops laid eggs from a chicken, which the player can then pick up", () => {
    const sim = new GameSimulation(makeRegion([{ instanceId: "hen", defId: "enemy.chicken", cell: { x: 9, z: 9 } }]), 7);
    // The player idles at spawn (far from the hen) so eggs accumulate.
    let laidEgg = false;
    for (let i = 0; i < 3000 && !laidEgg; i++) {
      sim.tick();
      laidEgg = [...sim.groundItems.instances.values()].some((g) => g.itemId === "item.egg");
    }
    expect(laidEgg).toBe(true);
  });

  it("a full pack can't grab a drop until a slot frees up", () => {
    const sim = new GameSimulation(makeRegion(), 1);
    // Fill every slot so nothing new fits.
    const slots = sim.inventory.slots.length;
    sim.inventory.add("item.log.basic", 50 * slots);
    expect(sim.inventory.canAdd("item.egg", 1)).toBe(false);
    const here = sim.movement.currentCell();
    sim.spawnGroundItem(here, "item.egg", 1);
    sim.tick();
    expect(sim.groundItems.instances.size).toBe(1); // stayed on the ground
    // Free a slot and it's collected on the next step.
    sim.inventory.removeItemById("item.log.basic", 50);
    sim.tick();
    expect(sim.groundItems.instances.size).toBe(0);
    expect(sim.inventory.count("item.egg")).toBe(1);
  });
});
