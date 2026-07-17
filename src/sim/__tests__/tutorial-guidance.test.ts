// The tutorial trail must never strand the player: guidance re-pins itself if
// tracking is ever lost, and a lesson whose deed was already performed
// registers when the player reports back to the master.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { QUESTS, TUTORIAL_ORDER } from "../../content/content";
import { activeQuestTarget } from "../../ui/quest-helper";

const talk = (sim: GameSimulation, npc: string) => {
  sim.events.emit({ type: "npcChat", instanceId: npc, name: npc });
  sim.tick();
};

/** Drive the chain through the real tick flow up to (excluding) `stopAt`. */
function completeThrough(sim: GameSimulation, stopAt: string): void {
  talk(sim, "tutorial.guide");
  const chain = ["quest.tut_welcome", ...TUTORIAL_ORDER.map((s) => `quest.tut_${s.slice(6)}`)];
  for (const qid of chain) {
    if (qid === stopAt) return;
    const def = QUESTS[qid];
    talk(sim, def.giverNpcId);
    for (let round = 0; round < 8 && sim.quests.states[qid].status !== "completed"; round++) {
      const obj = def.objectives[sim.quests.states[qid].objectiveIndex];
      if (!obj) break;
      if (obj.type === "train") { sim.events.emit({ type: "xpGained", skillId: obj.skillId!, amount: 10 }); sim.tick(); }
      else if (obj.type === "slay") {
        const eid = `test.${qid}.${round}`;
        sim.enemies.addPlacement({ instanceId: eid, defId: obj.enemyDefId!, cell: sim.movement.currentCell() }, sim.rng);
        sim.events.emit({ type: "enemyDied", instanceId: eid });
        sim.tick();
      } else if (obj.type === "deliver") { sim.inventory.add(obj.itemId!, obj.qty ?? 1); talk(sim, obj.npcId ?? def.giverNpcId); }
      else if (obj.type === "talk") talk(sim, obj.npcId ?? def.giverNpcId);
      else if (obj.type === "equipTag") { sim.events.emit({ type: "equipmentChanged" }); sim.tick(); }
    }
  }
}

describe("tutorial guidance resilience", () => {
  it("guidance re-pins the next lesson even if tracking is lost after construction", () => {
    const sim = GameSimulation.createTutorial(7);
    sim.tick();
    completeThrough(sim, "quest.tut_brewing");
    expect(sim.quests.states["quest.tut_construction"].status).toBe("completed");
    // Simulate the tracked quest getting lost (reload quirk / dropped event).
    sim.trackedQuestId = null;
    sim.tick();
    expect(sim.trackedQuestId).toBe("quest.tut_brewing");
    const target = activeQuestTarget(sim);
    expect(target, "guidance should point at the next master").not.toBeNull();
    expect(target!.label).toContain("Hops");
  });

  it("the enchanting lesson completes through the REAL craft pipeline", () => {
    const sim = GameSimulation.createTutorial(7);
    sim.tick();
    for (const id of Object.keys(sim.quests.states)) {
      if (id.startsWith("quest.tut_") && id !== "quest.tut_enchanting" && id !== "quest.tut_graduation") {
        sim.quests.states[id].status = "completed";
      }
    }
    const def = QUESTS["quest.tut_enchanting"];
    const lumen = sim.world.region.npcs.find((n) => n.instanceId === def.giverNpcId)!;
    sim.movement.setCellPosition(sim.world.nearestWalkable(lumen.cell, 4)!);
    sim.enqueue({ type: "interact", targetId: def.giverNpcId });
    for (let i = 0; i < 80; i++) sim.tick();
    expect(sim.quests.states["quest.tut_enchanting"].status).toBe("active");
    expect(sim.inventory.count("tool.axe.iron")).toBe(1);
    expect(sim.inventory.count("item.relic.idol")).toBe(1);
    // Walk to the table and actually rune the axe.
    const table = sim.world.region.objects.find((o) => o.instanceId === "tut.station.enchanting")!;
    sim.movement.setCellPosition(sim.world.nearestWalkable(table.cell, 4)!);
    sim.enqueue({ type: "interact", targetId: "tut.station.enchanting" });
    for (let i = 0; i < 60; i++) sim.tick();
    sim.enqueue({ type: "craft", stationId: "tut.station.enchanting", recipeId: "recipe.runed_axe" });
    for (let i = 0; i < 200; i++) sim.tick();
    expect(sim.inventory.count("tool.axe.runed"), "the runed axe was made").toBe(1);
    expect(sim.quests.states["quest.tut_enchanting"].objectiveIndex, "train objective ticked live").toBe(2);
    // Report back to Lumen — lesson signed off.
    sim.movement.setCellPosition(sim.world.nearestWalkable(lumen.cell, 4)!);
    sim.enqueue({ type: "interact", targetId: def.giverNpcId });
    for (let i = 0; i < 80; i++) sim.tick();
    expect(sim.quests.states["quest.tut_enchanting"].status).toBe("completed");
  });

  it("a train lesson already performed registers when reporting back", () => {
    const sim = GameSimulation.createTutorial(7);
    sim.tick();
    completeThrough(sim, "quest.tut_enchanting");
    const giver = QUESTS["quest.tut_enchanting"].giverNpcId;
    talk(sim, giver); // accept: talk objective auto-satisfied, train is next
    expect(sim.quests.states["quest.tut_enchanting"].status).toBe("active");
    // The player runes the axe, but the xpGained beat is lost (e.g. a reload
    // happened between the deed and the report). Only the ledger remembers.
    sim.skills.xp["skill.enchanting"] = 12;
    talk(sim, giver); // report back: the giver checks the ledger and signs off
    expect(sim.quests.states["quest.tut_enchanting"].status).toBe("completed");
  });
});
