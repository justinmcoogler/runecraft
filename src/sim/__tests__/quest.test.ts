// The quest engine, exercised through the Woodcutter lesson on Tutor's Trail:
// it advances purely off sim events (talk -> gather -> reward) and survives a
// save/load round-trip.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import { makeTestRegion } from "./testRegion";
import { clearSave, loadFromStorage, saveToStorage } from "../../save/save";

const NPC = "test.npc.001";
const TREE = "test.tree.001";
const QUEST = "quest.tut_woodcutting";

// The content quest is bound to a trail master; retarget it at the test NPC and
// satisfy its prerequisite (the welcome quest) so it can be offered.
function questSim(seed = 42): GameSimulation {
  const sim = new GameSimulation(makeTestRegion(true), seed);
  const def = (sim.quests as unknown as { defs: Record<string, { giverNpcId: string; objectives: Array<Record<string, unknown>> }> })
    .defs[QUEST];
  def.giverNpcId = NPC;
  for (const objective of def.objectives) {
    if (objective.npcId) objective.npcId = NPC;
  }
  sim.quests.states["quest.tut_welcome"].status = "completed"; // clear the prereq
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

describe("Woodcutter lesson quest", () => {
  it("plays start to finish: talk -> (axe already equipped) -> gather 2 logs -> rewards", () => {
    const sim = questSim();

    // Talk to the NPC: quest starts, talk objective completes, the gather begins.
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.states[QUEST].status).toBe("active");
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("do");

    // Chop until the gather completes; that's the final objective, so the lesson
    // completes and the woodcutting reward lands.
    const xpBefore = sim.skills.xp["skill.woodcutting"];
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "questCompleted", 6000);

    // Chopping grants woodcutting XP too, so the total includes the 40-XP
    // reward plus whatever the two logs earned.
    expect(sim.skills.xp["skill.woodcutting"]).toBeGreaterThanOrEqual(xpBefore + 40);
    expect(sim.quests.states[QUEST].status).toBe("completed");
    expect(sim.quests.markFor(NPC)).toBeNull();
  });

  it("gather counts only freshly gathered items, not existing stock", () => {
    const sim = questSim();
    sim.inventory.add("item.log.basic", 20); // pre-owned logs don't count
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("do");
    expect(sim.quests.states[QUEST].progress).toBe(0);
  });

  it("marks the giver with ! while the lesson is available to start", () => {
    const sim = questSim();
    expect(sim.quests.markFor(NPC)).toBe("give");
  });

  it("quest state survives save/load", () => {
    clearSave();
    const sim = questSim();
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    sim.quests.states[QUEST].progress = 1;
    sim.quests.states[QUEST].objectiveIndex = 1;
    expect(saveToStorage(sim)).toBe(true);

    const restored = questSim(7);
    expect(loadFromStorage(restored)).toBe(true);
    expect(restored.quests.states[QUEST]).toEqual({
      status: "active",
      objectiveIndex: 1,
      progress: 1,
    });
    clearSave();
  });
});
