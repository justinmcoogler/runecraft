// Tutor's Trail unlocks one lesson at a time: each lesson is gated behind the
// previous master's, graduation behind the last, the Combat Instructor grants a
// sword on accept and counts pig kills, and finishing graduation sets the
// tutorial.graduated world flag.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";
import { TUTORIAL_ORDER } from "../../content/content";

const NPC = "t.giver";
const PIG = "t.pig";
const lessonId = (skill: string) => `quest.tut_${skill.slice("skill.".length)}`;

function makeChainRegion(): RegionSpec {
  const width = 12, depth = 12;
  return {
    id: "region.chain_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [{ instanceId: NPC, name: "Guide", cell: { x: 8, z: 2 }, wanderRadius: 0 }],
    enemies: [{ instanceId: PIG, defId: "enemy.pig", cell: { x: 8, z: 8 } }],
    spawn: { x: 2, z: 2 },
  };
}

/** Retarget every tutorial quest at the single test NPC. */
function chainSim(seed = 42): GameSimulation {
  const sim = new GameSimulation(makeChainRegion(), seed);
  const defs = (sim.quests as unknown as {
    defs: Record<string, { giverNpcId: string; objectives: Array<Record<string, unknown>> }>;
  }).defs;
  for (const def of Object.values(defs)) {
    def.giverNpcId = NPC;
    for (const objective of def.objectives) if (objective.npcId) objective.npcId = NPC;
  }
  return sim;
}

const talk = (sim: GameSimulation): void =>
  sim.quests.process([{ type: "npcChat", instanceId: NPC, name: "Guide" } as SimEvent]);

describe("Tutor's Trail sequential unlock", () => {
  it("offers each lesson only once the previous is complete", () => {
    const sim = chainSim();
    expect(sim.quests.isAvailable("quest.tut_welcome")).toBe(true);
    // No lesson and not graduation is available before its predecessor is done.
    expect(sim.quests.isAvailable(lessonId(TUTORIAL_ORDER[0]))).toBe(false);
    expect(sim.quests.isAvailable("quest.tut_graduation")).toBe(false);

    sim.quests.states["quest.tut_welcome"].status = "completed";
    expect(sim.quests.isAvailable(lessonId(TUTORIAL_ORDER[0]))).toBe(true);
    expect(sim.quests.isAvailable(lessonId(TUTORIAL_ORDER[1]))).toBe(false);

    // Walk the whole chain: each completion opens exactly the next.
    for (let i = 0; i < TUTORIAL_ORDER.length; i++) {
      expect(sim.quests.isAvailable(lessonId(TUTORIAL_ORDER[i])), TUTORIAL_ORDER[i]).toBe(true);
      sim.quests.states[lessonId(TUTORIAL_ORDER[i])].status = "completed";
    }
    // Only after the last lesson does graduation open.
    expect(sim.quests.isAvailable("quest.tut_graduation")).toBe(true);
  });
});

describe("the Combat Instructor lesson", () => {
  it("grants a sword on accept, then makes you switch attack styles", () => {
    const sim = chainSim();
    // Complete every lesson up to (not including) Attack so it's available.
    sim.quests.states["quest.tut_welcome"].status = "completed";
    for (const skill of TUTORIAL_ORDER) {
      if (skill === "skill.attack") break;
      sim.quests.states[lessonId(skill)].status = "completed";
    }
    const swordsBefore = sim.inventory.count("tool.sword.bronze");
    sim.equippedTool = "tool.sword.bronze";
    talk(sim); // accept: startItems hands over a sword
    expect(sim.inventory.count("tool.sword.bronze")).toBe(swordsBefore + 1);
    // First a hit on Accurate (Attack), then a switch to Aggressive (Strength) —
    // the two train steps can't be finished on one style, so you must switch.
    expect(sim.quests.activeObjective("quest.tut_attack")?.type).toBe("train");
    expect(sim.quests.activeObjective("quest.tut_attack")?.skillId).toBe("skill.attack");
    sim.quests.process([{ type: "xpGained", skillId: "skill.attack", amount: 4 }] as SimEvent[]);
    expect(sim.quests.activeObjective("quest.tut_attack")?.skillId).toBe("skill.strength");
    sim.quests.process([{ type: "xpGained", skillId: "skill.strength", amount: 4 }] as SimEvent[]);
    // The lesson now ends by reporting back to the instructor.
    expect(sim.quests.activeObjective("quest.tut_attack")?.id).toBe("report");
    talk(sim);
    expect(sim.quests.states["quest.tut_attack"].status).toBe("completed");
  });
});

describe("graduation", () => {
  it("completing graduation sets the tutorial.graduated flag", () => {
    const sim = chainSim();
    // Force the whole chain complete so graduation is available.
    sim.quests.states["quest.tut_welcome"].status = "completed";
    for (const skill of TUTORIAL_ORDER) sim.quests.states[lessonId(skill)].status = "completed";
    sim.enqueue({ type: "interact", targetId: NPC });
    let done = false;
    for (let i = 0; i < 4000 && !done; i++) {
      if (sim.tick().some((e) => e.type === "questCompleted" && e.questId === "quest.tut_graduation")) done = true;
    }
    expect(done).toBe(true);
    expect(sim.worldFlags.has("tutorial.graduated")).toBe(true);
  });
});
