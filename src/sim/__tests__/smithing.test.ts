// Smelting levels (furnace) and smithing at the anvil (hammer required).

import { describe, expect, it } from "vitest";
import { xpToReachLevel, CURVES } from "../../content/content";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

const FURNACE = "t.furnace";
const ANVIL = "t.anvil";
const TIN_ROCK = "t.tinrock";
const COAL_ROCK = "t.coalseam";

function makeForgeRegion(): RegionSpec {
  const width = 12;
  const depth = 12;
  return {
    id: "region.forge_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [
      { instanceId: TIN_ROCK, defId: "resource.rock.tin", cell: { x: 9, z: 3 } },
      { instanceId: COAL_ROCK, defId: "resource.rock.coal", cell: { x: 9, z: 7 } },
    ],
    objects: [
      { instanceId: FURNACE, defId: "object.furnace.basic", cell: { x: 5, z: 5 } },
      { instanceId: ANVIL, defId: "object.anvil.basic", cell: { x: 7, z: 5 } },
    ],
    npcs: [],
    spawn: { x: 2, z: 2 },
  };
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 4000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

const levelXp = (level: number) => xpToReachLevel(CURVES["curve.standard"], level);

describe("smelting levels at the furnace", () => {
  it("furnace work trains Smelting, not Smithing", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.ore.copper", 2);
    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.copper_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.skills.xp["skill.smelting"]).toBe(30);
    expect(sim.skills.xp["skill.smithing"]).toBe(0);
  });

  it("gates tin bars behind Smelting 2 and bronze behind Smelting 3", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.ore.tin", 2);
    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");

    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.tin_bar" });
    let events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);

    sim.skills.xp["skill.smelting"] = levelXp(2);
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.tin_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.bar.tin")).toBe(1);

    // Bronze needs level 3 plus one bar of each metal.
    sim.inventory.add("item.bar.copper", 1);
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.bronze_bar" });
    events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);

    sim.skills.xp["skill.smelting"] = levelXp(3);
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.bronze_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.bar.bronze")).toBe(1);
    expect(sim.inventory.count("item.bar.tin")).toBe(0);
    expect(sim.inventory.count("item.bar.copper")).toBe(0);
  });
});

describe("smithing at the anvil", () => {
  it("forging requires a smithing hammer", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.bar.copper", 2);
    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.copper_sword" });
    const events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "missing_tool")).toBe(true);
  });

  it("forges a copper sword with a hammer and trains Smithing", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.bar.copper", 2);
    sim.inventory.add("tool.hammer.basic", 1);
    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.copper_sword" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("tool.sword.copper")).toBe(1);
    expect(sim.inventory.count("item.bar.copper")).toBe(0);
    expect(sim.skills.xp["skill.smithing"]).toBe(40);
    expect(sim.skills.xp["skill.smelting"]).toBe(0);
  });

  it("copper axe and pickaxe unlock at Smithing 2; bronze sword at 4", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.bar.copper", 2);
    sim.inventory.add("tool.hammer.basic", 1);
    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");

    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.copper_pickaxe" });
    const rejected = [sim.tick(), sim.tick()].flat();
    expect(rejected.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);

    sim.skills.xp["skill.smithing"] = levelXp(2);
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.copper_pickaxe" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("tool.pickaxe.copper")).toBe(1);

    sim.inventory.add("item.bar.bronze", 2);
    sim.skills.xp["skill.smithing"] = levelXp(4);
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.bronze_sword" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("tool.sword.bronze")).toBe(1);
  });
});

describe("gold and diamond smithing", () => {
  it("smelts gold with coal, rings it, and edges a sword in diamond", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("item.ore.gold", 6);
    sim.inventory.add("item.ore.coal", 3);
    sim.inventory.add("tool.hammer.basic", 1);
    sim.inventory.add("item.bar.iron", 2);
    sim.inventory.add("item.gem.diamond", 2);
    sim.skills.xp["skill.smelting"] = levelXp(35);
    sim.skills.xp["skill.smithing"] = levelXp(50);

    sim.enqueue({ type: "interact", targetId: FURNACE });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: FURNACE, recipeId: "recipe.gold_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.bar.gold")).toBeGreaterThanOrEqual(1);

    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.gold_ring" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.ring.gold")).toBeGreaterThanOrEqual(1);

    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.diamond_sword" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("tool.sword.diamond")).toBe(1);
  });
});

describe("ore level gates", () => {
  it("tin mines at level 1; coal seams need Mining 10", () => {
    const sim = new GameSimulation(makeForgeRegion(), 17);
    sim.inventory.add("tool.pickaxe.basic", 1);
    // Tin joins copper on the first rung so bronze is a level-1 craft.
    sim.enqueue({ type: "interact", targetId: TIN_ROCK });
    runUntil(sim, (e) => e.type === "itemGained" && e.itemId === "item.ore.tin");

    sim.enqueue({ type: "interact", targetId: COAL_ROCK });
    const events = [sim.tick(), sim.tick()].flat();
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);

    sim.skills.xp["skill.mining"] = levelXp(10);
    sim.enqueue({ type: "interact", targetId: COAL_ROCK });
    runUntil(sim, (e) => e.type === "itemGained" && e.itemId === "item.ore.coal");
  });
});
