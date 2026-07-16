// The tutorial vale is now quest-driven: the newcomer spawns among quest-giver
// NPCs, the welcome quest is the only one offered to start, and the gateway
// stays shut until the graduation quest sets the tutorial.graduated flag.

import { afterEach, describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { setValeActive, TUTORIAL_SEED } from "../worldgen/endless";

describe("the tutorial vale", () => {
  afterEach(() => setValeActive(false)); // createTutorial flips the shared flag on

  it("spawns among the quest-giver NPCs, with no lesson driver", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const ids = new Set(sim.world.region.npcs.map((n) => n.instanceId));
    for (const id of ["tutorial.guide", "tutorial.woodsman", "tutorial.smith", "village.npc.brusk"]) {
      expect(ids.has(id), id).toBe(true);
    }
    // The lesson driver is retired — the tutorial is delivered as quests.
    expect(sim.tutorial).toBeNull();
    // The graduation gateway exists.
    expect(sim.world.region.objects.some((o) => o.instanceId === "tutorial.graduate")).toBe(true);
  });

  it("offers only the welcome quest to begin, gating the rest behind it", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect(sim.quests.isAvailable("quest.tut_welcome")).toBe(true);
    for (const q of ["quest.tut_timber", "quest.tut_stone", "quest.tut_blooding", "quest.tut_graduation"]) {
      expect(sim.quests.isAvailable(q), q).toBe(false);
    }
    // The player starts with an axe equipped so the first gather works.
    expect(sim.equippedTool).toBe("tool.axe.basic");
  });

  it("does not set the graduation flag until the chain is done", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect(sim.worldFlags.has("tutorial.graduated")).toBe(false);
  });
});
