// Strength (melee damage), Prayer (bury bones), Fletching + Runecrafting
// (workstation recipes), and Magic (alchemy) — the RuneScape skills we added.

import { describe, expect, it } from "vitest";
import { CURVES, ENEMIES, SKILLS, xpToReachLevel } from "../../content/content";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { BlockType, RegionSpec } from "../world";

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 4000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error("condition not met");
}

function makeStationRegion(): RegionSpec {
  const width = 10, depth = 10;
  return {
    id: "region.station_test",
    width, depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [
      { instanceId: "bench", defId: "object.workbench.basic", cell: { x: 5, z: 5 } },
      { instanceId: "altar", defId: "object.altar.rune", cell: { x: 7, z: 5 } },
      { instanceId: "obelisk", defId: "object.obelisk.summon", cell: { x: 3, z: 5 } },
    ],
    npcs: [],
    spawn: { x: 2, z: 2 },
  };
}

describe("the new skills exist", () => {
  it("registers all ten added RuneScape skills", () => {
    for (const id of [
      "skill.strength", "skill.prayer", "skill.fletching", "skill.runecrafting", "skill.magic",
      "skill.constitution", "skill.dungeoneering", "skill.summoning", "skill.necromancy", "skill.invention",
    ]) {
      expect(SKILLS[id], `${id} missing`).toBeTruthy();
    }
  });
});

describe("Constitution", () => {
  it("raises max HP as it levels", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    const base = sim.maxHp();
    sim.skills.grantXp("skill.constitution", 5000); // several levels
    expect(sim.maxHp()).toBeGreaterThan(base);
  });

  it("trains off damage dealt in combat", () => {
    const region = makeStationRegion();
    region.enemies = [{ instanceId: "foe", defId: "enemy.target_dummy", cell: { x: 3, z: 2 } }];
    const sim = new GameSimulation(region, 3);
    sim.enqueue({ type: "interact", targetId: "foe" });
    runUntil(sim, (e) => e.type === "playerAttack" && (e as { damage: number | null }).damage != null);
    expect(sim.skills.xp["skill.constitution"]).toBeGreaterThan(0);
  });
});

describe("Dungeoneering & Necromancy", () => {
  it("felling a dungeon boss trains Dungeoneering", () => {
    const region = makeStationRegion();
    region.enemies = [{ instanceId: "crawl.boss", defId: "enemy.target_dummy", cell: { x: 3, z: 2 } }];
    const sim = new GameSimulation(region, 3);
    sim.skills.grantXp("skill.strength", 40000); // hit hard so it dies quickly
    sim.enqueue({ type: "interact", targetId: "crawl.boss" });
    runUntil(sim, (e) => e.type === "playerAttack" && (e as { killed?: boolean }).killed === true);
    expect(sim.skills.xp["skill.dungeoneering"]).toBeGreaterThan(0);
  });

  it("putting down the undead trains Necromancy", () => {
    const region = makeStationRegion();
    region.enemies = [{ instanceId: "bones", defId: "enemy.skeleton", cell: { x: 3, z: 2 } }];
    const sim = new GameSimulation(region, 3);
    // A well-armed, hardy fighter: fells the skeleton fast and survives it.
    sim.skills.grantXp("skill.attack", 60000);
    sim.skills.grantXp("skill.strength", 60000);
    sim.skills.grantXp("skill.defense", 60000);
    sim.inventory.add("tool.sword.netherite", 1);
    sim.enqueue({ type: "equipSlot", slot: sim.inventory.slots.findIndex((s) => s?.itemId === "tool.sword.netherite") });
    sim.tick();
    sim.enqueue({ type: "interact", targetId: "bones" });
    runUntil(sim, (e) => e.type === "playerAttack" && (e as { killed?: boolean }).killed === true);
    expect(sim.skills.xp["skill.necromancy"]).toBeGreaterThan(0);
  });
});

describe("Summoning", () => {
  it("binds a familiar pouch at the obelisk", () => {
    const sim = new GameSimulation(makeStationRegion(), 5);
    sim.inventory.add("item.charm.bone", 1);
    sim.inventory.add("item.essence.rune", 3);
    sim.enqueue({ type: "interact", targetId: "obelisk" });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: "obelisk", recipeId: "recipe.pouch_wolf" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.pouch.wolf")).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.summoning"]).toBeGreaterThan(0);
  });
});

describe("Invention", () => {
  it("salvages a bar into parts at the workbench", () => {
    const sim = new GameSimulation(makeStationRegion(), 5);
    sim.inventory.add("item.bar.iron", 2);
    sim.enqueue({ type: "interact", targetId: "bench" });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: "bench", recipeId: "recipe.salvage_bar" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.component.parts")).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.invention"]).toBeGreaterThan(0);
  });
});

