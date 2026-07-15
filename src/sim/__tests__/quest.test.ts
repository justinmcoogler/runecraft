// Milestone-9 tests: the First Timber quest advances purely off sim events.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import { makeTestRegion } from "./testRegion";
import { clearSave, loadFromStorage, saveToStorage } from "../../save/save";

const NPC = "test.npc.001";
const TREE = "test.tree.001";
const QUEST = "quest.first_timber";

// The content quest is bound to the vale NPC; retarget it at the test NPC.
function questSim(seed = 42): GameSimulation {
  const sim = new GameSimulation(makeTestRegion(true), seed);
  const def = (sim.quests as unknown as { defs: Record<string, { giverNpcId: string; objectives: Array<Record<string, unknown>> }> })
    .defs[QUEST];
  def.giverNpcId = NPC;
  for (const objective of def.objectives) {
    if (objective.npcId) objective.npcId = NPC;
  }
  return sim;
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

describe("First Timber quest", () => {
  it("plays start to finish: talk -> (axe already equipped) -> gather -> deliver -> rewards", () => {
    const sim = questSim();

    // Talk to the NPC: quest starts, talk objective completes, equipped axe auto-advances.
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.states[QUEST].status).toBe("active");
    const objective = sim.quests.activeObjective(QUEST);
    expect(objective?.id).toBe("gather");

    // Chop until 5 fresh logs are gathered (tree has 4-6; respawns if short).
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "questAdvanced" && e.label.includes("Bring"), 6000);
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("deliver");

    // Deliver: logs leave the pack, rewards arrive.
    const logsBefore = sim.inventory.count("item.log.basic");
    expect(logsBefore).toBeGreaterThanOrEqual(5);
    const xpBefore = sim.skills.xp["skill.woodcutting"];
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questCompleted");

    expect(sim.inventory.count("item.log.basic")).toBe(logsBefore - 5);
    expect(sim.inventory.count("tool.axe.copper")).toBe(1);
    expect(sim.skills.xp["skill.woodcutting"]).toBe(xpBefore + 120);
    expect(sim.quests.states[QUEST].status).toBe("completed");
    expect(sim.quests.markFor(NPC)).toBeNull();
  });

  it("gather counts only freshly gathered items, not existing stock", () => {
    const sim = questSim();
    sim.inventory.add("item.log.basic", 20); // pre-owned logs don't count
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("gather");
    expect(sim.quests.states[QUEST].progress).toBe(0);
  });

  it("marks the giver with ! when available and ? when the delivery is ready", () => {
    const sim = questSim();
    expect(sim.quests.markFor(NPC)).toBe("give");
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "questAdvanced" && e.label.includes("Bring"), 6000);
    expect(sim.quests.markFor(NPC)).toBe("ready");
  });

  it("quest state survives save/load", () => {
    clearSave();
    const sim = questSim();
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    sim.quests.states[QUEST].progress = 3;
    sim.quests.states[QUEST].objectiveIndex = 2;
    expect(saveToStorage(sim)).toBe(true);

    const restored = questSim(7);
    expect(loadFromStorage(restored)).toBe(true);
    expect(restored.quests.states[QUEST]).toEqual({
      status: "active",
      objectiveIndex: 2,
      progress: 3,
    });
    clearSave();
  });
});
