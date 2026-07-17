// Enchantments and socketed gems: different enchant types stack on one item,
// caps hold, costs are consumed, effects flow into combat maths, and the mods
// survive equip/unequip and a full save round-trip.

import { beforeEach, describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { makeTestRegion } from "./testRegion";
import { MAX_ENCHANTS, MAX_SOCKETS, aggregateMods } from "../../content/content";
import { clearSave, loadFromStorage, saveToStorage } from "../../save/save";

const SWORD = "tool.sword.copper";
const TUNIC = "armor.tunic.iron";

/** A sim standing right beside an enchanter's table, master enchanter level. */
function simAtTable(): GameSimulation {
  const region = makeTestRegion();
  region.objects.push({ instanceId: "test.ench.001", defId: "object.enchanter.basic", cell: { x: 3, z: 2 } });
  const sim = new GameSimulation(region, 42);
  sim.skills.xp["skill.enchanting"] = 5_000_000; // comfortably 99
  return sim;
}

const run = (sim: GameSimulation, cmd: Parameters<GameSimulation["enqueue"]>[0]) => {
  sim.enqueue(cmd);
  sim.tick();
};

describe("item mods: enchants + sockets", () => {
  it("different enchant types stack on one weapon; duplicates and the cap are refused", () => {
    const sim = simAtTable();
    sim.inventory.add(SWORD, 1);
    sim.inventory.add("item.relic.idol", 10);
    sim.inventory.add("item.feather", 10);
    sim.inventory.add("item.bone.old", 10);
    sim.inventory.add("item.essence.rune", 10);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);

    run(sim, { type: "enchantSlot", slot, enchId: "ench.sharpness" });
    run(sim, { type: "enchantSlot", slot, enchId: "ench.precision" });
    run(sim, { type: "enchantSlot", slot, enchId: "ench.sharpness" }); // duplicate type: refused
    run(sim, { type: "enchantSlot", slot, enchId: "ench.vampirism" });
    run(sim, { type: "enchantSlot", slot, enchId: "ench.smite" }); // over the cap: refused

    const mods = sim.inventory.slots[slot]!.mods!;
    expect(mods.ench).toEqual(["ench.sharpness", "ench.precision", "ench.vampirism"]);
    expect(mods.ench.length).toBe(MAX_ENCHANTS);
    const total = aggregateMods(mods, "weapon");
    expect(total.dmg).toBe(2);
    expect(total.acc).toBeCloseTo(0.06);
    expect(total.lifesteal).toBe(1);
  });

  it("enchanting consumes the cost and pays Enchanting XP; sockets consume the gem", () => {
    const sim = simAtTable();
    sim.inventory.add(SWORD, 1);
    sim.inventory.add("item.relic.idol", 2);
    sim.inventory.add("item.gem.ruby", 1);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    const xpBefore = sim.skills.xp["skill.enchanting"];

    run(sim, { type: "enchantSlot", slot, enchId: "ench.sharpness" });
    expect(sim.inventory.count("item.relic.idol")).toBe(1);
    expect(sim.skills.xp["skill.enchanting"]).toBe(xpBefore + 30);

    run(sim, { type: "socketSlot", slot, gemItemId: "item.gem.ruby" });
    expect(sim.inventory.count("item.gem.ruby")).toBe(0);
    expect(sim.inventory.slots[slot]!.mods!.gems).toEqual(["item.gem.ruby"]);
  });

  it("gem sockets cap at MAX_SOCKETS", () => {
    const sim = simAtTable();
    sim.inventory.add(SWORD, 1);
    sim.inventory.add("item.gem.quartz", 3);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    for (let i = 0; i < 3; i++) run(sim, { type: "socketSlot", slot, gemItemId: "item.gem.quartz" });
    expect(sim.inventory.slots[slot]!.mods!.gems.length).toBe(MAX_SOCKETS);
    expect(sim.inventory.count("item.gem.quartz")).toBe(1); // third gem was not eaten
  });

  it("enchanting is refused away from the table and below the required level", () => {
    const region = makeTestRegion();
    const sim = new GameSimulation(region, 42); // no enchanter anywhere
    sim.skills.xp["skill.enchanting"] = 5_000_000;
    sim.inventory.add(SWORD, 1);
    sim.inventory.add("item.relic.idol", 5);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    run(sim, { type: "enchantSlot", slot, enchId: "ench.sharpness" });
    expect(sim.inventory.slots[slot]!.mods).toBeUndefined();

    const atTable = simAtTable();
    atTable.skills.xp["skill.enchanting"] = 0; // level 1: Smite needs 35
    atTable.inventory.add(SWORD, 1);
    atTable.inventory.add("item.relic.idol", 5);
    atTable.inventory.add("item.essence.rune", 5);
    const s2 = atTable.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    run(atTable, { type: "enchantSlot", slot: s2, enchId: "ench.smite" });
    expect(atTable.inventory.slots[s2]!.mods).toBeUndefined();
  });

  it("mods ride equip/unequip and feed weapon damage, ward, and max HP", () => {
    const sim = simAtTable();
    sim.inventory.add(SWORD, 1);
    sim.inventory.add(TUNIC, 1);
    sim.inventory.add("item.relic.idol", 5);
    sim.inventory.add("item.herb.sage", 5);
    const sword = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    const tunic = sim.inventory.slots.findIndex((s) => s?.itemId === TUNIC);
    run(sim, { type: "enchantSlot", slot: sword, enchId: "ench.sharpness" });
    run(sim, { type: "enchantSlot", slot: tunic, enchId: "ench.warding" });
    run(sim, { type: "enchantSlot", slot: tunic, enchId: "ench.vigor" });

    const baseMax = sim.maxHp();
    run(sim, { type: "equipSlot", slot: sword });
    run(sim, { type: "equipSlot", slot: sim.inventory.slots.findIndex((s) => s?.itemId === TUNIC) });
    expect(sim.equippedTool).toBe(SWORD);
    expect(aggregateMods(sim.equippedToolMods, "weapon").dmg).toBe(2);
    expect(sim.armorWardBonus()).toBeCloseTo(0.04);
    expect(sim.maxHp()).toBe(baseMax + 6);

    // Coming back off, the mods return to the pack intact.
    run(sim, { type: "unequip" });
    run(sim, { type: "unequipArmor", slot: "body" });
    expect(sim.equippedToolMods).toBeNull();
    expect(sim.maxHp()).toBe(baseMax);
    const backSword = sim.inventory.slots.find((s) => s?.itemId === SWORD)!;
    const backTunic = sim.inventory.slots.find((s) => s?.itemId === TUNIC)!;
    expect(backSword.mods!.ench).toEqual(["ench.sharpness"]);
    expect(backTunic.mods!.ench).toEqual(["ench.warding", "ench.vigor"]);
  });

  it("mods survive a save round-trip, in the pack and on equipped gear", () => {
    clearSave();
    const sim = simAtTable();
    sim.inventory.add(SWORD, 1);
    sim.inventory.add(TUNIC, 1);
    sim.inventory.add("item.relic.idol", 5);
    sim.inventory.add("item.gem.ruby", 1);
    const sword = sim.inventory.slots.findIndex((s) => s?.itemId === SWORD);
    const tunic = sim.inventory.slots.findIndex((s) => s?.itemId === TUNIC);
    run(sim, { type: "enchantSlot", slot: sword, enchId: "ench.sharpness" });
    run(sim, { type: "socketSlot", slot: sword, gemItemId: "item.gem.ruby" });
    run(sim, { type: "enchantSlot", slot: tunic, enchId: "ench.warding" });
    run(sim, { type: "equipSlot", slot: tunic }); // armor worn, sword left in pack
    expect(saveToStorage(sim)).toBe(true);

    const restored = new GameSimulation(makeTestRegion(), 7);
    expect(loadFromStorage(restored)).toBe(true);
    const savedSword = restored.inventory.slots.find((s) => s?.itemId === SWORD)!;
    expect(savedSword.mods!.ench).toEqual(["ench.sharpness"]);
    expect(savedSword.mods!.gems).toEqual(["item.gem.ruby"]);
    expect(restored.equippedArmor.body).toBe(TUNIC);
    expect(restored.equippedArmorMods.body!.ench).toEqual(["ench.warding"]);
    expect(restored.armorWardBonus()).toBeCloseTo(0.04);
  });
});
