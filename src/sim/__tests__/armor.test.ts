// Armor: equip/unequip through commands, damage soaked by worn protection
// (never below 1), smithing the armor ladder at the anvil, and persistence.

import { describe, expect, it } from "vitest";
import { ENEMIES, ITEMS } from "../../content/content";
import { applySharedState, captureSharedState, clearSave, loadFromStorage, saveToStorage } from "../../save/save";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { BlockType, RegionSpec } from "../world";
import { makeTestRegion } from "./testRegion";

const ANVIL = "t.anvil";

function makeForgeRegion(): RegionSpec {
  const width = 8;
  const depth = 8;
  return {
    id: "region.forge_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [{ instanceId: ANVIL, defId: "object.anvil.basic", cell: { x: 4, z: 4 } }],
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

function slotOf(sim: GameSimulation, itemId: string): number {
  return sim.inventory.slots.findIndex((s) => s?.itemId === itemId);
}

describe("armor equipment", () => {
  it("equips pieces into their slots and swaps back the previous piece", () => {
    const sim = new GameSimulation(makeTestRegion(), 5);
    sim.inventory.add("armor.cap.leather", 1);
    sim.inventory.add("armor.cap.copper", 1);
    sim.enqueue({ type: "equipSlot", slot: slotOf(sim, "armor.cap.leather") });
    sim.tick();
    expect(sim.equippedArmor.head).toBe("armor.cap.leather");
    sim.enqueue({ type: "equipSlot", slot: slotOf(sim, "armor.cap.copper") });
    sim.tick();
    expect(sim.equippedArmor.head).toBe("armor.cap.copper");
    expect(sim.inventory.count("armor.cap.leather")).toBe(1); // swapped back
    sim.enqueue({ type: "unequipArmor", slot: "head" });
    sim.tick();
    expect(sim.equippedArmor.head).toBeNull();
    expect(sim.inventory.count("armor.cap.copper")).toBe(1);
  });

  it("armor soaks damage by its summed protection, but a hit always costs at least 1", () => {
    const sim = new GameSimulation(makeTestRegion(), 5);
    sim.equippedArmor = {
      head: "armor.cap.bronze",
      body: "armor.tunic.bronze",
      legs: "armor.leggings.bronze",
    };
    expect(sim.protection()).toBeCloseTo(0.48);
    const before = sim.hp;
    sim.damagePlayer(6);
    expect(before - sim.hp).toBe(3); // round(6 * 0.52)
    const before2 = sim.hp;
    sim.damagePlayer(1);
    expect(before2 - sim.hp).toBe(1); // floor of 1
  });

  it("bare skin takes full damage", () => {
    const sim = new GameSimulation(makeTestRegion(), 5);
    const before = sim.hp;
    sim.damagePlayer(6);
    expect(before - sim.hp).toBe(6);
  });

  it("smiths a leather cap at the anvil (hides + hammer), tunic gated a level higher", () => {
    const sim = new GameSimulation(makeForgeRegion(), 9);
    sim.inventory.add("tool.hammer.basic", 1);
    sim.inventory.add("item.hide.cow", 5);

    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");

    // Tunic needs Smithing 2: rejected at level 1.
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.tunic_leather" });
    const rejected = runUntil(sim, (e) => e.type === "actionRejected");
    expect(rejected.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);

    sim.enqueue({ type: "interact", targetId: ANVIL });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: ANVIL, recipeId: "recipe.cap_leather" });
    runUntil(sim, (e) => e.type === "itemGained" && e.itemId === "armor.cap.leather");
    expect(sim.inventory.count("armor.cap.leather")).toBeGreaterThan(0);
    expect(sim.inventory.count("item.hide.cow")).toBeLessThan(5);
  });

  it("worn armor persists through saves and region transfers", () => {
    clearSave();
    const sim = new GameSimulation(makeTestRegion(), 5);
    sim.equippedArmor.body = "armor.tunic.copper";
    saveToStorage(sim, {});
    const restored = new GameSimulation(makeTestRegion(), 6);
    expect(loadFromStorage(restored, {})).toBe(true);
    expect(restored.equippedArmor.body).toBe("armor.tunic.copper");

    const shared = captureSharedState(restored);
    const other = new GameSimulation(makeTestRegion(), 7);
    applySharedState(other, shared);
    expect(other.equippedArmor.body).toBe("armor.tunic.copper");
    clearSave();
  });
});

describe("livestock drops", () => {
  it("cows drop beef and hides, pigs drop pork; cooked meats out-heal fish", () => {
    const cowLoot = ENEMIES["enemy.cow"].loot.map((l) => l.itemId);
    expect(cowLoot).toContain("item.beef.raw");
    expect(cowLoot).toContain("item.hide.cow");
    const pigLoot = ENEMIES["enemy.pig"].loot.map((l) => l.itemId);
    expect(pigLoot).toContain("item.pork.raw");
    expect(ITEMS["item.beef.cooked"].healAmount!).toBeGreaterThan(
      ITEMS["item.pork.cooked"].healAmount!,
    );
    expect(ITEMS["item.pork.cooked"].healAmount!).toBeGreaterThan(
      ITEMS["item.fish.cooked"].healAmount!,
    );
    expect(ITEMS["item.beef.raw"].healAmount).toBeUndefined();
    expect(ITEMS["item.pork.raw"].healAmount).toBeUndefined();
  });

  it("dungeon spiders are aggressive; the vale's livestock is not", () => {
    expect(ENEMIES["enemy.spider"].aggroRadiusCells).toBeGreaterThan(0);
    expect(ENEMIES["enemy.cow"].aggroRadiusCells).toBe(0);
    expect(ENEMIES["enemy.pig"].aggroRadiusCells).toBe(0);
  });
});
