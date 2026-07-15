// The tutorial lesson driver: the required-core script advances one lesson per
// act, grants rewards, and completes (opening the gateway) after the last.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { TUTORIAL_SEED } from "../worldgen/endless";
import { TUTORIAL_LESSONS, TUTORIAL_OPTIONAL } from "../../content/tutorial";

/** The optional-lesson gear lives in the camp supply crate, not the pack. */
function crateHas(sim: GameSimulation, itemId: string): boolean {
  const crate = sim.world.region.objects.find((o) => o.instanceId === "tutorial.crate");
  return (crate?.initialItems ?? []).some((i) => i.itemId === itemId);
}

describe("the tutorial driver", () => {
  it("places the guide, tree and sparring foe in the tutorial region", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    expect(r.npcs.some((n) => n.instanceId === "tutorial.guide")).toBe(true);
    expect(r.nodes.some((n) => n.instanceId === "tutorial.tree")).toBe(true);
    expect((r.enemies ?? []).some((e) => e.instanceId === "tutorial.foe")).toBe(true);
    expect(sim.tutorial).not.toBeNull();
  });

  it("announces the first objective on the opening tick", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const events = sim.tick();
    const obj = events.find((e) => e.type === "tutorialObjective");
    expect(obj).toBeTruthy();
    expect(obj && obj.type === "tutorialObjective" && obj.index).toBe(0);
    expect(sim.tutorial!.index).toBe(0);
  });

  it("walks the full required-core script to graduation, rewarding each step", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick(); // drains the opening objective; player isn't at the guide yet
    expect(sim.tutorial!.index).toBe(0);

    // Lesson 1 — Basics: reach the guide.
    const guide = sim.world.region.npcs.find((n) => n.instanceId === "tutorial.guide")!.cell;
    sim.movement.setCellPosition({ x: guide.x - 1, z: guide.z });
    let events = sim.tick();
    expect(events.some((e) => e.type === "tutorialLessonDone")).toBe(true);
    expect(sim.tutorial!.index).toBe(1);
    expect(sim.inventory.count("item.coin")).toBeGreaterThanOrEqual(15); // reward landed

    // Lesson 2 — Gathering: a log enters the pack.
    sim.inventory.add("item.log.basic", 1);
    sim.events.emit({ type: "itemGained", itemId: "item.log.basic", qty: 1 });
    sim.tick();
    expect(sim.tutorial!.index).toBe(2);

    // Lesson 3 — Processing: burn a log.
    sim.events.emit({ type: "logBurned", itemId: "item.log.basic" });
    sim.tick();
    expect(sim.tutorial!.index).toBe(3);
    // Entering the Prayer lesson grants bones to bury.
    expect(sim.inventory.count("item.bone.old")).toBeGreaterThanOrEqual(1);

    // Lesson 4 — Spiritual: bury bones.
    sim.events.emit({ type: "bonesBuried", itemId: "item.bone.old" });
    sim.tick();
    expect(sim.tutorial!.index).toBe(4);

    // Lesson 5 — Combat: defeat the foe → tutorial complete.
    sim.events.emit({ type: "enemyDied", instanceId: "tutorial.foe" });
    events = sim.tick();
    expect(events.some((e) => e.type === "tutorialComplete")).toBe(true);
    expect(sim.tutorial!.complete).toBe(true);
    expect(sim.tutorial!.current).toBeNull();
  });

  it("places the optional-lesson stations and stocks their reagents", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    expect(r.nodes.some((n) => n.instanceId === "tutorial.rock")).toBe(true);
    expect(r.nodes.some((n) => n.instanceId === "tutorial.bush")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.furnace")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.anvil")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.altar")).toBe(true);
    // Reagents live in the supply crate; boot trips no lesson.
    sim.tick();
    expect(crateHas(sim, "tool.pickaxe.basic")).toBe(true);
    expect(crateHas(sim, "item.ore.copper")).toBe(true);
    expect(sim.tutorial!.optionalDone.size).toBe(0);
  });

  it("awards optional lessons opportunistically without touching the core track", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    const idxBefore = sim.tutorial!.index;
    // Mining an ore fires the optional mining lesson (itemGained from the real
    // gather pipeline, not a silent grant).
    sim.events.emit({ type: "itemGained", itemId: "item.ore.copper", qty: 1 });
    const events = sim.tick();
    expect(sim.tutorial!.optionalDone.has("tut.mine")).toBe(true);
    expect(events.some((e) => e.type === "tutorialLessonDone" && e.optional === true)).toBe(true);
    // The required track is untouched — optional lessons never gate graduation.
    expect(sim.tutorial!.index).toBe(idxBefore);
    expect(sim.tutorial!.complete).toBe(false);
  });

  it("awards optional lessons off skillXp and event triggers too", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    // Cooking (skillXp), Magic (spellCast event), Farming (planted event).
    sim.events.emit({ type: "xpGained", skillId: "skill.cooking", amount: 22 });
    sim.events.emit({ type: "spellCast", spell: "low_alch", coins: 4 });
    sim.events.emit({ type: "planted", instanceId: "tutorial.plot", seedItemId: "item.seed.wheat" });
    sim.tick();
    expect(sim.tutorial!.optionalDone.has("tut.cook")).toBe(true);
    expect(sim.tutorial!.optionalDone.has("tut.magic")).toBe(true);
    expect(sim.tutorial!.optionalDone.has("tut.farm")).toBe(true);
    // Core track still untouched.
    expect(sim.tutorial!.complete).toBe(false);
  });

  it("stocks the batch-2 reagents in the crate (no lesson tripped at boot)", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    expect(crateHas(sim, "item.fish.raw")).toBe(true);
    expect(crateHas(sim, "item.rune.fire")).toBe(true);
    expect(crateHas(sim, "item.seed.wheat")).toBe(true);
    expect(sim.tutorial!.optionalDone.size).toBe(0); // stocking the crate trips nothing
  });

  it("awards the crafting/brewing/agility batch and places their stations", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    expect(r.objects.some((o) => o.instanceId === "tutorial.cauldron")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.shortcut")).toBe(true);
    sim.tick();
    sim.events.emit({ type: "xpGained", skillId: "skill.crafting", amount: 10 });
    sim.events.emit({ type: "xpGained", skillId: "skill.brewing", amount: 10 });
    sim.events.emit({ type: "shortcutUsed", instanceId: "tutorial.shortcut" });
    sim.tick();
    expect(sim.tutorial!.optionalDone.has("tut.craft")).toBe(true);
    expect(sim.tutorial!.optionalDone.has("tut.brew")).toBe(true);
    expect(sim.tutorial!.optionalDone.has("tut.agility")).toBe(true);
    expect(crateHas(sim, "item.herb.sage")).toBe(true); // brewing reagent stocked
  });

  it("awards the herblore/hunting/thieving/archery batch and stocks their gear", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    expect(r.nodes.some((n) => n.instanceId === "tutorial.herb")).toBe(true);
    expect(r.nodes.some((n) => n.instanceId === "tutorial.trail")).toBe(true);
    expect(r.nodes.some((n) => n.instanceId === "tutorial.stall")).toBe(true);
    expect((r.enemies ?? []).some((e) => e.instanceId === "tutorial.foe2")).toBe(true);
    sim.tick();
    expect(crateHas(sim, "tool.trap.basic")).toBe(true);
    expect(crateHas(sim, "tool.bow.wood")).toBe(true);
    for (const s of ["skill.herblore", "skill.hunting", "skill.thieving", "skill.archery"]) {
      sim.events.emit({ type: "xpGained", skillId: s, amount: 10 });
    }
    sim.tick();
    for (const id of ["tut.herb", "tut.hunt", "tut.thieve", "tut.archery"]) {
      expect(sim.tutorial!.optionalDone.has(id)).toBe(true);
    }
    expect(sim.tutorial!.complete).toBe(false); // optionals never gate
  });

  it("awards summoning and places the obelisk", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    expect(sim.world.region.objects.some((o) => o.instanceId === "tutorial.obelisk")).toBe(true);
    sim.tick();
    expect(crateHas(sim, "item.charm.bone")).toBe(true);
    sim.events.emit({ type: "xpGained", skillId: "skill.summoning", amount: 40 });
    sim.tick();
    expect(sim.tutorial!.optionalDone.has("tut.summon")).toBe(true);
  });

  it("carves the tutorial pond and places the water/build/combat stations", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    const sp = r.spawn;
    // The pond: the Fishing spot sits on water; the bank just south is dry.
    expect(sim.world.blockAt({ x: sp.x + 12, z: sp.z + 5 })).toBe("water");
    expect(sim.world.walkable({ x: sp.x + 12, z: sp.z + 4 })).toBe(true);
    expect(r.nodes.some((n) => n.instanceId === "tutorial.fishing")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.enchanter")).toBe(true);
    expect(r.objects.some((o) => o.instanceId === "tutorial.buildsite")).toBe(true);
    expect(r.npcs.some((n) => n.instanceId === "village.npc.brusk")).toBe(true);
    expect((r.enemies ?? []).some((e) => e.instanceId === "tutorial.undead")).toBe(true);
    expect((r.enemies ?? []).some((e) => e.instanceId === "tutorial.boss")).toBe(true);
    // Gear lives in the supply crate (not the 20-slot pack) so nothing overflows.
    const crate = r.objects.find((o) => o.instanceId === "tutorial.crate");
    expect(crate).toBeTruthy();
    const crated = new Set((crate!.initialItems ?? []).map((i) => i.itemId));
    for (const id of ["tool.fishingrod.basic", "tool.boat.raft", "tool.axe.iron", "item.brick.stone", "item.bar.iron"]) {
      expect(crated.has(id), `${id} missing from supply crate`).toBe(true);
    }
  });

  it("awards the final skill batch (fishing…slaying) off their triggers", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    for (const s of [
      "skill.fishing", "skill.boating", "skill.enchanting", "skill.invention",
      "skill.necromancy", "skill.construction", "skill.dungeoneering",
    ]) {
      sim.events.emit({ type: "xpGained", skillId: s, amount: 10 });
    }
    sim.events.emit({ type: "slayerTaskAssigned", enemyName: "Goblin", count: 3 });
    sim.tick();
    for (const id of [
      "tut.fish", "tut.boat", "tut.enchant", "tut.invent",
      "tut.necro", "tut.construct", "tut.dungeon", "tut.slay",
    ]) {
      expect(sim.tutorial!.optionalDone.has(id), `${id} not awarded`).toBe(true);
    }
    expect(sim.tutorial!.complete).toBe(false); // still never gates
  });

  it("marks every optional lesson optional with an item+XP reward", () => {
    for (const l of TUTORIAL_OPTIONAL) {
      expect(l.optional).toBe(true);
      expect((l.reward.items?.length ?? 0) > 0).toBe(true);
      expect(l.reward.xp).toBeTruthy();
    }
  });

  it("keeps the required set to one lesson per act, in act order", () => {
    const acts = TUTORIAL_LESSONS.map((l) => l.act);
    expect(acts).toEqual(["Basics", "Gathering", "Processing", "Spiritual", "Combat"]);
    // Every lesson rewards a small item and XP (the locked reward shape).
    for (const l of TUTORIAL_LESSONS) {
      expect((l.reward.items?.length ?? 0) > 0).toBe(true);
      expect(l.reward.xp).toBeTruthy();
    }
  });
});
