// Factions & renown: deeds build standing with the great factions, crossing a
// rank pays a reward, and standing persists across saves.

import { describe, expect, it } from "vitest";
import { GameSimulation, FACTIONS, REP_RANKS } from "../simulation";
import { captureSharedState, applySharedState } from "../../save/save";

describe("factions & renown", () => {
  it("names three factions and a ladder of ranks", () => {
    expect(Object.keys(FACTIONS)).toContain("order");
    expect(Object.keys(FACTIONS)).toContain("guild");
    expect(Object.keys(FACTIONS)).toContain("grove");
    expect(REP_RANKS.length).toBeGreaterThanOrEqual(4);
    expect(REP_RANKS[0].at).toBe(0);
  });

  it("builds renown and pays a reward on each rank crossing", () => {
    const sim = GameSimulation.createEndless(1);
    expect(sim.factionRank("order")).toBe(0);
    const coin0 = sim.inventory.count("item.coin");
    sim.events.drain();
    // Push past the first threshold in one deed.
    sim.adjustRep("order", REP_RANKS[1].at + 5);
    expect(sim.factionRank("order")).toBe(1);
    const evs = sim.events.drain();
    const up = evs.find((e) => e.type === "factionRankUp");
    expect(up).toBeTruthy();
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coin0);
  });

  it("does not fire a rank-up when standing stays in the same band", () => {
    const sim = GameSimulation.createEndless(1);
    sim.adjustRep("guild", REP_RANKS[1].at); // to rank 1
    sim.events.drain();
    sim.adjustRep("guild", 1); // still rank 1
    expect(sim.events.drain().some((e) => e.type === "factionRankUp")).toBe(false);
  });

  it("conquering a dungeon honours the Wardens", () => {
    const sim = GameSimulation.createEndless(1);
    const before = sim.reputation.order;
    // Drive a finale-boss kill through the public tick path.
    sim.world.region.id = "dyn_crypt_1_1_1_0_0";
    sim.world.region.enemies = [{ instanceId: "x.boss", defId: "enemy.skeleton", cell: { x: 0, z: 0 } }];
    sim.enemies.addPlacement({ instanceId: "x.boss", defId: "enemy.skeleton", cell: { x: 0, z: 0 } }, sim.rng);
    sim.enemies.damage("x.boss", 99999);
    sim.tick();
    expect(sim.reputation.order).toBeGreaterThan(before);
  });

  it("persists renown across a save round-trip", () => {
    const sim = GameSimulation.createEndless(1);
    sim.adjustRep("order", 55);
    sim.adjustRep("grove", 10);
    const shared = captureSharedState(sim);
    expect(shared.reputation).toMatchObject({ order: 55, grove: 10 });
    const fresh = GameSimulation.createEndless(1);
    applySharedState(fresh, shared);
    expect(fresh.reputation.order).toBe(55);
    expect(fresh.reputation.grove).toBe(10);
  });
});
