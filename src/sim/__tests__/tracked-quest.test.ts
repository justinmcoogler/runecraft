// The player can pin a quest to track: the guidance target (beacon/path line +
// map marker) then follows that quest instead of the first active one.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { QUESTS } from "../../content/content";
import { activeQuestTarget } from "../../ui/quest-helper";
import type { RegionSpec, BlockType } from "../world";

const A = "npc.a", B = "npc.b";
const CELL_A = { x: 8, z: 2 }, CELL_B = { x: 2, z: 8 };

function twoNpcRegion(): RegionSpec {
  const w = 12, d = 12;
  return {
    id: "region.endless", // an overworld id so targets are "showable"
    width: w,
    depth: d,
    heights: new Array<number>(w * d).fill(0),
    blocks: new Array<BlockType>(w * d).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [
      { instanceId: A, name: "Alda", cell: CELL_A, wanderRadius: 0 },
      { instanceId: B, name: "Bertram", cell: CELL_B, wanderRadius: 0 },
    ],
    enemies: [],
    spawn: { x: 6, z: 6 },
  };
}

/** Point quest.tut_welcome at NPC A and quest.tut_woodcutting at NPC B. */
function twoQuestSim(): GameSimulation {
  const sim = new GameSimulation(twoNpcRegion(), 7);
  const defs = (sim.quests as unknown as {
    defs: Record<string, { giverNpcId: string; objectives: Array<Record<string, unknown>> }>;
  }).defs;
  const retarget = (qid: string, npc: string) => {
    const def = defs[qid];
    def.giverNpcId = npc;
    for (const o of def.objectives) if (o.npcId) o.npcId = npc;
  };
  retarget("quest.tut_welcome", A);
  retarget("quest.tut_woodcutting", B);
  return sim;
}

describe("tracked quest guidance", () => {
  it("follows the first active quest when nothing is pinned", () => {
    const sim = twoQuestSim();
    sim.quests.states["quest.tut_welcome"].status = "active";
    sim.quests.states["quest.tut_woodcutting"].status = "active";
    const t = activeQuestTarget(sim);
    // quest.tut_welcome precedes quest.tut_woodcutting in the QUESTS registry.
    expect(t?.questName).toBe(QUESTS["quest.tut_welcome"].name);
    expect(t?.cell).toEqual(CELL_A);
  });

  it("follows the pinned quest instead of the first active one", () => {
    const sim = twoQuestSim();
    sim.quests.states["quest.tut_welcome"].status = "active";
    sim.quests.states["quest.tut_woodcutting"].status = "active";
    sim.trackedQuestId = "quest.tut_woodcutting";
    const t = activeQuestTarget(sim);
    expect(t?.questName).toBe(QUESTS["quest.tut_woodcutting"].name);
    expect(t?.cell).toEqual(CELL_B);
  });

  it("leads to the giver when the pinned quest hasn't been started yet", () => {
    const sim = twoQuestSim();
    // welcome is available (unstarted); pin it and expect the giver as target.
    sim.trackedQuestId = "quest.tut_welcome";
    const t = activeQuestTarget(sim);
    expect(t?.questName).toBe(QUESTS["quest.tut_welcome"].name);
    expect(t?.cell).toEqual(CELL_A);
    expect(t?.label.toLowerCase()).toContain("begin");
  });
});
