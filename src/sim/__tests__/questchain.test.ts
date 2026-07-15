// Quest chain: prerequisites gate later quests; slay objectives count kills.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

const NPC = "t.alder";
const GNASHER = "t.gnasher";

function makeChainRegion(): RegionSpec {
  const width = 12;
  const depth = 12;
  return {
    id: "region.chain_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [{ instanceId: NPC, name: "Old Alder", cell: { x: 8, z: 2 }, wanderRadius: 1 }],
    enemies: [{ instanceId: GNASHER, defId: "enemy.old_gnasher", cell: { x: 8, z: 8 } }],
    spawn: { x: 2, z: 2 },
  };
}

// Retarget the vale quests at the test NPC.
function chainSim(seed = 42): GameSimulation {
  const sim = new GameSimulation(makeChainRegion(), seed);
  const defs = (sim.quests as unknown as {
    defs: Record<string, { giverNpcId: string; objectives: Array<Record<string, unknown>> }>;
  }).defs;
  for (const def of Object.values(defs)) {
    def.giverNpcId = NPC;
    for (const objective of def.objectives) {
      if (objective.npcId) objective.npcId = NPC;
    }
  }
  return sim;
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 8000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("quest chain gating", () => {
  it("later quests stay hidden until their prerequisite completes", () => {
    const sim = chainSim();
    expect(sim.quests.isAvailable("quest.first_timber")).toBe(true);
    expect(sim.quests.isAvailable("quest.tin_and_temper")).toBe(false);
    expect(sim.quests.isAvailable("quest.the_gnasher")).toBe(false);

    // Talking starts only First Timber.
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.states["quest.first_timber"].status).toBe("active");
    expect(sim.quests.states["quest.tin_and_temper"].status).toBe("available");
    expect(sim.quests.isAvailable("quest.tin_and_temper")).toBe(false);
  });

  it("completing First Timber unlocks Tin and Temper (marker returns)", () => {
    const sim = chainSim();
    sim.quests.states["quest.first_timber"].status = "completed";
    expect(sim.quests.isAvailable("quest.tin_and_temper")).toBe(true);
    expect(sim.quests.markFor(NPC)).toBe("give");
  });
});

describe("Tin and Temper", () => {
  it("counts mined tin and the smelted bronze bar, then trades the bar for rewards", () => {
    const sim = chainSim();
    sim.quests.states["quest.first_timber"].status = "completed";
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted" && e.questId === "quest.tin_and_temper");
    expect(sim.quests.activeObjective("quest.tin_and_temper")?.id).toBe("tin");

    // Gather objectives advance off itemGained events (mining or smelting both emit them).
    sim.quests.process([{ type: "itemGained", itemId: "item.ore.tin", qty: 2 }]);
    expect(sim.quests.activeObjective("quest.tin_and_temper")?.id).toBe("bronze");
    sim.quests.process([{ type: "itemGained", itemId: "item.bar.bronze", qty: 1 }]);
    expect(sim.quests.activeObjective("quest.tin_and_temper")?.id).toBe("deliver");

    sim.inventory.add("item.bar.bronze", 1);
    const smeltXpBefore = sim.skills.xp["skill.smelting"];
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questCompleted" && e.questId === "quest.tin_and_temper");
    expect(sim.inventory.count("item.bar.bronze")).toBe(2); // 1 delivered, 2 rewarded
    expect(sim.skills.xp["skill.smelting"]).toBe(smeltXpBefore + 150);
  });
});

describe("The Gnasher Below", () => {
  it("equip auto-advance, slay counting, and the Emberstone hand-back", () => {
    const sim = chainSim();
    sim.quests.states["quest.first_timber"].status = "completed";
    sim.quests.states["quest.tin_and_temper"].status = "completed";

    // A weapon is already equipped when the quest starts: the arm step self-completes.
    sim.equippedTool = "tool.sword.bronze";
    sim.skills.xp["skill.attack"] = 10000; // seasoned fighter for a quick test kill
    sim.skills.xp["skill.defense"] = 10000; // sturdy enough to survive the boss
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted" && e.questId === "quest.the_gnasher");
    expect(sim.quests.activeObjective("quest.the_gnasher")?.id).toBe("slay");

    sim.enqueue({ type: "interact", targetId: GNASHER });
    runUntil(sim, (e) => e.type === "enemyDied" && e.instanceId === GNASHER, 12000);
    expect(sim.quests.activeObjective("quest.the_gnasher")?.id).toBe("proof");
    expect(sim.inventory.count("item.gem.emberstone")).toBe(1); // boss loot

    const attackXpBefore = sim.skills.xp["skill.attack"];
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questCompleted" && e.questId === "quest.the_gnasher");
    expect(sim.inventory.count("item.gem.emberstone")).toBe(1); // taken, then returned
    expect(sim.inventory.count("item.fish.cooked")).toBe(5);
    expect(sim.skills.xp["skill.attack"]).toBe(attackXpBefore + 300);
    expect(sim.quests.markFor(NPC)).toBeNull(); // chain finished
  });
});
