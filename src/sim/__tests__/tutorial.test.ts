// Tutor's Trail: the tutorial is a hand-built finite region (its own
// heightfield, no endless streaming). The newcomer spawns at the camp, the
// welcome quest is the only one offered to start, and the gateway stays shut
// until the graduation quest sets the tutorial.graduated flag.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { TUTORIAL_SEED } from "../worldgen/endless";
import { masterNpcId, QUESTS } from "../../content/content";

describe("Tutor's Trail", () => {
  it("is a finite region — no endless terrain source or chunk streaming", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect(sim.world.region.id).toBe("region.tutorial");
    expect(sim.chunks).toBeNull();
    // A hand-built heightfield, not a generator.
    expect(sim.world.region.heights.length).toBe(sim.world.region.width * sim.world.region.depth);
  });

  it("spawns among the trail NPCs: guide, every skill master, gatekeeper", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const ids = new Set(sim.world.region.npcs.map((n) => n.instanceId));
    for (const id of ["tutorial.guide", "tutorial.gatekeeper", masterNpcId("skill.woodcutting"), masterNpcId("skill.invention")]) {
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
    for (const q of ["quest.tut_woodcutting", "quest.tut_mining", "quest.tut_graduation"]) {
      expect(sim.quests.isAvailable(q), q).toBe(false);
    }
    // The player starts with an axe equipped so the first gather works.
    expect(sim.equippedTool).toBe("tool.axe.basic");
  });

  it("makes gatherer/fighter lessons require doing the craft, not just talking", () => {
    // The gatherers gather and the fighters fight: each carries a real action
    // objective beyond the opening talk, so a chat alone can't tick it complete.
    for (const skill of ["woodcutting", "mining", "fishing", "attack", "archery"]) {
      const q = QUESTS[`quest.tut_${skill}`];
      expect(q, skill).toBeTruthy();
      expect(q.objectives.length, skill).toBeGreaterThan(1);
      expect(q.objectives.some((o) => o.type === "gather" || o.type === "slay"), skill).toBe(true);
    }
    // A weak practice mob is penned for the combat lessons.
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect((sim.world.region.enemies ?? []).some((e) => e.defId === "enemy.pig")).toBe(true);
  });

  it("does not set the graduation flag until the chain is done", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect(sim.worldFlags.has("tutorial.graduated")).toBe(false);
  });
});
