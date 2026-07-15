// Cleared-dungeon persistence: felling a finite dungeon's finale boss sets a
// persistent cleared flag and pays a conquest bounty; on re-entry the finale
// floor reads as conquered (no boss/elite, prize claimed) while the descent and
// intermediate floors keep their teeth.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { buildRegion } from "../world";
import { dynDungeonId, dungeonSpecFor } from "../worldgen/dungeons";

const EXIT = { x: 40, z: 40 };

describe("cleared-dungeon persistence", () => {
  it("strips the finale boss, elite and prize once the dungeon is cleared", () => {
    const finaleId = dynDungeonId("crypt", 123, 3, 3, EXIT);
    const flag = "cleared.dungeon.crypt.123";

    const before = buildRegion(finaleId);
    expect(before.enemies?.some((e) => e.instanceId.endsWith(".boss"))).toBe(true);
    expect(before.objects.some((o) => o.instanceId.endsWith(".prize"))).toBe(true);

    const after = buildRegion(finaleId, [flag]);
    expect(after.enemies?.some((e) => e.instanceId.endsWith(".boss"))).toBe(false);
    expect(after.enemies?.some((e) => e.instanceId.endsWith(".elite"))).toBe(false);
    expect(after.objects.some((o) => o.instanceId.endsWith(".prize"))).toBe(false);
    expect(after.objects.some((o) => o.instanceId.includes(".banner."))).toBe(false);
  });

  it("leaves intermediate floors of a cleared dungeon untouched", () => {
    // Floor 3 of a longer crawl still hosts a boss even after the finale (floor 6)
    // is conquered — the descent stays dangerous.
    const midId = dynDungeonId("crypt", 123, 3, 6, EXIT);
    const region = buildRegion(midId, ["cleared.dungeon.crypt.123"]);
    expect(region.enemies?.some((e) => e.instanceId.endsWith(".boss"))).toBe(true);
  });

  it("conquers the dungeon and pays a bounty when the finale boss dies", () => {
    const finaleId = dynDungeonId("mine", 77, 2, 2, EXIT);
    const region = buildRegion(finaleId);
    const sim = new GameSimulation(region, 1);
    const boss = region.enemies?.find((e) => e.instanceId.endsWith(".boss"));
    expect(boss).toBeTruthy();

    const coinsBefore = sim.inventory.count("item.coin");
    // Fell the boss; its death event is picked up on the next tick.
    sim.enemies.damage(boss!.instanceId, 99999);
    const evs = sim.tick();

    expect(sim.worldFlags.has("cleared.dungeon.mine.77")).toBe(true);
    expect(sim.clearedCount()).toBe(1);
    const cleared = evs.find((e) => e.type === "dungeonCleared");
    expect(cleared).toBeTruthy();
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coinsBefore);

    // Idempotent: felling nothing more never re-pays.
    const held = sim.inventory.count("item.coin");
    sim.tick();
    expect(sim.inventory.count("item.coin")).toBe(held);
  });

  it("does not clear on an intermediate boss floor or an endless descent", () => {
    // depth 3 of 6 (an intermediate boss floor) and an endless floor (maxDepth 0).
    for (const id of [dynDungeonId("crypt", 5, 3, 6, EXIT), dynDungeonId("crypt", 5, 3, 0, EXIT)]) {
      const region = buildRegion(id);
      const sim = new GameSimulation(region, 1);
      const boss = region.enemies?.find((e) => e.instanceId.endsWith(".boss"));
      if (!boss) continue;
      sim.enemies.damage(boss.instanceId, 99999);
      sim.tick();
      expect(sim.clearedCount()).toBe(0);
    }
    // Sanity: the finale spec name is well-formed for the bounty label.
    expect(dungeonSpecFor("crypt", 5, 6, 6, EXIT).name).toContain("Floor");
  });
});
