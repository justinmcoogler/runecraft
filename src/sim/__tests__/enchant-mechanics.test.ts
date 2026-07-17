// The Minecraft-flavored enchants do real things: Fire Aspect burns targets
// down (never past 1 HP), Knockback shoves them away, Thorns bites attackers,
// and armor warding makes enemies MISS more (regression: the sign flip).

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { makeTestRegion } from "./testRegion";
import { ENEMIES, aggregateMods } from "../../content/content";

const SPIDER = "enemy.spider";

function simWithEnemy(cell = { x: 5, z: 5 }): GameSimulation {
  const sim = new GameSimulation(makeTestRegion(), 42);
  sim.enemies.addPlacement({ instanceId: "test.mob", defId: SPIDER, cell }, sim.rng);
  return sim;
}

describe("enchant combat mechanics", () => {
  it("Fire Aspect burn ticks the target down but never kills it", () => {
    const sim = simWithEnemy();
    const mob = sim.enemies.get("test.mob")!;
    mob.hp = 3;
    sim.enemies.applyBurn("test.mob", 6);
    for (let i = 0; i < 12 * 10; i++) sim.enemies.tick(0.1, sim.rng); // 12 s: full burn-off
    expect(mob.hp).toBe(1); // chipped down, kill left for the player
    expect(mob.phase).toBe("alive");
  });

  it("Knockback shoves the target away from the attacker", () => {
    const sim = simWithEnemy({ x: 5, z: 5 });
    sim.enemies.knockback("test.mob", { x: 4, z: 5 }, 2);
    expect(sim.enemies.get("test.mob")!.movement.currentCell()).toEqual({ x: 7, z: 5 });
  });

  it("Knockback stops at unwalkable ground instead of tunneling through", () => {
    const sim = simWithEnemy({ x: 8, z: 5 }); // region is 10 wide: x=9 is the edge
    sim.enemies.knockback("test.mob", { x: 7, z: 5 }, 3);
    const cell = sim.enemies.get("test.mob")!.movement.currentCell();
    expect(cell.x).toBeLessThanOrEqual(9);
    expect(sim.world.walkable(cell)).toBe(true);
  });

  it("Thorns armor chips an attacker every time it lands a hit", () => {
    const sim = simWithEnemy({ x: 5, z: 5 });
    sim.movement.setCellPosition({ x: 5, z: 4 }); // adjacent — in melee range
    sim.equippedArmor.body = "armor.tunic.iron";
    sim.equippedArmorMods.body = { ench: ["ench.thorns"], gems: [] };
    expect(sim.armorThornsDamage()).toBe(1);
    const mob = sim.enemies.get("test.mob")!;
    sim.enemies.engage("test.mob");
    // Enough swings that at least one lands (accuracy 0.7, cadence 2.6 s).
    for (let i = 0; i < 60 * 10; i++) sim.enemies.tick(0.1, sim.rng);
    expect(mob.hp).toBeLessThan(ENEMIES[SPIDER].maxHealth);
    expect(mob.hp).toBeGreaterThanOrEqual(1);
  });

  it("the new enchants aggregate their effect fields", () => {
    const mods = { ench: ["ench.fireaspect", "ench.knockback", "ench.looting"], gems: [] };
    const fx = aggregateMods(mods, "weapon");
    expect(fx.burn).toBe(2);
    expect(fx.knock).toBe(2);
    expect(fx.loot).toBeCloseTo(0.3);
    const armor = aggregateMods({ ench: ["ench.thorns"], gems: [] }, "armor");
    expect(armor.thorns).toBe(1);
  });
});
