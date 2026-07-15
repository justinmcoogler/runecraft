// The tutorial lesson driver: one ordered, all-required track that tours every
// skill's station and opens the gateway only once the last lesson is done.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { TUTORIAL_SEED } from "../worldgen/endless";
import { TUTORIAL_LESSONS } from "../../content/tutorial";

/** Emit whatever event completes the sim's current lesson, then tick. */
function completeCurrent(sim: GameSimulation): void {
  const lesson = sim.tutorial!.current!;
  const t = lesson.trigger;
  switch (t.kind) {
    case "reachGuide": {
      const g = sim.world.region.npcs.find((n) => n.instanceId === "tutorial.guide")!.cell;
      sim.movement.setCellPosition({ x: g.x - 1, z: g.z });
      break;
    }
    case "logGained":
      sim.events.emit({ type: "itemGained", itemId: "item.log.basic", qty: 1 });
      break;
    case "logBurned":
      sim.events.emit({ type: "logBurned", itemId: "item.log.basic" });
      break;
    case "bonesBuried":
      sim.events.emit({ type: "bonesBuried", itemId: "item.bone.old" });
      break;
    case "enemyDefeated":
      sim.events.emit({ type: "enemyDied", instanceId: "tutorial.foe" });
      break;
    case "itemPrefix":
      sim.events.emit({ type: "itemGained", itemId: `${t.prefix}test`, qty: 1 });
      break;
    case "skillXp":
      sim.events.emit({ type: "xpGained", skillId: t.skillId, amount: 10 });
      break;
    case "eventType":
      if (t.eventType === "planted") sim.events.emit({ type: "planted", instanceId: "tutorial.plot", seedItemId: "item.seed.wheat" });
      else if (t.eventType === "spellCast") sim.events.emit({ type: "spellCast", spell: "low_alch", coins: 4 });
      else if (t.eventType === "slayerTaskAssigned") sim.events.emit({ type: "slayerTaskAssigned", enemyName: "Goblin", count: 3 });
      else if (t.eventType === "shortcutUsed") sim.events.emit({ type: "shortcutUsed", instanceId: "tutorial.shortcut" });
      break;
  }
  sim.tick();
}

describe("the tutorial driver", () => {
  it("has one required lesson per skill, in act order", () => {
    const acts = TUTORIAL_LESSONS.map((l) => l.act);
    const firstOf = (a: string) => acts.indexOf(a);
    // Acts appear in order and don't interleave.
    expect(firstOf("Basics")).toBeLessThan(firstOf("Gathering"));
    expect(firstOf("Gathering")).toBeLessThan(firstOf("Processing"));
    expect(firstOf("Processing")).toBeLessThan(firstOf("Spiritual"));
    expect(firstOf("Spiritual")).toBeLessThan(firstOf("Combat"));
    // Every gameplay skill is covered (str/con/def train inside the melee lesson).
    const skills = new Set(TUTORIAL_LESSONS.map((l) => l.skillId).filter(Boolean));
    for (const s of [
      "skill.woodcutting", "skill.mining", "skill.foraging", "skill.fishing", "skill.cooking",
      "skill.smelting", "skill.smithing", "skill.attack", "skill.farming", "skill.herblore",
      "skill.crafting", "skill.archaeology", "skill.archery", "skill.construction", "skill.brewing",
      "skill.enchanting", "skill.hunting", "skill.thieving", "skill.agility", "skill.slaying",
      "skill.boating", "skill.firemaking", "skill.prayer", "skill.runecrafting", "skill.fletching",
      "skill.magic", "skill.dungeoneering", "skill.summoning", "skill.necromancy", "skill.invention",
    ]) {
      expect(skills.has(s), `${s} has no tutorial lesson`).toBe(true);
    }
    // Every lesson pays a small item + XP.
    for (const l of TUTORIAL_LESSONS) {
      expect((l.reward.items?.length ?? 0) > 0).toBe(true);
      expect(l.reward.xp).toBeTruthy();
    }
  });

  it("places the guide, spread-out stations, pond, and combat foes", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const r = sim.world.region;
    const sp = r.spawn;
    // The pond carved to water; the bank is walkable.
    expect(sim.world.blockAt({ x: sp.x + 12, z: sp.z + 5 })).toBe("water");
    for (const id of ["tutorial.tree", "tutorial.rock", "tutorial.fishing", "tutorial.herb", "tutorial.stall", "tutorial.digsite"]) {
      expect(r.nodes.some((n) => n.instanceId === id), `${id} missing`).toBe(true);
    }
    for (const id of ["tutorial.furnace", "tutorial.anvil", "tutorial.workbench", "tutorial.altar", "tutorial.enchanter", "tutorial.obelisk", "tutorial.buildsite", "tutorial.shortcut"]) {
      expect(r.objects.some((o) => o.instanceId === id), `${id} missing`).toBe(true);
    }
    for (const id of ["tutorial.foe", "tutorial.foe2", "tutorial.undead", "tutorial.boss"]) {
      expect((r.enemies ?? []).some((e) => e.instanceId === id), `${id} missing`).toBe(true);
    }
    expect(r.npcs.some((n) => n.instanceId === "village.npc.brusk")).toBe(true);
    // Stations are genuinely spread out (not all crammed by spawn).
    const spread = r.objects.filter((o) => o.instanceId.startsWith("tutorial.")).map((o) => Math.abs(o.cell.x - sp.x) + Math.abs(o.cell.z - sp.z));
    expect(Math.max(...spread)).toBeGreaterThan(30);
  });

  it("announces the first objective and points a marker at it", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    const events = sim.tick();
    const obj = events.find((e) => e.type === "tutorialObjective");
    expect(obj && obj.type === "tutorialObjective" && obj.index).toBe(0);
    expect(obj && obj.type === "tutorialObjective" && obj.total).toBe(TUTORIAL_LESSONS.length);
    expect(sim.tutorial!.markerCell()).toBeTruthy(); // beacon target resolves
  });

  it("grants a lesson's reagents when it becomes active", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    // Advance to the mining lesson (grants a pickaxe on entry).
    let guard = 0;
    while (sim.tutorial!.current?.id !== "tut.mine" && guard++ < 40) completeCurrent(sim);
    expect(sim.tutorial!.current?.id).toBe("tut.mine");
    expect(sim.inventory.count("tool.pickaxe.basic")).toBeGreaterThanOrEqual(1);
  });

  it("drives the whole required track to graduation without the pack overflowing", () => {
    const sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    sim.tick();
    let guard = 0;
    while (!sim.tutorial!.complete && guard++ < TUTORIAL_LESSONS.length + 5) completeCurrent(sim);
    expect(sim.tutorial!.complete).toBe(true);
    expect(sim.tutorial!.index).toBe(TUTORIAL_LESSONS.length);
    expect(sim.tutorial!.current).toBeNull();
    // The 40-slot tutorial pack held everything — no add ever silently failed.
    expect(sim.inventory.slots.some((s) => s === null)).toBe(true);
  });
});
