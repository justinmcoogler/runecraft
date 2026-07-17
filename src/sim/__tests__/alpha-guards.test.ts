// Playtest guards: Agility shortcuts can't be click-looped for XP, and
// Superheat pays the same ore cost as the furnace.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { makeTestRegion } from "./testRegion";
import { SHOPS } from "../../content/content";

describe("alpha exploit guards", () => {
  it("a shortcut pays Agility XP once per minute, not per click", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    expect(sim.claimShortcutXp("hop.1")).toBe(true);
    expect(sim.claimShortcutXp("hop.1")).toBe(false); // straight back over: no XP
    expect(sim.claimShortcutXp("hop.2")).toBe(true); // a different hop still pays
    sim.timeS += 61;
    expect(sim.claimShortcutXp("hop.1")).toBe(true); // cooled down
  });

  it("Superheat consumes two ore per bar, like the furnace", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.skills.xp["skill.magic"] = 1_000_000;
    sim.inventory.add("item.rune.fire", 5);
    sim.inventory.add("item.ore.iron", 1);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.ore.iron");
    sim.enqueue({ type: "superheatSlot", slot });
    sim.tick();
    expect(sim.inventory.count("item.bar.iron"), "one ore is not enough").toBe(0);
    sim.inventory.add("item.ore.iron", 1);
    sim.enqueue({ type: "superheatSlot", slot });
    sim.tick();
    expect(sim.inventory.count("item.bar.iron")).toBe(1);
    expect(sim.inventory.count("item.ore.iron")).toBe(0);
  });

  it("Mara sells Blaze Runes so Magic works from day one", () => {
    expect(SHOPS["shop.general"].sells.some((o) => o.itemId === "item.rune.fire")).toBe(true);
  });

  it("Mara sells the once-unobtainable potato and melon seeds", () => {
    const ids = SHOPS["shop.general"].sells.map((o) => o.itemId);
    expect(ids).toContain("item.seed.potato");
    expect(ids).toContain("item.seed.melon");
  });

  it("dying costs a tithe of carried coins", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.inventory.add("item.coin", 100);
    sim.damagePlayer(sim.maxHp());
    expect(sim.inventory.count("item.coin")).toBe(90);
  });

  it("smithed gear below diamond has an alchemy value (a real coin sink)", async () => {
    const { ALCH_VALUES } = await import("../../content/content");
    for (const id of ["tool.sword.bronze", "tool.sword.iron", "armor.tunic.steel", "armor.cap.mithril"]) {
      expect(ALCH_VALUES[id], `${id} should alch`).toBeGreaterThan(0);
    }
  });

  it("the curator asks before taking relics: first chat offers, second donates", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.inventory.add("item.relic.urn", 2);
    sim.events.emit({ type: "npcChat", instanceId: "village.npc.fenwick", name: "Fenwick" });
    sim.tick();
    expect(sim.inventory.count("item.relic.urn"), "first chat only offers").toBe(2);
    sim.events.emit({ type: "npcChat", instanceId: "village.npc.fenwick", name: "Fenwick" });
    sim.tick();
    expect(sim.inventory.count("item.relic.urn"), "second chat donates").toBe(0);
    expect(sim.skills.xp["skill.archaeology"]).toBeGreaterThan(0);
  });
});
