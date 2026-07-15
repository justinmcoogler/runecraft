import { beforeEach, describe, expect, it } from "vitest";
import { GameSimulation } from "../../sim/simulation";
import { makeTestRegion } from "../../sim/__tests__/testRegion";
import {
  clearEndlessSave,
  deleteEndlessWorld,
  listEndlessWorlds,
  clearSave,
  loadEndlessFromStorage,
  loadFromStorage,
  peekEndlessSeed,
  saveEndlessToStorage,
  saveToStorage,
  serialize,
} from "../save";

const TREE = "test.tree.001";
const CHEST = "test.chest.001";

describe("save/load", () => {
  beforeEach(() => clearSave());

  it("round-trips player, skills, inventory, equipment, chest, and node state", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.skills.grantXp("skill.woodcutting", 777);
    sim.inventory.add("item.log.basic", 33);
    sim.equippedTool = null;
    sim.containers.get(CHEST)!.add("item.log.basic", 9);
    const node = sim.nodes.get(TREE)!;
    node.phase = "depleted";
    node.remaining = 0;
    node.respawnRemainingS = 12.5;
    sim.movement.setCellPosition({ x: 7, z: 3 });

    expect(saveToStorage(sim)).toBe(true);

    const restored = new GameSimulation(makeTestRegion(), 99);
    expect(loadFromStorage(restored)).toBe(true);

    expect(restored.skills.xp["skill.woodcutting"]).toBe(777);
    expect(restored.inventory.count("item.log.basic")).toBe(33);
    expect(restored.equippedTool).toBeNull();
    expect(restored.containers.get(CHEST)!.count("item.log.basic")).toBe(9);
    const restoredNode = restored.nodes.get(TREE)!;
    expect(restoredNode.phase).toBe("depleted");
    expect(restoredNode.respawnRemainingS).toBe(12.5);
    expect(restored.movement.currentCell()).toEqual({ x: 7, z: 3 });
  });

  it("respawn timers resume from saved remaining seconds (offline time is paused)", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    const node = sim.nodes.get(TREE)!;
    node.phase = "depleted";
    node.remaining = 0;
    node.respawnRemainingS = 0.3;
    saveToStorage(sim);

    const restored = new GameSimulation(makeTestRegion(), 1);
    loadFromStorage(restored);
    // 0.3s = 3 ticks at 10 Hz.
    let respawned = false;
    for (let i = 0; i < 5; i++) {
      if (restored.tick().some((e) => e.type === "nodeRespawned")) respawned = true;
    }
    expect(respawned).toBe(true);
  });

  it("recovers from a corrupt primary save via the backup", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.skills.grantXp("skill.woodcutting", 100);
    saveToStorage(sim); // creates primary
    sim.skills.grantXp("skill.woodcutting", 100);
    saveToStorage(sim); // rotates first save into backup
    localStorage.setItem("stoneleaf.save.slot0", "{not json!!");

    const restored = new GameSimulation(makeTestRegion(), 1);
    expect(loadFromStorage(restored)).toBe(true);
    expect(restored.skills.xp["skill.woodcutting"]).toBe(100); // backup content
  });

  it("refuses unknown future save versions", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    const data = serialize(sim) as unknown as Record<string, unknown>;
    data["save_format_version"] = 999;
    localStorage.setItem("stoneleaf.save.slot0", JSON.stringify(data));
    const restored = new GameSimulation(makeTestRegion(), 1);
    expect(loadFromStorage(restored)).toBe(false);
  });

  it("returns false with no save present", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    expect(loadFromStorage(sim)).toBe(false);
  });
});

