// Tutor's Trail: the tutorial is a hand-built finite region (its own
// heightfield, no endless streaming). The newcomer spawns at the camp, the
// welcome quest is the only one offered to start, and the gateway stays shut
// until the graduation quest sets the tutorial.graduated flag.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import { TUTORIAL_SEED } from "../worldgen/endless";
import { masterNpcId, QUESTS, TUTORIAL_ORDER } from "../../content/content";

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

  it("every lesson is completable in order, all the way to graduation", () => {
    // Drive the whole chain by satisfying each objective the way the game would,
    // proving no lesson (gather/slay/train/equip) can soft-lock the sequence.
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const q = sim.quests;
    const feed = (ev: SimEvent) => q.process([ev]);
    const toolForTag: Record<string, string> = {
      weapon: "tool.sword.bronze", bow: "tool.bow.oak", pickaxe: "tool.pickaxe.copper", fishing_tool: "tool.fishingrod.basic",
    };
    const enemyId = (defId: string) =>
      (sim.world.region.enemies ?? []).find((e) => e.defId === defId)!.instanceId;

    // Welcome: talk the guide, then the first master (that also opens lesson 1).
    feed({ type: "npcChat", instanceId: "tutorial.guide", name: "" } as SimEvent);
    feed({ type: "npcChat", instanceId: masterNpcId(TUTORIAL_ORDER[0]), name: "" } as SimEvent);
    expect(q.states["quest.tut_welcome"].status).toBe("completed");

    for (const skill of TUTORIAL_ORDER) {
      const id = `quest.tut_${skill.slice("skill.".length)}`;
      const npc = masterNpcId(skill);
      expect(q.isAvailable(id) || q.states[id].status === "active", id).toBe(true);
      feed({ type: "npcChat", instanceId: npc, name: "" } as SimEvent); // accept (+ startItems)
      // Satisfy each remaining objective by its type.
      for (let guard = 0; guard < 12 && q.states[id].status === "active"; guard++) {
        const obj = q.activeObjective(id);
        if (!obj) break;
        if (obj.type === "equipTag") {
          sim.equippedTool = toolForTag[obj.toolTag!] ?? "tool.sword.bronze";
          feed({ type: "equipmentChanged" } as SimEvent);
        } else if (obj.type === "gather") {
          // Gathering really adds to the pack, so the hand-back step can spend it.
          sim.inventory.add(obj.itemId!, obj.qty ?? 1);
          feed({ type: "itemGained", itemId: obj.itemId!, qty: obj.qty ?? 1 } as SimEvent);
        } else if (obj.type === "slay") {
          feed({ type: "enemyDied", instanceId: enemyId(obj.enemyDefId!) } as SimEvent);
        } else if (obj.type === "train") {
          feed({ type: "xpGained", skillId: obj.skillId!, amount: 1 } as SimEvent);
        } else if (obj.type === "talk" || obj.type === "deliver") {
          // Both the report-in and hand-back closers complete by talking to the
          // master (deliver also spends the items already in the pack).
          feed({ type: "npcChat", instanceId: npc, name: "" } as SimEvent);
        }
      }
      expect(q.states[id].status, id).toBe("completed");
    }

    // The whole trail done: graduation is offered and completes on the talk
    // (the sim applies its completionFlag on tick — see questchain.test).
    expect(q.isAvailable("quest.tut_graduation")).toBe(true);
    feed({ type: "npcChat", instanceId: "tutorial.gatekeeper", name: "" } as SimEvent);
    expect(q.states["quest.tut_graduation"].status).toBe("completed");
  });
});
