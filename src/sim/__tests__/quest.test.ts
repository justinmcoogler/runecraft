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
  it("plays start to finish: talk -> gather 2 logs -> hand them in -> rewards", () => {
    const sim = questSim();

    // Talk to the NPC: quest starts; the hand-back is the only step left.
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    expect(sim.quests.states[QUEST].status).toBe("active");
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("hand");

    // Chop until two logs sit in the pack — the hand-in reads the pack directly,
    // so it doesn't matter how or when they were gathered.
    const xpBefore = sim.skills.xp["skill.woodcutting"];
    sim.enqueue({ type: "interact", targetId: TREE });
    for (let i = 0; i < 6000 && sim.inventory.count("item.log.basic") < 2; i++) sim.tick();
    expect(sim.inventory.count("item.log.basic")).toBeGreaterThanOrEqual(2);

    // Return to the master: the logs leave the pack and the reward lands.
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questCompleted");
    expect(sim.skills.xp["skill.woodcutting"]).toBeGreaterThanOrEqual(xpBefore + 40);
    expect(sim.quests.states[QUEST].status).toBe("completed");
    expect(sim.quests.markFor(NPC)).toBeNull();
  });

  it("the hand-in won't complete until the goods are actually in the pack", () => {
    const sim = questSim();
    sim.enqueue({ type: "interact", targetId: NPC });
    runUntil(sim, (e) => e.type === "questStarted");
    // Talk again with an empty pack: the deliver can't be satisfied yet.
    sim.quests.process([{ type: "npcChat", instanceId: NPC, name: "Alda" } as SimEvent]);
    expect(sim.quests.states[QUEST].status).toBe("active");
    expect(sim.quests.activeObjective(QUEST)?.id).toBe("hand");
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