describe("Strength", () => {
  const fightUntilHit = (sim: GameSimulation) => {
    sim.enqueue({ type: "interact", targetId: "foe" });
    runUntil(sim, (e) => e.type === "playerAttack" && "damage" in e && (e as { damage: number | null }).damage != null);
  };
  const dummyRegion = () => {
    const region = makeStationRegion();
    region.enemies = [{ instanceId: "foe", defId: "enemy.target_dummy", cell: { x: 3, z: 2 } }];
    return region;
  };

  it("the Accurate style trains Attack, not Strength (RuneScape-style)", () => {
    const sim = new GameSimulation(dummyRegion(), 3);
    sim.attackStyle = "accurate";
    fightUntilHit(sim);
    expect(sim.skills.xp["skill.attack"]).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.strength"] ?? 0).toBe(0);
  });

  it("switching to the Aggressive style trains Strength instead", () => {
    const sim = new GameSimulation(dummyRegion(), 3);
    sim.attackStyle = "aggressive";
    fightUntilHit(sim);
    expect(sim.skills.xp["skill.strength"]).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.attack"] ?? 0).toBe(0);
  });
});

describe("Prayer", () => {
  it("burying bones grants Prayer XP and consumes them", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.inventory.add("item.bone.old", 2);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.bone.old");
    sim.enqueue({ type: "burySlot", slot });
    sim.tick();
    expect(sim.skills.xp["skill.prayer"]).toBeGreaterThan(0);
    expect(sim.inventory.count("item.bone.old")).toBe(1);
  });

  it("drops bones off animals too, feeding Prayer from the pasture", () => {
    for (const id of ["enemy.cow", "enemy.pig", "enemy.chicken", "enemy.sheep", "enemy.boar"]) {
      expect(ENEMIES[id].loot.some((l) => l.itemId === "item.bone.old"), `${id} drops no bones`).toBe(true);
    }
  });

  it("won't bury big bones below the required Prayer level", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.inventory.add("item.bone.big", 1); // needs Prayer 20
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.bone.big");
    sim.enqueue({ type: "burySlot", slot });
    sim.tick();
    expect(sim.skills.xp["skill.prayer"] ?? 0).toBe(0);
    expect(sim.inventory.count("item.bone.big")).toBe(1);
  });
});

describe("Runecrafting", () => {
  it("binds essence into runes at the altar", () => {
    const sim = new GameSimulation(makeStationRegion(), 5);
    sim.inventory.add("item.essence.rune", 5);
    sim.enqueue({ type: "interact", targetId: "altar" });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: "altar", recipeId: "recipe.rune_air" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.rune.air")).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.runecrafting"]).toBeGreaterThan(0);
  });
});

describe("Fletching", () => {
  it("carves arrow shafts from a log at the workbench", () => {
    const sim = new GameSimulation(makeStationRegion(), 5);
    sim.inventory.add("item.log.basic", 2);
    sim.enqueue({ type: "interact", targetId: "bench" });
    runUntil(sim, (e) => e.type === "workstationOpened");
    sim.enqueue({ type: "craft", stationId: "bench", recipeId: "recipe.fletch_shafts" });
    runUntil(sim, (e) => e.type === "actionEnded");
    expect(sim.inventory.count("item.arrow.shaft")).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.fletching"]).toBeGreaterThan(0);
  });
});

describe("Magic — alchemy", () => {
  it("low alchemy turns a bar to coins, burning a fire rune", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.inventory.add("item.bar.gold", 1);
    sim.inventory.add("item.rune.fire", 1);
    const before = sim.inventory.count("item.coin");
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.bar.gold");
    sim.enqueue({ type: "alchSlot", slot, tier: "low" });
    sim.tick();
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(before);
    expect(sim.inventory.count("item.rune.fire")).toBe(0);
    expect(sim.inventory.count("item.bar.gold")).toBe(0);
    expect(sim.skills.xp["skill.magic"]).toBeGreaterThan(0);
  });

  it("won't cast without a rune", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.inventory.add("item.bar.gold", 1);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.bar.gold");
    sim.enqueue({ type: "alchSlot", slot, tier: "low" });
    sim.tick();
    expect(sim.skills.xp["skill.magic"] ?? 0).toBe(0);
    expect(sim.inventory.count("item.bar.gold")).toBe(1);
  });

  it("grand alchemy pays the richest return, burning a law rune", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.skills.grantXp("skill.magic", xpToReachLevel(CURVES["curve.standard"], 44));
    sim.inventory.add("item.bar.gold", 1);
    sim.inventory.add("item.rune.law", 1);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.bar.gold");
    sim.enqueue({ type: "alchSlot", slot, tier: "grand" });
    sim.tick();
    // Grand factor is 1.5 vs gold's ALCH value 60 -> 90 coins.
    expect(sim.inventory.count("item.coin")).toBe(90);
    expect(sim.inventory.count("item.rune.law")).toBe(0);
  });

  it("superheat smelts an ore to a bar, training Magic and Smelting", () => {
    const sim = new GameSimulation(makeStationRegion(), 1);
    sim.skills.grantXp("skill.magic", xpToReachLevel(CURVES["curve.standard"], 35));
    // Superheat matches the furnace's 2-ore cost — its edge is castability.
    sim.inventory.add("item.ore.iron", 2);
    sim.inventory.add("item.rune.fire", 1);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.ore.iron");
    sim.enqueue({ type: "superheatSlot", slot });
    sim.tick();
    expect(sim.inventory.count("item.bar.iron")).toBe(1);
    expect(sim.inventory.count("item.ore.iron")).toBe(0);
    expect(sim.inventory.count("item.rune.fire")).toBe(0);
    expect(sim.skills.xp["skill.magic"]).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.smelting"]).toBeGreaterThan(0);
  });
});