describe("seed-item reconciliation", () => {
  beforeEach(() => clearSave());

  const regionWithSeededChest = () => {
    const region = makeTestRegion();
    region.objects[0].initialItems = [{ itemId: "tool.pickaxe.basic", qty: 1 }];
    return region;
  };

  it("re-grants chest seed items missing from an older save", () => {
    // Save made before the chest had seed items (simulates an old save).
    const oldSim = new GameSimulation(makeTestRegion(), 42);
    saveToStorage(oldSim);

    const sim = new GameSimulation(regionWithSeededChest(), 42);
    expect(loadFromStorage(sim)).toBe(true);
    expect(sim.containers.get(CHEST)!.count("tool.pickaxe.basic")).toBe(1);
  });

  it("does not duplicate a seed item the player already withdrew", () => {
    const before = new GameSimulation(regionWithSeededChest(), 42);
    // Player took the pickaxe out of the chest.
    before.containers.get(CHEST)!.removeFromSlot(0, 1);
    before.inventory.add("tool.pickaxe.basic", 1);
    saveToStorage(before);

    const sim = new GameSimulation(regionWithSeededChest(), 42);
    expect(loadFromStorage(sim)).toBe(true);
    expect(sim.inventory.count("tool.pickaxe.basic")).toBe(1);
    expect(sim.containers.get(CHEST)!.count("tool.pickaxe.basic")).toBe(0);
  });
});

describe("endless save/load", () => {
  beforeEach(() => clearEndlessSave());

  it("round-trips seed, player, time, skills and inventory", () => {
    const sim = GameSimulation.createEndless(4242);
    sim.skills.grantXp("skill.mining", 500);
    sim.inventory.add("item.ore.iron", 7);
    sim.timeS = 999;
    sim.movement.setCellPosition(sim.world.region.spawn);

    expect(saveEndlessToStorage(sim)).toBe(true);
    expect(peekEndlessSeed()).toBe(4242);

    // Fresh world of the same seed restores the player's state.
    const restored = GameSimulation.createEndless(4242);
    expect(loadEndlessFromStorage(restored)).toBe(true);
    expect(restored.skills.xp["skill.mining"]).toBe(500);
    expect(restored.inventory.count("item.ore.iron")).toBe(7);
    expect(restored.timeS).toBe(999);
  });

  it("refuses to restore onto a different seed", () => {
    const sim = GameSimulation.createEndless(1);
    saveEndlessToStorage(sim);
    const other = GameSimulation.createEndless(2);
    expect(loadEndlessFromStorage(other)).toBe(false);
  });

  it("keeps several worlds and lists them newest-first", () => {
    localStorage.clear();
    for (const s of [11, 22, 33]) {
      const sim = GameSimulation.createEndless(s);
      sim.timeS = s * 1200; // day s+1
      saveEndlessToStorage(sim);
    }
    const worlds = listEndlessWorlds();
    expect(worlds.map((w) => w.seed).sort()).toEqual([11, 22, 33]);
    // Newest write (seed 33) is first; day is derived from timeS.
    expect(worlds[0].seed).toBe(33);
    expect(worlds.find((w) => w.seed === 22)!.day).toBe(23);

    // Each world restores independently, not just the last-played one.
    const w11 = GameSimulation.createEndless(11);
    expect(loadEndlessFromStorage(w11)).toBe(true);
    expect(w11.timeS).toBe(11 * 1200);
  });

  it("deletes one world without touching the others", () => {
    localStorage.clear();
    for (const s of [5, 6]) saveEndlessToStorage(GameSimulation.createEndless(s));
    deleteEndlessWorld(5);
    const seeds = listEndlessWorlds().map((w) => w.seed);
    expect(seeds).toContain(6);
    expect(seeds).not.toContain(5);
    expect(loadEndlessFromStorage(GameSimulation.createEndless(5))).toBe(false);
  });
});

describe("legacy combat migration", () => {
  it("maps old skill.combat XP into both Attack and Defense", () => {
    clearSave();
    const sim = new GameSimulation(makeTestRegion(), 42);
    saveToStorage(sim);
    // Inject a pre-split save shape: skill.combat with XP.
    const raw = JSON.parse(localStorage.getItem("stoneleaf.save.slot0")!);
    raw.skills["skill.combat"] = 777;
    delete raw.skills["skill.attack"];
    delete raw.skills["skill.defense"];
    localStorage.setItem("stoneleaf.save.slot0", JSON.stringify(raw));

    const restored = new GameSimulation(makeTestRegion(), 1);
    expect(loadFromStorage(restored)).toBe(true);
    expect(restored.skills.xp["skill.attack"]).toBe(777);
    expect(restored.skills.xp["skill.defense"]).toBe(777);
    clearSave();
  });
});
