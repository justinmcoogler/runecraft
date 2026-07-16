// Tutor's Trail quests: the lessons and the graduation are gated behind the
// welcome quest, the combat lesson counts pig kills across attack styles, and
// finishing graduation sets the tutorial.graduated world flag.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

const NPC = "t.giver";
const PIG = "t.pig";

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

describe("Tutor's Trail gating", () => {
  it("gates the lessons and graduation behind the welcome quest", () => {
    const sim = chainSim();
    expect(sim.quests.isAvailable("quest.tut_welcome")).toBe(true);
    for (const q of ["quest.tut_attack", "quest.tut_mining", "quest.tut_graduation"]) {
      expect(sim.quests.isAvailable(q), q).toBe(false);
    }
    sim.quests.states["quest.tut_welcome"].status = "completed";
    for (const q of ["quest.tut_attack", "quest.tut_mining", "quest.tut_graduation"]) {
      expect(sim.quests.isAvailable(q), q).toBe(true);
    }
  });
});

describe("the Combat Instructor lesson", () => {
  it("auto-clears the equip step, then counts three pig kills", () => {
    const sim = chainSim();
    sim.quests.states["quest.tut_welcome"].status = "completed";
    sim.equippedTool = "tool.sword.bronze"; // a weapon already in hand
    talk(sim); // start: leading talk + equip-weapon auto-advance -> slay
    expect(sim.quests.activeObjective("quest.tut_attack")?.id).toBe("do");

    sim.quests.process([{ type: "enemyDied", instanceId: PIG }, { type: "enemyDied", instanceId: PIG }] as SimEvent[]);
    expect(sim.quests.states["quest.tut_attack"].progress).toBe(2);
    sim.quests.process([{ type: "enemyDied", instanceId: PIG }] as SimEvent[]);
    // The third kill clears the final objective, completing the lesson.
    expect(sim.quests.states["quest.tut_attack"].status).toBe("completed");
  });
});

describe("graduation", () => {
  it("completing graduation sets the tutorial.graduated flag", () => {
    const sim = chainSim();
    sim.quests.states["quest.tut_welcome"].status = "completed";
    // Walk over and talk: the single talk objective completes on accept, and
    // the sim applies the quest's completionFlag on questCompleted.
    sim.enqueue({ type: "interact", targetId: NPC });
    let done = false;
    for (let i = 0; i < 4000 && !done; i++) {
      if (sim.tick().some((e) => e.type === "questCompleted" && e.questId === "quest.tut_graduation")) done = true;
    }
    expect(done).toBe(true);
    expect(sim.worldFlags.has("tutorial.graduated")).toBe(true);
  });
});
