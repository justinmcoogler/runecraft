// Milestone-8 tests: cooking and smithing run through the same action
// pipeline; input consumption is transactional (never lost mid-cycle).

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

const CAMPFIRE = "t.campfire";
const FURNACE = "t.furnace";

function makeCampRegion(): RegionSpec {
  const width = 8;
  const depth = 8;
  return {
    id: "region.camp_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [
      { instanceId: CAMPFIRE, defId: "object.campfire.basic", cell: { x: 4, z: 4 } },
      { instanceId: FURNACE, defId: "object.furnace.basic", cell: { x: 6, z: 4 } },
    ],
    npcs: [],
    spawn: { x: 2, z: 2 },
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

describe("cooking at the campfire", () => {
  it("walks over, opens the recipe sheet, cooks all fish (some burn), correct XP", () => {
    const sim = new GameSimulation(makeCampRegion(), 21);
    sim.inventory.add("item.fish.raw", 5);

    sim.enqueue({ type: "interact", targetId: CAMPFIRE });
    runUntil(sim, (e) => e.type === "workstationOpened");

    sim.enqueue({ type: "craft", stationId: CAMPFIRE, recipeId: "recipe.cooked_fish" });
    const events = runUntil(sim, (e) => e.type === "actionEnded");

    const cooked = sim.inventory.count("item.fish.cooked");
    const burnt = sim.inventory.count("item.fish.burnt");
    expect(cooked + burnt).toBe(5);
    expect(sim.inventory.count("item.fish.raw")).toBe(0);
    expect(sim.skills.xp["skill.cooking"]).toBe(cooked * 22); // burns give no XP
    expect(events.some((e) => e.type === "actionEnded" && e.state === "completed" && e.reason === "out_of_inputs")).toBe(true);
  });

  it("rejects crafting without ingredients", () => {
    const sim = new GameSimulation(makeCampRegion(), 21);
    sim.enqueue({ type: "interact", targetId: CAMPFIRE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: CAMPFIRE, recipeId: "recipe.cooked_fish" });
    const events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "missing_inputs")).toBe(true);
  });
});

describe("smelting at the furnace", () => {
  it("smelts 5 ore into 2 bars with 1 ore left over", () => {
    const sim = new GameSimulation(makeCampRegion(), 21);
    sim.inventory.add("item.ore.copper", 5);
    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.copper_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.bar.copper")).toBe(2);
    expect(sim.inventory.count("item.ore.copper")).toBe(1);
    expect(sim.skills.xp["skill.smithing"]).toBe(60);
  });

  it("cancelling mid-cycle never loses ingredients", () => {
    const sim = new GameSimulation(makeCampRegion(), 21);
    sim.inventory.add("item.ore.copper", 2);
    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.copper_bar" });
    runUntil(sim, (e) => e.type === "actionStarted");
    // Mid-cycle (3s cycle = 30 ticks): cancel after 10.
    for (let i = 0; i < 10; i++) sim.tick();
    sim.enqueue({ type: "cancel" });
    sim.tick();
    expect(sim.inventory.count("item.ore.copper")).toBe(2);
    expect(sim.inventory.count("item.bar.copper")).toBe(0);
  });

  it("walking away interrupts crafting and closes the sheet", () => {
    const sim = new GameSimulation(makeCampRegion(), 21);
    sim.inventory.add("item.ore.copper", 10);
    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.copper_bar" });
    runUntil(sim, (e) => e.type === "actionStarted");
    sim.enqueue({ type: "moveTo", cell: { x: 1, z: 1 } });
    const events = runUntil(sim, (e) => e.type === "workstationClosed", 100);
    expect(
      events.some((e) => e.type === "actionEnded" && (e.state === "cancelled" || e.state === "interrupted")),
    ).toBe(true);
    expect(sim.inventory.count("item.ore.copper")).toBe(10); // no partial consumption
  });
});
