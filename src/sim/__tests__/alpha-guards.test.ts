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
});
