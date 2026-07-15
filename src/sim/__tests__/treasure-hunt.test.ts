// Treasure-map chains: a map in the pack marks a buried cache a good walk out;
// reaching the mark unearths coin (and sometimes the next map). Persisted.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { captureSharedState, applySharedState } from "../../save/save";
import { ENDLESS_CENTER } from "../worldgen/endless";

// unearthTreasure is private; reach it through a loose cast for the tests.
const unearth = (sim: GameSimulation): void =>
  (sim as unknown as { unearthTreasure(): void }).unearthTreasure();

describe("treasure-map chains", () => {
  it("consumes a map, marks a distant dry cache, and hints a bearing", () => {
    const sim = GameSimulation.createEndless(2024);
    // Roam out so the cache lands in interesting country.
    sim.movement.setCellPosition({ x: ENDLESS_CENTER + 2000, z: ENDLESS_CENTER + 500 });
    sim.inventory.add("item.treasure_map", 1);
    const evs = sim.tick();
    expect(sim.treasureHunt).toBeTruthy();
    expect(sim.inventory.count("item.treasure_map")).toBe(0); // consumed into the hunt
    const began = evs.find((e) => e.type === "treasureHuntBegan");
    expect(began).toBeTruthy();
    // The mark is a real distance away and not on open water.
    const t = sim.treasureHunt!;
    const here = { x: ENDLESS_CENTER + 2000, z: ENDLESS_CENTER + 500 };
    expect(Math.hypot(t.x - here.x, t.z - here.z)).toBeGreaterThan(200);
    expect(sim.world.blockAt(t)).not.toBe("water");
  });

  it("only one hunt at a time — a second map waits in the pack", () => {
    const sim = GameSimulation.createEndless(2024);
    sim.movement.setCellPosition({ x: ENDLESS_CENTER + 1500, z: ENDLESS_CENTER + 1500 });
    sim.inventory.add("item.treasure_map", 2);
    sim.tick();
    expect(sim.treasureHunt).toBeTruthy();
    expect(sim.inventory.count("item.treasure_map")).toBe(1); // the spare is untouched
  });

  it("unearths the cache when the player reaches the mark", () => {
    const sim = GameSimulation.createEndless(55);
    sim.movement.setCellPosition({ x: ENDLESS_CENTER + 3000, z: ENDLESS_CENTER + 2000 });
    sim.inventory.add("item.treasure_map", 1);
    sim.tick();
    const spot = sim.treasureHunt!;
    const coin0 = sim.inventory.count("item.coin");
    // Walk onto the marked cell.
    sim.movement.setCellPosition(spot);
    sim.tick();
    expect(sim.treasureHunt).toBeNull();
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coin0);
  });

  it("sometimes chains into another map, and never loops forever", () => {
    // Drive many unearths directly; count how often a fresh map appears, and
    // confirm the chain is finite (a run of forced unearths terminates).
    const sim = GameSimulation.createEndless(123);
    sim.movement.setCellPosition({ x: ENDLESS_CENTER + 4000, z: ENDLESS_CENTER + 4000 });
    let chains = 0;
    for (let i = 0; i < 60; i++) {
      sim.treasureHunt = { x: ENDLESS_CENTER + 4000 + i, z: ENDLESS_CENTER + 4000 };
      unearth(sim);
      if (sim.inventory.count("item.treasure_map") > 0) {
        chains++;
        sim.inventory.removeItemById("item.treasure_map", 99); // drain so the loop is controlled
      }
    }
    expect(chains).toBeGreaterThan(0); // chaining happens
    expect(chains).toBeLessThan(60); // but not on every single find
  });

  it("persists an active hunt across a save round-trip", () => {
    const sim = GameSimulation.createEndless(7);
    sim.treasureHunt = { x: 111, z: 222 };
    const shared = captureSharedState(sim);
    expect(shared.treasureHunt).toEqual({ x: 111, z: 222 });
    const fresh = GameSimulation.createEndless(7);
    applySharedState(fresh, shared);
    expect(fresh.treasureHunt).toEqual({ x: 111, z: 222 });
  });
});
