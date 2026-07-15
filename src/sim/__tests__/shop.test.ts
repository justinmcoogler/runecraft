// The general store: open by walking up, buy with coins, sell from the pack,
// and multi-cell buildings block pathing through their footprint.

import { describe, expect, it } from "vitest";
import { SHOPS } from "../../content/content";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import { buildRegion } from "../world";

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 4000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

function storeSim(): GameSimulation {
  // The shop counter lives inside the store interior region.
  const sim = new GameSimulation(buildRegion("region.town_store"), 5);
  sim.enqueue({ type: "interact", targetId: "region.town_store.counter" });
  runUntil(sim, (e) => e.type === "shopOpened");
  return sim;
}

describe("the general store", () => {
  it("opens on approach and closes when the player walks away", () => {
    const sim = storeSim();
    expect(sim.openShop()?.id).toBe("shop.general");
    sim.enqueue({ type: "moveTo", cell: { x: 2, z: 4 } });
    runUntil(sim, (e) => e.type === "shopClosed");
    expect(sim.openShop()).toBeNull();
  });

  it("buys an item when the player has coins, refuses when broke", () => {
    const sim = storeSim();
    // Broke: rejected.
    sim.enqueue({ type: "shopBuy", itemId: "item.berry.basic" });
    const rejected = sim.tick();
    expect(rejected.some((e) => e.type === "actionRejected")).toBe(true);
    expect(sim.inventory.count("item.berry.basic")).toBe(0);
    // Funded: purchase goes through at the listed price.
    const price = SHOPS["shop.general"].sells.find((o) => o.itemId === "item.berry.basic")!.price;
    sim.inventory.add("item.coin", 20);
    sim.enqueue({ type: "shopBuy", itemId: "item.berry.basic" });
    sim.tick();
    expect(sim.inventory.count("item.berry.basic")).toBe(1);
    expect(sim.inventory.count("item.coin")).toBe(20 - price);
  });

  it("sells pack items at the listed price; refuses unlisted items", () => {
    const sim = storeSim();
    sim.inventory.add("item.log.basic", 3);
    const slot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.log.basic");
    sim.enqueue({ type: "shopSell", slot });
    sim.tick();
    expect(sim.inventory.count("item.log.basic")).toBe(2);
    expect(sim.inventory.count("item.coin")).toBe(SHOPS["shop.general"].buys["item.log.basic"]);
    // The emberstone is not for sale.
    sim.inventory.add("item.gem.emberstone", 1);
    const gemSlot = sim.inventory.slots.findIndex((s) => s?.itemId === "item.gem.emberstone");
    sim.enqueue({ type: "shopSell", slot: gemSlot });
    sim.tick();
    expect(sim.inventory.count("item.gem.emberstone")).toBe(1);
  });

  it("building footprints block movement; the store door is a portal inside", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 5);
    // Greenvale's store: footprint cells and the door block, doorstep clear.
    for (const cell of [{ x: 1263, z: 1374 }, { x: 1266, z: 1376 }, { x: 1263, z: 1378 }]) {
      expect(sim.world.walkable(cell)).toBe(false); // footprint + the door itself
    }
    expect(sim.world.walkable({ x: 1263, z: 1380 })).toBe(true); // the doorstep
    sim.movement.setCellPosition({ x: 1263, z: 1380 });
    sim.enqueue({ type: "interact", targetId: "gv.storedoor.001" });
    const events = runUntil(sim, (e) => e.type === "portalEntered");
    expect(events.find((e) => e.type === "portalEntered")).toMatchObject({
      targetRegionId: "region.town_store",
    });
  });
});
