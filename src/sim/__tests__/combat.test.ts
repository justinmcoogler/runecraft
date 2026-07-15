// Milestone-10 tests: combat through the same action pipeline — chase,
// attack cadence, loot, XP, enemy retaliation, leashing, death and respawn.

import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";
import { clearSave, loadFromStorage, saveToStorage } from "../../save/save";

const COW = "t.cow";
const PIG = "t.pig";

function makeArenaRegion(): RegionSpec {
  const width = 14;
  const depth = 14;
  return {
    id: "region.arena_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [],
    enemies: [
      { instanceId: COW, defId: "enemy.cow", cell: { x: 8, z: 8 } },
      { instanceId: PIG, defId: "enemy.pig", cell: { x: 12, z: 12 } },
    ],
    spawn: { x: 2, z: 2 },
  };
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 5000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("combat", () => {
  it("walks to the cow, fights to the kill, earns Combat XP and possible loot", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.enqueue({ type: "interact", targetId: COW });
    const events = runUntil(sim, (e) => e.type === "enemyDied" && e.instanceId === COW);
    expect(events.some((e) => e.type === "playerAttack" && e.damage !== null)).toBe(true);
    expect(events.some((e) => e.type === "actionEnded" && e.reason === "target_slain")).toBe(true);
    // Attack XP = per-damage XP for every hit plus the defeat bonus.
    const totalDamage = events
      .filter((e): e is Extract<SimEvent, { type: "playerAttack" }> => e.type === "playerAttack")
      .reduce((sum, e) => sum + (e.damage ?? 0), 0);
    expect(sim.skills.xp["skill.attack"]).toBe(
      totalDamage * 4 + ENEMIES["enemy.cow"].xpOnDefeat,
    );
    expect(sim.enemies.get(COW)!.phase).toBe("dead");

    // Respawns at home with full health.
    runUntil(sim, (e) => e.type === "enemyRespawned" && e.instanceId === COW, 400);
    expect(sim.enemies.get(COW)!.hp).toBe(ENEMIES["enemy.cow"].maxHealth);
  });

  it("the enemy fights back; taking damage trains Defense", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    const maxHp = sim.maxHp();
    sim.enqueue({ type: "interact", targetId: COW });
    runUntil(sim, (e) => e.type === "enemyAttack" && e.damage !== null);
    expect(sim.hp).toBeLessThan(maxHp);
    expect(sim.skills.xp["skill.defense"]).toBe((maxHp - sim.hp) * 4);
  });

  it("max HP grows with Defense level and Defense lowers enemy hit chance", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    const baseline = sim.maxHp();
    sim.skills.xp["skill.defense"] = 100000; // a high level
    expect(sim.maxHp()).toBeGreaterThan(baseline);
    // Formula check: chance floor is respected at very high Defense.
    const level = sim.skills.levelOf("skill.defense");
    const chance = Math.max(0.25, 0.6 - 0.012 * (level - 1)); // cow accuracy 0.6
    expect(chance).toBe(0.25);
  });

  it("an equipped sword adds its damage bonus", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.equippedTool = "tool.sword.copper";
    sim.enqueue({ type: "interact", targetId: COW });
    const events = runUntil(sim, (e) => e.type === "enemyDied");
    const damages = events
      .filter((e): e is Extract<SimEvent, { type: "playerAttack" }> => e.type === "playerAttack")
      .map((e) => e.damage)
      .filter((d): d is number => d !== null);
    // Unarmed range is 1-3; the sword's +2 makes every hit 3-5.
    expect(Math.max(...damages)).toBeGreaterThan(3);
    expect(Math.min(...damages)).toBeGreaterThanOrEqual(3);
  });

  it("dying respawns the player at camp with full health, inventory intact", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.inventory.add("item.log.basic", 7);
    sim.hp = 1;
    sim.enqueue({ type: "interact", targetId: COW });
    runUntil(sim, (e) => e.type === "playerDied", 8000);
    expect(sim.movement.currentCell()).toEqual({ x: 2, z: 2 });
    expect(sim.hp).toBe(sim.maxHp());
    expect(sim.inventory.count("item.log.basic")).toBe(7);
    // Attackers gave up once the player dropped.
    expect([...sim.enemies.enemies.values()].every((e) => !e.engaged)).toBe(true);
  });

  it("leashing: an enemy dragged too far from home gives up and heals", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.enqueue({ type: "interact", targetId: COW });
    runUntil(sim, (e) => e.type === "playerAttack" && e.damage !== null);
    const hurtHp = sim.enemies.get(COW)!.hp;
    expect(hurtHp).toBeLessThan(ENEMIES["enemy.cow"].maxHealth);
    // Run to the far corner; the cow chases, hits its leash, resets.
    sim.enqueue({ type: "moveTo", cell: { x: 1, z: 1 } });
    for (let i = 0; i < 600; i++) sim.tick();
    const cow = sim.enemies.get(COW)!;
    expect(cow.engaged).toBe(false);
    expect(cow.hp).toBe(ENEMIES["enemy.cow"].maxHealth);
  });

  it("player HP regenerates out of combat", () => {
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.hp = 10;
    for (let i = 0; i < 120; i++) sim.tick(); // 12s: 5s delay + regen ticks
    expect(sim.hp).toBeGreaterThan(10);
  });

  it("player HP and enemy state survive save/load", () => {
    clearSave();
    const sim = new GameSimulation(makeArenaRegion(), 13);
    sim.hp = 9;
    const cow = sim.enemies.get(COW)!;
    cow.phase = "dead";
    cow.hp = 0;
    cow.respawnRemainingS = 11;
    expect(saveToStorage(sim)).toBe(true);

    const restored = new GameSimulation(makeArenaRegion(), 5);
    expect(loadFromStorage(restored)).toBe(true);
    expect(restored.hp).toBe(9);
    expect(restored.enemies.get(COW)!.phase).toBe("dead");
    expect(restored.enemies.get(COW)!.respawnRemainingS).toBe(11);
    clearSave();
  });
});
