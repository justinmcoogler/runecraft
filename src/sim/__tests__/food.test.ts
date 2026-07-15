// Eating: edible items restore HP from the inventory, capped at max, and
// are consumed transactionally. Inedible items and full health are no-ops.

import { describe, expect, it } from "vitest";
import { ITEMS } from "../../content/content";
import { GameSimulation } from "../simulation";
import { makeTestRegion } from "./testRegion";

function makeSim(): GameSimulation {
  return new GameSimulation(makeTestRegion(), 7);
}

function countOf(sim: GameSimulation, itemId: string): number {
  return sim.inventory.slots.reduce((n, s) => n + (s?.itemId === itemId ? s.qty : 0), 0);
}

describe("eating food", () => {
  it("cooked fish restores its healAmount and consumes one from the stack", () => {
    const sim = makeSim();
    sim.inventory.add("item.fish.cooked", 3);
    sim.hp = 5;
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.fish.cooked");
    sim.enqueue({ type: "eatSlot", slot });
    const events = sim.tick();
    expect(sim.hp).toBe(5 + ITEMS["item.fish.cooked"].healAmount!);
    expect(countOf(sim, "item.fish.cooked")).toBe(2);
    expect(events.some((e) => e.type === "ateFood" && e.healed === 7)).toBe(true);
    expect(events.some((e) => e.type === "healthChanged")).toBe(true);
  });

  it("healing is capped at max HP and reports only the effective amount", () => {
    const sim = makeSim();
    sim.inventory.add("item.fish.cooked", 1);
    sim.hp = sim.maxHp() - 2;
    sim.enqueue({ type: "eatSlot", slot: 0 });
    const events = sim.tick();
    expect(sim.hp).toBe(sim.maxHp());
    const ate = events.find((e) => e.type === "ateFood");
    expect(ate && ate.type === "ateFood" && ate.healed).toBe(2);
  });

  it("does nothing at full health (the food is kept)", () => {
    const sim = makeSim();
    sim.inventory.add("item.berry.basic", 4);
    sim.enqueue({ type: "eatSlot", slot: 0 });
    const events = sim.tick();
    expect(countOf(sim, "item.berry.basic")).toBe(4);
    expect(events.some((e) => e.type === "ateFood")).toBe(false);
  });

  it("inedible items cannot be eaten", () => {
    const sim = makeSim();
    sim.inventory.add("item.log.basic", 2);
    sim.hp = 3;
    sim.enqueue({ type: "eatSlot", slot: 0 });
    sim.tick();
    expect(sim.hp).toBe(3);
    expect(countOf(sim, "item.log.basic")).toBe(2);
  });

  it("berries heal less than a hot meal (content sanity)", () => {
    expect(ITEMS["item.berry.basic"].healAmount!).toBeLessThan(
      ITEMS["item.fish.cooked"].healAmount!,
    );
    expect(ITEMS["item.fish.raw"].healAmount).toBeUndefined();
    expect(ITEMS["item.fish.burnt"].healAmount).toBeUndefined();
  });
});
